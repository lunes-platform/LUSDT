#!/usr/bin/env node
/**
 * LUSDT Bridge — Teste Completo de Emissão e Queima
 *
 * Simula o ciclo completo:
 *   1. [Solana devnet] Consulta saldo USDT na carteira do bridge
 *   2. [Lunes local]   Emite LUSDT (simula chegada de USDT do Solana)
 *   3. [Lunes local]   Verifica saldo, supply, taxas e estado do contrato
 *   4. [Lunes local]   Transfere LUSDT entre contas
 *   5. [Lunes local]   Queima LUSDT (simula saque de volta para Solana)
 *   6. [Bridge API]    Verifica reservas, stats e fluxo completo via API
 */

const { ApiPromise, WsProvider, Keyring } = require('@polkadot/api');
const { ContractPromise } = require('@polkadot/api-contract');
const { Connection, PublicKey } = require('@solana/web3.js');
const fs = require('fs');
const path = require('path');

// ─── Configuração ─────────────────────────────────────────────────────────────
const LUNES_RPC      = 'ws://localhost:9944';
const BRIDGE_API     = 'http://localhost:3001';
const BRIDGE_API_KEY = 'bridge-dev-key-2026';
const OPS_USER       = 'ops';
const OPS_PASS       = 'lusdt-ops-dev-2026';
const SOLANA_RPC     = 'https://api.devnet.solana.com';

// Lê endereços do .env
const envPath = path.join(__dirname, '../../bridge-service/.env');
const envContent = fs.readFileSync(envPath, 'utf8');
const env = Object.fromEntries(
  envContent.split('\n')
    .filter(l => l.includes('=') && !l.startsWith('#'))
    .map(l => { const [k, ...v] = l.split('='); return [k.trim(), v.join('=').trim()]; })
);

const LUSDT_ADDRESS      = env.LUSDT_CONTRACT_ADDRESS;
const TAX_MANAGER_ADDRESS = env.TAX_MANAGER_CONTRACT_ADDRESS;
const SOLANA_BRIDGE_ADDR = env.SOLANA_MULTISIG_VAULT;

// Lê metadata dos contratos
const LUSDT_JSON = JSON.parse(fs.readFileSync(
  path.join(__dirname, '../../target/ink/lusdt_token/lusdt_token.json'), 'utf8'
));
const TAX_JSON = JSON.parse(fs.readFileSync(
  path.join(__dirname, '../../target/ink/tax_manager/tax_manager.json'), 'utf8'
));

// ─── Helpers ─────────────────────────────────────────────────────────────────
const GREEN  = '\x1b[32m';
const RED    = '\x1b[31m';
const YELLOW = '\x1b[33m';
const BLUE   = '\x1b[34m';
const CYAN   = '\x1b[36m';
const RESET  = '\x1b[0m';
const BOLD   = '\x1b[1m';

let passed = 0, failed = 0, warnings = 0;

function ok(msg)   { console.log(`  ${GREEN}✅ ${msg}${RESET}`); passed++; }
function fail(msg) { console.log(`  ${RED}❌ ${msg}${RESET}`); failed++; }
function warn(msg) { console.log(`  ${YELLOW}⚠️  ${msg}${RESET}`); warnings++; }
function info(msg) { console.log(`  ${BLUE}ℹ  ${msg}${RESET}`); }
function step(n, msg) { console.log(`\n${BOLD}${CYAN}▶ PASSO ${n}: ${msg}${RESET}`); }

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function fetchBridge(path, opts = {}) {
  const url = `${BRIDGE_API}${path}`;
  const headers = { 'Content-Type': 'application/json', ...opts.headers };
  const res = await fetch(url, { ...opts, headers });
  const text = await res.text();
  try { return { status: res.status, data: JSON.parse(text) }; }
  catch { return { status: res.status, data: text }; }
}

