import { PublicKey, Transaction, Connection } from '@solana/web3.js';
import { logger } from '../utils/logger';
import { config } from '../config/env';

/**
 * Multisig Security Procedures
 * Implements secure procedures for multisig operations following security best practices
 */

export interface MultisigConfig {
  threshold: number;
  owners: PublicKey[];
  programId: PublicKey;
  treasuryAccount: PublicKey;
}

export interface TransactionProposal {
  id: string;
  type: 'WITHDRAWAL' | 'KEY_ROTATION' | 'EMERGENCY' | 'MAINTENANCE';
  amount?: number;
  recipient?: PublicKey;
  description: string;
  proposer: PublicKey;
  createdAt: number;
  expiresAt: number;
  signatures: MultisigSignature[];
  status: 'PENDING' | 'APPROVED' | 'EXECUTED' | 'REJECTED' | 'EXPIRED';
  verificationData: VerificationData;
}

export interface MultisigSignature {
  signer: PublicKey;
  signature: Uint8Array;
  signedAt: number;
  verificationMethod: 'HARDWARE_WALLET' | 'HSM' | 'COLD_STORAGE';
  ipAddress: string;
  userAgent: string;
}

export interface VerificationData {
  bridgeRequestId?: string;
  lunesTransactionHash?: string;
  expectedAmount?: number;
  verificationSources: string[];
  riskAssessment: RiskLevel;
}

export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

/**
 * Multisig Security Manager
 * Manages secure multisig operations with comprehensive security controls
 */
export class MultisigSecurityManager {
  private config: MultisigConfig;
  private connection: Connection;
  private pendingProposals: Map<string, TransactionProposal> = new Map();
  private securityLog: SecurityLogEntry[] = [];

  // Security thresholds
  private readonly MAX_DAILY_WITHDRAWAL = 1_000_000; // $1M USDT
  private readonly MAX_SINGLE_WITHDRAWAL = 100_000;  // $100k USDT
  private readonly PROPOSAL_EXPIRY_TIME = 24 * 60 * 60 * 1000; // 24 hours
  private readonly MIN_VERIFICATION_SOURCES = 2;

  constructor(config: MultisigConfig, connection: Connection) {
    this.config = config;
    this.connection = connection;
    
    logger.info('Multisig Security Manager initialized', {
      threshold: config.threshold,
      ownersCount: config.owners.length,
      treasuryAccount: config.treasuryAccount.toBase58()
    });
  }

  /**
   * Propose a new multisig transaction with security validation
   */
  async proposeTransaction(
    type: TransactionProposal['type'],
    details: {
      amount?: number;
      recipient?: PublicKey;
      description: string;
      bridgeRequestId?: string;
      lunesTransactionHash?: string;
    },
    proposer: PublicKey
  ): Promise<string> {
    // Security validation
    await this.validateProposer(proposer);
    await this.validateTransactionLimits(type, details.amount);
    
    const proposalId = this.generateProposalId();
    const verificationData = await this.gatherVerificationData(details);
    
    const proposal: TransactionProposal = {
      id: proposalId,
      type,
      amount: details.amount,
      recipient: details.recipient,
      description: details.description,
      proposer,
      createdAt: Date.now(),
      expiresAt: Date.now() + this.PROPOSAL_EXPIRY_TIME,
      signatures: [],
      status: 'PENDING',
      verificationData
    };

    // Risk assessment
    proposal.verificationData.riskAssessment = await this.assessRisk(proposal);

    this.pendingProposals.set(proposalId, proposal);
    
    // Log security event
    this.logSecurityEvent('PROPOSAL_CREATED', {
      proposalId,
      type,
      amount: details.amount,
      proposer: proposer.toBase58(),
      riskLevel: proposal.verificationData.riskAssessment
    });

    // Send notifications to all owners
    await this.notifyOwners(proposal);

    logger.info('Multisig transaction proposed', {
      proposalId,
      type,
      amount: details.amount,
      proposer: proposer.toBase58(),
      riskLevel: proposal.verificationData.riskAssessment
    });

    return proposalId;
  }

