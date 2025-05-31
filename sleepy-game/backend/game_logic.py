import random

# Game constants
MAX_HAND_SIZE = 5
INITIAL_CHARACTERS_PER_PLAYER = 3

# Dummy data for characters and cards (replace with actual game data)
CHARACTER_TEMPLATES = [
    {"name": "Rickie", "age": 4, "max_sleep": 12, "description": "Young and needs lots of sleep"},
    {"name": "Nadia", "age": 17, "max_sleep": 10, "description": "Teenager, still growing"},
    {"name": "Chris", "age": 34, "max_sleep": 7, "description": "Busy adult"},
    {"name": "Merlin", "age": 6, "max_sleep": 9, "description": "Another young one"},
    {"name": "Gig", "age": 22, "max_sleep": 8, "description": "University student"},
    {"name": "William", "age": 72, "max_sleep": 8, "description": "Older adult, needs good rest"}
]

ACTION_CARD_TEMPLATES = [
    {"name": "Stay up late", "type": "attack", "effect": {"type": "reduce_sleep", "value": -2}, "description": "Reduce target's sleep"},
    {"name": "Drink warm milk", "type": "support", "effect": {"type": "add_sleep", "value": 2}, "description": "Add sleep to target"},
    {"name": "Good income", "type": "support", "effect": {"type": "add_sleep", "value": 3}, "description": "More sleep for target"},
    {"name": "Cool room", "type": "support", "effect": {"type": "add_sleep", "value": 1}, "description": "Slightly more sleep"},
    {"name": "Avoid heavy meals", "type": "attack", "effect": {"type": "reduce_sleep", "value": -1}, "description": "Less sleep for target"},
    {"name": "Late night movie", "type": "attack", "effect": {"type": "reduce_sleep", "value": -3}, "description": "Significantly reduce sleep"}
]

def generate_character_id(player_num, char_index):
    return f"player{player_num}_char_{char_index}"

def initialize_game():
    game_state = {
        "players": {
            "player1": {
                "characters": [],
                "hand": [],
                "sleep_count": 0, # Number of characters put to sleep
                "player_name": "Player 1" # Added for display
            },
            "player2": {
                "characters": [],
                "hand": [],
                "sleep_count": 0,
                "player_name": "Player 2" # Added for display
            }
        },
        "current_turn": "player1", # Who's turn it is
        "message": "Game started!",
        "game_over": False,
        "winner": None
    }

    all_characters = list(CHARACTER_TEMPLATES)
    random.shuffle(all_characters)

    for i in range(INITIAL_CHARACTERS_PER_PLAYER):
        char_data = all_characters.pop(0)
        game_state["players"]["player1"]["characters"].append({
            "id": generate_character_id(1, i),
            "name": char_data["name"],
            "age": char_data["age"],
            "current_sleep": 0,
            "max_sleep": char_data["max_sleep"],
            "is_asleep": False,
            "description": char_data["description"]
        })

    for i in range(INITIAL_CHARACTERS_PER_PLAYER):
        char_data = all_characters.pop(0)
        game_state["players"]["player2"]["characters"].append({
            "id": generate_character_id(2, i),
            "name": char_data["name"],
            "age": char_data["age"],
            "current_sleep": 0,
            "max_sleep": char_data["max_sleep"],
            "is_asleep": False,
            "description": char_data["description"]
        })

    draw_cards_for_player(game_state, "player1")
    draw_cards_for_player(game_state, "player2")

    return game_state

def draw_cards_for_player(game_state, player_id):
    player = game_state["players"][player_id]
    cards_to_draw = MAX_HAND_SIZE - len(player["hand"])
    
    for _ in range(cards_to_draw):
        card_template = random.choice(ACTION_CARD_TEMPLATES)
        player["hand"].append(card_template)
    
    return game_state

def get_player_id_from_character_id(character_id):
    if character_id.startswith("player1"):
        return "player1"
    elif character_id.startswith("player2"):
        return "player2"
    return None

