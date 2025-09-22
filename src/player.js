import { Element } from './element.js';

export class Player {
    constructor(game, playerData, spawnPosition) {
        this.game = game;
        this.id = playerData.id;
        this.nickname = playerData.nickname;
        this.isLocal = playerData.isLocal || false;
        this.playerIndex = playerData.playerIndex || 0; // Store player index
        this.baseHue = playerData.baseHue || 0; // Store base hue
        
        // Position and dimensions
        this.width = 16; // Player width in pixels
        this.height = 32; // Player height in pixels
        
        // Initialize both pixel and tile positions
        // First set initial tile position
        this.tileX = Math.floor(spawnPosition.x / this.game.map.tileSize);
        this.tileY = Math.floor(spawnPosition.y / this.game.map.tileSize);
        
        // Then get pixel position based on tile position
        const pixelPos = this.game.coords ? 
            this.game.coords.getPlayerSpritePosition(this.tileX, this.tileY) : 
            spawnPosition;
        
        this.x = pixelPos.x;
        this.y = pixelPos.y;
        
        // Game stats
        this.lives = 3;
        this.speed = 3; // Movement speed (tiles per second)
        this.bombCount = 1;
        this.bombPower = 1;
        
        // Movement state
        this.direction = 'down';  // Default direction, face is visible
        this.moving = false;
        this.lastMoveTime = 0;
        
        // Animation state
        this.animFrame = 0;
        this.animCounter = 0;
        
        // Bombs placed by this player
        this.activeBombs = [];
        
        this.lastDamageTime = 0;
        this.damageCooldown = 1000; // 1-second cooldown
        this.damagedByBombs = new Set(); // Track bomb IDs
        
        this.lastSentTime = 0;
        this.updateInterval = 17; // Send updates every 17ms
        this.lastSentState = null; // Store last sent state for comparison
        
        // Create player element
        this.element = this.createPlayerElement();
       
        console.log(`Player ${this.id} (${this.nickname}) initialized with speed=${this.speed}`);
        console.log(`Player ${this.id} initialized at tile (${this.tileX},${this.tileY}), pixel (${this.x},${this.y})`);
    }
    
    // Get combined filter with hue rotation
    getPlayerFilter(playerIndex, baseHue) {
        // Calculate the player's hue based on base hue and player index
        const playerHue = (baseHue + (playerIndex * 90)) % 360;
        
        return `hue-rotate(${playerHue}deg)`;
    }
    
    createPlayerElement() {
        // Start with row 6 (-96px) as the top of the 32px tall sprite
        const spriteRow = 96; // Row 6, since the sprite extends down to row 7
        
        let spriteX;
        switch (this.direction) {
            case 'up': spriteX = 0; break;
            case 'left': spriteX = -48; break;
            case 'right': spriteX = -144; break;
            case 'down': default: spriteX = -96; break;
        }
        
        // Get the combined filter with hue and brightness
        const filter = this.getPlayerFilter(this.playerIndex, this.baseHue);
        
        const element = new Element('div', {
            id: `player-${this.id}`,
            class: 'player',
            style: {
                left: `${this.x}px`,
                top: `${this.y}px`,
                width: `${this.width * this.game.scaleFactor}px`,
                height: `${this.height * this.game.scaleFactor}px`,
                backgroundImage: 'url(assets/bomberman.png)',
                backgroundPosition: `${spriteX}px -${spriteRow}px`, // Initial sprite based on direction
                backgroundSize: `${320 * this.game.scaleFactor}px ${192 * this.game.scaleFactor}px`,
                transform: 'translateZ(0)',
                zIndex: '10', // Ensure above tiles
                filter: filter
            }
        });
        
        console.log(`Player ${this.id} element created with filter: ${filter}`);
        return element;
    }
    
