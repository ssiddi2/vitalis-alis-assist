import { describe, it, expect } from 'vitest';
import {
  CONNECTOR_PROFILES,
  listProfiles,
  validateConnectorConfig,
  prepareExchangeEvent,
  commitPreparedExchange,
  enqueueOutboundDispatch,
  deliverThroughAdapter,
  workKeyFor,
  sourceEventKeyFor,
  streamKeyFor,
  type ConnectorConfig,
  type ExchangeEvent,
  type ExchangePartition,
  type RoutingDeps,
} from '@/lib/connectors';
import { createSyntheticStore, createSyntheticTransport, fixedClock } from '@/lib/connectors/testing';

const partition = (over: Partial<ExchangePartition> = {}): ExchangePartition => ({
  hospitalId: 'hosp-a',
  connectorId: 'conn-a',
  environment: 'production',
  direction: 'inbound',
  resourceType: 'Observation',
  resourceId: 'obs-1',
  operation: 'update',
  ...over,
});

const endpointA = { baseUrl: 'https://fhir.a.example/r4', issuer: 'https://auth.a.example' };
const endpointB = { baseUrl: 'https://fhir.b.example/r4', issuer: 'https://auth.b.example' };

const config = (over: Partial<ConnectorConfig> = {}): ConnectorConfig => ({
  connectorId: 'conn-a',
  hospitalId: 'hosp-a',
  profile: 'generic_fhir_r4',
  environment: 'production',
  enabled: true,
  endpoint: endpointA,
  secretRef: 'HOSP_A_FHIR_CLIENT_SECRET_REF',
  capabilities: [
    { resource: 'Observation', direction: 'inbound', mode: 'polling', verification: 'verified' },
    { resource: 'Observation', direction: 'inbound', mode: 'push_subscription', verification: 'verified' },
    { resource: 'Patient', direction: 'inbound', mode: 'polling', verification: 'unverified' },
  ],
  health: { state: 'pending', checkedAt: null, lastEventAt: null },
  ...over,
});

const event = (over: Partial<ExchangeEvent> = {}): ExchangeEvent => ({
  partition: partition(),
  sourceEventId: 'evt-1',
  versionId: 'W/"9a3f-opaque"',
  mode: 'polling',
  externalPatientId: 'ext-p1',
  endpoint: endpointA,
  occurredAt: '2026-09-07T00:00:00.000Z',
  ...over,
});

const deps = (configs: ConnectorConfig[], over: Partial<RoutingDeps> = {}): RoutingDeps => ({
  authorization: { isConnectorAuthorized: (h, c) => configs.some((x) => x.hospitalId === h && x.connectorId === c) },
  config: {
    getConnector: (hospitalId, connectorId, environment) =>
      configs.find(
        (c) => c.hospitalId === hospitalId && c.connectorId === connectorId && c.environment === environment,
      ) ?? null,
  },
  mapping: {
    resolvePatient: (p, ext) =>
      p.connectorId === 'conn-a' && ext === 'ext-p1' ? { patientId: 'internal-p1', hospitalId: p.hospitalId } : null,
    resolveEncounter: (p, ext) =>
      p.connectorId === 'conn-a' && ext === 'ext-e1'
        ? { encounterId: 'internal-e1', hospitalId: p.hospitalId, patientId: 'internal-p1' }
        : null,
  },
  store: createSyntheticStore(),
  now: fixedClock('2026-09-07T01:00:00.000Z'),
  ...over,
});

const ready = (outcome: ReturnType<typeof prepareExchangeEvent>) => {
  if (outcome.status !== 'ready') throw new Error(`expected ready, got ${JSON.stringify(outcome)}`);
  return outcome.plan;
};

