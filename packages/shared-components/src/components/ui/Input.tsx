import React from 'react';
import { cn } from '../../utils/cn';

export interface InputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> {
  /** Rótulo do campo */
  label?: string;
  /** Texto de ajuda abaixo do campo */
  helperText?: string;
  /** Mensagem de erro */
  error?: string;
  /** Ícone à esquerda do input */
  leftIcon?: React.ReactNode;
  /** Ícone à direita do input */
  rightIcon?: React.ReactNode;
  /** Elemento personalizado à direita (ex: botão) */
  rightElement?: React.ReactNode;
  /** Tamanho do input */
  size?: 'sm' | 'md' | 'lg';
  /** Se o campo é obrigatório */
  required?: boolean;
  /** Estado de loading */
  loading?: boolean;
}

/**
 * Componente Input otimizado com Tailwind 4.1
 * 
 * Características:
 * - Design system consistente com LUSDT
 * - Estados visuais claros (normal, error, disabled, loading)
 * - Suporte a ícones e elementos customizados
 * - Acessibilidade completa
 * - Responsividade com container queries
 * - Animações suaves
 * 
 * @example
 * ```tsx
 * // Input básico
 * <Input 
 *   label="Email" 
 *   placeholder="Digite seu email"
 *   type="email"
 * />
 * 
 * // Input com erro
 * <Input 
 *   label="Valor" 
 *   error="Valor deve ser maior que 0"
 *   value={value}
 *   onChange={setValue}
 * />
 * 
 * // Input com ícones
 * <Input 
 *   label="Buscar"
 *   leftIcon={<SearchIcon />}
 *   rightElement={<Button size="sm">Buscar</Button>}
 * />
 * ```
 */
const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({
    className,
    type = 'text',
    label,
    helperText,
    error,
    leftIcon,
    rightIcon,
    rightElement,
    size = 'md',
    required = false,
    loading = false,
    disabled,
    id,
    ...props
  }, ref) => {
    // Gerar ID único se não fornecido
    const inputId = id || React.useId();
    const helperTextId = `${inputId}-helper`;
    const errorId = `${inputId}-error`;
    
    // Classes baseadas no tamanho
    const sizeClasses = {
      sm: {
        input: 'h-8 px-3 text-sm',
        icon: 'h-4 w-4',
        label: 'text-sm'
      },
      md: {
        input: 'h-10 px-3 text-sm',
        icon: 'h-5 w-5',
        label: 'text-sm'
      },
      lg: {
        input: 'h-12 px-4 text-base',
        icon: 'h-6 w-6',
        label: 'text-base'
      }
    };
    
    const currentSize = sizeClasses[size];
    
    // Ícone de loading
    const LoadingIcon = () => (
      <svg 
        className={cn('animate-spin text-gray-400', currentSize.icon)}
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
      <div className={cn('w-full @container/input', className)}>
        {/* Label */}
        {label && (
          <label 
            htmlFor={inputId}
            className={cn(
              'block font-medium text-gray-700 mb-1',
              currentSize.label,
              'dark:text-gray-300',
              required && "after:content-['*'] after:ml-0.5 after:text-red-500"
            )}
          >
            {label}
          </label>
        )}
        
        {/* Container do input */}
        <div className="relative">
          {/* Ícone esquerdo */}
          {leftIcon && (
            <div className={cn(
              'absolute left-3 top-1/2 -translate-y-1/2 text-gray-400',
              'pointer-events-none',
              currentSize.icon
            )}>
              {leftIcon}
            </div>
          )}
          
          {/* Input */}
          <input
            type={type}
            id={inputId}
            ref={ref}
            disabled={disabled || loading}
            aria-invalid={error ? 'true' : 'false'}
            aria-describedby={cn(
              helperText && helperTextId,
              error && errorId
            )}
            className={cn(
              // Classes base
              'lusdt-input',
              'block w-full rounded-lg border bg-white',
              'text-gray-900 placeholder-gray-500',
              'transition-all duration-200',
              'focus:outline-none focus:ring-1',
              
              // Tamanho
              currentSize.input,
              
              // Espaçamento para ícones
              leftIcon && 'pl-10',
              (rightIcon || rightElement || loading) && 'pr-10',
              
              // Estados
              error ? [
                'border-red-300 focus:border-red-500 focus:ring-red-500',
                'dark:border-red-600 dark:focus:border-red-500'
              ] : [
                'border-gray-300 focus:border-primary-500 focus:ring-primary-500',
                'dark:border-gray-600 dark:focus:border-primary-400 dark:focus:ring-primary-400'
              ],
              
              disabled && [
                'bg-gray-50 text-gray-500 cursor-not-allowed',
                'dark:bg-gray-800 dark:text-gray-400'
              ],
              
              loading && 'cursor-wait',
              
              // Dark mode
              'dark:bg-gray-800 dark:text-white dark:placeholder-gray-400',
              
              // Container queries para responsividade
              '@[300px]/input:text-base @[300px]/input:px-4'
            )}
            {...props}
          />
          
          {/* Ícone direito ou loading */}
          {(rightIcon || rightElement || loading) && (
            <div className={cn(
              'absolute right-3 top-1/2 -translate-y-1/2',
              'flex items-center',
              rightElement ? 'pointer-events-auto' : 'pointer-events-none'
            )}>
              {loading ? (
                <LoadingIcon />
              ) : rightElement ? (
                rightElement
              ) : rightIcon ? (
                <span className={cn('text-gray-400', currentSize.icon)}>
                  {rightIcon}
                </span>
              ) : null}
            </div>
          )}
        </div>
        
        {/* Texto de ajuda ou erro */}
        {(helperText || error) && (
          <div className="mt-1 min-h-[1.25rem]">
            {error ? (
              <p 
                id={errorId}
                className="text-sm text-red-600 dark:text-red-400 animate-fade-in"
                role="alert"
              >
                {error}
              </p>
            ) : helperText ? (
              <p 
                id={helperTextId}
                className="text-sm text-gray-500 dark:text-gray-400"
              >
                {helperText}
              </p>
            ) : null}
          </div>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';

export { Input };