    update(deltaTime, input) {
        if (this.lives <= 0 || this.preventUpdates) return;
        
         // Check if chat input is focused
        const chatInput = document.getElementById('chat-input');
        if (chatInput && document.activeElement === chatInput) {
            this.lastKeyState = input.keyboard ? [...input.keyboard] : [];
            return; // Skip movement and bomb placement
        }
          
        // Track previous state for comparison
        const prevTileX = this.tileX;
        const prevTileY = this.tileY;
        const prevDirection = this.direction;
        const prevMoving = this.moving;
          
        // Handle bomb placement independently
        if (input.keyboard && input.keyboard.includes('Space') && this.activeBombs.length < this.bombCount) {
            if (!this.lastKeyState || !this.lastKeyState.includes('Space')) {
                this.placeBomb();
                console.log(`Player ${this.id} placed a bomb at tile (${this.tileX}, ${this.tileY})`);
            }
        }
        
        // Update movement if one movement key is pressed
        if (input && input.keyboard && input.keyboard.length === 1 && !input.keyboard.includes('Space')) {
            this.updateMovement(deltaTime, input);
        } else {
            // If no movement keys or multiple keys, stop moving
            this.moving = false;
        }
        
        // Send update if state changed
        if (
            this.tileX !== prevTileX ||
            this.tileY !== prevTileY ||
            this.direction !== prevDirection ||
            this.moving !== prevMoving
        ) {
            this.sendUpdate();
        }

        // Store last key state for debouncing
        this.lastKeyState = input.keyboard ? [...input.keyboard] : [];
        
        // Update animation
        this.updateAnimation(deltaTime);
    }
    
    updateMovement(deltaTime, input) {
        
        let newDirection = this.direction;
        this.moving = false;
        
        // Determine movement direction
        if (input.keyboard.includes('ArrowUp') || input.keyboard.includes('KeyW')) {
            newDirection = 'up';
            this.moving = true;
        } else if (input.keyboard.includes('ArrowDown') || input.keyboard.includes('KeyS')) {
            newDirection = 'down';
            this.moving = true;
        } else if (input.keyboard.includes('ArrowLeft') || input.keyboard.includes('KeyA')) {
            newDirection = 'left';
            this.moving = true;
        } else if (input.keyboard.includes('ArrowRight') || input.keyboard.includes('KeyD')) {
            newDirection = 'right';
            this.moving = true;
        }
        
        // Update direction whether we move or not
        this.direction = newDirection;
        
         // Handle movement timing
        this.lastMoveTime += deltaTime;
        const moveInterval = 1000 / this.speed;
        
        console.log(`Player ${this.id} updateMovement: speed=${this.speed}, moveInterval=${moveInterval}ms`);
        
        if (this.moving && this.lastMoveTime >= moveInterval) {
            this.lastMoveTime = 0;
            
            // Calculate new tile position based on direction
            let newTileX = this.tileX;
            let newTileY = this.tileY;
            
            switch (this.direction) {
                case 'up':
                    newTileY--;
                    break;
                case 'down':
                    newTileY++;
                    break;
                case 'left':
                    newTileX--;
                    break;
                case 'right':
                    newTileX++;
                    break;
            }
            
            // Check if the new tile is walkable
            if (this.isTileWalkable(newTileX, newTileY)) {
                this.tileX = newTileX;
                this.tileY = newTileY;
                
                const spritePos = this.game.coords.getPlayerSpritePosition(this.tileX, this.tileY);
                this.x = spritePos.x;
                this.y = spritePos.y;
                
                this.updatePosition();
                console.log(`Player ${this.id} moved to tile (${this.tileX},${this.tileY}), pixel (${this.x},${this.y}, speed=${this.speed}`);
            } else {
                console.log(`Player ${this.id} blocked at tile (${newTileX},${newTileY})`);
            }
        }
     
    }
    
    sendUpdate() {
        const now = Date.now();
        if (!this.isLocal || !this.game.websocket) return;

        // Updates become more frequent when moving (33ms vs 100ms)
        const updateInterval = this.moving ? 33 : 100;
        
        // Current player state
        const currentState = {
            id: this.id,
            tileX: this.tileX,
            tileY: this.tileY,
            direction: this.direction,
            moving: this.moving,
            lives: this.lives,
            speed: this.speed,
            timestamp: now
        };
        
        // Check if state has changed or enough time has passed
        const shouldSend = 
        this.lastPosition?.tileX !== this.tileX || 
        this.lastPosition?.tileY !== this.tileY ||
        now - this.lastSentTime >= 100; // Increase to reduce network traffic
    
        if (shouldSend) {
            this.game.websocket.send('playerUpdate', {
                id: this.id,
                tileX: this.tileX,
                tileY: this.tileY,
                direction: this.direction,
                moving: this.moving,
                lives: this.lives,
                speed: this.speed
            });
            this.lastSentTime = now;
            this.lastPosition = {tileX: this.tileX, tileY: this.tileY};
        }
    }
    
