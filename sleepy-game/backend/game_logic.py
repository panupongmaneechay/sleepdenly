import random

# Game constants
MAX_HAND_SIZE = 5
INITIAL_CHARACTERS_PER_PLAYER = 3

# Dummy data for characters and cards
CHARACTER_TEMPLATES = [
    {"name": "Anthony", "age": 4, "max_sleep": 12, "description": "A curious little one."},
    {"name": "Austin", "age": 8, "max_sleep": 10, "description": "Energetic and playful."},
    {"name": "Bee", "age": 10, "max_sleep": 9, "description": "Always buzzing with activity."},
    {"name": "Bell", "age": 30, "max_sleep": 7, "description": "Rings true to her responsibilities."},
    {"name": "Bey", "age": 5, "max_sleep": 11, "description": "Sweet and sleepy."},
    {"name": "Boy", "age": 8, "max_sleep": 10, "description": "Full of youthful spirit."},
    {"name": "Brian", "age": 15, "max_sleep": 9, "description": "Navigating teenage dreams."},
    {"name": "Chris", "age": 29, "max_sleep": 7, "description": "A seasoned individual."},
    {"name": "Fiona", "age": 60, "max_sleep": 8, "description": "Wise and serene."},
    {"name": "Gel", "age": 4, "max_sleep": 12, "description": "Soft and squishy, loves naps."},
    {"name": "Goku", "age": 25, "max_sleep": 8, "description": "Always ready for an adventure, or a nap."},
    {"name": "Hero", "age": 6, "max_sleep": 10, "description": "Aspiring to great feats, but needs rest."},
    {"name": "Jeejee", "age": 17, "max_sleep": 9, "description": "Always on the go."},
    {"name": "Jerico", "age": 36, "max_sleep": 7, "description": "Building dreams and needing sleep."},
    {"name": "Joe", "age": 55, "max_sleep": 7, "description": "Enjoys quiet evenings."},
    {"name": "Kate", "age": 70, "max_sleep": 8, "description": "A lifetime of experience."},
    {"name": "Lee", "age": 71, "max_sleep": 8, "description": "Finding peace in slumber."},
    {"name": "Lila", "age": 69, "max_sleep": 8, "description": "Graceful and calm."},
    {"name": "Luna", "age": 22, "max_sleep": 8, "description": "Night owl, needs her beauty sleep."},
    {"name": "Martin", "age": 10, "max_sleep": 9, "description": "A little dreamer."},
    {"name": "Micheal", "age": 6, "max_sleep": 10, "description": "Full of innocent wonder."},
    {"name": "Mike", "age": 1, "max_sleep": 14, "description": "Needs lots of sleep to grow big and strong."},
    {"name": "Nena", "age": 1, "max_sleep": 14, "description": "Tiny and always sleepy."},
    {"name": "Rich", "age": 3, "max_sleep": 13, "description": "Loves toys and quiet time."},
    {"name": "Roxy", "age": 14, "max_sleep": 9, "description": "Energetic teenager."},
    {"name": "Violet", "age": 50, "max_sleep": 7, "description": "A vibrant personality."},
    {"name": "Wendy", "age": 57, "max_sleep": 7, "description": "Always puts comfort first."},
    {"name": "William", "age": 80, "max_sleep": 8, "description": "Cherishes every moment of rest."},
    {"name": "Zeno", "age": 19, "max_sleep": 8, "description": "Exploring new horizons."}
]

