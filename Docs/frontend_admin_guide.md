# 🎮 **FRONT-END ADMINISTRATIVO LUSDT**
# 🎮 **LUSDT ADMINISTRATIVE FRONT-END**

> **English**: Complete guide for developing the administrative front-end for LUSDT token and bridge management.
>
> **Português**: Guia completo para desenvolver o front-end administrativo para gestão do token LUSDT e ponte.

## 📋 **FUNCIONALIDADES ADMINISTRATIVAS DISPONÍVEIS**
## 📋 **AVAILABLE ADMINISTRATIVE FUNCTIONS**

### 🏦 **LUSDT Token Contract Administration**

#### **🔑 Owner Functions (Apenas Proprietário)**
| Função | Parâmetros | Descrição |
|--------|------------|-----------|
| `set_bridge_account` | `new_bridge: AccountId` | Define novo endereço da conta bridge |
| `set_tax_manager_contract` | `new_tax_manager: AccountId` | Define novo contrato tax manager |
| `update_bridge_account` | `new_bridge: AccountId` | Atualiza conta bridge |
| `update_emergency_admin` | `new_admin: AccountId` | Atualiza administrador de emergência |
| `update_tax_manager` | `new_tax_manager: AccountId` | Atualiza contrato tax manager |

#### **🚨 Emergency Admin Functions (Admin de Emergência)**
| Função | Parâmetros | Descrição |
|--------|------------|-----------|
| `emergency_pause` | `reason: String` | Pausa o contrato em emergência |
| `emergency_unpause` | - | Remove pausa de emergência |

#### **🌉 Bridge Functions (Conta Bridge)**
| Função | Parâmetros | Descrição |
|--------|------------|-----------|
| `mint` | `to: AccountId, amount: Balance` | Criar novos tokens LUSDT |

#### **📊 View Functions (Consulta)**
| Função | Retorno | Descrição |
|--------|---------|-----------|
| `get_owner` | `AccountId` | Endereço do proprietário |
| `get_bridge_account` | `AccountId` | Endereço da conta bridge |
| `get_emergency_admin` | `AccountId` | Endereço do admin de emergência |
| `get_tax_manager_contract` | `AccountId` | Endereço do tax manager |
| `total_supply` | `Balance` | Fornecimento total de tokens |
| `balance_of` | `Balance` | Saldo de uma conta específica |
| `is_paused` | `bool` | Se o contrato está pausado |
| `pause_reason` | `Option<String>` | Motivo da pausa (se pausado) |

### 💰 **Tax Manager Contract Administration**

#### **🔑 Owner Functions**
| Função | Parâmetros | Descrição |
|--------|------------|-----------|
| `update_lunes_price` | `new_price: Balance` | Atualiza preço do LUNES em USD |
| `update_distribution_wallets` | `wallets: DistributionWallets` | Atualiza carteiras de distribuição |
| `update_fee_config` | `config: FeeConfig` | Atualiza configuração de taxas |

#### **📊 View Functions**
| Função | Retorno | Descrição |
|--------|---------|-----------|
| `get_owner` | `AccountId` | Proprietário do contrato |
| `get_lunes_price` | `Balance` | Preço atual do LUNES |
| `get_monthly_volume` | `Balance` | Volume mensal em USD |
| `get_distribution_wallets` | `DistributionWallets` | Carteiras de distribuição |
| `get_fee_config` | `FeeConfig` | Configuração de taxas |

---

## 🛠 **TECNOLOGIAS RECOMENDADAS**
## 🛠 **RECOMMENDED TECHNOLOGIES**

### **Frontend Framework**
```bash
# Next.js 14 com TypeScript
npx create-next-app@latest lusdt-admin-panel --typescript --tailwind --eslint --app

# Ou React + Vite (alternativa mais leve)
npm create vite@latest lusdt-admin-panel -- --template react-ts
```

### **Blockchain Integration**
```bash
# Polkadot.js para interação com Lunes/Substrate
npm install @polkadot/api @polkadot/api-contract @polkadot/extension-dapp @polkadot/util @polkadot/util-crypto

# Para Solana (se precisar interagir diretamente)
npm install @solana/web3.js @solana/wallet-adapter-react @solana/wallet-adapter-wallets
```

