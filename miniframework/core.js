const MiniFramework = {
  /**
   * Creates a virtual DOM element.
   * @param {string} tag - The element tag.
   * @param {object} attrs - The element attributes.
   * @param  {...any} children - The child elements.
   * @returns {object} A virtual DOM node.
   */
  createElement(tag, attrs = {}, ...children) {
    return {
      tag,
      attrs,
      children: children.flat().filter(child => child != null),
    };
  },

  /**
   * Renders a virtual DOM node into a container.
   * @param {object|string} vNode - The virtual node to render.
   * @param {HTMLElement} container - The DOM container to render into.
   */
  render(vNode, container) {
    if (typeof vNode === 'string' || typeof vNode === 'number') {
      container.appendChild(document.createTextNode(vNode.toString()));
      return;
    }

    if (!vNode || !vNode.tag) return;

    const element = document.createElement(vNode.tag);

    for (const [key, value] of Object.entries(vNode.attrs)) {
      if (key.startsWith('on') && typeof value === 'function') {
        element.addEventListener(key.substring(2).toLowerCase(), value);
      } else if (typeof value === 'boolean' && value) {
        element.setAttribute(key, '');
      } else if (value != null) {
        element.setAttribute(key, value);
      }
    }

    vNode.children.forEach(child => this.render(child, element));
    container.appendChild(element);
  },

  /**
   * Creates a state management object.
   * @param {object} initialState - The initial state.
   * @returns {object} A state object with getState, setState, and subscribe methods.
   */
  createState(initialState = {}) {
    let state = { ...initialState };
    const subscribers = [];
    return {
      getState: () => ({ ...state }),
      setState(newState) {
        state = { ...state, ...newState };
        subscribers.forEach(callback => callback(state));
      },
      subscribe(callback) {
        subscribers.push(callback);
        return () => subscribers.splice(subscribers.indexOf(callback), 1); // Unsubscribe
      },
    };
  },

  /**
   * Creates a hash-based router.
   * @param {object} routes - A map of routes to handler functions.
   * @returns {object} A router object with init and navigate methods.
   */
  createRouter(routes = {}) {
    const handleRouteChange = () => {
      const path = window.location.hash.slice(1) || '/';
      const handler = routes[path];
      if (handler) {
        handler();
      }
    };

    return {
      init() {
        window.addEventListener('hashchange', handleRouteChange);
        handleRouteChange(); // Handle initial route
      },
      navigate(path) {
        window.location.hash = path;
      },
    };
  },
};

export default MiniFramework;
