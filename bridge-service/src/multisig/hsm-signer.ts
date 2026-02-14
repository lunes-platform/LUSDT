/**
 * HSM / KMS Signer Abstraction
 *
 * Production: chaves NUNCA em .env — usa AWS KMS ou HashiCorp Vault.
 * Development: aceita chave local para facilitar testes.
 */

import { Keypair } from '@solana/web3.js';
import crypto from 'crypto';
import bs58 from 'bs58';
import { ISigner, SignerConfig, SignerType } from './types';
import { logger } from '../utils/logger';

// ── Local signer (development only) ────────────────────────────────

export class LocalSigner implements ISigner {
  private keypair: Keypair;

  constructor(privateKey: string) {
    const trimmed = privateKey.trim();
    if (trimmed.startsWith('[')) {
      this.keypair = Keypair.fromSecretKey(new Uint8Array(JSON.parse(trimmed)));
    } else {
      this.keypair = Keypair.fromSecretKey(bs58.decode(trimmed));
    }
    logger.warn('⚠️  Using LOCAL signer — NOT safe for production');
  }

  async getPublicKey(): Promise<string> {
    return this.keypair.publicKey.toString();
  }

  async sign(message: Uint8Array): Promise<Uint8Array> {
    const signature = crypto.sign(null, Buffer.from(message), {
      key: Buffer.from(this.keypair.secretKey),
      format: 'der',
      type: 'pkcs8',
    });
    // Fallback: use nacl-compatible ed25519 via keypair
    return Buffer.from(
      require('tweetnacl').sign.detached(message, this.keypair.secretKey)
    );
  }

  async signTransaction(transaction: any): Promise<any> {
    transaction.sign(this.keypair);
    return transaction;
  }

  getKeypair(): Keypair {
    return this.keypair;
  }
}

// ── AWS KMS signer (production) ─────────────────────────────────────

export class AwsKmsSigner implements ISigner {
  private kmsKeyId: string;
  private region: string;
  private cachedPublicKey?: string;

  constructor(kmsKeyId: string, region: string = 'us-east-1') {
    this.kmsKeyId = kmsKeyId;
    this.region = region;
    logger.info('🔐 AWS KMS signer initialized', { kmsKeyId, region });
  }

  async getPublicKey(): Promise<string> {
    if (this.cachedPublicKey) return this.cachedPublicKey;

    // In production, use AWS SDK:
    // const kms = new KMSClient({ region: this.region });
    // const result = await kms.send(new GetPublicKeyCommand({ KeyId: this.kmsKeyId }));
    // this.cachedPublicKey = bs58.encode(result.PublicKey);

    throw new Error(
      'AWS KMS signer requires @aws-sdk/client-kms. ' +
      'Install it and implement getPublicKey() for production use.'
    );
  }

  async sign(message: Uint8Array): Promise<Uint8Array> {
    // In production:
    // const kms = new KMSClient({ region: this.region });
    // const result = await kms.send(new SignCommand({
    //   KeyId: this.kmsKeyId,
    //   Message: message,
    //   MessageType: 'RAW',
    //   SigningAlgorithm: 'ECDSA_SHA_256',
    // }));
    // return new Uint8Array(result.Signature!);

    throw new Error(
      'AWS KMS signer requires @aws-sdk/client-kms. ' +
      'Install it and implement sign() for production use.'
    );
  }

  async signTransaction(transaction: any): Promise<any> {
    throw new Error(
      'AWS KMS transaction signing requires custom serialization. ' +
      'Implement with @aws-sdk/client-kms for production.'
    );
  }
}

// ── HashiCorp Vault signer (production) ─────────────────────────────

export class VaultSigner implements ISigner {
  private vaultUrl: string;
  private token: string;
  private keyPath: string;

  constructor(vaultUrl: string, token: string, keyPath: string) {
    this.vaultUrl = vaultUrl;
    this.token = token;
    this.keyPath = keyPath;
    logger.info('🔐 HashiCorp Vault signer initialized', { vaultUrl, keyPath });
  }

  async getPublicKey(): Promise<string> {
    // In production:
    // const res = await fetch(`${this.vaultUrl}/v1/${this.keyPath}/keys`, {
    //   headers: { 'X-Vault-Token': this.token }
    // });
    // const data = await res.json();
    // return data.data.keys['1'].public_key;

    throw new Error(
      'Vault signer requires implementation with HashiCorp Vault API. ' +
      'Configure VAULT_URL, VAULT_TOKEN, VAULT_KEY_PATH.'
    );
  }

  async sign(message: Uint8Array): Promise<Uint8Array> {
    throw new Error('Vault signer sign() not implemented — configure for production.');
  }

  async signTransaction(transaction: any): Promise<any> {
    throw new Error('Vault signer signTransaction() not implemented — configure for production.');
  }
}

// ── Factory ─────────────────────────────────────────────────────────

export function createSigner(config: SignerConfig): ISigner {
  switch (config.type) {
    case 'local':
      if (!config.localPrivateKey) {
        throw new Error('LocalSigner requires localPrivateKey');
      }
      return new LocalSigner(config.localPrivateKey);

    case 'aws_kms':
      if (!config.awsKmsKeyId) {
        throw new Error('AwsKmsSigner requires awsKmsKeyId');
      }
      return new AwsKmsSigner(config.awsKmsKeyId, config.awsRegion);

    case 'hashicorp_vault':
      if (!config.vaultUrl || !config.vaultToken || !config.vaultKeyPath) {
        throw new Error('VaultSigner requires vaultUrl, vaultToken, vaultKeyPath');
      }
      return new VaultSigner(config.vaultUrl, config.vaultToken, config.vaultKeyPath);

    default:
      throw new Error(`Unknown signer type: ${config.type}`);
  }
}
