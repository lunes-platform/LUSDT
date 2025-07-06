# 🏦 Documento Técnico: Setup do Cofre Multisig na Solana

**Versão:** 1.0
**Data:** 2024-07-26
**Status:** Implementado

## 1. Objetivo

Este documento descreve a arquitetura, o processo de configuração e os procedimentos operacionais para o cofre do tesouro (Treasury) do LUSDT Bridge na rede Solana. O objetivo principal é garantir a custódia segura e descentralizada de todos os fundos USDT que lastreiam os tokens LUSDT emitidos, eliminando pontos únicos de falha e prevenindo o acesso não autorizado aos fundos.

## 2. Arquitetura de Custódia

A custódia dos fundos USDT é baseada em um **cofre multisig (multi-assinatura) 3-de-5** na rede Solana, utilizando a Solana Program Library (SPL).

### 2.1. Componentes Principais

1.  **Guardiões (Guardians):**
    - São **5 entidades independentes** responsáveis pela segurança do tesouro.
    - Cada guardião possui um par de chaves Solana único, gerado e armazenado em um ambiente seguro (preferencialmente uma hardware wallet).
    - A identidade e a afiliação dos guardiões devem ser publicamente conhecidas para fins de auditoria e confiança.

2.  **Autoridade Multisig (Multisig Authority):**
    - É uma conta especial na Solana que **não armazena os fundos diretamente**.
    - Sua única função é atuar como a **"autoridade de assinatura"** para a conta do tesouro.
    - Ela é configurada com as 5 chaves públicas dos guardiões e um **threshold de 3 assinaturas**.
    - Endereço gerado: `solana-keys/multisig_authority_address.txt`

3.  **Conta do Tesouro (Treasury Token Account):**
    - É uma conta de token padrão para o USDT.
    - **Esta conta armazena 100% dos fundos USDT do tesouro.**
    - O "proprietário" (owner) desta conta não é uma chave única, mas sim a **Autoridade Multisig**.
    - Isso significa que qualquer transação de saída desta conta requer a aprovação de 3 dos 5 guardiões.
    - Endereço gerado: `solana-keys/treasury_token_account_address.txt`

### 2.2. Diagrama da Arquitetura

```text
                                  ┌─────────────────────────┐
                                  │   Conta do Tesouro USDT   │
                                  │ (Guarda 100% dos fundos)  │
                                  └────────────┬────────────┘
                                               │
                                       "owned by"
                                               │
                                  ┌────────────▼────────────┐
                                  │  Autoridade Multisig 3/5  │
                                  │  (Não guarda fundos)    │
                                  └────────────┬────────────┘
                                               │
                                       "controlled by"
                                               │
         ┌──────────┴──────────┬──────────┴──────────┬──────────┴──────────┐
         │                     │                     │                     │
┌────────▼────────┐   ┌────────▼────────┐   ┌────────▼────────┐   ┌────────▼────────┐   ┌────────▼────────┐
│  Guardião 1     │   │  Guardião 2     │   │  Guardião 3     │   │  Guardião 4     │   │  Guardião 5     │
│ (Hardware Wallet) │   │ (Hardware Wallet) │   │ (Hardware Wallet) │   │ (Hardware Wallet) │   │ (Hardware Wallet) │
└─────────────────┘   └─────────────────┘   └─────────────────┘   └─────────────────┘   └─────────────────┘
```

## 3. Procedimento de Setup

A configuração do cofre multisig é automatizada através do script `scripts/setup-solana-multisig.sh`.

