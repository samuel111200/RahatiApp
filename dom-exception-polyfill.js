// Metro polyfill — executes before setUpDefaultReactNativeEnvironment.
// Firebase's Node/browser builds reference Web APIs that don't exist in Hermes.
// These stubs satisfy the references so module init doesn't crash.
'use strict';
(function () {
  var g = typeof globalThis !== 'undefined' ? globalThis
        : typeof global    !== 'undefined' ? global
        : self;

  // ── DOMException ──────────────────────────────────────────────────────────
  if (!g.DOMException) {
    function DOMException(message, name) {
      var err = new Error(message != null ? message : '');
      err.name = name != null ? name : 'DOMException';
      return err;
    }
    DOMException.prototype = Object.create(Error.prototype);
    DOMException.prototype.constructor = DOMException;
    g.DOMException = DOMException;
  }

  // ── PerformanceEntry (base) ───────────────────────────────────────────────
  if (!g.PerformanceEntry) {
    function PerformanceEntry() {
      this.name = ''; this.entryType = ''; this.startTime = 0; this.duration = 0;
    }
    g.PerformanceEntry = PerformanceEntry;
  }

  // ── PerformanceResourceTiming ─────────────────────────────────────────────
  if (!g.PerformanceResourceTiming) {
    function PerformanceResourceTiming() { g.PerformanceEntry.call(this); }
    PerformanceResourceTiming.prototype = Object.create(g.PerformanceEntry.prototype);
    PerformanceResourceTiming.prototype.constructor = PerformanceResourceTiming;
    g.PerformanceResourceTiming = PerformanceResourceTiming;
  }

  // ── PerformanceMark ───────────────────────────────────────────────────────
  if (!g.PerformanceMark) {
    function PerformanceMark(name) {
      this.name = name || ''; this.entryType = 'mark';
      this.startTime = g.performance ? g.performance.now() : Date.now();
      this.duration = 0;
    }
    PerformanceMark.prototype = Object.create(g.PerformanceEntry.prototype);
    PerformanceMark.prototype.constructor = PerformanceMark;
    g.PerformanceMark = PerformanceMark;
  }

  // ── PerformanceMeasure ────────────────────────────────────────────────────
  if (!g.PerformanceMeasure) {
    function PerformanceMeasure(name) {
      this.name = name || ''; this.entryType = 'measure';
      this.startTime = 0; this.duration = 0;
    }
    PerformanceMeasure.prototype = Object.create(g.PerformanceEntry.prototype);
    PerformanceMeasure.prototype.constructor = PerformanceMeasure;
    g.PerformanceMeasure = PerformanceMeasure;
  }

  // ── PerformanceObserver ───────────────────────────────────────────────────
  if (!g.PerformanceObserver) {
    function PerformanceObserver() {}
    PerformanceObserver.prototype.observe = function () {};
    PerformanceObserver.prototype.disconnect = function () {};
    PerformanceObserver.supportedEntryTypes = [];
    g.PerformanceObserver = PerformanceObserver;
  }

  // ── performance (global object) ───────────────────────────────────────────
  if (!g.performance) {
    g.performance = {
      now: function () { return Date.now(); },
      mark: function () {}, measure: function () {},
      getEntriesByType: function () { return []; },
      getEntriesByName: function () { return []; },
      clearMarks: function () {}, clearMeasures: function () {},
    };
  }
})();
