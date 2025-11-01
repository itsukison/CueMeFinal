import { EventEmitter } from "events";
import { spawn, ChildProcess } from "child_process";
import * as path from "path";
import * as fs from "fs";
import { app } from "electron";
import { DiagnosticLogger } from "./utils/DiagnosticLogger";

const logger = new DiagnosticLogger("SystemAudioCapture");

export interface AudioSource {
  id: string;
  name: string;
  type: "microphone" | "system";
  available: boolean;
}

export interface SystemAudioCaptureConfig {
  sampleRate: number;
  channelCount: number;
  bufferSize: number;
}

export interface SystemAudioCaptureEvents {
  "audio-data": (audioData: Buffer) => void;
  "source-changed": (source: AudioSource) => void;
  error: (error: Error) => void;
  "state-changed": (state: {
    isCapturing: boolean;
    currentSource?: AudioSource;
  }) => void;
}

export class SystemAudioCapture extends EventEmitter {
  private isCapturing: boolean = false;
  private currentSource: AudioSource | null = null;
  private mediaStream: MediaStream | null = null;
  private audioContext: AudioContext | null = null;
  private processor: ScriptProcessorNode | null = null;
  private config: SystemAudioCaptureConfig;

  // audioteejs integration (custom implementation)
  private audioTeeProcess: ChildProcess | null = null;
  private ffmpegTeeProcess: ChildProcess | null = null;

  constructor(config?: Partial<SystemAudioCaptureConfig>) {
    super();

    this.config = {
      sampleRate: 16000,
      channelCount: 1,
      bufferSize: 4096,
      ...config,
    };

    logger.info("Initialized with config", this.config);
    logger.debug("Environment info", {
      platform: process.platform,
      arch: process.arch,
      cwd: process.cwd(),
      execPath: process.execPath,
      resourcesPath: process.resourcesPath,
    });
  }

  /**
   * Get macOS version
   */
  private async getMacOSVersion(): Promise<{
    major: number;
    minor: number;
    patch: number;
  }> {
    logger.methodEntry("getMacOSVersion");

    return new Promise((resolve) => {
      const proc = spawn("sw_vers", ["-productVersion"]);
      let output = "";

      proc.stdout.on("data", (data) => {
        output += data.toString();
      });

      proc.on("close", () => {
        const parts = output.trim().split(".");
        const version = {
          major: parseInt(parts[0] || "0", 10),
          minor: parseInt(parts[1] || "0", 10),
          patch: parseInt(parts[2] || "0", 10),
        };
        logger.methodExit("getMacOSVersion", version);
        resolve(version);
      });

      proc.on("error", (error) => {
        logger.error("Failed to get macOS version", error);
        resolve({ major: 0, minor: 0, patch: 0 });
      });
    });
  }

  /**
   * Get available audio sources including system audio and microphone
   */
  public async getAvailableSources(): Promise<AudioSource[]> {
    logger.methodEntry("getAvailableSources");

    try {
      const sources: AudioSource[] = [];

      // Add microphone as a source (always available)
      sources.push({
        id: "microphone",
        name: "Microphone",
        type: "microphone",
        available: true,
      });

      // Add system audio source - platform specific
      if (process.platform === "darwin") {
        // macOS: Core Audio Taps (14.2+)
        const osVersion = await this.getMacOSVersion();

        if (osVersion.major >= 14 && osVersion.minor >= 2) {
          sources.push({
            id: "system-audio",
            name: "System Audio (Core Audio Taps)",
            type: "system",
            available: true,
          });
          logger.info("System audio available (Core Audio Taps via audiotee)", {
            osVersion,
          });
        } else {
          sources.push({
            id: "system-audio",
            name: `System Audio (Requires macOS 14.2+)`,
            type: "system",
            available: false,
          });
          logger.warn(
            `System audio unavailable - macOS ${osVersion.major}.${osVersion.minor} detected, 14.2+ required`,
            { osVersion }
          );
        }
      } else if (process.platform === "win32") {
        // Windows: Native Electron Loopback (Electron 30.5.1+)
        sources.push({
          id: "system-audio",
          name: "CABLE Output (VB-Audio Virtual Cable)",
          type: "system",
          available: true,
        });
        logger.info("System audio available (Native Electron Loopback)");
      }

      logger.methodExit("getAvailableSources", sources);
      return sources;
    } catch (error) {
      logger.error("Error enumerating sources", error);
      // Return at least microphone as fallback
      return [
        {
          id: "microphone",
          name: "Microphone",
          type: "microphone",
          available: true,
        },
      ];
    }
  }

