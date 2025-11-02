# System Audio Permission UX Fix Plan

**Created:** 2025-11-01  
**Status:** 📋 PLANNING  
**Priority:** HIGH - Critical UX issue affecting all new users

---

## 🎯 Objective

Fix the permission granting flow to ensure users:

1. Grant **System Audio permission ONLY** (not Screen Recording)
2. Understand the difference between the two permissions
3. Have clear visual guidance on which permission to select

---

## 📊 Current Situation Analysis

### Current Permission Flow

**File:** `/src/components/ui/permission-dialog.tsx`

**Step 1: Welcome Screen**

- Shows two permissions: Microphone + Screen Recording
- Describes Screen Recording as "システム音声の取得とスクリーンショット機能に使用します"
- ❌ **Problem:** Misleading - users think Screen Recording = System Audio

**Step 2: Permissions Screen**

- **Microphone:** Can be requested programmatically ✅
- **Screen Recording:** Opens System Preferences ✅
- ❌ **Problem:** Still says "画面収録" (Screen Recording), not "システム音声" (System Audio)
- ❌ **Problem:** No visual guidance showing which checkbox to select
- ❌ **Problem:** No warning about NOT selecting Screen Recording

### Why It's Confusing

From user testing:

1. ✅ **Works:** System Audio Only permission
2. ❌ **Fails:** Screen Recording + System Audio permission
3. ❌ **Fails:** Screen Recording Only permission

**Root cause:** macOS has TWO separate audio capture pathways:

- `NSScreenCaptureUsageDescription` → ScreenCaptureKit APIs (for video + legacy audio)
- `NSAudioCaptureUsageDescription` → Core Audio Taps APIs (audio-only, newer)

Our app uses **Core Audio Taps** (via `audiotee`), which requires **System Audio permission**, NOT Screen Recording.

---

## 🔍 Technical Investigation

### 1. Can We Make Screen Recording Permission Work?

**Option A: Switch to ScreenCaptureKit APIs**

- Would require rewriting `SystemAudioCapture.ts` to use ScreenCaptureKit instead of `audiotee`
- ✅ Pro: Would work with Screen Recording permission
- ❌ Con: Major refactoring, loses benefits of `audiotee` library
- ❌ Con: ScreenCaptureKit is heavier (requires video capture setup even for audio-only)
- **Verdict:** NOT RECOMMENDED - stick with current approach

**Option B: Request Both Permissions**

- Grant both Screen Recording AND System Audio
- ❌ Con: macOS may route through Screen Recording pathway (conflicting APIs)
- ❌ Con: Empirical testing shows this **doesn't work** (silent buffers)
- **Verdict:** NOT VIABLE - confirmed broken in user testing

**Option C: Detect and Handle Permission Conflicts**

- Detect when Screen Recording is granted
- Show warning to remove it and add System Audio instead
- ✅ Pro: Educates users about the issue
- ✅ Pro: Provides recovery path for users who already granted wrong permission
- **Verdict:** RECOMMENDED as fallback/recovery mechanism

### 2. Can We Request System Audio Programmatically?

**Current Electron APIs:**

```typescript
// ✅ Works for microphone
systemPreferences.askForMediaAccess("microphone");

// ❌ No API for System Audio
systemPreferences.askForMediaAccess("system-audio"); // Does NOT exist
```

**macOS Restriction:**

- System Audio (Core Audio Taps) cannot be requested programmatically
- User MUST manually add app to System Settings → Privacy & Security → **System Audio**
- This is a security feature in macOS 14.2+

**Verdict:** Must rely on manual user action with clear UI guidance

---

## 🎨 Proposed Solution

### Strategy: Clear Visual Guidance + Error Recovery

**Three-pronged approach:**

1. **Update UI Language** - Replace confusing "Screen Recording" with accurate "System Audio"
2. **Add Visual Guide** - Screenshot showing exactly which permission to select
3. **Detect Permission Conflicts** - Warn if Screen Recording is granted instead

---

## 📝 Implementation Plan

### Phase 1: Update Permission Dialog UI

**File:** `/src/components/ui/permission-dialog.tsx`

#### 1.1 Update Welcome Screen (Step 1)

**Current:**

