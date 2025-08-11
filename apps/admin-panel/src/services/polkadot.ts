import { ApiPromise, WsProvider } from '@polkadot/api';
import { web3Accounts, web3Enable, web3FromAddress } from '@polkadot/extension-dapp';
import { ContractPromise } from '@polkadot/api-contract';
import type { Account } from '../types/contracts';

// Configurações de rede
export const NETWORKS = {
  local: 'ws://127.0.0.1:9944',
  rococo: 'wss://rococo-contracts-rpc.polkadot.io',
  // Adicione aqui a URL real da rede Lunes quando disponível
  lunes: 'wss://node.lunes.io'
};

class PolkadotService {
  private api: ApiPromise | null = null;
  private accounts: Account[] = [];
  private currentNetwork: string = NETWORKS.local;

  /**
   * Conecta à rede blockchain
   */
  async connect(networkUrl: string = NETWORKS.local): Promise<ApiPromise> {
    try {
      console.log('🔗 Conectando à rede:', networkUrl);
      
      const provider = new WsProvider(networkUrl);
      this.api = await ApiPromise.create({ provider });
      await this.api.isReady;
      
      this.currentNetwork = networkUrl;
      console.log('✅ Conectado com sucesso à blockchain');
      
      return this.api;
    } catch (error) {
      console.error('❌ Erro ao conectar à blockchain:', error);
      const msg = error instanceof Error ? error.message : String(error);
      throw new Error(`Falha na conexão: ${msg}`);
    }
  }

  /**
   * Habilita e conecta carteiras
   */
  async enableWallet(): Promise<Account[]> {
    try {
      console.log('🔐 Habilitando carteiras...');
      
      const extensions = await web3Enable('LUSDT Admin Panel');
      if (extensions.length === 0) {
        throw new Error('Nenhuma carteira encontrada. Instale a extensão Polkadot.js');
      }
      
      const accounts = await web3Accounts();
      this.accounts = accounts.map(account => ({
        address: account.address,
        name: account.meta.name ?? '',
        meta: {
          name: account.meta.name ?? '',
          source: account.meta.source
        }
      }));
      
      console.log(`✅ ${this.accounts.length} conta(s) encontrada(s)`);
      
      return this.accounts;
    } catch (error) {
      console.error('❌ Erro ao habilitar carteira:', error);
      throw error instanceof Error ? error : new Error(String(error));
    }
  }

  /**
   * Cria uma instância de contrato
   */
  async getContract(address: string, metadata: any): Promise<ContractPromise> {
    if (!this.api) {
      throw new Error('API não conectada. Chame connect() primeiro.');
    }
    
    try {
      const contract = new ContractPromise(this.api, metadata, address);
      console.log('📋 Contrato inicializado:', address);
      return contract;
    } catch (error) {
      console.error('❌ Erro ao inicializar contrato:', error);
      const msg = error instanceof Error ? error.message : String(error);
      throw new Error(`Falha ao inicializar contrato: ${msg}`);
    }
  }

  /**
   * Executa uma query (leitura) no contrato
   */
  async query(
    contract: ContractPromise,
    method: string,
    caller: string,
    ...args: any[]
  ): Promise<any> {
    try {
      const { result, output } = await contract.query[method](
        caller,
        { gasLimit: -1 },
        ...args
      );
      
      if (result.isOk && output) {
        return output.toHuman();
      }
      
      throw new Error(`Query falhou: ${result.asErr || 'Erro desconhecido'}`);
    } catch (error) {
      console.error(`❌ Erro na query ${method}:`, error);
      throw error instanceof Error ? error : new Error(String(error));
    }
  }

  /**
   * Executa uma transação no contrato
   */
  async executeTransaction(
    contract: ContractPromise,
    method: string,
    signerAddress: string,
    value: string = '0',
    ...args: any[]
  ): Promise<string> {
    try {
      const injector = await web3FromAddress(signerAddress);
      
      console.log(`📤 Executando transação: ${method}`);
      
      return new Promise((resolve, reject) => {
        contract.tx[method](
          { 
            gasLimit: -1,
            value: value
          },
          ...args
        ).signAndSend(
          signerAddress, 
          { signer: injector.signer }, 
          (result) => {
            if (result.status.isInBlock) {
              console.log(`✅ Transação ${method} incluída no bloco:`, result.txHash.toString());
              resolve(result.txHash.toString());
            } else if (result.status.isFinalized) {
              console.log(`🎯 Transação ${method} finalizada`);
            } else if (result.isError) {
              console.error(`❌ Transação ${method} falhou`);
              reject(new Error('Transação falhou'));
            }
          }
        );
      });
    } catch (error) {
      console.error(`❌ Erro ao executar transação ${method}:`, error);
      throw error instanceof Error ? error : new Error(String(error));
    }
  }

  /**
   * Obtém informações da rede
   */
  async getNetworkInfo(): Promise<{
    chain: string;
    version: string;
    properties: any;
    currentNetwork: string;
  } | null> {
    if (!this.api) return null;
    
    try {
      const [chain, version, properties] = await Promise.all([
        this.api.rpc.system.chain(),
        this.api.rpc.system.version(),
        this.api.rpc.system.properties()
      ]);
      
      return {
        chain: chain.toString(),
        version: version.toString(),
        properties: properties.toHuman(),
        currentNetwork: this.currentNetwork
      };
    } catch (error) {
      console.error('❌ Erro ao obter informações da rede:', error);
      return null;
    }
  }

  /**
   * Desconecta da rede
   */
  async disconnect() {
    if (this.api) {
      await this.api.disconnect();
      this.api = null;
      this.accounts = [];
      console.log('🔌 Desconectado da blockchain');
    }
  }

  // Getters
  getApi(): ApiPromise | null {
    return this.api;
  }

  getAccounts(): Account[] {
    return this.accounts;
  }

  isConnected(): boolean {
    return this.api !== null;
  }

  getCurrentNetwork(): string {
    return this.currentNetwork;
  }
}

// Singleton instance
export const polkadotService = new PolkadotService();