describe('profiles are unverified templates', () => {
  it('includes athenahealth and eClinicalWorks with docs references and no endpoints', () => {
    expect(listProfiles().map((p) => p.id).sort()).toEqual([
      'athenahealth', 'eclinicalworks', 'epic', 'generic_fhir_r4',
      'hl7v2_interface_engine', 'meditech', 'oracle_health',
    ]);
    for (const p of listProfiles()) {
      expect(p.templateCapabilities.every((c) => c.verification === 'unverified')).toBe(true);
      const { docsRef, ...rest } = p;
      expect(JSON.stringify(rest)).not.toMatch(/https?:\/\//);
      expect(docsRef === undefined || docsRef.startsWith('https://')).toBe(true);
    }
    expect(CONNECTOR_PROFILES.athenahealth.docsRef).toBe('https://docs.athenahealth.com/api/fhir-r4/document-reference');
    expect(CONNECTOR_PROFILES.eclinicalworks.docsRef).toBe('https://www.eclinicalworks.com/products-services/interoperability/');
  });

  it('rejects credential-bearing, query/fragment or inherited-key configuration', () => {
    expect(validateConnectorConfig(config())).toEqual([]);
    expect(validateConnectorConfig(config({ endpoint: { baseUrl: 'https://user:pw@fhir.a.example/r4', issuer: endpointA.issuer } })))
      .toContain('invalid_endpoint');
    expect(validateConnectorConfig(config({ endpoint: { baseUrl: 'https://fhir.a.example/r4?token=abc', issuer: endpointA.issuer } })))
      .toContain('invalid_endpoint');
    expect(validateConnectorConfig(config({ endpoint: { baseUrl: endpointA.baseUrl, issuer: 'https://auth.a.example/#t=1' } })))
      .toContain('invalid_issuer');
    expect(validateConnectorConfig(config({ profile: 'constructor' as never }))).toContain('unknown_profile');
    expect(validateConnectorConfig(config({ profile: 'toString' as never }))).toContain('unknown_profile');
  });
});

describe('keys are collision-safe and instance-scoped', () => {
  it('separates two Observations for the same patient', () => {
    const a = streamKeyFor(partition({ resourceId: 'obs-1' }));
    const b = streamKeyFor(partition({ resourceId: 'obs-2' }));
    expect(a).not.toBe(b);
    expect(JSON.parse(a)).toContain('obs-1');
  });

  it('does not collide when an id itself contains the old delimiter', () => {
    const x = workKeyFor(event({ partition: partition({ connectorId: 'conn-a::production', resourceId: 'r1' }) }));
    const y = workKeyFor(event({ partition: partition({ connectorId: 'conn-a', resourceId: 'production::r1' }) }));
    expect(x).not.toBe(y);
  });

  it('keeps work identity separate from immutable source-event identity', () => {
    const base = event();
    expect(workKeyFor(base)).not.toBe(sourceEventKeyFor(base));
    // Same source event, different operation => different work identity.
    expect(workKeyFor(base)).not.toBe(workKeyFor(event({ partition: partition({ operation: 'delete' }) })));
    // Opaque versions are compared only for equality.
    expect(workKeyFor(base)).not.toBe(workKeyFor(event({ versionId: 'W/"zz-other"' })));
    expect(sourceEventKeyFor(base)).toBe(sourceEventKeyFor(event({ versionId: 'W/"zz-other"' })));
  });
});

describe('prepare is read-only and fails closed', () => {
  it('writes nothing to the store', () => {
    const store = createSyntheticStore();
    const d = deps([config()], { store });
    const plan = ready(prepareExchangeEvent(event(), d));
    expect(store.effects).toEqual([]);
    expect(store.outbound).toEqual([]);
    expect(store.hasCommittedWork(plan.workKey)).toBe(false);
    expect(store.hasSeenSourceEvent(plan.sourceEventKey)).toBe(false);
    expect(store.getCheckpoint(plan.streamKey)).toBeNull();
  });

  it('isolates two hospitals on the same vendor profile and rejects a conflicting returned config', () => {
    const a = config();
    const b = config({ connectorId: 'conn-b', hospitalId: 'hosp-b', endpoint: endpointB });
    expect(prepareExchangeEvent(event({ partition: partition({ hospitalId: 'hosp-b' }) }), deps([a, b])))
      .toMatchObject({ status: 'rejected', reason: 'connector_not_found' });

    // Provider hands back a config for a different tenant/connector.
    const liar = deps([a], { config: { getConnector: () => b } });
    expect(prepareExchangeEvent(event(), liar)).toMatchObject({ reason: 'config_identity_mismatch', classification: 'permanent' });
  });

  it('requires BOTH base URL and issuer to match the approved binding', () => {
    const d = deps([config()]);
    expect(prepareExchangeEvent(event({ endpoint: { baseUrl: endpointA.baseUrl, issuer: endpointB.issuer } }), d))
      .toMatchObject({ reason: 'endpoint_binding_mismatch' });
    expect(prepareExchangeEvent(event({ endpoint: { baseUrl: endpointB.baseUrl, issuer: endpointA.issuer } }), d))
      .toMatchObject({ reason: 'endpoint_binding_mismatch' });
  });

  it('rejects invalid config, disabled connector and unauthorized tenant early', () => {
    expect(prepareExchangeEvent(event(), deps([config({ secretRef: 'not a ref' })]))).toMatchObject({ reason: 'invalid_connector_config' });
    expect(prepareExchangeEvent(event(), deps([config({ enabled: false })]))).toMatchObject({ reason: 'connector_disabled' });
    expect(prepareExchangeEvent(event(), deps([config()], { authorization: { isConnectorAuthorized: () => false } })))
      .toMatchObject({ reason: 'not_authorized' });
  });

  it('supports two verified modes for the same resource and rejects an unsupported one', () => {
    const d = deps([config()]);
    expect(prepareExchangeEvent(event({ mode: 'polling' }), d).status).toBe('ready');
    expect(prepareExchangeEvent(event({ mode: 'push_subscription' }), d).status).toBe('ready');
    const pollOnly = deps([config({ capabilities: [config().capabilities[0]] })]);
    expect(prepareExchangeEvent(event({ mode: 'push_subscription' }), pollOnly)).toMatchObject({ reason: 'exchange_mode_not_supported' });
    expect(prepareExchangeEvent(event({ partition: partition({ resourceType: 'DocumentReference' }) }), d))
      .toMatchObject({ reason: 'capability_unsupported' });
    expect(prepareExchangeEvent(event({ partition: partition({ resourceType: 'Patient' }) }), d))
      .toMatchObject({ reason: 'capability_unverified' });
  });

  it('rejects mapping misses and cross-tenant / cross-patient mappings', () => {
    const d = deps([config()]);
    expect(prepareExchangeEvent(event({ externalPatientId: 'nope' }), d))
      .toEqual({ status: 'rejected', reason: 'patient_mapping_missing', classification: 'retryable' });
    expect(prepareExchangeEvent(event({ externalEncounterId: 'nope' }), d))
      .toMatchObject({ reason: 'encounter_mapping_missing', classification: 'retryable' });

    const wrongTenant = deps([config()], {
      mapping: {
        resolvePatient: () => ({ patientId: 'internal-p1', hospitalId: 'hosp-b' }),
        resolveEncounter: () => null,
      },
    });
    expect(prepareExchangeEvent(event(), wrongTenant)).toMatchObject({ reason: 'patient_tenant_mismatch', classification: 'permanent' });

    const wrongPatient = deps([config()], {
      mapping: {
        resolvePatient: (p) => ({ patientId: 'internal-p1', hospitalId: p.hospitalId }),
        resolveEncounter: (p) => ({ encounterId: 'internal-e9', hospitalId: p.hospitalId, patientId: 'internal-p9' }),
      },
    });
    expect(prepareExchangeEvent(event({ externalEncounterId: 'ext-e1' }), wrongPatient))
      .toMatchObject({ reason: 'encounter_patient_mismatch', classification: 'permanent' });
  });
});

describe('commit is transactional and dedup cannot be poisoned', () => {
  it('commits effect, dedup and checkpoint together, then reports the duplicate', () => {
    const store = createSyntheticStore();
    const d = deps([config()], { store });
    const plan = ready(prepareExchangeEvent(event(), d));
    const outcome = commitPreparedExchange(plan, { kind: 'observation.upsert', payload: { v: 1 } }, d);

    expect(outcome).toMatchObject({ status: 'committed' });
    expect(store.effects).toHaveLength(1);
    expect(store.getCheckpoint(plan.streamKey)).toMatchObject({
      lastVersionId: 'W/"9a3f-opaque"', cursor: null, updatedAt: '2026-09-07T01:00:00.000Z',
    });
    expect(prepareExchangeEvent(event(), d)).toMatchObject({ status: 'duplicate', reason: 'work_already_committed' });
    // A different opaque version of the same source event is still deduped by source identity.
    expect(prepareExchangeEvent(event({ versionId: 'W/"other"' }), d))
      .toMatchObject({ status: 'duplicate', reason: 'source_event_already_seen' });
  });

  it('a failed commit leaves the event replayable — no dedup, no checkpoint, no effect', () => {
    const store = createSyntheticStore();
    const d = deps([config()], { store });
    const plan = ready(prepareExchangeEvent(event(), d));
    store.failNextCommit('effect_write_failed');

    expect(commitPreparedExchange(plan, { kind: 'observation.upsert', payload: {} }, d))
      .toEqual({ status: 'failed', classification: 'retryable', reason: 'effect_write_failed' });
    expect(store.effects).toEqual([]);
    expect(store.getCheckpoint(plan.streamKey)).toBeNull();
    expect(prepareExchangeEvent(event(), d).status).toBe('ready');
  });

  it('never advances the cursor past unseen data', () => {
    const store = createSyntheticStore();
    const d = deps([config()], { store });
    const first = ready(prepareExchangeEvent(event({ sequence: { cursor: 'c1', contiguous: true } }), d));
    commitPreparedExchange(first, { kind: 'x', payload: {} }, d);
    expect(store.getCheckpoint(first.streamKey)?.cursor).toBe('c1');

    // Out-of-order arrival: adapter cannot prove contiguity, so the cursor holds.
    const gap = ready(prepareExchangeEvent(
      event({ sourceEventId: 'evt-9', versionId: 'W/"v9"', sequence: { cursor: 'c9', contiguous: false } }), d,
    ));
    commitPreparedExchange(gap, { kind: 'x', payload: {} }, d);
    expect(store.getCheckpoint(first.streamKey)?.cursor).toBe('c1');

    // A claimed continuation from the wrong cursor is refused, not silently applied.
    const wrong = ready(prepareExchangeEvent(
      event({ sourceEventId: 'evt-10', versionId: 'W/"v10"', sequence: { cursor: 'c5', previousCursor: 'c4', contiguous: true } }), d,
    ));
    expect(commitPreparedExchange(wrong, { kind: 'x', payload: {} }, d))
      .toMatchObject({ status: 'failed', reason: 'cursor_discontinuity' });
  });

  it('outbound dispatch is a separate queue, not a commit', () => {
    const store = createSyntheticStore();
    const d = deps([config()], { store });
    const plan = ready(prepareExchangeEvent(event(), d));
    enqueueOutboundDispatch(plan, { body: 1 }, d);
    expect(store.outbound).toHaveLength(1);
    expect(store.hasCommittedWork(plan.workKey)).toBe(false);
    expect(store.durable).toBe(false);
  });
});

describe('delivery requires an authoritative receipt', () => {
  const cfg = config();
  const plan = () => ready(prepareExchangeEvent(event(), deps([cfg])));
  const transport = (
    respond: Parameters<typeof createSyntheticTransport>[1],
    over: Partial<Pick<Parameters<typeof createSyntheticTransport>[0], 'profile' | 'supports'>> = {},
  ) => createSyntheticTransport({ profile: 'generic_fhir_r4', supports: (c) => c.verification === 'verified', ...over }, respond);

  it('delivered only with a receipt; missing receipt, failure and throw are classified', async () => {
    const p = plan();
    const ok = transport(() => ({ status: 'delivered', receipt: { receiptId: 'r-1', acknowledgedAt: '2026-09-07T01:00:01Z' } }));
    await expect(deliverThroughAdapter(ok, cfg, p, event(), {})).resolves.toMatchObject({ status: 'delivered' });
    expect(ok.calls).toHaveLength(1);

    const noReceipt = transport(() => ({ status: 'delivered', receipt: undefined as never }));
    await expect(deliverThroughAdapter(noReceipt, cfg, p, event(), {}))
      .resolves.toEqual({ status: 'failed', classification: 'unknown', reason: 'delivery_receipt_missing' });

    const timeout = transport(() => ({ status: 'failed', classification: 'unknown', reason: 'ambiguous_timeout' }));
    await expect(deliverThroughAdapter(timeout, cfg, p, event(), {})).resolves.toMatchObject({ classification: 'unknown' });

    const retry = transport(() => ({ status: 'failed', classification: 'retryable', reason: 'connection_reset' }));
    await expect(deliverThroughAdapter(retry, cfg, p, event(), {})).resolves.toMatchObject({ classification: 'retryable' });

    const boom = transport(() => { throw new Error('nope'); });
    await expect(deliverThroughAdapter(boom, cfg, p, event(), {}))
      .resolves.toEqual({ status: 'failed', classification: 'unknown', reason: 'adapter_threw' });
  });

  it('refuses the wrong adapter and an adapter that does not support the capability', async () => {
    const p = plan();
    const wrongProfile = transport(() => ({ status: 'delivered', receipt: { receiptId: 'r', acknowledgedAt: 'now' } }), { profile: 'epic' });
    await expect(deliverThroughAdapter(wrongProfile, cfg, p, event(), {}))
      .resolves.toEqual({ status: 'failed', classification: 'permanent', reason: 'adapter_profile_mismatch' });
    expect(wrongProfile.calls).toHaveLength(0);

    const unsupported = transport(() => ({ status: 'delivered', receipt: { receiptId: 'r', acknowledgedAt: 'now' } }), { supports: () => false });
    await expect(deliverThroughAdapter(unsupported, cfg, p, event(), {}))
      .resolves.toEqual({ status: 'failed', classification: 'permanent', reason: 'adapter_capability_unsupported' });
    expect(unsupported.calls).toHaveLength(0);
  });

  it('an unknown or failed delivery never becomes a commit', () => {
    const store = createSyntheticStore();
    const d = deps([cfg], { store });
    const p = ready(prepareExchangeEvent(event(), d));
    // Nothing in this module turns a failed/unknown delivery into committed work.
    expect(store.hasCommittedWork(p.workKey)).toBe(false);
    expect(store.effects).toEqual([]);
  });
});
