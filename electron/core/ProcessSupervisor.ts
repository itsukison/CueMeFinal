import { EventEmitter } from 'events';
import { execSync, exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/**
 * ProcessSupervisor - Prevents multiple audio capture processes from running simultaneously
 * This solves the core issue seen in diagnostics where both CueMe and SystemAudioCapture
 * processes run at the same time, causing permission conflicts.
 */
export class ProcessSupervisor extends EventEmitter {
  private isSupervising: boolean = false;
  private audioProcessPid: number | null = null;
  private checkInterval: NodeJS.Timeout | null = null;
  private readonly CHECK_INTERVAL_MS = 2000; // Check every 2 seconds

  constructor() {
    super();
  }

  /**
   * Start supervising processes to prevent conflicts
   */
  public startSupervision(): void {
    if (this.isSupervising) return;
    
    console.log('[ProcessSupervisor] Starting process supervision...');
    this.isSupervising = true;
    
    // Initial cleanup
    this.performInitialCleanup();
    
    // Start periodic monitoring
    this.checkInterval = setInterval(() => {
      this.checkForConflicts();
    }, this.CHECK_INTERVAL_MS);
    
    console.log('[ProcessSupervisor] ✅ Process supervision active');
  }

  /**
   * Stop supervising processes
   */
  public stopSupervision(): void {
    if (!this.isSupervising) return;
    
    console.log('[ProcessSupervisor] Stopping process supervision...');
    this.isSupervising = false;
    
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
    
    console.log('[ProcessSupervisor] ✅ Process supervision stopped');
  }

  /**
   * Register a new audio process under supervision
   */
  public registerAudioProcess(pid: number): void {
    console.log(`[ProcessSupervisor] Registering audio process: ${pid}`);
    
    // If another audio process is already registered, terminate it first
    if (this.audioProcessPid && this.audioProcessPid !== pid) {
      console.log(`[ProcessSupervisor] Terminating previous audio process: ${this.audioProcessPid}`);
      this.terminateProcess(this.audioProcessPid);
    }
    
    this.audioProcessPid = pid;
    this.emit('audio-process-registered', pid);
  }

  /**
   * Unregister an audio process
   */
  public unregisterAudioProcess(pid: number): void {
    if (this.audioProcessPid === pid) {
      console.log(`[ProcessSupervisor] Unregistering audio process: ${pid}`);
      this.audioProcessPid = null;
      this.emit('audio-process-unregistered', pid);
    }
  }

  /**
   * Perform initial cleanup of any stale audio processes
   */
  private performInitialCleanup(): void {
    try {
      console.log('[ProcessSupervisor] Performing initial process cleanup...');
      
      // Find any existing SystemAudioCapture processes
      const processes = this.findAudioProcesses();
      
      if (processes.length === 0) {
        console.log('[ProcessSupervisor] No stale audio processes found');
        return;
      }
      
      console.log(`[ProcessSupervisor] Found ${processes.length} existing audio processes`);
      
      // Terminate all found processes
      for (const process of processes) {
        console.log(`[ProcessSupervisor] Terminating stale process: ${process.pid} (${process.name})`);
        this.terminateProcess(process.pid);
      }
      
      // Wait a moment for cleanup
      setTimeout(() => {
        const remaining = this.findAudioProcesses();
        if (remaining.length === 0) {
          console.log('[ProcessSupervisor] ✅ Initial cleanup completed successfully');
          this.emit('cleanup-completed');
        } else {
          console.warn(`[ProcessSupervisor] ⚠️  ${remaining.length} processes still running after cleanup`);
          this.emit('cleanup-incomplete', remaining);
        }
      }, 1000);
      
    } catch (error) {
      console.error('[ProcessSupervisor] Error during initial cleanup:', error);
      this.emit('cleanup-error', error);
    }
  }

  /**
   * Check for process conflicts and resolve them
   */
  private checkForConflicts(): void {
    try {
      const processes = this.findAudioProcesses();
      
      if (processes.length <= 1) {
        // No conflicts - this is normal
        return;
      }
      
      console.warn(`[ProcessSupervisor] ⚠️  Detected ${processes.length} audio processes running simultaneously!`);
      console.warn('[ProcessSupervisor] This can cause permission conflicts - resolving...');
      
      // Keep only the most recent process (highest PID usually)
      const sortedProcesses = processes.sort((a, b) => b.pid - a.pid);
      const keepProcess = sortedProcesses[0];
      const terminateProcesses = sortedProcesses.slice(1);
      
      console.log(`[ProcessSupervisor] Keeping process: ${keepProcess.pid} (${keepProcess.name})`);
      
      for (const process of terminateProcesses) {
        console.log(`[ProcessSupervisor] Terminating conflicting process: ${process.pid} (${process.name})`);
        this.terminateProcess(process.pid);
      }
      
      // Update our registered process
      this.audioProcessPid = keepProcess.pid;
      this.emit('conflict-resolved', { kept: keepProcess, terminated: terminateProcesses });
      
    } catch (error) {
      console.error('[ProcessSupervisor] Error checking for conflicts:', error);
    }
  }

  /**
   * Find all audio-related processes
   */
  private findAudioProcesses(): Array<{ pid: number; name: string; command: string }> {
    try {
      // Look for processes that might be capturing audio
      const output = execSync('ps aux | grep -E "(SystemAudioCapture|cueme|audio.*capture)" | grep -v grep', { 
        encoding: 'utf8',
        stdio: 'pipe'
      });
      
      const lines = output.split('\n').filter(line => line.trim());
      const processes: Array<{ pid: number; name: string; command: string }> = [];
      
      for (const line of lines) {
        const parts = line.trim().split(/\s+/);
        if (parts.length >= 11) {
          const pid = parseInt(parts[1]);
          const command = parts.slice(10).join(' ');
          
          // Extract process name
          let name = 'unknown';
          if (command.includes('SystemAudioCapture')) {
            name = 'SystemAudioCapture';
          } else if (command.includes('cueme') || command.includes('CueMe')) {
            name = 'CueMe';
          } else if (command.includes('audio') && command.includes('capture')) {
            name = 'AudioCapture';
          }
          
          if (!isNaN(pid) && pid > 0) {
            processes.push({ pid, name, command });
          }
        }
      }
      
      return processes;
      
    } catch (error) {
      // No processes found or command failed
      return [];
    }
  }

  /**
   * Terminate a process gracefully, then forcefully if needed
   */
  private terminateProcess(pid: number): void {
    try {
      // First try graceful termination
      console.log(`[ProcessSupervisor] Sending SIGTERM to process ${pid}...`);
      execSync(`kill -TERM ${pid}`, { stdio: 'pipe' });
      
      // Wait a moment and check if it's still running
      setTimeout(() => {
        try {
          execSync(`kill -0 ${pid}`, { stdio: 'pipe' });
          // Process still running, force kill
          console.log(`[ProcessSupervisor] Process ${pid} still running, sending SIGKILL...`);
          execSync(`kill -KILL ${pid}`, { stdio: 'pipe' });
        } catch {
          // Process is gone (kill -0 failed), which is what we want
          console.log(`[ProcessSupervisor] ✅ Process ${pid} terminated successfully`);
        }
      }, 500);
      
    } catch (error) {
      // Process might already be dead, which is fine
      console.log(`[ProcessSupervisor] Process ${pid} termination completed (may have already exited)`);
    }
  }

  /**
   * Get current status
   */
  public getStatus(): {
    isSupervising: boolean;
    registeredAudioProcess: number | null;
    activeProcesses: Array<{ pid: number; name: string; command: string }>;
  } {
    return {
      isSupervising: this.isSupervising,
      registeredAudioProcess: this.audioProcessPid,
      activeProcesses: this.findAudioProcesses()
    };
  }

  /**
   * Emergency cleanup - terminate all audio processes
   */
  public emergencyCleanup(): void {
    console.log('[ProcessSupervisor] 🚨 Performing emergency cleanup...');
    
    const processes = this.findAudioProcesses();
    
    for (const process of processes) {
      console.log(`[ProcessSupervisor] Emergency terminating: ${process.pid} (${process.name})`);
      this.terminateProcess(process.pid);
    }
    
    this.audioProcessPid = null;
    this.emit('emergency-cleanup-completed', processes);
  }

  /**
   * Cleanup resources
   */
  public destroy(): void {
    this.stopSupervision();
    this.removeAllListeners();
  }
}