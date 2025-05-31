import React from 'react';
import { useDrop } from 'react-dnd';
import './CharacterCard.css';

function CharacterCard({ character, onClick, onCardDrop, isDroppable, targetPlayerId }) {
  const [{ isOver, canDrop }, drop] = useDrop(() => ({
    accept: 'card',
    canDrop: (item, monitor) => {
      // General checks for all cards
      if (!isDroppable || character.is_asleep) return false; 
      
      const draggedCardType = item.cardType;
      const playingPlayerId = item.playerSourceId; 

      // Specific rules for different card types
      if (draggedCardType === 'attack') {
          // Cannot attack your own characters
          if (targetPlayerId === playingPlayerId) return false;
          // Cannot attack protected characters
          if (character.is_protected) return false;
      } else if (draggedCardType === 'support' || draggedCardType === 'lucky' || draggedCardType === 'defensive') {
          // Support, Lucky, Defensive cards can only be used on your own characters
          if (targetPlayerId !== playingPlayerId) return false;
          // Cannot protect an already protected character (for defensive cards)
          if (draggedCardType === 'defensive' && character.is_protected) return false;
      } else if (draggedCardType === 'dispel') {
          // Dispel cards can only be used on opponent characters
          if (targetPlayerId === playingPlayerId) return false;
          // Can only dispel if target is protected
          if (!character.is_protected) return false;
      }
      
      return true; // If all checks pass, allow dropping
    },
    drop: (item, monitor) => {
      const playingPlayerId = monitor.getItem().playerSourceId; 
      onCardDrop(item.cardIndex, character.id, item.cardType, targetPlayerId, playingPlayerId);
    },
    collect: (monitor) => ({
      isOver: monitor.isOver(),
      canDrop: monitor.canDrop(), 
    }),
  }), [isDroppable, character.is_asleep, character.is_protected, targetPlayerId]); // Add is_protected to dependencies

  const currentSleepDisplay = character.is_asleep ? "ASLEEP" : `${character.current_sleep}/${character.max_sleep} hours`;
  
  // Conditionally apply drop-target class and protected class
  const cardClass = `character-card 
    ${character.is_asleep ? 'asleep' : ''} 
    ${character.is_protected ? 'protected' : ''} 
    ${isOver && canDrop ? 'drop-target' : ''}`;

  return (
    <div ref={drop} className={cardClass} onClick={() => onClick(character.id)}>
      <img src={`/assets/${character.name.toLowerCase().replace(/\s/g, '-')}.png`} alt={character.name} className="character-avatar" onError={(e) => e.target.src = '/assets/default-avatar.png'}/>
      <div className="character-info">
        <h3>{character.name}</h3>
        <p>{character.age} years old</p>
        <p className="sleep-status">Sleep: {currentSleepDisplay}</p>
        {character.is_protected && <span className="protected-status">Protected</span>}
      </div>
    </div>
  );
}

export default CharacterCard;