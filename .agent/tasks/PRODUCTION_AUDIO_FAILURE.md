# Production Audio Failure Investigation & Fix

**Status:** � Ro ot Cause Identified - Fix Ready  
**Priority:** Critical  
**Created:** 2025-10-18  
**Updated:** 2025-10-18

## Executive Summary

**Problem:** System audio transcription fails in production builds.

**Root Cause:** The native Swift binary `SystemAudioCapture` is not being built before packaging. The `dist-native/` directory is empty in released apps.

**Solution:** Add Swift build step to GitHub Actions workflow and local build process.

**Files Changed:**
- ✅ Created `scripts/build-native-binary.sh` - Builds Swift binary
- ✅ Updated `.github/workflows/release.yml` - Added build step before packaging
- ✅ Updated `package.json` - Added `build:native` script to build process

**Next Action:** Test locally, then release v1.0.65

---

## Problem Statement

CueMeFinal works perfectly in development mode (`npm run dev -- --port 5180`), but after being released through GitHub Actions with code signing, both microphone and system audio transcription stop working completely.

**Analysis Result:** After implementing production logging and analyzing the logs, we discovered:
- ✅ API keys are loaded correctly
- ✅ AudioTranscriber initializes successfully  
- ✅ Audio sources are detected
- ❌ **Native binary is missing** - This is the root cause

## Root Cause Analysis

### 🎯 **CONFIRMED ROOT CAUSE: Native Binary Missing** ⚠️ CRITICAL
- **Issue:** The Swift binary `SystemAudioCapture` is NOT being built before packaging
- **Impact:** System audio capture completely fails in production
- **Evidence from logs:**
  ```
  Expected Binary Path: /Applications/CueMe.app/Contents/Resources/dist-native/SystemAudioCapture
  Binary Exists: false
  ```
- **Location:** `dist-native/` directory is empty
- **Cause:** GitHub Actions workflow doesn't include Swift build step
- **Fix Required:** Add Swift build step to `.github/workflows/release.yml` before `npm run build`

### 1. **No Production Logging** ✅ FIXED
- **Issue:** All logging uses `console.log()` which doesn't persist in packaged Electron apps
- **Status:** Fixed with `electron-log` implementation
- **Evidence:** Logs now available at `~/Library/Logs/CueMe/main.log`

### 2. **Environment Variable Loading** ✅ WORKING
- **Status:** API keys are present and loaded correctly
- **Evidence from logs:**
  ```
  OPENAI_API_KEY present: true
  GEMINI_API_KEY present: true
  ```
- **Note:** GitHub secrets ARE configured correctly

### 3. **Audio System Initialization** ✅ WORKING
- **Status:** AudioTranscriber initializes successfully
- **Evidence from logs:**
  ```
  AudioTranscriber: Initialized successfully
  SystemAudioCapture Sources: 2
    - Microphone (microphone): Available
    - System Audio (Core Audio Taps) (system): Available
  ```
- **Note:** Everything works EXCEPT the missing native binary

## Current State: How to Check Logs

### ❌ Currently IMPOSSIBLE
There is no way to check logs in the released application because:
1. No logging library that persists to files
2. `console.log` output goes nowhere in packaged apps
3. No debug UI or error reporting

### ✅ After Implementing Fixes
Logs will be available at:
- **macOS:** `~/Library/Logs/CueMe/main.log`
- **Windows:** `%USERPROFILE%\AppData\Roaming\CueMe\logs\main.log`
- **Linux:** `~/.config/CueMe/logs/main.log`

## Solution Implementation Plan

### Phase 1: Add Production Logging (IMMEDIATE) ✅ COMPLETED
- [x] Install `electron-log` package
- [x] Create `electron/utils/Logger.ts` wrapper
- [x] Replace critical `console.log` statements with proper logging
- [x] Add IPC handlers for log access
- [x] Update TypeScript types
- [x] Build successfully completed
- [x] **VERIFIED:** Logs working in production at `~/Library/Logs/CueMe/main.log`

