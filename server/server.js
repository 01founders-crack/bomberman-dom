const http = require("http");
const express = require("express");
const app = express();
const websocketServer = require("websocket").server;
const httpServer = http.createServer(app);
const os = require("os"); // to get network interfaces
const path = require('path');

app.use(express.static(path.join(__dirname, '../')));
app.get("/", (req, res) => res.sendFile(path.join(__dirname, '../index.html')));

// Function to get the local IP address
function getLocalIp() {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            // Look for IPv4, non-internal (not 127.0.0.1) addresses
            if (iface.family === 'IPv4' && !iface.internal) {
                // Prioritize Wi-Fi (wlp2s0) over Ethernet (enp1s0) if both exist
                if (name === 'wlp2s0' || name.startsWith('wlan') || name.startsWith('wi')) {
                    return iface.address;
                }
                return iface.address; // Fallback to first valid IP
            }
        }
    }
    return 'localhost'; // Default if no IP found (unlikely)
}

// Start the server and log the dynamic IP
//-
const PORT = 9090;
httpServer.listen(PORT, '0.0.0.0', () => {
    const ip = getLocalIp();
    console.log(`Listening on  http://localhost:${PORT} or http://${ip}:${PORT}`);
});

const clients = {};
const games = {};

const wsServer = new websocketServer({
    "httpServer": httpServer
});

// Generate a unique identifier for each client
function guid() {
    function S4() {
        return (((1 + Math.random()) * 0x10000) | 0).toString(16).substring(1);
    }
    return (S4() + S4() + "-" + S4() + "-4" + S4().substr(0, 3) + "-" + S4() + "-" + S4() + S4() + S4()).toLowerCase();
}

function broadcast(clientsToSend, method, data) { // Add clientsToSend as a parameter
    clientsToSend.forEach(client => {
        if (client && client.connection) {
            client.connection.send(JSON.stringify({ method, data }));
        } else {
            console.warn(`Client ${client?.id} has no valid connection`);
            if (client?.id && !client.connection) delete clients[client.id];
        }
    });
}

function handleJoinGame(connection, data) {
    console.log("handleJoinGame called with data:", data);

    // Find the client ID associated with this connection
    const clientId = Object.keys(clients).find(id => clients[id].connection === connection);
    if (!clientId) {
        console.warn("No client found for this connection");
        return;
    }

    if (Object.keys(games).length > 0) {
        const activeGameId = Object.keys(games)[0];
        const game = games[activeGameId];
        if (game.started || game.players.length >= 4) {
            connection.send(JSON.stringify({ 
                method: "error", 
                data: { message: "A game is already in progress or full. Please wait until it finishes." } 
            }));
            return;
        }

        // Update existing client with player data
        const player = clients[clientId];
        player.nickname = data.player.nickname;
        player.lives = 3;
        player.bombCount = 1;
        player.bombPower = 1;
        player.speed = 3;
        player.activeBombs = 0;

        game.players.push(player);

        const playersForBroadcast = game.players.map(p => ({
            id: p.id,
            nickname: p.nickname,
            lives: p.lives,
            speed: p.speed
        }));
        const clientsToSend = game.players.map(p => clients[p.id]);
        broadcast(clientsToSend, "updatePlayers", { players: playersForBroadcast });

        if (game.countdown) {
            broadcast([clients[player.id]], "countdownUpdate", {
                remaining: game.countdown.remaining,
                phase: game.countdown.phase
            });
        }

        if (game.players.length === 2 && !game.countdown) {
            game.countdown = { remaining: 20, phase: "waiting" }; // for testing change from 20 to lower
            broadcastCountdown(game);
        } else if (game.players.length === 4) {
            if (game.countdown) {
                clearInterval(game.countdown.interval);
            }
            game.countdown = { remaining: 10, phase: "starting" }; // for testing change from 10 to lower
            broadcastCountdown(game);
        }
        return;
    }

    // Create a new game if no active game exists
    const gameId = guid();
    games[gameId] = {
        id: gameId,
        players: [],
        state: {},
        countdown: null,
        started: false,
        baseHue: Math.floor(Math.random() * 360)
    };
    const game = games[gameId];

    // Update the existing client with player data
    const player = clients[clientId]; 
    player.nickname = data.player.nickname;
    player.lives = 3;
    player.bombs = 1;
    player.range = 1;
    player.speed = 3;

    game.players.push(player);

    const playersForBroadcast = game.players.map(p => ({
        id: p.id,
        nickname: p.nickname,
        lives: p.lives
    }));
    const clientsToSend = game.players.map(p => clients[p.id]);
    broadcast(clientsToSend, "updatePlayers", { players: playersForBroadcast });

    // Send a static "Waiting" message to the first player
    if (game.players.length === 1) {
        broadcast([clients[player.id]], "countdownUpdate", { 
            remaining: null, 
            phase: "waiting" 
        });
    }
}

