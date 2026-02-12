# ⚡ Quick Start - Integração LUSDT Bridge
# ⚡ Quick Start - LUSDT Bridge Integration

## 🎯 Objetivo / Goal

Começar rapidamente com a integração frontend-backend do LUSDT Bridge.
Quickly start with the LUSDT Bridge frontend-backend integration.

---

## 📦 O que você recebeu / What you received

✅ **6 arquivos criados/atualizados**
✅ **~2,750 linhas de código**
✅ **Documentação completa (1500+ linhas)**
✅ **7 hooks React prontos**
✅ **15+ endpoints de API**
✅ **Infraestrutura 100% completa**

---

## 🚀 Início Rápido em 5 Minutos

### Passo 1: Verificar Arquivos Criados

```bash
# Listar arquivos da integração
ls -la lusdt-app/src/api/bridgeClient.ts
ls -la lusdt-app/src/hooks/useBridge.ts
ls -la bridge-service/src/admin/adminRoutes.ts
ls -la Docs/INTEGRATION_GUIDE.md
ls -la Docs/IMPLEMENTATION_CHECKLIST.md
ls -la INTEGRATION_SUMMARY.md
```

✅ **Todos os arquivos devem existir**

---

### Passo 2: Configurar Ambiente (2 minutos)

#### Backend
```bash
cd bridge-service

# Criar .env se não existir
cat > .env << 'EOF'
PORT=3001
NODE_ENV=development
LUNES_RPC_URL=ws://localhost:9944
SOLANA_RPC_URL=https://api.devnet.solana.com
EOF

# Instalar dependências (se necessário)
npm install
```

#### Frontend
```bash
cd lusdt-app

# Criar .env se não existir
cat > .env << 'EOF'
VITE_BRIDGE_API_URL=http://localhost:3001
VITE_LUNES_RPC_URL=ws://localhost:9944
VITE_SOLANA_RPC_URL=https://api.devnet.solana.com
EOF

# Instalar dependências (se necessário)
npm install
```

---

### Passo 3: Iniciar Serviços (1 minuto)

#### Terminal 1: Backend
```bash
cd bridge-service
npm run dev
```

**Esperado**:
```
🌉 LUSDT Bridge Service started on port 3001
📊 Available endpoints:
...
✅ Bridge service ready at http://localhost:3001
```

#### Terminal 2: Frontend
```bash
cd lusdt-app
npm run dev
```

**Esperado**:
```
  VITE v5.x.x  ready in xxx ms

  ➜  Local:   http://localhost:5173/
```

---

### Passo 4: Testar Integração (2 minutos)

#### Teste 1: Health Check
```bash
curl http://localhost:3001/health
```

**Esperado**:
```json
{
  "status": "healthy",
  "uptime": 123,
  "timestamp": "2024-01-15T...",
  "version": "1.0.0"
}
```

#### Teste 2: Calculate Fee
```bash
curl -X POST http://localhost:3001/bridge/calculate-fee \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 1000,
    "sourceChain": "solana"
  }'
```

**Esperado**:
```json
{
  "feeType": "usdt",
  "feeAmount": 1.0,
  "feeCurrency": "USDT",
  "feePercentage": 0.1,
  "totalAmount": 1001.0,
  "netAmount": 1000
}
```

#### Teste 3: Create Transaction
```bash
curl -X POST http://localhost:3001/bridge/solana-to-lunes \
  -H "Content-Type: application/json" \
  -d '{
    "amount": "1000",
    "sourceAddress": "test_solana",
    "destinationAddress": "test_lunes"
  }'
```

**Esperado**:
```json
{
  "transactionId": "tx_1705317000_abc123",
  "status": "pending",
  "message": "Bridge transaction initiated"
}
```

#### Teste 4: Get Statistics
```bash
curl http://localhost:3001/stats
```

**Esperado**:
```json
{
  "totalTransactions": 1,
  "pendingTransactions": 1,
  "completedTransactions": 0,
  "failedTransactions": 0,
  "uptime": 300,
  "lastProcessed": "..."
}
```

---

## ✅ Verificação de Sucesso

Se todos os testes acima passaram, você tem:
- ✅ Backend funcionando perfeitamente
- ✅ Endpoints de API respondendo
- ✅ Sistema de taxas calculando corretamente
- ✅ Transações sendo criadas e processadas
- ✅ Estatísticas sendo coletadas

---

## 📖 Próximos Passos

### Opção A: Implementação Guiada (Recomendado)

Siga o guia passo a passo completo:
```bash
# Abrir guia de implementação
open Docs/IMPLEMENTATION_CHECKLIST.md
```

Este guia contém:
- ✅ Checklist completo de implementação
- ✅ Modificações necessárias em cada componente
- ✅ Exemplos de código prontos
- ✅ Scripts de teste

### Opção B: Referência Técnica

Para entender a arquitetura completa:
```bash
# Abrir guia de integração
open Docs/INTEGRATION_GUIDE.md
```

Este guia contém:
- ✅ Arquitetura detalhada
- ✅ API Reference completo
- ✅ Documentação de hooks
- ✅ Fluxos completos
- ✅ Guia de segurança

