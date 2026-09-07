import { validateConnectorConfig } from './profiles';
import type {
  Checkpoint,
  CommitOutcome,
  ConnectorAdapter,
  ConnectorConfig,
  DeliveryResult,
  ExchangeEvent,
  ExchangePartition,
  ExchangePlan,
  LocalEffect,
  OutcomeClassification,
  PrepareOutcome,
  RoutingDeps,
} from './types';

/**
 * Pure exchange validation. `prepareExchangeEvent` is READ-ONLY: it never marks
 * work processed and never advances a checkpoint. Durable state moves only
 * through `commitPreparedExchange`, which delegates to a transactional store.
 * Every authority (authorization, config, mapping, store, clock) is injected.
 */

const reject = (reason: string, classification: OutcomeClassification): PrepareOutcome => ({
  status: 'rejected',
  reason,
  classification,
});

/** Collision-safe tuple serialization. JSON array, never a delimiter join. */
const tupleKey = (parts: string[]): string => JSON.stringify(parts);

/** Work identity: full partition + operation + OPAQUE version. */
export const workKeyFor = (event: ExchangeEvent): string =>
  tupleKey([
    'work',
    event.partition.hospitalId,
    event.partition.connectorId,
    event.partition.environment,
    event.partition.direction,
    event.partition.resourceType,
    event.partition.resourceId,
    event.partition.operation,
    event.versionId,
  ]);

/** Immutable source-event identity, deliberately separate from work identity. */
export const sourceEventKeyFor = (event: ExchangeEvent): string =>
  tupleKey([
    'source_event',
    event.partition.hospitalId,
    event.partition.connectorId,
    event.partition.environment,
    event.sourceEventId,
  ]);

/** Stream identity: per resource INSTANCE and direction, never per resource type. */
export const streamKeyFor = (partition: ExchangePartition): string =>
  tupleKey([
    'stream',
    partition.hospitalId,
    partition.connectorId,
    partition.environment,
    partition.direction,
    partition.resourceType,
    partition.resourceId,
  ]);

const sameEndpoint = (a: { baseUrl: string; issuer: string }, b: { baseUrl: string; issuer: string }) =>
  a.baseUrl === b.baseUrl && a.issuer === b.issuer;

export function prepareExchangeEvent(event: ExchangeEvent, deps: RoutingDeps): PrepareOutcome {
  const p = event.partition;
  if (!p?.hospitalId || !p.connectorId || !p.resourceType || !p.resourceId || !p.operation) {
    return reject('incomplete_partition', 'permanent');
  }
  if (!event.sourceEventId || !event.versionId) return reject('incomplete_event_identity', 'permanent');

  const config = deps.config.getConnector(p.hospitalId, p.connectorId, p.environment);
  if (!config) return reject('connector_not_found', 'permanent');
  // The returned config is re-verified: a provider must never hand back another
  // tenant's, another connector's or another environment's configuration.
  if (
    config.connectorId !== p.connectorId ||
    config.hospitalId !== p.hospitalId ||
    config.environment !== p.environment
  ) {
    return reject('config_identity_mismatch', 'permanent');
  }
  if (validateConnectorConfig(config).length > 0) return reject('invalid_connector_config', 'permanent');
  if (!config.enabled) return reject('connector_disabled', 'permanent');
  if (!sameEndpoint(config.endpoint, event.endpoint)) return reject('endpoint_binding_mismatch', 'permanent');
  if (!deps.authorization.isConnectorAuthorized(p.hospitalId, p.connectorId, p.environment)) {
    return reject('not_authorized', 'permanent');
  }

  // Mode is part of the capability match: a connector may hold BOTH a verified
  // push and a verified polling capability for the same resource.
  const capability = config.capabilities.find(
    (c) => c.resource === p.resourceType && c.direction === p.direction && c.mode === event.mode,
  );
  if (!capability) {
    const resourceKnown = config.capabilities.some(
      (c) => c.resource === p.resourceType && c.direction === p.direction,
    );
    return reject(resourceKnown ? 'exchange_mode_not_supported' : 'capability_unsupported', 'permanent');
  }
  if (capability.verification !== 'verified') return reject('capability_unverified', 'permanent');

  const workKey = workKeyFor(event);
  const sourceEventKey = sourceEventKeyFor(event);
  if (deps.store.hasCommittedWork(workKey)) {
    return { status: 'duplicate', workKey, reason: 'work_already_committed' };
  }
  if (deps.store.hasSeenSourceEvent(sourceEventKey)) {
    return { status: 'duplicate', workKey, reason: 'source_event_already_seen' };
  }

  const patient = deps.mapping.resolvePatient(p, event.externalPatientId);
  if (!patient) return reject('patient_mapping_missing', 'retryable');
  if (patient.hospitalId !== p.hospitalId) return reject('patient_tenant_mismatch', 'permanent');

  let encounterId: string | null = null;
  if (event.externalEncounterId) {
    const encounter = deps.mapping.resolveEncounter(p, event.externalEncounterId);
    if (!encounter) return reject('encounter_mapping_missing', 'retryable');
    if (encounter.hospitalId !== p.hospitalId) return reject('encounter_tenant_mismatch', 'permanent');
    if (encounter.patientId !== patient.patientId) return reject('encounter_patient_mismatch', 'permanent');
    encounterId = encounter.encounterId;
  }

  return {
    status: 'ready',
    plan: {
      partition: { ...p },
      workKey,
      sourceEventKey,
      sourceEventId: event.sourceEventId,
      endpoint: { ...config.endpoint },
      streamKey: streamKeyFor(p),
      versionId: event.versionId,
      capability: { ...capability },
      patientId: patient.patientId,
      encounterId,
      sequence: event.sequence ? { ...event.sequence } : undefined,
    },
  };
}

