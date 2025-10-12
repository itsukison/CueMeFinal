# System Audio Permission Issue - Solutions

## Root Cause
Development Electron apps use adhoc signatures that CHANGE between builds.
macOS TCC sees each build as a "different app" and revokes Screen Recording permission.

## Solution 1: Stable Code Signature (BEST)

Create `scripts/sign-electron-dev.sh`:
```bash
#!/bin/bash
ELECTRON_APP="./node_modules/electron/dist/Electron.app"

codesign --force --deep --sign - \
  --identifier "com.cueme.electron.dev" \
  "$ELECTRON_APP"

echo "✅ Signed. Now grant permission in System Settings → Screen Recording"
echo "   Add: $ELECTRON_APP"
```

Run before each dev session:
```bash
chmod +x scripts/sign-electron-dev.sh
./scripts/sign-electron-dev.sh
```

Then grant permission ONCE in System Settings → Privacy → Screen Recording.

## Solution 2: Use Production Build

```bash
npm run build
open dist/mac/CueMe.app
```

Production builds have stable signatures.

## Solution 3: Request Permission Every Time

Accept that you'll need to re-grant permission after each rebuild:
1. Run app
2. When system audio fails, open System Settings → Screen Recording  
3. Remove and re-add Electron.app
4. Restart app

## Solution 4: Reset Permissions

```bash
tccutil reset ScreenCapture
```

Then restart app and grant permission when prompted.

## Recommended
Use **Solution 1** for development, **Solution 2** for testing.
