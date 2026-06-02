---
name: tracklution-pixel
description: "Install Tracklution tracking pixel on any webpage with standard events (PageView, ViewContent, AddToCart, InitiateCheckout). Includes the base pixel snippet, event firing for ecommerce actions. Use for: tracking setup, pixel installation, conversion tracking, ecommerce events, add to cart tracking. Triggers: tracklution, pixel, tracking pixel, install pixel, add tracking, conversion tracking, ecommerce tracking, add to cart event, pageview event, tracklution pixel"
---

# Tracklution Pixel Installation

Install the Tracklution tracking pixel on any webpage with standard ecommerce events.

## Before You Start

You need 3 values from the user (these change per project):
- **Account ID** — e.g. `LS-25654158-0`
- **Primary script URL** — e.g. `https://tralut.example.com/js/script-dynamic.js?version=XXXXX`
- **Fallback script URL** — e.g. `https://main-XXXXX.trlution.com/js/script-dynamic.js?version=XXXXX`
- **Currency** — e.g. `CAD`, `USD`, `GBP`

**ASK the user for these values if not provided.** Check the project's CLAUDE.md or existing pages first — they may already be documented.

## Base Pixel Snippet

Place this in `<head>` before `</head>` on every page. Replace the placeholder values:

```html
<!-- Tracklution Pixel -->
<script>
    !function(t,l,r,o,c,k,s)
    {if(t.tlq)return;c=t.tlq=function(){c.callMethod?
        c.callMethod(arguments):c.queue.push(arguments)};
        if(!t._tlq)t._tlq=c;c.push=c;c.loaded=!0;c.version='1.0';c.src=o;
        c.queue=[];k=l.createElement(r);k.async=!0;c.pd = false;c.tools = null;
        k.src=o;s=l.getElementsByTagName(r)[0];
        s.parentNode.insertBefore(k,s);k.onerror=function(){
        o='FALLBACK_SCRIPT_URL';
        t._tlq.src=o;k=l.createElement(r);k.async=!0;k.src=o;
        s.parentNode.insertBefore(k, s)
        }}(window,document,'script',
        'PRIMARY_SCRIPT_URL')

    tlq('init', 'ACCOUNT_ID');
    tlq('track', 'PageView');
    tlq('track', 'ViewContent', {content_name: 'PAGE_NAME_HERE'});
</script>
```

**Replace:**
- `PRIMARY_SCRIPT_URL` — the project's primary Tracklution script URL
- `FALLBACK_SCRIPT_URL` — the project's fallback Tracklution script URL
- `ACCOUNT_ID` — the project's Tracklution account ID
- `PAGE_NAME_HERE` — the actual page name (e.g., `'Premium Collection'`, `'Homepage'`)

## Standard Events

### PageView (automatic)
Fires on every page load. Already included in the base snippet above.

### ViewContent (automatic)
Fires on every page load with the page name. Already included in the base snippet above.

### AddToCart
Fire this whenever a user adds a product to cart. Place inside or right after the add-to-cart function:

```js
if (typeof tlq === 'function') {
  tlq('track', 'AddToCart', {
    content_name: 'Product Name (Variant Label)',
    content_ids: [variationOrProductId],
    value: priceAsNumber,
    currency: 'CURRENCY_CODE'
  });
}
```

**Parameters:**
- `content_name` — Product display name including variant (e.g., `"Purple Kush (Oz)"`)
- `content_ids` — Array with the product/variation ID
- `value` — Numeric price (e.g., `90`)
- `currency` — The project's currency code

### InitiateCheckout
Fire this when the user clicks the checkout/proceed button:

```js
if (typeof tlq === 'function') {
  tlq('track', 'InitiateCheckout', {
    value: cartTotalAsNumber,
    currency: 'CURRENCY_CODE',
    num_items: totalItemCount
  });
}
```

### Purchase (for thank-you/confirmation pages)
```js
if (typeof tlq === 'function') {
  tlq('track', 'Purchase', {
    value: orderTotal,
    currency: 'CURRENCY_CODE',
    content_ids: [arrayOfProductIds],
    num_items: totalItemCount
  });
}
```

