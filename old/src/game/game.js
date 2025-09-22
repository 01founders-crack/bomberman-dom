// Example game state
export const gameState = {
  players: [],
  bombs: [],
  map: [],
  running: false,
};

// Initialize the game
export function initGame({ players, map }) {
  gameState.players = players || [];
  gameState.bombs = [];
  gameState.map = map || [];
  gameState.running = true;
}

// Main game loop (using requestAnimationFrame)
export function startGameLoop(updateCallback, renderCallback) {
  function loop() {
    if (!gameState.running) return;
    updateCallback && updateCallback(gameState);
    renderCallback && renderCallback(gameState);
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
}

// Example: Stop the game
export function stopGame() {
  gameState.running = false;
}

// Example: Add a bomb
export function placeBomb(playerId, position) {
  gameState.bombs.push({
    playerId,
    position,
    timer: 3, // seconds until explosion
  });
}

// You can expand this file with more game logic: player movement, bomb explosions, win conditions, etc.