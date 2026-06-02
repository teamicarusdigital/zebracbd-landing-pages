# Meta Pixel Skill — Learned

## 2026-02-16: First Deployment (Dual-Pixel + CAPI)

### Root causes found on broken setup:
- layout.tsx had an ACCESS TOKEN in the pixel ID field — `fbq('init')` silently accepts any string but events go nowhere. Always verify the value is a numeric pixel ID.
- Child page loaded fbevents.js a SECOND time (duplicate `<Script>` tag), causing race condition with layout's copy — conversion event never fired
- useEffect runs at same priority as `strategy="afterInteractive"` — no load-order guarantee, must poll for `window.fbq`
- Site had ZERO server-side CAPI — all tracking relied on browser pixel only (fails with ad blockers + iOS ATT)

### Verification methods:
- Don't trust cached page views — use `curl` to check compiled JS bundles for event strings
- Test CAPI individually per pixel: `curl -X POST /api/meta-pixel` and inspect each result in the `results` array
- `Promise.allSettled` masks individual failures — always check each result's `status` and `value`

### Token expiry:
- CAPI tokens DO expire. No notification from Meta when they do.
- Returns `OAuthException 190: The access token could not be decrypted`
- Recommend: check tokens quarterly or monitor for 190 errors in server logs

### Cross-domain redirect loses user data for CAPI:
- Flow: form page (email submit) → external service (Calendly/Stripe) → thank-you page (Lead event)
- Browser-side pixel works fine — `_fbp` cookie persists on the origin domain across the redirect
- CAPI conversion event had NO email/name — collected on a different page, lost during external redirect
- Fix: `localStorage.setItem('_lead_email', email)` on submit, read + clear on thank-you page
- localStorage survives external redirects (tied to origin domain), sessionStorage does NOT survive `window.location.href` to external domains and back
- Always clear stored PII after reading: `localStorage.removeItem(...)` — don't leave emails in storage

### Dual-pixel behaviour:
- `fbq('init', ID1); fbq('init', ID2);` — ALL subsequent `fbq('track', ...)` fire to BOTH pixels automatically
- No need to specify which pixel receives which event — they all get everything
- noscript fallback needs separate `<img>` tags per pixel (one img per pixel per event)
