module.exports = function (api) {
  api.cache(true);
  return {
    // babel-preset-expo (SDK 56) auto-adds react-native-worklets/plugin when the
    // package is installed. Adding it again here double-transforms worklets and
    // crashes at runtime in valueUnpacker ("Cannot read property 'code' of undefined").
    presets: ['babel-preset-expo'],
  };
};
