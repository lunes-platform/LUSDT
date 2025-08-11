import React, { useState, useEffect } from 'react';
import { Input, type InputProps } from '../ui/Input';
import { cn } from '../../utils/cn';

export interface AddressInputProps extends Omit<InputProps, 'value' | 'onChange'> {
  /** Valor do endereço */
  value: string;
  /** Callback quando o valor muda */
  onChange: (value: string) => void;
  /** Tipo de rede */
  network: 'solana' | 'lunes';
  /** Validar formato do endereço */
  validateFormat?: boolean;
  /** Mostrar QR code scanner (futuro) */
  showQRScanner?: boolean;
}

export const AddressInput: React.FC<AddressInputProps> = ({
  value,
  onChange,
  network,
  validateFormat = true,
  showQRScanner = false,
  className,
  error,
  ...props
}) => {
  const [localError, setLocalError] = useState<string>('');

  // Validação do endereço
  useEffect(() => {
    if (!validateFormat || !value || value === '') {
      setLocalError('');
      return;
    }

    if (network === 'solana') {
      // Validação básica para endereços Solana (base58, 32-44 chars)
      if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(value)) {
        setLocalError('Formato de endereço Solana inválido');
        return;
      }
    } else if (network === 'lunes') {
      // Validação básica para endereços Lunes (substrate format)
      if (value.length < 40 || value.length > 50) {
        setLocalError('Formato de endereço Lunes inválido');
        return;
      }
      
      // Verificar se contém apenas caracteres válidos
      if (!/^[0-9a-fA-F]+$/.test(value)) {
        setLocalError('Endereço deve conter apenas caracteres hexadecimais');
        return;
      }
    }

    setLocalError('');
  }, [value, network, validateFormat]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = e.target.value.trim();
    onChange(inputValue);
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    // Permitir paste e limpar espaços
    setTimeout(() => {
      const pastedValue = e.currentTarget.value.trim();
      if (pastedValue !== value) {
        onChange(pastedValue);
      }
    }, 0);
  };

  const getPlaceholder = () => {
    switch (network) {
      case 'solana':
        return 'Ex: 7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU';
      case 'lunes':
        return 'Ex: 5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY';
      default:
        return 'Digite o endereço de destino';
    }
  };

  const getNetworkLabel = () => {
    switch (network) {
      case 'solana':
        return 'Solana';
      case 'lunes':
        return 'Lunes';
      default:
        return 'Rede';
    }
  };

  const displayError = error || localError;

  return (
    <div className="space-y-2">
      <div className="relative">
        <Input
          {...props}
          type="text"
          value={value}
          onChange={handleChange}
          onPaste={handlePaste}
          error={displayError}
          placeholder={getPlaceholder()}
          className={cn(
            'font-mono text-sm', // Fonte monospace para endereços
            showQRScanner && 'pr-12', // Espaço para botão QR
            className
          )}
        />
        
        {/* QR Scanner Button (placeholder para futuro) */}
        {showQRScanner && (
          <div className="absolute inset-y-0 right-0 flex items-center pr-3">
            <button
              type="button"
              className="text-gray-400 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 rounded p-1"
              title="Escanear QR Code"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
              </svg>
            </button>
          </div>
        )}
      </div>

      {/* Network Indicator */}
      <div className="flex items-center justify-between text-xs text-gray-500">
        <span>Rede de destino:</span>
        <div className="flex items-center space-x-1">
          <div className={cn(
            'w-2 h-2 rounded-full',
            network === 'solana' ? 'bg-purple-500' : 'bg-blue-500'
          )} />
          <span className="font-medium">{getNetworkLabel()}</span>
        </div>
      </div>
    </div>
  );
};

export default AddressInput;