function broadcastCountdown(game) {
    const clientsToSend = game.players.map(p => clients[p.id]);
    broadcast(clientsToSend, "countdownUpdate", { 
        remaining: game.countdown.remaining, 
        phase: game.countdown.phase 
    });

    game.countdown.interval = setInterval(() => {
        game.countdown.remaining--;
        const updatedClientsToSend = game.players.map(p => clients[p.id]); // Update every tick
        if (game.countdown.remaining <= 0) {
            clearInterval(game.countdown.interval);
            if (game.countdown.phase === "waiting" && game.players.length < 4) {
                game.countdown = { remaining: 10, phase: "starting" }; // for testing change from 10 to lower
                broadcastCountdown(game);
            } else {
                startGame(game);
            }
        } else {
            broadcast(updatedClientsToSend, "countdownUpdate", { 
                remaining: game.countdown.remaining, 
                phase: game.countdown.phase 
            });
        }
    }, 1000);
}

function generateMap() {
    const width = 15;
    const height = 13;
    const tileMap = [];

    for (let y = 0; y < height; y++) {
        const row = [];
        for (let x = 0; x < width; x++) {
            let tileType = 'empty';
            if (y === 0 || y === height - 1 || x === 0 || x === width - 1) {
                tileType = 'wall';
            } else if (x % 2 === 0 && y % 2 === 0) {
                tileType = 'wall';
            } else if (Math.random() < 0.4) {
                tileType = 'block';
            }
            row.push(tileType);
        }
        tileMap.push(row);
    }

    const corners = [
        { x: 1, y: 1 },
        { x: width - 2, y: 1 },
        { x: 1, y: height - 2 },
        { x: width - 2, y: height - 2 }
    ];
    corners.forEach(corner => {
        for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
                const nx = corner.x + dx;
                const ny = corner.y + dy;
                if (nx <= 0 || nx >= width - 1 || ny <= 0 || ny >= height - 1 || (nx % 2 === 0 && ny % 2 === 0)) {
                    continue;
                }
                tileMap[ny][nx] = 'empty';
            }
        }
    });

    return tileMap;
}

function startGame(game) { // Start the game with the given game object
    game.started = true; // Set game as started
    
    game.state.map = generateMap(); // Map generated here
    
    game.state.bombs = []; // Initialize bombs array here
    
    const spawnPositions = [ //
        { tileX: 1, tileY: 1 },
        { tileX: 13, tileY: 1 },
        { tileX: 1, tileY: 11 },
        { tileX: 13, tileY: 11 }
    ];
    
    game.players.forEach(player => resetPlayerStats(player)); // Reset player stats before starting the game

    const playersForBroadcast = game.players.map((player, index) => {
        const spawn = spawnPositions[index % spawnPositions.length];
        player.tileX = spawn.tileX;
        player.tileY = spawn.tileY;
        player.direction = 'down'; // Default direction
        player.moving = false; // Reset moving state
        player.activeBombs = 0; // Track active bombs per player
        player.bombCount = 1;   // Max bombs (matches client)
        player.bombPower = 1;   // Bomb range (matches client)
        return {
            id: player.id,
            nickname: player.nickname,
            lives: player.lives,
            tileX: player.tileX,
            tileY: player.tileY,
            direction: player.direction,
            moving: player.moving,
            speed: player.speed
        };
    });
    
    // Generate clientsToSend array using player ids.
    const clientsToSend = game.players.map(player => clients[player.id]);
    // console.log("Broadcasting gameStarted to:", clientsToSend.map(c => c.id));
    // console.log("Players for broadcast:", playersForBroadcast);
    broadcast(clientsToSend, "gameStarted", { 
        players: playersForBroadcast,
        map: game.state.map,
        baseHue: game.baseHue // Sent to all clients
    });
    // console.log("Game started with map:", game.state.map);
    // console.log("--- end startGame ---\n");
}

function resetPlayerStats(player) {
    player.lives = 3;
    player.bombCount = 1;
    player.bombPower = 1;
    player.speed = 3;
    player.activeBombs = 0;
    console.log(`Player ${player.id} initialized with speed=${player.speed}`);
}

