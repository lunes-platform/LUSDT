# 🏗️ Arquitetura da Plataforma LUSDT Bridge

## 📋 Visão Geral

A Plataforma LUSDT Bridge é uma solução completa para ponte cross-chain entre as redes Solana e Lunes, permitindo a conversão bidirecional entre USDT (Solana) e LUSDT (Lunes) com sistema de taxas inteligente baseado em volume.

### Arquitetura Geral

```text
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Usuário       │    │  Bridge Service │    │   Smart         │
│   (Frontend)    │───▶│   (Off-chain)   │───▶│   Contracts     │
│                 │    │                 │    │   (Lunes)       │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                        │                        │
         ▼                        ▼                        ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   USDT Token    │    │   Treasury      │    │   LUSDT Token   │
│   (SPL Token)   │    │   Management    │    │   (PSP22)       │
│   Solana        │    │   (Multisig)    │    │   Lunes Chain   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

---

## 📁 Estrutura do Projeto

```
LUSDT/
├── contracts/          # 🏛️ Smart Contracts (Rust/ink!)
│   ├── lusdt_token/   # Token LUSDT (PSP22)
│   └── tax_manager/   # Gerenciador de Taxas Inteligente
├── bridge-service/    # 🌉 Serviço Off-chain (Node.js)
│   ├── src/
│   │   ├── solana/    # Cliente Solana (USDT)
│   │   ├── lunes/     # Cliente Lunes (LUSDT)
│   │   ├── bridge/    # Processador Principal
│   │   ├── monitoring/# Sistema de Monitoramento
│   │   ├── security/  # Utilitários de Segurança
│   │   └── config/    # Configurações
│   ├── package.json
│   └── docker-compose.yml
├── lusdt-app/         # 🎨 Frontend (React/TypeScript)
│   ├── src/
│   │   ├── components/# Componentes React
│   │   ├── hooks/     # Hooks Customizados
│   │   ├── contracts/ # Endereços e Tipos
│   │   └── config.ts  # Configurações
│   ├── package.json
│   └── vite.config.ts
├── scripts/           # 🔧 Utilitários de Deploy/Setup
│   ├── setup-solana-multisig.sh
│   ├── setup-local-test.sh
│   └── health-check.js
├── docs/             # 📚 Documentação
│   ├── solana_usdt_integration.md
│   ├── bilingual_code_documentation.md
│   └── security_analysis.md
└── solana-keys/      # 🔑 Chaves do Multisig Solana
    ├── guardian_1_keypair.json
    ├── guardian_2_keypair.json
    └── ...
