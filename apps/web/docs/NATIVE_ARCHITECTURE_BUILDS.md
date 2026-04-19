# Native Architecture-Specific macOS Builds

This document explains the native architecture-specific build system for TangSengDaoDao macOS applications.

## Overview

We use separate GitHub Actions runners to build native binaries for each macOS architecture:
- **Intel (x64)**: Built on `macos-13` (Intel runner)
- **Apple Silicon (arm64)**: Built on `macos-14` (Apple Silicon runner)

This approach ensures true native builds without cross-compilation, providing optimal compatibility and performance.

## Architecture Strategy

### Why Separate Runners?

1. **Native Compilation**: Each architecture is built on its native hardware
2. **No Cross-Compilation Issues**: Avoids potential compatibility problems
3. **Native Module Support**: Packages like `electron-screenshots` work correctly
4. **Optimal Performance**: Each build is optimized for its target architecture
5. **Reliable Builds**: No universal binary merge conflicts

### Runner Mapping

| Architecture | GitHub Runner | Build Command | Output File |
|--------------|---------------|---------------|-------------|
| Intel (x64) | `macos-13` | `yarn build-ele:mac-x64` | `*-x64.dmg` |
| Apple Silicon (arm64) | `macos-14` | `yarn build-ele:mac-arm64` | `*-arm64.dmg` |

## Build Commands

### Local Development

```bash
# Build for current architecture (recommended)
yarn test:arch-builds

# Build specific architecture (if supported)
yarn build-ele:mac-x64      # Intel only
yarn build-ele:mac-arm64    # Apple Silicon only
```

### CI/CD Pipeline

The GitHub Actions workflow automatically:
1. **Detects** the appropriate runner for each architecture
2. **Verifies** runner architecture matches target architecture
3. **Builds** native binaries on matching hardware
4. **Validates** the built binary architecture
5. **Uploads** architecture-specific artifacts

## File Naming Convention

Built DMG files use clear architecture identification:
- **Intel**: `TangSengDaoDao-{version}-x64.dmg`
- **Apple Silicon**: `TangSengDaoDao-{version}-arm64.dmg`

Example:
- `TangSengDaoDao-1.0.6-x64.dmg` (Intel Macs)
- `TangSengDaoDao-1.0.6-arm64.dmg` (Apple Silicon Macs)

## GitHub Actions Workflow

### Matrix Strategy

```yaml
strategy:
  fail-fast: false
  matrix:
    include:
      - os: macos-13
        platform: macos
        arch: x64
      - os: macos-14
        platform: macos
        arch: arm64
```

### Build Process

1. **Runner Verification**: Confirms runner architecture matches target
2. **Environment Setup**: Installs Node.js and dependencies
3. **Native Build**: Compiles for specific architecture
4. **Binary Verification**: Validates built binary architecture
5. **Artifact Upload**: Uploads architecture-specific DMG files

### Verification Steps

Each build includes automatic verification:
- **Runner Architecture Check**: Ensures correct hardware
- **Binary Architecture Validation**: Confirms built binary matches target
- **File Existence Check**: Verifies DMG creation
- **Artifact Organization**: Separates x64 and arm64 builds

## Benefits

### ✅ **Advantages**

1. **True Native Builds**: No cross-compilation artifacts
2. **Maximum Compatibility**: Built on target hardware
3. **Native Module Support**: Full support for packages like `electron-screenshots`
4. **Optimal Performance**: Architecture-specific optimizations
5. **Reliable CI/CD**: Consistent, predictable builds
6. **Clear Distribution**: Users know exactly which version to download

### 📊 **Performance Benefits**

- **Intel Macs**: Run x86_64 optimized code
- **Apple Silicon Macs**: Run arm64 optimized code
- **Native Modules**: Work without compatibility layers
- **Startup Time**: Faster launch on native architecture

## Distribution Strategy

### For Users

**How to Choose the Right DMG:**

1. **Check Your Mac's Architecture:**
   ```bash
   uname -m
   # x86_64 = Intel Mac (download x64 DMG)
   # arm64 = Apple Silicon Mac (download arm64 DMG)
   ```

2. **Alternative Check:**
   - Apple Menu → About This Mac
   - Look for "Chip" information:
     - Intel: Download x64 DMG
     - Apple M1/M2/M3: Download arm64 DMG

### For Developers

**Release Process:**
1. Tag a new version (e.g., `v1.0.6`)
2. GitHub Actions automatically builds both architectures
3. Two DMG files are created and attached to the release
4. Users download the appropriate version for their Mac

## Local Testing

### Test Current Architecture

```bash
# Test build for current system architecture
yarn test:arch-builds
```

This script will:
- Detect your Mac's architecture
- Build the appropriate DMG
- Verify the binary architecture
- Provide detailed verification results

### Manual Verification

```bash
# Check built binary architecture
lipo -info "dist-ele/TangSengDaoDao.app/Contents/MacOS/TangSengDaoDao"

# Expected outputs:
# Intel: "Non-fat file: ... is architecture: x86_64"
# Apple Silicon: "Non-fat file: ... is architecture: arm64"
```

## Troubleshooting

### Build Issues

1. **Wrong Runner Architecture**: Check GitHub Actions logs for runner verification
2. **Missing DMG Files**: Verify build commands completed successfully
3. **Binary Architecture Mismatch**: Check lipo verification output

### Common Solutions

1. **Update Runner Versions**: Ensure using latest macOS runners
2. **Check Dependencies**: Verify all native modules support target architecture
3. **Review Build Logs**: Look for architecture-specific error messages

## Migration Benefits

### From Universal Builds

- **Eliminated**: Native module conflicts
- **Improved**: Build reliability and speed
- **Enhanced**: User experience with clear architecture choice
- **Reduced**: File size per architecture (no dual binaries)

### From Cross-Compilation

- **Better**: Native module compatibility
- **Faster**: Build times on native hardware
- **More Reliable**: Consistent behavior across environments
- **Cleaner**: No cross-compilation toolchain complexity

## Future Considerations

- **Automatic Detection**: Web-based architecture detection for downloads
- **Smart Installer**: Future unified installer with architecture detection
- **Performance Monitoring**: Track performance differences between native builds
- **User Analytics**: Monitor download patterns and user preferences
