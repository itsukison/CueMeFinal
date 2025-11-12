# Auto-Update Fix Plan

## Status: ✅ IMPLEMENTED (Pending Testing)

**Created:** 2025/11/05  
**Implemented:** 2025/11/05  
**Priority:** HIGH  
**Complexity:** Low

## Problem
App version 1.0.111 released on GitHub but the app doesn't detect or offer the update.

## Visual Flow Diagram

### Current (Broken) Flow:
```
App Launch
    ↓
Window Ready (0s)
    ↓
Auth Check Starts
    ↓
Update Check Starts (3s delay) ──→ Fires update-available event
    ↓                                        ↓
Auth Loading (2s)                           ↓
    ↓                                        ↓
Auth Failed/Not Logged In                   ↓
    ↓                                        ↓
Show AuthDialog                              ↓
    ↓                                        ↓
UpdateDialog NOT MOUNTED ←──────────────────┘
    ↓
❌ Event Lost!
```

### Fixed Flow:
```
App Launch
    ↓
Window Ready (0s)
    ↓
Auth Check Starts + UpdateDialog MOUNTED
    ↓
Update Check Starts (3s delay) ──→ Fires update-available event
    ↓                                        ↓
Auth Loading (2s)                           ↓
    ↓                                        ↓
Auth Failed/Not Logged In                   ↓
    ↓                                        ↓
Show AuthDialog + UpdateDialog              ↓
    ↓                                        ↓
UpdateDialog IS LISTENING ←─────────────────┘
    ↓
✅ Event Received! Show Update Dialog
```

## Root Cause Analysis

### Current Implementation ✅
1. **AutoUpdateManager** properly configured in `electron/core/AutoUpdateManager.ts`
   - Uses `electron-updater` package
   - Auto-download enabled
   - Auto-install on quit enabled
   - Checks every 4 hours + on startup (3s delay)

2. **IPC Handlers** properly set up in `electron/ipc/updateHandlers.ts`
   - `update-install` - Install and quit
   - `update-check` - Manual check
   - `update-get-status` - Get status

3. **UI Component** exists at `src/components/ui/update-dialog.tsx`
   - Listens for update events
   - Shows download progress
   - Prompts user to install

4. **Preload Bridge** properly configured in `electron/preload.ts`
   - `onUpdateAvailable`
   - `onUpdateDownloaded`
   - `onUpdateDownloadProgress`
   - `onUpdateError`

5. **Package.json** has GitHub publish config
   ```json
   "publish": [{
     "provider": "github",
     "owner": "itsukison",
     "repo": "CueMeFinal",
     "releaseType": "release"
   }]
   ```

### Missing/Broken Components ❌

**ACTUAL ROOT CAUSE: Dialog Rendering Order Issue**

1. **UpdateDialog Not Mounted During Update Check** ⚠️
   - `UpdateDialog` is only rendered when user is **authenticated** (App.tsx line 337-341)
   - Auth check happens **before** update check completes
   - Update events fire at startup (3s delay), but `UpdateDialog` isn't listening yet
   - Flow:
     ```
     App Launch → Auth Loading (shows spinner) → Auth Check
     ├─ If NOT authenticated → Show AuthDialog (UpdateDialog NOT mounted)
     └─ If authenticated → Show Main App + UpdateDialog (can receive events)
     ```
   - **Result:** Update events are lost because no component is listening

2. **Timing Issue**
   - AutoUpdateManager starts checking 3 seconds after window ready
   - Auth restoration also happens at startup
   - If auth is slow or fails, UpdateDialog never mounts
   - Update events (`update-available`, `update-downloaded`) are fired but ignored

3. **GitHub Release Assets** ✅
   - Verified: `latest-mac.yml` EXISTS in release
   - Verified: ZIP files exist
   - This is NOT the problem

## Solution Plan

### Solution: Move UpdateDialog Outside Auth Gate

The UpdateDialog must be mounted **regardless of auth state** so it can listen for update events.

**Option 1: Always Mount UpdateDialog (Recommended)**
- Mount UpdateDialog at the top level, before auth checks
- Update events will be captured even during auth flow
- User sees update dialog before/during auth if update available

**Option 2: Store Update State in Main Process**
- Cache update events in AutoUpdateManager
- Send cached events when UpdateDialog mounts
- More complex, requires state management

**Option 3: Delay Update Check Until After Auth**
- Only check for updates after user is authenticated
- Simpler but worse UX (delayed updates)

### Recommended Implementation: Option 1

Move UpdateDialog to always be mounted, similar to how DevAuthDialog is handled.

## Implementation Steps

### Step 1: Modify App.tsx to Always Mount UpdateDialog

**Current Code (App.tsx lines 337-341):**
```tsx
// User is authenticated, show main app
return (
  <div ref={containerRef} className="min-h-0">
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <AppRouter ... />
        <DevAuthDialog ... />
        <UpdateDialog
          isOpen={isUpdateDialogOpen}
          onOpenChange={setIsUpdateDialogOpen}
        />
        <ToastViewport />
      </ToastProvider>
    </QueryClientProvider>
  </div>
);
```

**Fix: Move UpdateDialog to ALL return statements**

