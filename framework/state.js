/**
 * Mini-Framework State Management System
 * 
 * A reactive state management system that allows components to respond to state changes
 * Features:
 * - Centralized state store
 * - State change subscriptions
 * - Computed properties
 * - State persistence
 */

import Helpers from './helpers.js';

/**
 * Creates a reactive state container
 * @param {Object} initialState - The initial state
 * @param {Object} options - Configuration options
 * @returns {Object} - State store API
 */
export function createState(initialState = {}, options = {}) {
  // Options with defaults
  const config = {
    persistence: null, // localStorage, sessionStorage, or custom adapter
    persistenceKey: 'mini-framework-state',
    ...options
  };
  
  // Internal state object
  let state = { ...initialState };
  
  // Subscribers to state changes
  const subscribers = [];
  
  // Computed properties cache
  const computedCache = new Map();
  
  // Computed property definitions
  const computedProperties = {};
  
  /**
   * Load persisted state if configured
   */
  const loadPersistedState = () => {
    if (!config.persistence) return;
    
    try {
      let savedState;
      
      if (config.persistence === 'localStorage') {
        savedState = localStorage.getItem(config.persistenceKey);
      } else if (config.persistence === 'sessionStorage') {
        savedState = sessionStorage.getItem(config.persistenceKey);
      } else if (Helpers.isFunction(config.persistence.getItem)) {
        savedState = config.persistence.getItem(config.persistenceKey);
      }
      
      if (savedState) {
        const parsedState = JSON.parse(savedState);
        state = { ...state, ...parsedState };
      }
    } catch (error) {
      console.error('Failed to load persisted state:', error);
    }
  };
  
  /**
   * Save state to persistence if configured
   */
  const saveState = () => {
    if (!config.persistence) return;
    
    try {
      const stateToSave = JSON.stringify(state);
      
      if (config.persistence === 'localStorage') {
        localStorage.setItem(config.persistenceKey, stateToSave);
      } else if (config.persistence === 'sessionStorage') {
        sessionStorage.setItem(config.persistenceKey, stateToSave);
      } else if (Helpers.isFunction(config.persistence.setItem)) {
        config.persistence.setItem(config.persistenceKey, stateToSave);
      }
    } catch (error) {
      console.error('Failed to persist state:', error);
    }
  };
  
  // Load state from persistence if configured
  loadPersistedState();
  
  // Public API
  return {
    /**
     * Get the current state or a specific property
     * @param {string} [prop] - Optional property path (dot notation supported)
     * @returns {*} - The requested state or property
     */
    getState(prop) {
      // Return a specific property if requested
      if (prop) {
        // Check if it's a computed property
        if (computedProperties[prop]) {
          // Check cache first
          if (computedCache.has(prop)) {
            return computedCache.get(prop);
          }
          
          // Compute the value
          const value = computedProperties[prop](state);
          computedCache.set(prop, value);
          return value;
        }
        
        // Handle nested properties with dot notation
        if (prop.includes('.')) {
          return prop.split('.').reduce((obj, key) => 
            obj && obj[key] !== undefined ? obj[key] : undefined, state);
        }
        
        return state[prop];
      }
      
      // Return full state (shallow clone to prevent direct mutation)
      return { ...state };
    },
    
    /**
     * Update the state
     * @param {Object|Function} update - New state object or function that returns updates
     * @returns {Object} - The updated state
     */
    setState(update) {
      // Save the old state for comparison
      const oldState = { ...state };
      
      // Allow functional updates that receive the current state
      const newValues = Helpers.isFunction(update) 
        ? update(this.getState()) 
        : update;
      
      // Merge the updates into the state
      state = { 
        ...state, 
        ...newValues 
      };
      
      // Clear computed cache as it might be affected by the update
      computedCache.clear();
      
      // Store the updated state if persistence is enabled
      saveState();
      
      // Notify subscribers about the state change
      subscribers.forEach(subscriber => subscriber(state, oldState, newValues));
      
      return this.getState();
    },
    
    /**
     * Subscribe to state changes
     * @param {Function} callback - Function to call when state changes
     * @returns {Function} - Unsubscribe function
     */
    subscribe(callback) {
      if (!Helpers.isFunction(callback)) {
        throw new Error('Subscriber callback must be a function');
      }
      
      subscribers.push(callback);
      
      // Return unsubscribe function
      return () => {
        const index = subscribers.indexOf(callback);
        if (index !== -1) {
          subscribers.splice(index, 1);
        }
      };
    },
    
    /**
     * Define a computed property derived from state
     * @param {string} name - Name of the computed property
     * @param {Function} getter - Function that computes the value from state
     * @returns {Object} - The state API for chaining
     */
    computed(name, getter) {
      if (!Helpers.isFunction(getter)) {
        throw new Error('Computed property getter must be a function');
      }
      
      computedProperties[name] = getter;
      return this;
    },
    
    /**
     * Reset state to initial values
     * @param {Object} [newInitial] - Optional new initial state
     * @returns {Object} - The reset state
     */
    reset(newInitial) {
      const initialValues = newInitial || initialState;
      state = { ...initialValues };
      computedCache.clear();
      saveState();
      
      // Notify subscribers
      subscribers.forEach(subscriber => 
        subscriber(state, {}, initialValues));
      
      return this.getState();
    },
    
    /**
     * Get the number of subscribers
     * @returns {number} - The subscriber count
     */
    subscriberCount() {
      return subscribers.length;
    }
  };
}

export default {
  createState
};

// ================================

// This state management implementation provides:

// Reactive state - Components can subscribe to state changes
// Computed properties - Define values derived from the state
// State persistence - Optionally save/load state to localStorage or sessionStorage
// Flexible updates - Update state with an object or function
// Nested state access - Get deeply nested properties with dot notation
// State reset - Return to initial state or set new baseline
// You can use it in your application like this:

// =================================!!!!!!!!!!!!!!!!!!!!!!!!!

// import { createState } from './framework/state.js';

// // Create a state store with initial values and localStorage persistence
// const store = createState({
//   user: { name: 'Guest', isLoggedIn: false },
//   todos: [],
//   filter: 'all'
// }, {
//   persistence: 'localStorage',
//   persistenceKey: 'todo-app-state'
// });

// // Define computed properties
// store.computed('activeTodoCount', (state) => 
//   state.todos.filter(todo => !todo.completed).length
// );

// store.computed('filteredTodos', (state) => {
//   if (state.filter === 'active') {
//     return state.todos.filter(todo => !todo.completed);
//   } else if (state.filter === 'completed') {
//     return state.todos.filter(todo => todo.completed);
//   }
//   return state.todos;
// });

// // Subscribe to state changes
// const unsubscribe = store.subscribe((newState, oldState, changes) => {
//   console.log('State updated:', changes);
//   renderApp();
// });

// // Get state
// const todos = store.getState('todos');
// const activeTodoCount = store.getState('activeTodoCount'); // Computed property

// // Update state
// store.setState({
//   filter: 'active'
// });

// // Functional update
// store.setState(state => ({
//   todos: [...state.todos, { id: Date.now(), text: 'New todo', completed: false }]
// }));

// // Clean up when component unmounts
// unsubscribe();

// ========================================