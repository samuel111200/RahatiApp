// Custom entry — runs before Metro loads any module.
// Firebase v12 references DOMException at module-init time but Hermes (Expo Go)
// doesn't expose it globally. We set it here with plain CJS so nothing is hoisted.
if (typeof global.DOMException === 'undefined') {
  global.DOMException = function DOMException(message, name) {
    Error.call(this, message);
    this.message = message || '';
    this.name = name || 'DOMException';
  };
  global.DOMException.prototype = Object.create(Error.prototype);
  global.DOMException.prototype.constructor = global.DOMException;
}

require('expo-router/entry');
