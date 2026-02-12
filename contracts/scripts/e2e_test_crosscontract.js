const { ApiPromise, WsProvider, Keyring } = require('@polkadot/api');
const { ContractPromise } = require('@polkadot/api-contract');
const fs = require('fs');
const path = require('path');

const TAX_ADDR = '5FvsNqiDpFRYBNY436UsvRWe6pYb2UWrkTXHJrgBQHx6a4pe';
const LUSDT_ADDR = '5H91zF5pkY1Xq9c2EG9R7aEsiLfGcYyLk9ED9AvKNNGSkQhD';
const STAKING_ADDR = '5GcrV2V1Dor9xwxFfpw8VLXnLeAfxe22ZE6ZvKQ6wJahKMNY';
const BURN_ENGINE_ADDR = '5G7T1bzZ1QuntTPLcxuoS1u8ymnre5grvFYEu75CP6vBLoK3';
const BASE = path.resolve(__dirname, '..', '..');

(async () => {
  const api = await ApiPromise.create({ provider: new WsProvider('ws://localhost:9944') });
  const kr = new Keyring({ type: 'sr25519' });
  const alice = kr.addFromUri('//Alice');
  const bob = kr.addFromUri('//Bob');
  const gl = api.registry.createType('WeightV2', { refTime: 50000000000n, proofSize: 5000000n });
  const qgl = api.registry.createType('WeightV2', { refTime: 5000000000000n, proofSize: 5000000n });

  const lusdtAbi = JSON.parse(fs.readFileSync(path.join(BASE, 'target/ink/lusdt_token/lusdt_token.contract'), 'utf8'));
  const taxAbi = JSON.parse(fs.readFileSync(path.join(BASE, 'target/ink/tax_manager/tax_manager.contract'), 'utf8'));
  const lusdt = new ContractPromise(api, lusdtAbi, LUSDT_ADDR);
  const tax = new ContractPromise(api, taxAbi, TAX_ADDR);

  const log = (m) => process.stdout.write(m + '\n');

  log('=== PRE-STATE ===');
  let r = await lusdt.query.totalSupply(alice.address, { gasLimit: qgl });
  log('totalSupply: ' + JSON.stringify(r.output?.toJSON()));
  r = await tax.query.getMonthlyVolumeUsd(alice.address, { gasLimit: qgl });
  log('monthlyVolume: ' + JSON.stringify(r.output?.toJSON()));

  log('\n=== TEST 1: MINT 1000 LUSDT to Bob ===');
  const mintRes = await new Promise((resolve, reject) => {
    lusdt.tx.mint({ gasLimit: gl, storageDepositLimit: null }, bob.address, 1000000000)
      .signAndSend(alice, (result) => {
        if (result.status.isInBlock) {
          resolve({ ok: !result.dispatchError, block: result.status.asInBlock.toHex() });
        }
      }).catch(reject);
  });
  log('Mint OK: ' + mintRes.ok + ' | Block: ' + mintRes.block);

  log('\n=== POST-MINT STATE ===');
  r = await lusdt.query.totalSupply(alice.address, { gasLimit: qgl });
  log('totalSupply: ' + JSON.stringify(r.output?.toJSON()));
  r = await lusdt.query.balanceOf(alice.address, { gasLimit: qgl }, bob.address);
  log('Bob balance: ' + JSON.stringify(r.output?.toJSON()));
  r = await tax.query.getMonthlyVolumeUsd(alice.address, { gasLimit: qgl });
  log('Tax monthlyVolume: ' + JSON.stringify(r.output?.toJSON()));

  log('\n=== TEST 2: BURN 500 LUSDT from Bob ===');
  const burnRes = await new Promise((resolve, reject) => {
    lusdt.tx.burn({ gasLimit: gl, storageDepositLimit: null }, 500000000, '6zZ9bP5kkSMyjvnnBzG75sYsmAwU9fat8YmXccMfVruj')
      .signAndSend(bob, (result) => {
        if (result.status.isInBlock) {
          resolve({ ok: !result.dispatchError, block: result.status.asInBlock.toHex() });
        }
      }).catch(reject);
  });
  log('Burn OK: ' + burnRes.ok + ' | Block: ' + burnRes.block);

  log('\n=== FINAL STATE ===');
  r = await lusdt.query.totalSupply(alice.address, { gasLimit: qgl });
  log('totalSupply: ' + JSON.stringify(r.output?.toJSON()));
  r = await lusdt.query.balanceOf(alice.address, { gasLimit: qgl }, bob.address);
  log('Bob balance: ' + JSON.stringify(r.output?.toJSON()));
  r = await tax.query.getMonthlyVolumeUsd(alice.address, { gasLimit: qgl });
  log('Tax monthlyVolume: ' + JSON.stringify(r.output?.toJSON()));

  log('\n=== E2E COMPLETE ===');
  await api.disconnect();
  process.exit(0);
})().catch(e => { process.stderr.write('FATAL: ' + e.message + '\n'); process.exit(1); });
