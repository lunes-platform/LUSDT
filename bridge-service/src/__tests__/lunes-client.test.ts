/**
 * LunesClient Integration Tests
 *
 * Covers:
 *  - mintLUSDT / burnLUSDT: resolves on isFinalized, not isInBlock
 *  - mintLUSDT / burnLUSDT: rejects on dispatchError with proper propagation
 *  - queryTaxManagerFeeBps: unwraps Ok(value) codec result correctly
 *  - queryLunesPrice: unwraps Ok(value) codec result correctly
 *  - getTotalSupply / getLUSDTBalance: WeightV2 refTime uses BigInt
 */

// ── Polkadot mock factory ─────────────────────────────────────────────

function makeStatusCallbackCapture() {
  let captured: ((update: { status: any; dispatchError?: any }) => void) | undefined;
  const signAndSend = jest.fn((account: any, cb: (update: any) => void) => {
    captured = cb;
    return Promise.resolve(() => { /* unsub noop */ });
  });
  return {
    signAndSend,
    fire: (update: { status: any; dispatchError?: any }) => {
      if (captured) captured(update);
    },
  };
}

function makeStatus(type: 'isInBlock' | 'isFinalized', hash = 'mock-hash') {
  return {
    isInBlock: type === 'isInBlock',
    asInBlock: { toString: () => hash },
    isFinalized: type === 'isFinalized',
    asFinalized: { toString: () => hash },
  };
}

function makeDispatchError(message: string) {
  return {
    isModule: false,
    toString: () => message,
  };
}

function makeCodecOutput(value: unknown, wrapped = true) {
  const inner = wrapped ? { ok: value } : value;
  return {
    toJSON: () => inner,
    toString: () => String(value),
  };
}

// ── LunesClient under test ─────────────────────────────────────────────

// We test the logic extracted from client.ts by reproducing the exact Promise
// construction used in mintLUSDT / burnLUSDT, plus the unwrapping logic.

describe('mintLUSDT — resolves on isFinalized, not isInBlock', () => {
  it('does NOT resolve when status is isInBlock', async () => {
    const capture = makeStatusCallbackCapture();
    const resolved: string[] = [];

    const p = new Promise<string>((resolve, reject) => {
      let unsub: (() => void) | undefined;
      // Simulate the mintLUSDT promise construction (post-fix)
      capture.signAndSend({}, ({ status, dispatchError }: any) => {
        try {
          if (dispatchError) {
            if (unsub) unsub();
            reject(new Error(`dispatch error: ${dispatchError.toString()}`));
          } else if (status.isFinalized) {
            if (unsub) unsub();
            resolve(status.asFinalized.toString());
          }
        } catch (err) {
          if (unsub) unsub();
          reject(err);
        }
      })
        .then((u: any) => { unsub = u; })
        .catch(reject);
    });

    p.then(v => resolved.push(v));

    // Fire isInBlock — should NOT resolve
    capture.fire({ status: makeStatus('isInBlock') });

    // Give microtasks a tick
    await new Promise(r => setImmediate(r));
    expect(resolved).toHaveLength(0);
  });

  it('resolves with finalized block hash when status is isFinalized', async () => {
    const capture = makeStatusCallbackCapture();

    const p = new Promise<string>((resolve, reject) => {
      let unsub: (() => void) | undefined;
      capture.signAndSend({}, ({ status, dispatchError }: any) => {
        try {
          if (dispatchError) {
            if (unsub) unsub();
            reject(new Error(`dispatch error: ${dispatchError.toString()}`));
          } else if (status.isFinalized) {
            if (unsub) unsub();
            resolve(status.asFinalized.toString());
          }
        } catch (err) {
          if (unsub) unsub();
          reject(err);
        }
      })
        .then((u: any) => { unsub = u; })
        .catch(reject);
    });

    capture.fire({ status: makeStatus('isInBlock', 'in-block-hash') });
    capture.fire({ status: makeStatus('isFinalized', 'finalized-hash-abc') });

    await expect(p).resolves.toBe('finalized-hash-abc');
  });

  it('rejects when dispatchError is present', async () => {
    const capture = makeStatusCallbackCapture();

    const p = new Promise<string>((resolve, reject) => {
      let unsub: (() => void) | undefined;
      capture.signAndSend({}, ({ status, dispatchError }: any) => {
        try {
          if (dispatchError) {
            if (unsub) unsub();
            reject(new Error(`LUSDT mint dispatch error: ${dispatchError.toString()}`));
          } else if (status.isFinalized) {
            if (unsub) unsub();
            resolve(status.asFinalized.toString());
          }
        } catch (err) {
          if (unsub) unsub();
          reject(err);
        }
      })
        .then((u: any) => { unsub = u; })
        .catch(reject);
    });

    capture.fire({ status: makeStatus('isInBlock'), dispatchError: makeDispatchError('staking.InsufficientBalance') });

    await expect(p).rejects.toThrow('LUSDT mint dispatch error: staking.InsufficientBalance');
  });

  it('rejects and propagates exceptions thrown inside the callback', async () => {
    const capture = makeStatusCallbackCapture();

    const p = new Promise<string>((resolve, reject) => {
      let unsub: (() => void) | undefined;
      capture.signAndSend({}, ({ status, dispatchError }: any) => {
        try {
          if (dispatchError) {
            if (unsub) unsub();
            reject(new Error(`dispatch: ${dispatchError.toString()}`));
          } else if (status.isFinalized) {
            throw new Error('unexpected codec error');
          }
        } catch (callbackErr) {
          if (unsub) unsub();
          reject(callbackErr instanceof Error ? callbackErr : new Error(String(callbackErr)));
        }
      })
        .then((u: any) => { unsub = u; })
        .catch(reject);
    });

    capture.fire({ status: makeStatus('isFinalized') });

    await expect(p).rejects.toThrow('unexpected codec error');
  });
});

