from flask import Flask, jsonify, request
from flask_socketio import SocketIO, emit, join_room, leave_room
from flask_cors import CORS
import random
from game_logic import initialize_game, apply_card_effect, check_win_condition, get_game_state_for_player, end_turn, MAX_HAND_SIZE
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
    target_character_id = data.get('targetCharacterId') 
    selected_card_indices_from_opponent = data.get('selectedCardIndicesFromOpponent')
    is_countering_theft = data.get('isCounteringTheft', False)
    is_theft_cancellation = data.get('isTheftCancellation', False) # New parameter
    
    try:
        new_game_state = apply_card_effect(game_state, player_id, card_index, target_character_id, selected_card_indices_from_opponent, is_countering_theft, is_theft_cancellation)
        win_status = check_win_condition(new_game_state)
        # ส่ง action_log กลับไปด้วย
        return jsonify({'gameState': new_game_state, 'winStatus': win_status, 'message': new_game_state['message'], 'action_log': new_game_state['action_log']})
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
        # ส่ง action_log กลับไปด้วย
        return jsonify({'gameState': updated_game_state, 'winStatus': win_status, 'message': updated_game_state['message'], 'action_log': updated_game_state['action_log']})
    except ValueError as e:
        return jsonify({'error': str(e)}), 400

@app.route('/game/bot_move', methods=['POST'])
def api_bot_move():
    data = request.json
    game_state = data['gameState']
    
    updated_game_state = make_bot_move(game_state)
    win_status = check_win_condition(updated_game_state)
    
    # ส่ง action_log กลับไปด้วย
    return jsonify({'gameState': updated_game_state, 'winStatus': win_status, 'message': updated_game_state['message'], 'action_log': updated_game_state['action_log']})

# API endpoint for Thief card to initiate the theft process (for Single Player)
@app.route('/game/theft_attempt_initiate', methods=['POST'])
def api_theft_attempt_initiate():
    data = request.json
    game_state = data['gameState']
    player_id = data['playerId']
    thief_card_index = data['cardIndex']
    
    try:
        # Call apply_card_effect for Theif card, which only sets theft_in_progress state
        new_game_state = apply_card_effect(game_state, player_id, thief_card_index)
        
        # Get game state for the player who initiated theft (thief_player_id)
        # This will include opponent's hand due to theft_in_progress state
        thief_player_game_state = get_game_state_for_player(new_game_state, player_id)

        return jsonify({
            'gameState': thief_player_game_state, 
            'message': new_game_state['message'],
            'thiefAttemptInitiated': True,
            'action_log': new_game_state['action_log'] # ส่ง action_log กลับไปด้วย
        })
    except ValueError as e:
        return jsonify({'error': str(e)}), 400


