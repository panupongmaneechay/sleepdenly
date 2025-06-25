# sleepy-game/backend/bot_ai.py
import random
import game_logic # Ensure this is imported for ACTION_CARD_TEMPLATES
from game_logic import apply_card_effect, check_win_condition, end_turn, MAX_HAND_SIZE, apply_pending_action

def make_bot_move(game_state):
    """
    Makes a single move for the bot player. This function assumes there is no
    pending attack to be resolved at the start of the bot's turn.
    The bot will attempt to play cards until it can't or chooses to end its turn.
    """
    bot_player_id = "player2"
    opponent_player_id = "player1" 

    # This check ensures that make_bot_move is only called when it's genuinely the bot's turn
    # and no pending attack needs resolution. The defense logic is handled in app.py.
    if game_state["current_turn"] != bot_player_id:
        return game_state
    
    # If there's a pending attack against the bot, handle defense logic first
    if game_state.get("pending_attack") and game_state["pending_attack"]["target_player_id"] == bot_player_id:
        # Bot's defense strategy: Always use defense card if available
        if game_state["players"][bot_player_id]["has_defense_card_in_hand"]:
            defense_card_index = -1
            for idx, card in enumerate(game_state["players"][bot_player_id]["hand"]):
                if card["type"] == "defense":
                    defense_card_index = idx
                    break
            
            if defense_card_index != -1:
                try:
                    # Apply defense card effect (this will clear pending_attack and return turn to attacker)
                    print(f"Bot uses Defense Card at index {defense_card_index}.")
                    updated_game_state = apply_card_effect(game_state, bot_player_id, defense_card_index, None, None, defending_card_index=defense_card_index)
                    # Turn remains with the player who initiated the attack, as their action was nullified.
                    # The bot (defender) is done with its defense, so we return the state.
                    return updated_game_state
                except ValueError as e:
                    print(f"Bot failed to use defense card: {e}")
                    # If for some reason defense fails, fall through to not defending
        
        # If bot has no defense card or failed to use it, apply the pending action
        print("Bot chooses not to defend or cannot defend. Applying pending action.")
        attacker_player_id = game_state["pending_attack"]["player_id"]
        attacking_card_name = game_state["pending_attack"]["card_name"]
        attacking_card_data = next((card for card in game_logic.ACTION_CARD_TEMPLATES if card["name"] == attacking_card_name), None)
        
        updated_game_state = apply_pending_action(game_state, attacker_player_id, attacking_card_data,
                                                  game_state["pending_attack"]["target_character_id"],
                                                  game_state["pending_attack"]["target_card_indices"])
        
        # After the pending action is applied, it becomes the bot's turn (as defender)
        updated_game_state["current_turn"] = bot_player_id # It's now the bot's turn after enduring the attack
        updated_game_state["pending_attack"] = None # Clear pending attack
        return updated_game_state


    current_game_state = dict(game_state)
    bot_hand = list(current_game_state["players"][bot_player_id]["hand"]) 
    player1_characters = current_game_state["players"]["player1"]["characters"]
    player2_characters = current_game_state["players"][bot_player_id]["characters"]

    # Bot will attempt to play cards until it can't or chooses to end turn
    while True:
        best_move_found = False
        
        if not bot_hand: 
            break

        # Strategy for Thief Card: Use if opponent has cards to steal
        thief_card_index = -1
        for idx, card in enumerate(bot_hand):
            if card["type"] == "theif":
                thief_card_index = idx
                break

        if thief_card_index != -1:
            if len(current_game_state["players"][opponent_player_id]["hand"]) > 0:
                try:
                    current_game_state = apply_card_effect(current_game_state, bot_player_id, thief_card_index)
                    bot_hand = list(current_game_state["players"][bot_player_id]["hand"]) 
                    best_move_found = True
                    print(f"Bot plays Thief and steals cards from {current_game_state['players'][opponent_player_id]['player_name']}.")
                except ValueError as e:
                    print(f"Bot failed to play Thief card: {e}")
                    pass 
            if best_move_found:
                continue 

        # Strategy for Swap Card: If bot has enough cards and opponent has cards, try to swap
        swap_card_index = -1
        for idx, card in enumerate(bot_hand):
            if card["type"] == "swap":
                swap_card_index = idx
                break
        
        if swap_card_index != -1:
            # Exclude the swap card itself from the bot's hand count for swapping
            player_hand_for_swap = [card for idx, card in enumerate(bot_hand) if idx != swap_card_index]
            player_hand_size = len(player_hand_for_swap) 
            opponent_hand_size = len(current_game_state["players"][opponent_player_id]["hand"])
            num_cards_to_swap = min(player_hand_size, opponent_hand_size)

            if num_cards_to_swap > 0:
                try:
                    # Select random cards from bot's hand (excluding the swap card itself)
                    my_cards_for_swap_indices = random.sample([i for i, card in enumerate(bot_hand) if i != swap_card_index], num_cards_to_swap)
                    opponent_cards_for_swap_indices = random.sample(range(len(current_game_state["players"][opponent_player_id]["hand"])), num_cards_to_swap)
                    
                    target_card_indices = []
                    for i in range(num_cards_to_swap):
                        target_card_indices.append(my_cards_for_swap_indices[i])
                        target_card_indices.append(opponent_cards_for_swap_indices[i])

                    current_game_state = apply_card_effect(current_game_state, bot_player_id, swap_card_index, None, target_card_indices)
                    bot_hand = list(current_game_state["players"][bot_player_id]["hand"]) 
                    best_move_found = True
                    print(f"Bot plays Swap and exchanges {num_cards_to_swap} cards with {current_game_state['players'][opponent_player_id]['player_name']}.")
                except ValueError as e:
                    print(f"Bot failed to play Swap card: {e}")
                    pass 
            if best_move_found:
                continue

        # Lucky Card
        lucky_card_index = -1
        for idx, card in enumerate(bot_hand):
            if card["type"] == "lucky":
                lucky_card_index = idx 
                break

        if lucky_card_index != -1:
            target_chars = [c for c in player2_characters if not c["is_asleep"] and c["current_sleep"] < c["max_sleep"]]
            if target_chars:
                # Prioritize character closest to sleeping, but not already asleep
                char_to_sleep = sorted(target_chars, key=lambda x: x["max_sleep"] - x["current_sleep"])[0]
                try:
                    current_game_state = apply_card_effect(current_game_state, bot_player_id, lucky_card_index, char_to_sleep["id"])
                    bot_hand = list(current_game_state["players"][bot_player_id]["hand"]) 
                    best_move_found = True
                    print(f"Bot plays Lucky Sleep on its own character {char_to_sleep['name']} for instant sleep.")
                except ValueError as e:
                    print(f"Bot failed to play Lucky card: {e}")
                    pass 
            if best_move_found:
                continue 

        # Attack Card - Prioritize putting opponent characters to sleep (exact match)
        if not best_move_found:
            for card_index_in_hand, card in enumerate(bot_hand): 
                if card["type"] == "attack":
                    for char in player1_characters:
                        if not char["is_asleep"]:
                            potential_sleep = char["current_sleep"] + card["effect"]["value"]
                            
                            if potential_sleep == char["max_sleep"]: # Exactly puts to sleep
                                try:
                                    current_game_state = apply_card_effect(current_game_state, bot_player_id, card_index_in_hand, char["id"])
                                    bot_hand = list(current_game_state["players"][bot_player_id]["hand"]) 
                                    best_move_found = True
                                    print(f"Bot plays {card['name']} on {char['name']} to put to sleep precisely.")
                                    break 
                                except ValueError as e:
                                    print(f"Bot failed to play attack card for exact sleep: {e}")
                                    continue 
                    if best_move_found:
                        break 
            if best_move_found:
                continue

        # Attack Card - Prioritize making opponent sleep (even if it's negative sleep)
        if not best_move_found:
            for card_index_in_hand, card in enumerate(bot_hand):
                if card["type"] == "attack":
                    # Target characters with highest current sleep first (closer to winning for them)
                    target_chars = sorted([c for c in player1_characters if not c["is_asleep"]], 
                                        key=lambda x: x["current_sleep"], reverse=True)
                    for char in target_chars:
                        try:
                            current_game_state = apply_card_effect(current_game_state, bot_player_id, card_index_in_hand, char["id"])
                            bot_hand = list(current_game_state["players"][bot_player_id]["hand"]) 
                            best_move_found = True
                            print(f"Bot plays {card['name']} on {char['name']} to reduce sleep.")
                            break
                        except ValueError as e:
                            print(f"Bot failed to play attack card: {e}")
                            continue 
                    if best_move_found:
                        break
            if best_move_found:
                continue
            
        # Support Card - Prioritize making own character sleep (even if it's not exact)
        if not best_move_found:
            for card_index_in_hand, card in enumerate(bot_hand):
                if card["type"] == "support":
                    # Target characters closest to sleeping first
                    target_chars = sorted([c for c in player2_characters if not c["is_asleep"]], 
                                        key=lambda x: x["max_sleep"] - x["current_sleep"])
                    for char in target_chars:
                        try:
                            current_game_state = apply_card_effect(current_game_state, bot_player_id, card_index_in_hand, char["id"])
                            bot_hand = list(current_game_state["players"][bot_player_id]["hand"]) 
                            best_move_found = True
                            print(f"Bot plays {card['name']} on its own character {char['name']} to add sleep.")
                        except ValueError as e:
                            print(f"Bot failed to play support card: {e}")
                            continue 
                    if best_move_found:
                        break
            if best_move_found:
                continue

        # If no optimal move, just break and end turn
        if not best_move_found or not bot_hand: 
            break
    
    # End Turn
    try:
        final_game_state = end_turn(current_game_state, bot_player_id)
        print("Bot ended its turn.")
        return final_game_state
    except ValueError as e:
        print(f"Bot error ending turn: {e}. Returning current state.")
        return current_game_state