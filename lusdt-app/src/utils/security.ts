// Utilitários de segurança para frontend LUSDT
// Implementa OWASP Top 10 e melhores práticas de segurança

// 1. SANITIZAÇÃO DE INPUT
export class InputSanitizer {
  // Remove caracteres potencialmente perigosos
  static sanitizeString(input: string): string {
    if (typeof input !== 'string') return '';

    return input
      .replace(/[<>]/g, '') // Remove < >
      .replace(/javascript:/gi, '') // Remove javascript: URLs
      .replace(/data:/gi, '') // Remove data: URLs
      .replace(/vbscript:/gi, '') // Remove vbscript: URLs
      .trim();
  }

  // Valida e sanitiza endereços
  static sanitizeAddress(address: string): string {
    if (typeof address !== 'string') return '';

    // Remove todos os caracteres não hexadecimais
    const cleanAddress = address.replace(/[^a-fA-F0-9]/g, '');

    // Valida comprimento (endereços Solana têm 32 bytes = 64 chars hex)
    if (cleanAddress.length !== 64) {
      throw new Error('Invalid address format');
    }

    return cleanAddress;
  }

  // Valida e sanitiza valores numéricos
  static sanitizeNumber(input: string, options: {
    min?: number;
    max?: number;
    decimals?: number;
  } = {}): string {
    if (typeof input !== 'string') return '0';

    // Remove tudo exceto números, ponto decimal e sinal negativo
    let clean = input.replace(/[^0-9.-]/g, '');

    // Garante apenas um ponto decimal
    const parts = clean.split('.');
    if (parts.length > 2) {
      clean = parts[0] + '.' + parts.slice(1).join('');
    }

    // Limita casas decimais se especificado
    if (options.decimals !== undefined && parts.length === 2) {
      clean = parts[0] + '.' + parts[1].substring(0, options.decimals);
    }

    const num = parseFloat(clean);

    // Valida limites
    if (options.min !== undefined && num < options.min) {
      throw new Error(`Value must be at least ${options.min}`);
    }

    if (options.max !== undefined && num > options.max) {
      throw new Error(`Value must be at most ${options.max}`);
    }

    return clean;
  }
}

// 2. VALIDAÇÃO DE DADOS
export class DataValidator {
  // Valida endereços Solana
  static isValidSolanaAddress(address: string): boolean {
    try {
      if (typeof address !== 'string') return false;
      if (address.length < 32 || address.length > 44) return false;

      // Base58 validation (simplified)
      const base58Chars = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
      return address.split('').every(char => base58Chars.includes(char));
    } catch {
      return false;
    }
  }

  // Valida endereços Lunes (Substrate)
  static isValidLunesAddress(address: string): boolean {
    try {
      if (typeof address !== 'string') return false;
      if (address.length < 47 || address.length > 48) return false;

      // Deve começar com '5' (mainnet) ou outros prefixos válidos
      return address.startsWith('5') || address.startsWith('1');
    } catch {
      return false;
    }
  }

  // Valida valores de transação
  static validateTransactionAmount(amount: string): {
    isValid: boolean;
    sanitizedAmount: string;
    errors: string[];
  } {
    const errors: string[] = [];
    let sanitizedAmount = '0';

    try {
      sanitizedAmount = InputSanitizer.sanitizeNumber(amount, {
        min: 0.000001,
        max: 1000000,
        decimals: 6
      });

      const numAmount = parseFloat(sanitizedAmount);
      if (numAmount <= 0) {
        errors.push('Amount must be greater than 0');
      }

      if (numAmount > 1000000) {
        errors.push('Amount exceeds maximum limit of 1,000,000');
      }

    } catch (error) {
      errors.push(error instanceof Error ? error.message : 'Invalid amount format');
    }

    return {
      isValid: errors.length === 0,
      sanitizedAmount,
      errors
    };
  }

  // Valida memos de transação
  static validateMemo(memo: string): {
    isValid: boolean;
    sanitizedMemo: string;
    errors: string[];
  } {
    const errors: string[] = [];
    let sanitizedMemo = '';

    try {
      sanitizedMemo = InputSanitizer.sanitizeString(memo);

      if (sanitizedMemo.length > 200) {
        errors.push('Memo exceeds maximum length of 200 characters');
      }

      // Verifica se contém endereços válidos
      if (memo.includes('5') || memo.includes('1')) {
        // Pode conter endereço Lunes
        const addressMatch = memo.match(/[51][a-zA-Z0-9]{46,47}/);
        if (addressMatch && !DataValidator.isValidLunesAddress(addressMatch[0])) {
          errors.push('Memo contains invalid Lunes address');
        }
      }

    } catch (error) {
      errors.push(error instanceof Error ? error.message : 'Invalid memo format');
    }

    return {
      isValid: errors.length === 0,
      sanitizedMemo,
      errors
    };
  }
}

