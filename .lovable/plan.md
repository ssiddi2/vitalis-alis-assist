

# Fix Hospital Selector Loading Issue

## Problem Identified

The application is stuck on "Loading facilities..." because there's a fundamental architectural issue with authentication state management:

**Root Cause**: The `useAuth()` hook creates **separate state instances** for each component that calls it. This means:
- `HospitalProvider` has its own copy of auth state
- `HospitalSelector` has its own copy of auth state
- These states don't stay synchronized, causing race conditions

When you sign in:
1. Auth changes trigger in one instance
2. But the other instance may not have received the update yet
3. The loading state never properly resolves

## Solution

Create a proper `AuthProvider` context that shares authentication state across the entire app, similar to how `HospitalProvider` works.

### Changes Required

**1. Create AuthContext (`src/contexts/AuthContext.tsx`)**

Create a new context that wraps the existing auth logic:
- Move the auth state management into a provider
- Export both the provider and a `useAuth()` hook that reads from context
- All components will share the same auth state instance

**2. Update App.tsx**

Wrap the app with `AuthProvider` at the top level (outside `HospitalProvider`):
```text
QueryClientProvider
  └── TooltipProvider
        └── BrowserRouter
              └── AuthProvider (NEW - added here)
                    └── HospitalProvider
                          └── Routes
```

**3. Update existing useAuth hook**

Convert the current hook to use the new context instead of creating local state.

**4. Simplify HospitalContext.tsx** 

Remove the redundant auth hook call since auth state will now be properly shared.

---

## Technical Details

### New AuthContext Structure

The provider will:
- Initialize with `loading: true`
- Set up `onAuthStateChange` listener once at app startup
- Check for existing session with `getSession()`
- Fetch user role when authenticated
- Set `loading: false` only after initial auth check completes

### State Flow After Fix

1. App mounts → `AuthProvider` starts loading
2. Auth check completes → `loading: false`, `user` populated (or null)
3. `HospitalProvider` sees auth is ready → fetches hospitals
4. `HospitalSelector` shows hospitals (or redirects to auth if no user)

This ensures a single source of truth for authentication state.