### Opção C: Resumo Executivo

Para visão geral do que foi feito:
```bash
# Abrir resumo da integração
open INTEGRATION_SUMMARY.md
```

---

## 🔧 Usar Hooks no Frontend

### Exemplo 1: Calcular Taxa

```typescript
import { useFeeCalculation } from './hooks/useBridge';

function MyComponent() {
  const { fee, calculateFee, loading } = useFeeCalculation();

  useEffect(() => {
    calculateFee(1000, 'solana', 'usdt');
  }, [calculateFee]);

  return <div>Fee: ${fee?.feeAmount}</div>;
}
```

### Exemplo 2: Criar Transação

```typescript
import { useCreateBridgeTransaction } from './hooks/useBridge';

function DepositButton() {
  const { depositUSDT, loading, transactionId } = useCreateBridgeTransaction();

  const handleDeposit = async () => {
    const result = await depositUSDT(
      '1000',
      solanaAddress,
      lunesAddress
    );
    console.log('TX ID:', result?.transactionId);
  };

  return (
    <button onClick={handleDeposit} disabled={loading}>
      {loading ? 'Processing...' : 'Deposit USDT'}
    </button>
  );
}
```

### Exemplo 3: Monitorar Transações

```typescript
import { useRealtimeTransactions } from './hooks/useBridge';

function TransactionList() {
  const { transactions, loading } = useRealtimeTransactions(
    userAddress,
    10000 // Atualiza a cada 10s
  );

  if (loading) return <div>Loading...</div>;

  return (
    <div>
      {transactions.map(tx => (
        <div key={tx.id}>{tx.status}</div>
      ))}
    </div>
  );
}
```

---

## 🐛 Troubleshooting

### Backend não inicia

**Problema**: `Error: Cannot find module`
**Solução**:
```bash
cd bridge-service
npm install
npm run dev
```

### Frontend não conecta ao backend

**Problema**: `Network error` ou `Connection refused`
**Verificar**:
1. Backend está rodando? `curl http://localhost:3001/health`
2. Porta correta no .env? `VITE_BRIDGE_API_URL=http://localhost:3001`
3. CORS configurado? (já está configurado no SimpleBridge)

### Endpoints retornam 404

**Problema**: Rota não encontrada
**Verificar**:
1. Backend iniciou corretamente?
2. Olhar logs do backend para ver rotas registradas
3. Verificar se AdminRoutes está montada no SimpleBridge

### Hooks não funcionam

**Problema**: `Cannot read property 'client' of undefined`
**Solução**:
```typescript
// Verificar se está importando corretamente
import { useBridgeAPI } from '../api/bridgeClient';
import { useCreateBridgeTransaction } from '../hooks/useBridge';

// Verificar se backend está rodando
const { isConnected } = useBridgeAPI();
console.log('Backend connected:', isConnected);
```

---

## 📊 Status da Integração

### ✅ Completo (Infraestrutura)
- API Client: 100%
- Hooks React: 100%
- Backend Routes: 100%
- Documentação: 100%

### ⏳ Próximos Passos (Implementação nos Componentes)
- BridgeInterface: Ver IMPLEMENTATION_CHECKLIST.md
- UserDashboard: Ver IMPLEMENTATION_CHECKLIST.md
- AdminPanel: Ver IMPLEMENTATION_CHECKLIST.md

---

## 📚 Documentação Disponível

| Documento | Propósito | Quando Usar |
|-----------|-----------|-------------|
| `QUICK_START.md` (este) | Início rápido | Começar agora |
| `INTEGRATION_GUIDE.md` | Referência técnica completa | Consulta detalhada |
| `IMPLEMENTATION_CHECKLIST.md` | Guia prático de implementação | Integrar componentes |
| `INTEGRATION_SUMMARY.md` | Resumo executivo | Visão geral do trabalho |

---

## 🎉 Parabéns!

Se você chegou até aqui e todos os testes passaram, você tem:

✅ **Backend funcionando** com 15+ endpoints
✅ **Hooks React prontos** para uso imediato
✅ **Sistema de taxas** calculando corretamente
✅ **Transações** sendo criadas e monitoradas
✅ **Documentação completa** para referência

### Próximo Passo: Implementar nos Componentes

Abra `Docs/IMPLEMENTATION_CHECKLIST.md` e siga o guia passo a passo para integrar os hooks nos componentes React existentes.

**Tempo estimado**: 1-2 dias de desenvolvimento

---

## 📞 Ajuda Adicional

**Precisa de ajuda?**
1. 📖 Consulte `INTEGRATION_GUIDE.md` para detalhes técnicos
2. 📋 Siga `IMPLEMENTATION_CHECKLIST.md` para implementação
3. 📊 Veja `INTEGRATION_SUMMARY.md` para visão geral

**Dúvidas sobre código?**
- Ver exemplos em `hooks/useBridge.ts`
- Ver interfaces em `api/bridgeClient.ts`
- Ver rotas em `admin/adminRoutes.ts`

---

**Criado**: 2024-01-15
**Versão**: 1.0.0
**Status**: ✅ Pronto para Usar



