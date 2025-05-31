import React from 'react';
import { useDrag } from 'react-dnd';
import './HandCard.css';

// HandCard Component: Represents a single card in a player's hand.
// It can be draggable if it's the current player's turn.
// Special handling for 'theif' card type to trigger a direct click action.
function HandCard({ card, index, isSelected, onClick, isDraggable, playerSourceId, isStealingMode, isOpponentCard = false }) {
  // useDrag hook for drag-and-drop functionality.
  const [{ isDragging }, drag] = useDrag(() => ({
    type: 'card', // Defines the type of draggable item
    item: { 
      cardIndex: index, // Index of the card in the hand
      cardType: card.type, // Type of the card (e.g., 'attack', 'support', 'theif')
      cardEffectValue: card.effect.value, // Value of the card's effect (if applicable)
      playerSourceId: playerSourceId // ID of the player who owns this card
    },
    // canDrag determines if the card is draggable.
    // Cards are draggable if it's the player's turn (isDraggable) AND
    // it's NOT a 'theif' card (as 'theif' is clicked, not dragged to a target) AND
    // it's NOT an opponent's card (opponent's cards are not draggable by player) AND
    // we are NOT in stealing mode (in stealing mode, hand cards are for choosing)
    canDrag: isDraggable && card.type !== 'theif' && !isOpponentCard && !isStealingMode,
    collect: (monitor) => ({
      isDragging: monitor.isDragging(), // True if the card is currently being dragged
    }),
  }), [index, card, isDraggable, playerSourceId, isOpponentCard, isStealingMode]);

  // Determine the CSS class for the card, including type-specific styles.
  const cardClass = `hand-card 
    ${isSelected ? 'selected' : ''} 
    ${isDragging ? 'dragging' : ''} 
    ${card.cssClass || 'card-default'}
    ${isStealingMode && isOpponentCard ? 'stealing-target' : ''}
    ${isOpponentCard && !isStealingMode ? 'opponent-hidden' : ''}
    `;

  // handleClick function to manage card clicks.
  const handleClick = () => {
    // If in stealing mode and this is an opponent's card, it means the player is selecting it to steal.
    if (isStealingMode && isOpponentCard) {
      onClick(index); // Pass the index of the selected opponent's card
    } 
    // If it's a 'theif' card and it's the player's turn and not already in stealing mode.
    else if (card.type === 'theif' && isDraggable && !isStealingMode) {
      // No alert, just trigger the action to enter stealing mode
      onClick(index, card.type, null); 
    } 
    // For other cards (attack, support, etc.) and it's player's turn,
    // this click handler is generally used for selection/targeting if needed,
    // but primary interaction is drag & drop.
    else if (isDraggable && !isOpponentCard && !isStealingMode) {
      onClick(index); 
    }
  };

  return (
    <div
      // Only attach drag ref if the card is draggable and not a thief card, and not in stealing mode or opponent's card
      ref={isDraggable && card.type !== 'theif' && !isOpponentCard && !isStealingMode ? drag : null}
      className={cardClass}
      onClick={isDraggable || (isStealingMode && isOpponentCard) ? handleClick : null} // Enable click if draggable or in stealing mode on opponent card
      style={{ opacity: isDragging ? 0.5 : 1 }}
    >
      <h3>{card.name}</h3>
      <p className="card-description">{card.description}</p>
      <p className="card-effect">
        {card.effect.type === 'force_sleep' ? 'Instant Sleep!' :
         card.effect.type === 'steal_card' ? 'Steal Cards!' : // New display for Theif card
         (card.effect.type === 'add_sleep' ? '+' : '') + card.effect.value + ' hours'}
      </p>
      {/* Show card content only if it's not an opponent's card OR if it's an opponent's card AND we are in stealing mode */}
      {(isOpponentCard && !isStealingMode) ? (
        <div className="card-back">?</div> // Simple card back for hidden opponent cards
      ) : null}
    </div>
  );
}

export default HandCard;