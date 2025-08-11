import { create } from 'zustand';
import { polkadotService } from '../services/polkadot';
import { LusdtTokenService } from '../services/lusdt';
import { TaxManagerService } from '../services/taxManager';
import type { 
  Account, 
  TokenInfo, 
  TaxManagerInfo, 
  AdminPermissions 
} from '../types/contracts';
import { AdminRole } from '../types/contracts';

interface AdminState {
  // === CONNECTION STATE ===
  isConnected: boolean;
  currentAccount: string | null;
  accounts: Account[];
  networkInfo: any;
  isLoading: boolean;
  error: string | null;
  
  // === SERVICES ===
  lusdtService: LusdtTokenService | null;
  taxManagerService: TaxManagerService | null;
  
  // === CONTRACT ADDRESSES ===
  lusdtAddress: string;
  taxManagerAddress: string;
  
  // === CONTRACT DATA ===
  tokenInfo: TokenInfo | null;
  taxManagerInfo: TaxManagerInfo | null;
  
  // === ADMIN PERMISSIONS ===
  adminPermissions: AdminPermissions;
  
  // === CONNECTION ACTIONS ===
  connectWallet: () => Promise<void>;
  disconnectWallet: () => void;
  setCurrentAccount: (account: string) => void;
  
  // === INITIALIZATION ACTIONS ===
  initializeContracts: () => Promise<void>;
  refreshData: () => Promise<void>;
  
  // === DATA ACTIONS ===
  refreshTokenData: () => Promise<void>;
  refreshTaxManagerData: () => Promise<void>;
  
  // === UTILITY ACTIONS ===
  setError: (error: string | null) => void;
  setLoading: (loading: boolean) => void;
}

export const useAdminStore = create<AdminState>((set, get) => ({
  // === INITIAL STATE ===
  isConnected: false,
  currentAccount: null,
  accounts: [],
  networkInfo: null,
  isLoading: false,
  error: null,
  
  lusdtService: null,
  taxManagerService: null,
  
  lusdtAddress: import.meta.env.VITE_LUSDT_ADDRESS || '',
  taxManagerAddress: import.meta.env.VITE_TAX_MANAGER_ADDRESS || '',
  
  tokenInfo: null,
  taxManagerInfo: null,
  
  adminPermissions: {
    role: AdminRole.NONE,
    canMint: false,
    canPause: false,
    canUpdateBridge: false,
    canUpdateTaxManager: false,
    canManageTaxes: false
  },

  // === CONNECTION ACTIONS ===
  connectWallet: async () => {
    set({ isLoading: true, error: null });
    
    try {
      console.log('🔗 Conectando carteira...');
      
      // Conectar à blockchain
      await polkadotService.connect();
      
      // Habilitar carteiras
      const accounts = await polkadotService.enableWallet();
      
      // Obter informações da rede
      const networkInfo = await polkadotService.getNetworkInfo();
      
      set({
        isConnected: true,
        accounts,
        networkInfo,
        currentAccount: accounts[0]?.address || null,
        isLoading: false
      });
      
      console.log('✅ Carteira conectada com sucesso');
      
      // Inicializar contratos se os endereços estiverem disponíveis
      const { lusdtAddress, taxManagerAddress } = get();
      if (lusdtAddress || taxManagerAddress) {
        await get().initializeContracts();
      }
      
    } catch (error) {
      console.error('❌ Erro ao conectar carteira:', error);
      set({ 
        error: error instanceof Error ? error.message : String(error), 
        isLoading: false,
        isConnected: false 
      });
      throw error;
    }
  },

  disconnectWallet: () => {
    console.log('🔌 Desconectando carteira...');
    
    polkadotService.disconnect();
    
    set({
      isConnected: false,
      currentAccount: null,
      accounts: [],
      networkInfo: null,
      lusdtService: null,
      taxManagerService: null,
      tokenInfo: null,
      taxManagerInfo: null,
      adminPermissions: {
        role: AdminRole.NONE,
        canMint: false,
        canPause: false,
        canUpdateBridge: false,
        canUpdateTaxManager: false,
        canManageTaxes: false
      },
      error: null
    });
  },

  setCurrentAccount: (account: string) => {
    set({ currentAccount: account });
    
    // Recalcular permissões administrativas
    const { tokenInfo, taxManagerInfo } = get();
    const permissions = calculateAdminPermissions(account, tokenInfo, taxManagerInfo);
    set({ adminPermissions: permissions });
  },

  // === INITIALIZATION ACTIONS ===
  initializeContracts: async () => {
    const { lusdtAddress, taxManagerAddress } = get();
    set({ isLoading: true, error: null });
    
    try {
      console.log('📋 Inicializando contratos...');
      
      // Inicializar LUSDT Token se endereço disponível
      let lusdtService: LusdtTokenService | null = null;
      if (lusdtAddress) {
        lusdtService = new LusdtTokenService(lusdtAddress);
        await lusdtService.initialize();
        console.log('✅ LUSDT Token inicializado');
      }
      
      // Inicializar Tax Manager se endereço disponível
      let taxManagerService: TaxManagerService | null = null;
      if (taxManagerAddress) {
        taxManagerService = new TaxManagerService(taxManagerAddress);
        await taxManagerService.initialize();
        console.log('✅ Tax Manager inicializado');
      }
      
      set({ 
        lusdtService, 
        taxManagerService,
        isLoading: false 
      });
      
      // Carregar dados dos contratos
      await get().refreshData();
      
    } catch (error) {
      console.error('❌ Erro ao inicializar contratos:', error);
      set({ 
        error: error instanceof Error ? error.message : String(error),
        isLoading: false 
      });
      throw error;
    }
  },

  refreshData: async () => {
    set({ isLoading: true, error: null });
    
    try {
      const { lusdtService, taxManagerService } = get();
      
      // Carregar dados em paralelo
      const promises: Promise<void>[] = [];
      
      if (lusdtService) {
        promises.push(get().refreshTokenData());
      }
      
      if (taxManagerService) {
        promises.push(get().refreshTaxManagerData());
      }
      
      await Promise.all(promises);
      
      set({ isLoading: false });
      
    } catch (error) {
      console.error('❌ Erro ao atualizar dados:', error);
      set({ 
        error: error instanceof Error ? error.message : String(error),
        isLoading: false 
      });
    }
  },

  // === DATA ACTIONS ===
  refreshTokenData: async () => {
    const { lusdtService, currentAccount } = get();
    
    if (!lusdtService) return;
    
    try {
      const tokenInfo = await lusdtService.getTokenInfo();
      set({ tokenInfo });
      
      // Recalcular permissões
      if (currentAccount) {
        const { taxManagerInfo } = get();
        const permissions = calculateAdminPermissions(currentAccount, tokenInfo, taxManagerInfo);
        set({ adminPermissions: permissions });
      }
      
      console.log('✅ Dados do token atualizados');
    } catch (error) {
      console.error('❌ Erro ao atualizar dados do token:', error);
      throw error;
    }
  },

  refreshTaxManagerData: async () => {
    const { taxManagerService, currentAccount } = get();
    
    if (!taxManagerService) return;
    
    try {
      const taxManagerInfo = await taxManagerService.getTaxManagerInfo();
      set({ taxManagerInfo });
      
      // Recalcular permissões
      if (currentAccount) {
        const { tokenInfo } = get();
        const permissions = calculateAdminPermissions(currentAccount, tokenInfo, taxManagerInfo);
        set({ adminPermissions: permissions });
      }
      
      console.log('✅ Dados do tax manager atualizados');
    } catch (error) {
      console.error('❌ Erro ao atualizar dados do tax manager:', error);
      throw error;
    }
  },

  // === UTILITY ACTIONS ===
  setError: (error: string | null) => {
    set({ error });
  },

  setLoading: (loading: boolean) => {
    set({ isLoading: loading });
  }
}));

