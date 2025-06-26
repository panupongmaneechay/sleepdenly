import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import CharacterCard from '../components/CharacterCard';
import HandCard from '../components/HandCard';
import InformationPanel from '../components/InformationPanel';
import PlayerZone from '../components/PlayerZone';
import '../styles/Game.css';

// Debounce utility function
const debounce = (func, delay) => {
  let timeout;
  return function(...args) {
    const context = this;
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(context, args), delay);
  };
};

function MultiPlayerGame({ socket }) {
  const { roomId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const [gameState, setGameState] = useState(null);
  const [message, setMessage] = useState("Waiting for opponent...");
  const [information, setInformation] = useState({ name: 'N/A', age: 'N/A', description: 'Click on a character for details.' });
  const [gameOver, setGameOver] = useState(false);
  const [winner, setWinner] = useState(null);
  const [logEntries, setLogEntries] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false); // New state to prevent double clicks/drops

  const [swapInProgress, setSwapInProgress] = useState(false);
  const [selectedCardsToSwap, setSelectedCardsToSwap] = useState([]);
  const [swapCardPlayedIndex, setSwapCardPlayedIndex] = useState(null);

  const [pendingAttackDetails, setPendingAttackDetails] = useState(null);

  const [myPlayerId, setMyPlayerId] = useState(location.state?.playerId || null);

  const opponentPlayerId = myPlayerId === 'player1' ? 'player2' : 'player1';

  const isMyTurn = gameState && gameState.current_turn === myPlayerId;
  const isOpponentsTurn = gameState && gameState.current_turn === opponentPlayerId;

  const getMaxCardsToSwap = useCallback(() => {
    if (!gameState || !myPlayerId || swapCardPlayedIndex === null) return 0;
    const myHandSizeExcludingSwap = (gameState.players[myPlayerId].hand ? gameState.players[myPlayerId].hand.length : 0) - (swapCardPlayedIndex !== null ? 1 : 0);
    const opponentHandSize = gameState.players[opponentPlayerId].hand_size;
    return Math.min(myHandSizeExcludingSwap, opponentHandSize);
  }, [gameState, myPlayerId, opponentPlayerId, swapCardPlayedIndex]);


  useEffect(() => {
    if (!socket || !roomId) {
        setMessage("Socket or Room ID not available. Redirecting to lobby.");
        setTimeout(() => navigate('/multiplayer-lobby'), 2000);
        return;
    }

    if (location.state?.initialGameState && location.state?.playerId) {
        setGameState(location.state.initialGameState);
        setMyPlayerId(location.state.playerId);
        setMessage(location.state.initialGameState.message);
        setLogEntries(location.state.initialGameState.action_log || []);
        setSwapInProgress(location.state.initialGameState.swap_in_progress || false);
        setSelectedCardsToSwap(location.state.initialGameState.selected_cards_for_swap || []);
        setPendingAttackDetails(location.state.initialGameState.pending_attack || null);
    }
    
    socket.on('game_start', (data) => {
        console.log("Game: Game start signal received. Setting state.", data);
        const player1_sid_in_room = data.players_sids.player1.sid;
        const player2_sid_in_room = data.players_sids.player2.sid;
        
        let assignedPlayerId = null;
        if (socket.id === player1_sid_in_room) {
            assignedPlayerId = 'player1';
        } else if (socket.id === player2_sid_in_room) {
            assignedPlayerId = 'player2';
        }

        if (assignedPlayerId) {
            setMyPlayerId(assignedPlayerId);
            const initialPlayerState = data[`${assignedPlayerId}_game_state`];
            setGameState(initialPlayerState);
            setMessage(`Game started! It's ${initialPlayerState.current_turn === assignedPlayerId ? 'your' : 'opponent\'s'} turn.`);
            setLogEntries(initialPlayerState.action_log || []);
            setSwapInProgress(initialPlayerState.swap_in_progress || false);
            setSelectedCardsToSwap(initialPlayerState.selected_cards_for_swap || []);
            setPendingAttackDetails(initialPlayerState.pending_attack || null);
        } else {
            setMessage("Failed to determine player ID from game start data. Returning to lobby.");
            setTimeout(() => navigate('/multiplayer-lobby'), 2000);
        }
    });


    socket.on('game_update', (data) => {
      console.log("Game update received:", data);
      if (!myPlayerId) {
          console.warn("myPlayerId not set when game_update received. Waiting for game_start.");
          if (socket.id === data.players_sids.player1.sid) {
              setMyPlayerId('player1');
          } else if (socket.id === data.players_sids.player2.sid) {
              setMyPlayerId('player2');
          } else {
              console.error("Could not infer myPlayerId from game_update. Disconnecting.");
              socket.disconnect();
              navigate('/multiplayer-lobby');
              return;
          }
      }
      const updatedPlayerState = data[`${myPlayerId}_game_state`];
      setGameState(updatedPlayerState);

      setSwapInProgress(updatedPlayerState.swap_in_progress || false);
      setSelectedCardsToSwap(updatedPlayerState.selected_cards_for_swap || []);
      setPendingAttackDetails(updatedPlayerState.pending_attack || null);

      if (data.win_status.game_over) {
        setGameOver(true);
        setWinner(data.win_status.winner);
        setMessage(data.win_status.message);
      } else {
        setMessage(data.message);
      }
      setLogEntries(updatedPlayerState.action_log || []);
      setIsProcessing(false); // End processing when game_update is received
    });

    socket.on('player_disconnected', (data) => {
      setMessage(`Opponent disconnected: ${data.message}. Returning to lobby...`);
      setTimeout(() => navigate('/multiplayer-lobby'), 3000);
    });

    socket.on('error', (data) => {
      setMessage(`Game Error: ${data.message}`);
      setIsProcessing(false); // End processing on error
    });

    return () => {
      socket.off('game_start');
      socket.off('game_update');
      socket.off('player_disconnected');
      socket.off('error');
    };
  }, [roomId, navigate, socket, myPlayerId, location.state]);

  const handleCardDrop = useCallback((cardIndex, targetCharacterId, cardType, targetPlayerIdOfChar, playingPlayerId) => {
    if (isProcessing) { // Prevent action if already processing
        setMessage("Please wait, an action is already being processed.");
        return;
    }
    if (swapInProgress) {
        setMessage("A card swap is in progress. Please select cards to swap or cancel.");
        return;
    }
    if (pendingAttackDetails) {
        setMessage("An opponent's action is pending defense. Please decide to use a Defense card or not.");
        return;
    }
    console.log("handleCardDrop called. cardIndex:", cardIndex, "targetCharacterId:", targetCharacterId, "cardType:", cardType, "playingPlayerId:", playingPlayerId);

    if (!['attack', 'support', 'lucky'].includes(cardType)) {
        setMessage("This card cannot be dropped on a character. Click the card to use it.");
        return; 
    }

    setIsProcessing(true); // Set processing true before sending request
    setMessage("Playing card...");

    // Ensure targetCharacterId is not null or undefined here
    const finalTargetCharacterId = targetCharacterId || null; 
    socket.emit('play_card', {
        room_id: roomId,
        player_id: playingPlayerId,
        card_index: cardIndex,
        target_character_id: finalTargetCharacterId, 
        target_card_indices: null,
        defendingCardIndex: null,
    });
    // State updates for multiplayer come from 'game_update' socket event
  }, [roomId, gameState, gameOver, myPlayerId, swapInProgress, pendingAttackDetails, isProcessing, socket]);

  const debouncedHandleCardDrop = useCallback(debounce(handleCardDrop, 300), [handleCardDrop]); // Debounce the drop handler

  const handlePlayCardAction = useCallback((cardIndex, cardType) => {
    if (isProcessing) { // Prevent action if already processing
        setMessage("Please wait, an action is already being processed.");
        return;
    }
    if (swapInProgress) {
        setMessage("A card swap is in progress. Please select cards to swap or cancel.");
        return;
    }
    if (pendingAttackDetails) {
        setMessage("An opponent's action is pending defense. Please decide to use a Defense card or not.");
        return;
    }
    console.log("handlePlayCardAction called. cardIndex:", cardIndex, "cardType:", cardType);

    setIsProcessing(true); // Set processing true

    if (cardType === 'theif') {
        setMessage("Using Thief card...");
        socket.emit('play_card', {
            room_id: roomId,
            player_id: myPlayerId,
            card_index: cardIndex,
            target_character_id: null, // Thief does not target characters
            target_card_indices: null,
            defendingCardIndex: null,
        });
    } else if (cardType === 'swap') {
        const myHandSizeExcludingSwap = gameState.players[myPlayerId].hand.length - 1;
        const opponentHandSize = gameState.players[opponentPlayerId].hand_size;

        if (myHandSizeExcludingSwap === 0 || opponentHandSize === 0) {
            setMessage("You need at least one card (excluding the Swap card) and your opponent must have at least one card to use Swap.");
            setIsProcessing(false); // Stop processing if validation fails
            return;
        }

        setSwapInProgress(true);
        setSwapCardPlayedIndex(cardIndex);
        setSelectedCardsToSwap([]);
        setMessage(`Select up to ${Math.min(myHandSizeExcludingSwap, opponentHandSize)} of your cards and an equal number of opponent's cards to swap. Click the Confirm Swap button.`);
        // No API call yet, so don't set isProcessing to false immediately
    } else if (cardType === 'defense') {
        setMessage("Defense cards are used when an opponent plays an action on you. You will be prompted to use it then.");
        // No API call, so stop processing
    } else {
        setMessage("Please drag and drop this card onto a character.");
    }

    // Only set isProcessing to false if not entering a multi-step process like swap
    if (cardType !== 'swap') {
        setIsProcessing(false);
    }
  }, [roomId, gameState, gameOver, myPlayerId, swapInProgress, pendingAttackDetails, isProcessing, socket, opponentPlayerId]);

  const debouncedHandlePlayCardAction = useCallback(debounce(handlePlayCardAction, 300), [handlePlayCardAction]);

  const handleSelectCardForSwap = useCallback((cardIndex, card, isOpponent) => {
    if (isProcessing) {
        setMessage("Please wait, an action is already being processed.");
        return;
    }
    setSelectedCardsToSwap(prevSelected => {
      const currentSwapCount = getMaxCardsToSwap();
      const existingSelectionIndex = prevSelected.findIndex(
        (item) => item.index === cardIndex && item.isOpponent === isOpponent
      );

      let newSelected = [...prevSelected];

      if (existingSelectionIndex !== -1) {
        newSelected.splice(existingSelectionIndex, 1);
      } else {
        const mySelectedCount = newSelected.filter(item => !item.isOpponent).length;
        const oppSelectedCount = newSelected.filter(item => item.isOpponent).length;

        if (isOpponent && oppSelectedCount < currentSwapCount) {
          newSelected.push({ index: cardIndex, card, isOpponent });
        } else if (!isOpponent && mySelectedCount < currentSwapCount) {
          if (cardIndex !== swapCardPlayedIndex || isOpponent) {
              newSelected.push({ index: cardIndex, card, isOpponent });
          } else {
              setMessage("You cannot select the Swap card itself for the swap.");
          }
        } else {
            setMessage(`You can only select up to ${currentSwapCount} cards from each side.`);
        }
      }

      return newSelected;
    });
  }, [isProcessing, getMaxCardsToSwap, swapCardPlayedIndex]);

  const handleConfirmSwap = useCallback(() => {
    if (isProcessing) {
        setMessage("Please wait, an action is already being processed.");
        return;
    }

    const mySelected = selectedCardsToSwap.filter(item => !item.isOpponent);
    const oppSelected = selectedCardsToSwap.filter(item => item.isOpponent);

    const numCardsToSwap = getMaxCardsToSwap();

    if (mySelected.length === numCardsToSwap && oppSelected.length === numCardsToSwap) {
      setMessage("Confirming swap...");
      setIsProcessing(true); // Set processing true
      const targetCardIndices = [];
      mySelected.forEach(item => targetCardIndices.push(item.index));
      oppSelected.forEach(item => targetCardIndices.push(item.index));


      socket.emit('play_card', {
        room_id: roomId,
        player_id: myPlayerId,
        card_index: swapCardPlayedIndex,
        target_character_id: null,
        target_card_indices: targetCardIndices,
        defendingCardIndex: null,
      });

      // State updates for multiplayer come from 'game_update' socket event
      // The finally block in handleCardDrop (not this confirm handler) will handle setIsProcessing(false)
      // and clearing other states after the game_update is received.
    } else {
      setMessage(`Please select exactly ${numCardsToSwap} cards from your hand and ${numCardsToSwap} from the opponent's hand.`);
    }
  }, [roomId, myPlayerId, selectedCardsToSwap, swapCardPlayedIndex, getMaxCardsToSwap, isProcessing, socket]);

  const handleCancelSwap = useCallback(() => {
    if (isProcessing) {
        setMessage("Please wait, an action is already being processed.");
        return;
    }
    setSwapInProgress(false);
    setSelectedCardsToSwap([]);
    setSwapCardPlayedIndex(null);
    setMessage("Card swap cancelled. You can play another card or end your turn.");
  }, [isProcessing]);

  const handleDefendAction = useCallback((useDefense, defendingCardIndex = null) => {
    if (isProcessing) {
        setMessage("Please wait, an action is already being processed.");
        return;
    }
    if (!pendingAttackDetails) return;

    setMessage("Resolving opponent's action...");
    setIsProcessing(true); // Set processing true
    socket.emit('resolve_pending_attack', {
      room_id: roomId,
      player_id: myPlayerId,
      useDefense: useDefense,
      defendingCardIndex: defendingCardIndex,
    });

    // State updates for multiplayer come from 'game_update' socket event
    // The finally block in handleCardDrop (or game_update listener) will handle setIsProcessing(false)
    // and clearing other states after the game_update is received.
  }, [roomId, myPlayerId, pendingAttackDetails, isProcessing, socket]);

  const handleEndTurn = useCallback(() => {
    if (isProcessing) {
        setMessage("Please wait, an action is already being processed.");
        return;
    }
    if (swapInProgress) {
        setMessage("A card swap is in progress. Please complete or cancel the swap before ending your turn.");
        return;
    }
    if (pendingAttackDetails) {
        setMessage("An opponent's action is pending defense. Please decide to use a Defense card or not.");
        return;
    }

    setIsProcessing(true); // Set processing true
    setMessage("Ending your turn...");
    socket.emit('end_turn', {
        room_id: roomId,
        player_id: myPlayerId,
    });
    // State updates for multiplayer come from 'game_update' socket event
    // The finally block in handleCardDrop (or game_update listener) will handle setIsProcessing(false)
    // and clearing other states after the game_update is received.
  }, [roomId, myPlayerId, gameState, gameOver, swapInProgress, pendingAttackDetails, isProcessing, socket]);

  const handleCharacterClick = useCallback((characterId) => {
    let character = null;
    character = gameState?.players[myPlayerId]?.characters.find(char => char.id === characterId);
    if (!character) {
        character = gameState?.players[opponentPlayerId]?.characters.find(char => char.id === characterId);
    }

    if (character) {
        setInformation({
            name: character.name,
            age: `${character.age} years old`,
            description: `${character.description || ''} Current Sleep: ${character.current_sleep}/${character.max_sleep}.`
        });
    }
  }, [gameState, myPlayerId, opponentPlayerId]);


  const currentPlayer = gameState ? gameState.players[myPlayerId] : null;
  const opponentPlayer = gameState ? gameState.players[opponentPlayerId] : null;

  if (!gameState || !myPlayerId) {
    return (
      <div className="game-container loading">
        <p>{message}</p>
        <button onClick={() => navigate('/multiplayer-lobby')} className="back-button">Back to Lobby</button>
      </div>
    );
  }

  const currentPlayerCharacters = currentPlayer ? currentPlayer.characters : [];
  const currentPlayerHand = currentPlayer ? currentPlayer.hand : [];
  const currentPlayerSleepCount = currentPlayer ? currentPlayer.sleep_count : 0;
  const currentPlayerHasDefenseCard = currentPlayer ? currentPlayer.has_defense_card_in_hand : false;
  
  const opponentCharacters = opponentPlayer ? opponentPlayer.characters : [];
  const opponentHandSize = opponentPlayer ? opponentPlayer.hand_size : 0;
  const opponentSleepCount = opponentPlayer ? opponentPlayer.sleep_count : 0;

  return (
    <div className="game-container">
      <div className="game-board-area">
        <div className="game-board">
          {/* Opponent Player Zone */}
          <PlayerZone 
            player={`${opponentPlayer?.player_name || 'Opponent'} (Opponent)`} 
            characters={opponentCharacters} 
            sleepCount={opponentSleepCount} 
            handSize={opponentHandSize}
            onCharacterClick={handleCharacterClick} 
            onCardDrop={debouncedHandleCardDrop} // Use debounced handler
            isCurrentTurn={gameState.current_turn === opponentPlayerId}
            isOpponentZone={true}
            myPlayerId={myPlayerId}
            currentTurnPlayerId={gameState.current_turn}
            swapInProgress={swapInProgress}
          />

          {/* Current Player Zone */}
          <PlayerZone 
            player={`${currentPlayer?.player_name || 'You'} (You)`} 
            characters={currentPlayerCharacters} 
            sleepCount={currentPlayerSleepCount} 
            handSize={currentPlayerHand.length}
            onCharacterClick={handleCharacterClick} 
            onCardDrop={debouncedHandleCardDrop} // Use debounced handler
            isCurrentTurn={gameState.current_turn === myPlayerId}
            isOpponentZone={false}
            myPlayerId={myPlayerId}
            currentTurnPlayerId={gameState.current_turn}
            swapInProgress={swapInProgress}
          />

          {/* Current Player Hand */}
          <div className="player-hand-container">
            <div className="player-hand">
              {currentPlayerHand.map((card, index) => (
                <HandCard
                  key={`${index}-${card.name}-${JSON.stringify(card.effect)}`}
                  card={card}
                  index={index}
                  isDraggable={isMyTurn && !gameOver && !swapInProgress && !pendingAttackDetails && !isProcessing} // Disable drag if processing
                  playerSourceId={myPlayerId}
                  onClick={debouncedHandlePlayCardAction} // Use debounced handler
                  isSelectableForSwap={swapInProgress && index !== swapCardPlayedIndex && !isProcessing} // Disable selection if processing
                  onSelectForSwap={handleSelectCardForSwap}
                  isSelected={selectedCardsToSwap.some(item => item.isOpponent && item.index === index)}
                  isAttackIncoming={pendingAttackDetails && pendingAttackDetails.target_player_id === myPlayerId} 
                  isDefendable={card.type === 'defense'} 
                  onDefendSelect={(idx) => handleDefendAction(true, idx)} 
                />
              ))}
            </div>

            {/* Opponent's Hand for Swap Selection */}
            {swapInProgress && (
              <div className="opponent-hand-for-swap">
                <h3>Select {getMaxCardsToSwap()} cards from opponent's hand:</h3>
                <div className="opponent-hand-cards">
                  {Array.from({ length: opponentHandSize }).map((_, index) => (
                    <HandCard
                      key={`opponent-card-${index}`}
                      card={{ name: 'Opponent Card', type: 'unknown', description: 'Hidden Card' }}
                      index={index}
                      isOpponentCard={true}
                      isDraggable={false}
                      isSelectableForSwap={swapInProgress && !isProcessing} // Disable selection if processing
                      onSelectForSwap={handleSelectCardForSwap}
                      isSelected={selectedCardsToSwap.some(item => item.isOpponent && item.index === index)}
                    />
                  ))}
                </div>
                <div className="swap-buttons">
                  <button onClick={handleConfirmSwap} disabled={isProcessing || selectedCardsToSwap.filter(item => !item.isOpponent).length !== getMaxCardsToSwap() || selectedCardsToSwap.filter(item => item.isOpponent).length !== getMaxCardsToSwap()}>Confirm Swap</button>
                  <button onClick={handleCancelSwap} className="cancel-button" disabled={isProcessing}>Cancel Swap</button>
                </div>
              </div>
            )}

            {/* Defense Card Prompt */}
            {pendingAttackDetails && pendingAttackDetails.target_player_id === myPlayerId && (
              <div className="defense-prompt-container">
                <h3>Opponent used {pendingAttackDetails.card_name}!</h3>
                {currentPlayerHasDefenseCard ? (
                  <>
                    <p>Do you want to use a Defense Card to nullify this action?</p>
                    <div className="defense-actions">
                      <button onClick={() => handleDefendAction(true, currentPlayerHand.findIndex(card => card.type === 'defense'))} disabled={isProcessing}>Use Defense Card</button>
                      <button onClick={() => handleDefendAction(false)} className="cancel-button" disabled={isProcessing}>Don't Use</button>
                    </div>
                  </>
                ) : (
                  <>
                    <p>You don't have a Defense Card to nullify this action.</p>
                    <button onClick={() => handleDefendAction(false)} disabled={isProcessing}>Continue</button>
                  </>
                )}
              </div>
            )}

            {!swapInProgress && !pendingAttackDetails && (
              <button
                onClick={handleEndTurn}
                disabled={!isMyTurn || gameOver || isProcessing} // Disable if processing
                className="end-turn-button"
              >
                End Turn
              </button>
            )}
          </div>
        </div>

        <div className="info-and-log-area">
          <InformationPanel info={information} />
          <div className="game-messages-area">
              <h2>Game Log</h2>
              <p className={isMyTurn ? 'your-turn' : 'opponent-turn'}>
                {message}
              </p>
              {/* Display Log Entries in reverse order */}
              <div className="action-log-display">
                {logEntries.slice().reverse().map((log, index) => (
                    <p key={`log-${index}`} className="log-entry">
                        {log}
                    </p>
                ))}
              </div>
              {gameOver && <h2 className="game-over-message">{winner === myPlayerId ? 'You Won!' : 'Opponent Won!'}</h2>}
              {gameOver && <button onClick={() => navigate('/multiplayer-lobby')} className="restart-button">Back to Lobby</button>}
          </div>
        </div>
      </div>
    </div>
  );
}

export default MultiPlayerGame;