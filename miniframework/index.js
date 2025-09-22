import MiniFramework from './core.js';

// You can add helper functions or other modules here in the future.

// Add a version property
MiniFramework.version = '1.0.0';

/**
 * Initializes the framework with optional settings.
 * @param {object} options - Configuration options.
 */
MiniFramework.init = (options = {}) => {
  MiniFramework.options = { debug: false, ...options };
  if (MiniFramework.options.debug) {
    console.log(`Mini-Framework v${MiniFramework.version} initialized.`);
  }
  return MiniFramework;
};

export default MiniFramework;