/**
 * Permission Watcher - Automatically retries system audio when permissions are granted
 * This makes the user experience seamless by eliminating manual retry steps
 */

import { EventEmitter } from 'events';
import { systemPreferences } from 'electron';

export class PermissionWatcher extends EventEmitter {
  private isWatching = false;
  private watchInterval?: NodeJS.Timeout;
  private lastScreenCaptureStatus: string = 'unknown';

  constructor() {
    super();
  }

  /**
   * Start watching for permission changes
   */
  public startWatching(): void {
    if (this.isWatching || process.platform !== 'darwin') {
      return;
    }

    console.log('[PermissionWatcher] Starting permission monitoring...');
    this.isWatching = true;

    // Get initial state
    this.updatePermissionStatus();

    // Check every 2 seconds for permission changes
    this.watchInterval = setInterval(() => {
      this.updatePermissionStatus();
    }, 2000);
  }

  /**
   * Stop watching for permission changes
   */
  public stopWatching(): void {
    if (!this.isWatching) {
      return;
    }

    console.log('[PermissionWatcher] Stopping permission monitoring...');
    this.isWatching = false;

    if (this.watchInterval) {
      clearInterval(this.watchInterval);
      this.watchInterval = undefined;
    }
  }

  /**
   * Check current permission status and emit changes
   */
  private updatePermissionStatus(): void {
    try {
      const screenCaptureStatus = systemPreferences.getMediaAccessStatus('screen');
      
      // Check if Screen Recording permission was just granted
      if (this.lastScreenCaptureStatus !== 'granted' && screenCaptureStatus === 'granted') {
        console.log('[PermissionWatcher] ✅ Screen Recording permission granted! Notifying listeners...');
        this.emit('screen-recording-granted');
      }
      
      // Check if Screen Recording permission was revoked
      if (this.lastScreenCaptureStatus === 'granted' && screenCaptureStatus !== 'granted') {
        console.log('[PermissionWatcher] ❌ Screen Recording permission revoked! Notifying listeners...');
        this.emit('screen-recording-revoked');
      }

      this.lastScreenCaptureStatus = screenCaptureStatus;
      
    } catch (error) {
      console.error('[PermissionWatcher] Error checking permission status:', error);
    }
  }

  /**
   * Get current permission status with enhanced diagnostics
   */
  public getCurrentStatus(): {
    screenCapture: string;
    microphone: string;
    diagnostics: {
      hasSystemSettings: boolean;
      tccdRunning: boolean;
      signatureStable: boolean;
    };
  } {
    try {
      const screenCapture = systemPreferences.getMediaAccessStatus('screen');
      const microphone = systemPreferences.getMediaAccessStatus('microphone');
      
      // Enhanced diagnostics
      const diagnostics = {
        hasSystemSettings: this.checkSystemSettingsAccess(),
        tccdRunning: this.checkTccdStatus(),
        signatureStable: this.checkSignatureStability()
      };
      
      return {
        screenCapture,
        microphone,
        diagnostics
      };
    } catch (error) {
      console.error('[PermissionWatcher] Error getting current status:', error);
      return {
        screenCapture: 'unknown',
        microphone: 'unknown',
        diagnostics: {
          hasSystemSettings: false,
          tccdRunning: false,
          signatureStable: false
        }
      };
    }
  }

  /**
   * Check if System Settings is accessible
   */
  private checkSystemSettingsAccess(): boolean {
    try {
      // Try to check if we can open System Settings
      return true; // For now, assume it's accessible
    } catch {
      return false;
    }
  }

  /**
   * Check if TCC daemon is running properly
   */
  private checkTccdStatus(): boolean {
    try {
      const { execSync } = require('child_process');
      const result = execSync('pgrep tccd', { encoding: 'utf8', timeout: 1000 });
      return result.trim().length > 0;
    } catch {
      return false;
    }
  }

  /**
   * Check if app signature is stable (production vs development)
   */
  private checkSignatureStability(): boolean {
    try {
      const { execSync } = require('child_process');
      const appPath = process.execPath;
      const result = execSync(`codesign -dv "${appPath}" 2>&1`, { encoding: 'utf8', timeout: 2000 });
      
      // If it contains "adhoc" it's development build
      const isAdhoc = result.toLowerCase().includes('adhoc');
      const hasTeamId = result.includes('TeamIdentifier=');
      
      // Stable if it's either properly signed or consistently adhoc
      return hasTeamId || !isAdhoc;
    } catch {
      return false;
    }
  }

