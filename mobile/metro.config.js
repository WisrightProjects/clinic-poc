const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// NOTE: Do NOT override resolverMainFields. Reanimated 4 / react-native-worklets
// ship their source via the `react-native` field on purpose, so Metro loads it
// and the worklets Babel plugin (added by babel-preset-expo) can transform the
// worklets and emit `__initData`. Forcing `main` (pre-compiled lib/) skips that
// transform, leaving worklets with a hash but no __initData -> runtime crash in
// valueUnpacker ("Cannot read property 'code' of undefined").

module.exports = config;
