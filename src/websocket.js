import { EventEmitter } from './eventSystem.js';

let instance = null;

export class WebSocketClient extends EventEmitter {
    constructor() {
        // Singleton pattern: if an instance already exists, return it
        // This prevents multiple WebSocketClient instances from being created
        // and ensures that only one connection is made to the server
        if (instance) {
            console.log("Returning existing WebSocketClient instance");
            return instance;
        }
        
        super();
        instance = this;
        // Ensure WebSocketClient creates only one connection per client instance:
        // Initialize clientId to null
        this.clientId = null;
        console.log("Creating new WebSocketClient instance from:", new Error().stack);
        this.connect();
    }
    
    connect() {
        console.log("Creating WebSocket connection from:", new Error().stack);
        
        // dynamic IP address
        const SERVER_IP = window.location.hostname; // Uses the IP from the URL
        this.ws = new WebSocket(`ws://${SERVER_IP}:9090`);
        
        // connect through ngrok need to use wss, change the URL that generate from ngrok ( need to change every time)
        // this.ws = new WebSocket(`wss://9474-194-82-132-122.ngrok-free.app`);

        this.ws.onopen = () => {
            console.log("WebSocket connection opened");
            this.send("getClientId", {});
            this.emit("open");
        };

        this.ws.onmessage = (event) => {
            const message = JSON.parse(event.data);
            console.log("WebSocket message received:", message);
            if (message.method === "clientId") {
                this.clientId = message.data.clientId;
                console.log("Assigned clientId:", this.clientId);
            }
            this.emit(message.method, message.data);
        };

        this.ws.onclose = () => {
            console.log("WebSocket connection closed, attempting reconnect...");
            this.emit("close");
            setTimeout(() => this.connect(), 1000); // Added reconnection
        };

        this.ws.onerror = (error) => {
            console.error("WebSocket error:", error);
            this.emit("error", error);
        };
    }

    // The send method sends a message to the server
    send(method, data) {
        if (this.ws.readyState === WebSocket.OPEN) {
            const message = JSON.stringify({ method, data });
            console.log("Sending WebSocket message:", message);
            this.ws.send(message);
        } else {
            console.warn(`WebSocket not open. State: ${this.ws.readyState}`);
        }
    }
}