---
name: Post-King Chess
description: Use when calling Post-King Chess hosted /v1 or installing the local package. Author Aziel Eliab.
---

# Post-King Chess

The goal is not to win. The goal is to continue. Author: **Aziel Eliab**.

**THIS IS:** an asymmetric continuity-based game.

**THIS IS NOT:** orthodox chess, a rating engine, or a wager. Hosted `/v1` does not increment downloads or views.

Always send `User-Agent: Mozilla/5.0`. Cloudflare Workers may 403 an empty agent.

## Call these URLs

- Worker OpenAPI: https://postking-download-tracker.vibelock.workers.dev/openapi.json
- Catalog OpenAPI: https://aziel-runtime.vibelock.workers.dev/openapi.json
- MCP: `POST https://aziel-runtime.vibelock.workers.dev/mcp`
- Live skill (this markdown): `GET https://postking-download-tracker.vibelock.workers.dev/v1/skill`

Ops (do **not** increment downloads or views):

- `GET /v1/health` — liveness
- `GET /v1/skill` — this file
- Product POSTs listed in OpenAPI

Grok: import OpenAPI as a custom tool. ChatGPT: GPT Actions. Venice: HTTP tools.

## Example

```bash
curl -s -A 'Mozilla/5.0' https://postking-download-tracker.vibelock.workers.dev/v1/health
curl -s -A 'Mozilla/5.0' https://postking-download-tracker.vibelock.workers.dev/v1/skill
```

## Local (after one-click install)

```bash
curl -fsSL https://postking-download-tracker.vibelock.workers.dev/install.sh | bash
postking ui
postking doctor
```

Then open http://127.0.0.1:8844 (loopback only).

Counted download (gzip HTTP 200, no 302): https://postking-download-tracker.vibelock.workers.dev/download?asset=postking-chess-0.1.0.tar.gz
GitHub: https://github.com/AzielEliab/postking-chess

Paper: DOI https://doi.org/10.5281/zenodo.21897338 · https://zenodo.org/records/21897338 · License: CC BY 4.0 (not Apache). Forks welcome.
