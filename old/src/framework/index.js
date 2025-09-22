
// Example: Minimal framework structure

// Render a component into a target element
export function render(component, target) {
  target.innerHTML = '';
  target.appendChild(component());
}

// Example: Create a simple DOM element
export function createElement(tag, props = {}, ...children) {
  const el = document.createElement(tag);
  Object.entries(props).forEach(([key, value]) => {
    el[key] = value;
  });
  children.forEach(child => {
    if (typeof child === 'string') {
      el.appendChild(document.createTextNode(child));
    } else if (child instanceof Node) {
      el.appendChild(child);
    }
  });
  return el;
}

// You can expand this file with more framework utilities as needed
//-
//--