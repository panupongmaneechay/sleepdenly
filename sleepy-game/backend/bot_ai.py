import random
from game_logic import apply_card_effect, check_win_condition, end_turn

def make_bot_move(game_state):
    bot_player_id = "player2"
    
    if game_state["current_turn"] != bot_player_id:
        return game_state

    current_game_state = dict(game_state)
    bot_hand = current_game_state["players"][bot_player_id]["hand"]
    player1_characters = current_game_state["players"]["player1"]["characters"]
    player2_characters = current_game_state["players"][bot_player_id]["characters"]

    moves_made = False
    
    # Bot plays cards until no more 'strategic' moves or no cards left
    while len(current_game_state["players"][bot_player_id]["hand"]) > 0:
        best_move_found = False
        
        # Strategy 0: Use Lucky Card on self if available and beneficial
        for card_index, card in enumerate(bot_hand):
            if card["type"] == "lucky":
                # Find an own character that is NOT asleep
                target_chars = [c for c in player2_characters if not c["is_asleep"]]
                if target_chars:
                    # Prioritize character closest to sleep, or any character
                    char_to_sleep = random.choice(target_chars) 
                    try:
                        current_game_state = apply_card_effect(current_game_state, bot_player_id, card_index, char_to_sleep["id"])
                        bot_hand = current_game_state["players"][bot_player_id]["hand"] # Update hand
                        moves_made = True
                        best_move_found = True
                        print(f"Bot plays {card['name']} on its own character {char_to_sleep['name']} for instant sleep.")
                        break
                    except ValueError as e:
                        print(f"Bot failed to play Lucky card: {e}")
                        continue
            if best_move_found:
                break
        if best_move_found:
            continue

        # Strategy 1: Put opponent's character to sleep (most impactful)
        for card_index, card in enumerate(bot_hand):
            if card["type"] == "attack": # Only attack cards can reduce sleep
                for char in player1_characters:
                    if not char["is_asleep"]:
                        # Simulate effect to see if it puts character to sleep
                        if card["effect"]["type"] == "reduce_sleep":
                            simulated_sleep = char["current_sleep"] + card["effect"]["value"]
                            if simulated_sleep >= char["max_sleep"]:
                                try:
                                    current_game_state = apply_card_effect(current_game_state, bot_player_id, card_index, char["id"])
                                    bot_hand = current_game_state["players"][bot_player_id]["hand"] 
                                    moves_made = True
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
            for card_index, card in enumerate(bot_hand):
                if card["type"] == "attack":
                    target_chars = sorted([c for c in player1_characters if not c["is_asleep"]], 
                                          key=lambda x: x["current_sleep"], reverse=True)
                    for char in target_chars:
                        try:
                            current_game_state = apply_card_effect(current_game_state, bot_player_id, card_index, char["id"])
                            bot_hand = current_game_state["players"][bot_player_id]["hand"]
                            moves_made = True
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
            for card_index, card in enumerate(bot_hand):
                if card["type"] == "support": # Only support cards can add sleep
                    target_chars = sorted([c for c in player2_characters if not c["is_asleep"]], 
                                          key=lambda x: x["current_sleep"])
                    for char in target_chars:
                        try:
                            current_game_state = apply_card_effect(current_game_state, bot_player_id, card_index, char["id"])
                            bot_hand = current_game_state["players"][bot_player_id]["hand"]
                            moves_made = True
                            best_move_found = True
                            print(f"Bot plays {card['name']} on its own character {char['name']} to add sleep.")
                            break
                        except ValueError as e:
                            continue
                if best_move_found:
                    break
        if best_move_found:
            continue

        # If no strategic moves found, break the loop to end turn
        if not best_move_found:
            break
    
    # After attempting all moves, the bot ends its turn
    try:
        final_game_state = end_turn(current_game_state, bot_player_id)
        print("Bot ended its turn.")
        return final_game_state
    except ValueError as e:
        print(f"Bot error ending turn: {e}. Returning current state.")
        return current_game_state