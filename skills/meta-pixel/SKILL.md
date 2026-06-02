# Meta Pixel Deployment Skill

Deploy Meta Pixel tracking (browser + server-side CAPI) on any website with multi-pixel support, event deduplication, and iOS ATT coverage.

## When to Use

- Installing Meta Pixel on a new site
- Adding a second pixel to an existing site
- Setting up Conversions API (CAPI) server-side events
- Fixing pixel events not firing (race conditions, wrong IDs, duplicate scripts)
- Passing user data (email/name) across external redirects for CAPI matching
- Verifying pixel + CAPI are working correctly

## Architecture Overview

```
User visits page
    |
    ├── Browser-side (global layout/template)
    |   ├── Load fbevents.js ONCE
    |   ├── fbq('init', PIXEL_1)
    |   ├── fbq('init', PIXEL_2)  ← optional second pixel
    |   └── fbq('track', 'PageView')  ← fires on ALL pages
    |
    ├── Form/action page (e.g. landing page, product page)
    |   ├── Browser: fbq('track', 'Contact', {}, { eventID })
    |   ├── Server: POST /api/meta-pixel (CAPI with email/name)
    |   └── localStorage: persist email/name for downstream pages
    |
    └── Conversion page (e.g. thank-you, order confirmation)
        ├── Browser: fbq('track', 'Lead', {}, { eventID })  ← with polling
        ├── Server: POST /api/meta-pixel (CAPI with same eventID)
        └── localStorage: read + clear persisted user data
```

## Step-by-Step Deployment

### Step 1: Gather Requirements

Before writing any code, confirm with the client:

| Item | Example | Notes |
|------|---------|-------|
| Pixel ID(s) | `123456789012345` | Always NUMERIC, never an access token |
| CAPI Access Token(s) | `EAAxxxxx...` | From Events Manager > Settings > Generate Token |
| Events to track | PageView, Lead, Contact, Purchase | Which events on which pages |
| Conversion page URLs | `/thank-you`, `/order-confirmation` | Where conversion events fire |
| External redirects | Calendly, Stripe, payment gateways | User leaves domain mid-funnel? |
| Graph API version | `v21.0` | Use latest stable version |

### Step 2: Pixel Init in Global Layout (Browser-Side)

Add to the root layout/template. This is the **single source of truth** for pixel initialization. Never init the pixel anywhere else.

#### Next.js (App Router)

```tsx
// layout.tsx
import Script from "next/script";

const FB_PIXEL_1 = "YOUR_PIXEL_ID_1";  // MUST be numeric pixel ID
const FB_PIXEL_2 = "YOUR_PIXEL_ID_2";  // Second pixel (if needed, otherwise remove)

// Inside <head>:
<Script id="fb-pixel" strategy="afterInteractive">
  {`
    !function(f,b,e,v,n,t,s)
    {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
    n.callMethod.apply(n,arguments):n.queue.push(arguments)};
    if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
    n.queue=[];t=b.createElement(e);t.async=!0;
    t.src=v;s=b.getElementsByTagName(e)[0];
    s.parentNode.insertBefore(t,s)}(window, document,'script',
    'https://connect.facebook.net/en_US/fbevents.js');
    fbq('init', '${FB_PIXEL_1}');
    fbq('init', '${FB_PIXEL_2}');
    fbq('track', 'PageView');
  `}
</Script>

// Inside <body> (noscript fallback per pixel):
<noscript>
  <img height="1" width="1" style={{ display: 'none' }}
    src={`https://www.facebook.com/tr?id=${FB_PIXEL_1}&ev=PageView&noscript=1`} alt="" />
  <img height="1" width="1" style={{ display: 'none' }}
    src={`https://www.facebook.com/tr?id=${FB_PIXEL_2}&ev=PageView&noscript=1`} alt="" />
</noscript>
```

#### Plain HTML / WordPress / Other Frameworks

```html
<!-- In <head> of global template (header.php, base.html, _app.tsx, etc.) -->
<script>
  !function(f,b,e,v,n,t,s)
  {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
  n.callMethod.apply(n,arguments):n.queue.push(arguments)};
  if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
  n.queue=[];t=b.createElement(e);t.async=!0;
  t.src=v;s=b.getElementsByTagName(e)[0];
  s.parentNode.insertBefore(t,s)}(window, document,'script',
  'https://connect.facebook.net/en_US/fbevents.js');
  fbq('init', 'YOUR_PIXEL_ID_1');
  fbq('init', 'YOUR_PIXEL_ID_2');
  fbq('track', 'PageView');
