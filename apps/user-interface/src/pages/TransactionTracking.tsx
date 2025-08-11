import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, Badge, Button } from '@lusdt/shared-components';

interface TransactionStatus {
  id: string;
  type: 'deposit' | 'redemption';
  status: 'pending' | 'detected' | 'processing' | 'confirming' | 'completed' | 'failed';
  amount: string;
  sourceToken: string;
  destinationToken: string;
  sourceNetwork: string;
  destinationNetwork: string;
  sourceAddress: string;
  destinationAddress: string;
  sourceTransaction?: string;
  destinationTransaction?: string;
  createdAt: Date;
  updatedAt: Date;
  estimatedCompletion?: Date;
  confirmations: number;
  requiredConfirmations: number;
  steps: {
    name: string;
    status: 'pending' | 'processing' | 'completed' | 'failed';
    timestamp?: Date;
    transactionHash?: string;
  }[];
}

const TransactionTracking: React.FC = () => {
  const { transactionId } = useParams<{ transactionId: string }>();
  const [transaction, setTransaction] = useState<TransactionStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchTransaction = async () => {
      if (!transactionId) {
        setError('ID da transação não fornecido');
        setLoading(false);
        return;
      }

      try {
        // Mock transaction data - em produção seria uma chamada para API
        await new Promise(resolve => setTimeout(resolve, 1000));

        const mockTransaction: TransactionStatus = {
          id: transactionId,
          type: 'deposit',
          status: 'processing',
          amount: '100.00',
          sourceToken: 'USDT',
          destinationToken: 'LUSDT',
          sourceNetwork: 'Solana',
          destinationNetwork: 'Lunes',
          sourceAddress: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU',
          destinationAddress: '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY',
          sourceTransaction: 'abc123def456',
          createdAt: new Date(),
          updatedAt: new Date(),
          estimatedCompletion: new Date(Date.now() + 3 * 60 * 1000), // 3 minutes
          confirmations: 2,
          requiredConfirmations: 12,
          steps: [
            {
              name: 'Transação Solana Enviada',
              status: 'completed',
              timestamp: new Date(Date.now() - 2 * 60 * 1000),
              transactionHash: 'abc123def456'
            },
            {
              name: 'Confirmações Solana',
              status: 'processing',
              timestamp: new Date(Date.now() - 1 * 60 * 1000)
            },
            {
              name: 'Processamento Bridge',
              status: 'pending'
            },
            {
              name: 'Mint LUSDT na Lunes',
              status: 'pending'
            },
            {
              name: 'Transação Concluída',
              status: 'pending'
            }
          ]
        };

        setTransaction(mockTransaction);
      } catch (err) {
        setError('Erro ao carregar dados da transação');
      } finally {
        setLoading(false);
      }
    };

    fetchTransaction();

    // Simular atualizações em tempo real
    const interval = setInterval(() => {
      setTransaction(prev => {
        if (!prev || prev.status === 'completed' || prev.status === 'failed') {
          return prev;
        }

        // Simular progresso
        const newConfirmations = Math.min(prev.confirmations + 1, prev.requiredConfirmations);
        const newStatus = newConfirmations >= prev.requiredConfirmations ? 'completed' : prev.status;

        return {
          ...prev,
          confirmations: newConfirmations,
          status: newStatus,
          updatedAt: new Date()
        };
      });
    }, 10000); // Atualizar a cada 10 segundos

    return () => clearInterval(interval);
  }, [transactionId]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'processing':
        return 'bg-blue-100 text-blue-800';
      case 'failed':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-yellow-100 text-yellow-800';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return '✓';
      case 'processing':
        return '⟳';
      case 'failed':
        return '✗';
      default:
        return '○';
    }
  };

  const formatTime = (date: Date) => {
    return date.toLocaleString('pt-BR');
  };

  const truncateHash = (hash: string, chars: number = 8) => {
    return `${hash.slice(0, chars)}...${hash.slice(-chars)}`;
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="text-center">
          <div className="animate-spin h-8 w-8 border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-gray-600">Carregando dados da transação...</p>
        </div>
      </div>
    );
  }

  if (error || !transaction) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <Card>
          <CardContent className="text-center py-12">
            <div className="text-red-500 text-4xl mb-4">⚠️</div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              Erro ao Carregar Transação
            </h3>
            <p className="text-gray-600 mb-6">
              {error || 'Transação não encontrada'}
            </p>
            <Link to="/bridge">
              <Button>Voltar ao Bridge</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-2xl font-bold text-gray-900">Rastreamento de Transação</h1>
        <p className="mt-1 text-sm text-gray-500">
          ID: {transaction.id}
        </p>
      </div>

      {/* Status Overview */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Status da Transação</CardTitle>
            <Badge className={getStatusColor(transaction.status)}>
              {getStatusIcon(transaction.status)} {transaction.status.toUpperCase()}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <h4 className="font-medium text-gray-900">Detalhes da Operação</h4>
                <div className="mt-2 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Tipo:</span>
                    <span className="font-medium">
                      {transaction.type === 'deposit' ? 'Depósito' : 'Resgate'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Valor:</span>
                    <span className="font-medium">
                      {transaction.amount} {transaction.sourceToken}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">De:</span>
                    <span className="font-medium">{transaction.sourceNetwork}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Para:</span>
                    <span className="font-medium">{transaction.destinationNetwork}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <h4 className="font-medium text-gray-900">Progresso</h4>
                <div className="mt-2 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Confirmações:</span>
                    <span className="font-medium">
                      {transaction.confirmations}/{transaction.requiredConfirmations}
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                      style={{ 
                        width: `${(transaction.confirmations / transaction.requiredConfirmations) * 100}%` 
                      }}
                    ></div>
                  </div>
                  {transaction.estimatedCompletion && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Conclusão estimada:</span>
                      <span className="font-medium">
                        {formatTime(transaction.estimatedCompletion)}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Transaction Steps */}
      <Card>
        <CardHeader>
          <CardTitle>Progresso Detalhado</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {transaction.steps.map((step, index) => (
              <div key={index} className="flex items-start space-x-4">
                <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                  step.status === 'completed' 
                    ? 'bg-green-100 text-green-800' 
                    : step.status === 'processing'
                    ? 'bg-blue-100 text-blue-800'
                    : step.status === 'failed'
                    ? 'bg-red-100 text-red-800'
                    : 'bg-gray-100 text-gray-600'
                }`}>
                  {getStatusIcon(step.status)}
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium text-gray-900">{step.name}</h4>
                    {step.timestamp && (
                      <span className="text-xs text-gray-500">
                        {formatTime(step.timestamp)}
                      </span>
                    )}
                  </div>
                  
                  {step.transactionHash && (
                    <div className="mt-1">
                      <span className="text-xs text-gray-500">Hash: </span>
                      <code className="text-xs font-mono bg-gray-100 px-1 py-0.5 rounded">
                        {truncateHash(step.transactionHash)}
                      </code>
                    </div>
                  )}
                  
                  {step.status === 'processing' && (
                    <div className="mt-2">
                      <div className="animate-pulse flex space-x-1">
                        <div className="w-1 h-1 bg-blue-500 rounded-full"></div>
                        <div className="w-1 h-1 bg-blue-500 rounded-full"></div>
                        <div className="w-1 h-1 bg-blue-500 rounded-full"></div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Transaction Details */}
      <Card>
        <CardHeader>
          <CardTitle>Detalhes da Transação</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className="font-medium text-gray-900 mb-3">Endereços</h4>
              <div className="space-y-3 text-sm">
                <div>
                  <span className="text-gray-600">Origem ({transaction.sourceNetwork}):</span>
                  <div className="font-mono bg-gray-50 p-2 rounded mt-1 break-all">
                    {transaction.sourceAddress}
                  </div>
                </div>
                <div>
                  <span className="text-gray-600">Destino ({transaction.destinationNetwork}):</span>
                  <div className="font-mono bg-gray-50 p-2 rounded mt-1 break-all">
                    {transaction.destinationAddress}
                  </div>
                </div>
              </div>
            </div>

            <div>
              <h4 className="font-medium text-gray-900 mb-3">Timestamps</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Criado:</span>
                  <span className="font-medium">{formatTime(transaction.createdAt)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Atualizado:</span>
                  <span className="font-medium">{formatTime(transaction.updatedAt)}</span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex justify-center space-x-4">
        <Link to="/bridge">
          <Button variant="secondary">Nova Transação</Button>
        </Link>
        <Link to="/history">
          <Button variant="secondary">Ver Histórico</Button>
        </Link>
        <Button 
          onClick={() => window.location.reload()}
          variant="ghost"
        >
          Atualizar Status
        </Button>
      </div>
    </div>
  );
};

export default TransactionTracking;