import React, { useState, useEffect } from 'react';
import { Input, type InputProps } from '../ui/Input';
import { cn } from '../../utils/cn';

export interface AmountInputProps extends Omit<InputProps, 'value' | 'onChange'> {
  /** Valor do amount */
  value: string;
  /** Callback quando o valor muda */
  onChange: (value: string) => void;
  /** Token symbol */
  token: string;
  /** Saldo disponível */
  balance?: number;
  /** Valor mínimo */
  min?: number;
  /** Valor máximo */
  max?: number;
  /** Mostrar botão "Max" */
  showMaxButton?: boolean;
  /** Callback quando clica em "Max" */
  onMaxClick?: () => void;
  /** Mostrar validação de saldo */
  validateBalance?: boolean;
  /** Decimais permitidos */
  decimals?: number;
}

export const AmountInput: React.FC<AmountInputProps> = ({
  value,
  onChange,
  token,
  balance,
  min = 0,
  max,
  showMaxButton = true,
  onMaxClick,
  validateBalance = true,
  decimals = 6,
  className,
  error,
  ...props
}) => {
  const [localError, setLocalError] = useState<string>('');

  // Validação do valor
  useEffect(() => {
    if (!value || value === '') {
      setLocalError('');
      return;
    }

    const numValue = parseFloat(value);

    if (isNaN(numValue)) {
      setLocalError('Valor inválido');
      return;
    }

    if (numValue < min) {
      setLocalError(`Valor mínimo: ${min} ${token}`);
      return;
    }

    if (max && numValue > max) {
      setLocalError(`Valor máximo: ${max} ${token}`);
      return;
    }

    if (validateBalance && balance !== undefined && numValue > balance) {
      setLocalError('Saldo insuficiente');
      return;
    }

    setLocalError('');
  }, [value, min, max, balance, token, validateBalance]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = e.target.value;
    
    // Permitir apenas números e ponto decimal
    if (inputValue === '' || /^\d*\.?\d*$/.test(inputValue)) {
      // Limitar decimais
      const parts = inputValue.split('.');
      if (parts[1] && parts[1].length > decimals) {
        return;
      }
      
      onChange(inputValue);
    }
  };

  const handleMaxClick = () => {
    if (onMaxClick) {
      onMaxClick();
    } else if (balance !== undefined) {
      onChange(balance.toString());
    }
  };

  const formatBalance = (amount: number) => {
    return new Intl.NumberFormat('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: decimals
    }).format(amount);
  };

  const displayError = error || localError;

  return (
    <div className="space-y-2">
      <div className="relative">
        <Input
          {...props}
          type="text"
          inputMode="decimal"
          value={value}
          onChange={handleChange}
          error={displayError}
          className={cn(
            'pr-20', // Espaço para o token symbol
            showMaxButton && balance !== undefined && 'pr-32', // Espaço adicional para botão Max
            className
          )}
          placeholder={`0.00 ${token}`}
        />
        
        {/* Token Symbol */}
        <div className="absolute inset-y-0 right-0 flex items-center pr-3">
          <div className="flex items-center space-x-2">
            {showMaxButton && balance !== undefined && (
              <button
                type="button"
                onClick={handleMaxClick}
                className="text-xs font-medium text-blue-600 hover:text-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 rounded px-1"
              >
                Max
              </button>
            )}
            <span className="text-sm font-medium text-gray-500">
              {token}
            </span>
          </div>
        </div>
      </div>

      {/* Balance Display */}
      {balance !== undefined && (
        <div className="flex justify-between text-xs text-gray-500">
          <span>Saldo disponível:</span>
          <span className="font-medium">
            {formatBalance(balance)} {token}
          </span>
        </div>
      )}
    </div>
  );
};

export default AmountInput;