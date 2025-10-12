# Quick Release Guide

## 🚀 How to Release CueMe with Working System Audio

### **TL;DR**: Yes, system audio WILL work in production! ✅

---

## 📦 Release Process (3 Steps)

### **1. Build**
```bash
npm run app:build:mac
```

This creates:
- `release/CueMe-1.0.53.dmg` (Universal)
- `release/CueMe-1.0.53-arm64.dmg` (Apple Silicon - Recommended)

### **2. Test**
```bash
# Mount the DMG
open release/CueMe-1.0.53-arm64.dmg

# Install and test:
# - Grant Screen Recording permission
# - Test system audio with YouTube
```

### **3. Release**

**Option A: Manual Upload**
1. Go to https://github.com/itsukison/CueMeFinal/releases/new
2. Create new release (e.g., `v1.0.53`)
3. Upload DMG files
4. Publish!

**Option B: Automated**
```bash
git tag v1.0.53
git push origin v1.0.53
npm run release
```

---

## ✅ Why System Audio Works in Production

| Issue | Development | Production |
|-------|------------|------------|
| **Code Signature** | Changes every build | Stable |
| **Permissions** | Get revoked | Persist ✅ |
| **System Audio** | Unreliable ⚠️ | Works reliably ✅ |

**Key Points:**
- ✅ Swift binary has proper entitlements
- ✅ AfterPack hook signs binary correctly
- ✅ App bundle includes all needed permissions
- ✅ Users just need to grant Screen Recording permission once

---

## 🎯 What Users Experience

1. **Download** DMG from GitHub
2. **Install** to Applications folder
3. **First Launch**: Right-click → Open (if no Apple cert)
4. **Grant Permission**: Screen Recording when prompted
5. **System Audio Works!** 🎉

---

## 🔧 Quick Troubleshooting

**If system audio doesn't work:**

```bash
# Check binary exists
ls -la release/mac/CueMe.app/Contents/Resources/dist-native/SystemAudioCapture

# Verify it's executable
# Should show: -rwxr-xr-x
```

**User troubleshooting:**
- Open System Settings → Privacy & Security → Screen Recording
- Ensure CueMe is enabled
- Restart CueMe

---

## 📝 Pre-Release Checklist

- [ ] Update version in `package.json`
- [ ] Test production build locally
- [ ] Verify system audio works
- [ ] Commit changes
- [ ] Create GitHub release
- [ ] Upload DMG files

---

**Need more details?** See [`PRODUCTION_DEPLOYMENT_CHECKLIST.md`](./PRODUCTION_DEPLOYMENT_CHECKLIST.md)
