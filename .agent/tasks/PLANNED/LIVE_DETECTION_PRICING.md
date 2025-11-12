# Live Question Detection Usage Limits - Implementation Plan

**Status:** 📋 Ready for Implementation  
**Created:** 2025-10-27  
**Last Updated:** 2025-10-27

---

## Overview

Add usage limits for live question detection time to maintain profitability and prevent abuse. This includes database changes, backend tracking, UI updates, and limit enforcement in both the Electron app and web dashboard.

---

## Current Plan Structure

| Plan | Price | Files | Q&A/File | Monthly Questions |
|------|-------|-------|----------|-------------------|
| Free | ¥0 | 1 | 5 | 10 |
| Basic | ¥750 | 5 | 20 | 200 |
| Premium | ¥2500 | 20 | 30 | 1000 |

---

## Gemini Live API Cost Analysis

### Pricing Structure
- **Gemini 2.0 Flash Streaming**
  - Input: $0.075 per 1M tokens
  - Output: $0.30 per 1M tokens
  - Audio: ~100 tokens per second

### Cost Calculations

**Per Minute of Live Streaming:**
- Input tokens: 60 seconds × 100 = 6,000 tokens
- Input cost: 6,000 × $0.075 / 1,000,000 = $0.00045
- At ¥150/$1 = **¥0.07 per minute**

**Common Session Durations:**
- 10 minutes: ¥0.70
- 30 minutes: ¥2.10
- 60 minutes: ¥4.20
- 120 minutes: ¥8.40

---

## Proposed Plan Updates

### FREE PLAN (¥0)
**Current Limits:**
- 1 file
- 5 Q&A per file
- 10 monthly questions

**NEW Limits:**
- **30 minutes live detection/month** (~1 min/day)
- **2 hours max per session**

**Cost Analysis:**
- Live detection cost: ¥2.10
- Regular questions cost: ~¥0.50
- **Total cost: ~¥2.60**
- **Margin: -¥2.60** (loss leader acceptable)

**Use Case:** Try the feature, 1-2 short interviews

---

### BASIC PLAN (¥750)
**Current Limits:**
- 5 files
- 20 Q&A per file
- 200 monthly questions

**NEW Limits:**
- **300 minutes (5 hours) live detection/month** (~10 min/day)
- **2 hours max per session**

**Cost Analysis:**
- Live detection cost: ¥21
- Regular questions cost: ~¥10
- **Total cost: ~¥31**
- **Profit: ¥719 (96% margin)**

**Use Case:** 2-3 interviews per week (30-40 min each), regular user

---

### PREMIUM PLAN (¥2500)
**Current Limits:**
- 20 files
- 30 Q&A per file
- 1000 monthly questions

**NEW Limits:**
- **1500 minutes (25 hours) live detection/month** (~50 min/day)
- **4 hours max per session** (more flexibility)

**Cost Analysis:**
- Live detection cost: ¥105
- Regular questions cost: ~¥50
- **Total cost: ~¥155**
- **Profit: ¥2345 (94% margin)**

**Use Case:** Daily interviews/meetings, power user, professional use

---

## Implementation Plan

### Phase 1: Database Schema (Week 1, Day 1-2)

#### 1.1 Add Columns to `subscription_plans` Table
```sql
ALTER TABLE subscription_plans 
ADD COLUMN max_live_detection_minutes INTEGER DEFAULT 0,
ADD COLUMN max_session_duration_minutes INTEGER DEFAULT 120;
```

#### 1.2 Update Existing Plans
```sql
UPDATE subscription_plans 
SET max_live_detection_minutes = 30, max_session_duration_minutes = 120 
WHERE name = 'Free';

UPDATE subscription_plans 
SET max_live_detection_minutes = 300, max_session_duration_minutes = 120 
WHERE name = 'Basic';

UPDATE subscription_plans 
SET max_live_detection_minutes = 1500, max_session_duration_minutes = 240 
WHERE name = 'Premium';
```

#### 1.3 Add Columns to `usage_tracking` Table
```sql
ALTER TABLE usage_tracking 
ADD COLUMN live_detection_minutes_used INTEGER DEFAULT 0,
ADD COLUMN current_session_start TIMESTAMP,
ADD COLUMN current_session_duration INTEGER DEFAULT 0;
```

