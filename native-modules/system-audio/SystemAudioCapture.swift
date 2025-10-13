import AVFoundation
import ScreenCaptureKit

class SystemAudioCapture: NSObject, SCStreamDelegate, SCStreamOutput {
    static var screenCaptureStream: SCStream?
    var contentEligibleForSharing: SCShareableContent?
    let semaphoreStreamingStopped = DispatchSemaphore(value: 0)
    var streamFunctionCalled = false
    var streamFunctionTimeout: TimeInterval = 0.5 // Timeout in seconds
    var isStreaming = false
    var stdinMonitor: DispatchSourceRead?
    
    override init() {
        super.init()
        processCommandLineArguments()
    }

    func processCommandLineArguments() {
        let arguments = CommandLine.arguments
        
        // Handle different commands
        if arguments.contains("status") {
            checkStatus()
            return
        }
        
        if arguments.contains("permissions") {
            requestPermissions()
            return
        }
        
        if arguments.contains("start-stream") {
            startStreaming()
            return
        }
        
        if arguments.contains("--selftest") {
            runSelfTest()
            return
        }
        
        // Default - invalid arguments
        ResponseHandler.returnResponse(["type": "error", "message": "Invalid arguments. Use: status, permissions, start-stream, or --selftest"])
    }
    
    func checkStatus() {
        // Check if ScreenCaptureKit is available        
        if #available(macOS 13.0, *) {
            // Check if we can get screen content
            Task {
                do {
                    let content = try await SCShareableContent.excludingDesktopWindows(false, onScreenWindowsOnly: true)
                    let hasDisplays = !content.displays.isEmpty
                    
                    let statusData: [String: Any] = [
                        "isAvailable": hasDisplays,
                        "displayCount": content.displays.count,
                        "macOSVersion": "13.0+",
                        "screenCaptureKitSupported": true
                    ]
                    
                    ResponseHandler.returnResponse([
                        "type": "status", 
                        "data": statusData
                    ])
                } catch {
                    ResponseHandler.returnResponse([
                        "type": "status",
                        "data": [
                            "isAvailable": false,
                            "error": error.localizedDescription,
                            "macOSVersion": "13.0+",
                            "screenCaptureKitSupported": true
                        ]
                    ])
                }
            }
        } else {
            ResponseHandler.returnResponse([
                "type": "status",
                "data": [
                    "isAvailable": false,
                    "error": "ScreenCaptureKit requires macOS 13.0+",
                    "macOSVersion": "< 13.0",
                    "screenCaptureKitSupported": false
                ]
            ])
        }
        
