/**
 * Launch-integration vendor registry (UI copy only).
 *
 * Mirrors the server registry in supabase/functions/_shared/vendors.ts. The
 * server is authoritative for every gate; this file drives labels, checklists
 * and the shipping guide. Nothing here can enable production traffic.
 */

export type VendorKey = 'dosespot' | 'stedi' | 'health_gorilla' | 'docupdate';

export type VendorState =
  | 'not_contracted' | 'baa_pending' | 'sandbox_pending' | 'sandbox_configured'
  | 'certification_testing' | 'production_review' | 'production_verified' | 'suspended';

export const STATE_ORDER: VendorState[] = [
  'not_contracted', 'baa_pending', 'sandbox_pending', 'sandbox_configured',
  'certification_testing', 'production_review', 'production_verified', 'suspended',
];

export const STATE_TONE: Record<VendorState, string> = {
  not_contracted: 'border-slate-200 bg-slate-100 text-slate-600',
  baa_pending: 'border-amber-500/30 bg-amber-500/10 text-amber-600',
  sandbox_pending: 'border-amber-500/30 bg-amber-500/10 text-amber-600',
  sandbox_configured: 'border-blue-500/30 bg-blue-500/10 text-blue-600',
  certification_testing: 'border-blue-500/30 bg-blue-500/10 text-blue-600',
  production_review: 'border-blue-600/40 bg-blue-600/10 text-blue-700',
  production_verified: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-600',
  suspended: 'border-[#EF4444]/40 bg-[#EF4444]/10 text-[#EF4444]',
};

export interface VendorMeta {
  key: VendorKey;
  label: string;
  tagline: string;
  domain: string;
  capabilities: string[];
  secretRefs: string[];
  /** Vendor artifact the owner must obtain → internal step it unlocks. */
  artifacts: { artifact: string; unlocks: string }[];
  certification: string[];
  warning?: string;
}

const SHARED_CHECKLIST = [
  'legal_entity_and_contacts', 'baa_msa_dpa_executed', 'security_questionnaire_returned',
  'implementation_owner_named', 'sandbox_provisioned', 'production_provisioned',
  'test_scripts_executed', 'customer_signoff', 'rollback_and_downtime_plan',
  'incident_notification_path', 'data_retention_and_deletion', 'exit_and_offboarding_plan',
];

export const VENDOR_CHECKLIST: Record<VendorKey, string[]> = {
  dosespot: ['jumpstart_agreement', 'clinic_and_clinician_provisioning', 'provider_identity_proofing',
    'npi_dea_state_authority_metadata', 'two_factor_enrollment_vendor_side', 'surescripts_certification_matrix',
    'epcs_certification_separate', 'go_live_checklist'],
  stedi: ['contract_and_pricing', 'test_api_key_issued', 'payer_directory_reviewed', 'provider_enrollment_submitted',
    'era_835_enrollment', 'eft_setup_separate_from_era', 'trading_partner_testing', 'production_key_issued'],
  health_gorilla: ['lab_account_provisioning', 'interface_activation_per_lab', 'compendium_mapping',
    'specimen_and_order_questions', 'abn_and_medical_necessity', 'psc_and_location_setup',
    'insurance_billing_responsibility', 'critical_result_test_script', 'corrected_and_cancelled_result_scripts'],
  docupdate: ['standalone_only_acknowledged', 'duplicate_entry_reconciliation_workflow', 'non_controlled_only_attested'],
};

export const checklistFor = (key: VendorKey) => [...SHARED_CHECKLIST, ...VENDOR_CHECKLIST[key]];

