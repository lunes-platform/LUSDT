/**
 * HSM / KMS Signer Abstraction
 *
 * Production: chaves NUNCA em .env — usa AWS KMS ou HashiCorp Vault.
 * Development: aceita chave local para facilitar testes.
 *
 * Nota sobre Solana + KMS:
 *   Solana usa ed25519. AWS KMS suporta ECC_NIST_P256 (secp256r1), não ed25519 nativo.
 *   Para ed25519 puro, use Vault Transit com key_type=ed25519 ou
 *   armazene a chave criptografada no KMS (envelope encryption).
 *   A implementação abaixo usa envelope encryption: a chave ed25519 é
 *   criptografada pelo KMS e descriptografada em memória apenas quando necessário.
 */

import { Keypair, Transaction } from '@solana/web3.js';
import { KMSClient, DecryptCommand, EncryptCommand, GetPublicKeyCommand } from '@aws-sdk/client-kms';
import crypto from 'crypto';
import bs58 from 'bs58';
import { ISigner, SignerConfig } from './types';
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
    // ed25519 sign using Node crypto (Node 18+)
    const privateKeyObj = crypto.createPrivateKey({
      key: Buffer.from(this.keypair.secretKey.slice(0, 32)),
      format: 'der',
      type: 'pkcs8',
    });
    // Fallback: direct nacl-style sign via keypair secretKey
    const { sign } = await import('tweetnacl');
    return sign.detached(message, this.keypair.secretKey);
  }

  async signTransaction(transaction: Transaction): Promise<Transaction> {
    transaction.sign(this.keypair);
    return transaction;
  }

  getKeypair(): Keypair {
    return this.keypair;
  }
}

// ── AWS KMS signer (production — envelope encryption) ───────────────
//
// Estratégia: a chave ed25519 (Solana keypair) é armazenada criptografada
// via AWS KMS (AES-256). No boot, o signer descriptografa a chave em memória.
// A chave em texto claro NUNCA toca disco.
//
// Para configurar:
//   1. Gere um keypair Solana
//   2. Criptografe com: aws kms encrypt --key-id <ID> --plaintext fileb://keypair.json
//   3. Armazene o CiphertextBlob como env var (base64)
//   4. Configure AWS_KMS_KEY_ID e SOLANA_ENCRYPTED_KEY

export class AwsKmsSigner implements ISigner {
  private kmsClient: KMSClient;
  private kmsKeyId: string;
  private keypair?: Keypair;
  private encryptedKey: string;
  private initialized: boolean = false;

  constructor(kmsKeyId: string, encryptedKey: string, region: string = 'us-east-1') {
    this.kmsKeyId = kmsKeyId;
    this.encryptedKey = encryptedKey;
    this.kmsClient = new KMSClient({ region });
    logger.info('🔐 AWS KMS signer created (envelope encryption)', { kmsKeyId, region });
  }

  private async ensureInitialized(): Promise<void> {
    if (this.initialized) return;

    try {
      // Descriptografa a chave ed25519 via KMS
      const ciphertext = Buffer.from(this.encryptedKey, 'base64');
      const response = await this.kmsClient.send(new DecryptCommand({
        KeyId: this.kmsKeyId,
        CiphertextBlob: ciphertext,
      }));

      if (!response.Plaintext) {
        throw new Error('KMS Decrypt returned empty plaintext');
      }

      const secretKeyBytes = new Uint8Array(response.Plaintext);
      this.keypair = Keypair.fromSecretKey(secretKeyBytes);
      this.initialized = true;

      // Zero-out the response buffer (defense in depth)
      (response.Plaintext as Uint8Array).fill(0);

      logger.info('🔐 AWS KMS signer initialized', {
        publicKey: this.keypair.publicKey.toString(),
      });
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      logger.error('❌ AWS KMS signer initialization failed', { error: msg });
      throw new Error(`KMS signer init failed: ${msg}`);
    }
  }

  async getPublicKey(): Promise<string> {
    await this.ensureInitialized();
    return this.keypair!.publicKey.toString();
  }

  async sign(message: Uint8Array): Promise<Uint8Array> {
    await this.ensureInitialized();
    const { sign } = await import('tweetnacl');
    return sign.detached(message, this.keypair!.secretKey);
  }

  async signTransaction(transaction: Transaction): Promise<Transaction> {
    await this.ensureInitialized();
    transaction.sign(this.keypair!);
    return transaction;
  }

