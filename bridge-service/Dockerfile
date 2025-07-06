# Multi-stage build para otimizar o tamanho da imagem
FROM node:18-alpine AS builder

# Instala dependências do sistema
RUN apk add --no-cache python3 make g++

# Define diretório de trabalho
WORKDIR /app

# Copia arquivos de dependências
COPY package*.json ./
COPY tsconfig.json ./

# Instala dependências
RUN npm ci --only=production && npm cache clean --force

# Copia código fonte
COPY src/ ./src/

# Compila TypeScript
RUN npm run build

# Estágio de produção
FROM node:18-alpine AS production

# Instala dependências do sistema para produção
RUN apk add --no-cache dumb-init

# Cria usuário não-root para segurança
RUN addgroup -g 1001 -S nodejs
RUN adduser -S bridge -u 1001

# Define diretório de trabalho
WORKDIR /app

# Copia arquivos de dependências
COPY package*.json ./

# Instala apenas dependências de produção
RUN npm ci --only=production && npm cache clean --force

# Copia código compilado do estágio anterior
COPY --from=builder /app/dist ./dist

# Cria diretório para logs
RUN mkdir -p logs && chown -R bridge:nodejs logs

# Muda para usuário não-root
USER bridge

# Expõe porta
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })"

# Comando de inicialização
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/index.js"]

# Labels para metadados
LABEL maintainer="Lunes Team <dev@lunes.io>"
LABEL version="1.0.0"
LABEL description="LUSDT Bridge Service - Cross-chain bridge between Lunes and Solana"
LABEL org.opencontainers.image.source="https://github.com/lunes-platform/lusdt-bridge" 