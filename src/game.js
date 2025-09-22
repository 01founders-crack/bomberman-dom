import { CoordinateSystem } from './coordinates.js';
import { Element } from './element.js';
import { EventEmitter } from './eventSystem.js';
import { InputManager } from './inputManager.js';
import { GameMap } from './map.js';
import { Player } from './player.js';
import { Bomb, Explosion, PowerUp } from './bomb.js';
import { WebSocketClient } from './websocket.js';
import { sendChatMessage, addChatMessage } from './chatUtils.js';

export class Game extends EventEmitter {
    constructor(rootElement, gameData) {
        super();
        this.root = rootElement;
        this.gameData = gameData || {}; // Allow gameData to be empty initially
        this.players = [];
        this.bombs = [];
        this.explosions = [];
        this.powerUps = [];
        this.frameCount = 0;
        this.lastTime = 0;
        this.isGameOver = false;
        this.gameStartTime = null; // Set when game actually starts
        this.gameTime = 180000; // 3 minutes in milliseconds
        this.stateCheckInterval = null;

        // Use the baseHue from gameData if available, otherwise generate a random one
        this.baseHue = this.gameData.baseHue !== undefined ? this.gameData.baseHue : Math.floor(Math.random() * 360);
        console.log(`Game initialized with baseHue: ${this.baseHue}`);
        
        // Scale factor for responsive rendering
        this.scaleFactor = 1;
        
        if (!this.gameData.map) {
            console.error('No map provided in gameData:', this.gameData);
            throw new Error('Game initialization failed: No map provided');
        }
        this.initializeContainer();
        this.initializeGame(this.gameData.map);
    }
    
    getHeadSpritePosition(lives) {
        // When lives are 0, use the sad face at (177, 177)
        // Otherwise use normal face at (129, 101)
        return lives <= 0 
            ? { x: 161, y: 160 }
            : { x: 129, y: 101 };
    }

    startPeriodicStateCheck() {
        // Clear any existing interval first
        if (this.stateCheckInterval) {
            clearInterval(this.stateCheckInterval);
        }
        
        // Check game state every 500ms
        this.stateCheckInterval = setInterval(() => {
            // Skip if game is already over
            if (this.isGameOver) return;
            
            // Count players still alive
            const alivePlayers = this.players.filter(player => player.lives > 0);
            
            // If only one player remains, they win
            if (alivePlayers.length === 1 && this.players.length > 1) {
                console.log(`Periodic check: Winner is ${alivePlayers[0].nickname}`);
                this.endGame(alivePlayers[0]);
            }
            // If no players remain, it's a draw
            else if (alivePlayers.length === 0 && this.players.length > 0) {
                console.log('Periodic check: No winners (draw)');
                this.endGame();
            }
        }, 500); // Check every half second
    }

    initializeContainer() {
        // Create game container
        this.container = new Element('div', { id: 'game-container' });
        this.root.appendChild(this.container.render());
    
        // Calculate initial scale factor
        this.calculateScaleFactor();

        // Add loading message
        const loadingMessage = new Element('div', {
            id: 'loading-message',
            style: {
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                color: 'white',
                fontSize: '24px',
                textAlign: 'center',
                zIndex: '100'
            }
        }, ['Waiting for game to start...']);
        this.container.render().appendChild(loadingMessage.render());

        // Initialize WebSocket
        this.websocket = new WebSocketClient();

        // Only add resize listener after coords is initialized, or guard it
        window.addEventListener('resize', () => {
            this.calculateScaleFactor();
            if (this.coords) { // Guard against early calls
                this.updateAllElementsScale();
            } else {
                console.warn('Resize event triggered before coordinate system initialized');
            }
        });
        
        if (!this.websocket) { // Prevent re-initialization
            this.websocket = new WebSocketClient();
            this.setupWebSocketListeners();
        }
    }
    
    // Initialize the coordinate system
    initializeCoordinateSystem() {
        this.coords = new CoordinateSystem(this);
        console.log('Coordinate system initialized');
    }

    // Utility to create elements (for consistency)
    createElement(tag, attrs = {}, children = []) {
        return new Element(tag, attrs, children);
    }

    initializeGame(serverMap) {
        // Initialize coordinate system first
        this.initializeCoordinateSystem();

        // Remove loading message
        const loadingMessage = document.getElementById('loading-message');
        if (loadingMessage) loadingMessage.remove();
    
        // Initialize input manager
        this.inputManager = new InputManager();
    
        // Create game map with server-provided map
        this.map = new GameMap(this);
        const mapContainer = this.map.initialize(serverMap);
        
        // Append map to gameArea instead of container
        this.gameArea.render().appendChild(mapContainer.render());
    
        // Initialize players
        this.initializePlayers();
    
        // Create game UI
        this.createGameUI();
    
        // Initialize chat
        this.initializeChat();
    
        // Setup WebSocket listeners here, after players are initialized
        if (this.websocket) {
            this.setupWebSocketListeners();
        }
        
        // Start game loop
        this.gameStartTime = Date.now();
        this.lastTime = performance.now();
        this.lastFpsUpdate = this.lastTime;
        this.gameLoop(this.lastTime);
    
        this.startPeriodicStateCheck();

        console.log('Game initialized with scale factor:', this.scaleFactor);
    }
    
    calculateScaleFactor() {
        // Original game map dimensions (in pixels)
        const originalMapWidth = 240;  // 15 tiles * 16 pixels
        const originalMapHeight = 208; // 13 tiles * 16 pixels
        
        // Set sidebar width relative to game (128px compared to 240px game width ~ 35%)
        const originalSidebarWidth = 128;
        
        // Total original width including sidebar
        const originalTotalWidth = originalMapWidth + originalSidebarWidth;
        
        // Available space in the viewport (use 95% to leave some margin)
        const availableWidth = window.innerWidth * 0.95;
        const availableHeight = window.innerHeight * 0.95;
        
        // Calculate scale factor to maintain aspect ratio
        const widthScaleFactor = Math.floor(availableWidth / originalTotalWidth);
        const heightScaleFactor = Math.floor(availableHeight / originalMapHeight);
        
        // Use the smaller scale factor
        this.scaleFactor = Math.max(1, Math.min(widthScaleFactor, heightScaleFactor));
        
        // Calculate scaled dimensions
        const scaledMapWidth = Math.round(originalMapWidth * this.scaleFactor);
        const scaledMapHeight = Math.round(originalMapHeight * this.scaleFactor);
        const scaledSidebarWidth = Math.round(originalSidebarWidth * this.scaleFactor);
        const totalWidth = scaledMapWidth + scaledSidebarWidth;
        
        // Update container size and position
        this.container.setStyle({
            width: `${totalWidth}px`,
            height: `${scaledMapHeight}px`,
            position: 'relative',
            display: 'flex',
            maxWidth: '100%',
            maxHeight: '100vh',
            zIndex: '1' // Higher than background
        });
        
        // Create a game area container if it doesn't exist
        if (!this.gameArea) {
            this.gameArea = new Element('div', {
                id: 'game-area',
                style: {
                    width: `${scaledMapWidth}px`,
                    height: `${scaledMapHeight}px`,
                    position: 'relative'
                }
            });
            this.container.render().appendChild(this.gameArea.render());
        } else {
            this.gameArea.setStyle({
                width: `${scaledMapWidth}px`,
                height: `${scaledMapHeight}px`,
                zIndex: '1' // Higher than background
            });
        }
        
        // Create a UI sidebar if it doesn't exist
        if (!this.uiSidebar) {
            this.uiSidebar = new Element('div', {
                id: 'ui-sidebar',
                style: {
                    width: `${scaledSidebarWidth}px`,
                    height: `${scaledMapHeight}px`,
                    display: 'flex',
                    flexDirection: 'column',
                    padding: `${Math.max(5, Math.round(10 * this.scaleFactor / 3))}px`,
                    boxSizing: 'border-box',
                    backgroundColor: 'rgba(34, 34, 34, 0.4)', // Translucent background
                    zIndex: '1'
                }
            });
            this.container.render().appendChild(this.uiSidebar.render());
        } else {
            this.uiSidebar.setStyle({
                width: `${scaledSidebarWidth}px`,
                height: `${scaledMapHeight}px`,
                padding: `${Math.max(5, Math.round(10 * this.scaleFactor / 3))}px`,
                backgroundColor: 'rgba(34, 34, 34, 0.7)',
                zIndex: '1' // Higher than background
            });
        }
    }
    
