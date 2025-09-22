/**
 * Mini-Framework DOM Abstraction
 * 
 * A lightweight virtual DOM implementation for efficient DOM manipulation
 * Features:
 * - Virtual DOM creation and rendering
 * - DOM diffing and patching
 * - Event handling
 * - CSS class and style manipulation
 */

import Helpers from './helpers.js';

/**
 * Create a virtual DOM element
 * @param {string} tag - The element tag name
 * @param {Object} attrs - Element attributes
 * @param {...(Object|string)} children - Child elements or text nodes
 * @returns {Object} Virtual DOM node
 */
function createElement(tag, attrs = {}, ...children) {
  // Flatten nested arrays of children
  const flatChildren = children.flat().filter(child => 
    child !== null && child !== undefined && child !== false
  );
  
  return {
    tag,
    attrs: attrs || {},
    children: flatChildren.map(child => 
      typeof child === 'string' || typeof child === 'number'
        ? { type: 'text', value: String(child) }
        : child
    )
  };
}

/**
 * Render a virtual DOM tree to a real DOM element
 * @param {Object} vNode - Virtual DOM node
 * @param {HTMLElement} container - Container to render into
 * @returns {HTMLElement} The created DOM element
 */
function render(vNode, container) {
  // Handle text nodes
  if (vNode.type === 'text') {
    const textNode = document.createTextNode(vNode.value);
    container.appendChild(textNode);
    return textNode;
  }
  
  // Skip null, undefined, or boolean nodes
  if (!vNode || !vNode.tag) return null;
  
  // Create the DOM element
  const element = document.createElement(vNode.tag);
  
  // Add attributes
  if (vNode.attrs) {
    Object.entries(vNode.attrs).forEach(([key, value]) => {
      // Handle event attributes (starting with 'on')
      if (key.startsWith('on') && typeof value === 'function') {
        const eventName = key.slice(2).toLowerCase();
        element.addEventListener(eventName, value);
      } 
      // Handle style objects
      else if (key === 'style' && typeof value === 'object') {
        Object.assign(element.style, value);
      }
      // Handle className/class alias
      else if (key === 'className') {
        element.setAttribute('class', value);
      }
      // Handle boolean attributes
      else if (typeof value === 'boolean') {
        if (value) {
          element.setAttribute(key, '');
        }
      }
      // Handle regular attributes
      else if (value !== null && value !== undefined) {
        element.setAttribute(key, value);
      }
    });
  }
  
  // Add children
  if (vNode.children && vNode.children.length > 0) {
    vNode.children.forEach(child => {
      render(child, element);
    });
  }
  
  // Append to container
  container.appendChild(element);
  
  return element;
}

/**
 * Update an existing DOM element with changes from a new virtual DOM tree
 * @param {Object} newVNode - New virtual DOM tree
 * @param {Object} oldVNode - Previous virtual DOM tree
 * @param {HTMLElement} domElement - DOM element to update
 * @returns {HTMLElement} Updated DOM element
 */
function patch(newVNode, oldVNode, domElement) {
  // If the node is completely different, replace it
  if (!oldVNode || oldVNode.tag !== newVNode.tag) {
    const newElement = render(newVNode, document.createElement('div'));
    domElement.parentNode.replaceChild(newElement, domElement);
    return newElement;
  }
  
  // If it's a text node, update the text
  if (newVNode.type === 'text') {
    if (domElement.nodeValue !== newVNode.value) {
      domElement.nodeValue = newVNode.value;
    }
    return domElement;
  }
  
  // Update attributes
  updateAttributes(domElement, newVNode.attrs || {}, oldVNode.attrs || {});
  
  // Update children
  updateChildren(domElement, newVNode.children || [], oldVNode.children || []);
  
  return domElement;
}

/**
 * Update DOM element attributes
 * @param {HTMLElement} element - DOM element to update
 * @param {Object} newAttrs - New attributes
 * @param {Object} oldAttrs - Old attributes
 */
function updateAttributes(element, newAttrs, oldAttrs) {
  // Remove old attributes that are not in new attributes
  Object.keys(oldAttrs).forEach(attr => {
    if (attr.startsWith('on')) {
      // Remove event listeners
      const eventName = attr.slice(2).toLowerCase();
      element.removeEventListener(eventName, oldAttrs[attr]);
    } else if (!(attr in newAttrs)) {
      element.removeAttribute(attr);
    }
  });
  
  // Set new attributes
  Object.entries(newAttrs).forEach(([attr, value]) => {
    // Handle event listeners
    if (attr.startsWith('on') && typeof value === 'function') {
      const eventName = attr.slice(2).toLowerCase();
      if (oldAttrs[attr]) {
        element.removeEventListener(eventName, oldAttrs[attr]);
      }
      element.addEventListener(eventName, value);
    } 
    // Handle style objects
    else if (attr === 'style' && typeof value === 'object') {
      // Reset styles
      element.removeAttribute('style');
      Object.assign(element.style, value);
    }
    // Handle className/class alias
    else if (attr === 'className') {
      element.setAttribute('class', value);
    }
    // Handle boolean attributes
    else if (typeof value === 'boolean') {
      if (value) {
        element.setAttribute(attr, '');
      } else {
        element.removeAttribute(attr);
      }
    }
    // Regular attributes
    else if (value !== oldAttrs[attr]) {
      element.setAttribute(attr, value);
    }
  });
}

