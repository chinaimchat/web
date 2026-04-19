// Electron Builder Configuration for Universal (x64 + ARM64) macOS Build
const baseConfig = require('./electron-builder.js');

module.exports = {
  ...baseConfig,
  mac: {
    ...baseConfig.mac,
    target: [
      {
        target: 'dmg',
        arch: ['universal']
      }
    ],
    // Universal binary naming
    // eslint-disable-next-line no-template-curly-in-string
    artifactName: '${productName}-${version}-universal.${ext}',
    // Universal build configuration for electron-builder 26.x
    // Enable ASAR merging for universal builds
    mergeASARs: true,
    // Ensure native modules are unpacked
    asarUnpack: [
      ...baseConfig.asarUnpack,
      "**/*.node",
      "**/node-screenshots-*/**/*"
    ],
  },
  beforeBuild: async (context) => {
    console.log('🔨 Building Universal macOS app (x64 + ARM64)');
    console.log('   Target Architectures: x64, arm64');
    console.log('   Platform:', context.platform.name);
    console.log('   System Architecture:', process.arch);
    console.log('   📦 This will create a universal binary that runs natively on both Intel and Apple Silicon Macs');
    console.log('   🔧 Universal build configuration optimized for electron-builder 26.x');
    console.log('   📋 mergeASARs:', module.exports.mac.mergeASARs);
    console.log('   � Using simplified configuration to avoid native module conflicts');
    return true;
  },
  afterPack: async (context) => {
    console.log('📦 Universal macOS packaging completed');
    console.log('   Output Directory:', context.outDir);
    console.log('   ✅ Universal binary created - works on both Intel and Apple Silicon Macs');
    return true;
  },
};
