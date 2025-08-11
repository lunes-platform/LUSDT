import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Button, 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle,
  AmountInput,
  AddressInput,
  FeeCalculator,
  TransactionSummary,
  Input,
  cn
} from '@lusdt/shared-components';
import { useWalletStore } from '../../store/walletStore';
import { useDepositForm } from '../../hooks/useDepositForm';
import { WalletModal } from '../wallet';

export interface DepositFormProps {
  className?: string;
}

export const DepositForm: React.FC<DepositFormProps> = ({ className }) => {
  const navigate = useNavigate();
  const { solana, lunes } = useWalletStore();
  const [showWalletModal, setShowWalletModal] = useState(false);
  
  const {
    formData,
    errors,
    feeCalculation,
    feeLoading,
    feeError,
    transactionSummary,
    isValid,
    isSubmitting,
    updateField,
    submitDeposit
  } = useDepositForm();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const transactionId = await submitDeposit();
    if (transactionId) {
      // Navegar para página de tracking
      navigate(`/bridge/track/${transactionId}`);
    }
  };

  const handleMaxAmount = () => {
    if (solana?.balance) {
      updateField('amount', solana.balance.toString());
    }
  };

  // Check if wallets are connected
  const walletsConnected = solana?.connected && lunes?.connected;

  if (!walletsConnected) {
    return (
      <div className={cn('max-w-2xl mx-auto', className)}>
        <Card className="bridge-card">
          <CardContent className="text-center py-12">
            <div className="mx-auto h-16 w-16 text-gray-400 mb-4">
              <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 12a2.25 2.25 0 00-2.25-2.25H15a3 3 0 11-6 0H5.25A2.25 2.25 0 003 12m18 0v6a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 18v-6m18 0V9M3 12V9m18 0a2.25 2.25 0 00-2.25-2.25H13.5a3 3 0 11-6 0H5.25A2.25 2.25 0 003 9m18 0V6a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 6v3" />
              </svg>
            </div>
            
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              Conecte suas Carteiras
            </h3>
            
            <p className="text-gray-600 mb-6">
              Para fazer depósitos USDT → LUSDT, você precisa conectar carteiras em ambas as redes
            </p>

            <div className="space-y-3 mb-6">
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-purple-500 rounded-full flex items-center justify-center">
                    <span className="text-white text-sm font-medium">S</span>
                  </div>
                  <span className="font-medium">Solana (USDT)</span>
                </div>
                <div className={cn(
                  'text-sm font-medium',
                  solana?.connected ? 'text-green-600' : 'text-gray-400'
                )}>
                  {solana?.connected ? '✓ Conectado' : 'Não conectado'}
                </div>
              </div>

              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
                    <span className="text-white text-sm font-medium">L</span>
                  </div>
                  <span className="font-medium">Lunes (LUSDT)</span>
                </div>
                <div className={cn(
                  'text-sm font-medium',
                  lunes?.connected ? 'text-green-600' : 'text-gray-400'
                )}>
                  {lunes?.connected ? '✓ Conectado' : 'Não conectado'}
                </div>
              </div>
            </div>

            <Button 
              onClick={() => setShowWalletModal(true)}
              size="lg"
              className="w-full sm:w-auto"
            >
              Conectar Carteiras
            </Button>
          </CardContent>
        </Card>

        <WalletModal 
          isOpen={showWalletModal} 
          onClose={() => setShowWalletModal(false)} 
        />
      </div>
    );
  }

  return (
    <div className={cn('max-w-4xl mx-auto', className)}>
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Header */}
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            Depósito USDT → LUSDT
          </h2>
          <p className="text-gray-600">
            Converta seus USDT da Solana para LUSDT na Lunes
          </p>
        </div>

        {/* Error Display */}
        {errors.general && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-red-800">{errors.general}</p>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Form Fields */}
          <div className="space-y-6">
            <Card className="bridge-card">
              <CardHeader>
                <CardTitle className="text-lg">Detalhes do Depósito</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Amount Input */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Valor a Depositar
                  </label>
                  <AmountInput
                    value={formData.amount}
                    onChange={(value) => updateField('amount', value)}
                    token="USDT"
                    balance={solana?.balance}
                    onMaxClick={handleMaxAmount}
                    error={errors.amount}
                    placeholder="0.00"
                  />
                </div>

                {/* Destination Address */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Endereço de Destino (Lunes)
                  </label>
                  <AddressInput
                    value={formData.destinationAddress}
                    onChange={(value) => updateField('destinationAddress', value)}
                    network="lunes"
                    error={errors.destinationAddress}
                    placeholder="Endereço da carteira Lunes"
                  />
                  {lunes?.address && (
                    <button
                      type="button"
                      onClick={() => updateField('destinationAddress', lunes.address)}
                      className="mt-2 text-xs text-blue-600 hover:text-blue-700 focus:outline-none"
                    >
                      Usar endereço conectado: {lunes.address.slice(0, 8)}...{lunes.address.slice(-8)}
                    </button>
                  )}
                </div>

                {/* Optional Memo */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Memo (Opcional)
                  </label>
                  <Input
                    value={formData.memo || ''}
                    onChange={(e) => updateField('memo', e.target.value)}
                    placeholder="Adicione uma nota para esta transação"
                    maxLength={100}
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    Máximo 100 caracteres
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Fee Calculator and Summary */}
          <div className="space-y-6">
            <FeeCalculator
              calculation={feeCalculation}
              loading={feeLoading}
              error={feeError}
              operation="deposit"
              sourceToken="USDT"
              destinationToken="LUSDT"
            />

            <TransactionSummary
              data={transactionSummary}
              readyToConfirm={isValid && !isSubmitting}
            />
          </div>
        </div>

        {/* Submit Button */}
        <div className="flex justify-center pt-6">
          <Button
            type="submit"
            size="lg"
            loading={isSubmitting}
            disabled={!isValid || isSubmitting}
            className="w-full sm:w-auto min-w-[200px]"
          >
            {isSubmitting ? 'Processando...' : 'Confirmar Depósito'}
          </Button>
        </div>

        {/* Help Text */}
        <div className="text-center text-sm text-gray-500">
          <p>
            Ao confirmar, você autoriza a transferência de USDT da sua carteira Solana.
          </p>
          <p className="mt-1">
            O processo leva aproximadamente 2-5 minutos para ser concluído.
          </p>
        </div>
      </form>
    </div>
  );
};

export default DepositForm;