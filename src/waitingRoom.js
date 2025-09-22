// waitingRoom.js
import { Element } from './element.js';
import { EventEmitter } from './eventSystem.js';
import { sendChatMessage, addChatMessage } from './chatUtils.js';

export class WaitingRoom extends EventEmitter {
    constructor(rootElement, websocket) {
        super();
        this.root = rootElement;
        this.websocket = websocket; // Expect websocket to be passed in
        this.players = [];
        this.maxPlayers = 4;
        this.minPlayers = 2;
        this.isWaiting = false;
        
        if (!this.websocket) {
            throw new Error("WebSocketClient must be provided to WaitingRoom constructor");
        }

        this.createWaitingRoomUI();
        this.setupWebSocketListeners();
    }
    
    generateRandomNickname() {
        const adjectives = ["Super", "Lovely", "Smart", "Nice","Funny","Crazy","Playful","Lazy","Fast"];
        const nouns = ["Lion", "Cat", "Kangaroo", "Bat", "Dolphin", "Gorilla","Dog"];
        const adjective = adjectives[Math.floor(Math.random() * adjectives.length)];
        const noun = nouns[Math.floor(Math.random() * nouns.length)];
        return `${adjective} ${noun}`;
    }

    createWaitingRoomUI() {
        this.container = new Element('div', { 
                id: 'waiting-room', 
                style: { 
                    color: 'white', 
                    display: 'flex', 
                    flexDirection: 'column', 
                    alignItems: 'center', 
                    width: '100%', 
                    maxWidth: '600px', 
                    margin: '0 auto' 
                } 
        });
        
         // Header container for the title
        this.headerContainer = new Element('div', {
            id: 'header-container',
            style: {
                width: '100%',
                textAlign: 'center'
            }
        });
        this.title = new Element('h1', { style: { marginBottom: '2rem', textAlign: 'center' } }, ['Bomberman DOM']);
        this.headerContainer.render().appendChild(this.title.render());
        
         // Content container for nickname form and side-by-side layout
        this.contentContainer = new Element('div', {
            id: 'content-container',
            style: {
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                width: '100%'
            }
        });
        
        // Nickname form
        this.nicknameForm = new Element('div', { id: 'nickname-form' });
        const nicknameLabel = new Element('label', { for: 'nickname-input', style: { display: 'block', marginBottom: '0.5rem' } }, ['Enter your nickname or get a silly one!']);
        const nicknameInput = new Element('input', { 
            id: 'nickname-input', 
            type: 'text', 
            placeholder: 'Nickname',
            maxLength: '15',
            value: this.generateRandomNickname(), // Pre-fill with random nickname
            style: { 
                color: '#333333',
                backgroundColor: '#ffffff'
            }
        });
        // updated random nickname
        setInterval(() => {
            nicknameInput.setAttribute('placeholder', this.generateRandomNickname());
        }, 2000);
        const joinButton = new Element('button', { 
            id: 'join-button', 
            onClick: () => this.joinGame()
        }, ['Join Game']);

        this.nicknameForm.render().appendChild(nicknameLabel.render());
        this.nicknameForm.render().appendChild(nicknameInput.render());
        this.nicknameForm.render().appendChild(joinButton.render());
        
        this.leftContainer = new Element('div', { 
            id: 'left-container',
            style: { 
                flex: '1', 
                padding: '10px', 
                display: 'none', 
                minWidth: '300px' 
            } 
        });
        
        // waiting area
        this.waitingArea = new Element('div', { id: 'waiting-area', style: { display: 'none', width: '100%', textAlign: 'center' } });
        const waitingTitle = new Element('h2', { style: { marginBottom: '1rem' } }, ['Waiting for players...']);
        this.playerCounter = new Element('div', { id: 'player-counter' }, [`Players: 0/${this.maxPlayers}`]);
        this.timer = new Element('div', { 
            id: 'timer', 
            style: { 
                display: 'none', 
                fontSize: '1.5rem', 
                marginTop: '1rem', 
                color: '#ffcc00' 
            } 
        }, ['']);
        this.playerList = new Element('ul', { 
                   id: 'player-list', 
                   style: { listStyle: 'none', padding: '0' } 
               });

        this.waitingArea.render().appendChild(waitingTitle.render());
        this.waitingArea.render().appendChild(this.playerCounter.render());
        this.waitingArea.render().appendChild(this.timer.render());
        this.waitingArea.render().appendChild(this.playerList.render());
        this.leftContainer.render().appendChild(this.waitingArea.render());
        
        // Append nickname form and left container to content container
        this.contentContainer.render().appendChild(this.nicknameForm.render());
        this.contentContainer.render().appendChild(this.leftContainer.render());

        // Append header and content to main container
        this.container.render().appendChild(this.headerContainer.render());
        this.container.render().appendChild(this.contentContainer.render());
        this.root.appendChild(this.container.render());
    }
    
