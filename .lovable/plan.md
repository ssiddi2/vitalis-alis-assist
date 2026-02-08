
# Futuristic Background with Lite Mode Toggle

## Current State

The app has inconsistent backgrounds:
- **Auth page**: Full futuristic treatment (gradient, grid pattern, 3 animated floating orbs)
- **Hospital Selector**: Partial treatment (2 orbs hidden on mobile)
- **Dashboard**: Plain white background, no visual flair

## Solution Overview

Create a reusable `FuturisticBackground` component with two modes:

| Mode | Description | Use Case |
|------|-------------|----------|
| **Full** | Animated floating orbs, gradient, grid pattern | Default for desktop, marketing pages |
| **Lite** | Static gradient + grid, no animations | Mobile devices, reduced motion, performance-sensitive |

The mode will be controlled by:
1. A `lite` prop for explicit control
2. Automatic detection of `prefers-reduced-motion` media query
3. Optional user toggle stored in localStorage

---

## Implementation

### 1. Create FuturisticBackground Component

**File**: `src/components/virtualis/FuturisticBackground.tsx`

```text
Props:
- variant: 'full' | 'lite' | 'auto' (default: 'auto')
- className: string (optional)

Features:
- 'auto' mode: Uses 'lite' on mobile (<1024px) or if prefers-reduced-motion
- Gradient background layer (always shown)
- Grid pattern overlay (always shown, subtle opacity)
- Floating orbs (only in 'full' mode)
- All elements use absolute positioning with pointer-events-none
```

### 2. Add Animation Keyframes for Orbs

**File**: `src/index.css`

The existing `animate-float` keyframe works well. Add a new slower variant for variety:

```css
@keyframes float-slow {
  0%, 100% { transform: translateY(0) scale(1) rotate(0deg); }
  50% { transform: translateY(-30px) scale(1.03) rotate(3deg); }
}

.animate-float-slow {
  animation: float-slow 8s ease-in-out infinite;
}
```

### 3. Apply Background to All Pages

**Dashboard.tsx**:
```text
Add <FuturisticBackground variant="lite" /> inside the main container
Use lite mode by default since dashboard has dense content
```

**HospitalSelector.tsx**:
```text
Replace inline background elements with <FuturisticBackground />
Uses auto mode - full on desktop, lite on mobile
```

**Auth.tsx**:
```text
Replace inline background with <FuturisticBackground />
Uses auto mode for consistency
```

### 4. Optional: User Preference Toggle

Add a small toggle in settings or TopBar that lets users switch between full/lite mode. Store preference in localStorage.

---

## Component Design

```text
FuturisticBackground
├── Gradient Layer (always)
│   └── from-primary/5 via-background to-info/5
├── Grid Pattern Layer (always)
│   └── grid-pattern opacity-20
└── Orbs Layer (full mode only)
    ├── Orb 1: top-left, primary/10, animate-float
    ├── Orb 2: bottom-right, info/10, animate-float-slow
    └── Orb 3: center-left, success/10, animate-float (delay)
```

---

## Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `src/components/virtualis/FuturisticBackground.tsx` | Create | Reusable background component |
| `src/index.css` | Edit | Add `animate-float-slow` keyframe |
| `src/pages/Dashboard.tsx` | Edit | Add FuturisticBackground (lite) |
| `src/pages/HospitalSelector.tsx` | Edit | Replace inline background with component |
| `src/pages/Auth.tsx` | Edit | Replace inline background with component |

---

## Performance Considerations

**Lite mode benefits:**
- No CSS animations = reduced CPU/GPU usage
- Simpler DOM = faster paint times
- Better battery life on mobile devices
- Respects user accessibility preferences

**Detection logic:**
```text
isLite = 
  variant === 'lite' ||
  (variant === 'auto' && (
    window.matchMedia('(prefers-reduced-motion: reduce)').matches ||
    window.innerWidth < 1024
  ))
```

---

## Visual Result

| Page | Desktop | Mobile |
|------|---------|--------|
| Auth | Full (3 orbs, animated) | Lite (gradient + grid only) |
| Hospital Selector | Full | Lite |
| Dashboard | Lite | Lite |

The dashboard uses lite mode even on desktop because it has dense clinical content - the animations could be distracting during patient care.