```

---

## 🏛️ Componentes Principais

### 1. Smart Contracts (Rust/ink!)

#### LUSDT Token Contract
- **Arquivo:** `contracts/lusdt_token/src/lib.rs`
- **Padrão:** PSP22 (similar ao ERC20)
- **Funcionalidades:**
  - `mint()` - Cunhar tokens LUSDT
  - `burn()` - Queimar tokens LUSDT
  - `transfer()` - Transferir tokens
  - `emergency_pause()` - Pausa de emergência
  - `balance_of()` - Consulta de saldo

#### Tax Manager Contract
- **Arquivo:** `contracts/tax_manager/src/lib.rs`
- **Funcionalidades:**
  - `process_fees()` - Processamento de taxas
  - `get_current_fee_bps()` - Taxa atual (basis points)
  - `calculate_fee_in_lunes()` - Cálculo em LUNES
  - `update_lunes_price()` - Atualização de preço

### 2. Bridge Service (Node.js/TypeScript)

#### Solana Client
- **Arquivo:** `bridge-service/src/solana/client.ts`
- **Responsabilidades:**
  - Conexão com rede Solana
  - Transferências USDT
  - Consulta de saldos
  - Monitoramento de transações
  - Validação de endereços

#### Lunes Client
- **Arquivo:** `bridge-service/src/lunes/client.ts`
- **Responsabilidades:**
  - Conexão com rede Lunes/Substrate
  - Interação com contratos LUSDT
  - Monitoramento de eventos
  - Mint/Burn de tokens

#### Bridge Processor
- **Arquivo:** `bridge-service/src/bridge/processor.ts`
- **Fluxos:**
  - **USDT → LUSDT:** Solana → Lunes
  - **LUSDT → USDT:** Lunes → Solana
  - Processamento assíncrono
  - Gestão de estado das transações

### 3. Frontend (React/TypeScript)

#### Hooks de Integração
- `useSolanaContract.ts` - Integração Solana
- `useLunesContract.ts` - Integração Lunes
- `useWallet.ts` - Gerenciamento de carteiras

#### Componentes Principais
- `BridgeInterface.tsx` - Interface principal do bridge
- `UserDashboard.tsx` - Dashboard analítico do usuário
- `AdminPanel.tsx` - Painel administrativo
- `WalletProvider.tsx` - Context de carteiras

---

## 🔄 Fluxos de Transação

### Fluxo 1: USDT → LUSDT (Mint)

```text
1. Usuário conecta Phantom (Solana) + Polkadot.js (Lunes)
2. Frontend calcula taxas baseado no volume mensal
3. Usuário transfere USDT para treasury Solana com memo
4. Bridge Service detecta depósito via monitoramento
5. Valida transação e chama LUSDT.mint() no contrato
6. LUSDT é creditado na carteira Lunes do usuário
7. Taxas são processadas pelo Tax Manager
```

### Fluxo 2: LUSDT → USDT (Burn)

```text
1. Usuário conecta carteiras
2. Frontend calcula taxas
3. Usuário chama LUSDT.burn() com endereço Solana destino
4. Bridge Service detecta evento de burn
5. Valida transação e transfere USDT da treasury Solana
6. USDT é creditado na carteira Solana do usuário
7. Taxas são distribuídas pelas carteiras do Tax Manager
```

---

## 💰 Sistema de Taxas Inteligente

### Estrutura de Tiers por Volume

```typescript
const feeTiers = {
  low:     { volume: '< 10K',  fee: '0.60%' }, // Baixo Volume
  medium:  { volume: '10K-100K', fee: '0.50%' }, // Médio Volume
  high:    { volume: '> 100K',  fee: '0.30%' }  // Alto Volume
}
```

### Tetos de Segurança por Transação

```typescript
const feeCaps = {
  '≤ $100':    'Max 0.5 LUNES',
  '$100-1K':   'Max 2 LUNES',
  '$1K-10K':   'Max 10 LUNES',
  '> $10K':     'Max 50 LUNES'
}
```

### Distribuição de Taxas

#### Mint Operations (USDT → LUSDT):
- **40%** - Desenvolvimento
- **20%** - DAO Treasury
- **25%** - Fundo de Lastro
- **15%** - Recompensas

#### Burn Operations (LUSDT → USDT):
- **40%** - Desenvolvimento
- **20%** - DAO Treasury
- **20%** - Liquidity Pool
- **20%** - Burn (destruição)

---

## 🔐 Arquitetura de Segurança

### Circuit Breaker
- **Emergency Pause:** Qualquer admin pode pausar operações
- **Owner Unpause:** Apenas owner pode retomar operações
- **Status Transparente:** Estado do contrato é público

### Controle de Acesso
- **RBAC (Role-Based Access Control)**
- **Bridge Role:** Apenas bridge service pode mint
- **Owner:** Controle administrativo completo
- **Emergency Admin:** Pausa de emergência independente

### Rate Limiting
- **Limites por Hora:** Máximo de transações por hora
- **Limites por Valor:** Máximo por transação e diário
- **Monitoramento:** Alertas automáticos

### Multisig Treasury (Solana)
- **Configuração:** 3-of-5 guardians
- **Protocolo:** Squads Protocol
- **Auditoria:** Todas as transações registradas

---

## 🔧 Configuração por Ambiente

### Desenvolvimento
```typescript
{
  solanaRpc: 'https://api.devnet.solana.com',
  usdtMint: 'Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr',
  lunesRpc: 'ws://localhost:9944',
  requiredConfirmations: 'confirmed'
}
```

### Produção
```typescript
{
  solanaRpc: 'https://api.mainnet-beta.solana.com',
  usdtMint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
  lunesRpc: 'wss://rpc.lunes.io',
  requiredConfirmations: 'finalized'
}
```

---

## 🚀 Guia de Desenvolvimento

### Setup Local
```bash
# Instalar dependências
npm install

# Rodar tudo
npm run dev

# Ou rodar separadamente
npm run dev:app      # Frontend
npm run dev:bridge   # Bridge Service
```

### Build
```bash
# Build tudo
npm run build

# Build específico
npm run build:app
npm run build:bridge
```

### Testes
```bash
# Testar tudo
npm run test

# Health check
npm run health-check
```

---

## 📊 Monitoramento e Observabilidade

### Métricas Principais
- **Volume de Transações:** Diariamente/Semanalmente
- **Taxa de Sucesso:** >99.8% esperado
- **Tempo Médio de Processamento:** <1.2 segundos
- **Paridade Treasury:** Desvio <1%

### Alertas Críticos
- **Paridade Deviada:** >1% diferença treasury vs total supply
- **Saldo Baixo:** Treasury < 50k USDT
- **Taxa de Falha:** >5% de transações falhando
- **Processamento Lento:** >30 segundos por transação

---

## 🎯 Benefícios da Arquitetura

### ✅ Simplicidade
- Estrutura clara e direta
- Uma aplicação por responsabilidade
- Dependências mínimas necessárias

### ✅ Segurança
- Circuit breaker para emergência
- Multisig treasury
- Rate limiting inteligente
- Auditoria completa de transações

### ✅ Escalabilidade
- Processamento assíncrono
- Monitoramento em tempo real
- Alertas automáticos
- Separação clara de responsabilidades

### ✅ Usabilidade
- Interface intuitiva
- Cálculo transparente de taxas
- Dashboard analítico completo
- Suporte multi-carteira

---

**Esta arquitetura garante uma ponte cross-chain robusta, segura e eficiente entre Solana e Lunes, estabelecendo o LUSDT como o primeiro token verdadeiramente cross-chain do ecossistema.**