    updateAllElementsScale() {
        if (!this.coords) {
            console.warn('Skipping updateAllElementsScale: Coordinate system not initialized');
            return;
        }
        
        // Update map tiles
        if (this.map) this.map.updateScale(this.scaleFactor);
         
        // Update players
        this.players.forEach(player => {
            player.updateScale(this.scaleFactor); // Recalculate position
            player.updatePosition(); // Apply immediately
        });
        
        // Update bombs
        this.bombs.forEach(bomb => bomb.updateScale(this.scaleFactor));
        
        // Update explosions
        this.explosions.forEach(explosion => explosion.updateScale(this.scaleFactor));
        
        // Update power-ups
        this.powerUps.forEach(powerUp => powerUp.updateScale(this.scaleFactor));
        
        // Update UI elements WITHOUT recreating them
        if (this.uiContainer) {
            this.uiContainer.setStyle({
                padding: `${Math.max(4, Math.round(5 * this.scaleFactor / 2))}px`,
                marginBottom: `${Math.max(5, Math.round(10 * this.scaleFactor / 3))}px`
            });
        }
        
        // Update timer and FPS container
        if (this.topStatsContainer) {
            this.topStatsContainer.setStyle({
                marginBottom: `${Math.max(5, Math.round(10 * this.scaleFactor / 3))}px`
            });
        }
        
        // Update timer text size
        if (this.timerElement) {
            const uiFontSize = Math.max(10, Math.round(12 * this.scaleFactor / 2));
            this.timerElement.setStyle({
                fontSize: `${uiFontSize}px`,
                marginBottom: `${Math.max(5, Math.round(10 * this.scaleFactor / 3))}px`
            });
            
            // Update timer text
            const elapsedTime = Date.now() - this.gameStartTime;
            const remainingTime = Math.max(0, this.gameTime - elapsedTime);
            const minutes = Math.floor(remainingTime / 60000);
            const seconds = Math.floor((remainingTime % 60000) / 1000);
            this.timerElement.render().textContent = `Time: ${minutes}:${seconds.toString().padStart(2, '0')}`;
        }
        
        // Update FPS element scaling
        if (this.fpsElement) {
            const uiFontSize = Math.max(10, Math.round(12 * this.scaleFactor / 2));
            this.fpsElement.setStyle({
                fontSize: `${uiFontSize}px`,
                marginBottom: `${Math.max(5, Math.round(10 * this.scaleFactor / 3))}px`
            });
        }
        
        // Update player lives
        if (this.livesContainer) {
            this.livesContainer.setStyle({
                gap: `${Math.max(4, Math.round(8 * this.scaleFactor / 3))}px`
            });
            
            // Update individual player entries
            const headSize = Math.round(16 * this.scaleFactor);
            const livesFontSize = Math.max(9, Math.round(10 * this.scaleFactor / 2));
            
            this.players.forEach(player => {
                const playerLivesEl = document.getElementById(`lives-${player.id}`);
                if (playerLivesEl) {
                    // Update container styling
                    playerLivesEl.style.padding = `${Math.max(4, Math.round(8 * this.scaleFactor / 3))}px`;
                    playerLivesEl.style.fontSize = `${livesFontSize}px`;
                    
                    // Update head icon
                    const headIcon = playerLivesEl.querySelector('.player-head-icon');
                    if (headIcon) {
                        const headSprite = this.getHeadSpritePosition(player.lives);
                        headIcon.style.width = `${headSize}px`;
                        headIcon.style.height = `${headSize}px`;
                        headIcon.style.backgroundPosition = `-${headSprite.x * this.scaleFactor}px -${headSprite.y * this.scaleFactor}px`;
                        headIcon.style.backgroundSize = `${320 * this.scaleFactor}px ${192 * this.scaleFactor}px`;
                        headIcon.style.marginRight = `${Math.max(4, Math.round(8 * this.scaleFactor / 3))}px`;
                    }
                    
                    // Update text size
                    const textElements = playerLivesEl.querySelectorAll('span');
                    textElements.forEach(el => {
                        el.style.fontSize = `${livesFontSize}px`;
                    });
                }
            });
        }
        
        // Update chat UI
        if (this.chatContainer && this.smallUIMessage) {
            const chatFontSize = Math.max(9, Math.round(10 * this.scaleFactor / 2));
            const minChatWidth = 200; // Minimum width for usable chat
            const actualWidth = this.uiSidebar.render().clientWidth;
            const showChat = actualWidth >= minChatWidth;
            
            // Update visibility of chat components
            this.chatContainer.setStyle({
                display: showChat ? 'flex' : 'none'
            });
            
            this.smallUIMessage.setStyle({
                display: showChat ? 'none' : 'block',
                padding: `${Math.max(5, Math.round(8 * this.scaleFactor / 3))}px`,
                fontSize: `${chatFontSize}px`
            });
            
            // Update font sizes and spacing for chat elements
            if (this.chatMessages) {
                this.chatMessages.setStyle({
                    padding: `${Math.max(3, Math.round(5 * this.scaleFactor / 2))}px`,
                    fontSize: `${chatFontSize}px`
                });
            }
            
            if (this.chatInput) {
                this.chatInput.setStyle({
                    padding: `${Math.max(3, Math.round(5 * this.scaleFactor / 2))}px`,
                    fontSize: `${chatFontSize}px`,
                    borderRadius: `${Math.max(2, Math.round(3 * this.scaleFactor / 2))}px 0 0 ${Math.max(2, Math.round(3 * this.scaleFactor / 2))}px`
                });
            }
            
            if (this.chatSendButton) {
                this.chatSendButton.setStyle({
                    padding: `${Math.max(3, Math.round(5 * this.scaleFactor / 2))}px`,
                    fontSize: `${chatFontSize}px`,
                    borderRadius: `0 ${Math.max(2, Math.round(3 * this.scaleFactor / 2))}px ${Math.max(2, Math.round(3 * this.scaleFactor / 2))}px 0`
                });
            }
        }
    }
    
    initializePlayers() {

        // Set a black background to the document root to avoid seeing white
        document.body.style.backgroundColor = '222';

        const spawnPositions = [
            { x: 1 * this.map.tileSize, y: 1 * this.map.tileSize },
            { x: 13 * this.map.tileSize, y: 1 * this.map.tileSize },
            { x: 1 * this.map.tileSize, y: 11 * this.map.tileSize },
            { x: 13 * this.map.tileSize, y: 11 * this.map.tileSize }
        ];
        
        // Create a dedicated background element before adding players
        this.backgroundElement = new Element('div', {
            id: 'game-background',
            style: {
                position: 'fixed',
                top: '0',
                left: '0',
                width: '100%',
                height: '100%',
                backgroundImage: 'url(assets/background.png)',
                backgroundRepeat: 'repeat',
                backgroundSize: '117px 64px',
                zIndex: '0', // Behind everything
                transition: 'filter 0.5s ease' // Smooth transition for color changes
            }
        });
        document.body.appendChild(this.backgroundElement.render());

        // Wait until after player creation to apply filters
        let localPlayerFound = false;

        this.gameData.players.forEach((playerData, index) => {
            if (index >= spawnPositions.length) return;
            const isLocal = this.gameData.localPlayerId === playerData.id;
            const player = new Player(this, {
                ...playerData,
                isLocal,
                playerIndex: index,
                baseHue: this.baseHue
            }, spawnPositions[index]);
            if (playerData.speed !== undefined) {
                player.speed = playerData.speed;
                console.log(`Player ${player.id} initialized with server speed=${player.speed}`);
            }
            // Apply server-provided data if available
            if (playerData.tileX !== undefined) player.tileX = playerData.tileX;
            if (playerData.tileY !== undefined) player.tileY = playerData.tileY;
            if (playerData.direction) player.direction = playerData.direction;
            if (playerData.moving !== undefined) player.moving = playerData.moving;
    
            const pos = this.coords.getPlayerSpritePosition(player.tileX, player.tileY);
            player.x = pos.x;
            player.y = pos.y;
            player.updatePosition(); // Set initial position
            player.updateAnimation(0); // Set initial sprite
    
            this.players.push(player);
            this.gameArea.render().appendChild(player.element.render());
            
            // If this is the local player, apply their color filter to the background
            if (isLocal) {
                localPlayerFound = true;
                const playerFilter = player.getPlayerFilter(player.playerIndex, this.baseHue);
                console.log(`Applying background filter: ${playerFilter} for player ${player.nickname}`);
                this.backgroundElement.setStyle({
                    filter: playerFilter
                });
            }
        });

        // If we couldn't identify a local player, keep default background without filters
        if (!localPlayerFound) {
            console.log('No local player found, using default background');
        }
    }
    
