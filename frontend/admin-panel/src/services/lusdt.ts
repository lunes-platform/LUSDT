import { ContractPromise } from '@polkadot/api-contract';
import { polkadotService } from './polkadot';
import type { TokenInfo, TransactionResult } from '../types/contracts';
import lusdtMetadata from '../contracts/lusdt_token.json';

export class LusdtTokenService {
  private contract: ContractPromise | null = null;
  private contractAddress: string;

  constructor(contractAddress: string) {
    this.contractAddress = contractAddress;
  }

  /**
   * Inicializa o serviço do contrato LUSDT
   */
  async initialize(): Promise<void> {
    if (!this.contractAddress) {
      throw new Error('Endereço do contrato LUSDT não configurado');
    }

    this.contract = await polkadotService.getContract(
      this.contractAddress,
      lusdtMetadata
    );
    
    console.log('🪙 Serviço LUSDT Token inicializado');
  }

  /**
   * Obtém todas as informações do token
   */
  async getTokenInfo(): Promise<TokenInfo> {
    if (!this.contract) {
      throw new Error('Contrato não inicializado');
    }

    try {
      const [
        totalSupply,
        owner,
        bridgeAccount,
        emergencyAdmin,
        taxManagerContract,
        isPaused,
        pauseReason
      ] = await Promise.all([
        this.getTotalSupply(),
        this.getOwner(),
        this.getBridgeAccount(),
        this.getEmergencyAdmin(),
        this.getTaxManagerContract(),
        this.isPaused(),
        this.getPauseReason()
      ]);

      return {
        totalSupply,
        owner,
        bridgeAccount,
        emergencyAdmin,
        taxManagerContract,
        isPaused,
        pauseReason
      };
    } catch (error) {
      console.error('❌ Erro ao obter informações do token:', error);
      throw error;
    }
  }

  // === READ FUNCTIONS ===

  /**
   * Obtém o total supply de tokens
   */
  async getTotalSupply(): Promise<string> {
    if (!this.contract) throw new Error('Contrato não inicializado');
    
    const result = await polkadotService.query(
      this.contract,
      'totalSupply',
      this.contractAddress
    );
    
    return result?.replace(/,/g, '') || '0';
  }

  /**
   * Obtém o proprietário do contrato
   */
  async getOwner(): Promise<string> {
    if (!this.contract) throw new Error('Contrato não inicializado');
    
    const result = await polkadotService.query(
      this.contract,
      'getOwner',
      this.contractAddress
    );
    
    return result?.toString() || '';
  }

  /**
   * Obtém a conta bridge
   */
  async getBridgeAccount(): Promise<string> {
    if (!this.contract) throw new Error('Contrato não inicializado');
    
    const result = await polkadotService.query(
      this.contract,
      'getBridgeAccount',
      this.contractAddress
    );
    
    return result?.toString() || '';
  }

  /**
   * Obtém o administrador de emergência
   */
  async getEmergencyAdmin(): Promise<string> {
    if (!this.contract) throw new Error('Contrato não inicializado');
    
    const result = await polkadotService.query(
      this.contract,
      'getEmergencyAdmin',
      this.contractAddress
    );
    
    return result?.toString() || '';
  }

  /**
   * Obtém o contrato tax manager
   */
  async getTaxManagerContract(): Promise<string> {
    if (!this.contract) throw new Error('Contrato não inicializado');
    
    const result = await polkadotService.query(
      this.contract,
      'getTaxManagerContract',
      this.contractAddress
    );
    
    return result?.toString() || '';
  }

  /**
   * Verifica se o contrato está pausado
   */
  async isPaused(): Promise<boolean> {
    if (!this.contract) throw new Error('Contrato não inicializado');
    
    const result = await polkadotService.query(
      this.contract,
      'isPaused',
      this.contractAddress
    );
    
    return result === true || result === 'true';
  }

  /**
   * Obtém o motivo da pausa (se pausado)
   */
  async getPauseReason(): Promise<string | undefined> {
    if (!this.contract) throw new Error('Contrato não inicializado');
    
    try {
      const result = await polkadotService.query(
        this.contract,
        'pauseReason',
        this.contractAddress
      );
      
      return result?.toString();
    } catch (error) {
      // Se não conseguir obter o motivo, retorna undefined
      return undefined;
    }
  }

  /**
   * Obtém o saldo de uma conta específica
   */
  async getBalanceOf(account: string): Promise<string> {
    if (!this.contract) throw new Error('Contrato não inicializado');
    
    const result = await polkadotService.query(
      this.contract,
      'balanceOf',
      this.contractAddress,
      account
    );
    
    return result?.replace(/,/g, '') || '0';
  }

  // === WRITE FUNCTIONS ===

