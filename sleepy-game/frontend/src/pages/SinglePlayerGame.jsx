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
      } else if (gameState.current_turn === botPlayerId && !gameOver) {
        // Delay bot move slightly
        setTimeout(handleBotMove, 1500);
      }
    }
  }, [gameState, gameOver]);

  const initializeGame = async () => {
    try {
      const response = await axios.post(`${API_BASE_URL}/game/initialize`);
      setGameState(response.data);
      setGameOver(false);
      setWinner(null);
      setMessage("Game initialized! Your turn.");
    } catch (error) {
      console.error("Error initializing game:", error);
      setMessage("Error initializing game.");
    }
  };

  const handleCardDrop = async (cardIndex, targetCharacterId, cardType, targetPlayerIdOfChar, playingPlayerId) => {
    // IMPORTANT: Use the updater function for setGameState to ensure latest state is sent
    // This is the core fix for the "reset" bug.
    setGameState(prevGameState => {
        if (!prevGameState) return null; // Should not happen if game is initialized

        if (prevGameState.current_turn !== playingPlayerId || gameOver) {
            setMessage("It's not your turn or game is over.");
            return prevGameState; // Return current state if invalid
        }

        if (cardType === 'attack' && targetPlayerIdOfChar === playingPlayerId) {
            setMessage("You cannot use attack cards on your own characters!");
            return prevGameState; // Return current state if invalid
        }

        setMessage("Playing card...");
        
        // Make the API call with the PREV_GAME_STATE
        axios.post(`${API_BASE_URL}/game/apply_card`, {
            gameState: prevGameState, // Send the latest state to backend
            playerId: playingPlayerId,
            cardIndex: cardIndex,
            targetCharacterId: targetCharacterId,
        })
        .then(response => {
            if (response.data.error) {
                setMessage(`Error: ${response.data.error}`);
            } else {
                setGameState(response.data.gameState); // Update with new state from backend
                if (response.data.winStatus.game_over) {
                    setGameOver(true);
                    setWinner(response.data.winStatus.winner);
                    setMessage(response.data.winStatus.message);
                } else {
                    // Update message from backend
                    setMessage(response.data.message || "Card played successfully! You can play another or end turn.");
                }
            }
        })
        .catch(error => {
            console.error("Error applying card:", error);
            setMessage(`Error: ${error.response?.data?.error || error.message}`);
        });

        // Optimistic update for hand size and message might be tricky here
        // For simplicity, let's just return prevGameState and let the .then() update
        // The display will update when setGameState is called in .then()
        return prevGameState; 
    });
  };

  const handleEndTurn = async () => {
    // IMPORTANT: Use the updater function for setGameState to ensure latest state is sent
    setGameState(prevGameState => {
        if (!prevGameState) return null;

        if (prevGameState.current_turn !== myPlayerId || gameOver) {
            setMessage("It's not your turn or game is over.");
            return prevGameState;
        }

        setMessage("Ending your turn...");
        axios.post(`${API_BASE_URL}/game/end_turn`, {
            gameState: prevGameState, // Send the latest state
            playerId: myPlayerId
        })
        .then(response => {
            if (response.data.error) {
                setMessage(`Error: ${response.data.error}`);
            } else {
                setGameState(response.data.gameState); // Update with new state from backend
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
    // IMPORTANT: Use the updater function for setGameState
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
                onClick={() => {}}
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

      <div className="game-sidebar">
        <InformationPanel info={information} />
        <div className="game-messages">
          <h2>Game Log</h2>
          <p className={gameState.current_turn === myPlayerId ? 'your-turn' : 'opponent-turn'}>
            {message}
          </p>
          {gameOver && <h2 className="game-over-message">{winner === myPlayerId ? 'You Won!' : 'AI Won!'}</h2>}
          {gameOver && <button onClick={initializeGame} className="restart-button">Play Again</button>}
        </div>
      </div>
    </div>
  );
}

export default SinglePlayerGame;