    initializeChat() {
        // Calculate consistent width for the chat container
        const chatWidth = 300; // Default width
        
        this.chatContainer = new Element('div', {
            id: 'chat-container',
            style: {
                flex: '1',
                display: 'flex',
                flexDirection: 'column',
                backgroundColor: 'rgba(0, 0, 0, 0.8)',
                borderRadius: '4px',
                color: 'white',
                padding: '10px',
                marginLeft: '20px',
                height: '400px',
                minWidth: `${chatWidth}px`,
                maxWidth: `${chatWidth}px` // Ensure consistent width
            }
        });
    
        this.chatMessages = new Element('div', {
            id: 'chat-messages',
            style: {
                flex: '1',
                overflowY: 'auto',
                padding: '5px',
                fontSize: '14px'
            }
        });
    
        this.chatForm = new Element('form', {
            id: 'chat-form',
            onSubmit: (e) => {
                e.preventDefault();
                sendChatMessage(this); // Use shared function directly
            },
            style: {
                display: 'flex',
                padding: '5px'
            }
        });
    
        this.chatInput = new Element('input', {
            id: 'chat-input',
            type: 'text',
            placeholder: 'Type your message...',
            style: {
                flexGrow: '1',
                padding: '5px',
                fontSize: '14px',
                border: 'none',
                borderRadius: '3px 0 0 3px'
            }
        });
    
        this.chatSendButton = new Element('button', {
            id: 'chat-send',
            type: 'submit',
            style: {
                padding: '5px',
                fontSize: '14px',
                backgroundColor: '#4CAF50',
                color: 'white',
                border: 'none',
                borderRadius: '0 3px 3px 0'
            }
        }, ['Send']);
    
        this.chatForm.render().appendChild(this.chatInput.render());
        this.chatForm.render().appendChild(this.chatSendButton.render());
        this.chatContainer.render().appendChild(this.chatMessages.render());
        this.chatContainer.render().appendChild(this.chatForm.render());
    
        // Make sure left container width is consistent with chat container
        this.leftContainer.render().style.maxWidth = `${chatWidth}px`;
        this.leftContainer.render().style.minWidth = `${chatWidth}px`;
    
        // Append chat to contentContainer, not container
        this.contentContainer.render().appendChild(this.chatContainer.render());
    }

    joinGame() {
        const nicknameInput = document.getElementById('nickname-input');
        let nickname = nicknameInput.value.trim(); 
        console.log("nickname",nickname)
        if (!nickname || nickname ==="") {
            nickname = this.generateRandomNickname();
            console.log('Generated random nickname:', nickname);
        }else{
            console.log('Joining game with nickname:', nickname);
        }
        
        this.nicknameForm.render().style.display = 'none';
        this.leftContainer.render().style.display = 'block';
        this.waitingArea.render().style.display = 'block';
        
        this.initializeChat();

        // Expand container and switch content to row layout
        this.container.render().style.maxWidth = '800px';
        this.contentContainer.render().style.flexDirection = 'row';
        this.contentContainer.render().style.alignItems = 'flex-start';
        this.contentContainer.render().style.justifyContent = 'space-between';
        this.contentContainer.render().style.gap = '20px';
        
        this.isWaiting = true;
        this.websocket.send('joinGame', { player: { nickname } });
    }
    
