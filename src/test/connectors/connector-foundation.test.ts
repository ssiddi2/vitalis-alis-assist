import { describe, it, expect } from 'vitest';
import {
  CONNECTOR_PROFILES,
  listProfiles,
  validateConnectorConfig,
  routeExchangeEvent,
  idempotencyKeyFor,
  deliverThroughAdapter,
  type ConnectorConfig,
  type ExchangeEvent,
  type RoutingDeps,
} from '@/lib/connectors';
import { createInMemoryLedger, createSyntheticTransport, fixedClock } from '@/lib/connectors/testing';

const config = (over: Partial<ConnectorConfig> = {}): ConnectorConfig => ({
  connectorId: 'conn-a',
  hospitalId: 'hosp-a',
  profile: 'generic_fhir_r4',
  environment: 'production',
  enabled: true,
  endpoint: { baseUrl: 'https://fhir.a.example/r4', issuer: 'https://fhir.a.example' },
  secretRef: 'HOSP_A_FHIR_CLIENT_SECRET_REF',
  capabilities: [
    { resource: 'Encounter', direction: 'inbound', mode: 'polling', verification: 'verified' },
    { resource: 'Patient', direction: 'inbound', mode: 'polling', verification: 'unverified' },
  ],
  health: { state: 'pending', checkedAt: null, lastEventAt: null },
  ...over,
});

const event = (over: Partial<ExchangeEvent> = {}): ExchangeEvent => ({
  hospitalId: 'hosp-a',
  connectorId: 'conn-a',
  environment: 'production',
  sourceEventId: 'evt-1',
  resourceVersion: 2,
  resource: 'Encounter',
  direction: 'inbound',
  mode: 'polling',
  externalPatientId: 'ext-p1',
  issuer: 'https://fhir.a.example',
  occurredAt: '2026-09-07T00:00:00.000Z',
  ...over,
});

const deps = (configs: ConnectorConfig[], over: Partial<RoutingDeps> = {}): RoutingDeps => ({
  authorization: { isConnectorAuthorized: (h, c) => configs.some((x) => x.hospitalId === h && x.connectorId === c) },
  config: { getConnector: (id) => configs.find((c) => c.connectorId === id) ?? null },
  mapping: {
    resolvePatient: (connectorId, ext) => (connectorId === 'conn-a' && ext === 'ext-p1' ? 'internal-p1' : null),
    resolveEncounter: (connectorId, ext) => (connectorId === 'conn-a' && ext === 'ext-e1' ? 'internal-e1' : null),
  },
  ledger: createInMemoryLedger(),
  now: fixedClock('2026-09-07T01:00:00.000Z'),
  ...over,
});

