from flask import Flask, jsonify, request
from flask_socketio import SocketIO, emit, join_room, leave_room
from flask_cors import CORS
import random
import game_logic as gm_lg
from game_logic import initialize_game, apply_card_effect, check_win_condition, get_game_state_for_player, end_turn, apply_pending_action
from bot_ai import make_bot_move

app = Flask(__name__)
app.config['SECRET_KEY'] = 'your_secret_key_here' # Change this!
CORS(app, resources={r"/*": {"origins": "*"}}) # Allow CORS for frontend
# socketio = SocketIO(app, cors_allowed_origins="*")
socketio = SocketIO(app, cors_allowed_origins="*", logger=True, engineio_logger=True)

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
    target_character_id = data.get('targetCharacterId')
    target_card_indices = data.get('targetCardIndices') # New: for Swap card
    defending_card_index = data.get('defendingCardIndex') # New: for Defense card

    try:
        new_game_state = apply_card_effect(game_state, player_id, card_index, target_character_id, target_card_indices, defending_card_index)
        win_status = check_win_condition(new_game_state)
        return jsonify({'gameState': new_game_state, 'winStatus': win_status, 'message': new_game_state['message'], 'action_log': new_game_state['action_log']})
    except ValueError as e:
        return jsonify({'error': str(e)}), 400

# New API route to resolve a pending attack (after defense decision)
@app.route('/game/resolve_pending_attack', methods=['POST'])
def api_resolve_pending_attack():
    data = request.json
    game_state = data['gameState']
    player_id = data['playerId'] # The player who is defending or choosing not to
    use_defense = data['useDefense']
    defending_card_index = data.get('defendingCardIndex')

    if not game_state["pending_attack"]:
        return jsonify({'error': 'No pending attack to resolve.'}), 400
    
    if player_id != game_state["pending_attack"]["target_player_id"]:
        return jsonify({'error': 'You are not the target of this action.'}), 400

    # Re-add the attacking card to the attacker's hand if defense is successful
    attacker_player_id = game_state["pending_attack"]["player_id"]
    attacking_card_data = next((card for card in gm_lg.ACTION_CARD_TEMPLATES if card["name"] == game_state["pending_attack"]["card_name"]), None)
    
    try:
        if use_defense:
            # Call apply_card_effect with defending_card_index to handle defense
            updated_game_state = apply_card_effect(game_state, player_id, defending_card_index, None, None, defending_card_index=defending_card_index)
            # Re-add the attacking card to the attacker's hand as it was nullified
            if attacking_card_data:
                updated_game_state["players"][attacker_player_id]["hand"].append(attacking_card_data)
                updated_game_state["players"][attacker_player_id]["has_defense_card_in_hand"] = any(card["type"] == "defense" for card in updated_game_state["players"][attacker_player_id]["hand"]) # Update defense status
            
            # Since defense was used, it's still the attacker's turn
            updated_game_state["current_turn"] = attacker_player_id
            updated_game_state["message"] = updated_game_state["message"] + f" {game_state['players'][attacker_player_id]['player_name']}'s turn continues."
        else: # Player chose not to defend, apply the original pending action
            updated_game_state = apply_pending_action(game_state, attacker_player_id, attacking_card_data, game_state["pending_attack"]["target_character_id"], game_state["pending_attack"]["target_card_indices"])
            # Since action was applied, it's now the defender's turn (attacker's turn ends implicitly after action resolution)
            updated_game_state["current_turn"] = player_id # It's now the defender's turn
            updated_game_state["message"] = updated_game_state["message"] + f" It's {game_state['players'][player_id]['player_name']}'s turn."
            
        win_status = check_win_condition(updated_game_state)
        return jsonify({'gameState': updated_game_state, 'winStatus': win_status, 'message': updated_game_state['message'], 'action_log': updated_game_state['action_log']})
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
        return jsonify({'gameState': updated_game_state, 'winStatus': win_status, 'message': updated_game_state['message'], 'action_log': updated_game_state['action_log']})
    except ValueError as e:
        return jsonify({'error': str(e)}), 400

