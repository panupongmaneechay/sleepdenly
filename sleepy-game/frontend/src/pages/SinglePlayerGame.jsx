// sleepy-game/frontend/src/pages/SinglePlayerGame.jsx
import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
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

const API_BASE_URL = 'http://127.0.0.1:5000';

function SinglePlayerGame() {
  const [gameState, setGameState] = useState(null);
  const [message, setMessage] = useState("Initializing game...");
  const [information, setInformation] = useState({ name: 'N/A', age: 'N/A', description: 'Click on a character for details.' });
  const [gameOver, setGameOver] = useState(false);
  const [winner, setWinner] = useState(null);
  const [logEntries, setLogEntries] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false); // New state to prevent double clicks/drops

  // New states for Swap card logic
  const [swapInProgress, setSwapInProgress] = useState(false);
  const [selectedCardsToSwap, setSelectedCardsToSwap] = useState([]); // Stores { index, card, isOpponent }
  const [swapCardPlayedIndex, setSwapCardPlayedIndex] = useState(null); // Stores the index of the 'Swap' card itself

  // New states for Defense card logic
  const [pendingAttackDetails, setPendingAttackDetails] = useState(null); // Stores details of the incoming attack

  const myPlayerId = 'player1';
  const botPlayerId = 'player2';

  // Helper to determine maximum cards to swap based on current hand sizes
  const getMaxCardsToSwap = useCallback(() => {
    if (!gameState || !myPlayerId) return 0;
    const myHandSizeExcludingSwap = gameState.players[myPlayerId].hand.length - (swapCardPlayedIndex !== null ? 1 : 0);
    const opponentHandSize = gameState.players[botPlayerId].hand_size; // Opponent's hand_size is visible
    return Math.min(myHandSizeExcludingSwap, opponentHandSize);
  }, [gameState, myPlayerId, botPlayerId, swapCardPlayedIndex]);

  // Define initializeGame using useCallback
  const initializeGame = useCallback(async () => {
    try {
      setIsProcessing(true); // Start processing
      const response = await axios.post(`${API_BASE_URL}/game/initialize`);
      setGameState(response.data);
      setGameOver(false);
      setWinner(null);
      setLogEntries([]);
      setSwapInProgress(false);
      setSelectedCardsToSwap([]);
      setSwapCardPlayedIndex(null);
      setPendingAttackDetails(null);
      setMessage("Game initialized! Your turn.");
    } catch (error) {
      console.error("Error initializing game:", error);
      setMessage("Error initializing game.");
    } finally {
      setIsProcessing(false); // End processing
    }
  }, []); 

  useEffect(() => {
    initializeGame();
  }, [initializeGame]); 

  useEffect(() => {
    if (gameState) {
      setMessage(gameState.message);
      setLogEntries(gameState.action_log || []);

      setSwapInProgress(gameState.swap_in_progress || false);
      setSelectedCardsToSwap(gameState.selected_cards_for_swap || []);
      setPendingAttackDetails(gameState.pending_attack || null); 

      if (gameState.current_turn === botPlayerId && !gameOver && !gameState.pending_attack && !isProcessing) {
        // Prevent bot from moving if still processing previous action
        setTimeout(debouncedHandleBotMove, 1500); 
      } else if (gameState.game_over) {
        setGameOver(true);
        setWinner(gameState.winner);
        setMessage(`${gameState.winner === myPlayerId ? 'You' : 'AI'} win!`);
      }
    }
  }, [gameState, gameOver, myPlayerId, botPlayerId, swapInProgress, pendingAttackDetails, isProcessing]); 

  const handleCardDrop = useCallback(async (cardIndex, targetCharacterId, cardType, targetPlayerIdOfChar, playingPlayerId) => {
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

    try {
        const finalTargetCharacterId = targetCharacterId || null; 
        const payload = {
            gameState: gameState, 
            playerId: playingPlayerId,
            cardIndex: cardIndex,
            targetCharacterId: finalTargetCharacterId,
            targetCardIndices: null, 
            defendingCardIndex: null, 
        };

        const response = await axios.post(`${API_BASE_URL}/game/apply_card`, payload);
        if (response.data.error) {
            setMessage(`Error: ${response.data.error}`);
        } else {
            setGameState(response.data.gameState);
            if (response.data.winStatus.game_over) {
                setGameOver(true);
                setWinner(response.data.winStatus.winner);
                setMessage(response.data.winStatus.message);
            } else {
                setMessage(response.data.message || "Card played successfully! You can play another or end turn.");
            }
        }
    } catch (error) {
        console.error("Error applying card:", error);
        setMessage(`Error: ${error.response?.data?.error || error.message}`);
    } finally {
        setIsProcessing(false); // Always set processing to false after request completes or fails
    }
  }, [gameState, gameOver, myPlayerId, swapInProgress, pendingAttackDetails, isProcessing]); 

  const debouncedHandleCardDrop = useCallback(debounce(handleCardDrop, 300), [handleCardDrop]); 

  const handlePlayCardAction = useCallback(async (cardIndex, cardType) => {
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

    try {
        if (cardType === 'theif') {
            setMessage("Using Thief card...");
            const payload = {
                gameState: gameState, 
                playerId: myPlayerId,
                cardIndex: cardIndex,
                targetCharacterId: null, 
                targetCardIndices: null,
                defendingCardIndex: null, 
            };

            const response = await axios.post(`${API_BASE_URL}/game/apply_card`, payload);
            if (response.data.error) {
                setMessage(`Error: ${response.data.error}`);
            } else {
                setGameState(response.data.gameState);
                if (response.data.winStatus.game_over) {
                    setGameOver(true);
                    setWinner(response.data.winStatus.winner);
                    setMessage(response.data.winStatus.message);
                } else {
                    setMessage(response.data.message);
                }
            }
        } else if (cardType === 'swap') {
            const myHandSizeExcludingSwap = gameState.players[myPlayerId].hand.length - 1;
            const opponentHandSize = gameState.players[botPlayerId].hand_size; 

            if (myHandSizeExcludingSwap === 0 || opponentHandSize === 0) {
                setMessage("You need at least one card (excluding the Swap card) and your opponent must have at least one card to use Swap.");
                setIsProcessing(false); // Stop processing if validation fails
                return;
            }

            setSwapInProgress(true);
            setSwapCardPlayedIndex(cardIndex); 
            setSelectedCardsToSwap([]); 
            setMessage(`Select up to ${Math.min(myHandSizeExcludingSwap, opponentHandSize)} of your cards and an equal number of opponent's cards to swap. Click the Swap button to confirm.`);
            // No API call yet, so don't set isProcessing to false immediately
        } else if (cardType === 'defense') {
            setMessage("Defense cards are used when an opponent plays an action on you. You will be prompted to use it then.");
            // No API call, so stop processing
        } else {
            setMessage("Please drag and drop this card onto a character.");
        }
    } catch (error) {
        console.error("Error using card:", error);
        setMessage(`Error using card: ${error.response?.data?.error || error.message}`);
    } finally {
        // Only set isProcessing to false if not entering a multi-step process like swap
        if (cardType !== 'swap') {
            setIsProcessing(false);
        }
    }
  }, [gameState, gameOver, myPlayerId, swapInProgress, pendingAttackDetails, isProcessing]);

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

  const handleConfirmSwap = useCallback(async () => {
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

      const payload = {
        gameState: gameState, 
        playerId: myPlayerId,
        cardIndex: swapCardPlayedIndex, 
        targetCharacterId: null, 
        targetCardIndices: targetCardIndices,
        defendingCardIndex: null,
      };

      try {
        const response = await axios.post(`${API_BASE_URL}/game/apply_card`, payload);
        if (response.data.error) {
            setMessage(`Error during swap: ${response.data.error}`);
        } else {
            setGameState(response.data.gameState);
            setSwapInProgress(false);
            setSelectedCardsToSwap([]);
            setSwapCardPlayedIndex(null);
            setMessage(response.data.message);
        }
      } catch (error) {
        console.error("Error during swap:", error);
        setMessage(`Error during swap: ${error.response?.data?.error || error.message}`);
      } finally {
        setIsProcessing(false); // End processing
        setSwapInProgress(false); // Ensure these flags are reset
        setSelectedCardsToSwap([]);
        setSwapCardPlayedIndex(null);
      }
    } else {
      setMessage(`Please select exactly ${numCardsToSwap} cards from your hand and ${numCardsToSwap} from the opponent's hand.`);
    }
  }, [gameState, myPlayerId, selectedCardsToSwap, swapCardPlayedIndex, getMaxCardsToSwap, isProcessing]);

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

  // --- Defense Card Handlers ---
  const handleDefendAction = useCallback(async (useDefense, defendingCardIndex = null) => {
    if (isProcessing) {
        setMessage("Please wait, an action is already being processed.");
        return;
    }
    if (!pendingAttackDetails) return; 

    setMessage("Resolving opponent's action...");
    setIsProcessing(true); // Set processing true
    try {
        const payload = {
            gameState: gameState, 
            playerId: myPlayerId,
            useDefense: useDefense,
            defendingCardIndex: defendingCardIndex,
        };

        const response = await axios.post(`${API_BASE_URL}/game/resolve_pending_attack`, payload);
        if (response.data.error) {
            setMessage(`Error resolving attack: ${response.data.error}`);
        } else {
            setGameState(response.data.gameState);
            if (response.data.winStatus.game_over) {
                setGameOver(true);
                setWinner(response.data.winStatus.winner);
                setMessage(response.data.winStatus.message);
            } else {
                setMessage(response.data.message);
            }
        }
    } catch (error) {
      console.error("Error resolving pending attack:", error);
      setMessage(`Error resolving pending attack: ${error.response?.data?.error || error.message}`);
    } finally {
      setIsProcessing(false); // End processing
      setPendingAttackDetails(null); 
    }
  }, [gameState, myPlayerId, pendingAttackDetails, isProcessing]);

  const handleEndTurn = useCallback(async () => {
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
    try {
        const payload = {
            gameState: gameState, 
            playerId: myPlayerId
        };
        const response = await axios.post(`${API_BASE_URL}/game/end_turn`, payload);
        if (response.data.error) {
            setMessage(`Error: ${response.data.error}`);
        } else {
            setGameState(response.data.gameState);
            if (response.data.winStatus.game_over) {
                setGameOver(true);
                setWinner(response.data.winStatus.winner);
                setMessage(response.data.winStatus.message);
            } else {
                setMessage(response.data.message);
            }
        }
    } catch (error) {
        console.error("Error ending turn:", error);
        setMessage(`Error ending turn: ${error.response?.data?.error || error.message}`);
    } finally {
        setIsProcessing(false); // End processing
    }
  }, [gameState, gameOver, myPlayerId, swapInProgress, pendingAttackDetails, isProcessing]);

  const handleBotMove = useCallback(async () => {
    if (isProcessing) { // Prevent bot from moving if still processing
        return;
    }
    setIsProcessing(true); // Set processing true for bot's turn
    setGameState(prevGameState => {
        if (!prevGameState) return null;
        if (gameOver || prevGameState.current_turn !== botPlayerId) return prevGameState;

        setMessage("AI is thinking...");
        axios.post(`${API_BASE_URL}/game/bot_move`, { gameState: prevGameState })
        .then(response => {
            if (response.data.error) {
                setMessage(`AI Error: ${response.data.error}`);
            } else {
                setGameState(response.data.gameState);
                if (response.data.winStatus.game_over) {
                    setGameOver(true);
                    setWinner(response.data.winStatus.winner);
                    setMessage(response.data.winStatus.message);
                } else {
                    setMessage(response.data.message);
                }
            }
        })
        .catch(error => {
            console.error("Error during bot move:", error);
            setMessage("Error during AI's turn.");
        })
        .finally(() => {
            setIsProcessing(false); // End processing after bot move
        });
        return prevGameState;
    });
  }, [gameState, gameOver, botPlayerId, isProcessing]);

  const debouncedHandleBotMove = useCallback(debounce(handleBotMove, 300), [handleBotMove]);


  const handleCharacterClick = useCallback((characterId) => {
    let character = null;
    for (const playerKey in gameState.players) {
        character = gameState.players[playerKey].characters.find(char => char.id === characterId);
        if (character) break;
    }
    if (character) {
        setInformation({
            name: character.name,
            age: `${character.age} years old`,
            description: `${character.description || ''} Current Sleep: ${character.current_sleep}/${character.max_sleep}.`
        });
    }
  }, [gameState]);


  if (!gameState) {
    return <div className="game-container loading">Loading game...</div>;
  }

  const player1 = gameState.players[myPlayerId];
  const player2 = gameState.players[botPlayerId]; 

  // Determine if it's my turn
  const isMyTurn = gameState.current_turn === myPlayerId;
  const isOpponentTurn = gameState.current_turn !== myPlayerId;


  return (
    <div className="game-container">
      <div className="game-board-area">
        <div className="game-board">
          {/* Player 2 (AI/Opponent) Zone */}
          <PlayerZone
            player={`${player2.player_name} (AI)`}
            characters={player2.characters}
            sleepCount={player2.sleep_count}
            handSize={player2.hand_size || 0}
            onCharacterClick={handleCharacterClick}
            onCardDrop={debouncedHandleCardDrop} // Use debounced handler
            isCurrentTurn={isOpponentTurn}
            isOpponentZone={true}
            myPlayerId={myPlayerId}
            currentTurnPlayerId={gameState.current_turn}
            swapInProgress={swapInProgress}
          />

          {/* Player 1 (You) Zone */}
          <PlayerZone
            player={`${player1.player_name} (You)`}
            characters={player1.characters}
            sleepCount={player1.sleep_count}
            handSize={player1.hand.length}
            onCharacterClick={handleCharacterClick}
            onCardDrop={debouncedHandleCardDrop} // Use debounced handler
            isCurrentTurn={isMyTurn}
            isOpponentZone={false}
            myPlayerId={myPlayerId}
            currentTurnPlayerId={gameState.current_turn}
            swapInProgress={swapInProgress}
          />

          {/* Current Player Hand */}
          <div className="player-hand-container">
            <div className="player-hand">
              {player1.hand.map((card, index) => (
                <HandCard
                  key={`${index}-${card.name}-${JSON.stringify(card.effect)}`}
                  card={card}
                  index={index}
                  isDraggable={isMyTurn && !gameOver && !swapInProgress && !pendingAttackDetails && !isProcessing} // Disable drag if processing
                  playerSourceId={myPlayerId}
                  onClick={debouncedHandlePlayCardAction} // Use debounced handler
                  isSelectableForSwap={swapInProgress && index !== swapCardPlayedIndex && !isProcessing} // Disable selection if processing
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
                  {Array.from({ length: player2.hand_size }).map((_, index) => (
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
                {player1.has_defense_card_in_hand ? (
                  <>
                    <p>Do you want to use a Defense Card to nullify this action?</p>
                    <div className="defense-actions">
                      <button onClick={() => handleDefendAction(true, player1.hand.findIndex(card => card.type === 'defense'))} disabled={isProcessing}>Use Defense Card</button>
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
              {gameOver && <h2 className="game-over-message">{winner === myPlayerId ? 'You Won!' : 'AI Won!'}</h2>}
              {gameOver && <button onClick={initializeGame} className="restart-button">Play Again</button>}
          </div>
        </div>
      </div>
    </div>
  );
}

export default SinglePlayerGame;