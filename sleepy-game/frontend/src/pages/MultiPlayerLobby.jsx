import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
// Removed `io from 'socket.io-client'`
import '../styles/MainMenu.css'; 

// Removed: const socket = io(SOCKET_SERVER_URL, ...);

function MultiPlayerLobby({ socket }) { // Receive socket as prop
  const [roomId, setRoomId] = useState('');
  const [message, setMessage] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    // No need to call socket.connect() here, it's connected in App.js
    // Ensure socket is available
    if (!socket) {
        setMessage("Socket connection not available. Please restart the app.");
        return;
    }

    // Event listener for room creation confirmation from server
    socket.on('room_created', (data) => {
      setMessage(`Room created! Share this ID: ${data.room_id}. Waiting for opponent...`);
      setRoomId(data.room_id); 
    });

    // Event listener for joining an existing room
    socket.on('room_joined', (data) => {
      setMessage(`Joined room ${data.room_id}. Waiting for game to start...`);
    });

    // Event listener for game start (emitted by server when 2 players are in room)
    socket.on('game_start', (data) => {
        console.log("Lobby: Game start signal received. Navigating to game.", data);
        // Determine myPlayerId based on SID from the game_start data
        // `socket.id` here is the current active SID from App.js
        const player1_sid_in_room = data.players_sids.player1.sid;
        const player2_sid_in_room = data.players_sids.player2.sid;
        
        let assignedPlayerId = null;
        if (socket.id === player1_sid_in_room) {
            assignedPlayerId = 'player1';
        } else if (socket.id === player2_sid_in_room) {
            assignedPlayerId = 'player2';
        }

        if (assignedPlayerId) {
            navigate(`/multiplayer-game/${data.room_id}`, { 
                state: { 
                    playerId: assignedPlayerId,
                    initialGameState: assignedPlayerId === 'player1' ? data.player1_game_state : data.player2_game_state
                } 
            });
        } else {
            // This case should ideally not happen if SIDs are correctly managed.
            // It means current socket.id is not recognized in the room.
            setMessage("Failed to determine your player ID. Returning to lobby.");
            console.error("Lobby: Current socket.id not found in players_sids from game_start event.");
            // Optional: socket.disconnect(); // Force disconnect and clean up if confused state
            // navigate('/multiplayer-lobby'); // Or just stay on lobby
        }
    });

    socket.on('join_error', (data) => {
      setMessage(`Error joining room: ${data.message}`);
    });

    socket.on('connect_error', (error) => {
      setMessage(`Connection Error: ${error.message}. Please ensure the backend server is running.`);
      console.error("Socket connection error:", error);
    });

    // Clean up on component unmount (remove listeners specific to this component)
    return () => {
      socket.off('room_created');
      socket.off('room_joined');
      socket.off('game_start'); 
      socket.off('join_error');
      socket.off('connect_error');
    };
  }, [navigate, socket]); // Add socket to dependencies

  const handleCreateRoom = () => {
    setMessage('Creating room...');
    socket.emit('create_room'); // No need to send sid, backend uses request.sid
  };

  const handleJoinRoom = () => {
    if (roomId.trim()) {
      setMessage(`Joining room ${roomId}...`);
      socket.emit('join_room', { room_id: roomId.trim() }); // No need to send sid, backend uses request.sid
    } else {
      setMessage('Please enter a room ID.');
    }
  };

  return (
    <div className="main-menu-container">
      <h1>Multiplayer Lobby</h1>
      <div className="lobby-actions">
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