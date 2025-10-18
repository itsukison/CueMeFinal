# Production Audio Failure Investigation & Fix

**Status:** 🔴 In Progress  
**Priority:** Critical  
**Created:** 2025-10-18

## Problem Statement

CueMeFinal works perfectly in development mode (`npm run dev -- --port 5180`), but after being released through GitHub Actions with code signing, both microphone and system audio transcription stop working completely.

## Root Cause Analysis

### 1. **No Production Logging** ⚠️ CRITICAL
- **Issue:** All logging uses `console.log()` which doesn't persist in packaged Electron apps
- **Impact:** Impossible to diagnose what's failing in production
- **Evidence:** No `electron-log` or similar logging library in dependencies
- **Location:** Throughout codebase, especially in:
  - `electron/main.ts`
  - `electron/AudioStreamProcessor.ts`
  - `electron/audio/AudioTranscriber.ts`
  - `electron/core/EnvLoader.ts`

### 2. **Environment Variable Loading Failure** ⚠️ CRITICAL
- **Issue:** `.env` file not loaded correctly in production, causing API keys to be undefined
- **Impact:** `AudioStreamProcessor` constructor throws error when `OPENAI_API_KEY` is missing/empty
- **Evidence:**
  - `AudioStreamProcessor.ts:47-49` - Throws error if API key is empty
  - `EnvLoader.ts` - Tries multiple paths but no verification logging
  - `package.json:88-94` - `.env` in `extraResources` but path might be wrong
- **Likely Cause:** GitHub secrets not configured in "cueme" environment

### 3. **Silent Initialization Failures** ⚠️ HIGH
- **Issue:** Errors during service initialization not surfaced to user
- **Impact:** App appears to work but audio features silently fail
- **Evidence:**
  - `AudioStreamProcessor` constructor throws but error not caught
  - No user-facing error messages for initialization failures
  - No status indicators for API connectivity

### 4. **GitHub Actions Configuration** ⚠️ HIGH
- **Issue:** Secrets might not be set in GitHub repository's "cueme" environment
- **Impact:** `.env` file created with empty values
- **Evidence:** `.github/workflows/release.yml:44-50` creates `.env` from secrets
- **Required Secrets:**
  - `GEMINI_API_KEY`
  - `OPENAI_API_KEY`
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`

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
- [x] Replace critical `console.log` statements with proper logging in:
  - `electron/main.ts`
  - `electron/AudioDebugger.ts`
  - `electron/core/EnvLoader.ts` (enhanced with file existence checks)
- [x] Add IPC handlers for log access:
  - `get-system-status` - Returns env vars, audio system status, log path
  - `open-log-file` - Opens log file in default viewer
  - `get-log-path` - Returns log file path
- [x] Update TypeScript types in `electron.d.ts` and `preload.ts`
- [x] Build successfully completed

### Phase 2: Fix Environment Variable Loading
- [ ] Add detailed logging to `EnvLoader.ts`
- [ ] Verify `.env` file location in packaged app
- [ ] Add fallback error messages if `.env` not found
- [ ] Verify GitHub secrets are configured
- [ ] Add build-time verification of `.env` contents

### Phase 3: Add Error Handling & User Feedback
- [ ] Wrap `AudioStreamProcessor` initialization in try-catch
- [ ] Add user-facing error dialog for initialization failures
- [ ] Create debug panel showing:
  - Environment variable status (without exposing keys)
  - Audio system initialization status
  - Recent errors
  - API connection test button
- [ ] Add status indicators for audio system health

### Phase 4: Improve Build Process
- [ ] Add verification step in `afterPack.js` to check `.env` exists
- [ ] Log `.env` file location during build
- [ ] Add smoke test for packaged app
- [ ] Document troubleshooting steps for users

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
2. **Test packaged app locally** - Run `npm run app:build:mac` and test
3. **Check logs after running packaged app:**
   - Open `~/Library/Logs/CueMe/main.log`
   - Look for `[ENV]` lines showing if .env was loaded
   - Look for `[AudioTranscriber]` errors about missing API key
   - Look for audio diagnostics output
4. **If .env not loading:** Verify it's in `<app>/Contents/Resources/.env`
5. **Release new version** with logging to GitHub
6. **Download released version** and check logs
7. Implement Phases 2-4 based on log analysis

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
