#!/usr/bin/env node
/**
 * Redeploy LUSDT contracts to local node
 * Usage: node scripts/redeploy_local.mjs
 */
import { ApiPromise, WsProvider, Keyring } from '@polkadot/api';
import { CodePromise } from '@polkadot/api-contract';
import { readFileSync } from 'fs';

const RPC = 'ws://localhost:9944';

// Dev accounts
const ALICE = '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY';
const BOB = '5FHneW46xGXgs5mUiveU4sbTyGBzmstUspZC92UhjJM694ty';
const CHARLIE = '5FLSigC9HGRKVhB9FiEo4Y3koPsNmBmLJbpXg2mp1hXcS59Y';

async function deploy(api, signer, contractJson, constructorName, args) {
  const code = new CodePromise(api, contractJson, contractJson.source.wasm);
  const gasLimit = api.registry.createType('WeightV2', {
    refTime: 50_000_000_000n,
    proofSize: 5_000_000n,
  });
  const storageDepositLimit = null;

  return new Promise((resolve, reject) => {
    const tx = code.tx[constructorName]({ gasLimit, storageDepositLimit }, ...args);
    tx.signAndSend(signer, ({ status, contract, dispatchError }) => {
      if (dispatchError) {
        if (dispatchError.isModule) {
          const decoded = api.registry.findMetaError(dispatchError.asModule);
          reject(new Error(`${decoded.section}.${decoded.name}: ${decoded.docs.join(' ')}`));
        } else {
          reject(new Error(dispatchError.toString()));
        }
        return;
      }
      if (status.isInBlock || status.isFinalized) {
        if (contract) {
          resolve(contract.address.toString());
        }
      }
    }).catch(reject);
  });
}

async function main() {
  console.log('🔗 Connecting to', RPC);
  const provider = new WsProvider(RPC);
  const api = await ApiPromise.create({ provider });
  await api.isReady;
  console.log('✅ Connected. Chain:', (await api.rpc.system.chain()).toString());

  const keyring = new Keyring({ type: 'sr25519' });
  const alice = keyring.addFromUri('//Alice');
  console.log('👤 Deployer:', alice.address);

  // Load contract artifacts
  const taxManagerJson = JSON.parse(readFileSync('target/ink/tax_manager/tax_manager.contract', 'utf8'));
  const lusdtTokenJson = JSON.parse(readFileSync('target/ink/lusdt_token/lusdt_token.contract', 'utf8'));

  // 1. Deploy Tax Manager
  console.log('\n📦 Deploying Tax Manager...');
  const distributionWallets = {
    dev_solana: ALICE,
    dev_lunes: BOB,
    insurance_fund: CHARLIE,
  };
  const initialLunesPrice = 500_000; // 0.50 USD (6 decimals)

  const taxManagerAddress = await deploy(api, alice, taxManagerJson, 'new', [
    ALICE,           // lunes_token_address (placeholder)
    ALICE,           // lusdt_token_address (placeholder, will be updated)
    distributionWallets,
    initialLunesPrice,
  ]);
  console.log('✅ Tax Manager deployed at:', taxManagerAddress);

  // 2. Deploy LUSDT Token with Tax Manager address
  console.log('\n📦 Deploying LUSDT Token...');
  const lusdtAddress = await deploy(api, alice, lusdtTokenJson, 'new', [
    taxManagerAddress,  // tax_manager_contract
  ]);
  console.log('✅ LUSDT Token deployed at:', lusdtAddress);

  // 3. Summary
  console.log('\n' + '='.repeat(60));
  console.log('🎉 DEPLOYMENT COMPLETE');
  console.log('='.repeat(60));
  console.log(`TAX_MANAGER_ADDRESS=${taxManagerAddress}`);
  console.log(`LUSDT_TOKEN_ADDRESS=${lusdtAddress}`);
  console.log('='.repeat(60));
  console.log('\nUpdate your lusdt-app/.env:');
  console.log(`VITE_LOCAL_LUSDT_ADDRESS=${lusdtAddress}`);
  console.log(`VITE_LOCAL_TAX_MANAGER_ADDRESS=${taxManagerAddress}`);

  await api.disconnect();
  process.exit(0);
}

main().catch((err) => {
  console.error('❌ Deploy failed:', err.message || err);
  process.exit(1);
});
