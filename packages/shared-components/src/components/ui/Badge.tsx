import React from 'react';
import { cn, createVariants } from '../../utils/cn';

const badgeVariants = createVariants({
  variant: {
    default: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300',
    primary: 'bg-primary-100 text-primary-800 dark:bg-primary-900/20 dark:text-primary-400',
    secondary: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300',
    success: 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400',
    warning: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400',
    error: 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400',
    info: 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400',
    
    // Status específicos para transações
    pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400 animate-pulse',
    processing: 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400 animate-transaction-pulse',
    completed: 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400',
    failed: 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400',
    
    // Redes blockchain
    solana: 'bg-solana-100 text-solana-800 dark:bg-solana-900/20 dark:text-solana-400',
    lunes: 'bg-lunes-100 text-lunes-800 dark:bg-lunes-900/20 dark:text-lunes-400'
  },
  
  size: {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-2.5 py-0.5 text-sm',
    lg: 'px-3 py-1 text-sm'
  },
  
  shape: {
    rounded: 'rounded-md',
    pill: 'rounded-full',
    square: 'rounded-none'
  }
});

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement> {
  /** Variante visual do badge */
  variant?: 'default' | 'primary' | 'secondary' | 'success' | 'warning' | 'error' | 'info' | 'pending' | 'processing' | 'completed' | 'failed' | 'solana' | 'lunes';
  /** Tamanho do badge */
  size?: 'sm' | 'md' | 'lg';
  /** Formato do badge */
  shape?: 'rounded' | 'pill' | 'square';
  /** Ícone à esquerda */
  leftIcon?: React.ReactNode;
  /** Ícone à direita */
  rightIcon?: React.ReactNode;
  /** Se deve ter efeito de brilho */
  glow?: boolean;
}

/**
 * Componente Badge para status e categorização
 * 
 * @example
 * ```tsx
 * // Badge básico
 * <Badge variant="success">Concluído</Badge>
 * 
 * // Badge de status de transação
 * <Badge variant="processing" leftIcon={<SpinnerIcon />}>
 *   Processando
 * </Badge>
 * 
 * // Badge de rede
 * <Badge variant="solana" shape="pill">
 *   Solana
 * </Badge>
 * ```
 */
const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(
  ({
    className,
    variant = 'default',
    size = 'md',
    shape = 'pill',
    leftIcon,
    rightIcon,
    glow = false,
    children,
    ...props
  }, ref) => {
    const glowMap: Record<NonNullable<BadgeProps['variant']>, string | undefined> = {
      default: undefined,
      primary: 'glow-primary',
      secondary: undefined,
      success: 'glow-success',
      warning: undefined,
      error: 'glow-error',
      info: undefined,
      pending: undefined,
      processing: undefined,
      completed: undefined,
      failed: undefined,
      solana: 'glow-solana',
      lunes: 'glow-lunes'
    };
    return (
      <span
        ref={ref}
        className={cn(
          // Classes base
          'inline-flex items-center gap-1 font-medium',
          'transition-all duration-200',
          
          // Aplicar variantes
          badgeVariants({ variant, size, shape }),
          
          // Efeito de brilho
          glow && glowMap[variant],
          
          className
        )}
        {...props}
      >
        {/* Ícone esquerdo */}
        {leftIcon && (
          <span className="flex-shrink-0" aria-hidden="true">
            {leftIcon}
          </span>
        )}
        
        {/* Conteúdo */}
        <span className="flex-1">
          {children}
        </span>
        
        {/* Ícone direito */}
        {rightIcon && (
          <span className="flex-shrink-0" aria-hidden="true">
            {rightIcon}
          </span>
        )}
      </span>
    );
  }
);

Badge.displayName = 'Badge';

export { Badge, badgeVariants };