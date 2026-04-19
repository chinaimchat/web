#!/bin/bash

# Debug script to analyze the build structure and find app binaries
# This helps troubleshoot the "No app binaries found for verification" issue

set -e

echo "🔍 Debug Build Structure Analysis"
echo "================================="

# Check if we're in the right directory
if [[ ! -f "package.json" ]]; then
    echo "❌ Error: This script must be run from the apps/web directory"
    echo "Current directory: $(pwd)"
    exit 1
fi

echo "📁 Current directory: $(pwd)"
echo ""

# Check if dist-ele exists
if [[ -d "dist-ele" ]]; then
    echo "✅ dist-ele directory exists"
    echo "📊 Directory size: $(du -sh dist-ele | cut -f1)"
    echo ""
    
    echo "📁 Top-level contents of dist-ele:"
    ls -la dist-ele/
    echo ""
    
    echo "🔍 Searching for .app bundles:"
    APP_BUNDLES=$(find dist-ele -name "*.app" -type d 2>/dev/null)
    
    if [[ -n "$APP_BUNDLES" ]]; then
        echo "📱 Found .app bundles:"
        echo "$APP_BUNDLES"
        echo ""
        
        # Analyze each app bundle
        while IFS= read -r app_bundle; do
            echo "🔍 Analyzing: $app_bundle"
            echo "  📊 Size: $(du -sh "$app_bundle" | cut -f1)"
            
            # Check Contents directory
            contents_dir="$app_bundle/Contents"
            if [[ -d "$contents_dir" ]]; then
                echo "  ✅ Contents directory exists"
                
                # List Contents structure
                echo "  📂 Contents structure:"
                ls -la "$contents_dir" | sed 's/^/    /'
                
                # Check MacOS directory
                macos_dir="$contents_dir/MacOS"
                if [[ -d "$macos_dir" ]]; then
                    echo "  ✅ MacOS directory exists"
                    echo "  📂 MacOS contents:"
                    ls -la "$macos_dir" | sed 's/^/    /'
                    
                    # Check each binary
                    for binary in "$macos_dir"/*; do
                        if [[ -f "$binary" && -x "$binary" ]]; then
                            echo "  🔍 Binary: $(basename "$binary")"
                            echo "    📊 Size: $(ls -lh "$binary" | awk '{print $5}')"
                            echo "    🏗️  Architecture:"
                            lipo -info "$binary" 2>/dev/null | sed 's/^/      /' || echo "      ⚠️ Could not read architecture info"
                            echo "    🔍 File type:"
                            file "$binary" | sed 's/^/      /'
                        fi
                    done
                else
                    echo "  ❌ MacOS directory not found"
                fi
                
                # Check Info.plist
                info_plist="$contents_dir/Info.plist"
                if [[ -f "$info_plist" ]]; then
                    echo "  ✅ Info.plist exists"
                    echo "  📄 Bundle identifier:"
                    plutil -p "$info_plist" | grep CFBundleIdentifier | sed 's/^/    /' || echo "    ⚠️ Could not read bundle identifier"
                else
                    echo "  ❌ Info.plist not found"
                fi
            else
                echo "  ❌ Contents directory not found"
                echo "  📂 App bundle structure:"
                ls -la "$app_bundle" | sed 's/^/    /'
            fi
            echo ""
        done <<< "$APP_BUNDLES"
    else
        echo "❌ No .app bundles found"
    fi
    
    echo "🔍 Searching for DMG files:"
    DMG_FILES=$(find dist-ele -name "*.dmg" -type f 2>/dev/null)
    
    if [[ -n "$DMG_FILES" ]]; then
        echo "💿 Found DMG files:"
        while IFS= read -r dmg_file; do
            echo "  📀 $(basename "$dmg_file")"
            echo "    📊 Size: $(ls -lh "$dmg_file" | awk '{print $5}')"
        done <<< "$DMG_FILES"
    else
        echo "❌ No DMG files found"
    fi
    echo ""
    
    echo "📊 Complete file tree (first 50 items):"
    find dist-ele -type f | head -50 | sed 's/^/  /'
    
else
    echo "❌ dist-ele directory not found"
    echo ""
    echo "💡 Suggestions:"
    echo "  1. Run a build first: yarn build-ele:mac-x64 or yarn build-ele:mac-arm64"
    echo "  2. Check if the build completed successfully"
    echo "  3. Verify electron-builder configuration"
fi

echo ""
echo "🔧 Build Environment Info:"
echo "  Node.js: $(node --version 2>/dev/null || echo 'Not found')"
echo "  npm: $(npm --version 2>/dev/null || echo 'Not found')"
echo "  yarn: $(yarn --version 2>/dev/null || echo 'Not found')"
echo "  System: $(uname -a)"

if command -v lipo >/dev/null 2>&1; then
    echo "  ✅ lipo command available"
else
    echo "  ❌ lipo command not available (required for architecture verification)"
fi

echo ""
echo "🎯 Next Steps:"
echo "  1. If no .app bundles found, check the build logs for errors"
echo "  2. If .app bundles exist but no MacOS directory, check electron-builder config"
echo "  3. If binaries exist but lipo fails, check file permissions and format"
echo "  4. Compare with a successful local build to identify differences"