### Phase 2: Fix Native Binary Build (CRITICAL) ✅ COMPLETED
- [x] Create Swift build script `scripts/build-native-binary.sh`
- [x] Add Swift build step to GitHub Actions workflow
- [x] Verify binary is created in `dist-native/` before packaging
- [x] **TESTED:** Binary builds successfully as universal binary (x86_64 + arm64)
- [ ] Test full app build with `npm run app:build:mac`
- [ ] Release new version and verify binary exists in packaged app

### Phase 3: Verify Fix
- [ ] Download released .dmg from GitHub
- [ ] Install and run app
- [ ] Check logs: `tail -f ~/Library/Logs/CueMe/main.log`
- [ ] Verify binary exists: `ls -la /Applications/CueMe.app/Contents/Resources/dist-native/`
- [ ] Test system audio transcription
- [ ] Test microphone transcription

## Implementation Details

### 1. Logger Utility

```typescript
// electron/utils/Logger.ts
import log from 'electron-log';
import { app } from 'electron';

export class Logger {
  static initialize() {
    // Configure log file location
    log.transports.file.level = 'info';
    log.transports.console.level = 'debug';
    
    const logPath = log.transports.file.getFile().path;
    console.log(`[Logger] Logs will be written to: ${logPath}`);
    
    // Log app info
    log.info('='.repeat(80));
    log.info(`CueMe v${app.getVersion()} - ${new Date().toISOString()}`);
    log.info(`Platform: ${process.platform} ${process.arch}`);
    log.info(`Node: ${process.version}`);
    log.info(`Electron: ${process.versions.electron}`);
    log.info(`Packaged: ${app.isPackaged}`);
    log.info(`CWD: ${process.cwd()}`);
    log.info(`Resources: ${process.resourcesPath || 'N/A'}`);
    log.info('='.repeat(80));
  }
  
  static info(message: string, ...args: any[]) {
    log.info(message, ...args);
  }
  
  static error(message: string, ...args: any[]) {
    log.error(message, ...args);
  }
  
  static warn(message: string, ...args: any[]) {
    log.warn(message, ...args);
  }
  
  static debug(message: string, ...args: any[]) {
    log.debug(message, ...args);
  }
  
  static getLogPath(): string {
    return log.transports.file.getFile().path;
  }
}
```

### 2. Enhanced EnvLoader with Logging

```typescript
// electron/core/EnvLoader.ts - Enhanced version
import dotenv from "dotenv";
import path from "path";
import fs from "fs";
import { Logger } from "../utils/Logger";

export class EnvLoader {
  static load(): void {
    Logger.info('[ENV] Starting environment variable loading...');
    Logger.info('[ENV] Process info:', {
      cwd: process.cwd(),
      resourcesPath: process.resourcesPath,
      isPackaged: process.env.NODE_ENV === 'production' || !process.env.NODE_ENV,
      platform: process.platform
    });
    
    const envPaths = [
      path.join(process.cwd(), '.env.local'),
      path.join(process.cwd(), '.env'),
      path.join(process.resourcesPath || process.cwd(), '.env.local'),
      path.join(process.resourcesPath || process.cwd(), '.env'),
      '.env.local',
      '.env'
    ];
    
    Logger.info('[ENV] Will try these paths in order:', envPaths);

    let envLoaded = false;
    let loadedPath = '';
    
    for (const envPath of envPaths) {
      try {
        // Check if file exists first
        if (fs.existsSync(envPath)) {
          Logger.info(`[ENV] Found .env file at: ${envPath}`);
          
          const result = dotenv.config({ path: envPath });
          if (!result.error) {
            Logger.info(`[ENV] ✅ Successfully loaded from: ${envPath}`);
            envLoaded = true;
            loadedPath = envPath;
            
            // Log which keys were loaded (without values)
            const keys = Object.keys(result.parsed || {});
            Logger.info(`[ENV] Loaded ${keys.length} variables: ${keys.join(', ')}`);
            break;
          } else {
            Logger.warn(`[ENV] File exists but failed to parse: ${envPath}`, result.error);
          }
        }
      } catch (error) {
        Logger.warn(`[ENV] Error checking path ${envPath}:`, error);
      }
    }

    if (!envLoaded) {
      Logger.warn('[ENV] No .env file found in any location, using default dotenv.config()');
      dotenv.config();
    }
    
    // Validate loaded variables
    const validation = this.validate();
    if (!validation.valid) {
      Logger.error('[ENV] ❌ Missing required variables:', validation.missing);
    } else {
      Logger.info('[ENV] ✅ All required variables present');
    }
  }

  static validate(): { valid: boolean; missing: string[]; present: string[] } {
    const required = ['GEMINI_API_KEY'];
    const optional = ['OPENAI_API_KEY', 'NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY'];
    
    const missing: string[] = [];
    const present: string[] = [];
    
    for (const key of required) {
      if (!process.env[key] || process.env[key]?.trim() === '') {
        missing.push(key);
        Logger.error(`[ENV] Required variable missing or empty: ${key}`);
      } else {
        present.push(key);
        Logger.info(`[ENV] Required variable present: ${key}`);
      }
    }

    for (const key of optional) {
      if (process.env[key] && process.env[key]?.trim() !== '') {
        present.push(key);
        Logger.info(`[ENV] Optional variable present: ${key}`);
      } else {
        Logger.warn(`[ENV] Optional variable missing: ${key}`);
      }
    }

    return {
      valid: missing.length === 0,
      missing,
      present
    };
  }
}
```

