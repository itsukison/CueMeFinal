import { desktopCapturer } from 'electron';
import { DiagnosticLogger } from './DiagnosticLogger';

const logger = new DiagnosticLogger('PermissionManager');

export class PermissionManager {
  /**
   * Request Screen Recording permission (required for system audio capture on macOS)
   * This triggers the macOS permission dialog if not already granted
   */
  public static async requestScreenRecordingPermission(): Promise<{
    granted: boolean;
    error?: string;
  }> {
    if (process.platform !== 'darwin') {
      // Screen recording permission only needed on macOS
      return { granted: true };
    }

    try {
      logger.info('🔐 Requesting Screen Recording permission for system audio...');

      // In Electron 33+, systemPreferences is deprecated
      // We use desktopCapturer to trigger the permission dialog
      // Trigger the permission dialog by attempting to access screen capture
      // This is the official way to request Screen Recording permission
      const sources = await desktopCapturer.getSources({
        types: ['screen'],
        thumbnailSize: { width: 1, height: 1 },
      });

      if (sources.length > 0) {
        logger.info(
          '✅ Screen Recording permission granted (system audio enabled)',
          {
            sourcesFound: sources.length,
          }
        );
        return { granted: true };
      } else {
        const errorMsg =
          'Screen Recording permission required for system audio capture. Please grant permission in System Settings > Privacy & Security > Screen Recording.';
        logger.warn('⚠️ No screen sources available - permission may be denied');
        return {
          granted: false,
          error: errorMsg,
        };
      }
    } catch (error) {
      logger.error('Error requesting Screen Recording permission', error as Error);
      return {
        granted: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Request Microphone permission
   * Note: In Electron 33+, microphone permission is handled automatically
   * when the app tries to access the microphone via getUserMedia in the renderer
   */
  public static async requestMicrophonePermission(): Promise<{
    granted: boolean;
    error?: string;
  }> {
    if (process.platform !== 'darwin') {
      return { granted: true };
    }

    try {
      logger.info('🔐 Microphone permission will be requested when app accesses microphone');
      logger.info('ℹ️ In Electron 33+, microphone permission is handled automatically by the OS');
      
      // In Electron 33+, we can't check or request microphone permission from main process
      // It's handled automatically when renderer calls getUserMedia()
      // We just return true here and let the OS handle it
      return { granted: true };
    } catch (error) {
      logger.error('Error with microphone permission', error as Error);
      return {
        granted: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Request all required permissions for audio capture
   */
  public static async requestAllAudioPermissions(): Promise<{
    microphone: boolean;
    screenRecording: boolean;
    errors: string[];
  }> {
    logger.info('🔐 Requesting all audio permissions...');

    const micResult = await this.requestMicrophonePermission();
    const screenResult = await this.requestScreenRecordingPermission();

    const errors: string[] = [];
    if (micResult.error) errors.push(micResult.error);
    if (screenResult.error) errors.push(screenResult.error);

    logger.info('Permission request results', {
      microphone: micResult.granted,
      screenRecording: screenResult.granted,
      hasErrors: errors.length > 0,
    });

    return {
      microphone: micResult.granted,
      screenRecording: screenResult.granted,
      errors,
    };
  }

  /**
   * Check current permission status without requesting
   * Note: In Electron 33+, we can't check permission status from main process
   */
  public static checkPermissionStatus(): {
    microphone: string;
    screenRecording: string;
  } {
    if (process.platform !== 'darwin') {
      return {
        microphone: 'not-applicable',
        screenRecording: 'not-applicable',
      };
    }

    // In Electron 33+, systemPreferences.getMediaAccessStatus is deprecated
    // We can't check permission status from main process anymore
    // Return 'unknown' to indicate we can't check
    return {
      microphone: 'unknown',
      screenRecording: 'unknown',
    };
  }
}
