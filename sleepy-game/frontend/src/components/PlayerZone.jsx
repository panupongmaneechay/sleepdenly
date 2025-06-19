// frontend/src/components/PlayerZone.jsx
import React from 'react';
import CharacterCard from './CharacterCard';
import HandCard from './HandCard'; // Still needed even if not showing opponent's hand explicitly
import './PlayerZone.css';

function PlayerZone({ player, characters, sleepCount, handSize, onCharacterClick, onCardDrop, isCurrentTurn, isOpponentZone, myPlayerId, currentTurnPlayerId }) {
  const zoneClass = `player-zone ${isCurrentTurn ? 'current-turn-highlight' : ''}`;
  
  return (
    <div className={zoneClass}>
      <div className="player-header">
        <h2>{player}</h2>
        <div className="player-stats">
          <p>Slept: <span className="sleep-count">{sleepCount}/3</span></p>
          <p>Cards: <span className="hand-size">{handSize}</span></p>
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
            targetPlayerId={char.id.includes('player1') ? 'player1' : 'player2'} 
          />
        ))}
      </div>
    </div>
  );
}

export default PlayerZone;