  /**
   * Start capturing audio from the specified source
   */
  public async startCapture(sourceId: string): Promise<void> {
    if (this.isCapturing) {
      console.log(
        "[SystemAudioCapture] Already capturing, stopping current capture first"
      );
      await this.stopCapture();
    }

    try {
      console.log(
        "[SystemAudioCapture] Starting capture from source:",
        sourceId
      );

      const sources = await this.getAvailableSources();
      const targetSource = sources.find((s) => s.id === sourceId);

      if (!targetSource) {
        throw new Error(`Audio source not found: ${sourceId}`);
      }

      if (!targetSource.available) {
        throw new Error(`Audio source not available: ${targetSource.name}`);
      }

      this.currentSource = targetSource;

      if (sourceId === "microphone") {
        // Microphone capture is now handled in the renderer process
        // The renderer will send audio chunks via IPC
        console.log(
          "[SystemAudioCapture] Microphone source selected - capture handled by renderer"
        );
        // Don't call startMicrophoneCapture() - it will throw an error
      } else if (sourceId === "system-audio") {
        await this.startSystemAudioCapture();
      } else {
        throw new Error(`Unsupported audio source: ${sourceId}`);
      }

      this.isCapturing = true;
      this.emit("source-changed", targetSource);
      this.emit("state-changed", {
        isCapturing: true,
        currentSource: targetSource,
      });

      console.log(
        "[SystemAudioCapture] Successfully started capture from:",
        targetSource.name
      );
    } catch (error) {
      console.error("[SystemAudioCapture] Failed to start capture:", error);
      this.emit("error", error as Error);
      throw error;
    }
  }

  /**
   * Stop audio capture
   */
  public async stopCapture(): Promise<void> {
    if (!this.isCapturing) {
      console.log("[SystemAudioCapture] Not currently capturing");
      return;
    }

    try {
      console.log("[SystemAudioCapture] Stopping audio capture...");

      // Stop audioteejs if running
      if (this.audioTeeProcess) {
        console.log("[SystemAudioCapture] Stopping audioteejs...");

        // Send SIGTERM to gracefully stop
        this.audioTeeProcess.kill("SIGTERM");

        // Wait a bit for graceful shutdown
        await new Promise<void>((resolve) => {
          const timeout = setTimeout(() => {
            // Force kill if still running
            if (this.audioTeeProcess && !this.audioTeeProcess.killed) {
              this.audioTeeProcess.kill("SIGKILL");
            }
            resolve();
          }, 5000);

          this.audioTeeProcess?.once("exit", () => {
            clearTimeout(timeout);
            resolve();
          });
        });

        this.audioTeeProcess = null;
      }

      // Clean up audio processing
      if (this.processor) {
        this.processor.disconnect();
        this.processor = null;
      }

      if (this.audioContext) {
        await this.audioContext.close();
        this.audioContext = null;
      }

      // Stop media stream
      if (this.mediaStream) {
        this.mediaStream.getTracks().forEach((track) => {
          track.stop();
          console.log(
            "[SystemAudioCapture] Stopped track:",
            track.kind,
            track.label
          );
        });
        this.mediaStream = null;
      }

      this.isCapturing = false;
      this.currentSource = null;

      this.emit("state-changed", { isCapturing: false });
      console.log("[SystemAudioCapture] Successfully stopped capture");
    } catch (error) {
      console.error("[SystemAudioCapture] Error stopping capture:", error);
      this.emit("error", error as Error);
    }
  }

  /**
   * Switch to a different audio source
   */
  public async switchSource(sourceId: string): Promise<void> {
    console.log("[SystemAudioCapture] Switching to source:", sourceId);

    const wasCapturing = this.isCapturing;

    if (wasCapturing) {
      await this.stopCapture();
    }

    if (wasCapturing) {
      await this.startCapture(sourceId);
    }
  }

  /**
   * Get current capture state
   */
  public getState(): {
    isCapturing: boolean;
    currentSource: AudioSource | null;
  } {
    return {
      isCapturing: this.isCapturing,
      currentSource: this.currentSource,
    };
  }

  /**
   * Start microphone capture
   *
   * NOTE: Microphone capture has been moved to the renderer process.
   * This method is kept for backward compatibility but should not be used.
   * Use the MicrophoneCapture service in the renderer process instead.
   *
   * @deprecated Use MicrophoneCapture in renderer process
   */
  private async startMicrophoneCapture(): Promise<void> {
    throw new Error(
      "Microphone capture must be initiated from the renderer process. " +
        "Use the MicrophoneCapture service (src/services/MicrophoneCapture.ts) instead. " +
        "This is required because navigator.mediaDevices is only available in the browser context."
    );
  }

