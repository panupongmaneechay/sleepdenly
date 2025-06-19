// frontend/src/components/HandCard.jsx
import React from 'react';
import { useDrag } from 'react-dnd';
import './HandCard.css';

function HandCard({ 
  card, 
  index, 
  onClick, 
  isDraggable, 
  playerSourceId, 
  isOpponentCard = false,
  isSelectableForSwap = false, // New prop
  onSelectForSwap = () => {}, // New prop
  isSelected = false // New prop
}) {
  const [{ isDragging }, drag] = useDrag(() => ({
    type: 'card',
    item: { 
      cardIndex: index, 
      cardType: card.type, 
      cardEffectValue: card.effect && card.effect.value !== undefined ? card.effect.value : null, 
      playerSourceId: playerSourceId 
    },
    // Only allow dragging if it's draggable and not an opponent's card AND NOT a 'theif' or 'swap' card
    canDrag: isDraggable && card.type !== 'theif' && card.type !== 'swap' && !isOpponentCard,
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  }), [index, card, isDraggable, playerSourceId, isOpponentCard]);

  const cardClass = `hand-card 
    ${isDragging ? 'dragging' : ''} 
    ${card.cssClass || 'card-default'}
    ${isOpponentCard ? 'opponent-hidden' : ''}
    ${isSelectableForSwap ? 'selectable-for-swap' : ''}
    ${isSelected ? 'selected-for-swap' : ''}
    `;

  const handleClick = () => {
    if (isDraggable && card.type === 'theif') {
      onClick(index, card.type); // Pass index and card type to the handler
    } else if (isSelectableForSwap) {
      onSelectForSwap(index, card, isOpponentCard);
    } else {
        // For other cards, direct click in hand does nothing (they are meant for drag/drop)
        // unless you add other specific clickable card types here.
        console.log(`Card ${card.name} clicked, but no direct click action defined or card type not applicable.`);
    }
  };

  const renderCardEffect = () => {
    if (card.effect && card.effect.type) {
      if (card.effect.type === 'force_sleep') return 'Instant Sleep!';
      if (card.effect.type === 'steal_cards') return 'Steal All Cards!';
      if (card.type === 'swap') return 'Swap Cards!'; // Display for Swap card
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
      ref={isDraggable && card.type !== 'theif' && card.type !== 'swap' && !isOpponentCard ? drag : null}
      className={cardClass}
      onClick={handleClick}
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
      {isOpponentCard ? (
        <div className="card-back">?</div>
      ) : null}
    </div>
  );
}

export default HandCard;