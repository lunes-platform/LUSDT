# 📊 LUSDT Bridge - Investor Slide Data

## 1. Nível de Amadurecimento

**Status Atual:** **MVP Completo / Pré-Produção (Ready for Testnet)**

- Ciclo funcional completo (Smart Contracts, Backend, Frontend).
- Validado por testes automatizados (>95% cobertura).
- Scripts de deploy e runbooks prontos para Testnet.

---

## 2. Visão Geral do Produto

| Dimensão | Detalhes |
| :--- | :--- |
| **O que é** | Plataforma de ponte cross-chain bidirecional entre Solana (USDT) e Lunes (LUSDT), permitindo a conversão de ativos com paridade 1:1, gerenciada por contratos inteligentes e custódia segura. |
| **Amadurecimento** | **Fase 2 (Otimização e Segurança)**. Contratos em Rust (ink! 4.2.1) finalizados; Backend em Node.js com monitoramento de paridade; Documentação técnica completa e auditoria interna realizada. |
| **Market-Fit** | Soluciona a fragmentação de liquidez trazendo a estabilidade do USDT (Solana) para o ecossistema Lunes. Habilita DeFi e pagamentos estáveis na rede Lunes com taxas competitivas e finalidade rápida. |

---

## 3. Modelo de Negócio e Estratégia

### **Modelo de Receita**

Sistema de Taxas Híbrido (**Hybrid Fee System**) que maximiza a captura de valor em moeda forte (Dólar) e impulsiona a economia do token Lunes.

1. **Taxa de Volume (Revenue Fee):** % do volume transacionado, cobrada no ativo (**USDT** ou **LUSDT**). Gera receita direta em Dólar.
2. **Taxa de Rede (Network Fee):** Valor fixo em **LUNES** por transação.
   - **60% Receita:** Desenvolvimento & DAO.
   - **10% Deflação:** Queima (Burn) automática.
   - **30% Ecossistema:** Liquidez & Recompensas.

| Tier | Volume Mensal | Taxa (USD) | Taxa (LUNES) |
| :--- | :--- | :--- | :--- |
| **Baixo** | < $10k | 0.60% | ~2 LUNES |
| **Médio** | $10k - $100k | 0.50% | ~2 LUNES |
| **Alto** | > $100k | 0.30% | ~2 LUNES |

### **Mecanismo de Aplicação**

- **Taxa em Dólar (Revenue):** Descontada automaticamente do valor principal da transação (*Net Amount*).
  - *Exemplo:* Envia $1,000 USDT ➔ Recebe $994 LUSDT (Taxa 0.6% = $6.00).
- **Taxa em LUNES (Network):** Cobrada diretamente da carteira do usuário como taxa de serviço.
  - *Exemplo:* Usuário deve possuir saldo de LUNES (~2 LUNES) para executar a operação.

---

## 4. Mitigação de Risco e Segurança

| Recurso | Descrição |
| :--- | :--- |
| **Monitor de Paridade** | Serviço autônomo que verifica constantemente o saldo do Tesouro vs. Supply Total. Pausa o sistema se divergência > 5%. |
| **Circuit Breaker** | Função de "Pausa de Emergência" nos contratos para congelar operações instantaneamente em anomalias. |
| **Multisig Treasury** | Custódia de fundos na Solana protegida por esquema 3-de-5 assinaturas. |
| **Tetos de Taxa** | Proteção (Fee Caps) para usuários contra taxas excessivas em grandes volumes. |
| **Rate Limiting** | Limites de volume por janela de tempo para prevenir drenagem rápida de liquidez. |

---

## 5. Simulação de Receita (3 Anos)

**Premissas:**

- **Preço LUNES:** $0.50.
- **Mix de Transações:** Varejo 40%, Traders 30%, Pro 20%, Institucional 10%.
- **Receita LUNES:** Considera apenas a parcela de 60% (Dev+DAO) líquida para a empresa.

### **Cenário 1: Crescimento Orgânico (Conservador)**

| Ano | Usuários (Exit) | Volume (Exit) | Receita (USD) | Receita (LUNES) | Queima (LUNES) |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Ano 1** | ~2,160 | $1.0M | **$17,547** | **62,833 LUNES** | 10,472 LUNES |
| **Ano 2** | ~10,800 | $5.0M | **$107,167** | **373,310 LUNES** | 62,218 LUNES |
| **Ano 3** | ~43,200 | $20.0M | **$449,167** | **1,555,536 LUNES** | 259,256 LUNES |
| **TOTAL** | | | **~$573,880** | **~1.99M LUNES** | **~331k LUNES** |

### **Cenário 2: Adoção Acelerada (Meta de Impacto)**

Início com 10k usuários.

| Ano | Usuários (Exit) | Volume (Exit) | Receita (USD) | Receita (LUNES) | Queima (LUNES) |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Ano 1** | ~24,800 | $11.5M | **$288,787** | **1,001,755 LUNES** | 166,959 LUNES |
| **Ano 2** | ~99,300 | $46.0M | **$1,034,167** | **3,577,764 LUNES** | 596,294 LUNES |
| **Ano 3** | ~248,400 | $115.0M | **$2,897,167** | **10,017,782 LUNES** | 1,669,630 LUNES |
| **TOTAL** | | | **~$4.22 Milhões** | **~14.60M LUNES** | **~2.43M LUNES** |

> *Nota: "Receita (USD)" é o ganho direto em Stablecoin. "Receita (LUNES)" é o ganho em tokens utilitários para tesouraria. "Queima" é a redução de supply.*
