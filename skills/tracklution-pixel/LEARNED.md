# Tracklution Pixel — Learned

## Dual pixel via `target` field (confirmed working — Mycolean, Apr 2025)

Loading two `script-dynamic.js` scripts on the same page always fails. Both scripts share `window.tlq` and `window.trlApp`. The second script's IIFE has a guard `if (window.trlApp) St()` — it detects the first app and skips creating its own instance entirely. All attempts to multiplex at the `callMethod` level also fail because `parseDomainConfig()` re-reads `window.tlq.src` on every single event.

**The correct approach:** pass `target: 'BACKUP_ACCOUNT_ID'` in the event payload. Confirmed working from a production WordPress implementation. No second script, no iframe, no multiplexer needed.

## MANDATORY: Always use this skill when installing Tracklution — never write from memory

NativeSmokes4Less (Apr 2026): pixel was installed in an earlier session without consulting this skill. Result: `tlq('init')` was called twice — once per pixel ID. The second init overwrote the first. LS-38632104-0 never fired. LS-97103238-6 never received events via `target:`. AddToCart was missing the backup duplicate. InitiateCheckout was missing entirely.

The rule "never call init twice, use target: for secondary pixels" is ONLY in this skill file — not common knowledge. If this skill isn't read before installation, the dual-init mistake is almost certain.

**Trigger phrases that should invoke this skill:** "add tracklution", "tracklution pixel", "install pixel", "add second pixel", "backup pixel", any mention of `LS-` account IDs.

## `<script async src="...">` tag format is silently broken (confirmed twyn, May 2026)

The simplified tag format looks installed but fires zero events:

```html
<!-- BROKEN — do not use -->
<script async src="https://main-39277.trlution.com/js/script-dynamic.js?version=..." id="trltn-pixel" data-id="LS-69253957-1"></script>
```

Why it breaks: the `data-id` attribute is ignored by the script — Tracklution only initializes when `tlq('init', 'LS-...')` is called explicitly. Without the IIFE snippet, `window.tlq` is never defined, so there is no queue and no events ever reach Tracklution. PageView, AddToCart, InitiateCheckout — all silently dropped.

**Always use the full IIFE snippet.** The pre-flight audit table in SKILL.md now catches this automatically.

## WholesaleHempFarms page — dual-init mistake repeated (May 2026)

Same dual-init mistake as NativeSmokes4Less. Backup pixel `LS-51326342-8` was added via a second `tlq('init', ...)` call in a prior session (without reading this skill). Fixed by: removing the second init, adding `target: 'LS-51326342-8'` duplicates for PageView + ViewContent in head, AddToCart in ATC handler, InitiateCheckout on checkout button onclick. AddToCart and InitiateCheckout were also missing entirely before this fix.

## Never try these approaches for dual pixels
- Two `script-dynamic.js` scripts in the same page (singleton guard blocks the second)
- Renaming `window.tlq` to `window.tlq2` (external script ignores it, looks for `window.tlq` only)
- Swapping `window._tlq` (script uses `window.tlq` directly, not `_tlq`)
- Saving `callMethod` as `cm1`/`cm2` and multiplexing (doesn't work — `wt()` always reads `window.trlApp` live, not a captured reference)
- Clearing `window.trlApp` + swapping `tlq.src` (partial fix but `parseDomainConfig` reads `tlq.src` on every event so src-swapping is race-prone)
- Hidden iframe (correct in theory but unnecessary given `target` field works)
