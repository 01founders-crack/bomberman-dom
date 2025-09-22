// this isn't used for the todo website at all, but may become part of the Bomberman Dom project

import { EventEmitter } from './eventSystem.js';

export class InputManager extends EventEmitter {
    constructor() {
        super();
        this.keys = new Set();
        this.gamepads = new Map();
        this.touchState = new Map();
        
        // Keyboard handling
        window.addEventListener('keydown', e => {
            if (!e.repeat) {  // Prevent key repeat from causing issues
                this.keys.add(e.code);
                this.emit('inputchange', this.getState());
            }
        });
        
        window.addEventListener('keyup', e => {
            this.keys.delete(e.code);
            this.emit('inputchange', this.getState());
        });

        // Blur handling (clear inputs when window loses focus)
        window.addEventListener('blur', () => {
            this.keys.clear();
            this.emit('inputchange', this.getState());
        });

        // Gamepad handling
        window.addEventListener("gamepadconnected", (e) => {
            this.gamepads.set(e.gamepad.index, e.gamepad);
            this.emit('gamepadconnected', e.gamepad);
        });

        window.addEventListener("gamepaddisconnected", (e) => {
            this.gamepads.delete(e.gamepad.index);
            this.emit('gamepaddisconnected', e.gamepad);
        });

        // Touch handling
        if ('ontouchstart' in window) {
            window.addEventListener('touchstart', (e) => {
                for (let touch of e.changedTouches) {
                    this.touchState.set(touch.identifier, {
                        startX: touch.clientX,
                        startY: touch.clientY,
                        currentX: touch.clientX,
                        currentY: touch.clientY
                    });
                }
                this.emit('inputchange', this.getState());
            });

            window.addEventListener('touchmove', (e) => {
                for (let touch of e.changedTouches) {
                    const state = this.touchState.get(touch.identifier);
                    if (state) {
                        state.currentX = touch.clientX;
                        state.currentY = touch.clientY;
                    }
                }
                this.emit('inputchange', this.getState());
            });

            window.addEventListener('touchend', (e) => {
                for (let touch of e.changedTouches) {
                    this.touchState.delete(touch.identifier);
                }
                this.emit('inputchange', this.getState());
            });
        }
    }

    // Poll gamepads for current state
    pollGamepads() {
        const gamepads = navigator.getGamepads();
        for (let gamepad of gamepads) {
            if (gamepad) {
                this.gamepads.set(gamepad.index, gamepad);
            }
        }
    }

    isPressed(keyCode) {
        return this.keys.has(keyCode);
    }

    // Get all current input states
    getState() {
        this.pollGamepads();
        return {
            keyboard: Array.from(this.keys),
            gamepads: Array.from(this.gamepads.values()).map(gamepad => ({
                index: gamepad.index,
                buttons: Array.from(gamepad.buttons).map(btn => btn.pressed),
                axes: Array.from(gamepad.axes)
            })),
            touches: Array.from(this.touchState.entries()).map(([id, state]) => ({
                id,
                ...state,
                // Calculate direction from start position to current
                direction: this.getTouchDirection(state)
            }))
        };
    }

    // Helper to convert touch movement into a direction
    getTouchDirection(touchState) {
        const dx = touchState.currentX - touchState.startX;
        const dy = touchState.currentY - touchState.startY;
        const threshold = 30; // Minimum pixels to register as direction

        if (Math.abs(dx) < threshold && Math.abs(dy) < threshold) {
            return null;
        }

        if (Math.abs(dx) > Math.abs(dy)) {
            return dx > 0 ? 'right' : 'left';
        } else {
            return dy > 0 ? 'down' : 'up';
        }
    }
}