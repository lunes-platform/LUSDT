/**
 * Multisig Vault System — Type Definitions
 *
 * Architecture: M-of-N approval bots + on-chain multisig vault.
 * The bridge proposes; bots validate and approve; multisig executes.
 */

// ── Proposal lifecycle ──────────────────────────────────────────────

export type ProposalStatus =
  | 'pending'       // Created, awaiting bot approvals
  | 'approved'      // Quorum reached, ready to execute
  | 'executing'     // Multisig transaction submitted
  | 'executed'      // Confirmed on-chain (finalized)
  | 'rejected'      // A bot explicitly rejected
  | 'expired'       // TTL exceeded without quorum
  | 'failed';       // Execution failed

export interface MultisigProposal {
  id: string;
  bridgeTransactionId: string;
  recipient: string;
  amount: number;
  tokenMint: string;
  createdAt: number;
  expiresAt: number;
  status: ProposalStatus;
  approvals: BotApproval[];
  rejections: BotRejection[];
  requiredApprovals: number;
  totalBots: number;
  executionSignature?: string;
  timelockUntil?: number;      // For high-value: delay before execution
  metadata: Record<string, unknown>;
}

// ── Bot approvals / rejections ──────────────────────────────────────

export type BotRole = 'origin_validator' | 'risk_validator' | 'backup_validator';

export interface BotApproval {
  botId: string;
  botRole: BotRole;
  timestamp: number;
  signature: string;            // HMAC signature of proposal data
  validationDetails: ValidationResult;
}

export interface BotRejection {
  botId: string;
  botRole: BotRole;
  timestamp: number;
  reason: string;
  severity: 'warning' | 'critical';
}

export interface ValidationResult {
  valid: boolean;
  checks: ValidationCheck[];
  riskScore: number;            // 0-100 (0 = safe, 100 = blocked)
}

export interface ValidationCheck {
  name: string;
  passed: boolean;
  detail: string;
}

// ── Circuit breaker ─────────────────────────────────────────────────

export type CircuitState = 'closed' | 'open' | 'half_open';

export interface CircuitBreakerConfig {
  failureThreshold: number;     // Failures before opening
  resetTimeoutMs: number;       // How long to stay open before half-open
  halfOpenMaxAttempts: number;  // Attempts allowed in half-open state
  windowMs: number;             // Rolling window for failure counting
}

export interface CircuitBreakerStatus {
  state: CircuitState;
  failures: number;
  lastFailureAt?: number;
  lastSuccessAt?: number;
  openedAt?: number;
}

// ── HSM / KMS signer abstraction ────────────────────────────────────

export type SignerType = 'local' | 'aws_kms' | 'hashicorp_vault';

export interface SignerConfig {
  type: SignerType;
  // Local (dev only)
  localPrivateKey?: string;
  // AWS KMS
  awsKmsKeyId?: string;
  awsRegion?: string;
  // HashiCorp Vault
  vaultUrl?: string;
  vaultToken?: string;
  vaultKeyPath?: string;
}

export interface ISigner {
  getPublicKey(): Promise<string>;
  sign(message: Uint8Array): Promise<Uint8Array>;
  signTransaction(transaction: unknown): Promise<unknown>;
}

// ── Multisig vault interface ────────────────────────────────────────

export interface IMultisigVault {
  createTransferProposal(
    recipient: string,
    amount: number,
    tokenMint: string,
    metadata: Record<string, unknown>,
  ): Promise<string>; // returns proposal tx id

  approveProposal(proposalId: string, signer: ISigner): Promise<void>;

  executeProposal(proposalId: string): Promise<string>; // returns execution signature

  getProposalStatus(proposalId: string): Promise<{ approved: number; required: number; executed: boolean }>;
}

// ── Spending / risk policy ──────────────────────────────────────────

export interface SpendingPolicy {
  singleTxLimit: number;
  hourlyLimit: number;
  dailyLimit: number;
  highValueThreshold: number;   // Above this → require 3/3 + timelock
  timelockDurationMs: number;   // Delay for high-value txs
  proposalTtlMs: number;        // Time before proposal expires
}

// ── Audit log entry ─────────────────────────────────────────────────

export interface AuditEntry {
  timestamp: number;
  event: string;
  proposalId?: string;
  botId?: string;
  details: Record<string, unknown>;
  severity: 'info' | 'warning' | 'critical';
}
