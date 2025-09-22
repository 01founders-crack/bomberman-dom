# Project 
# Bomberman DOM

A multiplayer Bomberman game built using plain JavaScript, DOM manipulation, and WebSockets.

Objectives:
For this project you have to create a bomberman alike game, where multiple players (2-4) can join in and battle until one of them is the last man standing. Chat. 3 minutes timer. Up speed, Up multiple boms, Up fire line. 60 fps.

## Project Structure
- `miniframework/elements.js`: My miniFramework
- `framework/index.js`: My Framework
- `index.html`: Main HTML file
- `css/style.css`: Main styles
- `assets/bomberman.png`:sprite sheet for game element
- `src/`: JavaScript source files
  - `app.js`: Entry point
  - `element.js`: Virtual DOM abstraction
  - `eventSystem.js`: Custom event handling
  - `inputManager.js`: Input handling
  - `router.js`: URL-based routing
  - `state.js`: State management
  - `game.js`: Main game logic
  - `map.js`: Map generation and rendering
  - `coordinates.js`: Unified coordinate system for element positioning
  - `chatUtils.js`: handle add/send message for chat feature
  - `player.js`: Player logic
  - `bomb.js`: Bomb, explosion, and power-up logic
  - `waitingRoom.js`: Multiplayer waiting room
  - `websocket.js`: WebSocket client
- `server/server.js`: Node.js WebSocket server

HOW to RUN 1: 

1. If it’s a new project → Initialize one:

If you’re starting from scratch and need to create a package.json:

npm init -y
npm install react
npm install express
npm install websocket

2. If it’s an existing project → Install dependencies:
node server/server.js

OPEN in Firefox or Chrom: http://localhost:9090

Made in 01 Founders team: vkyrychu, Radek, ababa, schana. 2025.

