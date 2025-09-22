import { Element } from './element.js';
import { WaitingRoom } from './waitingRoom.js';
import { Game } from './game.js';
import { WebSocketClient } from './websocket.js';
import { State } from './state.js';
import MiniFramework from '../miniframework/index.js';


class BombermanApp {
    constructor() {
        this.root = document.getElementById('root');
        if (!this.root) {
            console.error('Root element not found');
            return MiniFramework.createElement('li', {
            style: {
                padding: '0.5rem',
                marginBottom: '0.5rem',
                backgroundColor: '#444',
                borderRadius: '4px',
                display: 'flex',
                alignItems: 'center'
            }
        });
        }
         // Instantiate WebSocketClient
         //---comment out the next line to use the WebSocketClient
        
         try {
            this.websocket = new WebSocketClient();
            console.log('WebSocket initialized in app.js:', this.websocket);
        } catch (error) {
            console.error('Failed to initialize WebSocketClient:', error);
            this.root.innerHTML = '<p style="color: red">WebSocket initialization failed.</p>';
            return;
        }
        this.state = new State({ screen: 'waiting', players: [] });
        this.state.subscribe((newState) => this.handleStateChange(newState));
        
        // Preload game assets before showing waiting room
        this.preloadAssets().then(() => {
            console.log('Game assets preloaded successfully');
            this.showWaitingRoom();
        }).catch(error => {
            console.error('Error preloading assets:', error);
            // Continue anyway but log the error
            this.showWaitingRoom();
        });
    }
    
    
    handleStateChange(newState) {
        console.log('State changed:', newState);
        if (newState.screen === 'game') {
            if (!newState.gameData || !newState.gameData.map) {
                console.error('Game data missing or incomplete:', newState.gameData);
                return;
            }
            console.log('Game starting with data:', newState.gameData);
            this.startGame(newState.gameData);
        } else if (newState.screen === 'waiting') {
            this.showWaitingRoom();
        }
    }
    
    async preloadAssets() {
        // Display a loading message
        const loadingMessage = document.createElement('div');
        loadingMessage.id = 'loading-message';
        loadingMessage.style.position = 'absolute';
        loadingMessage.style.top = '50%';
        loadingMessage.style.left = '50%';
        loadingMessage.style.transform = 'translate(-50%, -50%)';
        loadingMessage.style.color = 'white';
        loadingMessage.style.fontSize = '24px';
        loadingMessage.textContent = 'Loading game assets...';
        this.root.appendChild(loadingMessage);
        
        try {
            // Use the preloadMedia method from Element class
            const assets = await Element.preloadMedia([
                { url: 'assets/bomberman.png', type: 'image' }
                // Add more assets here when you add them
            ]);
            
            // Store preloaded assets in a global or instance variable for later use
            window.preloadedAssets = assets;
            
            // Remove loading message
            loadingMessage.remove();
            
            return assets;
        } catch (error) {
            // Remove loading message even on error
            loadingMessage.remove();
            throw error;
        }
    }

    showWaitingRoom() {
        this.root.innerHTML = '';
        if (!this.websocket) {
            console.error('WebSocket not available in showWaitingRoom');
            this.root.innerHTML = '<p style="color: red">WebSocket not initialized.</p>';
            return;
        }
        console.log('Creating WaitingRoom with websocket:', this.websocket);
        // passes this websocket instance to WaitingRoom, which will use it to communicate with the server
        this.waitingRoom = new WaitingRoom(this.root, this.websocket);
        this.waitingRoom.on('gameStart', (gameData) => {
            this.state.setState({ screen: 'game', gameData });
        });
    }
    
    startGame(gameData) {
        // Clear the root element
        this.root.innerHTML = '';
    
        try {
            // Reset websocket event listeners to avoid duplicates
            if (this.websocket) {
                this.websocket.removeAllListeners();
            }
            
            this.game = new Game(this.root, gameData);
            console.log('Game instance created with map:', gameData.map);
    
            this.game.on('gameEnd', (result) => {
                console.log('Game ended with result:', result);
                this.showGameResult(result);
                setTimeout(() => {
                    // Clean up the game instance before switching states
                    if (this.game) {
                        this.game.cleanup();
                        this.game = null;
                    }
                    this.state.setState({ screen: 'waiting', players: [] });
                }, 5000);
            });
        } catch (error) {
            console.error('Failed to start game:', error);
            this.root.innerHTML = '<p style="color: red">Game initialization failed.</p>';
        }
    }
    
    showGameResult(result) {
        const resultContainer = new Element('div', {
            style: {
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                backgroundColor: 'rgba(0, 0, 0, 0.8)',
                color: 'white',
                padding: '2rem',
                borderRadius: '8px',
                textAlign: 'center',
                zIndex: '100'
            }
        });
        
        const resultTitle = new Element('h2', {
            style: { marginBottom: '1rem', fontSize: '2rem' }
        }, [result.winner ? `${result.winner.nickname} wins!` : 'Game Over!']);
        
        resultContainer.render().appendChild(resultTitle.render());
        
        if (result.players.length > 0) {
            const playerList = new Element('ul', { 
                style: { 
                    listStyle: 'none', 
                    padding: '0' 
                } 
            });
            
            // Use the same baseHue as in the game for consistent colors
            // Use the same baseHue as in the game for consistent colors
            const baseHue = this.game ? this.game.baseHue : Math.floor(Math.random() * 360);
            
            result.players.forEach((player, index) => {
                // Function to generate player filter based on index (same as in game.js)
                const getPlayerFilter = (playerIndex, baseHue) => {
                    const playerHue = (baseHue + (playerIndex * 90)) % 360;
                    let brightness = 1;
                    switch(playerIndex) {
                        case 0: brightness = 1; break;
                        case 1: brightness = 1.15; break;
                        case 2: brightness = 1.30; break;
                        case 3: brightness = 1.45; break;
                    }
                    return `hue-rotate(${playerHue}deg) brightness(${brightness})`;
                };
                
                // Create head icon
                const headIcon = new Element('div', {
                    style: {
                        width: '16px',
                        height: '16px',
                        backgroundImage: 'url(assets/bomberman.png)',
                        backgroundPosition: '-129px -101px',
                        backgroundSize: '320px 192px',
                        marginRight: '10px',
                        filter: getPlayerFilter(index, baseHue),
                        imageRendering: 'pixelated',
                        display: 'inline-block',
                        verticalAlign: 'middle'
                    }
                });
                
                const playerText = new Element('span', {
                    style: {
                        verticalAlign: 'middle'
                    }
                }, [`${player.nickname}: ${player.lives} lives left`]);
                
                const playerItem = new Element('li', {
                    style: { 
                        padding: '0.5rem', 
                        marginBottom: '0.5rem', 
                        backgroundColor: '#444', 
                        borderRadius: '4px',
                        display: 'flex',
                        alignItems: 'center'
                    }
                });
                
                playerItem.render().appendChild(headIcon.render());
                playerItem.render().appendChild(playerText.render());
                playerList.render().appendChild(playerItem.render());
            });
            resultContainer.render().appendChild(playerList.render());
        }
        
        this.root.appendChild(resultContainer.render());
    }
}

// Initialize the app when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM loaded, starting BombermanApp');
    new BombermanApp();
});