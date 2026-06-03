# Make the VirtualisOne Logo Bigger & Futuristic on Sign-In

Goal: demo-ready hero logo on `/auth` — larger, with subtle futuristic motion. No layout breakage on mobile (current viewport 440px).

## Changes (single file: `src/pages/Auth.tsx`)

### Desktop hero (left panel)
- Logo size: `h-40` → `h-64` (with `max-w-[80%]`)
- Wrap in animated container:
  - **Pulsing aura**: dual conic/blur orbs behind logo, slow counter-rotating (20s + 30s), primary→info gradient
  - **Orbit ring**: thin dashed SVG ring rotating 40s
  - **Float**: logo itself uses `animate-float` (already in tailwind config) for gentle Y bob
  - **Shimmer sweep**: diagonal gradient overlay sweeping every 6s (mask to logo bounds)
- Entrance: `animate-scale-in` + `animate-fade-in`

### Mobile header (shown <lg)
- Logo size: `h-24` → `h-36`
- Same float + glow aura (lighter — single blur orb, no orbit ring to keep perf on mobile)
- Drop the redundant small logo inside the form card's 20×20 icon box (form card already has H2 "Welcome back" — the icon feels redundant once the header logo is bigger). Replace with a slim animated accent bar OR keep it but smaller (`h-12 w-12`, no box).

### Implementation notes
- All animations via Tailwind utility classes + a tiny inline `<style>` block (or extend `tailwind.config.ts` keyframes for `spin-slow`, `spin-reverse-slow`, `shimmer-sweep`). Prefer extending config so it's reusable.
- New keyframes to add:
  - `spin-slow` (40s linear infinite)
  - `spin-reverse-slow` (30s linear infinite reverse)
  - `aura-pulse` (4s ease-in-out — scale 1→1.15, opacity 0.4→0.7)
- Respect `prefers-reduced-motion` — wrap motion in a media query (Tailwind `motion-safe:`).
- Uses existing semantic tokens (`primary`, `info`) — no new colors.

## Out of scope
- No copy changes, no form changes, no other pages (Product, HospitalSelector, TopBar logos unchanged).
- No new dependencies (pure CSS/Tailwind, no framer-motion needed for this).

## Files touched
| File | Change |
|---|---|
| `src/pages/Auth.tsx` | Enlarge logos, wrap in animated aura/orbit/float container |
| `tailwind.config.ts` | Add 3 keyframes + animation utilities |

Confirm and I'll build it.