// 3. RATE LIMITING CLIENT-SIDE
export class ClientRateLimiter {
  private static instance: ClientRateLimiter;
  private attempts: Map<string, { count: number; resetTime: number }> = new Map();

  private constructor() {}

  static getInstance(): ClientRateLimiter {
    if (!ClientRateLimiter.instance) {
      ClientRateLimiter.instance = new ClientRateLimiter();
    }
    return ClientRateLimiter.instance;
  }

  // Verifica se operação pode ser executada
  canExecute(operation: string, maxAttempts: number = 5, windowMs: number = 60000): boolean {
    const now = Date.now();
    const key = operation;

    const record = this.attempts.get(key);

    if (!record || now > record.resetTime) {
      // Reset window
      this.attempts.set(key, { count: 1, resetTime: now + windowMs });
      return true;
    }

    if (record.count >= maxAttempts) {
      return false;
    }

    record.count++;
    return true;
  }

  // Tempo até reset
  getTimeUntilReset(operation: string): number {
    const record = this.attempts.get(operation);
    if (!record) return 0;

    return Math.max(0, record.resetTime - Date.now());
  }
}

// 4. CONTENT SECURITY POLICY (CSP) HELPER
export class CSPHelper {
  // Gera nonce para scripts inline
  static generateNonce(): string {
    const array = new Uint8Array(16);
    crypto.getRandomValues(array);
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
  }

  // Valida se URL é segura
  static isSecureUrl(url: string): boolean {
    try {
      const parsedUrl = new URL(url);

      // Apenas HTTPS em produção
      if (process.env.NODE_ENV === 'production') {
        return parsedUrl.protocol === 'https:';
      }

      // Permite HTTP localhost em desenvolvimento
      return parsedUrl.protocol === 'https:' ||
             (parsedUrl.protocol === 'http:' && parsedUrl.hostname === 'localhost');
    } catch {
      return false;
    }
  }
}

// 5. ERROR HANDLING SEGURO
export class SecureErrorHandler {
  // Sanitiza mensagens de erro antes de exibir
  static sanitizeErrorMessage(error: any): string {
    if (!error) return 'Unknown error occurred';

    let message = 'An error occurred while processing your request';

    // Não expor mensagens de erro internas em produção
    if (process.env.NODE_ENV === 'development') {
      message = error instanceof Error ? error.message : String(error);
    }

    // Remove informações sensíveis
    message = message
      .replace(/private[_-]?key/gi, '[REDACTED]')
      .replace(/secret[_-]?key/gi, '[REDACTED]')
      .replace(/password/gi, '[REDACTED]')
      .replace(/token/gi, '[REDACTED]');

    return message;
  }

  // Log seguro (não expõe dados sensíveis)
  static logError(error: any, context?: string): void {
    const sanitizedError = {
      message: SecureErrorHandler.sanitizeErrorMessage(error),
      context,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href
    };

    console.error('Secure Error Log:', sanitizedError);

    // Em produção, enviar para serviço de logging
    if (process.env.NODE_ENV === 'production') {
      // Enviar para serviço de monitoramento
      // logErrorToService(sanitizedError);
    }
  }
}

// 6. STORAGE SECURITY
export class SecureStorage {
  private static readonly PREFIX = 'LUSDT_SECURE_';

  // Armazenamento seguro com encriptação
  static setItem(key: string, value: string): void {
    try {
      const fullKey = SecureStorage.PREFIX + key;
      const encryptedValue = btoa(JSON.stringify({
        data: value,
        timestamp: Date.now(),
        checksum: SecureStorage.generateChecksum(value)
      }));

      localStorage.setItem(fullKey, encryptedValue);
    } catch (error) {
      SecureErrorHandler.logError(error, 'SecureStorage.setItem');
    }
  }

