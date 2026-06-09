const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Force Metro to use compiled lib/ output from react-native-reanimated
// instead of its TypeScript source (the react-native field in its package.json
// points to src/index which has broken internal imports in v4.x).
config.resolver.resolverMainFields = ['main', 'module', 'browser'];

module.exports = config;
