#!/usr/bin/env node
const { ApiPromise, WsProvider, Keyring } = require('@polkadot/api');
const { CodePromise } = require('@polkadot/api-contract');
const fs = require('fs');
const path = require('path');

// Carregar .env
const envPath = path.join(__dirname, '../.env');
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
  console.error('LUNES_WALLET_SEED nao encontrada no .env');
  process.exit(1);
}

const RPC_ENDPOINTS = [
  'wss://ws.lunes.io',
  'wss://ws-lunes-main-02.lunes.io',
  'wss://ws-lunes-main-01.lunes.io'
];

const CONTRACT_PATH = path.join(__dirname, '../../target/ink/lusdt_token/lusdt_token.contract');

async function tryConnect(url) {
  console.log('Tentando ' + url);
  const provider = new WsProvider(url, 1000, {}, 15000);
  
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      provider.disconnect();
      reject(new Error('Timeout'));
    }, 20000);

    provider.on('connected', async () => {
      clearTimeout(timeout);
      try {
        const api = await ApiPromise.create({ provider });
        await api.isReady;
        console.log('Conectado a ' + url);
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
  console.log('LUSDT Contract Deployment\n');

  if (!fs.existsSync(CONTRACT_PATH)) {
    console.error('Contrato nao encontrado: ' + CONTRACT_PATH);
    process.exit(1);
  }
  console.log('Contrato encontrado');

  const contractJson = JSON.parse(fs.readFileSync(CONTRACT_PATH, 'utf8'));

  let api;
  for (const url of RPC_ENDPOINTS) {
    try {
      const result = await tryConnect(url);
      api = result.api;
      break;
    } catch (err) {
      console.log('Falha em ' + url + ': ' + err.message);
    }
  }

  if (!api) {
    console.error('Nao foi possivel conectar a nenhum RPC');
    process.exit(1);
  }

  const chain = await api.rpc.system.chain();
  console.log('Rede: ' + chain);

  const hasContracts = api.tx.contracts !== undefined;
  if (!hasContracts) {
    console.error('Rede NAO tem pallet de contratos');
    await api.disconnect();
    process.exit(1);
  }
  console.log('Pallet de contratos disponivel');

  const keyring = new Keyring({ type: 'sr25519' });
  const account = keyring.addFromMnemonic(LUNES_WALLET_SEED);
  console.log('Wallet: ' + account.address);

  const { data: balance } = await api.query.system.account(account.address);
  console.log('Saldo: ' + (Number(balance.free) / 1e12) + ' LUNES');

  if (balance.free.toBigInt() === 0n) {
    console.error('Saldo insuficiente');
    await api.disconnect();
    process.exit(1);
  }

  console.log('\nPreparando deploy...');
  const code = new CodePromise(api, contractJson, contractJson.source.wasm);
  
  const taxManager = account.address;
  const bridgeAccount = account.address;
  const emergencyAdmin = account.address;

  const gasLimit = api.registry.createType('WeightV2', {
    refTime: 500000000000,
    proofSize: 500000
  });

  console.log('Fazendo deploy...');
  
  const tx = code.tx.new({ gasLimit, storageDepositLimit: null }, taxManager, bridgeAccount, emergencyAdmin);
  
  await new Promise((resolve, reject) => {
    tx.signAndSend(account, ({ contract, status }) => {
      if (status.isInBlock) {
        console.log('Tx no bloco: ' + status.asInBlock.toHex());
      }
      if (status.isFinalized) {
        console.log('Tx finalizada');
        if (contract) {
          console.log('\nCONTRATO DEPLOYADO!');
          console.log('Endereco: ' + contract.address.toString());
          console.log('\nConfigure no .env:');
          console.log('LUSDT_CONTRACT_ADDRESS=' + contract.address.toString());
        }
        api.disconnect();
        resolve();
      }
    }).catch(reject);
  });
}

main().catch(err => {
  console.error('Erro:', err.message);
  process.exit(1);
});
