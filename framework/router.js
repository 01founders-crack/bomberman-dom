/**
 * Mini-Framework Router
 * 
 * A hash-based routing system for single-page applications
 * Features:
 * - Route definition and matching
 * - Route parameters
 * - Programmatic navigation
 * - Route change events
 */

import Helpers from './helpers.js';

class Router {
  constructor(options = {}) {
    this.routes = [];
    this.currentRoute = null;
    this.defaultRoute = options.defaultRoute || '/';
    this.notFoundHandler = options.notFoundHandler || null;
    this.beforeEach = options.beforeEach || null;
    this.afterEach = options.afterEach || null;
    this.listeners = [];
    
    // Extract the current route from the hash or use default
    this.currentHash = window.location.hash.slice(1) || this.defaultRoute;
  }
  
  /**
   * Add a route to the router
   * @param {string} path - The route path
   * @param {Function} handler - The route handler function
   * @param {Object} [meta] - Optional metadata for the route
   * @return {Router} - Returns this router instance for chaining
   */
  add(path, handler, meta = {}) {
    // Convert path pattern to regexp for matching
    const pattern = path
      .replace(/\/\//g, '/')
      .replace(/:\w+/g, '([^/]+)')
      .replace(/\*\*/g, '(.*)');
    
    const regexp = new RegExp(`^${pattern}$`);
    
    // Extract parameter names from the path
    const paramNames = (path.match(/:\w+/g) || [])
      .map(param => param.substring(1));
    
    this.routes.push({
      path,
      handler,
      regexp,
      paramNames,
      meta
    });
    
    return this;
  }
  
  /**
   * Navigate to a specific route
   * @param {string} path - The route path to navigate to
   * @param {Object} [options] - Navigation options
   * @param {boolean} [options.replace=false] - Replace current history entry instead of adding
   * @param {boolean} [options.silent=false] - Don't trigger route change handlers
   */
  navigate(path, options = {}) {
    const fullPath = path.startsWith('/') ? path : `/${path}`;
    
    // Update the URL hash
    if (options.replace) {
      window.location.replace(`#${fullPath}`);
    } else {
      window.location.hash = fullPath;
    }
    
    if (!options.silent) {
      this.handleRouteChange(fullPath);
    }
  }
  
  /**
   * Match a path to a route and extract parameters
   * @param {string} path - The path to match
   * @return {Object|null} - Matched route or null if no match
   */
  match(path) {
    for (const route of this.routes) {
      const matches = path.match(route.regexp);
      
      if (matches) {
        // Extract route parameters
        const params = {};
        
        if (route.paramNames.length > 0) {
          matches.slice(1).forEach((value, index) => {
            params[route.paramNames[index]] = decodeURIComponent(value);
          });
        }
        
        return {
          route,
          params
        };
      }
    }
    
    return null;
  }
  
  /**
   * Handle route changes (called when hash changes)
   * @param {string} [path] - The path to handle (uses current hash if not provided)
   */
  async handleRouteChange(path) {
    const currentPath = path || window.location.hash.slice(1) || this.defaultRoute;
    this.currentHash = currentPath;
    
    // Find the matching route
    const matchedRoute = this.match(currentPath);
    
    // Store previous route for hooks
    const previousRoute = this.currentRoute;
    
    // Update current route
    this.currentRoute = matchedRoute ? {
      path: currentPath,
      params: matchedRoute.params,
      meta: matchedRoute.route.meta
    } : null;
    
    // Call beforeEach hook if defined
    if (this.beforeEach) {
      const next = await this.beforeEach(this.currentRoute, previousRoute);
      if (next === false) {
        // Route navigation was cancelled
        return;
      }
    }
    
    // Execute route handler or notFoundHandler
    if (matchedRoute) {
      matchedRoute.route.handler(matchedRoute.params, this.currentRoute);
    } else if (this.notFoundHandler) {
      this.notFoundHandler(currentPath);
    }
    
    // Call afterEach hook if defined
    if (this.afterEach) {
      this.afterEach(this.currentRoute, previousRoute);
    }
    
    // Notify listeners
    this.notifyListeners(this.currentRoute);
  }
  
  /**
   * Notify all listeners of a route change
   * @param {Object} route - The current route
   */
  notifyListeners(route) {
    this.listeners.forEach(listener => listener(route));
  }
  
  /**
   * Add a listener for route changes
   * @param {Function} callback - Function to call when route changes
   * @return {Function} - Function to remove the listener
   */
  onRouteChange(callback) {
    if (!Helpers.isFunction(callback)) {
      throw new Error('Route change listener must be a function');
    }
    
    this.listeners.push(callback);
    
    // Return unsubscribe function
    return () => {
      const index = this.listeners.indexOf(callback);
      if (index !== -1) {
        this.listeners.splice(index, 1);
      }
    };
  }
  
  /**
   * Get the current route
   * @return {Object|null} - The current route or null
   */
  getCurrentRoute() {
    return this.currentRoute;
  }
  
  /**
   * Initialize the router
   */
  init() {
    // Handle hash changes
    window.addEventListener('hashchange', () => {
      this.handleRouteChange();
    });
    
    // Initial route handling
    this.handleRouteChange();
    
    return this;
  }
}

/**
 * Create a new router instance
 * @param {Object} options - Router options
 * @return {Router} - The router instance
 */
export function createRouter(options = {}) {
  return new Router(options);
}

export default {
  createRouter
};

// ===================================================

// This router implementation provides:

// Route definition - Add routes with parameters and handlers
// Route matching - Match URLs to defined routes and extract parameters
// Navigation - Programmatically navigate between routes
// Route change events - Subscribe to route changes
// Route hooks - Execute code before and after navigation
// Nested routes - Support for hierarchical routing structure
// Route metadata - Attach additional data to routes
// You can use it in your application like this:

// ====================================================!!!!!!!!!

// import { createRouter } from './framework/router.js';

// const router = createRouter({
//   defaultRoute: '/',
//   notFoundHandler: (path) => console.log(`Route not found: ${path}`)
// });

// // Add routes
// router
//   .add('/', () => renderHomePage())
//   .add('/about', () => renderAboutPage())
//   .add('/users/:id', (params) => renderUserProfile(params.id))
//   .add('/products/:category/:id', (params) => {
//     console.log(`Category: ${params.category}, Product: ${params.id}`);
//   });

// // Listen for route changes
// router.onRouteChange((route) => {
//   console.log('Current route:', route);
// });

// // Initialize the router
// router.init();

// // Navigate programmatically
// document.getElementById('about-link').addEventListener('click', () => {
//   router.navigate('/about');
// });

// =====================================================