/**
 * Calcula as permissões administrativas baseadas na conta atual
 */
function calculateAdminPermissions(
  currentAccount: string,
  tokenInfo: TokenInfo | null,
  taxManagerInfo: TaxManagerInfo | null
): AdminPermissions {
  if (!currentAccount) {
    return {
      role: AdminRole.NONE,
      canMint: false,
      canPause: false,
      canUpdateBridge: false,
      canUpdateTaxManager: false,
      canManageTaxes: false
    };
  }

  // Verificar se é owner do token
  if (tokenInfo?.owner === currentAccount) {
    return {
      role: AdminRole.OWNER,
      canMint: false, // Owner não minta, apenas bridge
      canPause: false, // Owner não pausa, apenas emergency admin
      canUpdateBridge: true,
      canUpdateTaxManager: true,
      canManageTaxes: taxManagerInfo?.owner === currentAccount
    };
  }

  // Verificar se é bridge
  if (tokenInfo?.bridgeAccount === currentAccount) {
    return {
      role: AdminRole.BRIDGE,
      canMint: true,
      canPause: false,
      canUpdateBridge: false,
      canUpdateTaxManager: false,
      canManageTaxes: false
    };
  }

  // Verificar se é emergency admin
  if (tokenInfo?.emergencyAdmin === currentAccount) {
    return {
      role: AdminRole.EMERGENCY_ADMIN,
      canMint: false,
      canPause: true,
      canUpdateBridge: false,
      canUpdateTaxManager: false,
      canManageTaxes: false
    };
  }

  // Verificar se é owner do tax manager (mas não do token)
  if (taxManagerInfo?.owner === currentAccount) {
    return {
      role: AdminRole.NONE, // Não tem role no token
      canMint: false,
      canPause: false,
      canUpdateBridge: false,
      canUpdateTaxManager: false,
      canManageTaxes: true
    };
  }

  // Nenhuma permissão especial
  return {
    role: AdminRole.NONE,
    canMint: false,
    canPause: false,
    canUpdateBridge: false,
    canUpdateTaxManager: false,
    canManageTaxes: false
  };
}