import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import io from 'socket.io-client';
import '../styles/MainMenu.css'; // Reusing some menu styles

const SOCKET_SERVER_URL = 'http://127.0.0.1:5000'; // Flask SocketIO URL
const socket = io(SOCKET_SERVER_URL);

function MultiPlayerLobby() {
  const [roomId, setRoomId] = useState('');
  const [message, setMessage] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    socket.on('room_created', (data) => {
      setMessage(`Room created! Share this ID: ${data.room_id}. You are Player 1.`);
      navigate(`/multiplayer-game/${data.room_id}`, { state: { playerId: 'player1' } });
    });

    socket.on('room_joined', (data) => {
      setMessage(`Joined room ${data.room_id}. You are Player 2.`);
      navigate(`/multiplayer-game/${data.room_id}`, { state: { playerId: 'player2' } });
    });

    socket.on('join_error', (data) => {
      setMessage(`Error joining room: ${data.message}`);
    });

    return () => {
      socket.off('room_created');
      socket.off('room_joined');
      socket.off('join_error');
    };
  }, [navigate]);

  const handleCreateRoom = () => {
    setMessage('Creating room...');
    socket.emit('create_room');
  };

  const handleJoinRoom = () => {
    if (roomId.trim()) {
      setMessage(`Joining room ${roomId}...`);
      socket.emit('join_room', { room_id: roomId.trim() });
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