import React from 'react';
import { useDrag } from 'react-dnd';
import './HandCard.css';

function HandCard({ card, index, isSelected, onClick, isDraggable, playerSourceId, isStealingMode, isOpponentCard = false, isUnderTheftAttempt = false, thiefPlayerId = null, selectedOpponentCardIndices = [] }) {
  const [{ isDragging }, drag] = useDrag(() => ({
    type: 'card',
    item: { 
      cardIndex: index, 
      cardType: card.type, 
      cardEffectValue: card.effect && card.effect.value !== undefined ? card.effect.value : null, 
      playerSourceId: playerSourceId 
    },
    // Only allow dragging if it's draggable and not a special card type that is no longer in use
    canDrag: isDraggable && card.type !== 'theif' && card.type !== 'anti_theft' && !isOpponentCard && !isStealingMode && !isUnderTheftAttempt,
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  }), [index, card, isDraggable, playerSourceId, isStealingMode, isUnderTheftAttempt]);

  // isSelected and selectedOpponentCardIndices logic will be unused if Thief/Anti_theft removed
  const isCurrentlySelectedForSteal = isStealingMode && isOpponentCard && selectedOpponentCardIndices.includes(index);

  const cardClass = `hand-card 
    ${isSelected ? 'selected' : ''} 
    ${isDragging ? 'dragging' : ''} 
    ${card.cssClass || 'card-default'}
    ${isCurrentlySelectedForSteal ? 'stealing-target' : ''}
    ${isOpponentCard && !isStealingMode && !isUnderTheftAttempt ? 'opponent-hidden' : ''}
    ${isUnderTheftAttempt && card.type === 'anti_theft' && playerSourceId !== thiefPlayerId ? 'anti-theft-highlight' : ''}
    `;

  // Simplify isClickable as Thief/Anti_theft logic is removed
  const isClickable = false; // By default, cards are not clickable in hand except by drag/drop

  const handleClick = () => {
    // With drag/drop, direct clicks on cards in hand are generally not intended
    // unless they trigger a special action (like Thief did).
    // As Thief/Anti_theft are removed, this click handler can remain mostly inactive.
    // If you add new click-only card types, you'd add logic here.
    console.log(`Card ${card.name} clicked, but no direct click action defined.`);
  };

  const renderCardEffect = () => {
    if (card.effect && card.effect.type) {
      if (card.effect.type === 'force_sleep') return 'Instant Sleep!';
      if (card.effect.value !== undefined && card.effect.value !== null) {
        const sign = card.effect.value > 0 ? '+' : '';
        return `${sign}${card.effect.value} hours`;
      }
    }
    return ''; 
  };

  const getCardImagePath = (cardName) => {
    const formattedName = cardName.toLowerCase().replace(/\s/g, '-');
    return `/assets/action/${formattedName}.png`; 
  };

  return (
    <div
      ref={isDraggable && card.type !== 'theif' && card.type !== 'anti_theft' && !isOpponentCard && !isStealingMode && !isUnderTheftAttempt ? drag : null}
      className={cardClass}
      // onClick={isClickable ? handleClick : null} // Keep this for future direct click cards if needed
      style={{ opacity: isDragging ? 0.5 : 1 }}
    >
      <div className="card-image-container">
        <img 
          src={getCardImagePath(card.name)} 
          alt={card.name} 
          className="card-icon" 
          onError={(e) => { e.target.onerror = null; e.target.src = '/assets/default-card-icon.png'; }}
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