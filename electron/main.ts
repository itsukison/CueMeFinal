// Load environment variables FIRST before any other imports
import { EnvLoader } from "./core/EnvLoader";
EnvLoader.load();

import { app, session, desktopCapturer } from "electron";
import { Logger } from "./utils/Logger";
import { DiagnosticLogger } from "./utils/DiagnosticLogger";
import { VisibilityConfig } from "./config/VisibilityConfig";

// Initialize Logger as early as possible
Logger.initialize();

// Initialize diagnostic logger
const diagLogger = new DiagnosticLogger('Main');

// Log system information for debugging
diagLogger.info('=== CueMe Application Starting ===');
diagLogger.info('Environment check', {
  NODE_ENV: process.env.NODE_ENV,
  isProduction: process.env.NODE_ENV === 'production',
  hasOpenAI: !!process.env.OPENAI_API_KEY,
  hasGemini: !!process.env.GEMINI_API_KEY,
  hasSupabaseUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
  hasSupabaseKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
});

// Log environment status with Logger (keep existing)
Logger.info('🚨 [PRODUCTION DEBUG] Environment check:');
Logger.info('  NODE_ENV:', process.env.NODE_ENV);
Logger.info('  OPENAI_API_KEY present:', !!process.env.OPENAI_API_KEY);
Logger.info('  GEMINI_API_KEY present:', !!process.env.GEMINI_API_KEY);
Logger.info('  Process info:', {
  cwd: process.cwd(),
  resourcesPath: process.resourcesPath,
  platform: process.platform
});

// Debug audio system in production builds
// DISABLED: AudioDebugger uses navigator.mediaDevices which is only available in renderer
// Microphone permission checks are now handled in the renderer via MicrophoneCapture service
// import { AudioDebugger } from "./AudioDebugger";
// if (process.env.NODE_ENV === 'production' || !process.env.NODE_ENV) {
//   Logger.info('[Main] Running audio system diagnostics...');
//   setTimeout(() => {
//     AudioDebugger.diagnoseAudioSystem().catch(error => {
//       Logger.error('[Main] Audio diagnostics failed:', error);
//     });
//   }, 2000);
// }
import { initializeIpcHandlers } from "./ipc";
import { AppState } from "./core/AppState";
import { DeepLinkHandler } from "./core/DeepLinkHandler";

/**
 * Request microphone access on app startup
 */
async function requestMicAccess(appState: AppState): Promise<void> {
  if (process.platform !== 'darwin') {
    console.log('[Permission] Microphone permission request only available on macOS');
    return;
  }

  try {
    console.log('[Permission] Requesting microphone permission...');
    const granted = await appState.permissionStorage.requestMicrophonePermission();

    if (granted) {
      console.log('[Permission] ✅ Microphone access granted');
    } else {
      console.log('[Permission] ❌ Microphone access denied');
    }
  } catch (error) {
    console.error('[Permission] Error requesting microphone permission:', error);
  }
}

/**
 * Application initialization
 */
async function initializeApp() {
  console.log('[App Init] ==============================');
  console.log('[App Init] Starting application initialization...');
  console.log('[App Init] Process args:', process.argv);
  console.log('[App Init] ==============================');

  // Set app identification early for proper permission dialogs on macOS
  app.setName('CueMe');
  if (process.platform === 'darwin') {
    app.setAppUserModelId('com.cueme.interview-assistant');
    console.log('[App Init] Set app name and ID for macOS permission dialogs');
  }

  // Validate environment variables
  const envValidation = EnvLoader.validate();
  if (!envValidation.valid) {
    console.error('[App Init] ❌ Missing required environment variables:', envValidation.missing);
    // Continue anyway - some features may be disabled
  }

  // Prevent multiple instances
  const gotTheLock = app.requestSingleInstanceLock();
  console.log('[App Init] Single instance lock acquired:', gotTheLock);

  if (!gotTheLock) {
    console.log('[App Init] Another instance is running, quitting...');
    app.quit();
    return;
  }

  const appState = AppState.getInstance();
  console.log('[App Init] AppState instance created');

  // Initialize IPC handlers before window creation
  console.log('[App Init] Initializing IPC handlers...');
  initializeIpcHandlers(appState);

  // Set up deep link protocol handling
  console.log('[App Init] Setting up deep link protocol handling...');
  const deepLinkHandler = new DeepLinkHandler(appState);
  deepLinkHandler.setup();

  app.whenReady().then(async () => {
    console.log('[App Init] ✅ Electron app is ready!');

    // Setup display media request handler for system audio loopback
    // This enables Electron's native audio loopback capture
    console.log('[App Init] Setting up display media request handler...');
    session.defaultSession.setDisplayMediaRequestHandler((request, callback) => {
      desktopCapturer.getSources({ types: ['screen'] })
        .then((sources) => {
          if (sources && sources.length > 0) {
            console.log('[DisplayMedia] Granting access to screen with loopback audio');
            // Grant access to first screen with loopback audio
            // This bypasses the system picker and enables audio: 'loopback'
            callback({ video: sources[0], audio: 'loopback' });
          } else {
            console.warn('[DisplayMedia] No screen sources available');
            callback({});
          }
        })
        .catch((error) => {
          console.error('[DisplayMedia] Failed to get desktop sources:', error);
          callback({});
        });
    });

    console.log('[App Init] Creating main window...');
    appState.createWindow();

    if (!VisibilityConfig.IS_INVISIBLE) {
      console.log('[App Init] Creating system tray...');
      appState.createTray();
    } else {
      console.log('[App Init] System tray creation skipped (Invisible Mode)');
    }

    // TODO: Register global shortcuts (Cmd+H for screenshot, Cmd+Shift+Space for toggle)
    // Shortcuts functionality needs to be reimplemented after cleanup
    console.log('[App Init] Global shortcuts registration skipped (needs reimplementation)');

    // Request microphone permission on startup
    console.log('[App Init] Requesting microphone permission...');
    await requestMicAccess(appState);

    console.log('[App Init] ✅ App initialization completed successfully!');
  });

  app.on("activate", () => {
    console.log('[App Init] App activated (macOS dock click or similar)');
    if (appState.getMainWindow() === null) {
      console.log('[App Init] No main window, creating new one...');
      appState.createWindow();
    }
  });

  // Quit when all windows are closed, except on macOS
  app.on("window-all-closed", () => {
    console.log('[App Init] All windows closed');
    if (process.platform !== "darwin") {
      console.log('[App Init] Not macOS, quitting app...');
      app.quit();
    }
  });

  app.on('will-quit', () => {
    console.log('[App Init] App will quit');
    appState.cleanup();
  });

  app.on('before-quit', () => {
    console.log('[App Init] App before quit');
  });

  if (VisibilityConfig.IS_INVISIBLE) {
    app.dock?.hide(); // Hide dock icon
  }
  app.commandLine.appendSwitch("disable-background-timer-throttling");

  console.log('[App Init] App initialization setup complete');
}

// Start the application
initializeApp().catch(console.error);
