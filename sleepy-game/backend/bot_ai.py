import random
from game_logic import apply_card_effect, check_win_condition, end_turn, MAX_HAND_SIZE

def make_bot_move(game_state):
    bot_player_id = "player2"
    opponent_player_id = "player1" # The player the bot will target

    if game_state["current_turn"] != bot_player_id:
        return game_state

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
                    # For Thief, target_character_id is None as it affects the hand, not a character
                    current_game_state = apply_card_effect(current_game_state, bot_player_id, thief_card_index)
                    bot_hand = list(current_game_state["players"][bot_player_id]["hand"]) # Update hand after playing card
                    best_move_found = True
                    print(f"Bot plays Thief and steals cards from {current_game_state['players'][opponent_player_id]['player_name']}.")
                except ValueError as e:
                    print(f"Bot failed to play Thief card: {e}")
                    pass # Continue to next card if this one fails
            if best_move_found:
                continue 

        # Strategy for Swap Card: If bot has enough cards and opponent has cards, try to swap
        swap_card_index = -1
        for idx, card in enumerate(bot_hand):
            if card["type"] == "swap":
                swap_card_index = idx
                break
        
        if swap_card_index != -1:
            player_hand_size = len(bot_hand) - 1 # Exclude the swap card itself
            opponent_hand_size = len(current_game_state["players"][opponent_player_id]["hand"])
            num_cards_to_swap = min(player_hand_size, opponent_hand_size)

            if num_cards_to_swap > 0:
                try:
                    # Bot randomly selects its own cards to swap (excluding the swap card itself)
                    # and randomly selects opponent's cards.
                    my_cards_for_swap_indices = random.sample([i for i in range(len(bot_hand)) if i != swap_card_index], num_cards_to_swap)
                    opponent_cards_for_swap_indices = random.sample(range(len(current_game_state["players"][opponent_player_id]["hand"])), num_cards_to_swap)
                    
                    target_card_indices = []
                    for i in range(num_cards_to_swap):
                        target_card_indices.append(my_cards_for_swap_indices[i])
                        target_card_indices.append(opponent_cards_for_swap_indices[i])

                    current_game_state = apply_card_effect(current_game_state, bot_player_id, swap_card_index, None, target_card_indices)
                    bot_hand = list(current_game_state["players"][bot_player_id]["hand"]) # Update hand
                    best_move_found = True
                    print(f"Bot plays Swap and exchanges {num_cards_to_swap} cards with {current_game_state['players'][opponent_player_id]['player_name']}.")
                except ValueError as e:
                    print(f"Bot failed to play Swap card: {e}")
                    pass # Continue to next card if this one fails
            if best_move_found:
                continue

        # Lucky Card
        lucky_card_index = -1
        for idx, card in enumerate(bot_hand):
            if card["type"] == "lucky":
                lucky_card_index = idx # Get actual index from bot_hand
                break

        if lucky_card_index != -1:
            # Prioritize characters that are not asleep and need sleep
            target_chars = [c for c in player2_characters if not c["is_asleep"] and c["current_sleep"] < c["max_sleep"]]
            if target_chars:
                # Choose the character that needs the most sleep first, or is closest to sleeping
                char_to_sleep = sorted(target_chars, key=lambda x: x["max_sleep"] - x["current_sleep"], reverse=True)[0]
                try:
                    current_game_state = apply_card_effect(current_game_state, bot_player_id, lucky_card_index, char_to_sleep["id"])
                    bot_hand = list(current_game_state["players"][bot_player_id]["hand"]) # Update hand
                    best_move_found = True
                    print(f"Bot plays Lucky Sleep on its own character {char_to_sleep['name']} for instant sleep.")
                except ValueError as e:
                    print(f"Bot failed to play Lucky card: {e}")
                    pass # Continue to next card if this one fails
            if best_move_found:
                continue 

        # Attack Card - Prioritize putting opponent characters to sleep
        if not best_move_found:
            for card_index_in_hand, card in enumerate(bot_hand): # Iterate over actual bot_hand to get correct index
                if card["type"] == "attack":
                    for char in player1_characters:
                        if not char["is_asleep"]:
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