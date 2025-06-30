# sleepy-game/backend/game_logic.py

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
    {"name": "Lucky", "type": "lucky", "effect": {"type": "force_sleep"}, "description": "Force your character to sleep instantly!", "cssClass": "card-lucky", "rarity": 0.2},
    {"name": "Theif", "type": "theif", "effect": {"type": "steal_cards"}, "description": "Steal cards from an opponent's hand!", "cssClass": "card-theif", "rarity": 0.1},
    {"name": "Swap", "type": "swap", "effect": {"type": "swap_cards"}, "description": "Swap cards with an opponent!", "cssClass": "card-swap", "rarity": 0.3},
    {"name": "Defense_Card", "type": "defense", "effect": {"type": "nullify_action"}, "description": "Nullifies an opponent's action against you!", "cssClass": "card-defense", "rarity": 0.5},
]

def generate_character_id(player_num, char_index):
    return f"player{player_num}_char_{char_index}"

def initialize_game(total_players, num_bots, player_ids_list):
    game_state = {
        "players": {},
        "current_turn": player_ids_list[0], # First player in the sorted list starts
        "message": "Game started!",
        "game_over": False,
        "winner": None,
        "action_log": [],
        "pending_attack": None,
        "swap_in_progress": False,
        "selected_cards_for_swap": [],
        "player_turn_order": player_ids_list # Store the ordered list of player IDs
    }

    all_characters = list(CHARACTER_TEMPLATES)
    random.shuffle(all_characters)

    # Distribute characters to all players (human and bot)
    for i, player_id in enumerate(player_ids_list):
        is_bot = True if i >= (total_players - num_bots) else False # Simple check for bot based on order
        game_state["players"][player_id] = {
            "characters": [],
            "hand": [],
            "sleep_count": 0,
            "player_name": f"Player {i+1}", # Display name based on order
            "has_defense_card_in_hand": False,
            "is_bot": is_bot
        }
        for char_index in range(INITIAL_CHARACTERS_PER_PLAYER):
            char_data = all_characters.pop(0)
            game_state["players"][player_id]["characters"].append({
                "id": f"{player_id}_char_{char_index}", # Character ID now includes player_id
                "player_id": player_id, # Link character back to player
                "name": char_data["name"],
                "age": char_data["age"],
                "current_sleep": 0,
                "max_sleep": char_data["max_sleep"],
                "is_asleep": False,
                "is_protected": False,
                "description": char_data["description"]
            })
        draw_cards_for_player(game_state, player_id)

    return game_state

def draw_cards_for_player(game_state, player_id):
    player = game_state["players"][player_id]
    
    cards_to_draw = MAX_HAND_SIZE - len(player["hand"]) 
    
    if cards_to_draw <= 0:
        # game_state["message"] = f"{player['player_name']}'s hand is full. No cards drawn." # This message might clutter log in multiplayer
        # game_state["action_log"].append(game_state["message"])
        return game_state

    weighted_cards = []
    for card_template in ACTION_CARD_TEMPLATES:
        weight = int(card_template["rarity"] * 100) # Rarity means higher weight for more common cards
        for _ in range(weight):
            weighted_cards.append(card_template)

    for _ in range(cards_to_draw):
        if not weighted_cards:
            break
        card_template = random.choice(weighted_cards)
        player["hand"].append(card_template)
    
    player["has_defense_card_in_hand"] = any(card["type"] == "defense" for card in player["hand"])

    return game_state

def get_player_id_from_character_id(character_id):
    # Extracts player ID from character ID (e.g., 'player1_char_0' -> 'player1')
    parts = character_id.split('_')
    if len(parts) >= 2 and parts[0].startswith('player'):
        return parts[0]
    return None

