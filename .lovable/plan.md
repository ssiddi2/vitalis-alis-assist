

# Patient Census Cleanup, ALIS Scroll Fix, and Quick Actions

## Issues Identified

1. **Patient Census cards are cluttered** -- The `ml-4.5` indent class doesn't exist in Tailwind, patient info runs together, and the card layout lacks clear visual hierarchy.

2. **ALIS chat overflows the viewport** -- The Dashboard uses `min-h-screen` but the ALIS panel's flex layout doesn't properly constrain its height. The messages area grows unbounded, pushing the input below the fold.

3. **No quick-action buttons** -- Users want shortcuts like "Create Note", "Place Order", etc. available in the ALIS panel or dashboard without having to type a prompt.

---

## Plan

### 1. Fix Patient Census Card Layout

**Edit: `src/pages/PatientCensus.tsx`**

Restructure each patient card for clean visual hierarchy:
- Replace `ml-4.5` (invalid) with `ml-[18px]` or remove indent entirely
- Add a clear two-row layout: **Row 1** = status dot + name + bed badge, **Row 2** = demographics line (age/sex, MRN), **Row 3** = diagnosis, **Row 4** = attending
- Use proper spacing, separators, and consistent text sizing
- Add a subtle right-arrow or chevron on hover to signal clickability

### 2. Fix ALIS Panel Scroll Containment

**Edit: `src/pages/Dashboard.tsx`**

- Change the outer container from `min-h-screen` to `h-screen` so the layout is viewport-locked
- Ensure the grid children use `h-full` / `overflow-hidden` properly

**Edit: `src/components/virtualis/ALISPanel.tsx`**

- The ALIS panel already has `h-full` and `overflow-hidden` on the root, and `flex-1 overflow-y-auto` on the messages area -- the issue is the parent not constraining height. The Dashboard fix should resolve this.

**Edit: `src/components/virtualis/PatientDashboard.tsx`**

- Ensure the patient dashboard column also scrolls independently within `h-[calc(100vh-57px)]` rather than pushing the page height.

### 3. Add Quick Action Buttons to ALIS Panel

**Edit: `src/components/virtualis/ALISPanel.tsx`**

Add a row of quick-action chip buttons above the text input:
- "Create Note" -- sends a pre-filled prompt to ALIS: "Draft a progress note for this patient"
- "Place Order" -- sends: "Suggest orders for this patient based on current status"
- "Summarize" -- sends: "Summarize this patient's current clinical status"
- "Care Plan" -- sends: "Outline the care plan for this patient"

These appear as small rounded pill buttons (like suggestion chips) just above the textarea, horizontally scrollable if needed.

---

## Files Summary

| File | Action | Description |
|------|--------|-------------|
| `src/pages/PatientCensus.tsx` | Edit | Clean up card layout, fix spacing, improve hierarchy |
| `src/pages/Dashboard.tsx` | Edit | Lock to viewport height (`h-screen`) to contain all panels |
| `src/components/virtualis/PatientDashboard.tsx` | Edit | Add `h-full overflow-y-auto` to stay within bounds |
| `src/components/virtualis/ALISPanel.tsx` | Edit | Add quick-action chips above input |

---

## Technical Details

**Census card restructure:**
```text
+------------------------------------------+
| [status dot]  Patient Name     Bed: 4A   |
| 72M  ·  MRN-001234                       |
| Sepsis secondary to UTI                  |
| Dr. Williams                             |
+------------------------------------------+
```

**Quick action chips (ALIS input area):**
```text
[ Create Note ]  [ Place Order ]  [ Summarize ]  [ Care Plan ]
+--------------------------------------------------+  [Send]
| Ask ALIS anything...                             |
+--------------------------------------------------+
```

**Dashboard height fix:**
- Outer div: `h-screen` instead of `min-h-screen`
- Grid area: already uses `h-[calc(100vh-57px)]` for sidebar and ALIS columns; ensure the middle PatientDashboard column also uses this constraint