# Updated ACTION_CARD_TEMPLATES with new cards and their properties
ACTION_CARD_TEMPLATES = [
    {"name": "Acid_reflux", "type": "attack", "effect": {"type": "reduce_sleep", "value": -2}, "description": "Causes discomfort, making sleep harder.", "cssClass": "card-attack", "rarity": 1.0},
    {"name": "Depressed", "type": "attack", "effect": {"type": "reduce_sleep", "value": -3}, "description": "A heavy mind that steals away sleep.", "cssClass": "card-attack", "rarity": 1.0},
    {"name": "Eye_patch", "type": "support", "effect": {"type": "add_sleep", "value": 1}, "description": "Helps block out light for a quick nap.", "cssClass": "card-support", "rarity": 1.0},
    {"name": "Massage_under_the_ears", "type": "support", "effect": {"type": "add_sleep", "value": 1}, "description": "A soothing touch to invite slumber.", "cssClass": "card-support", "rarity": 1.0},
    {"name": "Sleep_with_the_lights_off", "type": "support", "effect": {"type": "add_sleep", "value": 2}, "description": "Darkness deepens the sleep.", "cssClass": "card-support", "rarity": 1.0},
    {"name": "Stress_reducing_music", "type": "support", "effect": {"type": "add_sleep", "value": 1}, "description": "Calming tunes for a peaceful mind.", "cssClass": "card-support", "rarity": 1.0},
    {"name": "Banana", "type": "support", "effect": {"type": "add_sleep", "value": 1}, "description": "A potassium boost for better rest.", "cssClass": "card-support", "rarity": 1.0},
    {"name": "Dont_sleep_during_the_day", "type": "support", "effect": {"type": "add_sleep", "value": 2}, "description": "Saves up all sleep for the night.", "cssClass": "card-support", "rarity": 1.0},
    {"name": "Free_from_odor_pollution", "type": "support", "effect": {"type": "add_sleep", "value": 1}, "description": "A clean scent promotes deep sleep.", "cssClass": "card-support", "rarity": 1.0},
    {"name": "Meditate", "type": "support", "effect": {"type": "add_sleep", "value": 2}, "description": "Calm your mind for restful sleep.", "cssClass": "card-support", "rarity": 1.0},
    {"name": "Sleeping_pills", "type": "support", "effect": {"type": "add_sleep", "value": 2}, "description": "A little help to fall asleep.", "cssClass": "card-support", "rarity": 1.0},
    {"name": "Stressed", "type": "attack", "effect": {"type": "reduce_sleep", "value": -2}, "description": "Worries keep slumber at bay.", "cssClass": "card-attack", "rarity": 1.0},
    {"name": "Bright_room", "type": "attack", "effect": {"type": "reduce_sleep", "value": -1}, "description": "Light disrupts the sleep cycle.", "cssClass": "card-attack", "rarity": 1.0},
    {"name": "Drink_alcohol", "type": "attack", "effect": {"type": "reduce_sleep", "value": -2}, "description": "Alcohol may induce sleep but disrupts quality.", "cssClass": "card-attack", "rarity": 1.0},
    {"name": "Fresh_air", "type": "support", "effect": {"type": "add_sleep", "value": 1}, "description": "A cool breeze makes for cozy sleep.", "cssClass": "card-support", "rarity": 1.0},
    {"name": "Nightmare", "type": "attack", "effect": {"type": "reduce_sleep", "value": -2}, "description": "Terrifying dreams steal away rest.", "cssClass": "card-attack", "rarity": 1.0},
    {"name": "Smoking", "type": "attack", "effect": {"type": "reduce_sleep", "value": -3}, "description": "Nicotine keeps the body awake.", "cssClass": "card-attack", "rarity": 1.0},
    {"name": "Tea", "type": "support", "effect": {"type": "add_sleep", "value": 1}, "description": "A warm cup of calming tea.", "cssClass": "card-support", "rarity": 1.0},
    {"name": "Coffee", "type": "attack", "effect": {"type": "reduce_sleep", "value": -2}, "description": "Caffeine keeps the mind alert.", "cssClass": "card-attack", "rarity": 1.0},
    {"name": "Drink_water", "type": "support", "effect": {"type": "add_sleep", "value": 2}, "description": "Hydration is key to healthy sleep.", "cssClass": "card-support", "rarity": 1.0},
    {"name": "Go_to_bed_on_time", "type": "support", "effect": {"type": "add_sleep", "value": 2}, "description": "Consistency builds a strong sleep cycle.", "cssClass": "card-support", "rarity": 1.0},
    {"name": "No_noise", "type": "support", "effect": {"type": "add_sleep", "value": 1}, "description": "A silent environment for peaceful rest.", "cssClass": "card-support", "rarity": 1.0},
    {"name": "Snoring", "type": "attack", "effect": {"type": "reduce_sleep", "value": -1}, "description": "Loud noises disrupt everyone's sleep.", "cssClass": "card-attack", "rarity": 1.0},
    {"name": "Using_phone", "type": "attack", "effect": {"type": "reduce_sleep", "value": -3}, "description": "Blue light disturbs natural sleep patterns.", "cssClass": "card-attack", "rarity": 1.0},
    {"name": "Cold_weather", "type": "support", "effect": {"type": "add_sleep", "value": 2}, "description": "A chilly room can be surprisingly cozy.", "cssClass": "card-support", "rarity": 1.0},
    {"name": "Eat_a_heavy_meal", "type": "attack", "effect": {"type": "reduce_sleep", "value": -2}, "description": "Digestion makes sleeping difficult.", "cssClass": "card-attack", "rarity": 1.0},
    {"name": "Good_income", "type": "support", "effect": {"type": "add_sleep", "value": 2}, "description": "Financial security brings peace of mind.", "cssClass": "card-support", "rarity": 1.0},
    {"name": "Not_coffee", "type": "support", "effect": {"type": "add_sleep", "value": 2}, "description": "Avoiding stimulants helps promote sleep.", "cssClass": "card-support", "rarity": 1.0},
    {"name": "Socialize_well", "type": "support", "effect": {"type": "add_sleep", "value": 2}, "description": "Good connections ease the mind for sleep.", "cssClass": "card-support", "rarity": 1.0},
    {"name": "Work_life_balance", "type": "support", "effect": {"type": "add_sleep", "value": 2}, "description": "Achieving balance leads to healthier sleep.", "cssClass": "card-support", "rarity": 1.0},
    {"name": "Cool_colors", "type": "support", "effect": {"type": "add_sleep", "value": 1}, "description": "Soothing colors create a relaxing atmosphere.", "cssClass": "card-support", "rarity": 1.0},
    {"name": "Eat_a_light_meal", "type": "support", "effect": {"type": "add_sleep", "value": 1}, "description": "Easy digestion for peaceful sleep.", "cssClass": "card-support", "rarity": 1.0},
    {"name": "Hot_milk", "type": "support", "effect": {"type": "add_sleep", "value": 1}, "description": "A classic remedy for sweet dreams.", "cssClass": "card-support", "rarity": 1.0},
    {"name": "Not_exercising", "type": "attack", "effect": {"type": "reduce_sleep", "value": -2}, "description": "Lack of activity can make falling asleep harder.", "cssClass": "card-attack", "rarity": 1.0},
    {"name": "Stay_up_late", "type": "attack", "effect": {"type": "reduce_sleep", "value": -3}, "description": "Significantly reduces sleep, impacting health.", "cssClass": "card-attack", "rarity": 1.0},
    {"name": "Cough", "type": "attack", "effect": {"type": "reduce_sleep", "value": -1}, "description": "A persistent cough disrupts peaceful sleep.", "cssClass": "card-attack", "rarity": 1.0},
    {"name": "Eat_and_then_sleep", "type": "attack", "effect": {"type": "reduce_sleep", "value": -2}, "description": "Eating right before bed can lead to discomfort.", "cssClass": "card-attack", "rarity": 1.0},
    {"name": "Hot_weather", "type": "attack", "effect": {"type": "reduce_sleep", "value": -1}, "description": "Heat makes it difficult to find comfort in bed.", "cssClass": "card-attack", "rarity": 1.0},
    {"name": "Odor_pollution", "type": "attack", "effect": {"type": "reduce_sleep", "value": -1}, "description": "Unpleasant smells hinder relaxation.", "cssClass": "card-attack", "rarity": 1.0},
    {"name": "Stomach_ache", "type": "attack", "effect": {"type": "reduce_sleep", "value": -2}, "description": "Pain keeps the body from resting.", "cssClass": "card-attack", "rarity": 1.0},
    {"name": "Dark_room", "type": "support", "effect": {"type": "add_sleep", "value": 2}, "description": "A dark room promotes melatonin production.", "cssClass": "card-support", "rarity": 1.0},
    {"name": "Exercising", "type": "support", "effect": {"type": "add_sleep", "value": 2}, "description": "Physical activity helps to tire the body.", "cssClass": "card-support", "rarity": 1.0},
    {"name": "Loud", "type": "attack", "effect": {"type": "reduce_sleep", "value": -2}, "description": "Excessive noise makes sleep impossible.", "cssClass": "card-attack", "rarity": 1.0},
    {"name": "Sick", "type": "attack", "effect": {"type": "reduce_sleep", "value": -3}, "description": "Illness severely impacts sleep quality.", "cssClass": "card-attack", "rarity": 1.0},
    {"name": "Stop_using_phone", "type": "support", "effect": {"type": "add_sleep", "value": 3}, "description": "Avoiding screens before bed improves sleep.", "cssClass": "card-support", "rarity": 1.0},
    # Keep special cards (Theif, Dodge) as they are
    
    {"name": "Lucky", "type": "lucky", "effect": {"type": "force_sleep"}, "description": "Force your character to sleep instantly!", "cssClass": "card-lucky", "rarity": 0.2},
    # New Cards
    {"name": "Shield", "type": "defensive", "effect": {"type": "protect"}, "description": "Protect a character from attacks!", "cssClass": "card-defensive", "rarity": 0.2},
    {"name": "Dispel", "type": "dispel", "effect": {"type": "remove_protection"}, "description": "Remove opponent's protection!", "cssClass": "card-dispel", "rarity": 0.2},
    {"name": "Theif", "type": "theif", "effect": {"type": "steal_card"}, "description": "Steal cards from opponent's hand!", "cssClass": "card-theif", "rarity": 0.1},
    {"name": "Dodge", "type": "anti_theft", "effect": {"type": "counter_theft"}, "description": "Counter an opponent's theft attempt!", "cssClass": "card-anti-theft", "rarity": 0.1}
]

