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
  const [isStealingMode, setIsStealingMode] = useState(false); // Player uses Thief card
  const [thiefCardPlayedInfo, setThiefCardPlayedInfo] = useState(null); 
  const [opponentHandRevealed, setOpponentHandRevealed] = useState([]);
  const [selectedCardsToSteal, setSelectedCardsToSteal] = useState([]);
  const [isUnderTheftAttempt, setIsUnderTheftAttempt] = useState(false); // New: Player is being stolen from
  const [thiefAttackerId, setThiefAttackerId] = useState(null); // New: ID of the player attempting theft

  const myPlayerId = 'player1';
  const botPlayerId = 'player2';

  useEffect(() => {
    initializeGame();
  }, []);

  useEffect(() => {
    if (gameState) {
      setMessage(gameState.message);
      if (gameState.game_over) {
        setGameOver(true);
        setWinner(gameState.winner);
        setMessage(`${gameState.winner === myPlayerId ? 'You' : 'AI'} win!`);
      } else if (gameState.current_turn === botPlayerId && !gameOver && !isStealingMode && !isUnderTheftAttempt) {
        setTimeout(handleBotMove, 1500);
      }

      if (gameState.theft_in_progress && gameState.theft_in_progress.target_player_id === myPlayerId && !isUnderTheftAttempt) {
          setIsUnderTheftAttempt(true);
          setThiefAttackerId(gameState.theft_in_progress.thief_player_id);
          setMessage(`ALERT: ${gameState.players[gameState.theft_in_progress.thief_player_id].player_name} is trying to steal your cards! Do you want to use an anti-theft card?`);
      } else if (!gameState.theft_in_progress && isUnderTheftAttempt) {
          setIsUnderTheftAttempt(false);
          setThiefAttackerId(null);
      }
    }
  }, [gameState, gameOver, myPlayerId, botPlayerId, isStealingMode, isUnderTheftAttempt]);

  const initializeGame = async () => {
    try {
      const response = await axios.post(`${API_BASE_URL}/game/initialize`);
      setGameState(response.data);
      setGameOver(false);
      setWinner(null);
      setIsStealingMode(false); 
      setThiefCardPlayedInfo(null);
      setOpponentHandRevealed([]);
      setSelectedCardsToSteal([]);
      setIsUnderTheftAttempt(false); 
      setThiefAttackerId(null); 
      setMessage("Game initialized! Your turn.");
    } catch (error) {
      console.error("Error initializing game:", error);
      setMessage("Error initializing game.");
    }
  };

  const handleCardDrop = async (cardIndex, targetCharacterId, cardType, targetPlayerIdOfChar, playingPlayerId) => {
    setGameState(prevGameState => { 
        if (!prevGameState) return null;

        if (prevGameState.current_turn !== playingPlayerId || gameOver || isStealingMode || isUnderTheftAttempt) {
            setMessage("Not your turn, game over, or in special action mode.");
            return prevGameState;
        }

        if (cardType === 'attack' && targetPlayerIdOfChar === playingPlayerId) {
            setMessage("You cannot use attack cards on your own characters!");
            return prevGameState;
        }
        if (cardType === 'lucky' && targetPlayerIdOfChar !== playingPlayerId) {
            setMessage("Lucky Sleep card can only be used on your own characters!");
            return prevGameState;
        }

        setMessage("Playing card...");
        axios.post(`${API_BASE_URL}/game/apply_card`, {
            gameState: prevGameState, 
            playerId: playingPlayerId,
            cardIndex: cardIndex,
            targetCharacterId: targetCharacterId,
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

  const handlePlayCardAction = async (cardIndex, cardType, targetCharacterId = null, isCounteringTheft = false) => {
    setGameState(prevGameState => { 
        if (!prevGameState) return null;

        if (isCounteringTheft) {
            setMessage("Using anti-theft card...");
            axios.post(`${API_BASE_URL}/game/respond_to_theft`, {
                gameState: prevGameState,
                targetPlayerId: myPlayerId,
                responseType: 'use_anti_theft',
                antiTheftCardIndex: cardIndex,
                thiefPlayerId: prevGameState.theft_in_progress ? prevGameState.theft_in_progress.thief_player_id : null,
                thiefCardIndex: prevGameState.theft_in_progress ? prevGameState.theft_in_progress.thief_card_index : null,
            })
            .then(response => {
                if (response.data.error) {
                    setMessage(`Error: ${response.data.error}`);
                } else {
                    setGameState(response.data.gameState); 
                }
            })
            .catch(error => {
                console.error("Error countering theft:", error);
                setMessage(`Error countering theft: ${error.response?.data?.error || error.message}`);
            });
            return prevGameState;
        }

        if (prevGameState.current_turn !== myPlayerId || gameOver || isStealingMode || isUnderTheftAttempt) {
            setMessage("Not your turn, game over, or in special action mode.");
            return prevGameState;
        }

        if (cardType === 'theif') {
            setMessage("Initiating theft attempt...");
            axios.post(`${API_BASE_URL}/game/theft_attempt_initiate`, {
                gameState: prevGameState,
                playerId: myPlayerId,
                cardIndex: cardIndex,
            })
            .then(response => {
                if (response.data.error) {
                    setMessage(`Error: ${response.data.error}`);
                } else {
                    setGameState(response.data.gameState); 
                    setIsStealingMode(true); 
                    setThiefCardPlayedInfo({ cardIndex: cardIndex, cardType: cardType });
                    // Ensure opponentHandRevealed is populated from the updated game state
                    setOpponentHandRevealed(response.data.gameState.players[botPlayerId].hand); 
                    setSelectedCardsToSteal([]); // IMPORTANT: Reset here to clear previous selections
                    setMessage(`You used Theif card. Select cards from ${response.data.gameState.players[botPlayerId].player_name}'s hand.`);
                }
            })
            .catch(error => {
                console.error("Error initiating theft:", error);
                setMessage(`Error initiating theft: ${error.response?.data?.error || error.message}`);
            });
            return prevGameState; 
        }

        setMessage("Playing card...");
        
        axios.post(`${API_BASE_URL}/game/apply_card`, {
            gameState: prevGameState, 
            playerId: myPlayerId,
            cardIndex: cardIndex,
            targetCharacterId: targetCharacterId,
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

  const handleCardSelectedForSteal = (selectedOpponentCardIndex) => {
    if (!isStealingMode || !thiefCardPlayedInfo) {
        setMessage("Not in a valid stealing state.");
        return;
    }

    const maxStealable = 5 - gameState.players[myPlayerId].hand.length;
    const currentOpponentHandSize = gameState.players[botPlayerId].hand.length;

    const isAlreadySelected = selectedCardsToSteal.includes(selectedOpponentCardIndex);

    let updatedSelectedCards;
    if (isAlreadySelected) {
        updatedSelectedCards = selectedCardsToSteal.filter(idx => idx !== selectedOpponentCardIndex);
    } else {
        if (selectedCardsToSteal.length < maxStealable && selectedOpponentCardIndex < currentOpponentHandSize) {
            updatedSelectedCards = [...selectedCardsToSteal, selectedOpponentCardIndex];
        } else {
            setMessage(`Cannot steal more than ${maxStealable} cards, or invalid selection.`);
            return;
        }
    }
    setSelectedCardsToSteal(updatedSelectedCards);
  };

  const confirmSteal = async () => {
    if (!isStealingMode || selectedCardsToSteal.length === 0) {
        setMessage("No cards selected to steal or not in stealing mode.");
        return;
    }

    setMessage("Stealing selected cards...");
    try {
        const response = await axios.post(`${API_BASE_URL}/game/apply_card`, {
            gameState: gameState,
            playerId: myPlayerId,
            cardIndex: thiefCardPlayedInfo.cardIndex,
            selectedCardIndicesFromOpponent: selectedCardsToSteal,
        });
        if (response.data.error) {
            setMessage(`Error: ${response.data.error}`);
        } else {
            setGameState(response.data.gameState);
            setIsStealingMode(false); 
            setThiefCardPlayedInfo(null);
            setOpponentHandRevealed([]);
            setSelectedCardsToSteal([]); // IMPORTANT: Clear on confirmation
            if (response.data.winStatus.game_over) {
                setGameOver(true);
                setWinner(response.data.winStatus.winner);
                setMessage(response.data.winStatus.message);
            } else {
                setMessage(response.data.message);
            }
        }
    } catch (error) {
        console.error("Error stealing cards:", error);
        setMessage(`Error stealing cards: ${error.response?.data?.error || error.message}`);
    }
  };

  const cancelSteal = () => {
    setIsStealingMode(false);
    setThiefCardPlayedInfo(null);
    setOpponentHandRevealed([]);
    setSelectedCardsToSteal([]); // IMPORTANT: Clear on cancel
    setMessage("Stealing cancelled.");

    handlePlayerBeingStolenFromResponse('thief_cancel', null, { isThiefInitiator: true, thiefCardPlayedInfo: thiefCardPlayedInfo });
  };

  const handlePlayerBeingStolenFromResponse = async (responseType, antiTheftCardIndex = null, options = {}) => {
    setGameState(prevGameState => {
        if (!prevGameState) return null;
        
        const isTargetResponding = (prevGameState.theft_in_progress && prevGameState.theft_in_progress.target_player_id === myPlayerId);
        const isThiefCancelling = (prevGameState.theft_in_progress && prevGameState.theft_in_progress.thief_player_id === myPlayerId && options.isThiefInitiator);

        if (!isTargetResponding && !isThiefCancelling) {
            setMessage("Not in a valid theft response state.");
            return prevGameState;
        }

        setMessage(`Responding to theft...`);

        axios.post(`${API_BASE_URL}/game/respond_to_theft`, {
            gameState: prevGameState,
            targetPlayerId: myPlayerId, 
            responseType: responseType,
            antiTheftCardIndex: antiTheftCardIndex,
            thiefPlayerId: options.isThiefInitiator ? myPlayerId : (prevGameState.theft_in_progress ? prevGameState.theft_in_progress.thief_player_id : null),
            thiefCardIndex: options.isThiefInitiator ? options.thiefCardPlayedInfo.cardIndex : (prevGameState.theft_in_progress ? prevGameState.theft_in_progress.thief_card_index : null),
        })
        .then(response => {
            if (response.data.error) {
                setMessage(`Error in theft response: ${response.data.error}`);
            } else {
                setGameState(response.data.gameState);
            }
        })
        .catch(error => {
            console.error("Error in theft response:", error);
            setMessage(`Error in theft response: ${error.response?.data?.error || error.message}`);
        });
        return prevGameState;
    });
  };

  const handleEndTurn = async () => {
    setGameState(prevGameState => { 
        if (!prevGameState) return null;

        if (prevGameState.current_turn !== myPlayerId || gameOver || isStealingMode || isUnderTheftAttempt) {
            setMessage("Not your turn or game is over, or in special action mode.");
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

        if (gameOver || prevGameState.current_turn !== botPlayerId || isStealingMode || isUnderTheftAttempt) return prevGameState;

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
    if (isStealingMode || isUnderTheftAttempt) {
      setMessage("You are in a special action mode. Cannot click characters.");
      return;
    }

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
  const maxStealableCardsCalc = 5 - player1.hand.length;

  const availableAntiTheftCards = isUnderTheftAttempt ? 
    player1.hand.filter(card => card.type === 'anti_theft').map((card, idx) => ({ ...card, originalIndex: player1.hand.indexOf(card) })) : [];


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
            isStealingMode={isStealingMode} 
            opponentHand={opponentHandRevealed} 
            onCardSelectedForSteal={handleCardSelectedForSteal}
            maxStealableCards={maxStealableCardsCalc}
            selectedCardsToStealCount={selectedCardsToSteal.length}
            selectedOpponentCardIndices={selectedCardsToSteal}
            isUnderTheftAttempt={isUnderTheftAttempt} 
            thiefPlayerId={thiefAttackerId}
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
            isStealingMode={isStealingMode}
            isUnderTheftAttempt={isUnderTheftAttempt}
            thiefPlayerId={thiefAttackerId}
          />

          {/* Player 1 Hand */}
          <div className="player-hand-container">
            <div className="player-hand">
              {player1.hand.map((card, index) => (
                <HandCard
                  key={`${index}-${card.name}-${JSON.stringify(card.effect)}`}
                  card={card}
                  index={index}
                  isDraggable={gameState.current_turn === myPlayerId && !gameOver && !isStealingMode && !isUnderTheftAttempt}
                  playerSourceId={myPlayerId}
                  onClick={handlePlayCardAction}
                  isStealingMode={isStealingMode}
                  isSelected={thiefCardPlayedInfo && thiefCardPlayedInfo.cardIndex === index}
                  isUnderTheftAttempt={isUnderTheftAttempt} 
                  thiefPlayerId={thiefAttackerId}
                />
              ))}
            </div>
            <button 
              onClick={handleEndTurn} 
              disabled={gameState.current_turn !== myPlayerId || gameOver || isStealingMode || isUnderTheftAttempt}
              className="end-turn-button"
            >
              End Turn
            </button>
          </div>
        </div>

        <div className="info-and-log-area">
          <InformationPanel info={information} />
          <div className="game-messages-area">
              <h2>Game Log</h2>
              <p className={gameState.current_turn === myPlayerId ? 'your-turn' : 'opponent-turn'}>
                {message}
              </p>
              {gameOver && <h2 className="game-over-message">{winner === myPlayerId ? 'You Won!' : 'AI Won!'}</h2>}
              {gameOver && <button onClick={initializeGame} className="restart-button">Play Again</button>}

              {/* Buttons for Thief card stealing mode */}
              {isStealingMode && (
                <div className="steal-actions">
                  <p className="steal-prompt">Select cards to steal ({selectedCardsToSteal.length}/{maxStealableCardsCalc}):</p>
                  <button onClick={confirmSteal} disabled={selectedCardsToSteal.length === 0}>
                    Confirm Steal
                  </button>
                  <button onClick={cancelSteal}>Cancel Steal</button>
                </div>
              )}

              {/* Anti-Theft Response UI */}
              {isUnderTheftAttempt && (
                <div className="anti-theft-response-area">
                    <h3>Theft Attempt!</h3>
                    <p>{gameState.players[thiefAttackerId].player_name} is trying to steal your cards!</p>
                    {player1.hand.filter(card => card.type === 'anti_theft').length > 0 ? (
                        <>
                            <p>Do you want to use an anti-theft card?</p>
                            <div className="anti-theft-cards-options">
                                {/* Use filtered list for display, but original index for click */}
                                {player1.hand.filter(card => card.type === 'anti_theft').map((card) => (
                                    <HandCard
                                        key={`anti-theft-${player1.hand.indexOf(card)}-${card.name}`} 
                                        card={card}
                                        index={player1.hand.indexOf(card)} 
                                        isDraggable={false}
                                        playerSourceId={myPlayerId}
                                        onClick={handlePlayCardAction}
                                        isStealingMode={false}
                                        isUnderTheftAttempt={true}
                                        thiefPlayerId={thiefAttackerId}
                                        isSelected={selectedCardsToSteal.includes(player1.hand.indexOf(card))}
                                    />
                                ))}
                            </div>
                            <button onClick={() => handlePlayerBeingStolenFromResponse('no_response')}>
                                No, let them steal
                            </button>
                        </>
                    ) : (
                        <p>You have no anti-theft cards to use. Theft will proceed.</p>
                    )}
                </div>
              )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default SinglePlayerGame;