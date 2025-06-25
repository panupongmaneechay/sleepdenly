// sleepy-game/frontend/src/pages/MultiPlayerGame.jsx
import React, { useState, useEffect, useRef } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import io from 'socket.io-client';
import CharacterCard from '../components/CharacterCard';
import HandCard from '../components/HandCard';
import InformationPanel from '../components/InformationPanel';
import PlayerZone from '../components/PlayerZone';
import '../styles/Game.css';

const SOCKET_SERVER_URL = 'http://127.0.0.1:5000';
const socket = io(SOCKET_SERVER_URL);

function MultiPlayerGame() {
  const { roomId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const [gameState, setGameState] = useState(null);
  const [message, setMessage] = useState("Waiting for opponent...");
  const [information, setInformation] = useState({ name: 'N/A', age: 'N/A', description: 'Click on a character for details.' });
  const [gameOver, setGameOver] = useState(false);
  const [winner, setWinner] = useState(null);
  const [logEntries, setLogEntries] = useState([]); // สถานะใหม่สำหรับเก็บ Log

  // New states for Swap card logic
  const [swapInProgress, setSwapInProgress] = useState(false);
  const [selectedCardsToSwap, setSelectedCardsToSwap] = useState([]); // Stores { index, card, isOpponent }
  const [swapCardPlayedIndex, setSwapCardPlayedIndex] = useState(null); // Stores the index of the 'Swap' card itself

  // New states for Defense card logic
  const [pendingAttackDetails, setPendingAttackDetails] = useState(null); // Stores details of the incoming attack

  const myPlayerId = location.state?.playerId;
  const opponentPlayerId = myPlayerId === 'player1' ? 'player2' : 'player1';

  const isMyTurn = gameState && gameState.current_turn === myPlayerId;
  const isOpponentsTurn = gameState && gameState.current_turn === opponentPlayerId; // New: track opponent's turn

  // Helper to determine maximum cards to swap based on current hand sizes
  const getMaxCardsToSwap = () => {
    if (!gameState || !myPlayerId) return 0;
    // Exclude the swap card itself from the count of cards the player has to swap
    const myHandSizeExcludingSwap = gameState.players[myPlayerId].hand.length - (swapCardPlayedIndex !== null ? 1 : 0);
    const opponentHandSize = gameState.players[opponentPlayerId].hand_size; // Opponent's hand_size is visible
    return Math.min(myHandSizeExcludingSwap, opponentHandSize);
  };

  useEffect(() => {
    if (!myPlayerId) {
      setMessage("Error: Player ID not found. Redirecting to lobby.");
      setTimeout(() => navigate('/multiplayer-lobby'), 2000);
      return;
    }

    socket.on('connect', () => {
      console.log('Connected to Socket.IO server for multiplayer.');
    });

    socket.on('game_start', (data) => {
      console.log("Game started!", data);
      const initialPlayerState = data[`${myPlayerId}_game_state`];
      setGameState(initialPlayerState);
      setMessage(`Game started! It's ${data.current_turn === myPlayerId ? 'your' : 'opponent\'s'} turn.`);
      setLogEntries(initialPlayerState.action_log || []);
      setSwapInProgress(initialPlayerState.swap_in_progress || false); // Initialize from game state
      setSelectedCardsToSwap(initialPlayerState.selected_cards_for_swap || []); // Initialize from game state
      setPendingAttackDetails(initialPlayerState.pending_attack || null); // Initialize from game state
    });

    socket.on('game_update', (data) => {
      console.log("Game update received:", data);
      const updatedPlayerState = data[`${myPlayerId}_game_state`];
      setGameState(updatedPlayerState);

      // Update swapInProgress and selectedCardsToSwap from gameState
      setSwapInProgress(updatedPlayerState.swap_in_progress || false);
      setSelectedCardsToSwap(updatedPlayerState.selected_cards_for_swap || []);
      setPendingAttackDetails(updatedPlayerState.pending_attack || null); // Update pending attack details

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

    return () => {
      socket.disconnect();
      socket.off('connect');
      socket.off('game_start');
      socket.off('game_update');
      socket.off('player_disconnected');
      socket.off('error');
    };
  }, [roomId, myPlayerId, opponentPlayerId, navigate]);

  const handleCardDrop = (cardIndex, targetCharacterId, cardType, targetPlayerIdOfChar, playingPlayerId) => {
    // Prevent actions if a swap is in progress
    if (swapInProgress) {
        setMessage("A card swap is in progress. Please select cards to swap or cancel.");
        return;
    }

    // Prevent playing cards if there's a pending attack that needs defense
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

        // Thief card cannot be dropped on a character, it's used by clicking
        if (cardType === 'theif') {
          setMessage("Thief card cannot be dropped on a character. Click the card to use it.");
          return prevGameState;
        }
        // Swap card cannot be dropped on a character either
        if (cardType === 'swap') {
            setMessage("Swap card cannot be dropped on a character. Click the card to use it.");
            return prevGameState;
        }
        // Defense card cannot be dropped on a character
        if (cardType === 'defense') {
            setMessage("Defense card cannot be dropped on a character. It activates automatically when attacked or can be clicked to resolve.");
            return prevGameState;
        }


        setMessage("Playing card...");
        socket.emit('play_card', {
            room_id: roomId,
            player_id: playingPlayerId,
            card_index: cardIndex,
            target_character_id: targetCharacterId,
            target_card_indices: null, // Ensure this is null for non-swap cards
            defendingCardIndex: null, // Not defending now
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

        // If a swap is already in progress, prevent playing other cards
        if (swapInProgress) {
            setMessage("A card swap is in progress. Please select cards to swap or cancel.");
            return prevGameState;
        }

        // Prevent playing cards if there's a pending attack that needs defense
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
                defendingCardIndex: null, // Not defending now
            });
            return prevGameState;
        }

        // Handle Swap card activation
        if (cardType === 'swap') {
            const myHandSizeExcludingSwap = prevGameState.players[myPlayerId].hand.length - 1;
            const opponentHandSize = prevGameState.players[opponentPlayerId].hand_size;

            if (myHandSizeExcludingSwap === 0 || opponentHandSize === 0) {
                setMessage("You need at least one card (excluding the Swap card) and your opponent must have at least one card to use Swap.");
                return prevGameState;
            }

            setSwapInProgress(true);
            setSwapCardPlayedIndex(cardIndex); // Store the index of the Swap card
            setSelectedCardsToSwap([]); // Reset any previous selections
            setMessage(`Select up to ${Math.min(myHandSizeExcludingSwap, opponentHandSize)} of your cards and an equal number of opponent's cards to swap. Click the Confirm Swap button.`);
            return { ...prevGameState, swap_in_progress: true }; // Update game state immediately to reflect swap mode
        }

        // Defense card cannot be "played" like other cards, it's selected during an incoming attack
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
        // Card already selected, unselect it
        newSelected.splice(existingSelectionIndex, 1);
      } else {
        // Card not selected, select it if count allows
        const mySelectedCount = newSelected.filter(item => !item.isOpponent).length;
        const oppSelectedCount = newSelected.filter(item => item.isOpponent).length;

        if (isOpponent && oppSelectedCount < currentSwapCount) {
          newSelected.push({ index: cardIndex, card, isOpponent });
        } else if (!isOpponent && mySelectedCount < currentSwapCount) {
          // Ensure the selected card is not the Swap card itself
          if (cardIndex !== swapCardPlayedIndex || isOpponent) { // If it's my card, ensure it's not the swap card
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
      for (let i = 0; i < numCardsToSwap; i++) {
        targetCardIndices.push(mySelected[i].index);
        targetCardIndices.push(oppSelected[i].index);
      }

      socket.emit('play_card', {
        room_id: roomId,
        player_id: myPlayerId,
        card_index: swapCardPlayedIndex, // Pass the index of the Swap card itself
        target_character_id: null, // Not applicable for Swap
        target_card_indices: targetCardIndices,
        defendingCardIndex: null, // Not defending now
      });

      // Reset swap state regardless, as the game_update will reflect actual state
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
    // If a swap was initiated but cancelled, the turn should still be for the player who initiated it
    // The game state will be updated by the server to reflect the cancellation.
  };

  // --- Defense Card Handlers ---
  const handleDefendAction = (useDefense, defendingCardIndex = null) => {
    if (!pendingAttackDetails) return; // Should not happen

    setMessage("Resolving opponent's action...");
    socket.emit('resolve_pending_attack', {
      room_id: roomId,
      player_id: myPlayerId,
      useDefense: useDefense,
      defendingCardIndex: defendingCardIndex,
    });

    setPendingAttackDetails(null); // Clear pending attack details
  };

  const handleEndTurn = () => {
    // Prevent ending turn if a swap is in progress
    if (swapInProgress) {
        setMessage("A card swap is in progress. Please complete or cancel the swap before ending your turn.");
        return;
    }
    // Prevent ending turn if there's a pending attack that needs defense
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

  if (!gameState) {
    return (
      <div className="game-container loading">
        <p>{message}</p>
        <button onClick={() => navigate('/multiplayer-lobby')} className="back-button">Back to Lobby</button>
      </div>
    );
  }

  const currentPlayer = gameState.players[myPlayerId];
  const opponentPlayer = gameState.players[opponentPlayerId];

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
            swapInProgress={swapInProgress} // Pass swapInProgress
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
            swapInProgress={swapInProgress} // Pass swapInProgress
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
                  onClick={handlePlayCardAction} // Handles Thief and Swap card clicks
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
                      card={{ name: 'Opponent Card', type: 'unknown', description: 'Hidden Card' }} // Display as hidden card
                      index={index}
                      isOpponentCard={true}
                      isDraggable={false}
                      isSelectableForSwap={swapInProgress} // Allow selection during swap
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