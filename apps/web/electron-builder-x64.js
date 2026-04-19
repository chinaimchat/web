// Electron Builder Configuration for x64 (Intel) Architecture Only
const baseConfig = require('./electron-builder.js');

module.exports = {
  ...baseConfig,
  mac: {
    ...baseConfig.mac,
    target: [
      {
        target: 'dmg',
        arch: 'x64'
      },
      {
        target: 'zip',
        arch: 'x64'
      },
    ],
    // eslint-disable-next-line no-template-curly-in-string
    artifactName: '${productName}-${version}-x64.${ext}',
  },
  beforeBuild: async (context) => {
    console.log('🔨 Building for Intel (x64) architecture only');
    console.log('   Target Architecture:', context.arch);
    console.log('   Platform:', context.platform.name);
    console.log('   System Architecture:', process.arch);

    // Verify we're building the correct architecture
    if (context.arch !== 'x64') {
      throw new Error(`This configuration should only build x64 architecture, got: ${context.arch}`);
    }

    // Warn if cross-compiling (building x64 on ARM64)
    if (process.arch === 'arm64') {
      console.log('⚠️  Cross-compiling x64 on ARM64 system');
      console.log('   This may cause compatibility issues');
    } else if (process.arch === 'x64') {
      console.log('✅ Native x64 build on x64 system');
    }

    return true;
  },
  afterPack: async (context) => {
    console.log('📦 Intel (x64) packaging completed');
    console.log('   Output Directory:', context.outDir);
    return true;
  },
};
