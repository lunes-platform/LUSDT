# LUSDT Contracts Deployment Runbook

Este documento fornece instruções detalhadas para implantação dos contratos LUSDT em diferentes ambientes.

## 📋 Pré-requisitos

### Ferramentas Necessárias
- `cargo-contract` v3.2.0 (compatível com ink! 4.2.1/4.3.0)
- Rust toolchain 1.85.0 (para build-std compatibility)
- Nó Lunes local via Docker (para testes locais)
- Node.js e npm/yarn (para scripts auxiliares)
- Polkadot.js Apps ou similar para interação com contratos

### Instalação das Ferramentas
```bash
# Instalar cargo-contract 3.2.0
cargo install cargo-contract --version 3.2.0 --force

# Instalar Rust toolchain 1.85.0 com rust-src
rustup install 1.85.0
rustup component add rust-src --toolchain 1.85.0-x86_64-apple-darwin

# Verificar instalações
cargo-contract --version  # 3.2.0
rustc +1.85.0 --version  # 1.85.0
```

## 🏗️ Arquitetura de Implantação

### Ordem de Implantação
1. **BurnEngine Contract** - Mecanismo deflacionário de LUNES
2. **Tax Manager Contract** - Gerenciador de taxas (dual-fee v3)
3. **LUSDT Token Contract** - Token principal (PSP22 + RBAC)
4. **Configuração e Integração** - Conectar contratos + set_burn_engine

### Dependências
```
BurnEngine ← Tax Manager ← LUSDT Token
                  ↓
         Distribution Wallets (80/15/5)
         ├── dev_solana / dev_lunes (80%)
         ├── insurance_fund (15%, fixo)
         └── staking_rewards_pool (5%, mensal ≥100k LUNES)
```

## 🌍 Ambientes de Implantação

### 1. Ambiente Local (Desenvolvimento)

#### Iniciar Nó Local (Docker)
```bash
docker start node-lunes
# ou: docker run -d --name node-lunes -p 9944:9944 lunes-node:latest --dev
# RPC: ws://localhost:9944
```

#### Parâmetros do Construtor - Local
```json
{
  "tax_manager": {
    "lunes_token_address": "5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY",
    "lusdt_token_address": "TBD_AFTER_DEPLOYMENT",
    "distribution_wallets": {
      "dev_solana": "5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY",
      "dev_lunes": "5FHneW46xGXgs5mUiveU4sbTyGBzmstUspZC92UhjJM694ty",
      "insurance_fund": "5FLSigC9HGRKVhB9FiEo4Y3koPsNmBmLJbpXg2mp1hXcS59Y",
      "staking_rewards_pool": "5DAAnrj7VHTznn2AWBemMuyBwZWs6FNFjdyVXUeYum3PTXFy"
    },
    "initial_lunes_price": 500000
  },
  "lusdt_token": {
    "tax_manager": "TBD_AFTER_TAX_MANAGER_DEPLOYMENT",
    "bridge_account": "5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY",
    "emergency_admin": "5FLSigC9HGRKVhB9FiEo4Y3koPsNmBmLJbpXg2mp1hXcS59Y"
  }
}
```

#### Último Deploy Local (RELEASE mode, cross-contract ✅)
```
Tax Manager:  5ETkoMMT5TnSBwgcc7ETk31DexEdYP7332kHM7wkgn4FENuw
LUSDT Token:  5CRWVeC2aqcTRjHbLMUi1ep3xtffmdQEnyNqJAGZUtPUpURc
```

> Para documentação detalhada do deploy com cross-contract, veja **[CROSS_CONTRACT_DEPLOY.md](./CROSS_CONTRACT_DEPLOY.md)**

### 2. Ambiente Testnet

#### Parâmetros do Construtor - Testnet
```json
{
  "tax_manager": {
    "lunes_token_address": "TESTNET_LUNES_TOKEN_ADDRESS",
    "lusdt_token_address": "TBD_AFTER_DEPLOYMENT",
    "distribution_wallets": {
      "dev_solana": "TESTNET_DEV_SOLANA_WALLET",
      "dev_lunes": "TESTNET_DEV_LUNES_WALLET",
      "insurance_fund": "TESTNET_INSURANCE_FUND_WALLET",
      "staking_rewards_pool": "TESTNET_STAKING_REWARDS_WALLET"
    },
    "initial_lunes_price": 500000
  },
  "lusdt_token": {
    "tax_manager": "TBD_AFTER_TAX_MANAGER_DEPLOYMENT",
    "bridge_account": "TESTNET_BRIDGE_ACCOUNT",
    "emergency_admin": "TESTNET_EMERGENCY_ADMIN"
  }
}
```

### 3. Ambiente Mainnet (Produção)