def generate_character_id(player_num, char_index):
    return f"player{player_num}_char_{char_index}"

def initialize_game():
    game_state = {
        "players": {
            "player1": {
                "characters": [],
                "hand": [],
                "sleep_count": 0,
                "player_name": "Player 1"
            },
            "player2": {
                "characters": [],
                "hand": [],
                "sleep_count": 0,
                "player_name": "Player 2"
            }
        },
        "current_turn": "player1",
        "message": "Game started!",
        "game_over": False,
        "winner": None,
        "theft_in_progress": None, # { 'thief_player_id': 'playerX', 'thief_card_index': Y, 'target_player_id': 'playerZ' }
        "action_log": [] # เพิ่ม action_log ตรงนี้
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
            "is_protected": False,
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
            "is_protected": False,
            "description": char_data["description"]
        })

    draw_cards_for_player(game_state, "player1")
    draw_cards_for_player(game_state, "player2")

    return game_state

def draw_cards_for_player(game_state, player_id):
    player = game_state["players"][player_id]
    
    cards_to_draw = MAX_HAND_SIZE - len(player["hand"])
    
    if cards_to_draw <= 0:
        return game_state

    weighted_cards = []
    for card_template in ACTION_CARD_TEMPLATES:
        weight = int(card_template["rarity"] * 100)
        for _ in range(weight):
            weighted_cards.append(card_template)

    for _ in range(cards_to_draw):
        if not weighted_cards:
            break
        card_template = random.choice(weighted_cards)
        player["hand"].append(card_template)
    
    return game_state

