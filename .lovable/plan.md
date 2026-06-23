# Add EMR Sandbox Access from Login Page

Add a single prominent button on `/auth` that opens `/emr-sandbox` in a new tab. No login required to view the sandbox (it's already a public route).

## Change

**`src/pages/Auth.tsx`** — add one button below the existing sign-in form:

```tsx
<a
  href="/emr-sandbox"
  target="_blank"
  rel="noreferrer"
  className="mt-4 flex items-center justify-center gap-2 w-full h-11 rounded-lg border-2 border-primary/30 bg-primary/5 hover:bg-primary/10 text-primary font-medium text-sm transition-colors"
>
  <Server className="w-4 h-4" />
  Open EMR Sandbox (no login required)
  <ExternalLink className="w-3.5 h-3.5" />
</a>
```

Placed directly under the "Sign in" button, separated by a thin divider with "DEMO" label so it reads as a demo-mode escape hatch rather than a primary auth path.

That's the entire change. No new files, no routing changes, no auth changes.
