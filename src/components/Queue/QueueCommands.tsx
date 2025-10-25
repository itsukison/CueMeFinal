import React, {
  useState,
  useEffect,
  useRef,
  forwardRef,
  useImperativeHandle,
} from "react";
import { createPortal } from "react-dom";
import {
  LogOut,
  MessageCircle,
  Command,
  ChevronDown,
  Database,
  Bot,
  Mic,
  MicIcon,
  FileText,
} from "lucide-react";
import { Dialog, DialogContent, DialogClose } from "../ui/dialog";
import {
  DetectedQuestion,
  AudioStreamState,
  AudioSource,
} from "../../types/audio-stream";

interface QnACollection {
  id: string;
  name: string;
  description: string | null;
  qna_count?: number;
}

// Removed Document interface and ContentItem type since we only use collections now

interface ResponseMode {
  type: "plain" | "qna";
  collectionId?: string;
  collectionName?: string;
}

interface QueueCommandsProps {
  onTooltipVisibilityChange: (visible: boolean, height: number) => void;
  screenshots: Array<{ path: string; preview: string }>;
  onChatToggle: () => void;
  responseMode?: ResponseMode;
  onResponseModeChange?: (mode: ResponseMode) => void;
  isAuthenticated?: boolean;
  onQuestionDetected?: (question: DetectedQuestion) => void;
  onAudioStreamStateChange?: (state: AudioStreamState) => void;
}

export interface QueueCommandsRef {
  stopListening: () => void;
}