    // Fix for death and victory animations at larger screen sizes
    // The issue is likely due to scaling calculation precision

    // 1. Fix the createAnimation method in game.js to handle scaling better
    // This is the underlying function that creates all animations

    createAnimation(name, keyframesDefinition) {
        const styleSheet = document.styleSheets[0];
    
        // Check if animation already exists and remove it first
        // This ensures we don't have scaling conflicts from previous versions
        for (let i = 0; i < styleSheet.cssRules.length; i++) {
            if (styleSheet.cssRules[i].type === CSSRule.KEYFRAMES_RULE && 
                styleSheet.cssRules[i].name === name) {
                styleSheet.deleteRule(i);
                break;
            }
        }
    
        // Add the fresh animation definition
        try {
            styleSheet.insertRule(keyframesDefinition, styleSheet.cssRules.length);
            console.log(`Animation '${name}' created successfully`);
            return true;
        } catch (e) {
            console.error(`Failed to create animation '${name}':`, e);
            console.log('Attempted keyframes:', keyframesDefinition);
            return false;
        }
    }

    createGameUI() {
        // Create UI container in the sidebar
        this.uiContainer = new Element('div', {
            id: 'game-ui',
            style: {
                width: '100%',
                padding: `${Math.max(4, Math.round(5 * this.scaleFactor / 2))}px`,
                display: 'flex',
                flexDirection: 'column',
                color: 'white',
                backgroundColor: 'rgba(0, 0, 0, 0.4)',
                fontFamily: 'Arial, sans-serif',
                borderRadius: '4px',
                marginBottom: `${Math.max(5, Math.round(10 * this.scaleFactor / 3))}px`
            }
        });
        
        // Create timer with scaled font size
        const uiFontSize = Math.max(10, Math.round(12 * this.scaleFactor / 2));
        this.timerElement = new Element('div', {
            id: 'game-timer',
            style: {
                fontSize: `${uiFontSize}px`,
                fontWeight: 'bold',
                marginBottom: `${Math.max(5, Math.round(10 * this.scaleFactor / 3))}px`,
                textAlign: 'center'
            }
        }, ['Time: 3:00']);
        
        // Create FPS counter with scaled font size
        this.fpsElement = new Element('div', {
            id: 'game-fps',
            style: {
                fontSize: `${uiFontSize}px`,
                fontWeight: 'bold', // Match the timer's bold style
                color: '#88ff88',
                textAlign: 'center',
                marginBottom: `${Math.max(5, Math.round(10 * this.scaleFactor / 3))}px`,
                backgroundColor: 'rgba(0, 0, 0, 0.3)',
                padding: '2px 5px',
                borderRadius: '3px',
                display: 'inline-block'
            }
        }, ['FPS: --']);

        // Create a container for the timer and FPS to place them side by side
        this.topStatsContainer = new Element('div', {
            style: {
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: `${Math.max(5, Math.round(10 * this.scaleFactor / 3))}px`
            }
        });

        // Add timer and FPS to the stats container
        this.topStatsContainer.render().appendChild(this.timerElement.render());
        this.topStatsContainer.render().appendChild(this.fpsElement.render());

        // Create player lives display
        this.livesContainer = new Element('div', {
            id: 'game-lives',
            style: {
                display: 'flex',
                flexDirection: 'column',
                gap: `${Math.max(4, Math.round(8 * this.scaleFactor / 3))}px`
            }
        });
        
        // Scale player lives text size
        const livesFontSize = Math.max(9, Math.round(10 * this.scaleFactor / 2));
        
        // Calculate head icon size (same as a tile)
        const headSize = Math.round(16 * this.scaleFactor);
        
        // Add player lives displays with head icons
        this.players.forEach(player => {
            const isLocalPlayer = this.websocket && player.id === this.websocket.clientId;
            
            // Get head sprite position based on lives
            const headSprite = this.getHeadSpritePosition(player.lives);
            
            // Create the player head icon
            const playerHeadIcon = new Element('div', {
                class: 'player-head-icon',
                style: {
                    width: `${headSize}px`,
                    height: `${headSize}px`,
                    backgroundImage: 'url(assets/bomberman.png)',
                    backgroundPosition: `-${headSprite.x * this.scaleFactor}px -${headSprite.y * this.scaleFactor}px`,
                    backgroundSize: `${320 * this.scaleFactor}px ${192 * this.scaleFactor}px`,
                    marginRight: `${Math.max(4, Math.round(8 * this.scaleFactor / 3))}px`,
                    filter: player.getPlayerFilter(player.playerIndex, this.baseHue),
                    imageRendering: 'pixelated',
                    flexShrink: 0
                }
            });
    
            const nicknameElement = new Element('span', {
                class: isLocalPlayer ? 'local-player' : '',
                style: {
                    fontSize: `${livesFontSize}px`,
                    flex: 1,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis'
                }
            }, [player.nickname]);
            
            const livesCountElement = new Element('span', {
                style: {
                    fontSize: `${livesFontSize}px`,
                    whiteSpace: 'nowrap'
                }
            }, [`${player.lives} ♥`]);
            
            const playerLives = new Element('div', {
                id: `lives-${player.id}`,
                class: 'player-lives',
                style: {
                    display: 'flex',
                    alignItems: 'center',
                    padding: `${Math.max(4, Math.round(8 * this.scaleFactor / 3))}px`,
                    backgroundColor: '#333',
                    borderRadius: '4px',
                    fontSize: `${livesFontSize}px`
                }
            });
            
            // Append elements to player lives container
            playerLives.render().appendChild(playerHeadIcon.render());
            playerLives.render().appendChild(nicknameElement.render());
            playerLives.render().appendChild(livesCountElement.render());
    
            this.livesContainer.render().appendChild(playerLives.render());
        });
        
        // Add UI elements to container - proper sequence
        this.uiContainer.render().appendChild(this.topStatsContainer.render());
        this.uiContainer.render().appendChild(this.livesContainer.render());
        
        // Add UI container to sidebar
        this.uiSidebar.render().appendChild(this.uiContainer.render());
    }
    
    
    initializeChat() {
        const chatFontSize = Math.max(9, Math.round(10 * this.scaleFactor / 2));
        
        // Check if UI is too small for chat
        const minChatWidth = 200; // Minimum width in pixels for chat to be usable
        const actualWidth = this.uiSidebar.render().clientWidth;
        const showChat = actualWidth >= minChatWidth;
        
        // Create main chat container
        this.chatContainer = new Element('div', {
            id: 'chat-container',
            style: {
                width: '100%',
                flex: 1, // Take remaining space in sidebar
                display: showChat ? 'flex' : 'none', // Hide if too small
                flexDirection: 'column',
                backgroundColor: 'rgba(0, 0, 0, 0.5)',
                borderRadius: '4px',
                color: 'white',
                position: 'relative', // For proper containment
                overflow: 'hidden' // Prevent content from spilling out
            }
        });
    
        // Create chat messages area
        this.chatMessages = new Element('div', {
            id: 'chat-messages',
            style: {
                flex: 1, // Take remaining space in chat container
                overflowY: 'auto',
                padding: `${Math.max(3, Math.round(5 * this.scaleFactor / 2))}px`,
                fontSize: `${chatFontSize}px`,
                marginBottom: '40px' // Make space for fixed input at bottom
            }
        });
    
        // Create chat form
        this.chatForm = new Element('form', {
            id: 'chat-form',
            onSubmit: (e) => {
                e.preventDefault();
                sendChatMessage(this); // Use shared function
            },
            style: {
                display: 'flex',
                padding: `${Math.max(2, Math.round(3 * this.scaleFactor / 2))}px`,
                position: 'absolute', // Fix at bottom
                bottom: '0',
                left: '0',
                right: '0',
                backgroundColor: 'rgba(0, 0, 0, 0.7)', // Background for visibility
                borderTop: '1px solid #444' // Separator from messages
            }
        });
    
        // Create chat input
        this.chatInput = new Element('input', {
            id: 'chat-input',
            type: 'text',
            placeholder: 'Type your message...',
            style: {
                flexGrow: '1',
                padding: `${Math.max(3, Math.round(5 * this.scaleFactor / 2))}px`,
                fontSize: `${chatFontSize}px`,
                border: 'none',
                borderRadius: `${Math.max(2, Math.round(3 * this.scaleFactor / 2))}px 0 0 ${Math.max(2, Math.round(3 * this.scaleFactor / 2))}px`
            }
        });
    
        // Create send button
        this.chatSendButton = new Element('button', {
            id: 'chat-send',
            type: 'submit',
            style: {
                padding: `${Math.max(3, Math.round(5 * this.scaleFactor / 2))}px`,
                fontSize: `${chatFontSize}px`,
                backgroundColor: '#4CAF50',
                color: 'white',
                border: 'none',
                borderRadius: `0 ${Math.max(2, Math.round(3 * this.scaleFactor / 2))}px ${Math.max(2, Math.round(3 * this.scaleFactor / 2))}px 0`,
                whiteSpace: 'nowrap' // Prevent button text from wrapping
            }
        }, ['Send']);
    
        // Assemble the chat components
        this.chatForm.render().appendChild(this.chatInput.render());
        this.chatForm.render().appendChild(this.chatSendButton.render());
        this.chatContainer.render().appendChild(this.chatMessages.render());
        this.chatContainer.render().appendChild(this.chatForm.render());
        
        // Create small UI message (but don't attach it yet)
        this.smallUIMessage = new Element('div', {
            id: 'small-ui-message',
            style: {
                padding: `${Math.max(5, Math.round(8 * this.scaleFactor / 3))}px`,
                textAlign: 'center',
                color: '#aaa',
                fontSize: `${chatFontSize}px`,
                backgroundColor: 'rgba(0, 0, 0, 0.5)',
                borderRadius: '4px',
                margin: '8px 0',
                display: showChat ? 'none' : 'block'
            }
        }, ['Chat disabled at small screen size']);
        
        // Add elements to the sidebar
        this.uiSidebar.render().appendChild(this.chatContainer.render());
        this.uiSidebar.render().appendChild(this.smallUIMessage.render());
    }
    
