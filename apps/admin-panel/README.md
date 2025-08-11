# 🎮 LUSDT Admin Panel

Painel administrativo para gerenciar o token LUSDT e suas funcionalidades.

## 🚀 Como executar

### 1. Configurar variáveis de ambiente

Crie um arquivo `.env.local` na raiz deste projeto com:

```env
# Endereços dos contratos (substituir pelos endereços reais após deploy)
VITE_LUSDT_ADDRESS=SEU_ENDERECO_LUSDT_AQUI
VITE_TAX_MANAGER_ADDRESS=SEU_ENDERECO_TAX_MANAGER_AQUI

# Configuração de rede (opcional - padrão é local)
VITE_NETWORK_URL=ws://127.0.0.1:9944
VITE_NETWORK_NAME=Local Testnet
```

### 2. Instalar dependências

```bash
npm install
```

### 3. Executar em desenvolvimento

```bash
npm run dev
```

O painel estará disponível em `http://localhost:5173`

## 📋 Funcionalidades

### 🪙 Token LUSDT
- **Owner Functions**:
  - Definir/atualizar conta bridge
  - Definir/atualizar contrato tax manager
  - Atualizar administrador de emergência

- **Bridge Functions**:
  - Mintar novos tokens LUSDT

- **Emergency Admin Functions**:
  - Pausar/despausar contrato em emergência

- **View Functions**:
  - Visualizar total supply
  - Ver status de pausa
  - Consultar endereços importantes
  - Verificar saldos

### 💰 Tax Manager
- **Owner Functions**:
  - Atualizar preço do LUNES
  - Configurar carteiras de distribuição
  - Alterar configurações de taxas

- **View Functions**:
  - Consultar configurações atuais
  - Calcular taxas
  - Ver volume mensal

## 🔐 Permissões

O painel identifica automaticamente suas permissões baseado na conta conectada:

- **👑 Owner**: Pode alterar configurações do contrato
- **🌉 Bridge**: Pode mintar tokens
- **🚨 Emergency Admin**: Pode pausar/despausar
- **👁️ Viewer**: Apenas visualização

## 🛠 Tecnologias

- **React 19** + **TypeScript**
- **Vite** para build
- **Tailwind CSS** para styling
- **Polkadot.js** para blockchain
- **Zustand** para state management
- **Headless UI** para componentes

## 📦 Deploy

### Build para produção

```bash
npm run build
```

### Preview do build

```bash
npm run preview
```

### Deploy na Vercel

1. Conecte o repositório na Vercel
2. Configure as variáveis de ambiente no dashboard
3. Deploy automático a cada push

## 🔧 Configuração avançada

### Diferentes redes

Para conectar em diferentes redes, atualize a variável `VITE_NETWORK_URL`:

```env
# Local testnet
VITE_NETWORK_URL=ws://127.0.0.1:9944

# Rococo testnet
VITE_NETWORK_URL=wss://rococo-contracts-rpc.polkadot.io

# Rede Lunes (quando disponível)
VITE_NETWORK_URL=wss://node.lunes.io
```

## 🐛 Troubleshooting

### Carteira não conecta
- Certifique-se que a extensão Polkadot.js está instalada
- Verifique se há contas configuradas na extensão
- Confirme que está na rede correta

### Contrato não carrega
- Verifique os endereços nas variáveis de ambiente
- Confirme que os contratos estão deployed na rede
- Verifique se a rede está acessível

### Transações falham
- Confirme que tem permissões para a operação
- Verifique se há saldo suficiente na conta
- Confirme que o contrato não está pausado

## 📁 Estrutura do projeto

```
src/
├── components/          # Componentes React
│   ├── admin/          # Componentes administrativos
│   ├── common/         # Componentes reutilizáveis
│   └── layout/         # Layout e navegação
├── contracts/          # Metadados dos contratos
├── services/           # Serviços blockchain
├── store/             # Estado global (Zustand)
├── types/             # Tipos TypeScript
└── utils/             # Utilitários
```

## 🤝 Contribuindo

1. Fork o projeto
2. Crie uma branch para sua feature
3. Commit suas mudanças
4. Push para a branch
5. Abra um Pull Request

## 📄 Licença

Este projeto está sob a licença MIT.