  /**
   * Define nova conta bridge (apenas owner)
   */
  async setBridgeAccount(signerAddress: string, newBridge: string): Promise<TransactionResult> {
    if (!this.contract) throw new Error('Contrato não inicializado');

    try {
      const txHash = await polkadotService.executeTransaction(
        this.contract,
        'setBridgeAccount',
        signerAddress,
        '0',
        newBridge
      );

      return {
        txHash,
        success: true
      };
    } catch (error) {
      console.error('❌ Erro ao definir conta bridge:', error);
      return {
        txHash: '',
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Define novo contrato tax manager (apenas owner)
   */
  async setTaxManagerContract(signerAddress: string, newTaxManager: string): Promise<TransactionResult> {
    if (!this.contract) throw new Error('Contrato não inicializado');

    try {
      const txHash = await polkadotService.executeTransaction(
        this.contract,
        'setTaxManagerContract',
        signerAddress,
        '0',
        newTaxManager
      );

      return {
        txHash,
        success: true
      };
    } catch (error) {
      console.error('❌ Erro ao definir tax manager:', error);
      return {
        txHash: '',
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Atualiza conta bridge (apenas owner)
   */
  async updateBridgeAccount(signerAddress: string, newBridge: string): Promise<TransactionResult> {
    if (!this.contract) throw new Error('Contrato não inicializado');

    try {
      const txHash = await polkadotService.executeTransaction(
        this.contract,
        'updateBridgeAccount',
        signerAddress,
        '0',
        newBridge
      );

      return {
        txHash,
        success: true
      };
    } catch (error) {
      console.error('❌ Erro ao atualizar conta bridge:', error);
      return {
        txHash: '',
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Atualiza administrador de emergência (apenas owner)
   */
  async updateEmergencyAdmin(signerAddress: string, newAdmin: string): Promise<TransactionResult> {
    if (!this.contract) throw new Error('Contrato não inicializado');

    try {
      const txHash = await polkadotService.executeTransaction(
        this.contract,
        'updateEmergencyAdmin',
        signerAddress,
        '0',
        newAdmin
      );

      return {
        txHash,
        success: true
      };
    } catch (error) {
      console.error('❌ Erro ao atualizar admin de emergência:', error);
      return {
        txHash: '',
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Pausa o contrato em emergência (apenas emergency admin)
   */
  async emergencyPause(signerAddress: string, reason: string): Promise<TransactionResult> {
    if (!this.contract) throw new Error('Contrato não inicializado');

    try {
      const txHash = await polkadotService.executeTransaction(
        this.contract,
        'emergencyPause',
        signerAddress,
        '0',
        reason
      );

      return {
        txHash,
        success: true
      };
    } catch (error) {
      console.error('❌ Erro ao pausar contrato:', error);
      return {
        txHash: '',
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Remove pausa de emergência (apenas emergency admin)
   */
  async emergencyUnpause(signerAddress: string): Promise<TransactionResult> {
    if (!this.contract) throw new Error('Contrato não inicializado');

    try {
      const txHash = await polkadotService.executeTransaction(
        this.contract,
        'emergencyUnpause',
        signerAddress,
        '0'
      );

      return {
        txHash,
        success: true
      };
    } catch (error) {
      console.error('❌ Erro ao remover pausa:', error);
      return {
        txHash: '',
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Cria novos tokens (apenas bridge)
   */
  async mint(signerAddress: string, to: string, amount: string): Promise<TransactionResult> {
    if (!this.contract) throw new Error('Contrato não inicializado');

    try {
      const txHash = await polkadotService.executeTransaction(
        this.contract,
        'mint',
        signerAddress,
        '0',
        to,
        amount
      );

      return {
        txHash,
        success: true
      };
    } catch (error) {
      console.error('❌ Erro ao mintar tokens:', error);
      return {
        txHash: '',
        success: false,
        error: error.message
      };
    }
  }

  // === UTILITY FUNCTIONS ===

  /**
   * Converte valor de LUSDT para wei (assumindo 6 decimais)
   */
  static toWei(lusdtAmount: string | number): string {
    const amount = typeof lusdtAmount === 'string' ? parseFloat(lusdtAmount) : lusdtAmount;
    return Math.floor(amount * 1_000_000).toString();
  }

  /**
   * Converte valor de wei para LUSDT (assumindo 6 decimais)
   */
  static fromWei(weiAmount: string | number): string {
    const amount = typeof weiAmount === 'string' ? parseInt(weiAmount) : weiAmount;
    return (amount / 1_000_000).toFixed(6);
  }

  /**
   * Formata endereço para exibição
   */
  static formatAddress(address: string): string {
    if (!address) return '';
    return `${address.slice(0, 6)}...${address.slice(-6)}`;
  }

  /**
   * Obtém o endereço do contrato
   */
  getContractAddress(): string {
    return this.contractAddress;
  }
}