    sendChatMessage() { 
        sendChatMessage(this);
    }
    
    addChatMessage(messageData) {
        addChatMessage(this, messageData);
    }
    
    gameLoop(currentTime) {
        // Calculate delta time
        const deltaTime = currentTime - this.lastTime;
        this.lastTime = currentTime;
        
        // Add accumulator for fixed timestep
        if (!this.accumulator) this.accumulator = 0;
        this.accumulator += deltaTime;
        
        // Fixed timestep for movement logic (60fps)
        const fixedTimestep = 1000/60;
        
        // Update FPS counter
        this.frameCount++;
        if (currentTime - this.lastFpsUpdate > 1000) {
            this.fps = Math.round((this.frameCount * 1000) / (currentTime - this.lastFpsUpdate));
            this.frameCount = 0;
            this.lastFpsUpdate = currentTime;
            
            // Update FPS display
            if (this.fpsElement && this.fpsElement.render) {
                // Color code the FPS value
                let fpsColor = '#88ff88'; // Green for 50-60+ FPS
                if (this.fps < 30) {
                    fpsColor = '#ff5555'; // Red for <30 FPS
                } else if (this.fps < 50) {
                    fpsColor = '#ffff55'; // Yellow for 30-50 FPS
                }
                
                this.fpsElement.setStyle({
                    color: fpsColor
                });
                
                this.fpsElement.render().textContent = `FPS: ${this.fps}`;
            }
            
            // Log FPS and player states (for debugging)
            console.log(`FPS: ${this.fps}`);
            // Debug: log player positions and states
            if (this.players) {
                this.players.forEach(player => {
                    if (player) {
                        console.log(`Player ${player.id} (${player.isLocal ? 'Local' : 'Remote'}): pos(${player.x}, ${player.y}), dir(${player.direction}), moving(${player.moving})`);
                    }
                });
            }
        }
        
        // If game is over, stop the loop
        if (this.isGameOver) {
            return;
        }
        
        // Get input state
        const inputState = this.inputManager.getState();
        
        // Use fixed timestep for movement updates
        while (this.accumulator >= fixedTimestep) {
            // Update game components with fixed timestep
            this.updateWithFixedTimestep(fixedTimestep, inputState);
            this.accumulator -= fixedTimestep;
        }
        
        // Additional updates that can happen every frame (animations, etc.)
        this.updatePerFrame(deltaTime, inputState);
        
        // Continue game loop
        requestAnimationFrame((time) => this.gameLoop(time));
    }
    
    // New methods to split update logic
    updateWithFixedTimestep(timestep, inputState) {
        // Update local players (movement logic)
        this.players.forEach(player => {
            if (player.isLocal) {
                player.update(timestep, inputState);
            }
        });
    }

    checkExplosionCollisions() {
        // Client no longer detects damage - server handles everything
        // This method is left as a placeholder in case other code calls it
        return;
    }

    updatePerFrame(deltaTime, inputState) {
        // Update remote players (interpolation)
        this.players.forEach(player => {
            if (!player.isLocal && player.targetTileX !== undefined && player.targetTileY !== undefined) {
                // If not currently at target tile
                if (player.tileX !== player.targetTileX || player.tileY !== player.targetTileY) {
                    if (player.moving) {
                        const targetPos = this.coords.getPlayerSpritePosition(player.targetTileX, player.targetTileY);
                        
                        // Use time-based interpolation factor
                        const interpFactor = Math.min(1.0, deltaTime / 100); // Complete move in ~100ms
                        
                        player.x += (targetPos.x - player.x) * interpFactor;
                        player.y += (targetPos.y - player.y) * interpFactor;
                        
                        // If very close to target, snap to it exactly
                        if (Math.abs(player.x - targetPos.x) < 2 && Math.abs(player.y - targetPos.y) < 2) {
                            player.tileX = player.targetTileX;
                            player.tileY = player.targetTileY;
                            player.x = targetPos.x;
                            player.y = targetPos.y;
                        }
                        player.updatePosition();
                    } else {
                        // Not moving but position differs - snap to target position immediately
                        player.tileX = player.targetTileX;
                        player.tileY = player.targetTileY;
                        const pos = this.coords.getPlayerSpritePosition(player.tileX, player.tileY);
                        player.x = pos.x;
                        player.y = pos.y;
                        player.updatePosition();
                    }
                }
                
                // Always update animation
                player.updateAnimation(deltaTime);
            }
        });
        
        // Update bombs
        this.bombs.forEach(bomb => bomb.update(deltaTime));
        
        // Update explosions
        this.explosions.forEach(explosion => explosion.update(deltaTime));
        
        // Update power-ups
        this.powerUps.forEach(powerUp => powerUp.update(deltaTime));
        
        // Check local player against explosions every frame
        this.checkExplosionCollisions();
        
        // Update game timer
        this.updateGameTimer();
        
        // Check for game over conditions
        this.checkGameOver();
    }
    

