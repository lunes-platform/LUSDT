import { ApiPromise } from '@polkadot/api';

export const QUERY_REF_TIME = 5_000_000_000_000n;
export const QUERY_PROOF_SIZE = 5_000_000n;
export const TX_REF_TIME = 50_000_000_000n;
export const TX_PROOF_SIZE = 5_000_000n;

/**
 * Creates a WeightV2 gas-limit object for use with @polkadot/api-contract queries and txs.
 *
 * LIMITATION: @polkadot/types is not installed as a direct dep — `WeightV2` from
 * `@polkadot/types/interfaces` cannot be imported. The return type `Codec` (from
 * `api.registry.createType`) is a structural superset and the runtime value IS WeightV2,
 * but TypeScript requires the `as unknown as WeightV2` double-cast at call sites.
 * This function encapsulates the cast so no call site needs an explicit escape hatch.
 */
export function createGasLimit(
  api: ApiPromise,
  refTime: bigint,
  proofSize: bigint,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): any {
  return api.registry.createType('WeightV2', { refTime, proofSize });
}

/** Unwraps an ink! Ok/Err Result codec value to the inner Ok payload. */
export function unwrapOutput(output: { toJSON?: () => unknown } | null | undefined): unknown {
  const json = output?.toJSON?.() ?? output;
  if (json && typeof json === 'object' && 'ok' in (json as object)) {
    return (json as { ok: unknown }).ok;
  }
  return json;
}
