## Full IA Overhaul — Make the App Make Sense

### The core problem

Right now after login you land on `/schedule` (because the build is in `ambulatory` mode, which forces `Navigate to="/schedule"`), the top nav is hidden under 1024px, the mobile menu has no links, and a pile of demo/integration/marketing routes (`/demo`, `/product`, `/emr-sandbox`, `/smart/launch`, `/integration-spec`, `/roi-calculator`) sit alongside real clinical routes with no labels or grouping. Nothing tells the user where they are or where to go.

### What you said you want

- A **role picker** style landing — not a forced schedule page.
- The **original Home** that shows the **multiple connected EMRs** (the HospitalSelector with Epic / Cerner / Meditech cards).
- Demo/sandbox/integration pages **kept visible but clearly labeled** so they stop looking like clinical features.
- A **full IA overhaul** — restructure navigation, rename sections, fix the post-login flow at every screen size.

### New information architecture

```text
LOGIN
  │
  ▼
HOME  (/)  ── "Choose your workspace"
  ├─ Clinical workspaces (EMR cards: Epic / Cerner / Meditech / +Add)
  │     click → enters that hospital's chart workspace
  ├─ My day        → /schedule
  ├─ My clinic     → /clinic
  └─ Quick links: Inbox · Notifications

PERSISTENT TOP BAR  (visible at ALL screen sizes via collapsible menu)
  ├─ Home
  ├─ Clinical  (Schedule, Clinic, Patient Census, Chart)
  ├─ Revenue   (RCM / Billing, Quality)
  ├─ Tools     ← NEW grouping for the confusing stuff
  │     ├─ EMR Sandbox        "FHIR data inspector — see what's syncing from connected EMRs"
  │     ├─ SMART Launcher     "Test SMART-on-FHIR app launch from an EHR"
  │     ├─ Integration Spec   "Technical FHIR integration docs (printable)"
  │     ├─ ROI Calculator     "Estimate savings for a prospective customer"
  │     └─ Product Page       "Public marketing page"
  └─ Admin    (admins only)
```

### Specific changes

**1. Landing = Home, not Schedule**
- `src/App.tsx`: remove the `isAmbulatory ? <Navigate to="/schedule"/> : <HospitalSelector/>` branch. Root `/` always renders `HospitalSelector` (rename internally to `Home`).
- Keep `/schedule`, `/clinic`, etc. as direct routes the Home page links into.

**2. Redesign Home as a role-aware launcher**
- `src/pages/HospitalSelector.tsx` becomes the Home page with three sections:
  - **Connected EMRs** — existing hospital cards (Epic/Cerner/Meditech), each opens that workspace.
  - **Jump back in** — "My Schedule today", "My Clinic", "Inbox" tiles.
  - **Tools & Demos** — small labeled tiles for Sandbox, SMART Launcher, ROI, Integration Spec, Product (hidden for non-admins if you want — confirm in build).
- Each tile has a one-line plain-English description so nothing is mysterious.

**3. Fix the navigation at every screen size**
- `src/components/virtualis/TopBar.tsx`: lower the breakpoint so the nav appears from `md:` (≥768px) instead of `lg:` (≥1024px), and regroup links into the new sections via a small dropdown ("Tools" menu) so the bar doesn't overflow.
- `src/components/virtualis/MobileMenu.tsx`: rebuild the link list around the new IA — Home, Clinical (Schedule/Clinic/Census), Revenue (RCM/Quality), Tools (Sandbox/SMART/Spec/ROI/Product), Admin. Each link gets the same one-line description as Home.

**4. Rename for clarity**
- "EMR Sandbox" → **"FHIR Data Inspector (Sandbox)"**
- "SMART Launch" → **"SMART-on-FHIR Launcher (Test)"**
- "Integration Spec" → **"Integration Spec (FHIR Docs)"**
- "Demo" → **"Public Demo Page"**
- Add a subtle "DEMO" or "DEV" badge on Tools-section pages so clinicians instantly know it's not a clinical workflow.

**5. Post-login redirect**
- After a successful login in `src/pages/Auth.tsx`, send users to `/` (Home), never directly into `/schedule`.

### Files touched

- `src/App.tsx` — root route logic
- `src/pages/HospitalSelector.tsx` — rebuilt as Home with three sections
- `src/components/virtualis/TopBar.tsx` — new grouped nav, lower breakpoint, Tools dropdown
- `src/components/virtualis/MobileMenu.tsx` — regrouped link list with descriptions
- `src/pages/Auth.tsx` — post-login redirect to `/`
- Light label/title tweaks in: `EmrSandbox.tsx`, `SmartLaunch.tsx`, `IntegrationSpec.tsx`, `Demo.tsx` (page titles + a small "Tool" badge)

### Out of scope (ask separately if you want them)

- Visual redesign (palette/typography) — this pass keeps the current glassmorphic look.
- Backend/role changes — uses the existing `isAdmin` from `useAuth` only.
- Deleting any routes — everything stays reachable, just labeled and grouped.