def steal_cards_from_opponent(game_state, playing_player_id, target_player_id):
    player_hand = game_state["players"][playing_player_id]["hand"]
    opponent_hand = game_state["players"][target_player_id]["hand"]

    stolen_card_names = []
    stolen_count = 0

    if not opponent_hand:
        log_message = f"{game_state['players'][playing_player_id]['player_name']} tried to steal from {game_state['players'][target_player_id]['player_name']}'s hand, but it was empty!"
        game_state["message"] = log_message
        game_state["action_log"].append(log_message)
        return game_state, 0

    available_space = MAX_HAND_SIZE - len(player_hand)
    num_to_steal = min(len(opponent_hand), available_space)

    for _ in range(num_to_steal):
        card = opponent_hand.pop(0) # Steal from top of opponent's hand
        player_hand.append(card)
        stolen_card_names.append(card['name'])
        stolen_count += 1
    
    if stolen_count > 0:
        log_message = f"{game_state['players'][playing_player_id]['player_name']} stole {stolen_count} card(s) ({', '.join(stolen_card_names)}) from {game_state['players'][target_player_id]['player_name']}."
    else:
        log_message = f"{game_state['players'][playing_player_id]['player_name']} attempted to steal from {game_state['players'][target_player_id]['player_name']} but stole no cards (hand full)."

    game_state["message"] = log_message
    game_state["action_log"].append(log_message)

    game_state["players"][playing_player_id]["has_defense_card_in_hand"] = any(card["type"] == "defense" for card in player_hand)
    game_state["players"][target_player_id]["has_defense_card_in_hand"] = any(card["type"] == "defense" for card in opponent_hand)
    
    return game_state, stolen_count

def swap_cards_with_opponent(game_state, playing_player_id, target_player_id, my_chosen_indices, opp_chosen_indices):
    player = game_state["players"][playing_player_id]
    opponent = game_state["players"][target_player_id]

    swapped_cards_player_names = []
    swapped_cards_opponent_names = []
    
    # Sort indices in reverse to avoid issues when popping elements
    my_chosen_indices.sort(reverse=True)
    opp_chosen_indices.sort(reverse=True)

    # Perform the swap
    for i in range(len(my_chosen_indices)):
        my_card_idx = my_chosen_indices[i]
        opp_card_idx = opp_chosen_indices[i]

        if my_card_idx >= len(player["hand"]) or opp_card_idx >= len(opponent["hand"]):
            raise ValueError("Invalid card indices during swap. State desync detected.")

        my_card = player["hand"].pop(my_card_idx)
        opponent_card = opponent["hand"].pop(opp_card_idx)

        player["hand"].insert(0, opponent_card) # Add to start of hand
        opponent["hand"].insert(0, my_card)     # Add to start of opponent's hand
        
        swapped_cards_player_names.append(my_card['name'])
        swapped_cards_opponent_names.append(opponent_card['name'])

    log_message = f"{player['player_name']} used Swap and exchanged {len(my_chosen_indices)} card(s) with {opponent['player_name']}. " \
                    f"{player['player_name']} gave: {', '.join(swapped_cards_player_names)}. " \
                    f"{player['player_name']} received: {', '.join(swapped_cards_opponent_names)}."
    
    game_state["message"] = log_message
    game_state["action_log"].append(log_message)

    player["has_defense_card_in_hand"] = any(card["type"] == "defense" for card in player["hand"])
    opponent["has_defense_card_in_hand"] = any(card["type"] == "defense" for card in opponent["hand"])

    return game_state