#### Parâmetros do Construtor - Mainnet
```json
{
  "tax_manager": {
    "lunes_token_address": "MAINNET_LUNES_TOKEN_ADDRESS",
    "lusdt_token_address": "TBD_AFTER_DEPLOYMENT",
    "distribution_wallets": {
      "dev_solana": "MAINNET_DEV_SOLANA_MULTISIG",
      "dev_lunes": "MAINNET_DEV_LUNES_MULTISIG",
      "insurance_fund": "MAINNET_INSURANCE_FUND_MULTISIG",
      "staking_rewards_pool": "MAINNET_STAKING_REWARDS_MULTISIG"
    },
    "initial_lunes_price": 500000
  },
  "lusdt_token": {
    "tax_manager": "TBD_AFTER_TAX_MANAGER_DEPLOYMENT",
    "bridge_account": "MAINNET_BRIDGE_SERVICE_HSM",
    "emergency_admin": "MAINNET_EMERGENCY_MULTISIG"
  }
}
```

## 🚀 Processo de Implantação

### Passo 1: Preparação

```bash
# Clonar repositório
git clone <repository_url>
cd LUSDT/contracts

# Executar script de preparação
./scripts/deploy.sh local development
```

### Passo 2: Implantação do BurnEngine

```bash
cd burn_engine

# Construir contrato
RUSTUP_TOOLCHAIN=1.85.0 cargo contract build --release

# Implantar
RUSTUP_TOOLCHAIN=1.85.0 cargo contract instantiate \
  --constructor new \
  --suri //Alice \
  --url ws://localhost:9944 \
  --skip-dry-run --skip-confirm -x \
  --gas 100000000000 --proof-size 500000

# Anotar endereço do BurnEngine
```

### Passo 3: Implantação do Tax Manager

```bash
# Navegar para o diretório
cd tax_manager

# Construir contrato
cargo contract build --release

# Implantar usando cargo-contract
cargo contract instantiate \
  --constructor new \
  --args "LUNES_TOKEN_ADDRESS" "LUSDT_TOKEN_ADDRESS" "DISTRIBUTION_WALLETS" 500000 \
  --suri //Alice \
  --url ws://localhost:9944

# Ou usando Polkadot.js Apps
# 1. Upload tax_manager.contract
# 2. Instantiate with constructor parameters
# 3. Note the contract address
```

### Passo 4: Implantação do LUSDT Token

```bash
# Navegar para o diretório
cd ../lusdt_token

# Construir contrato
cargo contract build --release

# Implantar usando cargo-contract
cargo contract instantiate \
  --constructor new \
  --args "TAX_MANAGER_ADDRESS" "BRIDGE_ACCOUNT" "EMERGENCY_ADMIN" \
  --suri //Alice \
  --url ws://localhost:9944

# Ou usando Polkadot.js Apps
# 1. Upload lusdt_token.contract
# 2. Instantiate with constructor parameters
# 3. Note the contract address
```

### Passo 5: Configuração Pós-Implantação

```bash
# Atualizar Tax Manager com endereço do LUSDT Token
cargo contract call \
  --contract TAX_MANAGER_ADDRESS \
  --message update_lusdt_token_address \
  --args "LUSDT_TOKEN_ADDRESS" \
  --suri //Alice \
  --url ws://localhost:9944

# Configurar BurnEngine no Tax Manager (OBRIGATÓRIO para dual-fee)
cargo contract call \
  --contract TAX_MANAGER_ADDRESS \
  --message set_burn_engine \
  --args "BURN_ENGINE_ADDRESS" \
  --suri //Alice \
  --url ws://localhost:9944

# Configurar preço inicial do LUNES (se necessário)
cargo contract call \
  --contract TAX_MANAGER_ADDRESS \
  --message update_lunes_price \
  --args 500000 \
  --suri //Alice \
  --url ws://localhost:9944

# Configurar LUNES burn fee (padrão: 10 = 0.10%)
cargo contract call \
  --contract TAX_MANAGER_ADDRESS \
  --message set_lunes_burn_fee_bps \
  --args 10 \
  --suri //Alice \
  --url ws://localhost:9944
```

### Passo 6: Verificação

```bash
# Executar script de verificação
./scripts/verify_deployment.sh local TAX_MANAGER_ADDRESS LUSDT_TOKEN_ADDRESS
```

## 🔒 Configurações de Segurança

### Controles de Acesso

#### LUSDT Token
- **Owner**: Multisig para operações administrativas
- **Bridge Account**: Serviço de ponte com HSM
- **Emergency Admin**: Multisig separado para pausas de emergência

#### Tax Manager
- **Owner**: Mesmo multisig do LUSDT Token
- **Distribution Wallets**: Multisigs separados para cada função

