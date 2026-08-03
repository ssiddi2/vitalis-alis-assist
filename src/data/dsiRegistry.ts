/**
 * ALIS DSI (Decision-Support Intervention) model-card registry.
 * Single source of truth for ONC §170.315(b)(11) source-attribute governance
 * and point-of-care intelligibility. Static — no schema, no edge function.
 */

export interface DsiRiskFactors {
  validity: string;
  reliability: string;
  robustness: string;
  fairness: string;
  intelligibility: string;
  safety: string;
  security: string;
  privacy: string;
}

export interface DsiEntry {
  id: string;
  name: string;
  category: 'predictive' | 'evidence-based';
  intendedUse: string;
  developer: string;
  fundingSource: string;
  models: string;
  inputs: string;
  outputs: string;
  validationApproach: string;
  cautions: string;
  humanInLoop: string;
  feedbackMechanism: string;
  riskFactors: DsiRiskFactors;
}

const DEVELOPER = 'LiveMed Health Inc. / Virtualis';
const FUNDING = 'Self-funded by LiveMed Health Inc.; no external grant, payer, or pharmaceutical funding.';

export const dsiRegistry: DsiEntry[] = [
  {
    id: 'acuity-engine',
    name: 'ALIS Acuity Engine — clinical message triage',
    category: 'predictive',
    intendedUse:
      'Suggests an acuity level (High / Moderate / Low), likely specialty, and target response time for clinician-authored consult messages, to help route and prioritize communication. Not a diagnosis and not a substitute for clinical triage.',
    developer: DEVELOPER,
    fundingSource: FUNDING,
    models:
      'Three-layer cascade: deterministic red-flag rules → Cohere command-r-plus fast classifier → Claude Sonnet escalation for low-confidence or high-stakes cases (Anthropic → Cohere → gateway failover).',
    inputs:
      'Free-text clinical reason and notes authored by the requesting clinician, optional structured patient context (age, problem list, vitals) scoped to the user\'s hospital.',
    outputs:
      'suggestedUrgency, suggestedSpecialty/-ies, reasoning, confidence score, service category, risk level, immediate actions, estimated response time, extracted keywords.',
    validationApproach:
      'Deterministic rule layer regression-tested against curated red-flag phrasings; model tiers evaluated against clinician-assigned urgency labels on retrospective consult text; every production score is logged with tier and confidence for ongoing agreement monitoring.',
    cautions:
      'Text-only inference — it cannot see the patient. Sparse, atypical, or non-English phrasing may under-call acuity. Never use as the sole basis for withholding or delaying escalation.',
    humanInLoop:
      'The suggestion is presented as an editable default; the sending clinician confirms or overrides the acuity before the consult is submitted. No autonomous routing without clinician confirmation.',
    feedbackMechanism:
      'Clinician overrides and final urgency are captured alongside the model score, forming a labeled feedback set reviewed for drift and used to tune rules and prompts.',
    riskFactors: {
      validity:
        'Evaluated against clinician-assigned urgency on retrospective consults; deterministic red-flag layer guarantees floor behavior for critical phrases.',
      reliability:
        'Same input yields stable output at low temperature; scores are persisted so repeat assessments are auditable and comparable.',
      robustness:
        'Multi-provider failover (Anthropic → Cohere → gateway) plus rule fallback; if all model tiers fail the UI states assessment unavailable rather than guessing.',
      fairness:
        'Inputs exclude race, insurance status, and payer data. Distribution of scores across demographics is monitored; no demographic feature is used as a predictor.',
      intelligibility:
        'Every score ships with plain-language reasoning, confidence, and extracted keywords, plus this model card at the point of care.',
      safety:
        'Advisory only; cannot suppress a message or downgrade a clinician-set urgency. Deterministic rules bias toward over- rather than under-triage.',
      security:
        'Server-side edge function only; JWT-verified, hospital-scoped, rate-limited, locked CORS allowlist. No vendor keys exposed to the browser.',
      privacy:
        'Runs under BAA-covered infrastructure with RLS enforcement; no training on customer PHI, no retention by model vendors beyond the request.',
    },
  },
  {
    id: 'ambient-note',
    name: 'ALIS Ambient Note — SOAP documentation drafting',
    category: 'predictive',
    intendedUse:
      'Drafts a structured SOAP progress note from clinician dictation and available chart context, to reduce documentation burden. The draft is a starting point, never a final record.',
    developer: DEVELOPER,
    fundingSource: FUNDING,
    models: 'Claude Sonnet primary → Cohere → Lovable gateway failover.',
    inputs:
      'Clinician dictation/free text, encounter type, and hospital-scoped chart context (problems, medications, allergies, recent vitals and labs).',
    outputs: 'Draft SOAP note sections and suggested billing codes for clinician review.',
    validationApproach:
      'Prompt and output structure reviewed by clinicians against sample encounters for completeness and absence of fabricated findings; generated notes are compared to the signed version to surface systematic omissions.',
    cautions:
      'Language models can omit or fabricate details. Do not sign a note without reading it in full. Content not stated in the source material must be independently verified.',
    humanInLoop:
      'Output is stored as an unsigned draft attributed to AI. It cannot enter the legal record or be pushed to the EMR until a clinician edits, attests, and signs it.',
    feedbackMechanism:
      'Clinician edits between draft and signed note are retained as an accuracy signal; users can flag a draft as unusable for prompt review.',
    riskFactors: {
      validity:
        'Grounded in supplied dictation and chart data; reviewed against sample encounters for factual alignment with source input.',
      reliability:
        'Deterministic section structure with low-variance decoding; identical input yields consistent note scaffolding.',
      robustness:
        'Provider failover chain; on total failure the clinician documents manually with no loss of workflow.',
      fairness:
        'Note generation is content-driven; no demographic attribute alters clinical wording. Templates are reviewed for stigmatizing language.',
      intelligibility:
        'Drafts are explicitly labeled AI-generated with provenance stamped on the record and this model card available inline.',
      safety:
        'Draft-only with mandatory clinician attestation and signature; no autonomous filing, coding submission, or EMR write-back.',
      security:
        'JWT-verified, hospital-scoped, rate-limited edge function; input validated and size-capped; keys held server-side.',
      privacy:
        'PHI processed under BAA with RLS-enforced access; no vendor training on customer data; audit log entry on every generation.',
    },
  },
  {
    id: 'billing-denial',
    name: 'ALIS Billing Intelligence — code suggestion + denial prediction',
    category: 'predictive',
    intendedUse:
      'Suggests E&M and procedure codes from documented medical decision making and predicts payer denial risk at the point of care so gaps can be corrected before submission. Advisory to coders and clinicians.',
    developer: DEVELOPER,
    fundingSource: FUNDING,
    models: 'Claude Sonnet → Cohere → gateway failover, applied over deterministic AMA E&M MDM rules and the local fee schedule.',
    inputs:
      'Signed or draft documentation, diagnoses, orders and procedures, encounter type, patient insurance/coverage attributes, and hospital fee schedule.',
    outputs:
      'Suggested CPT/E&M codes with MDM rationale, expected reimbursement, denial-risk score, and specific documentation gaps to remediate.',
    validationApproach:
      'Code suggestions checked against AMA MDM level criteria deterministically; denial-risk rules derived from common payer edit categories and reconciled against local billing_events outcomes.',
    cautions:
      'Not a compliance guarantee and not payer-specific adjudication. Upcoding risk exists if documentation is thin — the clinician and coder remain responsible for the submitted claim.',
    humanInLoop:
      'Suggestions appear in the charge-review panel as proposals; a human must accept, modify, or reject each code before any claim is finalized.',
    feedbackMechanism:
      'Accepted vs. rejected codes and downstream denial outcomes are recorded in billing_events and reviewed to recalibrate risk rules.',
    riskFactors: {
      validity:
        'Anchored to explicit AMA MDM criteria rather than free inference; suggestions reconciled against realized claim outcomes.',
      reliability:
        'Rule layer is deterministic; the model layer only explains and fills gaps, keeping code levels reproducible.',
      robustness:
        'If all model tiers fail, deterministic MDM rules and the fee schedule still return a code suggestion.',
      fairness:
        'Coverage type is used only for payer-edit checks, never to alter clinical documentation or care recommendations.',
      intelligibility:
        'Each suggestion lists the MDM elements and documentation gaps that produced it, with reimbursement math shown.',
      safety:
        'No autonomous claim submission; conservative default when documentation does not support a higher level.',
      security:
        'Guarded edge function with auth, hospital scoping, validation, and rate limiting; audit-logged.',
      privacy:
        'Minimum-necessary PHI sent; BAA-covered processing; no vendor retention or training.',
    },
  },
  {
    id: 'order-recommendation',
    name: 'ALIS Order Recommendations — staged clinical orders',
    category: 'predictive',
    intendedUse:
      'Proposes medication, lab, and imaging orders relevant to the active clinical context to reduce ordering friction and omission. Suggestions are staged, never live orders.',
    developer: DEVELOPER,
    fundingSource: FUNDING,
    models: 'Claude Sonnet → Cohere → gateway failover, with deterministic interaction, allergy, and controlled-substance guardrails.',
    inputs:
      'Active problems, medications, allergies, recent labs and vitals, encounter context, and the clinician\'s conversational request to ALIS.',
    outputs:
      'Staged order proposals with rationale, interaction and allergy alerts, and a controlled-substance block where applicable.',
    validationApproach:
      'Proposals are checked against interaction/allergy rules and formulary constraints before display; staged-vs-signed rates and rejections are tracked per order type.',
    cautions:
      'Dosing, renal/hepatic adjustment, pregnancy status, and local formulary must be verified by the prescriber. Controlled substances are blocked pending DEA EPCS certification.',
    humanInLoop:
      'Every proposal enters the staged_orders queue; a licensed clinician must review, sign, and only then is the order transmitted or written back to the EMR.',
    feedbackMechanism:
      'Signed, modified, and rejected staged orders are audit-logged with AI provenance and reviewed to tune recommendation prompts and guardrails.',
    riskFactors: {
      validity:
        'Recommendations constrained by chart context and validated against interaction, allergy, and formulary rules before surfacing.',
      reliability:
        'Guardrail layer is deterministic and always applied, so unsafe proposals are filtered consistently regardless of model tier.',
      robustness:
        'Failover chain across providers; on failure no order is proposed rather than a degraded one.',
      fairness:
        'No demographic or payer attribute influences what is recommended; equity of suggestions monitored across patient panels.',
      intelligibility:
        'Each staged order shows its rationale, source data, and an explicit AI-generated provenance marker.',
      safety:
        'Nothing executes autonomously — staged status plus mandatory clinician signature, hard block on controlled substances.',
      security:
        'Auth-gated, hospital-scoped, rate-limited edge functions; transmission credentials remain server-side.',
      privacy:
        'BAA-covered, RLS-enforced access to chart data; full audit trail on every mutating AI action.',
    },
  },
];

export const getDsiEntry = (id: string): DsiEntry | undefined =>
  dsiRegistry.find((entry) => entry.id === id);

export const RISK_FACTOR_LABELS: Array<[keyof DsiRiskFactors, string]> = [
  ['validity', 'Validity'],
  ['reliability', 'Reliability'],
  ['robustness', 'Robustness'],
  ['fairness', 'Fairness'],
  ['intelligibility', 'Intelligibility'],
  ['safety', 'Safety'],
  ['security', 'Security'],
  ['privacy', 'Privacy'],
];
