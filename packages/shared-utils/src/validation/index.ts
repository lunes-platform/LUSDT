import { z } from 'zod';

// Address validation schemas
export const solanaAddressSchema = z.string().regex(
  /^[1-9A-HJ-NP-Za-km-z]{32,44}$/,
  'Invalid Solana address format'
);

export const lunesAddressSchema = z.string().min(40, 'Invalid Lunes address format');

// Amount validation schemas
export const amountSchema = z.number().positive('Amount must be positive');

export const tokenAmountSchema = z.object({
  amount: amountSchema,
  decimals: z.number().int().min(0).max(18),
  symbol: z.string().min(1)
});

// Transaction validation schemas
export const transactionHashSchema = z.string().min(32, 'Invalid transaction hash');

// Bridge transaction schemas
export const depositParamsSchema = z.object({
  amount: amountSchema,
  destinationAddress: lunesAddressSchema,
  memo: z.string().optional()
});

export const redemptionParamsSchema = z.object({
  amount: amountSchema,
  destinationAddress: solanaAddressSchema,
  feeType: z.enum(['lunes', 'lusdt', 'usdt'])
});

// Validation functions
export function validateSolanaAddress(address: string): boolean {
  try {
    solanaAddressSchema.parse(address);
    return true;
  } catch {
    return false;
  }
}

export function validateLunesAddress(address: string): boolean {
  try {
    lunesAddressSchema.parse(address);
    return true;
  } catch {
    return false;
  }
}

export function validateAmount(amount: number): boolean {
  try {
    amountSchema.parse(amount);
    return true;
  } catch {
    return false;
  }
}

export function validateDepositParams(params: any): boolean {
  try {
    depositParamsSchema.parse(params);
    return true;
  } catch {
    return false;
  }
}

export function validateRedemptionParams(params: any): boolean {
  try {
    redemptionParamsSchema.parse(params);
    return true;
  } catch {
    return false;
  }
}

// Error formatting
export function formatValidationError(error: z.ZodError): string {
  return error.errors.map(err => err.message).join(', ');
}