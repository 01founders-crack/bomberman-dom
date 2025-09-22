import { Element } from './element.js';

export class GameMap {
    constructor(game, serverMap = null) {
        this.game = game;
        this.width = 15;
        this.height = 13;
        this.tileSize = 16; // Original tile size in pixels
        this.tileMap = serverMap || []; // 2D array representing the map
        this.mapContainer = null;
        this.tileElements = {}; // Store references to tile elements
    }
    
    initialize(serverMap = null) {
        // Create map container
        this.mapContainer = new Element('div', {
            id: 'map-container',
            style: {
                width: `${this.width * this.tileSize * this.game.scaleFactor}px`,
                height: `${this.height * this.tileSize * this.game.scaleFactor}px`,
                position: 'relative' // Changed from absolute to relative
            }
        });
        
        if (serverMap) {
            this.tileMap = serverMap;
            this.renderMap();
        } else {
            console.warn("No server map provided; waiting for server data.");
        }
        
        return this.mapContainer;
    }
    
    renderMap() {
        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {
                const tileType = this.tileMap[y][x];
                this.createTile(x, y, tileType); // Still needed here!
            }
        }
    }
    
    /* generateMap() { // Fallback for testing
        this.tileMap = [];
        
        for (let y = 0; y < this.height; y++) {
            const row = [];
            for (let x = 0; x < this.width; x++) {
                let tileType = 'empty';
                
                // Add border walls
                if (y === 0 || y === this.height - 1 || x === 0 || x === this.width - 1) {
                    tileType = 'wall';
                }
                // Add inner walls in a grid pattern
                else if (x % 2 === 0 && y % 2 === 0) {
                    tileType = 'wall';
                }
                // Add random destructible blocks
                else if (Math.random() < 0.4) {
                    tileType = 'block';
                }
                
                row.push(tileType);
                this.createTile(x, y, tileType); // Used here for fallback
            }
            this.tileMap.push(row);
        }
        
        // Ensure corners are empty for player spawns (and adjacent tiles)
        this.clearCornerAreas();
    } */
    
    createTile(x, y, type) {
        // Determine the background position based on tile type
        let bgX; 
        
        switch (type) {
            case 'wall':
                bgX = -112; // Indestructible wall (7th tile)
                break;
            case 'block':
                bgX = -128; // Destructible block (8th tile)
                break;
            case 'empty':
            default:
                bgX = -96; // Empty space (6th tile)
                break;
        }
        
        const scaledTileSize = Math.round(this.tileSize * this.game.scaleFactor);
        
        // Create tile element
        const tile = new Element('div', {
            id: `tile-${x}-${y}`,
            class: `tile ${type}`,
            style: {
                left: `${Math.round(x * scaledTileSize)}px`,
                top: `${Math.round(y * scaledTileSize)}px`,
                width: `${scaledTileSize}px`,
                height: `${scaledTileSize}px`,
                backgroundImage: 'url(assets/bomberman.png)',
                backgroundPosition: `${bgX * this.game.scaleFactor}px 0px`, // Use bgX
                backgroundSize: `${320 * this.game.scaleFactor}px ${192 * this.game.scaleFactor}px`,
                transform: 'translateZ(0)'
            }
        });
        
        this.mapContainer.render().appendChild(tile.render());
        this.tileElements[`${x}-${y}`] = tile;
    }
    
    clearCornerAreas() {
        // Define the corners
        const corners = [
            { x: 1, y: 1 }, // Top-left
            { x: this.width - 2, y: 1 }, // Top-right
            { x: 1, y: this.height - 2 }, // Bottom-left
            { x: this.width - 2, y: this.height - 2 } // Bottom-right
        ];
        
        // Clear each corner and adjacent tiles
        corners.forEach(corner => {
            // Clear center tile and adjacent tiles
            for (let dy = -1; dy <= 1; dy++) {
                for (let dx = -1; dx <= 1; dx++) {
                    const nx = corner.x + dx;
                    const ny = corner.y + dy;
                    
                    if (nx <= 0 || nx >= this.width - 1 || ny <= 0 || ny >= this.height - 1 ||
                        (nx % 2 === 0 && ny % 2 === 0)) {
                        continue;
                    }
                    
                    // Clear the tile
                    this.tileMap[ny][nx] = 'empty';
                    
                    // Update the tile element
                    const tile = this.tileElements[`${nx}-${ny}`];
                    if (tile) {
                        tile.setStyle({
                            backgroundPosition: `${-96 * this.game.scaleFactor}px 0px`
                        });
                    }
                }
            }
        });
    }
    
    getTileType(x, y) {
        // Return the type of tile at given coordinates
        if (x < 0 || x >= this.width || y < 0 || y >= this.height) {
            return null; // Out of bounds
        }
        return this.tileMap[y][x];
    }
    
    setTileType(x, y, type) {
        // Set the type of tile at given coordinates
        if (x < 0 || x >= this.width || y < 0 || y >= this.height) {
            return false; // Out of bounds
        }
        
        this.tileMap[y][x] = type;
        
        // Update the tile element
        const tile = this.tileElements[`${x}-${y}`];
        if (tile) {
            let bgX;
            
            switch (type) {
                case 'wall':
                    bgX = -112; 
                    break;
                case 'block':
                    bgX = -128; 
                    break;
                case 'empty':
                default:
                    bgX = -96; 
                    break;
            }
            
            tile.setStyle({
                backgroundPosition: `${bgX * this.game.scaleFactor}px 0px`
            });
        }
        
        return true;
    }
    
    updateMap(serverMap) {
        // New method to update the map when received from the server
        this.tileMap = serverMap;
        this.renderMap();
    }
    
    updateScale(scaleFactor) {
        const scaledTileSize = Math.round(this.tileSize * scaleFactor);
        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {
                const tile = this.tileElements[`${x}-${y}`];
                if (tile) {
                    // Get current tile type to determine background position
                    const tileType = this.tileMap[y][x];
                    let bgX;
                    
                    switch (tileType) {
                        case 'wall':
                            bgX = -112;
                            break;
                        case 'block':
                            bgX = -128;
                            break;
                        case 'empty':
                        default:
                            bgX = -96;
                            break;
                    }
                    
                    tile.setStyle({
                        left: `${Math.round(x * scaledTileSize)}px`,
                        top: `${Math.round(y * scaledTileSize)}px`,
                        width: `${scaledTileSize}px`,
                        height: `${scaledTileSize}px`,
                        backgroundSize: `${320 * scaleFactor}px ${192 * scaleFactor}px`,
                        backgroundPosition: `${bgX * scaleFactor}px 0px`
                    });
                }
            }
        }
        // Update container size
        this.mapContainer.setStyle({
            width: `${this.width * scaledTileSize}px`,
            height: `${this.height * scaledTileSize}px`
        });
    }
    
    // Converts pixel coordinates to tile coordinates
    pixelToTile(pixelX, pixelY) {
        return {
            x: Math.floor(pixelX / this.tileSize),
            y: Math.floor(pixelY / this.tileSize)
        };
    }
    
    // Converts tile coordinates to pixel coordinates (center of the tile)
    tileToPixel(tileX, tileY) {
        return {
            x: (tileX * this.tileSize + this.tileSize / 2) * this.game.scaleFactor,
            y: (tileY * this.tileSize + this.tileSize / 2) * this.game.scaleFactor
        };
    }
    
    // Check if a position (in pixels) is walkable
    isWalkable(pixelX, pixelY, width, height) {
        // Calculate the tile coordinates for all four corners
        const corners = [
            this.pixelToTile(pixelX, pixelY), // Top-left
            this.pixelToTile(pixelX + width - 1, pixelY), // Top-right
            this.pixelToTile(pixelX, pixelY + height - 1), // Bottom-left
            this.pixelToTile(pixelX + width - 1, pixelY + height - 1) // Bottom-right
        ];
        
        // Check if any corner is in a non-walkable tile
        for (const corner of corners) {
            const tileType = this.getTileType(corner.x, corner.y);
            if (tileType === 'wall' || tileType === 'block') {
                return false;
            }
        }
        
        return true;
    }
}