**Files to modify:**
- Create migration file in Supabase dashboard or via CLI

---

### Phase 2: Backend API (Week 1, Day 3-4)

#### 2.1 Update `/api/subscriptions/user` Response
**File:** `CueMeWeb/src/app/api/subscriptions/user/route.ts`

Add to response:
```typescript
{
  subscription: {
    subscription_plans: {
      // ... existing fields
      max_live_detection_minutes: number,
      max_session_duration_minutes: number
    }
  },
  usage: {
    // ... existing fields
    live_detection_minutes_used: number
  }
}
```

**Changes:**
- Update SELECT query to include new columns
- Add fields to response object

#### 2.2 Create `/api/usage/live-detection` Endpoint
**File:** `CueMeWeb/src/app/api/usage/live-detection/route.ts` (NEW)

**POST** - Increment live detection minutes:
```typescript
// Request: { minutes: number }
// Response: { success: boolean, remaining: number, error?: string }
```

**GET** - Check remaining minutes:
```typescript
// Response: { remaining: number, limit: number, used: number, sessionLimit: number }
```

**Implementation:**
- Verify user authentication
- Check monthly limit
- Update `live_detection_minutes_used` in `usage_tracking`
- Return remaining minutes
- Return 429 if limit exceeded

#### 2.3 Update TypeScript Types
**File:** `CueMeWeb/src/lib/supabase.ts`

Add to `SubscriptionPlan` interface:
```typescript
max_live_detection_minutes: number
max_session_duration_minutes: number
```

---

### Phase 3: Electron App - UsageTracker (Week 1, Day 5-6)

#### 3.1 Add Live Detection Tracking Methods
**File:** `CueMeFinal/electron/UsageTracker.ts`

**New Methods:**
```typescript
// Track live detection time (called every minute)
async trackLiveDetectionTime(userToken: string, minutes: number): Promise<{
  success: boolean;
  remaining?: number;
  error?: string;
}>

// Check if user can start live detection
async checkCanStartLiveDetection(userToken: string): Promise<{
  allowed: boolean;
  remaining?: number;
  sessionLimit?: number;
  error?: string;
}>

// Get current usage stats
async getLiveDetectionUsage(userToken: string): Promise<{
  used: number;
  limit: number;
  remaining: number;
  sessionLimit: number;
}>
```

**Implementation:**
- Add cache for live detection limits (similar to question cache)
- Call `/api/usage/live-detection` endpoint
- Handle 429 errors (limit exceeded)
- Return clear error messages

#### 3.2 Add Session Tracking
**New Properties:**
```typescript
private sessionStartTime: number | null = null
private sessionDuration: number = 0
private sessionTimer: NodeJS.Timeout | null = null
```

**New Methods:**
```typescript
startSession(): void
stopSession(): void
getSessionDuration(): number // in minutes
```

---

### Phase 4: Electron App - AudioStreamProcessor (Week 2, Day 1-2)

#### 4.1 Add Time Tracking
**File:** `CueMeFinal/electron/AudioStreamProcessor.ts`

**New Properties:**
```typescript
private listeningStartTime: number | null = null
private totalListeningTime: number = 0 // in seconds
private usageUpdateTimer: NodeJS.Timeout | null = null
private lastUsageUpdate: number = 0
private sessionLimitMinutes: number = 120
```

#### 4.2 Update `startListening()` Method
```typescript
async startListening(audioSource: string, userToken: string): Promise<void> {
  // 1. Check if user can start live detection
  const canStart = await usageTracker.checkCanStartLiveDetection(userToken)
  
  if (!canStart.allowed) {
    // Emit limit-reached event
    this.emit('live-detection-limit-reached', {
      error: canStart.error,
      remaining: canStart.remaining
    })
    return
  }
  
  // 2. Store session limit
  this.sessionLimitMinutes = canStart.sessionLimit || 120
  
  // 3. Start tracking time
  this.listeningStartTime = Date.now()
  usageTracker.startSession()
  
  // 4. Start usage update timer (every 60 seconds)
  this.usageUpdateTimer = setInterval(() => {
    this.updateUsage(userToken)
  }, 60000) // 60 seconds
  
  // 5. Start session timeout timer
  this.startSessionTimeoutTimer()
  
  // 6. Continue with existing logic...
}
```

