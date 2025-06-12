import React, { useState, useEffect } from 'react';
import { useDrop } from 'react-dnd';
import './CharacterCard.css'; // Existing CSS
import '../styles/CardEffects.css';

function CharacterCard({ character, onClick, onCardDrop, isDroppable, targetPlayerId }) {
  // State to manage visual effects
  const [effect, setEffect] = useState(null); // e.g., { type: 'zzz', key: Date.now() }
  const [effectIcon, setEffectIcon] = useState('');
  const [effectClass, setEffectClass] = useState('');

  const [{ isOver, canDrop }, drop] = useDrop(() => ({
    accept: 'card',
    canDrop: (item, monitor) => {
      // 'item' here contains the properties from the dragged card's `useDrag` hook
      const { cardType, cardEffectValue, playerSourceId } = item;

      if (cardType === 'theif') return false; 
      
      if (!isDroppable || character.is_asleep) return false; 
      
      const currentSleep = character.current_sleep;
      const maxSleep = character.max_sleep;

      if (cardType === 'attack') {
          if (character.is_protected) return false;
          // Attack cards can always be dropped on non-protected, non-asleep characters.
          // The backend will handle the exact sleep calculation and conditions for sleeping.
          return true; 
      } else if (cardType === 'support') {
          // REMOVED: if (potentialSleep > maxSleep) { return false; }
          // Allow support cards to be dropped even if they would exceed max_sleep.
          // The backend logic (game_logic.py) will cap the sleep at max_sleep.
          return true;
      } else if (cardType === 'defensive') {
          if (targetPlayerId !== playerSourceId) return false; // Defensive always on self
          if (character.is_protected) return false;
          return true;
      } else if (cardType === 'dispel') {
          if (targetPlayerId === playerSourceId) return false; // Dispel always on opponent
          if (!character.is_protected) return false;
          return true;
      } else if (cardType === 'lucky') {
          if (targetPlayerId !== playerSourceId) return false; // Lucky always on self
          return true;
      }
      
      return false; // Default: cannot drop unknown card types
    },
    drop: (item, monitor) => {
      const playingPlayerId = monitor.getItem().playerSourceId; 
      
      // Trigger effect display based on card type immediately on drop
      let icon = '';
      let className = '';
      if (item.cardType === 'support') {
        icon = '💤'; // หรือ 'Zzz'
        className = 'effect-zzz';
      } else if (item.cardType === 'attack') {
        icon = '💥'; // หรือ 'X_X'
        className = 'effect-attack';
      } else if (item.cardType === 'defensive') {
        icon = '🛡️'; // หรือ '🛡️'
        className = 'effect-defensive';
      } else if (item.cardType === 'dispel') {
        icon = '✨'; // หรือ '❌'
        className = 'effect-dispel';
      } else if (item.cardType === 'lucky') {
        icon = '⭐'; // หรือ '🌟'
        className = 'effect-lucky';
      }
      
      setEffectIcon(icon);
      setEffectClass(className);
      setEffect(Date.now()); // Update state to trigger animation

      onCardDrop(item.cardIndex, character.id, item.cardType, targetPlayerId, playingPlayerId);
    },
    collect: (monitor) => ({
      isOver: monitor.isOver(),
      canDrop: monitor.canDrop(), 
    }),
  }), [isDroppable, character.is_asleep, character.is_protected, character.current_sleep, character.max_sleep, targetPlayerId]); 

  // Effect to clear the visual effect after a delay
  useEffect(() => {
    if (effect) {
      const timer = setTimeout(() => {
        setEffect(null); // Clear the effect state
        setEffectIcon('');
        setEffectClass('');
      }, 1000); // Effect visible for 1 second
      return () => clearTimeout(timer);
    }
  }, [effect]);

  const currentSleepDisplay = character.is_asleep ? "ASLEEP" : `${character.current_sleep}/${character.max_sleep} hours`;
  
  const cardClass = `character-card 
    ${character.is_asleep ? 'asleep' : ''} 
    ${character.is_protected ? 'protected' : ''} 
    ${isOver && canDrop ? 'drop-target' : ''}`;

  // Helper to generate image path for character
  const getCharacterImagePath = (name) => {
    const formattedName = name.toLowerCase().replace(/\s/g, '-');
    console.log('=====',formattedName);
    
    return `/assets/character/${formattedName}.png`; 
  };

  return (
    <div
      ref={drop}
      className={cardClass}
      onClick={() => onClick(character.id)}
    >
      <img 
        src={getCharacterImagePath(character.name)} 
        alt={character.name} 
        className="character-avatar" 
        onError={(e) => { e.target.onerror = null; e.target.src = '/assets/default-avatar.png'; }} // Fallback image
      />
      <div className="character-info">
        <h3>{character.name}</h3>
        <p>{character.age} years old</p>
        <p className="sleep-status">Sleep: {currentSleepDisplay}</p>
        {character.is_protected && <span className="protected-status">Protected</span>}
      </div>
      {/* Visual Effect Element */}
      {effect && (
        <div key={effect} className={`card-effect-animation ${effectClass}`}>
          {effectIcon}
        </div>
      )}
    </div>
  );
}

export default CharacterCard;