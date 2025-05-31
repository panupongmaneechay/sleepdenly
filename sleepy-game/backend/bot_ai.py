import random
from game_logic import apply_card_effect, check_win_condition, end_turn

def make_bot_move(game_state):
    bot_player_id = "player2"
    
    if game_state["current_turn"] != bot_player_id:
        return game_state

    current_game_state = dict(game_state) # Make a copy to simulate moves
    bot_hand = current_game_state["players"][bot_player_id]["hand"]
    player1_characters = current_game_state["players"]["player1"]["characters"]
    player2_characters = current_game_state["players"][bot_player_id]["characters"]

    # Bot's turn to play multiple cards
    moves_made = False
    
    # Simple loop to try to play cards until no more 'strategic' moves or no cards left
    while len(current_game_state["players"][bot_player_id]["hand"]) > 0:
        best_move_found = False
        
        # Strategy 1: Put opponent's character to sleep (most impactful)
        for card_index, card in enumerate(bot_hand):
            if card["effect"]["type"] == "reduce_sleep":
                for char in player1_characters:
                    if not char["is_asleep"]:
                        simulated_sleep = char["current_sleep"] + card["effect"]["value"]
                        if simulated_sleep >= char["max_sleep"]:
                            try:
                                current_game_state = apply_card_effect(current_game_state, bot_player_id, card_index, char["id"])
                                bot_hand = current_game_state["players"][bot_player_id]["hand"] # Update hand after playing
                                moves_made = True
                                best_move_found = True
                                print(f"Bot plays {card['name']} on {char['name']} to put to sleep.")
                                break # Move made, re-evaluate hand and targets
                            except ValueError as e:
                                # print(f"Bot failed to play card (already asleep?): {e}")
                                continue
            if best_move_found:
                break
        if best_move_found:
            continue # Try to play another card with updated state

        # Strategy 2: Reduce opponent's character sleep (soften them up)
        if not best_move_found:
            for card_index, card in enumerate(bot_hand):
                if card["effect"]["type"] == "reduce_sleep":
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
                if card["effect"]["type"] == "add_sleep":
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

        # If no strategic moves, break the loop to end turn or if no cards left
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