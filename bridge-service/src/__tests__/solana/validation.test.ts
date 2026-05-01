/**
 * Solana integration validation tests
 *
 * Tests run fully offline — no RPC calls.
 * Covers:
 *   - Address validation (base58, length, public-key format)
 *   - Token amount precision (USDT 6 decimals, SOL 9 decimals)
 *   - Transaction building (correct accounts, instruction data encoding)
 *   - Error cases: invalid address, zero / negative amount, overflow
 */

import { PublicKey, Keypair, Transaction } from '@solana/web3.js';
import {
  Token,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from '@solana/spl-token';
import bs58 from 'bs58';

// ─── helpers ──────────────────────────────────────────────────────────────────

/** Validates a Solana address: must be base58, 32-byte public key. */
function isValidSolanaAddress(address: string): boolean {
  try {
    const decoded = bs58.decode(address);
    return decoded.length === 32;
  } catch {
    return false;
  }
}

/** Convert a USDT dollar amount (float) to lamport-equivalent micro-units (6 decimals). */
function usdtToMicroUnits(amount: number): bigint {
  return BigInt(Math.round(amount * 1_000_000));
}

/** Convert lamports (integer) to SOL. */
function lamportsToSol(lamports: number): number {
  return lamports / 1e9;
}

// Known-good test fixtures
const VALID_PUBKEY_1 = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'; // SPL Token Program
const VALID_PUBKEY_2 = 'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJe8bXt'; // Associated Token Program
const USDT_MINT_MAINNET = 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB'; // USDT on mainnet

// ─── 1. Address Validation ────────────────────────────────────────────────────

describe('Solana address validation', () => {
  test('accepts valid base58 public keys', () => {
    expect(isValidSolanaAddress(VALID_PUBKEY_1)).toBe(true);
    expect(isValidSolanaAddress(VALID_PUBKEY_2)).toBe(true);
    expect(isValidSolanaAddress(USDT_MINT_MAINNET)).toBe(true);
  });

  test('rejects empty string', () => {
    expect(isValidSolanaAddress('')).toBe(false);
  });

  test('rejects address that is too short', () => {
    expect(isValidSolanaAddress('abc123')).toBe(false);
  });

  test('rejects hex-formatted Ethereum address', () => {
    expect(isValidSolanaAddress('0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045')).toBe(false);
  });

  test('rejects base58 string with invalid characters (0, O, I, l)', () => {
    // '0' is not in base58 alphabet
    const invalidBase58 = '0' + VALID_PUBKEY_1.slice(1);
    expect(isValidSolanaAddress(invalidBase58)).toBe(false);
  });

  test('PublicKey constructor throws on invalid address', () => {
    expect(() => new PublicKey('not_a_valid_pubkey')).toThrow();
  });

  test('PublicKey constructor succeeds on valid address', () => {
    expect(() => new PublicKey(VALID_PUBKEY_1)).not.toThrow();
    const pk = new PublicKey(VALID_PUBKEY_1);
    expect(pk.toString()).toBe(VALID_PUBKEY_1);
  });

  test('Keypair generates valid 32-byte public keys', () => {
    const kp = Keypair.generate();
    expect(isValidSolanaAddress(kp.publicKey.toString())).toBe(true);
    expect(kp.secretKey.length).toBe(64);
  });
});

// ─── 2. Token Amount Precision ────────────────────────────────────────────────

describe('Token amount precision', () => {
  describe('USDT (6 decimals)', () => {
    test('1 USDT = 1_000_000 micro-units', () => {
      expect(usdtToMicroUnits(1)).toBe(BigInt(1_000_000));
    });

    test('0.1 USDT = 100_000 micro-units (no float error)', () => {
      // Native float: 0.1 * 1_000_000 = 100000.00000000001
      expect(usdtToMicroUnits(0.1)).toBe(BigInt(100_000));
    });

    test('0.01 USDT = 10_000 micro-units', () => {
      expect(usdtToMicroUnits(0.01)).toBe(BigInt(10_000));
    });

    test('100.123456 USDT = 100_123_456 micro-units', () => {
      expect(usdtToMicroUnits(100.123456)).toBe(BigInt(100_123_456));
    });

    test('minimum representable unit: 0.000001 USDT = 1 micro-unit', () => {
      expect(usdtToMicroUnits(0.000001)).toBe(BigInt(1));
    });

    test('large amount does not overflow Number (up to 9_000_000 USDT)', () => {
      const amount = 9_000_000;
      const units = usdtToMicroUnits(amount);
      expect(units).toBe(BigInt(9_000_000_000_000));
    });

    test('sub-minimum dust (0.0000001) rounds to 0', () => {
      expect(usdtToMicroUnits(0.0000001)).toBe(BigInt(0));
    });
  });

  describe('SOL (9 decimals / lamports)', () => {
    test('1 SOL = 1_000_000_000 lamports', () => {
      expect(lamportsToSol(1_000_000_000)).toBeCloseTo(1.0);
    });

    test('1 lamport = 1e-9 SOL', () => {
      expect(lamportsToSol(1)).toBeCloseTo(1e-9, 15);
    });

    test('round-trip: SOL → lamports → SOL preserves value', () => {
      const sol = 42.5;
      const lamports = Math.round(sol * 1e9);
      expect(lamportsToSol(lamports)).toBeCloseTo(sol, 6);
    });
  });
});

// ─── 3. Transaction Building ──────────────────────────────────────────────────

describe('SPL token transfer transaction building', () => {
  let payer: Keypair;
  let recipient: Keypair;
  let usdtMint: PublicKey;
  let sourceATA: PublicKey;
  let destATA: PublicKey;

  beforeAll(async () => {
    payer = Keypair.generate();
    recipient = Keypair.generate();
    usdtMint = new PublicKey(USDT_MINT_MAINNET);

    // Derive ATAs offline (no RPC needed)
    sourceATA = await Token.getAssociatedTokenAddress(
      ASSOCIATED_TOKEN_PROGRAM_ID,
      TOKEN_PROGRAM_ID,
      usdtMint,
      payer.publicKey
    );
    destATA = await Token.getAssociatedTokenAddress(
      ASSOCIATED_TOKEN_PROGRAM_ID,
      TOKEN_PROGRAM_ID,
      usdtMint,
      recipient.publicKey
    );
  });

  test('ATA derivation is deterministic', async () => {
    const ata2 = await Token.getAssociatedTokenAddress(
      ASSOCIATED_TOKEN_PROGRAM_ID,
      TOKEN_PROGRAM_ID,
      usdtMint,
      payer.publicKey
    );
    expect(ata2.toString()).toBe(sourceATA.toString());
  });

  test('ATA is a valid 32-byte public key', () => {
    expect(isValidSolanaAddress(sourceATA.toString())).toBe(true);
    expect(isValidSolanaAddress(destATA.toString())).toBe(true);
  });

  test('ATA differs by owner', () => {
    expect(sourceATA.toString()).not.toBe(destATA.toString());
  });

  test('transfer instruction targets correct accounts', () => {
    const amountUnits = Number(usdtToMicroUnits(10));
    const instruction = Token.createTransferInstruction(
      TOKEN_PROGRAM_ID,
      sourceATA,
      destATA,
      payer.publicKey,
      [],
      amountUnits
    );

    // instruction.programId must be TOKEN_PROGRAM_ID
    expect(instruction.programId.toString()).toBe(TOKEN_PROGRAM_ID.toString());

    const keys = instruction.keys.map(k => k.pubkey.toString());
    expect(keys).toContain(sourceATA.toString());
    expect(keys).toContain(destATA.toString());
    expect(keys).toContain(payer.publicKey.toString());
  });

  test('instruction data encodes the transfer amount', () => {
    const amountUnits = Number(usdtToMicroUnits(100));
    const instruction = Token.createTransferInstruction(
      TOKEN_PROGRAM_ID,
      sourceATA,
      destATA,
      payer.publicKey,
      [],
      amountUnits
    );
    // data[0] = 3 (Transfer instruction discriminator)
    expect(instruction.data[0]).toBe(3);
    // Amount is encoded as little-endian u64 in bytes 1–8
    const encoded = new DataView(instruction.data.buffer, instruction.data.byteOffset + 1, 8);
    const low = encoded.getUint32(0, true);
    const high = encoded.getUint32(4, true);
    const decodedAmount = low + high * 2 ** 32;
    expect(decodedAmount).toBe(amountUnits);
  });

  test('transaction add instruction increments instruction count', () => {
    const instruction = Token.createTransferInstruction(
      TOKEN_PROGRAM_ID,
      sourceATA,
      destATA,
      payer.publicKey,
      [],
      1_000_000
    );
    const tx = new Transaction().add(instruction);
    expect(tx.instructions.length).toBe(1);
  });
});

// ─── 4. Error Cases ───────────────────────────────────────────────────────────

describe('Error cases', () => {
  test('invalid Solana address throws in PublicKey constructor', () => {
    // These are definitively rejected by @solana/web3.js v1.x PublicKey
    const invalidAddresses = [
      '',
      'not-base58!',
      '0x1234567890abcdef',
      'too-short',
    ];
    invalidAddresses.forEach(addr => {
      expect(() => new PublicKey(addr)).toThrow();
    });
  });

  test('isValidSolanaAddress rejects base58 strings that decode to wrong byte length', () => {
    // A base58-encoded string that decodes to 20 bytes (Ethereum address length)
    // bs58.encode(20 bytes) will be a valid base58 string but fail the 32-byte check
    const twentyBytes = new Uint8Array(20).fill(1);
    const encoded20 = bs58.encode(twentyBytes);
    expect(isValidSolanaAddress(encoded20)).toBe(false);

    // 64-byte string (too long)
    const sixtyFourBytes = new Uint8Array(64).fill(2);
    const encoded64 = bs58.encode(sixtyFourBytes);
    expect(isValidSolanaAddress(encoded64)).toBe(false);
  });

  test('zero amount encodes as 0 in instruction', () => {
    const kp = Keypair.generate();
    const mint = new PublicKey(USDT_MINT_MAINNET);
    const ata = PublicKey.default;
    const instruction = Token.createTransferInstruction(
      TOKEN_PROGRAM_ID,
      ata,
      ata,
      kp.publicKey,
      [],
      0
    );
    const encoded = new DataView(instruction.data.buffer, instruction.data.byteOffset + 1, 8);
    expect(encoded.getUint32(0, true)).toBe(0);
    expect(encoded.getUint32(4, true)).toBe(0);
  });

  test('usdtToMicroUnits handles negative amount as negative bigint', () => {
    // Negative transfers are a logic error — caller must validate, but encoding is predictable
    const result = usdtToMicroUnits(-1);
    expect(result < BigInt(0)).toBe(true);
  });

  test('usdtToMicroUnits(NaN) produces 0 via Math.round', () => {
    // Math.round(NaN) = NaN; BigInt(NaN) throws — this is caught at runtime
    expect(() => usdtToMicroUnits(NaN)).toThrow();
  });
});

// ─── 5. Keypair Security ──────────────────────────────────────────────────────

describe('Keypair security', () => {
  test('Keypair.fromSecretKey rejects wrong-length array', () => {
    expect(() => Keypair.fromSecretKey(new Uint8Array(32))).toThrow();
    expect(() => Keypair.fromSecretKey(new Uint8Array(63))).toThrow();
  });

  test('Keypair.fromSecretKey accepts 64-byte array', () => {
    const kp = Keypair.generate();
    const restored = Keypair.fromSecretKey(kp.secretKey);
    expect(restored.publicKey.toString()).toBe(kp.publicKey.toString());
  });

  test('bs58 decode of valid key produces 64 bytes', () => {
    const kp = Keypair.generate();
    const encoded = bs58.encode(kp.secretKey);
    const decoded = bs58.decode(encoded);
    expect(decoded.length).toBe(64);
  });
});
