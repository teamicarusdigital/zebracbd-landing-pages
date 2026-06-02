---
name: zebracbd-landing-builder
description: Use when given a Zebra CBD funnel/offer link or saved page (zebracbd-offer.com URL, a Shopify product, or a downloaded .htm) to turn into a conversion landing page that funnels to zebracbd.com. Triggers — "make a page like this", "build a landing page from this link", "wire this offer", "create page N", "add another product page". Ensures UTM forwarding, Meta Pixel tracking, the cart drawer, and the Shopify/Recharge checkout handoff are all wired correctly.
---

# Zebra CBD Landing Builder

## Overview
Turn a funnel/offer link into a fast, single-file conversion landing page in the **Zebra CBD "Calm Commerce"** theme that funnels to `zebracbd.com`. Every page in this repo (`page 1`–`page 4`) follows this exact pattern.

**Core principle:** Clone the most recent validated page as the template, then swap in the new product's *content + images + verified variant data*. NEVER hand-write the commerce engine from scratch — copy it and change the data. Keep the theme locked; only layout/content changes.

- **Single product** → clone `page 3/index.html` (deep buy box: size tiles + qty + Subscribe & Save).
- **Two+ products / collection** → clone `page 4/index.html` (multi-product cart, "Complete Sleep System" bundle, free-ship nudge).

## When to use
- User shares a `zebracbd-offer.com/...` URL, a `zebracbd.com/products/...` link, or a saved `.htm`.
- "Build/clone a landing page", "create page N", "wire this image to a product", "add UTM/pixel".
- NOT for non-Zebra sites or pages that don't check out on `zebracbd.com`.

## Required sub-skills (always apply)
- **utm-forwarder** — persist incoming `?utm_*`/params and append to every `zebracbd.com` outbound link + checkout.
- **meta-pixel** — Meta Pixel `1271510024436196`: PageView, ViewContent, AddToCart, InitiateCheckout.
- **ui-ux-pro-max** — run for layout/UX guidance (`python skills/ui-ux-pro-max/scripts/search.py "<query>" --design-system`). Colors stay locked.

## Locked theme tokens (NEVER change — this is "the theme")
```css
--primary:#3A913F; --primary-dark:#2F7A34; --black:#121212; --cream:#F2F2EB;
--surface:#F8F8F5; --white:#FFFFFF; --ink:#000000; --muted:#6E6E6E;
--border:#D9D9D1; --error:#C93C3C; --gold:#E2A300;  /* star ratings only */
--r-md:10px; --r-pill:9999px;   /* Nunito font, pill CTAs */
```
Audit before shipping: every hex must be in this set (rgba of these is fine). Product *photos* may be any color — that's not the theme.

## Workflow

### 1. Gather the source (link → content + images)
```bash
# live funnel page
curl -sL -A "Mozilla/5.0" "<offer-url>" -o src.html
# parse content + image URLs with BeautifulSoup (strip script/style); list <img src> and any
# zebracbd.com /cart/<vid>:1?discount=CODE links — these reveal the real variant IDs + discount code.
```
For a **saved .htm** with inline base64 images, decode them (see `page 3` build: extract → dedupe → save to `assets/`). Review every image (build a PIL contact sheet) and map each to a slot; **exclude wrong-product or low-res duplicate graphics** and say so.

### 2. Get VERIFIED variant data from the store (critical — checkout breaks otherwise)
```bash
# resolve products + all variants/prices/compare-at
curl -sL "https://zebracbd.com/products.json?limit=250" -o store.json   # grep for the funnel's variant IDs
# per product: variants, compare_at, AND subscription selling plans
curl -sL "https://zebracbd.com/products/<handle>.js" -o p.js
```
Record per variant: `vid`, `price`, `compare_at_price`, and `selling_plan_allocations`.
- **If plan price < variant price** → real Subscribe & Save discount exists (e.g. roll-on 10/15/25%) → include subscribe option (see `page 3`).
- **If plan price == variant price** → NO subscribe discount → omit subscriptions; rely on pack tiers + bundle (see `page 4`).

### 3. Build the page (clone template, swap data)
Copy the matching template's `<head>` (meta, Pixel, fonts), CSS tokens, and the entire `<script>` commerce engine **verbatim**, then change only: `PRODUCTS`/`VARIANTS` (vids, prices), product copy, images, reviews, FAQ, comparison. Keep all JS hook IDs intact.

### 4. Checkout handoff (the part that's easy to get wrong)
- **One-time, any number of lines:** fast permalink `STORE+'/cart/'+vid+':'+qty[,vid:qty...]'`.
- **Subscription line:** `STORE+'/cart/add?id=<vid>&quantity=<q>&selling_plan=<plan>&return_to=/checkout'` — a `/cart/<vid>:q?selling_plan=` permalink DROPS the plan.
- **Discount code:** if the funnel's cart links carry `?discount=CODE` (e.g. `ZEBRA30BUNDLE`), forward it on checkout. **Verify the code's real % at checkout** before advertising it (ZEBRA30BUNDLE is 30%, not the "20%" the copy implied). If you display discounted prices, compute per line floored to the cent like Shopify: `disc(p)=p-Math.floor(p*RATE*100)/100`.
- **Always** append saved UTM params to the final URL.

### 5. Verify with a real browser (do not skip)
Serve it (`python -m http.server <port> --directory "page N"`) and drive it via Chrome DevTools Protocol (Node 24 has built-in `WebSocket`+`fetch`; see the `cdp_*.mjs` harnesses in `%TEMP%` from prior builds). Confirm:
- prices/totals correct; size/plan toggles update totals; Add-to-Cart fills the drawer; **checkout URL** has the right vids + discount + UTM.
- **0 horizontal overflow at 390px**, touch targets ≥44px, body ≥16px, no JS exceptions/console errors.
- If you display discounted prices, the cart subtotal must equal the Shopify checkout subtotal.

## Gotchas (learned the hard way)
| Trap | Do this instead |
|------|-----------------|
| Hand-coding cart/checkout | Clone `page 3`/`page 4` engine; change data only |
| Guessing variant IDs/prices | Pull from `products.json` + `<handle>.js`; never invent |
| Fabricated "was" prices | "was" = real `compare_at` or regular price; never made up |
| Advertised % ≠ coupon % | Verify the discount code's real % at checkout |
| Subscription via `/cart/<vid>:q?selling_plan=` | Use `/cart/add?...&return_to=/checkout` (permalink drops the plan) |
| Baked-text hero image | If the header art has no text, overlay your own H1/CTA on a scrim (responsive, SEO) |
| Negative-offset badges (`right:-10px`) | Cause mobile overflow — keep inside the container |
| `.reveal{opacity:0}` with JS off | Add `<noscript><style>.reveal{opacity:1}</style></noscript>` |
| Off-theme colors creeping in | Audit hex against the locked tokens before shipping |

## Reference implementations
- **`page 3/index.html`** — single product, Subscribe & Save (10/15/25%), reviews carousel, sticky mobile add-to-cart.
- **`page 4/index.html`** — two-product collection, bundle, multi-product cart, free-shipping nudge, displayed 30%-off prices matching checkout.
- Page meta in `~/.claude/projects/.../memory/page{1..4}-*.md`.
