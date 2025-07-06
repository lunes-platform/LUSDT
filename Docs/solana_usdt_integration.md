# Integração USDT Solana - Sistema de Bridge LUSDT

## 📋 Visão Geral

Esta documentação detalha a implementação da integração com USDT na rede Solana, permitindo o bridge bidirecional entre LUSDT (Lunes Chain) e USDT (Solana Network).

### Arquitetura do Sistema

```text
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Usuário       │    │  Bridge Service │    │   Smart         │
│   (Solana)      │───▶│   (Off-chain)   │───▶│   Contract      │
│                 │    │                 │    │   (Lunes)       │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                        │                        │
         ▼                        ▼                        ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   USDT Token    │    │   Treasury      │    │   LUSDT Token   │
│   (SPL Token)   │    │   Management    │    │   (ink! PSP22)  │
│   EPjFWdd5Au... │    │   (Multisig)    │    │   Lunes Chain   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

---

## 🔗 Especificações Técnicas

### USDT na Solana
- **Token Address:** `EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v`
- **Decimals:** 6
- **Type:** SPL Token (Fungible)
- **Standard:** SPL Token Program
- **Issuer:** Tether (Official)

### Endpoints e RPCs
```javascript
// Mainnet
const SOLANA_RPC_MAINNET = "https://api.mainnet-beta.solana.com";
const SOLANA_RPC_BACKUP = "https://solana-api.projectserum.com";

// Devnet (Para testes)
const SOLANA_RPC_DEVNET = "https://api.devnet.solana.com";
const USDT_DEVNET = "Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr"; // USDT Devnet
```

---

## 🏗️ Arquitetura do Bridge Service

### Componentes Principais

#### 1. Solana Client
```typescript
interface SolanaClient {
  // Conexão com a rede Solana
  connection: Connection;
  
  // Wallet para transações
  wallet: Keypair;
  
  // Token accounts
  usdtTokenAccount: PublicKey;
  treasuryAccount: PublicKey;
}
```

#### 2. Transaction Monitor
```typescript
interface TransactionMonitor {
  // Monitora depósitos USDT
  monitorDeposits(): Promise<void>;
  
  // Processa saques para Solana
  processWithdrawals(): Promise<void>;
  
  // Verifica confirmações
  checkConfirmations(signature: string): Promise<boolean>;
}
```

#### 3. Treasury Manager
```typescript
interface TreasuryManager {
  // Verifica saldo do treasury
  getBalance(): Promise<number>;
  
  // Executa transferências
  transfer(to: PublicKey, amount: number): Promise<string>;
  
  // Verifica paridade com LUSDT
  checkParity(): Promise<boolean>;
}
```

---

## 💰 Fluxos de Transação

### Fluxo 1: USDT → LUSDT (Mint)

```text
1. Usuário deposita USDT no treasury Solana
   ├── Valor: 1000 USDT
   ├── Memo: endereço_lunes_destino
   └── Confirmação: ~400ms (1 slot)

2. Bridge Service detecta depósito
   ├── Verifica memo válido
   ├── Confirma transação (finalized)
   └── Valida valor recebido

3. Bridge Service chama LUSDT.mint()
   ├── Destinatário: endereço do memo
   ├── Valor: 1000 LUSDT (1:1)
   └── Taxa: processada pelo tax_manager

4. LUSDT é creditado na conta Lunes
   ├── Evento: Transfer(None → user, 1000)
   ├── Total Supply: aumenta em 1000
   └── Notificação para usuário
```

### Fluxo 2: LUSDT → USDT (Burn)

```text
1. Usuário chama LUSDT.burn()
   ├── Valor: 500 LUSDT
   ├── Solana Address: 7EcDhSYGxXyscszYEp35KHN8vvw3svAuLKTzXwCFLtV
   └── Taxa: processada pelo tax_manager

2. Evento RedemptionRequested é emitido
   ├── From: conta_usuario_lunes
   ├── Amount: 500
   └── Solana Address: endereço_destino

3. Bridge Service processa evento
   ├── Valida endereço Solana
   ├── Verifica saldo do treasury
   └── Prepara transação Solana

4. USDT é enviado para usuário
   ├── From: treasury_account
   ├── To: endereço_solana_usuario
   ├── Amount: 500 USDT
   └── Confirmação: signature retornada
