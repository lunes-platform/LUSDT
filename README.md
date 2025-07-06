# 🌉 LUSDT - Cross-Chain Bridge Token

Sistema completo de bridge cross-chain entre LUSDT (Lunes Network) e USDT (Solana), implementando os mais altos padrões de segurança e conformidade com OWASP Top 10 para Smart Contracts.

## 🚀 Visão Geral

O LUSDT é um token lastreado 1:1 em USDT que permite transferências seguras e eficientes entre as redes Lunes e Solana. O sistema inclui:

- **Smart Contract LUSDT** (ink! 5.1.1) na Lunes Network
- **Bridge Service** (Node.js/TypeScript) para operações cross-chain
- **Sistema de Monitoramento** em tempo real
- **Procedimentos de Segurança** de nível enterprise

## 🏗️ Arquitetura

```text
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Solana USDT   │───▶│  Bridge Service │───▶│   LUSDT Token   │
│   Treasury      │    │   (Off-chain)   │    │   (Lunes Chain) │
│   (Multisig)    │    │   (HSM Keys)    │    │   (ink! PSP22)  │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

### Componentes Principais

1. **LUSDT Smart Contract** - Token PSP22 com funcionalidades de bridge
2. **Bridge Service** - Serviço off-chain para sincronização entre redes
3. **Treasury Multisig** - Cofre seguro de USDT na Solana (3-of-5)
4. **Monitoring System** - Monitoramento de paridade e alertas

## 🌐 Configurações de Rede

### Lunes Network

#### Testnet
- **WebSocket:** `wss://ws-test.lunes.io`
- **Uso:** Desenvolvimento e testes

#### Mainnet
- **WebSocket Principal:** `wss://ws.lunes.io`
- **WebSocket Backup 1:** `wss://ws-lunes-main-01.lunes.io`
- **WebSocket Backup 2:** `wss://ws-lunes-main-02.lunes.io`
- **WebSocket Archive:** `wss://ws-archive.lunes.io`

### Solana Network

#### Mainnet
- **RPC Endpoint:** `https://api.mainnet-beta.solana.com`
- **USDT Token:** `EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v`

#### Devnet (Testes)
- **RPC Endpoint:** `https://api.devnet.solana.com`
- **USDT Devnet:** `Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr`

## 🔐 Recursos de Segurança

### Smart Contract (Camada 1)
- ✅ **Role-Based Access Control (RBAC)**
- ✅ **Circuit Breaker** (pausa de emergência)
- ✅ **Safe Math Operations** (proteção overflow/underflow)
- ✅ **Reentrancy Protection**
- ✅ **Rate Limiting** (1M LUSDT/hora)

### Bridge Service (Camada 2)
- ✅ **HSM/KMS** para proteção de chaves
- ✅ **Parity Monitor** (detecção < 30s)
- ✅ **Validação Idempotente**
- ✅ **Alertas Multi-Canal**

### Operações (Camada 3)
- ✅ **Multisig 3-of-5** na Solana
- ✅ **Incident Response Playbook**
- ✅ **Procedimentos de Emergência**

## 📋 Pré-requisitos

### Para Desenvolvimento
- **Rust** 1.70+ com target `wasm32-unknown-unknown`
- **cargo-contract** 4.0+
- **Node.js** 18+
- **Docker** & **Docker Compose**

### Para Deploy
- **Carteira Lunes** com fundos para deploy
- **Carteira Solana** com USDT para treasury
- **Acesso HSM/KMS** para chaves de produção

## 🛠️ Instalação e Setup

### 1. Clone o Repositório
```bash
git clone https://github.com/lunes-platform/lusdt-bridge.git
cd lusdt-bridge
```

### 2. Smart Contract (LUSDT)
```bash
cd contracts/lusdt_token

# Instalar dependências
cargo check

# Executar testes
cargo test

# Build para produção
cargo contract build --release
```

### 3. Bridge Service
```bash
cd bridge-service

# Instalar dependências
npm install

# Configurar ambiente
cp .env.example .env
# Editar .env com suas configurações

# Executar em desenvolvimento
npm run dev

# Deploy com Docker
docker-compose up -d
```

## ⚙️ Configuração

### Variáveis de Ambiente Principais

```bash
# Lunes Network
LUNES_RPC_URL=wss://ws.lunes.io
LUNES_WALLET_SEED=your_mnemonic_phrase
LUSDT_CONTRACT_ADDRESS=5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY

# Solana Network
SOLANA_RPC_URL=https://api.mainnet-beta.solana.com
SOLANA_WALLET_PRIVATE_KEY=your_base58_private_key
USDT_TOKEN_MINT=EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v

# Segurança
HSM_TYPE=aws-kms  # ou 'vault' ou 'development'
AWS_KMS_KEY_ID=your_kms_key_id
TREASURY_MIN_BALANCE=50000

# Monitoramento
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/...
ALERT_EMAIL=admin@lunes.io
```

## 🔄 Fluxos de Operação

### Depósito (USDT → LUSDT)
1. Usuário deposita USDT no treasury Solana
2. Bridge Service detecta transação (< 30s)
3. Validação do endereço Lunes no memo
4. Mint LUSDT na conta de destino
5. Confirmação e eventos emitidos

### Saque (LUSDT → USDT)
1. Usuário chama `burn()` no contrato LUSDT
2. Evento `RedemptionRequested` é emitido
3. Bridge Service processa automaticamente
4. Transferência USDT via multisig Solana
5. Confirmação na blockchain

## 📊 Monitoramento

