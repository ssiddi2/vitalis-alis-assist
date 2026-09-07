/**
 * Vendor-neutral connector domain types.
 *
 * virtualisONE is a STANDALONE EMR. Everything in this module is OPTIONAL
 * integration scaffolding: it never gates a native clinical workflow, and it
 * performs no network I/O. Profiles are integration TEMPLATES, not certified
 * implementations — no vendor endpoint, path or capability is asserted here.
 */

export type ConnectorProfileId =
  | 'epic'
  | 'oracle_health'
  | 'meditech'
  | 'generic_fhir_r4'
  | 'hl7v2_interface_engine';

export type ConnectorStandard = 'fhir_r4' | 'hl7v2';
export type ConnectorEnvironment = 'sandbox' | 'production';
export type VerificationState = 'unverified' | 'verified';
export type ExchangeDirection = 'inbound' | 'outbound';

/**
 * Delivery mode. HL7 FHIR R4 Subscription permits `rest-hook` and describes
 * polling/history as the alternative (https://hl7.org/fhir/R4/subscription.html).
 * The mode MUST come from the hospital's own confirmed capability, never from
 * the vendor name.
 */
export type ExchangeMode = 'push_subscription' | 'polling';

/** One declared endpoint capability. Verification is per endpoint, never per vendor. */
export interface CapabilityDeclaration {
  resource: string;
  direction: ExchangeDirection;
  mode: ExchangeMode;
  /** `verified` only after this hospital's own connectivity evidence is approved. */
  verification: VerificationState;
}

/** An extensible integration template. Contains no endpoints and no credentials. */
export interface ConnectorProfile {
  id: ConnectorProfileId;
  label: string;
  standard: ConnectorStandard;
  /** Template capabilities. Always emitted as `unverified`. */
  templateCapabilities: CapabilityDeclaration[];
  notes: string;
}

export type ConnectorHealthState =
  | 'not_configured'
  | 'pending'
  | 'ok'
  | 'degraded'
  | 'unknown';

export interface ConnectorHealth {
  state: ConnectorHealthState;
  /** ISO timestamp of the last health evaluation, if any. */
  checkedAt: string | null;
  /** ISO timestamp of the last accepted exchange, if any. */
  lastEventAt: string | null;
}

/**
 * Per-connector configuration. Browser-safe by construction: it carries only a
 * server-side secret REFERENCE NAME — never a token, key or credential value.
 */
export interface ConnectorConfig {
  connectorId: string;
  hospitalId: string;
  profile: ConnectorProfileId;
  environment: ConnectorEnvironment;
  enabled: boolean;
  /** Exact approved binding. Both must match the event/session exactly. */
  endpoint: { baseUrl: string; issuer: string };
  /** Server secret reference name, e.g. `EPIC_PROD_CLIENT_SECRET_REF`. */
  secretRef: string;
  capabilities: CapabilityDeclaration[];
  health: ConnectorHealth;
}

/** Immutable exchange envelope. */
export interface ExchangeEvent {
  hospitalId: string;
  connectorId: string;
  environment: ConnectorEnvironment;
  /** Immutable id assigned by the source system. */
  sourceEventId: string;
  /** Monotonic per-resource version from the source system. */
  resourceVersion: number;
  resource: string;
  direction: ExchangeDirection;
  mode: ExchangeMode;
  externalPatientId: string;
  externalEncounterId?: string;
  /** Issuer that presented the event; must match the connector binding exactly. */
  issuer: string;
  occurredAt: string;
}

export type OutcomeClassification = 'permanent' | 'retryable' | 'unknown';

export type RouteOutcome =
  | {
      status: 'accepted';
      idempotencyKey: string;
      hospitalId: string;
      connectorId: string;
      /** Internal ids resolved through the trusted mapping provider. */
      patientId: string;
      encounterId: string | null;
      checkpoint: Checkpoint;
    }
  | { status: 'duplicate'; idempotencyKey: string; reason: 'already_processed' }
  | { status: 'rejected'; reason: string; classification: OutcomeClassification };

/** Per-resource delivery checkpoint. */
export interface Checkpoint {
  /** `${hospitalId}::${connectorId}::${environment}::${resource}::${externalPatientId}` */
  streamKey: string;
  lastVersion: number;
  lastSourceEventId: string;
  updatedAt: string;
}

/** Trusted, server-derived providers. Client-supplied membership is never accepted. */
export interface AuthorizationProvider {
  /** True only when this tenant is provisioned for this connector+environment. */
  isConnectorAuthorized(
    hospitalId: string,
    connectorId: string,
    environment: ConnectorEnvironment,
  ): boolean;
}

export interface ConfigProvider {
  getConnector(connectorId: string): ConnectorConfig | null;
}

export interface MappingProvider {
  /** External→internal patient id, scoped to the connector. */
  resolvePatient(connectorId: string, externalPatientId: string): string | null;
  resolveEncounter(connectorId: string, externalEncounterId: string): string | null;
}

/**
 * Checkpoint/idempotency ledger contract.
 *
 * The in-memory implementation shipped for tests is NOT durable delivery
 * infrastructure. A production runtime must back this with a durable,
 * transactional store.
 */
export interface LedgerStore {
  hasProcessed(idempotencyKey: string): boolean;
  markProcessed(idempotencyKey: string): void;
  getCheckpoint(streamKey: string): Checkpoint | null;
  putCheckpoint(checkpoint: Checkpoint): void;
}

export interface RoutingDeps {
  authorization: AuthorizationProvider;
  config: ConfigProvider;
  mapping: MappingProvider;
  ledger: LedgerStore;
  /** Injected clock — no ambient Date in the domain module. */
  now: () => Date;
}

export interface DeliveryResult {
  status: 'delivered' | 'failed';
  classification?: OutcomeClassification;
  reason?: string;
}

/** Transport seam. No live SDK or network client is implemented here. */
export interface ConnectorAdapter {
  profile: ConnectorProfileId;
  supports(capability: CapabilityDeclaration): boolean;
  deliver(event: ExchangeEvent, payload: unknown): Promise<DeliveryResult>;
}
