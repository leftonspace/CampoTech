// Learn more https://docs.expo.io/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Add platform-specific extension resolution
config.resolver.sourceExts = ['web.tsx', 'web.ts', 'web.js', ...config.resolver.sourceExts];

// Exclude WatermelonDB native modules from web bundle
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (platform === 'web') {
    // Replace native WatermelonDB adapter with a no-op for web
    if (moduleName.includes('@nozbe/watermelondb/adapters/sqlite')) {
      return {
        type: 'empty',
      };
    }
    // Replace WatermelonDB native module
    if (moduleName === '@nozbe/watermelondb/native') {
      return {
        type: 'empty',
      };
    }
  }

  // Default resolution
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
