import random
from game_logic import apply_card_effect, check_win_condition, end_turn, MAX_HAND_SIZE

def make_bot_move(game_state):
    bot_player_id = "player2"
    
    # Anti Theft Card - Removed logic
    if game_state["theft_in_progress"] and game_state["theft_in_progress"]["target_player_id"] == bot_player_id:
        print("Bot is targeted by theft, awaiting player's response. (This state should not be reached if theft cards are removed)")
        return game_state 
    
    if game_state["current_turn"] != bot_player_id:
        return game_state

    current_game_state = dict(game_state)
    bot_hand = list(current_game_state["players"][bot_player_id]["hand"]) 
    player1_characters = current_game_state["players"]["player1"]["characters"]
    player2_characters = current_game_state["players"][bot_player_id]["characters"]
    
    while True:
        best_move_found = False
        playable_hand = list(bot_hand) # Use a copy to iterate
        
        if not playable_hand: 
            break

        # Removed Thief Card Logic

        # Lucky Card
        # วนหาการ์ด Lucky
        lucky_card_index = -1
        for idx, card in enumerate(playable_hand): # Iterate through playable_hand
            if card["type"] == "lucky":
                # Find its original index in the current bot_hand state
                try:
                    original_index = bot_hand.index(card)
                    lucky_card_index = original_index
                    break
                except ValueError:
                    continue # Card might have been played already if logic changed

        if lucky_card_index != -1:
            # Prioritize characters that are not asleep and need sleep
            target_chars = [c for c in player2_characters if not c["is_asleep"] and c["current_sleep"] < c["max_sleep"]]
            if target_chars:
                # Choose the character that needs the most sleep first, or is closest to sleeping
                char_to_sleep = sorted(target_chars, key=lambda x: x["max_sleep"] - x["current_sleep"], reverse=True)[0]
                try:
                    current_game_state = apply_card_effect(current_game_state, bot_player_id, lucky_card_index, char_to_sleep["id"])
                    bot_hand = list(current_game_state["players"][bot_player_id]["hand"]) # Update hand after playing card
                    best_move_found = True
                    print(f"Bot plays Lucky Sleep on its own character {char_to_sleep['name']} for instant sleep.")
                except ValueError as e:
                    print(f"Bot failed to play Lucky card: {e}")
                    pass # Continue to next card if this one fails
            if best_move_found:
                continue 

        # Removed Dispel Card Logic
        # Removed Defensive Card Logic
            
        # Attack Card - Prioritize putting opponent characters to sleep
        if not best_move_found:
            for card_index_in_hand, card in enumerate(bot_hand): # Iterate over actual bot_hand to get correct index
                if card["type"] == "attack":
                    for char in player1_characters:
                        if not char["is_asleep"]: # No protection check needed now
                            # Calculate potential sleep. Prioritize attacks that make them sleep EXACTLY
                            potential_sleep = char["current_sleep"] + card["effect"]["value"]
                            
                            # Check if this attack would make the opponent character sleep (reach max_sleep)
                            if potential_sleep == char["max_sleep"]:
                                try:
                                    current_game_state = apply_card_effect(current_game_state, bot_player_id, card_index_in_hand, char["id"])
                                    bot_hand = list(current_game_state["players"][bot_player_id]["hand"]) # Update hand
                                    best_move_found = True
                                    print(f"Bot plays {card['name']} on {char['name']} to put to sleep precisely.")
                                    break # Move made, break inner char loop
                                except ValueError as e:
                                    print(f"Bot failed to play attack card for exact sleep: {e}")
                                    continue # Try next character or card
                    if best_move_found:
                        break # Move made, break card loop
            if best_move_found:
                continue

        # Attack Card - Prioritize making opponent sleep (even if it's negative sleep)
        if not best_move_found:
            for card_index_in_hand, card in enumerate(bot_hand):
                if card["type"] == "attack":
                    # Sort opponent characters by how far they are from being asleep (descending, so higher current_sleep comes first)
                    # This means we prioritize making characters with more sleep fall asleep first.
                    target_chars = sorted([c for c in player1_characters if not c["is_asleep"]], 
                                        key=lambda x: x["current_sleep"], reverse=True)
                    for char in target_chars:
                        try:
                            current_game_state = apply_card_effect(current_game_state, bot_player_id, card_index_in_hand, char["id"])
                            bot_hand = list(current_game_state["players"][bot_player_id]["hand"]) # Update hand
                            best_move_found = True
                            print(f"Bot plays {card['name']} on {char['name']} to reduce sleep.")
                            break
                        except ValueError as e:
                            print(f"Bot failed to play attack card: {e}")
                            continue # Try next character or card
                    if best_move_found:
                        break
            if best_move_found:
                continue
            
        # Support Card - Prioritize making own character sleep (even if it's not exact)
        if not best_move_found:
            for card_index_in_hand, card in enumerate(bot_hand):
                if card["type"] == "support":
                    # Sort own characters by how close they are to max_sleep (ascending)
                    # Prioritize characters that need less sleep to reach max_sleep
                    target_chars = sorted([c for c in player2_characters if not c["is_asleep"]], 
                                        key=lambda x: x["max_sleep"] - x["current_sleep"])
                    for char in target_chars:
                        try:
                            current_game_state = apply_card_effect(current_game_state, bot_player_id, card_index_in_hand, char["id"])
                            bot_hand = list(current_game_state["players"][bot_player_id]["hand"]) # Update hand
                            best_move_found = True
                            print(f"Bot plays {card['name']} on its own character {char['name']} to add sleep.")
                            break
                        except ValueError as e:
                            print(f"Bot failed to play support card: {e}")
                            continue # Try next character or card
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