// Cloudflare Worker — first-party proxy for Umami Cloud analytics.
//
// Routes:
//   GET  analytics.delegation-kit.sh/script.js  → cloud.umami.is/script.js
//   POST analytics.delegation-kit.sh/api/send   → cloud.umami.is/api/send
//
// Why this exists: the analytics script and ingest endpoint are served
// from a first-party subdomain so ad-blockers (uBlock Origin, Brave
// Shields) don't drop them. Without this, ~30-40% of dev visitors get
// the script blocked because `umami.is` is on most filter lists.
//
// What this is NOT: a generic open proxy. Only the two paths above are
// forwarded; everything else returns 404. The visitor IP is forwarded
// via X-Forwarded-For so Umami's daily-salt hash still deduplicates
// visitors correctly (without it, every visitor would share the same
// Worker source IP and dedup would break).

const UPSTREAM = 'cloud.umami.is';
const ALLOWED_PATHS = new Set(['/script.js', '/api/send']);

export default {
  async fetch(request) {
    const url = new URL(request.url);

    if (!ALLOWED_PATHS.has(url.pathname)) {
      return new Response('Not Found', { status: 404 });
    }

    const upstreamUrl = new URL(
      url.pathname + url.search,
      `https://${UPSTREAM}`
    );

    const visitorIp = request.headers.get('cf-connecting-ip') ?? '';
    const headers = new Headers(request.headers);
    headers.set('Host', UPSTREAM);
    if (visitorIp) {
      headers.set('X-Forwarded-For', visitorIp);
      headers.set('X-Real-IP', visitorIp);
    }

    const proxied = new Request(upstreamUrl, {
      method: request.method,
      headers,
      body:
        request.method === 'GET' || request.method === 'HEAD'
          ? undefined
          : request.body,
      redirect: 'follow'
    });

    return fetch(proxied);
  }
};