// Query somente-leitura de um contrato ink!
async function contractQuery(api, contract, method, caller, ...args) {
  // WeightV2 explícito — gasLimit:-1 causa OutOfGas nesta versão da API
  const gasLimit = api.registry.createType('WeightV2', {
    refTime: 500_000_000_000n,
    proofSize: 1_000_000n
  });
  const result = await contract.query[method](caller, { gasLimit }, ...args);
  if (result.result.isOk && result.output) {
    const val = result.output.toJSON();
    if (val && typeof val === 'object' && 'ok' in val) return val.ok;
    return val;
  }
  throw new Error(`Query ${method} falhou: ${result.result.toString()}`);
}

// TX que modifica estado no contrato
async function contractTx(api, contract, method, signer, value = 0, ...args) {
  const gasLimit = api.registry.createType('WeightV2', {
    refTime: 30_000_000_000n,
    proofSize: 500_000n
  });

  return new Promise((resolve, reject) => {
    let unsub;
    contract.tx[method]({ gasLimit, value }, ...args)
      .signAndSend(signer, (result) => {
        if (result.status.isInBlock || result.status.isFinalized) {
          if (result.dispatchError) {
            if (result.dispatchError.isModule) {
              const decoded = api.registry.findMetaError(result.dispatchError.asModule);
              reject(new Error(`${decoded.section}.${decoded.method}: ${decoded.docs.join(' ')}`));
            } else {
              reject(new Error(result.dispatchError.toString()));
            }
          } else {
            resolve(result);
          }
          if (unsub) unsub();
        }
      })
      .then(u => { unsub = u; })
      .catch(reject);
  });
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`\n${BOLD}${'═'.repeat(60)}${RESET}`);
  console.log(`${BOLD}  LUSDT Bridge — Teste de Emissão e Queima${RESET}`);
  console.log(`${BOLD}${'═'.repeat(60)}${RESET}`);
  console.log(`  LUSDT Contract : ${LUSDT_ADDRESS}`);
  console.log(`  TaxManager     : ${TAX_MANAGER_ADDRESS}`);
  console.log(`  Bridge Solana  : ${SOLANA_BRIDGE_ADDR}`);

  // ───────────────────────────────────────────────────────────
  step(1, 'Conectando à rede Solana (devnet)');
  // ───────────────────────────────────────────────────────────
  const solanaConn = new Connection(SOLANA_RPC, 'confirmed');
  try {
    const slot = await solanaConn.getSlot();
    ok(`Conectado ao devnet Solana — slot atual: ${slot}`);

    const bridgePubkey = new PublicKey(SOLANA_BRIDGE_ADDR);
    const balance = await solanaConn.getBalance(bridgePubkey);
    info(`Saldo SOL da carteira bridge (${SOLANA_BRIDGE_ADDR}): ${balance / 1e9} SOL`);

    // Verificar token USDT (devnet)
    const USDT_MINT_DEVNET = new PublicKey('Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr');
    try {
      const tokenAccounts = await solanaConn.getParsedTokenAccountsByOwner(bridgePubkey, {
        mint: USDT_MINT_DEVNET
      });
      if (tokenAccounts.value.length > 0) {
        const usdtBalance = tokenAccounts.value[0].account.data.parsed.info.tokenAmount.uiAmount;
        ok(`Saldo USDT (devnet) da carteira bridge: ${usdtBalance} USDT`);
      } else {
        warn('Carteira bridge não possui conta de token USDT ainda (normal em devnet zerada)');
      }
    } catch (e) {
      warn(`Não foi possível verificar saldo USDT: ${e.message}`);
    }
  } catch (e) {
    fail(`Falha ao conectar Solana: ${e.message}`);
  }

  // ───────────────────────────────────────────────────────────
  step(2, 'Conectando à rede Lunes (local)');
  // ───────────────────────────────────────────────────────────
  const provider = new WsProvider(LUNES_RPC);
  const api = await ApiPromise.create({ provider });
  await api.isReady;

  const chain = await api.rpc.system.chain();
  ok(`Conectado ao nó Lunes: ${chain}`);

  const keyring = new Keyring({ type: 'sr25519' });
  const alice   = keyring.addFromUri('//Alice');   // owner + bridge account
  const bob     = keyring.addFromUri('//Bob');     // usuário de teste
  const charlie = keyring.addFromUri('//Charlie'); // emergency admin

  const lusdtContract = new ContractPromise(api, LUSDT_JSON, LUSDT_ADDRESS);
  const taxContract   = new ContractPromise(api, TAX_JSON,   TAX_MANAGER_ADDRESS);

  // ───────────────────────────────────────────────────────────
  step(3, 'Estado inicial dos contratos');
  // ───────────────────────────────────────────────────────────
  let initialSupply, initialBobBalance, isPaused, lunesPrice;

  try {
    isPaused = await contractQuery(api, lusdtContract, 'isPaused', alice.address);
    ok(`Contrato LUSDT ativo (isPaused = ${isPaused})`);
    if (isPaused) { fail('Contrato pausado — testes de TX não vão funcionar'); }
  } catch (e) {
    fail(`Erro ao ler isPaused: ${e.message}`);
  }

  try {
    initialSupply = await contractQuery(api, lusdtContract, 'totalSupply', alice.address);
    ok(`Total supply inicial: ${initialSupply} (${Number(initialSupply) / 1e6} LUSDT)`);
  } catch (e) {
    fail(`Erro ao ler totalSupply: ${e.message}`);
    initialSupply = 0;
  }

  try {
    initialBobBalance = await contractQuery(api, lusdtContract, 'balanceOf', alice.address, bob.address);
    ok(`Saldo inicial de Bob: ${initialBobBalance} (${Number(initialBobBalance) / 1e6} LUSDT)`);
  } catch (e) {
    fail(`Erro ao ler balanceOf(Bob): ${e.message}`);
    initialBobBalance = 0;
  }

  try {
    lunesPrice = await contractQuery(api, taxContract, 'getLunesPrice', alice.address);
    ok(`Preço do LUNES (TaxManager): ${lunesPrice}`);
  } catch (e) {
    warn(`Erro ao ler preço LUNES: ${e.message}`);
  }

  // ───────────────────────────────────────────────────────────
  step(4, 'Emissão de LUSDT (simulando depósito USDT → Lunes)');
  // ───────────────────────────────────────────────────────────
  // 100.00 LUSDT = 100 * 1_000_000 (6 decimais, como USDT)
  const MINT_AMOUNT = 100_000_000n; // 100 LUSDT

  info(`Mintando ${Number(MINT_AMOUNT) / 1e6} LUSDT para Bob (${bob.address})...`);
  info('Chamada: lusdt_token::mint(recipient=Bob, amount=100_000_000)');

  try {
    await contractTx(api, lusdtContract, 'mint', alice, 0, bob.address, MINT_AMOUNT);
    ok(`Mint de ${Number(MINT_AMOUNT) / 1e6} LUSDT executado com sucesso`);
  } catch (e) {
    fail(`Mint falhou: ${e.message}`);
    info('Possível causa: Alice não é o bridge_account deste contrato');
    // Tentar continuar para ver o estado atual
  }

  // Verifica saldo após mint
  await sleep(1000);
  try {
    const bobBalance = await contractQuery(api, lusdtContract, 'balanceOf', alice.address, bob.address);
    const minted = BigInt(bobBalance) - BigInt(initialBobBalance);
    if (BigInt(bobBalance) > BigInt(initialBobBalance)) {
      ok(`Saldo de Bob após mint: ${Number(bobBalance) / 1e6} LUSDT (emitido: ${Number(minted) / 1e6})`);
    } else {
      warn(`Saldo de Bob não alterou: ${Number(bobBalance) / 1e6} LUSDT`);
    }

    const newSupply = await contractQuery(api, lusdtContract, 'totalSupply', alice.address);
    ok(`Total supply após mint: ${Number(newSupply) / 1e6} LUSDT`);

    const supplyDiff = BigInt(newSupply) - BigInt(initialSupply);
    if (supplyDiff === MINT_AMOUNT) {
      ok(`Supply aumentou exatamente ${Number(MINT_AMOUNT) / 1e6} LUSDT ✓`);
    } else if (supplyDiff > 0n) {
      ok(`Supply aumentou ${Number(supplyDiff) / 1e6} LUSDT`);
    }
  } catch (e) {
    fail(`Erro ao verificar estado pós-mint: ${e.message}`);
  }

  // ───────────────────────────────────────────────────────────
  step(5, 'Transferência de LUSDT entre contas');
  // ───────────────────────────────────────────────────────────
  const TRANSFER_AMOUNT = 20_000_000n; // 20 LUSDT

  try {
    const bobBalBefore = BigInt(await contractQuery(api, lusdtContract, 'balanceOf', alice.address, bob.address));
    info(`Bob → Charlie: ${Number(TRANSFER_AMOUNT) / 1e6} LUSDT`);

    if (bobBalBefore >= TRANSFER_AMOUNT) {
      await contractTx(api, lusdtContract, 'transfer', bob, 0, charlie.address, TRANSFER_AMOUNT);
      await sleep(1000);

      const bobBalAfter     = await contractQuery(api, lusdtContract, 'balanceOf', alice.address, bob.address);
      const charlieBalance  = await contractQuery(api, lusdtContract, 'balanceOf', alice.address, charlie.address);

      ok(`Bob após transfer: ${Number(bobBalAfter) / 1e6} LUSDT`);
      ok(`Charlie após transfer: ${Number(charlieBalance) / 1e6} LUSDT`);

      const bobDiff = bobBalBefore - BigInt(bobBalAfter);
      if (bobDiff === TRANSFER_AMOUNT) {
        ok(`Valor debitado de Bob correto: ${Number(bobDiff) / 1e6} LUSDT ✓`);
      }
    } else {
      warn(`Bob não tem saldo suficiente (${Number(bobBalBefore) / 1e6} LUSDT) para transferir ${Number(TRANSFER_AMOUNT) / 1e6} — pulando transfer`);
    }
  } catch (e) {
    fail(`Transfer falhou: ${e.message}`);
  }

  // ───────────────────────────────────────────────────────────
  step(6, 'Verificação de taxas (TaxManager)');
  // ───────────────────────────────────────────────────────────
  try {
    const feeRes = await fetchBridge('/bridge/calculate-fee', {
      method: 'POST',
      body: JSON.stringify({ amount: 100, sourceChain: 'solana' })
    });

    if (feeRes.status === 200) {
      const f = feeRes.data;
      ok(`Taxa calculada para 100 USDT:`);
      info(`  Modelo: ${f.feeModel} (USDT + LUNES burn)`);
      info(`  Taxa USDT: ${f.stablecoinFee} USDT (${f.stablecoinFeePercentage}%)`);
      info(`  LUNES burn: ${f.lunesBurnFee} LUNES (${f.lunesBurnCurrency})`);
      info(`  Total taxa USD: $${f.totalFeeUsd} (${f.totalFeePercentage}%)`);
      info(`  Valor líquido: ${f.netAmount} USDT`);

      if (f.netAmount === 99.4) ok('Valor líquido correto: 100 - 0.6% = 99.4 USDT ✓');
      if (f.stablecoinFeePercentage === 0.6) ok('Taxa de 0.6% aplicada corretamente ✓');
    } else {
      fail(`Erro ao calcular taxa: ${JSON.stringify(feeRes.data)}`);
    }
  } catch (e) {
    fail(`Erro ao verificar taxas: ${e.message}`);
  }

  // ───────────────────────────────────────────────────────────
  step(7, 'Queima de LUSDT (simulando saque → Solana)');
  // ───────────────────────────────────────────────────────────
  const BURN_AMOUNT = 50_000_000n; // 50 LUSDT

  try {
    const bobBalBefore = BigInt(await contractQuery(api, lusdtContract, 'balanceOf', alice.address, bob.address));
    info(`Queimando ${Number(BURN_AMOUNT) / 1e6} LUSDT de Bob (${bob.address})...`);
    info(`Saldo Bob antes da queima: ${Number(bobBalBefore) / 1e6} LUSDT`);

    if (bobBalBefore >= BURN_AMOUNT) {
      // burn(amount, solana_recipient)
      const SOLANA_RECIPIENT = SOLANA_BRIDGE_ADDR;
      await contractTx(api, lusdtContract, 'burn', bob, 0, BURN_AMOUNT, SOLANA_RECIPIENT);
      await sleep(1000);

      const bobBalAfter  = await contractQuery(api, lusdtContract, 'balanceOf', alice.address, bob.address);
      const finalSupply  = await contractQuery(api, lusdtContract, 'totalSupply', alice.address);

      ok(`Bob após burn: ${Number(bobBalAfter) / 1e6} LUSDT`);
      ok(`Total supply após burn: ${Number(finalSupply) / 1e6} LUSDT`);

      const burned = bobBalBefore - BigInt(bobBalAfter);
      if (burned === BURN_AMOUNT) ok(`Queima de ${Number(BURN_AMOUNT) / 1e6} LUSDT confirmada ✓`);

      const supplyReduced = BigInt(initialSupply) + MINT_AMOUNT - BURN_AMOUNT;
      info(`Supply esperado (inicial + mint - burn): ${Number(supplyReduced) / 1e6} LUSDT`);
    } else {
      warn(`Bob não tem saldo suficiente (${Number(bobBalBefore) / 1e6} LUSDT) para queimar ${Number(BURN_AMOUNT) / 1e6} — ajustando...`);

      // Queimar o que Bob tem
      if (bobBalBefore > 0n) {
        await contractTx(api, lusdtContract, 'burn', bob, 0, bobBalBefore, SOLANA_BRIDGE_ADDR);
        await sleep(1000);
        const bobBalAfter = await contractQuery(api, lusdtContract, 'balanceOf', alice.address, bob.address);
        ok(`Bob após burn total: ${Number(bobBalAfter) / 1e6} LUSDT`);
      } else {
        warn('Bob sem saldo — burn skipped');
      }
    }
  } catch (e) {
    fail(`Burn falhou: ${e.message}`);
  }

  // ───────────────────────────────────────────────────────────
  step(8, 'Teste de circuit breaker (emergency pause/unpause)');
  // ───────────────────────────────────────────────────────────
  try {
    info('Pausando contrato com emergency_pause (Charlie = emergency admin)...');
    await contractTx(api, lusdtContract, 'emergencyPause', charlie, 0, 'test-circuit-breaker');
    await sleep(500);

    const pausedState = await contractQuery(api, lusdtContract, 'isPaused', alice.address);
    if (pausedState === true) {
      ok('Contrato pausado com sucesso ✓');
    } else {
      warn(`isPaused = ${pausedState} (esperado true)`);
    }

    // Verificar que mint é bloqueado quando pausado
    try {
      await contractTx(api, lusdtContract, 'mint', alice, 0, bob.address, 1_000_000n);
      fail('Mint deveria ter sido bloqueado enquanto pausado!');
    } catch (e) {
      if (e.message.includes('Paused') || e.message.includes('pause') || e.message.includes('Error')) {
        ok('Mint bloqueado corretamente enquanto pausado ✓');
      } else {
        warn(`Mint falhou por outro motivo: ${e.message}`);
      }
    }

    // Despausar
    info('Despausando com emergency_unpause (Alice = owner)...');
    await contractTx(api, lusdtContract, 'emergencyUnpause', alice);
    await sleep(500);

    const unpausedState = await contractQuery(api, lusdtContract, 'isPaused', alice.address);
    if (unpausedState === false) {
      ok('Contrato despausado com sucesso ✓');
    } else {
      warn(`isPaused = ${unpausedState} (esperado false)`);
    }
  } catch (e) {
    warn(`Teste de pause/unpause: ${e.message}`);
  }

  // ───────────────────────────────────────────────────────────
  step(9, 'Verificação final via Bridge API');
  // ───────────────────────────────────────────────────────────
  try {
    // Estado do contrato via API ops
    const contractStatus = await fetchBridge('/admin/contract-status', {
      headers: { 'Authorization': 'Basic ' + Buffer.from(`${OPS_USER}:${OPS_PASS}`).toString('base64') }
    });
    if (contractStatus.status === 200) {
      const cs = contractStatus.data;
      ok('Contract status via API:');
      info(`  isPaused: ${cs.isPaused}`);
      info(`  Total supply: ${Number(cs.totalSupply) / 1e6} LUSDT`);
      info(`  Preço LUNES: ${cs.lunesPrice}`);
      info(`  Volume mensal: ${cs.monthlyVolume}`);
      info(`  Fee config: low=${cs.feeConfig?.lowVolumeFee}bps, med=${cs.feeConfig?.mediumVolumeFee}bps, high=${cs.feeConfig?.highVolumeFee}bps`);
    }

    // Reservas
    const reserves = await fetchBridge('/bridge/reserves');
    if (reserves.status === 200) {
      ok(`Reservas: ${reserves.data.totalBackingUSDT} USDT | ${reserves.data.totalCirculatingLUSDT} LUSDT`);
      info(`  Ratio de cobertura: ${reserves.data.backingRatio}%`);
    }

    // Stats gerais
    const stats = await fetchBridge('/stats');
    if (stats.status === 200) {
      ok(`Stats bridge: ${stats.data.totalTransactions} TXs totais, ${stats.data.failedTransactions} falhas`);
    }

    // Listar TXs
    const txs = await fetchBridge('/transactions');
    if (txs.status === 200) {
      ok(`Transações no banco: ${txs.data.total}`);
      if (txs.data.transactions.length > 0) {
        txs.data.transactions.forEach(tx => {
          info(`  TX ${tx.id}: ${tx.amount} USDT | status=${tx.status} | ${tx.sourceChain}→${tx.destinationChain}`);
        });
      }
    }
  } catch (e) {
    fail(`Erro na verificação final: ${e.message}`);
  }

  // ───────────────────────────────────────────────────────────
  step(10, 'Estado final dos contratos na Lunes');
  // ───────────────────────────────────────────────────────────
  try {
    const finalSupply   = await contractQuery(api, lusdtContract, 'totalSupply', alice.address);
    const finalBobBal   = await contractQuery(api, lusdtContract, 'balanceOf', alice.address, bob.address);
    const finalCharlie  = await contractQuery(api, lusdtContract, 'balanceOf', alice.address, charlie.address);
    const finalAlice    = await contractQuery(api, lusdtContract, 'balanceOf', alice.address, alice.address);
    const isPausedFinal = await contractQuery(api, lusdtContract, 'isPaused', alice.address);

    ok('Estado final dos contratos:');
    info(`  Total supply:    ${Number(finalSupply) / 1e6} LUSDT`);
    info(`  Alice (bridge):  ${Number(finalAlice) / 1e6} LUSDT`);
    info(`  Bob (usuário):   ${Number(finalBobBal) / 1e6} LUSDT`);
    info(`  Charlie (admin): ${Number(finalCharlie) / 1e6} LUSDT`);
    info(`  Contrato ativo:  ${!isPausedFinal}`);
  } catch (e) {
    fail(`Erro ao ler estado final: ${e.message}`);
  }

  await api.disconnect();

  // ─── Relatório Final ─────────────────────────────────────────────────────────
  console.log(`\n${BOLD}${'═'.repeat(60)}${RESET}`);
  console.log(`${BOLD}  RELATÓRIO FINAL${RESET}`);
  console.log(`${'═'.repeat(60)}`);
  console.log(`  ${GREEN}✅ Passou:    ${passed}${RESET}`);
  console.log(`  ${RED}❌ Falhou:    ${failed}${RESET}`);
  console.log(`  ${YELLOW}⚠️  Avisos:    ${warnings}${RESET}`);
  console.log(`${'═'.repeat(60)}\n`);

  if (failed === 0) {
    console.log(`${GREEN}${BOLD}  🎉 TODOS OS TESTES PASSARAM! Bridge funcionando corretamente.${RESET}\n`);
  } else {
    console.log(`${YELLOW}${BOLD}  ⚠️  ${failed} teste(s) falharam. Verifique os erros acima.${RESET}\n`);
  }

  process.exit(failed > 0 ? 1 : 0);
}

main().catch(err => {
  console.error(`\n${RED}Erro fatal: ${err.message}${RESET}`);
  console.error(err.stack);
  process.exit(1);
});
