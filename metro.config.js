const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

config.resolver.sourceExts.push('cjs');
// Enable package exports so Metro uses Firebase's "react-native" export condition
// instead of falling back to the "main" field (which is the Node.js build).
// The Node.js build references PerformanceEntry, DOMException etc. without guards;
// the React Native build is pre-compiled and safe for Hermes.
config.resolver.unstable_enablePackageExports = true;
config.resolver.unstable_conditionNames = ['react-native', 'require', 'default'];

// Transform Firebase packages so Metro can convert their ESM (import/export)
// syntax to CommonJS (require/module.exports) for the Metro bundler.
// Firebase's react-native builds are pre-compiled and don't use private fields.
config.transformer.transformIgnorePatterns = [
  'node_modules/(?!(react-native|@react-native|expo|@expo|firebase|@firebase)/)',
];

// Inject DOMException polyfill as a Metro serialiser polyfill so it runs
// BEFORE React Native initialises (before setUpDefaultReactNativeEnvironment).
// This is earlier than index.js or any import in _layout.tsx.
if (!config.serializer) config.serializer = {};
const _existingGetPolyfills = config.serializer.getPolyfills;
config.serializer.getPolyfills = (options) => {
  const defaults = _existingGetPolyfills ? _existingGetPolyfills(options) : [];
  return [
    path.join(__dirname, 'dom-exception-polyfill.js'),
    ...defaults,
  ];
};

module.exports = config;