```

---

## 🔐 Configurações de Segurança

### Treasury Multisig (Solana)

```typescript
// Configuração de Multisig 3-of-5
const multisigConfig = {
  threshold: 3,
  owners: [
    "7EcDhSYGxXyscszYEp35KHN8vvw3svAuLKTzXwCFLtV", // Owner 1
    "5FHneW46xGXgs5mUiveU4sbTyGBzmstUspZC92UhjJM6", // Owner 2  
    "9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM", // Owner 3
    "BQcdHdAQW1hczDbBi9hiegXAR7A98Q9jx3X3iBBBDiq4", // Owner 4
    "DhkqjDD1BJnBQMdJdaKVMhBMaLXUv8qZvZjzF1MmEXWW"  // Owner 5
  ],
  programId: "9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM" // Squads Protocol
};
```

### Bridge Service Security

```typescript
const securityConfig = {
  // Rate limiting
  maxTransactionsPerHour: 100,
  maxValuePerTransaction: 100000, // 100k USDT
  maxDailyVolume: 1000000, // 1M USDT
  
  // Confirmations
  requiredConfirmations: "finalized", // ~6.4s
  maxRetries: 3,
  retryDelay: 5000, // 5s
  
  // Monitoring
  healthCheckInterval: 30000, // 30s
  parityCheckInterval: 60000,  // 1min
  alertThreshold: 0.01 // 1% deviation
};
```

---

## 🛠️ Implementação do Bridge Service

### Estrutura do Projeto

```
bridge-service/
├── src/
│   ├── solana/
│   │   ├── client.ts          # Cliente Solana
│   │   ├── monitor.ts         # Monitor de transações  
│   │   ├── treasury.ts        # Gestão do treasury
│   │   └── types.ts           # Tipos Solana
│   ├── lunes/
│   │   ├── client.ts          # Cliente Lunes/Substrate
│   │   ├── contract.ts        # Interface LUSDT
│   │   └── types.ts           # Tipos Lunes
│   ├── bridge/
│   │   ├── processor.ts       # Processador principal
│   │   ├── validator.ts       # Validações
│   │   └── database.ts        # Persistência
│   ├── monitoring/
│   │   ├── metrics.ts         # Métricas
│   │   ├── alerts.ts          # Alertas
│   │   └── health.ts          # Health checks
│   └── config/
│       ├── env.ts             # Configurações
│       └── constants.ts       # Constantes
├── package.json
├── tsconfig.json
└── docker-compose.yml
```

### Cliente Solana Principal

```typescript
import { 
  Connection, 
  PublicKey, 
  Keypair,
  Transaction,
  SystemProgram,
  LAMPORTS_PER_SOL
} from '@solana/web3.js';
import { 
  getOrCreateAssociatedTokenAccount,
  transfer,
  TOKEN_PROGRAM_ID
} from '@solana/spl-token';

export class SolanaClient {
  private connection: Connection;
  private wallet: Keypair;
  private usdtMint: PublicKey;
  private treasuryAccount: PublicKey;

  constructor(rpcUrl: string, walletPrivateKey: Uint8Array) {
    this.connection = new Connection(rpcUrl, 'finalized');
    this.wallet = Keypair.fromSecretKey(walletPrivateKey);
    this.usdtMint = new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v');
  }

  async initialize(): Promise<void> {
    // Inicializa ou obtém conta de token USDT do treasury
    this.treasuryAccount = await getOrCreateAssociatedTokenAccount(
      this.connection,
      this.wallet,
      this.usdtMint,
      this.wallet.publicKey
    ).then(account => account.address);
    
    console.log(`Treasury USDT Account: ${this.treasuryAccount.toBase58()}`);
  }

  async getUSDTBalance(): Promise<number> {
    const balance = await this.connection.getTokenAccountBalance(this.treasuryAccount);
    return balance.value.uiAmount || 0;
  }

  async transferUSDT(
    to: PublicKey, 
    amount: number
  ): Promise<string> {
    // Validações de segurança
    if (amount <= 0) throw new Error('Amount must be positive');
    if (amount > await this.getUSDTBalance()) {
      throw new Error('Insufficient treasury balance');
    }

    // Obtém ou cria conta de token do destinatário
    const toTokenAccount = await getOrCreateAssociatedTokenAccount(
      this.connection,
      this.wallet,
      this.usdtMint,
      to
    );

    // Converte para unidades menores (6 decimais para USDT)
    const amountInSmallestUnit = amount * Math.pow(10, 6);

    // Executa transferência
    const signature = await transfer(
      this.connection,
      this.wallet,
      this.treasuryAccount,
      toTokenAccount.address,
      this.wallet,
      amountInSmallestUnit
    );

    // Aguarda confirmação
    await this.connection.confirmTransaction(signature, 'finalized');
    
    return signature;
  }