        // Keep the process alive for async response
        semaphoreStreamingStopped.wait()
    }
    
    func requestPermissions() {
        PermissionsRequester.requestScreenCaptureAccess { granted in
            let result: [String: Any] = [
                "type": "permission",
                "granted": granted,
                "message": granted ? "Screen recording permission granted" : "Screen recording permission denied"
            ]
            ResponseHandler.returnResponse(result)
        }
        
        // Keep the process alive for async response
        semaphoreStreamingStopped.wait()
    }
    
    func startStreaming() {
        guard #available(macOS 13.0, *) else {
            ResponseHandler.returnResponse([
                "type": "error", 
                "message": "ScreenCaptureKit requires macOS 13.0+"
            ])
            return
        }
        
        // Setup stdin monitoring for stop commands
        setupStdinMonitoring()
        
        // Setup interrupt signal handler
        setupInterruptSignalHandler()
        
        // Start the streaming process
        updateAvailableContent()
        
        // Keep the process alive
        semaphoreStreamingStopped.wait()
    }
    
    func setupStdinMonitoring() {
        let stdin = FileHandle.standardInput
        stdinMonitor = DispatchSource.makeReadSource(fileDescriptor: stdin.fileDescriptor, queue: .global())
        
        stdinMonitor?.setEventHandler { [weak self] in
            let data = stdin.availableData
            if let command = String(data: data, encoding: .utf8)?.trimmingCharacters(in: .whitespacesAndNewlines) {
                if command == "stop" || command == "quit" {
                    self?.stopStreaming()
                }
            }
        }
        
        stdinMonitor?.resume()
    }
    
    func setupInterruptSignalHandler() {
        let interruptSignalHandler: @convention(c) (Int32) -> Void = { signal in
            if signal == SIGINT {
                SystemAudioCapture.terminateStreaming()
                
                ResponseHandler.returnResponse([
                    "type": "status",
                    "message": "STREAMING_STOPPED"
                ], shouldExitProcess: false)
                
                exit(0)
            }
        }
        
        signal(SIGINT, interruptSignalHandler)
    }

    func updateAvailableContent() {
        guard #available(macOS 13.0, *) else { return }
        
        // Add timeout for the async operation
        let timeoutTask = Task {
            try await Task.sleep(nanoseconds: 5_000_000_000) // 5 seconds
            ResponseHandler.returnResponse([
                "type": "error",
                "message": "Timeout getting screen content - permission dialog may be waiting"
            ], shouldExitProcess: false)
            semaphoreStreamingStopped.signal()
        }
        
        Task {
            do {
                let content = try await SCShareableContent.excludingDesktopWindows(false, onScreenWindowsOnly: true)
                timeoutTask.cancel() // Cancel timeout since we succeeded
                self.contentEligibleForSharing = content
                await self.setupStreamingEnvironment()
            } catch {
                timeoutTask.cancel() // Cancel timeout since we got an error
                ResponseHandler.returnResponse([
                    "type": "error",
                    "message": "Failed to get screen content: \(error.localizedDescription)"
                ], shouldExitProcess: false)
                semaphoreStreamingStopped.signal()
            }
        }
    }

    func setupStreamingEnvironment() async {
        guard let firstDisplay = contentEligibleForSharing?.displays.first else {
            ResponseHandler.returnResponse([
                "type": "error",
                "message": "No display found"
            ], shouldExitProcess: false)
            return
        }

        let screenContentFilter = SCContentFilter(display: firstDisplay, excludingApplications: [], exceptingWindows: [])
        
        await initiateStreaming(with: screenContentFilter)
    }

    func initiateStreaming(with filter: SCContentFilter) async {
        guard #available(macOS 13.0, *) else { return }
        
        let streamConfiguration = SCStreamConfiguration()
        configureStream(streamConfiguration)

        do {
            SystemAudioCapture.screenCaptureStream = SCStream(filter: filter, configuration: streamConfiguration, delegate: self)

            try SystemAudioCapture.screenCaptureStream?.addStreamOutput(self, type: .audio, sampleHandlerQueue: .global())
            
            // Add timeout for stream start
            let startTask = Task {
                try await SystemAudioCapture.screenCaptureStream?.startCapture()
            }
            
            let timeoutTask = Task {
                try await Task.sleep(nanoseconds: 3_000_000_000) // 3 seconds
                startTask.cancel()
                throw NSError(domain: "StreamTimeout", code: -1, userInfo: [NSLocalizedDescriptionKey: "Stream start timeout - permission may be required"])
            }
            
            do {
                _ = try await startTask.value
                timeoutTask.cancel()
                
                isStreaming = true
                
                // Send ready status
                ResponseHandler.returnResponse([
                    "type": "status",
                    "message": "READY"
                ], shouldExitProcess: false)
                
            } catch {
                timeoutTask.cancel()
                throw error
            }
            
        } catch {
            ResponseHandler.returnResponse([
                "type": "error",
                "message": "Failed to start capture: \(error.localizedDescription)"
            ], shouldExitProcess: false)
            semaphoreStreamingStopped.signal()
        }
    }

    func configureStream(_ configuration: SCStreamConfiguration) {
        configuration.width = 2
        configuration.height = 2
        configuration.minimumFrameInterval = CMTime(value: 1, timescale: CMTimeScale.max)
        configuration.showsCursor = false
        configuration.capturesAudio = true
        configuration.sampleRate = 48000
        configuration.channelCount = 2
    }

    func stream(_ stream: SCStream, didOutputSampleBuffer sampleBuffer: CMSampleBuffer, of outputType: SCStreamOutputType) {
        guard outputType == .audio, isStreaming else { return }
        
        self.streamFunctionCalled = true
        guard let audioBuffer = sampleBuffer.asPCMBuffer, sampleBuffer.isValid else { return }
        
        // Convert audio buffer to data for streaming
        if let audioData = audioBuffer.toBase64Data() {
            let timestamp = Date().timeIntervalSince1970 * 1000 // milliseconds
            
            let audioMessage: [String: Any] = [
                "type": "audio",
                "data": audioData,
                "sampleRate": audioBuffer.format.sampleRate,
                "channels": audioBuffer.format.channelCount,
                "frameLength": audioBuffer.frameLength,
                "timestamp": timestamp
            ]
            
            ResponseHandler.returnResponse(audioMessage, shouldExitProcess: false)
        }
    }
    
    func stopStreaming() {
        isStreaming = false
        SystemAudioCapture.terminateStreaming()
        
        ResponseHandler.returnResponse([
            "type": "status",
            "message": "STREAMING_STOPPED"
        ], shouldExitProcess: false)
        
        semaphoreStreamingStopped.signal()
    }
    
    /// Self-test mode: Generate a 1 kHz sine wave for 500ms to verify audio pipeline
    /// without requiring any system permissions. Useful for smoke testing.
    func runSelfTest() {
        ResponseHandler.returnResponse([
            "type": "status",
            "message": "SELFTEST_START"
        ], shouldExitProcess: false)
        
        // Generate 500ms of 1 kHz sine wave at 48kHz sample rate
        let sampleRate: Double = 48000
        let frequency: Double = 1000 // 1 kHz
        let duration: Double = 0.5 // 500ms
        let frameCount = Int(sampleRate * duration)
        
        // Create audio format (Float32 stereo, matching real capture)
        guard let audioFormat = AVAudioFormat(commonFormat: .pcmFormatFloat32, sampleRate: sampleRate, channels: 2, interleaved: false) else {
            ResponseHandler.returnResponse([
                "type": "error",
                "message": "SELFTEST_FAILED: Could not create audio format"
            ])
            return
        }
        
        guard let audioBuffer = AVAudioPCMBuffer(pcmFormat: audioFormat, frameCapacity: AVAudioFrameCount(frameCount)) else {
            ResponseHandler.returnResponse([
                "type": "error",
                "message": "SELFTEST_FAILED: Could not create audio buffer"
            ])
            return
        }
        
        audioBuffer.frameLength = AVAudioFrameCount(frameCount)
        
        // Generate sine wave in both channels
        guard let leftChannel = audioBuffer.floatChannelData?[0],
              let rightChannel = audioBuffer.floatChannelData?[1] else {
            ResponseHandler.returnResponse([
                "type": "error",
                "message": "SELFTEST_FAILED: Could not access channel data"
            ])
            return
        }
        
        for i in 0..<frameCount {
            let sample = Float(sin(2.0 * Double.pi * frequency * Double(i) / sampleRate))
            leftChannel[i] = sample * 0.5  // 50% amplitude to avoid clipping
            rightChannel[i] = sample * 0.5
        }
        
        // Convert to base64 and emit (same format as real audio)
        if let audioData = audioBuffer.toBase64Data() {
            ResponseHandler.returnResponse([
                "type": "audio",
                "data": audioData,
                "sampleRate": audioBuffer.format.sampleRate,
                "channels": audioBuffer.format.channelCount,
                "frameLength": audioBuffer.frameLength,
                "timestamp": Date().timeIntervalSince1970 * 1000,
                "selftest": true
            ], shouldExitProcess: false)
        }
        
        ResponseHandler.returnResponse([
            "type": "status",
            "message": "SELFTEST_COMPLETE"
        ])
    }

    func stream(_ stream: SCStream, didStopWithError error: Error) {
        isStreaming = false
        
        ResponseHandler.returnResponse([
            "type": "error",
            "message": "Stream error: \(error.localizedDescription)"
        ], shouldExitProcess: false)
        
        SystemAudioCapture.terminateStreaming()
        semaphoreStreamingStopped.signal()
    }

    static func terminateStreaming() {
        screenCaptureStream?.stopCapture()
        screenCaptureStream = nil
    }
}