</script>
<noscript>
  <img height="1" width="1" style="display:none"
    src="https://www.facebook.com/tr?id=YOUR_PIXEL_ID_1&ev=PageView&noscript=1" />
  <img height="1" width="1" style="display:none"
    src="https://www.facebook.com/tr?id=YOUR_PIXEL_ID_2&ev=PageView&noscript=1" />
</noscript>
```

**Critical rules:**
- Load fbevents.js ONCE in the global layout — never load it again on any child page
- `fbq('init', ...)` accepts a numeric pixel ID string, NOT an access token
- Multiple `fbq('init', ...)` calls = all subsequent `fbq('track', ...)` fire to ALL initialized pixels
- For single-pixel setups, just use one `fbq('init', ...)` and one noscript img

### Step 3: Form Submission Event (with User Data Persistence)

When a user submits a form (email, contact info, etc.) and then gets redirected externally (Calendly, Stripe, payment gateway) before reaching a thank-you page, you must persist the user data so downstream pages can include it in CAPI calls.

```tsx
// On form submission handler:
const handleSubmit = async (formData) => {
  const eventId = 'contact_' + Math.random().toString(36).substr(2, 12) + '_' + Date.now();

  // 1. Browser-side event
  if (typeof window.fbq === 'function') {
    window.fbq('track', 'Contact', {}, { eventID: eventId });
  }

  // 2. Server-side CAPI (with user data for matching)
  const fbp = document.cookie.match(/(?:^|;\s*)_fbp=([^;]*)/)?.[1] || '';
  const fbc = document.cookie.match(/(?:^|;\s*)_fbc=([^;]*)/)?.[1] || '';
  fetch('/api/meta-pixel', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      event_name: 'Contact',
      event_id: eventId,
      source_url: window.location.href,
      user_agent: navigator.userAgent,
      email: formData.email,
      name: formData.name,
      fbp: fbp || undefined,
      fbc: fbc || undefined,
    }),
  }).catch(() => {});

  // 3. Persist user data for downstream conversion pages
  //    (survives external redirects — Calendly, Stripe, etc.)
  try {
    localStorage.setItem('_lead_email', formData.email || '');
    localStorage.setItem('_lead_name', formData.name || '');
  } catch {}

  // 4. Redirect to external service
  window.location.href = 'https://calendly.com/your-link';
};
```

**Why localStorage:** When the user leaves to an external domain (Calendly, Stripe) and returns to your thank-you page, `localStorage` persists because it's tied to the origin domain. `sessionStorage` does NOT survive `window.location.href` navigations to external domains and back.

**Security:** Always clear stored PII immediately after reading it on the downstream page.

### Step 4: Conversion Event with Polling + Persisted Data

On the conversion page (thank-you, order confirmation), fire the conversion event with:
1. Polling for `fbq` availability (race condition protection)
2. Persisted user data from the form page (for CAPI matching)
3. Shared `eventID` for deduplication

```tsx
// thank-you/page.tsx (or any conversion page)
'use client';
import { useEffect } from 'react';

export default function ThankYouPage() {
  useEffect(() => {
    const eventId = 'lead_' + Math.random().toString(36).substr(2, 12) + '_' + Date.now();

    // Browser-side: poll until fbq is ready (layout script loads async)
    const fireEvent = () => {
      const w = window as unknown as { fbq?: (...args: unknown[]) => void };
      if (w.fbq) {
        w.fbq('track', 'Lead', {}, { eventID: eventId });
        return true;
      }
      return false;
    };
    if (!fireEvent()) {
      const interval = setInterval(() => {
        if (fireEvent()) clearInterval(interval);
      }, 100);
      return () => clearInterval(interval);
    }

    // Retrieve persisted user data (from form page, survives external redirects)
    let leadEmail = '';
    let leadName = '';
    try {
      leadEmail = localStorage.getItem('_lead_email') || '';
      leadName = localStorage.getItem('_lead_name') || '';
      localStorage.removeItem('_lead_email');
      localStorage.removeItem('_lead_name');
    } catch {}

    // Server-side CAPI (deduped by eventId, includes user data for matching)
    const fbp = document.cookie.match(/(?:^|;\s*)_fbp=([^;]*)/)?.[1] || '';
    const fbc = document.cookie.match(/(?:^|;\s*)_fbc=([^;]*)/)?.[1] || '';
    fetch('/api/meta-pixel', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event_name: 'Lead',
        event_id: eventId,
        source_url: window.location.href,
        user_agent: navigator.userAgent,
        email: leadEmail || undefined,
        name: leadName || undefined,
        fbp: fbp || undefined,
        fbc: fbc || undefined,
      }),
    }).catch(() => {});
  }, []);

  return (/* page JSX */);
}
```

**Why polling:** `useEffect` and `strategy="afterInteractive"` both run post-hydration with no ordering guarantee. Polling every 100ms guarantees the event fires.

**Why eventID:** Browser sends `eventID` via fbq. Server sends the same `event_id` via CAPI. Meta deduplicates — counts as ONE event, not two.

### Step 5: CAPI API Route (Server-Side)

Create a server-side endpoint that forwards events to Facebook's Graph API. This works on any backend — Next.js API route, Express, serverless function, CloudFlare Worker, etc.

#### Next.js App Router

```typescript
// /api/meta-pixel/route.ts
import { NextRequest, NextResponse } from 'next/server';

