/**
 * Mini-Framework Events System
 * 
 * A simple pub/sub (publish/subscribe) implementation for event handling
 * that allows components to communicate without direct dependencies.
 */

const Events = {
    // Store for event listeners
    listeners: {},
    
    /**
     * Subscribe to an event
     * @param {string} eventName - Name of the event to listen for
     * @param {Function} callback - Function to call when event is emitted
     * @return {Function} Unsubscribe function
     */
    on(eventName, callback) {
      if (typeof callback !== 'function') {
        throw new Error('Event callback must be a function');
      }
      
      // Create array for this event if it doesn't exist
      if (!this.listeners[eventName]) {
        this.listeners[eventName] = [];
      }
      
      // Add the callback to the listeners array
      this.listeners[eventName].push(callback);
      
      // Return a function to unsubscribe
      return () => this.off(eventName, callback);
    },
    
    /**
     * Unsubscribe from an event
     * @param {string} eventName - Name of the event
     * @param {Function} callback - Callback function to remove
     */
    off(eventName, callback) {
      if (!this.listeners[eventName]) return;
      
      const index = this.listeners[eventName].indexOf(callback);
      if (index !== -1) {
        this.listeners[eventName].splice(index, 1);
        
        // Clean up empty listener arrays
        if (this.listeners[eventName].length === 0) {
          delete this.listeners[eventName];
        }
      }
    },
    
    /**
     * Emit an event with optional data
     * @param {string} eventName - Name of the event to emit
     * @param {...any} args - Arguments to pass to the event listeners
     */
    emit(eventName, ...args) {
      if (!this.listeners[eventName]) return;
      
      // Call each listener with the provided arguments
      this.listeners[eventName].forEach(callback => {
        try {
          callback(...args);
        } catch (error) {
          console.error(`Error in event listener for "${eventName}":`, error);
        }
      });
    },
    
    /**
     * Subscribe to an event for a single emission
     * @param {string} eventName - Name of the event to listen for
     * @param {Function} callback - Function to call when event is emitted
     * @return {Function} Unsubscribe function
     */
    once(eventName, callback) {
      // Create a wrapper that will call the callback and unsubscribe
      const wrapper = (...args) => {
        callback(...args);
        this.off(eventName, wrapper);
      };
      
      // Subscribe with the wrapper
      return this.on(eventName, wrapper);
    },
    
    /**
     * Clear all listeners or all listeners for a specific event
     * @param {string} [eventName] - Optional event name to clear
     */
    clear(eventName) {
      if (eventName) {
        delete this.listeners[eventName];
      } else {
        this.listeners = {};
      }
    }
  };
  
  export default Events;

//   This implementation provides a complete event system with the following features:

// on(eventName, callback) - Subscribe to events
// off(eventName, callback) - Unsubscribe from events
// emit(eventName, ...args) - Trigger events with any number of arguments
// once(eventName, callback) - Subscribe to an event but only trigger once
// clear([eventName]) - Remove all listeners for a specific event or all events
// It also includes error handling to prevent crashes when event handlers throw exceptions.