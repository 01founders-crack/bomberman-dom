// chatUtils.js
import { Element } from './element.js';

export function sendChatMessage(context) {
    const input = document.getElementById('chat-input');
    const message = input.value.trim();

    if (message) {
        // Find local player (context-specific)
        const localPlayer = context.players.find(p => p.id === (context.websocket ? context.websocket.clientId : p.isLocal));
        if (localPlayer) {
            const messageData = {
                playerId: localPlayer.id,
                playerName: localPlayer.nickname,
                text: message,
                timestamp: Date.now()
            };
            context.addChatMessage(messageData); // Call the instance's addChatMessage
            if (context.websocket) {
                context.websocket.send('chatMessage', { text: message }); // WaitingRoom style
            }
            input.value = '';
        } else {
            console.warn('Local player not found for chat message');
        }
    }
}

export function addChatMessage(context, messageData) {
    // Calculate font size based on scale factor if available
    const scaleFactor = context.scaleFactor || 1;
    const fontSize = Math.max(9, Math.round(10 * scaleFactor / 2));
    
    // Special styling for system messages
    const isSystem = messageData.isSystem || messageData.playerId === "SERVER";
    
    const messageElement = new Element('div', {
        class: 'chat-message',
        style: {
            marginBottom: `${Math.max(3, Math.round(5 * scaleFactor / 2))}px`,
            fontSize: `${fontSize}px`,
            wordBreak: 'break-word',
            color: isSystem ? '#ff9900' : 'white',  // Orange for system messages
            fontWeight: isSystem ? 'bold' : 'normal'
        }
    }, [`${messageData.playerName}: ${messageData.text}`]);

    context.chatMessages.render().appendChild(messageElement.render());
    
    // Ensure scroll to bottom - more reliable method
    requestAnimationFrame(() => {
        const messagesElement = context.chatMessages.render();
        messagesElement.scrollTop = messagesElement.scrollHeight;
    });
}