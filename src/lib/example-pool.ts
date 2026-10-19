// The worked example that runs through the home page: three models from three
// vendors, one per tier, each one a profile the default install ships —
// GPT-5.6 Luna (small, luna-clerk, through Codex), DeepSeek Flash (mid,
// deepseek-flash, an API key) and Claude Opus 5.5 (frontier, opus-reviewer,
// through Claude Code; kit 0.27.2 and later). Every number comes from src/data/catalog.json at build
// time, and `route()` mirrors tiered-v1's `choose()` in the kit
// (bin/lib/delegation_router_policy.py) for the requests the page shows. The
// same pool was checked with the kit's own `delegation-router check` and
// `choose()` on 2026-10-19, with opus-reviewer on claude-opus-5-5. If the catalog moves a model to another tier, or
// a request would land elsewhere, the build fails here instead of publishing
// copy that no longer matches the router.
import catalog from '../data/catalog.json';

export type Tier = 'small' | 'mid' | 'frontier';

type CatalogModel = {
  id: string;
  tier: string | null;
  index: number | null;
  source: string;
  price: { in: number; out: number } | null;
};

/** A 310-token request plus the default 1,024-token answer budget. */
export const REQUEST_TOKENS = 310;
export const ANSWER_TOKENS = 1024;
export const CONFIDENCE_FLOOR = 0.55;

export const catalogVersion = catalog.catalogVersion as string;
export const tiering = catalog.tiering as {
  rule: string;
  frontier_within: number;
  mid_within: number;
  top_index: number;
  source: string;
  date: string;
  attribution: string;
};

const round1 = (n: number) => Math.round(n * 10) / 10;
export const cuts = {
  top: tiering.top_index,
  frontier: round1(tiering.top_index - tiering.frontier_within),
  mid: round1(tiering.top_index - tiering.mid_within)
};

export type Profile = {
  /** The profile id in the kit's default install, as the config names it. */
  id: string;
  /** The catalog model. */
  model: string;
  name: string;
  /** How the model is reached, in a reader's words. */
  via: string;
  tier: Tier;
  index: number;
  price: { in: number; out: number };
  code: boolean;
  tierSource: string;
};

function profile(id: string, model: string, name: string, via: string, expected: Tier): Profile {
  const m = (catalog.models as CatalogModel[]).find((row) => row.id === model);
  if (!m || !m.price || m.index === null) throw new Error(`example pool: ${model} missing from the catalog`);
  if (m.tier !== expected)
    throw new Error(`example pool: ${model} is ${m.tier} in the catalog, the page says ${expected}`);
  return { id, model, name, via, tier: expected, index: m.index, price: m.price, code: true, tierSource: m.source };
}

export const luna = profile('luna-clerk', 'gpt-5.6-luna', 'GPT-5.6 Luna', 'through Codex', 'small');
export const flash = profile('deepseek-flash', 'deepseek-flash', 'DeepSeek Flash', 'an API key', 'mid');
export const opus = profile('opus-reviewer', 'claude-opus-5-5', 'Claude Opus 5.5', 'through Claude Code', 'frontier');
/** The pool in the order the config lists it; flash is the default and the decider. */
export const pool = [luna, flash, opus];
export const fallback = flash;

export const cost = (p: Profile) => (p.price.in * REQUEST_TOKENS + p.price.out * ANSWER_TOKENS) / 1e6;
export const usd = (n: number) => `$${n.toFixed(4)}`;
export const priceTag = (p: Profile) => usd(cost(p));

const RANK: Record<Tier, number> = { small: 0, mid: 1, frontier: 2 };
const UP: Record<Tier, Tier | null> = { small: 'mid', mid: 'frontier', frontier: null };

/** `failed`: the decider errored, timed out or answered outside the schema. */
export type Verdict = { difficulty: number; tags: ('code' | 'math')[]; confidence: number; failed?: string };
export type Route = {
  chosen: Profile;
  /** The tier the rating needs, after math lifts it; null when undecidable. */
  floor: Tier | null;
  undecidable: boolean;
};

/** tiered-v1 for the page's requests: no tools, no long input, no ceiling. */
export function route(v: Verdict, models: Profile[] = pool, dflt: Profile = fallback): Route {
  if (v.failed || v.confidence < CONFIDENCE_FLOOR) return { chosen: dflt, floor: null, undecidable: true };
  const d = v.difficulty / 4;
  const raw: Tier = d >= 0.75 ? 'frontier' : d < 0.375 ? 'small' : 'mid';
  const floor: Tier = raw === 'small' && v.tags.includes('math') ? 'mid' : raw;
  let candidates: Profile[] = [];
  if (v.tags.includes('code')) candidates = models.filter((p) => p.code && RANK[p.tier] >= RANK[floor]);
  let tier: Tier | null = floor;
  while (!candidates.length && tier) {
    const here: Tier = tier;
    candidates = models.filter((p) => p.tier === here);
    if (!candidates.length) tier = UP[here];
  }
  const chosen = [...candidates].sort((a, b) => cost(a) - cost(b))[0] ?? dflt;
  return { chosen, floor, undecidable: false };
}

export type Example = {
  request: string;
  v: Verdict;
  /** Where the kit's own policy sends it; the build checks route() agrees. */
  expect: Profile;
  /** The one-line reason the page prints. */
  why: string;
  r: Route;
};

function example(request: string, v: Verdict, expect: Profile, why: string): Example {
  const r = route(v);
  if (r.chosen !== expect)
    throw new Error(`example pool: "${request}" goes to ${r.chosen.name}, the page says ${expect.name}`);
  return { request, v, expect, why, r };
}

/** The requests the page follows, easiest first; the hero shows the first three. */
export const examples: Example[] = [
  example(
    'Rename foo to bar in utils.py',
    { difficulty: 1, tags: ['code'], confidence: 0.8 },
    luna,
    'Easy: small is enough, and Luna is your cheapest model.'
  ),
  example(
    'Summarise this contract',
    { difficulty: 2, tags: [], confidence: 0.8 },
    flash,
    'Medium: it needs mid, and DeepSeek Flash is your mid model.'
  ),
  example(
    'Find the race condition in this scheduler',
    { difficulty: 3, tags: ['code'], confidence: 0.8 },
    opus,
    'Hard: only frontier will do.'
  ),
  example(
    'What is 17% of 2,340?',
    { difficulty: 1, tags: ['math'], confidence: 0.8 },
    flash,
    'Easy, but math lifts it to mid.'
  ),
  example(
    'Any request, when the decider times out',
    { difficulty: 0, tags: [], confidence: 0, failed: 'timeout' },
    flash,
    'No rating: your default model answers, and the response says so.'
  )
];

/** "1 of 4 · code", or "no rating". */
export const rating = (v: Verdict) =>
  v.failed ? 'no rating' : [`${v.difficulty} of 4`, ...v.tags].join(' · ');
