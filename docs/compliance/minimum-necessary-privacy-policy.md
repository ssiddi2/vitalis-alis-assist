> **STARTER TEMPLATE — review and adopt with legal/compliance counsel before relying on it.**

# Minimum Necessary & Privacy Policy

**Owner:** Privacy Officer · **Review:** annually · 45 CFR §164.502(b), §164.514(d)

## 1. Principle

When using or disclosing PHI, or requesting PHI from another covered entity, VirtualisONE limits it to the **minimum necessary** to accomplish the purpose. As a business associate, we use PHI only as permitted by the BAA with each covered entity — to provide, support and improve the service, and as required by law. **We do not sell PHI, use it for advertising, or use it to train third-party AI models.**

## 2. How minimum necessary is implemented in the system

| Mechanism | Effect |
|---|---|
| Row Level Security on **all 45 public tables** | A user's queries can only return rows belonging to a hospital they are a member of |
| `hospital_users` membership | The single authoritative definition of which facilities a clinician may see |
| `userHasHospitalAccess()` (`_shared/auth.ts`) | Server-side re-check before any service-role read/write |
| `_shared/tenancy.ts` scoping | A caller-supplied `patient_id` / `note_id` / `order_id` / `prescription_id` is verified against the caller's hospital before use — membership alone never authorizes an arbitrary record |
| Cross-facility views | The "All my facilities" scope is derived strictly from the user's own `hospital_users` rows; no hospital the user does not belong to is ever queried |
| Purpose-scoped AI context | ALIS receives clinical context for the patient in scope only, assembled server-side after the hospital check; a foreign patient ID is refused before any context is loaded |
| Least-privilege grants | Table grants are the narrowest the policies allow; `public.rate_limits` is service-role only |
| Connectivity probes | `fhir-sync` returns only a resource ID and `lastUpdated` — never name, gender or birth date |
| Response hygiene | Upstream EHR response bodies are not echoed to clients; validation errors do not echo input |

## 3. Roles and the access each requires

| Role | Minimum necessary access |
|---|---|
| Clinician | Full clinical record for patients at facilities they cover — appropriate for treatment purposes |
| Administrator | User, role and facility management; clinical access only where they are also a clinician at that facility |
| Engineering / support | No routine PHI access. Troubleshooting that requires PHI is performed with the customer's knowledge, limited to the records at issue, and recorded in `audit_logs` |
| Automated processes | Service-role access constrained to the specific records the request is scoped to |

## 4. Exception for treatment

The minimum-necessary standard does not apply to disclosures to, or requests by, a health care provider for **treatment** purposes (§164.502(b)(2)(i)). This is why a clinician sees the full chart for their patients — but it does not extend across hospital boundaries, which is why hospital scoping is enforced unconditionally.

## 5. Individual rights

Requests from individuals to access, amend, restrict, receive an accounting of disclosures of, or delete their PHI are handled by the **covered entity**, not by VirtualisONE directly. On receiving such a request we: acknowledge it, forward it to the covered entity promptly, and support the covered entity's response within the BAA's timeframes — including producing the relevant `audit_logs` records for an accounting of disclosures.

## 6. Uses of data for product improvement

Aggregate, de-identified metrics (e.g. workflow timing telemetry) may be used to improve the service. De-identification follows §164.514(b) Safe Harbor. Identifiable clinical content is never used for model training: AWS Bedrock is invoked with zero-retention inference under the AWS BAA, and no other AI vendor is in the PHI path.

## 7. Complaints

Privacy concerns may be raised with the Privacy Officer, or with the relevant covered entity, without retaliation.