/**
 * Update DOM element children
 * @param {HTMLElement} parent - Parent DOM element
 * @param {Array} newChildren - New virtual children
 * @param {Array} oldChildren - Old virtual children
 */
function updateChildren(parent, newChildren, oldChildren) {
  const childNodes = Array.from(parent.childNodes);
  
  // Simple implementation - not doing key-based reconciliation for brevity
  // Real frameworks would use a more sophisticated diffing algorithm
  
  // Update existing children and add new ones
  for (let i = 0; i < newChildren.length; i++) {
    if (i < oldChildren.length) {
      // Update existing child
      patch(newChildren[i], oldChildren[i], childNodes[i]);
    } else {
      // Add new child
      render(newChildren[i], parent);
    }
  }
  
  // Remove extra old children
  for (let i = newChildren.length; i < oldChildren.length; i++) {
    parent.removeChild(childNodes[i]);
  }
}

/**
 * Creates a component factory function
 * @param {Function} renderFunction - Function that returns virtual DOM
 * @returns {Function} Component factory function
 */
function createComponent(renderFunction) {
  return (props = {}) => renderFunction(props);
}

/**
 * Mount a component to the DOM
 * @param {Object} vNode - Virtual DOM node
 * @param {string|HTMLElement} container - Container selector or element
 * @returns {Object} Component controller
 */
function mount(vNode, container) {
  const containerElement = typeof container === 'string'
    ? document.querySelector(container)
    : container;
  
  if (!containerElement) {
    throw new Error(`Could not find container: ${container}`);
  }
  
  // Keep track of the current vNode for future updates
  let currentVNode = vNode;
  
  // Clear container and render
  containerElement.innerHTML = '';
  render(vNode, containerElement);
  
  // Return methods to control the component
  return {
    update(newVNode) {
      const firstChild = containerElement.firstChild;
      if (firstChild) {
        patch(newVNode, currentVNode, firstChild);
      } else {
        containerElement.innerHTML = '';
        render(newVNode, containerElement);
      }
      currentVNode = newVNode;
    },
    unmount() {
      containerElement.innerHTML = '';
      currentVNode = null;
    },
    getElement() {
      return containerElement;
    }
  };
}

/**
 * Create an HTML element with the given attributes and children
 * @param {string} tag - HTML tag name
 * @param {Object} attrs - Element attributes
 * @param {...*} children - Child elements or text
 * @returns {HTMLElement} The created element
 */
function createDOMElement(tag, attrs = {}, ...children) {
  const element = document.createElement(tag);
  
  // Set attributes
  Object.entries(attrs).forEach(([key, value]) => {
    if (key === 'style' && typeof value === 'object') {
      Object.assign(element.style, value);
    } else if (key === 'className') {
      element.className = value;
    } else if (key.startsWith('on') && typeof value === 'function') {
      const eventName = key.slice(2).toLowerCase();
      element.addEventListener(eventName, value);
    } else if (typeof value === 'boolean') {
      if (value) element.setAttribute(key, '');
    } else {
      element.setAttribute(key, value);
    }
  });
  
  // Add children
  children.flat().forEach(child => {
    if (child === null || child === undefined) return;
    
    element.appendChild(
      child instanceof Node 
        ? child 
        : document.createTextNode(String(child))
    );
  });
  
  return element;
}

export default {
  createElement,
  render,
  patch,
  createComponent,
  mount,
  createDOMElement
};

// =========================================================


// GitHub Copilot
// It seems the file path is incorrect. The DOM module should be in the framework directory. Let me create a complete DOM abstraction module for your mini-framework:

// This DOM abstraction module provides:

// Virtual DOM Creation - createElement creates virtual DOM nodes
// Rendering - render turns virtual DOM into real DOM
// Efficient Updates - patch efficiently updates the DOM with changes
// Component System - createComponent creates reusable components
// Direct DOM Manipulation - createDOMElement for when you need to create real DOM directly
// The module uses a simple diffing algorithm to update only what has changed in the DOM, making 
//  it more efficient than naive approaches that completely recreate elements.

// ==========================================