#### 4.3 Add Usage Update Method
```typescript
private async updateUsage(userToken: string): Promise<void> {
  if (!this.listeningStartTime) return
  
  const now = Date.now()
  const elapsedSeconds = (now - this.lastUsageUpdate) / 1000
  const elapsedMinutes = Math.floor(elapsedSeconds / 60)
  
  if (elapsedMinutes >= 1) {
    // Track usage
    const result = await usageTracker.trackLiveDetectionTime(userToken, elapsedMinutes)
    
    if (!result.success) {
      // Limit reached, stop listening
      this.emit('live-detection-limit-reached', {
        error: result.error,
        remaining: result.remaining
      })
      this.stopListening()
    }
    
    this.lastUsageUpdate = now
  }
}
```

#### 4.4 Add Session Timeout Method
```typescript
private startSessionTimeoutTimer(): void {
  const timeoutMs = this.sessionLimitMinutes * 60 * 1000
  
  setTimeout(() => {
    if (this.state.isListening) {
      this.emit('session-timeout', {
        duration: this.sessionLimitMinutes
      })
      this.stopListening()
    }
  }, timeoutMs)
}
```

#### 4.5 Update `stopListening()` Method
```typescript
stopListening(): void {
  // 1. Clear timers
  if (this.usageUpdateTimer) {
    clearInterval(this.usageUpdateTimer)
    this.usageUpdateTimer = null
  }
  
  // 2. Final usage update
  if (this.listeningStartTime && this.lastUsageUpdate) {
    const finalMinutes = Math.floor((Date.now() - this.lastUsageUpdate) / 60000)
    if (finalMinutes > 0) {
      // Fire and forget final update
      usageTracker.trackLiveDetectionTime(userToken, finalMinutes).catch(console.error)
    }
  }
  
  // 3. Stop session tracking
  usageTracker.stopSession()
  
  // 4. Reset tracking variables
  this.listeningStartTime = null
  this.lastUsageUpdate = 0
  
  // 5. Continue with existing logic...
}
```

#### 4.6 Add New Events
```typescript
// In AudioStreamEvents type
'live-detection-limit-reached': (data: { error: string, remaining?: number }) => void
'session-timeout': (data: { duration: number }) => void
'usage-updated': (data: { used: number, remaining: number }) => void
```

---

### Phase 5: Electron App - IPC Handlers (Week 2, Day 3)

#### 5.1 Add IPC Handlers
**File:** `CueMeFinal/electron/ipcHandlers.ts`

```typescript
// Get live detection usage
ipcMain.handle('usage:get-live-detection', async (event) => {
  const userToken = await authService.getUserToken()
  if (!userToken) {
    return { error: 'Not authenticated' }
  }
  return usageTracker.getLiveDetectionUsage(userToken)
})

// Check if can start live detection
ipcMain.handle('usage:check-live-detection', async (event) => {
  const userToken = await authService.getUserToken()
  if (!userToken) {
    return { allowed: false, error: 'Not authenticated' }
  }
  return usageTracker.checkCanStartLiveDetection(userToken)
})
```

#### 5.2 Forward Events to Renderer
```typescript
// In AudioStreamProcessor event listeners
audioStreamProcessor.on('live-detection-limit-reached', (data) => {
  mainWindow?.webContents.send('live-detection-limit-reached', data)
})

audioStreamProcessor.on('session-timeout', (data) => {
  mainWindow?.webContents.send('session-timeout', data)
})

audioStreamProcessor.on('usage-updated', (data) => {
  mainWindow?.webContents.send('usage-updated', data)
})
```

#### 5.3 Update Preload Script
**File:** `CueMeFinal/electron/preload.ts`

