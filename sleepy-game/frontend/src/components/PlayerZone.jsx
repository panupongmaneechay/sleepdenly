import React from 'react';
import CharacterCard from './CharacterCard';
import HandCard from './HandCard'; // Import HandCard
import './PlayerZone.css';

function PlayerZone({ player, characters, sleepCount, handSize, onCharacterClick, onCardDrop, isCurrentTurn, isOpponentZone, myPlayerId, currentTurnPlayerId, isStealingMode, opponentHand, onCardSelectedForSteal, maxStealableCards, selectedCardsToStealCount, selectedOpponentCardIndices }) {
  const zoneClass = `player-zone ${isCurrentTurn ? 'current-turn-highlight' : ''}`;
  
  return (
    <div className={zoneClass}>
      <div className="player-header">
        <h2>{player}</h2>
        <div className="player-stats">
          <p>Slept: <span className="sleep-count">{sleepCount}/3</span></p>
          <p>Cards: <span className="hand-size">{handSize}</span></p>
          {isStealingMode && isOpponentZone && (
            <p className="steal-info">Steal: <span className="steal-count">{selectedCardsToStealCount}/{maxStealableCards}</span></p>
          )}
        </div>
      </div>
      <div className="character-cards-container">
        {characters.map(char => (
          <CharacterCard 
            key={char.id} 
            character={char} 
            onClick={onCharacterClick} 
            onCardDrop={onCardDrop}
            isDroppable={myPlayerId === currentTurnPlayerId && !char.is_asleep && !isStealingMode} 
            targetPlayerId={char.id.includes('player1') ? 'player1' : 'player2'} 
          />
        ))}
      </div>

      {/* New: Display opponent's hand if in stealing mode and it's the opponent's zone */}
      {isStealingMode && isOpponentZone && opponentHand && (
        <div className="opponent-hand-for-steal">
          <h3>Opponent's Hand:</h3>
          <div className="player-hand"> {/* Reuse player-hand style for layout */}
            {opponentHand.map((card, index) => (
              <HandCard
                key={`opponent-card-${index}-${card.name}`}
                card={card}
                index={index}
                isDraggable={false} 
                playerSourceId={isOpponentZone ? currentTurnPlayerId === 'player1' ? 'player2' : 'player1' : myPlayerId} 
                onClick={onCardSelectedForSteal} 
                isStealingMode={isStealingMode}
                isOpponentCard={true}
                isSelected={selectedOpponentCardIndices.includes(index)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default PlayerZone;