# Post-King Chess download tracker (Cloudflare Worker)

Counts GitHub-release downloads for Post-King Chess across the canonical
repository, other branches, and forks. Forks are identified by GitHub
`owner/repo`.

Homepage is an **isolated counter**: the number is on the download
button. Nobody reports a download. The click is the count.

GET `/download` **serves** the tarball via `env.ASSETS.fetch`. It does
not 302 to GitHub. Responses use `Cache-Control: private, no-store`.
Counters use `totalKey()`.

**Do not deploy wrangler from this tree.** Parent ships.

Until deploy,
`https://postking-download-tracker.vibelock.workers.dev` will not
resolve. Send people to
[GitHub Releases](https://github.com/AzielEliab/postking-chess/releases).

No secrets belong in this directory.

The goal is not to win. The goal is to remain. Forks are welcome
and always allowed.

This worker is Post-King Chess only. It is not mixed with any other
product.

Isolated counter: Worker `postking-download-tracker`, project
`postking`.

## Bindings

| Binding     | Type | Purpose |
|-------------|------|---------|
| `DOWNLOADS` | KV   | Counters keyed `project|owner|repo|branch|fork` |

KV id in `wrangler.toml`: `dbb9f4b45ea14ce1afd7880305cbac3a`.
Binding name MUST stay `DOWNLOADS`.

## Deploy (later — not from this tree)

Parent ships. Do not run `wrangler deploy` here. Do not create
`.wrangler`. Leave `public/` without the tarball until deploy; keep
`.gitkeep`.

The intended public URL is
`https://postking-download-tracker.vibelock.workers.dev`.

## Routes

| Method | Path | Behavior |
|--------|------|----------|
| GET | `/` | Isolated homepage: live count on the download button |
| GET | `/download?repo=&tag=&asset=` | Increment KV, serve the asset from `ASSETS` |
| GET | `/stats` | JSON totals plus per-repo and per-branch breakdown |
| POST | `/event` | A fork reports a download |

Query params on `/download`: `owner`, `repo` (`AzielEliab/postking-chess` is
accepted), `branch`, `fork` (`1` or `owner/repo`), `tag`, `asset`.

Tracked asset URL (after deploy):

```
https://postking-download-tracker.vibelock.workers.dev/download?repo=AzielEliab/postking-chess&tag=latest&asset=postking-chess-0.1.0.tar.gz
```

A fork reports its own download:

```bash
curl -X POST https://postking-download-tracker.vibelock.workers.dev/event \
  -H "content-type: application/json" \
  -d '{
    "owner": "YourFork",
    "repo": "postking-chess",
    "branch": "main",
    "fork": "1",
    "asset": "postking-chess-0.1.0.tar.gz"
  }'
```

`fork=1` or `fork=YourFork/postking-chess`. If `owner/repo` is not
`AzielEliab/postking-chess`, the worker records `fork=1` automatically.

## Stats

`GET /stats` returns `total`, `by_repo`, `by_branch`, `by_fork`, and a
`breakdown` array so forks can read aggregates.

## CORS

All responses include `Access-Control-Allow-Origin: *`.

`POST /v1/new` `POST /v1/move` `POST /v1/status`. Stateless. Worker AI is 1-ply.

## AI runtime (`/v1`)

CORS `*`. `GET /v1/health`, `GET /openapi.json` (OpenAPI 3.1), `GET /ai`.
Routes under `/v1` **do not** increment download KV.

Help page: `/ai`. Combined catalog: https://aziel-runtime.vibelock.workers.dev/
