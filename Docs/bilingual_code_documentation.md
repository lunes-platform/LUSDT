# LUSDT Project - Bilingual Code Documentation
# Projeto LUSDT - Documentação de Código Bilíngue

## Overview / Visão Geral

This document provides a comprehensive overview of the LUSDT project codebase with bilingual comments (English/Portuguese) to facilitate international collaboration and maintenance.

Este documento fornece uma visão abrangente da base de código do projeto LUSDT com comentários bilíngues (inglês/português) para facilitar a colaboração e manutenção internacional.

---

## Project Structure / Estrutura do Projeto

```
LUSDT/
├── contracts/                    # Smart contracts / Contratos inteligentes
│   ├── lusdt_token/              # Main LUSDT token contract / Contrato principal do token LUSDT
│   ├── tax_manager/              # Fee management contract / Contrato de gerenciamento de taxas
│   └── common/                   # Shared types and traits / Tipos e traits compartilhados
├── bridge-service/               # Off-chain bridge service / Serviço de ponte off-chain
├── scripts/                      # Setup and deployment scripts / Scripts de configuração e deploy
├── solana-keys/                  # Solana guardian keypairs / Pares de chaves dos guardiões Solana
└── Docs/                         # Documentation / Documentação
```

---

## Smart Contracts / Contratos Inteligentes

### 1. LUSDT Token Contract (`contracts/lusdt_token/src/lib.rs`)

**Purpose / Propósito**: Main PSP22-compatible token contract with security features
**Propósito**: Contrato de token principal compatível com PSP22 com recursos de segurança

#### Key Features / Recursos Principais:

- **Role-Based Access Control (RBAC) / Controle de Acesso Baseado em Papéis**
  - Owner role for administrative functions / Papel de proprietário para funções administrativas
  - Bridge role for cross-chain operations / Papel de ponte para operações cross-chain
  - Emergency admin for circuit breaker / Administrador de emergência para disjuntor

- **Security Features / Recursos de Segurança**
  - Circuit breaker (pause/unpause) / Disjuntor de circuito (pausar/despausar)
  - Reentrancy protection / Proteção contra reentrância
  - Rate limiting for mints / Limitação de taxa para cunhagem
  - Overflow protection / Proteção contra overflow

- **PSP22 Compliance / Conformidade PSP22**
  - Standard token functions / Funções padrão de token
  - Transfer and approval mechanisms / Mecanismos de transferência e aprovação
  - Event emission for transparency / Emissão de eventos para transparência

#### Storage Fields / Campos de Armazenamento:

```rust
pub struct LusdtToken {
    version: u16,                     // Contract version / Versão do contrato
    total_supply: Balance,            // Total token supply / Fornecimento total de tokens
    balances: Mapping<AccountId, Balance>,  // User balances / Saldos dos usuários
    allowances: Mapping<(AccountId, AccountId), Balance>,  // Spending allowances / Permissões de gasto
    
    // Security fields / Campos de segurança
    owner: AccountId,                 // Contract owner / Proprietário do contrato
    bridge_account: AccountId,        // Bridge service account / Conta do serviço de ponte
    emergency_admin: AccountId,       // Emergency admin account / Conta de administrador de emergência
    paused: bool,                     // Circuit breaker state / Estado do disjuntor
    pause_reason: Option<String>,     // Pause reason / Motivo da pausa
    paused_at: Option<u64>,          // Pause timestamp / Timestamp da pausa
    locked: bool,                     // Reentrancy guard / Proteção contra reentrância
    
    // Rate limiting / Limitação de taxa
    last_mint_time: u64,             // Last mint timestamp / Último timestamp de cunhagem
    mint_window_amount: Balance,     // Mints in current window / Cunhagens na janela atual
    mint_window_start: u64,          // Window start time / Tempo de início da janela
    
    tax_manager: AccountId,          // Tax manager contract / Contrato gerenciador de taxas
}
```

### 2. Tax Manager Contract (`contracts/tax_manager/src/lib.rs`)

**Purpose / Propósito**: Manages fee collection and distribution for LUSDT operations
**Propósito**: Gerencia a coleta e distribuição de taxas para operações LUSDT

#### Fee Structure / Estrutura de Taxas:

**Intelligent Capped Fee System / Sistema de Taxas Inteligente com Tetos**:
- Base fee: 0.30%-0.60% in USD with smart LUNES caps / Taxa base: 0,30%-0,60% em USD com tetos inteligentes em LUNES
- Fee caps prevent excessive charges when LUNES price increases / Tetos previnem taxas excessivas quando preço do LUNES aumenta

**Transaction Caps / Tetos por Transação**:
- ≤ $100: Max 0.5 LUNES / Máx 0,5 LUNES
- $100-$1K: Max 2 LUNES / Máx 2 LUNES  
- $1K-$10K: Max 10 LUNES / Máx 10 LUNES
- > $10K: Max 50 LUNES / Máx 50 LUNES

**Mint Operations / Operações de Cunhagem**:
- Development team: 40% / Equipe de desenvolvimento: 40%
- DAO treasury: 20% / Tesouro DAO: 20%
- Backing fund: 25% / Fundo de lastro: 25%
- Rewards fund: 15% / Fundo de recompensas: 15%

**Burn Operations / Operações de Queima**:
- Development team: 40% / Equipe de desenvolvimento: 40%
- DAO treasury: 20% / Tesouro DAO: 20%
- Liquidity pool: 20% / Pool de liquidez: 20%
- Burn address: 20% / Endereço de queima: 20%

#### Key Functions / Funções Principais:

```rust
// Process fees for mint/burn operations / Processar taxas para operações de mint/burn
fn process_fees(operation: OperationType, user: AccountId, lusdt_amount: u128)

// Calculate fees in LUNES tokens / Calcular taxas em tokens LUNES
fn calculate_fee_in_lunes(lusdt_amount: u128) -> u128

// Update volume statistics / Atualizar estatísticas de volume
fn update_volume(operation: OperationType, amount: u128)
```

---

## Bridge Service / Serviço de Ponte

### Simple Bridge (`bridge-service/src/simple-bridge.ts`)

**Purpose / Propósito**: Off-chain service for cross-chain transfers between Solana and Lunes
**Propósito**: Serviço off-chain para transferências cross-chain entre Solana e Lunes

#### Key Features / Recursos Principais:

- **Cross-chain transfers / Transferências cross-chain**
  - Solana → Lunes transfers / Transferências Solana → Lunes
  - Lunes → Solana transfers / Transferências Lunes → Solana

- **Transaction tracking / Rastreamento de transações**
  - Unique transaction IDs / IDs únicos de transação
  - Status monitoring / Monitoramento de status
  - Completion tracking / Rastreamento de conclusão

- **RESTful API / API RESTful**
  - Health checks / Verificações de saúde
  - Statistics endpoint / Endpoint de estatísticas
  - Transaction queries / Consultas de transação

#### API Endpoints / Endpoints da API:

```typescript
GET  /health                    // Service health check / Verificação de saúde do serviço
GET  /stats                     // Bridge statistics / Estatísticas da ponte
GET  /transactions              // List all transactions / Listar todas as transações
GET  /transactions/:id          // Get specific transaction / Obter transação específica
POST /bridge/solana-to-lunes    // Initiate Solana → Lunes transfer / Iniciar transferência Solana → Lunes
POST /bridge/lunes-to-solana    // Initiate Lunes → Solana transfer / Iniciar transferência Lunes → Solana
```

---

## Scripts / Scripts

### 1. Solana Multisig Setup (`scripts/setup-solana-multisig.sh`)

**Purpose / Propósito**: Sets up a 3-of-5 multisig treasury on Solana for USDT storage
**Propósito**: Configura um tesouro multisig 3-de-5 na Solana para armazenamento de USDT

#### Security Features / Recursos de Segurança:

- **Guardian keys / Chaves dos guardiões**: 5 independent keypairs / 5 pares de chaves independentes
- **Threshold signature / Assinatura de threshold**: Requires 3 out of 5 signatures / Requer 3 de 5 assinaturas
- **Treasury account / Conta do tesouro**: Secure token storage / Armazenamento seguro de tokens

#### Generated Assets / Ativos Gerados:

```bash
solana-keys/
├── guardian_1_keypair.json      # Guardian 1 private key / Chave privada do Guardião 1
├── guardian_2_keypair.json      # Guardian 2 private key / Chave privada do Guardião 2
├── guardian_3_keypair.json      # Guardian 3 private key / Chave privada do Guardião 3
├── guardian_4_keypair.json      # Guardian 4 private key / Chave privada do Guardião 4
└── guardian_5_keypair.json      # Guardian 5 private key / Chave privada do Guardião 5
```