### 3. AudioStreamProcessor Error Handling

```typescript
// In electron/core/AppState.ts or wherever AudioStreamProcessor is initialized
try {
  const openaiKey = process.env.OPENAI_API_KEY;
  
  if (!openaiKey || openaiKey.trim() === '') {
    Logger.error('[AppState] Cannot initialize AudioStreamProcessor: OPENAI_API_KEY is missing');
    Logger.error('[AppState] Audio transcription features will be disabled');
    
    // Show error to user
    if (this.mainWindow) {
      this.mainWindow.webContents.send('system-error', {
        title: 'Audio Transcription Unavailable',
        message: 'OpenAI API key is not configured. Audio transcription features are disabled.',
        details: 'Please check your environment configuration or contact support.',
        severity: 'error'
      });
    }
    
    // Don't initialize AudioStreamProcessor
    this.audioStreamProcessor = null;
  } else {
    Logger.info('[AppState] Initializing AudioStreamProcessor...');
    this.audioStreamProcessor = new AudioStreamProcessor(openaiKey, {
      sampleRate: 16000,
      questionDetectionEnabled: true
    });
    Logger.info('[AppState] ✅ AudioStreamProcessor initialized successfully');
  }
} catch (error) {
  Logger.error('[AppState] Failed to initialize AudioStreamProcessor:', error);
  
  if (this.mainWindow) {
    this.mainWindow.webContents.send('system-error', {
      title: 'Audio System Initialization Failed',
      message: 'Failed to initialize audio transcription system.',
      details: error instanceof Error ? error.message : String(error),
      severity: 'error'
    });
  }
}
```

### 4. Debug UI Panel

Add to `src/_pages/Debug.tsx`:

```typescript
// Add system status section
const [systemStatus, setSystemStatus] = useState({
  envLoaded: false,
  openaiKeyPresent: false,
  geminiKeyPresent: false,
  supabaseConfigured: false,
  audioSystemInitialized: false,
  logFilePath: ''
});

useEffect(() => {
  // Request system status from main process
  window.electronAPI.getSystemStatus().then(setSystemStatus);
}, []);

// Add IPC handler in electron/ipcHandlers.ts
ipcMain.handle('get-system-status', async () => {
  return {
    envLoaded: true, // Track this in EnvLoader
    openaiKeyPresent: !!process.env.OPENAI_API_KEY,
    geminiKeyPresent: !!process.env.GEMINI_API_KEY,
    supabaseConfigured: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
    audioSystemInitialized: !!appState.audioStreamProcessor,
    logFilePath: Logger.getLogPath()
  };
});
```

## Testing Checklist

### Development Testing
- [ ] Verify logs are written to file in dev mode
- [ ] Test with missing `.env` file
- [ ] Test with empty API keys
- [ ] Verify error messages appear in UI

