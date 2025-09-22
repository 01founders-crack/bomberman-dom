// Bomb object structure
export function createBomb(playerId, x, y, timer = 3, power = 1) {
  return {
    playerId,
    x,
    y,
    timer,    // seconds until explosion
    power,    // explosion radius
    exploded: false,
  };
}

// Update all bombs (decrease timer, trigger explosion if needed)
export function updateBombs(bombs, map, onExplode) {
  bombs.forEach(bomb => {
    if (!bomb.exploded) {
      bomb.timer -= 1 / 60; // assuming 60 FPS
      if (bomb.timer <= 0) {
        bomb.exploded = true;
        if (onExplode) onExplode(bomb, map);
      }
    }
  });
}

// Handle bomb explosion (affect map, players, etc.)
export function explodeBomb(bomb, map) {
  // Example: Mark affected tiles (expand with real logic)
  const { x, y, power } = bomb;
  const affected = [{ x, y }];
  // Simple cross explosion
  for (let dx = 1; dx <= power; dx++) {
    if (map[y][x + dx] !== 1) affected.push({ x: x + dx, y });
    else break;
  }
  for (let dx = 1; dx <= power; dx++) {
    if (map[y][x - dx] !== 1) affected.push({ x: x - dx, y });
    else break;
  }
  for (let dy = 1; dy <= power; dy++) {
    if (map[y + dy] && map[y + dy][x] !== 1) affected.push({ x, y: y + dy });
    else break;
  }
  for (let dy = 1; dy <= power; dy++) {
    if (map[y - dy] && map[y - dy][x] !== 1) affected.push({ x, y: y - dy });
    else break;
  }
  return affected;
}
//------------------------------------------
//---
//----

// Render a bomb as a DOM element
//---
// Example: Render bomb as a DOM element
export function renderBomb(bomb) {
  const el = document.createElement('div');
  el.className = 'bomb';
  el.style.gridRowStart = bomb.y + 1;
  el.style.gridColumnStart = bomb.x + 1;
  return el;
}