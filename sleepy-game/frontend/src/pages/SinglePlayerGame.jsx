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
  const [isStealingMode, setIsStealingMode] = useState(false); // New state for Thief card
  const [thiefCardPlayedInfo, setThiefCardPlayedInfo] = useState(null); // New state to store Thief card info
  const [opponentHandRevealed, setOpponentHandRevealed] = useState([]); // New state for opponent's hand in stealing mode
  const [selectedCardsToSteal, setSelectedCardsToSteal] = useState([]); // New state for selected cards to steal

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
      } else if (gameState.current_turn === botPlayerId && !gameOver && !isStealingMode) {
        setTimeout(handleBotMove, 1500);
      }
    }
  }, [gameState, gameOver, myPlayerId, botPlayerId, isStealingMode]);

  const initializeGame = async () => {
    try {
      const response = await axios.post(`${API_BASE_URL}/game/initialize`);
      setGameState(response.data);
      setGameOver(false);
      setWinner(null);
      setIsStealingMode(false); // Reset stealing mode
      setThiefCardPlayedInfo(null); // Reset thief card info
      setOpponentHandRevealed([]); // Clear revealed hand
      setSelectedCardsToSteal([]); // Clear selected cards
      setMessage("Game initialized! Your turn.");
    } catch (error) {
      console.error("Error initializing game:", error);
      setMessage("Error initializing game.");
    }
  };

  const handleCardDrop = async (cardIndex, targetCharacterId, cardType, targetPlayerIdOfChar, playingPlayerId) => {
    setGameState(prevGameState => {
        if (!prevGameState) return null;

        if (prevGameState.current_turn !== playingPlayerId || gameOver || isStealingMode) {
            setMessage("It's not your turn or game is over, or you are in stealing mode.");
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

  const handlePlayCardAction = async (cardIndex, cardType) => { // Removed targetCharacterId from signature
    setGameState(prevGameState => {
        if (!prevGameState) return null;

        if (prevGameState.current_turn !== myPlayerId || gameOver || isStealingMode) {
            setMessage("It's not your turn or game is over, or you are in stealing mode.");
            return prevGameState;
        }

        if (cardType === 'theif') {
            setMessage("You used Theif card. Select cards from opponent's hand.");
            setIsStealingMode(true); // Enter stealing mode
            setThiefCardPlayedInfo({ cardIndex: cardIndex, cardType: cardType }); // Store info about the Thief card
            setOpponentHandRevealed(prevGameState.players[botPlayerId].hand); // Show bot's hand
            setSelectedCardsToSteal([]); // Reset selection for new steal
            return prevGameState; // Don't send API call here yet
        }

        setMessage("Playing card...");
        
        axios.post(`${API_BASE_URL}/game/apply_card`, {
            gameState: prevGameState, 
            playerId: myPlayerId,
            cardIndex: cardIndex,
            targetCharacterId: null, // Default to null for non-target cards
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
            setIsStealingMode(false); // Exit stealing mode
            setThiefCardPlayedInfo(null);
            setOpponentHandRevealed([]);
            setSelectedCardsToSteal([]);
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
    setSelectedCardsToSteal([]);
    setMessage("Stealing cancelled.");
  };

  const handleEndTurn = async () => {
    setGameState(prevGameState => { 
        if (!prevGameState) return null;

        if (prevGameState.current_turn !== myPlayerId || gameOver || isStealingMode) {
            setMessage("It's not your turn or game is over, or you are in stealing mode.");
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

        if (gameOver || prevGameState.current_turn !== botPlayerId || isStealingMode) return prevGameState;

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
    if (isStealingMode) {
      setMessage("You are in stealing mode. Select cards from opponent's hand or cancel.");
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
  const maxStealableCardsCalc = 5 - player1.hand.length; // Re-calculate dynamically

  return (
    <div className="game-container">
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
        />

        {/* Player 1 Hand */}
        <div className="player-hand-container">
          <div className="player-hand">
            {player1.hand.map((card, index) => (
              <HandCard
                key={`${index}-${card.name}-${JSON.stringify(card.effect)}`}
                card={card}
                index={index}
                isDraggable={gameState.current_turn === myPlayerId && !gameOver && !isStealingMode}
                playerSourceId={myPlayerId}
                onClick={handlePlayCardAction}
                isStealingMode={isStealingMode}
                isSelected={thiefCardPlayedInfo && thiefCardPlayedInfo.cardIndex === index}
              />
            ))}
          </div>
          <button 
            onClick={handleEndTurn} 
            disabled={gameState.current_turn !== myPlayerId || gameOver || isStealingMode}
            className="end-turn-button"
          >
            End Turn
          </button>
        </div>
      </div>

      <div className="game-sidebar">
        <InformationPanel info={information} />
        <div className="game-messages">
          <h2>Game Log</h2>
          <p className={gameState.current_turn === myPlayerId ? 'your-turn' : 'opponent-turn'}>
            {message}
          </p>
          {gameOver && <h2 className="game-over-message">{winner === myPlayerId ? 'You Won!' : 'AI Won!'}</h2>}
          {gameOver && <button onClick={initializeGame} className="restart-button">Play Again</button>}

          {/* New: Buttons for Thief card stealing mode */}
          {isStealingMode && (
            <div className="steal-actions">
              <p className="steal-prompt">Select cards to steal ({selectedCardsToSteal.length}/{maxStealableCardsCalc}):</p>
              <button onClick={confirmSteal} disabled={selectedCardsToSteal.length === 0}>
                Confirm Steal
              </button>
              <button onClick={cancelSteal}>Cancel Steal</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default SinglePlayerGame;