import React from 'react';
import { cn } from '../../utils/cn';

export interface LoadingProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Tamanho do spinner */
  size?: 'sm' | 'md' | 'lg' | 'xl';
  /** Variante visual */
  variant?: 'default' | 'primary' | 'white';
  /** Texto de loading */
  text?: string;
  /** Se deve centralizar na tela */
  fullScreen?: boolean;
  /** Se deve mostrar backdrop */
  backdrop?: boolean;
}

/**
 * Componente Loading com spinner animado
 * 
 * @example
 * ```tsx
 * // Loading básico
 * <Loading />
 * 
 * // Loading com texto
 * <Loading text="Carregando transações..." />
 * 
 * // Loading em tela cheia
 * <Loading fullScreen text="Conectando carteira..." />
 * ```
 */
const Loading = React.forwardRef<HTMLDivElement, LoadingProps>(
  ({
    className,
    size = 'md',
    variant = 'default',
    text,
    fullScreen = false,
    backdrop = false,
    ...props
  }, ref) => {
    const sizeClasses = {
      sm: 'h-4 w-4',
      md: 'h-6 w-6',
      lg: 'h-8 w-8',
      xl: 'h-12 w-12'
    };
    
    const variantClasses = {
      default: 'text-gray-600 dark:text-gray-400',
      primary: 'text-primary-600 dark:text-primary-400',
      white: 'text-white'
    };
    
    const textSizeClasses = {
      sm: 'text-sm',
      md: 'text-base',
      lg: 'text-lg',
      xl: 'text-xl'
    };
    
    const spinner = (
      <svg
        className={cn(
          'animate-spin',
          sizeClasses[size],
          variantClasses[variant]
        )}
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
    
    const content = (
      <div
        ref={ref}
        className={cn(
          'flex items-center justify-center gap-3',
          fullScreen ? 'flex-col' : 'flex-row',
          className
        )}
        role="status"
        aria-live="polite"
        {...props}
      >
        {spinner}
        {text && (
          <span
            className={cn(
              'font-medium',
              textSizeClasses[size],
              variantClasses[variant]
            )}
          >
            {text}
          </span>
        )}
        <span className="sr-only">
          {text || 'Carregando...'}
        </span>
      </div>
    );
    
    if (fullScreen) {
      return (
        <div
          className={cn(
            'fixed inset-0 z-50 flex items-center justify-center',
            backdrop && 'bg-black/50 backdrop-blur-sm'
          )}
        >
          {content}
        </div>
      );
    }
    
    return content;
  }
);

Loading.displayName = 'Loading';

export { Loading };