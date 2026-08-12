import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { isTenantScoped, loadEffectivePolicies } from "./policyParser";

/**
 * Certification, compliance and external-dependency gap matrix (launch requirement 8).
 *
 * Proves from the migrations that false certification claims, self-attestation,
 * mutation of verified evidence, expired attestations, undocumented not-applicable
 * decisions, gate bypass and cross-tenant or anonymous access are all denied.
 */
const MIGRATIONS = path.resolve(process.cwd(), "supabase/migrations");
const sql = readdirSync(MIGRATIONS)
  .filter((f) => f.endsWith(".sql"))
  .sort()
  .map((f) => readFileSync(path.join(MIGRATIONS, f), "utf8"))
  .join("\n");

const policies = loadEffectivePolicies();
const TABLES = ["compliance_requirements", "compliance_assessments", "compliance_attestations"] as const;

describe("compliance matrix tenancy", () => {
  it.each(TABLES)("%s enables row level security", (t) => {
    expect(sql).toMatch(new RegExp(`ALTER TABLE public\\.${t} ENABLE ROW LEVEL SECURITY`));
  });

  it.each(TABLES)("%s scopes every policy to the caller's facility", (t) => {
    const rows = policies.get(t) ?? [];
    expect(rows.length).toBeGreaterThan(0);
    for (const p of rows) expect(isTenantScoped(p.expr)).toBe(true);
  });

  it.each(TABLES)("%s grants nothing to anonymous callers", (t) => {
    expect(sql).not.toMatch(new RegExp(`GRANT[^;]*ON public\\.${t} TO[^;]*anon`));
  });

  it("keeps the readiness aggregation away from anonymous callers", () => {
    expect(sql).toMatch(/REVOKE ALL ON FUNCTION public\.compliance_readiness\(uuid\) FROM anon/);
    expect(sql).toMatch(/GRANT EXECUTE ON FUNCTION public\.compliance_readiness\(uuid\) TO authenticated, service_role/);
  });

  it("binds requirement and assessment authorship to the caller and the compliance role", () => {
    expect(sql).toMatch(/compliance creates requirements[\s\S]*created_by = auth\.uid\(\)[\s\S]*has_governance_role\(auth\.uid\(\), hospital_id, 'compliance'\)/);
    expect(sql).toMatch(/compliance creates assessments[\s\S]*created_by = auth\.uid\(\)[\s\S]*has_governance_role\(auth\.uid\(\), hospital_id, 'compliance'\)/);
    expect(sql).toMatch(/attestors record attestations[\s\S]*attestor_id = auth\.uid\(\)/);
  });

  it("keeps records inside the facility that owns them", () => {
    expect(sql).toMatch(/an assessment must stay inside the facility that owns the requirement/);
    expect(sql).toMatch(/an attestation must stay inside the facility that owns the assessment/);
    expect(sql).toMatch(/a requirement cannot move between facilities/);
  });
});

describe("false certification claims are denied", () => {
  it("requires evidence, a hash, a test date, an assessor and a named authority", () => {
    expect(sql).toMatch(/external verification requires evidence, an evidence hash, a test date, an assessor and a named authority/);
  });

  it("requires a current independent attestation matching the evidence hash", () => {
    expect(sql).toMatch(/external verification requires a current independent attestation matching the evidence hash/);
    expect(sql).toMatch(/attestor_role IN \('independent_assessor','external_counsel'\)[\s\S]*coalesce\(t\.evidence_hash,''\) = NEW\.evidence_hash/);
  });

  it("rejects an expired attestation as the basis for verification", () => {
    expect(sql).toMatch(/an expired attestation cannot mark a requirement externally verified/);
    expect(sql).toMatch(/t\.expires_at IS NULL OR t\.expires_at >= current_date/);
  });

  it("requires an internal control reference before internal readiness", () => {
    expect(sql).toMatch(/internal readiness requires an internal control or evidence reference/);
  });

  it("seeds truthful gaps rather than assumed compliance", () => {
    expect(sql).toMatch(/No external evidence on file: no engaged assessor, executed contract or authorized attestation/);
    expect(sql).toMatch(/status public\.compliance_status NOT NULL DEFAULT 'not_started'/);
    expect(sql).toMatch(/applicability public\.compliance_applicability NOT NULL DEFAULT 'undetermined'/);
  });
});

