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
  | 'athenahealth'
  | 'eclinicalworks'
  | 'generic_fhir_r4'
  | 'hl7v2_interface_engine';

export type ConnectorStandard = 'fhir_r4' | 'hl7v2';
export type ConnectorEnvironment = 'sandbox' | 'production';
export type VerificationState = 'unverified' | 'verified';
export type ExchangeDirection = 'inbound' | 'outbound';

/** Resource-level operation. Part of the work identity: an update is not a delete. */
export type ExchangeOperation = 'create' | 'update' | 'delete';

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
  /** Public vendor documentation reference. Not a connection or capability claim. */
  docsRef?: string;
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
 * The reference-name heuristics in `profiles.ts` are a lint, NOT a security
 * guarantee: the server is the only place that may hold a credential value.
 */
export interface ConnectorConfig {
  connectorId: string;
  hospitalId: string;
  profile: ConnectorProfileId;
  environment: ConnectorEnvironment;
  enabled: boolean;
  /** Exact approved binding. BOTH values must match the presented endpoint. */
  endpoint: { baseUrl: string; issuer: string };
  /** Server secret reference name, e.g. `EPIC_PROD_CLIENT_SECRET_REF`. */
  secretRef: string;
  capabilities: CapabilityDeclaration[];
  health: ConnectorHealth;
}

/**
 * Full routing partition. Every key that scopes work identity, mapping lookup
 * and checkpoints travels together — never a bare connector id.
 */
export interface ExchangePartition {
  hospitalId: string;
  connectorId: string;
  environment: ConnectorEnvironment;
  direction: ExchangeDirection;
  resourceType: string;
  /** Resource INSTANCE id at the source. Two Observations for one patient are distinct streams. */
  resourceId: string;
  operation: ExchangeOperation;
}

/**
 * Optional source ordering contract. FHIR `versionId` is OPAQUE
 * (https://hl7.org/fhir/R4/http.html — vread / versioning), so it must never be
 * compared numerically or lexicographically. Ordering, when it exists at all,
 * comes from a source-owned cursor that the ADAPTER declares contiguous.
 */
export interface SourceSequence {
  /** Opaque source cursor to persist after a contiguous advance. */
  cursor: string;
  /** The cursor this event continues from, if the source supplies one. */
  previousCursor?: string;
  /**
   * True only when the adapter can prove this event directly follows the stored
   * checkpoint with no gap. A non-contiguous event never advances the cursor.
   */
  contiguous: boolean;
}

/** Immutable exchange envelope. */
export interface ExchangeEvent {
  partition: ExchangePartition;
  /** Immutable id assigned by the source system; dedup key for the event itself. */
  sourceEventId: string;
  /** OPAQUE FHIR versionId (or source equivalent). Never ordered. */
  versionId: string;
  /** Optional source-owned ordering contract. */
  sequence?: SourceSequence;
  mode: ExchangeMode;
  externalPatientId: string;
  externalEncounterId?: string;
  /** Presented endpoint. Both values must equal the approved connector binding. */
  endpoint: { baseUrl: string; issuer: string };
  occurredAt: string;
}

export type OutcomeClassification = 'permanent' | 'retryable' | 'unknown';

/** Per-stream checkpoint. Only ever advanced by a contiguous, committed event. */
export interface Checkpoint {
  /** JSON-array serialization of the stream tuple. Never a delimiter join. */
  streamKey: string;
  /** Last committed OPAQUE version. Stored for provenance, never compared. */
  lastVersionId: string;
  lastSourceEventId: string;
  /** Last contiguous source cursor, or null when the source has no ordering. */
  cursor: string | null;
  updatedAt: string;
}

/** Read-only validation result. Preparing NEVER mutates durable state. */
export interface ExchangePlan {
  partition: ExchangePartition;
  /** JSON-array work identity: partition + operation + opaque version. */
  workKey: string;
  /** JSON-array immutable source-event identity, independent of work identity. */
  sourceEventKey: string;
  streamKey: string;
  versionId: string;
  capability: CapabilityDeclaration;
  patientId: string;
  encounterId: string | null;
  sequence?: SourceSequence;
}

