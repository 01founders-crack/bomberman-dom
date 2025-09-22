let socket;
let onMessageCallback = null;

export function connectChat(nickname, onMessage) {
  socket = new WebSocket('ws://localhost:3000');
  onMessageCallback = onMessage;

  socket.addEventListener('open', () => {
    // Optionally notify server of nickname
    socket.send(JSON.stringify({ type: 'join', nickname }));
  });

  socket.addEventListener('message', (event) => {
    const data = event.data;
    if (onMessageCallback) {
      onMessageCallback(data);
    }
  });
}

export function sendChatMessage(nickname, message) {
  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify({ type: 'chat', nickname, message }));
  }
}
// ... (other functions like disconnectChat)
//--
// ... (other functions like disconnectChat)
export function disconnectChat() {
  if (socket) {
    socket.close();
    socket = null;
  }
}