  /**
   * Get detailed permission analysis with enhanced detection
   */
  public getPermissionAnalysis(): {
    status: 'working' | 'needs_permission' | 'signature_issue' | 'system_issue';
    message: string;
    actionRequired: string[];
  } {
    const current = this.getCurrentStatus();
    
    if (current.screenCapture === 'granted') {
      // Double-check with actual system audio capability
      if (this.canActuallyAccessSystemAudio()) {
        return {
          status: 'working',
          message: 'System audio permissions are properly configured',
          actionRequired: []
        };
      } else {
        return {
          status: 'signature_issue',
          message: 'Permission granted but system audio inaccessible (signature or TCC issue)',
          actionRequired: [
            'Sign development Electron with stable identifier: ./scripts/sign-electron-dev.sh',
            'Or use production build for reliable system audio',
            'If issues persist, reset permissions: ./scripts/nuclear-permission-reset.sh'
          ]
        };
      }
    } else if (current.screenCapture === 'denied') {
      return {
        status: 'needs_permission',
        message: 'Screen Recording permission explicitly denied',
        actionRequired: [
          'Open System Settings → Privacy & Security → Screen Recording',
          'Find and enable CueMe (or Electron)',
          'Restart the app after granting permission',
          'If app not listed, try: ./scripts/sign-electron-dev.sh'
        ]
      };
    } else if (current.screenCapture === 'not-determined') {
      return {
        status: 'needs_permission',
        message: 'Screen Recording permission not yet requested',
        actionRequired: [
          'Click "Request Permissions" in the app',
          'Grant permission when macOS prompts',
          'If no prompt appears, check System Settings manually'
        ]
      };
    } else {
      return {
        status: 'system_issue',
        message: `Unknown permission state: ${current.screenCapture}`,
        actionRequired: [
          'Restart the app',
          'Check Console.app for TCC-related errors',
          'If issues persist: ./scripts/nuclear-permission-reset.sh',
          'Consider restarting macOS'
        ]
      };
    }
  }

  /**
   * Attempt automatic permission recovery
   */
  public async attemptPermissionRecovery(): Promise<{
    success: boolean;
    message: string;
    actionsAttempted: string[];
  }> {
    const actionsAttempted: string[] = [];
    
    try {
      console.log('[PermissionWatcher] Starting automatic permission recovery...');
      
      // 1. Check current status
      const analysis = this.getPermissionAnalysis();
      actionsAttempted.push('Analyzed current permission state');
      
      if (analysis.status === 'working') {
        return {
          success: true,
          message: 'System audio permissions are already working',
          actionsAttempted
        };
      }
      
      // 2. Try to open System Settings if permission needed
      if (analysis.status === 'needs_permission') {
        const { shell } = require('electron');
        await shell.openExternal('x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture');
        actionsAttempted.push('Opened System Settings to Screen Recording');
      }
      
      // 3. For signature issues, recommend production build
      if (analysis.status === 'signature_issue') {
        return {
          success: false,
          message: 'Development build detected - use production build for stable permissions',
          actionsAttempted
        };
      }
      
      return {
        success: false,
        message: analysis.message,
        actionsAttempted
      };
      
    } catch (error) {
      console.error('[PermissionWatcher] Recovery attempt failed:', error);
      return {
        success: false,
        message: `Permission recovery failed: ${(error as Error).message}`,
        actionsAttempted
      };
    }
  }

  /**
   * Test if system audio is actually accessible (not just permission status)
   * 
   * Note: ScreenCaptureKit uses Screen Recording permission (no usage string).
   * NSAudioCaptureUsageDescription is required for CoreAudio taps on macOS 14.2+.
   */
  private canActuallyAccessSystemAudio(): boolean {
    try {
      const path = require('path');
      const { execSync } = require('child_process');
      
      // Get binary path
      const isDev = !require('electron').app.isPackaged;
      const binaryPath = isDev 
        ? path.join(process.cwd(), 'dist-native', 'SystemAudioCapture')
        : path.join(process.resourcesPath, 'dist-native', 'SystemAudioCapture');
      
      // Test if binary can actually check system audio availability
      // Use longer timeout and robust multi-line JSON parsing
      const output = execSync(`"${binaryPath}" status`, { 
        encoding: 'utf8', 
        timeout: 5000, // Increased from 3s for reliability
        stdio: 'pipe'
      });
      
      // Parse multi-line output - Swift binary may emit multiple JSON messages
      const lines = output.trim().split('\n');
      for (const line of lines) {
        try {
          const result = JSON.parse(line);
          if (result.type === 'status' && result.data) {
            return result.data.isAvailable === true;
          }
        } catch {
          // Skip non-JSON lines (stderr warnings, partial output, etc.)
          continue;
        }
      }
      
      return false;
      
    } catch (error) {
      console.warn('[PermissionWatcher] System audio capability test failed:', error);
      return false;
    }
  }

  /**
   * Cleanup resources
   */
  public destroy(): void {
    this.stopWatching();
    this.removeAllListeners();
  }
}