def apply_pending_action(game_state, playing_player_id, card_data, target_character_id=None, target_card_indices=None, target_player_for_thief_swap=None):
    player_name = game_state['players'][playing_player_id]['player_name']
    log_message = ""

    if card_data["type"] == "attack":
        target_player_id = get_player_id_from_character_id(target_character_id)
        target_character = None
        for char in game_state["players"][target_player_id]["characters"]:
            if char["id"] == target_character_id:
                target_character = char
                break
        
        target_character["current_sleep"] += card_data["effect"]["value"]
        log_message = f"{player_name} used {card_data['name']} on {game_state['players'][target_player_id]['player_name']}'s {target_character['name']} to reduce sleep by {-card_data['effect']['value']} hours."
        if target_character["current_sleep"] < 0:
            target_character["current_sleep"] = 0
        if target_character["current_sleep"] >= target_character["max_sleep"] and not target_character["is_asleep"]:
            target_character["is_asleep"] = True
            game_state["players"][target_player_id]["sleep_count"] += 1
            log_message += f" {target_character['name']} reached enough sleep and is now asleep!"

    elif card_data["type"] == "support":
        target_player_id = get_player_id_from_character_id(target_character_id)
        target_character = None
        for char in game_state["players"][target_player_id]["characters"]:
            if char["id"] == target_character_id:
                target_character = char
                break

        target_character["current_sleep"] += card_data["effect"]["value"]
        log_message = f"{player_name} used {card_data['name']} on {game_state['players'][target_player_id]['player_name']}'s {target_character['name']} to add {card_data['effect']['value']} hours of sleep."
        if target_character["current_sleep"] >= target_character["max_sleep"] and not target_character["is_asleep"]:
            target_character["is_asleep"] = True
            game_state["players"][target_player_id]["sleep_count"] += 1
            log_message += f" {target_character['name']} reached enough sleep and is now asleep!"

    elif card_data["type"] == "lucky":
        target_player_id = get_player_id_from_character_id(target_character_id)
        target_character = None
        for char in game_state["players"][target_player_id]["characters"]:
            if char["id"] == target_character_id:
                target_character = char
                break

        target_character["current_sleep"] = target_character["max_sleep"]
        log_message = f"{player_name} used {card_data['name']} on {game_state['players'][target_player_id]['player_name']}'s {target_character['name']} for instant sleep!"
        if target_character["current_sleep"] >= target_character["max_sleep"] and not target_character["is_asleep"]:
            target_character["is_asleep"] = True
            game_state["players"][target_player_id]["sleep_count"] += 1
            log_message += f" {target_character['name']} is now asleep!"

    elif card_data["type"] == "theif":
        # Target player should be provided by frontend if human, or chosen by bot_ai if bot
        if not target_player_for_thief_swap:
            raise ValueError("Target player for Thief card not specified.")
        game_state, stolen_count = steal_cards_from_opponent(game_state, playing_player_id, target_player_for_thief_swap)
        log_message = f"{player_name} used {card_data['name']}! {game_state['message']}"

    elif card_data["type"] == "swap":
        # Target player should be provided by frontend if human, or chosen by bot_ai if bot
        if not target_player_for_thief_swap or not target_card_indices:
            raise ValueError("Target player and card indices for Swap card not specified.")
        
        # target_card_indices comes as [my_card_idx_1, opp_card_idx_1, my_card_idx_2, opp_card_idx_2, ...]
        my_chosen_indices = []
        opp_chosen_indices = []
        for i in range(0, len(target_card_indices), 2):
            my_chosen_indices.append(target_card_indices[i])
            opp_chosen_indices.append(target_card_indices[i+1])

        game_state = swap_cards_with_opponent(game_state, playing_player_id, target_player_for_thief_swap, my_chosen_indices, opp_chosen_indices)
        log_message = game_state["message"] # Message set by swap_cards_with_opponent
    else:
        raise ValueError("Unknown card type in pending action.")

    game_state["message"] = log_message
    game_state["action_log"].append(game_state["message"])
    game_state["pending_attack"] = None
    game_state["swap_in_progress"] = False
    game_state["selected_cards_for_swap"] = []
    return game_state


