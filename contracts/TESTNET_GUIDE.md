# Guia de Testes em Testnet - LUSDT

Este guia fornece instruções passo a passo para executar testes dos contratos LUSDT em ambiente de testnet.

## 📋 Pré-requisitos

### Ferramentas Necessárias

```bash
# Instalar cargo-contract (se não estiver instalado)
cargo install cargo-contract --force

# Instalar jq para processamento JSON
# macOS
brew install jq

# Ubuntu/Debian
sudo apt-get install jq
```

### Contas de Teste

Certifique-se de ter as seguintes contas configuradas:

- **//Alice** - Deployer e Owner dos contratos
- **//Bob** - Bridge Account (para mint operations)
- **//Charlie** - Emergency Admin
- **//Dave** - Usuário de teste 1
- **//Eve** - Usuário de teste 2

### Saldo de Testnet

Todas as contas precisam ter saldo suficiente na testnet Rococo. Você pode obter tokens de teste através do [Polkadot Faucet](https://faucet.polkadot.io/).

## 🚀 Processo de Implantação e Testes

### Passo 1: Preparação do Ambiente

```bash
# Navegar para o diretório dos contratos
cd /Users/cliente/Documents/Projetos_DEV/LUSDT/contracts

# Verificar se todos os scripts têm permissão de execução
chmod +x scripts/*.sh

# Verificar se os contratos compilam
cargo test --workspace
```

### Passo 2: Implantação em Testnet

```bash
# Executar o script de implantação em testnet
./scripts/testnet_deploy.sh
```

**O que este script faz:**
- ✅ Compila os contratos para testnet
- ✅ Executa testes pré-implantação
- ✅ Faz upload dos contratos para Rococo testnet
- ✅ Instancia Tax Manager com parâmetros de testnet
- ✅ Instancia LUSDT Token conectado ao Tax Manager
- ✅ Configura integração entre contratos
- ✅ Executa testes básicos de verificação
- ✅ Gera relatório de implantação

**Saída esperada:**
```
🚀 LUSDT Testnet Deployment and Testing
Network: testnet
RPC Endpoint: wss://rococo-contracts-rpc.polkadot.io

✅ Prerequisites check passed
✅ Configuration loaded from testnet_config.json
✅ Tax Manager contract built successfully
✅ LUSDT Token contract built successfully
✅ All tests passed
✅ Tax Manager uploaded. Code Hash: 0x...
✅ Tax Manager instantiated at: 5C...
✅ LUSDT Token uploaded. Code Hash: 0x...
✅ LUSDT Token instantiated at: 5D...
✅ Deployment addresses saved to deployment_addresses.json

🎉 Testnet deployment and testing completed!
Tax Manager Address: 5C...
LUSDT Token Address: 5D...
```

### Passo 3: Testes Funcionais Abrangentes

```bash
# Executar testes funcionais completos
./scripts/testnet_functional_tests.sh deployments/testnet_YYYYMMDD_HHMMSS
```

**Suítes de Teste Incluídas:**

1. **Contract State Tests** - Consultas de estado dos contratos
2. **Access Control Tests** - Testes de controle de acesso
3. **Mint and Balance Tests** - Funcionalidade de mint e saldos
4. **Burn and Redemption Tests** - Queima de tokens e redenção
5. **Transfer Tests** - Transferências de tokens
6. **Approval Tests** - Sistema de aprovações
7. **Emergency Pause Tests** - Funcionalidade de pausa de emergência
8. **Tax Manager Tests** - Testes do gerenciador de taxas

**Saída esperada:**
```
🧪 LUSDT Testnet Functional Testing
Network: testnet
Deployment Dir: deployments/testnet_20241226_153000

📋 Running Functional Tests...

=== Contract State Tests ===
🔄 Test 1: Query LUSDT token name
✅ PASSED: Query LUSDT token name

=== Access Control Tests ===
🔄 Test 8: Non-bridge account cannot mint
✅ PASSED: Non-bridge account cannot mint (expected failure)

📊 Test Results Summary
✅ Tests Passed: 25
📋 Total Tests: 25
📈 Success Rate: 100%

🎉 All functional tests passed! Contracts are ready for integration testing.
```

### Passo 4: Verificação Manual via Polkadot.js Apps

Após a implantação, você pode interagir manualmente com os contratos:

1. **Acesse Polkadot.js Apps**: https://polkadot.js.org/apps/
2. **Conecte à Rococo**: Settings → General → Remote node → Rococo (hosted by Parity)
3. **Navegue para Contracts**: Developer → Contracts
4. **Adicione os contratos** usando os endereços do relatório de implantação

**Testes Manuais Recomendados:**

```javascript
// 1. Verificar estado inicial
token_name() // Deve retornar "Lunes USD Tether"
token_symbol() // Deve retornar "LUSDT"
total_supply() // Deve retornar 0 inicialmente

// 2. Testar mint (como bridge account - //Bob)
mint(user_address, 1000000000) // Mint 1000 LUSDT

// 3. Verificar saldo
balance_of(user_address) // Deve mostrar saldo < 1000 (devido às taxas)

// 4. Testar burn
burn(500000000, "SolanaAddress123456789012345678901") // Burn 500 LUSDT

// 5. Testar pausa de emergência (como emergency admin - //Charlie)
emergency_pause()
is_paused() // Deve retornar true

// 6. Testar unpause (como owner - //Alice)
emergency_unpause()
is_paused() // Deve retornar false
```

### Passo 5: Testes de Integração com Bridge Service

Para testar a integração completa:

```bash
# Executar testes E2E (se o bridge service estiver disponível)
cd integration-tests
cargo test --features e2e-tests
```

## 📊 Interpretação dos Resultados

### Métricas de Sucesso

- **Taxa de Sucesso**: >95% dos testes funcionais
- **Tempo de Resposta**: <5 segundos por transação
- **Consumo de Gás**: Dentro dos limites esperados
- **Eventos**: Todos os eventos esperados emitidos

### Indicadores de Problemas

- ❌ Falhas de acesso não autorizado
- ❌ Cálculos de taxa incorretos
- ❌ Falhas na pausa de emergência
- ❌ Problemas de integração entre contratos

## 🔧 Solução de Problemas

### Problemas Comuns

#### 1. Falha na Conexão com Testnet
```bash
# Verificar conectividade
curl -H "Content-Type: application/json" -d '{"id":1, "jsonrpc":"2.0", "method": "system_health", "params":[]}' wss://rococo-contracts-rpc.polkadot.io
```

#### 2. Saldo Insuficiente
```bash
# Verificar saldo das contas
cargo contract call --suri //Alice --url wss://rococo-contracts-rpc.polkadot.io --message system_account_next_index --dry-run
```

#### 3. Falhas de Implantação
```bash
# Limpar cache e tentar novamente
cargo clean
cargo contract build --release
```

#### 4. Testes Falhando
```bash
# Executar testes individuais para debug
cargo contract call --suri //Alice --url wss://rococo-contracts-rpc.polkadot.io --contract CONTRACT_ADDRESS --message METHOD_NAME --dry-run --verbose
```

## 📈 Próximos Passos

### Após Testes Bem-Sucedidos

1. **Documentar Endereços dos Contratos**
   - Atualizar configuração do frontend
   - Compartilhar com equipe de desenvolvimento

2. **Testes de Performance**
   - Executar múltiplas transações simultâneas
   - Validar rate limiting
   - Testar sob carga

3. **Testes de Segurança**
   - Tentar ataques conhecidos
   - Validar todas as proteções
   - Testar cenários de edge case

4. **Preparação para Mainnet**
   - Revisar parâmetros de produção
   - Configurar multisigs
   - Planejar estratégia de implantação

### Integração com Frontend

Após testes bem-sucedidos, atualize a configuração do frontend:

```typescript
// frontend/src/config/contracts.ts
export const TESTNET_CONFIG = {
  taxManager: "5C...", // Endereço do Tax Manager
  lusdtToken: "5D...", // Endereço do LUSDT Token
  network: "rococo",
  rpcEndpoint: "wss://rococo-contracts-rpc.polkadot.io"
};
```

## 📞 Suporte

Em caso de problemas:

1. **Verificar logs** nos arquivos de relatório gerados
2. **Consultar documentação** em `DEPLOYMENT_RUNBOOK.md`
3. **Revisar código** dos contratos para entender comportamento esperado
4. **Executar testes unitários** localmente para validar lógica

---

**Última Atualização**: $(date)  
**Versão**: 1.0  
**Responsável**: Equipe de Desenvolvimento LUSDT