const PIXELS = [
  {
    id: 'YOUR_PIXEL_ID_1',
    token: 'YOUR_CAPI_TOKEN_1',  // From Events Manager > Generate Token
  },
  // Add more pixels as needed:
  // { id: 'YOUR_PIXEL_ID_2', token: 'YOUR_CAPI_TOKEN_2' },
];
const API_VERSION = 'v21.0';

async function sha256Hash(value: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(value.trim().toLowerCase());
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { event_name, event_id, source_url, user_agent, ip_address, email, name, fbp, fbc } = body;

    const event_time = Math.floor(Date.now() / 1000);

    const user_data: Record<string, unknown> = {
      client_ip_address: ip_address || request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip'),
      client_user_agent: user_agent || request.headers.get('user-agent'),
    };

    if (email) user_data.em = [await sha256Hash(email)];
    if (name) user_data.fn = [await sha256Hash(name)];
    if (fbp) user_data.fbp = fbp;
    if (fbc) user_data.fbc = fbc;

    const payload = {
      data: [{
        event_name: event_name || 'PageView',
        event_time,
        event_id,
        event_source_url: source_url,
        action_source: 'website',
        user_data,
      }],
    };

    const results = await Promise.allSettled(
      PIXELS.map((pixel) =>
        fetch(
          `https://graph.facebook.com/${API_VERSION}/${pixel.id}/events?access_token=${pixel.token}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          }
        ).then((r) => r.json())
      )
    );

    return NextResponse.json({ success: true, results });
  } catch (error) {
    console.error('Meta CAPI error:', error);
    return NextResponse.json({ success: false }, { status: 500 });
  }
}
```

#### Express / Node.js

```javascript
const crypto = require('crypto');
const sha256 = (val) => crypto.createHash('sha256').update(val.trim().toLowerCase()).digest('hex');

app.post('/api/meta-pixel', async (req, res) => {
  const { event_name, event_id, source_url, user_agent, email, name, fbp, fbc } = req.body;
  const user_data = {
    client_ip_address: req.headers['x-forwarded-for'] || req.ip,
    client_user_agent: user_agent || req.headers['user-agent'],
  };
  if (email) user_data.em = [sha256(email)];
  if (name) user_data.fn = [sha256(name)];
  if (fbp) user_data.fbp = fbp;
  if (fbc) user_data.fbc = fbc;

  const payload = { data: [{ event_name, event_time: Math.floor(Date.now() / 1000), event_id, event_source_url: source_url, action_source: 'website', user_data }] };

  const results = await Promise.allSettled(
    PIXELS.map((px) => fetch(`https://graph.facebook.com/v21.0/${px.id}/events?access_token=${px.token}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
    }).then((r) => r.json()))
  );
  res.json({ success: true, results });
});
```

**Key details:**
- `Promise.allSettled` — one expired token doesn't kill the other pixel. Never use `Promise.all`
- SHA-256 hash PII before sending — Meta requires hashed email/name
- `_fbp` / `_fbc` — Meta's first-party cookies that link sessions to ad clicks. Higher match quality
- `action_source: 'website'` — required field, tells Meta the event originated from a website
- `x-forwarded-for` — on proxied hosts (Vercel, CloudFlare, Nginx), the real client IP is in this header

### Step 6: Verification

#### 1. Test browser pixels (should show all pixel IDs):
```bash
curl -s "https://yoursite.com/thank-you" | grep -o "fbq('init', '[0-9]*')"
```

#### 2. Test CAPI endpoint:
```bash
curl -s -X POST "https://yoursite.com/api/meta-pixel" \
  -H "Content-Type: application/json" \
  -d '{"event_name":"Lead","event_id":"test_001","source_url":"https://yoursite.com/thank-you","user_agent":"TestAgent"}'
