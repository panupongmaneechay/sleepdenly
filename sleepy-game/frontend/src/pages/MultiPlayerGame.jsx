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
  const [message, setMessage] = useState("Loading game...");
  const [information, setInformation] = useState({ name: 'N/A', age: 'N/A', description: 'Click on a character for details.' });
  const [gameOver, setGameOver] = useState(false);
  const [winner, setWinner] = useState(null);
  const [logEntries, setLogEntries] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false); 

  const [swapInProgress, setSwapInProgress] = useState(false);
  const [selectedCardsToSwap, setSelectedCardsToSwap] = useState([]);
  const [swapCardPlayedIndex, setSwapCardPlayedIndex] = useState(null);

  const [pendingAttackDetails, setPendingAttackDetails] = useState(null);

  const [myPlayerId, setMyPlayerId] = useState(location.state?.playerId || null);

  // Derive isMyTurn from gameState
  const isMyTurn = gameState && gameState.current_turn === myPlayerId;


  const getMaxCardsToSwap = useCallback(() => {
    if (!gameState || !myPlayerId || swapCardPlayedIndex === null) return 0;
    const myHand = gameState.players[myPlayerId]?.hand || [];
    const myHandSizeExcludingSwap = myHand.length - (myHand[swapCardPlayedIndex]?.type === 'swap' ? 1 : 0);
    
    let maxOpponentHandSize = 0;
    // Find the largest hand among active human opponents
    for (const pId in gameState.players) {
        if (pId !== myPlayerId && !gameState.players[pId].is_bot && !gameState.players[pId].has_lost) {
            maxOpponentHandSize = Math.max(maxOpponentHandSize, gameState.players[pId].hand_size);
        }
    }
    return Math.min(myHandSizeExcludingSwap, maxOpponentHandSize);
  }, [gameState, myPlayerId, swapCardPlayedIndex]);


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
        const assignedPlayerId = Object.keys(data.initial_game_states).find(
            playerId => data.initial_game_states[playerId].sid === socket.id
        );
        
        if (assignedPlayerId) {
            setMyPlayerId(assignedPlayerId);
            const initialPlayerState = data.initial_game_states[assignedPlayerId].game_state;
            setGameState(initialPlayerState);
            setMessage(`Game started! It's ${initialPlayerState.current_turn === assignedPlayerId ? 'your' : initialPlayerState.players[initialPlayerState.current_turn].player_name + '\'s'} turn.`);
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
          console.warn("myPlayerId not set when game_update received. Attempting to infer from update.");
          const inferredPlayerId = Object.keys(data.game_states_for_players).find(
            playerId => data.game_states_for_players[playerId].sid === socket.id
          );
          if (inferredPlayerId) {
            setMyPlayerId(inferredPlayerId);
          } else {
              console.error("Could not infer myPlayerId from game_update. Disconnecting.");
              socket.disconnect();
              navigate('/multiplayer-lobby');
              return;
          }
      }
      const updatedPlayerState = data.game_states_for_players[myPlayerId].game_state;
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
      setIsProcessing(false); 
    });

    socket.on('player_disconnected', (data) => {
      setMessage(`A player disconnected: ${data.message}. Returning to lobby...`);
      setTimeout(() => navigate('/multiplayer-lobby'), 3000);
    });

    socket.on('error', (data) => {
      setMessage(`Game Error: ${data.message}`);
      setIsProcessing(false); 
    });

    return () => {
      socket.off('game_start');
      socket.off('game_update');
      socket.off('player_disconnected');
      socket.off('error');
    };
  }, [roomId, navigate, socket, myPlayerId, location.state]);

  const handleCardDrop = useCallback((cardIndex, targetCharacterId, cardType, targetPlayerIdOfChar, playingPlayerId) => {
    if (isProcessing) { 
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

    setIsProcessing(true); 
    setMessage("Playing card...");

    const finalTargetCharacterId = targetCharacterId || null; 
    socket.emit('play_card', {
        room_id: roomId,
        player_id: playingPlayerId,
        card_index: cardIndex,
        target_character_id: finalTargetCharacterId, 
        target_card_indices: null,
        defending_card_index: null,
        target_player_for_thief_swap: targetPlayerIdOfChar // Pass the target player for potential Thief/Swap
    });
  }, [roomId, gameState, gameOver, myPlayerId, swapInProgress, pendingAttackDetails, isProcessing, socket]);

  const debouncedHandleCardDrop = useCallback(debounce(handleCardDrop, 300), [handleCardDrop]); 

  const handlePlayCardAction = useCallback((cardIndex, cardType) => {
    if (isProcessing) { 
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

    setIsProcessing(true); 

    if (cardType === 'theif') {
        setMessage("Using Thief card...");
        // For Thief card, the backend will decide the target opponent if not explicitly selected.
        // For human players, typically they would select the target, but current UI doesn't support that directly.
        // Passing null for target_player_for_thief_swap lets backend choose for now.
        socket.emit('play_card', {
            room_id: roomId,
            player_id: myPlayerId,
            card_index: cardIndex,
            target_character_id: null, 
            target_card_indices: null,
            defending_card_index: null,
            target_player_for_thief_swap: null // Backend will choose a random active human opponent
        });
    } else if (cardType === 'swap') {
        const myHandSizeExcludingSwap = (gameState.players[myPlayerId]?.hand?.length || 0) - 1;
        
        let maxOpponentHandSize = 0;
        let eligibleOpponents = [];
        for (const pId in gameState.players) {
            // Only human opponents are eligible for swap by a human player (bots swap randomly with any opponent)
            if (pId !== myPlayerId && !gameState.players[pId].is_bot && !gameState.players[pId].has_lost) {
                maxOpponentHandSize = Math.max(maxOpponentHandSize, gameState.players[pId].hand_size);
                eligibleOpponents.push(pId);
            }
        }
        
        if (myHandSizeExcludingSwap === 0 || maxOpponentHandSize === 0 || eligibleOpponents.length === 0) {
            setMessage("You need at least one card (excluding the Swap card) and an active human opponent with at least one card to use Swap.");
            setIsProcessing(false);
            return;
        }

        setSwapInProgress(true);
        setSwapCardPlayedIndex(cardIndex);
        setSelectedCardsToSwap([]); 
        setMessage(`Select up to ${Math.min(myHandSizeExcludingSwap, maxOpponentHandSize)} of your cards and an equal number of opponent's cards to swap. Click the Confirm Swap button.`);
    } else if (cardType === 'defense') {
        setMessage("Defense cards are used when an opponent plays an action on you. You will be prompted to use it then.");
    } else {
        setMessage("Please drag and drop this card onto a character.");
    }

    if (cardType !== 'swap' && cardType !== 'defense') {
        setIsProcessing(false);
    }
  }, [roomId, gameState, gameOver, myPlayerId, swapInProgress, pendingAttackDetails, isProcessing, socket]);

  const debouncedHandlePlayCardAction = useCallback(debounce(handlePlayCardAction, 300), [handlePlayCardAction]);

  const handleSelectCardForSwap = useCallback((cardIndex, card, isOpponent, targetPlayerIdForSelection) => {
    if (isProcessing) {
        setMessage("Please wait, an action is already being processed.");
        return;
    }
    setSelectedCardsToSwap(prevSelected => {
      const currentSwapCount = getMaxCardsToSwap();
      const existingSelectionIndex = prevSelected.findIndex(
        (item) => item.index === cardIndex && item.isOpponent === isOpponent && item.targetPlayerId === targetPlayerIdForSelection
      );

      let newSelected = [...prevSelected];

      if (existingSelectionIndex !== -1) {
        newSelected.splice(existingSelectionIndex, 1);
      } else {
        const mySelectedCount = newSelected.filter(item => !item.isOpponent).length;
        // Count opponent cards for this specific opponent
        const oppSelectedCount = newSelected.filter(item => item.isOpponent && item.targetPlayerId === targetPlayerIdForSelection).length;

        if (isOpponent) {
            // Ensure only selecting from one opponent for swap for human players
            const selectedOpponents = new Set(newSelected.filter(item => item.isOpponent).map(item => item.targetPlayerId));
            if (selectedOpponents.size > 0 && !selectedOpponents.has(targetPlayerIdForSelection)) {
                setMessage("You can only swap with one opponent at a time. Deselect cards from previous opponent first.");
                return prevSelected;
            }

            if (oppSelectedCount < currentSwapCount) {
                newSelected.push({ index: cardIndex, card, isOpponent, targetPlayerId: targetPlayerIdForSelection });
            } else {
                setMessage(`You can only select up to ${currentSwapCount} cards from the opponent's hand.`);
            }
        } else if (!isOpponent && mySelectedCount < currentSwapCount) {
          if (cardIndex !== swapCardPlayedIndex) { 
              newSelected.push({ index: cardIndex, card, isOpponent, targetPlayerId: myPlayerId });
          } else {
              setMessage("You cannot select the Swap card itself for the swap.");
          }
        } else {
            setMessage(`You can only select up to ${currentSwapCount} cards from each side.`);
        }
      }

      return newSelected;
    });
  }, [isProcessing, getMaxCardsToSwap, swapCardPlayedIndex, myPlayerId]);

  const handleConfirmSwap = useCallback(() => {
    if (isProcessing) {
        setMessage("Please wait, an action is already being processed.");
        return;
    }

    const mySelected = selectedCardsToSwap.filter(item => !item.isOpponent);
    const opponentSelected = selectedCardsToSwap.filter(item => item.isOpponent);

    const numCardsToSwap = getMaxCardsToSwap();

    const selectedOpponentPlayerIds = new Set(opponentSelected.map(item => item.targetPlayerId));

    if (mySelected.length === numCardsToSwap && opponentSelected.length === numCardsToSwap && selectedOpponentPlayerIds.size === 1) {
      setMessage("Confirming swap...");
      setIsProcessing(true); 
      
      const targetCardIndices = []; // This will be flattened: [myIdx1, oppIdx1, myIdx2, oppIdx2, ...]
      mySelected.forEach(item => targetCardIndices.push(item.index));
      opponentSelected.forEach(item => targetCardIndices.push(item.index)); 

      const targetPlayerForSwap = selectedOpponentPlayerIds.values().next().value; // The single opponent chosen

      socket.emit('play_card', {
        room_id: roomId,
        player_id: myPlayerId,
        card_index: swapCardPlayedIndex,
        target_character_id: null,
        target_card_indices: targetCardIndices, 
        defending_card_index: null,
        target_player_for_thief_swap: targetPlayerForSwap 
      });

    } else {
      setMessage(`Please select exactly ${numCardsToSwap} cards from your hand and ${numCardsToSwap} from ONE opponent's hand.`);
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
    setIsProcessing(true); 
    socket.emit('resolve_pending_attack', {
      room_id: roomId,
      player_id: myPlayerId,
      useDefense: useDefense,
      defending_card_index: defendingCardIndex,
    });
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

    setIsProcessing(true); 
    setMessage("Ending your turn...");
    socket.emit('end_turn', {
        room_id: roomId,
        player_id: myPlayerId,
    });
  }, [roomId, myPlayerId, gameState, gameOver, swapInProgress, pendingAttackDetails, isProcessing, socket]);

  const handleCharacterClick = useCallback((characterId) => {
    let character = null;
    let characterOwner = null;
    for (const playerKey in gameState.players) {
        character = gameState.players[playerKey].characters.find(char => char.id === characterId);
        if (character) {
            characterOwner = gameState.players[playerKey].player_name;
            break;
        }
    }
    if (character) {
        setInformation({
            name: character.name,
            age: `${character.age} years old`,
            description: `${character.description || ''} Current Sleep: ${character.current_sleep}/${character.max_sleep}. (Owner: ${characterOwner})`
        });
    }
  }, [gameState]);


  if (!gameState || !myPlayerId) {
    return (
      <div className="game-container loading">
        <p>{message}</p>
        <button onClick={() => navigate('/multiplayer-lobby')} className="back-button">Back to Lobby</button>
      </div>
    );
  }

  const myPlayer = gameState.players[myPlayerId];
  const allPlayers = Object.values(gameState.players).sort((a,b) => {
    // Sort players by their original turn order to maintain consistent rendering
    return gameState.player_turn_order.indexOf(a.player_id) - gameState.player_turn_order.indexOf(b.player_id);
  });
  
  const currentPlayerHasDefenseCard = myPlayer ? myPlayer.has_defense_card_in_hand : false;

  // Find the first active human opponent for swap display purposes
  const humanOpponentForSwap = allPlayers.find(p => p.player_id !== myPlayerId && !p.is_bot && !p.has_lost);
  const opponentPlayerIdForSwap = humanOpponentForSwap ? humanOpponentForSwap.player_id : null;
  const opponentHandSizeForSwap = humanOpponentForSwap ? humanOpponentForSwap.hand_size : 0;


  return (
    <div className="game-container">
      <div className="game-board-area">
        <div className={`game-board game-board--${allPlayers.length}-players`}>
          {/* Render Player Zones dynamically */}
          {allPlayers.map(player => (
            <PlayerZone
              key={player.player_id}
              player={`${player.player_name} ${player.is_bot ? '(AI)' : ''} ${player.player_id === myPlayerId ? '(You)' : ''}`}
              characters={player.characters}
              sleepCount={player.sleep_count}
              handSize={player.hand_size || 0}
              onCharacterClick={handleCharacterClick}
              onCardDrop={debouncedHandleCardDrop}
              isCurrentTurn={gameState.current_turn === player.player_id}
              isOpponentZone={player.player_id !== myPlayerId}
              myPlayerId={myPlayerId}
              currentTurnPlayerId={gameState.current_turn}
              swapInProgress={swapInProgress}
            />
          ))}

          {/* Current Player Hand and Action Area */}
          <div className="player-hand-container">
            <div className="player-hand">
              {myPlayer.hand.map((card, index) => (
                <HandCard
                  key={`${index}-${card.name}-${JSON.stringify(card.effect)}`}
                  card={card}
                  index={index}
                  isDraggable={isMyTurn && !gameOver && !swapInProgress && !pendingAttackDetails && !isProcessing}
                  playerSourceId={myPlayerId}
                  onClick={debouncedHandlePlayCardAction}
                  isSelectableForSwap={swapInProgress && index !== swapCardPlayedIndex && !isProcessing}
                  onSelectForSwap={(idx, c, isOpponent) => handleSelectCardForSwap(idx, c, isOpponent, myPlayerId)} // Pass myPlayerId as target for my own cards
                  isSelected={selectedCardsToSwap.some(item => !item.isOpponent && item.index === index)}
                  isAttackIncoming={pendingAttackDetails && pendingAttackDetails.target_player_id === myPlayerId} 
                  isDefendable={card.type === 'defense'} 
                  onDefendSelect={(idx) => handleDefendAction(true, idx)} 
                />
              ))}
            </div>

            {/* Opponent's Hand for Swap Selection (only for human opponents) */}
            {swapInProgress && humanOpponentForSwap && (
              <div className="opponent-hand-for-swap">
                <h3>Select {getMaxCardsToSwap()} cards from {humanOpponentForSwap.player_name}'s hand:</h3>
                <div className="opponent-hand-cards">
                  {Array.from({ length: opponentHandSizeForSwap }).map((_, index) => (
                    <HandCard
                      key={`opponent-card-${opponentPlayerIdForSwap}-${index}`}
                      card={{ name: 'Opponent Card', type: 'unknown', description: 'Hidden Card' }}
                      index={index}
                      isOpponentCard={true}
                      isDraggable={false}
                      isSelectableForSwap={swapInProgress && !isProcessing}
                      onSelectForSwap={(idx, c, isOpponent) => handleSelectCardForSwap(idx, c, isOpponent, opponentPlayerIdForSwap)}
                      isSelected={selectedCardsToSwap.some(item => item.isOpponent && item.index === index && item.targetPlayerId === opponentPlayerIdForSwap)}
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
                <h3>{gameState.players[pendingAttackDetails.player_id].player_name} used {pendingAttackDetails.card_name}!</h3>
                {currentPlayerHasDefenseCard ? (
                  <>
                    <p>Do you want to use a Defense Card to nullify this action?</p>
                    <div className="defense-actions">
                      <button onClick={() => handleDefendAction(true, myPlayer.hand.findIndex(card => card.type === 'defense'))} disabled={isProcessing}>Use Defense Card</button>
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
                disabled={!isMyTurn || gameOver || isProcessing}
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
              <div className="action-log-display">
                {logEntries.slice().reverse().map((log, index) => (
                    <p key={`log-${index}`} className="log-entry">
                        {log}
                    </p>
                ))}
              </div>
              {gameOver && <h2 className="game-over-message">{winner === myPlayerId ? 'You Won!' : `${gameState.players[winner]?.player_name || 'An Opponent'} Won!`}</h2>}
              {gameOver && <button onClick={() => navigate('/multiplayer-lobby')} className="restart-button">Back to Lobby</button>}
          </div>
        </div>
      </div>
    </div>
  );
}

export default MultiPlayerGame;