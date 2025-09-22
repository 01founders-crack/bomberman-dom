/**
 * Mini-Framework Helper Utilities
 * 
 * A collection of utility functions to support the framework
 */

const Helpers = {
    /**
     * Type checking utilities
     */
    isString(value) {
      return typeof value === 'string';
    },
    
    isNumber(value) {
      return typeof value === 'number' && !isNaN(value);
    },
    
    isBoolean(value) {
      return typeof value === 'boolean';
    },
    
    isFunction(value) {
      return typeof value === 'function';
    },
    
    isObject(value) {
      return value !== null && typeof value === 'object' && !Array.isArray(value);
    },
    
    isArray(value) {
      return Array.isArray(value);
    },
    
    isDefined(value) {
      return value !== undefined && value !== null;
    },
    
    /**
     * Object utilities
     */
    deepClone(obj) {
      if (!this.isObject(obj) && !this.isArray(obj)) return obj;
      return JSON.parse(JSON.stringify(obj));
    },
    
    merge(target, ...sources) {
      if (!sources.length) return target;
      const source = sources.shift();
      
      if (this.isObject(target) && this.isObject(source)) {
        for (const key in source) {
          if (this.isObject(source[key])) {
            if (!target[key]) Object.assign(target, { [key]: {} });
            this.merge(target[key], source[key]);
          } else {
            Object.assign(target, { [key]: source[key] });
          }
        }
      }
      
      return this.merge(target, ...sources);
    },
    
    /**
     * DOM utilities
     */
    query(selector, context = document) {
      return context.querySelector(selector);
    },
    
    queryAll(selector, context = document) {
      return Array.from(context.querySelectorAll(selector));
    },
    
    addClass(element, className) {
      if (!element) return;
      element.classList.add(className);
    },
    
    removeClass(element, className) {
      if (!element) return;
      element.classList.remove(className);
    },
    
    toggleClass(element, className) {
      if (!element) return;
      element.classList.toggle(className);
    },
    
    hasClass(element, className) {
      if (!element) return false;
      return element.classList.contains(className);
    },
    
    setStyle(element, styles) {
      if (!element) return;
      Object.assign(element.style, styles);
    },
    
    /**
     * Event utilities
     */
    delegateEvent(element, eventType, selector, handler) {
      if (!element) return;
      
      element.addEventListener(eventType, (event) => {
        const targetElement = event.target.closest(selector);
        
        if (targetElement && element.contains(targetElement)) {
          handler.call(targetElement, event);
        }
      });
    },
    
    /**
     * Async utilities
     */
    debounce(func, wait = 100) {
      let timeout;
      return function(...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
      };
    },
    
    throttle(func, limit = 100) {
      let inThrottle;
      return function(...args) {
        if (!inThrottle) {
          func.apply(this, args);
          inThrottle = true;
          setTimeout(() => inThrottle = false, limit);
        }
      };
    },
    
    /**
     * String utilities
     */
    capitalize(str) {
      if (!this.isString(str)) return '';
      return str.charAt(0).toUpperCase() + str.slice(1);
    },
    
    camelCase(str) {
      if (!this.isString(str)) return '';
      return str
        .replace(/[^a-zA-Z0-9]+(.)/g, (_, char) => char.toUpperCase())
        .replace(/^[A-Z]/, (char) => char.toLowerCase());
    },
    
    kebabCase(str) {
      if (!this.isString(str)) return '';
      return str
        .replace(/([a-z])([A-Z])/g, '$1-$2')
        .replace(/\s+/g, '-')
        .toLowerCase();
    },
    
    /**
     * Array utilities
     */
    unique(array) {
      if (!this.isArray(array)) return [];
      return [...new Set(array)];
    },
    
    groupBy(array, key) {
      if (!this.isArray(array)) return {};
      return array.reduce((result, item) => {
        const groupKey = this.isFunction(key) ? key(item) : item[key];
        if (!result[groupKey]) result[groupKey] = [];
        result[groupKey].push(item);
        return result;
      }, {});
    },
    
    /**
     * URL utilities
     */
    parseUrl(url) {
      const parser = document.createElement('a');
      parser.href = url;
      
      return {
        protocol: parser.protocol,
        hostname: parser.hostname,
        port: parser.port,
        pathname: parser.pathname,
        search: parser.search,
        hash: parser.hash,
        host: parser.host
      };
    },
    
    parseQueryString(queryString) {
      if (!queryString) return {};
      
      const query = {};
      const pairs = (queryString[0] === '?' ? queryString.substr(1) : queryString).split('&');
      
      for (let i = 0; i < pairs.length; i++) {
        const pair = pairs[i].split('=');
        query[decodeURIComponent(pair[0])] = decodeURIComponent(pair[1] || '');
      }
      
      return query;
    },
    
    /**
     * Generate a unique ID
     */
    uniqueId(prefix = '') {
      return `${prefix}${Date.now().toString(36)}${Math.random().toString(36).substr(2, 5)}`;
    }
  };
  
  export default Helpers;

//   This helpers.js file provides a comprehensive set of utility functions organized by category:

// Type checking - Functions to check the type of values
// Object utilities - Deep cloning and merging objects
// DOM utilities - Element selection and manipulation
// Event utilities - Event delegation for better performance
// Async utilities - Debounce and throttle functions
// String utilities - String transformation functions
// Array utilities - Array manipulation helpers
// URL utilities - URL parsing helpers
// ID generation - Generate unique identifiers
// These utilities will help streamline the development of your mini-framework and the applications built with it.

