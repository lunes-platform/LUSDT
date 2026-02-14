/**
 * Circuit Breaker — Pausa automática de transferências
 *
 * Estados:
 *  - closed:    tudo OK, transferências permitidas
 *  - open:      muitas falhas, tudo bloqueado
 *  - half_open: tentando recovery (poucos attempts permitidos)
 *
 * Fail-safe: se aberto, NENHUMA proposta é executada até reset.
 */

import { CircuitBreakerConfig, CircuitBreakerStatus, CircuitState, AuditEntry } from './types';
import { logger } from '../utils/logger';

const DEFAULT_CONFIG: CircuitBreakerConfig = {
  failureThreshold: 5,
  resetTimeoutMs: 300_000,      // 5 min
  halfOpenMaxAttempts: 2,
  windowMs: 600_000,            // 10 min rolling window
};

export class CircuitBreaker {
  private state: CircuitState = 'closed';
  private failures: number = 0;
  private successes: number = 0;
  private halfOpenAttempts: number = 0;
  private lastFailureAt?: number;
  private lastSuccessAt?: number;
  private openedAt?: number;
  private failureTimestamps: number[] = [];
  private config: CircuitBreakerConfig;
  private auditLog: AuditEntry[] = [];

  constructor(config?: Partial<CircuitBreakerConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Verifica se transferências são permitidas.
   * Retorna true se pode prosseguir, false se bloqueado.
   */
  canExecute(): boolean {
    this.cleanOldFailures();

    switch (this.state) {
      case 'closed':
        return true;

      case 'open': {
        const now = Date.now();
        if (this.openedAt && now - this.openedAt >= this.config.resetTimeoutMs) {
          this.transitionTo('half_open');
          return true;
        }
        return false;
      }

      case 'half_open':
        return this.halfOpenAttempts < this.config.halfOpenMaxAttempts;

      default:
        return false;
    }
  }

  /**
   * Registra sucesso — ajuda a fechar o circuito.
   */
  recordSuccess(): void {
    this.successes++;
    this.lastSuccessAt = Date.now();

    if (this.state === 'half_open') {
      this.transitionTo('closed');
      this.failures = 0;
      this.halfOpenAttempts = 0;
      this.failureTimestamps = [];
      this.log('info', 'circuit_breaker_closed', 'Circuit breaker recovered — now closed');
    }
  }

  /**
   * Registra falha — pode abrir o circuito.
   */
  recordFailure(reason: string): void {
    const now = Date.now();
    this.failures++;
    this.lastFailureAt = now;
    this.failureTimestamps.push(now);
    this.cleanOldFailures();

    if (this.state === 'half_open') {
      this.transitionTo('open');
      this.log('critical', 'circuit_breaker_reopened', `Re-opened after half_open failure: ${reason}`);
      return;
    }

    if (this.state === 'closed' && this.failureTimestamps.length >= this.config.failureThreshold) {
      this.transitionTo('open');
      this.log('critical', 'circuit_breaker_opened', `Opened after ${this.config.failureThreshold} failures in window. Last: ${reason}`);
    }
  }

  /**
   * Reset manual — para operadores (admin endpoint).
   */
  forceReset(): void {
    this.transitionTo('closed');
    this.failures = 0;
    this.halfOpenAttempts = 0;
    this.failureTimestamps = [];
    this.log('warning', 'circuit_breaker_force_reset', 'Circuit breaker force-reset by operator');
  }

  /**
   * Status atual do circuito.
   */
  getStatus(): CircuitBreakerStatus {
    return {
      state: this.state,
      failures: this.failureTimestamps.length,
      lastFailureAt: this.lastFailureAt,
      lastSuccessAt: this.lastSuccessAt,
      openedAt: this.openedAt,
    };
  }

  /**
   * Retorna o audit log (últimas N entradas).
   */
  getAuditLog(limit: number = 50): AuditEntry[] {
    return this.auditLog.slice(-limit);
  }

  // ── Internal ────────────────────────────────────────────────────

  private transitionTo(newState: CircuitState): void {
    const oldState = this.state;
    this.state = newState;

    if (newState === 'open') {
      this.openedAt = Date.now();
    }
    if (newState === 'half_open') {
      this.halfOpenAttempts = 0;
    }

    logger.warn(`🔌 Circuit breaker: ${oldState} → ${newState}`);
  }

  private cleanOldFailures(): void {
    const cutoff = Date.now() - this.config.windowMs;
    this.failureTimestamps = this.failureTimestamps.filter(ts => ts > cutoff);
  }

  private log(severity: AuditEntry['severity'], event: string, details: string): void {
    const entry: AuditEntry = {
      timestamp: Date.now(),
      event,
      details: { message: details, state: this.state, failures: this.failureTimestamps.length },
      severity,
    };
    this.auditLog.push(entry);

    if (this.auditLog.length > 500) {
      this.auditLog = this.auditLog.slice(-250);
    }

    if (severity === 'critical') {
      logger.error(`🚨 [CircuitBreaker] ${details}`);
    } else {
      logger.info(`🔌 [CircuitBreaker] ${details}`);
    }
  }
}
