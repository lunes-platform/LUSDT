# 🔗 Guia Completo de Integração LUSDT Bridge
# 🔗 Complete LUSDT Bridge Integration Guide

> **Português**: Guia completo para integração frontend-backend do sistema LUSDT Bridge.
>
> **English**: Complete guide for frontend-backend integration of the LUSDT Bridge system.

## 📋 Índice / Table of Contents

1. [Visão Geral / Overview](#visão-geral--overview)
2. [Arquitetura de Integração / Integration Architecture](#arquitetura-de-integração--integration-architecture)
3. [Setup / Configuração](#setup--configuração)
4. [API Reference](#api-reference)
5. [Hooks React](#hooks-react)
6. [Fluxos Completos / Complete Flows](#fluxos-completos--complete-flows)
7. [Exemplos de Uso / Usage Examples](#exemplos-de-uso--usage-examples)
8. [Tratamento de Erros / Error Handling](#tratamento-de-erros--error-handling)
9. [Segurança / Security](#segurança--security)
10. [Testes / Testing](#testes--testing)

---

## 🎯 Visão Geral / Overview

O sistema LUSDT Bridge conecta três camadas principais:

### Camadas / Layers

```
┌─────────────────────────────────────────────────────┐
│              FRONTEND (React/TypeScript)            │
│  - Components: BridgeInterface, UserDashboard, etc  │
│  - Hooks: useBridge, useBridgeAPI                   │
│  - API Client: BridgeAPIClient                      │
└────────────────────┬────────────────────────────────┘
                     │ HTTP/REST API
                     ↓
┌─────────────────────────────────────────────────────┐
│         BRIDGE SERVICE (Node.js/Express)            │
│  - Simple Bridge: Transaction processing            │
│  - Admin Routes: Administrative operations          │
│  - Contract Integration: Ink! Smart Contracts       │
└────────────────────┬────────────────────────────────┘
                     │ Polkadot.js API
                     ↓
┌─────────────────────────────────────────────────────┐
│          SMART CONTRACTS (Ink! 4.2.1)               │
│  - LUSDT Token Contract (PSP22)                     │
│  - Tax Manager Contract                             │
└─────────────────────────────────────────────────────┘
```

---

## 🏗️ Arquitetura de Integração / Integration Architecture

### Frontend → Backend

**Comunicação**: HTTP REST API
**Porta**: 3001 (configurável via `VITE_BRIDGE_API_URL`)

```typescript
// Frontend Configuration
// Configuração do Frontend
const BRIDGE_API_URL = import.meta.env.VITE_BRIDGE_API_URL || 'http://localhost:3001';
```

### Backend → Smart Contracts

**Comunicação**: Polkadot.js API
**Rede**: Lunes Chain (wss://rpc.lunes.io) ou local (ws://localhost:9944)

---

## ⚙️ Setup / Configuração

### 1. Variáveis de Ambiente

#### Frontend (`lusdt-app/.env`)
```bash
# Bridge Service URL
VITE_BRIDGE_API_URL=http://localhost:3001

# Lunes Network
VITE_LUNES_RPC_URL=ws://localhost:9944

# Solana Network
VITE_SOLANA_RPC_URL=https://api.devnet.solana.com
VITE_USDT_MINT=Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr

# Contract Addresses
VITE_LUSDT_CONTRACT=5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY
VITE_TAX_MANAGER_CONTRACT=5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY
```

#### Bridge Service (`bridge-service/.env`)
```bash
# Server
PORT=3001
NODE_ENV=development

# Lunes Network
LUNES_RPC_URL=ws://localhost:9944
LUSDT_CONTRACT_ADDRESS=5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY
TAX_MANAGER_CONTRACT_ADDRESS=5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY

# Solana Network
SOLANA_RPC_URL=https://api.devnet.solana.com
USDT_MINT=Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr
TREASURY_PUBKEY=YourTreasuryPublicKey

# Admin
ADMIN_WALLET=5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY
```

### 2. Iniciar Serviços

```bash
# Terminal 1: Bridge Service
cd bridge-service
npm install
npm run dev

# Terminal 2: Frontend
cd lusdt-app
npm install
npm run dev

# Terminal 3: Local Node (opcional para desenvolvimento)
substrate-contracts-node --dev
```

---

## 📡 API Reference

### Endpoints de Status / Status Endpoints

#### GET `/health`
**Descrição**: Verificação de saúde do serviço
```json
// Response
{
  "status": "healthy",
  "uptime": 12345,
  "timestamp": "2024-01-15T10:30:00.000Z",
  "version": "1.0.0"
}
```

#### GET `/stats`
**Descrição**: Estatísticas da ponte
```json
// Response
{
  "totalTransactions": 1250,
  "pendingTransactions": 3,
  "completedTransactions": 1230,
  "failedTransactions": 17,
  "uptime": 86400,
  "lastProcessed": "2024-01-15T10:29:50.000Z"
}
```

### Endpoints de Transações / Transaction Endpoints

#### GET `/transactions`
**Descrição**: Listar todas as transações
**Query Params**: `?status=pending|processing|completed|failed`
```json
// Response
{
  "transactions": [
    {
      "id": "tx_1705317000_abc123",
      "sourceChain": "solana",
      "destinationChain": "lunes",
      "amount": 1000,
      "sourceAddress": "8K5s...",
      "destinationAddress": "5Grw...",
      "status": "completed",
      "createdAt": "2024-01-15T10:30:00.000Z",
      "completedAt": "2024-01-15T10:30:05.000Z",
      "feeType": "usdt",
      "feeAmount": 1.0,
      "feeCurrency": "USDT"
    }
  ],
  "total": 1
}
```

#### GET `/transactions/:id`
**Descrição**: Obter transação específica
```json
// Response
{
  "id": "tx_1705317000_abc123",
  "sourceChain": "solana",
  "destinationChain": "lunes",
  "amount": 1000,
  "sourceAddress": "8K5s...",
  "destinationAddress": "5Grw...",
  "status": "completed",
  "createdAt": "2024-01-15T10:30:00.000Z",
  "completedAt": "2024-01-15T10:30:05.000Z",
  "feeType": "usdt",
  "feeAmount": 1.0,
  "feeCurrency": "USDT"
}
```

### Endpoints da Ponte / Bridge Endpoints

#### POST `/bridge/calculate-fee`
**Descrição**: Calcular taxa para uma transação
```json
// Request
{
  "amount": 1000,
  "sourceChain": "solana",
  "feeType": "usdt" // Optional
}

// Response
{
  "feeType": "usdt",
  "feeAmount": 1.0,
  "feeCurrency": "USDT",
  "feePercentage": 0.1,
  "totalAmount": 1001.0,
  "netAmount": 1000
}
```

#### POST `/bridge/solana-to-lunes`
**Descrição**: Criar transação Solana → Lunes (USDT → LUSDT)
```json
// Request
{
  "amount": "1000",
  "sourceAddress": "8K5s...",
  "destinationAddress": "5Grw...",
  "feeType": "usdt"
}

// Response
{
  "transactionId": "tx_1705317000_abc123",
  "status": "pending",
  "message": "Bridge transaction initiated"
}
```

#### POST `/bridge/lunes-to-solana`
**Descrição**: Criar transação Lunes → Solana (LUSDT → USDT)
```json
// Request
{
  "amount": "1000",
  "sourceAddress": "5Grw...",
  "destinationAddress": "8K5s...",
  "feeType": "lunes" // or "lusdt" or "usdt"
}

// Response
{
  "transactionId": "tx_1705317000_xyz789",
  "status": "pending",
  "message": "Bridge transaction initiated"
}
```

### Endpoints Administrativos / Admin Endpoints

#### GET `/admin/contract-status`
**Descrição**: Obter status do contrato
```json
// Response
{
  "isPaused": false,
  "pauseReason": "",
  "lunesPrice": 0.5,
  "monthlyVolume": 8500,
  "totalSupply": 1000000,
  "feeConfig": {
    "lowVolumeFee": 60,
    "mediumVolumeFee": 50,
    "highVolumeFee": 30
  }
}
```

#### POST `/admin/pause`
**Descrição**: Pausar operações do contrato
```json
// Request
{
  "adminAddress": "5Grw...",
  "reason": "Security maintenance"
}

// Response
{
  "success": true,
  "message": "Contract paused successfully",
  "status": {
    "isPaused": true,
    "reason": "Security maintenance",
    "pausedAt": 1705317000000
  }
}
```

#### POST `/admin/unpause`
**Descrição**: Despausar operações do contrato
```json
// Request
{
  "adminAddress": "5Grw..."
}

// Response
{
  "success": true,
  "message": "Contract unpaused successfully",
  "status": {
    "isPaused": false
  }
}
```

#### POST `/admin/update-lunes-price`
**Descrição**: Atualizar preço do LUNES
```json
// Request
{
  "adminAddress": "5Grw...",
  "newPrice": 0.75
}

// Response
{
  "success": true,
  "message": "LUNES price updated successfully",
  "oldPrice": 0.5,
  "newPrice": 0.75
}
```

#### POST `/admin/update-fee-config`
**Descrição**: Atualizar configuração de taxas
```json
// Request
{
  "adminAddress": "5Grw...",
  "config": {
    "lowVolumeFee": 60,
    "mediumVolumeFee": 50,
    "highVolumeFee": 30
  }
}

// Response
{
  "success": true,
  "message": "Fee configuration updated successfully",
  "oldConfig": {
    "lowVolumeFee": 60,
    "mediumVolumeFee": 50,
    "highVolumeFee": 30
  },
  "newConfig": {
    "lowVolumeFee": 55,
    "mediumVolumeFee": 45,
    "highVolumeFee": 25
  }
}
```

---

## ⚛️ Hooks React

### useBridgeAPI
**Hook base para comunicação com a API**

```typescript
import { useBridgeAPI } from './api/bridgeClient';

function MyComponent() {
  const { client, isConnected, error, isLoading } = useBridgeAPI();

  if (isLoading) return <div>Connecting to bridge...</div>;
  if (!isConnected) return <div>Bridge service offline</div>;

  // Use client for API calls
  return <div>Bridge connected!</div>;
}
```

### useBridgeTransactions
**Hook para gerenciar transações**

```typescript
import { useBridgeTransactions } from './hooks/useBridge';

function TransactionList() {
  const {
    transactions,
    loading,
    error,
    loadTransactions,
    loadUserTransactions,
  } = useBridgeTransactions();

  useEffect(() => {
    loadTransactions('completed');
  }, [loadTransactions]);

  return (
    <div>
      {transactions.map(tx => (
        <TransactionCard key={tx.id} transaction={tx} />
      ))}
    </div>
  );
}
```

### useCreateBridgeTransaction
**Hook para criar transações**

```typescript
import { useCreateBridgeTransaction } from './hooks/useBridge';

function BridgeForm() {
  const {
    depositUSDT,
    withdrawLUSDT,
    loading,
    error,
    transactionId,
  } = useCreateBridgeTransaction();

  const handleDeposit = async () => {
    const result = await depositUSDT(
      '1000',
      solanaAddress,
      lunesAddress
    );
    
    if (result) {
      console.log('Transaction created:', result.transactionId);
    }
  };

  return (
    <button onClick={handleDeposit} disabled={loading}>
      {loading ? 'Processing...' : 'Deposit USDT'}
    </button>
  );
}
```

### useAdminOperations
**Hook para operações administrativas**

```typescript
import { useAdminOperations } from './hooks/useBridge';

function AdminControls() {
  const {
    pauseContract,
    unpauseContract,
    updateLunesPrice,
    loading,
    error,
  } = useAdminOperations();

  const handlePause = async () => {
    const result = await pauseContract(
      adminAddress,
      'Emergency maintenance'
    );
    
    if (result?.success) {
      alert('Contract paused successfully!');
    }
  };

  return (
    <button onClick={handlePause} disabled={loading}>
      Emergency Pause
    </button>
  );
}
```

---

## 🔄 Fluxos Completos / Complete Flows

### Fluxo 1: Depósito (USDT → LUSDT)

```
1. Usuário conecta carteiras (Phantom + Polkadot.js)
   User connects wallets (Phantom + Polkadot.js)
   
2. Frontend calcula taxa usando calculateFee()
   Frontend calculates fee using calculateFee()
   
3. Usuário aprova transação no Phantom
   User approves transaction in Phantom
   
4. Frontend chama POST /bridge/solana-to-lunes
   Frontend calls POST /bridge/solana-to-lunes
   
5. Backend detecta depósito no Solana
   Backend detects deposit on Solana
   
6. Backend chama LUSDT.mint() no contrato Lunes
   Backend calls LUSDT.mint() on Lunes contract
   
7. Tax Manager processa taxas
   Tax Manager processes fees
   
8. Frontend monitora via useTransactionMonitor
   Frontend monitors via useTransactionMonitor
   
9. Usuário recebe LUSDT na carteira Lunes
   User receives LUSDT in Lunes wallet
```

### Fluxo 2: Retirada (LUSDT → USDT)

```
1. Usuário conecta carteiras
   User connects wallets
   
2. Frontend calcula taxa e mostra opções de pagamento
   Frontend calculates fee and shows payment options
   
3. Usuário seleciona tipo de taxa (LUNES/LUSDT/USDT)
   User selects fee type (LUNES/LUSDT/USDT)
   
4. Usuário aprova transação no Polkadot.js
   User approves transaction in Polkadot.js
   
5. Frontend chama POST /bridge/lunes-to-solana
   Frontend calls POST /bridge/lunes-to-solana
   
6. Backend detecta burn de LUSDT
   Backend detects LUSDT burn
   
7. Backend transfere USDT do treasury Solana
   Backend transfers USDT from Solana treasury
   
8. Tax Manager processa e distribui taxas
   Tax Manager processes and distributes fees
   
9. Usuário recebe USDT na carteira Solana
   User receives USDT in Solana wallet
```

### Fluxo 3: Operação Admin (Pausar Contrato)

```
1. Admin conecta carteira Polkadot.js
   Admin connects Polkadot.js wallet
   
2. Frontend verifica isOwner() via useLunesContract
   Frontend verifies isOwner() via useLunesContract
   
3. Admin aciona emergency pause com motivo
   Admin triggers emergency pause with reason
   
4. Frontend chama POST /admin/pause
   Frontend calls POST /admin/pause
   
5. Backend verifica permissões do admin
   Backend verifies admin permissions
   
6. Backend chama emergencyPause() no contrato
   Backend calls emergencyPause() on contract
   
7. Contract emite evento PauseChanged
   Contract emits PauseChanged event
   
8. Frontend atualiza UI mostrando status pausado
   Frontend updates UI showing paused status
```

---

## 💡 Exemplos de Uso / Usage Examples

### Exemplo 1: Componente Completo de Depósito
```typescript
import { useWallet } from './components/WalletProvider';
import { useCreateBridgeTransaction, useFeeCalculation } from './hooks/useBridge';
import { useState } from 'react';

function DepositForm() {
  const { solanaWallet, lunesWallet } = useWallet();
  const { depositUSDT, loading, error, transactionId } = useCreateBridgeTransaction();
  const { fee, calculateFee } = useFeeCalculation();
  const [amount, setAmount] = useState('');

  // Calculate fee when amount changes
  useEffect(() => {
    if (amount && parseFloat(amount) > 0) {
      calculateFee(parseFloat(amount), 'solana', 'usdt');
    }
  }, [amount, calculateFee]);

  const handleDeposit = async () => {
    if (!solanaWallet || !lunesWallet) {
      alert('Please connect both wallets');
      return;
    }

    try {
      const result = await depositUSDT(
        amount,
        solanaWallet.publicKey.toString(),
        lunesWallet.address
      );

      if (result) {
        alert(`Deposit initiated! Transaction ID: ${result.transactionId}`);
      }
    } catch (err) {
      console.error('Deposit failed:', err);
    }
  };

  return (
    <div className="deposit-form">
      <h2>Deposit USDT → Get LUSDT</h2>
      
      <input
        type="number"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        placeholder="Amount"
        disabled={loading}
      />

      {fee && (
        <div className="fee-info">
          <p>Fee: {fee.feeAmount} {fee.feeCurrency} ({fee.feePercentage}%)</p>
          <p>You will receive: {amount ? parseFloat(amount) - fee.feeAmount : 0} LUSDT</p>
        </div>
      )}

      <button onClick={handleDeposit} disabled={loading || !amount}>
        {loading ? 'Processing...' : 'Deposit'}
      </button>

      {error && <div className="error">{error}</div>}
      {transactionId && <div className="success">Transaction ID: {transactionId}</div>}
    </div>
  );
}
```

### Exemplo 2: Dashboard com Transações em Tempo Real
```typescript
import { useRealtimeTransactions } from './hooks/useBridge';
import { useWallet } from './components/WalletProvider';

function UserDashboard() {
  const { lunesWallet } = useWallet();
  const { transactions, loading, error } = useRealtimeTransactions(
    lunesWallet?.address,
    10000 // Refresh every 10 seconds
  );

  if (loading) return <div>Loading transactions...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <div className="dashboard">
      <h2>Your Transactions</h2>
      
      <div className="stats">
        <div className="stat">
          <span>Total: {transactions.length}</span>
        </div>
        <div className="stat">
          <span>
            Pending: {transactions.filter(tx => tx.status === 'pending').length}
          </span>
        </div>
      </div>

      <div className="transactions">
        {transactions.map(tx => (
          <TransactionCard key={tx.id} transaction={tx} />
        ))}
      </div>
    </div>
  );
}
```

---

## 🛡️ Segurança / Security

### Validações Necessárias

1. **Frontend**:
   - ✅ Validar endereços de carteira
   - ✅ Validar valores de transação (> 0)
   - ✅ Confirmar operações críticas
   - ✅ Verificar permissões antes de mostrar UI admin

2. **Backend**:
   - ✅ Validar todas as entradas
   - ✅ Verificar permissões de admin
   - ✅ Rate limiting
   - ✅ Sanitizar dados antes de processar

3. **Smart Contracts**:
   - ✅ Verificar `caller()` em funções restritas
   - ✅ Validar valores antes de operações
   - ✅ Usar `checked_*` para aritmética
   - ✅ Emitir eventos para auditoria

### Práticas Recomendadas

```typescript
// ✅ BOM: Validar entrada
const amount = parseFloat(inputAmount);
if (isNaN(amount) || amount <= 0) {
  throw new Error('Invalid amount');
}

// ❌ RUIM: Não validar
const amount = parseFloat(inputAmount);
await depositUSDT(amount.toString(), ...);

// ✅ BOM: Confirmar operações críticas
const confirmed = await showConfirmDialog(
  'Pausar contrato?',
  'Esta ação afetará todos os usuários.'
);
if (confirmed) {
  await pauseContract(adminAddress, reason);
}

// ❌ RUIM: Executar sem confirmação
await pauseContract(adminAddress, reason);
```

---

## 🧪 Testes / Testing

### Testar Integração Frontend-Backend

```typescript
// test/integration/bridge.test.ts
import { describe, it, expect } from 'vitest';
import BridgeAPIClient from '../src/api/bridgeClient';

describe('Bridge API Integration', () => {
  const client = new BridgeAPIClient('http://localhost:3001');

  it('should connect to bridge service', async () => {
    const health = await client.getHealth();
    expect(health.status).toBe('healthy');
  });

  it('should calculate fee correctly', async () => {
    const fee = await client.calculateFee(1000, 'solana', 'usdt');
    expect(fee.feeAmount).toBeGreaterThan(0);
    expect(fee.feeCurrency).toBe('USDT');
  });

  it('should create bridge transaction', async () => {
    const result = await client.bridgeSolanaToLunes({
      amount: '1000',
      sourceAddress: 'mock_solana_address',
      destinationAddress: 'mock_lunes_address'
    });
    
    expect(result.transactionId).toBeDefined();
    expect(result.status).toBe('pending');
  });
});
```

### Script de Teste Completo

```bash
#!/bin/bash
# test-integration.sh

echo "🧪 Testing LUSDT Bridge Integration"

# 1. Health Check
echo "1️⃣ Testing health endpoint..."
curl http://localhost:3000/health

# 2. Calculate Fee
echo "\n2️⃣ Testing fee calculation..."
curl -X POST http://localhost:3000/bridge/calculate-fee \
  -H "Content-Type: application/json" \
  -d '{"amount": 1000, "sourceChain": "solana"}'

# 3. Create Transaction
echo "\n3️⃣ Creating test transaction..."
curl -X POST http://localhost:3000/bridge/solana-to-lunes \
  -H "Content-Type: application/json" \
  -d '{"amount": "1000", "sourceAddress": "test", "destinationAddress": "test"}'

# 4. Get Stats
echo "\n4️⃣ Getting statistics..."
curl http://localhost:3000/stats

echo "\n✅ Integration tests complete!"
```

---

## 📝 Checklist de Integração

- [ ] Frontend conecta ao Bridge Service
- [ ] Hooks React funcionando corretamente
- [ ] Cálculo de taxas em tempo real
- [ ] Criação de transações Solana → Lunes
- [ ] Criação de transações Lunes → Solana
- [ ] Monitoramento de transações em tempo real
- [ ] Painel administrativo funcional
- [ ] Operações de pause/unpause
- [ ] Atualização de preço LUNES
- [ ] Atualização de configuração de taxas
- [ ] Tratamento de erros robusto
- [ ] Testes de integração passando
- [ ] Documentação atualizada

---

## 🤝 Contribuindo

Para contribuir com melhorias na integração:

1. Fork o repositório
2. Crie uma branch (`git checkout -b feature/integration-improvement`)
3. Commit suas mudanças (`git commit -am 'Add integration feature'`)
4. Push para a branch (`git push origin feature/integration-improvement`)
5. Abra um Pull Request

---

## 📞 Suporte

Para questões sobre integração:

- 📧 Email: suporte@lusdt.io
- 💬 Discord: [LUSDT Community](https://discord.gg/lusdt)
- 📖 Docs: [docs.lusdt.io](https://docs.lusdt.io)

---

**Última atualização**: 2024-01-15
**Versão**: 1.0.0





Server
Username: REDACTED
Password: REDACTED
VPS_IP: REDACTED

Chaves
ssh-keygen -t ed25519 -C "vps-deploy" -f ~/.ssh/id_ed25519 -N ""
