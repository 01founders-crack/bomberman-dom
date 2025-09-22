import { EventEmitter } from './eventSystem.js';

export class Element extends EventEmitter {
    constructor(tag, attrs = {}, children = []) {
        super();
        this.tag = tag;
        this.attrs = attrs;
        this.children = children;
        this.domElement = null;
        this.state = {};
        this.updateQueue = [];
        
        // Performance tracking
        this.lastFrameTime = 0;
        this.frameCount = 0;
        this.fps = 0;
        this.fpsUpdateInterval = 1000; // Update FPS every second
        this.lastFpsUpdate = 0;
    }

    static async preloadMedia(mediaList) {
        // Helper function to determine media type from URL or explicit type
        const getMediaType = (item) => {
            if (typeof item === 'string') {
                // Try to determine type from file extension
                const ext = item.split('.').pop().toLowerCase();
                if (['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp'].includes(ext)) return 'image';
                if (['mp3', 'wav', 'ogg', 'aac'].includes(ext)) return 'audio';
                if (['mp4', 'webm', 'ogv'].includes(ext)) return 'video';
                return 'unknown';
            }
            return item.type || 'unknown';
        };
    
        // Normalize input to array of objects with url and type
        const normalizedList = mediaList.map(item => {
            if (typeof item === 'string') {
                return { url: item, type: getMediaType(item) };
            }
            return { ...item, type: item.type || getMediaType(item.url) };
        });
    
        const loadPromises = normalizedList.map(({ url, type, ...options }) => {
            return new Promise((resolve, reject) => {
                switch (type) {
                    case 'image': {
                        const img = new Image();
                        img.onload = () => resolve({ url, element: img, type });
                        img.onerror = () => reject(new Error(`Failed to load image: ${url}`));
                        // Apply any additional options (like crossOrigin)
                        Object.assign(img, options);
                        img.src = url;
                        break;
                    }
                    case 'audio': {
                        const audio = new Audio();
                        audio.oncanplaythrough = () => resolve({ url, element: audio, type });
                        audio.onerror = () => reject(new Error(`Failed to load audio: ${url}`));
                        Object.assign(audio, options);
                        audio.preload = 'auto';
                        audio.src = url;
                        break;
                    }
                    case 'video': {
                        const video = document.createElement('video');
                        video.oncanplaythrough = () => resolve({ url, element: video, type });
                        video.onerror = () => reject(new Error(`Failed to load video: ${url}`));
                        Object.assign(video, options);
                        video.preload = 'auto';
                        video.src = url;
                        break;
                    }
                    default:
                        reject(new Error(`Unknown media type for: ${url}`));
                }
            });
        });
    
        try {
            const results = await Promise.all(loadPromises);
            // Convert results to a map for easy access
            return {
                elements: results.reduce((map, { url, element, type }) => {
                    map[url] = element;
                    return map;
                }, {}),
                byType: results.reduce((map, { url, element, type }) => {
                    if (!map[type]) map[type] = {};
                    map[type][url] = element;
                    return map;
                }, {})
            };
        } catch (error) {
            console.error('Error preloading media:', error);
            throw error;
        }
    }

    render() {
        if (!this.domElement) {
            this.domElement = document.createElement(this.tag);
            this.updateAttributes(this.attrs);
            this.updateChildren(this.children);
            
            // Apply pixel-perfect rendering for game sprites if specified
            if (this.attrs.pixelated) {
                this.domElement.style.imageRendering = 'pixelated';
                this.domElement.style.imageRendering = '-moz-crisp-edges';
                this.domElement.style.imageRendering = 'crisp-edges';
            }
        }
        return this.domElement;
    }

    updateAttributes(newAttrs) {
        Object.entries(newAttrs).forEach(([key, value]) => {
            if (key === 'style' && typeof value === 'object') {
                Object.entries(value).forEach(([prop, val]) => {
                    this.domElement.style[prop] = val;
                });
            } else if (key.startsWith('on')) {
                const eventName = key.slice(2).toLowerCase();
                this.domElement.addEventListener(eventName, value);
            } else if (key === 'pixelated') {
                // Skip pixelated attribute as it's handled in render()
                return;
            } else {
                this.domElement.setAttribute(key, value);
            }
        });
    }

    updateChildren(newChildren) {
        const fragment = document.createDocumentFragment();
        newChildren.forEach(child => {
            if (typeof child === 'string') {
                fragment.appendChild(document.createTextNode(child));
            } else if (child) {  // Check for null/undefined children
                fragment.appendChild(child.render());
            }
        });
        this.domElement.innerHTML = '';
        this.domElement.appendChild(fragment);
    }
    
    queueUpdate(callback) {
        this.updateQueue.push(callback);
        if (!this.updateFrame) {
            this.updateFrame = requestAnimationFrame((timestamp) => {
                // Performance tracking
                if (this.lastFrameTime) {
                    const frameTime = timestamp - this.lastFrameTime;
                    this.frameCount++;
                    
                    if (timestamp - this.lastFpsUpdate >= this.fpsUpdateInterval) {
                        this.fps = Math.round((this.frameCount * 1000) / (timestamp - this.lastFpsUpdate));
                        this.frameCount = 0;
                        this.lastFpsUpdate = timestamp;
                        this.emit('fpsUpdate', this.fps);
                    }
                }
                this.lastFrameTime = timestamp;

                // Process updates
                this.updateQueue.forEach(cb => cb());
                this.updateQueue = [];
                this.updateFrame = null;
            });
        }
    }

    // Performance monitoring methods
    getFPS() {
        return this.fps;
    }

    onFPSUpdate(callback) {
        this.on('fpsUpdate', callback);
    }

    setPosition(x, y) {
        this.state.x = x;
        this.state.y = y;
        this.queueUpdate(() => {
            this.domElement.style.transform = `translate(${x}px, ${y}px)`;
        });
    }

    setAttribute(key, value) {
        this.attrs[key] = value;
        if (this.domElement) {
            this.updateAttributes({ [key]: value });
        }
    }

    setStyle(styles) {
        this.attrs.style = { ...this.attrs.style, ...styles };
        if (this.domElement) {
            this.updateAttributes({ style: this.attrs.style });
        }
    }
}