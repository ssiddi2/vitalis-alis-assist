/**
 * Stedi clearinghouse binding for the VirtualisNote encounter workflow.
 *
 * This module adds NO new clinical model and NO new transport: it resolves the
 * existing `vendor_onboarding` row for Stedi, reuses `stediAdapter`
 * (gateway + allowlist + secret refs) and normalizes vendor responses for the
 * UI. Raw X12 is never produced, persisted or returned — the adapter already
 * strips it, and the 837P "preview" here is a normalized JSON summary only.
 */

import { stediAdapter, stediProductionGate, type PayerEnrollment } from "./vendorAdapters.ts";
import { vendorGate, type OnboardingRow } from "./vendors.ts";
import { stripX12 } from "./vendorEndpoints.ts";

// deno-lint-ignore no-explicit-any
type Db = { from: (t: string) => any };

export type ConnectionLabel = "not_connected" | "sandbox" | "production_verified";

/** Authoritative, server-computed connection banner state. */
export function connectionState(row: OnboardingRow | null, capability: string): {
  label: ConnectionLabel;
  environment: "sandbox" | "production" | null;
  blocked: string | null;
} {
  if (!row) return { label: "not_connected", environment: null, blocked: "no_vendor_profile" };
  const blocked = vendorGate(row, capability, row.environment);
  if (blocked) return { label: "not_connected", environment: row.environment, blocked };
  return {
    label: row.environment === "production" ? "production_verified" : "sandbox",
    environment: row.environment,
    blocked: null,
  };
}

/** Highest-trust Stedi onboarding row for a facility (production preferred). */
export async function loadStediRow(db: Db, hospitalId: string): Promise<OnboardingRow | null> {
  const { data } = await db
    .from("vendor_onboarding")
    .select("id, hospital_id, vendor_key, environment, state, capabilities, secret_ref_names, last_test_result, evidence_expires_at")
    .eq("hospital_id", hospitalId)
    .eq("vendor_key", "stedi")
    .order("environment", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as OnboardingRow) ?? null;
}

/**
 * Financial authority. The app role model is admin | clinician | viewer, so the
 * narrowest existing authorized workflow for billing actions (eligibility
 * refresh, submit, correct, remit) is the facility admin. Clinicians read only.
 */
export async function isBillingAuthorized(db: Db, userId: string, hospitalId: string): Promise<boolean> {
  const [{ data: role }, { data: member }] = await Promise.all([
    db.from("user_roles").select("role").eq("user_id", userId).eq("role", "admin").maybeSingle(),
    db.from("hospital_users").select("user_id").eq("user_id", userId).eq("hospital_id", hospitalId).maybeSingle(),
  ]);
  return !!role && !!member;
}

export interface NormalizedEligibility {
  coverage_active: boolean | null;
  copay_amount: number | null;
  deductible_remaining: number | null;
  coinsurance_percent: number | null;
  plan_begin: string | null;
  plan_end: string | null;
  messages: string[];
}

const num = (v: unknown): number | null => {
  const n = typeof v === "string" ? Number(v) : typeof v === "number" ? v : NaN;
  return Number.isFinite(n) ? n : null;
};

/** Stedi 271 JSON → normalized benefits. Unknown shapes degrade to `unknown`, never to "eligible". */
export function normalizeEligibility(payload: unknown): NormalizedEligibility {
  const out: NormalizedEligibility = {
    coverage_active: null, copay_amount: null, deductible_remaining: null,
    coinsurance_percent: null, plan_begin: null, plan_end: null, messages: [],
  };
  const body = (stripX12(payload) ?? {}) as Record<string, unknown>;
  const benefits = Array.isArray(body.benefitsInformation) ? body.benefitsInformation as Record<string, unknown>[] : [];
  for (const b of benefits) {
    const code = String(b.code ?? "");
    if (code === "1") out.coverage_active = true;
    if (code === "6" || code === "7" || code === "8") out.coverage_active ??= false;
    if (code === "B") out.copay_amount ??= num(b.benefitAmount);
    if (code === "C") out.deductible_remaining ??= num(b.benefitAmount);
    if (code === "A") out.coinsurance_percent ??= num(b.benefitPercent) != null ? num(b.benefitPercent)! * 100 : null;
    const name = typeof b.name === "string" ? b.name : null;
    if (name && out.messages.length < 8 && !out.messages.includes(name)) out.messages.push(name);
    const dates = (b.planDateInformation ?? {}) as Record<string, unknown>;
    out.plan_begin ??= typeof dates.plan === "string" ? dates.plan : typeof dates.planBegin === "string" ? dates.planBegin : null;
    out.plan_end ??= typeof dates.planEnd === "string" ? dates.planEnd : null;
  }
  if (Array.isArray(body.errors) && body.errors.length) out.coverage_active = false;
  return out;
}

/** Normalized (never raw X12) 837P review payload for the billing attestation screen. */
export function professionalClaimPreview(input: {
  claim: Record<string, unknown>;
  lines: Array<Record<string, unknown>>;
  diagnoses: Array<Record<string, unknown>>;
  payerName?: string | null;
}) {
  const { claim, lines, diagnoses, payerName } = input;
  return {
    transaction: "837P",
    billing_type: claim.billing_type,
    place_of_service: claim.place_of_service,
    payer: payerName ?? null,
    rendering_provider_npi: claim.rendering_provider_npi ?? null,
    billing_provider_npi: claim.billing_provider_npi ?? null,
    total_charge: Number(claim.total_charge ?? 0),
    diagnoses: diagnoses.map((d) => ({ code: d.icd10_code, code_set: d.code_set })),
    service_lines: lines.map((l) => ({
      cpt_code: l.cpt_code, units: l.units, charge_amount: Number(l.charge_amount ?? 0),
      modifiers: l.modifiers ?? [], diagnosis_pointers: l.diagnosis_pointers ?? [],
    })),
  };
}

/** Run a Stedi operation through the existing adapter, honouring the production enrollment gate. */
export async function runStedi(
  row: OnboardingRow | null,
  op: {
    capability: string; operation: string; payload?: unknown; params?: Record<string, string>;
    correlationId: string; idempotencyKey: string;
    transaction?: string; providerNpi?: string; payerId?: string;
  },
  enrollments: PayerEnrollment[] = [],
) {
  if (op.transaction) {
    const gate = stediProductionGate(row, {
      capability: op.capability, transaction: op.transaction,
      providerNpi: op.providerNpi ?? "", payerId: op.payerId ?? "",
    }, enrollments);
    if (gate) return { status: "blocked" as const, reason: gate };
  }
  return await stediAdapter.execute(row, {
    capability: op.capability, operation: op.operation, payload: op.payload,
    params: op.params, correlationId: op.correlationId, idempotencyKey: op.idempotencyKey,
  });
}