    setupWebSocketListeners() {
        // Remove gameStarted listener since we use gameData directly
        this.websocket.on('playerUpdate', (data) => {
            console.log("Received playerUpdate from server:", data);
            const player = this.players.find(p => p.id === data.id);
            if (player) {
                // Update invulnerability state
                if (data.invulnerable) {
                    // FIRST check if player is alive
                    if (player.lives <= 0) {
                        // Don't apply invulnerability to dead players
                        player.element.domElement.classList.remove('player-invulnerable');
                        if (player.invulnerabilityTimer) {
                            clearTimeout(player.invulnerabilityTimer);
                        }
                        return;
                    }
                    
                    player.lastHitTime = data.lastHitTime || Date.now();
                    
                    // Add visual indicator for invulnerability
                    player.element.domElement.classList.add('player-invulnerable');
                    
                    // Remove invulnerability after the period ends
                    if (player.invulnerabilityTimer) {
                        clearTimeout(player.invulnerabilityTimer);
                    }
                    
                    player.invulnerabilityTimer = setTimeout(() => {
                        if (player.element && player.element.domElement) {
                            player.element.domElement.classList.remove('player-invulnerable');
                        }
                    }, 3000); // Increased to match server
                }
                
                // For lives specifically, ALWAYS use server value
                if (typeof data.lives !== 'undefined' && player.lives !== data.lives) {
                    console.log(`Updating player ${player.id} lives: ${player.lives} => ${data.lives} (SERVER)`);
                    player.lives = data.lives;
                    
                    // Update UI with scaled font and head icon
                    const livesElement = document.getElementById(`lives-${player.id}`);
                    if (livesElement) {
                        livesElement.innerHTML = ''; // Clear existing
                        const isLocalPlayer = this.websocket && player.id === this.websocket.clientId;
                        
                        // Calculate font size based on scale factor
                        const livesFontSize = Math.max(9, Math.round(10 * this.scaleFactor / 2));
                        
                        // Calculate head icon size (same as a tile)
                        const headSize = Math.round(16 * this.scaleFactor);
                        
                        // Get head sprite position based on lives
                        const headSprite = this.getHeadSpritePosition(player.lives);
                        
                        // Create the player head icon
                        const playerHeadIcon = new Element('div', {
                            class: 'player-head-icon',
                            style: {
                                width: `${headSize}px`,
                                height: `${headSize}px`,
                                backgroundImage: 'url(assets/bomberman.png)',
                                backgroundPosition: `-${headSprite.x * this.scaleFactor}px -${headSprite.y * this.scaleFactor}px`,
                                backgroundSize: `${320 * this.scaleFactor}px ${192 * this.scaleFactor}px`,
                                marginRight: `${Math.max(4, Math.round(8 * this.scaleFactor / 3))}px`,
                                filter: player.getPlayerFilter(player.playerIndex, this.baseHue),
                                imageRendering: 'pixelated',
                                flexShrink: 0
                            }
                        });
                        
                        const nicknameElement = new Element('span', {
                            class: isLocalPlayer ? 'local-player' : '',
                            style: {
                                fontSize: `${livesFontSize}px`,
                                flex: 1,
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis'
                            }
                        }, [player.nickname]);
                        
                        const livesCountElement = new Element('span', {
                            style: {
                                fontSize: `${livesFontSize}px`,
                                whiteSpace: 'nowrap'
                            }
                        }, [`${player.lives} ♥`]);
                        
                        // Append elements to player lives container
                        livesElement.appendChild(playerHeadIcon.render());
                        livesElement.appendChild(nicknameElement.render());
                        livesElement.appendChild(livesCountElement.render());
                    }
                    
                    // Handle death state
                    if (player.lives <= 0 && player.element.domElement.style.display !== 'none') {
                        player.die();
                    }
                }
                
                this.websocket.on('gameStateSync', (data) => {
                    console.log('Received full game state sync:', data);
                    
                    // For each player in the server state
                    data.players.forEach(serverPlayer => {
                      const localPlayer = this.players.find(p => p.id === serverPlayer.id);
                      if (!localPlayer) return;
                      
                      // For local player, only correct if significantly out of sync
                      if (localPlayer.isLocal) {
                        // If position differs by more than 1 tile, force correction
                        const posDiffX = Math.abs(localPlayer.tileX - serverPlayer.tileX);
                        const posDiffY = Math.abs(localPlayer.tileY - serverPlayer.tileY);
                        
                        if (posDiffX > 1 || posDiffY > 1) {
                          console.log(`Correcting local player position from (${localPlayer.tileX},${localPlayer.tileY}) to (${serverPlayer.tileX},${serverPlayer.tileY})`);
                          
                          // Force position correction
                          localPlayer.tileX = serverPlayer.tileX;
                          localPlayer.tileY = serverPlayer.tileY;
                          
                          // Update visual position
                          const pos = this.coords.getPlayerSpritePosition(localPlayer.tileX, localPlayer.tileY);
                          localPlayer.x = pos.x;
                          localPlayer.y = pos.y;
                          localPlayer.updatePosition();
                          
                          // Update target position too
                          localPlayer.targetTileX = serverPlayer.tileX;
                          localPlayer.targetTileY = serverPlayer.tileY;
                        }
                        
                        // Always update lives, speed, and other critical stats
                        localPlayer.lives = serverPlayer.lives;
                        localPlayer.speed = serverPlayer.speed;
                        
                      } else {
                        // For remote players, always use server position
                        localPlayer.targetTileX = serverPlayer.tileX;
                        localPlayer.targetTileY = serverPlayer.tileY;
                        localPlayer.direction = serverPlayer.direction;
                        localPlayer.moving = serverPlayer.moving;
                        localPlayer.lives = serverPlayer.lives;
                        localPlayer.speed = serverPlayer.speed;
                      }
                    });
                  });

                // Handle activeBombs updates
                if (typeof data.activeBombs !== 'undefined') {
                    if (player.isLocal) {
                        // First, remove any bombs that no longer exist in the game
                        player.activeBombs = player.activeBombs.filter(b => 
                            b && this.bombs.some(bomb => bomb.bombId === b.bombId));
                        
                        // Ensure the array length matches server's count
                        const diff = data.activeBombs - player.activeBombs.length;
                        if (diff > 0) {
                            console.log(`Syncing activeBombs: Adding ${diff} placeholder bombs`);
                            for (let i = 0; i < diff; i++) {
                                player.activeBombs.push(null);
                            }
                        } else if (diff < 0) {
                            console.log(`Syncing activeBombs: Removing ${-diff} excess bombs`);
                            player.activeBombs.splice(player.activeBombs.length + diff);
                        }
                    }
                }
                
                console.log(`After update - Player ${player.id}: target=(${player.targetTileX},${player.targetTileY}), lives=${player.lives}`);
                
                // Update position for non-local players
                if (!player.isLocal) {
                    if (!player.moving || data.lives !== undefined) {
                        player.tileX = data.tileX;
                        player.tileY = data.tileY;
                        player.updatePosition();
                    }
                }
            }
        });

        this.websocket.on('bombPlaced', (data) => {
            console.log(`Received bombPlaced: bombId=${data.bombId}, tileX=${data.tileX}, tileY=${data.tileY}, playerId=${data.playerId}`);
            const player = this.players.find(p => p.id === data.playerId);
            if (player && !this.bombs.some(b => b.bombId === data.bombId)) {
                console.log(`Creating bomb ${data.bombId} for player ${data.playerId}`);
                const bomb = this.createBomb(player, data.tileX, data.tileY, data.bombId);
                if (player.isLocal) player.activeBombs.push(bomb); // Only local tracks activeBombs
            }
        });
        
        this.websocket.on('bombRejected', (data) => { // Added
            console.log(`Bomb placement rejected: ${data.reason}`);
        });
        
        this.websocket.on('explosionCreated', (data) => {
            console.log(`Received explosionCreated: ${data.type} at (${data.tileX},${data.tileY})`);
            this.createExplosion(data.tileX, data.tileY, data.type, data.direction, data.bombId);

            // NEW CODE: Check if this explosion is at a bomb position
            const bombAtPosition = this.bombs.find(b => 
                b.tileX === data.tileX && b.tileY === data.tileY);
                
            if (bombAtPosition) {
                // If we found a bomb at this position, add a visual effect
                // to indicate it's about to chain explode
                
                // Add a quick flash effect to the bomb
                const bombElement = bombAtPosition.element.domElement;
                bombElement.style.filter = 'brightness(3)'; // Make it glow
                
                // Optional: Add a distinctive "chain reaction" sound if you have one
                // this.playSound('chain-reaction');
            }

            const bomb = this.bombs.find(b => b.bombId === data.bombId);
            if (bomb) {
                // Find and update the player who owns this bomb
                const bombOwner = this.players.find(p => p.id === bomb.player.id);
                if (bombOwner && bombOwner.isLocal) {
                    // Remove the bomb from player's active bombs array
                    bombOwner.activeBombs = bombOwner.activeBombs.filter(b => 
                        b && b.bombId !== data.bombId);
                    console.log(`Updated player ${bombOwner.id} activeBombs: ${bombOwner.activeBombs.length}`);
                }
                this.removeBomb(bomb);  // Remove bomb on explosion confirmation
            }
        });

        this.websocket.on('mapUpdate', (data) => {
            this.map.setTileType(data.tileX, data.tileY, data.type);
        });
        
        this.websocket.on('powerUpCreated', (data) => {
            console.log(`Received powerUpCreated at (${data.tileX},${data.tileY}) of type ${data.type}`);
            
            // Create the power-up 
            const powerUp = this.createPowerUp(data.tileX, data.tileY, data.type);
            
            // If this is from a player death, add special visual effect
            if (data.fromPlayer) {
                // Create pulsing animation for player-dropped power-ups
                const animationName = 'death-powerup-pulse';
                const keyframes = `
                @keyframes ${animationName} {
                    0% { transform: scale(1); filter: brightness(1); }
                    50% { transform: scale(1.2); filter: brightness(2); }
                    100% { transform: scale(1); filter: brightness(1); }
                }`;
                
                // Add the animation to the stylesheet
                this.createAnimation(animationName, keyframes);
                
                // Apply the animation to the power-up
                powerUp.element.domElement.style.animation = `${animationName} 1s infinite`;
                
                // Add a special effect when it appears
                const explosionEffect = new Element('div', {
                    style: {
                        position: 'absolute',
                        left: `${powerUp.element.domElement.style.left}`,
                        top: `${powerUp.element.domElement.style.top}`,
                        width: `${this.map.tileSize * 3 * this.scaleFactor}px`,
                        height: `${this.map.tileSize * 3 * this.scaleFactor}px`,
                        transform: 'translate(-33%, -33%)',
                        backgroundColor: 'rgba(255, 255, 255, 0.7)',
                        borderRadius: '50%',
                        zIndex: '3',
                        animation: 'player-death-powerup-spawn 0.5s forwards'
                    }
                });
                
                // Create and add the spawn animation
                this.createAnimation('player-death-powerup-spawn', `
                    @keyframes player-death-powerup-spawn {
                        0% { transform: translate(-33%, -33%) scale(0); opacity: 0.8; }
                        100% { transform: translate(-33%, -33%) scale(1); opacity: 0; }
                    }
                `);
                
                // Add the effect to the game area
                this.gameArea.render().appendChild(explosionEffect.render());
                
                // Remove the effect after animation completes
                setTimeout(() => {
                    explosionEffect.domElement.remove();
                }, 500);
            }
        });

        this.websocket.on('powerUpCollected', (data) => {
            // Find and remove the power-up from the list
            const powerUp = this.powerUps.find(p => 
                p.tileX === data.tileX && p.tileY === data.tileY);
            
            if (powerUp) {
                powerUp.element.domElement.remove();
                this.removePowerUp(powerUp);
            }
            
            // Update any player's stats based on server data
            const player = this.players.find(p => p.id === data.playerId);
            if (player) {
                // For both local and remote players, update stats from server
                if (data.stats) {
                    console.log(`Updating player ${player.id} stats from server:`, data.stats);
                    player.bombCount = data.stats.bombCount;
                    player.bombPower = data.stats.bombPower;
                    player.speed = data.stats.speed;
                    
                    // If local player, trigger visual feedback
                    if (player.isLocal) {
                        // Create the power-up feedback text
                        const feedbackElement = new Element('div', {
                            style: {
                                position: 'absolute',
                                left: `${player.x}px`,
                                top: `${player.y - 20}px`,
                                color: 'white',
                                fontWeight: 'bold',
                                fontSize: '16px',
                                textShadow: '0 0 5px black',
                                zIndex: 20,
                                pointerEvents: 'none',
                                animation: 'powerup-text 1s forwards'
                            }
                        }, [`+${data.type}`]);
                        
                        this.gameArea.render().appendChild(feedbackElement.render());
                        
                        // Remove after animation
                        setTimeout(() => {
                            feedbackElement.domElement.remove();
                        }, 1000);
                    }
                }
            }
        });
        
        this.websocket.on('chatMessage', (data) => {
            this.addChatMessage(data);
        });
        
        this.websocket.on('gameStarted', (data) => {
            console.log('Received gameStarted with map:', data.map);
            this.gameData.players = data.players;
            this.initializeGameWithMap(data.map);
        });

        this.websocket.on('gameEnded', (data) => {
            console.log('Received gameEnded from server:', data);
            
            // Check if we already ended the game locally
            if (this.isGameOver) {
                console.log('Game already ended locally, ignoring server message');
                return;
            }
            
            // Convert server winner format to local player object format
            let winner = null;
            if (data.winner) {
                winner = this.players.find(p => p.id === data.winner.id);
                console.log(`Winner identified: ${data.winner.nickname}`);
            }
            
            // Delay ending the game to allow any in-progress death animations to complete
            setTimeout(() => {
                // End the game with the winner from server
                this.endGame(winner);
            }, 2000); // Allow enough time for death animations
        });

        this.websocket.on('gameOverVerified', (data) => {
            console.log('Received gameOverVerified from server:', data);
            
            // Clear the timeout to prevent double game end
            if (this.gameOverVerificationTimeout) {
                clearTimeout(this.gameOverVerificationTimeout);
                this.gameOverVerificationTimeout = null;
            }
            
            if (data.verified) {
                console.log('Server verified game over, winner:', data.winnerId);
                const winner = this.players.find(p => p.id === data.winnerId);
                this.endGame(winner);
            } else {
                console.log('Server rejected game over, updating player states');
                
                // Update player states with server's authoritative data
                data.correctState.forEach(serverPlayer => {
                    const player = this.players.find(p => p.id === serverPlayer.id);
                    if (player && player.lives !== serverPlayer.lives) {
                        console.log(`Correcting player ${player.id} lives from ${player.lives} to ${serverPlayer.lives}`);
                        player.lives = serverPlayer.lives;
                        
                        // Update UI
                        const livesElement = document.getElementById(`lives-${player.id}`);
                        if (livesElement) {
                            livesElement.innerHTML = ''; // Clear existing
                            const isLocalPlayer = this.websocket && player.id === this.websocket.clientId;
                            
                            // Calculate font size based on scale factor
                            const livesFontSize = Math.max(9, Math.round(10 * this.scaleFactor / 2));
                            
                            // Calculate head icon size (same as a tile)
                            const headSize = Math.round(16 * this.scaleFactor);
                            
                            // Get head sprite position based on lives
                            const headSprite = this.getHeadSpritePosition(player.lives);
                            
                            // Create the player head icon
                            const playerHeadIcon = new Element('div', {
                                class: 'player-head-icon',
                                style: {
                                    width: `${headSize}px`,
                                    height: `${headSize}px`,
                                    backgroundImage: 'url(assets/bomberman.png)',
                                    backgroundPosition: `-${headSprite.x * this.scaleFactor}px -${headSprite.y * this.scaleFactor}px`,
                                    backgroundSize: `${320 * this.scaleFactor}px ${192 * this.scaleFactor}px`,
                                    marginRight: `${Math.max(4, Math.round(8 * this.scaleFactor / 3))}px`,
                                    filter: player.getPlayerFilter(player.playerIndex, this.baseHue),
                                    imageRendering: 'pixelated',
                                    flexShrink: 0
                                }
                            });
                            
                            const nicknameElement = new Element('span', {
                                class: isLocalPlayer ? 'local-player' : '',
                                style: {
                                    fontSize: `${livesFontSize}px`,
                                    flex: 1,
                                    whiteSpace: 'nowrap',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis'
                                }
                            }, [player.nickname]);
                            
                            const livesCountElement = new Element('span', {
                                style: {
                                    fontSize: `${livesFontSize}px`,
                                    whiteSpace: 'nowrap'
                                }
                            }, [`${player.lives} ♥`]);
                            
                            // Append elements to player lives container
                            livesElement.appendChild(playerHeadIcon.render());
                            livesElement.appendChild(nicknameElement.render());
                            livesElement.appendChild(livesCountElement.render());
                        }
                        
                        // Handle death or resurrection if needed
                        if (player.lives <= 0 && player.element.domElement.style.display !== 'none') {
                            player.die();
                        } else if (player.lives > 0 && player.element.domElement.style.display === 'none') {
                            // Handle case where player was shown as dead but actually alive
                            player.element.domElement.style.display = 'block';
                            player.resetAnimation();
                        }
                    }
                });
            }
        });
    }
    
