# Plano de Tarefas de Desenvolvimento – Projeto LUSDT

Este documento descreve as tarefas de desenvolvimento de alto nível para os smart contracts do LUSDT. O desenvolvimento seguirá uma abordagem faseada, alinhada com a metodologia TDD.

---

## Fase 1: Fundação dos Contratos e Lógica Principal - CONCLUÍDA

_Objetivo: Implementar as estruturas básicas e a funcionalidade principal de `mint` e `burn`._

- [x] **Configuração do Projeto:**

  - [x] Inicializar um novo projeto `ink!` 5.1.x.
  - [x] Configurar o `Cargo.toml` com as dependências necessárias.
  - [x] Criar a estrutura de diretórios para os contratos (`lusdt_token`, `tax_manager`).

- [x] **Contrato `lusdt_token` (Core Logic):**

  - [x] **TDD:** Escrever teste que falha para o construtor (inicialização de `owner`, `bridge_account`, etc.).
  - [x] Implementar a `#[ink(storage)]` struct e o construtor para passar no teste.
  - [x] **TDD:** Escrever testes para a função `mint()` (caso de sucesso, erro de autorização, erro de contrato pausado).
  - [x] Implementar a lógica de `mint()` e os controles de acesso/pausa para passar nos testes.
  - [x] **TDD:** Escrever testes para a função `burn()` (caso de sucesso, erro de saldo insuficiente).
  - [x] Implementar a lógica de `burn()` para passar nos testes.
  - [x] Implementar a conformidade básica com o padrão PSP22 (`balance_of`, `total_supply`, `transfer`).

- [x] **Contrato `tax_manager` (Estrutura):**
  - [x] **TDD:** Escrever teste que falha para o construtor (inicialização das carteiras e configurações de taxa).
  - [x] Implementar a `#[ink(storage)]` struct e o construtor do `tax_manager`.
  - [x] **TDD:** Escrever testes para a lógica de cálculo de distribuição de taxas (para `Mint` e `Burn`).
  - [x] Implementar a lógica de `process_fees` para passar nos testes de cálculo.
  - [x] **TDD:** Implementar função `get_current_fee_bps()` com taxa adaptativa baseada em volume.
  - [x] **TDD:** Implementar função `update_monthly_volume()` para atualização de volume mensal.
  - [x] **TDD:** Implementar funções administrativas (`update_fee_config`, `update_distribution_wallets`).
  - [x] **Cobertura de Testes:** 13 testes unitários cobrindo todos os cenários críticos.

---

## Fase 2: Segurança, Integração e Funcionalidades Avançadas - CONCLUÍDA

_Objetivo: Fortalecer os contratos com padrões de segurança e garantir que eles funcionem perfeitamente juntos._

- [x] **Implementação de Padrões de Segurança:**

  - [x] **TDD:** Escrever testes para verificar o funcionamento do `Circuit Breaker`.
  - [x] Implementar e aplicar os modificadores de pausa em todas as funções críticas.
  - [x] **TDD:** Escrever testes para os controles de `owner`.
  - [x] Implementar as funções administrativas e o modificador `ensure_owner`.
  - [x] Revisar todo o código para garantir o uso de matemática segura (`checked_*`) e o padrão `Checks-Effects-Interactions`.

- [x] **Integração entre Contratos (DESBLOQUEADO):**

  - [ ] **TDD (Integração):** Escrever teste de integração. (Bloqueado por problemas de API nas ferramentas de teste `ink_e2e@5.1.1` e `drink@0.1.0` - **Ainda pendente**).
  - [x] Implementar a chamada/interação real do `lusdt_token` para o `tax_manager`.
  - [x] Garantir que o fluxo de aprovação de LUNES + chamada ao `tax_manager` funcione.

- [x] **Lógica de Taxa Adaptativa:**
  - [x] **TDD:** Escrever testes para a função `get_current_fee_bps`.
  - [x] Implementar a lógica de consulta da taxa adaptativa.
  - [x] **TDD:** Escrever testes para a atualização do volume.
  - [x] Implementar a função `update_monthly_volume`.

---

## Fase 3: Finalização, Otimização e Preparação para Auditoria

_Objetivo: Limpar o código, otimizar o consumo de gás e preparar toda a documentação para uma auditoria externa._

- [ ] **Refatoração e Otimização:**

  - [ ] Revisar todo o código em busca de otimizações de gás e armazenamento.
  - [ ] Garantir que a documentação `NatSpec` (comentários `///`) esteja completa e clara em todas as funções públicas.
  - [ ] Executar `cargo clippy` e `cargo fmt` e corrigir todos os avisos.

- [ ] **Testes Finais:**

  - [ ] Aumentar a cobertura de testes para mais de 95%, focando em casos de borda.
  - [ ] Realizar uma rodada completa de testes E2E simulando o fluxo completo com um mock do Serviço de Ponte.

- [ ] **Preparação para Implantação:**
  - [ ] Criar scripts de implantação e verificação.
  - [ ] Preparar um documento de "Deployment Runbook" com os parâmetros do construtor para a testnet e mainnet.
  - [ ] Congelar o código para a auditoria externa.

---
