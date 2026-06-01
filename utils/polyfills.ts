// Must be imported before any Firebase import.
// Firebase v12 references DOMException at module-init time.
// Hermes (Expo Go) doesn't expose it globally, so we polyfill it here.
// This file has ZERO imports so it executes immediately when required —
// no hoisting issue.
if (typeof (global as any).DOMException === 'undefined') {
  (global as any).DOMException = class DOMException extends Error {
    constructor(message?: string, name?: string) {
      super(message);
      this.name = name ?? 'DOMException';
    }
  };
}
