# @lusdt/shared-components

Biblioteca de componentes compartilhados para o ecossistema LUSDT, otimizada com **Tailwind CSS 4.1** e recursos avançados.

## 🚀 Características

- **Tailwind CSS 4.1**: Novo engine CSS baseado em Rust para performance superior
- **Container Queries**: Layouts responsivos baseados no tamanho do container
- **CSS Custom Properties**: Temas dinâmicos e customização avançada
- **Animações Suaves**: Sistema de animações otimizado
- **Acessibilidade**: Componentes totalmente acessíveis (WCAG 2.1)
- **TypeScript**: Type safety completo
- **Design System**: Sistema de design consistente para LUSDT

## 📦 Instalação

```bash
npm install @lusdt/shared-components
```

## 🎨 Uso Básico

```tsx
import { Button, Card, Input } from '@lusdt/shared-components';
import '@lusdt/shared-components/dist/styles.css';

function App() {
  return (
    <Card variant="elevated" hoverable>
      <CardHeader>
        <CardTitle>Bridge USDT para LUSDT</CardTitle>
        <CardDescription>
          Converta seus tokens de forma segura
        </CardDescription>
      </CardHeader>
      
      <CardContent>
        <Input 
          label="Valor a converter"
          placeholder="0.00"
          type="number"
        />
      </CardContent>
      
      <CardFooter>
        <Button variant="bridge" size="lg" fullWidth>
          Iniciar Bridge
        </Button>
      </CardFooter>
    </Card>
  );
}
```

## 🎯 Componentes Disponíveis

### Button
Botão versátil com múltiplas variantes e estados.

```tsx
// Variantes básicas
<Button variant="primary">Primário</Button>
<Button variant="secondary">Secundário</Button>
<Button variant="outline">Contorno</Button>

// Variantes específicas LUSDT
<Button variant="solana">Solana</Button>
<Button variant="lunes">Lunes</Button>
<Button variant="bridge">Bridge</Button>

// Com estados
<Button loading loadingText="Processando...">
  Enviar Transação
</Button>

// Com ícones
<Button leftIcon={<WalletIcon />} rightIcon={<ArrowIcon />}>
  Conectar Carteira
</Button>
```

### Input
Campo de entrada com validação e estados visuais.

```tsx
// Input básico
<Input 
  label="Email"
  placeholder="seu@email.com"
  type="email"
/>

// Com validação
<Input 
  label="Valor USDT"
  error="Valor deve ser maior que 0"
  helperText="Mínimo: 1 USDT"
/>

// Com ícones
<Input 
  label="Buscar"
  leftIcon={<SearchIcon />}
  rightElement={<Button size="sm">Buscar</Button>}
/>
```

### Card
Container flexível para conteúdo.

```tsx
// Card básico
<Card>
  <CardContent>Conteúdo aqui</CardContent>
</Card>

// Card interativo
<Card variant="elevated" hoverable clickable>
  <CardHeader>
    <CardTitle>Título</CardTitle>
    <CardDescription>Descrição</CardDescription>
  </CardHeader>
  <CardContent>Conteúdo</CardContent>
  <CardFooter>Rodapé</CardFooter>
</Card>

// Card com tema bridge
<Card variant="bridge" glow>
  <CardContent>
    Transação cross-chain em andamento...
  </CardContent>
</Card>
```

## 🎨 Sistema de Design

### Cores

```css
/* Cores primárias */
--color-primary: 59 130 246;    /* Blue-500 */
--color-solana: 220 38 127;     /* Solana Purple */
--color-lunes: 59 130 246;      /* Lunes Blue */

/* Estados */
--color-success: 34 197 94;     /* Green-500 */
--color-warning: 245 158 11;    /* Amber-500 */
--color-error: 239 68 68;       /* Red-500 */
```

### Container Queries

```tsx
// Componente que adapta ao tamanho do container
<div className="@container/form">
  <div className="grid @[400px]/form:grid-cols-2 @[600px]/form:grid-cols-3">
    {/* Layout adapta ao container, não à viewport */}
  </div>
</div>
```

### Animações

```tsx
// Animações específicas para transações
<div className="animate-transaction-success">
  Transação concluída!
</div>

<div className="animate-bridge-flow">
  Processando bridge...
</div>
```

## 🛠 Customização

### Tema Personalizado

```tsx
// Definir variáveis CSS customizadas
:root {
  --color-primary: 123 45 67; /* Sua cor personalizada */
}

// Usar com Tailwind
<Button className="bg-primary-500 hover:bg-primary-600">
  Botão Customizado
</Button>
```

### Variantes Customizadas

```tsx
import { cn, createVariants } from '@lusdt/shared-components';

const customButtonVariants = createVariants({
  variant: {
    custom: 'bg-purple-500 text-white hover:bg-purple-600'
  }
});

function CustomButton({ variant, className, ...props }) {
  return (
    <button 
      className={cn(
        'px-4 py-2 rounded-lg',
        customButtonVariants({ variant }),
        className
      )}
      {...props}
    />
  );
}
```

## 📱 Responsividade

Os componentes usam **container queries** para responsividade avançada:

```tsx
// Responsivo baseado no container pai
<Card className="@container/card">
  <div className="text-sm @[400px]/card:text-base @[600px]/card:text-lg">
    Texto que escala com o tamanho do card
  </div>
</Card>
```

## ♿ Acessibilidade

Todos os componentes seguem as diretrizes WCAG 2.1:

- Navegação por teclado
- Leitores de tela
- Contraste adequado
- Estados de foco visíveis
- ARIA labels apropriados

## 🧪 Testes

```bash
# Executar testes
npm test

# Testes com interface
npm run test:ui

# Cobertura de testes
npm run test:coverage
```

## 📚 Storybook

```bash
# Executar Storybook
npm run storybook

# Build do Storybook
npm run build-storybook
```

## 🤝 Contribuindo

1. Fork o projeto
2. Crie uma branch para sua feature (`git checkout -b feature/nova-feature`)
3. Commit suas mudanças (`git commit -m 'Adiciona nova feature'`)
4. Push para a branch (`git push origin feature/nova-feature`)
5. Abra um Pull Request

## 📄 Licença

MIT © Equipe LUSDT