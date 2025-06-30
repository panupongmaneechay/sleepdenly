# sleepy-game/backend/bot_ai.py
import random
import game_logic 
from game_logic import apply_card_effect, check_win_condition, end_turn, MAX_HAND_SIZE, apply_pending_action, check_player_lost

def make_bot_move(game_state):
    """
    Makes a single move for the bot player. This function handles both defense
    and offensive/support moves for a bot.
    """
    bot_player_id = game_state["current_turn"]
    bot_player_data = game_state["players"][bot_player_id]

    if not bot_player_data.get('is_bot'):
        # This function should only be called for bot players, but defensive check
        return game_state

    # --- Step 1: Handle pending attack if bot is the target ---
    if game_state.get("pending_attack") and game_state["pending_attack"]["target_player_id"] == bot_player_id:
        print(f"Bot {bot_player_id} is responding to a pending attack.")
        if bot_player_data["has_defense_card_in_hand"]:
            defense_card_index = -1
            for idx, card in enumerate(bot_player_data["hand"]):
                if card["type"] == "defense":
                    defense_card_index = idx
                    break
            
            if defense_card_index != -1:
                try:
                    # Apply defense card effect (this will clear pending_attack and return turn to attacker)
                    print(f"Bot {bot_player_id} uses Defense Card at index {defense_card_index}.")
                    updated_game_state = apply_card_effect(game_state, bot_player_id, defense_card_index, None, None, defending_card_index=defense_card_index)
                    # After defense, turn goes back to the attacker. Bot's "move" for this phase is done.
                    return updated_game_state
                except ValueError as e:
                    print(f"Bot {bot_player_id} failed to use defense card: {e}")
                    # Fall through to not defending
        
        # If bot has no defense card or failed to use it, apply the pending action
        print(f"Bot {bot_player_id} chooses not to defend or cannot defend. Applying pending action.")
        attacker_player_id = game_state["pending_attack"]["player_id"]
        attacking_card_name = game_state["pending_attack"]["card_name"]
        attacking_card_data = next((card for card in game_logic.ACTION_CARD_TEMPLATES if card["name"] == attacking_card_name), None)
        
        updated_game_state = apply_pending_action(game_state, attacker_player_id, attacking_card_data,
                                                  game_state["pending_attack"]["target_character_id"],
                                                  game_state["pending_attack"]["target_card_indices"],
                                                  game_state["pending_attack"].get("target_player_for_thief_swap"))
        
        # After the pending action is applied, it becomes the bot's turn (as the one who was attacked)
        updated_game_state["current_turn"] = bot_player_id # It's now the bot's turn after enduring the attack
        updated_game_state["pending_attack"] = None # Clear pending attack
        return updated_game_state # Bot's response phase is done

    # --- Step 2: If no pending attack, bot plays its turn ---
    current_game_state = dict(game_state)
    bot_hand = list(bot_player_data["hand"]) 

    # Get lists of all human and bot players, excluding self
    all_players_ids = current_game_state["player_turn_order"]
    # Filter for active opponents (not self, not lost)
    active_opponents = [p_id for p_id in all_players_ids if p_id != bot_player_id and not check_player_lost(current_game_state, p_id)]
    human_opponents = [p_id for p_id in active_opponents if not current_game_state["players"][p_id].get('is_bot', False)]
    bot_opponents = [p_id for p_id in active_opponents if current_game_state["players"][p_id].get('is_bot', False)]


    # Bot will attempt to play cards until it can't or chooses to end turn
    while True:
        move_made_this_loop = False
        if not bot_hand: 
            break

        # Prioritize playing Thief or Swap if advantageous
        thief_card_index = -1
        swap_card_index = -1
        
        for idx, card in enumerate(bot_hand):
            if card["type"] == "theif":
                thief_card_index = idx
            elif card["type"] == "swap":
                swap_card_index = idx
        
        # Strategy for Thief Card
        if thief_card_index != -1:
            # Prefer stealing from human players first if their hand is not empty
            eligible_steal_targets = [p_id for p_id in human_opponents if len(current_game_state["players"][p_id]["hand"]) > 0]
            if not eligible_steal_targets:
                # Then consider stealing from other bots if their hand is not empty
                eligible_steal_targets = [p_id for p_id in bot_opponents if len(current_game_state["players"][p_id]["hand"]) > 0]

            if eligible_steal_targets:
                target_player_id = random.choice(eligible_steal_targets)
                try:
                    current_game_state = apply_card_effect(current_game_state, bot_player_id, thief_card_index, None, None, None, target_player_id)
                    bot_hand = list(current_game_state["players"][bot_player_id]["hand"]) 
                    move_made_this_loop = True
                    print(f"Bot {bot_player_id} plays Thief and steals cards from {current_game_state['players'][target_player_id]['player_name']}.")
                except ValueError as e:
                    print(f"Bot {bot_player_id} failed to play Thief card: {e}")
            if move_made_this_loop:
                continue 

        # Strategy for Swap Card
        if swap_card_index != -1:
            eligible_swap_targets = []
            for p_id in human_opponents: # Prefer swapping with human players
                player_hand_size_excluding_swap = len([c for i, c in enumerate(bot_hand) if i != swap_card_index])
                opponent_hand_size = len(current_game_state["players"][p_id]["hand"])
                if player_hand_size_excluding_swap > 0 and opponent_hand_size > 0:
                    eligible_swap_targets.append(p_id)
            
            if eligible_swap_targets:
                target_player_id = random.choice(eligible_swap_targets)
                num_cards_to_swap = min(len([c for i, c in enumerate(bot_hand) if i != swap_card_index]), len(current_game_state["players"][target_player_id]["hand"]))
                
                if num_cards_to_swap > 0:
                    # Randomly select cards for swap
                    my_cards_for_swap_indices = random.sample([i for i, card in enumerate(bot_hand) if i != swap_card_index], num_cards_to_swap)
                    opponent_cards_for_swap_indices = random.sample(range(len(current_game_state["players"][target_player_id]["hand"])), num_cards_to_swap)
                    
                    target_card_indices_combined = []
                    for i in range(num_cards_to_swap):
                        target_card_indices_combined.append(my_cards_for_swap_indices[i])
                        target_card_indices_combined.append(opponent_cards_for_swap_indices[i])

                    try:
                        current_game_state = apply_card_effect(current_game_state, bot_player_id, swap_card_index, None, target_card_indices_combined, None, target_player_id)
                        bot_hand = list(current_game_state["players"][bot_player_id]["hand"]) 
                        move_made_this_loop = True
                        print(f"Bot {bot_player_id} plays Swap and exchanges {num_cards_to_swap} cards with {current_game_state['players'][target_player_id]['player_name']}.")
                    except ValueError as e:
                        print(f"Bot {bot_player_id} failed to play Swap card: {e}")
            if move_made_this_loop:
                continue

        # Lucky Card strategy: Use on own character closest to sleeping
        lucky_card_index = -1
        for idx, card in enumerate(bot_hand):
            if card["type"] == "lucky":
                lucky_card_index = idx 
                break

        if lucky_card_index != -1:
            bot_characters = bot_player_data["characters"]
            target_chars = [c for c in bot_characters if not c["is_asleep"] and c["current_sleep"] < c["max_sleep"]]
            if target_chars:
                # Prioritize character closest to sleeping (smallest sleep needed)
                char_to_sleep = sorted(target_chars, key=lambda x: x["max_sleep"] - x["current_sleep"])[0]
                try:
                    current_game_state = apply_card_effect(current_game_state, bot_player_id, lucky_card_index, char_to_sleep["id"])
                    bot_hand = list(current_game_state["players"][bot_player_id]["hand"]) 
                    move_made_this_loop = True
                    print(f"Bot {bot_player_id} plays Lucky Sleep on its own character {char_to_sleep['name']} for instant sleep.")
                except ValueError as e:
                    print(f"Bot {bot_player_id} failed to play Lucky card: {e}")
            if move_made_this_loop:
                continue 

        # Attack Card strategy: Prioritize putting opponent characters to sleep (exact match or most damage)
        best_attack_card_idx = -1
        best_attack_target_char_id = None
        best_attack_value = -float('inf') # Aim for largest negative sleep effect

        for card_index_in_hand, card in enumerate(bot_hand): 
            if card["type"] == "attack":
                for target_p_id in active_opponents: # Iterate through all active opponents
                    target_player_characters = current_game_state["players"][target_p_id]["characters"]
                    for char in target_player_characters:
                        if not char["is_asleep"]:
                            potential_sleep = char["current_sleep"] + card["effect"]["value"]
                            
                            # Prioritize exact sleep or most negative impact
                            if potential_sleep == char["max_sleep"] and card["effect"]["value"] < 0: # Exactly puts to sleep with attack
                                best_attack_card_idx = card_index_in_hand
                                best_attack_target_char_id = char["id"]
                                best_attack_value = 0 # High priority for exact sleep
                                break # Found a perfect attack, take it
                            elif card["effect"]["value"] < 0 and card["effect"]["value"] > best_attack_value: # More negative effect
                                best_attack_card_idx = card_index_in_hand
                                best_attack_target_char_id = char["id"]
                                best_attack_value = card["effect"]["value"]
                    if best_attack_card_idx != -1 and best_attack_value == 0: # If perfect attack found for any char/player
                        break 
            if best_attack_card_idx != -1 and best_attack_value == 0: # If perfect attack found, break outer loop
                break

        if best_attack_card_idx != -1:
            try:
                current_game_state = apply_card_effect(current_game_state, bot_player_id, best_attack_card_idx, best_attack_target_char_id)
                bot_hand = list(current_game_state["players"][bot_player_id]["hand"])
                move_made_this_loop = True
                print(f"Bot {bot_player_id} plays {current_game_state['action_log'][-1]}")
            except ValueError as e:
                print(f"Bot {bot_player_id} failed to play calculated attack card: {e}")
            if move_made_this_loop:
                continue

        # Support Card strategy: Prioritize making own character sleep
        best_support_card_idx = -1
        best_support_target_char_id = None
        best_support_sleep_needed = float('inf') # Aim for character needing least sleep

        bot_characters = bot_player_data["characters"]
        for card_index_in_hand, card in enumerate(bot_hand):
            if card["type"] == "support":
                for char in bot_characters:
                    if not char["is_asleep"]:
                        sleep_needed = char["max_sleep"] - char["current_sleep"]
                        if sleep_needed > 0 and sleep_needed <= card["effect"]["value"] and sleep_needed < best_support_sleep_needed: # Can complete sleep
                            best_support_card_idx = card_index_in_hand
                            best_support_target_char_id = char["id"]
                            best_support_sleep_needed = sleep_needed
                        elif sleep_needed > 0 and best_support_sleep_needed == float('inf'): # Just take any support if no perfect match found yet
                             best_support_card_idx = card_index_in_hand
                             best_support_target_char_id = char["id"]
                             best_support_sleep_needed = sleep_needed # Update to not infinity anymore

        if best_support_card_idx != -1:
            try:
                current_game_state = apply_card_effect(current_game_state, bot_player_id, best_support_card_idx, best_support_target_char_id)
                bot_hand = list(current_game_state["players"][bot_player_id]["hand"]) 
                move_made_this_loop = True
                print(f"Bot {bot_player_id} plays {current_game_state['action_log'][-1]}")
            except ValueError as e:
                print(f"Bot {bot_player_id} failed to play support card: {e}")
            if move_made_this_loop:
                continue

        # If no moves were made in this loop, break and end turn
        if not move_made_this_loop:
            break
    
    # End Turn
    try:
        final_game_state = end_turn(current_game_state, bot_player_id)
        print(f"Bot {bot_player_id} ended its turn.")
        return final_game_state
    except ValueError as e:
        print(f"Bot {bot_player_id} error ending turn: {e}. Returning current state.")
        return current_game_state