    updatePlayers(players) {
        console.log('Updating players:', players);
        this.players = players;
        this.playerCounter.queueUpdate(() => {
            this.playerCounter.render().textContent = `Players: ${this.players.length}/${this.maxPlayers}`;
        });
        
        this.playerList.render().innerHTML = '';
        
        // Store baseHue for later use in the game
        if (!this.baseHue) {
            this.baseHue = Math.floor(Math.random() * 360);
        }
        
        players.forEach((player, index) => {
            const isLocalPlayer = this.websocket && player.id === this.websocket.clientId;
            
            const nicknameElement = new Element('span', {
                class: isLocalPlayer ? 'local-player' : '',
                style: {
                    flex: 1
                }
            }, [player.nickname]);
            
            const playerItem = new Element('li', {
                class: 'player-item',
                style: {
                    display: 'flex',
                    alignItems: 'center',
                    padding: '8px 12px' // Add some padding to compensate for removed icon
                }
            });
            
            // Head icon removed - just append the nickname
            playerItem.render().appendChild(nicknameElement.render());
            
            this.playerList.render().appendChild(playerItem.render());
        });
    }
    
    updateCountdown(remaining, phase) {
        console.log(`Countdown update: ${phase} - ${remaining}s`);
        this.timer.render().style.display = 'block';
        this.timer.queueUpdate(() => {
            if (remaining === null && phase === "waiting") {
                this.timer.render().textContent = "Waiting for more players...";
            } else {
                this.timer.render().textContent = phase === "waiting" 
                    ? `Waiting for more players: ${remaining}s`
                    : `Game starting in ${remaining}s`;
            }
        });
        if (remaining === 0 && phase === "waiting") {
            this.timer.render().style.display = 'none';
        }
    }

    startGame(data) {
        console.log('Game starting with data:', data);
        this.timer.render().style.display = 'none';
        
        // Make sure all players have proper local/remote flags
        const localPlayer = this.players.find(player => {
            if (this.websocket.clientId === player.id) {
                return true;
            }
            return false;
        });
        
        if (localPlayer) {
            console.log(`Local player found: ${localPlayer.nickname} (${localPlayer.id})`);
            // Pass the local player ID through to the game data
            const gameDataWithLocal = {
                ...data,
                localPlayerId: localPlayer.id,
                // Make sure baseHue is passed through
                baseHue: data.baseHue
            };
            this.emit('gameStart', gameDataWithLocal);
        } else {
            console.warn('No local player found in player list');
            this.emit('gameStart', data);
        }
    }
    
     // Add these as instance methods to satisfy chatUtils
    sendChatMessage() {
       sendChatMessage(this);
    }

    addChatMessage(messageData) {
        addChatMessage(this, messageData);
    }


    setupWebSocketListeners() {
        if (!this.websocket) {
            console.error('WebSocket is not initialized in setupWebSocketListeners');
            return;
        }
        console.log('Setting up WebSocket listeners with:', this.websocket);

        this.websocket.on('updatePlayers', (data) => {
            this.updatePlayers(data.players);
        });

        this.websocket.on('countdownUpdate', (data) => {
            this.updateCountdown(data.remaining, data.phase);
        });

        this.websocket.on('gameStarted', (data) => {
            console.log('Received gameStarted from server:', data);
            this.players = data.players;
            this.startGame(data); // Pass the full data object
        });
        
        this.websocket.on('chatMessage', (data) => this.addChatMessage(data));

        this.websocket.on('error', (data) => {
            console.error('Server error:', data.message);
            this.waitingArea.render().style.display = 'none';
            this.nicknameForm.render().style.display = 'block';
            this.leftContainer.render().style.display = 'none'; // Hide waiting area fully
            this.chatContainer.render().style.display = 'none'; // Hide chat container
            this.isWaiting = false;
            
            // Create error message
            const errorMessage = new Element('p', { 
                style: { 
                    color: 'red', 
                    textAlign: 'center', 
                    margin: '0', 
                    fontSize: '1.2rem' 
                } 
            }, [data.message]);
            
            // Insert into this.container before contentContainer
            this.container.render().insertBefore(errorMessage.render(), this.contentContainer.render());
            
            // Reset layout to initial state
            this.container.render().style.maxWidth = '600px';
            this.contentContainer.render().style.flexDirection = 'column';
            this.contentContainer.render().style.alignItems = 'center';
            this.contentContainer.render().style.justifyContent = 'flex-start';
            
            setTimeout(() => {
                errorMessage.render().remove();
            }, 3000);
        });
    }
}