describe("separation of the assessor from the implementer", () => {
  it("denies self-verification on an assessment", () => {
    expect(sql).toMatch(/separation of duties: an implementer cannot verify their own control/);
    expect(sql).toMatch(/NEW\.assessor_id = r\.owner_user_id OR NEW\.assessor_id = r\.created_by[\s\S]*NEW\.assessor_id = auth\.uid\(\)/);
  });

  it("denies self-attestation by an implementer or owner", () => {
    expect(sql).toMatch(/separation of duties: the implementer cannot act as the independent assessor/);
    expect(sql).toMatch(/an independent attestation requires the attesting organization and an evidence hash/);
  });
});

describe("immutable evidence and attestation history", () => {
  it("freezes verified evidence", () => {
    expect(sql).toMatch(/externally verified evidence is immutable/);
  });

  it("freezes an externally verified requirement version", () => {
    expect(sql).toMatch(/an externally verified requirement version is immutable; create a new version instead/);
  });

  it("makes attestations append-only", () => {
    expect(sql).toMatch(/CREATE TRIGGER deny_attestation_change BEFORE UPDATE OR DELETE ON public\.compliance_attestations/);
    expect(sql).not.toMatch(/GRANT[^;]*DELETE[^;]*ON public\.compliance_attestations/);
  });

  it("protects concurrent edits with an optimistic lock", () => {
    expect(sql).toMatch(/this assessment was changed by someone else; reload and retry/);
  });
});

describe("applicability and gate aggregation", () => {
  it("requires a documented applicability decision before not-applicable", () => {
    expect(sql).toMatch(/an applicability decision requires a documented rationale and a named counsel or compliance decision maker/);
    expect(sql).toMatch(/a requirement can only be marked not applicable after a documented applicability decision/);
  });

  it("treats undetermined applicability as a blocker", () => {
    expect(sql).toMatch(/g\.applicability = 'undetermined'/);
  });

  it("demands external verification for external dependencies and internal readiness otherwise", () => {
    expect(sql).toMatch(/g\.external_dependency AND \(g\.status <> 'externally_verified'/);
    expect(sql).toMatch(/NOT g\.external_dependency AND g\.status NOT IN \('internally_ready','externally_verified'\)/);
  });

  it("never asserts certification or contract status in its own output", () => {
    expect(sql).toMatch(/internal readiness only; nothing here asserts certification, compliance or an executed external contract/);
  });
});

describe("no bypass of the national release gate", () => {
  it("blocks production availability on unverified compliance gates", () => {
    expect(sql).toMatch(/CREATE TRIGGER gate_compliance_availability BEFORE INSERT OR UPDATE ON public\.state_service_availability/);
    expect(sql).toMatch(/production release is blocked by unverified compliance gates/);
  });

  it("has no administrator or role escape hatch in the gate", () => {
    const fn = sql.slice(sql.indexOf("FUNCTION public.gate_compliance_availability"),
      sql.indexOf("CREATE TRIGGER gate_compliance_availability"));
    expect(fn).not.toMatch(/has_role|is_admin|service_role|auth\.uid\(\) IS NULL/);
  });

  it("counts expired evidence as unverified at the gate", () => {
    expect(sql).toMatch(/a\.expires_at IS NOT NULL AND a\.expires_at < current_date/);
  });
});

describe("claim guards and PHI-free reporting", () => {
  const hook = readFileSync(path.resolve(process.cwd(), "src/hooks/useCompliance.ts"), "utf8");
  const ui = readFileSync(path.resolve(process.cwd(), "src/components/virtualis/ComplianceMatrix.tsx"), "utf8");

  it("states internal readiness only in the shared banner", () => {
    expect(hook).toMatch(/INTERNAL READINESS ONLY/);
    expect(ui).toMatch(/CLAIM_BANNER/);
  });

  it("never claims national production readiness in the export", () => {
    expect(hook).toMatch(/national_production_ready: false/);
    expect(hook).toMatch(/external_blockers/);
  });

  it("exports catalog and evidence references only, no patient fields", () => {
    const report = hook.slice(hook.indexOf("const exportReport"), hook.indexOf("return { requirements"));
    expect(report).not.toMatch(/patient|mrn|dob|name_first|phi/i);
  });
});
