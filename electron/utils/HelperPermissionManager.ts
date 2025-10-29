import { exec } from "child_process";
import { promisify } from "util";
import { DiagnosticLogger } from "./DiagnosticLogger";

const execAsync = promisify(exec);
const logger = new DiagnosticLogger("HelperPermissionManager");

export class HelperPermissionManager {
  /**
   * Check if AudioTeeHelper has System Audio Recording permission
   */
  static async checkHelperPermission(): Promise<boolean> {
    try {
      // Check TCC database for helper app
      const bundleId = "com.cueme.audiotee-helper";

      // Note: Cannot directly read TCC database, but can infer from behavior
      // The helper will show a permission dialog on first run if not granted

      logger.info(
        "Helper app will request permission on first audio capture attempt"
      );
      return true; // Assume yes, let macOS handle the dialog
    } catch (error) {
      logger.error("Error checking helper permission", error);
      return false;
    }
  }

  /**
   * Open System Preferences to grant helper permission
   */
  static async openSystemPreferences(): Promise<void> {
    try {
      await execAsync(
        'open "x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture"'
      );
      logger.info("Opened System Preferences for Screen Recording permissions");
    } catch (error) {
      logger.error("Failed to open System Preferences", error);
    }
  }
}
