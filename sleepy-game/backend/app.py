# sleepy-game/backend/app.py
from flask import Flask, jsonify, request
from flask_socketio import SocketIO, emit, join_room, leave_room
from flask_cors import CORS # Import CORS

import random
import game_logic as gm_lg
from game_logic import initialize_game, apply_card_effect, check_win_condition, get_game_state_for_player, end_turn, apply_pending_action
import bot_ai # Import the bot_ai module

import eventlet 
import eventlet.wsgi

eventlet.monkey_patch() 

app = Flask(__name__)
app.config['SECRET_KEY'] = 'a_very_secret_key_for_sleepy_game_development_only' 

# Initialize CORS for your Flask app for HTTP routes
CORS(app, resources={r"/*": {"origins": ["http://localhost:3000"]}})

socketio = SocketIO(
    app, 
    logger=True, 
    engineio_logger=True, 
    ping_interval=25, 
    ping_timeout=60,
    cors_allowed_origins=["http://localhost:3000"] # This is for Socket.IO connections
)

game_rooms = {}
next_room_id = 1000

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
    target_character_id = data.get('targetCharacterId')
    target_card_indices = data.get('targetCardIndices') 
    defending_card_index = data.get('defendingCardIndex') 

    try: 
        new_game_state = apply_card_effect(game_state, player_id, card_index, target_character_id, target_card_indices, defending_card_index)
        win_status = check_win_condition(new_game_state)
        
        new_game_state_with_flags = {
            'gameState': new_game_state,
            'winStatus': win_status,
            'message': new_game_state['message'],
            'action_log': new_game_state['action_log'],
            'swap_in_progress': new_game_state.get('swap_in_progress', False),
            'selected_cards_for_swap': new_game_state.get('selected_cards_for_swap', []),
            'pending_attack': new_game_state.get('pending_attack')
        }
        return jsonify(new_game_state_with_flags)
    except ValueError as e:
        return jsonify({'error': str(e)}), 400

@app.route('/game/resolve_pending_attack', methods=['POST'])
def api_resolve_pending_attack():
    data = request.json
    game_state = data['gameState']
    player_id = data['playerId'] 
    use_defense = data['useDefense']
    defending_card_index = data.get('defendingCardIndex')

    if not game_state["pending_attack"]:
        return jsonify({'error': 'No pending attack to resolve.'}), 400
    
    if player_id != game_state["pending_attack"]["target_player_id"]:
        return jsonify({'error': 'You are not the target of this action.'}), 400

    attacker_player_id = game_state["pending_attack"]["player_id"]
    attacking_card_name = game_state["pending_attack"]["card_name"]
    attacking_card_data = next((card for card in gm_lg.ACTION_CARD_TEMPLATES if card["name"] == attacking_card_name), None)
    
    try:
        updated_game_state = dict(game_state)

        if use_defense:
            updated_game_state = gm_lg.apply_card_effect(updated_game_state, player_id, defending_card_index, None, None, defending_card_index=defending_card_index)
            
        else:
            updated_game_state = gm_lg.apply_pending_action(updated_game_state, attacker_player_id, attacking_card_data, 
                                                      game_state["pending_attack"]["target_character_id"], 
                                                      game_state["pending_attack"]["target_card_indices"])
            
        updated_game_state["pending_attack"] = None 
        updated_game_state["swap_in_progress"] = False 
        updated_game_state["selected_cards_for_swap"] = []

        win_status = check_win_condition(updated_game_state)
        return jsonify({
            'gameState': updated_game_state, 
            'winStatus': win_status, 
            'message': updated_game_state['message'], 
            'action_log': updated_game_state['action_log'],
            'swap_in_progress': updated_game_state.get('swap_in_progress', False),
            'selected_cards_for_swap': updated_game_state.get('selected_cards_for_swap', []),
            'pending_attack': updated_game_state.get('pending_attack')
        })
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
        
        updated_game_state_with_flags = {
            'gameState': updated_game_state,
            'winStatus': win_status,
            'message': updated_game_state['message'],
            'action_log': updated_game_state['action_log'],
            'swap_in_progress': updated_game_state.get('swap_in_progress', False),
            'selected_cards_for_swap': updated_game_state.get('selected_cards_for_swap', []),
            'pending_attack': updated_game_state.get('pending_attack')
        }
        return jsonify(updated_game_state_with_flags)
    except ValueError as e:
        return jsonify({'error': str(e)}), 400

