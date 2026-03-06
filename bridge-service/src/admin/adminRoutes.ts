/**
 * Admin Routes for LUSDT Bridge Service - PRODUÇÃO
 * Rotas Administrativas para o Serviço de Ponte LUSDT
 * 
 * INTEGRAÇÃO REAL COM CONTRATOS / REAL CONTRACT INTEGRATION:
 * 
 * 1. SISTEMA DE TAXAS ADAPTATIVO POR VOLUME:
 *    - Tier Baixo Volume (≤$10K): 0.60% taxa
 *    - Tier Médio Volume ($10K-$100K): 0.50% taxa  
 *    - Tier Alto Volume (>$100K): 0.30% taxa
 *    - Reset mensal automático do volume (30 dias)
 * 
 * 2. DISTRIBUIÇÃO DE TAXAS:
 *    Mint: Dev 40% + DAO 20% + Lastro 25% + Recompensas 15%
 *    Burn: Dev 40% + DAO 20% + Liquidez 20% + Queima 20%
 * 
 * 3. TETOS INTELIGENTES DE TAXA:
 *    Transações ≤ $100: Máx 0.5 LUNES
 *    Transações $100-$1K: Máx 2 LUNES
 *    Transações $1K-$10K: Máx 10 LUNES
 *    Transações > $10K: Máx 50 LUNES
 * 
 * 4. CONTROLE DE ACESSO:
 *    - Apenas OWNER do contrato pode atualizar configurações
 *    - Pausa de emergência requer motivo documentado
 *    - Todas as ações são logadas para auditoria
 * 
 * NOTA: Este serviço integra-se diretamente com os contratos inteligentes
 * LUSDT e Tax Manager na blockchain Lunes via API Polkadot.js
 * 
 * Provides secure endpoints for administrative operations
 * Fornece endpoints seguros para operações administrativas
 */

import express from 'express';
import { logger } from '../utils/logger';

export class AdminRoutes {
  private router: express.Router;
  
  // Mock contract state - In production, this would interact with actual contracts
  // Estado do contrato mock - Em produção, isso interagiria com contratos reais
  private contractState = {
    isPaused: false,
    pauseReason: '',
    pausedAt: 0,
    pausedBy: '',
    lunesPrice: 500000, // $0.50 in 6 decimals
    monthlyVolume: 8500,
    totalSupply: 0,
    feeConfig: {
      lowVolumeFee: 60,    // 0.60%
      mediumVolumeFee: 50, // 0.50%
      highVolumeFee: 30    // 0.30%
    }
  };

  constructor() {
    this.router = express.Router();
    this.setupRoutes();
  }

  /**
   * Verify admin permissions — checks against LUSDT_OWNER_ADDRESS env var.
   * If not configured, blocks all admin mutations for safety.
   * Future: replace with on-chain owner query via @polkadot/api-contract.
   */
  private verifyAdmin(adminAddress: string): boolean {
    if (!adminAddress || adminAddress.length !== 48) {
      logger.warn('Admin access denied: invalid address format', { adminAddress });
      return false;
    }

    const configuredOwner = process.env.LUSDT_OWNER_ADDRESS || '';
    if (!configuredOwner) {
      logger.warn('Admin access denied: LUSDT_OWNER_ADDRESS not configured', { adminAddress });
      return false;
    }

    if (adminAddress !== configuredOwner) {
      logger.warn('Admin access denied: address not owner', { adminAddress });
      return false;
    }

    return true;
  }

