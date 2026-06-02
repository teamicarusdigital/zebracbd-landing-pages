---
name: utm-forwarder
description: "Capture all URL parameters (UTM, coupon, gclid, fbclid, etc.) on landing page load, persist them across page redirects via sessionStorage, and automatically append them to all outbound links and checkout URLs. Use for: UTM tracking, parameter forwarding, attribution, campaign tracking, link decoration. Triggers: utm, utm forwarding, forward parameters, pass utm, campaign tracking, url parameters, query string forwarding, utm passthrough, parameter persistence"
---

# UTM Parameter Forwarder

Captures all incoming URL parameters on landing page load and forwards them to every outbound link and programmatic redirect. Parameters survive trailing-slash redirects and page reloads via sessionStorage backup.

## How It Works

1. **Capture** — On page load, grab the full query string from the URL
2. **Persist** — Store in sessionStorage so params survive redirects (e.g., trailing slash normalization)
3. **Retrieve** — Helper function that prefers live URL params, falls back to sessionStorage
4. **Append** — On load, decorate all outbound `<a>` links with the saved params
5. **Include** — Any JS-built URLs (checkout, cart, etc.) also append the saved params

## Implementation

### Step 1: Capture & Persist (place early in your JS, before any URL building)

```js
// === UTM & Parameter Capture ===
var PARAM_KEY = 'gh_incoming_params';  // Change prefix per project
var qs = window.location.search.replace(/^\?/, '');
if (qs) {
  try { sessionStorage.setItem(PARAM_KEY, qs); } catch(e) {}
}

function getSavedParams() {
  // Prefer live URL params, fall back to sessionStorage
  var live = window.location.search.replace(/^\?/, '');
  if (live) return live;
  try { return sessionStorage.getItem(PARAM_KEY) || ''; } catch(e) { return ''; }
}
```

**Change `PARAM_KEY`** to a project-specific key (e.g., `'lh_incoming_params'` for Lumova Health) to avoid collisions if multiple landing pages share a domain.

### Step 2: Append to All Outbound Links (run after DOM is ready)

```js
var savedParams = getSavedParams();
if (savedParams) {
  var outboundLinks = document.querySelectorAll('a[href^="http"]');
  for (var i = 0; i < outboundLinks.length; i++) {
    var href = outboundLinks[i].getAttribute('href');
    outboundLinks[i].setAttribute('href',
      href + (href.indexOf('?') === -1 ? '?' : '&') + savedParams
    );
  }
}
```

You can scope this to specific link classes instead of all `a[href^="http"]`:
```js
var productLinks = root.querySelectorAll('.product-link');
```

### Step 3: Include in JS-Built URLs (checkout, cart, etc.)

When building URLs programmatically (e.g., a checkout redirect), always append saved params:

```js
function buildCheckoutUrl() {
  var params = ['item_1=123', 'qty_1=2'];  // your cart params

  // Append all saved UTM/tracking params
  var saved = getSavedParams();
  if (saved) params.push(saved);

  return 'https://store.example.com/cart/?' + params.join('&');
}
```

## What Gets Forwarded

This captures and forwards ALL query parameters, not just UTMs. This includes:
- `utm_source`, `utm_medium`, `utm_campaign`, `utm_term`, `utm_content`
- `gclid` (Google Ads)
- `fbclid` (Facebook/Meta)
- `coupon`, `ref`, `discount`
- Any custom parameters

## Important Notes

- **sessionStorage is per-tab** — params don't leak between tabs
- **No expiry** — params persist for the browser tab's lifetime
- **Deduplication** — if the live URL has params, those are used; sessionStorage is only a fallback
- **Safe** — wrapped in try/catch for browsers with sessionStorage disabled
- **Order doesn't matter** — params are appended as a raw query string, not parsed individually
- **Works with any checkout/cart system** — WooCommerce, Shopify, custom, etc.

## Installation Checklist

1. Add the capture & persist block early in your page's `<script>`
2. Add the outbound link decorator after DOM content is ready
3. Update any JS-built URLs (checkout, redirects) to call `getSavedParams()`
4. Test with `?utm_source=test&utm_medium=test` and verify params appear on all outbound links
5. Document in the project's CLAUDE.md that UTM forwarding is active
