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

  const myPlayerId = location.state?.playerId;
  const opponentPlayerId = myPlayerId === 'player1' ? 'player2' : 'player1';

  const isMyTurn = gameState && gameState.current_turn === myPlayerId;

  useEffect(() => {
    if (!myPlayerId) {
      setMessage("Error: Player ID not found. Redirecting to lobby.");
      setTimeout(() => navigate('/multiplayer-lobby'), 2000);
      return;
    }

    socket.connect();

    socket.on('connect', () => {
      console.log('Connected to Socket.IO server for multiplayer.');
    });

    socket.on('game_start', (data) => {
      console.log("Game started!", data);
      const initialPlayerState = data[`${myPlayerId}_game_state`];
      setGameState(initialPlayerState); 
      setMessage(`Game started! It's ${data.current_turn === myPlayerId ? 'your' : 'opponent\'s'} turn.`);
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
    // IMPORTANT: Use the updater function for setGameState
    setGameState(prevGameState => {
        if (!prevGameState) return null;

        if (prevGameState.current_turn !== playingPlayerId || gameOver) {
            setMessage("It's not your turn or game is over.");
            return prevGameState;
        }

        if (cardType === 'attack' && targetPlayerIdOfChar === playingPlayerId) {
            setMessage("You cannot use attack cards on your own characters!");
            return prevGameState;
        }

        setMessage("Playing card...");
        socket.emit('play_card', {
            room_id: roomId,
            player_id: playingPlayerId, // This will be myPlayerId for multi player
            card_index: cardIndex,
            target_character_id: targetCharacterId,
        });
        return prevGameState;
    });
  };

  const handleEndTurn = () => {
    // IMPORTANT: Use the updater function for setGameState
    setGameState(prevGameState => {
        if (!prevGameState) return null;

        if (prevGameState.current_turn !== myPlayerId || gameOver) {
            setMessage("It's not your turn or game is over.");
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

  const currentPlayerCharacters = gameState.players[myPlayerId].characters;
  const currentPlayerHand = gameState.players[myPlayerId].hand;
  const currentPlayerSleepCount = gameState.players[myPlayerId].sleep_count;
  
  const opponentCharacters = gameState.players[opponentPlayerId].characters;
  const opponentHandSize = gameState.players[opponentPlayerId].hand_size;
  const opponentSleepCount = gameState.players[opponentPlayerId].sleep_count;

  return (
    <div className="game-container">
      <div className="game-board">
        {/* Opponent Player Zone */}
        <PlayerZone 
          player={`${gameState.players[opponentPlayerId].player_name} (Opponent)`} 
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
          player={`${gameState.players[myPlayerId].player_name} (You)`} 
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
                onClick={() => {}}
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

      <div className="game-sidebar">
        <InformationPanel info={information} />
        <div className="game-messages">
          <h2>Game Log</h2>
          <p className={isMyTurn ? 'your-turn' : 'opponent-turn'}>
            {message}
          </p>
          {gameOver && <h2 className="game-over-message">{winner === myPlayerId ? 'You Won!' : 'Opponent Won!'}</h2>}
          {gameOver && <button onClick={() => navigate('/multiplayer-lobby')} className="restart-button">Back to Lobby</button>}
        </div>
      </div>
    </div>
  );
}

export default MultiPlayerGame;