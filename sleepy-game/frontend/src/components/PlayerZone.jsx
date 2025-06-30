// frontend/src/components/PlayerZone.jsx
import React from 'react';
import CharacterCard from './CharacterCard';
import './PlayerZone.css';

function PlayerZone({ player, characters, sleepCount, handSize, onCharacterClick, onCardDrop, isCurrentTurn, isOpponentZone, myPlayerId, currentTurnPlayerId, swapInProgress }) {
  const zoneClass = `player-zone ${isCurrentTurn ? 'current-turn-highlight' : ''} ${isOpponentZone ? 'opponent-zone' : ''}`;
  
  return (
    <div className={zoneClass}>
      <div className="player-header">
        <h2>{player}</h2>
        <div className="player-stats">
          <p>Slept: <span className="sleep-count">{sleepCount}/{characters.length}</span></p> {/* Display current sleep count vs total characters */}
          {isOpponentZone && <p>Cards: <span className="hand-size">{handSize}</span></p>}
          {!isOpponentZone && <p>Cards: <span className="hand-size">{handSize}</span></p>} {/* Display actual hand size for self, hidden for opponents */}
        </div>
      </div>
      <div className="character-cards-container">
        {characters.map(char => (
          <CharacterCard 
            key={char.id} 
            character={char} 
            onClick={onCharacterClick} 
            onCardDrop={onCardDrop}
            isDroppable={myPlayerId === currentTurnPlayerId && !char.is_asleep} 
            targetPlayerId={char.player_id} 
            swapInProgress={swapInProgress}
          />
        ))}
      </div>
    </div>
  );
}

export default PlayerZone;