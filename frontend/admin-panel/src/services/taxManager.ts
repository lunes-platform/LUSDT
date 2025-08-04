import { ContractPromise } from '@polkadot/api-contract';
import { polkadotService } from './polkadot';
import type { TaxManagerInfo, DistributionWallets, FeeConfig, TransactionResult } from '../types/contracts';
import taxManagerMetadata from '../contracts/tax_manager.json';

export class TaxManagerService {
  private contract: ContractPromise | null = null;
  private contractAddress: string;

  constructor(contractAddress: string) {
    this.contractAddress = contractAddress;
  }

  /**
   * Inicializa o serviço do Tax Manager
   */
  async initialize(): Promise<void> {
    if (!this.contractAddress) {
      throw new Error('Endereço do contrato Tax Manager não configurado');
    }

    this.contract = await polkadotService.getContract(
      this.contractAddress,
      taxManagerMetadata
    );
    
    console.log('📊 Serviço Tax Manager inicializado');
  }

  /**
   * Obtém todas as informações do tax manager
   */
  async getTaxManagerInfo(): Promise<TaxManagerInfo> {
    if (!this.contract) {
      throw new Error('Contrato não inicializado');
    }

    try {
      const [
        owner,
        lunesPrice,
        monthlyVolume,
        distributionWallets,
        feeConfig
      ] = await Promise.all([
        this.getOwner(),
        this.getLunesPrice(),
        this.getMonthlyVolume(),
        this.getDistributionWallets(),
        this.getFeeConfig()
      ]);

      return {
        owner,
        lunesPrice,
        monthlyVolume,
        distributionWallets,
        feeConfig
      };
    } catch (error) {
      console.error('❌ Erro ao obter informações do tax manager:', error);
      throw error;
    }
  }

  // === READ FUNCTIONS ===

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
   * Obtém o preço atual do LUNES em USD
   */
  async getLunesPrice(): Promise<string> {
    if (!this.contract) throw new Error('Contrato não inicializado');
    
    const result = await polkadotService.query(
      this.contract,
      'getLunesPrice',
      this.contractAddress
    );
    
    return result?.replace(/,/g, '') || '0';
  }

  /**
   * Obtém o volume mensal em USD
   */
  async getMonthlyVolume(): Promise<string> {
    if (!this.contract) throw new Error('Contrato não inicializado');
    
    const result = await polkadotService.query(
      this.contract,
      'getMonthlyVolume',
      this.contractAddress
    );
    
    return result?.replace(/,/g, '') || '0';
  }

  /**
   * Obtém as carteiras de distribuição
   */
  async getDistributionWallets(): Promise<DistributionWallets> {
    if (!this.contract) throw new Error('Contrato não inicializado');
    
    const result = await polkadotService.query(
      this.contract,
      'getDistributionWallets',
      this.contractAddress
    );
    
    // Assumindo que o resultado vem como um objeto com as propriedades
    return {
      development: result?.development?.toString() || '',
      marketing: result?.marketing?.toString() || '',
      burn: result?.burn?.toString() || '',
      reserve: result?.reserve?.toString() || ''
    };
  }

  /**
   * Obtém a configuração de taxas
   */
  async getFeeConfig(): Promise<FeeConfig> {
    if (!this.contract) throw new Error('Contrato não inicializado');
    
    const result = await polkadotService.query(
      this.contract,
      'getFeeConfig',
      this.contractAddress
    );
    
    // Assumindo que o resultado vem como um objeto com as propriedades
    return {
      baseFeeUsd: result?.baseFeeUsd?.replace(/,/g, '') || '0',
      percentageFee: parseInt(result?.percentageFee?.toString() || '0'),
      minFeeUsd: result?.minFeeUsd?.replace(/,/g, '') || '0',
      maxFeeUsd: result?.maxFeeUsd?.replace(/,/g, '') || '0'
    };
  }

  /**
   * Calcula a taxa para uma transação
   */
  async calculateFee(amountUsd: string): Promise<string> {
    if (!this.contract) throw new Error('Contrato não inicializado');
    
    const result = await polkadotService.query(
      this.contract,
      'calculateFee',
      this.contractAddress,
      amountUsd
    );
    
    return result?.replace(/,/g, '') || '0';
  }

  // === WRITE FUNCTIONS ===

  /**
   * Atualiza o preço do LUNES (apenas owner)
   */
  async updateLunesPrice(signerAddress: string, newPrice: string): Promise<TransactionResult> {
    if (!this.contract) throw new Error('Contrato não inicializado');

    try {
      const txHash = await polkadotService.executeTransaction(
        this.contract,
        'updateLunesPrice',
        signerAddress,
        '0',
        newPrice
      );

      return {
        txHash,
        success: true
      };
    } catch (error) {
      console.error('❌ Erro ao atualizar preço do LUNES:', error);
      return {
        txHash: '',
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Atualiza as carteiras de distribuição (apenas owner)
   */
  async updateDistributionWallets(
    signerAddress: string, 
    wallets: DistributionWallets
  ): Promise<TransactionResult> {
    if (!this.contract) throw new Error('Contrato não inicializado');

    try {
      const txHash = await polkadotService.executeTransaction(
        this.contract,
        'updateDistributionWallets',
        signerAddress,
        '0',
        wallets
      );

      return {
        txHash,
        success: true
      };
    } catch (error) {
      console.error('❌ Erro ao atualizar carteiras de distribuição:', error);
      return {
        txHash: '',
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Atualiza a configuração de taxas (apenas owner)
   */
  async updateFeeConfig(
    signerAddress: string, 
    config: FeeConfig
  ): Promise<TransactionResult> {
    if (!this.contract) throw new Error('Contrato não inicializado');

    try {
      const txHash = await polkadotService.executeTransaction(
        this.contract,
        'updateFeeConfig',
        signerAddress,
        '0',
        config
      );

      return {
        txHash,
        success: true
      };
    } catch (error) {
      console.error('❌ Erro ao atualizar configuração de taxas:', error);
      return {
        txHash: '',
        success: false,
        error: error.message
      };
    }
  }

  // === UTILITY FUNCTIONS ===

  /**
   * Converte preço em USD para wei (assumindo 6 decimais)
   */
  static usdToWei(usdAmount: string | number): string {
    const amount = typeof usdAmount === 'string' ? parseFloat(usdAmount) : usdAmount;
    return Math.floor(amount * 1_000_000).toString();
  }

  /**
   * Converte wei para USD (assumindo 6 decimais)
   */
  static weiToUsd(weiAmount: string | number): string {
    const amount = typeof weiAmount === 'string' ? parseInt(weiAmount) : weiAmount;
    return (amount / 1_000_000).toFixed(2);
  }

  /**
   * Converte basis points para porcentagem
   */
  static basisPointsToPercent(basisPoints: number): number {
    return basisPoints / 100;
  }

  /**
   * Converte porcentagem para basis points
   */
  static percentToBasisPoints(percent: number): number {
    return Math.floor(percent * 100);
  }

  /**
   * Formata valor USD para exibição
   */
  static formatUsd(amount: string | number): string {
    const value = typeof amount === 'string' ? parseFloat(amount) : amount;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 6
    }).format(value);
  }

  /**
   * Obtém o endereço do contrato
   */
  getContractAddress(): string {
    return this.contractAddress;
  }
}