```tsx
<Monitor className="w-5 h-5 text-green-500" />
<div className="font-medium text-sm">画面収録</div>
<div className="text-xs">システム音声の取得とスクリーンショット機能に使用します</div>
```

**Proposed:**

```tsx
<Monitor className="w-5 h-5 text-green-500" />
<div className="font-medium text-sm">システム音声</div>
<div className="text-xs">
  Zoom/Teams等のシステム音声を取得します
  <span className="block text-yellow-700 font-medium mt-1">
    ⚠️ 「画面収録」ではなく「システム音声」の権限が必要です
  </span>
</div>
```

#### 1.2 Update Permissions Screen (Step 2)

**Replace Screen Recording section with System Audio:**

```tsx
{
  /* System Audio Permission (was Screen Recording) */
}
<div className="space-y-3">
  <div className="flex items-center justify-between p-4 bg-white/50 rounded-xl">
    <div className="flex items-center gap-3">
      <Monitor className="w-5 h-5 text-green-500" />
      <div>
        <div className="font-medium text-sm" style={{ color: "#013220" }}>
          システム音声
        </div>
        <div className="text-xs text-gray-600">
          Zoom/Teams等のシステム音声取得に必要
        </div>
      </div>
    </div>
    <div className="flex items-center gap-2">
      {getPermissionIcon(permissionStatus.systemAudio)}
      <span className="text-xs text-gray-600">
        {getPermissionText(permissionStatus.systemAudio)}
      </span>
    </div>
  </div>

  {/* Warning if Screen Recording is granted instead */}
  {permissionStatus.screenCapture === "granted" &&
    permissionStatus.systemAudio !== "granted" && (
      <div className="p-3 bg-red-50 border border-red-200 rounded-xl">
        <div className="flex items-start gap-2">
          <XCircle className="w-4 h-4 text-red-600 mt-0.5" />
          <div className="text-xs text-red-800">
            <div className="font-medium mb-1">
              ⚠️ 間違った権限が設定されています
            </div>
            <div>
              「画面収録」ではなく「システム音声」の権限を許可してください。
              画面収録の権限は削除することをお勧めします。
            </div>
          </div>
        </div>
      </div>
    )}

  <button
    onClick={openSystemPreferencesForSystemAudio}
    disabled={loading}
    className="w-full px-4 py-2 text-sm bg-green-50 hover:bg-green-100 disabled:opacity-50 disabled:cursor-not-allowed text-green-700 rounded-xl transition-all duration-200 font-medium border border-green-200"
  >
    {loading ? (
      <Loader2 className="w-4 h-4 animate-spin mx-auto" />
    ) : (
      "システム環境設定を開く (システム音声)"
    )}
  </button>
</div>;
```

#### 1.3 Update Instructions Section

**Replace current instructions with step-by-step visual guide:**

```tsx
<div className="p-4 bg-blue-50 border border-blue-200 rounded-xl space-y-3">
  <div className="flex items-start gap-2">
    <AlertTriangle className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
    <div className="text-xs text-blue-800">
      <div className="font-bold mb-2 text-sm">
        📌 重要: システム音声権限の設定方法
      </div>
      <ol className="space-y-2 list-decimal list-inside ml-2">
        <li className="font-medium">
          システム環境設定 → プライバシーとセキュリティ →
          <span className="bg-blue-200 px-1 rounded font-bold">
            システム音声
          </span>
        </li>
        <li className="font-medium">
          左側のリストから
          <span className="bg-blue-200 px-1 rounded font-bold">
            「システム音声」
          </span>
          を選択
          <div className="text-red-700 font-bold mt-1">
            ⚠️ 「画面収録」ではありません！
          </div>
        </li>
        <li>右側のリストで「CueMe」を探し、チェックを入れる</li>
        <li className="text-gray-700">
          設定後、このダイアログに戻り「状態を更新」をクリック
        </li>
      </ol>
    </div>
  </div>

  {/* Optional: Add visual diagram */}
  <div className="mt-3 p-2 bg-white rounded border border-blue-300">
    <div className="text-xs text-center text-gray-600 mb-1">視覚的ガイド:</div>
    <div className="font-mono text-xs text-gray-700 space-y-1">
      <div>プライバシーとセキュリティ</div>
      <div className="pl-4">├─ カメラ</div>
      <div className="pl-4">├─ マイク</div>
      <div className="pl-4">
        ├─ <span className="bg-red-200 px-1">❌ 画面収録 (使用しない)</span>
      </div>
      <div className="pl-4">
        └─{" "}
        <span className="bg-green-200 px-1 font-bold">
          ✅ システム音声 (これを使用!)
        </span>
      </div>
    </div>
  </div>
</div>
```

