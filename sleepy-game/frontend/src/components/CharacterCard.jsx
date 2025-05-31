import React from 'react';
import { useDrop } from 'react-dnd';
import './CharacterCard.css';

function CharacterCard({ character, onClick, onCardDrop, isDroppable, targetPlayerId }) {
  const [{ isOver, canDrop }, drop] = useDrop(() => ({
    accept: 'card',
    canDrop: (item, monitor) => {
      if (!isDroppable || character.is_asleep) return false; 
      
      const draggedCardType = item.cardType;
      const playingPlayerId = item.playerSourceId; 

      // Attack cards: can only be used on opponent characters
      if (draggedCardType === 'attack' && targetPlayerId === playingPlayerId) {
          return false;
      }
      // Lucky cards: can only be used on your own characters
      if (draggedCardType === 'lucky' && targetPlayerId !== playingPlayerId) {
          return false;
      }
      
      return true; // Allow dropping if all checks pass
    },
    drop: (item, monitor) => {
      const playingPlayerId = monitor.getItem().playerSourceId; 
      onCardDrop(item.cardIndex, character.id, item.cardType, targetPlayerId, playingPlayerId);
    },
    collect: (monitor) => ({
      isOver: monitor.isOver(),
      canDrop: monitor.canDrop(), 
    }),
  }), [isDroppable, character.is_asleep, targetPlayerId]); 

  const currentSleepDisplay = character.is_asleep ? "ASLEEP" : `${character.current_sleep}/${character.max_sleep} hours`;
  
  const cardClass = `character-card ${character.is_asleep ? 'asleep' : ''} ${isOver && canDrop ? 'drop-target' : ''}`;

  return (
    <div ref={drop} className={cardClass} onClick={() => onClick(character.id)}>
      <img src={`/assets/${character.name.toLowerCase().replace(/\s/g, '-')}.png`} alt={character.name} className="character-avatar" onError={(e) => e.target.src = '/assets/default-avatar.png'}/>
      <div className="character-info">
        <h3>{character.name}</h3>
        <p>{character.age} years old</p>
        <p className="sleep-status">Sleep: {currentSleepDisplay}</p>
      </div>
    </div>
  );
}

export default CharacterCard;