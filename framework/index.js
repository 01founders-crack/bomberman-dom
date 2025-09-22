/**
 * Mini-Framework
 * 
 * A lightweight JavaScript framework for building modern web applications
 * Features:
 * - Virtual DOM abstraction
 * - State management
 * - Routing system
 * - Event handling
 */

import MiniFramework from './core.js';
import Events from './events.js';
import Helpers from './helpers.js';
import Router from './router.js';
import State from './state.js';
import DOM from './dom.js';

// Add to framework/index.js
MiniFramework.createState = State.createState;
MiniFramework.createRouter = Router.createRouter;
Object.assign(MiniFramework, DOM); // Add DOM functions


// Merge the events module into the main framework
MiniFramework.events = Events;

// Add helpers to the framework
MiniFramework.helpers = Helpers;

// Additional framework configuration
MiniFramework.version = '1.0.0';

// Add convenience methods that use helpers
MiniFramework.$ = (selector) => Helpers.query(selector);
MiniFramework.$$ = (selector) => Helpers.queryAll(selector);

// Add framework initialization method
MiniFramework.init = (options = {}) => {
  // Store options
  MiniFramework.options = {
    debug: false,
    ...options
  };
  
  // Log framework initialization in debug mode
  if (MiniFramework.options.debug) {
    console.log(`Mini-Framework v${MiniFramework.version} initialized with options:`, MiniFramework.options);
  }
  
  // Return the framework for chaining
  return MiniFramework;
};

// Export the framework
export default MiniFramework;

// This index.js file:

// Imports all the core modules (core.js, events.js, helpers.js)
// Integrates them into a single cohesive API
// Adds version information and initialization method
// Provides convenience methods for DOM selection ($ and $$)
// Exports everything as a single default export

// ===============================================================
// Now your framework can be imported and used with a simple: !!!!!!!!!

// =================================================================
// // import MiniFramework from './framework/index.js';

// // // Initialize the framework
// // MiniFramework.init({ debug: true });

// // // Use the framework
// // const app = MiniFramework.createElement('div', {}, 'Hello World');
// // MiniFramework.render(app, document.getElementById('app'));
// ==================================================================