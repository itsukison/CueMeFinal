# 🔧 CueMe Permission Fix - Quick Start Guide

Your permission issues have been diagnosed and comprehensive fixes have been implemented! Follow these steps to resolve the system audio problems:

## 🎯 **Root Cause Identified**

The system audio button is unclickable because:
- **Development builds have unstable code signatures** that change with each rebuild
- **macOS TCC treats each rebuild as a \"new app\"** and revokes permissions
- **Even granted permissions aren't detected** due to signature mismatches

## ⚡ **Quick Fix (2 minutes)**

### Step 1: Fix Development Signature
```bash
./scripts/sign-electron-dev.sh
```
This applies a stable signature (`com.cueme.electron.dev`) that persists across rebuilds.

### Step 2: Grant Screen Recording Permission
1. **macOS may prompt for permission** - click \"Allow\"
2. **If no prompt**: Open System Settings → Privacy & Security → Screen Recording
3. **Find \"com.cueme.electron.dev\"** (or Electron) and enable it
4. **Important**: The app name might show as \"Electron\" initially

### Step 3: Restart CueMe and Test
1. **Restart the CueMe app**
2. **Check Audio Settings** - System audio should now be clickable
3. **Test with a YouTube video** to verify system audio capture

## 🔍 **If Issues Persist**

### Run Full Diagnostic
```bash
./scripts/diagnose-permissions.sh
```
This provides detailed analysis and specific fix recommendations.

### Alternative Solutions

#### Option A: Use Production Build (Most Reliable)
```bash
./scripts/run-production-for-audio.sh
```
Production builds have proper signatures and work reliably.

#### Option B: Nuclear Reset (Last Resort)
```bash
./scripts/nuclear-permission-reset.sh
```
Clears all permission state and forces a fresh start.

## 🎯 **What Was Fixed**

1. ✅ **Stable Development Signatures** - Prevents permission loss between builds
2. ✅ **Enhanced Permission Detection** - Better detection of actual system audio capability
3. ✅ **Comprehensive Diagnostics** - Detailed analysis and troubleshooting
4. ✅ **Automated Recovery Tools** - Scripts to fix common issues
5. ✅ **Enhanced UI Feedback** - Better error messages and user guidance

## 🚀 **For Future Development**

- **Development mode**: Use stable signature (already applied)
- **System audio testing**: Use production builds for reliability
- **Permission issues**: Run diagnostic script first
- **Major rebuilds**: Re-run `./scripts/sign-electron-dev.sh` if needed

## 📞 **Need Help?**

If you're still having issues:
1. **Run the diagnostic tool**: `./scripts/diagnose-permissions.sh`
2. **Check the terminal output** for specific recommendations
3. **Try the production build**: Most reliable for system audio

---

## 🔧 **Technical Summary**

**Root Cause**: Unstable adhoc code signatures in development builds causing TCC permission database confusion.

**Solution**: Applied stable development signature (`com.cueme.electron.dev`) + enhanced permission detection logic + comprehensive recovery tools.

**Result**: System audio button should now be clickable and permissions should persist across development builds.

---

**✅ Permission fix complete! The system audio button should now work properly.**