    updatePosition() {
        // Use scaled pixel position based on current tile coordinates
        const pos = this.game.coords.getPlayerSpritePosition(this.tileX, this.tileY);
        this.x = pos.x;
        this.y = pos.y;
        
        // Calculate transition duration based on player speed
        // As speed increases, transition time decreases
        const transitionDuration = 0.3 / (this.speed / 3);
        
        this.element.setStyle({
            left: `${this.x}px`,
            top: `${this.y}px`,
            transition: `left ${transitionDuration}s linear, top ${transitionDuration}s linear`
        });
    }
    
    isTileWalkable(tileX, tileY) {
        // Client-side estimate only - server has final say
        if (this.game.coords) {
            const tileType = this.game.map.getTileType(tileX, tileY);
            const bombAtTile = this.game.bombs.some(b => b.tileX === tileX && b.tileY === tileY);
            return tileType !== 'wall' && tileType !== 'block' && !bombAtTile;
        }
        return true; // Be optimistic, let server correct
    }
    
    resetAnimation() {
        // Clear any active animations
        this.element.domElement.style.animation = 'none';
        
        // Reset to normal walking sprite based on direction
        this.animFrame = 0;
        this.animCounter = 0;
        
        // Get sprite position based on current direction
        let spriteX, spriteY = 96; // Default sprite row
        
        switch (this.direction) {
            case 'up':
                spriteX = 0;
                break;
            case 'left':
                spriteX = -48;
                break;
            case 'right':
                spriteX = -144;
                break;
            case 'down':
            default:
                spriteX = -96;
                break;
        }
        
        // Apply the normal sprite position
        this.element.setStyle({
            display: 'block', // Make sure it's visible
            backgroundPosition: `${spriteX * this.game.scaleFactor}px -${spriteY * this.game.scaleFactor}px`,
            backgroundSize: `${320 * this.game.scaleFactor}px ${192 * this.game.scaleFactor}px`,
            filter: this.getPlayerFilter(this.playerIndex, this.game.baseHue)
        });
        
        // Re-enable transitions for smooth movement
        this.element.domElement.style.transition = 'left 0.15s linear, top 0.15s linear';
    }

    updateAnimation(deltaTime) {
        // Update animation frame
        if (this.moving) {
            const frameInterval = 1000 / (this.speed * 4); // Adjusted for 4-frame cycle
            this.animCounter += deltaTime;
            if (this.animCounter > frameInterval) {
                this.animCounter = 0;
                this.animFrame = (this.animFrame + 1) % 4; // Now cycles through 4 frames
                console.log(`Player ${this.id} animation frame=${this.animFrame}, speed=${this.speed}`);
            }
        } else {
            this.animFrame = 0; // Reset to standing position when not moving
        }
        
        // Set sprite based on direction and animation frame
        let spriteX, spriteY = 96; // Start at row 6 (-96px)
        
        // Convert 4-frame logical animation to 3-sprite physical frames
        // Frame sequence: 0 (left foot), 1 (in-between), 2 (right foot), 3 (in-between again)
        let spriteFrame;
        if (this.animFrame === 0) spriteFrame = 0; // Left foot
        else if (this.animFrame === 1) spriteFrame = 2; // In-between
        else if (this.animFrame === 2) spriteFrame = 1; // Right foot
        else spriteFrame = 2; // In-between again (reuse frame 2)
        
        switch (this.direction) {
            case 'up':
                spriteX = 0 - (16 * spriteFrame); // 0px, -16px, -32px (cols 0-2)
                break;
            case 'left':
                spriteX = -48 - (16 * spriteFrame); // -48px, -64px, -80px (cols 3-5)
                break;
            case 'right':
                spriteX = -144 - (16 * spriteFrame); // -144px, -160px, -176px (cols 9-11)
                break;
            case 'down':
            default:
                spriteX = -96 - (16 * spriteFrame); // -96px, -112px, -128px (cols 6-8)
                break;
        }
        
        // Apply scaled sprite position
        this.element.setStyle({
            backgroundPosition: `${spriteX * this.game.scaleFactor}px -${spriteY * this.game.scaleFactor}px`
        });
    }
    
