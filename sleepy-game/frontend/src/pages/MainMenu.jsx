import React from 'react';
import { useNavigate } from 'react-router-dom';
import '../styles/MainMenu.css';

function MainMenu() {
  const navigate = useNavigate();

  return (
    <div className="main-menu-container">
      <h1>Sleepy Game</h1>
      <div className="menu-buttons">
        <button onClick={() => navigate('/multiplayer-lobby')}>Start Game</button>
        {/* <button onClick={() => alert('Settings will be here (Dark Mode is a separate toggle)')}>Settings</button> */}
      </div>
    </div>
  );
}

export default MainMenu;