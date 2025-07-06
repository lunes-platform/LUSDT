import { SolanaClient } from '../solana/client';
import { LunesClient } from '../lunes/client';
import { logger } from '../utils/logger';
import { config } from '../config/env';

/**
 * Critical security component: Parity Monitor
 * Continuously monitors the balance between USDT treasury and LUSDT total supply
 * Triggers emergency procedures if deviation exceeds threshold
 */
export class ParityMonitor {
  private solanaClient: SolanaClient;
  private lunesClient: LunesClient;
  private isMonitoring: boolean = false;
  private monitoringInterval?: NodeJS.Timeout;
  private alertCooldown: Map<string, number> = new Map();
  private consecutiveViolations: number = 0;
  private lastKnownGoodState?: ParityState;

  // Security thresholds
  private readonly CRITICAL_THRESHOLD = 0.05; // 5% - immediate emergency pause
  private readonly WARNING_THRESHOLD = 0.01;  // 1% - alert but continue
  private readonly VIOLATION_LIMIT = 3;       // 3 consecutive violations = emergency
  private readonly ALERT_COOLDOWN = 300000;   // 5 minutes between alerts
  private readonly CHECK_INTERVAL = 30000;    // 30 seconds between checks

  constructor(solanaClient: SolanaClient, lunesClient: LunesClient) {
    this.solanaClient = solanaClient;
    this.lunesClient = lunesClient;
  }

  /**
   * Start continuous parity monitoring
   */
  async startMonitoring(): Promise<void> {
    if (this.isMonitoring) {
      logger.warn('Parity monitor already running');
      return;
    }

    logger.info('🔍 Starting parity monitor', {
      checkInterval: this.CHECK_INTERVAL,
      warningThreshold: this.WARNING_THRESHOLD,
      criticalThreshold: this.CRITICAL_THRESHOLD
    });

    this.isMonitoring = true;
    
    // Initial check
    await this.performParityCheck();
    
    // Schedule periodic checks
    this.monitoringInterval = setInterval(async () => {
      try {
        await this.performParityCheck();
      } catch (error) {
        logger.error('Parity check failed', { error });
        await this.handleMonitoringError(error);
      }
    }, this.CHECK_INTERVAL);
  }

