const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
// Keep enough headroom for Windows and other apps during exports / Expo Go development.
config.maxWorkers = 4;
module.exports = config;
