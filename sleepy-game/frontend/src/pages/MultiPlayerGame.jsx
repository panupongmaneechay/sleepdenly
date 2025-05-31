import React, { useState, useEffect, useRef } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import io from 'socket.io-client';
import CharacterCard from '../components/CharacterCard';
import HandCard from '../components/HandCard';
import InformationPanel from '../components/InformationPanel';
import PlayerZone from '../components/PlayerZone';
import '../styles/Game.css';

const SOCKET_SERVER_URL = 'http://127.0.0.1:5000';
const socket = io(SOCKET_SERVER_URL);

function MultiPlayerGame() {
  const { roomId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const [gameState, setGameState] = useState(null);
  const [message, setMessage] = useState("Waiting for opponent...");
  const [information, setInformation] = useState({ name: 'N/A', age: 'N/A', description: 'Click on a character for details.' });
  const [gameOver, setGameOver] = useState(false);
  const [winner, setWinner] = useState(null);
  const [isStealingMode, setIsStealingMode] = useState(false);
  const [thiefCardPlayedInfo, setThiefCardPlayedInfo] = useState(null);
  const [opponentHandRevealed, setOpponentHandRevealed] = useState([]);
  const [selectedCardsToSteal, setSelectedCardsToSteal] = useState([]);
  const [maxStealableCards, setMaxStealableCards] = useState(0); 
  const [isUnderTheftAttempt, setIsUnderTheftAttempt] = useState(false);
  const [thiefAttackerId, setThiefAttackerId] = useState(null);

  const myPlayerId = location.state?.playerId;
  const opponentPlayerId = myPlayerId === 'player1' ? 'player2' : 'player1';

  const isMyTurn = gameState && gameState.current_turn === myPlayerId;

  useEffect(() => {
    if (!myPlayerId) {
      setMessage("Error: Player ID not found. Redirecting to lobby.");
      setTimeout(() => navigate('/multiplayer-lobby'), 2000);
      return;
    }

    socket.on('connect', () => {
      console.log('Connected to Socket.IO server for multiplayer.');
    });

    socket.on('game_start', (data) => {
      console.log("Game started!", data);
      const initialPlayerState = data[`${myPlayerId}_game_state`];
      setGameState(initialPlayerState); 
      setMessage(`Game started! It's ${data.current_turn === myPlayerId ? 'your' : 'opponent\'s'} turn.`);
      setIsStealingMode(false);
      setThiefCardPlayedInfo(null);
      setOpponentHandRevealed([]);
      setSelectedCardsToSteal([]);
      setIsUnderTheftAttempt(false);
      setThiefAttackerId(null);
    });

    socket.on('game_update', (data) => {
      console.log("Game update received:", data);
      const updatedPlayerState = data[`${myPlayerId}_game_state`];
      setGameState(updatedPlayerState);
      
      if (data.win_status.game_over) {
        setGameOver(true);
        setWinner(data.win_status.winner);
        setMessage(data.win_status.message);
      } else {
        setMessage(data.message);
      }
      if (!data.hasOwnProperty('opponent_hand')) {
        setIsStealingMode(false); 
        setThiefCardPlayedInfo(null);
        setOpponentHandRevealed([]);
        setSelectedCardsToSteal([]);
      }
      setIsUnderTheftAttempt(false);
      setThiefAttackerId(null);
    });

    socket.on('opponent_hand_revealed', (data) => {
        setOpponentHandRevealed(data.opponent_hand);
        setMaxStealableCards(data.max_stealable);
        setMessage(data.message);
    });

    socket.on('theft_attempt', (data) => {
        setIsUnderTheftAttempt(true);
        setThiefAttackerId(data.thief_player_id);
        setMessage(data.message);
    });

    socket.on('player_disconnected', (data) => {
      setMessage(`Opponent disconnected: ${data.message}. Returning to lobby...`);
      setTimeout(() => navigate('/multiplayer-lobby'), 3000);
    });

    socket.on('error', (data) => {
      setMessage(`Game Error: ${data.message}`);
      setIsStealingMode(false);
      setThiefCardPlayedInfo(null);
      setOpponentHandRevealed([]);
      setSelectedCardsToSteal([]);
      setIsUnderTheftAttempt(false);
      setThiefAttackerId(null);
    });

    return () => {
      socket.disconnect();
      socket.off('connect');
      socket.off('game_start');
      socket.off('game_update');
      socket.off('opponent_hand_revealed');
      socket.off('theft_attempt');
      socket.off('player_disconnected');
      socket.off('error');
    };
  }, [roomId, myPlayerId, opponentPlayerId, navigate]);


  const handleCardDrop = (cardIndex, targetCharacterId, cardType, targetPlayerIdOfChar, playingPlayerId) => {
    setGameState(prevGameState => {
        if (!prevGameState) return null;

        if (prevGameState.current_turn !== playingPlayerId || gameOver || isStealingMode || isUnderTheftAttempt) {
            setMessage("Not your turn, game over, or in special action mode.");
            return prevGameState;
        }

        if (cardType === 'attack' && targetPlayerIdOfChar === playingPlayerId) {
            setMessage("You cannot use attack cards on your own characters!");
            return prevGameState;
        }
        if (cardType === 'lucky' && targetPlayerIdOfChar !== playingPlayerId) {
            setMessage("Lucky Sleep card can only be used on your own characters!");
            return prevGameState;
        }

        setMessage("Playing card...");
        socket.emit('play_card', {
            room_id: roomId,
            player_id: playingPlayerId,
            card_index: cardIndex,
            target_character_id: targetCharacterId,
        });
        return prevGameState;
    });
  };

  const handlePlayCardAction = (cardIndex, cardType, targetCharacterId = null, isCounteringTheft = false) => {
    setGameState(prevGameState => {
        if (!prevGameState) return null;

        if (isCounteringTheft) {
            setMessage("Using anti-theft card...");
            socket.emit('respond_to_theft', {
                room_id: roomId,
                player_id: myPlayerId,
                response_type: 'use_anti_theft',
                anti_theft_card_index: cardIndex,
                thief_player_id: prevGameState.theft_in_progress ? prevGameState.theft_in_progress.thief_player_id : null,
                thief_card_index: prevGameState.theft_in_progress ? prevGameState.theft_in_progress.thief_card_index : null,
            });
            return prevGameState;
        }

        if (prevGameState.current_turn !== myPlayerId || gameOver || isStealingMode || isUnderTheftAttempt) {
            setMessage("Not your turn, game over, or in special action mode.");
            return prevGameState;
        }

        if (cardType === 'theif') {
            setMessage("Initiating theft attempt...");
            socket.emit('initiate_theft_attempt', {
                room_id: roomId,
                player_id: myPlayerId,
                card_index: cardIndex,
            });
            return prevGameState; 
        }

        setMessage("Playing card...");
        socket.emit('play_card', {
            room_id: roomId,
            player_id: myPlayerId,
            card_index: cardIndex,
            target_character_id: targetCharacterId,
        });
        return prevGameState;
    });
  };

  const handleCardSelectedForSteal = (selectedOpponentCardIndex) => {
    if (!isStealingMode || !thiefCardPlayedInfo) {
        setMessage("Not in a valid stealing state.");
        return;
    }

    const isAlreadySelected = selectedCardsToSteal.includes(selectedOpponentCardIndex);

    let updatedSelectedCards;
    if (isAlreadySelected) {
        updatedSelectedCards = selectedCardsToSteal.filter(idx => idx !== selectedOpponentCardIndex);
    } else {
        if (selectedCardsToSteal.length < maxStealableCards) {
            updatedSelectedCards = [...selectedCardsToSteal, selectedOpponentCardIndex];
        } else {
            setMessage(`Cannot steal more than ${maxStealableCards} cards.`);
            return;
        }
    }
    setSelectedCardsToSteal(updatedSelectedCards);
    setMessage(`Selected ${updatedSelectedCards.length} of ${maxStealableCards} cards to steal.`);
  };

  const confirmSteal = () => {
    if (!isStealingMode || selectedCardsToSteal.length === 0) {
        setMessage("No cards selected to steal or not in stealing mode.");
        return;
    }

    setMessage("Stealing selected cards...");
    socket.emit('play_card', {
        room_id: roomId,
        player_id: myPlayerId,
        card_index: thiefCardPlayedInfo.cardIndex,
        selected_card_indices_from_opponent: selectedCardsToSteal,
    });
  };

  const cancelSteal = () => {
    setIsStealingMode(false);
    setThiefCardPlayedInfo(null);
    setOpponentHandRevealed([]);
    setSelectedCardsToSteal([]); // IMPORTANT: Clear on cancel
    setMessage("Stealing cancelled.");

    socket.emit('respond_to_theft', {
        room_id: roomId,
        player_id: myPlayerId, // The player who used Thief (acting as target for response)
        response_type: 'thief_cancel',
        thief_player_id: myPlayerId, 
        thief_card_index: thiefCardPlayedInfo.cardIndex 
    });
  };

  const handlePlayerBeingStolenFromResponse = async (responseType, antiTheftCardIndex = null) => {
    setMessage("Responding to theft...");
    socket.emit('respond_to_theft', {
        room_id: roomId,
        player_id: myPlayerId,
        response_type: responseType,
        anti_theft_card_index: antiTheftCardIndex,
        thief_player_id: gameState.theft_in_progress ? gameState.theft_in_progress.thief_player_id : null,
        thief_card_index: gameState.theft_in_progress ? gameState.theft_in_progress.thief_card_index : null,
    });
  };

  const handleEndTurn = () => {
    setGameState(prevGameState => {
        if (!prevGameState) return null;

        if (prevGameState.current_turn !== myPlayerId || gameOver || isStealingMode || isUnderTheftAttempt) {
            setMessage("Not your turn or game is over, or in special action mode.");
            return prevGameState;
        }

        setMessage("Ending your turn...");
        socket.emit('end_turn', {
            room_id: roomId,
            player_id: myPlayerId,
        });
        return prevGameState;
    });
  };

  const handleCharacterClick = (characterId) => {
    if (isStealingMode || isUnderTheftAttempt) {
      setMessage("You are in a special action mode. Cannot click characters.");
      return;
    }

    let character = null;
    character = gameState?.players[myPlayerId]?.characters.find(char => char.id === characterId);
    if (!character) {
        character = gameState?.players[opponentPlayerId]?.characters.find(char => char.id === characterId);
    }

    if (character) {
        setInformation({
            name: character.name,
            age: `${character.age} years old`,
            description: `${character.description || ''} Current Sleep: ${character.current_sleep}/${character.max_sleep}.`
        });
    }
  };

  if (!gameState) {
    return (
      <div className="game-container loading">
        <p>{message}</p>
        <button onClick={() => navigate('/multiplayer-lobby')} className="back-button">Back to Lobby</button>
      </div>
    );
  }

  const currentPlayer = gameState.players[myPlayerId];
  const opponentPlayer = gameState.players[opponentPlayerId];

  const currentPlayerCharacters = currentPlayer ? currentPlayer.characters : [];
  const currentPlayerHand = currentPlayer ? currentPlayer.hand : [];
  const currentPlayerSleepCount = currentPlayer ? currentPlayer.sleep_count : 0;
  
  const opponentCharacters = opponentPlayer ? opponentPlayer.characters : [];
  const opponentHandSize = opponentPlayer ? opponentPlayer.hand_size : 0;
  const opponentSleepCount = opponentPlayer ? opponentPlayer.sleep_count : 0;

  const maxStealableCardsCalc = 5 - currentPlayerHand.length;

  const availableAntiTheftCards = isUnderTheftAttempt ? 
    currentPlayerHand.filter(card => card.type === 'anti_theft').map((card) => ({ ...card, originalIndex: currentPlayerHand.indexOf(card) })) : [];


  return (
    <div className="game-container">
      <div className="game-board-area">
        <div className="game-board">
          {/* Opponent Player Zone */}
          <PlayerZone 
            player={`${opponentPlayer?.player_name || 'Opponent'} (Opponent)`} 
            characters={opponentCharacters} 
            sleepCount={opponentSleepCount} 
            handSize={opponentHandSize}
            onCharacterClick={handleCharacterClick} 
            onCardDrop={handleCardDrop}
            isCurrentTurn={gameState.current_turn === opponentPlayerId}
            isOpponentZone={true}
            myPlayerId={myPlayerId}
            currentTurnPlayerId={gameState.current_turn}
            isStealingMode={isStealingMode} 
            opponentHand={opponentHandRevealed} 
            onCardSelectedForSteal={handleCardSelectedForSteal}
            maxStealableCards={maxStealableCards}
            selectedCardsToStealCount={selectedCardsToSteal.length}
            selectedOpponentCardIndices={selectedCardsToSteal}
            isUnderTheftAttempt={isUnderTheftAttempt} 
            thiefPlayerId={thiefAttackerId}
          />

          {/* Current Player Zone */}
          <PlayerZone 
            player={`${currentPlayer?.player_name || 'You'} (You)`} 
            characters={currentPlayerCharacters} 
            sleepCount={currentPlayerSleepCount} 
            handSize={currentPlayerHand.length}
            onCharacterClick={handleCharacterClick} 
            onCardDrop={handleCardDrop}
            isCurrentTurn={gameState.current_turn === myPlayerId}
            isOpponentZone={false}
            myPlayerId={myPlayerId}
            currentTurnPlayerId={gameState.current_turn}
            isStealingMode={isStealingMode}
            isUnderTheftAttempt={isUnderTheftAttempt}
            thiefPlayerId={thiefAttackerId}
          />

          {/* Current Player Hand */}
          <div className="player-hand-container">
            <div className="player-hand">
              {currentPlayerHand.map((card, index) => (
                <HandCard
                  key={`${index}-${card.name}-${JSON.stringify(card.effect)}`}
                  card={card}
                  index={index}
                  isDraggable={isMyTurn && !gameOver && !isStealingMode && !isUnderTheftAttempt}
                  playerSourceId={myPlayerId}
                  onClick={handlePlayCardAction}
                  isStealingMode={isStealingMode}
                  isSelected={thiefCardPlayedInfo && thiefCardPlayedInfo.cardIndex === index}
                  isUnderTheftAttempt={isUnderTheftAttempt} 
                  thiefPlayerId={thiefAttackerId}
                />
              ))}
            </div>
            <button 
              onClick={handleEndTurn} 
              disabled={!isMyTurn || gameOver || isStealingMode || isUnderTheftAttempt}
              className="end-turn-button"
            >
              End Turn
            </button>
          </div>
        </div>

        <div className="info-and-log-area">
          <InformationPanel info={information} />
          <div className="game-messages-area">
              <h2>Game Log</h2>
              <p className={isMyTurn ? 'your-turn' : 'opponent-turn'}>
                {message}
              </p>
              {gameOver && <h2 className="game-over-message">{winner === myPlayerId ? 'You Won!' : 'Opponent Won!'}</h2>}
              {gameOver && <button onClick={() => navigate('/multiplayer-lobby')} className="restart-button">Back to Lobby</button>}

              {/* Buttons for Thief card stealing mode */}
              {isStealingMode && (
                <div className="steal-actions">
                  <p className="steal-prompt">Select cards to steal ({selectedCardsToSteal.length}/{maxStealableCardsCalc}):</p>
                  <button onClick={confirmSteal} disabled={selectedCardsToSteal.length === 0}>
                    Confirm Steal
                  </button>
                  <button onClick={cancelSteal}>Cancel Steal</button>
                </div>
              )}

              {/* Anti-Theft Response UI */}
              {isUnderTheftAttempt && (
                <div className="anti-theft-response-area">
                    <h3>Theft Attempt!</h3>
                    <p>{gameState.players[thiefAttackerId].player_name} is trying to steal your cards!</p>
                    {currentPlayerHand.filter(card => card.type === 'anti_theft').length > 0 ? (
                        <>
                            <p>Do you want to use an anti-theft card?</p>
                            <div className="anti-theft-cards-options">
                                {currentPlayerHand.map((card, idx) => (
                                    card.type === 'anti_theft' && (
                                        <HandCard
                                            key={`anti-theft-${idx}-${card.name}`} 
                                            card={card}
                                            index={idx} 
                                            isDraggable={false}
                                            playerSourceId={myPlayerId}
                                            onClick={handlePlayCardAction}
                                            isStealingMode={false}
                                            isUnderTheftAttempt={true}
                                            thiefPlayerId={thiefAttackerId}
                                        />
                                    )
                                ))}
                            </div>
                            <button onClick={() => handlePlayerBeingStolenFromResponse('no_response')}>
                                No, let them steal
                            </button>
                        </>
                    ) : (
                        <p>You have no anti-theft cards to use. Theft will proceed.</p>
                    )}
                </div>
              )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default MultiPlayerGame;