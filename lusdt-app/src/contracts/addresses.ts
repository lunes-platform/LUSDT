// Detecta se deve usar nó local ou mainnet
const USE_LOCAL_NODE = import.meta.env.VITE_USE_LOCAL_NODE === 'true'

// Endereços dos contratos
export const CONTRACT_ADDRESSES = {
  // Lunes Network
  lunes: {
    lusdtToken: USE_LOCAL_NODE
      ? (import.meta.env.VITE_LOCAL_LUSDT_ADDRESS || '5FF6tj1Y5TvpcSDfmTaBMw9bHLRaxx3yrVxCS9eGHL8dBxAm')
      : '5Gbyik8Ciu86LN8cL7s4S4AS7jEi8LhpvcuZ1KZHVq1Gsiry',
    taxManager: USE_LOCAL_NODE
      ? (import.meta.env.VITE_LOCAL_TAX_MANAGER_ADDRESS || '5EcMre9JQqicWazCQ1EqxxQ4NGfnAXysW42Tae7RVhv7AfmE')
      : '5Gbyik8Ciu86LN8cL7s4S4AS7jEi8LhpvcuZ1KZHVq1Gsiry',
    lunesToken: '5Gbyik8Ciu86LN8cL7s4S4AS7jEi8LhpvcuZ1KZHVq1Gsiry',
    stakingManager: USE_LOCAL_NODE
      ? (import.meta.env.VITE_LOCAL_STAKING_MANAGER_ADDRESS || '')
      : '',  // Set after mainnet deployment
  },

  // Solana Network
  solana: {
    // Mainnet: USDT oficial | Devnet: USDT de testes na devnet Solana
    usdtMint: USE_LOCAL_NODE
      ? 'Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr'  // Devnet USDT
      : 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // Mainnet USDT
    bridgeAddress: import.meta.env.VITE_SOLANA_BRIDGE_ADDRESS || '6zZ9bP5kkSMyjvnnBzG75sYsmAwU9fat8YmXccMfVruj',
    bridgeProgram: 'BridgeProgramIdHere', // Não necessário: bridge é off-chain
  }
};

// RPCs das redes — usa env vars quando disponíveis
export const NETWORK_CONFIG = {
  lunes: {
    name: USE_LOCAL_NODE ? 'Lunes Local Testnet' : 'Lunes Network',
    rpcUrl: import.meta.env.VITE_LUNES_RPC_URL
      || (USE_LOCAL_NODE ? 'ws://localhost:9944' : 'wss://ws.lunes.io'),
    httpRpcUrl: import.meta.env.VITE_LUNES_HTTP_RPC_URL
      || (USE_LOCAL_NODE ? 'http://localhost:9933' : 'https://rpc.lunes.io'),
    explorerUrl: 'https://explorer.lunes.io',
  },
  solana: {
    name: USE_LOCAL_NODE ? 'Solana Devnet' : 'Solana Mainnet',
    rpcUrl: USE_LOCAL_NODE
      ? 'https://api.devnet.solana.com'
      : 'https://api.mainnet-beta.solana.com',
    explorerUrl: USE_LOCAL_NODE
      ? 'https://explorer.solana.com/?cluster=devnet'
      : 'https://explorer.solana.com',
  }
};

// Log de diagnóstico
if (typeof window !== 'undefined') {
  console.log(`🌐 Network mode: ${USE_LOCAL_NODE ? 'LOCAL TESTNET' : 'MAINNET'}`)
  console.log(`🔗 Lunes WS RPC: ${NETWORK_CONFIG.lunes.rpcUrl}`)
  console.log(`🔗 Lunes HTTP RPC: ${NETWORK_CONFIG.lunes.httpRpcUrl}`)
  console.log(`🔗 Solana RPC: ${NETWORK_CONFIG.solana.rpcUrl}`)
  console.log(`📄 LUSDT Contract: ${CONTRACT_ADDRESSES.lunes.lusdtToken}`)
  console.log(`📄 Tax Manager: ${CONTRACT_ADDRESSES.lunes.taxManager}`)
  console.log(`📄 Staking Manager: ${CONTRACT_ADDRESSES.lunes.stakingManager || 'NOT SET'}`)
}