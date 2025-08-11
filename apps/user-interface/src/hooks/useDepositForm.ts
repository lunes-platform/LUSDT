import { useState, useEffect, useCallback } from 'react';
import { useWalletStore } from '../store/walletStore';
import { 
  type FeeCalculation, 
  type TransactionSummaryData 
} from '@lusdt/shared-components';

export interface DepositFormData {
  amount: string;
  destinationAddress: string;
  memo?: string;
}

export interface DepositFormState {
  // Form data
  formData: DepositFormData;
  
  // Validation
  errors: {
    amount?: string;
    destinationAddress?: string;
    general?: string;
  };
  
  // Fee calculation
  feeCalculation?: FeeCalculation;
  feeLoading: boolean;
  feeError?: string;
  
  // Transaction summary
  transactionSummary?: TransactionSummaryData;
  
  // Form state
  isValid: boolean;
  isSubmitting: boolean;
  
  // Actions
  updateField: (field: keyof DepositFormData, value: string) => void;
  validateForm: () => boolean;
  resetForm: () => void;
  submitDeposit: () => Promise<string | null>;
}

const INITIAL_FORM_DATA: DepositFormData = {
  amount: '',
  destinationAddress: '',
  memo: ''
};

export const useDepositForm = (): DepositFormState => {
  const { solana, lunes } = useWalletStore();
  
  // Form state
  const [formData, setFormData] = useState<DepositFormData>(INITIAL_FORM_DATA);
  const [errors, setErrors] = useState<DepositFormState['errors']>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Fee calculation state
  const [feeCalculation, setFeeCalculation] = useState<FeeCalculation>();
  const [feeLoading, setFeeLoading] = useState(false);
  const [feeError, setFeeError] = useState<string>();
  
  // Transaction summary
  const [transactionSummary, setTransactionSummary] = useState<TransactionSummaryData>();

  // Update form field
  const updateField = useCallback((field: keyof DepositFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    
    // Clear field-specific error
    if (errors[field as keyof typeof errors]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
  }, [errors]);

  // Validate individual fields
  const validateAmount = useCallback((amount: string): string | undefined => {
    if (!amount || amount === '') {
      return 'Valor é obrigatório';
    }

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      return 'Valor deve ser maior que zero';
    }

    if (solana?.balance && numAmount > solana.balance) {
      return 'Saldo insuficiente';
    }

    return undefined;
  }, [solana?.balance]);

  const validateDestinationAddress = useCallback((address: string): string | undefined => {
    if (!address || address === '') {
      return 'Endereço de destino é obrigatório';
    }

    // Validação básica para endereços Lunes
    if (address.length < 40 || address.length > 50) {
      return 'Formato de endereço Lunes inválido';
    }

    if (!/^[0-9a-fA-F]+$/.test(address)) {
      return 'Endereço deve conter apenas caracteres hexadecimais';
    }

    return undefined;
  }, []);

  // Validate entire form
  const validateForm = useCallback((): boolean => {
    const newErrors: DepositFormState['errors'] = {};

    // Validate amount
    const amountError = validateAmount(formData.amount);
    if (amountError) newErrors.amount = amountError;

    // Validate destination address
    const addressError = validateDestinationAddress(formData.destinationAddress);
    if (addressError) newErrors.destinationAddress = addressError;

    // Check wallet connections
    if (!solana?.connected) {
      newErrors.general = 'Conecte sua carteira Solana';
    } else if (!lunes?.connected) {
      newErrors.general = 'Conecte sua carteira Lunes';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [formData, solana?.connected, lunes?.connected, validateAmount, validateDestinationAddress]);

  // Calculate fees when amount changes
  useEffect(() => {
    const calculateFees = async () => {
      if (!formData.amount || parseFloat(formData.amount) <= 0) {
        setFeeCalculation(undefined);
        return;
      }

      setFeeLoading(true);
      setFeeError(undefined);

      try {
        // Mock fee calculation - em produção seria chamada para o serviço
        await new Promise(resolve => setTimeout(resolve, 500)); // Simular delay

        const amount = parseFloat(formData.amount);
        const feePercentage = 0.5; // 0.5%
        const feeAmount = amount * (feePercentage / 100);
        const totalReceived = amount - feeAmount;

        const mockCalculation: FeeCalculation = {
          baseAmount: amount,
          feeAmount,
          feePercentage,
          feeCap: 100, // 100 LUNES cap
          feeCapApplied: feeAmount > 100,
          distribution: {
            dev: feeAmount * 0.4,
            dao: feeAmount * 0.3,
            backing: feeAmount * 0.2,
            liquidity: feeAmount * 0.1
          },
          totalReceived: feeAmount > 100 ? amount - 100 : totalReceived,
          estimatedTime: '2-5 minutos'
        };

        setFeeCalculation(mockCalculation);
      } catch (error) {
        setFeeError('Erro ao calcular taxas. Tente novamente.');
        console.error('Fee calculation error:', error);
      } finally {
        setFeeLoading(false);
      }
    };

    calculateFees();
  }, [formData.amount]);

  // Update transaction summary when form data changes
  useEffect(() => {
    if (!formData.amount || !formData.destinationAddress || !feeCalculation || !solana?.address || !lunes?.address) {
      setTransactionSummary(undefined);
      return;
    }

    const summary: TransactionSummaryData = {
      operation: 'deposit',
      amount: formData.amount,
      sourceToken: 'USDT',
      destinationToken: 'LUSDT',
      sourceAddress: solana.address,
      destinationAddress: formData.destinationAddress,
      sourceNetwork: 'Solana',
      destinationNetwork: 'Lunes',
      feeAmount: feeCalculation.feeAmount.toFixed(6),
      totalReceived: feeCalculation.totalReceived.toFixed(6),
      estimatedTime: feeCalculation.estimatedTime,
      exchangeRate: '1 USDT = 1 LUSDT'
    };

    setTransactionSummary(summary);
  }, [formData, feeCalculation, solana?.address, lunes?.address]);

  // Submit deposit
  const submitDeposit = useCallback(async (): Promise<string | null> => {
    if (!validateForm()) {
      return null;
    }

    setIsSubmitting(true);
    setErrors({});

    try {
      // Mock deposit submission - em produção seria chamada para o DepositService
      await new Promise(resolve => setTimeout(resolve, 2000)); // Simular delay

      // Simular sucesso
      const mockTransactionId = `deposit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Reset form on success
      resetForm();
      
      return mockTransactionId;
    } catch (error) {
      setErrors({ general: 'Erro ao processar depósito. Tente novamente.' });
      console.error('Deposit submission error:', error);
      return null;
    } finally {
      setIsSubmitting(false);
    }
  }, [validateForm]);

  // Reset form
  const resetForm = useCallback(() => {
    setFormData(INITIAL_FORM_DATA);
    setErrors({});
    setFeeCalculation(undefined);
    setTransactionSummary(undefined);
    setFeeError(undefined);
  }, []);

  // Check if form is valid
  const isValid = validateForm() && !!feeCalculation && !feeError;

  return {
    formData,
    errors,
    feeCalculation,
    feeLoading,
    feeError,
    transactionSummary,
    isValid,
    isSubmitting,
    updateField,
    validateForm,
    resetForm,
    submitDeposit
  };
};