class PermissionsRequester {
    static func requestScreenCaptureAccess(completion: @escaping (Bool) -> Void) {
        if !CGPreflightScreenCaptureAccess() {
            let result = CGRequestScreenCaptureAccess()
            completion(result)
        } else {
            completion(true)
        }
    }
}

class ResponseHandler {
    static func returnResponse(_ response: [String: Any], shouldExitProcess: Bool = true) {
        if let jsonData = try? JSONSerialization.data(withJSONObject: response),
           let jsonString = String(data: jsonData, encoding: .utf8) {
            print(jsonString)
            fflush(stdout)
        } else {
            print("{\"type\": \"error\", \"message\": \"JSON_SERIALIZATION_FAILED\"}")
            fflush(stdout)
        }

        if shouldExitProcess {
            exit(0)
        }
    }
}

// Audio buffer processing extensions
extension AVAudioPCMBuffer {
    func toBase64Data() -> String? {
        guard let floatChannelData = self.floatChannelData else { return nil }
        
        let frameLength = Int(self.frameLength)
        let channelCount = Int(self.format.channelCount)
        
        // Interleave the audio data if multiple channels
        var interleavedData = [Float](repeating: 0, count: frameLength * channelCount)
        
        if channelCount == 1 {
            // Mono audio
            let channelData = floatChannelData[0]
            for i in 0..<frameLength {
                interleavedData[i] = channelData[i]
            }
        } else {
            // Stereo or multi-channel audio - interleave
            for frame in 0..<frameLength {
                for channel in 0..<channelCount {
                    let channelData = floatChannelData[channel]
                    interleavedData[frame * channelCount + channel] = channelData[frame]
                }
            }
        }
        
        // Convert Float array to Data
        let data = interleavedData.withUnsafeBufferPointer { buffer in
            Data(buffer: buffer)
        }
        
        return data.base64EncodedString()
    }
}

// Extensions from original recorder
extension CMSampleBuffer {
    var asPCMBuffer: AVAudioPCMBuffer? {
        try? self.withAudioBufferList { audioBufferList, _ -> AVAudioPCMBuffer? in
            guard let absd = self.formatDescription?.audioStreamBasicDescription else { return nil }
            guard let format = AVAudioFormat(standardFormatWithSampleRate: absd.mSampleRate, channels: absd.mChannelsPerFrame) else { return nil }
            return AVAudioPCMBuffer(pcmFormat: format, bufferListNoCopy: audioBufferList.unsafePointer)
        }
    }
}

// Main execution
let app = SystemAudioCapture()

// For start-stream command, we need to keep the process alive
if CommandLine.arguments.contains("start-stream") {
    // The semaphore is handled within the startStreaming method
} else {
    // For other commands, the process will exit after completion
}