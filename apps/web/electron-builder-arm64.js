// Electron Builder Configuration for ARM64 (Apple Silicon) Architecture Only
const baseConfig = require('./electron-builder.js');

module.exports = {
  ...baseConfig,
  mac: {
    ...baseConfig.mac,
    target: [
      {
        target: 'dmg',
        arch: 'arm64'
      },
      {
        target: 'zip',
        arch: 'arm64'
      },
    ],
    // eslint-disable-next-line no-template-curly-in-string
    artifactName: '${productName}-${version}-arm64.${ext}',
  },
  beforeBuild: async (context) => {
    console.log('🔨 Building for Apple Silicon (arm64) architecture only');
    console.log('   Target Architecture:', context.arch);
    console.log('   Platform:', context.platform.name);
    console.log('   System Architecture:', process.arch);

    // Verify we're building the correct architecture
    if (context.arch !== 'arm64') {
      throw new Error(`This configuration should only build arm64 architecture, got: ${context.arch}`);
    }

    // Warn if cross-compiling (building arm64 on x64)
    if (process.arch === 'x64') {
      console.log('⚠️  Cross-compiling arm64 on x64 system');
      console.log('   This may cause compatibility issues');
    } else if (process.arch === 'arm64') {
      console.log('✅ Native arm64 build on arm64 system');
    }

    return true;
  },
  afterPack: async (context) => {
    console.log('📦 Apple Silicon (arm64) packaging completed');
    console.log('   Output Directory:', context.outDir);
    return true;
  },
};