# API endpoint to handle response to theft attempt (for single player)
@app.route('/game/respond_to_theft', methods=['POST'])
def api_respond_to_theft():
    data = request.json
    game_state = data['gameState']
    target_player_id = data['targetPlayerId'] # Player who is responding to theft
    response_type = data['responseType'] # 'use_anti_theft' or 'no_response' or 'thief_cancel'
    anti_theft_card_index = data.get('antiTheftCardIndex') # Optional: if using anti-theft card
    thief_player_id = data.get('thiefPlayerId') # Needed for thief_cancel
    thief_card_index = data.get('thiefCardIndex') # Needed for thief_cancel

    current_game_state = dict(game_state) # Create a mutable copy

    try:
        if response_type == 'use_anti_theft':
            if not current_game_state["theft_in_progress"] or current_game_state["theft_in_progress"]["target_player_id"] != target_player_id:
                raise ValueError("No active theft attempt targeting this player.")
            updated_game_state = apply_card_effect(current_game_state, target_player_id, anti_theft_card_index, is_countering_theft=True)
            
        elif response_type == 'no_response':
            if not current_game_state["theft_in_progress"] or current_game_state["theft_in_progress"]["target_player_id"] != target_player_id:
                raise ValueError("No active theft attempt targeting this player.")
            
            thief_player_id_in_progress = current_game_state["theft_in_progress"]["thief_player_id"]
            thief_card_index_in_progress = current_game_state["theft_in_progress"]["thief_card_index"]
            
            selected_by_thief = current_game_state["theft_in_progress"].get("selected_card_indices_for_thief", [])
            
            # Here, we need to apply the actual steal from the perspective of the thief.
            # The thief card was "used" but not "removed" from hand by apply_card_effect
            # during theft initiation. So, we remove it here first.
            
            # Ensure the thief card is still at the stored index before popping
            if thief_card_index_in_progress >= 0 and thief_card_index_in_progress < len(current_game_state["players"][thief_player_id_in_progress]["hand"]) and \
               current_game_state["players"][thief_player_id_in_progress]["hand"][thief_card_index_in_progress]["type"] == "theif":
                current_game_state["players"][thief_player_id_in_progress]["hand"].pop(thief_card_index_in_progress)
            else:
                print(f"Warning: Thief card not found for removal for player {thief_player_id_in_progress} at index {thief_card_index_in_progress} during no_response.")
                # Fallback: if card is already gone, proceed anyway but log.

            updated_game_state, stolen_count = current_game_state, 0
            if selected_by_thief: # Only attempt steal if thief actually selected cards
                updated_game_state, stolen_count = game_logic.steal_cards_from_opponent(current_game_state, thief_player_id_in_progress, selected_by_thief)
                # Message and log handled by steal_cards_from_opponent
            else:
                updated_game_state["message"] = f"{game_state['players'][thief_player_id_in_progress]['player_name']}'s theft was successful (no cards selected)."
                updated_game_state["action_log"].append(updated_game_state["message"]) # Log
            
            updated_game_state["theft_in_progress"] = None # Reset theft state

        elif response_type == 'thief_cancel': # Thief wants to cancel the theft attempt
            updated_game_state = apply_card_effect(updated_game_state, thief_player_id_in_progress, thief_card_index_in_progress, is_theft_cancellation=True)
            # theft_in_progress is cleared by apply_card_effect

        else:
            raise ValueError("Invalid response type to theft.")
        
        win_status = check_win_condition(updated_game_state)
        # ส่ง action_log กลับไปด้วย
        return jsonify({'gameState': updated_game_state, 'winStatus': win_status, 'message': updated_game_state['message'], 'action_log': updated_game_state['action_log']})

    except ValueError as e:
        return jsonify({'error': str(e)}), 400


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
            'action_log': initial_game_state['action_log'] # ส่ง action_log ไปด้วย
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
    selected_card_indices_from_opponent = data.get('selected_card_indices_from_opponent')

    room_data = game_rooms.get(room_id)
    if not room_data:
        return emit('error', {'message': 'Room not found.'})

    current_game_state = room_data['game_state']

    if player_id != current_game_state['current_turn']:
        return emit('error', {'message': 'Not your turn to play a card.'}, room=request.sid)

    try:
        updated_game_state = apply_card_effect(current_game_state, player_id, card_index, target_character_id, selected_card_indices_from_opponent)
        game_rooms[room_id]['game_state'] = updated_game_state

        win_status = check_win_condition(updated_game_state)
        
        emit('game_update', {
            'player1_game_state': get_game_state_for_player(updated_game_state, 'player1'),
            'player2_game_state': get_game_state_for_player(updated_game_state, 'player2'),
            'current_turn': updated_game_state['current_turn'],
            'win_status': win_status,
            'message': updated_game_state['message'],
            'action_log': updated_game_state['action_log'] # ส่ง action_log ไปด้วย
        }, room=room_id)

        if win_status["game_over"]:
            print(f"Game over in room {room_id}. Winner: {win_status['winner']}")
        else:
            print(f"Player {player_id} played card in room {room_id}. Message: {updated_game_state['message']}")

    except ValueError as e:
        emit('error', {'message': str(e)}, room=request.sid)


# New: WebSocket event to initiate a theft attempt (Thief card used)
@socketio.on('initiate_theft_attempt')
def handle_initiate_theft_attempt(data):
    room_id = data['room_id']
    thief_player_id = data['player_id']
    thief_card_index = data['card_index']
    
    room_data = game_rooms.get(room_id)
    if not room_data:
        return emit('error', {'message': 'Room not found.'})

    current_game_state = room_data['game_state']

    if thief_player_id != current_game_state['current_turn']:
        return emit('error', {'message': 'Not your turn to initiate theft.'}, room=request.sid)
    
    try:
        # Call apply_card_effect for Theif card, which only sets theft_in_progress state
        new_game_state = apply_card_effect(current_game_state, thief_player_id, thief_card_index)
        game_rooms[room_id]['game_state'] = new_game_state # Update global state
        
        target_player_id = new_game_state["theft_in_progress"]["target_player_id"]
        
        # Inform the thief about the state change (they are waiting for opponent's response)
        emit('game_update', {
            'player1_game_state': get_game_state_for_player(new_game_state, 'player1'),
            'player2_game_state': get_game_state_for_player(new_game_state, 'player2'),
            'current_turn': new_game_state['current_turn'],
            'win_status': check_win_condition(new_game_state),
            'message': new_game_state['message'],
            'action_log': new_game_state['action_log'] # ส่ง action_log ไปด้วย
        }, room=room_data[f'{thief_player_id}_sid'])

        # Notify the target player about the theft attempt
        target_player_socket_id = room_data[f'{target_player_id}_sid']
        
        # Get target player's view including their own hand to check for anti-theft cards
        target_player_game_state_view = get_game_state_for_player(new_game_state, target_player_id)
        
        # Filter for anti_theft cards in target player's hand, and get their original index
        anti_theft_cards_info = [
            {'index': i, 'name': card['name'], 'type': card['type'], 'cssClass': card['cssClass']}
            for i, card in enumerate(target_player_game_state_view['players'][target_player_id]['hand'])
            if card['type'] == 'anti_theft'
        ]

        emit('theft_attempt', {
            'message': f"{game_rooms[room_id]['game_state']['players'][thief_player_id]['player_name']} is trying to steal your cards! Do you want to use an anti-theft card?",
            'anti_theft_cards': anti_theft_cards_info, # Send available anti-theft cards
            'thief_player_id': thief_player_id,
            'thief_card_index': thief_card_index # Pass thief card index
        }, room=target_player_socket_id)

        print(f"Theft initiated by {thief_player_id} against {target_player_id} in room {room_id}.")

    except ValueError as e:
        emit('error', {'message': str(e)}, room=request.sid)

