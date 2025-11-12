import * as path from 'path'
import * as fs from 'fs'
import { app } from 'electron'

interface UsageData {
  remaining: number
  limit: number
  used: number
  lastSync: number
}

interface PendingUsage {
  count: number
  timestamp: number
  type: 'question' | 'other'
}

/**
 * LocalUsageManager - Fast, non-blocking usage tracking with background synchronization
 *
 * This replaces the synchronous UsageTracker for better performance:
 * - Local usage estimation (no blocking network calls)
 * - Background synchronization every 30-60 seconds
 * - Prefetch usage data on authentication
 * - Graceful fallback to server when needed
 */
export class LocalUsageManager {
  private webApiUrl: string
  private localUsageFile: string
  private usageData: UsageData | null = null
  private pendingUsage: PendingUsage[] = []
  private syncInterval: NodeJS.Timeout | null = null
  private lastUserToken: string | null = null
  private isOnline: boolean = true
  private isInitialized: boolean = false
  private initializationPromise: Promise<void> | null = null

  // Configuration
  private readonly SYNC_INTERVAL = 45 * 1000 // 45 seconds
  private readonly LOCAL_TTL = 2 * 60 * 1000 // 2 minutes for fresh local data
  private readonly MAX_PENDING = 50 // Max pending usage before forcing sync
  private readonly DEFAULT_LIMIT = 200 // Default limit if no server data

  constructor() {
    this.webApiUrl = process.env.WEB_API_URL || 'https://www.cueme.ink'
    this.localUsageFile = path.join(app.getPath('userData'), 'usage-cache.json')

    console.log(`[LocalUsageManager] Initialized with API URL: ${this.webApiUrl}`)
    console.log(`[LocalUsageManager] Local cache file: ${this.localUsageFile}`)

    this.loadLocalUsage()
    this.startBackgroundSync()
  }

  /**
   * Prefetch usage data - call this when user authenticates
   */
  async prefetchUsageData(userToken: string): Promise<void> {
    // Avoid multiple concurrent prefetches
    if (this.initializationPromise) {
      console.log('[LocalUsageManager] Prefetch already in progress, waiting...')
      return this.initializationPromise
    }

    console.log('[LocalUsageManager] Prefetching usage data for user...')
    this.lastUserToken = userToken
    this.isInitialized = false

    this.initializationPromise = this._doPrefetch(userToken)

    try {
      await this.initializationPromise
    } finally {
      this.initializationPromise = null
    }
  }

  private async _doPrefetch(userToken: string): Promise<void> {
    try {
      // Load existing usage data in parallel with server fetch
      const [localData, serverData] = await Promise.allSettled([
        Promise.resolve(this.loadLocalUsage()),
        this.fetchUsageFromServer(userToken)
      ])

      if (serverData.status === 'fulfilled' && serverData.value) {
        this.usageData = {
          ...serverData.value,
          lastSync: Date.now()
        }
        this.saveLocalUsage()
        this.isInitialized = true
        console.log('[LocalUsageManager] ✅ Prefetched fresh usage data from server')
        console.log(`[LocalUsageManager] Usage data - remaining: ${this.usageData.remaining}, limit: ${this.usageData.limit}`)
      } else if (localData.status === 'fulfilled' && localData.value) {
        this.isInitialized = true
        console.log('[LocalUsageManager] ✅ Using local usage data, server fetch failed')
        console.log(`[LocalUsageManager] Usage data - remaining: ${this.usageData.remaining}, limit: ${this.usageData.limit}`)
      } else {
        console.log('[LocalUsageManager] Initializing with default usage data')
        this.usageData = {
          remaining: this.DEFAULT_LIMIT,
          limit: this.DEFAULT_LIMIT,
          used: 0,
          lastSync: Date.now()
        }
        this.isInitialized = true
        console.log(`[LocalUsageManager] Usage data - remaining: ${this.usageData.remaining}, limit: ${this.usageData.limit}`)
      }
    } catch (error) {
      console.error('[LocalUsageManager] Error prefetching usage data:', error)
      this.initializeDefaultUsage()
      this.isInitialized = true
    }
  }