  async monitorDeposits(
    callback: (deposit: DepositEvent) => void
  ): Promise<void> {
    // Monitora transações para o treasury account
    this.connection.onAccountChange(
      this.treasuryAccount,
      async (accountInfo) => {
        // Processa mudanças na conta do treasury
        const signatures = await this.connection.getSignaturesForAddress(
          this.treasuryAccount,
          { limit: 1 }
        );

        if (signatures.length > 0) {
          const txDetails = await this.connection.getTransaction(
            signatures[0].signature,
            { commitment: 'finalized' }
          );

          if (txDetails) {
            const deposit = this.parseDepositTransaction(txDetails);
            if (deposit) {
              callback(deposit);
            }
          }
        }
      },
      'finalized'
    );
  }

  private parseDepositTransaction(tx: any): DepositEvent | null {
    // Parse da transação para extrair informações do depósito
    try {
      const preBalance = tx.meta.preTokenBalances?.find(
        (b: any) => b.accountIndex === /* treasury account index */ 0
      )?.uiTokenAmount?.uiAmount || 0;

      const postBalance = tx.meta.postTokenBalances?.find(
        (b: any) => b.accountIndex === /* treasury account index */ 0
      )?.uiTokenAmount?.uiAmount || 0;

      const amount = postBalance - preBalance;
      
      if (amount > 0) {
        // Extrai memo da transação
        const memo = this.extractMemoFromTransaction(tx);
        
        return {
          signature: tx.transaction.signatures[0],
          amount: amount,
          lunesAddress: memo,
          timestamp: tx.blockTime * 1000,
          slot: tx.slot
        };
      }
    } catch (error) {
      console.error('Error parsing deposit transaction:', error);
    }
    
    return null;
  }

  private extractMemoFromTransaction(tx: any): string | null {
    // Extrai memo da transação (endereço Lunes de destino)
    const memoInstruction = tx.transaction.message.instructions.find(
      (ix: any) => ix.programId === 'MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr'
    );
    
    if (memoInstruction) {
      const memoData = Buffer.from(memoInstruction.data, 'base64');
      return memoData.toString('utf8');
    }
    
    return null;
  }
}

interface DepositEvent {
  signature: string;
  amount: number;
  lunesAddress: string | null;
  timestamp: number;
  slot: number;
}
```

### Processador Principal do Bridge

```typescript
import { SolanaClient } from './solana/client';
import { LunesClient } from './lunes/client';
import { Database } from './bridge/database';

export class BridgeProcessor {
  private solanaClient: SolanaClient;
  private lunesClient: LunesClient;
  private database: Database;
  private isProcessing: boolean = false;

  constructor(
    solanaClient: SolanaClient,
    lunesClient: LunesClient,
    database: Database
  ) {
    this.solanaClient = solanaClient;
    this.lunesClient = lunesClient;
    this.database = database;
  }

  async start(): Promise<void> {
    console.log('🌉 Starting Bridge Service...');
    
    // Inicializa clientes
    await this.solanaClient.initialize();
    await this.lunesClient.initialize();
    
    // Inicia monitoramento de depósitos Solana
    await this.solanaClient.monitorDeposits(
      this.handleSolanaDeposit.bind(this)
    );
    
    // Inicia monitoramento de eventos Lunes
    await this.lunesClient.monitorRedemptionRequests(
      this.handleLunesRedemption.bind(this)
    );
    
    // Inicia health checks
    this.startHealthChecks();
    
    console.log('✅ Bridge Service started successfully');
  }