### **UI Components & Styling**
```bash
# Tailwind CSS + Headless UI para componentes
npm install @headlessui/react @heroicons/react

# Ou Ant Design (mais componentes prontos)
npm install antd @ant-design/icons

# Ou Material-UI
npm install @mui/material @emotion/react @emotion/styled
```

### **State Management**
```bash
# Zustand (simples e eficiente)
npm install zustand

# Ou Redux Toolkit (para aplicações maiores)
npm install @reduxjs/toolkit react-redux
```

### **Charts & Analytics**
```bash
# Recharts para gráficos
npm install recharts

# Ou Chart.js
npm install chart.js react-chartjs-2
```

---

## 🏗 **ESTRUTURA DO PROJETO**
## 🏗 **PROJECT STRUCTURE**

```
lusdt-admin-panel/
├── src/
│   ├── components/
│   │   ├── common/           # Componentes reutilizáveis
│   │   │   ├── Loading.tsx
│   │   │   ├── ErrorAlert.tsx
│   │   │   └── ConfirmDialog.tsx
│   │   ├── layout/           # Layout da aplicação
│   │   │   ├── Header.tsx
│   │   │   ├── Sidebar.tsx
│   │   │   └── Layout.tsx
│   │   └── admin/            # Componentes administrativos
│   │       ├── TokenManagement.tsx
│   │       ├── TaxManagement.tsx
│   │       ├── BridgeManagement.tsx
│   │       ├── EmergencyControls.tsx
│   │       └── Analytics.tsx
│   ├── hooks/                # Custom hooks
│   │   ├── useContract.ts
│   │   ├── usePolkadot.ts
│   │   └── useAdmin.ts
│   ├── services/             # Serviços de blockchain
│   │   ├── lusdt.ts
│   │   ├── taxManager.ts
│   │   └── polkadot.ts
│   ├── types/                # Tipos TypeScript
│   │   ├── contracts.ts
│   │   └── admin.ts
│   ├── utils/                # Utilitários
│   │   ├── format.ts
│   │   ├── validation.ts
│   │   └── constants.ts
│   └── pages/                # Páginas (Next.js) ou Routes
│       ├── dashboard.tsx
│       ├── token-management.tsx
│       ├── tax-management.tsx
│       ├── bridge-management.tsx
│       └── emergency.tsx
├── public/
│   └── contract-metadata/    # Metadados dos contratos
│       ├── lusdt_token.json
│       └── tax_manager.json
└── package.json
```

---

## 🔧 **IMPLEMENTAÇÃO PASSO A PASSO**
## 🔧 **STEP-BY-STEP IMPLEMENTATION**

### **Etapa 1: Setup Inicial**

#### 1.1 Criar o projeto
```bash
npx create-next-app@latest lusdt-admin-panel --typescript --tailwind --eslint --app
cd lusdt-admin-panel
```

#### 1.2 Instalar dependências blockchain
```bash
npm install @polkadot/api @polkadot/api-contract @polkadot/extension-dapp @polkadot/util @polkadot/util-crypto @polkadot/keyring
```

#### 1.3 Instalar dependências UI
```bash
npm install @headlessui/react @heroicons/react zustand recharts date-fns
npm install -D @types/node
```

### **Etapa 2: Configuração Blockchain**