function handleDisconnect(clientId) {
    // debug print
  /*   console.log(`Client ${clientId} disconnected`);
    console.log("Clients before disconnect:", Object.keys(clients)); */
    const gameId = Object.keys(games).find(id => games[id].players.some(p => p.id === clientId));
    if (gameId) {
        const game = games[gameId];
        const oldPlayerCount = game.players.length;
        game.players = game.players.filter(p => p.id !== clientId);

        if (game.players.length === 0) {
            delete games[gameId];
            // debug print
          /*   console.log(`Game ${gameId} deleted (no players remaining)`);
            console.log("Games after deletion:", Object.keys(games)); */
        } else {
            const playersForBroadcast = game.players.map(p => ({
                id: p.id,
                nickname: p.nickname,
                lives: p.lives
            }));
            const clientsToSend = game.players.map(p => clients[p.id]);
            broadcast(clientsToSend, "updatePlayers", { players: playersForBroadcast });

            if (!game.started && game.countdown) {
                if (game.players.length < 2) {
                    clearInterval(game.countdown.interval);
                    game.countdown = null;
                    broadcast(clientsToSend, "countdownUpdate", { remaining: 0, phase: "waiting" });
                } else if (game.players.length === 2 && oldPlayerCount === 3) {
                    clearInterval(game.countdown.interval);
                    game.countdown = { remaining: 20, phase: "waiting" };
                    broadcastCountdown(game);
                }
            }
        }
    }
    delete clients[clientId];
    // debug print
    // console.log("Clients after disconnect:", Object.keys(clients));
}

// Handle incoming connections
wsServer.on("request", request => {
    const connection = request.accept(null, request.origin);
    const clientId = guid();
    clients[clientId] = { connection, id: clientId };
    console.log(`Client ${clientId} connected. Total clients:`, Object.keys(clients));
    
    // Send the client ID back to the client immediately after connection
    connection.send(JSON.stringify({
        method: "clientId",
        data: { clientId }
    }));

    connection.on("close", () => {
        //console.log(`Client ${clientId} disconnected`);
        handleDisconnect(clientId);
    });

    connection.on("message", message => {
        const result = JSON.parse(message.utf8Data);
        // debug print, print detail in each functions.
        //console.log(`Received message from ${clientId}:`, result);

        switch (result.method) {
            case "joinGame":
                handleJoinGame(connection, result.data);
                break;
            case "playerUpdate":
                handlePlayerUpdate(clientId, result.data);
                break;
            case "bombPlaced":
                handleBombPlaced(clientId, result.data);
                break;
            case "bombExploded": // Added case
                handleBombExploded(clientId, result.data);
                break;
            case "powerUpCollected":
                handlePowerUpCollected(clientId, result.data);
                break;    
            case "chatMessage":
                handleChatMessage(clientId, result.data);
                break;
            case "verifyGameOver":
                handleVerifyGameOver(clientId, result.data);
                break;
            case "gameEnded":
                handleGameEnded(clientId, result.data);
                break;            
            case "getClientId": // Add this case
                connection.send(JSON.stringify({
                    method: "clientId",
                    data: { clientId }
                }));
            break;    
            default:
                console.warn(`Unhandled method: ${result.method}`);
        }
    });
});

