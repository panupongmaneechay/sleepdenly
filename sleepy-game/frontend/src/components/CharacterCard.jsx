// frontend/src/components/CharacterCard.jsx
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
    item: { 
      cardIndex: -1, // This component does not directly handle card index as it's a drop target
      cardType: '',
      cardEffectValue: null, 
      playerSourceId: '' 
    },
    // The actual item properties are received in the drop function
    // For canDrop, we only check if it's generally droppable for ANY card (except Thief)
    canDrop: (item, monitor) => {
      // 'item' here contains the properties from the dragged card's `useDrag` hook
      const { cardType } = item;

      // Cannot drop if the character is asleep or if isDroppable is false
      if (!isDroppable || character.is_asleep) return false; 
      
      // Thief card does not target characters, so it cannot be dropped
      if (cardType === 'theif') return false; 

      // Lucky card can only be used on the player's own characters
      if (cardType === 'lucky' && targetPlayerId !== item.playerSourceId) return false;
      
      return true; // All other cards (attack, support, lucky on self) can be dropped
    },
    drop: (item, monitor) => {
      // When a card is dropped, call the onCardDrop prop with necessary info
      onCardDrop(item.cardIndex, character.id, item.cardType, targetPlayerId, item.playerSourceId);
      
      // Trigger effect display based on card type immediately on drop
      let icon = '';
      let className = '';
      if (item.cardType === 'support') {
        icon = '💤'; 
        className = 'effect-zzz';
      } else if (item.cardType === 'attack') {
        icon = '💥'; 
        className = 'effect-attack';
      } else if (item.cardType === 'lucky') {
        icon = '⭐'; 
        className = 'effect-lucky';
      }
      
      setEffectIcon(icon);
      setEffectClass(className);
      setEffect(Date.now()); // Update state to trigger animation
    },
    collect: (monitor) => ({
      isOver: monitor.isOver(),
      canDrop: monitor.canDrop(), 
    }),
  }), [isDroppable, character.is_asleep, targetPlayerId, onCardDrop]); 

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