/**
 * Verify deployed contracts on local testnet
 */
const { ApiPromise, WsProvider, Keyring } = require('@polkadot/api');
const { ContractPromise } = require('@polkadot/api-contract');
const fs = require('fs');
const path = require('path');

const TAX_ADDR = '5EVuvhZGXZXezWoKzbMfcVDcbGy8ovNUnemAjw6LA85adZvP';
const LUSDT_ADDR = '5G5SWex3XwZptL1i1xiBsZfykvPDSVqnFgZRUJoB96YrzrGa';

async function verify() {
  const provider = new WsProvider('ws://localhost:9944');
  const api = await ApiPromise.create({ provider });
  console.log('Connected to:', (await api.rpc.system.chain()).toString());

  const keyring = new Keyring({ type: 'sr25519' });
  const alice = keyring.addFromUri('//Alice');

  const taxArtifact = JSON.parse(fs.readFileSync(
    path.resolve(__dirname, '../../target/ink/tax_manager/tax_manager.contract'), 'utf8'
  ));
  const tax = new ContractPromise(api, taxArtifact, TAX_ADDR);

  const gasLimit = api.registry.createType('WeightV2', {
    refTime: 500000000000n,
    proofSize: 250000n,
  });

  console.log('\n=== TAX MANAGER VERIFICATION ===');

  const tests = [
    { name: 'getVersion', fn: () => tax.query.getVersion(alice.address, { gasLimit }) },
    { name: 'getOwner', fn: () => tax.query.getOwner(alice.address, { gasLimit }) },
    { name: 'getLunesPrice', fn: () => tax.query.getLunesPrice(alice.address, { gasLimit }) },
    { name: 'getDevWallets', fn: () => tax.query.getDevWallets(alice.address, { gasLimit }) },
    { name: 'getFeeConfig', fn: () => tax.query.getFeeConfig(alice.address, { gasLimit }) },
    { name: 'getMonthlyVolumeUsd', fn: () => tax.query.getMonthlyVolumeUsd(alice.address, { gasLimit }) },
  ];

  for (const t of tests) {
    try {
      const q = await t.fn();
      if (q.result.isOk) {
        console.log(`✅ ${t.name}:`, JSON.stringify(q.output?.toJSON()));
      } else {
        const err = q.result.asErr.toJSON();
        console.log(`❌ ${t.name}: ERROR`, JSON.stringify(err));
      }
    } catch (e) {
      console.log(`❌ ${t.name}: EXCEPTION`, e.message);
    }
  }

  console.log('\n=== DEPLOYMENT INFO ===');
  console.log('TAX_MANAGER_CONTRACT_ADDRESS=' + TAX_ADDR);
  console.log('LUSDT_CONTRACT_ADDRESS=' + LUSDT_ADDR);

  await api.disconnect();
  process.exit(0);
}

verify().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
