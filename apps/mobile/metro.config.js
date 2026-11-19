// Metro config for Kibo mobile inside the pnpm monorepo.
const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');
const path = require('path');

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// 1. Watch the whole monorepo so changes in packages/* trigger rebuilds.
config.watchFolders = [monorepoRoot];

// 2. Resolve modules from the app first, then from the monorepo root.
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(monorepoRoot, 'node_modules'),
];

// 3. NativeWind: compile global.css (Tailwind) into RN styles.
module.exports = withNativeWind(config, { input: './src/global.css' });
