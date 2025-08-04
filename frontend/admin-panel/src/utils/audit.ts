/**
 * Sistema de auditoria e logging para ações administrativas
 */

export interface AuditLogEntry {
  id: string;
  timestamp: number;
  action: string;
  actor: string; // Endereço da conta
  target?: string; // Endereço ou ID do alvo da ação
  details: Record<string, any>;
  result: 'success' | 'failure' | 'pending';
  txHash?: string;
  error?: string;
  networkId?: string;
  ipAddress?: string; // Se disponível
  userAgent?: string;
}

export enum AuditAction {
  // Conexão
  WALLET_CONNECTED = 'wallet_connected',
  WALLET_DISCONNECTED = 'wallet_disconnected',
  NETWORK_CHANGED = 'network_changed',
  
  // Token Management
  BRIDGE_ACCOUNT_UPDATED = 'bridge_account_updated',
  TAX_MANAGER_UPDATED = 'tax_manager_updated',
  EMERGENCY_ADMIN_UPDATED = 'emergency_admin_updated',
  TOKENS_MINTED = 'tokens_minted',
  CONTRACT_PAUSED = 'contract_paused',
  CONTRACT_UNPAUSED = 'contract_unpaused',
  
  // Tax Manager
  LUNES_PRICE_UPDATED = 'lunes_price_updated',
  DISTRIBUTION_WALLETS_UPDATED = 'distribution_wallets_updated',
  FEE_CONFIG_UPDATED = 'fee_config_updated',
  
  // Security
  UNAUTHORIZED_ACCESS_ATTEMPT = 'unauthorized_access_attempt',
  INVALID_TRANSACTION = 'invalid_transaction',
  SUSPICIOUS_ACTIVITY = 'suspicious_activity'
}

class AuditLogger {
  private logs: AuditLogEntry[] = [];
  private maxLogs = 1000; // Manter apenas os últimos 1000 logs
  private sessionId: string;

  constructor() {
    this.sessionId = this.generateSessionId();
    this.loadLogs();
  }

  /**
   * Registra uma ação administrativa
   */
  log(
    action: AuditAction,
    actor: string,
    details: Record<string, any> = {},
    target?: string
  ): string {
    const entry: AuditLogEntry = {
      id: this.generateId(),
      timestamp: Date.now(),
      action,
      actor,
      target,
      details: {
        ...details,
        sessionId: this.sessionId
      },
      result: 'pending',
      networkId: this.getCurrentNetwork(),
      userAgent: this.getUserAgent()
    };

    this.logs.push(entry);
    this.trimLogs();
    this.saveLogs();
    
    // Log no console para desenvolvimento
    console.log('🔍 Audit Log:', entry);

    return entry.id;
  }

  /**
   * Atualiza o resultado de uma ação
   */
  updateResult(
    logId: string, 
    result: 'success' | 'failure', 
    txHash?: string, 
    error?: string
  ): void {
    const entry = this.logs.find(log => log.id === logId);
    if (entry) {
      entry.result = result;
      if (txHash) entry.txHash = txHash;
      if (error) entry.error = error;
      this.saveLogs();
      
      // Log resultado no console
      const emoji = result === 'success' ? '✅' : '❌';
      console.log(`${emoji} Audit Update:`, { logId, result, txHash, error });
    }
  }

  /**
   * Registra tentativa de acesso não autorizado
   */
  logUnauthorizedAccess(
    actor: string,
    attemptedAction: string,
    requiredRole: string
  ): string {
    return this.log(
      AuditAction.UNAUTHORIZED_ACCESS_ATTEMPT,
      actor,
      {
        attemptedAction,
        requiredRole,
        severity: 'high'
      }
    );
  }

  /**
   * Registra atividade suspeita
   */
  logSuspiciousActivity(
    actor: string,
    reason: string,
    details: Record<string, any> = {}
  ): string {
    return this.log(
      AuditAction.SUSPICIOUS_ACTIVITY,
      actor,
      {
        reason,
        severity: 'high',
        ...details
      }
    );
  }

