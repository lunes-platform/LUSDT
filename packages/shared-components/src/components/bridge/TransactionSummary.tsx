import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { cn } from '../../utils/cn';

export interface TransactionSummaryData {
  operation: 'deposit' | 'redemption';
  amount: string;
  sourceToken: string;
  destinationToken: string;
  sourceAddress: string;
  destinationAddress: string;
  sourceNetwork: string;
  destinationNetwork: string;
  feeAmount: string;
  totalReceived: string;
  estimatedTime: string;
  exchangeRate?: string;
}

export interface TransactionSummaryProps {
  /** Dados do resumo */
  data?: TransactionSummaryData;
  /** Se está pronto para confirmar */
  readyToConfirm?: boolean;
  /** Classe CSS adicional */
  className?: string;
}

export const TransactionSummary: React.FC<TransactionSummaryProps> = ({
  data,
  readyToConfirm = false,
  className
}) => {
  if (!data) {
    return (
      <Card className={cn('bg-white shadow-lg rounded-xl border border-gray-200', className)}>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Resumo da Transação</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-500 text-center py-4">
            Complete os campos para ver o resumo
          </p>
        </CardContent>
      </Card>
    );
  }

  const getOperationLabel = () => {
    return data.operation === 'deposit' ? 'Depósito' : 'Resgate';
  };

  const getOperationDescription = () => {
    if (data.operation === 'deposit') {
      return `Converter ${data.sourceToken} em ${data.destinationToken}`;
    } else {
      return `Resgatar ${data.sourceToken} para ${data.destinationToken}`;
    }
  };

  const truncateAddress = (address: string, chars: number = 6) => {
    if (address.length <= chars * 2) return address;
    return `${address.slice(0, chars)}...${address.slice(-chars)}`;
  };

  const getNetworkColor = (network: string) => {
    switch (network.toLowerCase()) {
      case 'solana':
        return 'bg-purple-100 text-purple-800';
      case 'lunes':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <Card className={cn(
      'bg-white shadow-lg rounded-xl border border-gray-200',
      readyToConfirm && 'ring-2 ring-blue-500 ring-opacity-50',
      className
    )}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium">
            Resumo da Transação
          </CardTitle>
          <Badge variant={readyToConfirm ? 'success' : 'secondary'} className="text-xs">
            {readyToConfirm ? 'Pronto' : 'Pendente'}
          </Badge>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Operação */}
        <div className="text-center pb-2 border-b">
          <h3 className="text-lg font-semibold text-gray-900">
            {getOperationLabel()}
          </h3>
          <p className="text-sm text-gray-600">
            {getOperationDescription()}
          </p>
        </div>

        {/* Valores */}
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-600">Valor:</span>
            <div className="text-right">
              <div className="font-semibold">
                {data.amount} {data.sourceToken}
              </div>
              {data.exchangeRate && (
                <div className="text-xs text-gray-500">
                  Taxa: {data.exchangeRate}
                </div>
              )}
            </div>
          </div>

          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-600">Taxa:</span>
            <span className="font-medium text-red-600">
              -{data.feeAmount} {data.sourceToken}
            </span>
          </div>

          <div className="flex justify-between items-center border-t pt-2">
            <span className="text-sm font-medium text-gray-900">Você receberá:</span>
            <span className="font-bold text-green-600 text-lg">
              {data.totalReceived} {data.destinationToken}
            </span>
          </div>
        </div>

        {/* Endereços e Redes */}
        <div className="space-y-3 border-t pt-4">
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-gray-500">De:</span>
              <Badge className={cn('text-xs', getNetworkColor(data.sourceNetwork))}>
                {data.sourceNetwork}
              </Badge>
            </div>
            <div className="font-mono text-sm bg-gray-50 p-2 rounded border">
              {truncateAddress(data.sourceAddress, 8)}
            </div>
          </div>

          <div className="flex justify-center">
            <div className="flex items-center text-gray-400">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
              </svg>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-gray-500">Para:</span>
              <Badge className={cn('text-xs', getNetworkColor(data.destinationNetwork))}>
                {data.destinationNetwork}
              </Badge>
            </div>
            <div className="font-mono text-sm bg-gray-50 p-2 rounded border">
              {truncateAddress(data.destinationAddress, 8)}
            </div>
          </div>
        </div>

        {/* Informações Adicionais */}
        <div className="border-t pt-3 space-y-2">
          <div className="flex justify-between text-xs text-gray-500">
            <span>Tempo estimado:</span>
            <span className="font-medium">{data.estimatedTime}</span>
          </div>
          
          <div className="flex justify-between text-xs text-gray-500">
            <span>Status:</span>
            <span className={cn(
              'font-medium',
              readyToConfirm ? 'text-green-600' : 'text-yellow-600'
            )}>
              {readyToConfirm ? 'Pronto para confirmar' : 'Aguardando dados'}
            </span>
          </div>
        </div>

        {/* Aviso de Confirmação */}
        {readyToConfirm && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <div className="flex items-start">
              <div className="flex-shrink-0">
                <svg className="h-4 w-4 text-blue-400 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="ml-2">
                <p className="text-xs text-blue-800">
                  Revise cuidadosamente os detalhes antes de confirmar. 
                  Esta operação não pode ser desfeita.
                </p>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default TransactionSummary;