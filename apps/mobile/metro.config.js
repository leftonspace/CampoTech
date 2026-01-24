// Learn more https://docs.expo.io/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

// Monorepo root directory
const projectRoot = __dirname;

// Set EXPO_ROUTER_APP_ROOT for monorepo compatibility
// This tells expo-router where to find the app directory
process.env.EXPO_ROUTER_APP_ROOT = path.resolve(projectRoot, 'app');
const monorepoRoot = path.resolve(projectRoot, '../..');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(projectRoot);

// Extend Expo's default watchFolders to include root node_modules for shared packages
// This preserves expo/metro-config defaults while adding monorepo support
config.watchFolders = [
  ...(config.watchFolders || []),
  path.resolve(monorepoRoot, 'node_modules'),
];

// Configure module resolution for monorepo
// Order matters: check app's node_modules first, then root
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(monorepoRoot, 'node_modules'),
];

// Platform-specific module resolution
// - Web: Use mocks for WatermelonDB and react-native-maps (they require native code)
// - Native (EAS builds): Use real WatermelonDB with SQLite
config.resolver.resolveRequest = (context, moduleName, platform) => {
  // WEB ONLY: Redirect WatermelonDB to mock
  if (platform === 'web') {
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

    // Redirect react-native-maps to web mock (native-only library)
    if (moduleName === 'react-native-maps' ||
      moduleName.startsWith('react-native-maps/')) {
      return {
        filePath: path.resolve(__dirname, 'web-mocks/react-native-maps.tsx'),
        type: 'sourceFile',
      };
    }
  }

  // NATIVE: Use real WatermelonDB (default resolution)
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
