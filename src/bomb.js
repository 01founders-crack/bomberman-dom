import { Element } from './element.js';

export class Bomb {
    constructor(game, player, tileX, tileY, bombId) { 
        this.game = game;
        this.player = player;
        this.tileX = tileX;
        this.tileY = tileY;
        this.bombId = bombId || Date.now() + Math.random();  // Use provided bombId or generate
        this.power = player.bombPower;
        this.timer = 3000; // 3 seconds until explosion
        this.planted = Date.now();
        
        // Add to player's active bombs
       // this.player.activeBombs.push(this);
        
        // Create bomb element
        this.element = this.createBombElement();

        console.log(`Bomb created at (${tileX},${tileY}) with power ${this.power}`);
    }
    
    createBombElement() {
        // Get position from coordinate system - use getTileEntityPosition
        const pixelPos = this.game.coords.getTileEntityPosition(this.tileX, this.tileY);
        const scaleFactor = this.game.scaleFactor;
        const tileSize = this.game.map.tileSize * scaleFactor;
        
        const bomb = this.game.createElement('div', {
            class: 'bomb bomb-pulse',
            style: {
                left: `${pixelPos.x}px`,
                top: `${pixelPos.y}px`,
                width: `${tileSize}px`,
                height: `${tileSize}px`,
                backgroundImage: 'url(assets/bomberman.png)',
                backgroundPosition: '0px 0px',
                backgroundSize: `${320 * scaleFactor}px ${192 * scaleFactor}px`,
                animation: `bomb-pulse 1s infinite`,
                zIndex: '4' // Make sure this is set to 5 (lower than players)
            }
        });
        
        // Dynamically set keyframes via JS
        const styleSheet = document.styleSheets[0];
        const keyframes = `
           @keyframes bomb-pulse {
                0% { background-position: 0px 0px; }
                24.9% { background-position: 0px 0px; }
                25% { background-position: ${-16 * scaleFactor}px 0px; }
                49.9% { background-position: ${-16 * scaleFactor}px 0px; }
                50% { background-position: ${-32 * scaleFactor}px 0px; }
                74.9% { background-position: ${-32 * scaleFactor}px 0px; }
                75% { background-position: ${-16 * scaleFactor}px 0px; }
                99.9% { background-position: ${-16 * scaleFactor}px 0px; }
                100% { background-position: 0px 0px; }
            }
        `;
        try {
            styleSheet.insertRule(keyframes, styleSheet.cssRules.length);
        } catch (e) {
            console.log('Keyframe already exists or CSS injection failed');
        }
        return bomb;
    }
    
    update(deltaTime) {
        // If client-owned bomb, check for explosion
        if (this.player.isLocal) {
            // Check if it's time to explode
            if (Date.now() - this.planted >= this.timer) {
                this.explode();
            }
        }
        // For remote bombs, just wait for server message
    }
    
    explode() {
        if (this.game.websocket) {
            this.game.websocket.send('bombExploded', {
                bombId: this.bombId,
                tileX: this.tileX,
                tileY: this.tileY,
                power: this.power,
                playerId: this.player.id
            });
            // Removal handled by explosionCreated from server
        }
    }
    // Remove createExplosions and createDirectionalExplosions since server handles it
    // These will be triggered by server updates instead
    
    updateScale(scaleFactor) {
        // Get position from coordinate system
        const pixelPos = this.game.coords.getTileEntityPosition(this.tileX, this.tileY); // Fixed
        const scaledTileSize = this.game.map.tileSize * scaleFactor;
        
        this.element.setStyle({
            left: `${pixelPos.x}px`,
            top: `${pixelPos.y}px`,
            width: `${scaledTileSize}px`,
            height: `${scaledTileSize}px`,
            backgroundSize: `${320 * scaleFactor}px ${192 * scaleFactor}px`
        });
    }
}

export class Explosion {
    constructor(game, tileX, tileY, type = 'center', direction = null, bombId) {
        this.game = game;
        this.tileX = tileX;
        this.tileY = tileY;
        this.type = type;         // 'center', 'extension', or 'end'
        this.direction = direction; // 'up', 'right', 'down', 'left', or null for center
        this.bombId = bombId; // Link to bomb
        this.duration = 1000; // 1 second explosion duration
        this.created = Date.now();
        
        // Create explosion element
        this.element = this.createExplosionElement();
    }
    
    createExplosionElement() {
        // Get position from coordinate system - use getTileEntityPosition
        const pixelPos = this.game.coords.getTileEntityPosition(this.tileX, this.tileY);
        const scaleFactor = this.game.scaleFactor;
        const tileSize = this.game.map.tileSize * scaleFactor;
        
        // Determine sprite position based on explosion type and direction
        const spritePos = this.getExplosionSpritePosition();
        
        // Log the explosion creation for debugging
        console.log(`Creating explosion ${this.type} ${this.direction || 'center'} at tile (${this.tileX},${this.tileY}) with sprite: ${spritePos.x}px ${spritePos.y}px`);
        
        return this.game.createElement('div', {
            class: `explosion explosion-${this.type} explosion-${this.direction || 'center'}`,
            style: {
                left: `${pixelPos.x}px`,
                top: `${pixelPos.y}px`,
                width: `${tileSize}px`,
                height: `${tileSize}px`,
                backgroundImage: 'url(assets/bomberman.png)',
                backgroundPosition: `${spritePos.x * scaleFactor}px ${spritePos.y * scaleFactor}px`,
                backgroundSize: `${320 * scaleFactor}px ${192 * scaleFactor}px`,
                transform: 'translateZ(0)',
                animation: 'explosion-fade 1s forwards'
            }
        });
    }
    
