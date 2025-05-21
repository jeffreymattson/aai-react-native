const { getDefaultConfig } = require('@expo/metro-config');

const config = getDefaultConfig(__dirname);

// Add custom configuration
config.resolver.sourceExts = [...config.resolver.sourceExts, 'jsx', 'js', 'ts', 'tsx'];
config.resolver.assetExts = [...config.resolver.assetExts, 'xlsx'];

// Ensure proper handling of web-specific files
config.resolver.platforms = ['web', 'ios', 'android'];

module.exports = config; 