def apply_card_effect(game_state, playing_player_id, card_index, target_character_id=None, target_card_indices=None, defending_card_index=None, target_player_for_thief_swap=None):
    player = game_state["players"][playing_player_id]
    
    # CRITICAL: Check if the card_index is still valid
    if card_index < 0 or card_index >= len(player["hand"]):
        raise ValueError(f"Invalid card index {card_index}. Card no longer exists at this index. This might indicate a state desync or invalid action.")

    card = player["hand"][card_index] # Get the card based on the index

    # IMPORTANT: Re-validate turn and pending state here for robustness against delayed/repeated calls
    # Defense cards can be played out of turn when an attack is pending
    is_defense_action = card["type"] == "defense"
    
    if game_state["current_turn"] != playing_player_id and not (is_defense_action and game_state.get("pending_attack") and game_state["pending_attack"]["target_player_id"] == playing_player_id):
        raise ValueError("It's not your turn to play a card.")
    
    if game_state.get("pending_attack") and not is_defense_action:
        # If there's a pending attack, only the target player can play a defense card.
        # Other players cannot play any card until the pending attack is resolved.
        if playing_player_id == game_state["pending_attack"]["target_player_id"]:
            raise ValueError("You must respond to the pending attack before playing other cards.")
        else:
            raise ValueError("Cannot play card while an action is pending defense on another player.")

    # Handle defending against an attack
    if defending_card_index is not None:
        if game_state["pending_attack"] is None:
            raise ValueError("No incoming attack to defend against.")
        
        # Verify the defending card's index and type match
        if defending_card_index < 0 or defending_card_index >= len(player["hand"]):
            raise ValueError("Invalid defense card index.")
        defense_card = player["hand"][defending_card_index]
        if defense_card["type"] != "defense":
            raise ValueError("Only a Defense card can be used to defend.")
        if playing_player_id != game_state["pending_attack"]["target_player_id"]:
             raise ValueError("You can only use a Defense card when you are the target of an action.")

        player["hand"].pop(defending_card_index) # Remove defense card
        player["has_defense_card_in_hand"] = any(c["type"] == "defense" for c in player["hand"])
        
        log_message = f"{player['player_name']} used {defense_card['name']} to nullify {game_state['pending_attack']['card_name']}'s effect from {game_state['players'][game_state['pending_attack']['player_id']]['player_name']}!"
        game_state["message"] = log_message
        game_state["action_log"].append(log_message)
        game_state["pending_attack"] = None # Clear pending attack
        game_state["swap_in_progress"] = False # Ensure these flags are reset
        game_state["selected_cards_for_swap"] = [] # Ensure these flags are reset
        
        # Turn returns to the player who initiated the attack, as their action was nullified.
        game_state["current_turn"] = game_state["pending_attack"]["player_id"] 
        return game_state

    # --- Logic for playing other card types ---
    
    print(f"DEBUG: Applying card effect for card '{card.get('name', 'UNKNOWN')}' (type: {card.get('type', 'UNKNOWN')})")
    print(f"DEBUG: target_character_id received: {target_character_id}")
    print(f"DEBUG: target_player_for_thief_swap received: {target_player_for_thief_swap}")

    if card.get("type") in ["attack", "support", "lucky"]:
        if target_character_id is None:
            raise ValueError(f"Target character ID is required for {card.get('name', 'Unknown Card')} (type: {card.get('type', 'Unknown Type')}) card.")
    elif card.get("type") not in ["theif", "swap", "defense"]:
        raise ValueError(f"Attempted to play unknown or unplayable card type '{card.get('type', 'UNKNOWN')}'. Card name: {card.get('name', 'UNKNOWN')}")
    
    # Handle playing a Thief card
    if card["type"] == "theif":
        if card["name"] != "Theif": 
            raise ValueError(f"Expected Thief card at index {card_index}, but found {card['name']}.")
        
        # Determine target opponent for Thief
        if not target_player_for_thief_swap:
            # If human player didn't select, or bot playing: pick a random active opponent
            active_opponents = [pid for pid, p_data in game_state["players"].items() if pid != playing_player_id and not check_player_lost(game_state, pid)]
            if not active_opponents:
                raise ValueError("No active opponents to steal from.")
            target_player_for_thief_swap = random.choice(active_opponents)
        
        player["hand"].pop(card_index)
        player["has_defense_card_in_hand"] = any(c["type"] == "defense" for c in player["hand"])
        return apply_pending_action(game_state, playing_player_id, card, None, None, target_player_for_thief_swap)
    
    # Handle playing a Swap card
    if card["type"] == "swap":
        if card["name"] != "Swap":
            raise ValueError(f"Expected Swap card at index {card_index}, but found {card['name']}.")

        # Determine target opponent for Swap
        if not target_player_for_thief_swap:
            # If human player didn't select, or bot playing: pick a random active, non-bot opponent
            # For simplicity, bots won't swap with other bots, only humans
            active_human_opponents = [pid for pid, p_data in game_state["players"].items() if pid != playing_player_id and not p_data.get('is_bot', False) and not check_player_lost(game_state, pid)]
            if not active_human_opponents:
                raise ValueError("No active human opponents to swap cards with.")
            target_player_for_thief_swap = random.choice(active_human_opponents)
        
        # Validate selected_cards_for_swap
        my_hand_size = len(player["hand"]) - 1 # Excluding the swap card itself
        opponent_hand_size = len(game_state["players"][target_player_for_thief_swap]["hand"])
        num_cards_to_swap = min(my_hand_size, opponent_hand_size)

        if not target_card_indices or len(target_card_indices) != num_cards_to_swap * 2:
             # This means either the selection was incomplete from frontend, or bot failed to pick enough.
             # If human player, UI should prevent this. If bot, ensure bot sends correct indices.
            raise ValueError(f"Invalid number of selected cards for Swap. Expected {num_cards_to_swap} from each side, got {len(target_card_indices)/2 if target_card_indices else 0}.")

        # Remove the Swap card first before performing the swap logic
        player["hand"].pop(card_index) 
        player["has_defense_card_in_hand"] = any(c["type"] == "defense" for c in player["hand"])

        game_state["pending_attack"] = { # Reusing pending_attack for multi-step actions
            "card_name": card["name"],
            "card_type": card["type"],
            "player_id": playing_player_id,
            "target_player_id": target_player_for_thief_swap, # This is the target for the swap action
            "target_character_id": None, 
            "target_card_indices": target_card_indices, # Combined indices for actual swap logic
            "original_card_index": card_index,
            "target_player_for_thief_swap": target_player_for_thief_swap # Pass along for apply_pending_action
        }
        game_state["swap_in_progress"] = True 
        game_state["selected_cards_for_swap"] = [] 

        if game_state["players"][target_player_for_thief_swap]["has_defense_card_in_hand"] and not game_state["players"][target_player_for_thief_swap].get('is_bot', False):
            # Only human players can defend. Bots always apply effects unless defended by a human.
            game_state["message"] = f"{game_state['players'][target_player_for_thief_swap]['player_name']} has a Defense Card! Waiting for their response."
            game_state["action_log"].append(game_state["message"])
            return game_state
        else:
            game_state["swap_in_progress"] = False # Not really pending, just apply now
            return apply_pending_action(game_state, playing_player_id, card, None, target_card_indices, target_player_for_thief_swap)

    # For attack, support, lucky cards, ensure target character is valid and not asleep
    target_player_id_of_char = get_player_id_from_character_id(target_character_id)
    target_character = None
    if target_player_id_of_char:
        for char in game_state["players"][target_player_id_of_char]["characters"]:
            if char["id"] == target_character_id:
                target_character = char
                break

    if not target_character:
        raise ValueError(f"Character with ID '{target_character_id}' not found for player '{target_player_id_of_char}'. This might indicate a state desync.")

    if target_character["is_asleep"]:
        raise ValueError("Target character is already asleep and cannot be affected by this card.")

    # Special handling for Lucky card (can only be used on own characters)
    if card["type"] == "lucky" and target_player_id_of_char != playing_player_id:
        raise ValueError("Lucky Sleep card can only be used on your own characters.")

    # If it's an attack, create a pending attack. Otherwise (support/lucky), apply immediately.
    if card["type"] == "attack":
        game_state["pending_attack"] = {
            "card_name": card["name"],
            "card_type": card["type"],
            "effect_value": card["effect"].get("value"),
            "player_id": playing_player_id,
            "target_player_id": target_player_id_of_char, # This is the target of the attack
            "target_character_id": target_character_id,
            "original_card_index": card_index 
        }
        player["hand"].pop(card_index) # Remove card from hand
        player["has_defense_card_in_hand"] = any(c["type"] == "defense" for c in player["hand"])

        if game_state["players"][target_player_id_of_char]["has_defense_card_in_hand"] and not game_state["players"][target_player_id_of_char].get('is_bot', False):
            game_state["message"] = f"{game_state['players'][target_player_id_of_char]['player_name']} has a Defense Card! Waiting for their response."
            game_state["action_log"].append(game_state["message"])
            return game_state
        else:
            # If target is a bot, or human has no defense, apply effect immediately
            return apply_pending_action(game_state, playing_player_id, card, target_character_id)
    elif card["type"] in ["support", "lucky"]:
        player["hand"].pop(card_index) # Remove card from hand
        player["has_defense_card_in_hand"] = any(c["type"] == "defense" for c in player["hand"])
        return apply_pending_action(game_state, playing_player_id, card, target_character_id)
    else:
        raise ValueError("Unhandled card type in apply_card_effect after initial checks.")


