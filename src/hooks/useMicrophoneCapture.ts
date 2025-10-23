/**
 * React hook for microphone capture using the MicrophoneCapture service
 * 
 * This hook provides a simple interface to capture microphone audio in the renderer
 * and send it to the main process for processing.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { getMicrophoneCapture, type MicrophoneCaptureState } from '../services/MicrophoneCapture';

export interface UseMicrophoneCaptureOptions {
  sampleRate?: number;
  channelCount?: number;
  bufferSize?: number;
  autoStart?: boolean;
}

export interface UseMicrophoneCaptureReturn {
  state: MicrophoneCaptureState;
  startCapture: () => Promise<void>;
  stopCapture: () => Promise<void>;
  requestPermission: () => Promise<boolean>;
  checkPermission: () => Promise<boolean>;
  isCapturing: boolean;
  hasPermission: boolean;
  error: string | undefined;
}

export function useMicrophoneCapture(
  options: UseMicrophoneCaptureOptions = {}
): UseMicrophoneCaptureReturn {
  const {
    sampleRate = 16000,
    channelCount = 1,
    bufferSize = 4096,
    autoStart = false
  } = options;

  const [state, setState] = useState<MicrophoneCaptureState>({
    isCapturing: false,
    hasPermission: false
  });

  const captureRef = useRef(getMicrophoneCapture());
  const configRef = useRef({ sampleRate, channelCount, bufferSize });

  // Update state from capture service
  const updateState = useCallback(() => {
    const newState = captureRef.current.getState();
    setState(newState);
  }, []);

  // Start capturing
  const startCapture = useCallback(async () => {
    try {
      await captureRef.current.startCapture(configRef.current);
      updateState();
    } catch (error) {
      console.error('[useMicrophoneCapture] Failed to start capture:', error);
      updateState();
      throw error;
    }
  }, [updateState]);

  // Stop capturing
  const stopCapture = useCallback(async () => {
    try {
      await captureRef.current.stopCapture();
      updateState();
    } catch (error) {
      console.error('[useMicrophoneCapture] Failed to stop capture:', error);
      updateState();
      throw error;
    }
  }, [updateState]);

  // Request permission
  const requestPermission = useCallback(async () => {
    try {
      const granted = await captureRef.current.requestPermission();
      updateState();
      return granted;
    } catch (error) {
      console.error('[useMicrophoneCapture] Failed to request permission:', error);
      updateState();
      return false;
    }
  }, [updateState]);

  // Check permission
  const checkPermission = useCallback(async () => {
    try {
      const granted = await captureRef.current.checkPermission();
      updateState();
      return granted;
    } catch (error) {
      console.error('[useMicrophoneCapture] Failed to check permission:', error);
      updateState();
      return false;
    }
  }, [updateState]);

  // Auto-start if requested
  useEffect(() => {
    if (autoStart) {
      startCapture().catch(error => {
        console.error('[useMicrophoneCapture] Auto-start failed:', error);
      });
    }

    // Cleanup on unmount
    return () => {
      if (captureRef.current.getState().isCapturing) {
        captureRef.current.stopCapture().catch(error => {
          console.error('[useMicrophoneCapture] Cleanup failed:', error);
        });
      }
    };
  }, [autoStart, startCapture]);

  return {
    state,
    startCapture,
    stopCapture,
    requestPermission,
    checkPermission,
    isCapturing: state.isCapturing,
    hasPermission: state.hasPermission,
    error: state.error
  };
}
