// coordinates.js - Unified coordinate system for consistent game element positioning
// This file provides translation functions between different coordinate systems
// and handles the scaling properly across different screen sizes

export class CoordinateSystem {
    constructor(game) {
        this.game = game;
        this.tileSize = 16; // Base tile size in pixels
        this.playerHeight = 32; // Player sprites are 32px tall (2 tiles)
    }

    // Get the current scale factor
    getScaleFactor() {
        return this.game.scaleFactor || 1;
    }

    // ====== TILE TO PIXEL CONVERSIONS ======

    // Convert tile coordinates to pixel position (top-left of tile)
    tileToPixel(tileX, tileY) {
        const scaleFactor = this.getScaleFactor();
        return {
            x: Math.round(tileX * this.tileSize * scaleFactor),
            y: Math.round(tileY * this.tileSize * scaleFactor)
        };
    }

    // Convert tile coordinates to pixel position (center of tile)
    tileToPixelCenter(tileX, tileY) {
        const scaleFactor = this.getScaleFactor();
        const tileSize = this.tileSize * scaleFactor;
        return {
            x: Math.round(tileX * tileSize + tileSize / 2),
            y: Math.round(tileY * tileSize + tileSize / 2)
        };
    }

    // ====== PIXEL TO TILE CONVERSIONS ======

    // Convert pixel position to tile coordinates
    pixelToTile(pixelX, pixelY) {
        const scaleFactor = this.getScaleFactor();
        return {
            x: Math.floor(pixelX / (this.tileSize * scaleFactor)),
            y: Math.floor(pixelY / (this.tileSize * scaleFactor))
        };
    }

    // ====== ENTITY POSITION HELPERS ======

    // Get position for a player sprite (centered horizontally, with feet at bottom of tile)
    getPlayerSpritePosition(tileX, tileY) {
        const scaleFactor = this.getScaleFactor();
        const tileSize = this.tileSize * scaleFactor;
        
        // Position player with feet at the bottom of the tile
        // X: center of tile, minus half the tile width
        // Y: bottom of tile, minus player height (32px)
        return {
            x: Math.round(tileX * tileSize),
            y: Math.round((tileY + 1) * tileSize - this.playerHeight * scaleFactor)
        };
    }

    // Get logical position for tile-based entities (bombs, explosions, power-ups)
    getTileEntityPosition(tileX, tileY) {
        const scaleFactor = this.getScaleFactor();
        const tileSize = this.tileSize * scaleFactor;
        
        // Position entity at top-left of tile
        return {
            x: Math.round(tileX * tileSize),
            y: Math.round(tileY * tileSize)
        };
    }

    // Convert player's visual position to the tile they're standing on
    getPlayerTilePosition(pixelX, pixelY) {
        const scaleFactor = this.getScaleFactor();
        
        // For the player, we use the feet position (bottom center of sprite)
        // The feet are at pixelY + playerHeight
        const feetY = pixelY + (this.playerHeight * scaleFactor);
        
        return {
            x: Math.floor((pixelX + (this.tileSize * scaleFactor / 2)) / (this.tileSize * scaleFactor)),
            y: Math.floor(feetY / (this.tileSize * scaleFactor))
        };
    }

    // ====== GRID & BOUNDS CHECKING ======

    // Check if a tile coordinate is within map bounds
    isValidTile(tileX, tileY) {
        return tileX >= 0 && tileX < this.game.map.width && 
               tileY >= 0 && tileY < this.game.map.height;
    }

    // Check if a tile is walkable
    isTileWalkable(tileX, tileY) {
        if (!this.isValidTile(tileX, tileY)) return false;
        
        const tileType = this.game.map.getTileType(tileX, tileY);
        return tileType !== 'wall' && tileType !== 'block';
    }
    
    // Get adjacent tiles in the four cardinal directions
    getAdjacentTiles(tileX, tileY) {
        return [
            { x: tileX, y: tileY - 1, direction: 'up' },
            { x: tileX + 1, y: tileY, direction: 'right' },
            { x: tileX, y: tileY + 1, direction: 'down' },
            { x: tileX - 1, y: tileY, direction: 'left' }
        ].filter(tile => this.isValidTile(tile.x, tile.y));
    }
}