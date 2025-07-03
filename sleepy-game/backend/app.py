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

@socketio.on('connect')
def handle_connect():
    print(f'Client connected: {request.sid}')

@socketio.on('disconnect')
def handle_disconnect():
    print(f'Client disconnected: {request.sid}')
    for room_id, room_data in list(game_rooms.items()): 
        human_player_sids = [p_data['sid'] for p_id, p_data in room_data.get('player_sids', {}).items() if not p_data.get('is_bot', False)]
        
        if request.sid in human_player_sids:
            socketio.emit('player_disconnected', {'message': f'Player {request.sid} disconnected'}, room=room_id)
            if room_id in game_rooms:
                del game_rooms[room_id]
            print(f"Room {room_id} disbanded due to a player disconnect.")
            break 


@socketio.on('create_room')
def create_room(data):
    global next_room_id
    room_id = str(next_room_id)
    next_room_id += 1
    
    total_players = data.get('total_players', 2)
    num_bots = data.get('num_bots', 0)
    num_human_players_needed = total_players - num_bots

    if num_human_players_needed <= 0:
        emit('join_error', {'message': 'Invalid configuration: At least one human player is required.'})
        return

    game_rooms[room_id] = {
        'total_players': total_players,
        'num_bots': num_bots,
        'human_player_sids': [], # SIDs of connected human players
        'player_sids': {}, # Map player_id to sid (e.g., {'player1': {'sid': 'xyz', 'is_bot': False}, 'bot1': {'sid': None, 'is_bot': True}})
        'game_state': None,
        'turn': 'player1', # Initial turn holder
        'waiting_for_players': True
    }
    
    # Assign first human player as player1
    player_id_counter = 1
    game_rooms[room_id]['player_sids'][f'player{player_id_counter}'] = {'sid': request.sid, 'is_bot': False}
    game_rooms[room_id]['human_player_sids'].append(request.sid)
    join_room(room_id)
    
    emit('room_created', {'room_id': room_id, 'player_id': f'player{player_id_counter}', 'players_needed': num_human_players_needed - len(game_rooms[room_id]['human_player_sids'])})
    print(f'Room {room_id} created by {request.sid} as Player {player_id_counter}. Total players: {total_players}, Bots: {num_bots}')

    # If all human players are already accounted for (e.g., 1 human, 1 bot game started by 1 human)
    if len(game_rooms[room_id]['human_player_sids']) == num_human_players_needed:
        start_multiplayer_game(room_id)

@socketio.on('join_room')
def join_game_room(data):
    room_id = data.get('room_id')
    client_sid = request.sid 

    room_data = game_rooms.get(room_id)

    if not room_data:
        emit('join_error', {'message': 'Room not found.'})
        print(f'Join failed for {client_sid} on room {room_id}: Room not found.')
        return
    
    num_human_players_needed = room_data['total_players'] - room_data['num_bots']
    
    if len(room_data['human_player_sids']) >= num_human_players_needed:
        emit('join_error', {'message': 'Room is full or game has started.'})
        print(f'Join failed for {client_sid} on room {room_id}: Room full.')
        return
    
    if client_sid in room_data['human_player_sids']:
        emit('join_error', {'message': 'You are already in this room.'})
        print(f'Join failed for {client_sid} on room {room_id}: Already in room.')
        return

    # Assign next available player ID
    player_id_counter = 1
    while f'player{player_id_counter}' in room_data['player_sids']:
        player_id_counter += 1
    
    assigned_player_id = f'player{player_id_counter}'
    room_data['player_sids'][assigned_player_id] = {'sid': client_sid, 'is_bot': False}
    room_data['human_player_sids'].append(client_sid)
    join_room(room_id)
    
    emit('room_joined', {'room_id': room_id, 'player_id': assigned_player_id}, room=client_sid)
    print(f'Player {client_sid} joined room {room_id} as {assigned_player_id}.')

    if len(room_data['human_player_sids']) == num_human_players_needed:
        start_multiplayer_game(room_id)
    else:
        socketio.emit('room_created', {'room_id': room_id, 'players_needed': num_human_players_needed - len(room_data['human_player_sids'])}, room=room_id) # Update other players in lobby

