from flask import Flask, jsonify, request
from flask_socketio import SocketIO, emit, join_room, leave_room
from flask_cors import CORS
import random
from game_logic import initialize_game, apply_card_effect, check_win_condition, get_game_state_for_player, end_turn
from bot_ai import make_bot_move

app = Flask(__name__)
app.config['SECRET_KEY'] = 'your_secret_key_here' # Change this!
CORS(app, resources={r"/*": {"origins": "*"}}) # Allow CORS for frontend
socketio = SocketIO(app, cors_allowed_origins="*")

game_rooms = {}
next_room_id = 1000

# --- API Routes (for Single Player) ---
@app.route('/')
def home():
    return "Welcome to Sleepy Game Backend!"

@app.route('/game/initialize', methods=['POST'])
def api_initialize_game():
    game_state = initialize_game()
    return jsonify(game_state)

@app.route('/game/apply_card', methods=['POST'])
def api_apply_card():
    data = request.json
    game_state = data['gameState']
    player_id = data['playerId']
    card_index = data['cardIndex']
    target_character_id = data['targetCharacterId']

    try:
        new_game_state = apply_card_effect(game_state, player_id, card_index, target_character_id)
        win_status = check_win_condition(new_game_state)
        return jsonify({'gameState': new_game_state, 'winStatus': win_status, 'message': new_game_state['message']})
    except ValueError as e:
        return jsonify({'error': str(e)}), 400

@app.route('/game/end_turn', methods=['POST'])
def api_end_turn():
    data = request.json
    game_state = data['gameState']
    player_id = data['playerId']

    try:
        updated_game_state = end_turn(game_state, player_id)
        win_status = check_win_condition(updated_game_state)
        return jsonify({'gameState': updated_game_state, 'winStatus': win_status, 'message': updated_game_state['message']})
    except ValueError as e:
        return jsonify({'error': str(e)}), 400

@app.route('/game/bot_move', methods=['POST'])
def api_bot_move():
    data = request.json
    game_state = data['gameState']
    
    updated_game_state = make_bot_move(game_state)
    win_status = check_win_condition(updated_game_state)
    
    return jsonify({'gameState': updated_game_state, 'winStatus': win_status, 'message': updated_game_state['message']})


# --- WebSocket Events (for Multiplayer) ---
@socketio.on('connect')
def handle_connect():
    print(f'Client connected: {request.sid}')

@socketio.on('disconnect')
def handle_disconnect():
    print(f'Client disconnected: {request.sid}')
    for room_id, room_data in list(game_rooms.items()):
        if room_data.get('player1_sid') == request.sid:
            socketio.emit('player_disconnected', {'message': 'Player 1 disconnected'}, room=room_id)
            del game_rooms[room_id]
            print(f"Room {room_id} disbanded due to Player 1 disconnect.")
        elif room_data.get('player2_sid') == request.sid:
            socketio.emit('player_disconnected', {'message': 'Player 2 disconnected'}, room=room_id)
            del game_rooms[room_id]
            print(f"Room {room_id} disbanded due to Player 2 disconnect.")


@socketio.on('create_room')
def create_room():
    global next_room_id
    room_id = str(next_room_id)
    next_room_id += 1
    game_rooms[room_id] = {
        'player1_sid': request.sid,
        'player2_sid': None,
        'game_state': None,
        'turn': 'player1'
    }
    join_room(room_id)
    emit('room_created', {'room_id': room_id, 'player_id': 'player1'})
    print(f'Room {room_id} created by {request.sid} as Player 1')

@socketio.on('join_room')
def join_game_room(data):
    room_id = data.get('room_id')
    if room_id in game_rooms and game_rooms[room_id]['player2_sid'] is None:
        game_rooms[room_id]['player2_sid'] = request.sid
        join_room(room_id)
        
        initial_game_state = initialize_game()
        game_rooms[room_id]['game_state'] = initial_game_state
        
        emit('room_joined', {'room_id': room_id, 'player_id': 'player2'}, room=request.sid)
        
        emit('game_start', {
            'player1_game_state': get_game_state_for_player(initial_game_state, 'player1'),
            'player2_game_state': get_game_state_for_player(initial_game_state, 'player2'),
            'current_turn': game_rooms[room_id]['turn']
        }, room=room_id)
        
        print(f'Player {request.sid} joined room {room_id} as Player 2. Game starting.')
    else:
        emit('join_error', {'message': 'Room not found or full.'})
        print(f'Join failed for {request.sid} on room {room_id}')

@socketio.on('play_card')
def handle_play_card(data):
    room_id = data['room_id']
    player_id = data['player_id']
    card_index = data['card_index']
    target_character_id = data['target_character_id']

    room_data = game_rooms.get(room_id)
    if not room_data:
        return emit('error', {'message': 'Room not found.'})

    current_game_state = room_data['game_state']
    
    # Ensure it's the player's turn to play a card
    if (player_id == 'player1' and request.sid != room_data['player1_sid']) or \
       (player_id == 'player2' and request.sid != room_data['player2_sid']) or \
       (player_id != current_game_state['current_turn']): # Ensure it's the current player's turn
        return emit('error', {'message': 'Not your turn or invalid player to play card.'})

    try:
        new_game_state = apply_card_effect(current_game_state, player_id, card_index, target_character_id)
        win_status = check_win_condition(new_game_state)
        
        game_rooms[room_id]['game_state'] = new_game_state # Update global state
        
        # Do NOT switch turn here. Turn is switched by 'end_turn' event.

        # Send updated game states to both players
        emit('game_update', {
            'player1_game_state': get_game_state_for_player(new_game_state, 'player1'),
            'player2_game_state': get_game_state_for_player(new_game_state, 'player2'),
            'current_turn': new_game_state['current_turn'], # Still the same player's turn
            'win_status': win_status,
            'message': new_game_state['message']
        }, room=room_id)

        print(f'Player {player_id} played card in room {room_id}.')

    except ValueError as e:
        emit('error', {'message': str(e)})

@socketio.on('end_turn')
def handle_end_turn(data):
    room_id = data['room_id']
    player_id = data['player_id']

    room_data = game_rooms.get(room_id)
    if not room_data:
        return emit('error', {'message': 'Room not found.'})

    current_game_state = room_data['game_state']

    if (player_id == 'player1' and request.sid != room_data['player1_sid']) or \
       (player_id == 'player2' and request.sid != room_data['player2_sid']) or \
       (player_id != current_game_state['current_turn']):
        return emit('error', {'message': 'Not your turn or invalid player to end turn.'})

    try:
        updated_game_state = end_turn(current_game_state, player_id)
        win_status = check_win_condition(updated_game_state)

        game_rooms[room_id]['game_state'] = updated_game_state # Update global state
        
        emit('game_update', {
            'player1_game_state': get_game_state_for_player(updated_game_state, 'player1'),
            'player2_game_state': get_game_state_for_player(updated_game_state, 'player2'),
            'current_turn': updated_game_state['current_turn'], # Now it's the next player's turn
            'win_status': win_status,
            'message': updated_game_state['message']
        }, room=room_id)

        print(f'Player {player_id} ended turn in room {room_id}. New turn: {updated_game_state["current_turn"]}')

    except ValueError as e:
        emit('error', {'message': str(e)})

if __name__ == '__main__':
    socketio.run(app, debug=True, port=5000)