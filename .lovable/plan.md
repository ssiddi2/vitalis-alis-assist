## Plan: Add Navigation to MobileMenu

**Problem:** The mobile menu (`MobileMenu.tsx`) currently only shows AI status, time, and direct messages. On small screens (`< 1024px`), the TopBar navigation links are hidden (`hidden lg:flex`), leaving users unable to navigate between Schedule, Clinic, RCM, Quality, or the EMR Sandbox.

**Goal:** Add full navigation links to the mobile sheet so users can navigate on any viewport size.

**Implementation:**
1. **Update `src/components/virtualis/MobileMenu.tsx`**:
   - Import `useNavigate` from `react-router-dom` and required Lucide icons (`CalendarDays`, `Users`, `DollarSign`, `BarChart3`, `Server`, `Shield`).
   - Import `useAuth` to conditionally render the Admin Panel link for `isAdmin` users.
   - Import `isAmbulatory` from `@/config/deployment` to hide the Quality link in ambulatory mode.
   - Add a new navigation section between the status badges and the Direct Messages section.
   - Links to include:
     - **Schedule** (`/schedule`) — `CalendarDays` icon
     - **Clinic** (`/clinic`) — `Users` icon
     - **RCM** (`/billing`) — `DollarSign` icon
     - **Quality** (`/quality`) — `BarChart3` icon (hidden when `isAmbulatory` is true)
     - **EMR Sandbox** (`/emr-sandbox`) — `Server` icon
     - **Admin Panel** (`/admin`) — `Shield` icon (visible only to `isAdmin`)
   - Each nav item will be a button with an icon + label, styled to match the existing glassmorphic aesthetic (rounded-xl, hover states, muted foreground text).
   - Clicking a nav item will call `navigate()` and close the sheet (`setOpen(false)`).

**Files to change:**
- `src/components/virtualis/MobileMenu.tsx` (only file)

**No changes needed to:**
- `TopBar.tsx` (it already passes `currentTime`)
- `App.tsx` (routes already exist)
- Any backend or database code