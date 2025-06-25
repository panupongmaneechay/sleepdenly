// sleepy-game/frontend/src/pages/SinglePlayerGame.jsx
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import CharacterCard from '../components/CharacterCard';
import HandCard from '../components/HandCard';
import InformationPanel from '../components/InformationPanel';
import PlayerZone from '../components/PlayerZone';
import '../styles/Game.css';

const API_BASE_URL = 'http://127.0.0.1:5000';

function SinglePlayerGame() {
  const [gameState, setGameState] = useState(null);
  const [message, setMessage] = useState("Initializing game...");
  const [information, setInformation] = useState({ name: 'N/A', age: 'N/A', description: 'Click on a character for details.' });
  const [gameOver, setGameOver] = useState(false);
  const [winner, setWinner] = useState(null);
  const [logEntries, setLogEntries] = useState([]);

  // New states for Swap card logic
  const [swapInProgress, setSwapInProgress] = useState(false);
  const [selectedCardsToSwap, setSelectedCardsToSwap] = useState([]); // Stores { index, card, isOpponent }
  const [swapCardPlayedIndex, setSwapCardPlayedIndex] = useState(null); // Stores the index of the 'Swap' card itself

  // New states for Defense card logic
  const [pendingAttackDetails, setPendingAttackDetails] = useState(null); // Stores details of the incoming attack

  const myPlayerId = 'player1';
  const botPlayerId = 'player2';

  // Helper to determine maximum cards to swap based on current hand sizes
  const getMaxCardsToSwap = () => {
    if (!gameState || !myPlayerId) return 0;
    const myHandSizeExcludingSwap = gameState.players[myPlayerId].hand.length - (swapCardPlayedIndex !== null ? 1 : 0);
    const opponentHandSize = gameState.players[botPlayerId].hand_size; // Opponent's hand_size is visible
    return Math.min(myHandSizeExcludingSwap, opponentHandSize);
  };

  useEffect(() => {
    initializeGame();
  }, []);

  useEffect(() => {
    if (gameState) {
      setMessage(gameState.message);
      setLogEntries(gameState.action_log || []);

      // Update swapInProgress and selectedCardsToSwap from gameState
      setSwapInProgress(gameState.swap_in_progress || false);
      setSelectedCardsToSwap(gameState.selected_cards_for_swap || []);
      setPendingAttackDetails(gameState.pending_attack || null); // Update pending attack details

      // Bot moves only if no pending attack and it's its turn
      if (gameState.current_turn === botPlayerId && !gameOver && !gameState.pending_attack) {
        setTimeout(handleBotMove, 1500);
      } else if (gameState.game_over) {
        setGameOver(true);
        setWinner(gameState.winner);
        setMessage(`${gameState.winner === myPlayerId ? 'You' : 'AI'} win!`);
      }
    }
  }, [gameState, gameOver, myPlayerId, botPlayerId, swapInProgress, pendingAttackDetails]); // Added pendingAttackDetails to dependencies

  const initializeGame = async () => {
    try {
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
    }
  };

  const handleCardDrop = async (cardIndex, targetCharacterId, cardType, targetPlayerIdOfChar, playingPlayerId) => {
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
        axios.post(`${API_BASE_URL}/game/apply_card`, {
            gameState: prevGameState,
            playerId: playingPlayerId,
            cardIndex: cardIndex,
            targetCharacterId: targetCharacterId,
            targetCardIndices: null, // Ensure this is null for non-swap cards
            defendingCardIndex: null, // Not defending now
        })
        .then(response => {
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
        })
        .catch(error => {
            console.error("Error applying card:", error);
            setMessage(`Error: ${error.response?.data?.error || error.message}`);
        });

        return prevGameState;
    });
  };

  const handlePlayCardAction = async (cardIndex, cardType) => {
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
            axios.post(`${API_BASE_URL}/game/apply_card`, {
                gameState: prevGameState,
                playerId: myPlayerId,
                cardIndex: cardIndex,
                targetCharacterId: null,
                targetCardIndices: null,
                defendingCardIndex: null, // Not defending now
            })
            .then(response => {
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
            })
            .catch(error => {
                console.error("Error using Thief card:", error);
                setMessage(`Error using Thief card: ${error.response?.data?.error || error.message}`);
            });
            return prevGameState;
        }

        // Handle Swap card activation
        if (cardType === 'swap') {
            const myHandSizeExcludingSwap = prevGameState.players[myPlayerId].hand.length - 1;
            const opponentHandSize = prevGameState.players[botPlayerId].hand_size;

            if (myHandSizeExcludingSwap === 0 || opponentHandSize === 0) {
                setMessage("You need at least one card (excluding the Swap card) and your opponent must have at least one card to use Swap.");
                return prevGameState;
            }

            setSwapInProgress(true);
            setSwapCardPlayedIndex(cardIndex); // Store the index of the Swap card
            setSelectedCardsToSwap([]); // Reset any previous selections
            setMessage(`Select up to ${Math.min(myHandSizeExcludingSwap, opponentHandSize)} of your cards and an equal number of opponent's cards to swap. Click the Swap button to confirm.`);
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

  const handleConfirmSwap = async () => {
    const mySelected = selectedCardsToSwap.filter(item => !item.isOpponent);
    const oppSelected = selectedCardsToSwap.filter(item => item.isOpponent);

    const numCardsToSwap = getMaxCardsToSwap();

    if (mySelected.length === numCardsToSwap && oppSelected.length === numCardsToSwap) {
      setMessage("Confirming swap...");
      const targetCardIndices = [];
      // Combine indices, my cards first, then opponent's cards
      mySelected.forEach(item => targetCardIndices.push(item.index));
      oppSelected.forEach(item => targetCardIndices.push(item.index));

      try {
        const response = await axios.post(`${API_BASE_URL}/game/apply_card`, {
          gameState: gameState,
          playerId: myPlayerId,
          cardIndex: swapCardPlayedIndex, // Pass the index of the Swap card itself
          targetCharacterId: null, // Not applicable for Swap
          targetCardIndices: targetCardIndices,
          defendingCardIndex: null, // Not defending now
        });

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
      }
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

  // --- Defense Card Handlers ---
  const handleDefendAction = async (useDefense, defendingCardIndex = null) => {
    if (!pendingAttackDetails) return; // Should not happen

    setMessage("Resolving opponent's action...");
    try {
      const response = await axios.post(`${API_BASE_URL}/game/resolve_pending_attack`, {
        gameState: gameState,
        playerId: myPlayerId,
        useDefense: useDefense,
        defendingCardIndex: defendingCardIndex,
      });

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
    }
    setPendingAttackDetails(null); // Clear pending attack details
  };


  const handleEndTurn = async () => {
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
        axios.post(`${API_BASE_URL}/game/end_turn`, {
            gameState: prevGameState,
            playerId: myPlayerId
        })
        .then(response => {
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
        })
        .catch(error => {
            console.error("Error ending turn:", error);
            setMessage(`Error ending turn: ${error.response?.data?.error || error.message}`);
        });
        return prevGameState;
    });
  };

  const handleBotMove = async () => {
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
        });
        return prevGameState;
    });
  };

  const handleCharacterClick = (characterId) => {
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
  };

  if (!gameState) {
    return <div className="game-container loading">Loading game...</div>;
  }

  const player1 = gameState.players[myPlayerId];
  const player2 = gameState.players[botPlayerId];

  return (
    <div className="game-container">
      <div className="game-board-area">
        <div className="game-board">
          {/* Player 2 (AI) Zone */}
          <PlayerZone
            player={`${player2.player_name} (AI)`}
            characters={player2.characters}
            sleepCount={player2.sleep_count}
            handSize={player2.hand_size || 0}
            onCharacterClick={handleCharacterClick}
            onCardDrop={handleCardDrop}
            isCurrentTurn={gameState.current_turn === botPlayerId}
            isOpponentZone={true}
            myPlayerId={myPlayerId}
            currentTurnPlayerId={gameState.current_turn}
            swapInProgress={swapInProgress}
          />

          {/* Player 1 Zone */}
          <PlayerZone
            player={`${player1.player_name} (You)`}
            characters={player1.characters}
            sleepCount={player1.sleep_count}
            handSize={player1.hand.length}
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
              {player1.hand.map((card, index) => (
                <HandCard
                  key={`${index}-${card.name}-${JSON.stringify(card.effect)}`}
                  card={card}
                  index={index}
                  isDraggable={gameState.current_turn === myPlayerId && !gameOver && !swapInProgress && !pendingAttackDetails} 
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
                  {Array.from({ length: player2.hand_size }).map((_, index) => (
                    <HandCard
                      key={`opponent-card-${index}`}
                      card={{ name: 'Opponent Card', type: 'unknown', description: 'Hidden Card' }}
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
                {player1.has_defense_card_in_hand ? (
                  <>
                    <p>Do you want to use a Defense Card to nullify this action?</p>
                    <div className="defense-actions">
                      <button onClick={() => handleDefendAction(true, player1.hand.findIndex(card => card.type === 'defense'))}>Use Defense Card</button>
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
                disabled={gameState.current_turn !== myPlayerId || gameOver}
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
              <p className={gameState.current_turn === myPlayerId ? 'your-turn' : 'opponent-turn'}>
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