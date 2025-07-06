# 🌉 LUSDT Bridge Service

Sistema de bridge cross-chain entre LUSDT (Lunes) e USDT (Solana) com arquitetura robusta e segura.

## 🚀 Características

- **Cross-Chain Bridge**: Conversão bidirecional LUSDT ↔ USDT
- **Segurança Avançada**: Multisig treasury, rate limiting, monitoramento
- **Monitoramento Real-Time**: Dashboards, alertas, métricas
- **Arquitetura Escalável**: Microserviços, Docker, load balancing
- **Auditoria Completa**: Logs detalhados, rastreamento de transações

## 🏗️ Arquitetura

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

## 📋 Pré-requisitos

- **Node.js** 18+
- **Docker** & **Docker Compose**
- **PostgreSQL** 15+
- **Redis** 7+
- **Carteira Solana** com USDT
- **Carteira Lunes** com acesso ao contrato LUSDT

## 🛠️ Instalação

### 1. Clone o repositório
```bash
git clone https://github.com/lunes-platform/lusdt-bridge.git
cd lusdt-bridge/bridge-service
```

### 2. Instale dependências
```bash
npm install
```

### 3. Configure variáveis de ambiente
```bash
cp .env.example .env
# Edite .env com suas configurações
```

### 4. Inicie os serviços
```bash
# Desenvolvimento
docker-compose up -d postgres redis
npm run dev

# Produção
docker-compose up -d
```

## ⚙️ Configuração

### Variáveis de Ambiente

```bash
# Servidor
PORT=3000
NODE_ENV=development
LOG_LEVEL=info

# Solana
SOLANA_RPC_URL=https://api.mainnet-beta.solana.com
SOLANA_WALLET_PRIVATE_KEY=your_base58_private_key
USDT_TOKEN_MINT=EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v

# Lunes
LUNES_RPC_URL=wss://rpc.lunes.io
LUNES_WALLET_SEED=your_mnemonic_phrase
LUSDT_CONTRACT_ADDRESS=5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY

# Banco de Dados
DATABASE_URL=postgresql://user:pass@localhost:5432/bridge_db
REDIS_URL=redis://localhost:6379

# Segurança
RATE_LIMIT_PER_HOUR=100
MAX_TRANSACTION_VALUE=100000
TREASURY_MIN_BALANCE=50000

# Monitoramento
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/...
ALERT_EMAIL=admin@lunes.io
```

## 🔄 Fluxos de Operação

### Depósito (USDT → LUSDT)

1. **Usuário deposita USDT** no treasury Solana
2. **Bridge Service detecta** a transação
3. **Validação** do endereço Lunes no memo
4. **Mint LUSDT** na conta de destino
5. **Confirmação** e notificação

### Saque (LUSDT → USDT)

1. **Usuário chama burn()** no contrato LUSDT
2. **Evento RedemptionRequested** é emitido
3. **Bridge Service processa** o evento
4. **Transferência USDT** para endereço Solana
5. **Confirmação** e atualização de status

## 📊 Monitoramento

### Endpoints de API

```bash
# Health check
GET /health

# Métricas
GET /metrics

# Status da transação
GET /transactions/{signature}

# Estatísticas
GET /stats
```

### Dashboards

- **Grafana**: http://localhost:3001 (admin/admin123)
- **Prometheus**: http://localhost:9090
- **Bridge Service**: http://localhost:3000

### Alertas

- **Discord**: Notificações em tempo real
- **Email**: Alertas críticos
- **Logs**: Auditoria completa

## 🔐 Segurança

### Controles Implementados

- ✅ **Rate Limiting**: 100 req/hora por IP
- ✅ **Validação de Entrada**: Todos os inputs validados
- ✅ **Treasury Multisig**: 3-of-5 assinaturas
- ✅ **Monitoramento Paridade**: Alerta se desbalanceado
- ✅ **Logs Auditáveis**: Todas as operações registradas
- ✅ **Timeouts**: Prevenção de transações travadas

### Limites de Segurança

```typescript
const securityLimits = {
  maxTransactionValue: 100000,  // 100k USDT
  maxDailyVolume: 1000000,      // 1M USDT
  treasuryMinBalance: 50000,    // 50k USDT
  parityDeviation: 0.01,        // 1%
  processingTimeout: 30000      // 30 segundos
};
```

## 🧪 Testes

```bash
# Testes unitários
npm test

# Testes com cobertura
npm run test:coverage

# Testes de integração
npm run test:integration

# Testes E2E
npm run test:e2e
```

## 📈 Performance

### Métricas Esperadas

- **Latência**: < 2 segundos
- **Throughput**: 1000 tx/hora
- **Uptime**: 99.9%
- **Precisão**: 100% (paridade treasury)

### Otimizações

- **Connection Pooling**: PostgreSQL
- **Caching**: Redis para dados frequentes
- **Batch Processing**: Múltiplas transações
- **Load Balancing**: Nginx reverse proxy

## 🚀 Deploy

### Staging

```bash
# Build da imagem
docker build -t lusdt-bridge:staging .

# Deploy
docker-compose -f docker-compose.staging.yml up -d
```

### Produção

```bash
# Build da imagem
docker build -t lusdt-bridge:latest .

# Deploy com secrets
docker-compose -f docker-compose.prod.yml up -d
```

## 📝 Logs

### Estrutura de Logs

```json
{
  "timestamp": "2025-01-15T10:30:00.000Z",
  "level": "info",
  "message": "Processing Solana deposit",
  "data": {
    "signature": "5j7s8...",
    "amount": 1000,
    "lunesAddress": "5GrwvaEF...",
    "processingTime": 1.2
  }
}
```

### Categorias de Logs

- **INFO**: Operações normais
- **WARN**: Situações de atenção
- **ERROR**: Falhas e erros
- **DEBUG**: Informações detalhadas

## 🔧 Troubleshooting

### Problemas Comuns

#### Bridge Service não inicia
```bash
# Verificar logs
docker-compose logs bridge-service

# Verificar configurações
cat .env | grep -E "(SOLANA|LUNES|DATABASE)"
```

#### Transações travadas
```bash
# Verificar status
curl http://localhost:3000/transactions/{signature}

# Verificar health
curl http://localhost:3000/health
```

#### Desbalanceamento treasury
```bash
# Verificar paridade
curl http://localhost:3000/metrics | grep parity

# Alertas
tail -f logs/bridge-service.log | grep PARITY
```

## 🤝 Contribuição

1. Fork o projeto
2. Crie sua feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit suas mudanças (`git commit -m 'Add some AmazingFeature'`)
4. Push para a branch (`git push origin feature/AmazingFeature`)
5. Abra um Pull Request

## 📄 Licença

Este projeto está licenciado sob a MIT License - veja o arquivo [LICENSE](LICENSE) para detalhes.

## 📞 Suporte

- **Discord**: [Lunes Community](https://discord.gg/lunes)
- **Email**: dev@lunes.io
- **Docs**: [docs.lunes.io](https://docs.lunes.io)
- **Issues**: [GitHub Issues](https://github.com/lunes-platform/lusdt-bridge/issues)

---

**Desenvolvido com ❤️ pela equipe Lunes Platform** 