### 3.1. Pré-requisitos
- [Solana CLI](https://docs.solana.com/cli/install) instalada.
- Acesso ao terminal na raiz do projeto.

### 3.2. Execução
1.  **Tornar o script executável:**
    ```bash
    chmod +x scripts/setup-solana-multisig.sh
    ```
2.  **Executar o script:**
    ```bash
    ./scripts/setup-solana-multisig.sh
    ```
O script guiará o processo passo a passo. Por padrão, ele opera na **devnet**. Para produção, o script deve ser editado para apontar para a `mainnet-beta` e usar o endereço de mint correto do USDT.

### 3.3. Produtos Gerados
O script cria um diretório `solana-keys/` com os seguintes artefatos:
- `guardian_N_keypair.json`: Os 5 pares de chaves dos guardiões.
- `multisig_authority_address.txt`: O endereço público da autoridade multisig.
- `treasury_token_account_address.txt`: O endereço público da conta do tesouro.

> **AVISO DE SEGURANÇA CRÍTICO:** O diretório `solana-keys/` contém as chaves privadas que controlam os fundos. **NUNCA** faça commit deste diretório para o Git. Em produção, as chaves devem ser geradas e manuseadas em ambientes offline e seguras, e os arquivos `keypair.json` distribuídos aos guardiões por canais seguros.

## 4. Procedimentos Operacionais

### 4.1. Depósito de Fundos (Entrada no Tesouro)
- Depósitos são simples transferências de USDT para o endereço público da **Conta do Tesouro**.
- Exemplo: `spl-token transfer <USDT_MINT> 100 <ENDERECO_DA_CONTA_DO_TESOURO>`
- O Bridge Service monitora este endereço para novos depósitos.

### 4.2. Saque de Fundos (Saída do Tesouro)
- Saques são transações multisig e exigem um processo de múltiplas etapas.
- O Bridge Service automatiza a **proposta** da transação. Os guardiões devem **aprovar**.

**Processo de uma transferência multisig:**

1.  **Proposta (Bridge Service ou Guardião 1):**
    - O primeiro ator (geralmente o Bridge Service) constrói e propõe a transação, assinando-a com sua chave. A transação fica pendente.
    - Comando Exemplo:
      ```bash
      spl-token transfer <TOKEN> <QTD> <DESTINO> \
        --owner <AUTORIDADE_MULTISIG> \
        --multisig-signer <CHAVE_GUARDIÃO_1>
      ```

2.  **Aprovação (Guardião 2):**
    - O segundo guardião usa os mesmos parâmetros da transação original para aprovar a transação pendente.
    - Comando Exemplo:
      ```bash
      spl-token transfer <TOKEN> <QTD> <DESTINO> \
        --owner <AUTORIDADE_MULTISIG> \
        --multisig-signer <CHAVE_GUARDIÃO_2>
      ```

3.  **Aprovação e Execução (Guardião 3):**
    - O terceiro guardião (ou qualquer guardião que complete o threshold de 3) aprova a transação. Como o threshold é atingido, a transação é **executada** na rede Solana.
    - Comando Exemplo:
      ```bash
      spl-token transfer <TOKEN> <QTD> <DESTINO> \
        --owner <AUTORIDADE_MULTISIG> \
        --multisig-signer <CHAVE_GUARDIÃO_3>
      ```

## 5. Plano de Testes

Para validar que a implementação do cofre multisig funciona conforme o esperado, um script de teste automatizado foi criado: `scripts/test-solana-multisig.sh`.

### 5.1. Cenários de Teste

1.  **Teste de Falha (Abaixo do Threshold):**
    - **Objetivo:** Provar que uma transação **falha** se não atingir o threshold de 3 assinaturas.
    - **Passos:** O script tentará executar a transferência com apenas 2 assinaturas.
    - **Resultado Esperado:** A CLI da Solana deve retornar um erro, e os fundos não devem ser movidos.

2.  **Teste de Sucesso (Threshold Atingido):**
    - **Objetivo:** Provar que uma transação é **bem-sucedida** quando o threshold de 3 assinaturas é atingido.
    - **Passos:** O script simulará os 3 guardiões assinando a transação em sequência.
    - **Resultado Esperado:** A transação deve ser executada com sucesso, e o saldo na conta de destino deve ser atualizado.

### 5.2. Executando os Testes
1.  Garanta que o cofre foi configurado com `setup-solana-multisig.sh`.
2.  Torne o script de teste executável: `chmod +x scripts/test-solana-multisig.sh`.
3.  Execute o teste: `./scripts/test-solana-multisig.sh`.

O script fornecerá um output claro indicando o sucesso ou falha de cada cenário.

## 6. Segurança e Melhores Práticas

- **Gestão de Chaves:** A segurança do sistema depende inteiramente da segurança das chaves dos guardiões. Use hardware wallets (como Ledger) para armazenar as chaves de produção.
- **Rotação de Guardiões:** Defina um procedimento claro para adicionar ou remover um guardião do cofre multisig. Isso envolve a criação de uma nova autoridade multisig e a transferência da propriedade da conta do tesouro.
- **Monitoramento:** Monitore ativamente o endereço da Conta do Tesouro e o endereço da Autoridade Multisig em exploradores de bloco para qualquer atividade inesperada.
- **Backup Seguro:** Guardiões devem manter backups seguros de suas frases de recuperação em locais fisicamente distintos e seguros.
- **Não commitar chaves:** Repetindo, o diretório `solana-keys/` JAMAIS deve ser commitado no repositório de código. Adicione `solana-keys/` ao arquivo `.gitignore`. 