describe('connector profiles are templates, not certified implementations', () => {
  it('ships the five extensible profiles with only unverified template capabilities', () => {
    expect(listProfiles().map((p) => p.id).sort()).toEqual(
      ['epic', 'generic_fhir_r4', 'hl7v2_interface_engine', 'meditech', 'oracle_health'],
    );
    for (const p of listProfiles()) {
      expect(p.templateCapabilities.every((c) => c.verification === 'unverified')).toBe(true);
      expect(JSON.stringify(p)).not.toMatch(/https?:\/\//);
    }
    expect(CONNECTOR_PROFILES.hl7v2_interface_engine.standard).toBe('hl7v2');
  });

  it('rejects configuration that carries a credential value or a non-https binding', () => {
    expect(validateConnectorConfig(config())).toEqual([]);
    expect(
      validateConnectorConfig(config({ secretRef: 'eyJhbGciOiJIUzI1NiJ9.abcdefghijklmno' as string })),
    ).toContain('invalid_secret_ref');
    expect(
      validateConnectorConfig(config({ endpoint: { baseUrl: 'http://fhir.a.example', issuer: 'https://fhir.a.example' } })),
    ).toContain('invalid_endpoint');
    expect(
      validateConnectorConfig(config({ profile: 'made_up_vendor' as never })),
    ).toContain('unknown_profile');
  });
});

describe('routing fails closed', () => {
  it('isolates two hospitals running the same vendor profile', () => {
    const a = config();
    const b = config({ connectorId: 'conn-b', hospitalId: 'hosp-b', endpoint: { baseUrl: 'https://fhir.b.example/r4', issuer: 'https://fhir.b.example' } });
    const d = deps([a, b]);
    expect(routeExchangeEvent(event({ hospitalId: 'hosp-b' }), d)).toMatchObject({ status: 'rejected', reason: 'tenant_mismatch' });
    expect(routeExchangeEvent(event({ connectorId: 'conn-b', hospitalId: 'hosp-b' }), d)).toMatchObject({ status: 'rejected', reason: 'issuer_binding_mismatch' });
  });

  it('rejects wrong connector, environment, disabled connector and unauthorized tenant', () => {
    expect(routeExchangeEvent(event({ connectorId: 'nope' }), deps([config()]))).toMatchObject({ reason: 'connector_not_found', classification: 'permanent' });
    expect(routeExchangeEvent(event({ environment: 'sandbox' }), deps([config()]))).toMatchObject({ reason: 'environment_mismatch' });
    expect(routeExchangeEvent(event(), deps([config({ enabled: false })]))).toMatchObject({ reason: 'connector_disabled' });
    const unauth = deps([config()], { authorization: { isConnectorAuthorized: () => false } });
    expect(routeExchangeEvent(event(), unauth)).toMatchObject({ reason: 'not_authorized' });
  });

  it('rejects unsupported, unverified and wrong-mode capabilities', () => {
    const d = deps([config()]);
    expect(routeExchangeEvent(event({ resource: 'Observation' }), d)).toMatchObject({ reason: 'capability_unsupported' });
    expect(routeExchangeEvent(event({ resource: 'Patient' }), d)).toMatchObject({ reason: 'capability_unverified' });
    expect(routeExchangeEvent(event({ mode: 'push_subscription' }), d)).toMatchObject({ reason: 'exchange_mode_not_supported' });
  });

  it('rejects missing patient and encounter mappings as retryable', () => {
    const d = deps([config()]);
    expect(routeExchangeEvent(event({ externalPatientId: 'unknown' }), d)).toEqual({ status: 'rejected', reason: 'patient_mapping_missing', classification: 'retryable' });
    expect(routeExchangeEvent(event({ externalEncounterId: 'unknown' }), d)).toMatchObject({ reason: 'encounter_mapping_missing', classification: 'retryable' });
  });
});

describe('idempotency, versions and checkpoints', () => {
  it('accepts once, treats the identical event as duplicate and advances the checkpoint', () => {
    const d = deps([config()]);
    const first = routeExchangeEvent(event(), d);
    expect(first).toMatchObject({ status: 'accepted', patientId: 'internal-p1', encounterId: null });
    if (first.status !== 'accepted') throw new Error('expected accepted');
    expect(first.checkpoint).toEqual({
      streamKey: 'hosp-a::conn-a::production::Encounter::ext-p1',
      lastVersion: 2,
      lastSourceEventId: 'evt-1',
      updatedAt: '2026-09-07T01:00:00.000Z',
    });
    expect(routeExchangeEvent(event(), d)).toEqual({ status: 'duplicate', idempotencyKey: first.idempotencyKey, reason: 'already_processed' });
  });

  it('treats a distinct resource version as a new event and rejects stale/out-of-order ones', () => {
    const d = deps([config()]);
    routeExchangeEvent(event(), d);
    expect(routeExchangeEvent(event({ sourceEventId: 'evt-2', resourceVersion: 3 }), d)).toMatchObject({ status: 'accepted' });
    expect(routeExchangeEvent(event({ sourceEventId: 'evt-0', resourceVersion: 1 }), d)).toMatchObject({ reason: 'stale_resource_version', classification: 'permanent' });
    expect(idempotencyKeyFor(event())).not.toEqual(idempotencyKeyFor(event({ resourceVersion: 3 })));
  });

  it('scopes the idempotency key to tenant, connector and environment', () => {
    const key = idempotencyKeyFor(event());
    expect(key).toBe('hosp-a::conn-a::production::evt-1::2');
    expect(idempotencyKeyFor(event({ hospitalId: 'hosp-b' }))).not.toBe(key);
  });

  it('the shipped ledger is explicitly non-durable', () => {
    expect(createInMemoryLedger().durable).toBe(false);
  });
});

describe('adapter transport is synthetic and classifies failures', () => {
  const adapter = (result: Parameters<typeof createSyntheticTransport>[1]) =>
    createSyntheticTransport({ profile: 'generic_fhir_r4', supports: (c) => c.verification === 'verified' }, result);

  it('returns retryable, unknown and delivered outcomes without any network call', async () => {
    const ok = adapter(() => ({ status: 'delivered' }));
    await expect(deliverThroughAdapter(ok, event(), { a: 1 })).resolves.toEqual({ status: 'delivered' });
    expect(ok.calls).toHaveLength(1);

    const retry = adapter(() => ({ status: 'failed', classification: 'retryable', reason: 'timeout' }));
    await expect(deliverThroughAdapter(retry, event(), {})).resolves.toMatchObject({ classification: 'retryable' });

    const vague = adapter(() => ({ status: 'failed' }));
    await expect(deliverThroughAdapter(vague, event(), {})).resolves.toMatchObject({ classification: 'unknown' });

    const boom = adapter(() => { throw new Error('nope'); });
    await expect(deliverThroughAdapter(boom, event(), {})).resolves.toEqual({ status: 'failed', classification: 'unknown', reason: 'adapter_threw' });
  });
});