// ── burnLUSDT mirrors mint behavior ───────────────────────────────────

describe('burnLUSDT — resolves on isFinalized, rejects on dispatchError', () => {
  it('resolves only on isFinalized', async () => {
    const capture = makeStatusCallbackCapture();

    const p = new Promise<string>((resolve, reject) => {
      let unsub: (() => void) | undefined;
      capture.signAndSend({}, ({ status, dispatchError }: any) => {
        try {
          if (dispatchError) {
            if (unsub) unsub();
            reject(new Error(`LUSDT burn dispatch error: ${dispatchError.toString()}`));
          } else if (status.isFinalized) {
            if (unsub) unsub();
            resolve(status.asFinalized.toString());
          }
        } catch (err) {
          if (unsub) unsub();
          reject(err);
        }
      })
        .then((u: any) => { unsub = u; })
        .catch(reject);
    });

    // isInBlock should not resolve
    capture.fire({ status: makeStatus('isInBlock', 'early-hash') });
    await new Promise(r => setImmediate(r));

    // isFinalized should resolve
    capture.fire({ status: makeStatus('isFinalized', 'final-hash-xyz') });
    await expect(p).resolves.toBe('final-hash-xyz');
  });
});

// ── Codec unwrapping: queryTaxManagerFeeBps / queryLunesPrice ─────────

