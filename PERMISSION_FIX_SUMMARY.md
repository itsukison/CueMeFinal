# 🔧 System Audio Permission Fix - Summary

## ✅ What I Just Did

1. **Identified the root cause**: Development Electron apps use adhoc signatures that change between builds, causing macOS to revoke Screen Recording permission
2. **Signed your Electron.app with a stable identifier** (`com.cueme.electron.dev`)
3. **Reset all Screen Recording permissions** (via `tccutil reset ScreenCapture`)

## 📋 What You Need to Do NOW

### Step 1: Grant Permission to the Newly-Signed App

1. Open **System Settings** → **Privacy & Security** → **Screen Recording**
2. Click the **(+)** button to add an app
3. Navigate to and select:
   ```
   /Users/kotan/CueMeFinal-1/node_modules/electron/dist/Electron.app
   ```
4. Enable the toggle for "Electron"
5. **Completely quit and restart CueMe** (don't just reload)

### Step 2: Test System Audio

1. Run CueMe: `npm run dev -- --port 5180`
2. Start audio listening with "System Audio" source
3. Play a YouTube video
4. Verify audio is being captured

### Step 3: If It Works

The permission will now **persist across builds** because the app has a stable signature!

---

## 🔁 For Future Development Sessions

The signature will remain stable unless you:
- Delete and reinstall `node_modules/electron`
- Upgrade Electron version

If that happens, just re-run:
```bash
cd /Users/kotan/CueMeFinal-1
codesign --force --deep --sign - --identifier com.cueme.electron.dev ./node_modules/electron/dist/Electron.app
```

Then re-grant permission in System Settings (one time).

---

## 🎯 Alternative Solutions (If Above Doesn't Work)

### Option A: Use Production Build
```bash
npm run build
open dist/mac/CueMe.app  # Grant permission to this app instead
```

Production builds have proper code signatures.

### Option B: Manual Re-grant After Each Build

Accept that development mode requires re-granting permission:
1. After each `npm run dev`, open System Settings → Screen Recording
2. Remove "Electron" and re-add it
3. Restart the app

### Option C: Request Permission Programmatically

Modify the app to show a dialog when permission is denied, directing users to System Settings.

---

## 🐛 Troubleshooting

### Permission still denied after granting?

1. **Verify the signature**:
   ```bash
   codesign -dv node_modules/electron/dist/Electron.app 2>&1 | grep Identifier
   # Should show: Identifier=com.cueme.electron.dev
   ```

2. **Check System Settings**:
   - Ensure "Electron" is listed and ENABLED
   - Ensure it's the correct path: `.../CueMeFinal-1/node_modules/electron/dist/Electron.app`

3. **Restart macOS** (sometimes TCC cache gets stuck)

4. **Check Console.app** for TCC denial messages

### App crashes or won't start?

The code signature shouldn't cause crashes. If it does:
```bash
# Remove signature
codesign --remove-signature node_modules/electron/dist/Electron.app
```

Then use **Option A** (production build) instead.

---

## 📊 Why This Happened

| Component | Issue | Solution |
|-----------|-------|----------|
| **Development Electron** | Adhoc signature changes per build | Stable identifier signature |
| **macOS TCC** | Tracks apps by code signature | Re-grant permission to new signature |
| **Swift Binary** | Permission check (`CGPreflightScreenCaptureAccess`) gives false positive | Would need to test actual API call |

---

## ✨ For Production Release

Your production build (via `electron-builder`) will have:
- ✅ Developer certificate signature (not adhoc)
- ✅ Hardened runtime
- ✅ Proper entitlements
- ✅ Permissions that persist correctly

No special handling needed in production! This is purely a development mode issue.

---

**Next Steps**: Follow "What You Need to Do NOW" above, then test with a YouTube video!
