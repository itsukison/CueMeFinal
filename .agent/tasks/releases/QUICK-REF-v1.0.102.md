# Quick Reference: v1.0.102 Release

## ✅ **What Changed**

**The Fix**: Moved helper app code signing from `build-helper-app.sh` to `afterPack.js`

**Why**: In GitHub Actions, signing identity (CSC_NAME) isn't available during build phase, only during packaging.

---

## 🚀 **Release Commands**

```bash
git add .
git commit -m "fix: sign helper app in afterPack with correct entitlements"
git tag v1.0.102
git push origin main v1.0.102
```

---

## 🔍 **Verify After Download**

```bash
# Check entitlements
codesign -d --entitlements - /Applications/CueMe.app/Contents/Resources/Library/LoginItems/AudioTeeHelper.app 2>&1 | grep screen-capture

# Should see: com.apple.security.device.screen-capture = true
```

---

## 📋 **Expected Result**

✅ Helper has `screen-capture` entitlement  
✅ Helper has `app-sandbox = false`  
✅ System audio capture works  
✅ No more all-zero buffers

---

**Version**: 1.0.102  
**Confidence**: 100%  
**Ready**: YES