  /**
   * Sign a transaction proposal with comprehensive verification
   */
  async signProposal(
    proposalId: string,
    signer: PublicKey,
    signature: Uint8Array,
    verificationMethod: MultisigSignature['verificationMethod'],
    metadata: {
      ipAddress: string;
      userAgent: string;
      hardwareWalletFingerprint?: string;
    }
  ): Promise<boolean> {
    const proposal = this.pendingProposals.get(proposalId);
    if (!proposal) {
      throw new Error('Proposal not found');
    }

    // Security validations
    await this.validateSigner(signer, proposal);
    await this.validateSignature(signature, proposal, signer);
    await this.performSecurityChecks(signer, metadata);

    // Check if already signed
    const existingSignature = proposal.signatures.find(
      sig => sig.signer.equals(signer)
    );
    if (existingSignature) {
      throw new Error('Signer has already signed this proposal');
    }

    // Add signature
    const multisigSignature: MultisigSignature = {
      signer,
      signature,
      signedAt: Date.now(),
      verificationMethod,
      ipAddress: metadata.ipAddress,
      userAgent: metadata.userAgent
    };

    proposal.signatures.push(multisigSignature);

    // Log security event
    this.logSecurityEvent('PROPOSAL_SIGNED', {
      proposalId,
      signer: signer.toBase58(),
      verificationMethod,
      ipAddress: metadata.ipAddress,
      signatureCount: proposal.signatures.length,
      threshold: this.config.threshold
    });

    // Check if threshold reached
    if (proposal.signatures.length >= this.config.threshold) {
      proposal.status = 'APPROVED';
      
      // For high-risk transactions, require additional verification
      if (proposal.verificationData.riskAssessment === 'HIGH' || 
          proposal.verificationData.riskAssessment === 'CRITICAL') {
        await this.performAdditionalVerification(proposal);
      }

      logger.info('Proposal approved - threshold reached', {
        proposalId,
        signatures: proposal.signatures.length,
        threshold: this.config.threshold
      });

      // Auto-execute if conditions are met
      if (await this.shouldAutoExecute(proposal)) {
        await this.executeProposal(proposalId);
      }
    }

    return true;
  }

  /**
   * Execute an approved multisig transaction
   */
  async executeProposal(proposalId: string): Promise<string> {
    const proposal = this.pendingProposals.get(proposalId);
    if (!proposal) {
      throw new Error('Proposal not found');
    }

    if (proposal.status !== 'APPROVED') {
      throw new Error('Proposal not approved');
    }

    // Final security checks
    await this.performPreExecutionChecks(proposal);

    try {
      // Build and send transaction
      const transaction = await this.buildTransaction(proposal);
      const txSignature = await this.sendTransaction(transaction, proposal);

      proposal.status = 'EXECUTED';
      
      // Log execution
      this.logSecurityEvent('PROPOSAL_EXECUTED', {
        proposalId,
        txSignature,
        type: proposal.type,
        amount: proposal.amount,
        recipient: proposal.recipient?.toBase58()
      });

      logger.info('Multisig transaction executed', {
        proposalId,
        txSignature,
        type: proposal.type,
        amount: proposal.amount
      });

      // Post-execution procedures
      await this.performPostExecutionProcedures(proposal, txSignature);

      return txSignature;

    } catch (error) {
      proposal.status = 'REJECTED';
      
      this.logSecurityEvent('PROPOSAL_EXECUTION_FAILED', {
        proposalId,
        error: error.message,
        type: proposal.type
      });

      logger.error('Multisig transaction execution failed', {
        proposalId,
        error: error.message
      });

      throw error;
    }
  }