def get_player_id_from_character_id(character_id):
    if character_id.startswith("player1"):
        return "player1"
    elif character_id.startswith("player2"):
        return "player2"
    return None

def steal_cards_from_opponent(game_state, playing_player_id, selected_card_indices_from_opponent):
    opponent_player_id = "player1" if playing_player_id == "player2" else "player2"
    
    player_hand = game_state["players"][playing_player_id]["hand"]
    opponent_hand = game_state["players"][opponent_player_id]["hand"]

    cards_stolen_count = 0
    max_stealable = MAX_HAND_SIZE - len(player_hand)
    
    if max_stealable <= 0:
        game_state["message"] = f"{game_state['players'][playing_player_id]['player_name']} tried to steal, but their hand is full!"
        game_state["action_log"].append(f"{game_state['players'][playing_player_id]['player_name']} attempted to steal, but their hand was full.") # Log
        return game_state, 0

    if not opponent_hand:
        game_state["message"] = f"{game_state['players'][playing_player_id]['player_name']} tried to steal, but {game_state['players'][opponent_player_id]['player_name']}'s hand is empty!"
        game_state["action_log"].append(f"{game_state['players'][playing_player_id]['player_name']} attempted to steal from {game_state['players'][opponent_player_id]['player_name']}'s empty hand.") # Log
        return game_state, 0

    if not isinstance(selected_card_indices_from_opponent, list):
        raise ValueError("Selected card indices must be a list.")
    
    if len(selected_card_indices_from_opponent) > max_stealable:
        raise ValueError(f"Cannot steal more than {max_stealable} cards.")

    # Remove duplicates and sort indices in reverse to remove without affecting subsequent indices
    unique_selected_indices = sorted(list(set(selected_card_indices_from_opponent)), reverse=True)
    
    stolen_card_names = [] # เก็บชื่อการ์ดที่ถูกขโมย
    for idx in unique_selected_indices:
        if 0 <= idx < len(opponent_hand):
            card = opponent_hand.pop(idx)
            player_hand.append(card)
            cards_stolen_count += 1
            stolen_card_names.append(card['name']) # เก็บชื่อการ์ด
        else:
            # This should ideally not happen if frontend validates properly
            print(f"Warning: Invalid card index {idx} provided for stealing. Skipping.")
            continue # Skip invalid index, don't raise error to prevent game crash
    
    if cards_stolen_count > 0:
        log_message = f"{game_state['players'][playing_player_id]['player_name']} stole {cards_stolen_count} card(s) ({', '.join(stolen_card_names)}) from {game_state['players'][opponent_player_id]['player_name']}."
    else:
        log_message = f"{game_state['players'][playing_player_id]['player_name']} attempted to steal from {game_state['players'][opponent_player_id]['player_name']} but stole no cards."
    game_state["message"] = log_message
    game_state["action_log"].append(log_message) # Log
    
    return game_state, cards_stolen_count