def start_multiplayer_game(room_id):
    room_data = game_rooms[room_id]
    room_data['waiting_for_players'] = False

    # Assign bot IDs and mark them
    player_id_counter = room_data['total_players'] - room_data['num_bots'] + 1
    for _ in range(room_data['num_bots']):
        bot_player_id = f'player{player_id_counter}'
        room_data['player_sids'][bot_player_id] = {'sid': None, 'is_bot': True} # Bots don't have SIDs
        player_id_counter += 1

    player_ids_list = list(room_data['player_sids'].keys())
    # Sort player_ids for consistent turn order: player1, player2, ..., playerN
    player_ids_list.sort(key=lambda x: int(x.replace('player', '')))

    initial_game_state = gm_lg.initialize_game(room_data['total_players'], room_data['num_bots'], player_ids_list)
    room_data['game_state'] = initial_game_state

    # Prepare game states for each player view
    game_states_for_players = {}
    for p_id in player_ids_list:
        game_states_for_players[p_id] = {
            'sid': room_data['player_sids'][p_id]['sid'] if not room_data['player_sids'][p_id]['is_bot'] else None,
            'game_state': gm_lg.get_game_state_for_player(initial_game_state, p_id)
        }
    
    # Send initial game state to all clients in the room
    socketio.emit('game_start', {
        'initial_game_states': game_states_for_players, # Send full map of player states
        'room_id': room_id
    }, room=room_id) 
    
    print(f'Game started in room {room_id} with {room_data["total_players"]} players ({room_data["num_bots"]} bots).')

    # If the current turn is a bot's, trigger its move immediately
    if room_data['game_state']['players'][room_data['game_state']['current_turn']].get('is_bot'):
        eventlet.spawn_after(1, trigger_bot_move, room_id)