---

### Phase 2: Update Backend Permission Checking

**File:** `/electron/PermissionStorage.ts`

#### 2.1 Add System Audio Status Check

**Current:** Only checks `screenCapture` (Screen Recording)

**Add:**

```typescript
public async getCurrentPermissionStatus(): Promise<{
  microphone: PermissionStatus
  screenCapture: PermissionStatus
  systemAudio: PermissionStatus // NEW
}> {
  try {
    let microphoneStatus: PermissionStatus = 'unknown'
    let screenCaptureStatus: PermissionStatus = 'unknown'
    let systemAudioStatus: PermissionStatus = 'unknown' // NEW

    if (process.platform === 'darwin') {
      microphoneStatus = systemPreferences.getMediaAccessStatus('microphone')
      screenCaptureStatus = systemPreferences.getMediaAccessStatus('screen')

      // Check System Audio permission (macOS 14.2+)
      // Note: There's no direct API for this, we check if audiotee binary can access Core Audio
      // Workaround: Check if we have NSAudioCaptureUsageDescription in Info.plist
      // and infer from successful audio capture
      systemAudioStatus = await this.checkSystemAudioPermission()
    }

    return {
      microphone: microphoneStatus,
      screenCapture: screenCaptureStatus,
      systemAudio: systemAudioStatus
    }
  } catch (error) {
    // ... error handling
  }
}

/**
 * Check System Audio permission by attempting a test capture
 * This is a workaround since there's no direct macOS API
 */
private async checkSystemAudioPermission(): Promise<PermissionStatus> {
  try {
    // Attempt to spawn audiotee binary with --test flag (quick check)
    // If it succeeds, System Audio permission is granted
    // If it fails with permission error, it's denied
    // Implementation details in Phase 3
    return 'unknown' // Placeholder
  } catch (error) {
    return 'unknown'
  }
}
```

#### 2.2 Update IPC Handlers

**File:** `/electron/ipc/permissionHandlers.ts`

Add new handler:

```typescript
ipcMain.handle("permission-open-system-audio-preferences", async () => {
  try {
    // Open System Preferences directly to System Audio section
    // macOS 13+ uses new URL scheme
    await shell.openExternal(
      "x-apple.systempreferences:com.apple.preference.security?Privacy_SystemAudio"
    );
    return { success: true };
  } catch (error: any) {
    console.error("Error opening system audio preferences:", error);
    return { success: false, error: error.message };
  }
});
```

---

### Phase 3: Add Permission Conflict Detection

**File:** `/src/components/ui/permission-dialog.tsx`

#### 3.1 Detect Conflicting Permissions

Add useEffect to detect conflicts:

```typescript
useEffect(() => {
  if (
    permissionStatus.screenCapture === "granted" &&
    permissionStatus.systemAudio !== "granted"
  ) {
    // Show warning about wrong permission
    setError(
      "⚠️ 「画面収録」ではなく「システム音声」の権限を許可してください。" +
        "画面収録の権限は削除することをお勧めします。"
    );
  }
}, [permissionStatus]);
```

#### 3.2 Add Recovery Action

```tsx
{
  permissionStatus.screenCapture === "granted" &&
    permissionStatus.systemAudio !== "granted" && (
      <button
        onClick={openPermissionResetGuide}
        className="w-full px-4 py-2 text-sm bg-red-50 hover:bg-red-100 text-red-700 rounded-xl font-medium border border-red-200"
      >
        🔧 権限をリセットする方法を表示
      </button>
    );
}
```

---

### Phase 4: Update Backend Permission Opening

**File:** `/electron/ipc/permissionHandlers.ts`

#### 4.1 Create Dedicated System Audio Opener