    createPowerUp(tileX, tileY, type) {
        const powerUp = new PowerUp(this, tileX, tileY, type);
        this.powerUps.push(powerUp);
        this.gameArea.render().appendChild(powerUp.element.render());
        return powerUp;
    }

    update(deltaTime) {
        // Get input state
        const inputState = this.inputManager.getState();
        
        // Update players
        this.players.forEach(player => {
            if (player.isLocal) {
                player.update(deltaTime, inputState);
            } else if (player.targetTileX !== undefined && player.targetTileY !== undefined) {
                if (player.tileX !== player.targetTileX || player.tileY !== player.targetTileY) {
                    const targetPos = this.coords.getPlayerSpritePosition(player.targetTileX, player.targetTileY);
                    
                    // Instead of a speed factor, use a time-based approach
                    const interpFactor = Math.min(1.0, deltaTime / 100); // Complete move in ~100ms
                    
                    player.x += (targetPos.x - player.x) * interpFactor;
                    player.y += (targetPos.y - player.y) * interpFactor;
                    
                    // Snap to target when very close to avoid tiny movements
                    if (Math.abs(player.x - targetPos.x) < 2 && Math.abs(player.y - targetPos.y) < 2) {
                        player.x = targetPos.x;
                        player.y = targetPos.y;
                        player.tileX = player.targetTileX;
                        player.tileY = player.targetTileY;
                    }
                    
                    player.updatePosition();
                    player.updateAnimation(deltaTime);
                }
                
                // Always update animation
                player.updateAnimation(deltaTime);
            }
        });
        
        // Update bombs
        this.bombs.forEach(bomb => bomb.update(deltaTime));
        
        // Update explosions
        this.explosions.forEach(explosion => explosion.update(deltaTime));
        
        // Update power-ups
        this.powerUps.forEach(powerUp => powerUp.update(deltaTime));
        
        // Check local player against explosions every frame
        const localPlayer = this.players.find(p => p.isLocal);
        if (localPlayer && localPlayer.lives > 0 && this.explosions.length > 0) {
            this.explosions.forEach(explosion => {
                // More precise collision - check player's tile position
                if (localPlayer.tileX === explosion.tileX && localPlayer.tileY === explosion.tileY) {
                    // Debounce hits by tracking which bombs have hit this player
                    if (!localPlayer.hitByExplosions) localPlayer.hitByExplosions = new Set();
                    
                    if (!localPlayer.hitByExplosions.has(explosion.bombId)) {
                        localPlayer.hitByExplosions.add(explosion.bombId);
                        console.log(`Client detected collision with explosion ${explosion.bombId}`);
                        
                        // Don't reduce lives locally! Just request server to validate and do it
                        this.websocket.send('playerUpdate', {
                            id: localPlayer.id,
                            tileX: localPlayer.tileX,
                            tileY: localPlayer.tileY,
                            lives: localPlayer.lives - 1,  // REQUEST life reduction
                            forceUpdate: true  // Flag that this is a damage request
                        });
                    }
                }
            });
        }
        
        // Update game timer
        this.updateGameTimer();
        
        // Check for game over conditions
        this.checkGameOver();
    }
    
