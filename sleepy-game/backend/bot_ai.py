import random
from game_logic import apply_card_effect, check_win_condition, end_turn, MAX_HAND_SIZE

def make_bot_move(game_state):
    bot_player_id = "player2"
    
    # If bot is targeted by theft, it will not use anti-theft for now.
    # It just waits for the human player to confirm/cancel.
    # The human player's action (confirmSteal/cancelSteal) will resolve theft_in_progress.
    if game_state["theft_in_progress"] and game_state["theft_in_progress"]["target_player_id"] == bot_player_id:
        print("Bot is targeted by theft, awaiting player's response.")
        return game_state 

    if game_state["current_turn"] != bot_player_id:
        return game_state

    current_game_state = dict(game_state)
    bot_hand = list(current_game_state["players"][bot_player_id]["hand"]) 
    player1_characters = current_game_state["players"]["player1"]["characters"]
    player2_characters = current_game_state["players"][bot_player_id]["characters"]
    
    # Loop until no strategic moves found or hand is empty
    while True:
        best_move_found = False
        
        # Filter out anti_theft cards from main play logic (bot won't use them automatically)
        playable_hand = [card for card in bot_hand if card["type"] != "anti_theft"] 
        
        if not playable_hand: # If only Anti-Theft cards or no cards left, break
            break

        # Priority 0: Play Thief card if advantageous (simplified AI for Thief)
        theif_card_index = -1
        for idx, card in enumerate(bot_hand): # Search in full bot_hand to find Thief card
            if card["type"] == "theif":
                theif_card_index = idx
                break

        # Simple AI for Thief: if opponent has more than 1 card, and bot has less than max hand size, use Thief.
        player1_hand_size = len(current_game_state["players"]["player1"]["hand"])
        if theif_card_index != -1 and player1_hand_size > 0 and len(bot_hand) < MAX_HAND_SIZE:
            try:
                # Bot will automatically select cards to steal (simplified: steal up to MAX_HAND_SIZE - bot's current hand size)
                num_to_steal = min(player1_hand_size, MAX_HAND_SIZE - len(bot_hand))
                
                # Ensure num_to_steal doesn't exceed opponent's actual hand size
                actual_num_to_steal = min(num_to_steal, player1_hand_size)

                selected_card_indices_for_thief = []
                if actual_num_to_steal > 0:
                    selected_card_indices_for_thief = random.sample(range(player1_hand_size), actual_num_to_steal)
                
                # IMPORTANT: For AI, calling apply_card_effect with selected_card_indices_from_opponent
                # means the steal is performed immediately (no intermediate 'theft_in_progress' state for AI's own theft).
                current_game_state = apply_card_effect(
                    current_game_state,
                    bot_player_id,
                    theif_card_index,
                    selected_card_indices_from_opponent=selected_card_indices_for_thief # Pass selected indices for immediate steal
                )
                bot_hand = list(current_game_state["players"][bot_player_id]["hand"]) # Re-fetch updated hand
                best_move_found = True
                print(f"Bot plays Thief and stole {actual_num_to_steal} cards! Bot's new hand size: {len(bot_hand)}")
            except ValueError as e:
                print(f"Bot failed to play Thief card: {e}")
                pass # Continue if Thief fails
            if best_move_found:
                continue # Try to find another move after playing Thief

        # ... (rest of bot's strategies for other cards) ...
        # Ensure 'playable_hand' is used for iterations and then map back to 'bot_hand' index if needed.
        # This part should be fine if you ensure 'original_index = bot_hand.index(card)' is correct.

        # Strategy 0b: Use Lucky Card on self if available and beneficial (character not asleep, not protected)
        lucky_card_index = -1
        for idx, card in enumerate(playable_hand):
            if card["type"] == "lucky":
                if card in bot_hand: # Ensure card is still in original hand
                    original_index = bot_hand.index(card)
                    lucky_card_index = original_index
                    break
        
        if lucky_card_index != -1:
            target_chars = [c for c in player2_characters if not c["is_asleep"] and not c["is_protected"] and c["current_sleep"] < c["max_sleep"]]
            if target_chars:
                char_to_sleep = random.choice(target_chars) 
                try:
                    current_game_state = apply_card_effect(current_game_state, bot_player_id, lucky_card_index, char_to_sleep["id"])
                    bot_hand = list(current_game_state["players"][bot_player_id]["hand"])
                    best_move_found = True
                    print(f"Bot plays Lucky Sleep on its own character {char_to_sleep['name']} for instant sleep.")
                except ValueError as e:
                    pass
            if best_move_found:
                continue

        # Strategy 0c: Use Dispel card on opponent if they have protected characters
        dispel_card_index = -1
        for idx, card in enumerate(playable_hand):
            if card["type"] == "dispel":
                if card in bot_hand:
                    original_index = bot_hand.index(card)
                    dispel_card_index = original_index
                    break

        if not best_move_found and dispel_card_index != -1:
            protected_opponent_chars = [c for c in player1_characters if c["is_protected"]]
            if protected_opponent_chars:
                target_char = random.choice(protected_opponent_chars)
                try:
                    current_game_state = apply_card_effect(current_game_state, bot_player_id, dispel_card_index, target_char["id"])
                    bot_hand = list(current_game_state["players"][bot_player_id]["hand"])
                    best_move_found = True
                    print(f"Bot plays Dispel on opponent's protected character {target_char['name']}.")
                except ValueError as e:
                    pass
            if best_move_found:
                continue

        # Strategy 0d: Use Defensive card on self if an important character is NOT protected and vulnerable
        defensive_card_index = -1
        for idx, card in enumerate(playable_hand):
            if card["type"] == "defensive":
                if card in bot_hand:
                    original_index = bot_hand.index(card)
                    defensive_card_index = original_index
                    break

        if not best_move_found and defensive_card_index != -1:
            vulnerable_chars = sorted([c for c in player2_characters if not c["is_asleep"] and not c["is_protected"]], 
                                    key=lambda x: x["current_sleep"])
            if vulnerable_chars:
                target_char = vulnerable_chars[0] 
                try:
                    current_game_state = apply_card_effect(current_game_state, bot_player_id, defensive_card_index, target_char["id"])
                    bot_hand = list(current_game_state["players"][bot_player_id]["hand"])
                    best_move_found = True
                    print(f"Bot plays Shield on its own character {target_char['name']} for protection.")
                except ValueError as e:
                    pass
            if best_move_found:
                continue

        # Strategy 1: Put opponent's character to sleep (most impactful)
        if not best_move_found:
            for card_index_playable, card in enumerate(playable_hand):
                if card["type"] == "attack":
                    if card in bot_hand:
                        original_index = bot_hand.index(card)
                        for char in player1_characters:
                            if not char["is_asleep"] and not char["is_protected"]:
                                if card["effect"]["type"] == "reduce_sleep":
                                    simulated_sleep = char["current_sleep"] + card["effect"]["value"]
                                    if simulated_sleep >= char["max_sleep"]:
                                        try:
                                            current_game_state = apply_card_effect(current_game_state, bot_player_id, original_index, char["id"])
                                            bot_hand = list(current_game_state["players"][bot_player_id]["hand"])
                                            best_move_found = True
                                            print(f"Bot plays {card['name']} on {char['name']} to put to sleep.")
                                            break
                                        except ValueError as e:
                                            continue
                        if best_move_found:
                            break
            if best_move_found:
                continue

        # Strategy 2: Reduce opponent's character sleep
        if not best_move_found:
            for card_index_playable, card in enumerate(playable_hand):
                if card["type"] == "attack":
                    if card in bot_hand:
                        original_index = bot_hand.index(card)
                        target_chars = sorted([c for c in player1_characters if not c["is_asleep"] and not c["is_protected"]], 
                                            key=lambda x: x["current_sleep"], reverse=True)
                        for char in target_chars:
                            try:
                                current_game_state = apply_card_effect(current_game_state, bot_player_id, original_index, char["id"])
                                bot_hand = list(current_game_state["players"][bot_player_id]["hand"])
                                best_move_found = True
                                print(f"Bot plays {card['name']} on {char['name']} to reduce sleep.")
                                break
                            except ValueError as e:
                                continue
                        if best_move_found:
                            break
            if best_move_found:
                continue
            
        # Strategy 3: Increase bot's own character sleep (defensive)
        if not best_move_found:
            for card_index_playable, card in enumerate(playable_hand):
                if card["type"] == "support":
                    if card in bot_hand:
                        original_index = bot_hand.index(card)
                        target_chars = sorted([c for c in player2_characters if not c["is_asleep"] and c["current_sleep"] < c["max_sleep"]], 
                                            key=lambda x: x["current_sleep"])
                        for char in target_chars:
                            try:
                                current_game_state = apply_card_effect(current_game_state, bot_player_id, original_index, char["id"])
                                bot_hand = list(current_game_state["players"][bot_player_id]["hand"])
                                best_move_found = True
                                print(f"Bot plays {card['name']} on its own character {char['name']} to add sleep.")
                                break
                            except ValueError as e:
                                continue
                        if best_move_found:
                            break
            if best_move_found:
                continue

        # If no strategic moves found or hand is empty, break the loop
        if not best_move_found or not bot_hand: 
            break
    
    # After attempting all moves, the bot ends its turn
    try:
        final_game_state = end_turn(current_game_state, bot_player_id)
        print("Bot ended its turn.")
        return final_game_state
    except ValueError as e:
        print(f"Bot error ending turn: {e}. Returning current state.")
        return current_game_state