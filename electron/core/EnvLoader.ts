import dotenv from "dotenv";
import path from "path";
import fs from "fs";

/**
 * Environment variable loader with multiple fallback paths
 * Tries various locations to find .env file for better reliability
 */
export class EnvLoader {
  /**
   * Load environment variables from .env file
   * Tries multiple paths in order of preference
   */
  static load(): void {
    // Use console.log here since Logger isn't initialized yet
    console.log('[ENV] Debug info:', {
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
    
    console.log('[ENV] Attempting to load from paths:', envPaths);

    let envLoaded = false;
    let loadedPath = '';
    
    for (const envPath of envPaths) {
      try {
        // Check if file exists first
        if (fs.existsSync(envPath)) {
          console.log(`[ENV] Found .env file at: ${envPath}`);
          
          const result = dotenv.config({ path: envPath });
          if (!result.error) {
            console.log(`[ENV] ✅ Successfully loaded from: ${envPath}`);
            envLoaded = true;
            loadedPath = envPath;
            
            // Log which keys were loaded (without values)
            const keys = Object.keys(result.parsed || {});
            console.log(`[ENV] Loaded ${keys.length} variables: ${keys.join(', ')}`);
            break;
          } else {
            console.warn(`[ENV] File exists but failed to parse: ${envPath}`, result.error);
          }
        }
      } catch (error) {
        console.warn(`[ENV] Error checking path ${envPath}:`, error);
      }
    }

    if (!envLoaded) {
      console.warn('[ENV] ⚠️  No .env file found in any location, using default dotenv.config()');
      dotenv.config(); // Fallback to default
    }
    
    // Validate loaded variables
    const validation = this.validate();
    if (!validation.valid) {
      console.error('[ENV] ❌ Missing required variables:', validation.missing);
    } else {
      console.log('[ENV] ✅ All required variables present');
    }
  }

  /**
   * Validate that required environment variables are present
   */
  static validate(): { valid: boolean; missing: string[]; present: string[] } {
    const required = ['GEMINI_API_KEY'];
    const optional = ['OPENAI_API_KEY', 'NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY'];
    
    const missing: string[] = [];
    const present: string[] = [];
    
    for (const key of required) {
      if (!process.env[key] || process.env[key]?.trim() === '') {
        missing.push(key);
        console.error(`[ENV] Required variable missing or empty: ${key}`);
      } else {
        present.push(key);
        console.log(`[ENV] Required variable present: ${key}`);
      }
    }

    // Log status of optional keys
    for (const key of optional) {
      if (process.env[key] && process.env[key]?.trim() !== '') {
        present.push(key);
        console.log(`[ENV] Optional variable present: ${key}`);
      } else {
        console.warn(`[ENV] Optional variable missing: ${key}`);
      }
    }

    return {
      valid: missing.length === 0,
      missing,
      present
    };
  }
}