#### 2.1 Serviço Polkadot (`src/services/polkadot.ts`)
```typescript
import { ApiPromise, WsProvider } from '@polkadot/api';
import { web3Accounts, web3Enable, web3FromAddress } from '@polkadot/extension-dapp';
import { ContractPromise } from '@polkadot/api-contract';

// Configurações de rede
export const NETWORKS = {
  local: 'ws://127.0.0.1:9944',
  rococo: 'wss://rococo-contracts-rpc.polkadot.io',
  lunes: 'wss://node.lunes.io' // Substitua pela URL real
};

class PolkadotService {
  private api: ApiPromise | null = null;
  private accounts: any[] = [];

  async connect(networkUrl: string = NETWORKS.local) {
    const provider = new WsProvider(networkUrl);
    this.api = await ApiPromise.create({ provider });
    await this.api.isReady;
    return this.api;
  }

  async enableWallet() {
    const extensions = await web3Enable('LUSDT Admin Panel');
    if (extensions.length === 0) {
      throw new Error('Nenhuma carteira encontrada. Instale Polkadot.js extension.');
    }
    
    this.accounts = await web3Accounts();
    return this.accounts;
  }

  async getContract(address: string, metadata: any) {
    if (!this.api) throw new Error('API não conectada');
    return new ContractPromise(this.api, metadata, address);
  }

  getApi() {
    return this.api;
  }

  getAccounts() {
    return this.accounts;
  }
}

export const polkadotService = new PolkadotService();
```

#### 2.2 Serviço LUSDT Token (`src/services/lusdt.ts`)
```typescript
import { ContractPromise } from '@polkadot/api-contract';
import { polkadotService } from './polkadot';
import { web3FromAddress } from '@polkadot/extension-dapp';
import lusdtMetadata from '../../public/contract-metadata/lusdt_token.json';

export class LusdtTokenService {
  private contract: ContractPromise | null = null;
  private contractAddress: string;

  constructor(contractAddress: string) {
    this.contractAddress = contractAddress;
  }

  async initialize() {
    this.contract = await polkadotService.getContract(
      this.contractAddress,
      lusdtMetadata
    );
  }

  // === READ FUNCTIONS ===
  async getTotalSupply() {
    if (!this.contract) throw new Error('Contrato não inicializado');
    
    const { result, output } = await this.contract.query.totalSupply(
      this.contractAddress,
      { gasLimit: -1 }
    );
    
    if (result.isOk && output) {
      return output.toHuman();
    }
    throw new Error('Erro ao consultar total supply');
  }

  async getOwner() {
    if (!this.contract) throw new Error('Contrato não inicializado');
    
    const { result, output } = await this.contract.query.getOwner(
      this.contractAddress,
      { gasLimit: -1 }
    );
    
    if (result.isOk && output) {
      return output.toString();
    }
    throw new Error('Erro ao consultar owner');
  }

  async getBridgeAccount() {
    if (!this.contract) throw new Error('Contrato não inicializado');
    
    const { result, output } = await this.contract.query.getBridgeAccount(
      this.contractAddress,
      { gasLimit: -1 }
    );
    
    if (result.isOk && output) {
      return output.toString();
    }
    throw new Error('Erro ao consultar bridge account');
  }

  async isPaused() {
    if (!this.contract) throw new Error('Contrato não inicializado');
    
    const { result, output } = await this.contract.query.isPaused(
      this.contractAddress,
      { gasLimit: -1 }
    );
    
    if (result.isOk && output) {
      return output.toHuman();
    }
    return false;
  }

  async getBalanceOf(account: string) {
    if (!this.contract) throw new Error('Contrato não inicializado');
    
    const { result, output } = await this.contract.query.balanceOf(
      this.contractAddress,
      { gasLimit: -1 },
      account
    );
    
    if (result.isOk && output) {
      return output.toHuman();
    }
    return '0';
  }

  // === WRITE FUNCTIONS ===
  async setBridgeAccount(signerAddress: string, newBridge: string) {
    if (!this.contract) throw new Error('Contrato não inicializado');

    const injector = await web3FromAddress(signerAddress);
    
    return new Promise((resolve, reject) => {
      this.contract!.tx.setBridgeAccount(
        { gasLimit: -1 },
        newBridge
      ).signAndSend(signerAddress, { signer: injector.signer }, (result) => {
        if (result.status.isInBlock) {
          resolve(result.txHash.toString());
        } else if (result.status.isFinalized) {
          console.log('Transaction finalized');
        } else if (result.isError) {
          reject(new Error('Transaction failed'));
        }
      });
    });
  }

  async setTaxManagerContract(signerAddress: string, newTaxManager: string) {
    if (!this.contract) throw new Error('Contrato não inicializado');

    const injector = await web3FromAddress(signerAddress);
    
    return new Promise((resolve, reject) => {
      this.contract!.tx.setTaxManagerContract(
        { gasLimit: -1 },
        newTaxManager
      ).signAndSend(signerAddress, { signer: injector.signer }, (result) => {
        if (result.status.isInBlock) {
          resolve(result.txHash.toString());
        } else if (result.isError) {
          reject(new Error('Transaction failed'));
        }
      });
    });
  }

  async emergencyPause(signerAddress: string, reason: string) {
    if (!this.contract) throw new Error('Contrato não inicializado');

    const injector = await web3FromAddress(signerAddress);
    
    return new Promise((resolve, reject) => {
      this.contract!.tx.emergencyPause(
        { gasLimit: -1 },
        reason
      ).signAndSend(signerAddress, { signer: injector.signer }, (result) => {
        if (result.status.isInBlock) {
          resolve(result.txHash.toString());
        } else if (result.isError) {
          reject(new Error('Transaction failed'));
        }
      });
    });
  }

  async mint(signerAddress: string, to: string, amount: string) {
    if (!this.contract) throw new Error('Contrato não inicializado');

    const injector = await web3FromAddress(signerAddress);
    
    return new Promise((resolve, reject) => {
      this.contract!.tx.mint(
        { gasLimit: -1 },
        to,
        amount
      ).signAndSend(signerAddress, { signer: injector.signer }, (result) => {
        if (result.status.isInBlock) {
          resolve(result.txHash.toString());
        } else if (result.isError) {
          reject(new Error('Transaction failed'));
        }
      });
    });
  }
}
```

