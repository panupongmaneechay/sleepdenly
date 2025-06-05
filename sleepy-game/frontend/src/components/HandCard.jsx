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
    canDrag: isDraggable && card.type !== 'theif' && !isOpponentCard && !isStealingMode && !isUnderTheftAttempt,
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  }), [index, card, isDraggable, playerSourceId, isStealingMode, isUnderTheftAttempt]);

  // ตรวจสอบว่าการ์ดนี้ควรถูกไฮไลต์ในโหมดขโมยหรือไม่ (เมื่อถูกเลือกแล้ว)
  const isCurrentlySelectedForSteal = isStealingMode && isOpponentCard && selectedOpponentCardIndices.includes(index);

  const cardClass = `hand-card 
    ${isSelected ? 'selected' : ''} 
    ${isDragging ? 'dragging' : ''} 
    ${card.cssClass || 'card-default'}
    ${isCurrentlySelectedForSteal ? 'stealing-target' : ''}
    ${isOpponentCard && !isStealingMode && !isUnderTheftAttempt ? 'opponent-hidden' : ''}
    ${isUnderTheftAttempt && card.type === 'anti_theft' && playerSourceId !== thiefPlayerId ? 'anti-theft-highlight' : ''}
    `;

  const isClickable = (isStealingMode && isOpponentCard) || 
                      (isUnderTheftAttempt && !isOpponentCard && card.type === 'anti_theft' && playerSourceId !== thiefPlayerId) || 
                      (card.type === 'theif' && isDraggable && !isStealingMode && !isUnderTheftAttempt);

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

  const getCardImagePath = (cardName) => {
    const formattedName = cardName.toLowerCase().replace(/\s/g, '-');
    return `/assets/action/${formattedName}.png`; 
  };

  return (
    <div
      ref={isDraggable && card.type !== 'theif' && !isOpponentCard && !isStealingMode && !isUnderTheftAttempt ? drag : null}
      className={cardClass}
      onClick={isClickable ? handleClick : null}
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