  /**
   * Obtém logs filtrados
   */
  getLogs(filter?: {
    action?: AuditAction;
    actor?: string;
    startTime?: number;
    endTime?: number;
    result?: 'success' | 'failure' | 'pending';
  }): AuditLogEntry[] {
    let filteredLogs = [...this.logs];

    if (filter) {
      if (filter.action) {
        filteredLogs = filteredLogs.filter(log => log.action === filter.action);
      }
      if (filter.actor) {
        filteredLogs = filteredLogs.filter(log => log.actor === filter.actor);
      }
      if (filter.startTime) {
        filteredLogs = filteredLogs.filter(log => log.timestamp >= filter.startTime!);
      }
      if (filter.endTime) {
        filteredLogs = filteredLogs.filter(log => log.timestamp <= filter.endTime!);
      }
      if (filter.result) {
        filteredLogs = filteredLogs.filter(log => log.result === filter.result);
      }
    }

    return filteredLogs.sort((a, b) => b.timestamp - a.timestamp);
  }

  /**
   * Exporta logs para JSON
   */
  exportLogs(): string {
    return JSON.stringify(this.logs, null, 2);
  }

  /**
   * Limpa logs antigos
   */
  clearOldLogs(olderThanDays: number = 30): void {
    const cutoffTime = Date.now() - (olderThanDays * 24 * 60 * 60 * 1000);
    this.logs = this.logs.filter(log => log.timestamp > cutoffTime);
    this.saveLogs();
  }

  /**
   * Obtém estatísticas dos logs
   */
  getStats(): {
    total: number;
    byAction: Record<string, number>;
    byResult: Record<string, number>;
    lastActivity: number;
    sessionsToday: number;
  } {
    const byAction: Record<string, number> = {};
    const byResult: Record<string, number> = {};
    let lastActivity = 0;

    this.logs.forEach(log => {
      byAction[log.action] = (byAction[log.action] || 0) + 1;
      byResult[log.result] = (byResult[log.result] || 0) + 1;
      if (log.timestamp > lastActivity) {
        lastActivity = log.timestamp;
      }
    });

    // Contar sessões únicas hoje
    const today = new Date().setHours(0, 0, 0, 0);
    const todayLogs = this.logs.filter(log => log.timestamp >= today);
    const uniqueSessions = new Set(
      todayLogs.map(log => log.details.sessionId)
    ).size;

    return {
      total: this.logs.length,
      byAction,
      byResult,
      lastActivity,
      sessionsToday: uniqueSessions
    };
  }

  private generateId(): string {
    return 'audit_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  private generateSessionId(): string {
    return 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  private getCurrentNetwork(): string {
    // Tentar obter da variável de ambiente ou localStorage
    return import.meta.env.VITE_NETWORK_NAME || 'unknown';
  }

  private getUserAgent(): string {
    return typeof window !== 'undefined' ? window.navigator.userAgent : 'unknown';
  }

  private trimLogs(): void {
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs);
    }
  }

  private saveLogs(): void {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        // Salvar apenas logs dos últimos 7 dias para não ocupar muito espaço
        const weekAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
        const recentLogs = this.logs.filter(log => log.timestamp > weekAgo);
        localStorage.setItem('lusdt_audit_logs', JSON.stringify(recentLogs));
      }
    } catch (error) {
      console.warn('Falha ao salvar logs de auditoria:', error);
    }
  }

  private loadLogs(): void {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const saved = localStorage.getItem('lusdt_audit_logs');
        if (saved) {
          this.logs = JSON.parse(saved);
        }
      }
    } catch (error) {
      console.warn('Falha ao carregar logs de auditoria:', error);
      this.logs = [];
    }
  }
}

// Singleton instance
export const auditLogger = new AuditLogger();

// Funções de conveniência
export function logAdminAction(
  action: AuditAction,
  actor: string,
  details?: Record<string, any>,
  target?: string
): string {
  return auditLogger.log(action, actor, details, target);
}

export function updateAuditResult(
  logId: string,
  result: 'success' | 'failure',
  txHash?: string,
  error?: string
): void {
  auditLogger.updateResult(logId, result, txHash, error);
}

export function getAuditLogs(filter?: Parameters<typeof auditLogger.getLogs>[0]): AuditLogEntry[] {
  return auditLogger.getLogs(filter);
}

export function exportAuditLogs(): string {
  return auditLogger.exportLogs();
}