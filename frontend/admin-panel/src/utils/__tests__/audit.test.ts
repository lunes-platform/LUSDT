import { describe, it, expect, beforeEach, vi } from 'vitest';
import { auditLogger, AuditAction, logAdminAction, updateAuditResult } from '../audit';

// Mock localStorage
const mockLocalStorage = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};

Object.defineProperty(window, 'localStorage', {
  value: mockLocalStorage,
});

// Mock window.navigator
Object.defineProperty(window, 'navigator', {
  value: {
    userAgent: 'Test User Agent',
  },
});

describe('🔍 Audit System - Security Logging Tests', () => {
  beforeEach(() => {
    // Limpar mocks
    vi.clearAllMocks();
    mockLocalStorage.getItem.mockReturnValue(null);
  });

  describe('auditLogger.log', () => {
    it('should create audit log entry with required fields', () => {
      const actor = '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY';
      const logId = auditLogger.log(
        AuditAction.TOKENS_MINTED,
        actor,
        { amount: '1000000', recipient: '5FZoQhgUCmqBxnkHX7jCqThScS2xQWiwiF61msg63CFL3Y8f' }
      );

      expect(logId).toMatch(/^audit_\d+_[a-z0-9]{9}$/);

      const logs = auditLogger.getLogs();
      expect(logs).toHaveLength(1);

      const entry = logs[0];
      expect(entry.id).toBe(logId);
      expect(entry.action).toBe(AuditAction.TOKENS_MINTED);
      expect(entry.actor).toBe(actor);
      expect(entry.result).toBe('pending');
      expect(entry.details.amount).toBe('1000000');
      expect(entry.timestamp).toBeTypeOf('number');
      expect(entry.userAgent).toBe('Test User Agent');
    });

    it('should include session ID in details', () => {
      const actor = '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY';
      auditLogger.log(AuditAction.WALLET_CONNECTED, actor);

      const logs = auditLogger.getLogs();
      expect(logs[0].details.sessionId).toMatch(/^session_\d+_[a-z0-9]{9}$/);
    });

    it('should handle target parameter', () => {
      const actor = '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY';
      const target = '5FZoQhgUCmqBxnkHX7jCqThScS2xQWiwiF61msg63CFL3Y8f';
      
      auditLogger.log(AuditAction.BRIDGE_ACCOUNT_UPDATED, actor, {}, target);

      const logs = auditLogger.getLogs();
      expect(logs[0].target).toBe(target);
    });
  });

  describe('auditLogger.updateResult', () => {
    it('should update log entry result with success', () => {
      const actor = '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY';
      const logId = auditLogger.log(AuditAction.TOKENS_MINTED, actor);
      const txHash = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';

      auditLogger.updateResult(logId, 'success', txHash);

      const logs = auditLogger.getLogs();
      const entry = logs.find(log => log.id === logId);
      
      expect(entry?.result).toBe('success');
      expect(entry?.txHash).toBe(txHash);
    });

    it('should update log entry result with failure', () => {
      const actor = '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY';
      const logId = auditLogger.log(AuditAction.CONTRACT_PAUSED, actor);
      const error = 'Insufficient permissions';

      auditLogger.updateResult(logId, 'failure', undefined, error);

      const logs = auditLogger.getLogs();
      const entry = logs.find(log => log.id === logId);
      
      expect(entry?.result).toBe('failure');
      expect(entry?.error).toBe(error);
      expect(entry?.txHash).toBeUndefined();
    });

    it('should handle non-existent log ID gracefully', () => {
      expect(() => {
        auditLogger.updateResult('non-existent-id', 'success');
      }).not.toThrow();
    });
  });

  describe('auditLogger.logUnauthorizedAccess', () => {
    it('should log unauthorized access attempt', () => {
      const actor = '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY';
      const logId = auditLogger.logUnauthorizedAccess(
        actor,
        'mint_tokens',
        'bridge_account'
      );

      const logs = auditLogger.getLogs();
      const entry = logs.find(log => log.id === logId);

      expect(entry?.action).toBe(AuditAction.UNAUTHORIZED_ACCESS_ATTEMPT);
      expect(entry?.actor).toBe(actor);
      expect(entry?.details.attemptedAction).toBe('mint_tokens');
      expect(entry?.details.requiredRole).toBe('bridge_account');
      expect(entry?.details.severity).toBe('high');
    });
  });

  describe('auditLogger.logSuspiciousActivity', () => {
    it('should log suspicious activity', () => {
      const actor = '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY';
      const reason = 'Multiple failed transaction attempts';
      const logId = auditLogger.logSuspiciousActivity(actor, reason, {
        attemptCount: 5,
        timeWindow: '5 minutes'
      });

      const logs = auditLogger.getLogs();
      const entry = logs.find(log => log.id === logId);

      expect(entry?.action).toBe(AuditAction.SUSPICIOUS_ACTIVITY);
      expect(entry?.actor).toBe(actor);
      expect(entry?.details.reason).toBe(reason);
      expect(entry?.details.severity).toBe('high');
      expect(entry?.details.attemptCount).toBe(5);
    });
  });

  describe('auditLogger.getLogs', () => {
    beforeEach(() => {
      // Limpar logs existentes
      auditLogger.clearOldLogs(0);
    });

    it('should return all logs without filter', () => {
      const actor = '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY';
      auditLogger.log(AuditAction.WALLET_CONNECTED, actor);
      auditLogger.log(AuditAction.TOKENS_MINTED, actor);

      const logs = auditLogger.getLogs();
      expect(logs).toHaveLength(2);
    });

    it('should filter logs by action', () => {
      const actor = '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY';
      auditLogger.log(AuditAction.WALLET_CONNECTED, actor);
      auditLogger.log(AuditAction.TOKENS_MINTED, actor);
      auditLogger.log(AuditAction.WALLET_CONNECTED, actor);

      const logs = auditLogger.getLogs({ action: AuditAction.WALLET_CONNECTED });
      expect(logs).toHaveLength(2);
      expect(logs.every(log => log.action === AuditAction.WALLET_CONNECTED)).toBe(true);
    });

    it('should filter logs by actor', () => {
      const actor1 = '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY';
      const actor2 = '5FZoQhgUCmqBxnkHX7jCqThScS2xQWiwiF61msg63CFL3Y8f';
      
      auditLogger.log(AuditAction.WALLET_CONNECTED, actor1);
      auditLogger.log(AuditAction.TOKENS_MINTED, actor2);
      auditLogger.log(AuditAction.CONTRACT_PAUSED, actor1);

      const logs = auditLogger.getLogs({ actor: actor1 });
      expect(logs).toHaveLength(2);
      expect(logs.every(log => log.actor === actor1)).toBe(true);
    });

    it('should filter logs by result', () => {
      const actor = '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY';
      const logId1 = auditLogger.log(AuditAction.TOKENS_MINTED, actor);
      const logId2 = auditLogger.log(AuditAction.CONTRACT_PAUSED, actor);
      
      auditLogger.updateResult(logId1, 'success');
      auditLogger.updateResult(logId2, 'failure');

      const successLogs = auditLogger.getLogs({ result: 'success' });
      expect(successLogs).toHaveLength(1);
      expect(successLogs[0].result).toBe('success');

      const failureLogs = auditLogger.getLogs({ result: 'failure' });
      expect(failureLogs).toHaveLength(1);
      expect(failureLogs[0].result).toBe('failure');
    });

    it('should filter logs by time range', () => {
      const actor = '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY';
      const now = Date.now();
      const oneHourAgo = now - (60 * 60 * 1000);
      
      auditLogger.log(AuditAction.WALLET_CONNECTED, actor);
      
      const recentLogs = auditLogger.getLogs({ startTime: oneHourAgo });
      expect(recentLogs).toHaveLength(1);

      const futureLogs = auditLogger.getLogs({ startTime: now + 1000 });
      expect(futureLogs).toHaveLength(0);
    });

    it('should return logs sorted by timestamp (newest first)', () => {
      const actor = '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY';
      
      const logId1 = auditLogger.log(AuditAction.WALLET_CONNECTED, actor);
      
      // Aguardar para garantir timestamps diferentes
      const currentTime = Date.now();
      vi.spyOn(Date, 'now').mockReturnValue(currentTime + 1000);
      
      const logId2 = auditLogger.log(AuditAction.TOKENS_MINTED, actor);

      const logs = auditLogger.getLogs();
      expect(logs[0].id).toBe(logId2); // Newest first
      expect(logs[1].id).toBe(logId1); // Older second
      
      vi.restoreAllMocks();
    });
  });

  describe('auditLogger.getStats', () => {
    beforeEach(() => {
      auditLogger.clearOldLogs(0);
    });

    it('should return correct statistics', () => {
      const actor = '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY';
      
      const logId1 = auditLogger.log(AuditAction.WALLET_CONNECTED, actor);
      const logId2 = auditLogger.log(AuditAction.TOKENS_MINTED, actor);
      const logId3 = auditLogger.log(AuditAction.WALLET_CONNECTED, actor);
      
      auditLogger.updateResult(logId1, 'success');
      auditLogger.updateResult(logId2, 'failure');
      // logId3 remains pending

      const stats = auditLogger.getStats();
      
      expect(stats.total).toBe(3);
      expect(stats.byAction[AuditAction.WALLET_CONNECTED]).toBe(2);
      expect(stats.byAction[AuditAction.TOKENS_MINTED]).toBe(1);
      expect(stats.byResult.success).toBe(1);
      expect(stats.byResult.failure).toBe(1);
      expect(stats.byResult.pending).toBe(1);
      expect(stats.lastActivity).toBeTypeOf('number');
      expect(stats.sessionsToday).toBeGreaterThan(0);
    });
  });

  describe('convenience functions', () => {
    it('should work with logAdminAction', () => {
      const actor = '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY';
      const logId = logAdminAction(AuditAction.BRIDGE_ACCOUNT_UPDATED, actor, { 
        newBridge: '5FZoQhgUCmqBxnkHX7jCqThScS2xQWiwiF61msg63CFL3Y8f' 
      });

      expect(logId).toMatch(/^audit_\d+_[a-z0-9]{9}$/);
      
      const logs = auditLogger.getLogs();
      expect(logs.some(log => log.id === logId)).toBe(true);
    });

    it('should work with updateAuditResult', () => {
      const actor = '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY';
      const logId = logAdminAction(AuditAction.TOKENS_MINTED, actor);
      const txHash = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';

      updateAuditResult(logId, 'success', txHash);

      const logs = auditLogger.getLogs();
      const entry = logs.find(log => log.id === logId);
      
      expect(entry?.result).toBe('success');
      expect(entry?.txHash).toBe(txHash);
    });
  });

  describe('localStorage integration', () => {
    it('should save logs to localStorage', () => {
      const actor = '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY';
      auditLogger.log(AuditAction.WALLET_CONNECTED, actor);

      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'lusdt_audit_logs',
        expect.any(String)
      );
    });

    it('should handle localStorage errors gracefully', () => {
      mockLocalStorage.setItem.mockImplementation(() => {
        throw new Error('localStorage is full');
      });

      const actor = '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY';
      
      expect(() => {
        auditLogger.log(AuditAction.WALLET_CONNECTED, actor);
      }).not.toThrow();
    });
  });
});