### **Etapa 3: Estado Global (Zustand)**

#### 3.1 Store principal (`src/store/adminStore.ts`)
```typescript
import { create } from 'zustand';
import { polkadotService } from '../services/polkadot';
import { LusdtTokenService } from '../services/lusdt';

interface AdminState {
  // Connection
  isConnected: boolean;
  currentAccount: string | null;
  accounts: any[];
  
  // Contracts
  lusdtService: LusdtTokenService | null;
  taxManagerService: any; // Implementar depois
  
  // Contract addresses
  lusdtAddress: string;
  taxManagerAddress: string;
  
  // Contract data
  totalSupply: string;
  isPaused: boolean;
  owner: string;
  bridgeAccount: string;
  
  // Actions
  connectWallet: () => Promise<void>;
  disconnectWallet: () => void;
  initializeContracts: () => Promise<void>;
  refreshContractData: () => Promise<void>;
  setCurrentAccount: (account: string) => void;
}

export const useAdminStore = create<AdminState>((set, get) => ({
  // Initial state
  isConnected: false,
  currentAccount: null,
  accounts: [],
  lusdtService: null,
  taxManagerService: null,
  lusdtAddress: process.env.NEXT_PUBLIC_LUSDT_ADDRESS || '',
  taxManagerAddress: process.env.NEXT_PUBLIC_TAX_MANAGER_ADDRESS || '',
  totalSupply: '0',
  isPaused: false,
  owner: '',
  bridgeAccount: '',

  // Actions
  connectWallet: async () => {
    try {
      await polkadotService.connect();
      const accounts = await polkadotService.enableWallet();
      
      set({
        isConnected: true,
        accounts,
        currentAccount: accounts[0]?.address || null
      });
    } catch (error) {
      console.error('Erro ao conectar carteira:', error);
      throw error;
    }
  },

  disconnectWallet: () => {
    set({
      isConnected: false,
      currentAccount: null,
      accounts: [],
      lusdtService: null,
      taxManagerService: null
    });
  },

  initializeContracts: async () => {
    const { lusdtAddress, taxManagerAddress } = get();
    
    if (!lusdtAddress) throw new Error('Endereço do LUSDT não configurado');
    
    const lusdtService = new LusdtTokenService(lusdtAddress);
    await lusdtService.initialize();
    
    set({ lusdtService });
  },

  refreshContractData: async () => {
    const { lusdtService } = get();
    
    if (!lusdtService) return;
    
    try {
      const [totalSupply, isPaused, owner, bridgeAccount] = await Promise.all([
        lusdtService.getTotalSupply(),
        lusdtService.isPaused(),
        lusdtService.getOwner(),
        lusdtService.getBridgeAccount()
      ]);
      
      set({
        totalSupply,
        isPaused,
        owner,
        bridgeAccount
      });
    } catch (error) {
      console.error('Erro ao atualizar dados do contrato:', error);
    }
  },

  setCurrentAccount: (account: string) => {
    set({ currentAccount: account });
  }
}));
```

