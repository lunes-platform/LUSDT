# 🔧 Setup do LUSDT Admin Panel

## 🚀 Configuração Rápida

### 1. Configurar endereços dos contratos

Primeiro, você precisa dos endereços dos contratos deployados. Para obtê-los, execute na raiz do projeto:

```bash
# Verificar se os contratos estão compilados
cd contracts/lusdt_token
cargo contract build --release

cd ../tax_manager  
cargo contract build --release

# Os endereços serão mostrados após o deploy dos contratos
```

### 2. Criar arquivo de configuração

Crie o arquivo `.env.local` no diretório `frontend/admin-panel/`:

```bash
# Na pasta frontend/admin-panel/
cp .env.example .env.local
```

Edite o `.env.local` com os endereços reais:

```env
# Substitua pelos endereços reais após deploy
VITE_LUSDT_ADDRESS=5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY
VITE_TAX_MANAGER_ADDRESS=5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY

# Configuração de rede (ajuste conforme necessário)
VITE_NETWORK_URL=ws://127.0.0.1:9944
VITE_NETWORK_NAME=Local Testnet
```

### 3. Instalar e executar

```bash
# Instalar dependências
npm install

# Executar em desenvolvimento  
npm run dev
```

### 4. Verificar funcionamento

1. Acesse `http://localhost:5173`
2. Clique em "Conectar Carteira"
3. Autorize a conexão na extensão Polkadot.js
4. Verifique se as informações do token carregam

## 🔍 Solução de Problemas

### Carteira não conecta
- Instale a extensão Polkadot.js
- Crie pelo menos uma conta na extensão
- Permita que a extensão acesse o site

### Contratos não carregam
- Verifique se os endereços estão corretos
- Confirme que os contratos estão deployados
- Teste a conexão com a rede

### Sem permissões
- Use a conta do owner para funções administrativas
- Use a conta bridge para mintar tokens
- Use a conta emergency admin para pausar/despausar

## 📋 Checklist de Funcionalidades

### ✅ Básico
- [ ] Conexão com carteira Polkadot.js
- [ ] Carregamento de dados do token
- [ ] Exibição de informações básicas

### ✅ Owner Functions
- [ ] Alterar conta bridge
- [ ] Alterar contrato tax manager  
- [ ] Alterar emergency admin

### ✅ Bridge Functions
- [ ] Mintar novos tokens

### ✅ Emergency Functions
- [ ] Pausar contrato
- [ ] Despausar contrato

### ✅ Interface
- [ ] Alertas de erro/sucesso
- [ ] Confirmação de transações
- [ ] Loading states
- [ ] Formatação de endereços

## 🚀 Deploy em Produção

### Vercel (Recomendado)

1. **Preparar repositório**:
```bash
git add .
git commit -m "feat: implement LUSDT admin panel"
git push origin main
```

2. **Deploy na Vercel**:
   - Conecte o repositório na Vercel
   - Configure o diretório raiz: `frontend/admin-panel`
   - Adicione as variáveis de ambiente no dashboard
   - Deploy automático

3. **Variáveis de ambiente na Vercel**:
```
VITE_LUSDT_ADDRESS=<endereco-real>
VITE_TAX_MANAGER_ADDRESS=<endereco-real>
VITE_NETWORK_URL=<url-rede-producao>
VITE_NETWORK_NAME=<nome-rede>
```

### Build local

```bash
# Build para produção
npm run build

# Testar build localmente
npm run preview
```

## 🔐 Segurança

### Recomendações
- ✅ Nunca commite chaves privadas
- ✅ Use HTTPS em produção  
- ✅ Valide permissões no frontend E nos contratos
- ✅ Monitore transações importantes
- ✅ Mantenha logs de auditoria

### Permissões por Conta
- **Owner**: Todas as configurações administrativas
- **Bridge**: Apenas mint de tokens
- **Emergency Admin**: Apenas pause/unpause
- **Usuários**: Apenas visualização

## 📞 Suporte

Se encontrar problemas:

1. Verifique os logs do console do navegador
2. Confirme a configuração de rede
3. Teste com a rede local primeiro
4. Verifique se os contratos estão deployados corretamente