/**
 * Atomically commits the local effect, the dedup records and the checkpoint.
 *
 * The cursor advances ONLY for an adapter-declared contiguous event: an
 * out-of-order event must never move the cursor past unseen data. Opaque
 * versions are stored for provenance and never compared.
 */
export function commitPreparedExchange(
  plan: ExchangePlan,
  effect: LocalEffect,
  deps: RoutingDeps,
): CommitOutcome {
  const previous = deps.store.getCheckpoint(plan.streamKey);
  if (plan.sequence?.previousCursor && previous?.cursor && plan.sequence.previousCursor !== previous.cursor) {
    return { status: 'failed', classification: 'retryable', reason: 'cursor_discontinuity' };
  }
  const cursor = plan.sequence?.contiguous ? plan.sequence.cursor : (previous?.cursor ?? null);

  const checkpoint: Checkpoint = {
    streamKey: plan.streamKey,
    lastVersionId: plan.versionId,
    lastSourceEventId: plan.sourceEventId,
    cursor,
    updatedAt: deps.now().toISOString(),
  };
  return deps.store.commit({ plan, effect, checkpoint });
}

/**
 * Enqueues outbound work. Enqueue is NOT delivery, and a delivery outcome never
 * flows back through the inbound commit path.
 */
export function enqueueOutboundDispatch(plan: ExchangePlan, payload: unknown, deps: RoutingDeps): void {
  deps.store.enqueueOutbound({
    workKey: plan.workKey,
    partition: plan.partition,
    payload,
    enqueuedAt: deps.now().toISOString(),
  });
}

/**
 * Runs a delivery through an adapter.
 *
 * `delivered` requires the adapter's authoritative receipt. A missing receipt,
 * a throw or an ambiguous timeout is `unknown`: never delivered, and never
 * automatically resent by this module.
 */
export async function deliverThroughAdapter(
  adapter: ConnectorAdapter,
  config: ConnectorConfig,
  plan: ExchangePlan,
  event: ExchangeEvent,
  payload: unknown,
): Promise<DeliveryResult> {
  // Revalidate the prepared event against current connector configuration.
  const p = event.partition;
  if (
    validateConnectorConfig(config).length > 0 || !config.enabled ||
    config.hospitalId !== p.hospitalId || config.connectorId !== p.connectorId ||
    config.environment !== p.environment ||
    workKeyFor(event) !== plan.workKey ||
    workKeyFor({ ...event, partition: plan.partition }) !== plan.workKey ||
    sourceEventKeyFor(event) !== plan.sourceEventKey ||
    event.sourceEventId !== plan.sourceEventId ||
    streamKeyFor(p) !== plan.streamKey ||
    !sameEndpoint(config.endpoint, event.endpoint) ||
    !sameEndpoint(plan.endpoint, event.endpoint)
  ) {
    return { status: 'failed', classification: 'permanent', reason: 'delivery_binding_mismatch' };
  }
  const currentCapability = config.capabilities.find(
    (c) =>
      c.resource === p.resourceType && c.direction === p.direction &&
      c.mode === event.mode && c.verification === 'verified',
  );
  if (!currentCapability) {
    return { status: 'failed', classification: 'permanent', reason: 'delivery_capability_unverified' };
  }
  if (adapter.profile !== config.profile) {
    return { status: 'failed', classification: 'permanent', reason: 'adapter_profile_mismatch' };
  }
  if (!adapter.supports(currentCapability, config)) {
    return { status: 'failed', classification: 'permanent', reason: 'adapter_capability_unsupported' };
  }
  try {
    const result = await adapter.deliver(event, payload);
    if (result.status === 'delivered') {
      if (!result.receipt?.receiptId) {
        return { status: 'failed', classification: 'unknown', reason: 'delivery_receipt_missing' };
      }
      return result;
    }
    return {
      status: 'failed',
      classification: result.classification ?? 'unknown',
      reason: result.reason,
    };
  } catch {
    return { status: 'failed', classification: 'unknown', reason: 'adapter_threw' };
  }
}