### Production Testing
- [ ] Build app with `npm run app:build:mac`
- [ ] Verify `.env` file is in `<app>/Contents/Resources/`
- [ ] Check log file is created at `~/Library/Logs/CueMe/main.log`
- [ ] Test audio transcription works
- [ ] Test error handling with invalid API key
- [ ] Verify debug panel shows correct status

### GitHub Actions Testing
- [ ] Verify secrets are set in "cueme" environment
- [ ] Check build logs show `.env` creation
- [ ] Download released artifact and test
- [ ] Verify logs are accessible in released app

## User Documentation

### How to Check Logs in Released App

1. **Open log file location:**
   - macOS: `~/Library/Logs/CueMe/main.log`
   - Windows: `%USERPROFILE%\AppData\Roaming\CueMe\logs\main.log`
   - Linux: `~/.config/CueMe/logs/main.log`

2. **Or use the Debug Panel:**
   - Open CueMe
   - Navigate to Debug page
   - Click "Open Log File" button
   - View system status and recent errors

3. **What to look for:**
   - `[ENV]` lines showing environment variable loading
   - `[AudioStreamProcessor]` lines showing audio system initialization
   - `[AudioTranscriber]` lines showing transcription attempts
   - Any `ERROR` or `WARN` messages

## Next Steps

1. ✅ ~~Implement Phase 1 (Production Logging)~~ - COMPLETED
2. ✅ ~~Analyze production logs~~ - COMPLETED (Root cause identified)
3. **🔴 CURRENT: Fix Native Binary Build**
   - Created `scripts/build-native-binary.sh`
   - Updated GitHub Actions workflow to build Swift binary
   - Updated `package.json` to include `build:native` step
4. **Test locally:**
   ```bash
   cd CueMeFinal
   npm run build:native  # Build Swift binary
   npm run app:build:mac  # Build full app
   
   # Verify binary exists
   ls -la release/mac/CueMe.app/Contents/Resources/dist-native/SystemAudioCapture
   
   # Run and check logs
   open release/mac/CueMe.app
   tail -f ~/Library/Logs/CueMe/main.log
   ```
5. **Release new version:**
   ```bash
   git add .
   git commit -m "fix: Add Swift binary build step to fix system audio in production"
   git tag v1.0.65
   git push origin main
   git push origin v1.0.65
   ```
6. **Verify in released version:**
   - Download .dmg from GitHub releases
   - Install and run
   - Check logs show binary exists
   - Test system audio transcription

## How to Test Now

### Local Build Test:
```bash
# Build the app
npm run app:build:mac

# Run the built app
open release/mac/CueMe.app

# Check logs immediately
tail -f ~/Library/Logs/CueMe/main.log

# Or open log file
open ~/Library/Logs/CueMe/main.log
```

### What to Look For in Logs:
1. **Environment Loading:**
   ```
   [ENV] Found .env file at: /path/to/.env
   [ENV] ✅ Successfully loaded from: /path/to/.env
   [ENV] Loaded 4 variables: GEMINI_API_KEY, OPENAI_API_KEY, ...
   ```

2. **Audio System Initialization:**
   ```
   [AudioTranscriber] Initialized successfully
   ```
   OR
   ```
   [AudioTranscriber] Cannot initialize - Missing OpenAI API key
   ```

3. **System Diagnostics:**
   ```
   🔍 ===== AUDIO SYSTEM DIAGNOSTICS =====
   📋 Environment Variables:
     OPENAI_API_KEY: Present/Missing
   ```

### GitHub Release Test:
```bash
# After pushing to GitHub with tag
git tag v1.0.64
git push origin v1.0.64

# Wait for GitHub Actions to complete
# Download the released .dmg
# Install and run
# Check logs at ~/Library/Logs/CueMe/main.log
```

## Related Files

- `electron/main.ts` - App initialization
- `electron/AudioStreamProcessor.ts` - Audio system
- `electron/audio/AudioTranscriber.ts` - Transcription
- `electron/core/EnvLoader.ts` - Environment loading
- `package.json` - Build configuration
- `.github/workflows/release.yml` - Release process
- `scripts/afterPack.js` - Post-build processing

---

**Last Updated:** 2025-10-18  
**Assigned To:** Development Team  
**Estimated Time:** 4-6 hours for Phase 1, 8-12 hours total
