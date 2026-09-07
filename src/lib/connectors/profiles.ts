import type { CapabilityDeclaration, ConnectorProfile, ConnectorProfileId } from './types';

/**
 * Integration TEMPLATES only.
 *
 * No vendor host, path, OAuth detail or certified capability is asserted, and
 * no connection to any vendor is claimed. Every template capability is emitted
 * `unverified`; it becomes `verified` only from a hospital's own approved
 * connectivity evidence, per endpoint.
 */

const fhirTemplate = (): CapabilityDeclaration[] => [
  { resource: 'Patient', direction: 'inbound', mode: 'polling', verification: 'unverified' },
  { resource: 'Encounter', direction: 'inbound', mode: 'polling', verification: 'unverified' },
  { resource: 'Observation', direction: 'inbound', mode: 'polling', verification: 'unverified' },
  { resource: 'DocumentReference', direction: 'outbound', mode: 'polling', verification: 'unverified' },
];

export const CONNECTOR_PROFILES: Record<ConnectorProfileId, ConnectorProfile> = {
  epic: {
    id: 'epic',
    label: 'Epic (template)',
    standard: 'fhir_r4',
    templateCapabilities: fhirTemplate(),
    notes: 'Template only. Endpoints, scopes and supported resources come from the hospital’s own Epic configuration.',
  },
  oracle_health: {
    id: 'oracle_health',
    label: 'Oracle Health / Cerner (template)',
    standard: 'fhir_r4',
    templateCapabilities: fhirTemplate(),
    notes: 'Template only. No Oracle Health endpoint or capability is asserted.',
  },
  meditech: {
    id: 'meditech',
    label: 'Meditech (template)',
    standard: 'fhir_r4',
    templateCapabilities: fhirTemplate(),
    notes: 'Template only. No Meditech endpoint or capability is asserted.',
  },
  athenahealth: {
    id: 'athenahealth',
    label: 'athenahealth (template)',
    standard: 'fhir_r4',
    templateCapabilities: fhirTemplate(),
    notes:
      'Template only, unverified. athenahealth publishes FHIR R4 documentation (e.g. DocumentReference); actual practice endpoints, scopes and enabled resources come from the hospital’s own athenahealth configuration. No connection or certification is claimed.',
    docsRef: 'https://docs.athenahealth.com/api/fhir-r4/document-reference',
  },
  eclinicalworks: {
    id: 'eclinicalworks',
    label: 'eClinicalWorks (template)',
    standard: 'fhir_r4',
    templateCapabilities: fhirTemplate(),
    notes:
      'Template only, unverified. Interoperability options are documented by the vendor; the practice’s own endpoint, resource set and exchange mode must be confirmed per site. No connection or certification is claimed.',
    docsRef: 'https://www.eclinicalworks.com/products-services/interoperability/',
  },
  generic_fhir_r4: {
    id: 'generic_fhir_r4',
    label: 'Generic FHIR R4 server',
    standard: 'fhir_r4',
    templateCapabilities: fhirTemplate(),
    notes:
      'Baseline FHIR R4. Subscription rest-hook vs polling/history is decided by the hospital’s confirmed capability, not by vendor name (hl7.org/fhir/R4/subscription.html).',
  },
  hl7v2_interface_engine: {
    id: 'hl7v2_interface_engine',
    label: 'HL7 v2 interface engine',
    standard: 'hl7v2',
    templateCapabilities: [
      { resource: 'ADT', direction: 'inbound', mode: 'polling', verification: 'unverified' },
      { resource: 'ORU', direction: 'inbound', mode: 'polling', verification: 'unverified' },
      { resource: 'ORM', direction: 'outbound', mode: 'polling', verification: 'unverified' },
    ],
    notes: 'Template only. Message set, encoding and transport are per-site interface-engine configuration.',
  },
};

export const listProfiles = (): ConnectorProfile[] => Object.values(CONNECTOR_PROFILES);

const SECRET_REF = /^[A-Z][A-Z0-9_]{2,80}$/;
/**
 * Lint heuristic for values that look like credentials. This is a developer
 * guard, NOT a browser-safety guarantee: the only real protection is that
 * credential VALUES never leave the server.
 */
const SECRET_VALUE_HINT = /(bearer\s|eyJ[A-Za-z0-9_-]{6,}|-----BEGIN|[A-Za-z0-9_-]{40,})/;

export type ConfigProblem =
  | 'unknown_profile'
  | 'missing_hospital'
  | 'missing_connector_id'
  | 'invalid_endpoint'
  | 'invalid_issuer'
  | 'invalid_secret_ref'
  | 'secret_value_in_config'
  | 'capability_not_in_profile';

/**
 * HTTPS, no embedded credentials, no query/fragment. A binding must be an exact
 * approved origin+path, never a URL carrying userinfo or token parameters.
 */
const isCleanHttps = (value: string) => {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  if (url.protocol !== 'https:') return false;
  if (url.username || url.password) return false;
  if (url.search || url.hash) return false;
  return true;
};

/** Pure, offline validation of a connector configuration. Fails closed. */
export function validateConnectorConfig(config: {
  connectorId: string;
  hospitalId: string;
  profile: string;
  endpoint: { baseUrl: string; issuer: string };
  secretRef: string;
  capabilities: CapabilityDeclaration[];
}): ConfigProblem[] {
  const problems: ConfigProblem[] = [];
  // Own-property check: an inherited key such as `constructor` is not a profile.
  const known = Object.prototype.hasOwnProperty.call(CONNECTOR_PROFILES, config.profile);
  const profile = known ? CONNECTOR_PROFILES[config.profile as ConnectorProfileId] : undefined;
  if (!profile) problems.push('unknown_profile');
  if (!config.hospitalId) problems.push('missing_hospital');
  if (!config.connectorId) problems.push('missing_connector_id');
  if (!isCleanHttps(config.endpoint?.baseUrl ?? '')) problems.push('invalid_endpoint');
  if (!isCleanHttps(config.endpoint?.issuer ?? '')) problems.push('invalid_issuer');
  if (!SECRET_REF.test(config.secretRef ?? '')) problems.push('invalid_secret_ref');
  if (SECRET_VALUE_HINT.test(config.secretRef ?? '')) problems.push('secret_value_in_config');
  if (
    profile &&
    (config.capabilities ?? []).some(
      (c) => !profile.templateCapabilities.some((t) => t.resource === c.resource && t.direction === c.direction),
    )
  ) {
    problems.push('capability_not_in_profile');
  }
  return problems;
}
