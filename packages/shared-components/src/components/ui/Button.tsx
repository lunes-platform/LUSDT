import React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cn, createVariants } from '../../utils/cn';

// Definição das variantes do botão usando Tailwind 4.1
const buttonVariants = createVariants({
  variant: {
    primary: [
      'bg-primary-500 text-white shadow-sm',
      'hover:bg-primary-600 hover:shadow-md',
      'focus-visible:ring-primary-500',
      'active:bg-primary-700'
    ].join(' '),
    
    secondary: [
      'bg-white text-gray-900 border border-gray-300 shadow-sm',
      'hover:bg-gray-50 hover:border-gray-400',
      'focus-visible:ring-gray-500',
      'active:bg-gray-100'
    ].join(' '),
    
    outline: [
      'border border-primary-300 text-primary-700 bg-transparent',
      'hover:bg-primary-50 hover:border-primary-400',
      'focus-visible:ring-primary-500',
      'active:bg-primary-100'
    ].join(' '),
    
    ghost: [
      'text-gray-700 bg-transparent',
      'hover:bg-gray-100 hover:text-gray-900',
      'focus-visible:ring-gray-500',
      'active:bg-gray-200'
    ].join(' '),
    
    destructive: [
      'bg-red-500 text-white shadow-sm',
      'hover:bg-red-600 hover:shadow-md',
      'focus-visible:ring-red-500',
      'active:bg-red-700'
    ].join(' '),
    
    success: [
      'bg-green-500 text-white shadow-sm',
      'hover:bg-green-600 hover:shadow-md',
      'focus-visible:ring-green-500',
      'active:bg-green-700'
    ].join(' '),
    
    // Variantes específicas para LUSDT
    solana: [
      'bg-solana-500 text-white shadow-sm glow-solana',
      'hover:bg-solana-600 hover:shadow-md',
      'focus-visible:ring-solana-500',
      'active:bg-solana-700'
    ].join(' '),
    
    lunes: [
      'bg-lunes-500 text-white shadow-sm glow-lunes',
      'hover:bg-lunes-600 hover:shadow-md',
      'focus-visible:ring-lunes-500',
      'active:bg-lunes-700'
    ].join(' '),
    
    bridge: [
      'bg-gradient-bridge text-white shadow-sm',
      'hover:shadow-md hover:scale-105',
      'focus-visible:ring-primary-500',
      'active:scale-95 transition-transform'
    ].join(' ')
  },
  
  size: {
    xs: 'h-7 px-2 text-xs rounded-md',
    sm: 'h-8 px-3 text-sm rounded-md',
    md: 'h-10 px-4 text-sm rounded-lg',
    lg: 'h-12 px-6 text-base rounded-lg',
    xl: 'h-14 px-8 text-lg rounded-xl',
    icon: 'h-10 w-10 rounded-lg'
  },
  
  fullWidth: {
    true: 'w-full',
    false: 'w-auto'
  }
});

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Variante visual do botão */
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'destructive' | 'success' | 'solana' | 'lunes' | 'bridge';
  /** Tamanho do botão */
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'icon';
  /** Se o botão deve ocupar toda a largura disponível */
  fullWidth?: boolean;
  /** Estado de carregamento */
  loading?: boolean;
  /** Ícone à esquerda do texto */
  leftIcon?: React.ReactNode;
  /** Ícone à direita do texto */
  rightIcon?: React.ReactNode;
  /** Se deve renderizar como um Slot (para uso com bibliotecas de roteamento) */
  asChild?: boolean;
  /** Texto para leitores de tela quando em estado de loading */
  loadingText?: string;
}

/**
 * Componente Button otimizado com Tailwind 4.1
 * 
 * Características:
 * - Variantes visuais extensivas incluindo temas específicos para Solana/Lunes
 * - Estados de loading com indicador visual
 * - Suporte a ícones
 * - Acessibilidade completa
 * - Animações suaves com Tailwind 4.1
 * - Container queries para responsividade
 * 
 * @example
 * ```tsx
 * // Botão básico
 * <Button variant="primary" size="md">
 *   Clique aqui
 * </Button>
 * 
 * // Botão com loading
 * <Button loading loadingText="Processando...">
 *   Enviar
 * </Button>
 * 
 * // Botão específico para bridge
 * <Button variant="bridge" size="lg" fullWidth>
 *   Iniciar Bridge
 * </Button>
 * ```
 */
const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({
    className,
    variant = 'primary',
    size = 'md',
    fullWidth = false,
    loading = false,
    leftIcon,
    rightIcon,
    asChild = false,
    loadingText,
    disabled,
    children,
    ...props
  }, ref) => {
    const Comp = asChild ? Slot : 'button';
    
    // Ícone de loading
    const LoadingIcon = () => (
      <svg 
        className="animate-spin h-4 w-4" 
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <circle 
          className="opacity-25" 
          cx="12" 
          cy="12" 
          r="10" 
          stroke="currentColor" 
          strokeWidth="4"
        />
        <path 
          className="opacity-75" 
          fill="currentColor" 
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
        />
      </svg>
    );
    
    return (
      <Comp
        className={cn(
          // Classes base
          'lusdt-button',
          'inline-flex items-center justify-center gap-2 font-medium',
          'transition-all duration-200 ease-in-out',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
          'disabled:pointer-events-none disabled:opacity-50',
          'select-none',
          
          // Container query para responsividade
          '@container/button',
          
          // Aplicar variantes (fullWidth espera 'true' | 'false')
          buttonVariants({ variant, size, fullWidth: (fullWidth ? 'true' : 'false') as 'true' | 'false' }),
          
          // Estados especiais
          loading && 'cursor-wait',
          
          className
        )}
        disabled={disabled || loading}
        ref={ref}
        aria-disabled={disabled || loading}
        aria-describedby={loading && loadingText ? 'button-loading-text' : undefined}
        {...props}
      >
        {/* Ícone esquerdo ou loading */}
        {loading ? (
          <LoadingIcon />
        ) : leftIcon ? (
          <span className="flex-shrink-0" aria-hidden="true">
            {leftIcon}
          </span>
        ) : null}
        
        {/* Conteúdo do botão */}
        <span className={cn(
          'flex-1',
          size === 'icon' && 'sr-only' // Esconder texto em botões de ícone
        )}>
          {children}
        </span>
        
        {/* Ícone direito (não mostrar durante loading) */}
        {!loading && rightIcon && (
          <span className="flex-shrink-0" aria-hidden="true">
            {rightIcon}
          </span>
        )}
        
        {/* Texto de loading para leitores de tela */}
        {loading && loadingText && (
          <span id="button-loading-text" className="sr-only">
            {loadingText}
          </span>
        )}
      </Comp>
    );
  }
);

Button.displayName = 'Button';

export { Button, buttonVariants };