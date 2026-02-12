#!/usr/bin/env node
/**
 * LUSDT Local Testnet Deployment Script
 * Deploys TaxManager + LUSDTToken to ws://localhost:9944 using //Alice dev account
 */

const { ApiPromise, WsProvider, Keyring } = require('@polkadot/api');
const { CodePromise } = require('@polkadot/api-contract');
const fs = require('fs');
const path = require('path');

const RPC = 'ws://localhost:9944';
const TARGET_DIR = path.join(__dirname, '../../target/ink');
const TAX_CONTRACT_PATH = path.join(TARGET_DIR, 'tax_manager/tax_manager.contract');
const LUSDT_CONTRACT_PATH = path.join(TARGET_DIR, 'lusdt_token/lusdt_token.contract');

async function deployContract(api, account, contractJson, constructorName, args, label) {
    console.log(`\n📦 Deploying ${label}...`);

    const code = new CodePromise(api, contractJson, contractJson.source.wasm);

    const gasLimit = api.registry.createType('WeightV2', {
        refTime: 500_000_000_000n,
        proofSize: 500_000n
    });

    return new Promise((resolve, reject) => {
        const tx = code.tx[constructorName]({ gasLimit, storageDepositLimit: null }, ...args);

        tx.signAndSend(account, ({ contract, status, events, dispatchError }) => {
            if (dispatchError) {
                if (dispatchError.isModule) {
                    const decoded = api.registry.findMetaError(dispatchError.asModule);
                    reject(new Error(`${decoded.section}.${decoded.method}: ${decoded.docs.join(' ')}`));
                } else {
                    reject(new Error(dispatchError.toString()));
                }
                return;
            }

            if (status.isFinalized) {
                if (contract) {
                    const addr = contract.address.toString();
                    console.log(`✅ ${label} deployed at: ${addr}`);
                    console.log(`   Block: ${status.asFinalized.toHex()}`);
                    resolve(addr);
                } else {
                    // Try to find ContractInstantiated event
                    const instantiated = events?.find(e =>
                        e.event.section === 'contracts' && e.event.method === 'Instantiated'
                    );
                    if (instantiated) {
                        const addr = instantiated.event.data[1]?.toString();
                        console.log(`✅ ${label} deployed at: ${addr}`);
                        resolve(addr);
                    } else {
                        reject(new Error('Contract not found in events'));
                    }
                }
            }
        }).catch(reject);
    });
}

async function main() {
    console.log('🚀 LUSDT Local Testnet Deployment');
    console.log(`📡 RPC: ${RPC}\n`);

    // Check contract files
    if (!fs.existsSync(TAX_CONTRACT_PATH)) {
        console.error(`❌ Tax Manager contract not found: ${TAX_CONTRACT_PATH}`);
        console.error('Run: cd contracts/tax_manager && cargo contract build --release');
        process.exit(1);
    }
    if (!fs.existsSync(LUSDT_CONTRACT_PATH)) {
        console.error(`❌ LUSDT Token contract not found: ${LUSDT_CONTRACT_PATH}`);
        console.error('Run: cd contracts/lusdt_token && cargo contract build --release');
        process.exit(1);
    }

    // Load contracts
    const taxJson = JSON.parse(fs.readFileSync(TAX_CONTRACT_PATH, 'utf8'));
    const lusdtJson = JSON.parse(fs.readFileSync(LUSDT_CONTRACT_PATH, 'utf8'));
    console.log('✅ Contract files loaded');

    // Connect
    const provider = new WsProvider(RPC);
    const api = await ApiPromise.create({ provider });
    await api.isReady;

    const chain = await api.rpc.system.chain();
    console.log(`✅ Connected to: ${chain}`);

    // Setup keyring with dev accounts
    const keyring = new Keyring({ type: 'sr25519' });
    const alice = keyring.addFromUri('//Alice');
    const charlie = keyring.addFromUri('//Charlie');

    console.log(`🔑 Alice (owner/bridge): ${alice.address}`);
    console.log(`🔑 Charlie (emergency):  ${charlie.address}`);

    // Check balance
    const { data: balance } = await api.query.system.account(alice.address);
    console.log(`💰 Alice balance: ${Number(balance.free.toBigInt()) / 1e12} LUNES`);

    // === Step 1: Deploy Tax Manager ===
    // Constructor: new(lunes_token_address, lusdt_token_address, distribution_wallets, initial_lunes_price)
    // For initial deploy, we pass Alice's address as token addresses (will update later)
    const distributionWallets = {
        dev: alice.address,
        dao: keyring.addFromUri('//Bob').address,
        backing_fund: charlie.address,
        rewards_fund: keyring.addFromUri('//Dave').address,
        burn_address: keyring.addFromUri('//Eve').address
    };

    let taxManagerAddress;
    try {
        taxManagerAddress = await deployContract(
            api, alice, taxJson, 'new',
            [
                alice.address,            // lunes_token_address
                alice.address,            // lusdt_token_address (placeholder, will update)
                distributionWallets,      // distribution_wallets
                1_000_000_000_000        // initial_lunes_price (1 LUNES = 1e12 planck units)
            ],
            'Tax Manager'
        );
    } catch (err) {
        console.error(`❌ Tax Manager deploy failed: ${err.message}`);
        await api.disconnect();
        process.exit(1);
    }

    // === Step 2: Deploy LUSDT Token ===
    // Constructor: new(tax_manager, bridge_account, emergency_admin)
    let lusdtAddress;
    try {
        lusdtAddress = await deployContract(
            api, alice, lusdtJson, 'new',
            [
                taxManagerAddress,   // tax_manager contract
                alice.address,       // bridge_account (Alice for dev testing)
                charlie.address      // emergency_admin
            ],
            'LUSDT Token'
        );
    } catch (err) {
        console.error(`❌ LUSDT Token deploy failed: ${err.message}`);
        await api.disconnect();
        process.exit(1);
    }

    // === Save results ===
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const deployDir = path.join(__dirname, `../deployments/local_${timestamp}`);
    fs.mkdirSync(deployDir, { recursive: true });

    const result = {
        network: 'local',
        rpc_endpoint: RPC,
        timestamp,
        contracts: {
            tax_manager: taxManagerAddress,
            lusdt_token: lusdtAddress
        },
        accounts: {
            owner: `${alice.address} (//Alice)`,
            bridge: `${alice.address} (//Alice)`,
            emergency_admin: `${charlie.address} (//Charlie)`
        }
    };

    fs.writeFileSync(
        path.join(deployDir, 'deployment_addresses.json'),
        JSON.stringify(result, null, 2)
    );

    // Copy artifacts
    fs.copyFileSync(TAX_CONTRACT_PATH, path.join(deployDir, 'tax_manager.contract'));
    fs.copyFileSync(LUSDT_CONTRACT_PATH, path.join(deployDir, 'lusdt_token.contract'));

    console.log('\n' + '='.repeat(60));
    console.log('🎉 DEPLOYMENT COMPLETE!');
    console.log('='.repeat(60));
    console.log(`  Tax Manager:  ${taxManagerAddress}`);
    console.log(`  LUSDT Token:  ${lusdtAddress}`);
    console.log(`  Deployment:   ${deployDir}`);
    console.log('\n⚠️  Update your bridge-service/.env:');
    console.log(`  LUSDT_CONTRACT_ADDRESS=${lusdtAddress}`);
    console.log('='.repeat(60));

    await api.disconnect();
    process.exit(0);
}

main().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