    placeBomb() {
        if (this.activeBombs.length >= this.bombCount || this.lives <= 0) {
            console.log(`Cannot place bomb: activeBombs=${this.activeBombs.length}, bombCount=${this.bombCount}, lives=${this.lives}`);
            return;
        }
    
        const bombId = Date.now() + Math.random();
        if (this.game.websocket) {
            this.game.websocket.send('bombPlaced', {
                bombId,
                tileX: this.tileX,
                tileY: this.tileY,
                playerId: this.id
            });
            // Bomb creation handled by server broadcast
        }
    }
    
    takeDamage(bombId) {
        // Visual effects only - server controls actual life reduction
        if (this.lives <= 0) return;
        
        this.element.domElement.classList.add('player-hurt');
        setTimeout(() => {
            if (this.element && this.element.domElement) {
                this.element.domElement.classList.remove('player-hurt');
            }
        }, 1000);
    }
    
    die() {
        // Clear any existing animations or transitions
        this.element.domElement.style.transition = 'none';
        
        // Remove invulnerability animation when dying
        this.element.domElement.classList.remove('player-invulnerable');
        if (this.invulnerabilityTimer) {
            clearTimeout(this.invulnerabilityTimer);
        }
        
        // Set death animation properties
        const deathFrameCount = 9;
        const deathAnimationDuration = 1800; // 1.8 seconds total
        const scaleFactor = this.game.scaleFactor;
        
        // Create the CSS animation for death sequence
        const animationName = `player-death-${this.id}`;
        
        // Build keyframes definition
        let keyframes = `@keyframes ${animationName} {`;
        
        for (let i = 0; i < deathFrameCount; i++) {
            // Calculate start and end percentage for this frame
            const startPercent = (i / deathFrameCount) * 100;
            const endPercent = ((i + 1) / deathFrameCount) * 100 - 0.1;
            
            // Calculate X position for sprite - use more precise positioning
            const frameIndex = deathFrameCount - 1 - i; // Reverse order (9th to 1st)
            
            // Use exact pixel positions instead of scaling the original coordinates
            // This prevents rounding errors at larger scales
            const baseSpriteX = 0 + (frameIndex * 16);
            const baseSpriteY = 161;
            
            // Use Math.round for all scaled values to ensure pixel precision
            const spriteX = Math.round(-baseSpriteX * scaleFactor);
            const spriteY = Math.round(-baseSpriteY * scaleFactor);
            
            // Add keyframe ranges for start and end of this frame
            keyframes += `
                ${startPercent}% { 
                    background-position: ${spriteX}px ${spriteY}px; 
                }
                ${endPercent}% { 
                    background-position: ${spriteX}px ${spriteY}px; 
                }
            `;
        }
        
        keyframes += `}`;
        
        // Use game's helper to create the animation
        this.game.createAnimation(animationName, keyframes);
        
        // Apply the animation to the player element with precise sizing
        const backgroundSize = `${Math.round(320 * scaleFactor)}px ${Math.round(192 * scaleFactor)}px`;
        
        // Ensure player keeps its filter during death animation
        const currentFilter = this.getPlayerFilter(this.playerIndex, this.game.baseHue);
        
        this.element.setStyle({
            backgroundPosition: `${Math.round(-144 * scaleFactor)}px ${Math.round(-161 * scaleFactor)}px`, // Starting frame (9th frame)
            backgroundSize: backgroundSize,
            animation: `${animationName} ${deathAnimationDuration}ms forwards`,
            filter: currentFilter // Keep player color
        });
        
        // Directly modify the style to ensure the animation takes precedence
        this.element.domElement.style.animation = `${animationName} ${deathAnimationDuration}ms forwards`;
        
        console.log(`Player ${this.id} death animation started`);
        
        // Remove player after animation completes
        setTimeout(() => {
            // adding the player-dead class
            this.element.domElement.classList.add('player-dead');
            
            // Hide the element
            this.element.setStyle({
                display: 'none'
            });
            
            // Notify game of player death
            this.game.playerDied(this);
        }, deathAnimationDuration);
    }
    
