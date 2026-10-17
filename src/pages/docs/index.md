---
layout: ../../layouts/DocLayout.astro
title: 'Getting started — delegation-kit'
description: 'Install delegation-kit, name the decision model and the profiles it governs, check and serve the router, and send it your first request.'
path: '/docs'
---

# Getting started

Easy requests go to your cheap models; hard ones go to your strong ones.
delegation-kit installs `delegation-router`, an OpenAI-compatible endpoint on
your own machine: send it `"model": "auto"`, and a decision model you choose
rates how much capability the request needs, from 0 to 4. It sees an excerpt,
never your keys or your model names, and it cannot name a model. A public
index places each of your models on a rung, the rating sets the lowest rung
the request may use, and a published policy picks one model from your pool on
price. You choose the judge; your rules pick the model; every response says
why.

The kit also installs what the same profiles are dispatched through by hand:
a personal configuration that describes each model once, one dispatcher for
every adapter, the six provider runners with their own sandboxes, Claude Code
and Codex profiles, skills, and the always-loaded user-direction guard. Hand
dispatch never starts on its own; the router routes only what you send it
after you start `serve`.

## Requirements

macOS, `jq`, `git`, `python3`. Claude Code and/or Codex for the native
adapters. Provider runners need their own credentials: the installer asks
once, stores keys mode 600, and never copies them silently from another tool.

## Install

The shortest path is the npm installer. It clones the tagged release, verifies
it, and runs the same `install.sh` a clone would; nothing is copied into
`node_modules`:

```sh
npx delegation-kit           # interactive: asks for external keys once
npx delegation-kit --claude-only
npx delegation-kit --codex-only
npx delegation-kit --skip-doctor
```

From a clone, which is also where `doctor.sh` compares the installed kit with
the sources:

```sh
git clone https://github.com/matteoscurati/delegation-kit
cd delegation-kit
./install.sh        # or --claude-only / --codex-only
./doctor.sh         # verify everything is wired (add --ping for a live round-trip)
```

Claude-only, from the plugin marketplace:

```
/plugin marketplace add matteoscurati/delegation-kit
/plugin install delegation-kit
```

`./uninstall.sh` (or `npx delegation-kit --uninstall`) removes every installed
file, link and guarded block, and keeps your keys, your refreshed catalog and
the router's receipts beside the data home; the next install restores them.

## What the installer sets up

- **A personal configuration** at
  `${XDG_CONFIG_HOME:-$HOME/.config}/delegation-kit/config.json` (override with
  `DELEGATION_CONFIG_FILE`). A fresh install gets the default preset: one
  profile per model the kit knows, review `optional`. An existing file is never
  overwritten.
- **Commands** on `~/.local/bin`: `delegation-router`, `delegation-config`,
  `delegation-route`, `delegation-run`, `delegation-openai-compatible`, the six
  provider runners and `delegation-patch-verify`.
- **The catalog** and the decider prompt under the data home, beside the key
  files.

`./doctor.sh` answers "is this machine wired": configuration valid, commands
on PATH, runtimes reachable, and — first in its router section — which
decider governs which pool and which catalog is in effect.

## Your first routed request

```sh
# 1. The profiles you can call — one per model, keys by variable name only
delegation-config show

# 2. Add a router block: the decider first, then the profiles it governs
#    "router": {"decider": {"kind": "llm", "profile": "glm"},
#               "pool": ["glm", "opus"],
#               "default": "glm"}

# 3. Check — no network: the decider, the pool with its rungs and prices
delegation-router check

# 4. Ask for a recommendation on one prompt — one call to the decider, no dispatch
delegation-router decide --prompt-file /tmp/task.txt --json

# 5. Serve, then send "auto" from any OpenAI SDK with base_url http://127.0.0.1:4141/v1
delegation-router serve
curl -si 127.0.0.1:4141/v1/chat/completions -H 'Content-Type: application/json' \
  -d '{"model":"auto","messages":[{"role":"user","content":"Rename foo to bar in utils.py"}]}'
```

`glm` stands for an HTTP profile, GLM 5.3 Flash (mid rung) on an API key;
`opus` for a `claude-code` profile, Opus 5.5 (frontier rung) on your Claude
subscription, which answers through its CLI. The names are yours. With them,
the rename above goes to glm: the decider rates it 1 with code, the floor is
small, and glm is the cheapest code-capable model at small or above. A race
condition rated 3 goes to opus, the only model on frontier. The
[home page](/#how) walks through both.

The response carries `X-Router-*` headers and a `router` object: the signals,
the reasons, the candidates with their estimated cost, usage, what the
provider reported. The decider can be one of your cheap profiles, Levanto
Sage, TypeSafe Jev, your own Dipylon, a local classifier, or `none` (rules
only: every request goes to the default, the baseline `eval` measures the
others against). The ladder the policy climbs comes from the Artificial
Analysis index, and `delegation-router catalog refresh` rewrites it with your
own key. The [router page](/docs/router) has every field, the policy, the
error codes and the evaluation harness.

## Picking by hand

The same profiles can be dispatched one at a time, explicitly, from Claude
Code or Codex:

```sh
delegation-route resolve --lane builder --json                      # read-only: choices, blocked
delegation-route resolve --lane builder --selected-profile terra-builder --json
delegation-run --profile terra-builder --lane builder \
  --prompt-file /tmp/task.txt --output /tmp/result.txt --workdir /path/to/repo
```

`delegation-run` writes the output, a metrics file and a receipt with the
requested versus provider-reported model and the review status. Text adapters
return a patch the lead applies and tests; retries and reviews are dispatches
too, each with its own approval. The [dispatch page](/dispatch) resolves every
role against the default preset.

## Where next

- [The router](/docs/router) — decider, pool, policy, catalog, disclosure, eval.
- [Personal configuration](/docs/configuration) — profiles, adapters, keys and environment, adding a model, review, upgrading.
- [External executors](/docs/executors) — adapters, permission classes, the patch verifier.
- [Compatibility](/docs/compatibility) — the verified snapshot of the current release.
- [Changelog](/changelog).
