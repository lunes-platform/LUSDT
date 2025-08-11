import { useEffect, useState } from 'react';
import { useAdminStore } from './store/adminStore';
import Header from './components/layout/Header';
import Navigation, { type NavigationTab } from './components/layout/Navigation';
import AdminDashboard from './components/admin/AdminDashboard';
import TokenManagement from './components/admin/TokenManagement';
import TaxOverview from './components/admin/TaxOverview';
import TransactionMonitoring from './components/admin/TransactionMonitoring';
import SystemConfiguration from './components/admin/SystemConfiguration';
import Loading from './components/common/Loading';
import ErrorAlert from './components/common/ErrorAlert';
import './App.css';

function App() {
  const { 
    isConnected, 
    initializeContracts, 
    lusdtAddress, 
    taxManagerAddress,
    error,
    isLoading 
  } = useAdminStore();

  const [activeTab, setActiveTab] = useState<NavigationTab>('dashboard');

  // Inicializar contratos quando conectado
  useEffect(() => {
    if (isConnected && (lusdtAddress || taxManagerAddress)) {
      initializeContracts().catch(console.error);
    }
  }, [isConnected, lusdtAddress, taxManagerAddress, initializeContracts]);

  // Renderizar conteúdo baseado na aba ativa
  const renderContent = () => {
    if (!isConnected) {
      return (
        <div className="bg-white shadow rounded-lg p-8 text-center">
          <div className="text-blue-400 text-6xl mb-4">🔗</div>
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">
            Conecte sua Carteira
          </h2>
          <p className="text-gray-600 mb-6">
            Para começar a gerenciar o sistema LUSDT, conecte sua carteira Polkadot.js
          </p>
          <div className="bg-blue-50 rounded-lg p-4 text-sm text-blue-700">
            <p className="font-medium mb-2">Requisitos:</p>
            <ul className="text-left list-disc list-inside space-y-1">
              <li>Extensão Polkadot.js instalada</li>
              <li>Conta com permissões administrativas</li>
              <li>Conexão com a rede correta</li>
            </ul>
          </div>
        </div>
      );
    }

    if (isLoading) {
      return (
        <div className="bg-white shadow rounded-lg p-8 text-center">
          <Loading size="lg" text="Inicializando contratos..." />
        </div>
      );
    }

    switch (activeTab) {
      case 'dashboard':
        return <AdminDashboard />;
      case 'token-management':
        return <TokenManagement />;
      case 'tax-overview':
        return <TaxOverview />;
      case 'transaction-monitoring':
        return <TransactionMonitoring />;
      case 'system-config':
        return <SystemConfiguration />;
      default:
        return <AdminDashboard />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      
      <div className="flex h-screen pt-16"> {/* pt-16 para compensar o header fixo */}
        {/* Navigation Sidebar */}
        {isConnected && (
          <Navigation activeTab={activeTab} onTabChange={setActiveTab} />
        )}
        
        {/* Main Content */}
        <div className="flex-1 overflow-auto">
          <main className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
            {/* Aviso sobre configuração */}
            {!lusdtAddress && !taxManagerAddress && (
              <div className="mb-6">
                <ErrorAlert
                  title="Configuração Necessária"
                  message="Configure os endereços dos contratos nas variáveis de ambiente VITE_LUSDT_ADDRESS e VITE_TAX_MANAGER_ADDRESS para usar o painel administrativo."
                  variant="warning"
                  persistent
                />
              </div>
            )}

            {/* Título principal - apenas quando não conectado */}
            {!isConnected && (
              <div className="mb-8">
                <h1 className="text-3xl font-bold text-gray-900">
                  🎮 Painel Administrativo LUSDT
                </h1>
                <p className="mt-2 text-gray-600">
                  Gerencie tokens LUSDT, taxas e configurações do sistema
                </p>
              </div>
            )}

            {/* Conteúdo principal */}
            {renderContent()}

            {/* Error global */}
            {error && (
              <div className="mt-6">
                <ErrorAlert
                  title="Erro do Sistema"
                  message={error}
                  variant="error"
                />
              </div>
            )}
          </main>

          {/* Footer */}
          <footer className="bg-white border-t border-gray-200 mt-12">
            <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
              <div className="flex justify-between items-center">
                <p className="text-sm text-gray-500">
                  LUSDT Admin Panel v1.0.0
                </p>
                <div className="flex space-x-4 text-sm text-gray-500">
                  <span>🏦 LUSDT Token Management</span>
                  <span>🌉 Bridge Controls</span>
                  <span>💰 Tax Management</span>
                </div>
              </div>
            </div>
          </footer>
        </div>
      </div>
    </div>
  );
}

export default App;