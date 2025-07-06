import { Keypair, PublicKey } from '@solana/web3.js';
import { config } from '../config/env';
import { logger } from '../utils/logger';

/**
 * Hardware Security Module (HSM) interface for secure key management
 * Provides abstraction layer for different HSM/KMS providers
 */
export interface HSMProvider {
  signTransaction(transaction: Uint8Array): Promise<Uint8Array>;
  getPublicKey(): Promise<PublicKey>;
  isAvailable(): Promise<boolean>;
  rotateKey(): Promise<void>;
}

/**
 * AWS KMS implementation for production environments
 */
export class AWSKMSProvider implements HSMProvider {
  private keyId: string;
  private region: string;

  constructor(keyId: string, region: string = 'us-east-1') {
    this.keyId = keyId;
    this.region = region;
  }

  async signTransaction(transaction: Uint8Array): Promise<Uint8Array> {
    try {
      // In production, this would use AWS KMS SDK
      logger.info('Signing transaction with AWS KMS', {
        keyId: this.keyId,
        transactionSize: transaction.length
      });

      // Placeholder for AWS KMS signing
      // const kms = new AWS.KMS({ region: this.region });
      // const result = await kms.sign({
      //   KeyId: this.keyId,
      //   Message: transaction,
      //   MessageType: 'RAW',
      //   SigningAlgorithm: 'ECDSA_SHA_256'
      // }).promise();
      
      // For now, return mock signature
      return new Uint8Array(64); // Ed25519 signature length
      
    } catch (error) {
      logger.error('Failed to sign transaction with AWS KMS', { error });
      throw new Error('HSM signing failed');
    }
  }

  async getPublicKey(): Promise<PublicKey> {
    try {
      // In production, retrieve public key from KMS
      logger.info('Retrieving public key from AWS KMS', { keyId: this.keyId });
      
      // Placeholder - would retrieve actual public key from KMS
      return new PublicKey('11111111111111111111111111111112');
      
    } catch (error) {
      logger.error('Failed to retrieve public key from AWS KMS', { error });
      throw new Error('HSM public key retrieval failed');
    }
  }

  async isAvailable(): Promise<boolean> {
    try {
      // Check KMS connectivity and key availability
      return true; // Placeholder
    } catch (error) {
      logger.error('AWS KMS availability check failed', { error });
      return false;
    }
  }

  async rotateKey(): Promise<void> {
    try {
      logger.info('Initiating key rotation in AWS KMS', { keyId: this.keyId });
      // Implement key rotation logic
    } catch (error) {
      logger.error('Key rotation failed', { error });
      throw new Error('Key rotation failed');
    }
  }
}

/**
 * HashiCorp Vault implementation for enterprise environments
 */
export class VaultProvider implements HSMProvider {
  private vaultUrl: string;
  private token: string;
  private keyPath: string;

  constructor(vaultUrl: string, token: string, keyPath: string) {
    this.vaultUrl = vaultUrl;
    this.token = token;
    this.keyPath = keyPath;
  }

  async signTransaction(transaction: Uint8Array): Promise<Uint8Array> {
    try {
      logger.info('Signing transaction with HashiCorp Vault', {
        keyPath: this.keyPath,
        transactionSize: transaction.length
      });

      // Placeholder for Vault signing
      return new Uint8Array(64);
      
    } catch (error) {
      logger.error('Failed to sign transaction with Vault', { error });
      throw new Error('Vault signing failed');
    }
  }

  async getPublicKey(): Promise<PublicKey> {
    try {
      logger.info('Retrieving public key from Vault', { keyPath: this.keyPath });
      return new PublicKey('11111111111111111111111111111112');
    } catch (error) {
      logger.error('Failed to retrieve public key from Vault', { error });
      throw new Error('Vault public key retrieval failed');
    }
  }

  async isAvailable(): Promise<boolean> {
    try {
      // Check Vault connectivity
      return true; // Placeholder
    } catch (error) {
      logger.error('Vault availability check failed', { error });
      return false;
    }
  }

  async rotateKey(): Promise<void> {
    try {
      logger.info('Initiating key rotation in Vault', { keyPath: this.keyPath });
      // Implement key rotation logic
    } catch (error) {
      logger.error('Key rotation failed', { error });
      throw new Error('Key rotation failed');
    }
  }
}

/**
 * Development-only provider using local keypair
 * NEVER use in production
 */
export class DevelopmentProvider implements HSMProvider {
  private keypair: Keypair;

  constructor(privateKey?: Uint8Array) {
    if (privateKey) {
      this.keypair = Keypair.fromSecretKey(privateKey);
    } else {
      this.keypair = Keypair.generate();
      logger.warn('Generated new keypair for development', {
        publicKey: this.keypair.publicKey.toBase58()
      });
    }
  }

  async signTransaction(transaction: Uint8Array): Promise<Uint8Array> {
    logger.debug('Signing transaction with development keypair');
    // This is a simplified signing - in reality would need proper transaction serialization
    return this.keypair.secretKey.slice(0, 64);
  }

  async getPublicKey(): Promise<PublicKey> {
    return this.keypair.publicKey;
  }