```typescript
// Add to electronAPI
getLiveDetectionUsage: () => ipcRenderer.invoke('usage:get-live-detection'),
checkCanStartLiveDetection: () => ipcRenderer.invoke('usage:check-live-detection'),

// Add event listeners
onLiveDetectionLimitReached: (callback: (data: any) => void) => {
  const subscription = (_: any, data: any) => callback(data)
  ipcRenderer.on('live-detection-limit-reached', subscription)
  return () => ipcRenderer.removeListener('live-detection-limit-reached', subscription)
},

onSessionTimeout: (callback: (data: any) => void) => {
  const subscription = (_: any, data: any) => callback(data)
  ipcRenderer.on('session-timeout', subscription)
  return () => ipcRenderer.removeListener('session-timeout', subscription)
},

onUsageUpdated: (callback: (data: any) => void) => {
  const subscription = (_: any, data: any) => callback(data)
  ipcRenderer.on('usage-updated', subscription)
  return () => ipcRenderer.removeListener('usage-updated', subscription)
}
```

---

### Phase 6: Web Dashboard UI (Week 2, Day 4-5)

#### 6.1 Update Dashboard Page - Usage Display
**File:** `CueMeWeb/src/app/dashboard/page.tsx`

**Current display shows:**
- Q&A Pairs
- Document Scans

**Add:**
- Monthly Questions Used
- Live Detection Minutes Used

**Changes to Usage Status Card (lines 268-330):**

```typescript
<div className="space-y-3">
  {/* Q&A Pairs - existing */}
  <div>
    <div className="flex justify-between items-center mb-1">
      <span className="text-xs font-medium text-gray-700">Q&Aペア</span>
      <span className="text-xs font-semibold text-black">
        {userData?.current_usage.totalQnaPairs || 0} /{" "}
        {userData?.subscription.subscription_plans.max_total_qna_pairs || "10"}
      </span>
    </div>
    <div className="w-full bg-gray-200 rounded-full h-1.5">
      <div
        className="h-1.5 rounded-full transition-all duration-300"
        style={{
          backgroundColor: "#013220",
          width: `${Math.min(
            ((userData?.current_usage.totalQnaPairs || 0) /
              (userData?.subscription.subscription_plans.max_total_qna_pairs || 10)) *
              100,
            100
          )}%`,
        }}
      ></div>
    </div>
  </div>

  {/* Document Scans - existing */}
  <div>
    <div className="flex justify-between items-center mb-1">
      <span className="text-xs font-medium text-gray-700">文書スキャン</span>
      <span className="text-xs font-semibold text-black">
        {userData?.current_usage.totalDocumentScans || 0} /{" "}
        {userData?.subscription.subscription_plans.max_total_document_scans || "3"}
      </span>
    </div>
    <div className="w-full bg-gray-200 rounded-full h-1.5">
      <div
        className="h-1.5 rounded-full transition-all duration-300"
        style={{
          backgroundColor: "#013220",
          width: `${Math.min(
            ((userData?.current_usage.totalDocumentScans || 0) /
              (userData?.subscription.subscription_plans.max_total_document_scans || 3)) *
              100,
            100
          )}%`,
        }}
      ></div>
    </div>
  </div>

  {/* NEW: Monthly Questions */}
  <div>
    <div className="flex justify-between items-center mb-1">
      <span className="text-xs font-medium text-gray-700">月間質問</span>
      <span className="text-xs font-semibold text-black">
        {userData?.usage.questions_used || 0} /{" "}
        {userData?.subscription.subscription_plans.max_monthly_questions || "10"}
      </span>
    </div>
    <div className="w-full bg-gray-200 rounded-full h-1.5">
      <div
        className="h-1.5 rounded-full transition-all duration-300"
        style={{
          backgroundColor: "#013220",
          width: `${Math.min(
            ((userData?.usage.questions_used || 0) /
              (userData?.subscription.subscription_plans.max_monthly_questions || 10)) *
              100,
            100
          )}%`,
        }}
      ></div>
    </div>
  </div>

  {/* NEW: Live Detection Minutes */}
  <div>
    <div className="flex justify-between items-center mb-1">
      <span className="text-xs font-medium text-gray-700">ライブ検出時間</span>
      <span className="text-xs font-semibold text-black">
        {userData?.usage.live_detection_minutes_used || 0} /{" "}
        {userData?.subscription.subscription_plans.max_live_detection_minutes || "0"} 分
      </span>
    </div>
    <div className="w-full bg-gray-200 rounded-full h-1.5">
      <div
        className="h-1.5 rounded-full transition-all duration-300"
        style={{
          backgroundColor: "#013220",
          width: `${Math.min(
            ((userData?.usage.live_detection_minutes_used || 0) /
              (userData?.subscription.subscription_plans.max_live_detection_minutes || 1)) *
              100,
            100
          )}%`,
        }}
      ></div>
    </div>
  </div>
</div>
```

