import random
from game_logic import apply_card_effect, check_win_condition, end_turn, MAX_HAND_SIZE

def make_bot_move(game_state):
    bot_player_id = "player2"
    
    if game_state["current_turn"] != bot_player_id:
        return game_state

    current_game_state = dict(game_state)
    # Ensure to create a deep copy if modifying nested structures frequently,
    # but for simple hand manipulation, a shallow copy of hand list is often enough.
    bot_hand = list(current_game_state["players"][bot_player_id]["hand"]) 
    player1_characters = current_game_state["players"]["player1"]["characters"]
    player2_characters = current_game_state["players"][bot_player_id]["characters"]
    
    # In this current setup, AI won't try to use Thief card
    # because it lacks the logic to "select" opponent's cards.
    # To implement AI for Thief, you'd need more sophisticated logic
    # to choose which card to steal, and potentially make another API call.
    # For now, we'll ensure it doesn't try to use it if it comes across it.

    # Loop until no strategic moves found or hand is empty
    while True:
        best_move_found = False
        
        # Find and skip Thief card for now
        theif_card_indices = [idx for idx, card in enumerate(bot_hand) if card["type"] == "theif"]
        playable_hand = [card for idx, card in enumerate(bot_hand) if idx not in theif_card_indices]
        
        if not playable_hand: # If only Thief cards or no cards left, break
            break

        # Prioritize playing non-theif cards
        # Strategy 0b: Use Lucky Card on self if available and beneficial (character not asleep, not protected)
        lucky_card_index = -1
        for idx, card in enumerate(playable_hand):
            if card["type"] == "lucky":
                original_index = bot_hand.index(card) # Get original index before filtering
                lucky_card_index = original_index
                break
        
        if lucky_card_index != -1:
            target_chars = [c for c in player2_characters if not c["is_asleep"] and not c["is_protected"]]
            if target_chars:
                char_to_sleep = random.choice(target_chars) 
                try:
                    current_game_state = apply_card_effect(current_game_state, bot_player_id, lucky_card_index, char_to_sleep["id"])
                    bot_hand = list(current_game_state["players"][bot_player_id]["hand"]) # Re-fetch updated hand
                    best_move_found = True
                    print(f"Bot plays Lucky Sleep on its own character {char_to_sleep['name']} for instant sleep.")
                except ValueError as e:
                    pass # Continue if Lucky fails
            if best_move_found:
                continue # Try to find another move after playing

        # Strategy 0c: Use Dispel card on opponent if they have protected characters
        dispel_card_index = -1
        for idx, card in enumerate(playable_hand):
            if card["type"] == "dispel":
                original_index = bot_hand.index(card)
                dispel_card_index = original_index
                break

        if not best_move_found and dispel_card_index != -1:
            protected_opponent_chars = [c for c in player1_characters if c["is_protected"]]
            if protected_opponent_chars:
                target_char = random.choice(protected_opponent_chars)
                try:
                    current_game_state = apply_card_effect(current_game_state, bot_player_id, dispel_card_index, target_char["id"])
                    bot_hand = list(current_game_state["players"][bot_player_id]["hand"]) # Re-fetch updated hand
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
                original_index = bot_hand.index(card)
                defensive_card_index = original_index
                break

        if not best_move_found and defensive_card_index != -1:
            # Prioritize characters with low sleep and not protected
            vulnerable_chars = sorted([c for c in player2_characters if not c["is_asleep"] and not c["is_protected"]], 
                                    key=lambda x: x["current_sleep"])
            if vulnerable_chars:
                target_char = vulnerable_chars[0] # Protect the most vulnerable
                try:
                    current_game_state = apply_card_effect(current_game_state, bot_player_id, defensive_card_index, target_char["id"])
                    bot_hand = list(current_game_state["players"][bot_player_id]["hand"]) # Re-fetch updated hand
                    best_move_found = True
                    print(f"Bot plays Shield on its own character {target_char['name']} for protection.")
                except ValueError as e:
                    pass
            if best_move_found:
                continue

        # Strategy 1: Put opponent's character to sleep (most impactful)
        if not best_move_found:
            for card_index, card in enumerate(playable_hand):
                if card["type"] == "attack":
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
            for card_index, card in enumerate(playable_hand):
                if card["type"] == "attack":
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
            for card_index, card in enumerate(playable_hand):
                if card["type"] == "support":
                    original_index = bot_hand.index(card)
                    target_chars = sorted([c for c in player2_characters if not c["is_asleep"]], 
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
        if not best_move_found or not bot_hand: # Check bot_hand again after potential plays
            break
    
    # After attempting all moves, the bot ends its turn
    try:
        final_game_state = end_turn(current_game_state, bot_player_id)
        print("Bot ended its turn.")
        return final_game_state
    except ValueError as e:
        print(f"Bot error ending turn: {e}. Returning current state.")
        return current_game_state