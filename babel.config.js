module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    // Note: react-native-reanimated/plugin is NOT needed for Reanimated v4 (SDK 54)
    // It has been removed in v4 — do not add it back
  };
};
