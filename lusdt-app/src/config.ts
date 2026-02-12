// Configurações baseadas nos contratos reais
const USE_LOCAL = typeof import.meta !== 'undefined' && import.meta.env?.VITE_USE_LOCAL_NODE === 'true'

export const NETWORKS = {
  solana: {
    name: USE_LOCAL ? 'Solana Devnet' : 'Solana',
    rpcUrl: USE_LOCAL ? 'https://api.devnet.solana.com' : 'https://api.mainnet-beta.solana.com',
    usdtMint: USE_LOCAL
      ? 'Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr'
      : 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
    explorerUrl: USE_LOCAL ? 'https://explorer.solana.com/?cluster=devnet' : 'https://explorer.solana.com',
  },
  lunes: {
    name: USE_LOCAL ? 'Lunes Local Testnet' : 'Lunes Network',
    rpcUrl: (typeof import.meta !== 'undefined' && import.meta.env?.VITE_LUNES_RPC_URL)
      || (USE_LOCAL ? 'ws://localhost:9944' : 'wss://ws.lunes.io'),
    httpRpcUrl: (typeof import.meta !== 'undefined' && import.meta.env?.VITE_LUNES_HTTP_RPC_URL)
      || (USE_LOCAL ? 'http://localhost:9933' : 'https://rpc.lunes.io'),
    lusdtContract: USE_LOCAL
      ? ((typeof import.meta !== 'undefined' && import.meta.env?.VITE_LOCAL_LUSDT_ADDRESS) || '5FF6tj1Y5TvpcSDfmTaBMw9bHLRaxx3yrVxCS9eGHL8dBxAm')
      : '5Gbyik8Ciu86LN8cL7s4S4AS7jEi8LhpvcuZ1KZHVq1Gsiry',
    taxManagerContract: USE_LOCAL
      ? ((typeof import.meta !== 'undefined' && import.meta.env?.VITE_LOCAL_TAX_MANAGER_ADDRESS) || '5EcMre9JQqicWazCQ1EqxxQ4NGfnAXysW42Tae7RVhv7AfmE')
      : '5Gbyik8Ciu86LN8cL7s4S4AS7jEi8LhpvcuZ1KZHVq1Gsiry',
    explorerUrl: 'https://explorer.lunes.io',
  }
}

// Configurações do bridge baseadas no Tax Manager
export const BRIDGE_CONFIG = {
  // Taxas em basis points (do contrato)
  baseFee: 50, // 0.5%
  lowVolumeFee: 60, // 0.6%
  mediumVolumeFee: 50, // 0.5%
  highVolumeFee: 30, // 0.3%
  
  // Limites (baseados no contrato)
  minAmount: 1, // Mínimo 1 USDT/LUSDT
  maxAmount: 1000000, // Máximo 1M USDT/LUSDT
  
  // Tetos de taxa em LUNES (do contrato)
  feeCaps: {
    small: 0.5, // ≤ $100: Max 0.5 LUNES
    medium: 2, // $100-$1K: Max 2 LUNES
    large: 10, // $1K-$10K: Max 10 LUNES
    veryLarge: 50, // > $10K: Max 50 LUNES
  },
  
  // Distribuição de taxas (v3 - dual-fee + staking rewards)
  // Taxas cobradas na moeda da transação: USDT (mint) ou LUSDT (burn)
  feeDistribution: {
    dev: 80,               // 80% -> carteira dev (por rede: dev_solana ou dev_lunes)
    insuranceFund: 15,     // 15% -> fundo de seguro (fixo, não editável)
    stakingRewards: 5,     // 5%  -> pool de staking rewards (distribuição mensal, ≥100k LUNES)
  }
}