  /**
   * Get the audiotee binary path (following article's approach)
   * https://stronglytyped.uk/articles/packaging-shipping-electron-apps-audiotee
   */
  private getAudioteeBinaryPath(): string | undefined {
    logger.methodEntry("getAudioteeBinaryPath");

    // Production: Binary is directly in Resources/ (via extraResources)
    if (process.resourcesPath) {
      const productionPath = path.join(process.resourcesPath, "audiotee");
      logger.debug("Checking production path", { productionPath });
      
      if (fs.existsSync(productionPath)) {
        logger.info("✅ Found audiotee binary (production)", { path: productionPath });
        return productionPath;
      }
    }

    // Development: Use custom binary
    if (!app.isPackaged) {
      const devPath = path.join(process.cwd(), "custom-binaries", "audiotee");
      logger.debug("Checking dev path", { devPath });
      
      if (fs.existsSync(devPath)) {
        logger.info("✅ Found audiotee binary (development)", { path: devPath });
        return devPath;
      }
    }

    logger.error("❌ audiotee binary not found", null, {
      resourcesPath: process.resourcesPath,
      cwd: process.cwd(),
      isPackaged: app.isPackaged,
    });

    return undefined;
  }

  /**
   * Start system audio capture - routes to platform-specific implementation
   */
  private async startSystemAudioCapture(): Promise<void> {
    if (process.platform === "darwin") {
      // macOS: Use audioteejs
      await this.startMacOSSystemAudioCapture();
    } else if (process.platform === "win32") {
      // Windows: Use native loopback
      await this.startWindowsSystemAudioCapture();
    } else {
      throw new Error(
        `System audio capture not supported on ${process.platform}`
      );
    }
  }

