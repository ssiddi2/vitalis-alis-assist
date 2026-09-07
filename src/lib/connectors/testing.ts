import type { Checkpoint, ConnectorAdapter, DeliveryResult, ExchangeEvent, LedgerStore } from './types';

/**
 * Offline doubles for tests and local development.
 *
 * NOT PRODUCTION INFRASTRUCTURE. The in-memory ledger is volatile: it provides
 * no durability, no transactionality and no delivery guarantee. A runtime needs
 * a durable inbox/outbox with persisted checkpoints.
 */
export function createInMemoryLedger(): LedgerStore & { readonly durable: false } {
  const processed = new Set<string>();
  const checkpoints = new Map<string, Checkpoint>();
  return {
    durable: false,
    hasProcessed: (key) => processed.has(key),
    markProcessed: (key) => { processed.add(key); },
    getCheckpoint: (streamKey) => checkpoints.get(streamKey) ?? null,
    putCheckpoint: (checkpoint) => { checkpoints.set(checkpoint.streamKey, checkpoint); },
  };
}

/** Synthetic transport: records calls, never performs I/O. */
export function createSyntheticTransport(
  adapter: Pick<ConnectorAdapter, 'profile' | 'supports'>,
  respond: (event: ExchangeEvent, payload: unknown) => DeliveryResult | Promise<DeliveryResult>,
): ConnectorAdapter & { calls: Array<{ event: ExchangeEvent; payload: unknown }> } {
  const calls: Array<{ event: ExchangeEvent; payload: unknown }> = [];
  return {
    profile: adapter.profile,
    supports: adapter.supports,
    calls,
    async deliver(event, payload) {
      calls.push({ event, payload });
      return respond(event, payload);
    },
  };
}

/** Deterministic clock for tests. */
export const fixedClock = (iso: string) => () => new Date(iso);
