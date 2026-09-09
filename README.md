# delegation-kit.sh

Showcase and docs site for [`delegation-kit`](https://github.com/matteoscurati/delegation-kit):
user-directed model delegation for Claude Code and Codex.

Built with **Astro 5** + **Tailwind v4** + **TypeScript**. Static-only output.
The only runtime JavaScript is the copy button on code blocks; the "Resolve a
lane" panel on the home page is radio buttons plus CSS `:has()`.

## What the site shows, and where it comes from

Everything that describes the kit is generated from the kit checkout, never
written by hand here:

| on the site                                                                 | source in `../delegation-kit`                                                            |
| --------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| version, release date, counts in the footer and hero                        | `package.json`, `CHANGELOG.md`, `delegation-executor-contract check --json`              |
| the routing table                                                           | `delegation-route table --json`                                                          |
| the "Resolve a lane" panel                                                  | `delegation-route resolve --lane … --json`, once per lane and per producer family        |
| `/docs/executors`, `/docs/compatibility`, `/docs/routing`, `/docs/adapting` | `docs/external-executors.md`, `docs/compatibility.md`, `model-routing.md`, `ADAPTING.md` |
| `/changelog`                                                                | `CHANGELOG.md`                                                                           |

`scripts/sync-kit.mjs` runs the kit's read-only commands and rewrites the
synced blocks between `<!-- BEGIN AUTOGEN -->` / `<!-- END AUTOGEN -->`
markers. It never dispatches a model.

```bash
npm run sync-kit          # refresh from ../delegation-kit (or DELEGATION_KIT_ROOT)
npm run sync-kit -- --check   # exit 1 if out of sync; skipped when the kit checkout is absent (CI)
```

`npm run build` runs the check first, then regenerates `public/og-image.png`
from `public/og-image.svg`.

## Develop

```bash
npm install
npm run dev       # http://localhost:4321
npm run check     # astro check: TypeScript + templates
npm run build     # static output in dist/
npm run preview
```

## Release sync

When the kit ships a version (its `release` flow, step "sync the showcase
site"): after npm serves the version, `npm run sync-kit`, `npm run build`,
commit, push. Pushing `main` deploys.

## Deploy

Production runs on **Cloudflare Workers with Static Assets**, connected to
this repository. First-time setup:

1. Push the repo: `gh repo create matteoscurati/delegation-kit.sh --public --source=. --push`
2. dash.cloudflare.com → Workers & Pages → Create → Connect to Git → pick
   `matteoscurati/delegation-kit.sh`. Worker name: `delegation-kit-sh`.
3. Build settings: framework preset **Astro**, build command `npm run build`,
   output directory `dist`, root directory empty. `.nvmrc` pins Node 20;
   `public/_headers` sets cache rules.
4. Save and Deploy. Every push to `main` deploys; PRs get preview URLs.
5. Custom domain: Worker → Settings → Domains & Routes → Add Custom Domain →
   `delegation-kit.sh` (and `www` as a redirect).

Any other static host works with the same build/output.

## Analytics

Umami Cloud, EU region, through the first-party proxy in `worker/`
(`analytics.delegation-kit.sh`). Off unless `PUBLIC_UMAMI_WEBSITE_ID` and
`PUBLIC_UMAMI_SCRIPT_URL` are set as build variables; see `.env.example` and
`/privacy`.

## Layout

```
src/
  components/   CodeBlock, StatusPill, RoutingTable, LaneResolver, ResolvePanel, UmamiAnalytics
  data/         kit.json, routing-table.json, resolve.json, contract.json  (generated)
  layouts/      BaseLayout, DocLayout
  pages/        index.astro, docs/*.md, changelog/index.md, privacy.md
  styles/       global.css (design tokens)
scripts/        sync-kit.mjs, generate-og-image.mjs
public/         favicon, og-image, prose.css, _headers, robots.txt
worker/         Umami proxy Worker
```

## License

MIT. Content synced from the kit repository is MIT there too.
