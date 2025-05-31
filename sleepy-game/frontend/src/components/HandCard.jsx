import React from 'react';
import { useDrag } from 'react-dnd';
import './HandCard.css';

function HandCard({ card, index, isSelected, onClick, isDraggable, playerSourceId, isStealingMode, isOpponentCard = false, isUnderTheftAttempt = false, thiefPlayerId = null }) {
  const [{ isDragging }, drag] = useDrag(() => ({
    type: 'card',
    item: { 
      cardIndex: index, 
      cardType: card.type, 
      cardEffectValue: card.effect && card.effect.value !== undefined ? card.effect.value : null, 
      playerSourceId: playerSourceId 
    },
    canDrag: isDraggable && card.type !== 'theif' && !isOpponentCard && !isStealingMode && !isUnderTheftAttempt,
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  }), [index, card, isDraggable, playerSourceId, isOpponentCard, isStealingMode, isUnderTheftAttempt]);

  const cardClass = `hand-card 
    ${isSelected ? 'selected' : ''} 
    ${isDragging ? 'dragging' : ''} 
    ${card.cssClass || 'card-default'}
    ${isStealingMode && isOpponentCard ? 'stealing-target' : ''}
    ${isOpponentCard && !isStealingMode && !isUnderTheftAttempt ? 'opponent-hidden' : ''}
    ${isUnderTheftAttempt && card.type === 'anti_theft' && playerSourceId !== thiefPlayerId ? 'anti-theft-highlight' : ''}
    `;

  const handleClick = () => {
    if (isClickable) {
      if (isStealingMode && isOpponentCard) {
        onClick(index); 
      } 
      else if (isUnderTheftAttempt && !isOpponentCard && card.type === 'anti_theft') {
          onClick(index, card.type, null, true);
      }
      else if (card.type === 'theif' && isDraggable && !isStealingMode && !isUnderTheftAttempt) {
        onClick(index, card.type); 
      } 
      else if (isDraggable && !isOpponentCard && !isStealingMode && !isUnderTheftAttempt) {
        onClick(index); 
      }
    }
  };

  const isClickable = (isStealingMode && isOpponentCard) || 
                      (isUnderTheftAttempt && !isOpponentCard && card.type === 'anti_theft' && playerSourceId !== thiefPlayerId) || 
                      (card.type === 'theif' && isDraggable && !isStealingMode && !isUnderTheftAttempt);


  const renderCardEffect = () => {
    if (card.effect && card.effect.type) {
      if (card.effect.type === 'force_sleep') return 'Instant Sleep!';
      if (card.effect.type === 'steal_card') return 'Steal Cards!';
      if (card.effect.type === 'counter_theft') return 'Counter Theft!';
      if (card.effect.type === 'protect') return 'Protect!';
      if (card.effect.type === 'remove_protection') return 'Dispel!';
  
      if (card.effect.value !== undefined && card.effect.value !== null) {
        const sign = card.effect.value > 0 ? '+' : '';
        return `${sign}${card.effect.value} hours`;
      }
    }
    return ''; 
  };

  // Helper to generate image path for card
  const getCardImagePath = (cardName) => {
    // Assuming image files are in public/assets and named after card's lowercase name, hyphenated
    // e.g., "Stay up late" -> "stay-up-late.png"
    const formattedName = cardName.toLowerCase().replace(/\s/g, '-');
    return `/assets/action/${formattedName}.png`; // Or .jpeg if your files are JPEG
  };

  return (
    <div
      ref={isDraggable && card.type !== 'theif' && !isOpponentCard && !isStealingMode && !isUnderTheftAttempt ? drag : null}
      className={cardClass}
      onClick={isClickable ? handleClick : null}
      style={{ opacity: isDragging ? 0.5 : 1 }}
    >
      <div className="card-image-container"> {/* New container for image */}
        <img 
          src={getCardImagePath(card.name)} 
          alt={card.name} 
          className="card-icon" 
          onError={(e) => { e.target.onerror = null; e.target.src = '/assets/default-card-icon.png'; }} // Fallback image
        />
      </div>
      <h3>{card.name}</h3>
      <p className="card-description">{card.description}</p>
      <p className="card-effect">{renderCardEffect()}</p>
      {(isOpponentCard && !isStealingMode && !isUnderTheftAttempt) ? (
        <div className="card-back">?</div>
      ) : null}
    </div>
  );
}

export default HandCard;