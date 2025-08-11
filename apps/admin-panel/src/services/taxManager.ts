import { ContractPromise } from '@polkadot/api-contract';
import { polkadotService } from './polkadot';
import type { TaxManagerInfo, DistributionWallets, FeeConfig, TransactionResult } from '../types/contracts';
import taxManagerMetadata from '../contracts/tax_manager.json';

const USE_MOCKS = (import.meta as any).env?.VITE_USE_MOCKS === 'true';

function toPlainString(value: unknown): string {
  if (value === null || value === undefined) return '';
  const s = typeof value === 'string' ? value : (value as any)?.toString?.() ?? String(value);
  return s.replace(/,/g, '');
}

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
    if (!this.contractAddress && !USE_MOCKS) {
      throw new Error('Endereço do contrato Tax Manager não configurado');
    }
    if (USE_MOCKS) {
      console.log('📊 Serviço Tax Manager inicializado (mock)');
      return;
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
    if (USE_MOCKS) return '5FMockOwnerAddress1234567890MockOwnerAddr';
    if (!this.contract) throw new Error('Contrato não inicializado');
    
    const result = await polkadotService.query(
      this.contract,
      'getOwner',
      this.contractAddress
    );
    
    return toPlainString(result);
  }

  /**
   * Obtém o preço atual do LUNES em USD
   */
  async getLunesPrice(): Promise<string> {
    if (USE_MOCKS) return '1.00';
    if (!this.contract) throw new Error('Contrato não inicializado');
    
    const result = await polkadotService.query(
      this.contract,
      'getLunesPrice',
      this.contractAddress
    );
    
    return toPlainString(result) || '0';
  }

  /**
   * Obtém o volume mensal em USD
   */
  async getMonthlyVolume(): Promise<string> {
    if (USE_MOCKS) return '5000000';
    if (!this.contract) throw new Error('Contrato não inicializado');
    
    const result = await polkadotService.query(
      this.contract,
      'getMonthlyVolume',
      this.contractAddress
    );
    
    return toPlainString(result) || '0';
  }

  /**
   * Obtém as carteiras de distribuição
   */
  async getDistributionWallets(): Promise<DistributionWallets> {
    if (USE_MOCKS) {
      return {
        development: '5FdevWalletMockxxxxxxxxxxxxxxxxxxxxxxx',
        marketing: '5FmarketingMockxxxxxxxxxxxxxxxxxxxxxxxx',
        burn: '5FburnWalletMockxxxxxxxxxxxxxxxxxxxxxxxxxx',
        reserve: '5FreserveMockxxxxxxxxxxxxxxxxxxxxxxxxxxx'
      };
    }
    if (!this.contract) throw new Error('Contrato não inicializado');
    
    const result = await polkadotService.query(
      this.contract,
      'getDistributionWallets',
      this.contractAddress
    );
    
    // Assumindo que o resultado vem como um objeto com as propriedades
    const r: any = result as any;
    return {
      development: toPlainString(r?.development),
      marketing: toPlainString(r?.marketing),
      burn: toPlainString(r?.burn),
      reserve: toPlainString(r?.reserve)
    };
  }

  /**
   * Obtém a configuração de taxas
   */
  async getFeeConfig(): Promise<FeeConfig> {
    if (USE_MOCKS) {
      return {
        baseFeeUsd: '0',
        percentageFee: 25,
        minFeeUsd: '0',
        maxFeeUsd: '0'
      };
    }
    if (!this.contract) throw new Error('Contrato não inicializado');
    await polkadotService.query(
      this.contract,
      'getFeeConfig',
      this.contractAddress
    );
    // Enquanto contrato real não retorna FeeConfig estruturado, usar defaults
    return {
      baseFeeUsd: '0',
      percentageFee: 25,
      minFeeUsd: '0',
      maxFeeUsd: '0'
    };
  }

  /**
   * Calcula a taxa para uma transação
   */
  async calculateFee(amountUsd: string): Promise<string> {
    if (USE_MOCKS) return '500000';
    if (!this.contract) throw new Error('Contrato não inicializado');
    
    const result = await polkadotService.query(
      this.contract,
      'calculateFee',
      this.contractAddress,
      amountUsd
    );
    
    return toPlainString(result) || '0';
  }

  // === WRITE FUNCTIONS ===

  /**
   * Atualiza o preço do LUNES (apenas owner)
   */
  async updateLunesPrice(signerAddress: string, newPrice: string): Promise<TransactionResult> {
    if (USE_MOCKS) {
      return { txHash: '0xMOCKTX', error: null, status: 'finalized' };
    }
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
        error: null,
        status: 'finalized'
      };
    } catch (error) {
      console.error('❌ Erro ao atualizar preço do LUNES:', error);
      return {
        txHash: null,
        error: error instanceof Error ? error.message : String(error),
        status: 'error'
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
    if (USE_MOCKS) {
      return { txHash: '0xMOCKTX', error: null, status: 'finalized' };
    }
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
        error: null,
        status: 'finalized'
      };
    } catch (error) {
      console.error('❌ Erro ao atualizar carteiras de distribuição:', error);
      return {
        txHash: null,
        error: error instanceof Error ? error.message : String(error),
        status: 'error'
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
    if (USE_MOCKS) {
      return { txHash: '0xMOCKTX', error: null, status: 'finalized' };
    }
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
        error: null,
        status: 'finalized'
      };
    } catch (error) {
      console.error('❌ Erro ao atualizar configuração de taxas:', error);
      return {
        txHash: null,
        error: error instanceof Error ? error.message : String(error),
        status: 'error'
      };
    }
  }

  /**
   * Obtém a configuração de distribuição de taxas
   */
  async getFeeDistribution(): Promise<{
    dev: number;
    dao: number;
    backing?: number;
    rewards?: number;
    burn?: number;
    liquidity?: number;
  }> {
    // Mock de dados - em produção viria do contrato
    return {
      dev: 40,      // 40%
      dao: 30,      // 30%
      backing: 15,  // 15%
      rewards: 10,  // 10%
      burn: 5       // 5%
    };
  }

  /**
   * Obtém analytics de taxas
   */
  async getTaxAnalytics(): Promise<{
    totalCollected: string;
    monthlyRevenue: string;
    averageFee: string;
    transactionCount: number;
  }> {
    // Mock de dados - em produção viria de indexer
    return {
      totalCollected: '2500000000', // 2.5k LUSDT
      monthlyRevenue: '500000000',  // 500 LUSDT
      averageFee: '5000000',        // 5 LUSDT
      transactionCount: 1250
    };
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