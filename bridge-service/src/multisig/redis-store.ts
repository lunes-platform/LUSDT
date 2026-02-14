/**
 * Redis Store — Persistência de estado do sistema multisig
 *
 * Persiste:
 *  - Propostas (lifecycle completo)
 *  - Spending counters (diário, horário)
 *  - Circuit breaker state
 *  - Audit log
 *
 * Garante que um restart do serviço NÃO reseta limites de gasto
 * nem perde propostas em andamento.
 */

import Redis from 'ioredis';
import { MultisigProposal, CircuitBreakerStatus, AuditEntry } from './types';
import { logger } from '../utils/logger';

const KEY_PREFIX = 'lusdt:multisig:';

export class RedisStore {
  private redis: Redis;
  private connected: boolean = false;

  constructor(redisUrl: string = 'redis://localhost:6379') {
    this.redis = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
      retryStrategy: (times: number) => {
        if (times > 5) return null; // Stop retrying
        return Math.min(times * 200, 2000);
      },
      lazyConnect: true,
    });

    this.redis.on('connect', () => {
      this.connected = true;
      logger.info('🔴 Redis connected (multisig store)');
    });

    this.redis.on('error', (err) => {
      logger.error('🔴 Redis error', { error: err.message });
    });

    this.redis.on('close', () => {
      this.connected = false;
      logger.warn('🔴 Redis disconnected');
    });
  }

  async connect(): Promise<void> {
    try {
      await this.redis.connect();
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      logger.error('🔴 Redis connection failed', { error: msg });
      // Non-fatal: system works with in-memory fallback
    }
  }

  async disconnect(): Promise<void> {
    await this.redis.quit();
  }

  isConnected(): boolean {
    return this.connected;
  }

  // ── Proposals ─────────────────────────────────────────────────────

  async saveProposal(proposal: MultisigProposal): Promise<void> {
    if (!this.connected) return;
    try {
      const key = `${KEY_PREFIX}proposal:${proposal.id}`;
      await this.redis.set(key, JSON.stringify(proposal), 'EX', 86400 * 3); // 3 days TTL

      // Index by status
      await this.redis.sadd(`${KEY_PREFIX}proposals:${proposal.status}`, proposal.id);

      // Index by bridge tx
      await this.redis.set(
        `${KEY_PREFIX}bridge_tx:${proposal.bridgeTransactionId}`,
        proposal.id,
        'EX', 86400 * 3,
      );
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      logger.error('Redis saveProposal failed', { proposalId: proposal.id, error: msg });
    }
  }

  async getProposal(proposalId: string): Promise<MultisigProposal | null> {
    if (!this.connected) return null;
    try {
      const data = await this.redis.get(`${KEY_PREFIX}proposal:${proposalId}`);
      return data ? JSON.parse(data) : null;
    } catch {
      return null;
    }
  }

  async getProposalByBridgeTx(bridgeTxId: string): Promise<MultisigProposal | null> {
    if (!this.connected) return null;
    try {
      const proposalId = await this.redis.get(`${KEY_PREFIX}bridge_tx:${bridgeTxId}`);
      if (!proposalId) return null;
      return this.getProposal(proposalId);
    } catch {
      return null;
    }
  }

  async updateProposalStatus(proposalId: string, oldStatus: string, newStatus: string): Promise<void> {
    if (!this.connected) return;
    try {
      await this.redis.srem(`${KEY_PREFIX}proposals:${oldStatus}`, proposalId);
      await this.redis.sadd(`${KEY_PREFIX}proposals:${newStatus}`, proposalId);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      logger.error('Redis updateProposalStatus failed', { proposalId, error: msg });
    }
  }

  async getProposalsByStatus(status: string): Promise<string[]> {
    if (!this.connected) return [];
    try {
      return await this.redis.smembers(`${KEY_PREFIX}proposals:${status}`);
    } catch {
      return [];
    }
  }

  // ── Spending Counters ─────────────────────────────────────────────

  async incrementSpending(amount: number): Promise<void> {
    if (!this.connected) return;
    try {
      const hourlyKey = `${KEY_PREFIX}spending:hourly`;
      const dailyKey = `${KEY_PREFIX}spending:daily`;

      const pipeline = this.redis.pipeline();
      pipeline.incrbyfloat(hourlyKey, amount);
      pipeline.expire(hourlyKey, 3600);      // 1h TTL — auto-reset
      pipeline.incrbyfloat(dailyKey, amount);
      pipeline.expire(dailyKey, 86400);      // 24h TTL — auto-reset
      await pipeline.exec();
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      logger.error('Redis incrementSpending failed', { error: msg });
    }
  }

  async getSpending(): Promise<{ hourly: number; daily: number }> {
    if (!this.connected) return { hourly: 0, daily: 0 };
    try {
      const [hourly, daily] = await Promise.all([
        this.redis.get(`${KEY_PREFIX}spending:hourly`),
        this.redis.get(`${KEY_PREFIX}spending:daily`),
      ]);
      return {
        hourly: parseFloat(hourly || '0'),
        daily: parseFloat(daily || '0'),
      };
    } catch {
      return { hourly: 0, daily: 0 };
    }
  }

  // ── Recipient Volume Tracking ─────────────────────────────────────

  async trackRecipientVolume(recipient: string, amount: number): Promise<void> {
    if (!this.connected) return;
    try {
      const key = `${KEY_PREFIX}recipient:${recipient}:daily`;
      await this.redis.incrbyfloat(key, amount);
      await this.redis.expire(key, 86400);

      const countKey = `${KEY_PREFIX}recipient:${recipient}:count`;
      await this.redis.incr(countKey);
      await this.redis.expire(countKey, 86400);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      logger.error('Redis trackRecipientVolume failed', { error: msg });
    }
  }

  async getRecipientVolume(recipient: string): Promise<{ totalSent: number; txCount: number }> {
    if (!this.connected) return { totalSent: 0, txCount: 0 };
    try {
      const [total, count] = await Promise.all([
        this.redis.get(`${KEY_PREFIX}recipient:${recipient}:daily`),
        this.redis.get(`${KEY_PREFIX}recipient:${recipient}:count`),
      ]);
      return {
        totalSent: parseFloat(total || '0'),
        txCount: parseInt(count || '0', 10),
      };
    } catch {
      return { totalSent: 0, txCount: 0 };
    }
  }

  // ── Circuit Breaker State ─────────────────────────────────────────

  async saveCircuitBreakerState(status: CircuitBreakerStatus): Promise<void> {
    if (!this.connected) return;
    try {
      await this.redis.set(
        `${KEY_PREFIX}circuit_breaker`,
        JSON.stringify(status),
        'EX', 86400,
      );
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      logger.error('Redis saveCircuitBreakerState failed', { error: msg });
    }
  }

  async getCircuitBreakerState(): Promise<CircuitBreakerStatus | null> {
    if (!this.connected) return null;
    try {
      const data = await this.redis.get(`${KEY_PREFIX}circuit_breaker`);
      return data ? JSON.parse(data) : null;
    } catch {
      return null;
    }
  }

  // ── Proposal Count (for velocity checks) ──────────────────────────

  async incrementProposalCount(): Promise<void> {
    if (!this.connected) return;
    try {
      const key = `${KEY_PREFIX}proposal_count:hourly`;
      await this.redis.incr(key);
      await this.redis.expire(key, 3600);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      logger.error('Redis incrementProposalCount failed', { error: msg });
    }
  }

  async getProposalCount(): Promise<number> {
    if (!this.connected) return 0;
    try {
      const count = await this.redis.get(`${KEY_PREFIX}proposal_count:hourly`);
      return parseInt(count || '0', 10);
    } catch {
      return 0;
    }
  }

  // ── Audit Log ─────────────────────────────────────────────────────

  async appendAuditEntry(entry: AuditEntry): Promise<void> {
    if (!this.connected) return;
    try {
      const key = `${KEY_PREFIX}audit_log`;
      await this.redis.lpush(key, JSON.stringify(entry));
      await this.redis.ltrim(key, 0, 999); // Keep last 1000 entries
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      logger.error('Redis appendAuditEntry failed', { error: msg });
    }
  }

  async getAuditLog(limit: number = 100): Promise<AuditEntry[]> {
    if (!this.connected) return [];
    try {
      const entries = await this.redis.lrange(`${KEY_PREFIX}audit_log`, 0, limit - 1);
      return entries.map(e => JSON.parse(e));
    } catch {
      return [];
    }
  }

  // ── Health ────────────────────────────────────────────────────────

  async ping(): Promise<boolean> {
    try {
      const result = await this.redis.ping();
      return result === 'PONG';
    } catch {
      return false;
    }
  }
}