function handlePlayerUpdate(clientId, data) {
    console.log(`Received playerUpdate from ${clientId}: tile=(${data.tileX},${data.tileY}), speed=${data.speed}`);
    // Find the game this client is in
    const gameId = Object.keys(games).find(id => 
        games[id].players.some(p => p.id === clientId)
    );
    
    if (!gameId) {
        console.warn(`No game found for client ${clientId}`);
        return;
    }
    
    const game = games[gameId];
    console.log(`Found game ${gameId} with players:`, game.players.map(p => p.id));
    
    // Update player data
    const playerIndex = game.players.findIndex(p => p.id === clientId);
    if (playerIndex === -1) {
        console.warn(`Player ${clientId} not found in game ${gameId}`);
        return;
    }
    
    const player = game.players[playerIndex];
    
    // Ensure data.tileX and data.tileY are valid numbers
    const newTileX = Number(data.tileX);
    const newTileY = Number(data.tileY);
    
    if (isNaN(newTileX) || isNaN(newTileY)) {
        console.error(`Invalid tile coordinates from ${clientId}: tileX=${data.tileX}, tileY=${data.tileY}`);
        if (typeof data.lives !== 'undefined') {
            // For safety, only allow life reduction if:
            // 1. It's a force update (triggered by explosion)
            // 2. The new lives value is less than current (no cheating to gain lives)
            // 3. The difference is exactly 1 (prevent multiple life loss in one hit)
            if (data.forceUpdate && data.lives < player.lives && player.lives - data.lives === 1) {
                console.log(`Player ${clientId} life reduced from ${player.lives} to ${data.lives} (server validated)`);
                player.lives = data.lives;
            } else {
                // If client tries to update lives without validation, ignore the lives update
                // but still process the position update
                console.log(`Player ${clientId} life update rejected: ${player.lives} to ${data.lives}`);
                
                // Send correction back to all clients with server's authoritative value
                broadcastUpdate(game, clientId, player);
                return; // Skip further processing
            }
        }
        return;
    }
    
    // Update speed if provided
    if (typeof data.speed !== 'undefined') {
        player.speed = data.speed;
        console.log(`Updated player ${clientId} speed to ${player.speed}`);
    }
    
    if (typeof data.lives !== 'undefined') {
        player.lives = data.lives;
    }
    
    if (data.forceUpdate || isValidMove(game, player, newTileX, newTileY)) {
        player.tileX = newTileX;
        player.tileY = newTileY;
        player.direction = data.direction;
        player.moving = data.moving;
        broadcastUpdate(game, clientId, player);
        console.log(`Player ${clientId} moved to (${newTileX},${newTileY}), speed=${player.speed}`);
    } else if (data.forceUpdate) {
        broadcastUpdate(game, clientId, player);
    } else {
        console.log(`Invalid move for player ${clientId} to (${newTileX},${newTileY})`);
        if (typeof data.lives !== 'undefined') {
            broadcastUpdate(game, clientId, player);
        }
    }
}


function isValidMove(game, player, newTileX, newTileY) {
    if (!game.state || !game.state.map || !Array.isArray(game.state.map) || !game.state.map.length) {
        console.error(`Invalid game state or map for game ${game.id}`);
        return false;
    }

    const dx = Math.abs(newTileX - player.tileX);
    const dy = Math.abs(newTileY - player.tileY);
    if (dx > 1 || dy > 1 || (dx + dy) > 1) {
        console.log(`Move too large: dx=${dx}, dy=${dy}`);
        return false;
    }

    if (newTileX < 0 || newTileX >= game.state.map[0].length || 
        newTileY < 0 || newTileY >= game.state.map.length || 
        !Array.isArray(game.state.map[newTileY])) {
        console.log(`Out of bounds: newTileX=${newTileX}, newTileY=${newTileY}, map=${game.state.map.length}x${game.state.map[0].length}`);
        return false;
    }

    const tileType = game.state.map[newTileY][newTileX];
    const bombAtTile = game.state.bombs.some(b => b.tileX === newTileX && b.tileY === newTileY);
    return tileType !== 'wall' && tileType !== 'block' && !bombAtTile;
}

function handleBombPlaced(clientId, data) {
    // Find the game this client is in
    const gameId = Object.keys(games).find(id => 
        games[id].players.some(p => p.id === clientId)
    );
    
    if (!gameId) return;
    
    const game = games[gameId];
    
    const player = game.players.find(p => p.id === clientId);
    if (!player || player.activeBombs >= player.bombCount) {
        console.warn(`Bomb placement rejected for ${clientId}: activeBombs=${player?.activeBombs}, bombCount=${player?.bombCount}`);
        if (clients[clientId]) { // Added rejection feedback
            clients[clientId].connection.send(JSON.stringify({
                method: "bombRejected",
                data: { reason: "Max bombs reached" }
            }));
        }
        return;
    }
    
    // Create bomb data with player ID
    const bomb = {
        id: data.bombId,
        tileX: data.tileX,
        tileY: data.tileY,
        power: player.bombPower,
        ownerId: clientId,
        planted: Date.now(),
        timer: 3000
    };
    
    game.state.bombs.push(bomb);
    player.activeBombs++;
    
    // Broadcast to all players except the one who placed it
    const clientsToSend = game.players.map(p => clients[p.id]).filter(c => c);
    console.log(`Broadcasting bombPlaced to clients:`, clientsToSend.map(c => c.id));
    broadcast(clientsToSend, "bombPlaced", {
        bombId: bomb.id,
        tileX: bomb.tileX,
        tileY: bomb.tileY,
        playerId: clientId
    });
}

