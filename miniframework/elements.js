import MiniFramework from './index.js';

// Initialize the framework (optional)
MiniFramework.init({ debug: true });

// --- Usage Examples ---

// 1. Creating a simple button
const button = MiniFramework.createElement('button', 
  { 
    class: 'my-button',
    onclick: () => alert('Button clicked!')
  }, 
  'Click me'
);

// 2. Creating a div with nested elements
const container = MiniFramework.createElement('div',
  { class: 'container' },
  MiniFramework.createElement('h1', {}, 'Hello World'),
  MiniFramework.createElement('p', {}, 'This is a paragraph')
);

// 3. Creating an input with various attributes
const input = MiniFramework.createElement('input', {
  type: 'text',
  placeholder: 'Enter your name',
  class: 'input-field',
  id: 'name-input',
  required: true,
  'data-custom': 'value'
});

// --- Rendering to the DOM ---

// To see the elements, you need to render them into a container in your HTML.
// Assuming you have a <div id="root"></div> in your index.html:
const rootElement = document.getElementById('root');

if (rootElement) {
  // Combine all example elements into a single fragment to render
  const app = MiniFramework.createElement('div', {},
    button,
    container,
    input
  );
  
  // Clear the root and render the app
  rootElement.innerHTML = '';
  MiniFramework.render(app, rootElement);
} else {
  console.warn('Root element #root not found. Examples were created but not rendered.');
}