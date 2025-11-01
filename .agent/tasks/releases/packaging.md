Packaging Electron apps with AudioTee.js
November 1, 2025
Introduction
Make the binary accessible
Locate the binary at runtime
Set entitlements and permissions
Wrapping up
Introduction
AudioTee.js captures system audio on macOS—everything playing through your speakers or headphones—and streams it to your Node.js app as PCM data. It's useful for apps that transcribe video calls, record meetings, or process audio from any application running on the system.

Recording system audio requires native OS-level access you can't get in a browser, which makes desktop applications the natural home for this functionality. Electron remains the most accessible entry to desktop development for many developers: it provides a familiar UI layer (Chrome), a familiar backend (Node.js), and the native access required to capture system audio.

AudioTee.js and Electron work together seamlessly in development mode (e.g. npm run dev or equivalent), but the latter requires a little bit of configuration when it comes to packaging your application for distribution. That's what we'll cover in this guide.

I will assume you've already set up code signing and notarization for your Electron app. If you haven't, start with the signing and notarization sections of my Electron publishing guide first. I'll also assume you're using electron-builder to package your app. Any other packaging tool like Electron Forge will support the options you need, just via slightly different configuration syntax.

Make the binary accessible
When you package an Electron app, your application code and node_modules typically get bundled into an ASAR archive—a compressionless archive format that packages many files into a single file. Some Node.js APIs don't support executing binaries from ASAR archives, and AudioTee.js uses one of them (child_process.spawn, if you're interested).

In development, the underlying swift binary which AudioTee.js spawns lives at node_modules/audiotee/bin/audiotee. Once packaged, it ends up inside app.asar where Node.js can't execute it—binaries must be real files on disk, not archive entries.

The solution is to copy the binary outside the ASAR archive at build time. If you're using electron-builder, add this to electron-builder.yml or equivalent:

extraResources:
  - from: node_modules/audiotee/bin/audiotee
    to: audiotee
This copies the binary to your app's Contents/Resources/ directory on macOS, outside the ASAR archive, where it can be executed.

Note that asarUnpack is an alternative approach—it includes the binary in the ASAR archive but marks it to be unpacked to disk at runtime. We use extraResources here because the binary is already on disk at the right location with no runtime unpacking overhead.

Locate the binary at runtime
Now that you've copied it to process.resourcesPath in your packaged app, you need to tell AudioTee.js where to find it:

import { AudioTee } from 'audiotee'
import { join } from 'path'

// Determine binary path: in packaged apps, use process.resourcesPath
// In dev, return undefined to fall back to AudioTee's default (node_modules)
function getBinaryPath(): string | undefined {
  if (process.resourcesPath) {
    return join(process.resourcesPath, 'audiotee')
  }
  return undefined
}

const audioTee = new AudioTee({
  sampleRate: 16000,
  chunkDurationMs: 20,
  binaryPath: getBinaryPath(),
})
Set entitlements and permissions
macOS apps run in a sandbox with restricted capabilities. To access system resources like audio capture, you need to declare both what your app is allowed to do (entitlements) and why it needs to do it (usage descriptions).

Entitlements
Entitlements are capabilities your app requests from macOS. They're declared in a .plist file and embedded into your app during code signing. Create or update your entitlements.mac.plist:

<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
  <dict>
    <key>com.apple.security.cs.allow-jit</key>
    <true/>
    <key>com.apple.security.device.audio-input</key>
    <true/>
    <key>com.apple.security.cs.disable-library-validation</key>
    <true/>
  </dict>
</plist>
Here's what each entitlement does:

com.apple.security.cs.allow-jit - Allows Chromium's V8 JavaScript engine to use just-in-time compilation. Required for any Electron app.
com.apple.security.device.audio-input - Grants permission to capture microphone input. Strictly speaking, this isn't required for AudioTee.js (which captures system audio output, not mic input), but I've included it here because every use case I've encountered needs both—transcribing calls, recording meetings, etc. If your app only needs system audio, you can omit this.
com.apple.security.cs.disable-library-validation - Allows your app to load and execute the external AudioTee binary. Without this, macOS blocks the binary from running as part of your signed app.
Usage descriptions
Usage descriptions are the human-readable strings users see when macOS asks for permission. They're separate from entitlements: entitlements grant your app the capability, usage descriptions explain to the user why you're asking for it.

If you're using electron-builder, add these to your electron-builder.yml:

mac:
  entitlementsInherit: build/entitlements.mac.plist
  extendInfo:
    NSMicrophoneUsageDescription: Your app needs microphone access to record audio.
    NSAudioCaptureUsageDescription: Your app needs system audio access to record audio.
NSAudioCaptureUsageDescription is required for AudioTee.js. NSMicrophoneUsageDescription is only needed if your app also captures microphone input—which most use cases do. Replace the generic descriptions with text that accurately reflects what your app does; they're shown to users when macOS asks for permission.

Wrapping up
That's all there is to it: copy the binary outside the ASAR archive so Node.js can execute it, point AudioTee.js to the binary's runtime location, and set the entitlements and permissions macOS requires.

To debug your packaged application prior to distribution, you might find it handy to run it from your terminal (./dist/mac-arm64/YourApp.app/Contents/MacOS/YourApp) rather than launching through Finder—you'll see errors that wouldn't otherwise surface. The most common issues are missing extraResources configuration (ENOENT errors), missing the disable-library-validation entitlement (Operation not permitted), or missing usage descriptions.

AudioTee.js is macOS-only at the moment, but there's work in progress on Windows support. If you're building something with it, or if you hit packaging issues I haven't covered, open an issue on GitHub.