### **Etapa 4: Componentes UI**

#### 4.1 Layout principal (`src/components/layout/Layout.tsx`)
```typescript
import React from 'react';
import Header from './Header';
import Sidebar from './Sidebar';

interface LayoutProps {
  children: React.ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <div className="flex">
        <Sidebar />
        <main className="flex-1 p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
```

#### 4.2 Header com conexão de carteira (`src/components/layout/Header.tsx`)
```typescript
import React from 'react';
import { useAdminStore } from '../../store/adminStore';
import { useState } from 'react';

export default function Header() {
  const {
    isConnected,
    currentAccount,
    accounts,
    connectWallet,
    disconnectWallet,
    setCurrentAccount
  } = useAdminStore();
  
  const [isLoading, setIsLoading] = useState(false);

  const handleConnect = async () => {
    setIsLoading(true);
    try {
      await connectWallet();
    } catch (error) {
      alert('Erro ao conectar carteira: ' + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-6)}`;
  };

  return (
    <header className="bg-white shadow-sm border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            <h1 className="text-xl font-semibold text-gray-900">
              🏦 LUSDT Admin Panel
            </h1>
          </div>
          
          <div className="flex items-center space-x-4">
            {!isConnected ? (
              <button
                onClick={handleConnect}
                disabled={isLoading}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium disabled:opacity-50"
              >
                {isLoading ? 'Conectando...' : 'Conectar Carteira'}
              </button>
            ) : (
              <div className="flex items-center space-x-3">
                <select
                  value={currentAccount || ''}
                  onChange={(e) => setCurrentAccount(e.target.value)}
                  className="border border-gray-300 rounded-md px-3 py-1 text-sm"
                >
                  {accounts.map((account) => (
                    <option key={account.address} value={account.address}>
                      {account.meta.name} ({formatAddress(account.address)})
                    </option>
                  ))}
                </select>
                
                <button
                  onClick={disconnectWallet}
                  className="bg-gray-600 hover:bg-gray-700 text-white px-3 py-1 rounded-md text-sm"
                >
                  Desconectar
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
```

#### 4.3 Gerenciamento de Tokens (`src/components/admin/TokenManagement.tsx`)
```typescript
import React, { useState, useEffect } from 'react';
import { useAdminStore } from '../../store/adminStore';

export default function TokenManagement() {
  const {
    lusdtService,
    currentAccount,
    totalSupply,
    owner,
    bridgeAccount,
    isPaused,
    refreshContractData
  } = useAdminStore();

  const [newBridge, setNewBridge] = useState('');
  const [newTaxManager, setNewTaxManager] = useState('');
  const [mintTo, setMintTo] = useState('');
  const [mintAmount, setMintAmount] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (lusdtService) {
      refreshContractData();
    }
  }, [lusdtService]);

  const handleSetBridgeAccount = async () => {
    if (!lusdtService || !currentAccount || !newBridge) return;
    
    setIsLoading(true);
    try {
      const txHash = await lusdtService.setBridgeAccount(currentAccount, newBridge);
      alert(`Transação enviada: ${txHash}`);
      setNewBridge('');
      setTimeout(() => refreshContractData(), 3000);
    } catch (error) {
      alert('Erro: ' + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleMint = async () => {
    if (!lusdtService || !currentAccount || !mintTo || !mintAmount) return;
    
    setIsLoading(true);
    try {
      // Converter para wei (assumindo 6 decimais)
      const amountWei = (parseFloat(mintAmount) * 1_000_000).toString();
      const txHash = await lusdtService.mint(currentAccount, mintTo, amountWei);
      alert(`Tokens mintados! Transação: ${txHash}`);
      setMintTo('');
      setMintAmount('');
      setTimeout(() => refreshContractData(), 3000);
    } catch (error) {
      alert('Erro: ' + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const isOwner = currentAccount === owner;
  const isBridge = currentAccount === bridgeAccount;

  return (
    <div className="space-y-6">
      <div className="bg-white shadow rounded-lg p-6">
        <h2 className="text-lg font-medium text-gray-900 mb-4">
          📊 Informações do Token
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-blue-50 p-4 rounded-lg">
            <div className="text-sm font-medium text-blue-600">Total Supply</div>
            <div className="text-2xl font-bold text-blue-900">
              {(parseInt(totalSupply) / 1_000_000).toLocaleString()} LUSDT
            </div>
          </div>
          
          <div className="bg-green-50 p-4 rounded-lg">
            <div className="text-sm font-medium text-green-600">Status</div>
            <div className="text-2xl font-bold text-green-900">
              {isPaused ? '⏸️ Pausado' : '✅ Ativo'}
            </div>
          </div>
          
          <div className="bg-purple-50 p-4 rounded-lg">
            <div className="text-sm font-medium text-purple-600">Owner</div>
            <div className="text-sm font-mono text-purple-900">
              {owner.slice(0, 8)}...{owner.slice(-8)}
            </div>
          </div>
          
          <div className="bg-orange-50 p-4 rounded-lg">
            <div className="text-sm font-medium text-orange-600">Bridge</div>
            <div className="text-sm font-mono text-orange-900">
              {bridgeAccount.slice(0, 8)}...{bridgeAccount.slice(-8)}
            </div>
          </div>
        </div>
      </div>

      {/* Funções do Owner */}
      {isOwner && (
        <div className="bg-white shadow rounded-lg p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">
            👑 Funções do Proprietário
          </h3>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Novo Endereço Bridge
              </label>
              <div className="mt-1 flex rounded-md shadow-sm">
                <input
                  type="text"
                  value={newBridge}
                  onChange={(e) => setNewBridge(e.target.value)}
                  className="flex-1 border border-gray-300 rounded-l-md px-3 py-2 text-sm"
                  placeholder="5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY"
                />
                <button
                  onClick={handleSetBridgeAccount}
                  disabled={isLoading || !newBridge}
                  className="inline-flex items-center px-3 py-2 border border-l-0 border-gray-300 rounded-r-md bg-gray-50 text-gray-500 text-sm disabled:opacity-50"
                >
                  Atualizar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Funções do Bridge */}
      {isBridge && (
        <div className="bg-white shadow rounded-lg p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">
            🌉 Funções do Bridge
          </h3>
          
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Endereço Destinatário
                </label>
                <input
                  type="text"
                  value={mintTo}
                  onChange={(e) => setMintTo(e.target.value)}
                  className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                  placeholder="5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Quantidade (LUSDT)
                </label>
                <input
                  type="number"
                  value={mintAmount}
                  onChange={(e) => setMintAmount(e.target.value)}
                  className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                  placeholder="100.000000"
                  step="0.000001"
                />
              </div>
            </div>
            
            <button
              onClick={handleMint}
              disabled={isLoading || !mintTo || !mintAmount}
              className="w-full bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md text-sm font-medium disabled:opacity-50"
            >
              {isLoading ? 'Mintando...' : '💰 Mintar LUSDT'}
            </button>
          </div>
        </div>
      )}

      {!isOwner && !isBridge && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex">
            <div className="text-yellow-400">⚠️</div>
            <div className="ml-3">
              <p className="text-sm text-yellow-700">
                Você não tem permissões administrativas. Conecte-se com a conta do Owner ou Bridge para gerenciar o token.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
```

### **Etapa 5: Página Principal**

#### 5.1 Dashboard (`src/app/page.tsx` ou `src/pages/index.tsx`)
```typescript
import React, { useEffect } from 'react';
import Layout from '../components/layout/Layout';
import TokenManagement from '../components/admin/TokenManagement';
import { useAdminStore } from '../store/adminStore';

export default function Dashboard() {
  const { isConnected, initializeContracts, lusdtAddress } = useAdminStore();

  useEffect(() => {
    if (isConnected && lusdtAddress) {
      initializeContracts().catch(console.error);
    }
  }, [isConnected, lusdtAddress]);

  return (
    <Layout>
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">
            🎮 Painel Administrativo LUSDT
          </h1>
          <p className="mt-2 text-gray-600">
            Gerencie tokens LUSDT, taxas e configurações do sistema
          </p>
        </div>

        {!isConnected ? (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-8 text-center">
            <div className="text-blue-400 text-4xl mb-4">🔗</div>
            <h2 className="text-xl font-semibold text-blue-900 mb-2">
              Conecte sua Carteira
            </h2>
            <p className="text-blue-700">
              Conecte sua carteira Polkadot.js para começar a gerenciar o sistema LUSDT
            </p>
          </div>
        ) : (
          <TokenManagement />
        )}
      </div>
    </Layout>
  );
}
```

### **Etapa 6: Configuração de Ambiente**

#### 6.1 Variáveis de ambiente (`.env.local`)
```bash
# Endereços dos contratos (substituir pelos endereços reais após deploy)
NEXT_PUBLIC_LUSDT_ADDRESS=5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY
NEXT_PUBLIC_TAX_MANAGER_ADDRESS=5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY

# Configuração de rede
NEXT_PUBLIC_NETWORK_URL=ws://127.0.0.1:9944
NEXT_PUBLIC_NETWORK_NAME=Local Testnet

# Configurações da aplicação
NEXT_PUBLIC_APP_NAME=LUSDT Admin Panel
NEXT_PUBLIC_APP_VERSION=1.0.0
```

---

## 🚀 **EXECUÇÃO E DEPLOY**
## 🚀 **EXECUTION AND DEPLOYMENT**

### **Desenvolvimento Local**
```bash
# Instalar dependências
npm install

# Executar em modo desenvolvimento
npm run dev

# Compilar para produção
npm run build

# Executar versão de produção
npm start
```

### **Deploy (Vercel)**
```bash
# Instalar Vercel CLI
npm i -g vercel

# Deploy
vercel

# Configurar variáveis de ambiente no dashboard da Vercel
```

---

## 📚 **PRÓXIMOS PASSOS**
## 📚 **NEXT STEPS**

1. **✅ Implementar estrutura básica** (Token Management)
2. **🔄 Adicionar Tax Manager** (Gerenciamento de taxas)
3. **🔄 Implementar Emergency Controls** (Controles de emergência)
4. **🔄 Adicionar Analytics** (Gráficos e estatísticas)
5. **🔄 Implementar Bridge Management** (Gerenciamento da ponte)
6. **🔄 Adicionar notificações** (Toast messages)
7. **🔄 Implementar histórico de transações**
8. **🔄 Adicionar testes** (Jest + Testing Library)
9. **🔄 Implementar PWA** (Progressive Web App)
10. **🔄 Deploy em produção**

---

## 🔐 **CONSIDERAÇÕES DE SEGURANÇA**
## 🔐 **SECURITY CONSIDERATIONS**

### **Validações Importantes**
- ✅ Verificar permissões antes de mostrar funções
- ✅ Validar endereços Substrate
- ✅ Confirmar transações críticas
- ✅ Mostrar estimativas de gas
- ✅ Implementar timeouts para transações
- ✅ Logs de auditoria
- ✅ Rate limiting para chamadas
- ✅ Validação de inputs no frontend E backend

### **Práticas Recomendadas**
- 🔒 Nunca armazenar chaves privadas
- 🔒 Sempre validar permissões no contrato
- 🔒 Usar HTTPS em produção
- 🔒 Implementar CSP (Content Security Policy)
- 🔒 Monitorar transações suspeitas
- 🔒 Backup regular de configurações
- 🔒 Documentar todas as operações administrativas

---

Este guia fornece uma base sólida para desenvolver um front-end administrativo completo para o sistema LUSDT. Quer que eu implemente alguma parte específica primeiro?