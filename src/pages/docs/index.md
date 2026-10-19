---
layout: ../../layouts/DocLayout.astro
title: 'Getting started — delegation-kit'
description: 'Install delegation-kit, choose a decider and two of your models, start the router and send your first request.'
path: '/docs'
---

# Getting started

delegation-kit is a model router that runs on your own machine: each request
goes to the cheapest of your models that is strong enough for it, and the
response says which model answered and why. [How it picks a model](/#how) is on
the home page.

## What you need

- macOS with `jq`, `git` and `python3`.
- Two or more models you can call. Each is either an API key (DeepSeek, Qwen,
  or any OpenAI-compatible endpoint, local ones included) or a plan you use
  through its own CLI (Claude, Codex, GLM, Kimi, Grok).
- The steps below use a DeepSeek API key and Claude Code signed in to Claude.

## 1. Install

```sh
npx delegation-kit
```

It fetches the release, installs the commands in `~/.local/bin`, asks for
the API keys it knows (Z.AI, DeepSeek, Qwen; press Enter to skip one) and then
checks the install. Keys are saved in files only you can read.

## 2. See your models

```sh
delegation-config show
```

Each entry is a *profile*: a short name for one model and how to reach it.
The install creates a set of them, some models more than once. You use these
names in the next step.

## 3. Choose the decider and the models

Open `~/.config/delegation-kit/config.json` and add a `"router"` entry next to
`"profiles"`:

```json
"router": {
  "decider": {"kind": "llm", "profile": "deepseek-flash"},
  "pool": ["deepseek-flash", "opus-reviewer"],
  "default": "deepseek-flash"
}
```

- `decider`: who rates each request. Here, DeepSeek Flash on your API key.
- `pool`: the models it may choose from. `deepseek-flash` is mid;
  `opus-reviewer` is Opus 5 on your Claude subscription, frontier.
- `default`: the model that answers when the decider can't.

Other deciders: a hosted service (Levanto Sage, TypeSafe Jev), your own
Dipylon service, a local classifier, or `none`, which always uses the default.
See [Deciders](/docs/router#deciders).

## 4. Check it

```sh
delegation-router check
```

It prints the decider and each model with its tier, without calling anything.

## 5. Start the router and send a request

```sh
delegation-router serve
```

In another terminal:

```sh
curl -si 127.0.0.1:4141/v1/chat/completions -H 'Content-Type: application/json' \
  -d '{"model":"auto","messages":[{"role":"user","content":"Rename foo to bar in utils.py"}]}'
```

From code, point any OpenAI SDK at `http://127.0.0.1:4141/v1` with
`model="auto"`. The API key you pass is ignored; each model uses its own.

## 6. Read why

The response headers name the choice:

```
X-Router-Model: deepseek-flash
X-Router-Tier: mid
X-Router-Difficulty: 1.0
```

`X-Router-Difficulty` is the decider's rating, 0 to 4. The `router` field in
the body lists the reasons and the estimated cost of each model it considered.
Here, a request rated 3 or 4 (or a very long one) goes to opus-reviewer;
everything else goes to deepseek-flash.

## Next

- [Router reference](/docs/router): every field, the deciders, the errors, `eval`.
- [Add a model](/docs/configuration#adding-a-model): your own key or endpoint.
- [Run a model by hand](/docs/dispatch): one task to one model you name, from
  Claude Code or Codex.

## Other ways to install

- `npx delegation-kit --claude-only` skips the Codex setup; `--codex-only`
  skips the Claude Code setup.
- From a clone: `git clone https://github.com/matteoscurati/delegation-kit`,
  then `./install.sh`; `./doctor.sh` checks the install.
- To remove it, run `./uninstall.sh` from a clone. Your keys are kept for the
  next install.