    updateGameTimer() {
        const elapsedTime = Date.now() - this.gameStartTime;
        const remainingTime = Math.max(0, this.gameTime - elapsedTime);
        
        // Convert to minutes and seconds
        const minutes = Math.floor(remainingTime / 60000);
        const seconds = Math.floor((remainingTime % 60000) / 1000);
        
        // Add visual urgency when time is running low
        if (remainingTime < 30000) { // Less than 30 seconds
            if (!this.timerElement.domElement.classList.contains('timer-warning')) {
                this.timerElement.domElement.classList.add('timer-warning');
                
                // Play a sound if you have one
                // this.game.playSound('timer-warning');
                
                console.log('Timer entering warning state!');
            }
        } else {
            // Remove the warning class if time is above 30 seconds
            if (this.timerElement.domElement.classList.contains('timer-warning')) {
                this.timerElement.domElement.classList.remove('timer-warning');
            }
        }
        
        // Update timer display
        this.timerElement.render().textContent = `Time: ${minutes}:${seconds.toString().padStart(2, '0')}`;
        
        // If time is up, end the game
        if (remainingTime <= 0) {
            this.endGame();
        }
    }
    
   /*  checkExplosionCollisions() {
        // Check each explosion against each player
        this.explosions.forEach(explosion => {
            console.log(`Explosion ${explosion.bombId} at (${explosion.tileX},${explosion.tileY})`);
            this.players.forEach(player => {
                if (player.lives <= 0) return;
                
                const playerPos = player.getPosition();
                console.log(`Player ${player.id} at (${playerPos.tileX},${playerPos.tileY}), lives=${player.lives}`);
                // Check if player is on the explosion tile
                if (playerPos.tileX === explosion.tileX && playerPos.tileY === explosion.tileY) {
                    console.log(`Hit Player ${player.id}`);
                    player.takeDamage(explosion.bombId); // Already broadcasts
                }
            });
        });
    } */
    
        checkGameOver() {
            // Don't check if the game is already over
            if (this.isGameOver) return;
            
            // Count players still alive
            const alivePlayers = this.players.filter(player => player.lives > 0);
            
            // If only one player remains, they win
            if (alivePlayers.length === 1 && this.players.length > 1) {
                const winner = alivePlayers[0];
                console.log(`Regular check: Winner is ${winner.nickname}`);
                
                // Add a short delay before ending the game to ensure any 
                // final death animations can complete
                setTimeout(() => {
                    // Double-check that game is still not over and player is still alive
                    if (!this.isGameOver && winner.lives > 0) {
                        // Request final verification from server before ending
                        if (this.websocket) {
                            this.websocket.send('verifyGameOver', { 
                                expectedWinner: winner.id,
                                clientState: this.players.map(p => ({
                                    id: p.id,
                                    lives: p.lives
                                }))
                            });
                            
                            // Set a timeout to end the game anyway if server doesn't respond
                            this.gameOverVerificationTimeout = setTimeout(() => {
                                if (!this.isGameOver) {
                                    console.log('No server verification received, ending game with local state');
                                    this.endGame(winner);
                                }
                            }, 2000);
                        } else {
                            this.endGame(winner);
                        }
                    }
                }, 2000);
            }
            // If no players remain, it's a draw
            else if (alivePlayers.length === 0 && this.players.length > 0) {
                console.log('Regular check: No winners (draw)');
                
                // Add a short delay before ending the game
                setTimeout(() => {
                    if (!this.isGameOver) {
                        this.endGame();
                    }
                }, 2000);
            }
        }
    
