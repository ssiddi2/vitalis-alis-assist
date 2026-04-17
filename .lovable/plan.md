

# Protect the Integration Spec Page

## The Problem
The `/integration-spec` route is publicly accessible on your live site. It contains confidential technical architecture details (FHIR mappings, API contracts, SMART on FHIR auth flows, internal data models) labeled "For InterSystems Discussion Only" — but anyone with the URL can read it.

## Recommended Approach

**Move the route behind authentication** so only logged-in users can access it.

### Changes

| File | Change |
|------|--------|
| `src/App.tsx` | Move the `/integration-spec` route inside the `ProtectedRoute` wrapper alongside the other authenticated routes |

This is a one-line move — the `ProtectedRoute` component already exists and wraps your dashboard routes. The integration spec page just needs to be inside that same wrapper.

### Alternative (if you want to share it externally)
Instead of a live page, generate a **watermarked PDF** from the page content and share that directly with InterSystems. The live route stays behind auth. This gives you control over distribution.