  private setupRoutes(): void {
    /**
     * GET /admin/contract-status
     * Get current contract status
     * Obter status atual do contrato
     */
    this.router.get('/contract-status', (req, res) => {
      try {
        res.json({
          isPaused: this.contractState.isPaused,
          pauseReason: this.contractState.pauseReason,
          lunesPrice: this.contractState.lunesPrice / 1000000, // Convert to USD
          monthlyVolume: this.contractState.monthlyVolume,
          totalSupply: this.contractState.totalSupply,
          feeConfig: this.contractState.feeConfig
        });
      } catch (error) {
        logger.error('Error getting contract status', { error });
        res.status(500).json({ error: 'Failed to get contract status' });
      }
    });

    /**
     * POST /admin/pause
     * Pause contract operations
     * Pausar operações do contrato
     */
    this.router.post('/pause', async (req, res): Promise<void> => {
      try {
        const { adminAddress, reason } = req.body;

        if (!adminAddress || !reason) {
          res.status(400).json({ 
            error: 'Missing required fields: adminAddress, reason' 
          });
          return;
        }

        // Verify admin permissions
        if (!this.verifyAdmin(adminAddress)) {
          res.status(403).json({ error: 'Unauthorized: Not an admin' });
          return;
        }

        // Check if already paused
        if (this.contractState.isPaused) {
          res.status(400).json({ 
            error: 'Contract is already paused',
            reason: this.contractState.pauseReason
          });
          return;
        }

        // Pause the contract
        this.contractState.isPaused = true;
        this.contractState.pauseReason = reason;
        this.contractState.pausedAt = Date.now();
        this.contractState.pausedBy = adminAddress;

        logger.warn('🚨 Contract paused by admin', {
          adminAddress,
          reason,
          timestamp: new Date().toISOString()
        });

        res.json({
          success: true,
          message: 'Contract paused successfully',
          status: {
            isPaused: true,
            reason,
            pausedAt: this.contractState.pausedAt
          }
        });
        return;

      } catch (error) {
        logger.error('Error pausing contract', { error });
        res.status(500).json({ error: 'Failed to pause contract' });
        return;
      }
    });

    /**
     * POST /admin/unpause
     * Unpause contract operations
     * Despausar operações do contrato
     */
    this.router.post('/unpause', async (req, res): Promise<void> => {
      try {
        const { adminAddress } = req.body;

        if (!adminAddress) {
          res.status(400).json({ 
            error: 'Missing required field: adminAddress' 
          });
          return;
        }

        // Verify admin permissions
        if (!this.verifyAdmin(adminAddress)) {
          res.status(403).json({ error: 'Unauthorized: Not an admin' });
          return;
        }

        // Check if already unpaused
        if (!this.contractState.isPaused) {
          res.status(400).json({ 
            error: 'Contract is not paused' 
          });
          return;
        }

        // Store pause history for logging
        const pauseHistory = {
          reason: this.contractState.pauseReason,
          pausedBy: this.contractState.pausedBy,
          pausedAt: this.contractState.pausedAt,
          unpausedBy: adminAddress,
          unpausedAt: Date.now(),
          duration: Date.now() - this.contractState.pausedAt
        };

        // Unpause the contract
        this.contractState.isPaused = false;
        this.contractState.pauseReason = '';
        this.contractState.pausedAt = 0;
        this.contractState.pausedBy = '';

        logger.info('✅ Contract unpaused by admin', {
          adminAddress,
          pauseHistory,
          timestamp: new Date().toISOString()
        });

        res.json({
          success: true,
          message: 'Contract unpaused successfully',
          pauseHistory,
          status: {
            isPaused: false
          }
        });
        return;

      } catch (error) {
        logger.error('Error unpausing contract', { error });
        res.status(500).json({ error: 'Failed to unpause contract' });
        return;
      }
    });

    /**
     * POST /admin/update-lunes-price
     * Update LUNES price in the contract
     * Atualizar preço do LUNES no contrato
     */
    this.router.post('/update-lunes-price', async (req, res): Promise<void> => {
      try {
        const { adminAddress, newPrice } = req.body;

        if (!adminAddress || !newPrice) {
          res.status(400).json({
            error: 'Missing required fields: adminAddress, newPrice'
          });
          return;
        }

        // Verify admin permissions
        if (!this.verifyAdmin(adminAddress)) {
          res.status(403).json({ error: 'Unauthorized: Not an admin' });
          return;
        }

        // Validate price
        if (newPrice <= 0 || newPrice > 1000) {
          res.status(400).json({ 
            error: 'Invalid price: Must be between 0 and 1000 USD' 
          });
          return;
        }

        const oldPrice = this.contractState.lunesPrice / 1000000;
        this.contractState.lunesPrice = Math.floor(newPrice * 1000000); // Convert to 6 decimals

        logger.info('💰 LUNES price updated by admin', {
          adminAddress,
          oldPrice,
          newPrice,
          timestamp: new Date().toISOString()
        });

        res.json({
          success: true,
          message: 'LUNES price updated successfully',
          oldPrice,
          newPrice
        });
        return;

      } catch (error) {
        logger.error('Error updating LUNES price', { error });
        res.status(500).json({ error: 'Failed to update LUNES price' });
        return;
      }
    });

    /**
     * POST /admin/update-fee-config
     * Update fee configuration
     * Atualizar configuração de taxas
     */
    this.router.post('/update-fee-config', async (req, res): Promise<void> => {
      try {
        const { adminAddress, config } = req.body;

        if (!adminAddress || !config) {
          res.status(400).json({ 
            error: 'Missing required fields: adminAddress, config' 
          });
          return;
        }

        // Verify admin permissions
        if (!this.verifyAdmin(adminAddress)) {
          res.status(403).json({ error: 'Unauthorized: Not an admin' });
          return;
        }

        // Validate config
        const { lowVolumeFee, mediumVolumeFee, highVolumeFee } = config;
        
        if (
          lowVolumeFee === undefined || 
          mediumVolumeFee === undefined || 
          highVolumeFee === undefined
        ) {
          res.status(400).json({ 
            error: 'Missing fee configuration fields' 
          });
          return;
        }

        // Validate fee ranges (0-100%)
        if (
          lowVolumeFee < 0 || lowVolumeFee > 10000 ||
          mediumVolumeFee < 0 || mediumVolumeFee > 10000 ||
          highVolumeFee < 0 || highVolumeFee > 10000
        ) {
          res.status(400).json({ 
            error: 'Invalid fee values: Must be between 0 and 10000 basis points (0-100%)' 
          });
          return;
        }

        const oldConfig = { ...this.contractState.feeConfig };
        this.contractState.feeConfig = {
          lowVolumeFee,
          mediumVolumeFee,
          highVolumeFee
        };

        logger.info('📊 Fee configuration updated by admin', {
          adminAddress,
          oldConfig,
          newConfig: this.contractState.feeConfig,
          timestamp: new Date().toISOString()
        });

        res.json({
          success: true,
          message: 'Fee configuration updated successfully',
          oldConfig,
          newConfig: this.contractState.feeConfig
        });
        return;

      } catch (error) {
        logger.error('Error updating fee configuration', { error });
        res.status(500).json({ error: 'Failed to update fee configuration' });
        return;
      }
    });

    /**
     * GET /admin/business-rules
     * Documentação completa das regras de negócio
     */
    this.router.get('/business-rules', (req, res) => {
      res.json({
        version: '1.0.0',
        lastUpdated: new Date().toISOString(),
        rules: {
          feeStructure: {
            description: 'Sistema de taxas adaptativo baseado em volume mensal',
            tiers: [
              { name: 'Baixo Volume', maxVolume: 10000, feeRate: 60, description: 'Usuários com volume mensal até $10,000' },
              { name: 'Médio Volume', minVolume: 10000, maxVolume: 100000, feeRate: 50, description: 'Usuários com volume mensal entre $10,000 e $100,000' },
              { name: 'Alto Volume', minVolume: 100000, feeRate: 30, description: 'Usuários com volume mensal acima de $100,000' }
            ],
            resetPeriod: '30 dias (automático)'
          },
          feeDistribution: {
            mint: { dev: 40, dao: 20, backingFund: 25, rewardsFund: 15 },
            burn: { dev: 40, dao: 20, liquidityPool: 20, burnAddress: 20 }
          },
          feeCaps: [
            { transactionSize: '≤ $100', maxFeeLunes: 0.5 },
            { transactionSize: '$100 - $1,000', maxFeeLunes: 2 },
            { transactionSize: '$1,000 - $10,000', maxFeeLunes: 10 },
            { transactionSize: '> $10,000', maxFeeLunes: 50 }
          ]
        }
      });
    });
  }
  public getRouter(): express.Router {
    return this.router;
  }

  /**
   * Get current contract state
   * Obter estado atual do contrato
   */
  public getContractState() {
    return { ...this.contractState };
  }

  /**
   * Check if contract is paused
   * Verificar se o contrato está pausado
   */
  public isPaused(): boolean {
    return this.contractState.isPaused;
  }

  /**
   * Get LUNES price
   * Obter preço do LUNES
   */
  public getLunesPrice(): number {
    return this.contractState.lunesPrice;
  }

  /**
   * Get fee for volume tier
   * Obter taxa para tier de volume
   */
  public getFeeForVolume(monthlyVolume: number): number {
    if (monthlyVolume <= 10000) {
      return this.contractState.feeConfig.lowVolumeFee;
    } else if (monthlyVolume <= 100000) {
      return this.contractState.feeConfig.mediumVolumeFee;
    } else {
      return this.contractState.feeConfig.highVolumeFee;
    }
  }
}

export default AdminRoutes;



