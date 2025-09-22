// Constants for map tiles
export const TILE_EMPTY = 0;
export const TILE_WALL = 1;
export const TILE_BLOCK = 2;

// Generate a default map (15x13 grid)
export function generateMap(width = 15, height = 13) {
  const map = [];
  for (let y = 0; y < height; y++) {
    const row = [];
    for (let x = 0; x < width; x++) {
      // Border walls
      if (y === 0 || y === height - 1 || x === 0 || x === width - 1) {
        row.push(TILE_WALL);
      }
      // Solid walls every other tile
      else if (y % 2 === 0 && x % 2 === 0) {
        row.push(TILE_WALL);
      }
      // Random blocks or empty
      else {
        row.push(Math.random() < 0.7 ? TILE_BLOCK : TILE_EMPTY);
      }
    }
    map.push(row);
  }
  return map;
}

// Render the map as a DOM element
export function renderMap(map) {
  const board = document.createElement('div');
  board.className = 'game-board';
  map.forEach(row => {
    row.forEach(tile => {
      const cell = document.createElement('div');
      cell.className = 'tile';
      if (tile === TILE_WALL) cell.classList.add('tile-wall');
      else if (tile === TILE_BLOCK) cell.classList.add('tile-block');
      else cell.classList.add('tile-empty');
      board.appendChild(cell);
    });
  });
  return board;
}