export type PrepareOutcome =
  | { status: 'ready'; plan: ExchangePlan }
  | {
      status: 'duplicate';
      workKey: string;
      reason: 'work_already_committed' | 'source_event_already_seen';
    }
  | { status: 'rejected'; reason: string; classification: OutcomeClassification };

/** Trusted, server-derived providers. Client-supplied membership is never accepted. */
export interface AuthorizationProvider {
  /**
   * True only when this tenant is provisioned for this connector+environment.
   * This is a trusted SERVER seam for transport authorization; it is not, and
   * must not be read as, clinical authorization for the underlying record.
   */
  isConnectorAuthorized(
    hospitalId: string,
    connectorId: string,
    environment: ConnectorEnvironment,
  ): boolean;
}

export interface ConfigProvider {
  /** Lookup is scoped by tenant AND environment; the result is re-verified. */
  getConnector(
    hospitalId: string,
    connectorId: string,
    environment: ConnectorEnvironment,
  ): ConnectorConfig | null;
}

/** Mapping results carry their own tenancy so the router can verify consistency. */
export interface PatientMapping {
  patientId: string;
  hospitalId: string;
}
export interface EncounterMapping {
  encounterId: string;
  hospitalId: string;
  patientId: string;
}

export interface MappingProvider {
  resolvePatient(partition: ExchangePartition, externalPatientId: string): PatientMapping | null;
  resolveEncounter(
    partition: ExchangePartition,
    externalEncounterId: string,
  ): EncounterMapping | null;
}

/** The local effect that must land atomically with the inbox + checkpoint write. */
export interface LocalEffect {
  kind: string;
  payload: unknown;
}

export interface CommitEntry {
  plan: ExchangePlan;
  effect: LocalEffect;
  checkpoint: Checkpoint;
}

export type CommitOutcome =
  | { status: 'committed'; workKey: string; checkpoint: Checkpoint }
  | { status: 'duplicate'; workKey: string }
  | { status: 'failed'; classification: OutcomeClassification; reason: string };

/** An outbound unit of work. Dispatch is a SEPARATE step from the local commit. */
export interface OutboundEntry {
  workKey: string;
  partition: ExchangePartition;
  payload: unknown;
  enqueuedAt: string;
}

/**
 * Transactional store contract.
 *
 * `commit` MUST apply the local effect, the inbox dedup records and the
 * checkpoint advance atomically — all or nothing. The implementation shipped in
 * `testing.ts` is synthetic and explicitly NOT durable.
 */
export interface TransactionalStore {
  readonly durable: boolean;
  hasCommittedWork(workKey: string): boolean;
  hasSeenSourceEvent(sourceEventKey: string): boolean;
  getCheckpoint(streamKey: string): Checkpoint | null;
  commit(entry: CommitEntry): CommitOutcome;
  /** Outbound dispatch queue. Enqueue is not delivery. */
  enqueueOutbound(entry: OutboundEntry): void;
}

export interface RoutingDeps {
  authorization: AuthorizationProvider;
  config: ConfigProvider;
  mapping: MappingProvider;
  store: TransactionalStore;
  /** Injected clock — no ambient Date in the domain module. */
  now: () => Date;
}

/** Authoritative acknowledgement from the receiving system. */
export interface DeliveryReceipt {
  receiptId: string;
  acknowledgedAt: string;
}

/**
 * A delivery is `delivered` ONLY with an authoritative receipt. A throw, a
 * missing receipt or an ambiguous timeout is `unknown` — never delivered, never
 * auto-resent.
 */
export type DeliveryResult =
  | { status: 'delivered'; receipt: DeliveryReceipt }
  | { status: 'failed'; classification: OutcomeClassification; reason?: string };

/** Transport seam. No live SDK or network client is implemented here. */
export interface ConnectorAdapter {
  profile: ConnectorProfileId;
  /** Checked against the resolved capability AND the connector config. */
  supports(capability: CapabilityDeclaration, config: ConnectorConfig): boolean;
  deliver(event: ExchangeEvent, payload: unknown): Promise<DeliveryResult>;
}