  /**
   * Emergency procedures for critical situations
   */
  async triggerEmergencyProcedures(
    emergencyType: 'PAUSE_BRIDGE' | 'TREASURY_FREEZE' | 'KEY_COMPROMISE',
    reason: string,
    initiator: PublicKey
  ): Promise<string> {
    logger.error('Emergency procedures triggered', {
      emergencyType,
      reason,
      initiator: initiator.toBase58()
    });

    // Validate emergency authority
    await this.validateEmergencyAuthority(initiator, emergencyType);

    const proposalId = await this.proposeTransaction(
      'EMERGENCY',
      {
        description: `EMERGENCY: ${emergencyType} - ${reason}`,
        bridgeRequestId: `emergency_${Date.now()}`
      },
      initiator
    );

    // Emergency proposals have reduced threshold and faster expiry
    const proposal = this.pendingProposals.get(proposalId)!;
    proposal.expiresAt = Date.now() + (2 * 60 * 60 * 1000); // 2 hours

    // Immediate notification to all owners
    await this.sendEmergencyNotifications(proposal, emergencyType, reason);

    this.logSecurityEvent('EMERGENCY_TRIGGERED', {
      emergencyType,
      reason,
      proposalId,
      initiator: initiator.toBase58()
    });

    return proposalId;
  }

  /**
   * Security validation methods
   */
  private async validateProposer(proposer: PublicKey): Promise<void> {
    if (!this.config.owners.some(owner => owner.equals(proposer))) {
      throw new Error('Proposer is not a multisig owner');
    }

    // Check for recent suspicious activity
    const recentActivity = this.getRecentActivity(proposer);
    if (recentActivity.suspiciousPatterns.length > 0) {
      logger.warn('Suspicious activity detected for proposer', {
        proposer: proposer.toBase58(),
        patterns: recentActivity.suspiciousPatterns
      });
      
      // May require additional verification
    }
  }

  private async validateTransactionLimits(
    type: TransactionProposal['type'],
    amount?: number
  ): Promise<void> {
    if (!amount) return;

    // Check single transaction limit
    if (amount > this.MAX_SINGLE_WITHDRAWAL) {
      throw new Error(`Transaction amount exceeds single limit: ${amount} > ${this.MAX_SINGLE_WITHDRAWAL}`);
    }

    // Check daily limit
    const dailyTotal = await this.getDailyWithdrawalTotal();
    if (dailyTotal + amount > this.MAX_DAILY_WITHDRAWAL) {
      throw new Error(`Transaction would exceed daily limit: ${dailyTotal + amount} > ${this.MAX_DAILY_WITHDRAWAL}`);
    }
  }

  private async validateSigner(signer: PublicKey, proposal: TransactionProposal): Promise<void> {
    if (!this.config.owners.some(owner => owner.equals(signer))) {
      throw new Error('Signer is not a multisig owner');
    }

    if (proposal.status !== 'PENDING') {
      throw new Error('Proposal is not in pending status');
    }

    if (Date.now() > proposal.expiresAt) {
      proposal.status = 'EXPIRED';
      throw new Error('Proposal has expired');
    }
  }

  private async validateSignature(
    signature: Uint8Array,
    proposal: TransactionProposal,
    signer: PublicKey
  ): Promise<void> {
    // Implement signature validation logic
    // This would verify the signature against the proposal data
    
    if (signature.length !== 64) {
      throw new Error('Invalid signature length');
    }

    // Additional cryptographic validation would go here
  }

  private async performSecurityChecks(
    signer: PublicKey,
    metadata: { ipAddress: string; userAgent: string }
  ): Promise<void> {
    // IP address validation
    if (await this.isBlacklistedIP(metadata.ipAddress)) {
      throw new Error('Signing from blacklisted IP address');
    }

    // Geolocation checks
    const location = await this.getIPLocation(metadata.ipAddress);
    if (location.country && await this.isRestrictedCountry(location.country)) {
      logger.warn('Signing from restricted country', {
        signer: signer.toBase58(),
        country: location.country,
        ip: metadata.ipAddress
      });
    }

    // Rate limiting
    if (await this.isRateLimited(signer)) {
      throw new Error('Signer is rate limited');
    }
  }