  async isAvailable(): Promise<boolean> {
    return true;
  }

  async rotateKey(): Promise<void> {
    logger.warn('Key rotation not supported in development mode');
    throw new Error('Key rotation not supported in development');
  }
}

/**
 * HSM Manager - provides unified interface for key management
 */
export class HSMManager {
  private provider: HSMProvider;
  private backupProvider?: HSMProvider;

  constructor(provider: HSMProvider, backupProvider?: HSMProvider) {
    this.provider = provider;
    this.backupProvider = backupProvider;
  }

  /**
   * Sign a transaction with primary or backup provider
   */
  async signTransaction(transaction: Uint8Array): Promise<Uint8Array> {
    try {
      // Try primary provider first
      if (await this.provider.isAvailable()) {
        return await this.provider.signTransaction(transaction);
      }
      
      // Fallback to backup provider
      if (this.backupProvider && await this.backupProvider.isAvailable()) {
        logger.warn('Primary HSM unavailable, using backup provider');
        return await this.backupProvider.signTransaction(transaction);
      }
      
      throw new Error('No HSM providers available');
      
    } catch (error) {
      logger.error('Transaction signing failed', { error });
      throw error;
    }
  }

  /**
   * Get public key from active provider
   */
  async getPublicKey(): Promise<PublicKey> {
    try {
      if (await this.provider.isAvailable()) {
        return await this.provider.getPublicKey();
      }
      
      if (this.backupProvider && await this.backupProvider.isAvailable()) {
        return await this.backupProvider.getPublicKey();
      }
      
      throw new Error('No HSM providers available');
      
    } catch (error) {
      logger.error('Public key retrieval failed', { error });
      throw error;
    }
  }

  /**
   * Health check for all providers
   */
  async healthCheck(): Promise<{
    primary: boolean;
    backup?: boolean;
    activeProvider: string;
  }> {
    const primaryHealth = await this.provider.isAvailable();
    const backupHealth = this.backupProvider ? await this.backupProvider.isAvailable() : undefined;
    
    let activeProvider = 'none';
    if (primaryHealth) {
      activeProvider = 'primary';
    } else if (backupHealth) {
      activeProvider = 'backup';
    }

    return {
      primary: primaryHealth,
      backup: backupHealth,
      activeProvider
    };
  }

  /**
   * Rotate keys on all providers
   */
  async rotateKeys(): Promise<void> {
    logger.info('Starting key rotation process');
    
    try {
      await this.provider.rotateKey();
      
      if (this.backupProvider) {
        await this.backupProvider.rotateKey();
      }
      
      logger.info('Key rotation completed successfully');
    } catch (error) {
      logger.error('Key rotation failed', { error });
      throw error;
    }
  }
}

/**
 * Factory function to create HSM provider based on configuration
 */
export function createHSMProvider(): HSMProvider {
  const hsmType = config.HSM_TYPE || 'development';
  
  switch (hsmType.toLowerCase()) {
    case 'aws-kms':
      return new AWSKMSProvider(
        config.AWS_KMS_KEY_ID!,
        config.AWS_REGION
      );
      
    case 'vault':
      return new VaultProvider(
        config.VAULT_URL!,
        config.VAULT_TOKEN!,
        config.VAULT_KEY_PATH!
      );
      
    case 'development':
      if (config.NODE_ENV === 'production') {
        throw new Error('Development HSM provider cannot be used in production');
      }
      
      const privateKeyBase58 = config.SOLANA_WALLET_PRIVATE_KEY;
      if (privateKeyBase58) {
        // Decode base58 private key
        const privateKey = new Uint8Array(64); // Placeholder for base58 decode
        return new DevelopmentProvider(privateKey);
      }
      
      return new DevelopmentProvider();
      
    default:
      throw new Error(`Unsupported HSM type: ${hsmType}`);
  }
}

/**
 * Create HSM manager with primary and backup providers
 */
export function createHSMManager(): HSMManager {
  const primaryProvider = createHSMProvider();
  
  // In production, you might want a backup provider
  let backupProvider: HSMProvider | undefined;
  
  if (config.NODE_ENV === 'production' && config.BACKUP_HSM_TYPE) {
    // Create backup provider based on configuration
    // This is environment-specific
  }
  
  return new HSMManager(primaryProvider, backupProvider);
}

/**
 * Security audit logging for HSM operations
 */
export class HSMSecurityLogger {
  static logKeyUsage(operation: string, keyId: string, success: boolean): void {
    logger.info('HSM key operation', {
      operation,
      keyId,
      success,
      timestamp: new Date().toISOString(),
      securityEvent: true
    });
  }

  static logSecurityViolation(violation: string, details: any): void {
    logger.error('HSM security violation detected', {
      violation,
      details,
      timestamp: new Date().toISOString(),
      severity: 'CRITICAL',
      securityEvent: true
    });
  }

  static logKeyRotation(keyId: string, oldKeyFingerprint: string, newKeyFingerprint: string): void {
    logger.info('HSM key rotation completed', {
      keyId,
      oldKeyFingerprint,
      newKeyFingerprint,
      timestamp: new Date().toISOString(),
      securityEvent: true
    });
  }
} 