**Update TypeScript Interfaces:**
```typescript
interface SubscriptionPlan {
  // ... existing fields
  max_live_detection_minutes: number;
  max_session_duration_minutes: number;
}

interface UserData {
  subscription: UserSubscription;
  usage: {
    questions_used: number;
    qna_files_used: number;
    scanned_documents_used: number;
    live_detection_minutes_used: number; // NEW
    current_month: string;
  };
  current_usage: {
    qna_files: number;
    documents: number;
    totalQnaPairs: number;
    totalDocumentScans: number;
  };
}
```

#### 6.2 Update Subscription Page - Plan Display
**File:** `CueMeWeb/src/app/dashboard/subscription/page.tsx`

**Add live detection minutes to plan features (lines 380-391):**

```typescript
<div className="space-y-2 text-sm">
  <div className="flex items-center gap-2">
    <span className="w-2 h-2 bg-green-500 rounded-full"></span>
    <span>{plan.max_files} ファイル</span>
  </div>
  <div className="flex items-center gap-2">
    <span className="w-2 h-2 bg-green-500 rounded-full"></span>
    <span>ファイルあたり{plan.max_qnas_per_file} Q&A</span>
  </div>
  <div className="flex items-center gap-2">
    <span className="w-2 h-2 bg-green-500 rounded-full"></span>
    <span>月間{plan.max_monthly_questions}質問</span>
  </div>
  {/* NEW */}
  <div className="flex items-center gap-2">
    <span className="w-2 h-2 bg-green-500 rounded-full"></span>
    <span>ライブ検出{plan.max_live_detection_minutes}分/月</span>
  </div>
  {/* NEW */}
  <div className="flex items-center gap-2">
    <span className="w-2 h-2 bg-green-500 rounded-full"></span>
    <span>最大セッション{Math.floor(plan.max_session_duration_minutes / 60)}時間</span>
  </div>
</div>
```

**Update TypeScript Interface:**
```typescript
interface SubscriptionPlan {
  id: string;
  name: string;
  price_jpy: number;
  max_files: number;
  max_qnas_per_file: number;
  max_monthly_questions: number;
  max_live_detection_minutes: number; // NEW
  max_session_duration_minutes: number; // NEW
  stripe_price_id: string | null;
}
```

---

### Phase 7: Electron App - UI Components (Week 2, Day 6-7)

#### 7.1 Update AudioSettings Component
**File:** `CueMeFinal/src/components/AudioSettings.tsx`

**Add usage display above the "Start Listening" button:**

```typescript
const [liveDetectionUsage, setLiveDetectionUsage] = useState<{
  used: number;
  limit: number;
  remaining: number;
  sessionLimit: number;
} | null>(null);

useEffect(() => {
  // Fetch usage on mount
  window.electronAPI.getLiveDetectionUsage()
    .then(setLiveDetectionUsage)
    .catch(console.error);
    
  // Listen for usage updates
  const unsubscribe = window.electronAPI.onUsageUpdated((data) => {
    setLiveDetectionUsage(prev => prev ? {
      ...prev,
      used: data.used,
      remaining: data.remaining
    } : null);
  });
  
  return unsubscribe;
}, []);

// Add before "Start Listening" button:
{liveDetectionUsage && (
  <div className="mb-4 p-3 bg-gray-50 rounded-lg">
    <div className="flex justify-between items-center mb-2">
      <span className="text-sm font-medium text-gray-700">
        今月の使用時間
      </span>
      <span className="text-sm font-semibold text-gray-900">
        {liveDetectionUsage.used} / {liveDetectionUsage.limit} 分
      </span>
    </div>
    <div className="w-full bg-gray-200 rounded-full h-2">
      <div
        className="h-2 bg-green-600 rounded-full transition-all"
        style={{
          width: `${Math.min((liveDetectionUsage.used / liveDetectionUsage.limit) * 100, 100)}%`
        }}
      />
    </div>
    <div className="mt-1 text-xs text-gray-500">
      残り {liveDetectionUsage.remaining} 分 • 
      最大セッション {Math.floor(liveDetectionUsage.sessionLimit / 60)} 時間
    </div>
  </div>
)}
```

