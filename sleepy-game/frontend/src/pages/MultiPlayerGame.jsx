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

  const myPlayerId = location.state?.playerId;
  const opponentPlayerId = myPlayerId === 'player1' ? 'player2' : 'player1';

  const isMyTurn = gameState && gameState.current_turn === myPlayerId;

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
      setLogEntries(initialPlayerState.action_log || []); // ดึง log จาก initial state
    });

    socket.on('game_update', (data) => {
      console.log("Game update received:", data);
      const updatedPlayerState = data[`${myPlayerId}_game_state`];
      setGameState(updatedPlayerState);
      
      if (data.win_status.game_over) {
        setGameOver(true);
        setWinner(data.win_status.winner);
        setMessage(data.win_status.message);
      } else {
        setMessage(data.message);
      }
      setLogEntries(updatedPlayerState.action_log || []); // ดึง log จาก updated state
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
    setGameState(prevGameState => {
        if (!prevGameState) return null;

        if (prevGameState.current_turn !== playingPlayerId || gameOver) {
            setMessage("Not your turn or game over.");
            return prevGameState;
        }

        // Thief card doesn't get dropped on a character, it's used by clicking
        if (cardType === 'theif') {
          setMessage("Thief card cannot be dropped on a character. Click the card to use it.");
          return prevGameState;
        }

        setMessage("Playing card...");
        socket.emit('play_card', {
            room_id: roomId,
            player_id: playingPlayerId,
            card_index: cardIndex,
            target_character_id: targetCharacterId,
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

        if (cardType === 'theif') {
            setMessage("Using Thief card...");
            socket.emit('play_card', {
                room_id: roomId,
                player_id: myPlayerId,
                card_index: cardIndex,
                // No targetCharacterId needed for Thief card
            });
            return prevGameState; 
        }

        setMessage("Please drag and drop this card onto a character.");
        return prevGameState;
    });
  };

  const handleEndTurn = () => {
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
          />

          {/* Current Player Hand */}
          <div className="player-hand-container">
            <div className="player-hand">
              {currentPlayerHand.map((card, index) => (
                <HandCard
                  key={`${index}-${card.name}-${JSON.stringify(card.effect)}`}
                  card={card}
                  index={index}
                  isDraggable={isMyTurn && !gameOver}
                  playerSourceId={myPlayerId}
                  onClick={handlePlayCardAction} // Handle clicks for Thief card
                />
              ))}
            </div>
            <button 
              onClick={handleEndTurn} 
              disabled={!isMyTurn || gameOver}
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