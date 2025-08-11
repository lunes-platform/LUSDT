import React from 'react';
import { ChevronDownIcon } from '@heroicons/react/24/outline';
import { cn } from '../../utils/cn';

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectProps
  extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'size'> {
  /** Rótulo do campo */
  label?: string;
  /** Texto de ajuda abaixo do campo */
  helperText?: string;
  /** Mensagem de erro */
  error?: string;
  /** Opções do select */
  options: SelectOption[];
  /** Placeholder quando nenhuma opção está selecionada */
  placeholder?: string;
  /** Tamanho do select */
  size?: 'sm' | 'md' | 'lg';
  /** Se o campo é obrigatório */
  required?: boolean;
}

/**
 * Componente Select otimizado com Tailwind 4.1
 * 
 * @example
 * ```tsx
 * <Select
 *   label="Rede"
 *   placeholder="Selecione uma rede"
 *   options={[
 *     { value: 'solana', label: 'Solana' },
 *     { value: 'lunes', label: 'Lunes' }
 *   ]}
 *   value={selectedNetwork}
 *   onChange={(e) => setSelectedNetwork(e.target.value)}
 * />
 * ```
 */
const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({
    className,
    label,
    helperText,
    error,
    options,
    placeholder,
    size = 'md',
    required = false,
    disabled,
    id,
    ...props
  }, ref) => {
    const selectId = id || React.useId();
    const helperTextId = `${selectId}-helper`;
    const errorId = `${selectId}-error`;
    
    const sizeClasses = {
      sm: {
        select: 'h-8 px-3 text-sm',
        label: 'text-sm'
      },
      md: {
        select: 'h-10 px-3 text-sm',
        label: 'text-sm'
      },
      lg: {
        select: 'h-12 px-4 text-base',
        label: 'text-base'
      }
    };
    
    const currentSize = sizeClasses[size];
    
    return (
      <div className={cn('w-full @container/select', className)}>
        {/* Label */}
        {label && (
          <label 
            htmlFor={selectId}
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
        
        {/* Select container */}
        <div className="relative">
          <select
            id={selectId}
            ref={ref}
            disabled={disabled}
            aria-invalid={error ? 'true' : 'false'}
            aria-describedby={cn(
              helperText && helperTextId,
              error && errorId
            )}
            className={cn(
              // Classes base
              'block w-full rounded-lg border bg-white pr-10',
              'text-gray-900 transition-all duration-200',
              'focus:outline-none focus:ring-1',
              'appearance-none cursor-pointer',
              
              // Tamanho
              currentSize.select,
              
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
              
              // Dark mode
              'dark:bg-gray-800 dark:text-white',
              
              // Container queries
              '@[300px]/select:text-base @[300px]/select:px-4'
            )}
            {...props}
          >
            {placeholder && (
              <option value="" disabled>
                {placeholder}
              </option>
            )}
            {options.map((option) => (
              <option
                key={option.value}
                value={option.value}
                disabled={option.disabled}
              >
                {option.label}
              </option>
            ))}
          </select>
          
          {/* Ícone de seta */}
          <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
            <ChevronDownIcon className="h-5 w-5 text-gray-400" />
          </div>
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

Select.displayName = 'Select';

export { Select };