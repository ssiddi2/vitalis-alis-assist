
# Rebrand to VirtualisOne (keep ALIS for Copilot)

Positioning: **VirtualisOne** = the universal EMR platform. **ALIS** = the AI copilot inside it.

## Asset
- Upload `Untitled design.png` to Lovable Assets as `src/assets/virtualis-one-logo.png.asset.json`.
- Keep existing `src/assets/alis-logo.png` untouched — still used wherever ALIS the assistant appears.

## Swap logo → VirtualisOne (product/platform branding)
| File | Change |
|---|---|
| `src/pages/Auth.tsx` | Replace the 3 `alisLogo` uses (left hero, mobile header, form card icon) with VirtualisOne logo. Update copy: H1 "Welcome to VirtualisOne", subhead "Universal EMR Intelligence Platform — powered by ALIS". |
| `index.html` | `<title>` → "VirtualisOne — Universal EMR Intelligence Platform". Meta description + OG title/description updated. Favicon stays (already the V mark). |
| `src/pages/Product.tsx` | Hero logo + product name → VirtualisOne; tagline "Powered by ALIS". |
| `src/pages/HospitalSelector.tsx` | Header logo → VirtualisOne (if present). |
| `src/components/virtualis/TopBar.tsx` | App brand mark → VirtualisOne wordmark/icon. |
| `src/pages/ROICalculator.tsx`, `src/pages/IntegrationSpec.tsx` | Any top-of-page brand logo → VirtualisOne. |

## Keep ALIS logo (assistant identity)
- `ALISPanel`, `ChatMessage`, `TypingIndicator`, `MobileALISFab`, `AmbientStatusIndicator`, `VoiceDictationButton`, any "Ask ALIS" affordance.

## Out of scope
- No backend, routing, or feature changes.
- No favicon change (current V mark already aligns).
- No design-token color changes.

Confirm and I'll implement.