function checkExplosionCollisions(game) {
    // Skip if game not started or no players
    if (!game.started || !game.players || game.players.length === 0) return;
    
    // Get all active explosions (stored when created)
    const activeExplosions = game.activeExplosions || [];
    if (activeExplosions.length === 0) return;
    
    const now = Date.now();
    
        if (game.lastExplosionCheck && now - game.lastExplosionCheck < 50) {
        // debug print
        // console.log(`Skipping duplicate explosion check (${now - game.lastExplosionCheck}ms since last check)`);
        return;
    }
    
    // Record this check to prevent duplicates
    game.lastExplosionCheck = now;
    
    // Check each player against each explosion
    game.players.forEach(player => {
        // Skip dead players
        if (player.lives <= 0) return;
        
        // Initialize tracking properties if they don't exist
        if (!player.lastHitTime) player.lastHitTime = 0;
        if (!player.hitByExplosions) player.hitByExplosions = new Map();
        
        // Use an invulnerability period
        const INVULNERABILITY_TIME = 3000;
        
        // Skip if player is in invulnerability period
        if (now - player.lastHitTime < INVULNERABILITY_TIME) {
            // debug print
            // console.log(`Player ${player.nickname} is invulnerable for ${Math.floor((INVULNERABILITY_TIME - (now - player.lastHitTime))/1000)}s more`);
            return;
        }
        
        // Check if player is in any explosion tile
        let hitByExplosion = false;
        let hitByBombId = null;
        
        for (const explosion of activeExplosions) {
            if (explosion.tileX === player.tileX && explosion.tileY === player.tileY) {
                hitByExplosion = true;
                hitByBombId = explosion.bombId;
                break;
            }
        }
        
        if (hitByExplosion && hitByBombId) {
            // debug print
            // Log the hit with detail
            console.log(`HIT DETECTION: Player ${player.nickname} at (${player.tileX},${player.tileY}) hit by bomb ${hitByBombId}`);
            console.log(`Player lastHitTime before: ${player.lastHitTime}, now: ${now}, diff: ${now - player.lastHitTime}ms`);
            
            // Record hit time BEFORE reducing lives to prevent race conditions
            player.lastHitTime = now;
            
            // Log the life change
            const prevLives = player.lives;
            player.lives--;
            console.log(`LIFE REDUCTION: ${player.nickname}: ${prevLives} → ${player.lives} lives (hit by bomb ${hitByBombId})`);
            
            // Record this bomb hit
            player.hitByExplosions.set(hitByBombId, now);
            
            // Broadcast with invulnerability flag
            broadcastUpdate(game, player.id, player, true);
            
            // Send chat message to all players about the life lost
            const message = {
                playerId: "SERVER",
                playerName: "SYSTEM",
                text: `${player.nickname} was hit! ${player.lives} lives left.`,
                timestamp: now,
                isSystem: true
            };
            broadcast(game.players.map(p => clients[p.id]).filter(c => c), "chatMessage", message);
            
            if (player.lives <= 0) {
                console.log(`Player ${player.id} died`);
                
                // Spawn a power-up at the player's position on death
                spawnPlayerDeathPowerUp(game, player.tileX, player.tileY);
                
                // Send death notification
                const deathMessage = {
                    playerId: "SERVER",
                    playerName: "SYSTEM",
                    text: `${player.nickname} was 'SPLODED!`,
                    timestamp: now,
                    isSystem: true
                };
                broadcast(game.players.map(p => clients[p.id]).filter(c => c), "chatMessage", deathMessage);
            }
        }
    });
}

  function cleanupExpiredExplosions(game) {
    if (!game.activeExplosions) return;
    
    const now = Date.now();
    game.activeExplosions = game.activeExplosions.filter(explosion => 
      explosion.expires > now
    );
  }

  function handleBombExploded(clientId, data) {
    const gameId = Object.keys(games).find(id => games[id].players.some(p => p.id === clientId));
    if (!gameId) return;
    
    const game = games[gameId];
    const bombIndex = game.state.bombs.findIndex(b => b.id === data.bombId);
    if (bombIndex === -1) return;
    
    const bomb = game.state.bombs[bombIndex];
    
    // Make sure only the bomb owner can explode their own bomb
    if (bomb.ownerId !== clientId) {
        console.log(`Bomb explosion attempt rejected: Client ${clientId} tried to explode bomb owned by ${bomb.ownerId}`);
        return;
    }
    
    // Only check location, not power (which might be out of sync)
    if (bomb.tileX !== data.tileX || bomb.tileY !== data.tileY) {
        console.warn(`Bomb location mismatch for ${data.bombId}`);
        return;
    }
    
    // Use the server's value for bomb power, not the client's
    const bombPower = bomb.power;
    
    game.state.bombs.splice(bombIndex, 1);
    const player = game.players.find(p => p.id === clientId);
    if (player) player.activeBombs--;
    
    // Get all connected clients for broadcasting
    const clientsToSend = game.players.map(p => clients[p.id]).filter(c => c);
    
    // Use the server's bomb power value here
    const explosionTiles = calculateExplosionTiles(game, { 
        tileX: bomb.tileX, 
        tileY: bomb.tileY, 
        power: bombPower,
        id: bomb.id
    });

    // Check for bombs caught in the explosion
    const chainReactionBombs = [];
    game.state.bombs.forEach(otherBomb => {
        // Check if any explosion tile overlaps with another bomb
        const bombHit = explosionTiles.some(tile => 
            tile.x === otherBomb.tileX && tile.y === otherBomb.tileY);
            
        if (bombHit) {
            chainReactionBombs.push(otherBomb);
        }
    });
    
    // Initialize activeExplosions array if it doesn't exist
    if (!game.activeExplosions) game.activeExplosions = [];
    
    // Store explosion tiles with expiration time
    explosionTiles.forEach(tile => {
        game.activeExplosions.push({
            bombId: bomb.id, 
            tileX: tile.x,
            tileY: tile.y,
            expires: Date.now() + 800 // 0.8 second duration
        });
    });

    explosionTiles.forEach(tile => {
        const type = (tile.x === bomb.tileX && tile.y === bomb.tileY) ? 'center' : 
                     (tile.isEnd ? 'end' : 'extension');
        const direction = tile.direction || null;
        broadcast(clientsToSend, "explosionCreated", {
            tileX: tile.x,
            tileY: tile.y,
            type: type,
            direction: direction,
            bombId: bomb.id
        });
    });
    
    // Trigger chain reactions with a small delay between each
    if (chainReactionBombs.length > 0) {
        console.log(`Chain reaction: ${chainReactionBombs.length} bombs caught in explosion`);
        
        // Explode each bomb with a slight delay for visual effect
        chainReactionBombs.forEach((chainBomb, index) => {
            setTimeout(() => {
                // Find the bomb owner
                const bombOwner = game.players.find(p => p.id === chainBomb.ownerId);
                if (bombOwner) {
                    // Create a synthetic explosion event
                    handleBombExploded(chainBomb.ownerId, {
                        bombId: chainBomb.id,
                        tileX: chainBomb.tileX,
                        tileY: chainBomb.tileY,
                        power: chainBomb.power
                    });
                }
            }, 100 * (index + 1)); // Small cascade delay between chain reactions
        });
    }

    // setTimeout call entirely - let the tick system handle it
    /* setTimeout(() => {
        checkExplosionCollisions(game);
    }, 50); */
    
    // Sync activeBombs and check game over
    if (player) {
        broadcast(clientsToSend, "playerUpdate", {
            id: player.id,
            activeBombs: player.activeBombs
        });
    }
    checkGameOver(game);
}

