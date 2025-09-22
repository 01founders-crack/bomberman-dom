/**
 * Mini-Framework - A lightweight JavaScript framework
 * Implements DOM abstraction, routing, state management, and event handling
 */

// Main framework object
const MiniFramework = {
  // DOM abstraction for creating virtual elements
  createElement(tag, attrs = {}, ...children) {
    // Store element definition in a virtual structure
    return {
      tag,
      attrs,
      children: children.flat().filter(child => child != null),
    };
  },

  // State management system
  createState(initialState = {}) {
    // Private state object
    let state = { ...initialState };
    
    // Array of subscribers to notify when state changes
    const subscribers = [];
    
    return {
      // Get current state (or a specific property)
      getState(prop) {
        if (prop) return state[prop];
        return { ...state };
      },
      
      // Update state and notify subscribers
      setState(newState) {
        const oldState = { ...state };
        state = { ...state, ...newState };
        
        // Notify subscribers about state change
        subscribers.forEach(subscriber => subscriber(state, oldState));
        
        return state;
      },
      
      // Subscribe to state changes
      subscribe(callback) {
        subscribers.push(callback);
        
        // Return unsubscribe function
        return () => {
          const index = subscribers.indexOf(callback);
          if (index !== -1) subscribers.splice(index, 1);
        };
      }
    };
  },

  // Router implementation
  createRouter(routes = {}) {
    // Default route
    let currentRoute = window.location.hash.slice(1) || '/';
    
    // Store route change handlers
    const routeChangeHandlers = [];
    
    // Navigate to a specific route
    const navigate = (route) => {
      window.location.hash = route;
      currentRoute = route;
      
      // Notify subscribers
      routeChangeHandlers.forEach(handler => handler(currentRoute));
      
      // Execute matched route handler if exists
      if (routes[route]) {
        routes[route]();
      }
    };
    
    // Initialize router
    const init = () => {
      // Handle hash changes
      window.addEventListener('hashchange', () => {
        const newRoute = window.location.hash.slice(1) || '/';
        navigate(newRoute);
      });
      
      // Initial route execution
      if (routes[currentRoute]) {
        routes[currentRoute]();
      }
    };
    
    return {
      getCurrentRoute: () => currentRoute,
      navigate,
      onRouteChange: (callback) => {
        routeChangeHandlers.push(callback);
        return () => {
          const index = routeChangeHandlers.indexOf(callback);
          if (index !== -1) routeChangeHandlers.splice(index, 1);
        };
      },
      init
    };
  },

  // Custom event system
  events: {
    listeners: {},
    
    // Add event listener
    on(event, callback) {
      if (!this.listeners[event]) {
        this.listeners[event] = [];
      }
      this.listeners[event].push(callback);
      
      // Return function to remove listener
      return () => this.off(event, callback);
    },
    
    // Remove event listener
    off(event, callback) {
      if (!this.listeners[event]) return;
      
      const index = this.listeners[event].indexOf(callback);
      if (index !== -1) {
        this.listeners[event].splice(index, 1);
      }
    },
    
    // Emit event
    emit(event, ...args) {
      if (!this.listeners[event]) return;
      
      this.listeners[event].forEach(callback => {
        callback(...args);
      });
    }
  },

  // Render virtual DOM to real DOM
  render(vNode, container) {
    // Clear container if it's a re-render
    if (container && container._isRerender) {
      container.innerHTML = '';
    }
    
    // Handle text nodes
    if (typeof vNode === 'string' || typeof vNode === 'number') {
      container.appendChild(document.createTextNode(vNode));
      return;
    }
    
    // Skip null or undefined nodes
    if (!vNode || !vNode.tag) return;
    
    // Create DOM element
    const element = document.createElement(vNode.tag);
    
    // Add attributes
    if (vNode.attrs) {
      Object.keys(vNode.attrs).forEach(key => {
        // Handle event attributes (starting with 'on')
        if (key.startsWith('on') && typeof vNode.attrs[key] === 'function') {
          const eventName = key.slice(2).toLowerCase();
          element.addEventListener(eventName, vNode.attrs[key]);
        } else {
          element.setAttribute(key, vNode.attrs[key]);
        }
      });
    }
    
    // Add children
    if (vNode.children && vNode.children.length > 0) {
      vNode.children.forEach(child => {
        this.render(child, element);
      });
    }
    
    // Append to container
    container.appendChild(element);
    
    // Mark as rendered for future updates
    container._isRerender = true;
    
    return element;
  },

  // Create component
  createComponent(component) {
    return (props = {}) => {
      return component(props);
    };
  },

  // Mount application to DOM
  mount(rootComponent, rootContainer) {
    const container = typeof rootContainer === 'string' 
      ? document.querySelector(rootContainer) 
      : rootContainer;
      
    if (!container) {
      throw new Error(`Could not find container: ${rootContainer}`);
    }
    
    this.render(rootComponent, container);
    
    return {
      update: (newComponent) => {
        container.innerHTML = '';
        this.render(newComponent, container);
      }
    };
  }
};

// Export the framework
export default MiniFramework;