### Endpoints de API
```bash
# Health check
curl http://localhost:3000/health

# Métricas em tempo real
curl http://localhost:3000/metrics

# Status de transação
curl http://localhost:3000/transactions/{signature}

# Estatísticas do sistema
curl http://localhost:3000/stats
```

### Dashboards
- **Grafana:** http://localhost:3001 (admin/admin123)
- **Prometheus:** http://localhost:9090
- **Bridge Service:** http://localhost:3000

## 🧪 Testes

### Smart Contract
```bash
cd contracts/lusdt_token

# Testes unitários (19 testes)
cargo test

# Testes de segurança específicos
cargo test security

# Build de produção
cargo contract build --release
```

### Bridge Service
```bash
cd bridge-service

# Testes unitários
npm test

# Testes de integração
npm run test:integration

# Testes E2E
npm run test:e2e

# Cobertura de testes
npm run test:coverage
```

## 🚀 Deploy

### Testnet (Desenvolvimento)
```bash
# Deploy do contrato LUSDT
cargo contract instantiate \
  --constructor new \
  --args $BRIDGE_ACCOUNT $TAX_MANAGER $EMERGENCY_ADMIN \
  --suri //Alice \
  --url wss://ws-test.lunes.io

# Iniciar bridge service
docker-compose -f docker-compose.dev.yml up -d
```

### Mainnet (Produção)
```bash
# Verificar configurações
./scripts/pre-deploy-check.sh

# Deploy com multisig
cargo contract instantiate \
  --constructor new \
  --args $BRIDGE_ACCOUNT $TAX_MANAGER $EMERGENCY_ADMIN \
  --suri $DEPLOYER_SEED \
  --url wss://ws.lunes.io

# Deploy bridge service
docker-compose -f docker-compose.prod.yml up -d
```

## 🔧 Troubleshooting

### Problemas Comuns

#### Conexão com Lunes Network
```bash
# Testar conectividade
curl -H "Content-Type: application/json" \
     -d '{"id":1, "jsonrpc":"2.0", "method":"system_health"}' \
     wss://ws.lunes.io

# Verificar status da rede
curl https://status.lunes.io
```

#### Bridge Service não sincroniza
```bash
# Verificar logs
docker-compose logs bridge-service

# Verificar paridade
curl http://localhost:3000/metrics | grep parity

# Reiniciar serviços
docker-compose restart
```

#### Transações travadas
```bash
# Verificar status
curl http://localhost:3000/transactions/{signature}

# Verificar health do sistema
curl http://localhost:3000/health

# Verificar saldo do treasury
curl http://localhost:3000/treasury/balance
```

## 📈 Métricas de Performance

### Benchmarks Esperados
- **Latência de Bridge:** < 2 segundos
- **Throughput:** 1000+ transações/hora
- **Uptime:** 99.9% SLA
- **Precisão de Paridade:** 100%

### Limites de Segurança
- **Máximo por transação:** 100k USDT
- **Volume diário:** 1M USDT
- **Rate limit:** 1M LUSDT/hora
- **Treasury mínimo:** 50k USDT

## 🛡️ Auditoria e Conformidade

### Conformidade OWASP Top 10
- ✅ **100% conformidade** com OWASP Top 10 para Smart Contracts
- ✅ **19/19 testes de segurança** passando
- ✅ **Auditoria de código** completa
- ✅ **Penetration testing** recomendado

### Certificações
- **ISO 27001** compliance ready
- **SOC 2 Type II** framework
- **LGPD** data protection

## 🤝 Contribuição

1. Fork o projeto
2. Crie sua feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit suas mudanças (`git commit -m 'Add some AmazingFeature'`)
4. Push para a branch (`git push origin feature/AmazingFeature`)
5. Abra um Pull Request

### Padrões de Desenvolvimento
- **TDD:** Testes antes do código
- **Security First:** Segurança em primeiro lugar
- **Clean Code:** Código limpo e documentado
- **CI/CD:** Integração e deploy contínuos

## 📄 Licença

Este projeto está licenciado sob a MIT License - veja o arquivo [LICENSE](LICENSE) para detalhes.

## 📞 Suporte

### Canais de Comunicação
- **Discord:** [Lunes Community](https://discord.gg/lunes)
- **Telegram:** [@LunesOfficial](https://t.me/LunesOfficial)
- **Email:** dev@lunes.io
- **Website:** [lunes.io](https://lunes.io)

### Emergências de Segurança
- **Email:** security@lunes.io
- **Discord:** #security-alerts
- **WhatsApp:** +55 11 99999-0001

### Documentação Adicional
- **Technical Specs:** [Docs/LUSDT_technical_specification.md](Docs/LUSDT_technical_specification.md)
- **Security Analysis:** [Docs/security_analysis.md](Docs/security_analysis.md)
- **Incident Response:** [Docs/security_incident_response_playbook.md](Docs/security_incident_response_playbook.md)
- **Bridge Service:** [bridge-service/README.md](bridge-service/README.md)

---

## 🎯 Roadmap

### Q1 2025
- ✅ **Smart Contract Security Hardened**
- ✅ **Bridge Service Implementation**
- ✅ **Monitoring System**
- 🔄 **External Security Audit**

### Q2 2025
- 📋 **Mainnet Launch**
- 📋 **Bug Bounty Program**
- 📋 **Mobile SDK**
- 📋 **Advanced Analytics**

### Q3 2025
- 📋 **Multi-Chain Expansion**
- 📋 **DeFi Integrations**
- 📋 **Governance Token**
- 📋 **DAO Implementation**

---

**Desenvolvido com ❤️ pela equipe Lunes Platform**

**LUSDT Bridge - Conectando Lunes e Solana com Segurança de Nível Enterprise** 