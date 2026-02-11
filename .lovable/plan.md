

# Production-Level Hardening

Comprehensive upgrade across security, admin capabilities, and reliability to bring the platform to production quality.

---

## 1. Security & Access Control

### Session Timeout (HIPAA compliance)
- Add an `InactivityGuard` component that monitors mouse/keyboard/touch events
- After 15 minutes of inactivity, show a "Session Expiring" warning modal with a 60-second countdown
- Auto-logout when countdown reaches zero, redirect to `/auth`
- Wrap all authenticated routes with this guard

### Protected Route Component
- Create a `ProtectedRoute` wrapper component that checks auth state and role
- Replace the scattered `useEffect` redirect patterns in `HospitalSelector`, `PatientCensus`, `Dashboard`, and `AdminPanel` with a single declarative approach
- Support role-based access: `<ProtectedRoute requiredRole="admin">` for `/admin`

### Password Strength Requirements
- Enforce minimum 8 characters, at least 1 uppercase, 1 number, 1 special character on the Reset Password page
- Show a real-time password strength indicator (weak/fair/strong) with visual bar
- Apply the same rules in the admin invite flow documentation/UI hints

### API Call Hardening
- Add a centralized `authenticatedFetch` utility that automatically attaches the current session token
- Standardize error handling for 401 (redirect to login) and 403 (show forbidden toast) across all edge function calls

---

## 2. Admin Panel Enhancement

### User Management Actions
- Add "Edit User" capability: click a user row to open an edit drawer/modal where admins can change role, add/remove hospital assignments
- Add "Deactivate User" with confirmation dialog (soft-disable via auth admin API)
- Add "Resend Invite" button for users who haven't yet accepted their invitation

### Multi-Hospital Assignment
- Allow assigning a user to multiple hospitals during creation (multi-select instead of single select)
- Show hospital assignment management in the edit modal

### Search, Filter, and Pagination
- Add a search input to filter users by name or email
- Add role filter dropdown (All / Admin / Clinician / Viewer)
- Add pagination for user list (20 per page) to handle growth

### Confirmation Dialogs
- Add `AlertDialog` confirmation before deactivating a user
- Add confirmation before role changes (especially escalation to admin)

---

## 3. Error Handling & Reliability

### Global Error Boundary
- Create an `ErrorBoundary` component wrapping the app that catches React render errors
- Display a friendly "Something went wrong" screen with a "Reload" button and option to report the error
- Log error details to the audit log for debugging

### Network Retry Logic
- Add retry with exponential backoff to critical API calls (patient data, clinical notes, vitals)
- Show a toast on retry: "Connection issue, retrying..."

### Loading Skeletons
- Replace all `Loader2` spinner-only states with content-aware skeleton screens:
  - Hospital selector: card-shaped skeletons
  - Patient census: grid of card skeletons
  - Patient dashboard: header skeleton + insight card skeletons
  - Admin panel: table row skeletons

### Offline/Connection Indicator
- Add a subtle banner at the top of the app when the browser goes offline
- Auto-dismiss when connectivity returns
- Pause realtime subscriptions during offline and reconnect gracefully

### Empty & Error States
- Standardize all empty states with consistent iconography and messaging
- Add error states to all data-fetching hooks with retry buttons

---

## Technical Details

### New Files
- `src/components/ProtectedRoute.tsx` -- route guard with role checking
- `src/components/InactivityGuard.tsx` -- session timeout monitor
- `src/components/ErrorBoundary.tsx` -- global React error boundary
- `src/components/ConnectionStatus.tsx` -- offline banner
- `src/components/ui/skeleton-patterns.tsx` -- reusable skeleton layouts (hospital card, patient card, table row, dashboard)
- `src/lib/authenticatedFetch.ts` -- centralized auth-aware fetch utility
- `src/components/virtualis/EditUserModal.tsx` -- admin user edit drawer

### Modified Files
- `src/App.tsx` -- wrap routes with `ProtectedRoute` and `ErrorBoundary`
- `src/pages/AdminPanel.tsx` -- add search/filter/pagination, edit/deactivate/resend actions, confirmation dialogs, skeleton loading
- `src/pages/ResetPassword.tsx` -- password strength indicator and stronger validation
- `src/pages/HospitalSelector.tsx` -- skeleton loading, remove manual auth redirect
- `src/pages/PatientCensus.tsx` -- skeleton loading, remove manual auth redirect
- `src/pages/Dashboard.tsx` -- skeleton loading, remove manual auth redirect, wrap with InactivityGuard
- `src/hooks/usePatients.ts` -- add retry logic and error state
- `src/hooks/usePatientDetails.ts` -- add retry logic and error state
- `supabase/functions/admin-create-user/index.ts` -- add `update_user`, `deactivate_user`, `resend_invite` actions

### Edge Function Changes
The `admin-create-user` edge function will be extended with three new actions:
- `update_user` -- update role and hospital assignments for an existing user
- `deactivate_user` -- ban/unban user via `auth.admin.updateUserById`
- `resend_invite` -- re-send the invitation email

No database schema changes required -- all changes use existing tables and the auth admin API.

