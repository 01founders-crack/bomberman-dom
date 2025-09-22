// Power-up types
export const POWERUP_TYPES = {
  BOMB: 'bomb',         // +1 bomb
  FIRE: 'fire',         // +1 explosion radius
  SPEED: 'speed',       // faster movement
  LIFE: 'life',         // extra life
};

// Create a new power-up object
export function createPowerup(type, x, y) {
  return {
    type,
    x,
    y,
    collected: false,
  };
}

// Check if a player collects a power-up
export function collectPowerup(player, powerup) {
  if (player.x === powerup.x && player.y === powerup.y && !powerup.collected) {
    powerup.collected = true;
    player.powerups.push(powerup.type);
    // Apply effect
    if (powerup.type === POWERUP_TYPES.BOMB) player.bombs += 1;
    if (powerup.type === POWERUP_TYPES.FIRE) player.firePower = (player.firePower || 1) + 1;
    if (powerup.type === POWERUP_TYPES.SPEED) player.speed = (player.speed || 1) + 0.5;
    if (powerup.type === POWERUP_TYPES.LIFE) player.lives += 1;
    return true;
  }
  return false;
}

// Render a power-up as a DOM element
export function renderPowerup(powerup) {
  if (powerup.collected) return null;
  const el = document.createElement('div');
  el.className = `powerup powerup-${powerup.type}`;
  el.style.gridRowStart = powerup.y + 1;
  el.style.gridColumnStart = powerup.x + 1;
  el.title = powerup.type;
  return el;
}