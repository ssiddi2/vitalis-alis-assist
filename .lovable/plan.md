
# Refine Patient Sidebar: Clean Cards + Collapsible Panel

## What's Changing

### 1. Clean up the patient cards in the sidebar

Each patient row will have a clear, structured layout instead of cramped text:

```text
[dot] Patient Name                Bed 4A
      72M · MRN-001234
      Sepsis secondary to UTI
```

- Status dot and name on the first line, bed badge right-aligned
- Demographics (age/sex + MRN) on the second line with a dot separator
- Diagnosis on the third line, muted color, truncated if too long
- Consistent spacing between rows

### 2. Make the sidebar collapsible

Add a toggle button so the sidebar can be collapsed to a narrow strip (icons only) or hidden entirely:

- A small chevron/arrow button at the top of the sidebar header to collapse it
- When collapsed, the sidebar shrinks to ~48px wide showing only status dots (or hides completely)
- The clinical dashboard and ALIS panel expand to fill the freed space
- The grid columns in Dashboard.tsx will react to the collapsed state

---

## Technical Details

### Files to edit

| File | Change |
|------|--------|
| `src/components/virtualis/PatientListSidebar.tsx` | Restructure patient card markup for clean hierarchy; accept `collapsed` and `onToggleCollapse` props |
| `src/pages/Dashboard.tsx` | Add `sidebarCollapsed` state; pass to sidebar; adjust grid columns dynamically |

### Sidebar card markup (new structure)
- Row 1: `flex justify-between` -- status dot + name (left), bed badge (right)
- Row 2: `text-[10px] text-muted-foreground` -- age/sex, dot separator, MRN
- Row 3: `text-[10px] text-muted-foreground/70 truncate` -- diagnosis
- Proper `py-2.5 px-3` padding with `gap-1` between rows

### Collapsible behavior
- `sidebarCollapsed` boolean state in Dashboard
- Grid changes from `grid-cols-[240px_1fr_420px]` to `grid-cols-[48px_1fr_420px]` when collapsed
- Collapsed view shows just the Census icon + patient count badge; clicking expands it back
- Smooth width transition with `transition-all duration-200`
