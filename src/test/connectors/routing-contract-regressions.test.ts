import { describe, it, expect } from 'vitest';
import {
  prepareExchangeEvent,
  commitPreparedExchange,
  deliverThroughAdapter,
  workKeyFor,
  streamKeyFor,
  validateConnectorConfig,
  type ConnectorAdapter,
  type ConnectorConfig,
  type DeliveryResult,
  type ExchangeEvent,
  type ExchangePlan,
  type RoutingDeps,
} from '@/lib/connectors';
import { createSyntheticStore, type SyntheticStore } from '@/lib/connectors/testing';

/**
 * Independently reproduced contract regressions, ported verbatim in behaviour.
 * Uses the real modules — no re-implementation of routing logic in the test.
 */

const endpoint = { baseUrl: 'https://hospital.example/fhir', issuer: 'https://hospital.example/fhir' };

const event = (over: Partial<ExchangeEvent> = {}): ExchangeEvent => ({
  partition: {
    hospitalId: 'A',
    connectorId: 'cA',
    environment: 'sandbox',
    direction: 'inbound',
    resourceType: 'Observation',
    resourceId: 'obs1',
    operation: 'update',
  },
  sourceEventId: 'event1',
  versionId: 'opaque-a',
  mode: 'polling',
  externalPatientId: 'patient1',
  endpoint,
  occurredAt: '2026-09-07T00:00:00Z',
  ...over,
});

const config = (over: Partial<ConnectorConfig> = {}): ConnectorConfig => ({
  hospitalId: 'A',
  connectorId: 'cA',
  profile: 'generic_fhir_r4',
  environment: 'sandbox',
  enabled: true,
  endpoint,
  secretRef: 'TEST_SECRET_REF',
  capabilities: [{ resource: 'Observation', direction: 'inbound', mode: 'polling', verification: 'verified' }],
  health: { state: 'ok', checkedAt: null, lastEventAt: null },
  ...over,
});

type Deps = RoutingDeps & { store: SyntheticStore };
const deps = (over: Partial<RoutingDeps> = {}): Deps =>
  ({
    config: { getConnector: () => config() },
    authorization: { isConnectorAuthorized: () => true },
    mapping: {
      resolvePatient: () => ({ patientId: 'p1', hospitalId: 'A' }),
      resolveEncounter: () => null,
    },
    store: createSyntheticStore(),
    now: () => new Date('2026-09-07T00:00:00Z'),
    ...over,
  }) as Deps;

const prepare = (e: ExchangeEvent, d: RoutingDeps): ExchangePlan => {
  const r = prepareExchangeEvent(e, d);
  expect(r.status).toBe('ready');
  if (r.status !== 'ready') throw new Error('not ready');
  return r.plan;
};

const adapter = (respond: ConnectorAdapter['deliver']): ConnectorAdapter => ({
  profile: 'generic_fhir_r4',
  supports: () => true,
  deliver: respond,
});

describe('connector routing contract regressions', () => {
  it('prepares valid work without processing or checkpoint mutation', () => {
    const d = deps();
    const p = prepare(event(), d);
    expect(d.store.hasCommittedWork(p.workKey)).toBe(false);
    expect(d.store.hasSeenSourceEvent(p.sourceEventKey)).toBe(false);
    expect(d.store.getCheckpoint(p.streamKey)).toBeNull();
    expect(d.store.effects).toEqual([]);
  });

  it('gives two Observation instances on one patient separate stream keys', () => {
    expect(streamKeyFor(event().partition)).not.toBe(
      streamKeyFor({ ...event().partition, resourceId: 'obs2' }),
    );
  });

  it('cannot collide partition values containing delimiters', () => {
    expect(workKeyFor(event({ partition: { ...event().partition, hospitalId: 'a::b', connectorId: 'c' } }))).not.toBe(
      workKeyFor(event({ partition: { ...event().partition, hospitalId: 'a', connectorId: 'b::c' } })),
    );
  });

  it('requires the returned connector identity to match the request', () => {
    const outcome = prepareExchangeEvent(
      event(),
      deps({ config: { getConnector: () => config({ connectorId: 'different' }) } }),
    );
    expect(outcome).toMatchObject({ status: 'rejected', reason: 'config_identity_mismatch' });
  });

  it('treats a delivery without a receipt as unknown, not confirmed', async () => {
    const e = event();
    const d = deps();
    const p = prepare(e, d);
    const result = await deliverThroughAdapter(
      adapter(async () => ({ status: 'delivered' }) as unknown as DeliveryResult),
      config(),
      p,
      e,
      {},
    );
    expect(result.status).toBe('failed');
    expect(result).toMatchObject({ classification: 'unknown' });
  });

  it('rejects an endpoint URL containing embedded credentials', () => {
    expect(
      validateConnectorConfig(
        config({ endpoint: { ...endpoint, baseUrl: 'https://secret:password@hospital.example/fhir' } }),
      ),
    ).toContain('invalid_endpoint');
  });

  it('does not let two prevalidated versions of one immutable source event both commit', () => {
    const d = deps();
    const first = prepare(event(), d);
    const second = prepare(event({ versionId: 'opaque-b' }), d);
    expect(commitPreparedExchange(first, { kind: 'test', payload: 'first' }, d).status).toBe('committed');
    expect(commitPreparedExchange(second, { kind: 'test', payload: 'second' }, d).status).not.toBe('committed');
    expect(d.store.effects.length).toBe(1);
  });

  it('rejects an event endpoint mismatch before invoking the transport', async () => {
    const e = event();
    const p = prepare(e, deps());
    let calls = 0;
    const result = await deliverThroughAdapter(
      adapter(async () => {
        calls++;
        return { status: 'delivered', receipt: { receiptId: 'receipt1', acknowledgedAt: '2026-09-07T00:00:00Z' } };
      }),
      config(),
      p,
      { ...e, endpoint: { ...endpoint, baseUrl: 'https://different.example/fhir' } },
      {},
    );
    expect(result.status).toBe('failed');
    expect(calls).toBe(0);
  });

  it('records source event identity in the checkpoint rather than the work tuple', () => {
    const e = event();
    const d = deps();
    const p = prepare(e, d);
    const result = commitPreparedExchange(p, { kind: 'test', payload: {} }, d);
    expect(result.status).toBe('committed');
    if (result.status !== 'committed') return;
    expect(result.checkpoint.lastSourceEventId).toBe(e.sourceEventId);
  });
});