function broadcastGameState(game) {
    // Skip if game not started
    if (!game.started) return;
    
    // Create a lightweight state snapshot
    const gameState = {
      players: game.players.map(p => ({
        id: p.id,
        tileX: p.tileX,
        tileY: p.tileY,
        direction: p.direction,
        moving: p.moving,
        lives: p.lives,
        activeBombs: p.activeBombs || 0,
        speed: p.speed
      })),
      timestamp: Date.now()
    };
    
    // Broadcast to all connected players
    const clientsToSend = game.players.map(p => clients[p.id]).filter(c => c);
    broadcast(clientsToSend, "gameStateSync", gameState);
  }

function calculateExplosionTiles(game, bomb) {
    const tiles = [{ x: bomb.tileX, y: bomb.tileY }];
    const directions = [
        { dx: 1, dy: 0, name: 'right' },
        { dx: -1, dy: 0, name: 'left' },
        { dx: 0, dy: 1, name: 'down' },
        { dx: 0, dy: -1, name: 'up' }
    ];
    
    directions.forEach(dir => {
        for (let i = 1; i <= bomb.power; i++) {
            const x = bomb.tileX + dir.dx * i;
            const y = bomb.tileY + dir.dy * i;
            if (x < 0 || x >= game.state.map[0].length || y < 0 || y >= game.state.map.length) break;
            const tileType = game.state.map[y][x];
            if (tileType === 'wall') break;
            tiles.push({ 
                x, 
                y, 
                direction: dir.name, 
                isEnd: i === bomb.power 
            });
            if (tileType === 'block') {
                game.state.map[y][x] = 'empty'; // Match client 'empty'
                broadcast(game.players.map(p => clients[p.id]).filter(c => c), "mapUpdate", {
                    tileX: x,
                    tileY: y,
                    type: 'empty'
                });
                
                // Try to spawn a power-up where the block was destroyed
                trySpawnPowerUp(game, x, y);
                break;
            }
        }
    });
    return tiles;
}