def apply_card_effect(game_state, playing_player_id, card_index, target_character_id=None, selected_card_indices_from_opponent=None, is_countering_theft=False, is_theft_cancellation=False):
    player = game_state["players"][playing_player_id]
    
    if card_index < 0 or card_index >= len(player["hand"]):
        raise ValueError("Invalid card index.")

    card = player["hand"][card_index]
    player_name = game_state['players'][playing_player_id]['player_name']

    if is_theft_cancellation: # New flag for thief cancelling theft
        if not game_state["theft_in_progress"] or game_state["theft_in_progress"]["thief_player_id"] != playing_player_id:
            raise ValueError("No active theft attempt initiated by this player to cancel.")
        
        # Only clear theft_in_progress state, the Thief card remains in hand
        # because it was never truly 'played' if cancelled before selection.
        game_state["theft_in_progress"] = None
        log_message = f"{player_name} cancelled the theft attempt using {card['name']}." # Log
        game_state["message"] = log_message
        game_state["action_log"].append(log_message)
        return game_state

    if is_countering_theft:
        if card["type"] != "anti_theft":
            raise ValueError("Only anti-theft cards can be played in response to theft.")
        
        if not game_state["theft_in_progress"] or game_state["theft_in_progress"]["target_player_id"] != playing_player_id:
            raise ValueError("Not currently under a theft attempt or not the target player.")
        
        thief_player_id = game_state["theft_in_progress"]["thief_player_id"]
        thief_card_index_on_thief_hand = game_state["theft_in_progress"]["thief_card_index"]
        thief_player_name = game_state['players'][thief_player_id]['player_name']
        
        # Remove the anti-theft card from player's hand
        popped_anti_theft_card = player["hand"].pop(card_index)
        
        # Remove the thief card from the thief's hand
        thief_card_removed = False
        if thief_card_index_on_thief_hand >= 0 and thief_card_index_on_thief_hand < len(game_state["players"][thief_player_id]["hand"]) and \
           game_state["players"][thief_player_id]["hand"][thief_card_index_on_thief_hand]["type"] == "theif":
            popped_thief_card = game_state["players"][thief_player_id]["hand"].pop(thief_card_index_on_thief_hand)
            thief_card_removed = True
            log_message = f"{player_name} used {popped_anti_theft_card['name']}! {thief_player_name}'s {popped_thief_card['name']} was destroyed. Theft attempt nullified!" # Log
        else:
            log_message = f"{player_name} used {popped_anti_theft_card['name']}, but {thief_player_name}'s Thief card was already gone or invalid. Theft attempt nullified!" # Log
            print(f"Error: Thief card not found at expected index {thief_card_index_on_thief_hand} for player {thief_player_id}.")
        
        game_state["message"] = log_message
        game_state["action_log"].append(log_message) # Log
        game_state["theft_in_progress"] = None # Reset theft state
        return game_state


    # Normal card play (not countering theft, not cancelling theft)
    
    # Handle 'theif' card type (initial click or confirmed steal)
    if card["type"] == "theif":
        if selected_card_indices_from_opponent is None:
            # This is the initial click on Theif card, setting up the theft_in_progress state
            log_message = f"{player_name} used {card['name']}. Waiting for opponent's response..." # Log
            game_state["message"] = log_message
            game_state["action_log"].append(log_message)
            game_state["theft_in_progress"] = {
                'thief_player_id': playing_player_id,
                'thief_card_index': card_index, # Keep original index of Thief card
                'target_player_id': 'player1' if playing_player_id == 'player2' else 'player2'
            }
            return game_state
        else:
            # This is the confirmation of steal action after selection
            if not game_state["theft_in_progress"] or game_state["theft_in_progress"]["thief_player_id"] != playing_player_id:
                raise ValueError("No active theft attempt initiated by this player to confirm.")
            
            # Remove the 'Theif' card from hand immediately after selection is confirmed
            player["hand"].pop(card_index) 
            
            # Apply steal effect with selected cards
            game_state, stolen_count = steal_cards_from_opponent(game_state, playing_player_id, selected_card_indices_from_opponent)
            # Message and log handled by steal_cards_from_opponent
            game_state["theft_in_progress"] = None # Reset theft state after successful steal
            return game_state

    # For other card types (attack, support, lucky, defensive, dispel), a target character is required
    if target_character_id is None:
        raise ValueError("Target character ID is required for this card type.")

    target_player_id = get_player_id_from_character_id(target_character_id)
    if not target_player_id:
        raise ValueError("Invalid target character ID.")

    target_character = None
    for char in game_state["players"][target_player_id]["characters"]:
        if char["id"] == target_character_id:
            target_character = char
            break

    if not target_character:
        raise ValueError(f"Character with ID {target_character_id} not found.")

    if target_character["is_asleep"]:
        raise ValueError("Target character is already asleep and cannot be affected.")
    
    # Remove card from hand BEFORE applying effects to ensure index is correct
    played_card = player["hand"].pop(card_index)

    # Apply validations and effects based on card type
    if played_card["type"] == "attack":
        if target_player_id == playing_player_id:
            raise ValueError("Attack cards cannot be used on your own characters.")
        if target_character["is_protected"]:
            # If protected, card is still consumed, but effect is nullified
            log_message = f"{player_name} used {played_card['name']} on {target_character['name']} but they are protected!" # Log
            game_state["message"] = log_message
            game_state["action_log"].append(log_message)
            return game_state # Card is consumed, but no effect
        
        target_character["current_sleep"] += played_card["effect"]["value"]
        log_message = f"{player_name} used {played_card['name']} on {target_character['name']} to reduce sleep by {-played_card['effect']['value']} hours." # Log
        game_state["message"] = log_message

    elif played_card["type"] == "support":
        if target_player_id != playing_player_id:
            raise ValueError("Support cards can only be used on your own characters.")
        
        target_character["current_sleep"] += played_card["effect"]["value"]
        log_message = f"{player_name} used {played_card['name']} on {target_character['name']} to add {played_card['effect']['value']} hours of sleep." # Log
        game_state["message"] = log_message

    elif played_card["type"] == "lucky":
        if target_player_id != playing_player_id:
            raise ValueError("Lucky Sleep card can only be used on your own characters.")
        
        target_character["current_sleep"] = target_character["max_sleep"]
        log_message = f"{player_name} used {played_card['name']} on {target_character['name']} for instant sleep!" # Log
        game_state["message"] = log_message

    elif played_card["type"] == "defensive":
        if target_player_id != playing_player_id:
            raise ValueError("Shield card can only be used on your own characters.")
        if target_character["is_protected"]:
            raise ValueError(f"{target_character['name']} is already protected.")
        
        target_character["is_protected"] = True
        log_message = f"{player_name} used {played_card['name']} on {target_character['name']} for protection!" # Log
        game_state["message"] = log_message

    elif played_card["type"] == "dispel":
        if target_player_id == playing_player_id:
            raise ValueError("Dispel card can only be used on opponent characters.")
        if not target_character["is_protected"]:
            raise ValueError(f"{target_character['name']} is not protected.")
        
        target_character["is_protected"] = False
        log_message = f"{player_name} used {played_card['name']} to dispel protection from {target_character['name']}!" # Log
        game_state["message"] = log_message
    
    else:
        raise ValueError("Unknown card type.")

    target_character["current_sleep"] = max(target_character["current_sleep"], -10)
    
    if target_character["current_sleep"] >= target_character["max_sleep"] and not target_character["is_asleep"]:
        target_character["is_asleep"] = True
        game_state["players"][target_player_id]["sleep_count"] += 1
        if played_card["type"] not in ["lucky", "defensive", "dispel"]: # Lucky, defensive, dispel already have specific messages
             # Only add this if character goes to sleep as a direct result of sleep change
            game_state["message"] += f" {target_character['name']} reached enough sleep and is now asleep!" # Log
        
    game_state["action_log"].append(game_state["message"]) # Log the final message
    return game_state

