import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate } from 'react-router-dom';
import MainMenu from './pages/MainMenu';
import SinglePlayerGame from './pages/SinglePlayerGame';
import MultiPlayerLobby from './pages/MultiPlayerLobby';
import MultiPlayerGame from './pages/MultiPlayerGame';
import DarkModeToggle from './components/DarkModeToggle';

// D&D Imports
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';


function App() {
  const [isDarkMode, setIsDarkMode] = useState(false);

  useEffect(() => {
    document.body.classList.toggle('dark-mode', isDarkMode);
  }, [isDarkMode]);

  return (
    <Router>
      <DndProvider backend={HTML5Backend}> {/* Wrap with DndProvider */}
        <div className={`App ${isDarkMode ? 'dark-mode' : 'light-mode'}`}>
          <DarkModeToggle isDarkMode={isDarkMode} setIsDarkMode={setIsDarkMode} />
          <Routes>
            <Route path="/" element={<MainMenu />} />
            <Route path="/single-player" element={<SinglePlayerGame />} />
            <Route path="/multiplayer-lobby" element={<MultiPlayerLobby />} />
            <Route path="/multiplayer-game/:roomId" element={<MultiPlayerGame />} />
          </Routes>
        </div>
      </DndProvider>
    </Router>
  );
}

export default App;