import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import MainMenu from './pages/MainMenu';
import MultiPlayerLobby from './pages/MultiPlayerLobby';
import MultiPlayerGame from './pages/MultiPlayerGame';
import DarkModeToggle from './components/DarkModeToggle';

// D&D Imports
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';

// Import the new effect CSS
import './styles/CardEffects.css'; 

// Import Socket.IO client here, create a single instance
import io from 'socket.io-client';

const SOCKET_SERVER_URL = 'http://127.0.0.1:5000';
const socket = io(SOCKET_SERVER_URL, {
  transports: ['websocket', 'polling'],
  // No forceNew here, we want to maintain this single connection
  jsonp: false, 
  extraHeaders: {
    "X-Client-Type": "react-app"
  }
});

function App() {
  const [isDarkMode, setIsDarkMode] = useState(false);

  useEffect(() => {
    document.body.classList.toggle('dark-mode', isDarkMode);
  }, [isDarkMode]);

  // Connect socket when App mounts, disconnect when App unmounts
  useEffect(() => {
    socket.connect();
    socket.on('connect', () => {
      console.log(`App.js: Connected to Socket.IO server. SID: ${socket.id}`);
    });
    socket.on('disconnect', () => {
      console.log('App.js: Disconnected from Socket.IO server.');
    });

    return () => {
      socket.off('connect');
      socket.off('disconnect');
      socket.disconnect(); // Ensure disconnection on unmount
    };
  }, []); // Empty dependency array means this runs once on mount/unmount


  return (
    <Router>
      <DndProvider backend={HTML5Backend}>
        <div className={`App ${isDarkMode ? 'dark-mode' : 'light-mode'}`}>
          <DarkModeToggle isDarkMode={isDarkMode} setIsDarkMode={setIsDarkMode} />
          <Routes>
            <Route path="/" element={<MainMenu />} />
            {/* Pass the single socket instance to Lobby and Game components */}
            <Route path="/multiplayer-lobby" element={<MultiPlayerLobby socket={socket} />} />
            <Route path="/multiplayer-game/:roomId" element={<MultiPlayerGame socket={socket} />} />
          </Routes>
        </div>
      </DndProvider>
    </Router>
  );
}

export default App;