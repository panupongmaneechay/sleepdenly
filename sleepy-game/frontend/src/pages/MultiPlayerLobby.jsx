import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import '../styles/MainMenu.css'; 

function MultiPlayerLobby({ socket }) {
  const [roomId, setRoomId] = useState('');
  const [message, setMessage] = useState('');
  const [totalPlayers, setTotalPlayers] = useState(2); // Default to 2 players
  const [numBots, setNumBots] = useState(0); // Default to 0 bots
  const navigate = useNavigate();

  useEffect(() => {
    if (!socket) {
        setMessage("Socket connection not available. Please restart the app.");
        return;
    }

    socket.on('room_created', (data) => {
      setMessage(`Room created! Share this ID: ${data.room_id}. Waiting for ${data.players_needed} human player(s)...`);
      setRoomId(data.room_id); 
    });

    socket.on('room_joined', (data) => {
      setMessage(`Joined room ${data.room_id}. Waiting for game to start...`);
    });

    socket.on('game_start', (data) => {
        console.log("Lobby: Game start signal received. Navigating to game.", data);
        const assignedPlayerId = Object.keys(data.initial_game_states).find(
            playerId => data.initial_game_states[playerId].sid === socket.id
        );
        
        if (assignedPlayerId) {
            navigate(`/multiplayer-game/${data.room_id}`, { 
                state: { 
                    playerId: assignedPlayerId,
                    initialGameState: data.initial_game_states[assignedPlayerId].game_state
                } 
            });
        } else {
            setMessage("Failed to determine your player ID. Returning to lobby.");
            console.error("Lobby: Current socket.id not found in initial_game_states from game_start event.");
        }
    });

    socket.on('join_error', (data) => {
      setMessage(`Error joining room: ${data.message}`);
    });

    socket.on('connect_error', (error) => {
      setMessage(`Connection Error: ${error.message}. Please ensure the backend server is running.`);
      console.error("Socket connection error:", error);
    });

    return () => {
      socket.off('room_created');
      socket.off('room_joined');
      socket.off('game_start'); 
      socket.off('join_error');
      socket.off('connect_error');
    };
  }, [navigate, socket]);

  const handleCreateRoom = () => {
    setMessage('Creating room...');
    socket.emit('create_room', { total_players: totalPlayers, num_bots: numBots });
  };

  const handleJoinRoom = () => {
    if (roomId.trim()) {
      setMessage(`Joining room ${roomId}...`);
      socket.emit('join_room', { room_id: roomId.trim() });
    } else {
      setMessage('Please enter a room ID.');
    }
  };

  const handleTotalPlayersChange = (e) => {
    const value = parseInt(e.target.value, 10);
    setTotalPlayers(value);
    if (numBots >= value) { // Ensure numBots doesn't exceed totalPlayers - 1
      setNumBots(value - 1);
    }
  };

  const handleNumBotsChange = (e) => {
    const value = parseInt(e.target.value, 10);
    setNumBots(value);
  };

  const maxBotsAllowed = totalPlayers - 1;

  return (
    <div className="main-menu-container">
      <h1>Multiplayer Lobby</h1>
      <div className="lobby-actions">
        <div className="game-settings">
          <label htmlFor="totalPlayers">Total Players:</label>
          <select id="totalPlayers" value={totalPlayers} onChange={handleTotalPlayersChange}>
            <option value={2}>2</option>
            <option value={3}>3</option>
            <option value={4}>4</option>
          </select>

          <label htmlFor="numBots">Number of Bots:</label>
          <select id="numBots" value={numBots} onChange={handleNumBotsChange} disabled={totalPlayers === 1}>
            {[...Array(maxBotsAllowed + 1).keys()].map(i => (
              <option key={i} value={i}>{i}</option>
            ))}
          </select>
        </div>

        <button onClick={handleCreateRoom}>Create New Room</button>
        <div className="join-room-section">
          <input
            type="text"
            placeholder="Enter Room ID"
            value={roomId}
            onChange={(e) => setRoomId(e.target.value)}
            className="room-input"
          />
          <button onClick={handleJoinRoom}>Join Room</button>
        </div>
        {message && <p className="lobby-message">{message}</p>}
      </div>
      <button onClick={() => navigate('/')} className="back-button">Back to Main Menu</button>
    </div>
  );
}

export default MultiPlayerLobby;