        endGame(winner = null) {
            // If already ended, prevent multiple calls
            if (this.isGameOver) {
                console.log('Game already ended, ignoring duplicate call');
                return;
            }
            
            // Set game over flag
            this.isGameOver = true;
            console.log(`Game ending with winner: ${winner ? winner.nickname : 'None (draw)'}`);
            
            // Play victory animation for the winner if one exists
            if (winner) {
                winner.playVictoryAnimation();
            }
        
            // Only freeze players that are still alive (EXCEPT THE WINNER)
            this.players.forEach(player => {
                if (player.lives > 0 && player !== winner && player.element && player.element.domElement) {
                    player.element.domElement.style.animation = 'none';
                    player.element.domElement.style.transition = 'none';
                }
            });
            
            // Freeze the timer
            if (this.timerElement && this.timerElement.domElement) {
                this.timerElement.domElement.classList.remove('timer-warning');
            }
            
            // Prepare result data
            const result = {
                winner,
                players: this.players.map(p => ({
                    id: p.id,
                    nickname: p.nickname,
                    lives: p.lives
                }))
            };
            
            // ALWAYS notify server about game end, whether there's a winner or not
            if (this.websocket) {
                this.websocket.send('gameEnded', {
                    reason: winner ? 'playerWon' : 'timeExpired',
                    winnerId: winner ? winner.id : null,
                    players: result.players
                });
            }
        
            // Emit game end event - delay to allow animation to play
            setTimeout(() => {
                this.emit('gameEnd', result);
            }, winner ? 3000 : 0); // Add a delay only if there's a winner
        }
    
        playerDied(player) {
            // Update lives display
            const livesElement = document.getElementById(`lives-${player.id}`);
            if (livesElement) {
                livesElement.innerHTML = '';
                const isLocalPlayer = this.websocket && player.id === this.websocket.clientId;
                
                // Calculate font size based on scale factor
                const livesFontSize = Math.max(9, Math.round(10 * this.scaleFactor / 2));
                
                // Calculate head icon size (same as a tile)
                const headSize = Math.round(16 * this.scaleFactor);
                
                // Get sad face sprite position
                const headSprite = this.getHeadSpritePosition(0);
                
                // Create the player head icon with sad face
                const playerHeadIcon = new Element('div', {
                    class: 'player-head-icon',
                    style: {
                        width: `${headSize}px`,
                        height: `${headSize}px`,
                        backgroundImage: 'url(assets/bomberman.png)',
                        backgroundPosition: `-${headSprite.x * this.scaleFactor}px -${headSprite.y * this.scaleFactor}px`,
                        backgroundSize: `${320 * this.scaleFactor}px ${192 * this.scaleFactor}px`,
                        marginRight: `${Math.max(4, Math.round(8 * this.scaleFactor / 3))}px`,
                        filter: player.getPlayerFilter(player.playerIndex, this.baseHue),
                        imageRendering: 'pixelated',
                        flexShrink: 0
                    }
                });
                
                const nicknameElement = new Element('span', {
                    class: isLocalPlayer ? 'local-player' : '',
                    style: {
                        fontSize: `${livesFontSize}px`,
                        flex: 1,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis'
                    }
                }, [player.nickname]);
                
                const livesCountElement = new Element('span', {
                    style: {
                        fontSize: `${livesFontSize}px`,
                        whiteSpace: 'nowrap'
                    }
                }, [`0 ♥`]);
                
                // Append elements to player lives container
                livesElement.appendChild(playerHeadIcon.render());
                livesElement.appendChild(nicknameElement.render());
                livesElement.appendChild(livesCountElement.render());
            }
            
            // Delay the game over check to allow animation to complete
            setTimeout(() => {
                // Check for game over AFTER animation completes
                this.checkGameOver();
            }, 2000); // Slightly longer than the death animation (1800ms)
        }
    
        createBomb(player, tileX, tileY, bombId) {
            const bomb = new Bomb(this, player, tileX, tileY, bombId);
            this.bombs.push(bomb);
            this.container.render().appendChild(bomb.element.render());
            
            // Ensure z-index is set correctly
            bomb.element.setStyle({
                zIndex: '5'  // Lower than players (10)
            });
            
            console.log(`Bomb ${bombId} added to DOM at (${tileX},${tileY})`);
            return bomb;
        }
    
    removeBomb(bomb) {
        const index = this.bombs.indexOf(bomb);
        if (index !== -1) {
            this.bombs.splice(index, 1);
            bomb.element.domElement.remove(); // Remove from DOM
            console.log(`Bomb ${bomb.bombId} removed from DOM at (${bomb.tileX},${bomb.tileY})`);
        } else {
            console.warn(`Bomb ${bomb.bombId} not found in this.bombs`);
        }
    }
    
    createExplosion(tileX, tileY, type = 'center', direction = null, bombId) { 
        const explosion = new Explosion(this, tileX, tileY, type, direction, bombId);
        this.explosions.push(explosion);
        this.gameArea.render().appendChild(explosion.element.render()); // Use gameArea, not container
        return explosion;
    }
    
    removeExplosion(explosion) {
        const index = this.explosions.indexOf(explosion);
        if (index !== -1) {
            this.explosions.splice(index, 1);
        }
    }
    
    trySpawnPowerUp(tileX, tileY) {
        // 30% chance to spawn a power-up
        if (Math.random() < 0.3) {
            // Define power-up types with their respective probabilities
            const powerUpTypes = [
                { type: 'bomb', weight: 0.36 },   // 36% chance for bomb power-up
                { type: 'flame', weight: 0.36 },  // 36% chance for flame power-up
                { type: 'speed', weight: 0.28 }   // 28% chance for speed power-up (less common)
            ];
            
            // Calculate total weight
            const totalWeight = powerUpTypes.reduce((sum, item) => sum + item.weight, 0);
            
            // Generate a random value
            const random = Math.random() * totalWeight;
            
            // Determine which power-up to spawn based on weights
            let cumulativeWeight = 0;
            let selectedType = 'bomb'; // Default
            
            for (const item of powerUpTypes) {
                cumulativeWeight += item.weight;
                if (random <= cumulativeWeight) {
                    selectedType = item.type;
                    break;
                }
            }
            
            try {
                // Create the power-up instance
                const powerUp = new PowerUp(this, tileX, tileY, selectedType);
                
                // Add to game's power-ups list
                this.powerUps.push(powerUp);
                
                // Add to DOM
                this.container.render().appendChild(powerUp.element.render());
                
                console.log(`Power-up of type ${selectedType} spawned at (${tileX}, ${tileY})`);
                return powerUp;
            } catch (error) {
                console.error("Error spawning power-up:", error);
                return null;
            }
        }
        
        return null;
    }
    
    removePowerUp(powerUp) {
        const index = this.powerUps.indexOf(powerUp);
        if (index !== -1) {
            this.powerUps.splice(index, 1);
            console.log(`Power-up removed from game. ${this.powerUps.length} power-ups remaining.`);
        } else {
            console.warn(`Attempted to remove a power-up that wasn't in the game's power-ups list.`);
        }
    }
    
    initializeGameWithMap(serverMap) {
        const placeholder = document.getElementById('map-placeholder');
        if (placeholder) placeholder.remove();
        
        this.map = new GameMap(this); // No serverMap in constructor
        const mapContainer = this.map.initialize(serverMap); // Pass it here
        this.container.render().appendChild(mapContainer.render());
        
        this.initializePlayers();
        this.players.forEach(player => this.container.render().appendChild(player.element.render()));
    }
    cleanup() {
         // Reset and remove background element
        if (this.backgroundElement && this.backgroundElement.domElement) {
            this.backgroundElement.domElement.remove();
        }
        this.backgroundElement = null;
        
        // Also reset body background just to be safe
        document.body.style.backgroundImage = 'none';

        // Cancel any ongoing animations or timers
        this.isGameOver = true;
        
        // Remove event listeners
        this.inputManager = null;
        
        // Clean up WebSocket listeners
        if (this.websocket) {
            this.websocket.removeAllListeners();
        }
        
        if (this.stateCheckInterval) {
            clearInterval(this.stateCheckInterval);
            this.stateCheckInterval = null;
        }

        // Clear game objects
        this.players = [];
        this.bombs = [];
        this.explosions = [];
        this.powerUps = [];
        
        // Clean up chat-related references
        this.chatContainer = null;
        this.chatMessages = null;
        this.chatForm = null;
        this.chatInput = null;
        this.chatSendButton = null;
        this.smallUIMessage = null;

        console.log('Game instance cleaned up');
    }
}