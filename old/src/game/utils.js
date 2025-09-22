// Generate a random integer between min and max (inclusive)
export function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Shuffle an array (Fisher-Yates)
export function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

// Deep clone an object or array
export function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

// Check if two positions are equal
export function positionsEqual(a, b) {
  return a.x === b.x && a.y === b.y;
}
//---------------------------------------------

// Clamp a value between min and max
export function clamp(val, min, max) {
  return Math.max(min, Math.min(max, val));
}