  /**
   * Start macOS system audio capture using audioteejs (Core Audio Taps)
   */
  private async startMacOSSystemAudioCapture(): Promise<void> {
    logger.methodEntry("startMacOSSystemAudioCapture");

    try {
      const binaryPath = this.getAudioteeBinaryPath();

      if (!binaryPath || !fs.existsSync(binaryPath)) {
        throw new Error(
          `audiotee binary not found. Checked: ${binaryPath || "no path resolved"}`
        );
      }

      logger.info("Using audiotee binary", {
        path: binaryPath,
        size: fs.statSync(binaryPath).size,
      });

      // Build arguments for audiotee binary
      const args = [
        "--sample-rate",
        "16000",
        "--chunk-duration",
        "0.2", // 200ms = 0.2 seconds
      ];

      logger.info("Spawning audiotee process", {
        binaryPath,
        args,
        cwd: process.cwd(),
      });

      // Spawn the audiotee binary (following article's approach)
      this.audioTeeProcess = spawn(binaryPath, args, {
        // Standard stdio for binary output
        stdio: ["ignore", "pipe", "pipe"],

        // Not detached - part of main app process tree
        detached: false,
        env: process.env,
      });

      logger.info("audiotee process spawned", {
        pid: this.audioTeeProcess.pid,
        killed: this.audioTeeProcess.killed,
      });

      let audioDataCount = 0;
      let lastAudioLogTime = Date.now();

      // Handle stdout (audio data)
      this.audioTeeProcess.stdout?.on("data", (data: Buffer) => {
        audioDataCount++;

        // Log first chunk and every 50 chunks
        if (audioDataCount === 1) {
          // 🔬 DETAILED ANALYSIS: Check if buffer is all zeros AT SOURCE
          const hexPreview = data.slice(0, 32).toString('hex');
          const isAllZeros = data.every(byte => byte === 0);
          
          // Calculate RMS of original buffer
          const samples = new Int16Array(data.buffer, data.byteOffset, data.length / 2);
          let sumSquares = 0;
          for (let i = 0; i < samples.length; i++) {
            sumSquares += samples[i] * samples[i];
          }
          const rms = Math.sqrt(sumSquares / samples.length);
          const normalizedRMS = rms / 32768;
          
          logger.info("🎵 FIRST audio chunk from audiotee (RAW BUFFER ANALYSIS)", {
            bytes: data.length,
            hexPreview: hexPreview,
            isAllZeros: isAllZeros,
            rms: rms.toFixed(2),
            normalizedRMS: normalizedRMS.toFixed(4),
            isSilent: normalizedRMS < 0.01,
            listenerCount: this.listenerCount("audio-data"),
            hasListeners: this.listenerCount("audio-data") > 0,
          });
          
          if (isAllZeros) {
            logger.error("❌ CRITICAL: audiotee produced ALL-ZERO buffer!", {
              message: "The binary is running but producing silent audio",
              possibleCauses: [
                "1. macOS Screen Recording permission conflict",
                "2. Core Audio Taps access denied",
                "3. Binary lacks proper entitlements",
                "4. No audio playing on system"
              ]
            });
          }
        } else if (audioDataCount % 50 === 0) {
          const now = Date.now();
          const elapsed = now - lastAudioLogTime;
          logger.info(
            `🎵 Audio chunks from audiotee: ${audioDataCount} total, ${data.length} bytes, ${elapsed}ms since last log`,
            {
              listenerCount: this.listenerCount("audio-data"),
            }
          );
          lastAudioLogTime = now;
        }

        
        // ✅ CRITICAL FIX: Copy buffer before emitting!
        // audiotee reuses the same buffer for performance, so we must copy it
        // before passing to async handlers. Otherwise, by the time the handler
        // processes the buffer, audiotee has already overwritten it with new data
        // (or zeros), resulting in corrupted/silent audio.
        const bufferCopy = Buffer.from(data);
        
        // 🔬 VERIFY: Check if copy operation preserved data
        if (audioDataCount === 1) {
          const copyHexPreview = bufferCopy.slice(0, 32).toString('hex');
          const copyIsAllZeros = bufferCopy.every(byte => byte === 0);
          logger.info("📋 Buffer copy verification", {
            originalLength: data.length,
            copyLength: bufferCopy.length,
            copyHexPreview: copyHexPreview,
            copyIsAllZeros: copyIsAllZeros,
            copiedSuccessfully: data.length === bufferCopy.length
          });
        }
        
        // Emit audio data directly - already in correct format (Int16, mono, 16kHz)!
        logger.debug(`Emitting audio-data event (chunk ${audioDataCount})`);
        this.emit('audio-data', bufferCopy);
      });

      // Handle stderr (logs and events)
      this.audioTeeProcess.stderr?.on("data", (data: Buffer) => {
        const text = data.toString("utf8");
        const lines = text.split("\n").filter((line) => line.trim());

        for (const line of lines) {
          try {
            const logMessage = JSON.parse(line);

            if (logMessage.message_type === "stream_start") {
              logger.info("✅ AudioTee capture started", logMessage.data);
            } else if (logMessage.message_type === "stream_stop") {
              logger.info("AudioTee capture stopped", logMessage.data);
            } else if (logMessage.message_type === "error") {
              logger.error("AudioTee error", null, logMessage.data);
              this.emit("error", new Error(logMessage.data.message));
            } else if (logMessage.message_type === "info") {
              // 🔬 LOG ALL INFO MESSAGES (not just stream_start)
              logger.info(`AudioTee [${logMessage.message_type}]`, logMessage.data);
            } else if (logMessage.message_type !== "debug") {
              // 🔬 LOG ALL NON-DEBUG MESSAGES
              logger.info(`AudioTee [${logMessage.message_type}]`, logMessage.data);
            } else {
              // Even debug messages - log first 10 for diagnostics
              if (audioDataCount < 10) {
                logger.debug(`AudioTee [debug]`, logMessage.data);
              }
            }
          } catch (parseError) {
            // Not JSON, just log it (could be raw output)
            logger.info("AudioTee raw output:", line);
          }
        }
      });

      // Handle process errors
      this.audioTeeProcess.on("error", (error) => {
        logger.error("AudioTee process error", error, {
          pid: this.audioTeeProcess?.pid,
          killed: this.audioTeeProcess?.killed,
        });
        this.emit("error", error);
      });

      // Handle process exit
      this.audioTeeProcess.on("exit", (code, signal) => {
        logger.info("AudioTee process exited", {
          code,
          signal,
          audioDataCount,
        });
        if (code !== 0 && code !== null) {
          const error = new Error(`AudioTee process exited with code ${code}`);
          logger.error("AudioTee process exited with error", error, {
            code,
            signal,
          });
          this.emit("error", error);
        }
      });

      logger.info("✅ macOS system audio capture started successfully");
    } catch (error) {
      logger.error("❌ Failed to start macOS system audio", error);
      throw error;
    }
  }

