## Root cause

Clicking a hospital does set `selectedHospital` in `HospitalContext`, but `PatientCensus` (and `Dashboard`, `Clinic`, `Schedule`) call `navigate('/')` **during render** the moment `selectedHospital` is null. Any case where the context state hasn't propagated to the freshly-mounted page — e.g. a preview iframe full reload on navigation, a fast double-click, or React batching the navigation before the provider re-renders — bounces the user straight back to the selector. The context is also held only in memory, so a refresh on `/census` always bounces.

## Fix

Two small, targeted changes — no UI/feature changes.

### 1. Persist `selectedHospital` + `selectedPatientId` in `HospitalContext`

In `src/contexts/HospitalContext.tsx`:
- Initialize `selectedHospital` and `selectedPatientId` from `sessionStorage` (lazy `useState` initializer).
- On change, write the id (or `null`) back to `sessionStorage`.
- On hospitals fetch completion, if `selectedHospital` is a hydrated stub `{id}` only, replace it with the full record from the fetched list (or clear it if not found / not accessible).

Storage keys: `virtualis.selectedHospitalId`, `virtualis.selectedPatientId`.

This makes the selection survive route re-mounts and preview reloads.

### 2. Move "no hospital → redirect" out of render

Replace the render-time `navigate('/')` pattern in:
- `src/pages/PatientCensus.tsx`
- `src/pages/Clinic.tsx`
- `src/pages/Schedule.tsx`

with either a `<Navigate to="/" replace />` return or a `useEffect` that waits for `loading === false` before redirecting. `Dashboard.tsx` already uses `useEffect` — leave it, but add the same `!loading` guard so it doesn't fire before context has hydrated.

This prevents the race where the page renders once with `selectedHospital === null` before hydration completes and bounces the user.

## Files touched

| File | Change |
|---|---|
| `src/contexts/HospitalContext.tsx` | Hydrate/persist `selectedHospital` + `selectedPatientId` via sessionStorage; reconcile hydrated stub against fetched list |
| `src/pages/PatientCensus.tsx` | Gate redirect on `!loading`; use `<Navigate>` instead of render-time `navigate()` |
| `src/pages/Clinic.tsx` | Same |
| `src/pages/Schedule.tsx` | Same |
| `src/pages/Dashboard.tsx` | Add `!loading` guard to existing redirect effect |

## Out of scope

- No backend, schema, or RLS changes.
- No visual changes to the animated logo, Auth page, or any panel.
- No new dependencies.
