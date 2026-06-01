const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

config.resolver.sourceExts.push('cjs');
config.resolver.unstable_enablePackageExports = true;
config.resolver.unstable_conditionNames = ['react-native', 'require', 'default'];

config.transformer.transformIgnorePatterns = [
  'node_modules/(?!(react-native|@react-native|expo|@expo|firebase|@firebase)/)',
];

if (!config.serializer) config.serializer = {};
const _existing = config.serializer.getPolyfills;
config.serializer.getPolyfills = (options) => {
  const defaults = _existing ? _existing(options) : [];
  return [path.join(__dirname, 'dom-exception-polyfill.js'), ...defaults];
};

module.exports = config;
