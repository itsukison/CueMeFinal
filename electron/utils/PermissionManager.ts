import { desktopCapturer, systemPreferences } from 'electron';
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

      // Check if permission is already granted
      const status = systemPreferences.getMediaAccessStatus('screen');
      logger.info(`Current Screen Recording permission status: ${status}`);

      if (status === 'granted') {
        logger.info('✅ Screen Recording permission already granted');
        return { granted: true };
      }

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
   */
  public static async requestMicrophonePermission(): Promise<{
    granted: boolean;
    error?: string;
  }> {
    if (process.platform !== 'darwin') {
      return { granted: true };
    }

    try {
      logger.info('🔐 Requesting Microphone permission...');

      const status = systemPreferences.getMediaAccessStatus('microphone');
      logger.info(`Current Microphone permission status: ${status}`);

      if (status === 'granted') {
        logger.info('✅ Microphone permission already granted');
        return { granted: true };
      }

      if (status === 'denied') {
        const errorMsg =
          'Microphone permission denied. Please grant permission in System Settings > Privacy & Security > Microphone.';
        logger.warn('⚠️ Microphone permission denied');
        return {
          granted: false,
          error: errorMsg,
        };
      }

      // Request permission
      const granted = await systemPreferences.askForMediaAccess('microphone');
      logger.info(`Microphone permission ${granted ? 'granted' : 'denied'}`);

      return { granted };
    } catch (error) {
      logger.error('Error requesting Microphone permission', error as Error);
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

    return {
      microphone: systemPreferences.getMediaAccessStatus('microphone'),
      screenRecording: systemPreferences.getMediaAccessStatus('screen'),
    };
  }
}