  private async gatherVerificationData(details: any): Promise<VerificationData> {
    const verificationSources: string[] = [];
    
    // If this is a bridge withdrawal, verify against bridge service
    if (details.bridgeRequestId) {
      const bridgeVerification = await this.verifyBridgeRequest(details.bridgeRequestId);
      verificationSources.push('bridge_service');
      
      if (!bridgeVerification.valid) {
        throw new Error('Bridge request verification failed');
      }
    }

    // If this relates to a Lunes transaction, verify it
    if (details.lunesTransactionHash) {
      const lunesVerification = await this.verifyLunesTransaction(details.lunesTransactionHash);
      verificationSources.push('lunes_blockchain');
      
      if (!lunesVerification.valid) {
        throw new Error('Lunes transaction verification failed');
      }
    }

    // Require minimum verification sources for high-value transactions
    if (details.amount && details.amount > 50000 && verificationSources.length < this.MIN_VERIFICATION_SOURCES) {
      throw new Error('Insufficient verification sources for high-value transaction');
    }

    return {
      bridgeRequestId: details.bridgeRequestId,
      lunesTransactionHash: details.lunesTransactionHash,
      expectedAmount: details.amount,
      verificationSources,
      riskAssessment: 'LOW' // Will be updated by assessRisk
    };
  }

  private async assessRisk(proposal: TransactionProposal): Promise<RiskLevel> {
    let riskScore = 0;

    // Amount-based risk
    if (proposal.amount) {
      if (proposal.amount > 100000) riskScore += 3;
      else if (proposal.amount > 50000) riskScore += 2;
      else if (proposal.amount > 10000) riskScore += 1;
    }

    // Type-based risk
    switch (proposal.type) {
      case 'EMERGENCY': riskScore += 3; break;
      case 'KEY_ROTATION': riskScore += 2; break;
      case 'WITHDRAWAL': riskScore += 1; break;
      case 'MAINTENANCE': riskScore += 0; break;
    }

    // Verification source risk
    if (proposal.verificationData.verificationSources.length < 2) {
      riskScore += 2;
    }

    // Time-based risk (off-hours transactions are riskier)
    const hour = new Date().getHours();
    if (hour < 6 || hour > 22) { // Outside business hours
      riskScore += 1;
    }

    // Convert score to risk level
    if (riskScore >= 6) return 'CRITICAL';
    if (riskScore >= 4) return 'HIGH';
    if (riskScore >= 2) return 'MEDIUM';
    return 'LOW';
  }

  private async performAdditionalVerification(proposal: TransactionProposal): Promise<void> {
    logger.info('Performing additional verification for high-risk proposal', {
      proposalId: proposal.id,
      riskLevel: proposal.verificationData.riskAssessment
    });

    // For high-risk transactions, require:
    // 1. Additional signatures beyond threshold
    // 2. Time delay before execution
    // 3. External verification

    if (proposal.verificationData.riskAssessment === 'CRITICAL') {
      // Require all owners to sign for critical transactions
      const requiredSignatures = this.config.owners.length;
      if (proposal.signatures.length < requiredSignatures) {
        throw new Error(`Critical transaction requires all ${requiredSignatures} signatures`);
      }
    }

    // Implement time delay for high-risk transactions
    const minDelayTime = this.getMinDelayTime(proposal.verificationData.riskAssessment);
    const timeSinceCreation = Date.now() - proposal.createdAt;
    
    if (timeSinceCreation < minDelayTime) {
      throw new Error(`High-risk transaction requires ${minDelayTime / 1000 / 60} minute delay`);
    }
  }

  private getMinDelayTime(riskLevel: RiskLevel): number {
    switch (riskLevel) {
      case 'CRITICAL': return 60 * 60 * 1000; // 1 hour
      case 'HIGH': return 30 * 60 * 1000;     // 30 minutes
      case 'MEDIUM': return 10 * 60 * 1000;   // 10 minutes
      default: return 0;
    }
  }

