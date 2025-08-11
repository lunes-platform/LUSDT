import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Loading } from '../ui/Loading';
import { cn } from '../../utils/cn';

export interface FeeBreakdown {
  dev: number;
  dao: number;
  backing?: number;
  rewards?: number;
  burn?: number;
  liquidity?: number;
}

export interface FeeCalculation {
  baseAmount: number;
  feeAmount: number;
  feePercentage: number;
  feeCap: number;
  feeCapApplied: boolean;
  distribution: FeeBreakdown;
  totalReceived: number;
  estimatedTime: string;
}

export interface FeeCalculatorProps {
  /** Cálculo de taxa atual */
  calculation?: FeeCalculation;
  /** Se está carregando */
  loading?: boolean;
  /** Erro no cálculo */
  error?: string;
  /** Tipo de operação */
  operation: 'deposit' | 'redemption';
  /** Token de origem */
  sourceToken: string;
  /** Token de destino */
  destinationToken: string;
  /** Classe CSS adicional */
  className?: string;
}

export const FeeCalculator: React.FC<FeeCalculatorProps> = ({
  calculation,
  loading = false,
  error,
  operation,
  sourceToken,
  destinationToken,
  className
}) => {
  const formatAmount = (amount: number, token: string) => {
    return `${new Intl.NumberFormat('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 6
    }).format(amount)} ${token}`;
  };

  const formatPercentage = (percentage: number) => {
    return `${percentage.toFixed(2)}%`;
  };

  const getOperationLabel = () => {
    return operation === 'deposit' ? 'Depósito' : 'Resgate';
  };

  if (loading) {
    return (
      <Card className={cn('bg-white shadow-lg rounded-xl border border-gray-200', className)}>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Calculando Taxas...</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-4">
            <Loading size="sm" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className={cn('bg-white shadow-lg rounded-xl border border-red-200', className)}>
        <CardHeader>
          <CardTitle className="text-sm font-medium text-red-800">Erro no Cálculo</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-red-600">{error}</p>
          <p className="text-xs text-red-500 mt-1">
            Tente novamente ou use valores estimados
          </p>
        </CardContent>
      </Card>
    );
  }

  if (!calculation) {
    return (
      <Card className={cn('bg-white shadow-lg rounded-xl border border-gray-200', className)}>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Resumo de Taxas</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-500 text-center py-4">
            Digite um valor para ver o cálculo de taxas
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn('bg-white shadow-lg rounded-xl border border-gray-200', className)}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium">
            Resumo de {getOperationLabel()}
          </CardTitle>
          <Badge variant="secondary" className="text-xs">
            {calculation.estimatedTime}
          </Badge>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Valores Principais */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Valor {operation === 'deposit' ? 'enviado' : 'queimado'}:</span>
            <span className="font-medium">
              {formatAmount(calculation.baseAmount, sourceToken)}
            </span>
          </div>
          
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Taxa total:</span>
            <div className="text-right">
              <span className="font-medium text-red-600">
                -{formatAmount(calculation.feeAmount, sourceToken)}
              </span>
              <span className="text-xs text-gray-500 ml-1">
                ({formatPercentage(calculation.feePercentage)})
              </span>
            </div>
          </div>

          {calculation.feeCapApplied && (
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Cap aplicado:</span>
              <Badge variant="success" className="text-xs">
                Economia aplicada
              </Badge>
            </div>
          )}

          <div className="border-t pt-2">
            <div className="flex justify-between text-sm font-medium">
              <span>Valor {operation === 'deposit' ? 'recebido' : 'a receber'}:</span>
              <span className="text-green-600">
                {formatAmount(calculation.totalReceived, destinationToken)}
              </span>
            </div>
          </div>
        </div>

        {/* Distribuição de Taxas */}
        <div className="border-t pt-4">
          <h4 className="text-xs font-medium text-gray-700 mb-2">
            Distribuição de Taxas
          </h4>
          <div className="space-y-1">
            {calculation.distribution.dev > 0 && (
              <div className="flex justify-between text-xs">
                <span className="text-gray-500">Desenvolvimento:</span>
                <span>{formatAmount(calculation.distribution.dev, sourceToken)}</span>
              </div>
            )}
            
            {calculation.distribution.dao > 0 && (
              <div className="flex justify-between text-xs">
                <span className="text-gray-500">DAO:</span>
                <span>{formatAmount(calculation.distribution.dao, sourceToken)}</span>
              </div>
            )}
            
            {calculation.distribution.backing && calculation.distribution.backing > 0 && (
              <div className="flex justify-between text-xs">
                <span className="text-gray-500">Backing:</span>
                <span>{formatAmount(calculation.distribution.backing, sourceToken)}</span>
              </div>
            )}
            
            {calculation.distribution.rewards && calculation.distribution.rewards > 0 && (
              <div className="flex justify-between text-xs">
                <span className="text-gray-500">Rewards:</span>
                <span>{formatAmount(calculation.distribution.rewards, sourceToken)}</span>
              </div>
            )}
            
            {calculation.distribution.burn && calculation.distribution.burn > 0 && (
              <div className="flex justify-between text-xs">
                <span className="text-gray-500">Burn:</span>
                <span>{formatAmount(calculation.distribution.burn, sourceToken)}</span>
              </div>
            )}
            
            {calculation.distribution.liquidity && calculation.distribution.liquidity > 0 && (
              <div className="flex justify-between text-xs">
                <span className="text-gray-500">Liquidez:</span>
                <span>{formatAmount(calculation.distribution.liquidity, sourceToken)}</span>
              </div>
            )}
          </div>
        </div>

        {/* Informações Adicionais */}
        <div className="border-t pt-3">
          <div className="flex items-center justify-between text-xs text-gray-500">
            <span>Tempo estimado:</span>
            <span>{calculation.estimatedTime}</span>
          </div>
          
          {calculation.feeCapApplied && (
            <div className="mt-1 text-xs text-green-600">
              ✓ Taxa limitada pelo cap de LUNES
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default FeeCalculator;