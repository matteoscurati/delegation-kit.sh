#!/usr/bin/env node
// Sync the site from the delegation-kit checkout (source of truth).
//
// Reads (sibling repo, or DELEGATION_KIT_ROOT):
//   package.json, CHANGELOG.md, README.md, docs/*.md, model-routing.md, ADAPTING.md
//   bin/delegation-route table|resolve --json       (read-only router)
//   bin/delegation-executor-contract check --json   (read-only inspector)
// Writes:
//   src/data/kit.json, routing-table.json, resolve.json, contract.json
//   the AUTOGEN block of src/pages/docs/*.md and src/pages/changelog/index.md
//
// Usage:
//   node scripts/sync-kit.mjs          write everything
//   node scripts/sync-kit.mjs --check  exit 1 if anything is out of sync (CI)
//
// Nothing here dispatches a model: `table`, `resolve`, and `check` are the
// kit's own read-only commands.

import { execFileSync } from 'node:child_process';
import { readFile, writeFile, mkdir, access } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, relative, posix } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const siteRoot = resolve(__dirname, '..');
const kitRoot = resolve(
  process.env.DELEGATION_KIT_ROOT ?? resolve(siteRoot, '..', 'delegation-kit')
);
const isCheck = process.argv.includes('--check');
const GITHUB = 'https://github.com/matteoscurati/delegation-kit';

const BEGIN = '<!-- BEGIN AUTOGEN -->';
const END = '<!-- END AUTOGEN -->';

function fail(message) {
  console.error(`sync-kit: ${message}`);
  process.exit(1);
}

try {
  await access(resolve(kitRoot, 'bin', 'delegation-route'));
} catch {
  if (isCheck) {
    console.log(`sync-kit: kit checkout not found at ${kitRoot}; skipping --check.`);
    process.exit(0);
  }
  fail(`kit checkout not found at ${kitRoot} (set DELEGATION_KIT_ROOT)`);
}

const kitCommand = (bin, args) =>
  JSON.parse(
    execFileSync(resolve(kitRoot, 'bin', bin), args, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe']
    })
  );

let drift = [];
async function emit(relPath, content) {
  const abs = resolve(siteRoot, relPath);
  let current = null;
  try {
    current = await readFile(abs, 'utf8');
  } catch {}
  if (current === content) return;
  if (isCheck) {
    drift.push(relPath);
    return;
  }
  await mkdir(dirname(abs), { recursive: true });
  await writeFile(abs, content);
  console.log(`sync-kit: wrote ${relPath}`);
}