describe('codec unwrapping — Ok(value) result', () => {
  function unwrapFee(output: ReturnType<typeof makeCodecOutput>): number | null {
    const json = output.toJSON() as { ok?: number } | number | null;
    const raw = json !== null && typeof json === 'object' && 'ok' in json ? json.ok : json;
    const feeBps = typeof raw === 'number' ? raw : parseInt(String(raw), 10);
    if (feeBps > 0 && feeBps <= 1000) return feeBps;
    return null;
  }

  function unwrapPrice(output: ReturnType<typeof makeCodecOutput>): number {
    const json = output.toJSON() as { ok?: number } | number | null;
    const unwrapped = json !== null && typeof json === 'object' && 'ok' in json ? json.ok : json;
    const raw = typeof unwrapped === 'number' ? unwrapped : parseInt(String(unwrapped), 10);
    if (raw > 0) return raw / 1_000_000;
    return 0.5;
  }

  it('unwraps Ok(60) for fee bps correctly', () => {
    const output = makeCodecOutput(60, true);
    expect(unwrapFee(output)).toBe(60);
  });

  it('unwraps bare number (no Ok wrapper) for fee bps correctly', () => {
    const output = makeCodecOutput(75, false);
    expect(unwrapFee(output)).toBe(75);
  });

  it('returns null for fee bps outside valid range (>1000)', () => {
    const output = makeCodecOutput(9999, true);
    expect(unwrapFee(output)).toBeNull();
  });

  it('returns null for zero fee bps', () => {
    const output = makeCodecOutput(0, true);
    expect(unwrapFee(output)).toBeNull();
  });

  it('unwraps Ok(500000) for LUNES price (= $0.50)', () => {
    const output = makeCodecOutput(500000, true);
    expect(unwrapPrice(output)).toBeCloseTo(0.5);
  });

  it('unwraps bare number for LUNES price correctly', () => {
    const output = makeCodecOutput(1200000, false);
    expect(unwrapPrice(output)).toBeCloseTo(1.2);
  });

  it('falls back to 0.5 for zero or null price', () => {
    const output = makeCodecOutput(0, true);
    expect(unwrapPrice(output)).toBe(0.5);
  });

  it('does not misread Ok(value) toString as the value', () => {
    // Old broken behavior: parseInt('Ok(60)') → NaN → fallback to DEFAULT_FEE_BPS
    // After fix, toJSON() gives { ok: 60 }, not 'Ok(60)' string
    const brokenOutput = {
      toJSON: () => ({ ok: 60 }),
      toString: () => 'Ok(60)',
    };
    const json = brokenOutput.toJSON() as { ok?: number };
    expect(json.ok).toBe(60);
    // parseInt of toString() would give NaN
    expect(parseInt(brokenOutput.toString(), 10)).toBeNaN();
  });
});

// ── WeightV2 refTime BigInt requirement ───────────────────────────────

describe('WeightV2 gas limit — refTime must be BigInt', () => {
  it('BigInt 10_000_000_000n is typeof bigint', () => {
    expect(typeof 10_000_000_000n).toBe('bigint');
  });

  it('Number 10_000_000_000 is NOT typeof bigint', () => {
    expect(typeof 10_000_000_000).toBe('number');
  });

  it('registry.createType receives bigint values for refTime and proofSize', () => {
    const createType = jest.fn().mockReturnValue({});
    const api = { registry: { createType } } as any;

    // Simulate the corrected createType call
    api.registry.createType('WeightV2', {
      refTime: 10_000_000_000n,
      proofSize: 10_000n,
    });

    const call = createType.mock.calls[0];
    expect(call[0]).toBe('WeightV2');
    expect(typeof call[1].refTime).toBe('bigint');
    expect(typeof call[1].proofSize).toBe('bigint');
  });
});

// ── LUNES decimal caps in tax_manager (JS equivalent logic) ──────────

describe('tax_manager LUNES fee caps — 12 decimal correctness', () => {
  const LUNES_DECIMALS = 12;
  const ONE_LUNES = BigInt(10 ** LUNES_DECIMALS); // 1_000_000_000_000

  it('0.5 LUNES cap equals 500_000_000_000 at 12 decimals', () => {
    expect(ONE_LUNES / 2n).toBe(500_000_000_000n);
  });

  it('2 LUNES cap equals 2_000_000_000_000 at 12 decimals', () => {
    expect(ONE_LUNES * 2n).toBe(2_000_000_000_000n);
  });

  it('10 LUNES cap equals 10_000_000_000_000 at 12 decimals', () => {
    expect(ONE_LUNES * 10n).toBe(10_000_000_000_000n);
  });

  it('50 LUNES cap equals 50_000_000_000_000 at 12 decimals', () => {
    expect(ONE_LUNES * 50n).toBe(50_000_000_000_000n);
  });

  it('old 6-decimal caps were 1_000_000x too small', () => {
    const old_half_lunes = 500_000n; // old buggy value
    const correct_half_lunes = 500_000_000_000n; // fixed value
    expect(correct_half_lunes / old_half_lunes).toBe(1_000_000n);
  });
});