def end_turn(game_state, player_id):
    if game_state["current_turn"] != player_id:
        raise ValueError("It's not your turn to end.")
    
    if game_state["theft_in_progress"]: # Cannot end turn while theft is in progress
        raise ValueError("Cannot end turn during a theft attempt. Please resolve theft first.")

    # Draw cards for the player whose turn is ending
    game_state = draw_cards_for_player(game_state, player_id)

    # Switch turn
    game_state["current_turn"] = "player2" if player_id == "player1" else "player1"
    player_name = game_state['players'][player_id]['player_name']
    next_player_name = game_state['players'][game_state['current_turn']]['player_name']
    
    log_message = f"Player {player_name} ended their turn. It's {next_player_name}'s turn." # Log
    game_state["message"] = log_message
    game_state["action_log"].append(log_message)

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
                "hand_size": len(full_game_state["players"][player1_id]["hand"]),
                "player_name": full_game_state["players"][player1_id]["player_name"]
            },
            "player2": {
                "characters": full_game_state["players"][player2_id]["characters"],
                "sleep_count": full_game_state["players"][player2_id]["sleep_count"],
                "hand_size": len(full_game_state["players"][player2_id]["hand"]),
                "player_name": full_game_state["players"][player2_id]["player_name"]
            }
        },
        "current_turn": full_game_state["current_turn"],
        "message": full_game_state["message"],
        "game_over": full_game_state["game_over"],
        "winner": full_game_state["winner"],
        "theft_in_progress": full_game_state["theft_in_progress"],
        "action_log": full_game_state["action_log"] # เพิ่ม action_log ตรงนี้
    }

    # Reveal hand of the player who is currently using Thief OR is being stolen from
    if full_game_state["theft_in_progress"]:
        thief_player_id = full_game_state["theft_in_progress"]["thief_player_id"]
        target_player_id = full_game_state["theft_in_progress"]["target_player_id"]
        
        if player_id_for_view == thief_player_id: # Thief player sees opponent's hand
            opponent_of_thief_id = target_player_id
            player_view["players"][opponent_of_thief_id]["hand"] = full_game_state["players"][opponent_of_thief_id]["hand"]
        
        if player_id_for_view == target_player_id: # Target player sees their own hand (to pick anti-theft)
            player_view["players"][target_player_id]["hand"] = full_game_state["players"][target_player_id]["hand"]
            
    # For player's own hand (always visible to them, but needs to be added to view)
    if player_id_for_view == player1_id:
        player_view["players"][player1_id]["hand"] = full_game_state["players"][player1_id]["hand"]
    elif player_id_for_view == player2_id:
        player_view["players"][player2_id]["hand"] = full_game_state["players"][player2_id]["hand"]
    
    return player_view