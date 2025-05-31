import React from 'react';
import { useDrag } from 'react-dnd';
import './HandCard.css';

function HandCard({ card, index, isSelected, onClick, isDraggable, playerSourceId }) {
  const [{ isDragging }, drag] = useDrag(() => ({
    type: 'card',
    item: { 
      cardIndex: index, 
      cardType: card.type, 
      cardEffectValue: card.effect.value, // Keep effect value for potential client-side display logic
      playerSourceId: playerSourceId 
    },
    canDrag: isDraggable, 
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  }), [index, card, isDraggable, playerSourceId]);

  // Use card.cssClass if provided, otherwise default 'card-default'
  const cardClass = `hand-card ${isSelected ? 'selected' : ''} ${isDragging ? 'dragging' : ''} ${card.cssClass || 'card-default'}`;

  return (
    <div
      ref={drag}
      className={cardClass}
      onClick={() => onClick(index)} 
      style={{ opacity: isDragging ? 0.5 : 1 }}
    >
      <h3>{card.name}</h3>
      <p className="card-description">{card.description}</p>
      <p className="card-effect">{card.effect.type === 'force_sleep' ? 'Instant Sleep!' : (card.effect.type === 'add_sleep' ? '+' : '') + card.effect.value + ' hours'}</p>
    </div>
  );
}

export default HandCard;