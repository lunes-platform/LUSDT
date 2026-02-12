#!/usr/bin/env node
/**
 * LUSDT Local Deploy via polkadot-js
 * Deploys Tax Manager + LUSDT Token to ws://localhost:9944
 * Uses //Alice dev account
 */

import { ApiPromise, WsProvider, Keyring } from '@polkadot/api';
import { CodePromise, ContractPromise } from '@polkadot/api-contract';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');
const INK_DIR = path.join(ROOT, 'target/ink');

const RPC = process.env.RPC_ENDPOINT || 'ws://localhost:9944';

// Dev accounts (Substrate well-known)
const ALICE = '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY';
const BOB = '5FHneW46xGXgs5mUiveU4sbTyGBzmstUspZC92UhjJM694ty';
const CHARLIE = '5FLSigC9HGRKVhB9FiEo4Y3koPsNmBmLJbpXg2mp1hXcS59Y';

async function main() {
  console.log('🚀 LUSDT Local Deploy via polkadot-js');
  console.log(`📡 RPC: ${RPC}\n`);

  // Connect
  const provider = new WsProvider(RPC);
  const api = await ApiPromise.create({ provider });
  console.log(`✅ Connected to ${(await api.rpc.system.chain()).toString()}`);

  // Keyring
  const keyring = new Keyring({ type: 'sr25519' });
  const alice = keyring.addFromUri('//Alice');
  console.log(`👤 Deployer: ${alice.address}\n`);

  // Load contract artifacts
  const taxManagerContract = JSON.parse(
    fs.readFileSync(path.join(INK_DIR, 'tax_manager/tax_manager.contract'), 'utf8')
  );
  const lusdtContract = JSON.parse(
    fs.readFileSync(path.join(INK_DIR, 'lusdt_token/lusdt_token.contract'), 'utf8')
  );

  // === DEPLOY TAX MANAGER ===
  console.log('📦 Deploying Tax Manager...');
  const taxCode = new CodePromise(api, taxManagerContract, taxManagerContract.source.wasm);

  // Constructor args: lunes_token, lusdt_token, distribution_wallets, initial_price
  const DAVE = keyring.addFromUri('//Dave').address;
  const distributionWallets = {
    dev_solana: ALICE,      // Dev Solana wallet (configurable)
    dev_lunes: BOB,         // Dev Lunes wallet (configurable)
    insurance_fund: CHARLIE, // Insurance fund (15%, FIXED)
    staking_rewards_pool: DAVE // Staking rewards (5%, monthly distribution to stakers ≥100k LUNES)
  };

  const taxGasLimit = api.registry.createType('WeightV2', {
    refTime: 100_000_000_000,
    proofSize: 1_000_000,
  });

  const taxManagerAddress = await new Promise((resolve, reject) => {
    let contractAddress = null;
    taxCode.tx.new(
      { gasLimit: taxGasLimit, storageDepositLimit: null },
      ALICE,    // lunes_token_address
      ALICE,    // lusdt_token_address
      distributionWallets,
      500_000   // initial_lunes_price (0.50 USD with 6 decimals)
    )
      .signAndSend(alice, ({ contract, status, dispatchError }) => {
        if (status.isInBlock || status.isFinalized) {
          if (dispatchError) {
            if (dispatchError.isModule) {
              const decoded = api.registry.findMetaError(dispatchError.asModule);
              reject(new Error(`${decoded.section}.${decoded.name}: ${decoded.docs.join(' ')}`));
            } else {
              reject(new Error(dispatchError.toString()));
            }
          } else if (contract) {
            contractAddress = contract.address.toString();
            console.log(`✅ Tax Manager deployed at: ${contractAddress}`);
            resolve(contractAddress);
          }
        }
      })
      .catch(reject);
  });

  // === DEPLOY LUSDT TOKEN ===
  console.log('\n📦 Deploying LUSDT Token...');
  const lusdtCode = new CodePromise(api, lusdtContract, lusdtContract.source.wasm);

  const lusdtAddress = await new Promise((resolve, reject) => {
    lusdtCode.tx.new(
      { gasLimit: taxGasLimit, storageDepositLimit: null },
      taxManagerAddress, // tax_manager address
      ALICE,             // bridge_account (//Alice for testing)
      CHARLIE            // emergency_admin
    )
      .signAndSend(alice, ({ contract, status, dispatchError }) => {
        if (status.isInBlock || status.isFinalized) {
          if (dispatchError) {
            if (dispatchError.isModule) {
              const decoded = api.registry.findMetaError(dispatchError.asModule);
              reject(new Error(`${decoded.section}.${decoded.name}: ${decoded.docs.join(' ')}`));
            } else {
              reject(new Error(dispatchError.toString()));
            }
          } else if (contract) {
            const addr = contract.address.toString();
            console.log(`✅ LUSDT Token deployed at: ${addr}`);
            resolve(addr);
          }
        }
      })
      .catch(reject);
  });

  // === VERIFY CONTRACTS ===
  console.log('\n🔍 Verifying contracts...');
  
  const taxContract = new ContractPromise(api, taxManagerContract, taxManagerAddress);
  
  // Check Tax Manager owner
  const { result: ownerResult, output: ownerOutput } = await taxContract.query.getOwner(
    alice.address,
    { gasLimit: taxGasLimit }
  );
  if (ownerResult.isOk) {
    console.log(`  Tax Manager owner: ${ownerOutput?.toHuman()}`);
  }

  // Check LUNES price
  const { result: priceResult, output: priceOutput } = await taxContract.query.getLunesPrice(
    alice.address,
    { gasLimit: taxGasLimit }
  );
  if (priceResult.isOk) {
    console.log(`  LUNES price: ${priceOutput?.toHuman()}`);
  }

  // Check dev wallets
  const { result: devResult, output: devOutput } = await taxContract.query.getDevWallets(
    alice.address,
    { gasLimit: taxGasLimit }
  );
  if (devResult.isOk) {
    console.log(`  Dev wallets: ${devOutput?.toHuman()}`);
  }

  // === SAVE DEPLOYMENT INFO ===
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const deployDir = path.join(ROOT, 'contracts/deployments', `local_${timestamp}`);
  fs.mkdirSync(deployDir, { recursive: true });

  const deploymentInfo = {
    network: 'local',
    timestamp,
    rpc_endpoint: RPC,
    contracts: {
      tax_manager: taxManagerAddress,
      lusdt_token: lusdtAddress,
    },
    wallets: {
      dev_solana: ALICE,
      dev_lunes: BOB,
      insurance_fund: CHARLIE,
    },
    accounts: {
      owner: `${ALICE} (//Alice)`,
      bridge: `${ALICE} (//Alice)`,
      emergency_admin: `${CHARLIE} (//Charlie)`,
    },
  };

  fs.writeFileSync(
    path.join(deployDir, 'deployment_addresses.json'),
    JSON.stringify(deploymentInfo, null, 2)
  );

  console.log(`\n🎉 Deployment complete!`);
  console.log(`  Tax Manager: ${taxManagerAddress}`);
  console.log(`  LUSDT Token: ${lusdtAddress}`);
  console.log(`  Saved to: ${deployDir}`);
  console.log(`\n📋 Add to bridge-service/.env:`);
  console.log(`  TAX_MANAGER_CONTRACT_ADDRESS=${taxManagerAddress}`);
  console.log(`  LUSDT_CONTRACT_ADDRESS=${lusdtAddress}`);
  console.log(`  LUNES_RPC_URL=${RPC}`);

  await api.disconnect();
  process.exit(0);
}

main().catch((err) => {
  console.error('❌ Deploy failed:', err.message || err);
  process.exit(1);
});