  private async shouldAutoExecute(proposal: TransactionProposal): Promise<boolean> {
    // Auto-execute low-risk transactions
    if (proposal.verificationData.riskAssessment === 'LOW') {
      return true;
    }

    // For higher risk, require manual execution
    return false;
  }

  private async buildTransaction(proposal: TransactionProposal): Promise<Transaction> {
    // Build the actual Solana transaction based on proposal type
    const transaction = new Transaction();
    
    // Implementation would depend on the specific transaction type
    // This is a simplified version
    
    return transaction;
  }

  private async sendTransaction(
    transaction: Transaction,
    proposal: TransactionProposal
  ): Promise<string> {
    // Send the transaction to Solana network
    // This would include all necessary signatures from the multisig
    
    const signature = await this.connection.sendTransaction(transaction);
    await this.connection.confirmTransaction(signature);
    
    return signature;
  }

  // Utility methods
  private generateProposalId(): string {
    return `proposal_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private logSecurityEvent(event: string, data: any): void {
    const logEntry: SecurityLogEntry = {
      timestamp: Date.now(),
      event,
      data,
      severity: this.getEventSeverity(event)
    };
    
    this.securityLog.push(logEntry);
    
    logger.info('Multisig security event', logEntry);
  }

  private getEventSeverity(event: string): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' {
    const criticalEvents = ['EMERGENCY_TRIGGERED', 'PROPOSAL_EXECUTION_FAILED'];
    const highEvents = ['PROPOSAL_EXECUTED', 'KEY_ROTATION'];
    const mediumEvents = ['PROPOSAL_CREATED', 'PROPOSAL_SIGNED'];
    
    if (criticalEvents.includes(event)) return 'CRITICAL';
    if (highEvents.includes(event)) return 'HIGH';
    if (mediumEvents.includes(event)) return 'MEDIUM';
    return 'LOW';
  }

  // Placeholder methods for external integrations
  private async notifyOwners(proposal: TransactionProposal): Promise<void> {
    // Send notifications to all multisig owners
  }

  private async sendEmergencyNotifications(
    proposal: TransactionProposal,
    emergencyType: string,
    reason: string
  ): Promise<void> {
    // Send urgent notifications for emergency proposals
  }

  private async validateEmergencyAuthority(
    initiator: PublicKey,
    emergencyType: string
  ): Promise<void> {
    // Validate that initiator has authority for this emergency type
  }

  private async verifyBridgeRequest(requestId: string): Promise<{ valid: boolean }> {
    // Verify request against bridge service database
    return { valid: true };
  }

  private async verifyLunesTransaction(txHash: string): Promise<{ valid: boolean }> {
    // Verify transaction on Lunes blockchain
    return { valid: true };
  }

  private async isBlacklistedIP(ip: string): Promise<boolean> {
    // Check against IP blacklist
    return false;
  }

  private async getIPLocation(ip: string): Promise<{ country?: string }> {
    // Get geolocation for IP
    return {};
  }

  private async isRestrictedCountry(country: string): Promise<boolean> {
    // Check if country is restricted
    return false;
  }

  private async isRateLimited(signer: PublicKey): Promise<boolean> {
    // Check rate limiting for signer
    return false;
  }

  private getRecentActivity(signer: PublicKey): { suspiciousPatterns: string[] } {
    // Analyze recent activity for suspicious patterns
    return { suspiciousPatterns: [] };
  }

  private async getDailyWithdrawalTotal(): Promise<number> {
    // Calculate total withdrawals for current day
    return 0;
  }

  private async performPreExecutionChecks(proposal: TransactionProposal): Promise<void> {
    // Final checks before execution
  }

  private async performPostExecutionProcedures(
    proposal: TransactionProposal,
    txSignature: string
  ): Promise<void> {
    // Post-execution procedures like notifications, logging, etc.
  }
}

// Type definitions
interface SecurityLogEntry {
  timestamp: number;
  event: string;
  data: any;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
}

export { MultisigSecurityManager }; 