### 2. Multisig Testing (`scripts/test-solana-multisig.sh`)

**Purpose / Propósito**: Tests the multisig functionality with real transactions
**Propósito**: Testa a funcionalidade multisig com transações reais

---

## Security Considerations / Considerações de Segurança

### 1. Smart Contract Security / Segurança dos Contratos Inteligentes

- **Checks-Effects-Interactions Pattern / Padrão Checks-Effects-Interactions**
  - All state changes occur before external calls / Todas as mudanças de estado ocorrem antes de chamadas externas
  - Prevents reentrancy attacks / Previne ataques de reentrância

- **Access Control / Controle de Acesso**
  - Role-based permissions / Permissões baseadas em papéis
  - Multi-signature requirements / Requisitos de múltiplas assinaturas
  - Emergency pause functionality / Funcionalidade de pausa de emergência

- **Arithmetic Safety / Segurança Aritmética**
  - Overflow protection with checked operations / Proteção contra overflow com operações verificadas
  - Safe math for all calculations / Matemática segura para todos os cálculos

### 2. Bridge Security / Segurança da Ponte

- **HSM Integration / Integração HSM**
  - Hardware security modules for key management / Módulos de segurança de hardware para gerenciamento de chaves
  - Secure key storage and operations / Armazenamento e operações seguras de chaves

- **Transaction Monitoring / Monitoramento de Transações**
  - Real-time transaction tracking / Rastreamento de transação em tempo real
  - Automated anomaly detection / Detecção automática de anomalias
  - Alert systems for suspicious activity / Sistemas de alerta para atividade suspeita

### 3. Operational Security / Segurança Operacional

- **Multi-signature Treasury / Tesouro Multi-assinatura**
  - 3-of-5 threshold for fund movements / Threshold 3-de-5 para movimentação de fundos
  - Geographic distribution of guardian keys / Distribuição geográfica das chaves dos guardiões
  - Regular key rotation procedures / Procedimentos regulares de rotação de chaves

---

## Development Guidelines / Diretrizes de Desenvolvimento

### 1. Code Comments / Comentários de Código

- **Bilingual documentation / Documentação bilíngue**: All public functions and important logic
- **Security annotations / Anotações de segurança**: Mark security-critical sections
- **Performance notes / Notas de performance**: Document gas-optimized patterns

### 2. Testing Standards / Padrões de Teste

- **Unit tests / Testes unitários**: Minimum 90% coverage / Cobertura mínima de 90%
- **Integration tests / Testes de integração**: Cross-contract interactions / Interações entre contratos
- **E2E tests / Testes E2E**: Full bridge workflow / Fluxo completo da ponte

### 3. Deployment Process / Processo de Deploy

- **Testnet validation / Validação em testnet**: Thorough testing before mainnet / Teste completo antes do mainnet
- **Security audit / Auditoria de segurança**: Professional audit required / Auditoria profissional necessária
- **Gradual rollout / Lançamento gradual**: Phased deployment strategy / Estratégia de deploy faseado

---

## Maintenance / Manutenção

### 1. Regular Updates / Atualizações Regulares

- **Dependency updates / Atualizações de dependências**: Monthly security patches / Patches de segurança mensais
- **Performance monitoring / Monitoramento de performance**: Continuous optimization / Otimização contínua
- **Documentation updates / Atualizações de documentação**: Keep bilingual docs current / Manter docs bilíngues atualizados

### 2. Incident Response / Resposta a Incidentes

- **Emergency procedures / Procedimentos de emergência**: Circuit breaker activation / Ativação do disjuntor
- **Communication plan / Plano de comunicação**: Multilingual user notifications / Notificações multilíngues aos usuários
- **Recovery protocols / Protocolos de recuperação**: System restoration procedures / Procedimentos de restauração do sistema

---

## Contact Information / Informações de Contato

For technical questions about this codebase, please contact:
Para questões técnicas sobre esta base de código, entre em contato:

- **Development Team / Equipe de Desenvolvimento**: [team@lusdt.com]
- **Security Team / Equipe de Segurança**: [security@lusdt.com]
- **Documentation / Documentação**: [docs@lusdt.com]

---

*Last updated / Última atualização: 2025-01-03*
*Document version / Versão do documento: 1.0*