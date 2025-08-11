import { decodeAddress, encodeAddress } from '@polkadot/util-crypto';
import { isHex } from '@polkadot/util';

/**
 * Validações de segurança para o painel administrativo LUSDT
 */

export interface ValidationResult {
  isValid: boolean;
  error?: string;
}

/**
 * Valida se um endereço Substrate é válido
 */
export function validateSubstrateAddress(address: string): ValidationResult {
  if (!address || typeof address !== 'string') {
    return { isValid: false, error: 'Endereço é obrigatório' };
  }

  // Remove espaços em branco
  const cleanAddress = address.trim();

  if (cleanAddress.length === 0) {
    return { isValid: false, error: 'Endereço não pode estar vazio' };
  }

  try {
    // Validação básica de formato - endereço Substrate padrão
    if (cleanAddress.length < 46 || cleanAddress.length > 48) {
      return { isValid: false, error: 'Endereço tem tamanho inválido' };
    }

    if (!cleanAddress.startsWith('5')) {
      return { isValid: false, error: 'Endereço deve começar com 5' };
    }

    // Verificar se contém apenas caracteres válidos para Base58
    const base58Regex = /^[123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz]+$/;
    if (!base58Regex.test(cleanAddress)) {
      return { isValid: false, error: 'Endereço contém caracteres inválidos' };
    }

    // Tenta decodificar o endereço usando Polkadot utils
    const decoded = decodeAddress(cleanAddress);
    
    // Verifica se tem o tamanho correto (32 bytes)
    if (decoded.length !== 32) {
      return { isValid: false, error: 'Endereço tem tamanho inválido' };
    }

    // Tenta recodificar para verificar integridade
    const encoded = encodeAddress(decoded, 42); // SS58 format 42 para Substrate
    
    if (!encoded) {
      return { isValid: false, error: 'Endereço tem formato inválido' };
    }

    return { isValid: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'formato incorreto';
    return { 
      isValid: false, 
      error: 'Endereço Substrate inválido: ' + message
    };
  }
}

/**
 * Valida quantidade de tokens
 */
export function validateTokenAmount(amount: string | number): ValidationResult {
  if (amount === '' || amount === null || amount === undefined) {
    return { isValid: false, error: 'Quantidade é obrigatória' };
  }

  const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;

  if (isNaN(numAmount)) {
    return { isValid: false, error: 'Quantidade deve ser um número válido' };
  }

  if (numAmount < 0) {
    return { isValid: false, error: 'Quantidade não pode ser negativa' };
  }

  if (numAmount === 0) {
    return { isValid: false, error: 'Quantidade deve ser maior que zero' };
  }

  // Verificar se não excede o máximo seguro (evitar overflow)
  const MAX_SAFE_TOKEN_AMOUNT = Number.MAX_SAFE_INTEGER / 1_000_000; // Considerando 6 decimais
  if (numAmount > MAX_SAFE_TOKEN_AMOUNT) {
    return { isValid: false, error: 'Quantidade excede o limite máximo permitido' };
  }

  // Verificar precisão (máximo 6 casas decimais para LUSDT)
  const decimalPlaces = (amount.toString().split('.')[1] || '').length;
  if (decimalPlaces > 6) {
    return { isValid: false, error: 'Máximo 6 casas decimais permitidas' };
  }

  return { isValid: true };
}

/**
 * Valida valor em USD
 */
export function validateUsdAmount(amount: string | number): ValidationResult {
  const result = validateTokenAmount(amount);
  if (!result.isValid) {
    return result;
  }

  const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;

  // Verificar se é um valor USD razoável (não muito grande)
  const MAX_USD_AMOUNT = 1_000_000_000; // 1 bilhão USD
  if (numAmount > MAX_USD_AMOUNT) {
    return { isValid: false, error: 'Valor USD excede o limite máximo' };
  }

  return { isValid: true };
}

/**
 * Valida motivo de pausa de emergência
 */
export function validatePauseReason(reason: string): ValidationResult {
  if (!reason || typeof reason !== 'string') {
    return { isValid: false, error: 'Motivo da pausa é obrigatório' };
  }

  const cleanReason = reason.trim();

  if (cleanReason.length === 0) {
    return { isValid: false, error: 'Motivo não pode estar vazio' };
  }

  if (cleanReason.length < 10) {
    return { isValid: false, error: 'Motivo deve ter pelo menos 10 caracteres' };
  }

  if (cleanReason.length > 200) {
    return { isValid: false, error: 'Motivo não pode exceder 200 caracteres' };
  }

  // Verificar caracteres perigosos (básico)
  const dangerousChars = /<script|javascript:|data:|vbscript:/i;
  if (dangerousChars.test(cleanReason)) {
    return { isValid: false, error: 'Motivo contém caracteres não permitidos' };
  }

  return { isValid: true };
}

/**
 * Sanitiza string removendo caracteres perigosos
 */
export function sanitizeString(input: string): string {
  if (!input || typeof input !== 'string') {
    return '';
  }

  return input
    .trim()
    .replace(/[<>'"&]/g, ' ') // Substitui caracteres HTML perigosos por espaços
    .replace(/\s+/g, ' '); // Normaliza espaços
}

/**
 * Valida formato de hash de transação
 */
export function validateTxHash(hash: string): ValidationResult {
  if (!hash || typeof hash !== 'string') {
    return { isValid: false, error: 'Hash da transação é obrigatório' };
  }

  const cleanHash = hash.trim();

  // Hash deve começar com 0x e ter 66 caracteres (32 bytes em hex)
  if (!cleanHash.startsWith('0x')) {
    return { isValid: false, error: 'Hash deve começar com 0x' };
  }

  if (cleanHash.length !== 66) {
    return { isValid: false, error: 'Hash deve ter 66 caracteres' };
  }

  if (!isHex(cleanHash)) {
    return { isValid: false, error: 'Hash deve ser hexadecimal válido' };
  }

  return { isValid: true };
}

/**
 * Valida percentage em basis points (0-10000)
 */
export function validateBasisPoints(points: number): ValidationResult {
  if (typeof points !== 'number' || isNaN(points)) {
    return { isValid: false, error: 'Basis points deve ser um número' };
  }

  if (points < 0) {
    return { isValid: false, error: 'Basis points não pode ser negativo' };
  }

  if (points > 10000) {
    return { isValid: false, error: 'Basis points não pode exceder 10000 (100%)' };
  }

  if (!Number.isInteger(points)) {
    return { isValid: false, error: 'Basis points deve ser um número inteiro' };
  }

  return { isValid: true };
}

/**
 * Verifica se uma conta tem permissão para uma ação específica
 */
export function validatePermission(
  currentAccount: string | null,
  requiredAccounts: string[],
  actionName: string
): ValidationResult {
  if (!currentAccount) {
    return { 
      isValid: false, 
      error: `Conta não conectada. ${actionName} requer autenticação.` 
    };
  }

  if (!requiredAccounts.includes(currentAccount)) {
    return { 
      isValid: false, 
      error: `Conta atual não tem permissão para ${actionName}.` 
    };
  }

  return { isValid: true };
}

/**
 * Valida entrada de rede blockchain
 */
export function validateNetworkUrl(url: string): ValidationResult {
  if (!url || typeof url !== 'string') {
    return { isValid: false, error: 'URL da rede é obrigatória' };
  }

  const cleanUrl = url.trim();

  if (!cleanUrl.startsWith('ws://') && !cleanUrl.startsWith('wss://')) {
    return { isValid: false, error: 'URL deve começar com ws:// ou wss://' };
  }

  try {
    new URL(cleanUrl);
    return { isValid: true };
  } catch {
    return { isValid: false, error: 'URL da rede é inválida' };
  }
}