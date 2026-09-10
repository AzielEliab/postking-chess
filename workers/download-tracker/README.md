# postking-chess download tracker

Isolated Worker `postking-download-tracker`. Project `postking`.
KV namespace `POSTKING_DOWNLOADS` bound as `DOWNLOADS`.
Does **not** 302 to GitHub on `/download`. Serves gzip via `ASSETS.fetch`,
`Cache-Control: private, no-store`.

GET `/` increments a **page-view** counter (separate from downloads).
GET `/download` increments **downloads**.
`/v1` never increments DOWNLOADS KV.
GET `/install.sh` one-click install (does not increment; script curls `/download`).
GET `/v1/skill` returns skill markdown (`text/markdown`). Does not increment views or downloads.
`/v1/mesh/*` PROXY to aziel-runtime suite mesh (`AZIEL_RUNTIME` / `https://aziel-runtime.vibelock.workers.dev`). Default OFF. QNM-BUILD-1.0 live|locked|isolated. **QNS-CD-1.0** (photon QNS1 packet transfer) hub cite / Worker mesh cross-map only — not a Softwares-tab product. No Node Gate. No public qnsd proxy. No auto-heal. Not anonymity. Human UI Live Nodes strip polls `GET /v1/mesh`.

Verify: `curl -sS -A 'Mozilla/5.0' https://postking-download-tracker.vibelock.workers.dev/v1/mesh/status` returns MESH-OK style JSON with `enabled: false` by default and a `qns_cd` / `qns_cd_spec: "QNS-CD-1.0"` cross-map.

Host: https://postking-download-tracker.vibelock.workers.dev