## Backup (Secondary) Pixel

To fire a second Tracklution account ID alongside the primary pixel — **no second script needed**. The Tracklution script supports a `target` field in the event payload that routes that event to a different account ID, reusing the same `tlq` instance.

### When the user asks to add a backup pixel, ask for:
- **Backup Account ID** — e.g. `LS-65737984-4`

That's all. No second script URL needed.

### How to add it

**1. In the base snippet** — add two extra lines after the primary PageView/ViewContent:

```html
<!-- Tracklution Pixel -->
<script>
    !function(t,l,r,o,c,k,s){...}(window,document,'script','PRIMARY_SCRIPT_URL');
    tlq('init', 'PRIMARY_ACCOUNT_ID');
    tlq('track', 'PageView');
    tlq('track', 'ViewContent', {content_name: 'PAGE_NAME_HERE'});
    tlq('track', 'PageView', {target: 'BACKUP_ACCOUNT_ID'});
    tlq('track', 'ViewContent', {content_name: 'PAGE_NAME_HERE', target: 'BACKUP_ACCOUNT_ID'});
</script>
```

**2. Every `tlq('track', ...)` event call** — add a duplicate with `target: 'BACKUP_ACCOUNT_ID'`:

```js
// Primary pixel
if (typeof tlq === 'function') {
  tlq('track', 'AddToCart', { content_name: 'Product', value: price, currency: 'USD' });
}
// Backup pixel — same call, add target
if (typeof tlq === 'function') {
  tlq('track', 'AddToCart', { content_name: 'Product', value: price, currency: 'USD', target: 'BACKUP_ACCOUNT_ID' });
}
```

Apply the same pattern to `InitiateCheckout`, `Purchase`, and any other events.

### Key rules
- Never load a second `script-dynamic.js` — both pixels fight over `window.tlq` and `window.trlApp` and will break each other
- No `tlq('init', 'BACKUP_ACCOUNT_ID')` needed — `target` in the payload handles routing
- Always duplicate every event, not just PageView

## Pre-flight Audit (existing pages)

**Before touching any page that already has a Tracklution pixel, grep the file for these failure patterns:**

```
grep -n "trlution\|tracklution\|tlq\|trltn" <file>
```

Check for each of these problems and fix them all before considering the task done:

| Pattern to grep for | Problem | Fix |
|---|---|---|
| `<script async src="...trlution...">` | Simplified tag — never calls `init()` or any events. Pixel loads but fires nothing. | Replace with full IIFE snippet |
| `<script ... data-id="LS-...">` | Same broken format — `data-id` attribute is not how Tracklution initializes | Replace with full IIFE snippet + `tlq('init', ...)` |
| No `tlq('track', 'AddToCart'` anywhere | AddToCart never fires | Add to the ATC click handler |
| No `tlq('track', 'InitiateCheckout'` anywhere | Checkout funnel invisible | Add to checkout button click |
| Script version in URL doesn't match what user provided | Stale/wrong script version | Update the version query param |

## Installation Checklist

When installing on a new page (or auditing an existing one):

1. **Audit first** — grep for existing pixel tags, check against pre-flight table above
2. Get the Account ID, primary script URL (with correct version), and fallback script URL from the user or project docs
3. Ask if they need a backup pixel — if yes, get the backup Account ID
4. Add/replace with the full IIFE base snippet in `<head>` with the correct values
5. If backup pixel: add the two extra PageView/ViewContent lines with `target` in the snippet
6. Find the add-to-cart function/handler and add the `AddToCart` event (+ backup duplicate if needed)
7. Find the checkout button handler and add the `InitiateCheckout` event (+ backup duplicate if needed)
8. Always wrap `tlq()` calls in `if (typeof tlq === 'function')` to prevent errors if the script fails to load
9. Use the correct currency code for the project
10. Test by checking the browser console for `tlq` calls or the Tracklution dashboard
11. Document the pixel config in the project's CLAUDE.md for future pages

## Self-Learning

Before using this skill, read `LEARNED.md` in this folder if it exists.
After completing a task, append any new discoveries to `LEARNED.md`.
