
The user reports patient information is cutting off and wants a next-level UX overhaul. Current viewport is 731×644 (tablet-ish). Let me think through what's likely broken and what to improve.

## Likely Issues (from code review)

Looking at `Dashboard.tsx` grid: `lg:grid-cols-[240px_1fr_700px]` at xl. At 731px width, we're below `lg` (1024px) — so user sees mobile layout: just patient dashboard + FAB for ALIS. But "patient info cutting off" suggests:

1. **PatientHeader** likely overflows horizontally (name, MRN, age/sex, location, bed, admission day, LOS, diagnosis all in a row).
2. **PatientChartTabs** — many tabs (Summary, Labs, Vitals, Meds, Allergies, Problems, Notes, Imaging, Orders, Billing) likely overflow without horizontal scroll affordance.
3. **No mobile patient list** — user can't switch patients on tablet/mobile easily (sidebar is `hidden lg:block`).
4. At desktop, the 700px ALIS panel squeezes the chart on smaller laptops (1280px → 260+700 = 960px, leaving ~320px for chart — way too narrow).
5. Panels inside (Labs/Vitals/etc.) likely have fixed-width tables that overflow.

## Plan

### 1. Audit & fix overflow in PatientHeader
- Make it responsive: stack on mobile, wrap chips, truncate long names with tooltip, ensure diagnosis wraps.

### 2. Fix PatientChartTabs
- Horizontal scroll with fade edges + scroll buttons on overflow
- Sticky tab bar so it doesn't scroll away
- Compact tab labels on mobile (icons + short text)

### 3. Rebalance Dashboard grid
- At `lg` (1024-1279px): `[200px_1fr_360px]` — give chart breathing room
- At `xl` (1280-1535px): `[220px_1fr_420px]`
- At `2xl` (1536px+): `[260px_1fr_560px]` — ALIS doesn't need 700px
- Collapsed sidebar saves more space everywhere

### 4. Add tablet patient switcher
- Show patient list as a Sheet (drawer) accessible from TopBar on `md` screens
- Currently mobile users have no way to change patient

### 5. Audit individual chart panels
- LabResultsPanel, VitalsPanel, MedicationsPanel, etc. — ensure tables use `overflow-x-auto` wrappers, truncate cells with tooltips, stack on narrow widths.

### 6. Information density polish
- Use consistent card padding (`p-4` mobile, `p-6` desktop)
- Sticky section headers within scrollable panels
- Better empty states and loading skeletons (already have skeleton-patterns)
- Ensure `min-w-0` on flex children to allow truncation

### 7. Typography & hierarchy pass
- Tighten line-heights on dense data
- Use `tabular-nums` on all numeric clinical data (vitals, labs)
- Consistent severity color usage (critical/warning/success tokens already defined)

### 8. Quick QA at 3 viewports
After changes, verify at 375px (phone), 768px (tablet), 1280px (laptop), 1920px (desktop).

## Files to Edit

| File | Change |
|------|--------|
| `src/components/virtualis/PatientHeader.tsx` | Responsive layout, truncation, wrap chips |
| `src/components/virtualis/PatientChartTabs.tsx` | Sticky + scrollable tab bar with fade edges |
| `src/pages/Dashboard.tsx` | Rebalance grid breakpoints, add tablet patient sheet trigger |
| `src/components/virtualis/TopBar.tsx` | Add patient-switcher button for tablet |
| `src/components/virtualis/PatientDashboard.tsx` | Consistent padding, `min-w-0` on flex children |
| `src/components/virtualis/LabResultsPanel.tsx` | Horizontal scroll wrapper, truncation |
| `src/components/virtualis/VitalsPanel.tsx` | Same |
| `src/components/virtualis/MedicationsPanel.tsx` | Same |
| `src/components/virtualis/ClinicalNotesDisplay.tsx` | Wrap long text, expand/collapse |
| `src/components/virtualis/PatientListSidebar.tsx` | Tablet/mobile sheet variant |

## Out of Scope
- No new features — purely UX polish on existing components.
- No backend / schema changes.
- No design system color changes (current Apple-light theme stays).
