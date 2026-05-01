import { PublicKey } from '@solana/web3.js';

export function isValidSolanaAddress(address: string): boolean {
  try {
    if (!address || typeof address !== 'string') return false;
    const pubkey = new PublicKey(address);
    return PublicKey.isOnCurve(pubkey.toBytes());
  } catch {
    return false;
  }
}

export function isValidLunesAddress(address: string): boolean {
  try {
    if (!address || typeof address !== 'string') return false;
    if (address.length < 47 || address.length > 48) return false;
    const base58Chars = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
    return address.split('').every(c => base58Chars.includes(c));
  } catch {
    return false;
  }
}
