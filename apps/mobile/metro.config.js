// Learn more https://docs.expo.io/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Add platform-specific extension resolution
config.resolver.sourceExts = ['web.tsx', 'web.ts', 'web.js', ...config.resolver.sourceExts];

// Exclude WatermelonDB from web builds completely
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (platform === 'web') {
    // Redirect ALL WatermelonDB imports to our web mock
    if (moduleName === '@nozbe/watermelondb' ||
        moduleName.startsWith('@nozbe/watermelondb/')) {
      return {
        filePath: path.resolve(__dirname, 'watermelon/database.web.ts'),
        type: 'sourceFile',
      };
    }

    // Redirect local watermelon model imports to web mock
    if (context.originModulePath &&
        (moduleName.includes('/watermelon/models/') ||
         moduleName.includes('/watermelon/schema') ||
         moduleName.endsWith('/watermelon') ||
         moduleName.endsWith('/watermelon/index'))) {
      return {
        filePath: path.resolve(__dirname, 'watermelon/database.web.ts'),
        type: 'sourceFile',
      };
    }

    // Redirect database.native.ts imports on web
    if (moduleName.includes('database.native')) {
      return {
        filePath: path.resolve(__dirname, 'watermelon/database.web.ts'),
        type: 'sourceFile',
      };
    }
  }

  // Default resolution
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
