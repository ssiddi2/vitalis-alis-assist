> **STARTER TEMPLATE — review and adopt with legal/compliance counsel before relying on it.**

# Incident Response Plan

**Owner:** Security Officer · **Review:** annually and after every Sev1/Sev2 · HIPAA §164.308(a)(6)

## 1. What is an incident

Any actual or suspected event that compromises the confidentiality, integrity or availability of ePHI or of VirtualisONE systems. Examples: suspected cross-tenant data exposure, credential compromise, EHR access-token leakage, a subprocessor breach notification, ransomware, prolonged outage, or PHI appearing in logs or error telemetry.

## 2. Roles

| Role | Responsibility |
|---|---|
| **Incident Commander** (Security Officer, or delegate) | Owns the incident end to end; declares severity; authorizes containment; single decision-maker |
| **Technical Lead** (Engineering Lead) | Investigation, containment and recovery actions |
| **Privacy Officer** | Determines whether the event is a breach of unsecured PHI; owns notification under [breach-notification-policy.md](./breach-notification-policy.md) |
| **Communications** | Customer/covered-entity notification, status updates |
| **Scribe** | Maintains the timeline: what was known, when, and what was done |

## 3. Severity ladder

| Sev | Definition | Response time | Examples |
|---|---|---|---|
| **Sev1** | Confirmed or highly likely PHI disclosure, or total outage | Immediate, 24/7 | Cross-tenant PHI read confirmed; DB exfiltration; EHR token stolen |
| **Sev2** | Credible risk to PHI or major degradation | ≤ 2 hours | Suspicious access pattern; auth bypass suspected; AI endpoint leaking context |
| **Sev3** | Security-relevant defect without evidence of exposure | ≤ 1 business day | Missing tenancy check found in review; misconfigured CORS in preview |
| **Sev4** | Informational | ≤ 5 business days | Dependency advisory with no reachable path |

## 4. Procedure

### 4.1 Report
Any workforce member who suspects an incident notifies the Security Officer **immediately** through the designated channel. There is no penalty for a good-faith false alarm; failing to report is a policy violation.

### 4.2 Triage (target: 1 hour for Sev1/Sev2)
Confirm the event is real, assign severity, open a timeline, and preserve evidence **before** changing anything: capture `audit_logs` rows for the window, Supabase Auth sign-in events, Edge Function logs, and Sentry events (if a DSN is active).

### 4.3 Contain
Actions, chosen by the Incident Commander:
- Revoke the affected session/user (Supabase Auth) and, if needed, the `hospital_users` membership.
- Rotate compromised secrets (AWS keys, `SMART_CLIENT_SECRET`, service-role key) — see [encryption-key-management-policy.md](./encryption-key-management-policy.md).
- Clear `ALLOWED_FHIR_ISS` to deny all EHR issuers, and/or narrow `ALLOWED_ORIGINS`.
- Disable a compromised Edge Function by deploying a version that returns 503, or unset the credential it depends on — the AI path **fails closed** without Bedrock configuration.
- For suspected exfiltration, engage Supabase support to restrict database access.

### 4.4 Eradicate and recover
Fix the root cause through the normal PR + CI path (see [secure-sdlc](./secure-sdlc-change-management-policy.md)); emergency fixes may be expedited but still require review and a retrospective PR record. Restore data per the [BC/DR plan](./business-continuity-dr-plan.md) if integrity was affected. Verify: re-run the tenancy checks, confirm RLS is enabled on all public tables, confirm no non-BAA AI path was reintroduced.

### 4.5 Assess for breach
The Privacy Officer performs the four-factor risk assessment within **5 business days** of containment. If a breach of unsecured PHI is confirmed, the notification clocks in the [breach notification policy](./breach-notification-policy.md) start on the **date of discovery**, not the date of the assessment.

### 4.6 Post-mortem
Within **10 business days** of resolution for Sev1/Sev2: blameless write-up covering timeline, root cause, detection gap, containment effectiveness, and corrective actions with owners and dates. Findings are entered in the risk register.

## 5. Evidence retention
Incident records, timelines and post-mortems are retained for **at least six years** (§164.316(b)(2)(i)).

## 6. Testing
A tabletop exercise is run at least annually — the default scenario is "a clinician at Hospital A reports seeing a patient who is not theirs."

## 7. Known limitation
Detection today relies primarily on user reports and manual log review. Automated alerting is pending Sentry DSN activation, and there is no anomaly detection over `audit_logs`. This materially lengthens time-to-detect and is tracked as R-05/R-12.
