# Plano de Testes e Estratégia TDD – Projeto LUSDT

## 1. Metodologia: Test-Driven Development (TDD)

O desenvolvimento dos smart contracts do LUSDT seguirá estritamente a metodologia TDD. Nosso mantra será o ciclo **Red-Green-Refactor**:

1.  **RED:** Escrever um novo teste que falha. O teste deve definir uma funcionalidade ou melhoria específica. Este passo garante que temos um requisito claro e testável antes de codificar.
2.  **GREEN:** Escrever o **mínimo** de código de produção necessário para fazer o teste passar. O objetivo aqui não é a elegância, mas a funcionalidade.
3.  **REFACTOR:** Com a segurança de um teste que passa, refatorar tanto o código de produção quanto o código de teste para melhorar a clareza, remover duplicação e otimizar o design, sem alterar o comportamento.

Esta abordagem garantirá que tenhamos uma suíte de testes abrangente, que o design do nosso contrato evolua de forma limpa e que cada linha de código tenha um propósito verificável.

## 2. Níveis de Teste

Aplicaremos três níveis de teste para garantir a robustez do sistema.

### Nível 1: Testes Unitários (`#[ink::test]`)

- **Foco:** Testar a lógica interna de cada contrato de forma isolada.
- **Ambiente:** Utiliza o ambiente de teste mock do `ink!`, que nos permite simular condições específicas como `caller`, `transferred_value`, balanços, etc.
- **Responsabilidade:** Verificar a correção de cada função, incluindo casos de sucesso, casos de erro esperados e condições de borda (edge cases).

### Nível 2: Testes de Integração (`#[ink_e2e::test]`)

- **Foco:** Testar a interação entre os smart contracts do sistema (`lusdt_token` e `tax_manager`).
- **Ambiente:** Executado contra um nó de blockchain real (ex: `substrate-contracts-node`), simulando transações e interações do mundo real.
- **Responsabilidade:** Garantir que os contratos se comunicam corretamente, que as transferências de controle e valor funcionam como esperado e que as permissões entre contratos são aplicadas.

### Nível 3: Testes End-to-End (E2E) (Framework Externo)

- **Foco:** Testar o fluxo completo do sistema, incluindo o Serviço de Ponte.
- **Ambiente:** Um ambiente de teste completo com os contratos implantados em uma testnet e um Serviço de Ponte (real ou mockado) em execução.
- **Responsabilidade:** Validar os casos de uso completos de `mint` e `burn`, desde a ação do usuário em uma ponta até o resultado na outra. Este nível de teste é crucial para validar a lógica off-chain e sua interação com os contratos.

## 3. Plano de Testes Inicial (Casos de Teste Chave)

A seguir, uma lista inicial de casos de teste que guiarão a primeira fase de desenvolvimento.

### 3.1. Contrato `lusdt_token`

#### Função: `new()` (Construtor)

- **[FAIL]** Teste `new_constructor_sets_owner`: Deve falhar porque o owner não foi implementado.
- **[PASS]** Implementar `owner`. Teste passa.
- **[FAIL]** Teste `new_constructor_sets_initial_addresses`: Deve falhar porque `bridge_account` etc. não existem.
- **[PASS]** Implementar `bridge_account`, etc. Teste passa.

#### Função: `mint()`

- **Given:** O chamador NÃO é o `bridge_account`.
  - **When:** `mint()` é chamado.
  - **Then:** A transação deve reverter com `Error::Unauthorized`.
- **Given:** O contrato está pausado.
  - **When:** `mint()` é chamado pelo `bridge_account`.
  - **Then:** A transação deve reverter com `Error::Paused`.
- **Given:** O chamador é o `bridge_account` e o contrato não está pausado.
  - **When:** `mint(user_a, 1000)` é chamado.
  - **Then:**
    - O `balance_of(user_a)` deve ser `1000`.
    - O `total_supply()` deve ser `1000`.
    - Um evento `Transfer` deve ser emitido de `None` para `user_a` com valor `1000`.

#### Função: `burn()`

- **Given:** O usuário `user_a` tem 500 LUSDT, mas tenta queimar 1000.
  - **When:** `burn(user_a, 1000, "sol_addr")` é chamado.
  - **Then:** A transação deve reverter com `Error::InsufficientBalance`.
- **Given:** O usuário `user_a` tem 1000 LUSDT.
  - **When:** `burn(user_a, 500, "sol_addr")` é chamado.
  - **Then:**
    - O `balance_of(user_a)` deve ser `500`.
    - O `total_supply()` deve ser `500`.
    - Um evento `RedemptionRequested` deve ser emitido com os dados corretos.
    - Um evento `Transfer` deve ser emitido de `user_a` para `None` com valor `500`.

#### Função: `toggle_pause_state()`

- **Given:** O chamador NÃO é o `owner`.
  - **When:** `toggle_pause_state()` é chamado.
  - **Then:** A transação deve reverter com `Error::Unauthorized`.
- **Given:** O chamador é o `owner` e o contrato está `unpaused`.
  - **When:** `toggle_pause_state()` é chamado.
  - **Then:** O estado `paused` deve ser `true` e um evento `Paused` deve ser emitido.

### 3.2. Contrato `tax_manager`

#### Função: `process_burn_fee_only()` para Emissão (Mint) - Modelo v3

- **Given:** Um mint de 1000 LUSDT é processado (USDT fee tratada pelo bridge).
  - **When:** `process_burn_fee_only(Mint, user, 1000)` é chamado.
  - **Then:**
    - Cobra 0.10% LUNES burn fee do usuário.
    - Transfere LUNES burn fee para o BurnEngine.
    - Emite evento `DualFeesProcessed` com `stablecoin_fee: 0`.
    - Atualiza `monthly_volume_usd`.

#### Função: `process_dual_fee()` para Resgate (Burn) - Modelo v3

- **Given:** Uma taxa de resgate de 100 (LUSDT) é processada com dual-fee.
  - **When:** `process_dual_fee(Burn, user, amount, FeeType::Lusdt)` é chamado.
  - **Then:**
    - O `dev_lunes` deve receber 80 (80% da taxa em LUSDT).
    - O `insurance_fund` deve receber 15 (15% da taxa em LUSDT, fixo).
    - O `staking_rewards_pool` deve receber 5 (5% da taxa em LUSDT, staking mensal).
    - Cobra 0.10% LUNES burn fee → envia ao BurnEngine.
    - Emite evento `DualFeesProcessed`.

#### Distribuição de taxas USDT via Bridge (Mint) - Modelo v3

- **Given:** O bridge coleta 100 USDT de taxa antes do mint.
  - **When:** Bridge distribui a taxa em Solana.
  - **Then:**
    - `DEV_SOLANA_WALLET` deve receber 80 USDT (80%).
    - `INSURANCE_SOLANA_WALLET` deve receber 15 USDT (15%).
    - `STAKING_REWARDS_SOLANA_WALLET` deve receber 5 USDT (5%).

---

Esta lista será expandida continuamente à medida que novas funcionalidades e casos de borda forem identificados. Cada bug encontrado em produção ou testnet resultará na criação de um novo teste de regressão que falhe, garantindo que o bug, uma vez corrigido, nunca mais ocorra.