export const VENDORS: Record<VendorKey, VendorMeta> = {
  dosespot: {
    key: 'dosespot',
    label: 'DoseSpot Jumpstart',
    tagline: 'Embedded Surescripts-certified ePrescribing',
    domain: 'Medications / e-Rx',
    capabilities: ['new_rx', 'cancel_rx', 'rx_renewal', 'rx_change', 'rx_fill', 'med_history', 'epcs'],
    secretRefs: [
      'DOSESPOT_{TEST|PROD}_CLINIC_ID_REF', 'DOSESPOT_{TEST|PROD}_USER_ID_REF',
      'DOSESPOT_{TEST|PROD}_CLINIC_KEY_REF', 'DOSESPOT_{TEST|PROD}_SUBSCRIPTION_KEY_REF',
    ],
    artifacts: [
      { artifact: 'Signed Jumpstart agreement + BAA', unlocks: 'Move sandbox profile out of not_contracted' },
      { artifact: 'Partner package (hosts, SSO/launch rules, endpoint + signing schema)', unlocks: 'Enables the embedded launch boundary and live transport' },
      { artifact: 'Sandbox clinic + clinician IDs', unlocks: 'Provider onboarding and non-controlled capability gate' },
      { artifact: 'Surescripts certification signoff', unlocks: 'certification_testing → production_review' },
      { artifact: 'EPCS certification + identity proofing + 2FA enrollment', unlocks: 'Controlled-substance gate (separate from new_rx)' },
      { artifact: 'Webhook signing secret', unlocks: 'Releases inbound events from quarantine' },
    ],
    certification: ['NewRx', 'CancelRx / CancelRxResponse', 'RxRenewalRequest', 'RxChangeRequest', 'RxFill',
      'Prescription status events', 'Medication history', 'Directed/undirected renewals', 'EPCS (separate certification)'],
    warning: 'Jumpstart and Surescripts approval are expected. Production is NOT LIVE until independently verified.',
  },
  stedi: {
    key: 'stedi',
    label: 'Stedi Clearinghouse',
    tagline: '270/271, 837P, 276/277, 277CA, 835 and 275 attachments',
    domain: 'Revenue cycle',
    capabilities: ['payer_directory', 'enrollment', 'eligibility_270_271', 'claim_837p', 'claim_status_276_277', 'ack_277ca', 'era_835', 'attachment_275'],
    secretRefs: ['STEDI_TEST_API_KEY_REF (sandbox)', 'STEDI_PROD_API_KEY_REF (production)'],
    artifacts: [
      { artifact: 'Contract + BAA + pricing schedule', unlocks: 'Sandbox provisioning' },
      { artifact: 'Test API key', unlocks: 'Payer directory + mock eligibility test connection' },
      { artifact: 'Payer transaction enrollment approvals', unlocks: 'provider_payer_enrollments per payer/transaction' },
      { artifact: 'ERA (835) enrollment approval', unlocks: 'Remittance work queue (EFT is a separate bank setup)' },
      { artifact: 'Trading-partner test results', unlocks: 'certification_testing → production_review' },
      { artifact: 'Production API key + event destination secret', unlocks: 'production_review → production_verified (with independent approval)' },
    ],
    certification: ['Payer directory / transactionSupport lookup', 'Real-time 270/271', 'Batch eligibility',
      '837P submission + 999/277CA acknowledgement', '276/277 claim status', '835 ERA posting', '275 attachments (where supported)'],
    warning: 'Receiving an 835 never implies EFT is configured. EFT is arranged separately with the payer/bank.',
  },
  health_gorilla: {
    key: 'health_gorilla',
    label: 'Health Gorilla Lab Network',
    tagline: 'FHIR R4 / OAuth 2.0 national lab ordering and results',
    domain: 'Diagnostics',
    capabilities: ['oauth_token', 'iframe_ordering', 'service_request', 'diagnostic_report', 'observation', 'document_reference', 'subscription'],
    secretRefs: ['HEALTH_GORILLA_{SANDBOX|PROD}_CLIENT_ID_REF', 'HEALTH_GORILLA_{SANDBOX|PROD}_CLIENT_SECRET_REF'],
    artifacts: [
      { artifact: 'Contract + BAA', unlocks: 'Sandbox tenant provisioning' },
      { artifact: 'OAuth client id/secret + token URL', unlocks: 'Server-side token handling and sandbox FHIR reads' },
      { artifact: 'Per-lab account + interface activation', unlocks: 'Shows that specific lab as enabled for this tenant' },
      { artifact: 'Compendium / test-code mapping file', unlocks: 'Order build and result mapping' },
      { artifact: 'iFrame ordering launch configuration', unlocks: 'Fastest go-live ordering boundary' },
      { artifact: 'Subscription/event credentials', unlocks: 'Result ingestion into external_record_staging' },
    ],
    certification: ['Patient create/search', 'Lab/Organization discovery', 'ServiceRequest / requisition ordering',
      'DiagnosticReport + Observation retrieval', 'DocumentReference / Binary', 'Corrected results', 'Cancelled orders',
      'Critical result acknowledgement', 'Downtime procedure'],
    warning: 'Network membership is not lab access. Only labs with an activated interface for this tenant are shown as enabled.',
  },
  docupdate: {
    key: 'docupdate',
    label: 'DocUpdate',
    tagline: 'STANDALONE · NOT INTEGRATED · NON-CONTROLLED ONLY',
    domain: 'Interim runbook',
    capabilities: [],
    secretRefs: [],
    artifacts: [
      { artifact: 'Signed vendor integration agreement + API', unlocks: 'The only path to any integration; none exists today' },
    ],
    certification: [],
    warning: 'No PHI may be sent, deep-linked or synchronized. If used during launch, every prescription must be duplicate-entered in VirtualisONE, which remains the system-of-record audit trail. It is never a substitute for that record, and never for controlled substances.',
  },
};

export const VENDOR_ORDER: VendorKey[] = ['dosespot', 'stedi', 'health_gorilla', 'docupdate'];