  /**
   * Utilitário: criptografa uma chave ed25519 para armazenamento seguro.
   * Usar uma vez para gerar o valor de SOLANA_ENCRYPTED_KEY.
   */
  async encryptKey(plaintextKey: Uint8Array): Promise<string> {
    const response = await this.kmsClient.send(new EncryptCommand({
      KeyId: this.kmsKeyId,
      Plaintext: plaintextKey,
    }));
    if (!response.CiphertextBlob) throw new Error('KMS Encrypt failed');
    return Buffer.from(response.CiphertextBlob).toString('base64');
  }
}

// ── HashiCorp Vault signer (production — Transit engine) ────────────
//
// Usa o Transit secrets engine do Vault com key_type=ed25519.
// Vault gerencia a chave; nunca sai do Vault.
//
// Para configurar:
//   1. vault secrets enable transit
//   2. vault write transit/keys/solana-bridge type=ed25519
//   3. Configure VAULT_URL, VAULT_TOKEN, VAULT_KEY_PATH=transit

export class VaultSigner implements ISigner {
  private vaultUrl: string;
  private token: string;
  private keyPath: string;
  private keyName: string;
  private cachedPublicKey?: string;

  constructor(vaultUrl: string, token: string, keyPath: string, keyName: string = 'solana-bridge') {
    this.vaultUrl = vaultUrl.replace(/\/$/, '');
    this.token = token;
    this.keyPath = keyPath;
    this.keyName = keyName;
    logger.info('🔐 HashiCorp Vault signer created', { vaultUrl, keyPath, keyName });
  }

  private async vaultRequest(method: string, path: string, body?: any): Promise<any> {
    const url = `${this.vaultUrl}/v1/${path}`;
    const options: RequestInit = {
      method,
      headers: {
        'X-Vault-Token': this.token,
        'Content-Type': 'application/json',
      },
    };
    if (body) options.body = JSON.stringify(body);

    const response = await fetch(url, options);
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Vault API error ${response.status}: ${text}`);
    }
    return response.json();
  }

  async getPublicKey(): Promise<string> {
    if (this.cachedPublicKey) return this.cachedPublicKey;

    const data = await this.vaultRequest('GET', `${this.keyPath}/keys/${this.keyName}`);
    const latestVersion = data.data.latest_version;
    const keyData = data.data.keys[String(latestVersion)];

    if (!keyData || !keyData.public_key) {
      throw new Error('Vault key has no public_key field — ensure key_type=ed25519');
    }

    // Vault retorna a public key em base64
    const pubkeyBytes = Buffer.from(keyData.public_key, 'base64');
    this.cachedPublicKey = bs58.encode(pubkeyBytes);

    logger.info('🔐 Vault public key retrieved', { publicKey: this.cachedPublicKey });
    return this.cachedPublicKey;
  }

  async sign(message: Uint8Array): Promise<Uint8Array> {
    const input = Buffer.from(message).toString('base64');
    const data = await this.vaultRequest('POST', `${this.keyPath}/sign/${this.keyName}`, {
      input,
      marshaling_algorithm: 'jws',
    });

    // Vault retorna: vault:v1:<base64_signature>
    const sigParts = data.data.signature.split(':');
    const sigBase64 = sigParts[sigParts.length - 1];
    return new Uint8Array(Buffer.from(sigBase64, 'base64'));
  }

  async signTransaction(transaction: Transaction): Promise<Transaction> {
    // Solana transactions need the full keypair to sign natively.
    // With Vault Transit, we sign the serialized message manually.
    const message = transaction.serializeMessage();
    const signature = await this.sign(message);
    const pubkeyStr = await this.getPublicKey();

    // Add the signature to the transaction
    transaction.addSignature(
      new (await import('@solana/web3.js')).PublicKey(pubkeyStr),
      Buffer.from(signature),
    );

    return transaction;
  }
}

// ── Factory ─────────────────────────────────────────────────────────

export function createSigner(cfg: SignerConfig): ISigner {
  switch (cfg.type) {
    case 'local':
      if (!cfg.localPrivateKey) {
        throw new Error('LocalSigner requires localPrivateKey');
      }
      return new LocalSigner(cfg.localPrivateKey);

    case 'aws_kms':
      if (!cfg.awsKmsKeyId) {
        throw new Error('AwsKmsSigner requires awsKmsKeyId');
      }
      return new AwsKmsSigner(
        cfg.awsKmsKeyId,
        process.env.SOLANA_ENCRYPTED_KEY || '',
        cfg.awsRegion,
      );

    case 'hashicorp_vault':
      if (!cfg.vaultUrl || !cfg.vaultToken || !cfg.vaultKeyPath) {
        throw new Error('VaultSigner requires vaultUrl, vaultToken, vaultKeyPath');
      }
      return new VaultSigner(cfg.vaultUrl, cfg.vaultToken, cfg.vaultKeyPath);

    default:
      throw new Error(`Unknown signer type: ${cfg.type}`);
  }
}