### Configurações de Taxa

```json
{
  "fee_config": {
    "base_fee_bps": 50,
    "volume_threshold_1_usd": 10000000000,
    "volume_threshold_2_usd": 100000000000,
    "low_volume_fee_bps": 60,
    "medium_volume_fee_bps": 50,
    "high_volume_fee_bps": 30
  }
}
```

### Rate Limiting
- **Mint Rate Limit**: 1M LUSDT por hora
- **Window**: 1 hora (3600000 ms)

## 🧪 Testes de Validação

### Testes Funcionais

```bash
# Executar todos os testes (27 testes: 9 burn + 3 lusdt + 15 tax)
cargo test -p tax_manager -p lusdt_token -p burn_engine

# Testes específicos
cargo test --package lusdt_token
cargo test --package tax_manager
cargo test --package burn_engine
```

### Testes de Integração

1. **Teste de Mint**
   - Verificar que apenas bridge account pode fazer mint
   - Validar cálculo e distribuição de taxas
   - Confirmar eventos emitidos

2. **Teste de Burn**
   - Verificar validação de endereço Solana
   - Validar queima de tokens
   - Confirmar processamento de taxas

3. **Teste de Transferência**
   - Validar transferências normais
   - Testar approve/transferFrom
   - Verificar saldos e allowances

4. **Teste de Pausa de Emergência**
   - Verificar que emergency admin pode pausar
   - Confirmar que operações falham quando pausado
   - Validar que apenas owner pode despausar

## 📊 Monitoramento e Alertas

### Métricas Importantes
- Volume total de tokens
- Número de transações
- Taxas coletadas
- Status de pausa
- Rate limiting hits

### Alertas Críticos
- Contrato pausado
- Rate limit excedido
- Falhas de distribuição de taxas
- Tentativas de acesso não autorizado

## 🚨 Procedimentos de Emergência

### Pausa de Emergência
```bash
# Pausar contrato (Emergency Admin)
cargo contract call \
  --contract LUSDT_TOKEN_ADDRESS \
  --message emergency_pause \
  --suri //EmergencyAdmin \
  --url ws://localhost:9944
```

### Despausar Contrato
```bash
# Despausar contrato (Owner apenas)
cargo contract call \
  --contract LUSDT_TOKEN_ADDRESS \
  --message emergency_unpause \
  --suri //Owner \
  --url ws://localhost:9944
```

### Atualização de Código
```bash
# Atualizar código do contrato (Owner apenas)
cargo contract call \
  --contract CONTRACT_ADDRESS \
  --message set_code \
  --args "NEW_CODE_HASH" \
  --suri //Owner \
  --url ws://localhost:9944
```

## 📝 Checklist de Implantação

### Pré-Implantação
- [ ] Código revisado e auditado
- [ ] Todos os testes passando
- [ ] Parâmetros de construtor validados
- [ ] Carteiras multisig configuradas
- [ ] Ambiente de destino preparado

### Durante a Implantação
- [ ] BurnEngine implantado com sucesso
- [ ] Tax Manager implantado com sucesso
- [ ] LUSDT Token implantado com sucesso
- [ ] `set_burn_engine()` configurado no Tax Manager
- [ ] Integração entre contratos configurada
- [ ] Distribuição 80/15/5 com staking_rewards_pool
- [ ] Configurações de segurança aplicadas
- [ ] Testes de validação executados

### Pós-Implantação
- [ ] Verificação de implantação concluída
- [ ] Monitoramento configurado
- [ ] Alertas configurados
- [ ] Documentação atualizada
- [ ] Equipe notificada
- [ ] Backup de configurações realizado

## 🔧 Solução de Problemas

### Problemas Comuns

#### Falha na Construção
```bash
# Limpar cache e reconstruir
cargo clean
cargo contract build --release
```

#### Falha na Implantação
- Verificar saldo da conta
- Validar parâmetros do construtor
- Confirmar conectividade com o nó

#### Falha na Verificação
- Verificar endereços dos contratos
- Confirmar configurações de rede
- Validar permissões de acesso

### Logs e Debugging
```bash
# Verificar logs do nó
tail -f ~/.local/share/substrate-contracts-node/chains/dev/network/substrate-contracts-node.log

# Verificar eventos do contrato
# Use Polkadot.js Apps -> Network -> Explorer
```

## 📞 Contatos de Suporte

- **Equipe de Desenvolvimento**: dev-team@lunes.io
- **Segurança**: security@lunes.io
- **Operações**: ops@lunes.io
- **Emergência**: emergency@lunes.io

---

**Última Atualização**: Fevereiro 2026  
**Versão do Documento**: 2.0 (v3 dual-fee + staking rewards)  
**Responsável**: Equipe de Desenvolvimento LUSDT