1. **In the "not authenticated" return** (around line 310):
```tsx
if (!authState.user && !authState.isLoading) {
  return (
    <div ref={containerRef} ...>
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <AuthDialog ... />
          <DevAuthDialog ... />
          <UpdateDialog
            isOpen={isUpdateDialogOpen}
            onOpenChange={setIsUpdateDialogOpen}
          />
          <ToastViewport />
        </ToastProvider>
      </QueryClientProvider>
    </div>
  );
}
```

2. **In the "auth loading" return** (around line 330):
```tsx
if (authState.isLoading) {
  return (
    <div ref={containerRef} ...>
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <div className="text-center">...</div>
          <UpdateDialog
            isOpen={isUpdateDialogOpen}
            onOpenChange={setIsUpdateDialogOpen}
          />
          <ToastViewport />
        </ToastProvider>
      </QueryClientProvider>
    </div>
  );
}
```

3. **Keep existing UpdateDialog in authenticated return** (already there)

### Step 2: Add Enhanced Logging to AutoUpdateManager

Add detailed logging to track update check flow:

```typescript
// In checkForUpdates()
Logger.info('[AutoUpdate] Checking for updates...');
Logger.info('[AutoUpdate] Current version:', app.getVersion());
Logger.info('[AutoUpdate] Feed URL:', autoUpdater.getFeedURL());

// In setupAutoUpdater()
autoUpdater.on('checking-for-update', () => {
  Logger.info('[AutoUpdate] Checking for update started');
});

autoUpdater.on('update-not-available', (info) => {
  Logger.info('[AutoUpdate] No updates available. Current version:', info.version);
});
```

### Step 3: Test Update Detection
After fixes:
1. Build and install old version (1.0.110 or earlier)
2. Launch app
3. **Don't log in yet** - wait at auth screen
4. Check console logs for update detection
5. Verify update dialog appears **over** auth dialog
6. Test download and install flow
7. Test "install later" flow

## Expected Behavior After Fix

1. **On App Launch (Not Authenticated):**
   - Auth dialog appears
   - After 3 seconds, update check runs in background
   - If update available, update dialog appears **over** auth dialog
   - User can handle update first, then authenticate
   - Or dismiss update and authenticate first

2. **On App Launch (Authenticated):**
   - Main app loads
   - After 3 seconds, update check runs
   - If update available, update dialog appears
   - User can continue working while download happens

3. **During Download:**
   - Show progress in dialog
   - Update progress bar
   - Log download status
   - User can dismiss and continue using app

4. **After Download:**
   - Show "ready to install" dialog
   - User can install now (quits and installs) or later
   - Auto-install on next quit if "later" chosen

## Summary

**Root Cause:** UpdateDialog component only mounts when user is authenticated, but update events fire during app startup regardless of auth state. Events are lost if user isn't authenticated yet.

**Fix:** Mount UpdateDialog in all render paths (loading, not authenticated, authenticated) so it can always listen for update events.

**Impact:** Minimal code change, no breaking changes, preserves existing auth and update logic.

## Files to Modify

1. **`src/App.tsx`** - Mount UpdateDialog in all render paths (CRITICAL)
2. **`electron/core/AutoUpdateManager.ts`** - Add enhanced logging (optional but helpful)

## Testing Checklist

- [x] Verify GitHub release has ZIP files ✅
- [x] Verify GitHub release has `latest-mac.yml` ✅
- [x] Modify App.tsx to mount UpdateDialog in all states ✅
- [x] Add enhanced logging to AutoUpdateManager ✅
- [ ] Build and install old version (1.0.110)
- [ ] Launch app and stay at auth screen
- [ ] Verify update dialog appears over auth dialog
- [ ] Test download progress shows correctly
- [ ] Test "install now" button works
- [ ] Test "install later" button works
- [ ] Test auto-install on quit
- [ ] Test update flow when already authenticated

## Notes

- Development mode skips update checks (by design)
- Must test with production build
- GitHub token required for publishing
- ZIP target is mandatory for macOS auto-updates (DMG alone won't work)

## Related to Auth System

The persistent auth system (see `PERSISTENT_AUTH.md`) works correctly but creates a timing issue:
- Auth restoration takes ~2 seconds with retry logic
- Update check starts after 3 seconds
- If auth fails/is slow, user sees auth dialog
- Update events fire but UpdateDialog isn't mounted to receive them

**Solution preserves both systems:**
- Auth system continues to work as designed
- Update system works independently
- Both dialogs can coexist (update dialog has higher z-index priority)


---

## Implementation Summary

### Changes Made

**1. src/App.tsx**
- Added `<UpdateDialog />` to "not authenticated" render path (line ~295)
- Added `<UpdateDialog />` to "auth loading" render path (line ~320)
- UpdateDialog now mounts in all app states, ensuring it can always listen for update events

**2. electron/core/AutoUpdateManager.ts**
- Added `checking-for-update` event listener for better logging
- Enhanced `checkForUpdates()` to log current version and feed URL
- Improved `update-not-available` event to log version info

### Result
- UpdateDialog is now always mounted regardless of auth state
- Update events will be captured even if user isn't authenticated
- Enhanced logging helps debug update check flow
- No breaking changes to existing functionality

### Next Steps
1. Build new version (1.0.112+)
2. Test with old version (1.0.110) to verify update detection works
3. Verify update dialog appears over auth dialog
4. Test complete update flow (download → install)

**Last Updated:** 2025/11/05  
**Status:** ✅ Implemented, Ready for Testing
