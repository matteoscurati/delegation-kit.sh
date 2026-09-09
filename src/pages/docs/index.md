---
layout: ../../layouts/DocLayout.astro
title: 'Getting started — delegation-kit'
description: 'Install delegation-kit, verify the bridge with doctor, and run your first user-directed delegation from Claude Code or Codex.'
path: '/docs'
---

# Getting started

delegation-kit installs, on one machine, everything Claude Code and Codex need
to delegate bounded coding work to other models under your direction: subagent
profiles, the routing skill, the executor skills, the read-only router, the six
gated external runners, and the always-loaded user-direction guard.

## Requirements

macOS, `jq`, `git`. Claude Code and/or Codex for the native lanes. External
runners need their own credentials: the installer asks once, stores keys mode
600, and never copies them silently from another tool.

## Install

```sh
git clone https://github.com/matteoscurati/delegation-kit
cd delegation-kit
./install.sh        # or --claude-only / --codex-only
./doctor.sh         # verify everything is wired (add --ping for a live round-trip)
```

Or, Claude-only, from the plugin marketplace:

```
/plugin marketplace add matteoscurati/delegation-kit
/plugin install delegation-kit
```

Or through npm, which clones the tagged release and runs the same installer:

```sh
npx delegation-kit           # interactive
npx delegation-kit --claude-only
npx delegation-kit --codex-only
```

`./uninstall.sh` (or `npx delegation-kit --uninstall`) removes every installed
file, link, and guarded block, and preserves stored keys as mode-600 backups.

## Is this machine current?

`install.sh` records what it installed; `doctor.sh` compares it with the
checkout. The "Installed version" section answers the question. A version
mismatch is a FAIL; a matching version with a different commit is normal while
unreleased work sits on `main`, and the fix is `./install.sh` again.

## Your first delegation

Delegation is user-directed and per dispatch. The flow is always the same:

```sh
# 1. Discover — read-only, never dispatches
delegation-route resolve --lane builder --json
#    → {"choices": [...], "requires_user_direction": true, "automatic_dispatch": false}

# 2. You choose — name the profile, or authorize the lead to pick from .choices
#    "Use terra-builder for <task>."
#    "Delegate <task> to a builder; show me the profiles first."

# 3. Validate — still read-only
delegation-route resolve --lane builder --selected-profile terra-builder --json

# 4. Dispatch — only now
codex exec --ephemeral -p terra-builder "<bounded, user-authorized task>" </dev/null
```

Prompt patterns that authorize a dispatch:

- `Use terra-builder for <task>.` — names the exact profile.
- `Delegate <task> to a builder; show me the available profiles before dispatch.`
- `You may choose one builder from the displayed choices for <task>.`

Task complexity, an installed skill, or a previous authorization is **not**
authorization. Retries and cross-family reviews are dispatches too: each needs
its own approval unless your request named that finite set.

## The lanes

| lane | who | notes |
|---|---|---|
| clerk / scout | Sonnet, Luna, GLM-5.3-Flash | very small bounded extraction, repo mapping, read-only support |
| builder / frontend-builder | Opus 5, GPT-5.6 Terra (both `max`); provisional: Kimi K3, Grok 4.6, Qwen, DeepSeek, GLM | bounded implementation; text-only lanes return a patch the lead applies |
| routine-review / material-review / security | Opus, Terra, Astra, Sonnet (tiny work only) | mandatory cross-family review — never the producer's family |
| judgement / super-judgement | Fable `max`, Astra `high` | manual-qualified, explicit-only, two-touch |

A lane becomes operational only through a versioned gate backed by exact
benchmark evidence plus a local runtime/scope smoke. Provisional lanes also
require your explicit decision plus the runner's `--allow-provisional` flag.
Blocked is blocked: no silent substitution, no runtime-availability shortcuts.
The full table, as the router computes it, is on the [home page](/).

## Governance, in four rules

- **User-directed activation.** `config/routing-gates.json` carries an
  `activation_policy` (`mode: user-directed`, `scope: per-dispatch`,
  `automatic_dispatch: false`). Every operational selection is `explicit-only`;
  there are no default or fallback routes.
- **Evidence-backed qualification.** Each lane's status (`qualified`,
  `provisional`, `manual-qualified`, `candidate`, `disabled`) is bound to dated
  benchmark rows plus local smokes. Frozen evaluation artifacts are never
  rewritten.
- **Fail-closed runners.** Every external runner validates the central gate
  against its own executable gate before every check and run, and refuses drift.
- **Read-only patch trust boundary.** Text-patch lane output passes through
  `delegation-patch-verify`; the lead, and only the lead, applies and tests.

## Where next

- [Routing policy](/docs/routing) — which model does which job, and the numbers.
- [External executors](/docs/executors) — the shared runner contract and the patch verifier.
- [Compatibility](/docs/compatibility) — verified snapshots per release.
- [Adapting](/docs/adapting) — map the roles to your own models.
- [Changelog](/changelog).
