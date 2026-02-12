#!/usr/bin/env node
/**
 * LUSDT Contract Deployment Script
 * Lê seed do .env e faz deploy na rede Lunes
 */

const { ApiPromise, WsProvider, Keyring } = require('@polkadot/api');
const { ContractPromise } = require('@polkadot/api-contract');
const { CodePromise } = require('@polkadot/api-contract');
const fs = require('fs');
const path = require('path');

// Carregar .env manualmente
const envPath = path.join(__dirname, '../../bridge-service/.env');
const envContent = fs.readFileSync(envPath, 'utf8');
const envVars = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) {
    envVars[match[1].trim()] = match[2].trim().replace(/^["']|["']$/g, '');
  }
});

const LUNES_WALLET_SEED = envVars.LUNES_WALLET_SEED;
if (!LUNES_WALLET_SEED) {
  console.error('❌ LUNES_WALLET_SEED não encontrada no .env');
  process.exit(1);
}

// RPCs para tentar
const RPC_ENDPOINTS = [
  'wss://ws.lunes.io',
  'wss://ws-lunes-main-02.lunes.io',
  'wss://ws-lunes-main-01.lunes.io',
  'wss://ws-archive.lunes.io'
];

// Caminho do contrato
const CONTRACT_PATH = path.join(__dirname, '../../target/ink/lusdt_token/lusdt_token.contract');

async function tryConnect(url) {
  console.log(`🔗 Tentando conectar a ${url}...`);
  const provider = new WsProvider(url, 1000, {}, 10000);
  
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      provider.disconnect();
      reject(new Error('Timeout'));
    }, 15000);

    provider.on('connected', async () => {
      clearTimeout(timeout);
      try {
        const api = await ApiPromise.create({ provider });
        await api.isReady;
        console.log(`✅ Conectado a ${url}`);
        resolve({ api, provider });
      } catch (err) {
        provider.disconnect();
        reject(err);
      }
    });

    provider.on('error', (err) => {
      clearTimeout(timeout);
      provider.disconnect();
      reject(err);
    });
  });
}

async function main() {
  console.log('🚀 LUSDT Contract Deployment\n');

  // Verificar arquivo do contrato
  if (!fs.existsSync(CONTRACT_PATH)) {
    console.error(`❌ Contrato não encontrado: ${CONTRACT_PATH}`);
    console.error('Execute: cd contracts/lusdt_token && cargo contract build --release');
    process.exit(1);
  }
  console.log('✅ Contrato encontrado');

  // Carregar contrato
  const contractJson = JSON.parse(fs.readFileSync(CONTRACT_PATH, 'utf8'));
  console.log('✅ Contrato carregado');

  // Tentar conectar a cada RPC
  let api, provider;
  for (const url of RPC_ENDPOINTS) {
    try {
      const result = await tryConnect(url);
      api = result.api;
      provider = result.provider;
      break;
    } catch (err) {
      console.log(`❌ Falha em ${url}: ${err.message}`);
    }
  }

  if (!api) {
    console.error('\n❌ Não foi possível conectar a nenhum RPC da Lunes');
    console.error('Verifique se a rede Lunes está online.');
    process.exit(1);
  }

  // Info da rede
  const chain = await api.rpc.system.chain();
  const version = await api.rpc.system.version();
  console.log(`\n📡 Rede: ${chain} (${version})`);

  // Verificar se tem pallet de contratos
  const hasContracts = api.tx.contracts !== undefined;
  if (!hasContracts) {
    console.error('\n❌ A rede Lunes NÃO tem o pallet de contratos (pallet-contracts)');
    console.error('Contratos ink! não são suportados nesta rede.');
    await api.disconnect();
    process.exit(1);
  }
  console.log('✅ Pallet de contratos disponível');

  // Criar keyring e conta
  const keyring = new Keyring({ type: 'sr25519' });
  const account = keyring.addFromMnemonic(LUNES_WALLET_SEED);
  console.log(`\n🔑 Wallet: ${account.address}`);

  // Verificar saldo
  const { data: balance } = await api.query.system.account(account.address);
  const free = balance.free.toBigInt();
  console.log(`💰 Saldo: ${Number(free) / 1e12} LUNES`);

  if (free === 0n) {
    console.error('\n❌ Saldo insuficiente para deploy');
    await api.disconnect();
    process.exit(1);
  }

  // Deploy do contrato
  console.log('\n📦 Preparando deploy...');
  
  const code = new CodePromise(api, contractJson, contractJson.source.wasm);
  
  // Parâmetros do construtor (usar mesma wallet para todos)
  const taxManager = account.address;
  const bridgeAccount = account.address;
  const emergencyAdmin = account.address;

  console.log('Parâmetros:');
  console.log(`  tax_manager: ${taxManager}`);
  console.log(`  bridge_account: ${bridgeAccount}`);
  console.log(`  emergency_admin: ${emergencyAdmin}`);

  // Estimar gas
  const gasLimit = api.registry.createType('WeightV2', {
    refTime: 500_000_000_000,
    proofSize: 500_000
  });

  console.log('\n🚀 Fazendo deploy...');
  
  try {
    const tx = code.tx.new({ gasLimit, storageDepositLimit: null }, taxManager, bridgeAccount, emergencyAdmin);
    
    const unsub = await tx.signAndSend(account, ({ contract, status, events }) => {
      if (status.isInBlock) {
        console.log(`\n✅ Transação incluída no bloco: ${status.asInBlock.toHex()}`);
      }
      
      if (status.isFinalized) {
        console.log(`✅ Transação finalizada: ${status.asFinalized.toHex()}`);
        
        if (contract) {
          console.log(`\n🎉 CONTRATO DEPLOYADO!`);
          console.log(`📋 Endereço: ${contract.address.toString()}`);
          console.log(`\n⚠️  Configure no .env do bridge-service:`);
          console.log(`LUSDT_CONTRACT_ADDRESS=${contract.address.toString()}`);
        }
        
        unsub();
        api.disconnect();
        process.exit(0);
      }
    });
  } catch (err) {
    console.error(`\n❌ Erro no deploy: ${err.message}`);
    await api.disconnect();
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Erro:', err);
  process.exit(1);
});
