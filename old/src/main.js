// Import your mini-framework and UI components
// import { createApp } from './framework/index.js';
// import { Lobby } from './ui/lobby.js';




import { render, createElement } from './framework/index.js';
import { renderLobby } from './ui/lobby.js';
import { renderHUD } from './ui/hud.js';
import { renderMap, generateMap } from './game/map.js';
import { connectChat } from './chat/chat.js';
import { renderPlayer } from './game/player.js';
import { renderBomb } from './game/bomb.js';

const app = document.getElementById('app');

let nickname = '';
let players = [];
let gameMap = [];
let gameState = 'nickname'; // 'nickname' | 'lobby' | 'game' | 'results'
let chatSocket = null;

// Example game state for demo (replace with real state in your game logic)
let gamePlayers = [
  { nickname: 'Alice', x: 1, y: 1, number: 1 },
  { nickname: 'Bob', x: 13, y: 11, number: 2 },
  { nickname: 'Carol', x: 1, y: 11, number: 3 },
  { nickname: 'Dave', x: 13, y: 1, number: 4 }
];
let gameBombs = [
  { x: 2, y: 2 },
  { x: 5, y: 5 }
];

// --- Screens ---
function NicknameScreen() {
  return createElement(
    'div',
    {},
    createElement('h1', {}, 'Bomberman DOM'),
    createElement('input', {
      id: 'nickname',
      type: 'text',
      placeholder: 'Enter your nickname',
      maxlength: 16,
      autofocus: true,
    }),
    createElement(
      'button',
      {
        onclick: () => {
          const input = document.getElementById('nickname');
          if (!input.value.trim()) return;
          nickname = input.value.trim();
          // Connect to WebSocket and join lobby
          connectChat(nickname, handleLobbyMessage);
          players = [nickname]; // Add self for now, will update from server
          gameState = 'lobby';
          update();
        },
      },
      'Join Game'
    )
  );
}

function handleLobbyMessage(data) {
  try {
    const msg = JSON.parse(data);
    if (msg.type === 'join') {
      // Add new player if not already in the list
      if (!players.includes(msg.nickname)) {
        players.push(msg.nickname);
        update();
      }
    }
    if (msg.type === 'playerList') {
      // Server can send full player list
      players = msg.players;
      update();
    }
  } catch (e) {
    // Ignore non-JSON messages
  }
}

function LobbyScreen() {
  return createElement(
    'div',
    {},
    renderLobby(players, () => {
      // Start game
      gameMap = generateMap();
      gameState = 'game';
      update();
    })
  );
}

function GameScreen() {
  const board = renderMap(gameMap);

  // Render players
  gamePlayers.forEach(player => {
    const playerEl = renderPlayer(player);
    if (playerEl) board.appendChild(playerEl);
  });

  // Render bombs
  //-----
  //------
  gameBombs.forEach(bomb => {
    const bombEl = renderBomb(bomb);
    if (bombEl) board.appendChild(bombEl);
  });

  return createElement(
    'div',
    {},
    renderHUD({ lives: 3, bombs: 1, powerups: [] }),
    board
  );
}

function ResultsScreen() {
  return createElement(
    'div',
    {},
    createElement('h2', {}, 'Game Over!'),
    createElement(
      'button',
      {
        onclick: () => {
          gameState = 'nickname';
          update();
        },
      },
      'Restart'
    )
  );
}

// --- Navigation ---
function update() {
  if (gameState === 'nickname') {
    render(NicknameScreen, app);
  } else if (gameState === 'lobby') {
    render(LobbyScreen, app);
  } else if (gameState === 'game') {
    render(GameScreen, app);
  } else if (gameState === 'results') {
    render(ResultsScreen, app);
  }
}

document.addEventListener('DOMContentLoaded', update);




// document.addEventListener('DOMContentLoaded', () => {
//   const app = document.getElementById('app');

//   // Example: Render the lobby or nickname input
//   // Replace this with your mini-framework's render logic
//   app.innerHTML = `
//     <h1>Bomberman DOM</h1>
//     <div id="nickname-screen">
//       <input type="text" id="nickname" placeholder="Enter your nickname" maxlength="16" />
//       <button id="join-btn">Join Game</button>
//     </div>
//     <div id="status"></div>
//   `;

//   document.getElementById('join-btn').onclick = () => {
//     const nickname = document.getElementById('nickname').value.trim();
//     if (nickname.length === 0) {
//       document.getElementById('status').textContent = 'Please enter a nickname.';
//       return;
//     }
//     // Proceed to lobby or connect to server
//     document.getElementById('status').textContent = `Welcome, ${nickname}! Connecting...`;
//     // TODO: Add logic to connect to WebSocket and show lobby
//   };
// });