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

