
# Remove Self-Service Signup

## What's Changing

The Auth page will become login-only. The signup toggle, "Create Account" form, full name field, and the "or" divider with the signup link will all be removed. Account creation will only happen through an administrator.

## Technical Details

### File: `src/pages/Auth.tsx`

- Remove the `isLogin` state and all signup-related branching
- Remove the `fullName` state and the Full Name input field
- Remove the signup branch from `handleSubmit` (the `else` block calling `supabase.auth.signUp`)
- Remove the "or" divider and the "Don't have an account? Sign up" / "Already have an account? Sign in" toggle button
- Keep the forgot password flow intact
- Update header text to always show "Welcome back" / "Sign in to access your clinical dashboard"
- The submit button always says "Sign In" (or "Send Reset Link" when in forgot-password mode)

No database or backend changes needed.
