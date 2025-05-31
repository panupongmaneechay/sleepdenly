import random

# Game constants
MAX_HAND_SIZE = 5
MAX_SLEEP_HOURS = 8 # Assuming a general max sleep hours for all characters, adjust if characters have different needs.
INITIAL_CHARACTERS_PER_PLAYER = 3

# Helper function to generate a unique ID for characters
def generate_character_id(player_num, char_index):
    return f"player{player_num}_char_{char_index}"

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
    {"name": "Stay up late", "effect": {"type": "reduce_sleep", "value": -2}, "description": "Reduce target's sleep"},
    {"name": "Drink warm milk", "effect": {"type": "add_sleep", "value": 2}, "description": "Add sleep to target"},
    {"name": "Good income", "effect": {"type": "add_sleep", "value": 3}, "description": "More sleep for target"},
    {"name": "Cool room", "effect": {"type": "add_sleep", "value": 1}, "description": "Slightly more sleep"},
    {"name": "Avoid heavy meals", "effect": {"type": "reduce_sleep", "value": -1}, "description": "Less sleep for target"},
    {"name": "Late night movie", "effect": {"type": "reduce_sleep", "value": -3}, "description": "Significantly reduce sleep"}
]

def initialize_game():
    game_state = {
        "players": {
            "player1": {
                "characters": [],
                "hand": [],
                "sleep_count": 0 # Number of characters put to sleep
            },
            "player2": {
                "characters": [],
                "hand": [],
                "sleep_count": 0
            }
        },
        "current_turn": "player1", # Who's turn it is
        "message": "Game started!",
        "game_over": False,
        "winner": None
    }

    # Assign random characters to players
    all_characters = list(CHARACTER_TEMPLATES)
    random.shuffle(all_characters)

    for i in range(INITIAL_CHARACTERS_PER_PLAYER):
        char_data = all_characters.pop(0) # Get a unique character
        game_state["players"]["player1"]["characters"].append({
            "id": generate_character_id(1, i),
            "name": char_data["name"],
            "age": char_data["age"],
            "current_sleep": 0, # Start with 0 sleep
            "max_sleep": char_data["max_sleep"],
            "is_asleep": False,
            "description": char_data["description"]
        })

    for i in range(INITIAL_CHARACTERS_PER_PLAYER):
        char_data = all_characters.pop(0) # Get another unique character
        game_state["players"]["player2"]["characters"].append({
            "id": generate_character_id(2, i),
            "name": char_data["name"],
            "age": char_data["age"],
            "current_sleep": 0,
            "max_sleep": char_data["max_sleep"],
            "is_asleep": False,
            "description": char_data["description"]
        })

    # Draw initial hand for both players
    draw_cards_for_player(game_state, "player1")
    draw_cards_for_player(game_state, "player2")

    return game_state

def draw_cards_for_player(game_state, player_id):
    player = game_state["players"][player_id]
    cards_to_draw = MAX_HAND_SIZE - len(player["hand"])
    
    for _ in range(cards_to_draw):
        # Draw a random card from all available action card templates
        card_template = random.choice(ACTION_CARD_TEMPLATES)
        player["hand"].append(card_template)
    
    # print(f"Player {player_id} drew {cards_to_draw} cards. Hand size: {len(player['hand'])}")
    return game_state

def apply_card_effect(game_state, playing_player_id, card_index, target_character_id):
    player = game_state["players"][playing_player_id]
    
    if card_index < 0 or card_index >= len(player["hand"]):
        raise ValueError("Invalid card index.")

    card = player["hand"].pop(card_index) # Remove card from hand
    
    target_found = False
    for p_id in game_state["players"]:
        for char in game_state["players"][p_id]["characters"]:
            if char["id"] == target_character_id:
                if char["is_asleep"]:
                    raise ValueError("Target character is already asleep and cannot be affected.")
                
                effect_type = card["effect"]["type"]
                effect_value = card["effect"]["value"]

                if effect_type == "add_sleep":
                    char["current_sleep"] += effect_value
                elif effect_type == "reduce_sleep":
                    char["current_sleep"] += effect_value # Subtracting a negative value adds it back
                
                # Ensure sleep hours don't go below what's possible
                char["current_sleep"] = max(char["current_sleep"], -10) # Set a floor, e.g., -10 hours
                
                # Check if character is now asleep
                if char["current_sleep"] >= char["max_sleep"] and not char["is_asleep"]:
                    char["is_asleep"] = True
                    game_state["players"][p_id]["sleep_count"] += 1
                    game_state["message"] = f"{char['name']} is now asleep!"
                
                target_found = True
                break
        if target_found:
            break

    if not target_found:
        raise ValueError(f"Character with ID {target_character_id} not found.")

    # After playing a card, draw cards if hand is not full
    game_state = draw_cards_for_player(game_state, playing_player_id)
    
    # Switch turn
    game_state["current_turn"] = "player2" if playing_player_id == "player1" else "player1"

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
    """
    Returns a partial game state tailored for a specific player's view.
    Opponent's hand should not be visible.
    """
    player1_id = "player1"
    player2_id = "player2"

    player_view = {
        "players": {
            "player1": {
                "characters": full_game_state["players"][player1_id]["characters"],
                "sleep_count": full_game_state["players"][player1_id]["sleep_count"],
                "hand_size": len(full_game_state["players"][player1_id]["hand"]) # Only hand size for opponent
            },
            "player2": {
                "characters": full_game_state["players"][player2_id]["characters"],
                "sleep_count": full_game_state["players"][player2_id]["sleep_count"],
                "hand_size": len(full_game_state["players"][player2_id]["hand"]) # Only hand size for opponent
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