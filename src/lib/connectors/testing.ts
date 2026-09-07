import type {
  Checkpoint,
  CommitEntry,
  CommitOutcome,
  ConnectorAdapter,
  ConnectorConfig,
  DeliveryResult,
  ExchangeEvent,
  LocalEffect,
  OutboundEntry,
  TransactionalStore,
} from './types';

/**
 * Offline doubles for tests and local development.
 *
 * NOT PRODUCTION INFRASTRUCTURE. This store is volatile in-process memory: it
 * provides no durability and no crash safety. It only emulates the required
 * ALL-OR-NOTHING commit semantics so the contract can be tested offline. A
 * runtime needs a durable, transactional inbox/outbox with persisted checkpoints.
 */
export interface SyntheticStore extends TransactionalStore {
  readonly durable: false;
  readonly effects: Array<{ workKey: string; effect: LocalEffect }>;
  readonly outbound: OutboundEntry[];
  /** Forces the next commit to fail, emulating a store/effect failure. */
  failNextCommit(reason: string, classification?: 'permanent' | 'retryable' | 'unknown'): void;
}

export function createSyntheticStore(): SyntheticStore {
  const committedWork = new Set<string>();
  const seenSourceEvents = new Set<string>();
  const checkpoints = new Map<string, Checkpoint>();
  const effects: Array<{ workKey: string; effect: LocalEffect }> = [];
  const outbound: OutboundEntry[] = [];
  let forcedFailure: { reason: string; classification: 'permanent' | 'retryable' | 'unknown' } | null = null;

  return {
    durable: false,
    effects,
    outbound,
    failNextCommit(reason, classification = 'retryable') {
      forcedFailure = { reason, classification };
    },
    hasCommittedWork: (key) => committedWork.has(key),
    hasSeenSourceEvent: (key) => seenSourceEvents.has(key),
    getCheckpoint: (streamKey) => checkpoints.get(streamKey) ?? null,
    commit(entry: CommitEntry): CommitOutcome {
      if (committedWork.has(entry.plan.workKey)) {
        return { status: 'duplicate', workKey: entry.plan.workKey };
      }
      if (forcedFailure) {
        const failure = forcedFailure;
        forcedFailure = null;
        // All-or-nothing: no effect, no dedup record, no checkpoint advance.
        return { status: 'failed', classification: failure.classification, reason: failure.reason };
      }
      effects.push({ workKey: entry.plan.workKey, effect: entry.effect });
      committedWork.add(entry.plan.workKey);
      seenSourceEvents.add(entry.plan.sourceEventKey);
      checkpoints.set(entry.checkpoint.streamKey, entry.checkpoint);
      return { status: 'committed', workKey: entry.plan.workKey, checkpoint: entry.checkpoint };
    },
    enqueueOutbound(entry) {
      outbound.push(entry);
    },
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
    supports: (capability, config: ConnectorConfig) => adapter.supports(capability, config),
    calls,
    async deliver(event, payload) {
      calls.push({ event, payload });
      return respond(event, payload);
    },
  };
}

/** Deterministic clock for tests. */
export const fixedClock = (iso: string) => () => new Date(iso);
