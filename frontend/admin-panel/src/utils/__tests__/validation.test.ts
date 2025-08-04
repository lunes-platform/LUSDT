import { describe, it, expect } from 'vitest';
import {
  validateSubstrateAddress,
  validateTokenAmount,
  validateUsdAmount,
  validatePauseReason,
  validateTxHash,
  validateBasisPoints,
  validatePermission,
  validateNetworkUrl,
  sanitizeString
} from '../validation';

describe('🔒 Validation Utils - Security Tests', () => {
  describe('validateSubstrateAddress', () => {
    it('should validate correct Substrate address', () => {
      const validAddress = '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY';
      const result = validateSubstrateAddress(validAddress);
      expect(result.isValid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should reject empty address', () => {
      const result = validateSubstrateAddress('');
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Endereço é obrigatório');
    });

    it('should reject null/undefined address', () => {
      const resultNull = validateSubstrateAddress(null as any);
      expect(resultNull.isValid).toBe(false);
      expect(resultNull.error).toBe('Endereço é obrigatório');

      const resultUndefined = validateSubstrateAddress(undefined as any);
      expect(resultUndefined.isValid).toBe(false);
      expect(resultUndefined.error).toBe('Endereço é obrigatório');
    });

    it('should reject invalid format address', () => {
      const result = validateSubstrateAddress('invalid-address');
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('Endereço Substrate inválido');
    });

    it('should handle addresses with whitespace', () => {
      const addressWithSpaces = '  5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY  ';
      const result = validateSubstrateAddress(addressWithSpaces);
      expect(result.isValid).toBe(true);
    });
  });

  describe('validateTokenAmount', () => {
    it('should validate correct token amount', () => {
      const result = validateTokenAmount('100.123456');
      expect(result.isValid).toBe(true);
    });

    it('should validate numeric amount', () => {
      const result = validateTokenAmount(1000);
      expect(result.isValid).toBe(true);
    });

    it('should reject negative amounts', () => {
      const result = validateTokenAmount('-100');
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Quantidade não pode ser negativa');
    });

    it('should reject zero amount', () => {
      const result = validateTokenAmount('0');
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Quantidade deve ser maior que zero');
    });

    it('should reject empty amount', () => {
      const result = validateTokenAmount('');
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Quantidade é obrigatória');
    });

    it('should reject non-numeric values', () => {
      const result = validateTokenAmount('abc');
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Quantidade deve ser um número válido');
    });

    it('should reject amounts with too many decimals', () => {
      const result = validateTokenAmount('100.1234567'); // 7 decimals
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Máximo 6 casas decimais permitidas');
    });

    it('should accept exactly 6 decimals', () => {
      const result = validateTokenAmount('100.123456'); // 6 decimals
      expect(result.isValid).toBe(true);
    });

    it('should reject extremely large amounts', () => {
      const hugeAmount = '999999999999999999999999999999';
      const result = validateTokenAmount(hugeAmount);
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Quantidade excede o limite máximo permitido');
    });
  });

  describe('validatePauseReason', () => {
    it('should validate correct pause reason', () => {
      const result = validatePauseReason('Sistema em manutenção para correção de bug crítico');
      expect(result.isValid).toBe(true);
    });

    it('should reject empty reason', () => {
      const result = validatePauseReason('');
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Motivo da pausa é obrigatório');
    });

    it('should reject very short reason', () => {
      const result = validatePauseReason('Bug');
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Motivo deve ter pelo menos 10 caracteres');
    });

    it('should reject very long reason', () => {
      const longReason = 'a'.repeat(201); // 201 characters
      const result = validatePauseReason(longReason);
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Motivo não pode exceder 200 caracteres');
    });

    it('should reject dangerous scripts', () => {
      const dangerousReason = 'Sistema em manutenção <script>alert("xss")</script>';
      const result = validatePauseReason(dangerousReason);
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Motivo contém caracteres não permitidos');
    });

    it('should reject javascript: protocol', () => {
      const dangerousReason = 'Problema encontrado javascript:alert(1)';
      const result = validatePauseReason(dangerousReason);
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Motivo contém caracteres não permitidos');
    });

    it('should handle whitespace properly', () => {
      const reasonWithSpaces = '   Problema de segurança detectado   ';
      const result = validatePauseReason(reasonWithSpaces);
      expect(result.isValid).toBe(true);
    });
  });

  describe('validateTxHash', () => {
    it('should validate correct transaction hash', () => {
      const validHash = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';
      const result = validateTxHash(validHash);
      expect(result.isValid).toBe(true);
    });

    it('should reject hash without 0x prefix', () => {
      const invalidHash = '1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';
      const result = validateTxHash(invalidHash);
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Hash deve começar com 0x');
    });

    it('should reject hash with wrong length', () => {
      const shortHash = '0x1234567890abcdef';
      const result = validateTxHash(shortHash);
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Hash deve ter 66 caracteres');
    });

    it('should reject non-hex characters', () => {
      const invalidHash = '0x1234567890abcdefg234567890abcdef1234567890abcdef1234567890abcdef';
      const result = validateTxHash(invalidHash);
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Hash deve ser hexadecimal válido');
    });

    it('should reject empty hash', () => {
      const result = validateTxHash('');
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Hash da transação é obrigatório');
    });
  });

  describe('validateBasisPoints', () => {
    it('should validate correct basis points', () => {
      const result = validateBasisPoints(500); // 5%
      expect(result.isValid).toBe(true);
    });

    it('should accept 0 basis points', () => {
      const result = validateBasisPoints(0);
      expect(result.isValid).toBe(true);
    });

    it('should accept maximum basis points', () => {
      const result = validateBasisPoints(10000); // 100%
      expect(result.isValid).toBe(true);
    });

    it('should reject negative basis points', () => {
      const result = validateBasisPoints(-1);
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Basis points não pode ser negativo');
    });

    it('should reject excessive basis points', () => {
      const result = validateBasisPoints(10001);
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Basis points não pode exceder 10000 (100%)');
    });

    it('should reject decimal basis points', () => {
      const result = validateBasisPoints(500.5);
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Basis points deve ser um número inteiro');
    });

    it('should reject non-numeric basis points', () => {
      const result = validateBasisPoints(NaN);
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Basis points deve ser um número');
    });
  });

  describe('validatePermission', () => {
    const ownerAddress = '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY';
    const bridgeAddress = '5FZoQhgUCmqBxnkHX7jCqThScS2xQWiwiF61msg63CFL3Y8f';
    const randomAddress = '5D34dL5prEUaGNQtPPZ3yN5Y6BnkfXunKXXz6fo7ZJbLwRRH';

    it('should validate owner permission', () => {
      const result = validatePermission(
        ownerAddress,
        [ownerAddress, bridgeAddress],
        'atualizar bridge'
      );
      expect(result.isValid).toBe(true);
    });

    it('should reject unauthorized account', () => {
      const result = validatePermission(
        randomAddress,
        [ownerAddress, bridgeAddress],
        'atualizar bridge'
      );
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Conta atual não tem permissão para atualizar bridge.');
    });

    it('should reject null account', () => {
      const result = validatePermission(
        null,
        [ownerAddress, bridgeAddress],
        'atualizar bridge'
      );
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Conta não conectada. atualizar bridge requer autenticação.');
    });
  });

  describe('validateNetworkUrl', () => {
    it('should validate ws:// URL', () => {
      const result = validateNetworkUrl('ws://127.0.0.1:9944');
      expect(result.isValid).toBe(true);
    });

    it('should validate wss:// URL', () => {
      const result = validateNetworkUrl('wss://rococo-contracts-rpc.polkadot.io');
      expect(result.isValid).toBe(true);
    });

    it('should reject http:// URL', () => {
      const result = validateNetworkUrl('http://example.com');
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('URL deve começar com ws:// ou wss://');
    });

    it('should reject invalid URL format', () => {
      const result = validateNetworkUrl('not-a-url');
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('URL da rede é inválida');
    });

    it('should reject empty URL', () => {
      const result = validateNetworkUrl('');
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('URL da rede é obrigatória');
    });
  });

  describe('sanitizeString', () => {
    it('should remove dangerous HTML characters', () => {
      const input = '<script>alert("xss")</script>';
      const result = sanitizeString(input);
      expect(result).toBe('scriptalert( xss )/script');
    });

    it('should normalize whitespace', () => {
      const input = '  multiple    spaces   ';
      const result = sanitizeString(input);
      expect(result).toBe('multiple spaces');
    });

    it('should handle quotes and ampersands', () => {
      const input = `He said "Hello" & 'Goodbye'`;
      const result = sanitizeString(input);
      expect(result).toBe('He said Hello Goodbye');
    });

    it('should return empty string for null input', () => {
      const result = sanitizeString(null as any);
      expect(result).toBe('');
    });

    it('should handle normal text without changes', () => {
      const input = 'Normal text without dangerous characters';
      const result = sanitizeString(input);
      expect(result).toBe('Normal text without dangerous characters');
    });
  });
});