@app.route('/game/bot_move', methods=['POST'])
def api_bot_move():
    data = request.json
    game_state = data['gameState']
    
    updated_game_state = bot_ai.make_bot_move(game_state) # Corrected: Call make_bot_move from bot_ai
    win_status = check_win_condition(updated_game_state)
    
    updated_game_state_with_flags = {
        'gameState': updated_game_state,
        'winStatus': win_status,
        'message': updated_game_state['message'],
        'action_log': updated_game_state['action_log'],
        'swap_in_progress': updated_game_state.get('swap_in_progress', False),
        'selected_cards_for_swap': updated_game_state.get('selected_cards_for_swap', []),
        'pending_attack': updated_game_state.get('pending_attack')
    }
    return jsonify(updated_game_state_with_flags)

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
            if room_id in game_rooms:
                del game_rooms[room_id]
            print(f"Room {room_id} disbanded due to Player 1 disconnect.")
            break 
        elif room_data.get('player2_sid') == request.sid:
            socketio.emit('player_disconnected', {'message': 'Player 2 disconnected'}, room=room_id)
            if room_id in game_rooms:
                del game_rooms[room_id]
            print(f"Room {room_id} disbanded due to Player 2 disconnect.")
            break 


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
    client_sid = request.sid 

    if room_id in game_rooms and game_rooms[room_id]['player2_sid'] is None:
        game_rooms[room_id]['player2_sid'] = client_sid
        join_room(room_id)
        
        initial_game_state = gm_lg.initialize_game()
        game_rooms[room_id]['game_state'] = initial_game_state
        
        initial_game_state['players_sids'] = {
            'player1': {'id': 'player1', 'sid': game_rooms[room_id]['player1_sid']},
            'player2': {'id': 'player2', 'sid': game_rooms[room_id]['player2_sid']}
        }

        emit('room_joined', {'room_id': room_id, 'player_id': 'player2'}, room=client_sid)

        socketio.emit('game_start', {
            'player1_game_state': gm_lg.get_game_state_for_player(initial_game_state, 'player1'),
            'player2_game_state': gm_lg.get_game_state_for_player(initial_game_state, 'player2'),
            'current_turn': initial_game_state['current_turn'],
            'message': initial_game_state['message'], 
            'action_log': initial_game_state['action_log'],
            'room_id': room_id, 
            'players_sids': initial_game_state['players_sids'] 
        }, room=room_id) 
        
        print(f'Player {client_sid} joined room {room_id} as Player 2. Game starting.')
    else:
        emit('join_error', {'message': 'Room not found or full.'})
        print(f'Join failed for {client_sid} on room {room_id}')

@socketio.on('play_card')
def handle_play_card(data):
    room_id = data['room_id']
    player_id = data['player_id']
    card_index = data['card_index']
    target_character_id = data.get('target_character_id') 
    target_card_indices = data.get('target_card_indices') 
    defending_card_index = data.get('defendingCardIndex') 

    # Add print statements here for debugging incoming data
    print(f"Received play_card data (from {request.sid}): player_id={player_id}, card_index={card_index}, target_character_id={target_character_id}, target_card_indices={target_card_indices}, defending_card_index={defending_card_index}")
 
    room_data = game_rooms.get(room_id)
    if not room_data:
        return emit('error', {'message': 'Room not found.'})

    current_game_state = room_data['game_state']

    if player_id != current_game_state['current_turn'] and current_game_state.get('pending_attack') is None:
        return emit('error', {'message': 'Not your turn to play a card.'}, room=request.sid)

    try:
        updated_game_state = gm_lg.apply_card_effect(current_game_state, player_id, card_index, target_character_id, target_card_indices, defending_card_index)
        game_rooms[room_id]['game_state'] = updated_game_state

        win_status = check_win_condition(updated_game_state)
        
        emit('game_update', {
            'player1_game_state': gm_lg.get_game_state_for_player(updated_game_state, 'player1'),
            'player2_game_state': gm_lg.get_game_state_for_player(updated_game_state, 'player2'),
            'current_turn': updated_game_state['current_turn'],
            'win_status': win_status,
            'message': updated_game_state['message'],
            'action_log': updated_game_state['action_log'],
            'swap_in_progress': updated_game_state.get('swap_in_progress', False), 
            'selected_cards_for_swap': updated_game_state.get('selected_cards_for_swap', []), 
            'pending_attack': updated_game_state.get('pending_attack') 
        }, room=room_id)

        if win_status["game_over"]:
            print(f"Game over in room {room_id}. Winner: {win_status['winner']}")
        else:
            print(f"Player {player_id} played card in room {room_id}. Message: {updated_game_state['message']}")

    except ValueError as e:
        emit('error', {'message': str(e)}, room=request.sid)