    playVictoryAnimation() {
        // Clear any existing animations or transitions
        this.element.domElement.style.transition = 'none';
        
        // Set victory animation properties
        const victoryFrameCount = 8;
        const victoryAnimationDuration = 2000; // 2 seconds total
        const scaleFactor = this.game.scaleFactor;
        
        // Create the CSS animation for victory sequence
        const animationName = `player-victory-${this.id}`;
        
        // Build keyframes definition with explicit frames
        let keyframes = `@keyframes ${animationName} {`;
        
        for (let i = 0; i < victoryFrameCount; i++) {
            // Calculate start and end percentage for this frame
            const startPercent = (i / victoryFrameCount) * 100;
            const endPercent = ((i + 1) / victoryFrameCount) * 100 - 0.1;
            
            // Play frames from right to left (7 to 0) since they're stored in reverse
            const frameIndex = (victoryFrameCount - 1) - i; // Go from 7 down to 0
            
            // Use exact pixel positions instead of scaling the original coordinates
            const baseSpriteX = frameIndex * 16;
            const baseSpriteY = 128;
            
            // Use Math.round for all scaled values to ensure pixel precision
            const spriteX = Math.round(-baseSpriteX * scaleFactor);
            const spriteY = Math.round(-baseSpriteY * scaleFactor);
            
            // Add keyframe ranges for start and end of this frame
            keyframes += `
                ${startPercent}% { 
                    background-position: ${spriteX}px ${spriteY}px; 
                }
                ${endPercent}% { 
                    background-position: ${spriteX}px ${spriteY}px; 
                }
            `;
        }
        
        // Add a 100% keyframe to ensure we stay on the victory pose
        // Use precise pixel calculations for the final frame
        const finalSpriteX = Math.round(0 * scaleFactor);
        const finalSpriteY = Math.round(-128 * scaleFactor);
        
        keyframes += `
            100% { 
                background-position: ${finalSpriteX}px ${finalSpriteY}px; 
            }
        `;
        
        keyframes += `}`;
        
        // Use game's helper to create the animation
        this.game.createAnimation(animationName, keyframes);
        
        // Apply the animation to the player element and lock it in with precise sizing
        const backgroundSize = `${Math.round(320 * scaleFactor)}px ${Math.round(192 * scaleFactor)}px`;
        const initialSpriteX = Math.round(-112 * scaleFactor);
        const initialSpriteY = Math.round(-128 * scaleFactor);
        
        this.element.setStyle({
            backgroundPosition: `${initialSpriteX}px ${initialSpriteY}px`, // Starting frame with precise positioning
            backgroundSize: backgroundSize,
            animation: `${animationName} ${victoryAnimationDuration}ms forwards`, // 'forwards' to keep final state
            zIndex: 20 // Ensure it appears above other elements
        });
        
        console.log(`Player ${this.id} victory animation started with scaleFactor: ${scaleFactor}`);
        
        // Lock the animation state to prevent other code from modifying it
        this.isVictorious = true;
        this.preventUpdates = true; // Add this flag to prevent standard animation updates
        
        // Override the updateAnimation method while victorious to prevent changes
        const originalUpdateAnimation = this.updateAnimation;
        this.updateAnimation = () => {
            // Do nothing - freeze animation updates
            if (this.isVictorious) return;
            // If victory state somehow ends, restore original behavior
            this.updateAnimation = originalUpdateAnimation;
        };
    }

