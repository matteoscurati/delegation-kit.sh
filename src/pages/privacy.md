---
layout: ../layouts/DocLayout.astro
title: 'Privacy — delegation-kit.sh'
description: 'Privacy policy for delegation-kit.sh. Anonymous, cookieless analytics via Umami Cloud (EU). No tracking, no advertising, no third parties.'
path: '/privacy'
---

# Privacy

_Last updated: 2026-09-09._

This site uses **Umami Cloud** (EU region) for privacy-friendly analytics, and
only once the site operator enables it. No cookies, no fingerprinting, no
cross-site tracking, no advertising. You do not need to accept anything to read
this site.

## Data controller

The site is operated by **Matteo Scurati**
([matteo.scurati@gmail.com](mailto:matteo.scurati@gmail.com)). For privacy
questions or to exercise your GDPR rights, write to that address.

## What is collected, and why

When you visit a page, the analytics script reports a single anonymous event
with: the URL of the page, the referring URL if any, your browser and operating
system family, your country (resolved from IP, then discarded), and a screen
size category. To deduplicate visits within a day, Umami hashes your IP, user
agent, and a salt that rotates every 24 hours, then discards the IP. The hash
cannot be reversed and resets daily.

The data is used to understand which docs are read, so they can be improved.
**Legal basis:** legitimate interest under Art. 6(1)(f) GDPR.

## How requests flow

The analytics script and the event-ingest endpoint are served from the
first-party subdomain `analytics.delegation-kit.sh`, fronted by a small
**Cloudflare Worker** (source at
[`worker/`](https://github.com/matteoscurati/delegation-kit.sh/tree/main/worker))
that forwards requests to Umami Cloud unchanged. The Worker does not log or
persist requests and does not modify the script or the events; it forwards your
IP via `X-Forwarded-For` so Umami's daily-salt hashing works, and Umami discards
the IP after hashing. Cloudflare, as infrastructure provider, processes minimal
request metadata for security and rate limiting; see
[Cloudflare's privacy policy](https://www.cloudflare.com/privacypolicy/).

## Where the data is stored, and for how long

Analytics are processed by **Umami Software, Inc.** in their **EU region**
(Frankfurt). Aggregated events are retained for up to 6 months, then deleted.
The deduplication hash is never persisted as a user identifier.

## What this site does not do

No cookies. No fingerprinting. No cross-site or cross-device tracking. No
advertising networks or third-party trackers besides Umami. No data is sold,
rented, or shared.

## Hosting

The site is served by **Cloudflare Workers (Static Assets)** on Cloudflare's
network, with EU edge POPs serving EU traffic.

## Your rights

Under GDPR you may access, rectify, erase, restrict, port, and object to the
processing of your personal data, and lodge a complaint with the
[Garante per la protezione dei dati personali](https://www.gpdp.it/). Write to
the email above. Anonymized analytics cannot be linked back to you, so erasure
of a specific past visit is technically infeasible.

## Opt out

Enable **Do Not Track** in your browser (the script honours it and sends
nothing), use a content blocker that blocks `analytics.delegation-kit.sh`, or do
not visit the site.

## Changes

If data collection changes, this page is updated and the date at the top
reflects the change.
