import React from 'react';
import CharacterCard from './CharacterCard';
import './PlayerZone.css';

function PlayerZone({ player, characters, sleepCount, handSize, onCharacterClick, isCurrentTurn, onCardDrop, isOpponentZone, myPlayerId, currentTurnPlayerId }) {
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
            // Logic for isDroppable:
            // 1. It must be MY turn (myPlayerId === currentTurnPlayerId)
            // 2. Character must NOT be asleep.
            // 3. If it's an ATTACK card, it must be dropped on an OPPONENT'S character (isOpponentZone is true).
            // 4. If it's a SUPPORT card, it can be dropped on EITHER player's character.
            // (The canDrop logic inside CharacterCard will also check cardType for attack)
            isDroppable={myPlayerId === currentTurnPlayerId && !char.is_asleep} 
            targetPlayerId={char.id.includes('player1') ? 'player1' : 'player2'} // Pass the target player ID
          />
        ))}
      </div>
    </div>
  );
}

export default PlayerZone;