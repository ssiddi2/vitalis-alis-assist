

# ALIS AI Product Landing Page (`/product`)

## What We're Building
A public-facing marketing/product page at `/product` showcasing ALIS AI capabilities, ROI metrics, feature grid, and a live demo CTA. No auth required.

## Page Sections

1. **Hero** — ALIS logo, tagline ("Ambient Learning Intelligence System"), subtitle about AI-powered clinical workflows, two CTAs: "Try Live Demo" (links to published URL) and "Sign In"
2. **Feature Grid** — 6 cards: Ambient AI Scribe, Auto SOAP Notes, Intelligent Orders, Real-Time Billing, Clinical Trends, Multi-EMR Support
3. **ROI Metrics** — 3 animated stat cards: "15-30 min saved per patient", "60% fewer clicks", "15-25% billing capture improvement"
4. **How It Works** — 3-step visual: Listen → Analyze → Act
5. **Safety / Physician-in-the-Loop** — Brief section on ALIS never executing orders autonomously
6. **CTA Footer** — "Experience ALIS" with demo link to `https://vitalis-alis-assist.lovable.app`

## Files

| Action | File |
|--------|------|
| Create | `src/pages/Product.tsx` — Full landing page component |
| Edit | `src/App.tsx` — Add `/product` route (public, no ProtectedRoute) |

## Technical Notes
- Reuses `FuturisticBackground`, `alisLogo`, existing design tokens (primary blue, glass styles)
- No auth required — route sits outside `ProtectedRoute`
- Responsive: mobile-first grid layouts
- Uses lucide icons + existing card/button components
- Published URL hardcoded as demo CTA href