**Current issue:** `permission-open-system-preferences` opens Screen Recording

**Fix:** Create separate handler that opens **System Audio** section specifically:

```typescript
ipcMain.handle("permission-open-system-audio-preferences", async () => {
  try {
    // macOS 13+: New Settings app URL scheme
    const url =
      "x-apple.systempreferences:com.apple.preference.security?Privacy_SystemAudio";

    await shell.openExternal(url);

    console.log("[Permissions] Opened System Audio preferences");
    return { success: true };
  } catch (error: any) {
    console.error("Error opening System Audio preferences:", error);

    // Fallback: Open general Privacy & Security pane
    try {
      await shell.openExternal(
        "x-apple.systempreferences:com.apple.preference.security"
      );
      return { success: true, fallback: true };
    } catch (fallbackError: any) {
      return { success: false, error: fallbackError.message };
    }
  }
});
```

---

## 🧪 Testing Plan

### Test Case 1: Fresh Install (No Permissions)

1. Launch app for first time
2. Should show permission dialog with updated UI
3. Click "システム環境設定を開く"
4. Verify it opens **System Audio** section (not Screen Recording)
5. Grant System Audio permission
6. Return to app, click "状態を更新"
7. Verify System Audio shows as "granted"
8. Complete setup
9. Test system audio capture works ✅

### Test Case 2: Wrong Permission Granted (Screen Recording)

1. Reset permissions
2. Manually grant **Screen Recording** permission
3. Launch app
4. Should show **warning** about wrong permission
5. Should highlight that System Audio is needed
6. Click recovery button
7. Follow guide to remove Screen Recording, add System Audio
8. Test system audio capture works ✅

### Test Case 3: Both Permissions Granted (Conflict)

1. Grant both Screen Recording AND System Audio
2. Launch app
3. Should show warning about conflicting permissions
4. Should recommend removing Screen Recording
5. Test system audio capture behavior (may fail due to conflict)

---

## 📋 Implementation Checklist

### UI Updates

- [ ] Update welcome screen - replace "画面収録" with "システム音声"
- [ ] Add warning banner about NOT using Screen Recording
- [ ] Update permissions screen with accurate labels
- [ ] Add visual guide showing System Settings hierarchy
- [ ] Add conflict detection warnings
- [ ] Add recovery action button for wrong permissions

### Backend Updates

- [ ] Add `systemAudio` to `PermissionStatus` type
- [ ] Update `getCurrentPermissionStatus()` to check System Audio
- [ ] Create `permission-open-system-audio-preferences` IPC handler
- [ ] Add System Audio URL scheme for macOS Settings
- [ ] Add fallback if direct URL doesn't work

### Testing

- [ ] Test fresh install flow
- [ ] Test wrong permission recovery
- [ ] Test permission conflict detection
- [ ] Verify System Audio capture works after setup
- [ ] Test on macOS 13 and 14 (different Settings app versions)

---

## 🚀 Expected Outcomes

After implementation:

1. ✅ **95%+ users grant correct permission on first try**
   - Clear visual guidance eliminates confusion
   - Warning about Screen Recording prevents mistakes

2. ✅ **Remaining 5% can easily recover**
   - Conflict detection alerts users immediately
   - Recovery guide provides clear steps

3. ✅ **System audio works for all users**
   - No more "silent buffer" issues from wrong permissions
   - Consistent behavior across all permission states

4. ✅ **Reduced support burden**
   - Self-service recovery for permission mistakes
   - Clear error messages guide users to solutions

---

## 📚 References

- macOS Permission System: https://developer.apple.com/documentation/avfoundation/capture_setup/requesting_authorization_for_media_capture_on_macos
- Core Audio Taps: https://developer.apple.com/documentation/coreaudio/core_audio_taps
- System Settings URL Schemes: https://github.com/orchetect/macOS-System-Settings-URL-Schemes

---

## 🎯 Next Steps

1. **Review this plan** - Get user approval
2. **Start with UI updates** (Phase 1) - Most visible impact
3. **Add backend support** (Phase 2) - Enable new UI
4. **Test thoroughly** - Verify on both macOS 13 and 14
5. **Deploy** - Include in v1.0.108 release

---

**Status:** Ready for implementation 🚀