  private async handleSolanaDeposit(deposit: DepositEvent): Promise<void> {
    if (this.isProcessing) {
      console.log('Bridge is busy, queuing deposit...');
      return;
    }

    this.isProcessing = true;
    
    try {
      console.log(`📥 Processing Solana deposit: ${deposit.signature}`);
      
      // Validações
      if (!deposit.lunesAddress) {
        throw new Error('No Lunes address in memo');
      }
      
      if (deposit.amount <= 0) {
        throw new Error('Invalid deposit amount');
      }

      // Verifica se já foi processado
      const existingTx = await this.database.getTransactionBySignature(
        deposit.signature
      );
      
      if (existingTx) {
        console.log('Transaction already processed, skipping...');
        return;
      }

      // Registra transação como processando
      await this.database.createTransaction({
        solanaSignature: deposit.signature,
        type: 'DEPOSIT',
        amount: deposit.amount,
        lunesAddress: deposit.lunesAddress,
        status: 'PROCESSING',
        timestamp: deposit.timestamp
      });

      // Chama mint no contrato LUSDT
      const lunesSignature = await this.lunesClient.mint(
        deposit.lunesAddress,
        deposit.amount
      );

      // Atualiza status da transação
      await this.database.updateTransaction(deposit.signature, {
        lunesSignature: lunesSignature,
        status: 'COMPLETED'
      });

      console.log(`✅ Deposit completed: ${deposit.amount} USDT → LUSDT`);
      
    } catch (error) {
      console.error('❌ Error processing deposit:', error);
      
      await this.database.updateTransaction(deposit.signature, {
        status: 'FAILED',
        errorMessage: error.message
      });
      
      // Enviar alerta para equipe
      await this.sendAlert('DEPOSIT_FAILED', {
        signature: deposit.signature,
        error: error.message
      });
      
    } finally {
      this.isProcessing = false;
    }
  }

  private async handleLunesRedemption(redemption: RedemptionEvent): Promise<void> {
    try {
      console.log(`📤 Processing Lunes redemption: ${redemption.lunesSignature}`);
      
      // Validações
      if (!this.isValidSolanaAddress(redemption.solanaAddress)) {
        throw new Error('Invalid Solana address');
      }
      
      if (redemption.amount <= 0) {
        throw new Error('Invalid redemption amount');
      }

      // Verifica saldo do treasury
      const treasuryBalance = await this.solanaClient.getUSDTBalance();
      if (treasuryBalance < redemption.amount) {
        throw new Error('Insufficient treasury balance');
      }

      // Registra transação
      await this.database.createTransaction({
        lunesSignature: redemption.lunesSignature,
        type: 'WITHDRAWAL',
        amount: redemption.amount,
        solanaAddress: redemption.solanaAddress,
        status: 'PROCESSING',
        timestamp: Date.now()
      });

      // Executa transferência USDT
      const solanaSignature = await this.solanaClient.transferUSDT(
        new PublicKey(redemption.solanaAddress),
        redemption.amount
      );

      // Atualiza status
      await this.database.updateTransaction(redemption.lunesSignature, {
        solanaSignature: solanaSignature,
        status: 'COMPLETED'
      });

      console.log(`✅ Redemption completed: ${redemption.amount} LUSDT → USDT`);
      
    } catch (error) {
      console.error('❌ Error processing redemption:', error);
      
      await this.database.updateTransaction(redemption.lunesSignature, {
        status: 'FAILED',
        errorMessage: error.message
      });
      
      await this.sendAlert('REDEMPTION_FAILED', {
        signature: redemption.lunesSignature,
        error: error.message
      });
    }
  }

  private isValidSolanaAddress(address: string): boolean {
    try {
      new PublicKey(address);
      return true;
    } catch {
      return false;
    }
  }

  private async startHealthChecks(): Promise<void> {
    setInterval(async () => {
      try {
        // Verifica paridade treasury vs total supply
        const treasuryBalance = await this.solanaClient.getUSDTBalance();
        const totalSupply = await this.lunesClient.getTotalSupply();
        
        const deviation = Math.abs(treasuryBalance - totalSupply) / totalSupply;
        
        if (deviation > 0.01) { // 1% threshold
          await this.sendAlert('PARITY_DEVIATION', {
            treasuryBalance,
            totalSupply,
            deviation: deviation * 100
          });
        }
        
        console.log(`💰 Treasury: ${treasuryBalance} USDT | Total Supply: ${totalSupply} LUSDT`);
        
      } catch (error) {
        console.error('Health check failed:', error);
      }
    }, 60000); // A cada minuto
  }

  private async sendAlert(type: string, data: any): Promise<void> {
    // Implementar sistema de alertas (Discord, Slack, Email, etc.)
    console.log(`🚨 ALERT [${type}]:`, data);
  }
}

interface RedemptionEvent {
  lunesSignature: string;
  amount: number;
  solanaAddress: string;
  timestamp: number;
}
```

### Sistema de Monitoramento

```typescript
export class BridgeMonitoring {
  private metrics: Map<string, number> = new Map();
  
  async trackTransaction(type: 'DEPOSIT' | 'WITHDRAWAL', amount: number): Promise<void> {
    const key = `${type}_${new Date().toDateString()}`;
    const current = this.metrics.get(key) || 0;
    this.metrics.set(key, current + amount);
  }
  
