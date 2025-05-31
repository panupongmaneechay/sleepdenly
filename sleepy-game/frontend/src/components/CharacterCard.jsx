import React from 'react';
import { useDrop } from 'react-dnd';
import './CharacterCard.css';

function CharacterCard({ character, onClick, onCardDrop, isDroppable, targetPlayerId }) { // targetPlayerId is already a prop
  const [{ isOver, canDrop }, drop] = useDrop(() => ({
    accept: 'card',
    canDrop: (item, monitor) => {
      // isDroppable from PlayerZone ensures it's current player's turn and char not asleep
      if (!isDroppable) return false; 
      
      const draggedCardType = item.cardType;
      const playingPlayerId = item.playerSourceId; // The ID of the player dragging the card

      // Rule 3: Attack cards cannot be used on self (for visual feedback)
      // If it's an attack card AND the target character belongs to the playing player,
      // then we should NOT allow dropping for visual feedback.
      if (draggedCardType === 'attack' && targetPlayerId === playingPlayerId) {
          return false; // Cannot drop an attack card on your own character
      }
      
      // Otherwise, allow dropping if the character is not asleep
      return !character.is_asleep; 
    },
    drop: (item, monitor) => {
      // item contains cardIndex, cardType, cardEffectValue
      // We also need the ID of the player who is dragging the card to check against targetPlayerId
      const playingPlayerId = monitor.getItem().playerSourceId; 

      // Pass all necessary info to the parent handler
      onCardDrop(item.cardIndex, character.id, item.cardType, targetPlayerId, playingPlayerId);
    },
    collect: (monitor) => ({
      isOver: monitor.isOver(),
      canDrop: monitor.canDrop(), // Use the result of canDrop function above
    }),
  }), [isDroppable, character.is_asleep, targetPlayerId]); // Add targetPlayerId to dependencies

  const currentSleepDisplay = character.is_asleep ? "ASLEEP" : `${character.current_sleep}/${character.max_sleep} hours`;
  
  // Conditionally apply drop-target class based on canDrop
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