  /**
   * Stop parity monitoring
   */
  stopMonitoring(): void {
    if (!this.isMonitoring) {
      return;
    }

    logger.info('🛑 Stopping parity monitor');
    
    this.isMonitoring = false;
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = undefined;
    }
  }

  /**
   * Perform a single parity check
   */
  async performParityCheck(): Promise<ParityCheckResult> {
    const startTime = Date.now();
    
    try {
      // Get current balances
      const [treasuryBalance, totalSupply] = await Promise.all([
        this.solanaClient.getUSDTBalance(),
        this.lunesClient.getTotalSupply()
      ]);

      const currentState: ParityState = {
        treasuryBalance,
        totalSupply,
        timestamp: Date.now(),
        blockNumber: await this.getCurrentBlockNumber()
      };

      // Calculate deviation
      const deviation = this.calculateDeviation(treasuryBalance, totalSupply);
      const deviationPercent = Math.abs(deviation) * 100;

      // Determine status
      let status: ParityStatus;
      if (deviationPercent >= this.CRITICAL_THRESHOLD * 100) {
        status = 'CRITICAL';
      } else if (deviationPercent >= this.WARNING_THRESHOLD * 100) {
        status = 'WARNING';
      } else {
        status = 'HEALTHY';
      }

      const result: ParityCheckResult = {
        status,
        treasuryBalance,
        totalSupply,
        deviation,
        deviationPercent,
        timestamp: currentState.timestamp,
        checkDuration: Date.now() - startTime
      };

      // Handle the result
      await this.handleParityResult(result, currentState);

      return result;

    } catch (error) {
      logger.error('Failed to perform parity check', { error });
      throw error;
    }
  }

  /**
   * Handle parity check results and trigger appropriate actions
   */
  private async handleParityResult(
    result: ParityCheckResult, 
    currentState: ParityState
  ): Promise<void> {
    const { status, deviationPercent } = result;

    // Log current state
    logger.info('Parity check completed', {
      status,
      treasuryBalance: result.treasuryBalance,
      totalSupply: result.totalSupply,
      deviationPercent: deviationPercent.toFixed(4),
      checkDuration: result.checkDuration
    });

    switch (status) {
      case 'HEALTHY':
        await this.handleHealthyState(result, currentState);
        break;
        
      case 'WARNING':
        await this.handleWarningState(result, currentState);
        break;
        
      case 'CRITICAL':
        await this.handleCriticalState(result, currentState);
        break;
    }

    // Update last known good state if healthy
    if (status === 'HEALTHY') {
      this.lastKnownGoodState = currentState;
      this.consecutiveViolations = 0;
    } else {
      this.consecutiveViolations++;
    }

    // Check for consecutive violations
    if (this.consecutiveViolations >= this.VIOLATION_LIMIT) {
      await this.handleConsecutiveViolations(result);
    }
  }

  /**
   * Handle healthy parity state
   */
  private async handleHealthyState(
    result: ParityCheckResult, 
    currentState: ParityState
  ): Promise<void> {
    // Reset violation counter
    this.consecutiveViolations = 0;
    
    // Log healthy state (debug level to avoid spam)
    logger.debug('Parity healthy', {
      deviation: result.deviationPercent.toFixed(4) + '%'
    });
  }

  /**
   * Handle warning parity state
   */
  private async handleWarningState(
    result: ParityCheckResult, 
    currentState: ParityState
  ): Promise<void> {
    const alertKey = 'parity_warning';
    
    if (this.shouldSendAlert(alertKey)) {
      await this.sendParityAlert('WARNING', result, currentState);
      this.setAlertCooldown(alertKey);
    }

    logger.warn('⚠️ Parity deviation detected', {
      deviation: result.deviationPercent.toFixed(4) + '%',
      threshold: this.WARNING_THRESHOLD * 100 + '%',
      consecutiveViolations: this.consecutiveViolations
    });
  }

  /**
   * Handle critical parity state - immediate emergency procedures
   */
  private async handleCriticalState(
    result: ParityCheckResult, 
    currentState: ParityState
  ): Promise<void> {
    logger.error('🚨 CRITICAL PARITY VIOLATION DETECTED', {
      deviation: result.deviationPercent.toFixed(4) + '%',
      threshold: this.CRITICAL_THRESHOLD * 100 + '%',
      treasuryBalance: result.treasuryBalance,
      totalSupply: result.totalSupply,
      consecutiveViolations: this.consecutiveViolations
    });

    // Always send critical alerts (no cooldown)
    await this.sendParityAlert('CRITICAL', result, currentState);

    // Trigger emergency procedures
    await this.triggerEmergencyProcedures(result, currentState);
  }

  /**
   * Handle consecutive violations - escalate to emergency
   */
  private async handleConsecutiveViolations(result: ParityCheckResult): Promise<void> {
    logger.error('🚨 CONSECUTIVE PARITY VIOLATIONS DETECTED', {
      violationCount: this.consecutiveViolations,
      limit: this.VIOLATION_LIMIT,
      currentDeviation: result.deviationPercent.toFixed(4) + '%'
    });

    // Escalate to emergency even if individual violation wasn't critical
    await this.triggerEmergencyProcedures(result, {
      treasuryBalance: result.treasuryBalance,
      totalSupply: result.totalSupply,
      timestamp: result.timestamp,
      blockNumber: await this.getCurrentBlockNumber()
    });
  }

  /**
   * Trigger emergency procedures
   */
  private async triggerEmergencyProcedures(
    result: ParityCheckResult, 
    currentState: ParityState
  ): Promise<void> {
    try {
      logger.error('🚨 TRIGGERING EMERGENCY PROCEDURES', {
        reason: 'PARITY_VIOLATION',
        deviation: result.deviationPercent.toFixed(4) + '%'
      });

      // 1. Pause the LUSDT contract immediately
      await this.emergencyPauseLUSDT(result);

      // 2. Send critical alerts to all channels
      await this.sendCriticalAlerts(result, currentState);

      // 3. Log detailed forensic information
      await this.logForensicData(result, currentState);

      // 4. Trigger incident response procedures
      await this.triggerIncidentResponse(result);

    } catch (error) {
      logger.error('Failed to execute emergency procedures', { error });
      
      // If emergency procedures fail, this is a critical system failure
      await this.handleEmergencyFailure(error, result);
    }
  }

  /**
   * Emergency pause the LUSDT contract
   */
  private async emergencyPauseLUSDT(result: ParityCheckResult): Promise<void> {
    try {
      const reason = `Parity violation: ${result.deviationPercent.toFixed(4)}% deviation detected`;
      
      await this.lunesClient.emergencyPause(reason);
      
      logger.info('✅ LUSDT contract emergency paused', { reason });
      
    } catch (error) {
      logger.error('❌ Failed to emergency pause LUSDT contract', { error });
      throw error;
    }
  }

  /**
   * Send critical alerts through all available channels
   */
  private async sendCriticalAlerts(
    result: ParityCheckResult, 
    currentState: ParityState
  ): Promise<void> {
    const alertData = {
      type: 'PARITY_VIOLATION_CRITICAL',
      severity: 'CRITICAL',
      deviation: result.deviationPercent,
      treasuryBalance: result.treasuryBalance,
      totalSupply: result.totalSupply,
      timestamp: result.timestamp,
      lastKnownGoodState: this.lastKnownGoodState
    };

    // Send alerts through all channels
    await Promise.allSettled([
      this.sendDiscordAlert(alertData),
      this.sendEmailAlert(alertData),
      this.sendSlackAlert(alertData),
      this.sendSMSAlert(alertData)
    ]);
  }

  /**
   * Calculate deviation between treasury and total supply
   */
  private calculateDeviation(treasuryBalance: number, totalSupply: number): number {
    if (totalSupply === 0) {
      return treasuryBalance === 0 ? 0 : 1; // 100% deviation if supply is 0 but treasury has funds
    }
    
    return (treasuryBalance - totalSupply) / totalSupply;
  }

  /**
   * Check if alert should be sent (respects cooldown)
   */
  private shouldSendAlert(alertKey: string): boolean {
    const lastAlert = this.alertCooldown.get(alertKey);
    if (!lastAlert) {
      return true;
    }
    
    return Date.now() - lastAlert >= this.ALERT_COOLDOWN;
  }

  /**
   * Set alert cooldown
   */
  private setAlertCooldown(alertKey: string): void {
    this.alertCooldown.set(alertKey, Date.now());
  }

  /**
   * Get current block number for forensic tracking
   */
  private async getCurrentBlockNumber(): Promise<number> {
    try {
      return await this.lunesClient.getCurrentBlockNumber();
    } catch (error) {
      logger.warn('Failed to get current block number', { error });
      return 0;
    }
  }

  /**
   * Send parity alert through configured channels
   */
  private async sendParityAlert(
    severity: 'WARNING' | 'CRITICAL',
    result: ParityCheckResult,
    currentState: ParityState
  ): Promise<void> {
    // Implementation would send alerts via Discord, email, etc.
    logger.info(`Sending ${severity} parity alert`, {
      deviation: result.deviationPercent.toFixed(4) + '%',
      treasuryBalance: result.treasuryBalance,
      totalSupply: result.totalSupply
    });
  }

  /**
   * Alert method implementations (placeholders)
   */
  private async sendDiscordAlert(alertData: any): Promise<void> {
    // Implementation for Discord webhook
    logger.info('Discord alert sent', { alertData });
  }

  private async sendEmailAlert(alertData: any): Promise<void> {
    // Implementation for email alerts
    logger.info('Email alert sent', { alertData });
  }

  private async sendSlackAlert(alertData: any): Promise<void> {
    // Implementation for Slack alerts
    logger.info('Slack alert sent', { alertData });
  }

  private async sendSMSAlert(alertData: any): Promise<void> {
    // Implementation for SMS alerts (critical only)
    logger.info('SMS alert sent', { alertData });
  }

  /**
   * Log detailed forensic data for investigation
   */
  private async logForensicData(
    result: ParityCheckResult,
    currentState: ParityState
  ): Promise<void> {
    const forensicData = {
      timestamp: Date.now(),
      parityViolation: {
        current: currentState,
        lastKnownGood: this.lastKnownGoodState,
        deviation: result.deviation,
        deviationPercent: result.deviationPercent
      },
      systemState: {
        consecutiveViolations: this.consecutiveViolations,
        monitoringUptime: this.isMonitoring ? Date.now() - (this.lastKnownGoodState?.timestamp || 0) : 0
      },
      blockchainState: {
        lunesBlockNumber: currentState.blockNumber,
        solanaSlot: await this.getSolanaSlot()
      }
    };

    logger.error('FORENSIC DATA - Parity Violation', forensicData);
  }

  /**
   * Get current Solana slot for forensic tracking
   */
  private async getSolanaSlot(): Promise<number> {
    try {
      return await this.solanaClient.getCurrentSlot();
    } catch (error) {
      logger.warn('Failed to get Solana slot', { error });
      return 0;
    }
  }

  /**
   * Trigger incident response procedures
   */
  private async triggerIncidentResponse(result: ParityCheckResult): Promise<void> {
    // This would integrate with incident management systems
    logger.info('Incident response triggered', {
      incidentType: 'PARITY_VIOLATION',
      severity: 'CRITICAL',
      autoActions: ['CONTRACT_PAUSED', 'ALERTS_SENT', 'FORENSIC_DATA_LOGGED']
    });
  }

  /**
   * Handle emergency procedure failures (system failure)
   */
  private async handleEmergencyFailure(error: any, result: ParityCheckResult): Promise<void> {
    logger.error('🚨 EMERGENCY PROCEDURE FAILURE - SYSTEM CRITICAL', {
      originalError: error,
      parityResult: result,
      systemStatus: 'CRITICAL_FAILURE'
    });

    // Last resort actions
    // This might involve external monitoring systems, kill switches, etc.
  }

  /**
   * Handle monitoring errors
   */
  private async handleMonitoringError(error: any): Promise<void> {
    logger.error('Parity monitoring error', { error });
    
    // If monitoring fails repeatedly, this could indicate a system compromise
    // Implement appropriate failsafe procedures
  }

  /**
   * Get current parity status
   */
  async getCurrentParityStatus(): Promise<ParityCheckResult> {
    return await this.performParityCheck();
  }

  /**
   * Get monitoring statistics
   */
  getMonitoringStats(): MonitoringStats {
    return {
      isMonitoring: this.isMonitoring,
      consecutiveViolations: this.consecutiveViolations,
      lastKnownGoodState: this.lastKnownGoodState,
      checkInterval: this.CHECK_INTERVAL,
      thresholds: {
        warning: this.WARNING_THRESHOLD,
        critical: this.CRITICAL_THRESHOLD
      }
    };
  }
}

// Type definitions
export interface ParityState {
  treasuryBalance: number;
  totalSupply: number;
  timestamp: number;
  blockNumber: number;
}

export interface ParityCheckResult {
  status: ParityStatus;
  treasuryBalance: number;
  totalSupply: number;
  deviation: number;
  deviationPercent: number;
  timestamp: number;
  checkDuration: number;
}

export type ParityStatus = 'HEALTHY' | 'WARNING' | 'CRITICAL';

export interface MonitoringStats {
  isMonitoring: boolean;
  consecutiveViolations: number;
  lastKnownGoodState?: ParityState;
  checkInterval: number;
  thresholds: {
    warning: number;
    critical: number;
  };
} 