@app.route('/game/bot_move', methods=['POST'])
def api_bot_move():
    data = request.json
    game_state = data['gameState']
    
    updated_game_state = make_bot_move(game_state)
    win_status = check_win_condition(updated_game_state)
    
    return jsonify({'gameState': updated_game_state, 'winStatus': win_status, 'message': updated_game_state['message'], 'action_log': updated_game_state['action_log']})

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
            'current_turn': initial_game_state['current_turn'],
            'action_log': initial_game_state['action_log'] 
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
    target_character_id = data.get('target_character_id')
    target_card_indices = data.get('target_card_indices') # New: for Swap card
    defending_card_index = data.get('defendingCardIndex') # New: for Defense card

    room_data = game_rooms.get(room_id)
    if not room_data:
        return emit('error', {'message': 'Room not found.'})

    current_game_state = room_data['game_state']

    if player_id != current_game_state['current_turn'] and defending_card_index is None:
        return emit('error', {'message': 'Not your turn to play a card.'}, room=request.sid)

    try:
        updated_game_state = apply_card_effect(current_game_state, player_id, card_index, target_character_id, target_card_indices, defending_card_index)
        game_rooms[room_id]['game_state'] = updated_game_state

        win_status = check_win_condition(updated_game_state)
        
        emit('game_update', {
            'player1_game_state': get_game_state_for_player(updated_game_state, 'player1'),
            'player2_game_state': get_game_state_for_player(updated_game_state, 'player2'),
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

# New Socket.IO event to resolve pending attack
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

    if not current_game_state["pending_attack"] or current_game_state["pending_attack"]["target_player_id"] != player_id:
        return emit('error', {'message': 'No pending action targeting you to resolve.'}, room=request.sid)

    try:
        attacker_player_id = current_game_state["pending_attack"]["player_id"]
        attacking_card_name = current_game_state["pending_attack"]["card_name"]
        
        # Find the attacking card data from templates (since it was removed from hand)
        attacking_card_data = next((card for card in gm_lg.ACTION_CARD_TEMPLATES if card["name"] == attacking_card_name), None)
        
        if use_defense:
            updated_game_state = apply_card_effect(current_game_state, player_id, defending_card_index, None, None, defending_card_index=defending_card_index)
            
            # Re-add the attacking card to the attacker's hand as it was nullified by defense
            if attacking_card_data:
                updated_game_state["players"][attacker_player_id]["hand"].append(attacking_card_data)
                # Re-check defense card status for attacker as well
                updated_game_state["players"][attacker_player_id]["has_defense_card_in_hand"] = any(c["type"] == "defense" for c in updated_game_state["players"][attacker_player_id]["hand"])

            updated_game_state["current_turn"] = attacker_player_id # It remains attacker's turn
            updated_game_state["message"] = updated_game_state["message"] + f" It is still {game_state['players'][attacker_player_id]['player_name']}'s turn."
            
        else: # Player chose not to defend
            updated_game_state = apply_pending_action(current_game_state, attacker_player_id, attacking_card_data,
                                                      current_game_state["pending_attack"]["target_character_id"],
                                                      current_game_state["pending_attack"]["target_card_indices"])
            updated_game_state["current_turn"] = player_id # It becomes defender's turn
            updated_game_state["message"] = updated_game_state["message"] + f" It's {game_state['players'][player_id]['player_name']}'s turn."

        updated_game_state["pending_attack"] = None # Clear the pending attack state
        game_rooms[room_id]['game_state'] = updated_game_state

        win_status = check_win_condition(updated_game_state)
        
        emit('game_update', {
            'player1_game_state': get_game_state_for_player(updated_game_state, 'player1'),
            'player2_game_state': get_game_state_for_player(updated_game_state, 'player2'),
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
            'player1_game_state': get_game_state_for_player(updated_game_state, 'player1'),
            'player2_game_state': get_game_state_for_player(updated_game_state, 'player2'),
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
    socketio.run(app, debug=True, port=5000)
    # socketio.run(app, debug=True, port=5000, allow_unsafe_werkzeug=True)