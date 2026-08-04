> **STARTER TEMPLATE — review and adopt with legal/compliance counsel before relying on it.**

# EHR Integration Security (SMART-on-FHIR)

**Owner:** Engineering Lead · **Review:** on every integration change

VirtualisONE integrates with customer EHRs (Epic, Cerner, MEDITECH) as a SMART-on-FHIR application: EHR launch and standalone launch, authorization-code flow with PKCE, FHIR R4 reads, and writeback of clinician-signed notes and orders.

## 1. Threat model

The `iss` (issuer) parameter of a SMART launch is **attacker-controllable** — anyone can send a clinician a launch URL. If the application followed an arbitrary issuer, an attacker could (a) receive our client credentials, (b) drive a same-origin `javascript:` navigation and steal the EHR access token held in `sessionStorage`, or (c) impersonate an EHR to harvest writeback content. Every control below exists to close one of those paths.

## 2. Controls

### 2.1 Issuer allowlist — deny by default
`supabase/functions/_shared/fhirAllowlist.ts` builds the allowlist solely from the `ALLOWED_FHIR_ISS` environment variable. **There are no built-in defaults: if the variable is unset the allowlist is empty and every issuer is denied.** `isAllowedIss(iss)` requires the URL to parse, to use the `https:` scheme, and to exactly match an allowlisted base or be a path beneath it (preventing `https://evil.com/?x=https://good.org` style bypasses).

### 2.2 https-only, everywhere in the launch path
`src/pages/SmartLaunch.tsx` rejects a non-`https:` `iss` **before** discovery is attempted, and validates that the discovered `authorization_endpoint` and `token_endpoint` are `https:` **before** storing PKCE state or navigating. `src/lib/smart.ts` `discoverSmart()` repeats both checks (defence in depth) and honours the optional `VITE_SMART_ISS_ALLOWLIST` host list. `new URL()` happily accepts `javascript:` — these explicit scheme checks are what prevent a same-origin script execution and token theft.

### 2.3 PKCE
The authorization-code flow uses PKCE (S256). The verifier is generated client-side, retained for the session only, and sent once at token exchange, so an intercepted authorization code cannot be redeemed by a third party.

### 2.4 Server-side token exchange with endpoint re-derivation
Token exchange happens in the `smart-token` Edge Function, never in the browser, so `SMART_CLIENT_SECRET` is never exposed. Critically, the function **does not accept a client-supplied `token_endpoint`** — it re-derives the endpoint by performing SMART discovery against the issuer server-side (`discoverTokenEndpoint(iss)`), and the issuer itself must pass `isAllowedIss()`. This closes the SSRF/credential-exfiltration path in which a malicious `token_endpoint` would receive our client secret. The function runs behind `guard()` (origin-allowlisted CORS → authenticated caller → rate limit).

### 2.5 Redirect URI discipline
The OAuth `redirect_uri` is a full, same-origin public URL (`${window.location.origin}/...`) — never a protected route. The intended post-login destination is stored separately and navigated to only after the session is established.

### 2.6 EHR token custody
Access tokens returned by the EHR are treated as **Restricted** data: session-scoped, held in `sessionStorage` for the life of the browser session (not `localStorage`), never logged, never sent to any third party, and honoured only until the EHR's stated expiry. Closing the session discards them. Token theft is the highest-impact failure mode of this integration, which is why §2.2 exists.

### 2.7 Read controls
`fhir-sync` is authenticated via `guard()` and takes the FHIR base from the request, requiring it to pass `isAllowedIss()` — there is **no hardcoded public sandbox**, and an unallowlisted base returns 403. The probe deliberately returns only resource counts, a resource ID and `lastUpdated`; it does **not** return patient name, gender or birth date, so a connectivity check cannot surface identifiers.

### 2.8 Writeback controls
- Writeback is authenticated and hospital-scoped through `guard()` plus the tenancy helpers; a caller-supplied record ID is verified to belong to the caller's hospital before it is transmitted.
- Only **clinician-signed** artefacts are written back. Orders follow staged → signed → pushed-to-EMR, and notes require signature; AI drafts alone are never transmitted.
- Every transmission is recorded in `audit_logs`, with AI-drafted content flagged as AI-initiated.
- **Controlled substances (DEA Schedules II–V) are hard-blocked** at the transmission layer (`_shared/controlledSubstances.ts`) because EPCS certification has not been obtained. When no vendor is connected, an order is honestly shown as **queued** — never as "sent".

### 2.9 No upstream response echo
> **Rule: no upstream EHR response body is ever returned to a client.**

`fhir-writeback` returns only a status and a reason code. A FHIR `OperationOutcome` can embed PHI or internal system detail, so the body is withheld from the browser; if debugging requires it, only a truncated, non-identifying server-side note (status and length) is recorded. Reviewers must reject any change that reintroduces an upstream body in a client response.

## 3. Operational requirements

- Set `ALLOWED_FHIR_ISS` to the exact https base URLs of the customer's FHIR endpoints (and only those) before enabling the integration. Leaving it unset is safe — everything is denied.
- Register the redirect URI with each EHR partner and keep client credentials per-partner where the partner supports it.
- Re-review the allowlist whenever a customer is added or removed.

## 4. Gaps

- Token exchange relies on the EHR's TLS certificate validation only; certificate pinning is not implemented.
- There is no automated regression test asserting that a non-allowlisted issuer is rejected — recommended as the highest-value test to add.
- Epic/Cerner production onboarding (app registration, security review) is per-customer and not yet completed for all target sites.
