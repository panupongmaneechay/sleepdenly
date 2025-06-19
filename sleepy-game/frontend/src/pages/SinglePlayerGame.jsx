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
  const [logEntries, setLogEntries] = useState([]); // สถานะสำหรับเก็บ Log

  const myPlayerId = 'player1';
  const botPlayerId = 'player2';

  useEffect(() => {
    initializeGame();
  }, []);

  useEffect(() => {
    if (gameState) {
      setMessage(gameState.message);
      setLogEntries(gameState.action_log || []);

      if (gameState.game_over) {
        setGameOver(true);
        setWinner(gameState.winner);
        setMessage(`${gameState.winner === myPlayerId ? 'You' : 'AI'} win!`);
      } else if (gameState.current_turn === botPlayerId && !gameOver) {
        setTimeout(handleBotMove, 1500);
      }
    }
  }, [gameState, gameOver, myPlayerId, botPlayerId]);

  const initializeGame = async () => {
    try {
      const response = await axios.post(`${API_BASE_URL}/game/initialize`);
      setGameState(response.data);
      setGameOver(false);
      setWinner(null);
      setLogEntries([]); // รีเซ็ต Log เมื่อเริ่มเกมใหม่
      setMessage("Game initialized! Your turn.");
    } catch (error) {
      console.error("Error initializing game:", error);
      setMessage("Error initializing game.");
    }
  };

  const handleCardDrop = async (cardIndex, targetCharacterId, cardType, targetPlayerIdOfChar, playingPlayerId) => {
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

        setMessage("Playing card...");
        axios.post(`${API_BASE_URL}/game/apply_card`, {
            gameState: prevGameState, 
            playerId: playingPlayerId,
            cardIndex: cardIndex,
            targetCharacterId: targetCharacterId, // Pass targetCharacterId for regular cards
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

        if (cardType === 'theif') {
            setMessage("Using Thief card...");
            axios.post(`${API_BASE_URL}/game/apply_card`, {
                gameState: prevGameState,
                playerId: myPlayerId,
                cardIndex: cardIndex,
                // No targetCharacterId needed for Thief card
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

        // For other card types, they should be dragged and dropped onto a character.
        setMessage("Please drag and drop this card onto a character.");
        return prevGameState;
    });
  };

  const handleEndTurn = async () => {
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
          />

          {/* Player 1 Hand */}
          <div className="player-hand-container">
            <div className="player-hand">
              {player1.hand.map((card, index) => (
                <HandCard
                  key={`${index}-${card.name}-${JSON.stringify(card.effect)}`}
                  card={card}
                  index={index}
                  isDraggable={gameState.current_turn === myPlayerId && !gameOver}
                  playerSourceId={myPlayerId}
                  onClick={handlePlayCardAction} // Handle clicks for Thief card
                />
              ))}
            </div>
            <button 
              onClick={handleEndTurn} 
              disabled={gameState.current_turn !== myPlayerId || gameOver}
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
              {/* แสดง Log Entries ย้อนหลัง */}
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