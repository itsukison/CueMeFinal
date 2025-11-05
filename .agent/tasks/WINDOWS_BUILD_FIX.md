# Windows/Linux Build Fix

## Problem
Windows and Linux builds fail in GitHub Actions because they try to run `npm run build` which includes `npm run build:native`. This script requires Swift/Xcode (macOS-only tools).

**Error:**
```
❌ Error: Swift compiler not found
Please install Xcode Command Line Tools:
xcode-select --install
Error: Process completed with exit code 1.
```

## Root Cause
- `package.json` has `build:win` script that skips native build
- But GitHub Actions workflow calls `npm run build` for all platforms
- `npm run build` includes `build:native` which fails on Windows/Linux

## Solution
Use platform-specific build commands in the GitHub Actions workflow:
- **macOS**: `npm run build` (includes native Swift binary build)
- **Windows**: `npm run build:win` (skips native build)
- **Linux**: `npm run build:linux` (skips native build, new script)

## Changes Made

### 1. package.json
- Added `build:linux` script (same as `build:win`)

### 2. .github/workflows/release.yml
- Updated "Build and release" step to use conditional build commands
- macOS continues with full build process (native + signing + notarization)
- Windows/Linux use simplified build (no native binary)

## Testing
- Workflow matrix already tests all three platforms
- Each platform now uses appropriate build command
- macOS build process unchanged (no risk of breaking)

## Status
✅ Implemented - Ready for testing

## Implementation Details

### package.json Changes
1. Added `build:linux` script that skips native binary build (line 9)
2. Updated `app:build:linux` to use `build:linux` instead of `build` (line 19)

### release.yml Changes
1. Modified "Build and release Electron app" step to use conditional build commands
2. macOS: `npm run build` (includes native Swift binary)
3. Windows: `npm run build:win` (skips native binary)
4. Linux: `npm run build:linux` (skips native binary)

## Verification
- No TypeScript/JSON syntax errors
- macOS build process unchanged (preserves code signing & notarization)
- Windows/Linux builds no longer attempt Swift compilation

## Next Steps
1. Push changes to repository
2. Create a new tag to trigger release workflow
3. Verify all three platforms build successfully

## Related Files
- `CueMeFinal/package.json` - Added build:linux script
- `CueMeFinal/.github/workflows/release.yml` - Platform-specific build commands
- `CueMeFinal/scripts/build-native-binary.sh` (macOS only, unchanged)