#### 7.2 Add Limit Reached Dialog
**File:** `CueMeFinal/src/components/ui/live-detection-limit-dialog.tsx` (NEW)

```typescript
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "./dialog";
import { Button } from "./button";
import { AlertCircle } from "lucide-react";

interface LiveDetectionLimitDialogProps {
  open: boolean;
  onClose: () => void;
  error: string;
  remaining?: number;
  isSessionTimeout?: boolean;
}

export function LiveDetectionLimitDialog({
  open,
  onClose,
  error,
  remaining,
  isSessionTimeout
}: LiveDetectionLimitDialogProps) {
  const handleUpgrade = () => {
    window.electronAPI.invoke(
      "open-external-url",
      "https://www.cueme.ink/dashboard/subscription"
    ).catch(console.error);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
              <AlertCircle className="h-5 w-5 text-red-600" />
            </div>
            <DialogTitle>
              {isSessionTimeout ? 'セッション時間制限' : '使用時間制限に達しました'}
            </DialogTitle>
          </div>
          <DialogDescription className="text-sm text-gray-600">
            {isSessionTimeout ? (
              <>
                最大セッション時間に達したため、ライブ検出が自動停止しました。
                新しいセッションを開始できます。
              </>
            ) : (
              <>
                {error}
                {remaining !== undefined && remaining > 0 && (
                  <div className="mt-2">
                    残り {remaining} 分の使用が可能です。
                  </div>
                )}
              </>
            )}
          </DialogDescription>
        </DialogHeader>
        <div className="flex gap-3 mt-4">
          <Button
            variant="outline"
            onClick={onClose}
            className="flex-1"
          >
            閉じる
          </Button>
          {!isSessionTimeout && (
            <Button
              onClick={handleUpgrade}
              className="flex-1 bg-red-600 hover:bg-red-700"
            >
              プランをアップグレード
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

#### 7.3 Integrate Dialog in Queue Page
**File:** `CueMeFinal/src/_pages/Queue.tsx`

```typescript
import { LiveDetectionLimitDialog } from "@/components/ui/live-detection-limit-dialog";

// Add state
const [limitDialog, setLimitDialog] = useState<{
  open: boolean;
  error: string;
  remaining?: number;
  isSessionTimeout?: boolean;
}>({
  open: false,
  error: '',
  remaining: undefined,
  isSessionTimeout: false
});

// Add event listeners in useEffect
useEffect(() => {
  const unsubscribeLimitReached = window.electronAPI.onLiveDetectionLimitReached((data) => {
    setLimitDialog({
      open: true,
      error: data.error,
      remaining: data.remaining,
      isSessionTimeout: false
    });
  });
  
  const unsubscribeSessionTimeout = window.electronAPI.onSessionTimeout((data) => {
    setLimitDialog({
      open: true,
      error: `${data.duration}分のセッション時間制限に達しました`,
      isSessionTimeout: true
    });
  });
  
  return () => {
    unsubscribeLimitReached();
    unsubscribeSessionTimeout();
  };
}, []);

// Add dialog component
<LiveDetectionLimitDialog
  open={limitDialog.open}
  onClose={() => setLimitDialog({ ...limitDialog, open: false })}
  error={limitDialog.error}
  remaining={limitDialog.remaining}
  isSessionTimeout={limitDialog.isSessionTimeout}
