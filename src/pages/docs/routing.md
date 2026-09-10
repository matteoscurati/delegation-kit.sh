---
layout: ../../layouts/DocLayout.astro
title: 'Routing policy — delegation-kit'
description: 'The evidence-backed model-routing policy behind delegation-kit: which model does which job, and why.'
path: '/docs/routing'
---

> Synced from [`model-routing.md`](https://github.com/matteoscurati/delegation-kit/blob/main/model-routing.md) in the kit repository. Edit there, not here.

<!-- BEGIN AUTOGEN -->

# User-directed model routing

`delegation-route` reads personal configuration and the code-owned adapter
capabilities. Models do not require kit qualification. Historical statuses,
benchmarks and evidence remain advisory and preserve their original meanings.

Display `.choices`, obtain the user's explicit selection or permission to choose,
and validate it with `resolve --selected-profile`. Validation never dispatches
or grants authorization. Each retry, fallback, review or additional worker needs
its own explicit authorization. The default review policy is `optional`; users
may choose `required` or `cross-family`. Mandatory review does not authorize a call.

The integrating lead verifies outputs, tests patches and owns the final response.
See [configuration and migration](/docs/configuration) for schemas,
provider examples, capabilities, identity provenance and review receipts.

<!-- END AUTOGEN -->