def end_turn(game_state, player_id):
    if game_state["current_turn"] != player_id:
        raise ValueError("It's not your turn to end.")
    
    if game_state["pending_attack"]:
        raise ValueError("Cannot end turn while an action is pending defense.")

    draw_cards_for_player(game_state, player_id)

    # Find the next active player
    current_player_index = game_state["player_turn_order"].index(player_id)
    
    next_player_id = None
    for i in range(1, len(game_state["player_turn_order"]) + 1):
        next_index = (current_player_index + i) % len(game_state["player_turn_order"])
        potential_next_player_id = game_state["player_turn_order"][next_index]
        if not check_player_lost(game_state, potential_next_player_id): # Check if player hasn't lost
            next_player_id = potential_next_player_id
            break
    
    if next_player_id is None:
        # All other players have lost, current player is the winner
        game_state["game_over"] = True
        game_state["winner"] = player_id
        game_state["message"] = f"{game_state['players'][player_id]['player_name']} wins as all other players have lost!"
        game_state["action_log"].append(game_state["message"])
        return game_state


    game_state["current_turn"] = next_player_id
    player_name = game_state['players'][player_id]['player_name']
    next_player_name = game_state['players'][game_state['current_turn']]['player_name']
    
    log_message = f"Player {player_name} ended their turn. It's {next_player_name}'s turn."
    game_state["message"] = log_message
    game_state["action_log"].append(log_message)

    return game_state