    addPowerUp(type) {
        console.log(`Player ${this.id} (${this.nickname}) collected ${type} power-up`);
        
        switch (type) {
            case 'bomb':
                // Increase bomb count - match server cap of 5
                this.bombCount = Math.min(this.bombCount + 1, 5); 
                console.log(`Bomb count increased to ${this.bombCount}`);
                break;
                
            case 'flame':
                // Increase explosion range - match server cap of 5
                this.bombPower = Math.min(this.bombPower + 1, 5); 
                console.log(`Bomb power increased to ${this.bombPower}`);
                break;
                
            case 'speed':
                // Match server speed increment of 0.75
                this.speed = Math.min(this.speed + 0.75, 8); 
                console.log(`Player ${this.id} speed power-up: ${oldSpeed} -> ${this.speed}`);
                if (this.isLocal) {
                    const speedText = new Element('div', {
                        style: {
                            position: 'absolute',
                            left: `${this.x}px`,
                            top: `${this.y - 30}px`,
                            color: '#00ff00',
                            fontSize: `${12 * this.game.scaleFactor}px`,
                            zIndex: '20',
                            animation: 'powerup-text 1s forwards'
                        }
                    }, [`Speed: ${this.speed}`]);
                    this.game.gameArea.render().appendChild(speedText.render());
                    setTimeout(() => speedText.domElement.remove(), 1000);
                }
                break;
            default:
                console.warn(`Unknown power-up type: ${type}`);
        }
    
        // If this is the local player, send update to server
        if (this.isLocal && this.game.websocket) {
            this.game.websocket.send('playerUpdate', {
                id: this.id,
                bombCount: this.bombCount,
                bombPower: this.bombPower,
                speed: this.speed
            });
        }
        
        const feedbackElement = new Element('div', {
            style: {
                position: 'absolute',
                left: `${this.x}px`,
                top: `${this.y - 20}px`,
                color: 'white',
                fontWeight: 'bold',
                fontSize: '16px',
                textShadow: '0 0 5px black',
                zIndex: 20,
                pointerEvents: 'none',
                animation: 'powerup-text 1s forwards'
            }
        }, [`+${type}`]);
        
        this.game.container.render().appendChild(feedbackElement.render());
        
        // Remove after animation
        setTimeout(() => {
            feedbackElement.domElement.remove();
        }, 1000);
    }
    
    updateScale(scaleFactor) {
        // Get the proper filter based on player data
        const filter = this.getPlayerFilter(this.playerIndex, this.game.baseHue);
        
        // detect if we're in a special animation state
        const hasDeathAnimation = this.element.domElement.style.animation && 
                             this.element.domElement.style.animation.includes('player-death');
        const hasVictoryAnimation = this.element.domElement.style.animation && 
                             this.element.domElement.style.animation.includes('player-victory');
    
        // Update basic dimensions in any case
        this.element.setStyle({
            width: `${this.width * scaleFactor}px`,
            height: `${this.height * scaleFactor}px`,
            backgroundSize: `${320 * scaleFactor}px ${192 * scaleFactor}px`,
            filter: filter
        });
    
        // Don't modify the animation if we're in death or victory animations
        if (hasDeathAnimation || hasVictoryAnimation) {
            // Just update scale-related styles without changing animation or position
            // The animation will continue from its current state
            console.log(`Preserving ${hasDeathAnimation ? 'death' : 'victory'} animation during resize`);
            return;
        }
        
        // For normal animation states, update sprite positions normally
        let spriteX, spriteY = 96;
        switch (this.direction) {
            case 'up':
                spriteX = 0 - (16 * this.animFrame);
                break;
            case 'left':
                spriteX = -48 - (16 * this.animFrame);
                break;
            case 'right':
                spriteX = -144 - (16 * this.animFrame);
                break;
            case 'down':
            default:
                spriteX = -96 - (16 * this.animFrame);
                break;
        }
    
        this.element.setStyle({
            backgroundPosition: `${spriteX * scaleFactor}px -${spriteY * scaleFactor}px`
        });
    
        // Reapply current position with new scale
        this.updatePosition();
    }
    
    // Return both pixel and tile positions
    getPosition() {
        return {
            x: this.x,
            y: this.y,
            tileX: this.tileX,
            tileY: this.tileY
        };
    }
}