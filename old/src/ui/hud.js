// Example: Render the HUD UI
export function renderHUD({ lives = 3, bombs = 1, powerups = [] } = {}) {
  const hudDiv = document.createElement('div');
  hudDiv.className = 'hud';

  const livesSpan = document.createElement('span');
  livesSpan.className = 'hud-lives';
  livesSpan.textContent = `Lives: ${lives}`;
  hudDiv.appendChild(livesSpan);

  const bombsSpan = document.createElement('span');
  bombsSpan.className = 'hud-bombs';
  bombsSpan.textContent = `Bombs: ${bombs}`;
  hudDiv.appendChild(bombsSpan);

  const powerupsSpan = document.createElement('span');
  powerupsSpan.className = 'hud-powerups';
  powerupsSpan.textContent = `Power-ups: ${powerups.join(', ') || 'None'}`;
  hudDiv.appendChild(powerupsSpan);

  return hudDiv;
}