> **STARTER TEMPLATE — review and adopt with legal/compliance counsel before relying on it.**

# Data Retention & Deletion Schedule

**Owner:** Privacy Officer · **Review:** annually · HIPAA §164.316(b)(2)(i); state medical-record retention law

## 1. Principle

Retain data as long as it is needed for treatment, operations, and legal or contractual obligation — and no longer. Where a covered entity's BAA or applicable state law specifies a longer or shorter period, **that requirement governs** and is recorded per customer.

## 2. Schedule

| Data | Retention | Basis |
|---|---|---|
| **Audit logs** (`audit_logs`, including AI-provenance entries) | **~6 years** from creation | HIPAA §164.316(b)(2)(i) documentation retention; supports accounting of disclosures |
| **Clinical records** — patients, encounters, notes, orders, prescriptions, vitals, labs, imaging metadata, consult threads | **Per applicable state medical-record law and the customer BAA**, commonly 6–10 years from last treatment, and for minors typically until the age of majority plus the state period. Never deleted on a shorter internal schedule | State law; BAA |
| **Acuity scores and clinical AI outputs** | Same as the clinical record they attach to — they are part of the decision record | Clinical/legal defensibility |
| **Billing and claims data** | 7 years | Payer and tax/audit requirements |
| **`rate_limits`** | **Transient** — a fixed-window counter, overwritten on each new window; carries no clinical content and is service-role only. Rows may be purged at any time with no compliance impact | Operational |
| **Authentication records** (sign-in events) | Per Supabase platform retention; security-relevant events copied into `audit_logs` where longer retention is required | Security monitoring |
| **Error telemetry** (Sentry, when enabled) | Provider default (typically 90 days); contains **no PHI** | Operational |
| **Backups / PITR** | Per the Supabase plan's backup retention window | Continuity |
| **Compliance policies, risk analyses, incident and breach records, sanctions, training records** | **6 years** from creation or last effective date, whichever is later | §164.316(b)(2)(i) |
| **Subprocessor agreements and BAAs** | 6 years after termination | §164.316(b)(2)(i) |
| **Source code and migration history** | Indefinite | Change-control evidence |

## 3. Account deletion semantics

> **Deleting a user account is not the same as deleting clinical data.**

When a workforce user is removed:

- The Supabase Auth account is **deactivated**, which immediately terminates login and revokes all sessions.
- `hospital_users` memberships and role assignments are removed, ending all data access.
- **Clinical records the user authored — notes, orders, prescriptions, consult messages — are retained** on the schedule above. They are part of the patient's legal medical record and must remain attributable to their author; removing them would destroy the record's integrity and violate retention law.
- The action is recorded in `audit_logs`.

For **patient** data, deletion is directed by the covered entity that owns the record. VirtualisONE does not unilaterally purge patient data, and honours the covered entity's instruction on termination of the BAA (return or destruction) subject to any legal hold.

## 4. Legal hold

On notice of litigation, investigation or audit, the Security Officer issues a legal hold that **suspends all deletion** for the identified data until the hold is lifted in writing.

## 5. Disposal

Deletion is logical (record removal in Postgres) followed by the subprocessor's media-sanitization process for underlying storage. Backups age out on their own retention window; a record may therefore persist in a backup after logical deletion, and that window is disclosed to customers.

## 6. Gap

Retention enforcement is currently **manual** — there is no automated purge job applying this schedule. A scheduled job for transient data (`rate_limits`) and an annual review of expired records is the intended next step.