def check_win_condition(game_state):
    win_status = {
        "game_over": False,
        "winner": None,
        "message": ""
    }
    
    # Check if any player has all their characters asleep
    for player_id, player_data in game_state["players"].items():
        if player_data["sleep_count"] >= INITIAL_CHARACTERS_PER_PLAYER:
            win_status["game_over"] = True
            win_status["winner"] = player_id
            win_status["message"] = f"{player_data['player_name']} wins by putting all their characters to sleep!"
            return win_status
            
    # Check for elimination (all other players lost)
    active_players = [p_id for p_id in game_state["players"].keys() if not check_player_lost(game_state, p_id)]
    
    if len(active_players) == 1:
        win_status["game_over"] = True
        win_status["winner"] = active_players[0]
        win_status["message"] = f"{game_state['players'][active_players[0]]['player_name']} wins as they are the last player standing!"
        return win_status

    return win_status

def check_player_lost(game_state, player_id):
    player_data = game_state["players"][player_id]
    # A player loses if all their characters are asleep
    return player_data["sleep_count"] >= INITIAL_CHARACTERS_PER_PLAYER


def get_game_state_for_player(full_game_state, player_id_for_view):
    player_view = {
        "players": {},
        "current_turn": full_game_state["current_turn"],
        "message": full_game_state["message"],
        "game_over": full_game_state["game_over"],
        "winner": full_game_state["winner"],
        "action_log": full_game_state["action_log"],
        "pending_attack": full_game_state.get("pending_attack"),
        "swap_in_progress": full_game_state.get("swap_in_progress", False),
        "selected_cards_for_swap": full_game_state.get("selected_cards_for_swap", []),
        "player_turn_order": full_game_state["player_turn_order"]
    }

    for p_id, p_data in full_game_state["players"].items():
        player_view["players"][p_id] = {
            "characters": p_data["characters"],
            "sleep_count": p_data["sleep_count"],
            "player_name": p_data["player_name"],
            "has_defense_card_in_hand": p_data["has_defense_card_in_hand"],
            "is_bot": p_data["is_bot"],
            "player_id": p_id # Include player_id for reference in frontend
        }
        # Only include hand for the viewing player, hide for others/bots
        if p_id == player_id_for_view:
            player_view["players"][p_id]["hand"] = p_data["hand"]
            player_view["players"][p_id]["hand_size"] = len(p_data["hand"]) # Also send hand size for consistency
        else:
            player_view["players"][p_id]["hand_size"] = len(p_data["hand"]) # Only hand size for opponents
    
    return player_view