/>
```

---

### Phase 8: Testing (Week 3, Day 1-2)

#### 8.1 Database Testing
- [ ] Verify columns added correctly
- [ ] Verify plan values updated
- [ ] Test queries with new columns

#### 8.2 API Testing
- [ ] Test `/api/subscriptions/user` returns new fields
- [ ] Test `/api/usage/live-detection` POST increments correctly
- [ ] Test `/api/usage/live-detection` GET returns correct data
- [ ] Test 429 response when limit exceeded
- [ ] Test authentication required

#### 8.3 Electron App Testing
- [ ] Test UsageTracker methods
- [ ] Test time tracking accuracy
- [ ] Test session timeout enforcement
- [ ] Test limit checking before start
- [ ] Test usage updates every minute
- [ ] Test final usage update on stop

#### 8.4 UI Testing
- [ ] Test dashboard displays all 4 usage metrics
- [ ] Test subscription page shows live detection limits
- [ ] Test AudioSettings shows usage
- [ ] Test limit dialog appears when limit reached
- [ ] Test session timeout dialog
- [ ] Test upgrade button navigation

#### 8.5 Integration Testing
- [ ] Test full flow: start → track → stop
- [ ] Test limit enforcement
- [ ] Test session timeout
- [ ] Test cache behavior
- [ ] Test offline/online transitions
- [ ] Test multiple sessions

#### 8.6 Edge Cases
- [ ] Test starting with 0 minutes remaining
- [ ] Test reaching limit mid-session
- [ ] Test session timeout at exact limit
- [ ] Test network errors during tracking
- [ ] Test authentication expiry during session
- [ ] Test app restart during session

---

### Phase 9: Deployment (Week 3, Day 3)

#### 9.1 Pre-Deployment Checklist
- [ ] All tests passing
- [ ] Database migrations ready
- [ ] API endpoints tested
- [ ] Electron app tested
- [ ] Web dashboard tested
- [ ] Documentation updated

#### 9.2 Deployment Steps
1. **Database Migration**
   - Run SQL migrations in Supabase
   - Verify data integrity
   - Test with production data

2. **Web App Deployment**
   - Deploy updated API routes
   - Deploy updated dashboard pages
   - Verify deployment successful

3. **Electron App Release**
   - Build new version
   - Test packaged app
   - Release to users
   - Monitor for issues

#### 9.3 Post-Deployment Monitoring
- [ ] Monitor API error rates
- [ ] Monitor usage tracking accuracy
- [ ] Monitor user feedback
- [ ] Monitor conversion rates
- [ ] Monitor support tickets

---

### Phase 10: Documentation & Monitoring (Week 3, Day 4-5)

#### 10.1 Update Documentation
- [ ] Update README.md with new features
- [ ] Update API documentation
- [ ] Update user guide
- [ ] Update troubleshooting guide

#### 10.2 Setup Monitoring
- [ ] Track API usage
- [ ] Track error rates
- [ ] Track limit hit rates
- [ ] Track upgrade conversions
- [ ] Track user satisfaction

#### 10.3 Create Analytics Dashboard
- [ ] Average session duration by plan
- [ ] Monthly minutes used by plan
- [ ] Limit hit rate by plan
- [ ] Upgrade rate when limit hit
- [ ] Cost per user by plan

---

## Summary Checklist

### Database (Week 1, Day 1-2)
- [ ] Add `max_live_detection_minutes` to `subscription_plans`
- [ ] Add `max_session_duration_minutes` to `subscription_plans`
- [ ] Update Free plan: 30 min/month, 2h session
- [ ] Update Basic plan: 300 min/month, 2h session
- [ ] Update Premium plan: 1500 min/month, 4h session
- [ ] Add `live_detection_minutes_used` to `usage_tracking`
- [ ] Add `current_session_start` to `usage_tracking`
- [ ] Add `current_session_duration` to `usage_tracking`

### Backend API (Week 1, Day 3-4)
- [ ] Update `/api/subscriptions/user` to return live detection fields
- [ ] Create `/api/usage/live-detection` POST endpoint
- [ ] Create `/api/usage/live-detection` GET endpoint
- [ ] Update TypeScript types in `supabase.ts`
- [ ] Test all endpoints

### Electron - UsageTracker (Week 1, Day 5-6)
- [ ] Add `trackLiveDetectionTime()` method
- [ ] Add `checkCanStartLiveDetection()` method
- [ ] Add `getLiveDetectionUsage()` method
- [ ] Add session tracking (start/stop/duration)
- [ ] Add cache for live detection limits
- [ ] Test all methods

### Electron - AudioStreamProcessor (Week 2, Day 1-2)
- [ ] Add time tracking properties
- [ ] Update `startListening()` to check limits
- [ ] Add usage update timer (every 60 seconds)
- [ ] Add session timeout timer
- [ ] Update `stopListening()` for final usage update
- [ ] Add new events: `live-detection-limit-reached`, `session-timeout`, `usage-updated`
- [ ] Test time tracking accuracy

### Electron - IPC (Week 2, Day 3)
- [ ] Add `usage:get-live-detection` handler
- [ ] Add `usage:check-live-detection` handler
- [ ] Forward events to renderer
- [ ] Update preload.ts with new methods
- [ ] Update electron.d.ts types
- [ ] Test IPC communication

### Web Dashboard (Week 2, Day 4-5)
- [ ] Update dashboard page to show 4 usage metrics
- [ ] Add Monthly Questions usage bar
- [ ] Add Live Detection Minutes usage bar
- [ ] Update TypeScript interfaces
- [ ] Update subscription page plan features
- [ ] Add live detection minutes display
- [ ] Add max session duration display
- [ ] Test UI updates

### Electron UI (Week 2, Day 6-7)
- [ ] Update AudioSettings to show usage
- [ ] Add usage display with progress bar
- [ ] Create LiveDetectionLimitDialog component
- [ ] Integrate dialog in Queue page
- [ ] Add event listeners for limit/timeout
- [ ] Test dialog flows
- [ ] Test upgrade navigation

### Testing (Week 3, Day 1-2)
- [ ] Database testing
- [ ] API testing
- [ ] UsageTracker testing
- [ ] AudioStreamProcessor testing
- [ ] UI testing (dashboard)
- [ ] UI testing (Electron app)
- [ ] Integration testing
- [ ] Edge case testing

### Deployment (Week 3, Day 3)
- [ ] Run database migrations
- [ ] Deploy web app
- [ ] Build and release Electron app
- [ ] Monitor deployment
- [ ] Check error rates

### Documentation (Week 3, Day 4-5)
- [ ] Update README.md
- [ ] Update API docs
- [ ] Update user guide
- [ ] Setup monitoring
- [ ] Create analytics dashboard

---

## Key Files to Modify

### Database
- Supabase migrations

### Backend (CueMeWeb)
- `src/app/api/subscriptions/user/route.ts` - Update response
- `src/app/api/usage/live-detection/route.ts` - NEW endpoint
- `src/lib/supabase.ts` - Update types
- `src/app/dashboard/page.tsx` - Add usage display
- `src/app/dashboard/subscription/page.tsx` - Add plan features

### Electron Backend (CueMeFinal)
- `electron/UsageTracker.ts` - Add live detection methods
- `electron/AudioStreamProcessor.ts` - Add time tracking
- `electron/ipcHandlers.ts` - Add IPC handlers
- `electron/preload.ts` - Add API methods

### Electron Frontend (CueMeFinal)
- `src/components/AudioSettings.tsx` - Add usage display
- `src/components/ui/live-detection-limit-dialog.tsx` - NEW component
- `src/_pages/Queue.tsx` - Integrate dialog
- `src/types/electron.d.ts` - Update types

---

## Success Metrics

### Financial
- Maintain >90% profit margin on Basic/Premium
- Free plan cost <¥5/user/month
- Track conversion rate from Free to paid

### Usage
- Average session duration by plan
- Monthly active users of live detection
- Limit hit rate by plan
- Upgrade rate when limits hit

### User Satisfaction
- Support tickets related to limits
- User feedback on limit adequacy
- Retention rate by plan

---

## Cost Analysis Summary

| Plan | Revenue | API Costs | Profit | Margin |
|------|---------|-----------|--------|--------|
| Free | ¥0 | ~¥2.60 | -¥2.60 | Loss leader |
| Basic | ¥750 | ~¥31 | ¥719 | 96% |
| Premium | ¥2,500 | ~¥155 | ¥2,345 | 94% |

**Cost per minute:** ~¥0.07 (Gemini 2.0 Flash streaming)

---

## Timeline

**Total Duration:** 3 weeks

- **Week 1:** Database + Backend API + UsageTracker
- **Week 2:** AudioStreamProcessor + IPC + UI
- **Week 3:** Testing + Deployment + Documentation

---

## Notes

- All usage tracking happens server-side for accuracy
- Cache used for performance, synced every minute
- Session timeout prevents abuse
- Monthly limits reset automatically
- Clear upgrade path when limits reached
- Graceful degradation on errors
