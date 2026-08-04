> **STARTER TEMPLATE — review and adopt with legal/compliance counsel before relying on it.**

# Risk Management Policy

**Owner:** Security Officer · **Review:** annually and after any significant system change · HIPAA §164.308(a)(1)

## 1. Purpose

Establish a repeatable process to identify, evaluate, treat and monitor risks to the confidentiality, integrity and availability of ePHI held or transmitted by VirtualisONE.

## 2. Process

1. **Identify** — inventory assets, data flows and threats. Sources: architecture review, code audit findings, dependency audit output from CI, incident post-mortems, subprocessor changes, customer security reviews.
2. **Analyze** — score each risk on Likelihood (1–5) × Impact (1–5).
3. **Treat** — mitigate, transfer (contract/insurance), avoid, or formally accept.
4. **Monitor** — re-review each open risk at least quarterly; re-run the full analysis annually or after material change (new subprocessor, new PHI flow, new integration).

## 3. Scoring

| Score | Band | Required response |
|---|---|---|
| 20–25 | Critical | Immediate remediation; work stops for competing features |
| 12–19 | High | Remediate within 30 days |
| 6–11 | Medium | Remediate within 90 days |
| 1–5 | Low | Track; remediate opportunistically |

Accepted risks require written sign-off by the Security Officer with a stated rationale and re-review date.

## 4. Current risk register

| ID | Risk | L | I | Score | Status | Treatment |
|---|---|---|---|---|---|---|
| R-01 | Cross-tenant PHI disclosure via a caller-supplied record ID used with the service-role client | 2 | 5 | 10 | Mitigated | RLS on 45/45 public tables + `userHasHospitalAccess()` + `_shared/tenancy.ts` scoping on every such ID; mandatory PR review rule |
| R-02 | PHI sent to an AI vendor without a BAA | 1 | 5 | 5 | Mitigated | Bedrock-only inference (`_shared/llm.ts`), fail-closed 503; Cohere/Gemini/Anthropic-direct/Lovable-gateway paths removed |
| R-03 | ElevenLabs voice session carries PHI before BAA execution | 3 | 5 | 15 | **Open — High** | BAA in negotiation; voice feature to be restricted to non-PHI demo use until executed |
| R-04 | EHR access-token theft via a malicious SMART issuer | 2 | 5 | 10 | Mitigated | Deny-by-default issuer allowlist (`_shared/fhirAllowlist.ts`), https-only scheme checks, server-side `token_endpoint` re-derivation |
| R-05 | Unmonitored production errors / delayed incident detection | 4 | 3 | 12 | **Open — High** | Sentry integrated and PHI-scrubbed but inert until `VITE_SENTRY_DSN` is set; activation pending |
| R-06 | Unknown exploitable vulnerability (no external pen test) | 3 | 4 | 12 | **Open — High** | Schedule third-party penetration test; interim: dependency audit in CI, internal code audits |
| R-07 | Clinically incorrect AI output influencing care | 3 | 4 | 12 | Partially mitigated | Advisory-only output, mandatory clinician sign-off on all orders/notes, DSI model cards published; **formal clinical validation not yet performed** |
| R-08 | Cost/abuse exhaustion of AI endpoints | 3 | 2 | 6 | Mitigated | Per-user fail-closed rate limiter; `rate_limits` service-role only |
| R-09 | Inappropriate controlled-substance prescribing without EPCS | 2 | 4 | 8 | Mitigated | Hard block on Schedules II–V (`_shared/controlledSubstances.ts`) |
| R-10 | Data loss / prolonged outage | 2 | 4 | 8 | Partially mitigated | Supabase managed backups + PITR; restore runbook documented but **not yet exercised end-to-end** |
| R-11 | PHI leakage into logs or error telemetry | 2 | 4 | 8 | Mitigated | PHI-scrubbing `beforeSend` in `src/lib/monitoring.ts`; upstream EHR response bodies no longer echoed to clients; non-identifying telemetry in `alis-chat` |
| R-12 | Insider misuse of legitimate access | 2 | 4 | 8 | Partially mitigated | Least privilege, `audit_logs`, quarterly access review; **no automated anomalous-access detection** |
| R-13 | Credential compromise without MFA | 3 | 4 | 12 | Partially mitigated | TOTP MFA available; **not mandatory** for privileged roles |

## 5. Reporting

The Security Officer reports register status quarterly, including new risks, closed risks, overdue treatments and accepted risks. Every Sev1/Sev2 incident produces a post-mortem whose findings enter this register.
