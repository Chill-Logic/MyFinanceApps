const { getDefaultConfig } = require('expo/metro-config');

/**
 * Metro configuration
 * https://docs.expo.dev/guides/customizing-metro
 *
 * expo/metro-config already handles npm workspace monorepo hoisting automatically since SDK 52 —
 * no need for the manual watchFolders/nodeModulesPaths setup the bare RN CLI setup required.
 *
 * @type {import('expo/metro-config').MetroConfig}
 */
module.exports = getDefaultConfig(__dirname);
