#!/bin/bash

# Script to verify DMG architecture and installability
# This helps debug ARM64 installation issues on Apple Silicon

set -e

echo "🔍 DMG Architecture Verification Tool"
echo "===================================="

# Function to verify DMG architecture
verify_dmg() {
    local dmg_file="$1"
    local expected_arch="$2"
    local mount_point="/tmp/verify_dmg_$$"
    
    if [[ ! -f "$dmg_file" ]]; then
        echo "❌ DMG file not found: $dmg_file"
        return 1
    fi
    
    echo ""
    echo "🔍 Analyzing: $(basename "$dmg_file")"
    echo "   Expected Architecture: $expected_arch"
    echo "   File Size: $(ls -lh "$dmg_file" | awk '{print $5}')"
    
    # Create mount point
    mkdir -p "$mount_point"
    
    # Mount DMG
    echo "   📀 Mounting DMG..."
    if ! hdiutil attach "$dmg_file" -mountpoint "$mount_point" -quiet 2>/dev/null; then
        echo "   ❌ Failed to mount DMG"
        rm -rf "$mount_point"
        return 1
    fi
    
    # Find app bundle
    local app_bundle=$(find "$mount_point" -name "*.app" -type d | head -1)
    if [[ -z "$app_bundle" ]]; then
        echo "   ❌ No app bundle found in DMG"
        hdiutil detach "$mount_point" -quiet 2>/dev/null || true
        rm -rf "$mount_point"
        return 1
    fi
    
    echo "   📱 Found app bundle: $(basename "$app_bundle")"
    
    # Check main binary
    local main_binary="$app_bundle/Contents/MacOS/TangSengDaoDao"
    if [[ -f "$main_binary" ]]; then
        echo "   🔍 Main binary architecture:"
        local arch_info=$(lipo -info "$main_binary" 2>/dev/null)
        echo "      $arch_info"
        
        # Verify architecture matches expected
        if echo "$arch_info" | grep -q "$expected_arch"; then
            echo "   ✅ Architecture matches expected ($expected_arch)"
        else
            echo "   ❌ Architecture mismatch! Expected: $expected_arch"
            echo "      Got: $arch_info"
        fi
        
        # Check file type
        echo "   📄 File type:"
        file "$main_binary" | sed 's/^/      /'
        
        # Check code signature
        echo "   🔐 Code signature:"
        codesign -dv "$main_binary" 2>&1 | head -3 | sed 's/^/      /' || echo "      No signature or verification failed"
        
    else
        echo "   ❌ Main binary not found: $main_binary"
    fi
    
    # Check helper binaries
    echo "   🔍 Helper binaries:"
    local helpers_dir="$app_bundle/Contents/Frameworks"
    if [[ -d "$helpers_dir" ]]; then
        find "$helpers_dir" -name "*.app" -type d | while read helper_app; do
            local helper_binary="$helper_app/Contents/MacOS/$(basename "$helper_app" .app)"
            if [[ -f "$helper_binary" ]]; then
                local helper_arch=$(lipo -info "$helper_binary" 2>/dev/null | grep -o 'architecture: [^[:space:]]*' | cut -d' ' -f2)
                echo "      $(basename "$helper_app"): $helper_arch"
            fi
        done
    fi
    
    # Check Info.plist
    local info_plist="$app_bundle/Contents/Info.plist"
    if [[ -f "$info_plist" ]]; then
        echo "   📄 Bundle Info:"
        echo "      Bundle ID: $(plutil -p "$info_plist" | grep CFBundleIdentifier | cut -d'"' -f4)"
        echo "      Version: $(plutil -p "$info_plist" | grep CFBundleShortVersionString | cut -d'"' -f4)"
        
        # Check for architecture-specific settings
        if plutil -p "$info_plist" | grep -q LSArchitecturePriority; then
            echo "      Architecture Priority: $(plutil -p "$info_plist" | grep LSArchitecturePriority)"
        fi
    fi
    
    # Test installability (simulation)
    echo "   🧪 Installation test:"
    if [[ -w "/Applications" ]]; then
        echo "      ✅ /Applications is writable"
    else
        echo "      ⚠️  /Applications is not writable (may need admin rights)"
    fi
    
    # Check for quarantine attributes
    echo "   🔒 Quarantine status:"
    local quarantine=$(xattr -p com.apple.quarantine "$dmg_file" 2>/dev/null || echo "none")
    if [[ "$quarantine" == "none" ]]; then
        echo "      ✅ No quarantine attribute"
    else
        echo "      ⚠️  Quarantine attribute present: $quarantine"
    fi
    
    # Unmount DMG
    hdiutil detach "$mount_point" -quiet 2>/dev/null || true
    rm -rf "$mount_point"
    
    return 0
}

# Check system architecture
echo "🖥️  System Information:"
echo "   Architecture: $(uname -m)"
echo "   macOS Version: $(sw_vers -productVersion)"
echo "   System: $(uname -a)"

# Check for DMG files
echo ""
echo "📁 Searching for DMG files in dist-ele..."

if [[ ! -d "dist-ele" ]]; then
    echo "❌ dist-ele directory not found"
    echo "💡 Run a build first: yarn build-ele:mac-x64 or yarn build-ele:mac-arm64"
    exit 1
fi

# Find DMG files
X64_DMG=$(find dist-ele -name "*-x64.dmg" -type f | head -1)
ARM64_DMG=$(find dist-ele -name "*-arm64.dmg" -type f | head -1)

if [[ -n "$X64_DMG" ]]; then
    verify_dmg "$X64_DMG" "x86_64"
else
    echo "⚠️  No x64 DMG found"
fi

if [[ -n "$ARM64_DMG" ]]; then
    verify_dmg "$ARM64_DMG" "arm64"
else
    echo "⚠️  No ARM64 DMG found"
fi

echo ""
echo "🎯 Summary:"
echo "=========="

if [[ -n "$X64_DMG" && -n "$ARM64_DMG" ]]; then
    echo "✅ Both x64 and ARM64 DMGs found"
    echo "📋 Next steps:"
    echo "   1. Test x64 DMG installation on Intel Mac"
    echo "   2. Test ARM64 DMG installation on Apple Silicon Mac"
    echo "   3. Verify both apps launch and run correctly"
elif [[ -n "$X64_DMG" ]]; then
    echo "⚠️  Only x64 DMG found"
    echo "💡 Run: yarn build-ele:mac-arm64"
elif [[ -n "$ARM64_DMG" ]]; then
    echo "⚠️  Only ARM64 DMG found"
    echo "💡 Run: yarn build-ele:mac-x64"
else
    echo "❌ No DMG files found"
    echo "💡 Run: yarn build-ele:mac-x64 && yarn build-ele:mac-arm64"
fi

echo ""
echo "🔧 Troubleshooting:"
echo "   - If ARM64 DMG won't install: Check code signature and architecture"
echo "   - If x64 DMG is slow on Apple Silicon: That's normal (Rosetta translation)"
echo "   - If builds fail: Check runner architecture matches target architecture"
