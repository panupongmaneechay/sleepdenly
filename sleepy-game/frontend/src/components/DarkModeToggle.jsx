import React from 'react';
import './DarkModeToggle.css'; // Create this CSS file

function DarkModeToggle({ isDarkMode, setIsDarkMode }) {
  return (
    <div className="dark-mode-toggle">
      <label className="switch">
        <input type="checkbox" checked={isDarkMode} onChange={() => setIsDarkMode(!isDarkMode)} />
        <span className="slider round"></span>
      </label>
      <span>Dark Mode</span>
    </div>
  );
}

export default DarkModeToggle;