def apply_card_effect(game_state, playing_player_id, card_index, target_character_id):
    player = game_state["players"][playing_player_id]
    
    if card_index < 0 or card_index >= len(player["hand"]):
        raise ValueError("Invalid card index.")

    card = player["hand"][card_index] # Keep card in hand until confirmed played
    
    target_player_id = get_player_id_from_character_id(target_character_id)
    if not target_player_id:
        raise ValueError("Invalid target character ID.")

    # Rule 3: Attack cards cannot be used on self
    if card["type"] == "attack" and target_player_id == playing_player_id:
        raise ValueError("Attack cards cannot be used on your own characters.")

    target_character = None
    for char in game_state["players"][target_player_id]["characters"]:
        if char["id"] == target_character_id:
            target_character = char
            break

    if not target_character:
        raise ValueError(f"Character with ID {target_character_id} not found.")

    if target_character["is_asleep"]:
        raise ValueError("Target character is already asleep and cannot be affected.")
    
    effect_type = card["effect"]["type"]
    effect_value = card["effect"]["value"]

    if effect_type == "add_sleep":
        target_character["current_sleep"] += effect_value
    elif effect_type == "reduce_sleep":
        target_character["current_sleep"] += effect_value 
    
    target_character["current_sleep"] = max(target_character["current_sleep"], -10)
    
    if target_character["current_sleep"] >= target_character["max_sleep"] and not target_character["is_asleep"]:
        target_character["is_asleep"] = True
        game_state["players"][target_player_id]["sleep_count"] += 1
        game_state["message"] = f"{target_character['name']} is now asleep!"
    
    # Remove card from hand AFTER successful application
    player["hand"].pop(card_index) 

    # No turn switch here. Turn switch happens on 'end_turn'

    return game_state

def end_turn(game_state, player_id):
    if game_state["current_turn"] != player_id:
        raise ValueError("It's not your turn to end.")
    
    # Draw cards for the player whose turn is ending
    game_state = draw_cards_for_player(game_state, player_id)

    # Switch turn
    game_state["current_turn"] = "player2" if player_id == "player1" else "player1"
    game_state["message"] = f"Player {player_id} ended their turn. It's {game_state['current_turn']}'s turn."
    return game_state


def check_win_condition(game_state):
    win_status = {
        "game_over": False,
        "winner": None,
        "message": ""
    }
    
    if game_state["players"]["player1"]["sleep_count"] >= INITIAL_CHARACTERS_PER_PLAYER:
        win_status["game_over"] = True
        win_status["winner"] = "player1"
        win_status["message"] = "Player 1 wins!"
    elif game_state["players"]["player2"]["sleep_count"] >= INITIAL_CHARACTERS_PER_PLAYER:
        win_status["game_over"] = True
        win_status["winner"] = "player2"
        win_status["message"] = "Player 2 wins!"
        
    return win_status

def get_game_state_for_player(full_game_state, player_id_for_view):
    player1_id = "player1"
    player2_id = "player2"

    player_view = {
        "players": {
            "player1": {
                "characters": full_game_state["players"][player1_id]["characters"],
                "sleep_count": full_game_state["players"][player1_id]["sleep_count"],
                "hand_size": len(full_game_state["players"][player1_id]["hand"]), # Only hand size for opponent
                "player_name": full_game_state["players"][player1_id]["player_name"]
            },
            "player2": {
                "characters": full_game_state["players"][player2_id]["characters"],
                "sleep_count": full_game_state["players"][player2_id]["sleep_count"],
                "hand_size": len(full_game_state["players"][player2_id]["hand"]), # Only hand size for opponent
                "player_name": full_game_state["players"][player2_id]["player_name"]
            }
        },
        "current_turn": full_game_state["current_turn"],
        "message": full_game_state["message"],
        "game_over": full_game_state["game_over"],
        "winner": full_game_state["winner"]
    }

    if player_id_for_view == player1_id:
        player_view["players"][player1_id]["hand"] = full_game_state["players"][player1_id]["hand"]
    elif player_id_for_view == player2_id:
        player_view["players"][player2_id]["hand"] = full_game_state["players"][player2_id]["hand"]

    return player_view