// Example: Render the lobby UI
export function renderLobby(players = [], onStartGame) {
  const lobbyDiv = document.createElement('div');
  lobbyDiv.className = 'lobby';

  const title = document.createElement('h2');
  title.textContent = 'Game Lobby';
  lobbyDiv.appendChild(title);

  const playerList = document.createElement('ul');
  playerList.className = 'player-list';
  players.forEach(player => {
    const li = document.createElement('li');
    li.textContent = player;
    playerList.appendChild(li);
  });
  lobbyDiv.appendChild(playerList);

  const startBtn = document.createElement('button');
  startBtn.textContent = 'Start Game';
  startBtn.onclick = () => {
    if (onStartGame) onStartGame();
  };
  lobbyDiv.appendChild(startBtn);

  return lobbyDiv;
}