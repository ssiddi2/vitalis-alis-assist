import type {
  Checkpoint,
  ConnectorAdapter,
  DeliveryResult,
  ExchangeEvent,
  OutcomeClassification,
  RouteOutcome,
  RoutingDeps,
} from './types';

/**
 * Pure exchange routing/validation. No network, no ambient clock, no client
 * membership proof: every authority (authorization, config, mapping, ledger,
 * clock) is injected. Every unmet condition fails closed.
 */

const reject = (reason: string, classification: OutcomeClassification): RouteOutcome => ({
  status: 'rejected',
  reason,
  classification,
});

export const idempotencyKeyFor = (event: ExchangeEvent): string =>
  [
    event.hospitalId,
    event.connectorId,
    event.environment,
    event.sourceEventId,
    String(event.resourceVersion),
  ].join('::');

export const streamKeyFor = (event: ExchangeEvent): string =>
  [event.hospitalId, event.connectorId, event.environment, event.resource, event.externalPatientId].join('::');

export function routeExchangeEvent(event: ExchangeEvent, deps: RoutingDeps): RouteOutcome {
  const config = deps.config.getConnector(event.connectorId);
  if (!config) return reject('connector_not_found', 'permanent');
  if (config.hospitalId !== event.hospitalId) return reject('tenant_mismatch', 'permanent');
  if (config.environment !== event.environment) return reject('environment_mismatch', 'permanent');
  if (!config.enabled) return reject('connector_disabled', 'permanent');
  if (config.endpoint.issuer !== event.issuer) return reject('issuer_binding_mismatch', 'permanent');
  if (!deps.authorization.isConnectorAuthorized(event.hospitalId, event.connectorId, event.environment)) {
    return reject('not_authorized', 'permanent');
  }

  const capability = config.capabilities.find(
    (c) => c.resource === event.resource && c.direction === event.direction,
  );
  if (!capability) return reject('capability_unsupported', 'permanent');
  if (capability.mode !== event.mode) return reject('exchange_mode_not_supported', 'permanent');
  if (capability.verification !== 'verified') return reject('capability_unverified', 'permanent');

  const idempotencyKey = idempotencyKeyFor(event);
  if (deps.ledger.hasProcessed(idempotencyKey)) {
    return { status: 'duplicate', idempotencyKey, reason: 'already_processed' };
  }

  const patientId = deps.mapping.resolvePatient(event.connectorId, event.externalPatientId);
  if (!patientId) return reject('patient_mapping_missing', 'retryable');

  let encounterId: string | null = null;
  if (event.externalEncounterId) {
    encounterId = deps.mapping.resolveEncounter(event.connectorId, event.externalEncounterId);
    if (!encounterId) return reject('encounter_mapping_missing', 'retryable');
  }

  const streamKey = streamKeyFor(event);
  const previous = deps.ledger.getCheckpoint(streamKey);
  if (previous && event.resourceVersion <= previous.lastVersion) {
    return reject('stale_resource_version', 'permanent');
  }

  const checkpoint: Checkpoint = {
    streamKey,
    lastVersion: event.resourceVersion,
    lastSourceEventId: event.sourceEventId,
    updatedAt: deps.now().toISOString(),
  };
  deps.ledger.markProcessed(idempotencyKey);
  deps.ledger.putCheckpoint(checkpoint);

  return {
    status: 'accepted',
    idempotencyKey,
    hospitalId: event.hospitalId,
    connectorId: event.connectorId,
    patientId,
    encounterId,
    checkpoint,
  };
}

/** Normalizes an adapter result; anything unclassified is treated as `unknown`. */
export async function deliverThroughAdapter(
  adapter: ConnectorAdapter,
  event: ExchangeEvent,
  payload: unknown,
): Promise<DeliveryResult> {
  try {
    const result = await adapter.deliver(event, payload);
    if (result.status === 'delivered') return result;
    return { status: 'failed', classification: result.classification ?? 'unknown', reason: result.reason };
  } catch {
    return { status: 'failed', classification: 'unknown', reason: 'adapter_threw' };
  }
}
