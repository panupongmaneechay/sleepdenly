import React from 'react';
import { useDrag } from 'react-dnd';
import './HandCard.css';

function HandCard({ card, index, isSelected, onClick, isDraggable, playerSourceId }) { // Accept playerSourceId
  const [{ isDragging }, drag] = useDrag(() => ({
    type: 'card',
    item: { 
      cardIndex: index, 
      cardType: card.type, 
      cardEffectValue: card.effect.value,
      playerSourceId: playerSourceId // Pass the player ID who owns this card
    },
    canDrag: isDraggable, 
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  }), [index, card, isDraggable, playerSourceId]); // Add all dependencies to ensure re-render for new cards

  const cardClass = `hand-card ${isSelected ? 'selected' : ''} ${isDragging ? 'dragging' : ''}`;

  return (
    <div
      ref={drag}
      className={cardClass}
      onClick={() => onClick(index)} 
      style={{ opacity: isDragging ? 0.5 : 1 }}
    >
      <h3>{card.name}</h3>
      <p className="card-description">{card.description}</p>
      <p className="card-effect">Effect: {card.effect.type === 'add_sleep' ? '+' : ''}{card.effect.value} hours</p>
    </div>
  );
}

export default HandCard;