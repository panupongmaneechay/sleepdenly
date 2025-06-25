import React, { useState, useEffect, useRef } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
// Removed `io from 'socket.io-client'`
import CharacterCard from '../components/CharacterCard';
import HandCard from '../components/HandCard';
import InformationPanel from '../components/InformationPanel';
import PlayerZone from '../components/PlayerZone';
import '../styles/Game.css';

// Removed: const socket = io(SOCKET_SERVER_URL, ...);

function MultiPlayerGame({ socket }) { // Receive socket as prop
  const { roomId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const [gameState, setGameState] = useState(null);
  const [message, setMessage] = useState("Waiting for opponent...");
  const [information, setInformation] = useState({ name: 'N/A', age: 'N/A', description: 'Click on a character for details.' });
  const [gameOver, setGameOver] = useState(false);
  const [winner, setWinner] = useState(null);
  const [logEntries, setLogEntries] = useState([]);

  // New states for Swap card logic
  const [swapInProgress, setSwapInProgress] = useState(false);
  const [selectedCardsToSwap, setSelectedCardsToSwap] = useState([]);
  const [swapCardPlayedIndex, setSwapCardPlayedIndex] = useState(null);

  // New states for Defense card logic
  const [pendingAttackDetails, setPendingAttackDetails] = useState(null);

  // Initialize myPlayerId from location state if available
  const [myPlayerId, setMyPlayerId] = useState(location.state?.playerId || null); 

  // Opponent Player ID is derived once myPlayerId is known
  const opponentPlayerId = myPlayerId === 'player1' ? 'player2' : 'player1';

  const isMyTurn = gameState && gameState.current_turn === myPlayerId;
  const isOpponentsTurn = gameState && gameState.current_turn === opponentPlayerId;

  const getMaxCardsToSwap = () => {
    if (!gameState || !myPlayerId || swapCardPlayedIndex === null) return 0; // swapCardPlayedIndex is only set when Swap card is clicked
    const myHandSizeExcludingSwap = (gameState.players[myPlayerId].hand ? gameState.players[myPlayerId].hand.length : 0) - (swapCardPlayedIndex !== null ? 1 : 0);
    const opponentHandSize = gameState.players[opponentPlayerId].hand_size;
    return Math.min(myHandSizeExcludingSwap, opponentHandSize);
  };

  useEffect(() => {
    if (!socket || !roomId) {
        setMessage("Socket or Room ID not available. Redirecting to lobby.");
        setTimeout(() => navigate('/multiplayer-lobby'), 2000);
        return;
    }

    // No need to call socket.connect() here, it's connected in App.js

    // If initial game state is provided from Lobby, set it
    if (location.state?.initialGameState && location.state?.playerId) {
        setGameState(location.state.initialGameState);
        setMyPlayerId(location.state.playerId);
        setMessage(location.state.initialGameState.message);
        setLogEntries(location.state.initialGameState.action_log || []);
        // Clear location state after using it to avoid re-triggering this on subsequent renders
        // Note: Direct modification of location.state is not standard React Router. 
        // A better approach would be to manage game state with a global state manager (Redux, Zustand, Context API).
        // For simplicity and direct answer, we proceed assuming initial data comes once.
    }
    
    // Listen for game_start event (relevant if refreshing page or direct access)
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
      if (!myPlayerId) { // Ensure myPlayerId is set before processing update
          console.warn("myPlayerId not set when game_update received. Waiting for game_start.");
          // Attempt to infer player ID if not set (fallback, ideally set by game_start)
          if (socket.id === data.players_sids.player1.sid) {
              setMyPlayerId('player1');
          } else if (socket.id === data.players_sids.player2.sid) {
              setMyPlayerId('player2');
          } else {
              console.error("Could not infer myPlayerId from game_update. Disconnecting.");
              socket.disconnect(); // Disconnect if cannot infer player ID
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
    });

    socket.on('player_disconnected', (data) => {
      setMessage(`Opponent disconnected: ${data.message}. Returning to lobby...`);
      setTimeout(() => navigate('/multiplayer-lobby'), 3000);
    });

    socket.on('error', (data) => {
      setMessage(`Game Error: ${data.message}`);
    });

    // Clean up on component unmount
    return () => {
      // Don't disconnect socket here, it's managed by App.js
      socket.off('game_start'); // Turn off only listeners specific to this component
      socket.off('game_update');
      socket.off('player_disconnected');
      socket.off('error');
    };
  }, [roomId, navigate, socket, myPlayerId, location.state]); // Add socket and myPlayerId to dependencies
  // Make sure myPlayerId is updated from game_start event, not just location state

  const handleCardDrop = (cardIndex, targetCharacterId, cardType, targetPlayerIdOfChar, playingPlayerId) => {
    if (swapInProgress) {
        setMessage("A card swap is in progress. Please select cards to swap or cancel.");
        return;
    }
    if (pendingAttackDetails) {
        setMessage("An opponent's action is pending defense. Please decide to use a Defense card or not.");
        return;
    }

    setGameState(prevGameState => {
        if (!prevGameState) return null;
        if (prevGameState.current_turn !== playingPlayerId || gameOver) {
            setMessage("Not your turn or game over.");
            return prevGameState;
        }

        if (cardType === 'theif' || cardType === 'swap' || cardType === 'defense') {
          setMessage("This card cannot be dropped on a character. Click the card to use it.");
          return prevGameState;
        }

        setMessage("Playing card...");
        socket.emit('play_card', {
            room_id: roomId,
            player_id: playingPlayerId,
            card_index: cardIndex,
            target_character_id: targetCharacterId,
            target_card_indices: null,
            defendingCardIndex: null,
        });
        return prevGameState;
    });
  };

  const handlePlayCardAction = (cardIndex, cardType) => {
    setGameState(prevGameState => {
        if (!prevGameState) return null;
        if (prevGameState.current_turn !== myPlayerId || gameOver) {
            setMessage("Not your turn or game over.");
            return prevGameState;
        }
        if (swapInProgress) {
            setMessage("A card swap is in progress. Please select cards to swap or cancel.");
            return prevGameState;
        }
        if (pendingAttackDetails) {
            setMessage("An opponent's action is pending defense. Please decide to use a Defense card or not.");
            return prevGameState;
        }

        if (cardType === 'theif') {
            setMessage("Using Thief card...");
            socket.emit('play_card', {
                room_id: roomId,
                player_id: myPlayerId,
                card_index: cardIndex,
                target_character_id: null,
                target_card_indices: null,
                defendingCardIndex: null,
            });
            return prevGameState;
        }

        if (cardType === 'swap') {
            const myHandSizeExcludingSwap = prevGameState.players[myPlayerId].hand.length - 1;
            const opponentHandSize = prevGameState.players[opponentPlayerId].hand_size;

            if (myHandSizeExcludingSwap === 0 || opponentHandSize === 0) {
                setMessage("You need at least one card (excluding the Swap card) and your opponent must have at least one card to use Swap.");
                return prevGameState;
            }

            setSwapInProgress(true);
            setSwapCardPlayedIndex(cardIndex);
            setSelectedCardsToSwap([]);
            setMessage(`Select up to ${Math.min(myHandSizeExcludingSwap, opponentHandSize)} of your cards and an equal number of opponent's cards to swap. Click the Confirm Swap button.`);
            return { ...prevGameState, swap_in_progress: true };
        }

        if (cardType === 'defense') {
            setMessage("Defense cards are used when an opponent plays an action on you. You will be prompted to use it then.");
            return prevGameState;
        }

        setMessage("Please drag and drop this card onto a character.");
        return prevGameState;
    });
  };

  const handleSelectCardForSwap = (cardIndex, card, isOpponent) => {
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
  };

  const handleConfirmSwap = () => {
    const mySelected = selectedCardsToSwap.filter(item => !item.isOpponent);
    const oppSelected = selectedCardsToSwap.filter(item => item.isOpponent);

    const numCardsToSwap = getMaxCardsToSwap();

    if (mySelected.length === numCardsToSwap && oppSelected.length === numCardsToSwap) {
      setMessage("Confirming swap...");
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

      setSwapInProgress(false);
      setSelectedCardsToSwap([]);
      setSwapCardPlayedIndex(null);

    } else {
      setMessage(`Please select exactly ${numCardsToSwap} cards from your hand and ${numCardsToSwap} from the opponent's hand.`);
    }
  };

  const handleCancelSwap = () => {
    setSwapInProgress(false);
    setSelectedCardsToSwap([]);
    setSwapCardPlayedIndex(null);
    setMessage("Card swap cancelled. You can play another card or end your turn.");
  };

  const handleDefendAction = (useDefense, defendingCardIndex = null) => {
    if (!pendingAttackDetails) return;

    setMessage("Resolving opponent's action...");
    socket.emit('resolve_pending_attack', {
      room_id: roomId,
      player_id: myPlayerId,
      useDefense: useDefense,
      defendingCardIndex: defendingCardIndex,
    });

    setPendingAttackDetails(null);
  };

  const handleEndTurn = () => {
    if (swapInProgress) {
        setMessage("A card swap is in progress. Please complete or cancel the swap before ending your turn.");
        return;
    }
    if (pendingAttackDetails) {
        setMessage("An opponent's action is pending defense. Please decide to use a Defense card or not.");
        return;
    }

    setGameState(prevGameState => {
        if (!prevGameState) return null;
        if (prevGameState.current_turn !== myPlayerId || gameOver) {
            setMessage("Not your turn or game is over.");
            return prevGameState;
        }

        setMessage("Ending your turn...");
        socket.emit('end_turn', {
            room_id: roomId,
            player_id: myPlayerId,
        });
        return prevGameState;
    });
  };

  const handleCharacterClick = (characterId) => {
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
  };

  // Ensure currentPlayer and opponentPlayer are safely accessed only when gameState is not null
  const currentPlayer = gameState ? gameState.players[myPlayerId] : null;
  const opponentPlayer = gameState ? gameState.players[opponentPlayerId] : null;

  // Render loading state if gameState or myPlayerId is not yet available
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
            onCardDrop={handleCardDrop}
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
            onCardDrop={handleCardDrop}
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
                  isDraggable={isMyTurn && !gameOver && !swapInProgress && !pendingAttackDetails} 
                  playerSourceId={myPlayerId}
                  onClick={handlePlayCardAction}
                  isSelectableForSwap={swapInProgress && index !== swapCardPlayedIndex} 
                  onSelectForSwap={handleSelectCardForSwap}
                  isSelected={selectedCardsToSwap.some(item => !item.isOpponent && item.index === index)}
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
                      isSelectableForSwap={swapInProgress}
                      onSelectForSwap={handleSelectCardForSwap}
                      isSelected={selectedCardsToSwap.some(item => item.isOpponent && item.index === index)}
                    />
                  ))}
                </div>
                <div className="swap-buttons">
                  <button onClick={handleConfirmSwap} disabled={selectedCardsToSwap.filter(item => !item.isOpponent).length !== getMaxCardsToSwap() || selectedCardsToSwap.filter(item => item.isOpponent).length !== getMaxCardsToSwap()}>Confirm Swap</button>
                  <button onClick={handleCancelSwap} className="cancel-button">Cancel Swap</button>
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
                      <button onClick={() => handleDefendAction(true, currentPlayerHand.findIndex(card => card.type === 'defense'))}>Use Defense Card</button>
                      <button onClick={() => handleDefendAction(false)} className="cancel-button">Don't Use</button>
                    </div>
                  </>
                ) : (
                  <>
                    <p>You don't have a Defense Card to nullify this action.</p>
                    <button onClick={() => handleDefendAction(false)}>Continue</button>
                  </>
                )}
              </div>
            )}

            {!swapInProgress && !pendingAttackDetails && (
              <button
                onClick={handleEndTurn}
                disabled={!isMyTurn || gameOver}
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
              {/* แสดง Log Entries ย้อนหลัง */}
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