    getExplosionSpritePosition() {
        // Map the explosion sprites to the correct positions in the sprite sheet
        // Based on the provided sprite positions
        let x, y;
        
        switch (this.type) {
            case 'center':
                x = -32; // 3rd column
                y = -48; // 4th row
                break;
            case 'end':
                switch (this.direction) {
                    case 'left':
                        x = 0;   // 1st column
                        y = -48; // 4th row
                        break;
                    case 'up':
                        x = -32; // 3rd column
                        y = -16; // 2nd row
                        break;
                    case 'right':
                        x = -64; // 5th column
                        y = -48; // 4th row
                        break;
                    case 'down':
                        x = -32; // 3rd column
                        y = -80; // 6th row
                        break;
                    default:
                        x = -32; // Default to center
                        y = -48;
                        break;
                }
                break;
            case 'extension':
                switch (this.direction) {
                    case 'left':
                    case 'right':
                        x = this.direction === 'left' ? -16 : -48; // 2nd or 4th column
                        y = -48; // 4th row
                        break;
                    case 'up':
                    case 'down':
                        x = -32; // 3rd column
                        y = this.direction === 'up' ? -32 : -64; // 3rd or 5th row
                        break;
                    default:
                        x = -32; // Default to center
                        y = -48;
                        break;
                }
                break;
            default:
                x = -32; // Default to center
                y = -48;
                break;
        }
        
        return { x, y };
    }
    
    update(deltaTime) {
        // Check if explosion should disappear
        if (Date.now() - this.created >= this.duration) {
            this.remove();
        }
    }
    
    remove() {
        // Remove explosion element
        this.element.domElement.remove();
        
        // Remove from game's explosions list
        this.game.removeExplosion(this);
    }
    
    updateScale(scaleFactor) {
        // Get position from coordinate system
        const pixelPos = this.game.coords.getTileEntityPosition(this.tileX, this.tileY);
        const scaledTileSize = this.game.map.tileSize * scaleFactor;
        
        // Get sprite position
        const spritePos = this.getExplosionSpritePosition();
        
        this.element.setStyle({
            left: `${pixelPos.x}px`,
            top: `${pixelPos.y}px`,
            width: `${scaledTileSize}px`,
            height: `${scaledTileSize}px`,
            backgroundSize: `${320 * scaleFactor}px ${192 * scaleFactor}px`,
        });
    }
}

export class PowerUp {
    constructor(game, tileX, tileY, type) {
        this.game = game;
        this.tileX = tileX;
        this.tileY = tileY;
        this.type = type; // 'bomb', 'flame', or 'speed'
        
        // Create power-up element
        this.element = this.createPowerUpElement();
    }
    
    createPowerUpElement() {
        // Get position from coordinate system - use getTileEntityPosition
        const pixelPos = this.game.coords.getTileEntityPosition(this.tileX, this.tileY);
        const scaleFactor = this.game.scaleFactor;
        const tileSize = this.game.map.tileSize * scaleFactor;
        
        // Determine sprite position based on type
        const spritePos = this.getPowerUpSpritePosition();
        
        return this.game.createElement('div', {
            class: `powerup powerup-${this.type}`,
            style: {
                left: `${pixelPos.x}px`,
                top: `${pixelPos.y}px`,
                width: `${tileSize}px`,
                height: `${tileSize}px`,
                backgroundImage: 'url(assets/bomberman.png)',
                backgroundPosition: `${spritePos.x * scaleFactor}px ${spritePos.y * scaleFactor}px`,
                backgroundSize: `${320 * scaleFactor}px ${192 * scaleFactor}px`
            }
        });
    }
    
    getPowerUpSpritePosition() {
        let x, y = 0;
        
        switch (this.type) {
            case 'flame':
                x = -48; // 4th tile - flame
                break;
            case 'bomb':
                x = -64; // 5th tile - bomb
                break;
            case 'speed':
                x = -80; // 6th tile - speed
                break;
            default:
                x = -64; // Default to bomb if type is invalid
                break;
        }
        
        return { x, y };
    }
    
    update(deltaTime) {
        // ONLY check collision for local player
        const localPlayer = this.game.players.find(player => player.isLocal);
        if (!localPlayer || localPlayer.lives <= 0) return;
        
        // Only detect collisions, don't modify stats locally
        if (localPlayer.tileX === this.tileX && localPlayer.tileY === this.tileY) {
            console.log(`Power-up collision detected at (${this.tileX},${this.tileY})`);
            this.collect(localPlayer);
        }
    }
    
    // And in PowerUp.collect:
    collect(player) {
        // Only notify server, don't apply effects locally
        if (player.isLocal && this.game.websocket) {
            console.log(`Sending powerUpCollected to server`);
            this.game.websocket.send('powerUpCollected', {
                tileX: this.tileX,
                tileY: this.tileY,
                type: this.type
            });
        }
        
        // Remove power-up visually
        this.element.domElement.remove();
        this.game.removePowerUp(this);
    }
    
    updateScale(scaleFactor) {
        // Get position from coordinate system
        const pixelPos = this.game.coords.getTileEntityPosition(this.tileX, this.tileY);
        const tileSize = this.game.map.tileSize * scaleFactor;
        
        // Get sprite position
        const spritePos = this.getPowerUpSpritePosition();
        
        this.element.setStyle({
            left: `${pixelPos.x}px`,
            top: `${pixelPos.y}px`,
            width: `${tileSize}px`,
            height: `${tileSize}px`,
            backgroundPosition: `${spritePos.x * scaleFactor}px ${spritePos.y * scaleFactor}px`,
            backgroundSize: `${320 * scaleFactor}px ${192 * scaleFactor}px`
        });
    }
}