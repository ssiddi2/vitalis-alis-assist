
# Multi-Entity & RCM Capability Assessment

## Goal

Give you an honest, evidence-based answer to: *can this platform today support a second legal entity with independent billing, RCM, and payer enrollment?* — then deliver it as a shareable PDF + Markdown document you can hand to stakeholders before scoping the IR workflow.

No application code changes. Read-only analysis of the current schema, config, and UI, plus document generation into `/mnt/documents/`.

## TL;DR of the assessment (so you can decide before I write the doc)

The platform today is a **clinical EMR + AI workspace with a demo-grade billing dashboard**, not a production RCM system. Multi-tenancy exists at the **hospital** level (RLS by `hospital_id`), but there is **no concept of a legal/billing entity**, **no Tax ID / billing NPI**, **no clearinghouse integration**, **no 837/835 pipeline**, **no ERA/EFT posting**, **no patient statements**, and **no credentialing/payer enrollment module**.

Per-bullet status:

| Requirement | Status | Evidence |
|---|---|---|
| Bill under multiple Tax IDs / billing NPIs in one instance | **Not supported** | No `tax_id`, `billing_npi`, or `entity` columns anywhere in schema |
| Separation of providers / locations / financials by entity | **Partial (hospital-level only)** | `hospitals` + `hospital_users` + RLS exist; no entity layer above/below |
| Electronic claim submission (837P/837I) by entity | **Not supported** | `billing_events` stores CPT/ICD + `estimated_revenue` only; no claim, no submission edge function |
| ERA (835) / EFT enrollment + posting | **Not supported** | No remit, payment, adjustment, or clearinghouse tables/functions |
| Insurance payment reconciliation & reporting by entity | **Not supported** | No payments table; RCM dashboard uses hard-coded demo arrays (`revenueTimeline`, `agingBuckets`) |
| Patient statements & payment processing | **Not supported** | No statement, ledger, or payment processor integration |
| Provider credentialing & payer enrollment (multi-entity) | **Not supported** | No credentialing, payer, or enrollment tables |
| RCM & collections reporting by entity | **Not supported** | Dashboard is presentational; no entity dimension and no real aggregations |

**Bottom line:** before scoping IR workflows that depend on billing under a separate legal entity, the platform needs a foundational multi-entity + RCM build. That is a substantial effort (not a config toggle).

## Deliverable

A single document written to `/mnt/documents/`, in two formats:

1. `multi-entity-capability-assessment.md` — source of truth, editable
2. `multi-entity-capability-assessment.pdf` — print/share version (US Letter, Arial, branded heading color from the app's primary token)

### Document outline

1. **Executive Summary** — one page, the TL;DR table above + clear "today vs. required" verdict.
2. **Current Architecture** — what the platform *is* today: clinical EMR (Epic-style chart, ALIS AI, SMART-on-FHIR sandbox), multi-hospital RLS isolation, demo-grade RCM dashboard.
3. **Per-Requirement Findings** — one section per bullet from your message, each with: *What you asked for*, *What exists today (with file/table evidence)*, *Gap*, *Effort tier* (S/M/L/XL).
4. **Proposed Data Model for Multi-Entity RCM** — entity tier above hospital, with `legal_entities` (tax_id, billing_npi, address, contact), `entity_locations`, `entity_providers` (credentialing status per payer), `payers`, `payer_enrollments` (per entity + provider + payer), `claims` (837), `remittances` (835), `payments`, `adjustments`, `patient_statements`. RLS scoped by entity *and* hospital.
5. **External Integrations Required** — clearinghouse options (Availity, Change Healthcare/Optum, Waystar, Office Ally), patient payment processor (Stripe via Lovable Cloud), ERA/EFT enrollment workflow per entity.
6. **Build Phases & Rough Effort** — Phase 0 entity model, Phase 1 claims out, Phase 2 ERA/EFT in, Phase 3 statements + patient pay, Phase 4 entity-scoped reporting & credentialing. T-shirt sizes only — no fake hour estimates.
7. **Decision Point for IR Scoping** — explicit recommendation on whether to scope IR workflows now (against the gap) or after Phase 0–1.
8. **Appendix** — file/table references used as evidence so your team can verify.

### Generation approach (technical)

- Write Markdown by hand (no template engine).
- Generate PDF with the bundled `docx` skill OR a small Python `reportlab` script (per the pdf skill) — reportlab is lighter and matches the "minimal code" preference. US Letter, 1" margins, Arial, primary color sampled from `index.css` token for headings.
- QA: render PDF → `pdftoppm` → inspect every page image → fix overflow/clipping → re-render. Report what was checked.
- Emit `<presentation-artifact>` tags for both the `.md` and `.pdf` so you can preview/download immediately.

## Out of scope (explicitly)

- No code changes to the app itself.
- No new tables, migrations, or edge functions.
- No IR workflow design — that comes after you decide on the multi-entity foundation.
