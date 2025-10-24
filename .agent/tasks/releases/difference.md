🔍 Key Differences That Affect Mic Access
Area	CueMe (yours)	Glass (working)	Impact
Entitlements	Unknown content (not shown, but probably minimal)	Explicitly uses entitlements.plist with correct mic entitlements	🔥 Most critical — macOS won’t allow mic use in hardened runtime without <key>com.apple.security.device.microphone</key>
Minimum macOS version	None set	"minimumSystemVersion": "11.0"	Minor, but ensures proper entitlement handling on Apple Silicon builds
Main vs Renderer mic logic	Log shows navigator is not defined (run in main process)	Glass almost certainly requests mic access in the renderer (via navigator.mediaDevices)	✅ Must move your mic initialization to renderer/preload
Hardened Runtime	✅ true	✅ true	Correct, but requires matching entitlements
Sandbox enabled	Possibly missing (com.apple.security.app-sandbox)	Present in Glass	⚠️ Should include to ensure entitlement enforcement consistency