// The worked example that runs through the home page: a pool of two
// profiles, glm (GLM 5.3 Flash) and opus (Opus 5.5), with GPT-5.6 Luna as the
// optional third. Every number comes from src/data/catalog.json at build time,
// and `route()` mirrors tiered-v1's `choose()` in the kit
// (bin/lib/delegation_router_policy.py) for the requests the page shows.
// If the catalog moves a model to another rung, the build fails here instead
// of publishing copy that no longer matches the router.
import catalog from '../data/catalog.json';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

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
  key: 'glm' | 'opus' | 'luna';
  id: string;
  name: string;
  tier: Tier;
  index: number;
  price: { in: number; out: number };
  code: boolean;
  tierSource: string;
};

function profile(key: Profile['key'], id: string, name: string, expected: Tier): Profile {
  const m = (catalog.models as CatalogModel[]).find((row) => row.id === id);
  if (!m || !m.price || m.index === null) throw new Error(`example pool: ${id} missing from the catalog`);
  if (m.tier !== expected)
    throw new Error(`example pool: ${id} is ${m.tier} in the catalog, the page says ${expected}`);
  return { key, id, name, tier: expected, index: m.index, price: m.price, code: true, tierSource: m.source };
}

export const glm = profile('glm', 'glm-5.3-flash', 'GLM 5.3 Flash', 'mid');
export const opus = profile('opus', 'claude-opus-5-5', 'Opus 5.5', 'frontier');
export const luna = profile('luna', 'gpt-5.6-luna', 'GPT-5.6 Luna', 'small');

export const cost = (p: Profile) => (p.price.in * REQUEST_TOKENS + p.price.out * ANSWER_TOKENS) / 1e6;
export const usd = (n: number) => `$${n.toFixed(4)}`;
export const priceTag = (p: Profile) => usd(cost(p));

const RANK: Record<Tier, number> = { small: 0, mid: 1, frontier: 2 };
const UP: Record<Tier, Tier | null> = { small: 'mid', mid: 'frontier', frontier: null };

/** `failed`: the decider errored, timed out or answered outside the schema. */
export type Verdict = { difficulty: number; tags: ('code' | 'math')[]; confidence: number; failed?: string };
export type Route = {
  chosen: Profile;
  /** The rung the answer sets, after math lifts it; null when undecidable. */
  floor: Tier | null;
  /** The rung the answer set before a lift (only for math). */
  raw: Tier | null;
  candidates: Profile[];
  climbed: boolean;
  undecidable: boolean;
  reasons: string[];
};

/** tiered-v1 for the page's requests: no tools, no long input, no ceiling. */
export function route(v: Verdict, pool: Profile[], fallback: Profile = glm): Route {
  const reasons: string[] = [];
  if (v.failed) {
    reasons.push('no usable signal → default');
    return { chosen: fallback, floor: null, raw: null, candidates: [], climbed: false, undecidable: true, reasons };
  }
  if (v.confidence < CONFIDENCE_FLOOR) {
    reasons.push(`confidence ${v.confidence.toFixed(2)} < ${CONFIDENCE_FLOOR.toFixed(2)} → default`);
    return { chosen: fallback, floor: null, raw: null, candidates: [], climbed: false, undecidable: true, reasons };
  }
  const d = v.difficulty / 4;
  const raw: Tier = d >= 0.75 ? 'frontier' : d < 0.375 ? 'small' : 'mid';
  const floor: Tier = raw === 'small' && v.tags.includes('math') ? 'mid' : raw;
  reasons.push(`difficulty ${d.toFixed(2)}`);
  for (const t of ['code', 'math'] as const) if (v.tags.includes(t)) reasons.push(`tag ${t} 1.00`);
  let candidates: Profile[] = [];
  let climbed = false;
  if (v.tags.includes('code')) {
    candidates = pool.filter((p) => p.code && RANK[p.tier] >= RANK[floor]);
    if (candidates.length) reasons.push(`code → cheapest code-capable profile at tier ≥ ${floor}`);
  }
  let tier: Tier | null = floor;
  while (!candidates.length && tier) {
    const here: Tier = tier;
    candidates = pool.filter((p) => p.tier === here);
    if (candidates.length) reasons.push(`tier ${here} → cheapest eligible`);
    else {
      tier = UP[here];
      climbed = true;
      if (tier) reasons.push(`tier empty → escalate to ${tier}`);
    }
  }
  candidates = [...candidates].sort((a, b) => cost(a) - cost(b));
  const chosen = candidates[0] ?? fallback;
  reasons.push(`${chosen.key} is ${chosen.tier} (${chosen.tierSource})`);
  reasons.push(
    `candidates: ${candidates.map((p) => `${p.key} ${priceTag(p)}`).join(', ')} → ${chosen.key}`
  );
  return { chosen, floor, raw: v.tags.includes('math') ? raw : null, candidates, climbed, undecidable: false, reasons };
}

/** The request every diagram follows: "Rename foo to bar in utils.py". */
export const renameVerdict: Verdict = { difficulty: 1, tags: ['code'], confidence: 0.8 };
export const renameRoute = route(renameVerdict, [glm, opus]);
if (renameRoute.chosen !== glm) throw new Error('example pool: the rename no longer goes to glm');

/** The router-prompt digest and the policy version the headers quote. */
const PROMPT_DIGEST = '46002df5';
const POLICY_VERSION = '2026-10-13';

// When the kit checkout sits next to the site (the same lookup as
// scripts/sync-kit.mjs), the build checks both against it: the digest is the
// first 8 hex of sha256(config/router-prompt.v1.md), the version is
// POLICY_VERSION in bin/lib/delegation_router_policy.py. Without a checkout
// (a CI build from the synced data alone) the check is skipped.
{
  const kitRoot = resolve(process.env.DELEGATION_KIT_ROOT ?? resolve(process.cwd(), '..', 'delegation-kit'));
  const promptFile = resolve(kitRoot, 'config/router-prompt.v1.md');
  const policyFile = resolve(kitRoot, 'bin/lib/delegation_router_policy.py');
  if (existsSync(promptFile) && existsSync(policyFile)) {
    const digest = createHash('sha256').update(readFileSync(promptFile)).digest('hex').slice(0, 8);
    if (digest !== PROMPT_DIGEST)
      throw new Error(`example pool: the decider header quotes prompt digest ${PROMPT_DIGEST}, the kit's is ${digest}`);
    const version = /^POLICY_VERSION = "([^"]+)"/m.exec(readFileSync(policyFile, 'utf8'))?.[1];
    if (version !== POLICY_VERSION)
      throw new Error(`example pool: the policy header quotes ${POLICY_VERSION}, the kit's is ${version}`);
  }
}

/** Headers a served response carries for the rename, as the server formats them. */
export const renameHeaders = {
  profile: renameRoute.chosen.key,
  model: renameRoute.chosen.id,
  tier: renameRoute.chosen.tier,
  decider: `llm/${glm.id}+${PROMPT_DIGEST}`,
  policy: `tiered-v1/${POLICY_VERSION}`,
  difficulty: renameVerdict.difficulty.toFixed(1),
  confidence: String(renameVerdict.confidence)
};