const QueueCommands = forwardRef<QueueCommandsRef, QueueCommandsProps>(
  (
    {
      onTooltipVisibilityChange,
      screenshots,
      onChatToggle,
      responseMode = { type: "plain" },
      onResponseModeChange,
      isAuthenticated = false,
      onQuestionDetected,
      onAudioStreamStateChange,
    },
    ref
  ) => {
    const [isTooltipVisible, setIsTooltipVisible] = useState(false);
    const tooltipRef = useRef<HTMLDivElement>(null);

    // Audio result for display
    const [audioResult, setAudioResult] = useState<string | null>(null);

    // Response mode dropdown state
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const [collections, setCollections] = useState<QnACollection[]>([]);
    const [contentLoading, setContentLoading] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const triggerRef = useRef<HTMLButtonElement>(null);
    const [dropdownPosition, setDropdownPosition] = useState({
      top: 0,
      left: 0,
      width: 0,
      height: 0,
    });

    // Audio Stream state (new always-on feature)
    const [isListening, setIsListening] = useState(false);
    const [audioStreamState, setAudioStreamState] =
      useState<AudioStreamState | null>(null);
    const [audioContext, setAudioContext] = useState<AudioContext | null>(null);
    const [processor, setProcessor] = useState<
      ScriptProcessorNode | AudioWorkletNode | null
    >(null);
    const [audioAnalyser, setAudioAnalyser] = useState<AnalyserNode | null>(
      null
    );
    const [pollingInterval, setPollingInterval] = useState<number | null>(null);
    const frontendListeningRef = useRef(false); // Local listening state to avoid React delays - using ref to prevent stale closure
    const audioChunks = useRef<Blob[]>([]);

    // Audio source management
    const [currentAudioSource, setCurrentAudioSource] =
      useState<AudioSource | null>(null);

    // Audio feedback and status - Keep minimal state for backend communication
    const [audioError, setAudioError] = useState<string | null>(null);

    // Remove all chat-related state, handlers, and the Dialog overlay from this file.

    // Expose methods to parent component
    useImperativeHandle(
      ref,
      () => ({
        stopListening: () => {
          if (isListening) {
            setIsListening(false);
            stopAudioCapture();
            window.electronAPI.audioStreamStop().catch(console.error);
          }
        },
      }),
      [isListening]
    );

    useEffect(() => {
      let tooltipHeight = 0;
      if (tooltipRef.current && isTooltipVisible) {
        tooltipHeight = tooltipRef.current.offsetHeight + 10;
      }
      onTooltipVisibilityChange(isTooltipVisible, tooltipHeight);
    }, [isTooltipVisible]);

    // Load content when authenticated
    useEffect(() => {
      if (isAuthenticated && isDropdownOpen && collections.length === 0) {
        loadContent();
      }
    }, [isAuthenticated, isDropdownOpen]);

    // Close dropdown when clicking outside
    useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
        if (
          dropdownRef.current &&
          !dropdownRef.current.contains(event.target as Node) &&
          triggerRef.current &&
          !triggerRef.current.contains(event.target as Node)
        ) {
          setIsDropdownOpen(false);
        }
      };

      if (isDropdownOpen) {
        document.addEventListener("mousedown", handleClickOutside);
      }

      return () => {
        document.removeEventListener("mousedown", handleClickOutside);
      };
    }, [isDropdownOpen]);

    // Listen for keyboard shortcut to toggle listen
    useEffect(() => {
      const handleTriggerListenToggle = () => {
        console.log(
          "[QueueCommands] Listen toggle triggered via keyboard shortcut"
        );
        handleListenToggle();
      };

      document.addEventListener(
        "trigger-listen-toggle",
        handleTriggerListenToggle
      );

      return () => {
        document.removeEventListener(
          "trigger-listen-toggle",
          handleTriggerListenToggle
        );
      };
    }, [isListening, isAuthenticated]); // Include dependencies so the handler has access to current state

    // Update dropdown position when opened
    useEffect(() => {
      if (isDropdownOpen && triggerRef.current) {
        const rect = triggerRef.current.getBoundingClientRect();
        const gap = 16; // 16px gap
        const viewportHeight = window.innerHeight;
        const viewportWidth = window.innerWidth;

        // Calculate dynamic content height
        const baseHeight = 60; // Plain mode option height + padding
        const separatorHeight = isAuthenticated ? 17 : 0; // Separator height
        const itemHeight = 52; // Each collection item height (including padding)
        const loadingHeight = 36; // Loading/empty state height
        const padding = 8; // Container padding

        let contentHeight = baseHeight + separatorHeight + padding;

        if (isAuthenticated) {
          if (contentLoading) {
            contentHeight += loadingHeight;
          } else if (collections.length > 0) {
            contentHeight += collections.length * itemHeight;
          } else {
            contentHeight += loadingHeight; // "No files found" message
          }
        } else {
          contentHeight += loadingHeight; // "Sign in to use files" message
        }

        // Set reasonable min/max bounds
        const minDropdownHeight = 80;
        const maxDropdownHeight = 400;
        const idealHeight = Math.max(
          minDropdownHeight,
          Math.min(maxDropdownHeight, contentHeight)
        );

        // Calculate available space below and above the trigger
        const spaceBelow = viewportHeight - rect.bottom - gap - 20; // 20px bottom margin
        const spaceAbove = rect.top - gap - 20; // 20px top margin

        // Determine final height and position
        let finalHeight: number;
        let shouldPositionAbove = false;

        if (spaceBelow >= idealHeight) {
          // Enough space below
          finalHeight = idealHeight;
          shouldPositionAbove = false;
        } else if (spaceAbove >= idealHeight) {
          // Not enough space below, but enough above
          finalHeight = idealHeight;
          shouldPositionAbove = true;
        } else {
          // Not enough space in either direction, use available space
          if (spaceBelow > spaceAbove) {
            finalHeight = Math.max(minDropdownHeight, spaceBelow);
            shouldPositionAbove = false;
          } else {
            finalHeight = Math.max(minDropdownHeight, spaceAbove);
            shouldPositionAbove = true;
          }
        }

        // Calculate vertical position
        let top: number;
        if (shouldPositionAbove) {
          top = rect.top + window.scrollY - finalHeight - gap;
        } else {
          top = rect.bottom + window.scrollY + gap;
        }

        // Calculate horizontal position and ensure it stays within viewport
        const dropdownWidth = Math.max(160, rect.width);
        let left = rect.left + window.scrollX;

        // Adjust if dropdown would overflow right edge
        if (left + dropdownWidth > viewportWidth) {
          left = viewportWidth - dropdownWidth - 16; // 16px margin from edge
        }

        // Ensure dropdown doesn't go off left edge
        if (left < 16) {
          left = 16; // 16px margin from edge
        }

        setDropdownPosition({
          top,
          left,
          width: dropdownWidth,
          height: finalHeight,
        });
      }
    }, [isDropdownOpen, collections, contentLoading, isAuthenticated]);

    // Initialize default audio source
    useEffect(() => {
      if (isAuthenticated && !currentAudioSource) {
        // Set default to microphone
        setCurrentAudioSource({
          id: "microphone",
          name: "Microphone",
          type: "microphone",
          available: true,
        });
      }
    }, [isAuthenticated, currentAudioSource]);

    // Audio Stream event listeners setup
    useEffect(() => {
      if (!isAuthenticated) return;

      const cleanupFunctions = [
        window.electronAPI.onAudioQuestionDetected(
          (question: DetectedQuestion) => {
            console.log(
              "[QueueCommands] Question detected (pre-refined):",
              question
            );
            onQuestionDetected?.(question);
          }
        ),

        window.electronAPI.onAudioStreamStateChanged(
          (state: AudioStreamState) => {
            console.log("[QueueCommands] Audio stream state changed:", state);
            setAudioStreamState(state);

            // Update current audio source from state
            if (state.currentAudioSource) {
              setCurrentAudioSource(state.currentAudioSource);
            }

            onAudioStreamStateChange?.(state);
          }
        ),

        window.electronAPI.onAudioStreamError((error: string) => {
          console.error("[QueueCommands] Audio stream error:", error);
          setAudioError(error);

          // Check if this is a fallback scenario (error message contains "fallback" or "using microphone")
          const isAutoFallback =
            error.toLowerCase().includes("fallback") ||
            error.toLowerCase().includes("using microphone") ||
            error.toLowerCase().includes("restored");

          if (!isAutoFallback) {
            // Only stop listening for actual failures, not fallbacks
            setIsListening(false);
            stopAudioCapture();
          }
        }),
      ];

      return () => {
        cleanupFunctions.forEach((cleanup) => cleanup());
      };
    }, [isAuthenticated, onQuestionDetected, onAudioStreamStateChange]);

    const loadContent = async () => {
      if (!isAuthenticated) return;

      try {
        setContentLoading(true);
        console.log(
          "[QueueCommands] Loading collections for authenticated user..."
        );

        // Only load collections since documents are now part of collections
        const userCollections = await window.electronAPI.invoke(
          "qna-get-collections"
        );

        console.log("[QueueCommands] Loaded collections:", userCollections);

        setCollections(userCollections);
      } catch (error) {
        console.error("Error loading collections:", error);
        setCollections([]);
      } finally {
        setContentLoading(false);
      }
    };

    const handleResponseModeChange = (mode: ResponseMode) => {
      onResponseModeChange?.(mode);
      setIsDropdownOpen(false);
    };

    const toggleDropdown = () => {
      console.log(
        "[QueueCommands] Toggling dropdown. Current state:",
        isDropdownOpen
      );
      console.log("[QueueCommands] Authentication status:", isAuthenticated);
      setIsDropdownOpen(!isDropdownOpen);
    };

    /**
     * Start audio capture and streaming
     * 
     * NEW SYSTEM (Gemini Live):
     * - Microphone audio: Captured here and sent to dualAudioProcessMicrophoneChunk
     * - System audio: Captured by backend and sent directly to Gemini Live
     * - Both streams go to separate Gemini Live sessions for real-time question detection
     */
    const startAudioCapture = async (): Promise<void> => {
      try {
        console.log("[QueueCommands] Starting audio capture (Gemini Live system)...");

        // System audio is handled by the backend DualAudioCaptureManager
        // It captures system audio and streams directly to Gemini Live (opponent source)
        if (currentAudioSource?.type === "system") {
          console.log(
            "[QueueCommands] System audio selected - backend will handle capture and stream to Gemini Live"
          );
          
          // Just set up the backend audio stream processing
          // The native Swift binary will provide audio data to the backend
          console.log("[QueueCommands] ✅ System audio capture delegated to backend");
          
          // For system audio, no frontend processing needed
          // The backend native Swift binary handles everything
          return;
        }

        // For microphone input, set up frontend capture
        console.log("[QueueCommands] Setting up microphone capture...");

        // Check microphone permissions first
        try {
          await navigator.mediaDevices.getUserMedia({ audio: true });
          console.log("[QueueCommands] Microphone permission granted");
        } catch (permError) {
          console.error(
            "[QueueCommands] Microphone permission denied:",
            permError
          );
          throw new Error("Microphone permission required for audio streaming");
        }

        // Get user media with audio
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            sampleRate: { ideal: 16000 },
            channelCount: { ideal: 1 },
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });

        console.log(
          "[QueueCommands] Got media stream, creating AudioContext..."
        );

        // Create AudioContext for real-time processing
        const ctx = new AudioContext({ sampleRate: 16000 });
        console.log("[QueueCommands] AudioContext created, state:", ctx.state);

        // Resume context if suspended (required by some browsers)
        if (ctx.state === "suspended") {
          await ctx.resume();
          console.log("[QueueCommands] AudioContext resumed");
        }

        const source = ctx.createMediaStreamSource(stream);
        console.log("[QueueCommands] Media stream source created");
        window.electronAPI.invoke(
          "debug-log",
          "[QueueCommands] Media stream source created"
        );

        // Test if we can get any audio data from the stream
        const track = stream.getAudioTracks()[0];
        console.log("[QueueCommands] Audio track info:", {
          enabled: track.enabled,
          readyState: track.readyState,
          muted: track.muted,
          settings: track.getSettings(),
        });
        window.electronAPI.invoke(
          "debug-log",
          "[QueueCommands] Audio track - enabled: " +
            track.enabled +
            ", readyState: " +
            track.readyState +
            ", muted: " +
            track.muted
        );

        try {
          // Try modern AudioWorklet API first
          console.log("[QueueCommands] About to attempt AudioWorklet setup...");
          window.electronAPI.invoke(
            "debug-log",
            "[QueueCommands] About to attempt AudioWorklet setup..."
          );

          // CRITICAL: Set frontendListening to true BEFORE connecting AudioWorklet
          // This prevents race condition where chunks arrive before flag is set
          frontendListeningRef.current = true;
          console.log("[QueueCommands] Set frontendListening to true (before AudioWorklet connection)");
          window.electronAPI.invoke(
            "debug-log",
            "[QueueCommands] Set frontendListening to true (before AudioWorklet connection)"
          );

          // Construct the correct path for AudioWorklet processor
          // In development: served by Vite dev server
          // In production: needs to be relative to the current page location
          const workletPath = import.meta.env.DEV 
            ? "/audio-worklet-processor.js"
            : new URL("/audio-worklet-processor.js", window.location.href).href;
          
          console.log("[QueueCommands] Loading AudioWorklet module from:", workletPath);
          window.electronAPI.invoke(
            "debug-log",
            `[QueueCommands] Loading AudioWorklet module from: ${workletPath}`
          );
          
          await ctx.audioWorklet.addModule(workletPath);
          
          console.log("[QueueCommands] ✅ AudioWorklet module loaded successfully");
          window.electronAPI.invoke(
            "debug-log",
            "[QueueCommands] AudioWorklet module loaded successfully"
          );
          
          console.log("[QueueCommands] Creating AudioWorkletNode...");
          const workletNode = new AudioWorkletNode(
            ctx,
            "audio-capture-processor"
          );
          
          console.log("[QueueCommands] ✅ AudioWorkletNode created successfully");
          window.electronAPI.invoke(
            "debug-log",
            "[QueueCommands] AudioWorkletNode created successfully"
          );

          let chunkCount = 0;

          workletNode.port.onmessage = async (event) => {
            const {
              type,
              data: inputData,
              message,
              length,
              durationMs,
              triggerReason,
            } = event.data;

            if (type === "log") {
              console.log("[QueueCommands] AudioWorklet:", message);
              return;
            }

            if (type === "audio-chunk") {
              chunkCount++;
              const currentlyListening = frontendListeningRef.current;
              
              // Log only every 50 chunks to avoid spam (50 chunks = ~6.4 seconds)
              if (chunkCount % 50 === 0) {
                console.log(
                  `[QueueCommands] Streaming: ${chunkCount} chunks sent (${(chunkCount * 128 / 1000).toFixed(1)}s)`
                );
              }

              if (!currentlyListening) {
                // Only log first dropped chunk to avoid spam
                if (chunkCount === 1) {
                  console.log("[QueueCommands] Not listening, dropping chunks");
                }
                return;
              }

              // Send the audio chunk immediately to backend (no buffering!)
              try {
                // Validate Float32Array
                if (!(inputData instanceof Float32Array)) {
                  console.error(
                    "[QueueCommands] Invalid data type:",
                    inputData.constructor.name
                  );
                  return;
                }

                // Send microphone audio to Gemini Live (continuous streaming)
                await window.electronAPI.dualAudioProcessMicrophoneChunk(inputData);
                
                // Success - no need to log every chunk (too spammy)
              } catch (error) {
                console.error(
                  "[QueueCommands] Error sending audio chunk:",
                  error
                );
                // Don't stop listening on individual chunk errors
              }
            }
          };

          source.connect(workletNode);
          workletNode.connect(ctx.destination);

          console.log(
            "[QueueCommands] AudioWorklet connected to source and destination"
          );
          window.electronAPI.invoke(
            "debug-log",
            "[QueueCommands] AudioWorklet connected, context state: " +
              ctx.state
          );

          setAudioContext(ctx);
          setProcessor(workletNode as any);

          console.log("[QueueCommands] AudioWorklet setup completed");
          window.electronAPI.invoke(
            "debug-log",
            "[QueueCommands] AudioWorklet setup completed"
          );

          // Test worklet and show status after 1 second
          setTimeout(() => {
            console.log(
              "[QueueCommands] AudioWorklet status check after 1 second"
            );
            window.electronAPI.invoke(
              "debug-log",
              "[QueueCommands] AudioWorklet status check after 1 second"
            );
          }, 1000);
        } catch (workletError) {
          console.error(
            "[QueueCommands] ❌ AudioWorklet failed:",
            workletError
          );
          window.electronAPI.invoke(
            "debug-log",
            "[QueueCommands] AudioWorklet failed: " + (workletError instanceof Error ? workletError.message : String(workletError))
          );
          
          console.warn(
            "[QueueCommands] Falling back to ScriptProcessor (deprecated but more compatible)"
          );
          window.electronAPI.invoke(
            "debug-log",
            "[QueueCommands] Falling back to ScriptProcessor"
          );

          // Fallback to ScriptProcessorNode
          const scriptProcessor = ctx.createScriptProcessor(4096, 1, 1);
          console.log("[QueueCommands] ✅ ScriptProcessor created as fallback");
          window.electronAPI.invoke(
            "debug-log",
            "[QueueCommands] ScriptProcessor created successfully"
          );

          let chunkCount = 0;
          scriptProcessor.onaudioprocess = async (event) => {
            chunkCount++;
            console.log(
              `[QueueCommands] Audio process event ${chunkCount}, frontendListeningRef:`,
              frontendListeningRef.current
            );

            // CRITICAL: Use frontendListeningRef.current instead of isListening
            // to avoid stale closure issues with React state
            if (!frontendListeningRef.current) {
              console.log(
                "[QueueCommands] Not listening, dropping audio chunk"
              );
              return;
            }

            const inputBuffer = event.inputBuffer;
            const inputData = inputBuffer.getChannelData(0);

            // Calculate audio level for visualization (still needed for internal monitoring)
            const rms = Math.sqrt(
              inputData.reduce((sum, sample) => sum + sample * sample, 0) /
                inputData.length
            );
            // Note: Audio level no longer displayed in UI but useful for debugging

            // Check for actual audio data
            const hasAudio = inputData.some(
              (sample) => Math.abs(sample) > 0.001
            );
            console.log(
              "[QueueCommands] Audio chunk - samples:",
              inputData.length,
              "hasAudio:",
              hasAudio
            );

            if (hasAudio) {
              // Send Float32Array directly as expected by the preload API
              try {
                console.log(
                  "[QueueCommands] Sending audio chunk to main process (Gemini Live)..."
                );
                // FIXED: Use dualAudioProcessMicrophoneChunk for Gemini Live (same as AudioWorklet path)
                await window.electronAPI.dualAudioProcessMicrophoneChunk(inputData);
                console.log("[QueueCommands] Audio chunk sent successfully to Gemini Live");
              } catch (error) {
                console.error(
                  "[QueueCommands] Error sending audio chunk:",
                  error
                );
                window.electronAPI.invoke(
                  "debug-log",
                  "[QueueCommands] Error sending audio chunk: " + error
                );
                setIsListening(false);
                stopAudioCapture();
              }
            }
          };

          source.connect(scriptProcessor);
          scriptProcessor.connect(ctx.destination);

          setAudioContext(ctx);
          setProcessor(scriptProcessor);

          console.log(
            "[QueueCommands] ScriptProcessor fallback setup completed"
          );
          window.electronAPI.invoke(
            "debug-log",
            "[QueueCommands] ScriptProcessor fallback setup completed"
          );

          // Test script processor immediately
          setTimeout(() => {
            console.log(
              "[QueueCommands] Testing ScriptProcessor after 1 second..."
            );
            window.electronAPI.invoke(
              "debug-log",
              "[QueueCommands] Testing ScriptProcessor after 1 second..."
            );
          }, 1000);
        }

        console.log(
          "[QueueCommands] Audio capture setup completed successfully"
        );
        // Also log to main process for terminal visibility
        window.electronAPI.invoke(
          "debug-log",
          "[QueueCommands] Audio capture setup completed successfully"
        );
      } catch (error) {
        console.error("[QueueCommands] Failed to start audio capture:", error);
        // Also log to main process
        window.electronAPI.invoke(
          "debug-log",
          "[QueueCommands] Failed to start audio capture: " + error
        );
        setIsListening(false);
        stopAudioCapture();
        throw error;
      }
    };

    /**
     * Stop audio capture
     */
    const stopAudioCapture = (): void => {
      try {
        // Clear frontend listening flag first
        frontendListeningRef.current = false;
        console.log("[QueueCommands] Set frontendListening to false");
        window.electronAPI.invoke(
          "debug-log",
          "[QueueCommands] Set frontendListening to false"
        );

        if (pollingInterval) {
          clearInterval(pollingInterval);
          setPollingInterval(null);
        }

        if (audioAnalyser) {
          audioAnalyser.disconnect();
          setAudioAnalyser(null);
        }

        if (processor) {
          processor.disconnect();
          setProcessor(null);
        }

        if (audioContext) {
          audioContext.close();
          setAudioContext(null);
        }

        console.log("[QueueCommands] Audio capture stopped");
        window.electronAPI.invoke(
          "debug-log",
          "[QueueCommands] Audio capture stopped"
        );
      } catch (error) {
        console.error("[QueueCommands] Error stopping audio capture:", error);
        window.electronAPI.invoke(
          "debug-log",
          "[QueueCommands] Error stopping audio capture: " + error
        );
      }
    };

    /**
     * Toggle always-on listening
     */
    const handleListenToggle = async (): Promise<void> => {
      if (!isAuthenticated) {
        console.warn(
          "[QueueCommands] User not authenticated for audio streaming"
        );
        return;
      }

      // Clear previous errors
      setAudioError(null);

      try {
        if (isListening) {
          // Stop listening
          console.log("[QueueCommands] Stopping audio listening...");
          window.electronAPI.invoke(
            "debug-log",
            "[QueueCommands] Stopping audio listening..."
          );

          setIsListening(false);
          stopAudioCapture();

          // Stop dual audio capture (NEW SYSTEM)
          const result = await window.electronAPI.dualAudioStop();
          if (!result.success) {
            console.error(
              "[QueueCommands] Failed to stop dual audio:",
              result.error
            );
          } else {
            console.log("[QueueCommands] ✅ Dual audio stopped successfully");
          }
        } else {
          // Start listening
          console.log("[QueueCommands] Starting audio listening...");
          window.electronAPI.invoke(
            "debug-log",
            "[QueueCommands] Starting audio listening..."
          );

          try {
            // CRITICAL FIX: Set listening state FIRST so audio chunks won't be dropped
            setIsListening(true);
            console.log("[QueueCommands] Set isListening to true");

            // Step 1: Start local audio capture
            await startAudioCapture();
            console.log("[QueueCommands] Audio capture initialized");

            // Step 2: Start dual audio capture with Gemini Live (NEW SYSTEM)
            // AUTOMATIC: Both microphone and system audio start automatically
            // No source selection needed
            console.log("[QueueCommands] Starting AUTOMATIC dual audio capture (microphone + system audio)...");
            const result = await window.electronAPI.dualAudioStart();
            
            if (!result.success) {
              throw new Error(result.error || "Dual audio start failed");
            }

            console.log(
              "[QueueCommands] ✅ Dual audio listening started successfully (Gemini Live)"
            );
            console.log("[QueueCommands] 🎤 Microphone → user source");
            console.log("[QueueCommands] 🔊 System audio → opponent source");
            window.electronAPI.invoke(
              "debug-log",
              "[QueueCommands] Dual audio listening started successfully"
            );
          } catch (error) {
            const errorMsg =
              error instanceof Error
                ? error.message
                : "Failed to start audio listening";
            console.error(
              "[QueueCommands] Failed to start audio listening:",
              error
            );
            window.electronAPI.invoke(
              "debug-log",
              "[QueueCommands] Failed to start audio listening: " + error
            );
            setAudioError(errorMsg);
            setIsListening(false);
            stopAudioCapture();
            throw error;
          }
        }
      } catch (error) {
        const errorMsg =
          error instanceof Error
            ? error.message
            : "Error toggling listen state";
        console.error("[QueueCommands] Error toggling listen state:", error);
        window.electronAPI.invoke(
          "debug-log",
          "[QueueCommands] Error toggling listen state: " + error
        );
        setAudioError(errorMsg);
        setIsListening(false);
        stopAudioCapture();
      }
    };

    /**
     * Handle audio source change
     */
    const handleAudioSourceChange = async (sourceId: string): Promise<void> => {
      try {
        console.log("[QueueCommands] Switching audio source to:", sourceId);

        // Clear previous errors
        setAudioError(null);

        // Switch the audio source in the backend (for all sources)
        const result = await window.electronAPI.audioSwitchSource(sourceId);
        if (!result.success) {
          const errorMsg = result.error || "Failed to switch audio source";
          console.error(
            "[QueueCommands] Failed to switch audio source:",
            result.error
          );
          setAudioError(errorMsg);
          return;
        }

        console.log("[QueueCommands] Audio source switched successfully");
      } catch (error) {
        const errorMsg =
          error instanceof Error
            ? error.message
            : "Error switching audio source";
        console.error("[QueueCommands] Error switching audio source:", error);
        setAudioError(errorMsg);
      }
    };

    const handleMouseEnter = () => {
      setIsTooltipVisible(true);
    };

    const handleMouseLeave = () => {
      setIsTooltipVisible(false);
    };

    // Remove handleChatSend function

    // Cleanup on unmount or when listening state changes
    useEffect(() => {
      return () => {
        if (isListening) {
          try {
            // Stop backend processor first
            window.electronAPI.audioStreamStop().catch(() => {});
          } finally {
            // Always stop local capture
            stopAudioCapture();
          }
        }
      };
    }, [isListening]);

    return (
      <div className="w-fit overflow-visible">
        <div className="text-xs text-white/90 liquid-glass-bar py-2 px-3 flex items-center justify-center gap-1 draggable-area overflow-visible">
          {/* Logo */}
          <div className="flex items-center gap-1">
            <img src="./logo.png" alt="CueMe Logo" className="w-4 h-4" />
          </div>

          {/* Separator */}
          {/* <div className="h-4 w-px bg-white/20" /> */}

          {/* Screenshot */}
          {/* Removed screenshot button from main bar for seamless screenshot-to-LLM UX */}

          {/* Solve Command */}
          {screenshots.length > 0 && (
            <>
              <span className="text-[11px] leading-none">Solve</span>
              <button className="morphism-button px-1.5 py-1 text-[11px] leading-none text-white/70 hover:text-white hover:bg-white/20 flex items-center transition-all">
                <Command className="w-4 h-4" />
              </button>
              <button className="morphism-button px-1.5 py-1 text-[11px] leading-none text-white/70 hover:text-white hover:bg-white/20 transition-all">
                ↵
              </button>
            </>
          )}

          {/* Always-On Listen Button */}
          {isAuthenticated && (
            <button
              className={`glass-button text-[11px] leading-none flex items-center gap-1 ${
                isListening
                  ? "!bg-white/30 hover:!bg-white/40 text-white"
                  : "text-white/70 hover:text-white hover:bg-white/15"
              }`}
              onClick={handleListenToggle}
              type="button"
              title={
                isListening ? "常時リスニングを停止" : "常時リスニングを開始"
              }
            >
              {isListening ? (
                <>
                  <Mic className="w-4 h-4 mr-1" />
                  <span className="animate-pulse">停止</span>
                </>
              ) : (
                <>
                  <MicIcon className="w-4 h-4 mr-1" />
                  <span>録音</span>
                </>
              )}
            </button>
          )}

          {/* Chat Button */}
          <button
            className="glass-button text-[11px] leading-none text-white/70 hover:text-white hover:bg-white/15 flex items-center gap-1"
            onClick={onChatToggle}
            type="button"
          >
            <MessageCircle className="w-4 h-4 mr-1" />
            会話
          </button>

          {/* Separator */}
          <div className="h-4 w-px bg-white/20 mr-1.5" />

          {/* Response Mode Dropdown */}
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-white/70" />
            <div className="relative" ref={dropdownRef}>
              <button
                ref={triggerRef}
                className="morphism-button px-2 py-0 text-[11px] leading-none text-white/70 flex items-center gap-1 min-w-[80px] h-6"
                onClick={toggleDropdown}
                type="button"
              >
                {responseMode.type === "plain" ? (
                  <>
                    <Bot className="w-4 h-4" />
                    <span>デフォルト</span>
                  </>
                ) : (
                  <>
                    <Database className="w-4 h-4" />
                    <span className="truncate max-w-[60px]">
                      {responseMode.collectionName || "ファイル"}
                    </span>
                  </>
                )}
                <ChevronDown
                  className={`w-4 h-4 transition-transform ${
                    isDropdownOpen ? "rotate-180" : ""
                  }`}
                />
              </button>
            </div>
          </div>

          {/* Add this button in the main button row, before the separator and sign out */}
          {/* Remove the Chat button */}

          {/* Separator */}
          <div className="mx-2 h-4 w-px bg-white/20" />

          {/* Sign Out Button - Moved to end */}
          <button
            className="text-white/70 hover:text-white/90 transition-colors hover:cursor-pointer"
            title="サインアウト"
            onClick={() => window.electronAPI.quitApp()}
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>

        {/* Audio Result Display - positioned below the floating bar */}
        {audioResult && (
          <div
            className="mt-2 liquid-glass chat-container p-4 text-white/90 text-xs relative"
            style={{ minWidth: "400px", maxWidth: "600px" }}
          >
            {/* AI Response Label with Logo */}
            <div className="mb-2 text-sm font-medium text-white/80 flex items-center gap-2">
              <img src="./logo.png" alt="CueMe Logo" className="w-4 h-4" />
              <span>AI回答</span>
            </div>

            {/* Close Button */}
            <button
              onClick={() => setAudioResult(null)}
              className="absolute top-2 right-2 w-5 h-5 rounded-full morphism-button flex items-center justify-center"
              type="button"
              title="閉じる"
            >
              <svg
                className="w-2.5 h-2.5 text-white"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>

            <div className="pr-8">{audioResult}</div>
          </div>
        )}
        {/* Chat Dialog Overlay */}
        {/* Remove the Dialog component */}

        {/* Dropdown Portal - Rendered outside component tree to escape container constraints */}
        {isDropdownOpen &&
          createPortal(
            <div
              ref={dropdownRef}
              className="fixed morphism-dropdown shadow-xl overflow-hidden"
              style={{
                top: dropdownPosition.top,
                left: dropdownPosition.left,
                width: dropdownPosition.width,
                height: dropdownPosition.height,
                zIndex: 99999, // Use inline style for maximum z-index priority
                pointerEvents: "auto", // Ensure dropdown is clickable
                maxHeight: "none", // Remove fixed max height constraint
                minHeight: "auto", // Allow natural height up to max
              }}
            >
              <div className="p-1 overflow-y-auto morphism-scrollbar h-full">
                {/* Plain Mode Option */}
                <button
                  className={`w-full flex items-center gap-2 px-3 py-2 text-[11px] rounded-lg transition-colors ${
                    responseMode.type === "plain"
                      ? "bg-white/20 text-white"
                      : "text-white/70 hover:bg-white/10 hover:text-white"
                  }`}
                  onClick={() => handleResponseModeChange({ type: "plain" })}
                >
                  <Bot className="w-4 h-4" />
                  <div className="text-left">
                    <div className="font-medium">デフォルト</div>
                    <div className="text-[10px] text-white/50">
                      CueMeの直接回答
                    </div>
                  </div>
                </button>

                {/* Separator */}
                {isAuthenticated && <div className="h-px bg-white/10 my-1" />}

                {/* Collections (Files) */}
                {isAuthenticated ? (
                  contentLoading ? (
                    <div className="px-3 py-2 text-[11px] text-white/50">
                      ファイルを読み込み中...
                    </div>
                  ) : collections.length > 0 ? (
                    collections.map((collection) => (
                      <button
                        key={collection.id}
                        className={`w-full flex items-center gap-2 px-3 py-2 text-[11px] rounded-lg transition-colors ${
                          responseMode.type === "qna" &&
                          responseMode.collectionId === collection.id
                            ? "bg-white/20 text-white"
                            : "text-white/70 hover:bg-white/10 hover:text-white"
                        }`}
                        onClick={() =>
                          handleResponseModeChange({
                            type: "qna",
                            collectionId: collection.id,
                            collectionName: collection.name,
                          })
                        }
                      >
                        <Database className="w-4 h-4 flex-shrink-0" />
                        <div className="text-left flex-1 min-w-0">
                          <div className="font-medium truncate">
                            {collection.name}
                          </div>
                          <div className="text-[10px] text-white/50">
                            {collection.qna_count || 0} 項目
                          </div>
                        </div>
                      </button>
                    ))
                  ) : (
                    <div className="px-3 py-2 text-[11px] text-white/50">
                      ファイルが見つかりません
                    </div>
                  )
                ) : (
                  <div className="px-3 py-2 text-[11px] text-white/50">
                    ファイルを使用するにはサインインしてください
                  </div>
                )}
              </div>
            </div>,
            document.body
          )}
      </div>
    );
  }
);

QueueCommands.displayName = "QueueCommands";

export default QueueCommands;
