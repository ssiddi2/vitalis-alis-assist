## Goal
Convince a prospective clinic in 30 minutes that this is a real, working ambulatory EMR — not a slide deck. The proof is letting them watch a patient flow from check-in to signed note to printed superbill, in their browser, against a live database.

## The 30-minute demo (8 beats)

```
0:00  Open cold      → published URL, sign in
0:02  Today's schedule → click a patient
0:05  Chart tour      → problems, meds, allergies, vitals (real DB rows)
0:09  Start encounter → vitals + HPI
0:13  ALIS voice      → dictate HPI, watch transcript land in the note
0:17  Orders + Rx     → stage labs, write a prescription, print preview
0:22  Sign note       → audit log entry appears
0:25  Superbill PDF   → pick ICD-10 + CPT, print to PDF, hand it to them
0:28  "Where's my data?" → show RLS: log in as a different clinic, zero leakage
0:30  Close
```

Each beat is something they can see happen on screen. No "imagine if…" slides.

## What needs to be true before the demo

This is the gap list — what to lock down so the demo doesn't faceplant. Pick the ones that aren't already solid:

1. **One seeded demo clinic** with: 1 provider account (you), 1 front-desk account, 5–8 patients with realistic problems/meds/allergies/vitals, 3 appointments on "today."
2. **A second seeded clinic** with 1 patient, used only for the 30-second RLS proof at the end.
3. **Superbill PDF**: print-to-PDF view exists and renders cleanly. (Schema is in; UI button on the encounter is the missing piece per the last build turn.)
4. **Prescription print view**: a clean printable Rx (patient, drug, sig, prescriber, DEA blank, signature line). Fax is not needed for the demo — print is enough.
5. **ALIS voice**: ElevenLabs is reconnected in this workspace (you rejected the connect prompt earlier — needs to be redone) and the dictation button works end-to-end on the note editor.
6. **Published URL is current** and loads in under 3 seconds cold. Custom domain (`alisai.health`) preferred over the preview URL — looks like a product, not a sandbox.
7. **Demo-mode guardrails**: hide inpatient nav (already done via `isAmbulatory`), hide anything half-built (consult marketplace, RCM analytics, ROI calculator, integration spec) from the signed-in nav so they don't click into a dead end.
8. **Reset script**: a single button or SQL snippet that puts the demo clinic back to its starting state in <10 seconds, in case a beat goes sideways and you need to restart.

## What I need from you to start

Pick the cuts — I'll do the rest in build mode:

- **A. Tightest path (recommended, ~2 hrs of build):** items 1, 3, 7, 8. Skip Rx print and voice — talk over them or show them on the chart but don't demo live. Lowest risk of a broken beat.
- **B. Full demo (~4–5 hrs of build):** all 8 items, including reconnecting ElevenLabs and wiring the Rx print view.
- **C. You tell me what to drop.**

Also confirm:

- **When is the demo?** (If it's today, A. If tomorrow+, B is realistic.)
- **In person or screen-share?** (Screen-share = use the published custom domain. In person on your laptop = preview URL is fine.)
- **Are they technical?** (Technical buyers want to see the RLS isolation beat. Clinic owners want to see the superbill and the time-to-sign-a-note.)

Once you answer, I switch to build mode and execute.