@socketio.on('resolve_pending_attack')
def handle_resolve_pending_attack(data):
    room_id = data['room_id']
    player_id = data['player_id'] 
    use_defense = data['useDefense']
    defending_card_index = data.get('defendingCardIndex')

    room_data = game_rooms.get(room_id)
    if not room_data:
        return emit('error', {'message': 'Room not found.'})

    current_game_state = room_data['game_state']

    if not current_game_state["pending_attack"]:
        return emit('error', {'message': 'No pending attack to resolve.'})
    
    if player_id != current_game_state["pending_attack"]["target_player_id"]:
        return emit('error', {'message': 'You are not the target of this action.'}, room=request.sid)

    attacker_player_id = current_game_state["pending_attack"]["player_id"]
    attacking_card_name = current_game_state["pending_attack"]["card_name"]
    
    attacking_card_data = next((card for card in gm_lg.ACTION_CARD_TEMPLATES if card["name"] == attacking_card_name), None)
    
    try:
        updated_game_state = dict(current_game_state)

        if use_defense:
            updated_game_state = gm_lg.apply_card_effect(updated_game_state, player_id, defending_card_index, None, None, defending_card_index=defending_card_index)
            
        else:
            updated_game_state = gm_lg.apply_pending_action(updated_game_state, attacker_player_id, attacking_card_data,
                                                      current_game_state["pending_attack"]["target_character_id"],
                                                      current_game_state["pending_attack"]["target_card_indices"])
            
        updated_game_state["pending_attack"] = None 
        updated_game_state["swap_in_progress"] = False 
        updated_game_state["selected_cards_for_swap"] = []
        game_rooms[room_id]['game_state'] = updated_game_state

        win_status = check_win_condition(updated_game_state)
        
        emit('game_update', {
            'player1_game_state': gm_lg.get_game_state_for_player(updated_game_state, 'player1'),
            'player2_game_state': gm_lg.get_game_state_for_player(updated_game_state, 'player2'),
            'current_turn': updated_game_state['current_turn'],
            'win_status': win_status,
            'message': updated_game_state['message'],
            'action_log': updated_game_state['action_log'],
            'swap_in_progress': updated_game_state.get('swap_in_progress', False),
            'selected_cards_for_swap': updated_game_state.get('selected_cards_for_swap', []),
            'pending_attack': updated_game_state.get('pending_attack')
        }, room=room_id)

        if win_status["game_over"]:
            print(f"Game over in room {room_id}. Winner: {win_status['winner']}")
        else:
            print(f"Player {player_id} resolved defense in room {room_id}.")

    except ValueError as e:
        emit('error', {'message': str(e)}, room=request.sid)

@socketio.on('end_turn')
def handle_end_turn(data):
    room_id = data['room_id']
    player_id = data['player_id']

    room_data = game_rooms.get(room_id)
    if not room_data:
        return emit('error', {'message': 'Room not found.'})

    current_game_state = room_data['game_state']

    if player_id != current_game_state['current_turn']:
        return emit('error', {'message': 'Not your turn to end.'}, room=request.sid)

    try:
        updated_game_state = end_turn(current_game_state, player_id)
        game_rooms[room_id]['game_state'] = updated_game_state

        win_status = check_win_condition(updated_game_state)

        emit('game_update', {
            'player1_game_state': gm_lg.get_game_state_for_player(updated_game_state, 'player1'),
            'player2_game_state': gm_lg.get_game_state_for_player(updated_game_state, 'player2'),
            'current_turn': updated_game_state['current_turn'],
            'win_status': win_status,
            'message': updated_game_state['message'],
            'action_log': updated_game_state['action_log'],
            'swap_in_progress': updated_game_state.get('swap_in_progress', False),
            'selected_cards_for_swap': updated_game_state.get('selected_cards_for_swap', []),
            'pending_attack': updated_game_state.get('pending_attack')
        }, room=room_id)

        if win_status["game_over"]:
            print(f"Game over in room {room_id}. Winner: {win_status['winner']}")
        else:
            print(f"Player {player_id} ended turn in room {room_id}.")

    except ValueError as e:
        emit('error', {'message': str(e)}, room=request.sid)


if __name__ == '__main__':
    print("Starting server with Eventlet...")
    eventlet.wsgi.server(eventlet.listen(('127.0.0.1', 5000)), app)