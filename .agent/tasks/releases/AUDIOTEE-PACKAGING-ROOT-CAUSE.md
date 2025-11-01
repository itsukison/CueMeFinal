# AudioTee Packaging Root Cause Analysis & Fix Plan

**Created:** 2025-11-01  
**Status:** 🔍 DIAGNOSED - Ready for Implementation  
**Severity:** CRITICAL - Affects all production builds

## 📋 Executive Summary

After analyzing the [AudioTee.js packaging guide](https://stronglytyped.uk/articles/packaging-shipping-electron-apps-audiotee) and comparing it with our current implementation, I've identified **3 CRITICAL MISCONFIGURATIONS** that explain why system audio works in dev but fails in production.

**The article prescribes a specific packaging approach that we are NOT following.**

---

## 🔬 Root Cause Analysis

### What the Article Says (Correct Approach)

From `packaging.md`:

```yaml
# electron-builder.yml
extraResources:
  - from: node_modules/audiotee/bin/audiotee
    to: audiotee # ← Places binary at Contents/Resources/audiotee
```

```javascript
// Runtime path resolution
function getBinaryPath(): string | undefined {
  if (process.resourcesPath) {
    return join(process.resourcesPath, 'audiotee')
  }
  return undefined
}
```

**Key points from the article:**

1. ✅ Binary MUST be in `Contents/Resources/` (via `extraResources`)
2. ✅ Binary MUST be outside ASAR archive (for `spawn()` to execute it)
3. ✅ Binary MUST have `com.apple.security.cs.disable-library-validation` entitlement
4. ✅ App MUST have `NSAudioCaptureUsageDescription` in `extendInfo`

---

### What We're Actually Doing (WRONG)

#### ❌ Problem #1: Binary in WRONG Location

**Current `package.json` (lines 126-138):**

```json
"extraResources": [
  ".env",
  {
    "from": "dist-native/",
    "to": "dist-native/",
    "filter": ["**/*"]
  },
  {
    "from": "dist-helper/AudioTeeHelper.app",
    "to": "Library/LoginItems/AudioTeeHelper.app"
  }
],
"asarUnpack": [
  "custom-binaries/**"
]
```

**What this does:**

- ❌ Audiotee binary ends up in `app.asar.unpacked/custom-binaries/audiotee` (NOT directly in Resources/)
- ❌ The article's recommended path (`Contents/Resources/audiotee`) is NOT used

**Verification from installed app:**

```bash
$ ls -la /Applications/CueMe.app/Contents/Resources/
-rw-r--r--  app.asar
drwxr-xr-x  app.asar.unpacked  # ← Binary is INSIDE this nested directory
```

**Why this matters:**

- The article explicitly states the binary should be **directly** in `Contents/Resources/`
- Our current path (`app.asar.unpacked/custom-binaries/audiotee`) adds unnecessary nesting
- This affects runtime path resolution and may confuse macOS permission system

---

#### ❌ Problem #2: We Copied `binaryPath` Logic, BUT Look Up WRONG Path

**Current `SystemAudioCapture.ts` (lines 438-466):**

```typescript
private findHelperApp(): string {
  const possiblePaths = [
    // Production: Inside Resources (electron-builder extraResources location)
    path.join(
      process.resourcesPath,
      "Library",
      "LoginItems",
      "AudioTeeHelper.app",  // ← Looking for HELPER APP
      "Contents",
      "MacOS",
      "audiotee"
    ),
    // ...
    // Fallback: Old custom binary location (for testing)
    path.join(process.resourcesPath, "app.asar.unpacked", "custom-binaries", "audiotee"),
  ];
  // ...
}
```

**The article's approach:**

```typescript
// SIMPLE, DIRECT PATH (as prescribed by article)
function getBinaryPath(): string | undefined {
  if (process.resourcesPath) {
    return join(process.resourcesPath, "audiotee"); // ← DIRECTLY in Resources/
  }
  return undefined;
}
```

**Why this matters:**

- We're trying to use a **Helper App bundle** (`AudioTeeHelper.app`) when the article uses a **plain binary**
- The Helper App approach is more complex and introduces extra failure points
- The article's approach is simpler and PROVEN to work

---

#### ❌ Problem #3: Missing `NSAudioCaptureUsageDescription` in `extendInfo`

**Article requirement (from `packaging.md`):**

```yaml
mac:
  entitlementsInherit: build/entitlements.mac.plist
  extendInfo:
    NSMicrophoneUsageDescription: Your app needs microphone access to record audio.
    NSAudioCaptureUsageDescription: Your app needs system audio access to record audio. # ← CRITICAL
```

**Current `package.json` (lines 81-84):**

```json
"extendInfo": {
  "NSMicrophoneUsageDescription": "CueMe needs microphone access...",
  "NSScreenCaptureDescription": "CueMe uses screen recording..."  // ← WRONG KEY!
}
```

**Why this matters:**

- We have `NSScreenCaptureDescription` but **NOT** `NSAudioCaptureUsageDescription`
- AudioTee.js uses **Core Audio Taps**, which requires `NSAudioCaptureUsageDescription`
- Without this key, macOS may silently deny audio access to the binary

**Verification:**

```bash
# Check our app's Info.plist
$ defaults read /Applications/CueMe.app/Contents/Info.plist NSAudioCaptureUsageDescription
# FAILS - Key not found!
```

---

#### ❌ Problem #4: Entitlements Mismatch (Partial Fix, But Not Following Article)

**Article requirement:**

```xml
<!-- From packaging.md -->
<key>com.apple.security.cs.disable-library-validation</key>
<true/>
<key>com.apple.security.device.audio-input</key>
<true/>
```

**Current `entitlements.mac.plist`:**

```xml
<!-- ✅ We HAVE this -->
<key>com.apple.security.cs.disable-library-validation</key>
<true/>

<!-- ✅ We HAVE this -->
<key>com.apple.security.device.audio-input</key>
<true/>

<!-- ⚠️ But we ALSO have these (not mentioned in article) -->
<key>com.apple.security.device.screen-capture</key>
<true/>
<key>com.apple.security.app-sandbox</key>
<false/>
```

**Entitlements verification from installed app:**

```bash
$ codesign -dvvv --entitlements - /Applications/CueMe.app/Contents/Resources/app.asar.unpacked/custom-binaries/audiotee
[Dict]
    [Key] com.apple.security.cs.allow-jit
    [Value] [Bool] true
    [Key] com.apple.security.cs.allow-unsigned-executable-memory
    [Value] [Bool] true
    [Key] com.apple.security.cs.disable-library-validation
    [Value] [Bool] true
    # ❌ MISSING: com.apple.security.device.audio-input
    # ❌ MISSING: NSAudioCaptureUsageDescription (not in binary's entitlements)
```

**Why this matters:**

- The binary is signed with SOME entitlements, but **NOT** `audio-input`
- This suggests our `afterPack.js` is signing the binary, but **NOT** with the FULL set of required entitlements
- The article explicitly states: "Entitlements grant your app the capability"

---

## 🎯 The Actual Problem (Synthesis)

Combining all findings:

1. **Binary is packaged in the WRONG location** (nested in `app.asar.unpacked` instead of directly in `Resources/`)
2. **Runtime code looks for the binary in WRONG paths** (Helper App bundle instead of simple binary path)
3. **Missing required macOS permission key** (`NSAudioCaptureUsageDescription` not in app's Info.plist)
4. **Binary is signed with INCOMPLETE entitlements** (missing `audio-input` despite it being in our plist)

**Result:** The binary runs, but macOS **silently denies** Core Audio Taps access, producing **silent buffers (all zeros)**.

---

## 🔧 Fix Plan (Following Article EXACTLY)

### Step 1: Simplify Binary Packaging (Follow Article)

**Remove Helper App complexity, use direct binary packaging as prescribed:**

```json
// package.json - REPLACE extraResources section
"extraResources": [
  ".env",
  {
    "from": "node_modules/audiotee/bin/audiotee",  // ← Use npm binary OR
    "to": "audiotee"                                 //   our custom-built binary
  }
],
// REMOVE asarUnpack (not needed per article)
```

**Alternative (if we want custom binary with Info.plist):**

```json
"extraResources": [
  ".env",
  {
    "from": "custom-binaries/audiotee",  // ← Our custom-built binary
    "to": "audiotee"
  }
]
```

---

### Step 2: Fix Runtime Path Resolution (Follow Article)

**Replace complex `findHelperApp()` with article's simple approach:**

```typescript
// SystemAudioCapture.ts - REPLACE findHelperApp() method
private getAudioteeBinaryPath(): string | undefined {
  // Follow article's exact pattern
  if (process.resourcesPath) {
    return path.join(process.resourcesPath, 'audiotee');
  }

  // Dev mode: use custom binary
  if (!app.isPackaged) {
    return path.join(process.cwd(), 'custom-binaries', 'audiotee');
  }

  return undefined;
}

// Update startMacOSSystemAudioCapture() to use new method
private async startMacOSSystemAudioCapture(): Promise<void> {
  const binaryPath = this.getAudioteeBinaryPath();

  if (!binaryPath || !fs.existsSync(binaryPath)) {
    throw new Error('audiotee binary not found at: ' + binaryPath);
  }

  // ... rest of method unchanged
  this.audioTeeProcess = spawn(binaryPath, args, { /* ... */ });
}
```

---

### Step 3: Add Required Info.plist Keys (Follow Article)

**Add `NSAudioCaptureUsageDescription` to `package.json`:**

```json
// package.json - UPDATE extendInfo
"extendInfo": {
  "NSMicrophoneUsageDescription": "CueMe needs microphone access to listen for interview questions and provide real-time coding assistance.",
  "NSAudioCaptureUsageDescription": "CueMe needs system audio access to capture audio from video calls (Zoom, Teams, etc.) for better interview question detection.",  // ← ADD THIS
  "NSScreenCaptureDescription": "CueMe uses screen recording to capture system audio from video calls (Zoom, Teams, etc.) for better interview question detection. No visual recording is performed - only audio is captured."
}
```

---

### Step 4: Verify Entitlements (Article Compliance)

**Ensure `entitlements.mac.plist` has ALL required keys:**

```xml
<!-- entitlements.mac.plist - VERIFY these exist -->
<key>com.apple.security.cs.allow-jit</key>
<true/>
<key>com.apple.security.device.audio-input</key>
<true/>
<key>com.apple.security.cs.disable-library-validation</key>
<true/>

<!-- Optional but good to keep for screen recording permission -->
<key>com.apple.security.device.screen-capture</key>
<true/>
```

---

### Step 5: Simplify afterPack.js (Remove Helper App Logic)

**Update `afterPack.js` to sign binary at NEW location:**

```javascript
// afterPack.js - UPDATE binary path
const binaryPath = path.join(
  resourcesPath,
  "audiotee" // ← NEW LOCATION (directly in Resources/)
);

if (!fs.existsSync(binaryPath)) {
  console.error("❌ audiotee binary not found at:", binaryPath);
  return;
}

// Sign with FULL entitlements (keep existing signing logic)
const entitlementsPath = path.join(
  process.cwd(),
  "assets",
  "entitlements.mac.plist"
);
const signCommand = `codesign --force --sign "${identity}" --options runtime --entitlements "${entitlementsPath}" --timestamp "${binaryPath}"`;
execSync(signCommand, { stdio: "inherit" });
```

---

### Step 6: Remove Helper App Build Scripts (Simplify)

**Delete or disable helper app build (no longer needed):**

```json
// package.json - REMOVE from build script
"build": "npm run clean && npm run build:native && tsc -p electron/tsconfig.json && vite build",
// REMOVE: npm run build:helper
```

---

## ✅ Expected Outcome

After implementing these changes:

1. ✅ Binary will be at `Contents/Resources/audiotee` (article-compliant path)
2. ✅ Runtime code will find binary via simple path resolution (article-compliant logic)
3. ✅ App's Info.plist will have `NSAudioCaptureUsageDescription` (macOS permission prompt)
4. ✅ Binary will be signed with correct entitlements (including `audio-input`)
5. ✅ macOS will grant Core Audio Taps access (no more silent buffers!)

---

## 🧪 Verification Steps (Post-Fix)

```bash
# 1. Verify binary location
ls -la /Applications/CueMe.app/Contents/Resources/audiotee
# Should exist (not in app.asar.unpacked)

# 2. Verify binary signature
codesign -dvvv --entitlements - /Applications/CueMe.app/Contents/Resources/audiotee
# Should show: com.apple.security.device.audio-input = true

# 3. Verify app Info.plist
defaults read /Applications/CueMe.app/Contents/Info.plist NSAudioCaptureUsageDescription
# Should output: "CueMe needs system audio access..."

# 4. Verify binary execution
/Applications/CueMe.app/Contents/Resources/audiotee --help
# Should output help text (no permission errors)

# 5. Test audio capture
# Run app, enable system audio, speak/play audio
# Check logs for non-zero audio buffers (not all zeros)
```

---

## 📚 References

- **Primary Source:** [Packaging Electron Apps with AudioTee.js](https://stronglytyped.uk/articles/packaging-shipping-electron-apps-audiotee)
- **AudioTee.js GitHub:** https://github.com/gfodor/audiotee
- **Related Issue:** v1.0.106-DEFINITIVE-FIX.md (previous incomplete fix)

---

## 🚀 Implementation Priority

**CRITICAL - Must fix before next release**

This is not a "maybe" or "nice to have" - the article provides a PROVEN, WORKING approach that we are NOT following. Every deviation from the article's prescription is a potential failure point.

**Estimated effort:** 2-3 hours (mostly config changes, minimal code changes)

**Risk level:** LOW (we're moving TOWARD a proven approach, not inventing new solutions)

---

## 💡 Key Insight

**We were over-engineering the solution.** The Helper App approach added unnecessary complexity. The article's simple approach (binary directly in Resources, simple path resolution) is what actually works. Sometimes the best fix is to **simplify and follow the documentation**.