```

**Working response:**
```json
{"success":true,"results":[{"status":"fulfilled","value":{"events_received":1,"messages":[]}}]}
```

**Expired token response:**
```json
{"status":"fulfilled","value":{"error":{"message":"The access token could not be decrypted","type":"OAuthException","code":190}}}
```

#### 3. Check Events Manager:
- Events Manager > Your Pixel > Test Events tab
- Open your site, trigger the conversion
- Both browser and server events should appear with matching event IDs

#### 4. Check Event Match Quality:
- Events Manager > Your Pixel > Overview > Event Match Quality
- Score should be Good or Great (6+/10) with CAPI + `_fbp`/`_fbc` + email

## Common Pitfalls

### 1. Using access token as pixel ID
**Symptom:** Pixel Helper shows "Pixel not found" or events don't appear in Events Manager.
**Cause:** `fbq('init', 'EAAxxxxx...')` — that's a token, not an ID.
**Fix:** Use the numeric pixel ID: `fbq('init', '123456789012345')`.

### 2. Duplicate pixel script on child pages
**Symptom:** PageView fires but conversion events (Lead, Purchase) silently fail.
**Cause:** Child page loads `fbevents.js` again, creating a race condition with the layout's copy.
**Fix:** Load pixel ONLY in the global layout. Child pages just call `fbq('track', ...)`.

### 3. fbq not ready when event fires
**Symptom:** Conversion event fires intermittently — works sometimes, fails on fast page loads.
**Cause:** Script and component both load post-hydration with no ordering guarantee.
**Fix:** Poll for `window.fbq` existence before calling it (see Step 4).

### 4. No event deduplication
**Symptom:** Events counted twice in Events Manager after adding CAPI.
**Cause:** Browser fbq and CAPI both send the same event without a shared `eventID`.
**Fix:** Generate one `eventId`, pass it to both `fbq('track', ..., { eventID })` and the CAPI `event_id`.

### 5. Promise.all instead of Promise.allSettled for multi-pixel CAPI
**Symptom:** CAPI returns 500 error, no events sent to any pixel.
**Cause:** `Promise.all` rejects if ANY pixel fails. Kills working pixels too.
**Fix:** Use `Promise.allSettled` — each pixel resolves/rejects independently.

### 6. CAPI token expired
**Symptom:** `OAuthException code 190: The access token could not be decrypted`.
**Fix:** Regenerate from Facebook Events Manager > Pixel Settings > Generate Access Token. Tokens expire without warning. Check quarterly.

### 7. Missing _fbp/_fbc cookies in CAPI
**Symptom:** Low "Event Match Quality" score in Events Manager.
**Cause:** Not forwarding Meta's first-party cookies to the CAPI call.
**Fix:** Read `_fbp` and `_fbc` from `document.cookie`, send in CAPI request body.

### 8. User data lost after external redirect
**Symptom:** CAPI conversion event has no email/name for matching (low match quality).
**Cause:** User submits email on page A, gets redirected to external service (Calendly, Stripe), returns to thank-you page — but email was never persisted.
**Fix:** Store email/name in `localStorage` on form submit, read + clear on thank-you page. `localStorage` survives external redirects (tied to origin domain). `sessionStorage` does NOT survive `window.location.href` to external domains.

## Supported Events Reference

| Event | Use For | Typical Page |
|-------|---------|-------------|
| `PageView` | All pages (auto via layout) | Every page |
| `Lead` | Form submission, booking confirmation | /thank-you |
| `Contact` | Contact form, inquiry form | /contact |
| `Purchase` | Completed purchase | /order-confirmation |
| `AddToCart` | Added product to cart | Product page |
| `InitiateCheckout` | Started checkout | /checkout |
| `ViewContent` | Viewed key content | Product/service pages |
| `CompleteRegistration` | Account signup | /welcome |
| `Subscribe` | Newsletter/subscription | /subscribe |

## Environment Variables (Recommended)

For production deployments, store pixel IDs and tokens as environment variables instead of hardcoding:

```env
# .env.local
META_PIXEL_ID_1=123456789012345
META_PIXEL_TOKEN_1=EAAxxxxx...
META_PIXEL_ID_2=987654321098765
META_PIXEL_TOKEN_2=EAAyyyyy...
META_GRAPH_API_VERSION=v21.0
```

Then reference in code:
```typescript
const PIXELS = [
  { id: process.env.META_PIXEL_ID_1!, token: process.env.META_PIXEL_TOKEN_1! },
  { id: process.env.META_PIXEL_ID_2!, token: process.env.META_PIXEL_TOKEN_2! },
].filter(p => p.id && p.token);  // Only include pixels with both ID and token
```

For the browser-side pixel init in layout, pixel IDs must be public (they're in the HTML), so use `NEXT_PUBLIC_` prefix or hardcode them.

## Self-Learning

Before each use, read `LEARNED.md` in this skill directory for accumulated lessons. After completing a pixel deployment or debugging session, append what was learned (new pitfalls, framework-specific quirks, API changes) to `LEARNED.md`. Keep entries under 50 lines, expire after 3 months, merge duplicates.
