> **STARTER TEMPLATE — review and adopt with legal/compliance counsel before relying on it.**

# Breach Notification Policy

**Owner:** Privacy Officer · **Review:** annually · 45 CFR §164.400–414

## 1. Role and posture

VirtualisONE (LiveMed) acts as a **business associate** to covered-entity customers (hospitals and health systems). Our primary obligation on discovery of a breach of unsecured PHI is to **notify the affected covered entity without unreasonable delay and no later than 60 calendar days from discovery** (§164.410). The covered entity is generally responsible for notifying individuals, HHS and, where applicable, the media — unless our BAA delegates that to us.

## 2. Definitions

- **Breach** — the acquisition, access, use or disclosure of PHI in a manner not permitted by the Privacy Rule that compromises the security or privacy of the PHI.
- **Unsecured PHI** — PHI not rendered unusable, unreadable or indecipherable through HHS-recognized encryption or destruction. PHI encrypted at rest with AES-256 **and** unreadable to the acquirer may fall within the encryption safe harbour; PHI disclosed through an application-layer authorization failure does **not**, because it was decrypted for the recipient.
- **Discovery** — the first day the incident is known, or by exercising reasonable diligence would have been known, to any workforce member other than the person who committed the breach.

## 3. Exclusions (§164.402(1))

Not a breach if: an unintentional, good-faith access by a workforce member acting within scope that is not further used or disclosed; an inadvertent disclosure between two authorized persons at the same covered entity/BA; or a disclosure where the recipient could not reasonably have retained the information. Every exclusion invoked must be documented with its reasoning.

## 4. Four-factor risk assessment (§164.402(2))

Unless one of the exclusions applies, an impermissible use or disclosure is **presumed to be a breach** unless we demonstrate a low probability of compromise, assessed on all four factors:

1. **Nature and extent of the PHI** — identifiers involved, and whether the data is clinically or financially sensitive (diagnoses, medications, notes, insurance).
2. **The unauthorized person** — another covered clinician bound by HIPAA, an unknown external party, or an automated process.
3. **Whether the PHI was actually acquired or viewed** — evidence from `audit_logs`, Edge Function logs and Supabase Auth records; the ability to distinguish "exposed" from "retrieved" is decisive.
4. **The extent to which risk has been mitigated** — credential revocation, secret rotation, attestations of deletion, subprocessor confirmation.

The assessment is documented, signed by the Privacy Officer, and retained six years, **including for events determined not to be breaches**.

## 5. Timelines

| Obligation | Clock | Deadline |
|---|---|---|
| Notify affected covered entity/entities | From discovery | Without unreasonable delay, ≤ **60 calendar days** (BAAs commonly shorten this — the contractual term governs, and several require notice within 24–72 hours) |
| Provide identification of affected individuals and incident details | From discovery | As soon as available; supplement as the investigation develops |
| Individual, HHS and media notice | — | Covered entity's obligation unless the BAA assigns it to us |
| Internal breach log entry | From determination | Immediately |

Do not delay initial notification because the investigation is incomplete; send what is known and supplement.

## 6. Content of the notification to the covered entity

To the extent known: date of the breach and date of discovery; description of what happened; the types of PHI and the identification of each affected individual; the steps taken to investigate, mitigate and prevent recurrence; and a contact for follow-up.

## 7. Subprocessor breaches

If AWS, Supabase, ElevenLabs or any other subprocessor notifies us of a breach affecting our data, the receipt of that notice is our **date of discovery**. We immediately open an incident under the [incident response plan](./incident-response-plan.md), run the four-factor assessment, and notify affected covered entities on the clock in §5.

## 8. Documentation and log

A breach log is maintained containing, for every event assessed: incident ID, discovery date, description, PHI involved, individuals affected, assessment outcome and rationale, notifications sent with dates, and corrective actions. Retained **six years**.

## 9. Non-retaliation

No workforce member may be retaliated against for reporting a suspected breach in good faith.
