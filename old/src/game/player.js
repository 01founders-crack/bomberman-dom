// Player directions
export const DIRECTION = {
  UP: 'up',
  DOWN: 'down',
  LEFT: 'left',
  RIGHT: 'right',
};

// Create a new player object
export function createPlayer(id, nickname, x, y) {
  return {
    id,
    nickname,
    x,
    y,
    lives: 3,
    bombs: 1,
    powerups: [],
    alive: true,
  };
}

// Move player if possible
export function movePlayer(player, direction, map) {
  let { x, y } = player;
  if (direction === DIRECTION.UP) y--;
  if (direction === DIRECTION.DOWN) y++;
  if (direction === DIRECTION.LEFT) x--;
  if (direction === DIRECTION.RIGHT) x++;

  // Check map bounds and collisions
  if (
    y >= 0 &&
    y < map.length &&
    x >= 0 &&
    x < map[0].length &&
    map[y][x] === 0 // 0 = empty tile
  ) {
    player.x = x;
    player.y = y;
    return true;
  }
  return false;
}

// Example: Render player as a DOM element
export function renderPlayer(player) {
  const el = document.createElement('div');
  el.className = 'player';
  el.style.gridRowStart = player.y + 1;
  el.style.gridColumnStart = player.x + 1;

  // Determine player number (default to 1 if not set)
  const playerNum = player.number || 1;
  const img = document.createElement('img');
  img.src = `src/assets/images/player${playerNum}.png`;
  img.alt = player.nickname;
  img.style.width = '32px';
  img.style.height = '32px';
  el.appendChild(img);

  return el;
}
//------------------------------------------
let gamePlayers = [
  { nickname: 'Alice', x: 1, y: 1, number: 1 },
  { nickname: 'Bob', x: 13, y: 11, number: 2 },
  { nickname: 'Carol', x: 1, y: 11, number: 3 },
  { nickname: 'Dave', x: 13, y: 1, number: 4 }
];