  /**
   * Fast, non-blocking usage check
   */
  canUse(count: number = 1): { allowed: boolean; remaining: number; error?: string } {
    const now = Date.now()
    const dataAge = this.usageData ? now - this.usageData.lastSync : Infinity

    console.log(`[LocalUsageManager] Usage check - count: ${count}, dataAge: ${dataAge}ms, remaining: ${this.usageData?.remaining || 'null'}, initialized: ${this.isInitialized}`)

    // If we have fresh local data (< 2 minutes), use it
    if (this.usageData && dataAge < this.LOCAL_TTL) {
      const allowed = this.usageData.remaining >= count
      console.log(`[LocalUsageManager] Using fresh data - allowed: ${allowed}, remaining: ${this.usageData.remaining}`)
      return {
        allowed,
        remaining: this.usageData.remaining,
        error: allowed ? undefined : 'Insufficient usage remaining'
      }
    }

    // If data is stale but we have some data, use optimistic approach with immediate refresh
    if (this.usageData && dataAge >= this.LOCAL_TTL) {
      console.log(`[LocalUsageManager] Data is stale (${Math.round(dataAge / 1000)}s old), using optimistic check and triggering refresh`)

      // Trigger immediate refresh in background
      if (this.lastUserToken) {
        setTimeout(() => this.fetchUsageFromServer(this.lastUserToken!), 100)
      }

      const allowed = this.usageData.remaining >= count
      return {
        allowed,
        remaining: this.usageData.remaining,
        error: allowed ? undefined : 'Insufficient usage remaining (data stale)'
      }
    }

    // If we're offline for extended time (>10 minutes) with old data, be slightly conservative
    if (!this.isOnline && this.usageData && dataAge > 10 * 60 * 1000) {
      console.log('[LocalUsageManager] Extended offline detected, using light conservative estimation')
      // Only subtract 2-3 usage instead of 10 for extended offline periods
      const conservativeRemaining = Math.max(0, this.usageData.remaining - 3)
      const allowed = conservativeRemaining >= count

      return {
        allowed,
        remaining: conservativeRemaining,
        error: allowed ? undefined : 'Insufficient usage remaining (offline mode)'
      }
    }

    // If we have any data but not stale, use it
    if (this.usageData) {
      const allowed = this.usageData.remaining >= count
      console.log(`[LocalUsageManager] Using available data - allowed: ${allowed}, remaining: ${this.usageData.remaining}`)
      return {
        allowed,
        remaining: this.usageData.remaining,
        error: allowed ? undefined : 'Insufficient usage remaining'
      }
    }

    // If no data available, allow by default but trigger refresh
    console.log('[LocalUsageManager] No usage data available, allowing by default and triggering refresh')
    if (this.lastUserToken && !this.initializationPromise) {
      setTimeout(() => this.prefetchUsageData(this.lastUserToken!), 100)
    }

    return {
      allowed: true,
      remaining: this.DEFAULT_LIMIT
    }
  }

  /**
   * Non-blocking usage increment
   */
  trackUsage(count: number = 1, type: 'question' | 'other' = 'question'): void {
    // Immediately update local usage
    if (this.usageData) {
      this.usageData.remaining = Math.max(0, this.usageData.remaining - count)
      this.usageData.used += count
    } else {
      this.usageData = {
        remaining: this.DEFAULT_LIMIT - count,
        limit: this.DEFAULT_LIMIT,
        used: count,
        lastSync: Date.now()
      }
    }

    // Add to pending sync queue
    this.pendingUsage.push({
      count,
      timestamp: Date.now(),
      type
    })

    console.log(`[LocalUsageManager] Tracked ${count} ${type} usage, remaining: ${this.usageData.remaining}`)

    // Force sync if too many pending
    if (this.pendingUsage.length >= this.MAX_PENDING) {
      console.log('[LocalUsageManager] Too many pending usage, forcing sync')
      this.syncToServer()
    }

    // Save local state
    this.saveLocalUsage()
  }

  /**
   * Get current usage statistics
   */
  getUsageStats(): UsageData | null {
    return this.usageData ? { ...this.usageData } : null
  }

  /**
   * Force immediate synchronization with server
   */
  async forceSync(userToken?: string): Promise<boolean> {
    const token = userToken || this.lastUserToken
    if (!token) {
      console.warn('[LocalUsageManager] No user token available for sync')
      return false
    }

    return this.syncToServer(token)
  }

