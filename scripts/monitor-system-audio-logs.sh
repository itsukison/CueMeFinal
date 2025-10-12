#!/bin/bash

# Monitor macOS Console logs for TCC and ScreenCaptureKit errors
# Run this in a separate terminal while testing system audio

echo "📊 Monitoring macOS system logs for TCC and ScreenCaptureKit errors..."
echo "Press Ctrl+C to stop"
echo ""
echo "================================"
echo ""

# Monitor multiple log sources simultaneously
log stream --predicate '
    (subsystem == "com.apple.TCC") OR 
    (subsystem == "com.apple.screencapturekit") OR 
    (subsystem == "com.apple.tccd") OR
    (eventMessage CONTAINS "SystemAudioCapture") OR
    (eventMessage CONTAINS "Electron") OR
    (eventMessage CONTAINS "ScreenCapture") OR
    (eventMessage CONTAINS "screen recording")
' --style compact --color auto