// ---- version + release date -------------------------------------------------
const pkg = JSON.parse(await readFile(resolve(kitRoot, 'package.json'), 'utf8'));
const changelog = await readFile(resolve(kitRoot, 'CHANGELOG.md'), 'utf8');
const head = changelog.match(/^## \[([^\]]+)\] — (\d{4}-\d{2}-\d{2})/m);
if (!head) fail('CHANGELOG.md has no `## [version] — date` heading');
if (head[1] !== pkg.version) fail(`CHANGELOG head ${head[1]} != package.json ${pkg.version}`);

// ---- router + contract ------------------------------------------------------
const table = kitCommand('delegation-route', ['table', '--json']);
const contract = kitCommand('delegation-executor-contract', ['check', '--json']);
const gates = JSON.parse(await readFile(resolve(kitRoot, 'config', 'routing-gates.json'), 'utf8'));

const lanes = [...new Set(table.profiles.map((row) => row.lane))].sort();
const reviewLanes = table.review_policy.review_lanes;
const families = [...new Set(Object.values(table.model_families))].sort();

// The lane resolver on the home page is the router's own answer, precomputed
// per lane (and per producer family for review lanes), so the CSS-only panel
// can never disagree with `delegation-route resolve`.
const resolveArgs = (lane, family) => [
  'resolve',
  '--lane',
  lane,
  '--json',
  ...(family ? ['--producer-family', family] : [])
];
const resolveData = { lanes: {}, review: {}, compound: {} };
for (const lane of lanes) {
  if (reviewLanes.includes(lane)) {
    resolveData.review[lane] = {};
    for (const family of families) {
      resolveData.review[lane][family] = kitCommand('delegation-route', resolveArgs(lane, family));
    }
  } else {
    resolveData.lanes[lane] = kitCommand('delegation-route', resolveArgs(lane));
  }
}
for (const lane of Object.keys(table.compound_lanes)) {
  // `resolve` on a compound lane returns the decision envelope; the lane's
  // own definition (members, protocol, activation) comes from `table`.
  resolveData.compound[lane] = {
    ...table.compound_lanes[lane],
    ...kitCommand('delegation-route', resolveArgs(lane))
  };
}

const kit = {
  version: pkg.version,
  releaseDate: head[2],
  profiles: new Set(table.profiles.map((row) => row.profile)).size,
  laneRows: table.profiles.length,
  lanes,
  reviewLanes,
  families,
  externalFamilies: contract.families,
  laneDeclarations: contract.lane_declarations,
  dispatchableLanes: contract.dispatchable_lanes,
  permissionClasses: contract.permission_classes,
  exitCodes: contract.exit_codes,
  patchPolicyVersion: contract.patch_policy_version,
  activation: gates.activation_policy,
  syncedAt: head[2]
};

const json = (value) => `${JSON.stringify(value, null, 2)}\n`;
await emit('src/data/kit.json', json(kit));
await emit('src/data/routing-table.json', json(table));
await emit('src/data/resolve.json', json(resolveData));
await emit('src/data/contract.json', json(contract));

// ---- markdown docs ----------------------------------------------------------
const routeFor = {
  'README.md': '/',
  'CHANGELOG.md': '/changelog',
  'ADAPTING.md': '/docs/adapting',
  'model-routing.md': '/docs/routing',
  'docs/external-executors.md': '/docs/executors',
  'docs/compatibility.md': '/docs/compatibility'
};

function rewriteLinks(markdown, sourcePath) {
  const sourceDir = posix.dirname(sourcePath);
  return markdown.replace(/\]\((\.\.?\/[^)#\s]+)(#[^)\s]*)?\)/g, (match, target, hash = '') => {
    const kitPath = posix.normalize(posix.join(sourceDir, target));
    if (routeFor[kitPath]) return `](${routeFor[kitPath]}${hash})`;
    return `](${GITHUB}/blob/main/${kitPath}${hash})`;
  });
}

async function syncDoc(sourcePath, sitePath) {
  let source = await readFile(resolve(kitRoot, sourcePath), 'utf8');
  source = rewriteLinks(source, sourcePath).trimEnd();
  const abs = resolve(siteRoot, sitePath);
  let page;
  try {
    page = await readFile(abs, 'utf8');
  } catch {
    fail(`missing page ${sitePath}; create it with the ${BEGIN} / ${END} markers first`);
  }
  const b = page.indexOf(BEGIN);
  const e = page.indexOf(END, b + BEGIN.length);
  if (b === -1 || e === -1) fail(`markers missing from ${sitePath}`);
  const next = `${page.slice(0, b + BEGIN.length)}\n\n${source}\n\n${page.slice(e)}`;
  await emit(sitePath, next);
}

await syncDoc('docs/external-executors.md', 'src/pages/docs/executors.md');
await syncDoc('docs/compatibility.md', 'src/pages/docs/compatibility.md');
await syncDoc('model-routing.md', 'src/pages/docs/routing.md');
await syncDoc('ADAPTING.md', 'src/pages/docs/adapting.md');

// Changelog: everything from the first version heading on.
const firstVersion = changelog.match(/^## \[/m);
if (!firstVersion) fail('CHANGELOG.md has no version headings');
{
  const sitePath = 'src/pages/changelog/index.md';
  const abs = resolve(siteRoot, sitePath);
  const page = await readFile(abs, 'utf8').catch(() => fail(`missing page ${sitePath}`));
  const b = page.indexOf(BEGIN);
  const e = page.indexOf(END, b + BEGIN.length);
  if (b === -1 || e === -1) fail(`markers missing from ${sitePath}`);
  const body = rewriteLinks(changelog.slice(firstVersion.index), 'CHANGELOG.md').trimEnd();
  await emit(sitePath, `${page.slice(0, b + BEGIN.length)}\n\n${body}\n\n${page.slice(e)}`);
}

if (isCheck) {
  if (drift.length) {
    console.error('sync-kit: out of sync with the kit checkout:');
    for (const p of drift) console.error(`  ${p}`);
    console.error('  Run `npm run sync-kit` to update.');
    process.exit(1);
  }
  console.log(
    `sync-kit: in sync with delegation-kit ${pkg.version} (${relative(siteRoot, kitRoot)}).`
  );
}