function trySpawnPowerUp(game, tileX, tileY) {
    // 40% chance to spawn a power-up
    if (Math.random() < 0.4) {
        // Define power-up types with their respective probabilities
        const powerUpTypes = [
            { type: 'bomb', weight: 0.37 },   // 40% chance for bomb power-up
            { type: 'flame', weight: 0.37 },  // 40% chance for flame power-up
            { type: 'speed', weight: 0.26 }   // 20% chance for speed power-up (less common)
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
        
        // Broadcast power-up creation to all players
        const clientsToSend = game.players.map(p => clients[p.id]).filter(c => c);
        broadcast(clientsToSend, "powerUpCreated", {
            tileX: tileX,
            tileY: tileY,
            type: selectedType
        });
        
        console.log(`Power-up of type ${selectedType} spawned at (${tileX}, ${tileY})`);
        return true;
    }
    
    return false;
}

function spawnPlayerDeathPowerUp(game, tileX, tileY) {
    // Define power-up types with their respective probabilities
    const powerUpTypes = [
        { type: 'bomb', weight: 0.33 },   // 33% chance for bomb power-up
        { type: 'flame', weight: 0.33 },  // 33% chance for flame power-up
        { type: 'speed', weight: 0.34 }   // 34% chance for speed power-up
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
    
    // Broadcast power-up creation to all players
    const clientsToSend = game.players.map(p => clients[p.id]).filter(c => c);
    broadcast(clientsToSend, "powerUpCreated", {
        tileX: tileX,
        tileY: tileY,
        type: selectedType,
        fromPlayer: true // Flag to indicate this came from a player death
    });
    
    console.log(`Player death power-up of type ${selectedType} spawned at (${tileX}, ${tileY})`);
    return true;
}

function handlePowerUpCollected(clientId, data) {
    console.log(`Received PowerUpCollected from ${clientId}: type=${data.type}`);
    const gameId = Object.keys(games).find(id => 
        games[id].players.some(p => p.id === clientId)
    );
    
    if (!gameId) return;
    
    const game = games[gameId];
    const player = game.players.find(p => p.id === clientId);
    
    if (!player) return;
    
    const oldSpeed = player.speed;
    // Update player's stats based on power-up type
    switch(data.type) {
        case 'bomb':
            // Increase bomb count (max 5)
            player.bombCount = Math.min((player.bombCount || 1) + 1, 6);
            break;
        case 'flame':
            // Increase bomb power/range (max 5)
            player.bombPower = Math.min((player.bombPower || 1) + 1, 6);
            break;
        case 'speed':
            // Increase movement speed (max 8)
            player.speed = Math.min((player.speed || 2) + 0.75, 7);
            console.log(`Player ${clientId} speed power-up: ${oldSpeed} -> ${player.speed}`);
            break;
    }
    
    // Broadcast power-up collection to all players
    const clientsToSend = game.players.map(p => clients[p.id]).filter(c => c);
    broadcast(clientsToSend, "powerUpCollected", {
        playerId: clientId,
        tileX: data.tileX,
        tileY: data.tileY,
        type: data.type,
        stats: {
            bombCount: player.bombCount,
            bombPower: player.bombPower,
            speed: player.speed
        }
    });
}

function broadcastUpdate(game, clientId, player, isInvulnerable = false) {
    const clientsToSend = game.players.map(p => clients[p.id]).filter(c => c);
    broadcast(clientsToSend, "playerUpdate", {
        id: clientId,
        tileX: player.tileX,
        tileY: player.tileY,
        direction: player.direction,
        moving: player.moving,
        lives: player.lives,
        activeBombs: player.activeBombs,
        invulnerable: isInvulnerable,
        lastHitTime: player.lastHitTime // Send the timestamp for clients to sync
    });
}

// Set up game tick (30 times per second)
const tickInterval = setInterval(() => {
    // Process each active game
    Object.values(games).forEach(game => {
      if (game.started) {
        // Run continuous collision detection
        checkExplosionCollisions(game);
        cleanupExpiredExplosions(game);
        
        // Send full state sync every 15 ticks (500ms)
        game.tickCount = (game.tickCount || 0) + 1;
        if (game.tickCount % 15 === 0) {
          broadcastGameState(game);
        }
      }
    });
  }, 17); // ~60 FPS (17ms interval)

function handleChatMessage(clientId, data) {
    // Find the game this client is in
    const gameId = Object.keys(games).find(id => 
        games[id].players.some(p => p.id === clientId)
    );
    
    if (!gameId) return;
    
    const game = games[gameId];
    
    // Get the player's nickname
    const player = game.players.find(p => p.id === clientId);
    if (!player) return;
    
    // Create message with player info
    const messageData = {
        playerId: clientId,
        playerName: player.nickname,
        text: data.text,
        timestamp: Date.now()
    };
    
    // Broadcast to all players including the sender
    const otherPlayers = game.players.filter(p => p.id !== clientId);
    const clientsToSend = otherPlayers.map(p => clients[p.id]);
    broadcast(clientsToSend, "chatMessage", messageData);
}

function handleVerifyGameOver(clientId, data) {
    const gameId = Object.keys(games).find(id => 
        games[id].players.some(p => p.id === clientId)
    );
    
    if (!gameId) return;
    
    const game = games[gameId];
    
    // Count alive players based on server state
    const alivePlayers = game.players.filter(p => p.lives > 0);
    
    // Check if server agrees with client
    const expectedWinner = game.players.find(p => p.id === data.expectedWinner);
    const serverStateMatches = 
        alivePlayers.length === 1 && 
        alivePlayers[0].id === data.expectedWinner;
    
    if (serverStateMatches) {
        // Server agrees, end the game
        checkGameOver(game);
        
        // Also send direct verification to the client that requested it
        if (clients[clientId]) {
            clients[clientId].connection.send(JSON.stringify({
                method: "gameOverVerified",
                data: {
                    verified: true,
                    winnerId: data.expectedWinner
                }
            }));
        }
    } else {
        // Server disagrees, send corrected state
        if (clients[clientId]) {
            clients[clientId].connection.send(JSON.stringify({
                method: "gameOverVerified",
                data: {
                    verified: false,
                    correctState: game.players.map(p => ({
                        id: p.id,
                        lives: p.lives
                    }))
                }
            }));
        }
    }
}

function checkGameOver(game) {
    // Get authoritative server state of alive players
    const alivePlayers = game.players.filter(p => p.lives > 0);
    
    // Log the current state for debugging
    console.log("Checking game over condition. Alive players:", 
        alivePlayers.map(p => `${p.nickname}(${p.lives})`));
    
    // If only one or zero players remain alive
    if (alivePlayers.length <= 1) {
        const winner = alivePlayers[0] || null;
        console.log(`Game over condition met! Winner: ${winner ? winner.nickname : 'None'}`);
        
        // One final forced state update before ending game
        game.players.forEach(player => {
            broadcastUpdate(game, player.id, player);
        });
        
        // Give a short delay to ensure final state updates propagate
        setTimeout(() => {
            const clientsToSend = game.players.map(p => clients[p.id]).filter(c => c);
            broadcast(clientsToSend, "gameEnded", {
                winner: winner ? { id: winner.id, nickname: winner.nickname } : null,
                players: game.players.map(p => ({ id: p.id, nickname: p.nickname, lives: p.lives }))
            });
            delete games[game.id];
        }, 250);
    }
}

function handleGameEnded(clientId, data) {
    const gameId = Object.keys(games).find(id => 
        games[id].players.some(p => p.id === clientId)
    );
    
    if (!gameId) return;
    
    // Log the game end reason
    if (data.reason === 'playerWon') {
        const winnerNickname = data.players.find(p => p.id === data.winnerId)?.nickname || 'Unknown';
        console.log(`Game ${gameId} ended because player ${winnerNickname} won`);
    } else {
        console.log(`Game ${gameId} ended due to timer expiration`);
    }
    
    // Clean up the game
    delete games[gameId];
    console.log(`Game ${gameId} has been deleted`);
}