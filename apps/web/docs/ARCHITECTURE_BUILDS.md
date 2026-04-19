# Architecture-Specific macOS Builds

This document explains how to build and distribute architecture-specific macOS installers for TangSengDaoDao.

## Overview

Instead of creating universal binaries, we build separate DMG files for each architecture:
- **Intel (x64)**: For Intel-based Macs
- **Apple Silicon (arm64)**: For Apple Silicon Macs (M1, M2, M3, etc.)

This approach avoids native module conflicts (like with `electron-screenshots`) while providing optimized builds for each architecture.

## Build Commands

### Build Both Architectures
```bash
# Build both x64 and arm64 DMG files
yarn build-ele:mac-both
```

### Build Specific Architecture
```bash
# Build only Intel (x64) DMG
yarn build-ele:mac-x64

# Build only Apple Silicon (arm64) DMG
yarn build-ele:mac-arm64
```

### Test Architecture Builds
```bash
# Test and verify both architecture builds
yarn test:arch-builds
```

## File Naming Convention

The built DMG files follow this naming pattern:
- **Intel**: `TangSengDaoDao-{version}-x64.dmg`
- **Apple Silicon**: `TangSengDaoDao-{version}-arm64.dmg`

Example:
- `TangSengDaoDao-1.0.6-x64.dmg` (Intel Macs)
- `TangSengDaoDao-1.0.6-arm64.dmg` (Apple Silicon Macs)

## GitHub Actions Workflow

The CI/CD pipeline automatically:
1. **Builds both architectures** when a version tag is pushed
2. **Verifies** that both DMG files are created
3. **Uploads artifacts** with clear architecture identification
4. **Creates releases** with both DMG files attached

### Workflow Steps:
1. Checkout code and setup Node.js
2. Install dependencies and build web app
3. Build both macOS architectures simultaneously
4. Verify both x64 and arm64 DMG files exist
5. Upload artifacts and create GitHub release

## Distribution Strategy

### For Users:
- **Intel Mac users**: Download the `*-x64.dmg` file
- **Apple Silicon Mac users**: Download the `*-arm64.dmg` file

### For Developers:
- Both DMG files are included in GitHub releases
- Clear naming makes it easy for users to choose the right version
- No confusion about universal vs. architecture-specific builds

## Benefits

### ✅ **Advantages:**
1. **No Native Module Conflicts**: Avoids issues with `electron-screenshots` and other native modules
2. **Optimized Performance**: Each build is optimized for its target architecture
3. **Smaller File Sizes**: Each DMG is smaller than a universal binary
4. **Clear User Choice**: Users know exactly which version to download
5. **Reliable Builds**: No complex universal binary merge issues

### ⚠️ **Considerations:**
1. **Two Downloads**: Users must choose the correct architecture
2. **Distribution Complexity**: Need to maintain two separate files
3. **User Education**: Users need to know their Mac's architecture

## Verification

### Local Testing:
```bash
# Build and test both architectures
yarn test:arch-builds

# Manual verification
lipo -info "dist-ele/TangSengDaoDao.app/Contents/MacOS/TangSengDaoDao"
```

### Expected Results:
- **x64 DMG**: Contains only x86_64 binary
- **arm64 DMG**: Contains only arm64 binary
- **Both**: Install and run correctly on their target architectures

## User Instructions

### How to Check Your Mac's Architecture:
```bash
# In Terminal
uname -m

# Results:
# x86_64 = Intel Mac (download x64 DMG)
# arm64 = Apple Silicon Mac (download arm64 DMG)
```

### Alternative Check:
1. Click Apple menu → About This Mac
2. Look for "Chip" information:
   - **Intel**: Download x64 DMG
   - **Apple M1/M2/M3**: Download arm64 DMG

## Troubleshooting

### Build Issues:
1. **Missing DMG files**: Check build logs for architecture-specific errors
2. **Native module errors**: This approach should eliminate them
3. **File size differences**: arm64 builds may be slightly different in size

### Distribution Issues:
1. **Wrong architecture downloaded**: Provide clear download instructions
2. **User confusion**: Include architecture info in download links
3. **Compatibility**: Each DMG only works on its target architecture

## Migration from Universal Builds

If migrating from universal builds:
1. **Update documentation** to explain architecture-specific downloads
2. **Update download pages** with clear architecture selection
3. **Test both architectures** thoroughly before release
4. **Communicate changes** to users in release notes

## Future Considerations

- **Automatic Detection**: Consider web-based architecture detection for downloads
- **Unified Installer**: Possible future smart installer that detects architecture
- **Performance Monitoring**: Track performance differences between architectures
- **User Feedback**: Monitor user experience with architecture-specific downloads