  async getDailyVolume(): Promise<{ deposits: number, withdrawals: number }> {
    const today = new Date().toDateString();
    return {
      deposits: this.metrics.get(`DEPOSIT_${today}`) || 0,
      withdrawals: this.metrics.get(`WITHDRAWAL_${today}`) || 0
    };
  }
  
  async getHealthStatus(): Promise<HealthStatus> {
    return {
      solanaConnection: await this.checkSolanaHealth(),
      lunesConnection: await this.checkLunesHealth(),
      treasuryBalance: await this.getTreasuryBalance(),
      parityCheck: await this.checkParity(),
      lastProcessedBlock: await this.getLastProcessedBlock()
    };
  }
}

interface HealthStatus {
  solanaConnection: boolean;
  lunesConnection: boolean;
  treasuryBalance: number;
  parityCheck: boolean;
  lastProcessedBlock: number;
}
```

---

## 📊 Métricas e Monitoramento

### Dashboards Principais

#### 1. Volume de Transações
```typescript
const volumeMetrics = {
  daily: {
    deposits: 50000,    // USDT → LUSDT
    withdrawals: 45000, // LUSDT → USDT  
    net: 5000          // Crescimento líquido
  },
  weekly: {
    deposits: 350000,
    withdrawals: 320000,
    net: 30000
  }
};
```

#### 2. Health Checks
```typescript
const healthMetrics = {
  parityDeviation: 0.001,     // 0.1% (muito bom)
  treasuryBalance: 1250000,   // 1.25M USDT
  totalSupply: 1248750,       // 1.248M LUSDT
  avgProcessingTime: 1.2,     // 1.2 segundos
  successRate: 99.8           // 99.8%
};
```

#### 3. Alertas Críticos
```typescript
const alertThresholds = {
  parityDeviation: 1.0,       // 1%
  lowTreasuryBalance: 100000, // 100k USDT
  highFailureRate: 5.0,       // 5%
  processingDelay: 30.0       // 30 segundos
};
```

---

## 🔧 Configuração e Deploy

### Variáveis de Ambiente

```bash
# Solana Configuration
SOLANA_RPC_URL=https://api.mainnet-beta.solana.com
SOLANA_WALLET_PRIVATE_KEY=base58_encoded_private_key
USDT_TOKEN_MINT=EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v

# Lunes Configuration  
LUNES_RPC_URL=wss://rpc.lunes.io
LUNES_WALLET_SEED=mnemonic_phrase_here
LUSDT_CONTRACT_ADDRESS=5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY

# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/bridge_db
REDIS_URL=redis://localhost:6379

# Security
RATE_LIMIT_PER_HOUR=100
MAX_TRANSACTION_VALUE=100000
TREASURY_MIN_BALANCE=50000

# Monitoring
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/...
ALERT_EMAIL=admin@lunes.io
```

### Docker Compose

```yaml
version: '3.8'

services:
  bridge-service:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
    env_file:
      - .env.production
    depends_on:
      - postgres
      - redis
    restart: unless-stopped
    
  postgres:
    image: postgres:15
    environment:
      POSTGRES_DB: bridge_db
      POSTGRES_USER: bridge_user
      POSTGRES_PASSWORD: secure_password
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"
      
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
      
  monitoring:
    image: prom/prometheus
    ports:
      - "9090:9090"
    volumes:
      - ./monitoring/prometheus.yml:/etc/prometheus/prometheus.yml
      
volumes:
  postgres_data:
  redis_data:
```

---

## 🚀 Próximos Passos

### Fase 1: Desenvolvimento (2 semanas)
- [ ] Implementar SolanaClient completo
- [ ] Criar LunesClient para interação com LUSDT
- [ ] Desenvolver BridgeProcessor principal
- [ ] Implementar sistema de database

### Fase 2: Testes (1 semana)  
- [ ] Testes unitários para todos os componentes
- [ ] Testes de integração com Devnet
- [ ] Simulação de cenários de falha
- [ ] Performance testing

### Fase 3: Deploy (1 semana)
- [ ] Deploy em ambiente de staging
- [ ] Configuração de monitoramento
- [ ] Setup do treasury multisig
- [ ] Go-live em produção

### Fase 4: Monitoramento (Contínuo)
- [ ] Dashboards em tempo real
- [ ] Alertas automatizados  
- [ ] Relatórios de compliance
- [ ] Otimizações baseadas em métricas

---

**Esta integração estabelecerá o LUSDT como o primeiro token verdadeiramente cross-chain entre Lunes e Solana, criando um bridge robusto e seguro para o ecossistema.** 