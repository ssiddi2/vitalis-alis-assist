

# Validate & Present ALIS Efficiency Claims

## Current State

Your audit_logs table has **552 real events** from 46 sessions — but these track *what* users did, not *how long it took* or *how many clicks* compared to Epic. The efficiency numbers from the previous analysis were **workflow projections**, not measured data.

To make these claims defensible for investors, hospital executives, and InterSystems, we need four deliverables:

---

## Deliverable 1: Click & Time Tracking Built Into ALIS

Add invisible instrumentation to the app that automatically measures efficiency per encounter.

**New database table: `workflow_metrics`**
- `encounter_id`, `user_id`, `patient_id`, `hospital_id`
- `click_count` — total clicks during encounter
- `time_on_task_seconds` — time from encounter start to note sign
- `notes_generated`, `orders_staged`, `orders_signed`
- `billing_codes_suggested`, `voice_commands_used`
- `workflow_steps` (JSONB) — granular step-by-step timing

**New hook: `useWorkflowMetrics`**
- Starts tracking on encounter begin
- Counts clicks via a global click listener scoped to the encounter
- Records timestamps at key milestones (chart open, note drafted, orders staged, note signed)
- Auto-submits on encounter end

**Wire into**: PatientDashboard, ProgressNoteModal, OrderEntryModal, OrderSignatureModal

This gives you **real production data** you can cite.

---

## Deliverable 2: Methodology Document (PDF)

A professional PDF explaining how each claim was derived:

- **Click reduction (72-85%)**: Workflow step comparison — Epic's 15-click chart review vs ALIS's 3-4 tab switches. Methodology: task analysis of identical clinical scenarios.
- **Time savings (83%)**: Based on published literature (Sinsky et al. 2016, Arndt et al. 2017) showing 25-48 min/patient in Epic, vs ALIS's measured workflow steps.
- **Interruption reduction (80-85%)**: Single-page architecture eliminates context switches. Cited against Westbrook et al. 2010 interruption studies.
- **LOS impact**: Tied to faster order execution and earlier documentation — referenced against CMS readmission/LOS data.

Each metric gets: **claim → methodology → literature source → ALIS feature mapping → confidence interval**

Label: *"Projected Efficiency Model v1.0 — Pending Clinical Validation"*

---

## Deliverable 3: Interactive ROI Calculator Page

New route: `/roi-calculator`

Hospital administrators input:
- Bed count, average daily census
- Number of physicians, encounters/day
- Current avg documentation time
- Physician hourly cost

Output:
- Projected annual hours saved
- Projected click reduction
- Estimated revenue capture improvement
- Cost savings in dollars

Animated counters, print-friendly, shareable URL with params.

---

## Deliverable 4: Pilot Study Protocol (PDF)

A structured document hospitals can use to run a real comparison:

- **Study design**: Paired crossover — same physician, same patient complexity, Epic vs ALIS
- **Sample size**: 5 physicians × 10 encounters each = 50 data points per arm
- **Metrics captured**: clicks (instrumented), time-to-complete, note quality score, billing accuracy
- **Data collection**: Automated via workflow_metrics table + manual observer checklist
- **Timeline**: 2-week pilot
- **Statistical analysis**: Paired t-test, 95% CI
- **IRB considerations**: Exempt category (quality improvement, no patient data exposure)

---

## How to Present to an Audience

With all four pieces, you say:

> "These are **projected efficiency metrics** derived from workflow analysis against published EHR burden literature. We have built instrumentation into ALIS to capture real click and time data during pilot deployments. We are currently enrolling pilot sites to validate these projections with the attached study protocol."

This is honest, credible, and shows you have a validation path — which is exactly what InterSystems and hospital buyers want to hear.

---

## Build Order

1. Database migration for `workflow_metrics` table
2. `useWorkflowMetrics` hook + wire into encounter components
3. Generate methodology PDF
4. Build ROI calculator page
5. Generate pilot study protocol PDF

## Files

| Action | File |
|--------|------|
| Migration | `workflow_metrics` table |
| Create | `src/hooks/useWorkflowMetrics.ts` |
| Edit | `src/components/virtualis/PatientDashboard.tsx` — start tracking |
| Edit | `src/components/virtualis/ProgressNoteModal.tsx` — milestone events |
| Edit | `src/components/virtualis/OrderSignatureModal.tsx` — milestone events |
| Create | `src/pages/ROICalculator.tsx` |
| Edit | `src/App.tsx` — add `/roi-calculator` route |
| Generate | Methodology PDF → `/mnt/documents/` |
| Generate | Pilot Study Protocol PDF → `/mnt/documents/` |