# New: WebSocket event for the target player to respond to a theft attempt
@socketio.on('respond_to_theft')
def handle_respond_to_theft(data):
    room_id = data['room_id']
    target_player_id = data['player_id'] # The player who is responding (the one being stolen from)
    response_type = data['response_type'] # 'use_anti_theft', 'no_response', or 'thief_cancel'
    anti_theft_card_index = data.get('anti_theft_card_index') # Optional
    thief_player_id_data = data.get('thief_player_id') # For thief_cancel only
    thief_card_index_data = data.get('thief_card_index') # For thief_cancel only
    
    room_data = game_rooms.get(room_id)
    if not room_data:
        return emit('error', {'message': 'Room not found.'})

    current_game_state = room_data['game_state']

    if response_type != 'thief_cancel': # Regular response from target
        if not current_game_state["theft_in_progress"] or current_game_state["theft_in_progress"]["target_player_id"] != target_player_id:
            return emit('error', {'message': 'No active theft attempt targeting this player or invalid responder.'}, room=request.sid)
        thief_player_id_in_progress = current_game_state["theft_in_progress"]["thief_player_id"]
        thief_card_index_in_progress = current_game_state["theft_in_progress"]["thief_card_index"]
    else: # Response is a thief_cancel
        thief_player_id_in_progress = thief_player_id_data
        thief_card_index_in_progress = thief_card_index_data
        # Target player needs to be the thief in this case.
        if not current_game_state["theft_in_progress"] or current_game_state["theft_in_progress"]["thief_player_id"] != target_player_id: # target_player_id is actually thief_player_id here
            return emit('error', {'message': 'No active theft attempt initiated by this player to cancel.'}, room=request.sid)

    try:
        updated_game_state = dict(current_game_state) # Start with a copy for modifications

        if response_type == 'use_anti_theft':
            updated_game_state = apply_card_effect(updated_game_state, target_player_id, anti_theft_card_index, is_countering_theft=True)
            # Theft in progress is cleared by apply_card_effect
            
        elif response_type == 'no_response':
            # Proceed with the stealing process
            
            # Remove Thief card from thief's hand (now that target chose not to counter)
            # Ensure the thief card is still at the stored index before popping
            if thief_card_index_in_progress >= 0 and thief_card_index_in_progress < len(updated_game_state["players"][thief_player_id_in_progress]["hand"]) and \
               updated_game_state["players"][thief_player_id_in_progress]["hand"][thief_card_index_in_progress]["type"] == "theif":
                updated_game_state["players"][thief_player_id_in_progress]["hand"].pop(thief_card_index_in_progress)
            else:
                print(f"Warning: Thief card not found for removal for player {thief_player_id_in_progress} at index {thief_card_index_in_progress} during no_response.")
            
            selected_by_thief = updated_game_state["theft_in_progress"].get("selected_card_indices_for_thief", [])
            
            updated_game_state, stolen_count = updated_game_state, 0 # Initialize for consistency
            if selected_by_thief:
                updated_game_state, stolen_count = game_logic.steal_cards_from_opponent(updated_game_state, thief_player_id_in_progress, selected_by_thief)
                # Message and log handled by steal_cards_from_opponent
            else:
                updated_game_state["message"] = f"{current_game_state['players'][thief_player_id_in_progress]['player_name']}'s theft was successful (no cards selected)."
                updated_game_state["action_log"].append(updated_game_state["message"]) # Log
            
            updated_game_state["theft_in_progress"] = None # Reset theft state

        elif response_type == 'thief_cancel': # Thief wants to cancel the theft attempt
            updated_game_state = apply_card_effect(updated_game_state, thief_player_id_in_progress, thief_card_index_in_progress, is_theft_cancellation=True)
            # theft_in_progress is cleared by apply_card_effect

        else:
            raise ValueError("Invalid response type.")
        
        game_rooms[room_id]['game_state'] = updated_game_state # Update global state
        
        # Send updated game state to both players
        emit('game_update', {
            'player1_game_state': get_game_state_for_player(updated_game_state, 'player1'),
            'player2_game_state': get_game_state_for_player(updated_game_state, 'player2'),
            'current_turn': updated_game_state['current_turn'], 
            'win_status': check_win_condition(updated_game_state),
            'message': updated_game_state['message'],
            'action_log': updated_game_state['action_log'] # ส่ง action_log ไปด้วย
        }, room=room_id)

        print(f"Player {target_player_id} responded to theft in room {room_id}. Result: {updated_game_state['message']}")

    except ValueError as e:
        emit('error', {'message': str(e)}, room=request.sid)

if __name__ == '__main__':
    socketio.run(app, debug=True, port=5000)