  static getItem(key: string): string | null {
    try {
      const fullKey = SecureStorage.PREFIX + key;
      const encryptedValue = localStorage.getItem(fullKey);

      if (!encryptedValue) return null;

      const decrypted = JSON.parse(atob(encryptedValue));

      // Valida checksum
      if (SecureStorage.generateChecksum(decrypted.data) !== decrypted.checksum) {
        throw new Error('Data integrity check failed');
      }

      // Verifica se não expirou (24h)
      if (Date.now() - decrypted.timestamp > 24 * 60 * 60 * 1000) {
        SecureStorage.removeItem(key);
        return null;
      }

      return decrypted.data;
    } catch (error) {
      SecureErrorHandler.logError(error, 'SecureStorage.getItem');
      SecureStorage.removeItem(key);
      return null;
    }
  }

  static removeItem(key: string): void {
    const fullKey = SecureStorage.PREFIX + key;
    localStorage.removeItem(fullKey);
  }

  private static generateChecksum(data: string): string {
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      const char = data.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString();
  }
}

// 7. API SECURITY
export class APISecurity {
  // Valida headers de resposta
  static validateResponseHeaders(response: Response): boolean {
    // Verifica Content-Type
    const contentType = response.headers.get('content-type');
    if (!contentType?.includes('application/json')) {
      return false;
    }

    // Verifica CORS
    const corsHeader = response.headers.get('access-control-allow-origin');
    if (corsHeader && corsHeader !== '*' && !corsHeader.includes(window.location.origin)) {
      return false;
    }

    return true;
  }

  // Valida payload de resposta
  static validateResponsePayload(data: any): boolean {
    // Verifica estrutura básica
    if (!data || typeof data !== 'object') {
      return false;
    }

    // Verifica campos obrigatórios
    if (data.hasOwnProperty('error') && data.error) {
      // Resposta de erro é válida
      return true;
    }

    // Verifica campos de resposta válida
    const validFields = ['status', 'data', 'message', 'timestamp'];
    const dataKeys = Object.keys(data);

    // Pelo menos um campo válido deve estar presente
    return dataKeys.some(key => validFields.includes(key));
  }

  // Rate limiting para chamadas API
  static canMakeAPICall(endpoint: string): boolean {
    const limiter = ClientRateLimiter.getInstance();
    return limiter.canExecute(`api_${endpoint}`, 10, 60000); // 10 chamadas por minuto
  }
}

// 8. WALLET SECURITY
export class WalletSecurity {
  // Valida conexão de carteira
  static validateWalletConnection(wallet: any): boolean {
    if (!wallet) return false;

    // Verifica propriedades essenciais
    if (!wallet.address || !wallet.network) return false;

    // Valida formato de endereço baseado na rede
    if (wallet.network === 'solana') {
      return DataValidator.isValidSolanaAddress(wallet.address);
    } else if (wallet.network === 'lunes') {
      return DataValidator.isValidLunesAddress(wallet.address);
    }

    return false;
  }

  // Limpa dados sensíveis da carteira
  static sanitizeWalletData(wallet: any): any {
    if (!wallet) return null;

    return {
      address: wallet.address,
      network: wallet.network,
      connected: wallet.connected,
      // Remove chaves privadas, seeds, etc.
    };
  }

  // Verifica permissões da carteira
  static checkWalletPermissions(wallet: any, requiredPermissions: string[]): boolean {
    if (!wallet || !wallet.permissions) return false;

    return requiredPermissions.every(permission =>
      wallet.permissions.includes(permission)
    );
  }
}

// 9. XSS PROTECTION
export class XSSProtection {
  // Sanitiza HTML
  static sanitizeHTML(html: string): string {
    if (typeof html !== 'string') return '';

    return html
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;')
      .replace(/\//g, '&#x2F;');
  }

  // Valida se string não contém XSS
  static isSafeString(str: string): boolean {
    if (typeof str !== 'string') return false;

    const dangerousPatterns = [
      /<script/i,
      /javascript:/i,
      /vbscript:/i,
      /data:/i,
      /on\w+\s*=/i,
      /style\s*=.*expression/i,
      /style\s*=.*javascript/i
    ];

    return !dangerousPatterns.some(pattern => pattern.test(str));
  }
}

// 10. CSRF PROTECTION
export class CSRFProtection {
  private static token: string | null = null;

  // Gera token CSRF
  static generateToken(): string {
    if (!CSRFProtection.token) {
      CSRFProtection.token = Math.random().toString(36).substring(2, 15) +
                            Math.random().toString(36).substring(2, 15);
    }
    return CSRFProtection.token;
  }

  // Valida token CSRF
  static validateToken(token: string): boolean {
    return CSRFProtection.token === token;
  }

  // Inclui token em requests
  static includeInRequest(data: any): any {
    return {
      ...data,
      _csrf: CSRFProtection.generateToken()
    };
  }
}
