# Custom AudioTee Binary with Embedded Info.plist

This directory contains a **custom-built** `audiotee` binary with an **embedded Info.plist** that includes the critical `NSAudioCaptureUsageDescription` key.

## Why This is Needed

On **macOS 14.2+**, the Core Audio Taps API requires binaries to have:

1. ✅ Proper code signing with entitlements (`com.apple.security.device.screen-capture`)
2. ✅ **Embedded Info.plist with `NSAudioCaptureUsageDescription`** ← This is what the npm package lacks!

Without the embedded Info.plist, the Core Audio Taps API will:

- ✅ Start successfully
- ✅ Connect to audio devices
- ❌ **Return ALL-ZERO buffers** (silent audio)

This is exactly what was happening in production builds!

## Build Process

The binary in this directory was built using the script in `../custom-audiotee/build.sh`:

```bash
cd /Users/itsukison/Desktop/CueMe/CueMeFinal/custom-audiotee
./build.sh
```

The build process:

1. Clones the official audiotee repository
2. Creates an `Info.plist` with `NSAudioCaptureUsageDescription`
3. Updates `Package.swift` to embed the Info.plist using Swift linker flags
4. Builds a universal binary (x86_64 + arm64)
5. Verifies Info.plist embedding with `otool`

## Binary Info

- **Source**: https://github.com/makeusabrew/audiotee
- **License**: MIT
- **Size**: ~609KB (universal binary)
- **Architectures**: x86_64, arm64
- **Embedded Info.plist**: ✅ YES
- **Code Signing**: Applied during `afterPack.js` with app entitlements

## How It's Used

### Development

The `SystemAudioCapture.ts` class looks for binaries in this order:

1. **`custom-binaries/audiotee`** ← Custom binary (highest priority)
2. `node_modules/audiotee/bin/audiotee` (npm package - fallback)

### Production

During the build process (`npm run build`):

1. `custom-binaries/` is copied to the app bundle (via `package.json` files array)
2. `afterPack.js` hook signs the binary with proper entitlements
3. Binary is unpacked from asar (via `asarUnpack` in `package.json`)
4. App loads from `app.asar.unpacked/custom-binaries/audiotee`

## Rebuilding

If you need to rebuild the binary (e.g., for a new audiotee version):

```bash
# Navigate to custom-audiotee directory
cd ../custom-audiotee

# Pull latest changes
git pull origin main

# Rebuild
./build.sh

# Copy to project
cp build/audiotee ../custom-binaries/audiotee

# Verify embedding
otool -l ../custom-binaries/audiotee | grep -A 5 __info_plist
```

## Verification

To verify the binary has the embedded Info.plist:

```bash
# Check for __info_plist section
otool -l custom-binaries/audiotee | grep -c __info_plist

# Should return: 2 (one for each architecture)

# View the embedded plist content
otool -s __TEXT __info_plist custom-binaries/audiotee
```

## Testing

### Local Testing

```bash
# Test execution
./custom-binaries/audiotee --help

# Test audio capture (requires Screen Recording permission)
./custom-binaries/audiotee --sample-rate 16000
```

### Production Testing

After building your app:

```bash
# Check if binary is in the bundle
ls -lh /Applications/CueMe.app/Contents/Resources/app.asar.unpacked/custom-binaries/

# Verify signature
codesign -dv --entitlements - /Applications/CueMe.app/Contents/Resources/app.asar.unpacked/custom-binaries/audiotee

# Check Info.plist
otool -l /Applications/CueMe.app/Contents/Resources/app.asar.unpacked/custom-binaries/audiotee | grep __info_plist
```

## Troubleshooting

### Binary Not Found

- **Issue**: App can't find the custom binary
- **Solution**: Check `package.json` includes `custom-binaries/**/*` in `files` array

### All-Zero Audio Buffers

- **Issue**: Binary runs but produces silent audio
- **Solution**: Verify Info.plist is embedded using `otool`

### Permission Denied

- **Issue**: macOS blocks execution
- **Solution**:
  1. Grant Screen Recording permission in System Settings
  2. Check code signature: `codesign -dv path/to/binary`

### Binary Not Signed

- **Issue**: `afterPack.js` didn't sign the binary
- **Solution**: Check `APPLE_IDENTITY` or `CSC_NAME` environment variables

## License

This custom binary is built from the MIT-licensed audiotee project.
Original repository: https://github.com/makeusabrew/audiotee

The embedded Info.plist is a configuration file specific to this CueMe application.