@socketio.on('play_card')
def handle_play_card(data):
    room_id = data['room_id']
    player_id = data['player_id']
    card_index = data['card_index']
    target_character_id = data.get('target_character_id') 
    target_card_indices = data.get('target_card_indices') 
    defending_card_index = data.get('defending_card_index') 
    target_player_for_thief_swap = data.get('target_player_for_thief_swap')

    print(f"Received play_card data (from {request.sid}): player_id={player_id}, card_index={card_index}, target_character_id={target_character_id}, target_card_indices={target_card_indices}, defending_card_index={defending_card_index}, target_player_for_thief_swap={target_player_for_thief_swap}")
 
    room_data = game_rooms.get(room_id)
    if not room_data:
        return emit('error', {'message': 'Room not found.'})

    current_game_state = room_data['game_state']

    if player_id != current_game_state['current_turn'] and current_game_state.get('pending_attack') is None:
        return emit('error', {'message': 'Not your turn to play a card.'}, room=request.sid)

    try:
        updated_game_state = apply_card_effect(current_game_state, player_id, card_index, target_character_id, target_card_indices, defending_card_index, target_player_for_thief_swap)
        room_data['game_state'] = updated_game_state

        win_status = check_win_condition(updated_game_state)
        
        # Prepare game states for each player view
        game_states_for_players = {}
        for p_id in updated_game_state['players'].keys():
            game_states_for_players[p_id] = {
                'sid': room_data['player_sids'][p_id]['sid'] if not room_data['player_sids'][p_id]['is_bot'] else None,
                'game_state': gm_lg.get_game_state_for_player(updated_game_state, p_id)
            }

        emit('game_update', {
            'game_states_for_players': game_states_for_players,
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
            # If after playing card, it's now a bot's turn, trigger bot move
            if updated_game_state['current_turn'] != player_id and updated_game_state['players'][updated_game_state['current_turn']].get('is_bot') and not win_status["game_over"]:
                eventlet.spawn_after(1, trigger_bot_move, room_id)


    except ValueError as e:
        emit('error', {'message': str(e)}, room=request.sid)

@socketio.on('resolve_pending_attack')
def handle_resolve_pending_attack(data):
    room_id = data['room_id']
    player_id = data['player_id'] 
    use_defense = data['useDefense']
    defending_card_index = data.get('defending_card_index')

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
                                                      current_game_state["pending_attack"]["target_card_indices"],
                                                      current_game_state["pending_attack"].get("target_player_for_thief_swap"))
            
        updated_game_state["pending_attack"] = None 
        updated_game_state["swap_in_progress"] = False 
        updated_game_state["selected_cards_for_swap"] = []
        room_data['game_state'] = updated_game_state

        win_status = check_win_condition(updated_game_state)
        
        # Prepare game states for each player view
        game_states_for_players = {}
        for p_id in updated_game_state['players'].keys():
            game_states_for_players[p_id] = {
                'sid': room_data['player_sids'][p_id]['sid'] if not room_data['player_sids'][p_id]['is_bot'] else None,
                'game_state': gm_lg.get_game_state_for_player(updated_game_state, p_id)
            }

        emit('game_update', {
            'game_states_for_players': game_states_for_players,
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
            # If after resolving attack, it's now a bot's turn, trigger bot move
            if updated_game_state['current_turn'] != player_id and updated_game_state['players'][updated_game_state['current_turn']].get('is_bot') and not win_status["game_over"]:
                eventlet.spawn_after(1, trigger_bot_move, room_id)

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
        room_data['game_state'] = updated_game_state

        win_status = check_win_condition(updated_game_state)

        # Prepare game states for each player view
        game_states_for_players = {}
        for p_id in updated_game_state['players'].keys():
            game_states_for_players[p_id] = {
                'sid': room_data['player_sids'][p_id]['sid'] if not room_data['player_sids'][p_id]['is_bot'] else None,
                'game_state': gm_lg.get_game_state_for_player(updated_game_state, p_id)
            }

        emit('game_update', {
            'game_states_for_players': game_states_for_players,
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
            # If it's now a bot's turn, trigger bot move
            if updated_game_state['players'][updated_game_state['current_turn']].get('is_bot') and not win_status["game_over"]:
                eventlet.spawn_after(1, trigger_bot_move, room_id)

    except ValueError as e:
        emit('error', {'message': str(e)}, room=request.sid)

def trigger_bot_move(room_id):
    room_data = game_rooms.get(room_id)
    if not room_data:
        print(f"Bot trigger: Room {room_id} not found.")
        return

    current_game_state = room_data['game_state']
    
    if current_game_state['game_over']:
        print(f"Bot trigger: Game in room {room_id} is already over.")
        return

    current_player_id = current_game_state['current_turn']
    if not current_game_state['players'][current_player_id].get('is_bot'):
        print(f"Bot trigger: Not bot's turn ({current_player_id}).")
        return # Not a bot's turn or human is still responding to pending attack

    print(f"Triggering bot move for {current_player_id} in room {room_id}...")
    
    # Check if there is a pending attack against this bot that needs resolution
    if current_game_state.get("pending_attack") and current_game_state["pending_attack"]["target_player_id"] == current_player_id:
        print(f"Bot {current_player_id} is resolving pending attack.")
        updated_game_state = bot_ai.make_bot_move(current_game_state) # Bot AI handles defense
    else:
        # Normal bot turn to play cards
        updated_game_state = bot_ai.make_bot_move(current_game_state)

    room_data['game_state'] = updated_game_state
    win_status = check_win_condition(updated_game_state)

    # Prepare game states for each player view
    game_states_for_players = {}
    for p_id in updated_game_state['players'].keys():
        game_states_for_players[p_id] = {
            'sid': room_data['player_sids'][p_id]['sid'] if not room_data['player_sids'][p_id]['is_bot'] else None,
            'game_state': gm_lg.get_game_state_for_player(updated_game_state, p_id)
        }

    socketio.emit('game_update', {
        'game_states_for_players': game_states_for_players,
        'current_turn': updated_game_state['current_turn'],
        'win_status': win_status,
        'message': updated_game_state['message'],
        'action_log': updated_game_state['action_log'],
        'swap_in_progress': updated_game_state.get('swap_in_progress', False),
        'selected_cards_for_swap': updated_game_state.get('selected_cards_for_swap', []),
        'pending_attack': updated_game_state.get('pending_attack')
    }, room=room_id)

    if win_status["game_over"]:
        print(f"Bot move resulted in game over in room {room_id}. Winner: {win_status['winner']}")
    elif updated_game_state['players'][updated_game_state['current_turn']].get('is_bot') and updated_game_state['current_turn'] != current_player_id:
        # If it's still a bot's turn (e.g., current bot ended its turn, and next player is also a bot)
        eventlet.spawn_after(1, trigger_bot_move, room_id)
    elif current_game_state.get("pending_attack") and current_game_state["pending_attack"]["target_player_id"] != current_player_id and updated_game_state['players'][updated_game_state['current_turn']].get('is_bot'):
        # If bot played an attacking card and now it's its turn again, but the target human needs to defend first
        # No recursive call here, waiting for human to resolve
        pass

if __name__ == '__main__':
    socketio.run(app, host='0.0.0.0', port=5000)