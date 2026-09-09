# `worker/` — Umami analytics proxy

A tiny Cloudflare Worker that proxies `analytics.delegation-kit.sh/*` to
`cloud.umami.is/*`, so the analytics script and ingest endpoint are served
from a first-party subdomain. This bypasses ad-blockers (uBlock, Brave)
that drop `umami.is` by default.

Two paths are forwarded; everything else 404s. Visitor IP is preserved
via `X-Forwarded-For` so Umami's deduplication hash still works.

## Deploy — option A: dashboard (no CLI)

1. **Delete the existing DNS record.** Cloudflare → your zone → DNS →
   find `analytics CNAME cloud.umami.is` → Delete. The Worker custom
   domain step below recreates a different (proxied) record.
2. **Create the Worker.** dash.cloudflare.com → Workers & Pages → Create →
   Create Worker. Name: `delegation-kit-analytics-proxy`.
3. **Replace the default code** with the contents of `index.js` from this
   folder. Save and Deploy.
4. **Bind the custom domain.** Worker → Settings → Domains & Routes →
   Add → Custom Domain → enter `analytics.delegation-kit.sh`. Cloudflare
   provisions the DNS record and SSL automatically (~30s).
5. **Verify:**
   ```bash
   curl -sSI https://analytics.delegation-kit.sh/script.js
   # expected: HTTP/2 200, content-type: application/javascript
   ```

## Deploy — option B: wrangler CLI (versioned)

Prerequisite: delete the existing `analytics CNAME cloud.umami.is` from
Cloudflare DNS first (see step 1 above).

```bash
cd worker
npx wrangler login          # one-time
npx wrangler deploy         # uses wrangler.jsonc in this folder
```

`wrangler.jsonc` has `routes[0].custom_domain = true`, so the custom
domain is provisioned during deploy.

## Update

For both options, after editing `index.js`:

- Dashboard: paste the new code → Save and Deploy.
- CLI: `npx wrangler deploy` from this folder.

## Free tier

Cloudflare Workers free tier: **100,000 requests/day**. For a marketing
site, one analytics event per pageview is well within budget.

## What this proxy does NOT do

- It does not cache. Umami's own `Cache-Control` headers pass through.
- It does not modify the script or events.
- It does not log. Use Cloudflare's Workers analytics for traffic stats.
- It does not handle CORS itself. Umami already returns proper CORS
  headers for `/script.js` and `/api/send`.