  /**
   * Start Windows system audio capture using native Electron loopback
   *
   * NOTE: This method also needs to be moved to renderer process for Windows support.
   * getDisplayMedia() is only available in the renderer process.
   *
   * @deprecated Windows system audio capture needs renderer implementation
   */
  private async startWindowsSystemAudioCapture(): Promise<void> {
    console.log(
      "[SystemAudioCapture] Starting system audio capture with FFmpeg..."
    );

    try {
      const ffmpegPath = "ffmpeg"; // assumes ffmpeg is in PATH

      const args = [
        "-f",
        "dshow",
        "-i",
        "audio=CABLE Output (VB-Audio Virtual Cable)",
        "-acodec",
        "pcm_s16le",
        "-ar",
        "16000",
        "-ac",
        "1",
        "-f",
        "s16le",
        "-",
      ];

      console.log("[VirtualAudioCapture] Spawning FFmpeg:", ffmpegPath, args);

      this.ffmpegTeeProcess = spawn(ffmpegPath, args);

      // Handle stdout (raw PCM audio)
      this.ffmpegTeeProcess.stdout?.on("data", (data: Buffer) => {
        // Emit audio data in 16-bit mono 16kHz chunks
        this.emit("audio-data", data);
      });

      // Handle stderr (logs and events)
      this.ffmpegTeeProcess.stderr?.on("data", (data: Buffer) => {
        const text = data.toString("utf8");
        const lines = text.split("\n").filter((line) => line.trim());

        for (const line of lines) {
          console.log("[VirtualAudioCapture] FFmpeg:", line);
        }
      });

      // Handle process errors
      this.ffmpegTeeProcess.on("error", (error) => {
        console.error("[VirtualAudioCapture] FFmpeg process error:", error);
        this.emit("error", error);
      });

      // Handle process exit
      this.ffmpegTeeProcess.on("exit", (code, signal) => {
        console.log("[VirtualAudioCapture] FFmpeg process exited:", {
          code,
          signal,
        });
        if (code !== 0 && code !== null) {
          this.emit("error", new Error(`FFmpeg exited with code ${code}`));
        }
      });

      console.log(
        "[VirtualAudioCapture] ✅ System audio capture started successfully"
      );
    } catch (error) {
      console.error(
        "[VirtualAudioCapture] Failed to start system audio:",
        error
      );
      throw error;
    }
  }

  /**
   * Setup audio processing pipeline for the current media stream
   */
  private async setupAudioProcessing(): Promise<void> {
    if (!this.mediaStream) {
      throw new Error("No media stream available for audio processing");
    }

    console.log("[SystemAudioCapture] Setting up audio processing...");

    try {
      // Create audio context
      this.audioContext = new AudioContext({
        sampleRate: this.config.sampleRate,
      });

      // Resume context if suspended
      if (this.audioContext.state === "suspended") {
        await this.audioContext.resume();
      }

      // Create media stream source
      const source = this.audioContext.createMediaStreamSource(
        this.mediaStream
      );

      // Create script processor for audio data extraction
      this.processor = this.audioContext.createScriptProcessor(
        this.config.bufferSize,
        this.config.channelCount,
        this.config.channelCount
      );

      // Setup audio processing callback
      let scriptProcessorChunkCount = 0;
      this.processor.onaudioprocess = (event) => {
        try {
          const inputBuffer = event.inputBuffer;
          const inputData = inputBuffer.getChannelData(0);

          // Check for actual audio data
          const hasAudio = inputData.some((sample) => Math.abs(sample) > 0.001);

          if (hasAudio) {
            scriptProcessorChunkCount++;

            if (scriptProcessorChunkCount === 1) {
              logger.info(
                "🎵 FIRST audio chunk from ScriptProcessor (microphone)",
                {
                  samples: inputData.length,
                  listenerCount: this.listenerCount("audio-data"),
                }
              );
            }

            // Convert Float32Array to Buffer for compatibility with existing AudioStreamProcessor
            const buffer = Buffer.alloc(inputData.length * 2);
            for (let i = 0; i < inputData.length; i++) {
              const sample = Math.max(
                -32768,
                Math.min(32767, inputData[i] * 32768)
              );
              buffer.writeInt16LE(sample, i * 2);
            }

            this.emit("audio-data", buffer);
          }
        } catch (error) {
          logger.error(
            "Audio processing error in ScriptProcessor",
            error as Error
          );
          this.emit("error", error as Error);
        }
      };

      // Connect the audio pipeline
      source.connect(this.processor);
      this.processor.connect(this.audioContext.destination);

      console.log("[SystemAudioCapture] Audio processing pipeline established");
    } catch (error) {
      console.error(
        "[SystemAudioCapture] Failed to setup audio processing:",
        error
      );
      throw error;
    }
  }

  /**
   * Cleanup resources
   */
  public destroy(): void {
    console.log("[SystemAudioCapture] Destroying instance...");

    this.stopCapture().catch((error) => {
      console.error("[SystemAudioCapture] Error during cleanup:", error);
    });

    this.removeAllListeners();
  }
}
