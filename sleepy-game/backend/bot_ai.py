import random
from game_logic import apply_card_effect, check_win_condition, end_turn, MAX_HAND_SIZE

def make_bot_move(game_state):
    bot_player_id = "player2"
    
    # Anti Theft Card
    # รอโดนขโมยการ์ด
    if game_state["theft_in_progress"] and game_state["theft_in_progress"]["target_player_id"] == bot_player_id:
        print("Bot is targeted by theft, awaiting player's response.")
        return game_state 
    # Check ว่าใช่ Turn ของ Bot ไหม
    if game_state["current_turn"] != bot_player_id:
        return game_state

    current_game_state = dict(game_state)
    bot_hand = list(current_game_state["players"][bot_player_id]["hand"]) 
    player1_characters = current_game_state["players"]["player1"]["characters"]
    player2_characters = current_game_state["players"][bot_player_id]["characters"]
    
    # วนการ์ดในมือ เพื่อใช้ โดยจะไม่ใช้ การ์ด anti_theft เพราะใช้ไม่ได้
    while True:
        best_move_found = False
        playable_hand = [card for card in bot_hand if card["type"] != "anti_theft"] 
        
        if not playable_hand: 
            break
        # Theif Card
        # ใช้การ์ด theif ถ้าในมือคู่ต่อสู้มีมากกว่า 0 ใบ
        theif_card_index = -1
        for idx, card in enumerate(bot_hand): 
            if card["type"] == "theif":
                theif_card_index = idx
                break
        #พิจารณาใช้การ์ดขโมย หากมีช่องว่างในมือ
        player1_hand_size = len(current_game_state["players"]["player1"]["hand"])
        if theif_card_index != -1 and player1_hand_size > 0 and len(bot_hand) < MAX_HAND_SIZE:
            try:
                #ถ้าคู่ต่อสู้มี 3 ใบ และบอทมี 4 ใบ (ช่องว่าง 1 ใบ) min(3, 5-4) = min(3, 1) = 1 -> ขโมย 1 ใบ
                num_to_steal = min(player1_hand_size, MAX_HAND_SIZE - len(bot_hand))    
                #ยืนยันอีกครั้งว่าจำนวนการ์ดที่จะขโมยจริง ๆ (actual_num_to_steal) จะต้องไม่เกินจำนวนการ์ดในมือของคู่ต่อสู้ (player1_hand_size)
                actual_num_to_steal = min(num_to_steal, player1_hand_size)

                #สร้างลิสต์ว่างสำหรับเก็บดัชนีของการ์ดที่บอทจะเลือกขโมย
                selected_card_indices_for_thief = []
                if actual_num_to_steal > 0:
                    selected_card_indices_for_thief = random.sample(range(player1_hand_size), actual_num_to_steal)
                
                # ใช้ฟังก์ชั่นจัดการการ์ดและผลกระทบของการ์ดนั้นต่อสถานะของเกมส์
                current_game_state = apply_card_effect(
                    current_game_state,
                    bot_player_id,
                    theif_card_index,
                    selected_card_indices_from_opponent=selected_card_indices_for_thief 
                )
                #ดึงสถานะล่าสุดหลังขโมยการ์ดคู่ต่อสู้มา
                bot_hand = list(current_game_state["players"][bot_player_id]["hand"]) 
                # Set เป็น True ให้เล่นต่อหลังขโมยการ์ดมาได้
                best_move_found = True
                print(f"Bot plays Thief and stole {actual_num_to_steal} cards! Bot's new hand size: {len(bot_hand)}")
            except ValueError as e:
                print(f"Bot failed to play Thief card: {e}")
                pass 
            if best_move_found:
                continue 

  
        # Lucky Card
        # วนหาการ์ด Lucky
        lucky_card_index = -1
        for idx, card in enumerate(playable_hand):
            if card["type"] == "lucky":
                if card in bot_hand: # Ensure card is still in original hand
                    original_index = bot_hand.index(card)
                    lucky_card_index = original_index
                    break
        # ถ้ามีการ์ด Lucky ซึ่งไม่ใช่ == -1 และจะใช้การ์ดกับตัวละครที่ไม่ถูกป้องกัน ยังต้องการชั่วโมงนอน และ ยังไม่หลับ 
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

        # Dispel Card
        # พิจารณาใช้ Dispel Card
        dispel_card_index = -1
        for idx, card in enumerate(playable_hand):
            if card["type"] == "dispel":
                if card in bot_hand:
                    original_index = bot_hand.index(card)
                    dispel_card_index = original_index
                    break
        # จะใช้ก็ต่อเมื่อตรวจเจอว่าฝ่ายตรงข้าม กำลังถูก Protected อยู่
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

        # Defensive Card
        # พิจารณาใช้ Defensive Card
        defensive_card_index = -1
        for idx, card in enumerate(playable_hand):
            if card["type"] == "defensive":
                if card in bot_hand:
                    original_index = bot_hand.index(card)
                    defensive_card_index = original_index
                    break

        # ใช้การ์ดกับ การ์ดที่ยังไม่หลับและไม่ถูก Protected
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
        # Attack Card
        # ใช้การ์ดโจมตี ติดลบมากที่สุด เช่นมุ่งโจมตี หนึ่งคน ให้มีคะแนน ติดลบมากที่สุด
        if not best_move_found:
            # วนหาการ์ดโจมตี
            for card_index_playable, card in enumerate(playable_hand):
                if card["type"] == "attack":
                    if card in bot_hand:
                        original_index = bot_hand.index(card)
                        for char in player1_characters:
                            # โจมตีการ์ดที่ยังไม่หลับ และ ไม่ถูก Protected
                            if not char["is_asleep"] and not char["is_protected"]:
                                # เช็คว่าคือการลดชั่วโมงการนอน
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

        # Attack Card ตัวละครที่ใกล้จะหลับมากที่สุด
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
            
        # Support Card
        # ทำให้ตัวละครที่ใกล้หลับมากที่สุดได้หลับก่อน
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

        #ออกจาก Loop
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