  /**
   * Cleanup and shutdown
   */
  destroy(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval)
      this.syncInterval = null
    }

    // Final sync before shutdown
    if (this.pendingUsage.length > 0 && this.lastUserToken) {
      this.syncToServer(this.lastUserToken)
    }

    this.saveLocalUsage()
    console.log('[LocalUsageManager] Shutdown complete')
  }

  // Private methods

  private loadLocalUsage(): UsageData | null {
    try {
      if (fs.existsSync(this.localUsageFile)) {
        const data = fs.readFileSync(this.localUsageFile, 'utf8')
        const parsed = JSON.parse(data)

        // Validate and clean up old data
        if (parsed.remaining !== undefined && parsed.limit !== undefined) {
          console.log('[LocalUsageManager] Loaded usage data from local cache')
          return {
            remaining: Math.max(0, parsed.remaining),
            limit: Math.max(0, parsed.limit),
            used: Math.max(0, parsed.used || 0),
            lastSync: parsed.lastSync || 0
          }
        }
      }
    } catch (error) {
      console.error('[LocalUsageManager] Error loading local usage:', error)
    }

    return null
  }

  private saveLocalUsage(): void {
    try {
      if (this.usageData) {
        fs.writeFileSync(this.localUsageFile, JSON.stringify(this.usageData, null, 2))
      }
    } catch (error) {
      console.error('[LocalUsageManager] Error saving local usage:', error)
    }
  }

  private initializeDefaultUsage(): void {
    this.usageData = {
      remaining: this.DEFAULT_LIMIT,
      limit: this.DEFAULT_LIMIT,
      used: 0,
      lastSync: Date.now()
    }
    this.saveLocalUsage()
  }

  private startBackgroundSync(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval)
    }

    this.syncInterval = setInterval(() => {
      if (this.pendingUsage.length > 0 && this.lastUserToken) {
        this.syncToServer(this.lastUserToken)
      }
    }, this.SYNC_INTERVAL)

    console.log(`[LocalUsageManager] Background sync started (${this.SYNC_INTERVAL / 1000}s interval)`)
  }

  private async syncToServer(userToken?: string): Promise<boolean> {
    const token = userToken || this.lastUserToken
    if (!token || this.pendingUsage.length === 0) {
      return false
    }

    try {
      console.log(`[LocalUsageManager] Syncing ${this.pendingUsage.length} pending usage items to server`)

      // Calculate total usage
      const totalUsage = this.pendingUsage.reduce((sum, item) => sum + item.count, 0)

      const response = await fetch(`${this.webApiUrl}/api/usage/increment`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ count: totalUsage })
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }

      const data = await response.json()

      // Update local usage with server response
      if (data.usage) {
        this.usageData = {
          remaining: data.usage.remaining,
          limit: data.usage.limit,
          used: data.usage.used,
          lastSync: Date.now()
        }
        this.saveLocalUsage()
      }

      // Clear pending usage
      this.pendingUsage = []
      console.log('[LocalUsageManager] Sync successful')
      return true

    } catch (error) {
      console.error('[LocalUsageManager] Sync failed:', error)
      this.isOnline = false

      // Retry failed syncs with exponential backoff
      setTimeout(() => {
        this.isOnline = true
        console.log('[LocalUsageManager] Retrying sync...')
        this.syncToServer(token)
      }, Math.min(30000, this.SYNC_INTERVAL * 2))

      return false
    }
  }

  private async fetchUsageFromServer(userToken: string): Promise<UsageData | null> {
    try {
      const response = await fetch(`${this.webApiUrl}/api/subscriptions/user`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${userToken}`,
        }
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }

      const data = await response.json()

      // API returns: { subscription: {..., subscription_plans: { max_monthly_questions }}, usage: { questions_used } }
      if (data.subscription && data.usage !== undefined) {
        const maxQuestions = data.subscription.subscription_plans?.max_monthly_questions || 10
        const questionsUsed = data.usage.questions_used || 0
        const remaining = Math.max(0, maxQuestions - questionsUsed)
        
        console.log('[LocalUsageManager] Fetched from server:', { 
          maxQuestions, 
          questionsUsed, 
          remaining 
        })
        
        return {
          remaining,
          limit: maxQuestions,
          used: questionsUsed,
          lastSync: Date.now()
        }
      }

      return null
    } catch (error) {
      console.error('[LocalUsageManager] Error fetching usage from server:', error)
      return null
    }
  }
}