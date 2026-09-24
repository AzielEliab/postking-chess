import * as engine from "./engine.js";
import { handleMeshApi, meshOpenApiPaths, meshPointer, QNS_CD_SPEC } from "./mesh.js";
import { classifyRequest, readBotManagement } from "./classify.js";
import {
  isolatedKeys,
  isReservedCounterKey,
  shapeCountBody,
  shapeHumanBotFields,
} from "./stats-shape.js";
const EXAMPLE_PAYLOAD = {
  "difficulty": "steward",
  "seed": 1
};
/**
 * Post-King Chess download tracker (Cloudflare Worker).
 *
 * GET  /download?repo=AzielEliab/postking-chess&tag=latest&asset=...
 *      increments KV, serves the tarball via env.ASSETS.fetch
 *      (does not 302 to GitHub)
 * GET  /stats   JSON totals + per-repo + per-branch breakdown
 * POST /event   forks report a download {owner,repo,branch,fork,asset}
 *
 * KV binding DOWNLOADS. Keys: project|owner|repo|branch|fork
 * CORS *. No secrets in this tree.
 * Isolated counter: Worker postking-download-tracker, project postking.
 * Standalone. Not mixed with any other product.
 * /v1, /v1/mesh/* do not increment. Suite mesh PROXY via AZIEL_RUNTIME.
 * QNS-CD-1.0 is a hub cite / Worker mesh cross-map only.
 */

const PROJECT = "postking";
const KEYS = isolatedKeys(PROJECT);

const DEFAULT_ASSET = "postking-chess-0.1.0.tar.gz";
const DEFAULT_OWNER = "AzielEliab";
const DEFAULT_REPO = "postking-chess";
const DEFAULT_BRANCH = "main";
const GITHUB_RELEASES = "https://github.com/AzielEliab/postking-chess/releases";
const GITHUB_LATEST = "https://github.com/AzielEliab/postking-chess/releases/latest";
const HOST = "https://postking-download-tracker.vibelock.workers.dev";
const SKILL = "---\nname: Post-King Chess\ndescription: Use when playing or explaining Post-King Chess (asymmetric continuity; Node not a king). Hosted AI is a 1-ply subset. Hosted /v1 via this Worker or aziel-runtime. This Worker /v1/mesh/* PROXY to aziel-runtime via AZIEL_RUNTIME. Suite mesh default OFF. QNM-BUILD-1.0 live|locked|isolated. QNS-CD-1.0 (photon QNS1) hub cite / Worker mesh cross-map only. No Node Gate. No public qnsd proxy. Author Aziel Eliab.\n---\n\n# Post-King Chess\n\nThe goal is not to win. The goal is to remain.\n\nAuthor: **Aziel Eliab**.\n\nUse when playing or explaining Post-King Chess (asymmetric continuity; Node not a king). Hosted AI is a 1-ply subset.\n\nAlways send `User-Agent: Mozilla/5.0`. Cloudflare Workers may 403 an empty agent.\n\n## Endpoints (this Worker)\n\nHost: `https://postking-download-tracker.vibelock.workers.dev`\n\n| Method | Path | What |\n|--------|------|------|\n| GET | `/v1/health` | Liveness. Does not increment downloads. |\n| GET | `/v1/skill` | This markdown. Does not increment downloads. |\n| GET | `/v1/mesh` | PROXY suite mesh status. Default OFF. QNM-BUILD-1.0 + QNS-CD-1.0 (photon QNS1). Never enables. |\n| GET | `/v1/mesh/nodes` | PROXY Live Nodes roster (5-minute presence). QNS-CD-1.0 cross-map included. |\n| POST | `/v1/mesh/{enable,disable,join,heartbeat,leave,broadcast}` | PROXY. Bearer required to enable. No Node Gate. No public qnsd proxy. |\n| POST | `/v1/new` | Start a game. Body: {difficulty, seed}. |\n| POST | `/v1/move` | Play a human UCI move. Returns AI reply. |\n| POST | `/v1/status` | Continuity status for a FEN/state. Stateless. |\n\nOpenAPI: `https://postking-download-tracker.vibelock.workers.dev/openapi.json`\n\nCatalog OpenAPI: `https://aziel-runtime.vibelock.workers.dev/openapi.json`\n\nMCP: `POST https://aziel-runtime.vibelock.workers.dev/mcp`\n\nCatalog aliases under `/p/postking/\u2026`.\n\n## How to call (Mozilla/5.0)\n\n```bash\ncurl -s -A 'Mozilla/5.0' https://postking-download-tracker.vibelock.workers.dev/v1/health\ncurl -s -A 'Mozilla/5.0' -X POST https://postking-download-tracker.vibelock.workers.dev/v1/new \\\n  -H 'content-type: application/json' \\\n  -d '{\"difficulty\":\"steward\",\"seed\":1}'\ncurl -s -A 'Mozilla/5.0' https://postking-download-tracker.vibelock.workers.dev/v1/skill\n```\n\nGrok: import the catalog OpenAPI as a custom tool. ChatGPT: GPT Actions. Venice: HTTP tools.\n\n## Local (after one-click install)\n\n```bash\ncurl -fsSL https://postking-download-tracker.vibelock.workers.dev/install.sh | bash\npostking ui\n```\n\nThen open http://127.0.0.1:8844 (this computer only).\n\n## Honest banner\n\nTHIS IS: asymmetric continuity-based chess. Human is king-bound; AI has a Node. Capture of the Node is not an ending. THIS IS NOT: standard chess, a rating engine, or a truth score. Author Aziel Eliab.\n\nDOI: https://doi.org/10.5281/zenodo.21897338  \nRecord: https://zenodo.org/records/21897338\n\nLicense: CC BY 4.0 (not Apache). Forks are welcome and always allowed.\n\n## Catalog + local UI\n\nAuthor: **Aziel Eliab**. Honest scope: Asymmetric continuity chess. The goal is not to win. The goal is to remain.\n\n- Catalog product: https://aziel-runtime.vibelock.workers.dev/p/postking/\n- Catalog OpenAPI: https://aziel-runtime.vibelock.workers.dev/openapi.json\n- Catalog MCP: `POST https://aziel-runtime.vibelock.workers.dev/mcp`\n- This Worker skill: `GET https://postking-download-tracker.vibelock.workers.dev/v1/skill`\n- This Worker OpenAPI: https://postking-download-tracker.vibelock.workers.dev/openapi.json\n- Sample payload: `GET https://postking-download-tracker.vibelock.workers.dev/v1/example`\n\nLocal UI: **Import JSON file** (`type=file`) and **Export JSON**. Then `postking doctor`.\n\nWorker homepage Live Nodes strip polls `GET /v1/mesh` (default OFF). Suite mesh `/v1/mesh/*` PROXY via `AZIEL_RUNTIME`. QNM-BUILD-1.0 live|locked|isolated. **QNS-CD-1.0** (photon QNS1 packet transfer) is a hub cite / Worker mesh cross-map only — not a Softwares-tab product. Local qnsd is https://github.com/AzielEliab/qnm-node. Runtime cites: https://github.com/AzielEliab/aziel-runtime. Pair custody: AZInterface. No Node Gate. No public qnsd proxy. No auto-heal. Not anonymity. Author Aziel Eliab.\n\nGrok: import catalog or Worker OpenAPI as a custom tool. ChatGPT: GPT Actions. Venice: HTTP tools.\n";

const GITHUB_REPO = "https://github.com/AzielEliab/postking-chess";
const INSTALL_LINE = "curl -fsSL https://postking-download-tracker.vibelock.workers.dev/install.sh | bash";
const DOI = "https://doi.org/10.5281/zenodo.21897338";
const ZENODO = "https://zenodo.org/records/21897338";


function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, HEAD, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Accept, Authorization, X-Aziel-Runtime-Token, User-Agent",
  };
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...corsHeaders() },
  });
}

function redirect(url) {
  return new Response(null, {
    status: 302,
    headers: { Location: url, ...corsHeaders() },
  });
}

function splitOwnerRepo(value, fallbackOwner, fallbackRepo) {
  if (typeof value === "string" && value.includes("/")) {
    const [o, r] = value.split("/").filter(Boolean);
    if (o && r) return { owner: o, repo: r };
  }
  return { owner: fallbackOwner, repo: fallbackRepo };
}

function parseDims(src) {
  const get = (k) => {
    if (src == null) return null;
    if (typeof src.get === "function") {
      const v = src.get(k);
      return v == null || v === "" ? null : v;
    }
    const v = src[k];
    return v == null || v === "" ? null : v;
  };

  let owner = get("owner") || DEFAULT_OWNER;
  let repo = get("repo") || DEFAULT_REPO;
  if (typeof repo === "string" && repo.includes("/")) {
    const split = splitOwnerRepo(repo, owner, DEFAULT_REPO);
    owner = split.owner;
    repo = split.repo;
  }

  const branch = get("branch") || DEFAULT_BRANCH;
  const tag = get("tag") || "latest";
  const asset = get("asset") || "";

  const forkRaw = get("fork");
  let fork = "0";
  if (forkRaw === 1 || forkRaw === true || forkRaw === "1" || forkRaw === "true") {
    fork = "1";
  } else if (typeof forkRaw === "string" && forkRaw.includes("/")) {
    const split = splitOwnerRepo(forkRaw, owner, repo);
    owner = split.owner;
    repo = split.repo;
    fork = "1";
  } else if (forkRaw != null && forkRaw !== 0 && forkRaw !== false && forkRaw !== "0" && forkRaw !== "false") {
    fork = "1";
  }

  if (`${owner}/${repo}`.toLowerCase() !== `${DEFAULT_OWNER}/${DEFAULT_REPO}`.toLowerCase()) {
    fork = "1";
  }

  return { project: PROJECT, owner, repo, branch, fork, tag, asset };
}

function kvKey(dims) {
  return `${dims.project}|${dims.owner}|${dims.repo}|${dims.branch}|${dims.fork}`;
}

function githubAssetUrl(owner, repo, tag, asset) {
  if (!asset) {
    if (owner === DEFAULT_OWNER && repo === DEFAULT_REPO) return GITHUB_RELEASES;
    return `https://github.com/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/releases`;
  }
  if (!tag || tag === "latest") {
    return `https://github.com/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/releases/latest/download/${encodeURIComponent(asset)}`;
  }
  return `https://github.com/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/releases/download/${encodeURIComponent(tag)}/${encodeURIComponent(asset)}`;
}

function totalKey() {
  return PROJECT + "|__total__";
}


async function bump(env, key) {
  const n = parseInt((await env.DOWNLOADS.get(key)) || "0", 10) + 1;
  await env.DOWNLOADS.put(key, String(n));
  return n;
}

async function incrementSplit(env, humanKey, botKey, request) {
  const cls = classifyRequest(request);
  const splitKey = cls.bucket === "human" ? humanKey : botKey;
  await bump(env, splitKey);
  return cls;
}

async function readHumanBotSplit(env, request) {
  const views = parseInt((await env.DOWNLOADS.get(KEYS.views)) || "0", 10) || 0;
  const downloadsRaw = await env.DOWNLOADS.get(KEYS.total);
  let downloads = parseInt(downloadsRaw || "0", 10);
  if (!Number.isFinite(downloads) || downloads < 0) downloads = 0;
  const viewsHuman = parseInt((await env.DOWNLOADS.get(KEYS.views_human)) || "0", 10) || 0;
  const downloadsHuman = parseInt((await env.DOWNLOADS.get(KEYS.downloads_human)) || "0", 10) || 0;
  const botManagementAvailable = readBotManagement(request).available;
  return shapeHumanBotFields({
    views,
    downloads,
    views_human: viewsHuman,
    downloads_human: downloadsHuman,
    botManagementAvailable,
  });
}

function enrichStatsWithHumanBot(stats, split) {
  return {
    ...stats,
    views_human: split.views_human,
    views_bot: split.views_bot,
    downloads_human: split.downloads_human,
    downloads_bot: split.downloads_bot,
    human: split.human,
    bot: split.bot,
    classification: split.classification,
  };
}

async function increment(env, dims, request) {
  const key = kvKey(dims);
  const n = parseInt((await env.DOWNLOADS.get(key)) || "0", 10) + 1;
  await env.DOWNLOADS.put(key, String(n));
  const tot = parseInt((await env.DOWNLOADS.get(totalKey())) || "0", 10) + 1;
  await env.DOWNLOADS.put(totalKey(), String(tot));
  if (request) await incrementSplit(env, KEYS.downloads_human, KEYS.downloads_bot, request);

  return tot;
}

async function listAllKeys(env) {
  const keys = [];
  let cursor;
  do {
    const page = await env.DOWNLOADS.list(cursor ? { cursor } : {});
    keys.push(...page.keys);
    cursor = page.list_complete ? undefined : page.cursor;
  } while (cursor);
  return keys;
}

async function collectStats(env, request) {
  const keys = await listAllKeys(env);
  let total = 0;
  const by_repo = {};
  const by_branch = {};
  const by_fork = { "0": 0, "1": 0 };
  const breakdown = [];

  for (const k of keys) {
    const name = k.name;
    if (isReservedCounterKey(name, PROJECT)) continue;
    const n = parseInt((await env.DOWNLOADS.get(name)) || "0", 10);
    if (!Number.isFinite(n) || n <= 0) continue;
    const parts = name.split("|");
    if (parts.length < 5) continue;
    const [project, owner, repo, branch, fork] = parts;
    total += n;
    const repoId = `${owner}/${repo}`;
    by_repo[repoId] = (by_repo[repoId] || 0) + n;
    by_branch[branch] = (by_branch[branch] || 0) + n;
    const forkFlag = fork === "1" ? "1" : "0";
    by_fork[forkFlag] = (by_fork[forkFlag] || 0) + n;
    breakdown.push({ project, owner, repo, branch, fork: forkFlag, count: n });
  }

  const totalDirect = parseInt((await env.DOWNLOADS.get(totalKey())) || "0", 10);
  const views = parseInt((await env.DOWNLOADS.get(viewsKey())) || "0", 10) || 0;
  const github = await githubStats(env);
  const shown = Number.isFinite(totalDirect) && totalDirect > 0 ? totalDirect : total;
  const __hbViews = parseInt((await env.DOWNLOADS.get(KEYS.views)) || "0", 10) || 0;
  const __hbViewsHuman = parseInt((await env.DOWNLOADS.get(KEYS.views_human)) || "0", 10) || 0;
  const __hbDownloadsHuman = parseInt((await env.DOWNLOADS.get(KEYS.downloads_human)) || "0", 10) || 0;
  const __hbBotMgmt = request ? readBotManagement(request).available : false;

  return {
    ...shapeHumanBotFields({
      views: (typeof views !== 'undefined' ? views : __hbViews),
      downloads: (typeof downloads !== 'undefined' ? downloads : (typeof shown !== 'undefined' ? shown : (typeof total !== 'undefined' ? total : 0))),
      views_human: __hbViewsHuman,
      downloads_human: __hbDownloadsHuman,
      botManagementAvailable: __hbBotMgmt,
    }),

    project: PROJECT,
    total: shown,
    views,
    downloads: shown,
    by_repo,
    by_branch,
    by_fork,
    breakdown,
    github: {
      stars: github.stars || 0,
      forks: github.forks || 0,
      watchers: github.watchers || 0,
      release_download_count: github.release_download_count || 0,
    },
    note: "Forks identified by GitHub owner/repo. Key layout: project|owner|repo|branch|fork. Views are separate from downloads. /v1 does not increment.",
  };
}



function viewsKey() {
  return PROJECT + "|__views__";
}

function githubCacheKey() {
  return PROJECT + "|__github__";
}

async function incrementViews(env, request) {
  const n = parseInt((await env.DOWNLOADS.get(viewsKey())) || "0", 10) + 1;
  await env.DOWNLOADS.put(viewsKey(), String(n));
  if (request) await incrementSplit(env, KEYS.views_human, KEYS.views_bot, request);

  return n;
}

async function githubStats(env) {
  const cached = await env.DOWNLOADS.get(githubCacheKey());
  if (cached) {
    try {
      const obj = JSON.parse(cached);
      if (obj && obj.fetched_at && Date.now() - obj.fetched_at < 5 * 60 * 1000) {
        return obj;
      }
    } catch {
      /* ignore */
    }
  }
  const headers = { "User-Agent": "Mozilla/5.0 Post-King Chess-download-tracker", Accept: "application/vnd.github+json" };
  let stars = 0;
  let forks = 0;
  let watchers = 0;
  let release_download_count = 0;
  try {
    const repoRes = await fetch("https://api.github.com/repos/AzielEliab/postking-chess", { headers });
    if (repoRes.ok) {
      const repo = await repoRes.json();
      stars = Number(repo.stargazers_count) || 0;
      forks = Number(repo.forks_count) || 0;
      watchers = Number(repo.subscribers_count != null ? repo.subscribers_count : repo.watchers_count) || 0;
    }
    const relRes = await fetch("https://api.github.com/repos/AzielEliab/postking-chess/releases/latest", { headers });
    if (relRes.ok) {
      const rel = await relRes.json();
      const assets = Array.isArray(rel.assets) ? rel.assets : [];
      release_download_count = assets.reduce((s, a) => s + (Number(a.download_count) || 0), 0);
    }
  } catch {
    /* public API; empty is fine */
  }
  const out = { stars, forks, watchers, release_download_count, fetched_at: Date.now() };
  try {
    await env.DOWNLOADS.put(githubCacheKey(), JSON.stringify(out));
  } catch {
    /* ignore */
  }
  return out;
}

function installScript() {
  return `#!/usr/bin/env bash
# Post-King Chess one-click install. Counted download via this Worker.
set -euo pipefail
HOST="${HOST}"
ASSET="${DEFAULT_ASSET}"
WORKDIR="\${POSTKING_HOME:-\$HOME/postking-chess}"
mkdir -p "\$WORKDIR"
cd "\$WORKDIR"
echo "Downloading counted tarball from \${HOST}/download (User-Agent Mozilla/5.0)…"
curl -fsSL -A 'Mozilla/5.0' "\${HOST}/download?asset=\${ASSET}" -o "\${ASSET}"
tar -xzf "\${ASSET}"
DIR="\$(find . -maxdepth 1 -type d -name 'postking-chess-*' -o -name 'postking_chess-*' | head -n 1)"
if [ -n "\${DIR}" ]; then
  cd "\${DIR}"
fi
python3 -m venv .venv
. .venv/bin/activate
python -m pip install -U pip
python -m pip install -e .
echo
echo "Installed Post-King Chess."
echo "Run:  postking ui"
echo "Then open http://127.0.0.1:8844  (loopback only)"
echo "Author: Aziel Eliab."
`;
}

async function serveAsset(request, env, asset, { head = false } = {}) {
  if (!env.ASSETS) {
    return json({ error: "assets binding missing" }, 500);
  }
  const assetUrl = new URL("/" + asset, request.url);
  const assetRes = await env.ASSETS.fetch(new Request(assetUrl, { method: "GET" }));
  if (!assetRes.ok) {
    return json({ error: "asset not hosted", asset, status: assetRes.status }, 404);
  }
  const headers = new Headers();
  headers.set("Content-Type", "application/gzip");
  headers.set("Content-Disposition", 'attachment; filename="' + asset.replaceAll('"', "") + '"');
  headers.set("Cache-Control", "private, no-store");
  const len = assetRes.headers.get("Content-Length");
  if (len) headers.set("Content-Length", len);
  for (const [k, v] of Object.entries(corsHeaders())) headers.set(k, v);
  if (head) {
    return new Response(null, { status: 200, headers });
  }
  return new Response(assetRes.body, { status: 200, headers });
}

async function indexHtml(env) {
  const stats = await collectStats(env);
  const views = Number(stats.views) || 0;
  const downloads = Number(stats.downloads != null ? stats.downloads : stats.total) || 0;
  const v = views.toLocaleString("en-US");
  const n = downloads.toLocaleString("en-US");
  const gh = stats.github || {};
  const breakdown = (stats.breakdown || [])
    .map(
      (b) =>
        `<li><code>${b.owner}/${b.repo}</code> branch <code>${b.branch}</code> fork=${b.fork} → ${b.count}</li>`,
    )
    .join("") || "<li>none yet</li>";
  return `<!doctype html>
<html lang="en">
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Post-King Chess — Aziel Eliab</title>
<meta name="description" content="Asymmetric continuity-based chess by Aziel Eliab: capture of the Node is not an ending.">
<meta name="author" content="Aziel Eliab">
<link rel="canonical" href="https://postking-download-tracker.vibelock.workers.dev/">
<meta property="og:title" content="Post-King Chess — Aziel Eliab">
<meta property="og:description" content="Asymmetric continuity-based chess by Aziel Eliab: capture of the Node is not an ending.">
<meta property="og:url" content="https://postking-download-tracker.vibelock.workers.dev/">
<meta property="og:type" content="website">
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  "name": "Post-King Chess",
  "author": {
    "@type": "Person",
    "name": "Aziel Eliab"
  },
  "codeRepository": "https://github.com/AzielEliab/postking-chess",
  "downloadUrl": "https://postking-download-tracker.vibelock.workers.dev/download",
  "license": "https://creativecommons.org/licenses/by/4.0/",
  "url": "https://postking-download-tracker.vibelock.workers.dev/",
  "description": "Asymmetric continuity-based chess by Aziel Eliab: capture of the Node is not an ending.",
  "identifier": "https://doi.org/10.5281/zenodo.21897338"
}
</script>
<!-- gitbaby-seo -->
<style>
  :root {
    color-scheme: dark;
    --bg: #0b0b0b; --text: #f4f1ea; --muted: #c8c2b6; --panel: #161616;
    --line: #8d8374; --gold: #e7c56a; --btn: #f4f1ea; --btn-ink: #14120c;
    --focus: #ffffff; --field: #101010; --install-ink: #14110a;
  }
  @media (prefers-color-scheme: light) {
    :root {
      color-scheme: light;
      --bg: #fbf8f2; --text: #1a1612; --muted: #4a453c; --panel: #ffffff;
      --line: #6e675c; --gold: #6a4e10; --btn: #1a1612; --btn-ink: #fbf8f2;
      --focus: #1a1612; --field: #ffffff; --install-ink: #fbf8f2;
    }
  }
  * { box-sizing: border-box; }
  html, body { margin: 0; background: var(--bg); color: var(--text); }
  body { font: 16px/1.5 system-ui, "Segoe UI", sans-serif; max-width: 58rem; margin: 0 auto; padding: 1.15rem 1rem 2.5rem; overflow-x: clip; }
  a { color: var(--text); }
  a:focus-visible, button:focus-visible, input:focus-visible { outline: 2px solid var(--focus); outline-offset: 2px; }
  .skip { position: absolute; left: -999px; top: 0; }
  .skip:focus { left: 1rem; top: 1rem; z-index: 5; background: var(--btn); color: var(--btn-ink); padding: .45rem .75rem; text-decoration: none; outline: 2px solid var(--focus); outline-offset: 2px; }
  .hero { margin: 0 0 1.15rem; }
  h1 { font-size: clamp(2rem, 8vw, 2.6rem); font-weight: 650; letter-spacing: .02em; margin: 0 0 .25rem; line-height: 1.15; }
  .motto { color: var(--gold); font-style: italic; margin: 0 0 .7rem; font-size: 1.08rem; }
  .lede { color: var(--muted); margin: 0 0 1rem; max-width: 40rem; }
  a.btn.block.primary { display: block; width: 100%; max-width: 40rem; margin: 0 0 .7rem; padding: 1.05rem 1.2rem; border: 1px solid transparent; border-radius: 9px; background: var(--btn); color: var(--btn-ink); text-align: center; text-decoration: none; font: 700 1.25rem/1.1 ui-monospace, Menlo, Consolas, monospace; letter-spacing: .03em; }
  a.btn.block.primary:hover { filter: brightness(1.08); }
  .asset-note { color: var(--muted); font-size: .95rem; margin: 0 0 .85rem; overflow-wrap: anywhere; }
  .nums { display: grid; grid-template-columns: 1fr 1fr; gap: .8rem; margin: 0 0 1rem; max-width: 40rem; }
  .count { font-size: 1.35rem; font-variant-numeric: tabular-nums; font-weight: 700; margin: 0; }
  .count span { display: block; font-size: .92rem; font-weight: 500; color: var(--muted); }
  .features { display: grid; grid-template-columns: 1fr; gap: .45rem 1.2rem; margin: 0; padding: 0; list-style: none; max-width: 46rem; }
  .features li { margin: 0; }
  .card { border: 1px solid var(--line); border-radius: 14px; padding: 1.15rem 1.2rem 1.25rem; background: var(--panel); margin: 0 0 1.1rem; }
  h2 { font-size: 1.05rem; font-weight: 650; margin: 1rem 0 .45rem; }
  button.btn.install { background: var(--gold); color: var(--install-ink); border: 0; border-radius: 9px; padding: .72rem 1rem; font: 700 .95rem/1.2 ui-monospace, Menlo, Consolas, monospace; cursor: pointer; max-width: 100%; white-space: normal; }
  button.btn.install:hover { filter: brightness(1.06); }
  button.btn.install.copied { background: #146c43; color: #f4f1ea; }
  .kid { font-size: 1rem; margin: 0 0 .85rem; }
  .meta, .iso { margin: .85rem 0 0; color: var(--muted); font-size: .92rem; }
  .meta a, footer.quiet a { color: var(--text); text-underline-offset: 2px; }
  pre { background: var(--field); color: var(--text); border: 1px solid var(--line); padding: .75rem .9rem; overflow-x: auto; max-width: 100%; border-radius: 8px; font-size: .82rem; white-space: pre-wrap; overflow-wrap: anywhere; }
  code { font-size: .92em; }
  footer.quiet { padding: .2rem 0 .4rem; color: var(--muted); font-size: .9rem; }
  footer.quiet p { margin: .35rem 0; }
  #meshStrip { border: 1px solid var(--line); border-radius: 14px; padding: .85rem 1rem; background: var(--panel); margin: 0 0 1.1rem; display: flex; flex-wrap: wrap; align-items: center; gap: .7rem 1rem; font-size: .88rem; color: var(--muted); }
  #meshStrip > * { min-width: 0; max-width: 100%; }
  #meshStrip .live { color: var(--text); }
  #meshStrip .live b { color: var(--gold); font-size: 1.35rem; margin-right: .35rem; }
  #meshStrip .rollup b { color: var(--gold); }
  #meshStrip .mesh-actions { display: flex; flex-wrap: wrap; gap: .45rem; width: 100%; }
  #meshStrip button { font: 700 .78rem/1 ui-monospace, Menlo, Consolas, monospace; height: 2rem; padding: 0 .75rem; border-radius: 8px; background: transparent; color: var(--text); border: 1px solid var(--line); cursor: pointer; }
  #meshStrip button:hover { border-color: var(--gold); color: var(--gold); }
  #meshStrip input { width: min(16rem, 100%); max-width: 100%; min-width: 0; flex: 1 1 12rem; padding: .4rem .55rem; border: 1px solid var(--line); border-radius: 8px; background: var(--field); color: var(--text); font: inherit; }
  #meshProducts { flex-basis: 100%; margin: 0; overflow-wrap: anywhere; }
  .brandrow{display:flex;flex-wrap:wrap;align-items:center;gap:12px;margin:0 0 10px}
  .brandmark{width:40px;height:40px;border-radius:10px;object-fit:cover;flex:0 0 auto;box-shadow:0 0 0 1px #d4af3733}
  @media (min-width: 720px) {
    .features { grid-template-columns: repeat(3, minmax(0, 1fr)); }
    body { padding: 1.4rem 1.2rem 2.8rem; }
  }
</style>
<body>
  <a class="skip" href="#downloadBtn">Skip to download</a>
  <header class="hero">
  <div class="brandrow"><img class="brandmark" src="/sigil.png" width="40" height="40" alt="" decoding="async"></div>
  <h1>Post-King Chess</h1>
  <p class="motto">The goal is not to win. The goal is to remain.</p>
  <p class="lede">Asymmetric continuity chess by Aziel Eliab. You keep a king. The other side has a Node. Capture of the Node is not an ending.</p>
  <a class="btn block primary" id="downloadBtn" href="/download?asset=${DEFAULT_ASSET}" aria-describedby="downloadNote">Download</a>
  <p class="asset-note" id="downloadNote">${n} downloads · ${DEFAULT_ASSET} · counted on this Worker for every branch and fork</p>
  <div class="nums">
    <p class="count">${v}<span>Views</span></p>
    <p class="count">${n}<span>Downloads</span></p>
  </div>
  <ul class="features">
    <li>Witness, Steward, and Remain</li>
    <li>Deterministic by seed. Offline.</li>
    <li>Local board at 127.0.0.1:8844 after install</li>
  </ul>
  </header>
  <div id="meshStrip" aria-label="Suite Live Nodes">
    <div class="live"><b id="meshLiveCount">0</b> Live Nodes</div>
    <div id="meshLine">Suite mesh: off (default). QNM-BUILD-1.0 · QNS-CD-1.0. Not an anonymity network.</div>
    <div class="rollup">live <b id="qnmLive">0</b> · locked <b id="qnmLocked">0</b> · isolated <b id="qnmIsolated">0</b></div>
    <div>No Node Gate · No public qnsd proxy · No auto-heal · Aziel Eliab only</div>
    <div class="mesh-actions">
      <input id="meshBearer" type="text" maxlength="80" placeholder="bearer (required to enable)" aria-label="mesh bearer">
      <button id="meshEnable" type="button" title="Enable suite mesh. Declared bearer required. Default off.">Enable</button>
      <button id="meshDisable" type="button" title="Disable suite mesh (always allowed)">Disable</button>
      <button id="meshJoin" type="button" title="Join as postking. Refused while mesh is OFF. No auto-join.">Join</button>
      <button id="meshLeave" type="button" title="Leave this node. No auto-heal.">Leave</button>
    </div>
    <p id="meshProducts">Catalog MCP mesh_* · FragGate slug=mesh · /v1/mesh/* PROXY · QNS-CD-1.0 cross-map · not a Softwares-tab product · not AnonBroadcast · not AZMail ring · not a Node Gate · no public qnsd proxy</p>
  </div>
  <div class="card">
    <p class="kid">One-click install copies a Terminal command. After it finishes, type <code>postking ui</code>.</p>
    <button type="button" class="btn install" id="install-btn">One-click install</button>
    <pre id="install-cmd">${INSTALL_LINE}</pre>
    <p class="kid">Then run: <code>postking ui</code> and open http://127.0.0.1:8844 (this computer only).</p>
    <p class="meta">The download count ticks when Download is clicked. The Worker serves the gzip (HTTP 200). Forks and other branches that use this link are counted on their own keys, and the total includes them. ${DEFAULT_ASSET} — ${n} counted.</p>
    <p class="iso">Isolated counter: Worker <code>postking-download-tracker</code>, project <code>${PROJECT}</code>, KV <code>POSTKING_DOWNLOADS</code>. Not mixed with any other product. /v1 does not increment downloads.</p>
    <p class="meta">GitHub: stars ${gh.stars || 0} · forks ${gh.forks || 0} · watchers ${gh.watchers || 0} · release assets ${gh.release_download_count || 0}</p>
    <script>
      (function () {
        var cmd = "curl -fsSL https://postking-download-tracker.vibelock.workers.dev/install.sh | bash";
        var btn = document.getElementById("install-btn");
        var pre = document.getElementById("install-cmd");
        if (!btn) return;
        btn.addEventListener("click", function () {
          function done(ok) {
            btn.textContent = ok ? "Copied! Paste in Terminal, then run postking ui" : "Select the command, copy it, then run postking ui";
            btn.classList.add("copied");
          }
          if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(cmd).then(function () { done(true); }).catch(function () { done(false); });
          } else {
            done(false);
            if (pre && window.getSelection) {
              var r = document.createRange();
              r.selectNodeContents(pre);
              var sel = window.getSelection();
              sel.removeAllRanges();
              sel.addRange(r);
            }
          }
        });
      })();
      (function () {
      function $(id) { return document.getElementById(id); }
      function meshNum() {
        for (var i = 0; i < arguments.length; i++) {
          var raw = arguments[i];
          if (raw == null || raw === "") continue;
          var n = typeof raw === "number" ? raw : Number(String(raw).replace(/,/g, ""));
          if (Number.isFinite(n) && n >= 0) return Math.floor(n);
        }
        return 0;
      }
      function unwrapMesh(j) {
        if (!j || typeof j !== "object") return {};
        if (j.result && typeof j.result === "object") return Object.assign({}, j, j.result);
        if (j.mesh && typeof j.mesh === "object") return Object.assign({}, j, j.mesh);
        return j;
      }
      function paintMesh(raw) {
        var j = unwrapMesh(raw);
        var on = j.enabled === true || j.enabled === 1 || String(j.status || "").toLowerCase() === "on";
        var r = (j.rollup && typeof j.rollup === "object") ? j.rollup : {};
        var live = on ? meshNum(r.live, j.live_nodes, j.live) : 0;
        var locked = on ? meshNum(r.locked, j.locked_nodes, j.locked) : 0;
        var isolated = on ? meshNum(r.isolated, j.isolated_nodes, j.isolated) : 0;
        $("meshLiveCount").textContent = String(live);
        $("qnmLive").textContent = String(live);
        $("qnmLocked").textContent = String(locked);
        $("qnmIsolated").textContent = String(isolated);
        var line = $("meshLine");
        if (on) line.textContent = "Suite mesh: on · live " + live + " · locked " + locked + " · isolated " + isolated + ". QNS-CD-1.0. Not an anonymity network.";
        else if (j.status === "unavailable" || (j.ok === false && j.error)) line.textContent = "Suite mesh: off (unavailable). QNM-BUILD-1.0 · QNS-CD-1.0. Not an anonymity network.";
        else line.textContent = "Suite mesh: off (default). QNM-BUILD-1.0 · QNS-CD-1.0. Not an anonymity network.";
        var products = j.products_present || j.products || [];
        var names = Array.isArray(products) ? products.map(function (p) { return typeof p === "string" ? p : (p && (p.product || p.slug)) || ""; }).filter(Boolean) : [];
        var nodes = Array.isArray(j.nodes) ? j.nodes : [];
        var extra = names.length ? " · products " + names.join(", ") : (nodes.length ? " · " + nodes.length + " node labels" : "");
        var qns = (j.qns_cd && j.qns_cd.spec) || j.qns_cd_spec || "QNS-CD-1.0";
        $("meshProducts").textContent = "Catalog MCP mesh_* · FragGate slug=mesh · /v1/mesh/* PROXY · " + qns + " cross-map · not a Softwares-tab product · not AnonBroadcast · not AZMail ring · not a Node Gate · no public qnsd proxy" + extra;
      }
      async function meshGet(path) {
        var r = await fetch(path, { headers: { "user-agent": "Mozilla/5.0", accept: "application/json" } });
        return r.json();
      }
      async function meshPost(path, payload) {
        var r = await fetch(path, { method: "POST", headers: { "content-type": "application/json", "user-agent": "Mozilla/5.0" }, body: JSON.stringify(payload || {}) });
        return r.json();
      }
      async function refreshMesh() {
        try {
          var status = await meshGet("/v1/mesh");
          var merged = status;
          var inner = unwrapMesh(status);
          var on = inner.enabled === true;
          if (on) {
            try {
              var nodes = await meshGet("/v1/mesh/nodes");
              merged = Object.assign({}, inner, unwrapMesh(nodes));
            } catch (e) { /* status is enough */ }
          }
          paintMesh(merged);
          var nodeId = sessionStorage.getItem("postking_mesh_node");
          if (on && nodeId) {
            try { await meshPost("/v1/mesh/heartbeat", { node_id: nodeId }); } catch (e) { /* no auto-heal */ }
          }
        } catch (e) {
          paintMesh({ ok: false, enabled: false, status: "unavailable", error: "mesh_unavailable" });
        }
      }
      $("meshEnable").onclick = async function () {
        var bearer = ($("meshBearer").value || "").trim();
        paintMesh(await meshPost("/v1/mesh/enable", bearer ? { bearer: bearer } : {}));
        refreshMesh();
      };
      $("meshDisable").onclick = async function () {
        sessionStorage.removeItem("postking_mesh_node");
        paintMesh(await meshPost("/v1/mesh/disable", {}));
        refreshMesh();
      };
      $("meshJoin").onclick = async function () {
        var j = await meshPost("/v1/mesh/join", { product: "postking", label: "Post-King Chess Worker" });
        var inner = unwrapMesh(j);
        var id = inner.node_id || inner.id || (inner.session && inner.session.node_id);
        if (id) sessionStorage.setItem("postking_mesh_node", String(id));
        paintMesh(j);
        refreshMesh();
      };
      $("meshLeave").onclick = async function () {
        var id = sessionStorage.getItem("postking_mesh_node");
        if (id) await meshPost("/v1/mesh/leave", { node_id: id });
        sessionStorage.removeItem("postking_mesh_node");
        refreshMesh();
      };
      window.addEventListener("pagehide", function () {
        var id = sessionStorage.getItem("postking_mesh_node");
        if (!id || typeof navigator.sendBeacon !== "function") return;
        try { navigator.sendBeacon("/v1/mesh/leave", new Blob([JSON.stringify({ node_id: id })], { type: "application/json" })); } catch (e) { /* leave expires in 5 minutes */ }
      });
      refreshMesh();
      setInterval(refreshMesh, 30000);
      document.addEventListener("visibilitychange", function () { if (!document.hidden) refreshMesh(); });
    })();
    </script>
    <h2>Per repo / branch / fork</h2>
    <ul>${breakdown}</ul>
  </div>

<footer class="quiet">
  <p>CC BY 4.0 · Aziel Eliab · Post-King Chess 0.1.0</p>
  <p>Aziel Eliab. Post-King Chess. <a href="${DOI}">doi:10.5281/zenodo.21897338</a> · <a href="${ZENODO}">Zenodo</a></p>
  <p><a href="${GITHUB_REPO}">GitHub</a> · <a href="/openapi.json">OpenAPI</a> · <a href="/v1/skill">Skill</a> · <a href="/ai">AI runtime</a> · <a href="/stats">Stats</a> · <a href="/cite.json">Cite</a> · <a href="https://aziel-runtime.vibelock.workers.dev/">Catalog</a> · <a href="${GITHUB_LATEST}">Releases</a></p>
</footer>
<!-- /gitbaby-seo -->
</body>
</html>`;
}

function html(body) {
  return new Response(body, {
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "private, no-store", ...corsHeaders() },
  });
}

function originOf(request) {
  try {
    return new URL(request.url).origin;
  } catch {
    return "https://postking-download-tracker.vibelock.workers.dev";
  }
}

function openapiSpec(request) {
  const origin = originOf(request);
  return {
    openapi: "3.1.0",
    info: {
      title: "Post-King Chess runtime",
      version: "0.1.0",
      summary: "Stateless Post-King Chess. Human king-bound; AI has a Node.",
      description: engine.MOTTO + " Worker subset: legal moves + 1-ply continuity AI.",
    },
    servers: [{ url: origin }],
    paths: {
      ...meshOpenApiPaths(),
            "/v1/example": { get: { operationId: "postkingExample", summary: "Sample JSON payload. Does not increment downloads.", responses: { "200": { description: "OK" } } } },
      "/v1/skill": {
        get: {
          operationId: "postking_skill",
          summary: "Return skill markdown. Does not increment download KV.",
          responses: { "200": { description: "markdown" } },
        },
      },
"/v1/health": { get: { operationId: "postking_health", summary: "Liveness. Does not increment download KV.", responses: { "200": { description: "ok" } } } },
      "/v1/new": {
        post: {
          operationId: "postking_new",
          summary: "Start a game. Body: {difficulty, seed}. Difficulties: witness|steward|remain.",
          requestBody: { content: { "application/json": { schema: { type: "object", properties: { difficulty: { type: "string" }, seed: { type: "integer" } } } } } },
          responses: { "200": { description: "state" } },
        },
      },
      "/v1/move": {
        post: {
          operationId: "postking_move",
          summary: "Play a human UCI move against the current FEN/state. Returns AI reply.",
          requestBody: { required: true, content: { "application/json": { schema: { type: "object", properties: { fen_or_state: {}, uci: { type: "string" } } } } } },
          responses: { "200": { description: "state" } },
        },
      },
      "/v1/status": {
        post: {
          operationId: "postking_status",
          summary: "Continuity status for a FEN/state. Stateless.",
          requestBody: { required: true, content: { "application/json": { schema: { type: "object" } } } },
          responses: { "200": { description: "state" } },
        },
      },
    },
  };
}

function aiHelpPage(request) {
  const origin = originOf(request);
  return `<!doctype html>
<html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Post-King Chess — AI runtime</title>
<style>
  :root { color-scheme: dark; }
  body { font: 16px/1.45 system-ui, sans-serif; max-width: 44rem; margin: 3rem auto; padding: 0 1.25rem; background: #0e1014; color: #e8eaef; }
  a { color: #c9d4ff; }
  code, pre { background: #151922; padding: .15rem .35rem; border-radius: 4px; }
  pre { padding: .85rem 1rem; overflow: auto; }
  .banner { border: 1px solid #5c4a1a; background: #241c0d; color: #f0d78c; padding: .85rem 1rem; border-radius: 8px; }
  .brandrow{display:flex;flex-wrap:wrap;align-items:center;gap:12px;margin:0 0 10px}
  .brandmark{width:40px;height:40px;border-radius:10px;object-fit:cover;flex:0 0 auto;box-shadow:0 0 0 1px #d4af3733}
</style>
<body>
<div class="brandrow"><img class="brandmark" src="/sigil.png" width="40" height="40" alt="" decoding="async"></div>
<h1>Post-King Chess runtime</h1>
<p class="banner">${engine.MOTTO} Human is king-bound. AI has a Node, not a king. Capture of the Node is not an ending.</p>
<p>Stateless: send board state on every call. Worker AI is a <strong>1-ply subset</strong> (legal moves + continuity ranking). Full Python search lives in the package.</p>
<p>OpenAPI: <a href="${origin}/openapi.json">${origin}/openapi.json</a></p>
<p>Catalog: <a href="https://aziel-runtime.vibelock.workers.dev/">aziel-runtime.vibelock.workers.dev</a></p>
<pre>curl -X POST ${origin}/v1/new -H 'content-type: application/json' -d '{"difficulty":"steward","seed":1}'
curl -X POST ${origin}/v1/move -H 'content-type: application/json' \\
  -d '{"fen_or_state":"${engine.START_FEN}","uci":"e2e4","difficulty":"steward","seed":1}'
</pre>
<p>GET/POST under <code>/v1</code> never increment the download counter.</p>
<p><a href="/">Downloads</a></p>
</body></html>`;
}

async function handleRuntime(request, url) {
  const path = url.pathname.replace(/\/+$/, "") || "/";
  if (path === "/v1/health" && request.method === "GET") {
    return json({
      ok: true, author: "Aziel Eliab",
      product: "postking",
      runtime: true,
      kv_increment: false,
      motto: engine.MOTTO,
      subset: "1-ply continuity AI; full legal-move kernel",
      mesh: meshPointer(),
      qns_cd_spec: QNS_CD_SPEC,
    });
  }
  if ((path === "/v1/example" || path === "/v1/example/") && (request.method === "GET" || request.method === "HEAD")) {
    return json({
      ok: true,
      product: "postking",
      author: "Aziel Eliab",
      example: EXAMPLE_PAYLOAD,
      note: "Sample payload only. Does not increment downloads.",
    });
  }

  if (path === "/v1/skill" && request.method === "GET") {
    return new Response(SKILL, {
      status: 200,
      headers: { "Content-Type": "text/markdown; charset=utf-8", "Cache-Control": "private, no-store", ...corsHeaders() },
    });
  }
  if (path === "/openapi.json" && request.method === "GET") {
    return json(openapiSpec(request));
  }
  if ((path === "/ai" || url.pathname === "/ai/") && request.method === "GET") {
    return html(aiHelpPage(request));
  }
  if (path === "/v1/new" && request.method === "POST") {
    let body = {};
    try { body = await request.json(); } catch { body = {}; }
    try {
      return json(engine.newGame(body || {}));
    } catch (err) {
      return json({ error: String(err.message || err), motto: engine.MOTTO }, 400);
    }
  }
  if (path === "/v1/move" && request.method === "POST") {
    let body;
    try { body = await request.json(); } catch {
      return json({ error: "JSON body required", motto: engine.MOTTO }, 400);
    }
    try {
      return json(await engine.playMove(body || {}));
    } catch (err) {
      return json({ error: String(err.message || err), motto: engine.MOTTO }, 400);
    }
  }
  if (path === "/v1/status" && request.method === "POST") {
    let body;
    try { body = await request.json(); } catch {
      return json({ error: "JSON body required", motto: engine.MOTTO }, 400);
    }
    try {
      return json(engine.statusOf(body || {}));
    } catch (err) {
      return json({ error: String(err.message || err), motto: engine.MOTTO }, 400);
    }
  }
  if (path.startsWith("/v1/") || path === "/v1") {
    return json({ error: "not found", hint: "GET /v1/health GET /v1/skill GET /v1/mesh POST /v1/new /v1/move /v1/status", motto: engine.MOTTO }, 404);
  }
  return null;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders() });
    }

    const mesh = await handleMeshApi(request, url, env);
    if (mesh) return mesh;

    if ((url.pathname === "/install.sh" || url.pathname === "/install.sh/") && request.method === "GET") {
      return new Response(installScript(), {
        status: 200,
        headers: {
          "Content-Type": "text/x-shellscript; charset=utf-8",
          "Cache-Control": "private, no-store",
          ...corsHeaders(),
        },
      });
    }


    const runtime = await handleRuntime(request, url);
    if (runtime) return runtime;


    if (url.pathname === "/" && request.method === "GET") {
      await incrementViews(env, request);
      return new Response(await indexHtml(env), {
        headers: { "Content-Type": "text/html; charset=utf-8", ...corsHeaders() },
      });
    }

    if (url.pathname === "/count" && request.method === "GET") {
      const stats = await collectStats(env, request);
      return json(shapeCountBody({
        project: PROJECT,
        views: stats.views || 0,
        downloads: stats.downloads || 0,
        total: stats.total || 0,
        views_human: stats.views_human,
        downloads_human: stats.downloads_human,
        botManagementAvailable: readBotManagement(request).available,
      }));
    }

    if (url.pathname === "/stats" && request.method === "GET") {
      return json(await collectStats(env, request));
    }

    if (url.pathname === "/event" && request.method === "POST") {
      let body;
      try {
        body = await request.json();
      } catch {
        return json({ error: "JSON body required" }, 400);
      }
      const dims = parseDims(body || {});
      const count = await increment(env, dims, request);
      return json({
        ok: true,
        key: kvKey(dims),
        count,
        owner: dims.owner,
        repo: dims.repo,
        branch: dims.branch,
        fork: dims.fork,
        asset: dims.asset || null,
      });
    }

    if (url.pathname === "/go" && (request.method === "GET" || request.method === "HEAD")) {
      const dims = parseDims(url.searchParams);
      const asset = dims.asset || DEFAULT_ASSET;
      dims.asset = asset;
      if (request.method === "GET") await increment(env, dims, request);
      return serveAsset(request, env, asset, { head: request.method === "HEAD" });
    }

    if ((url.pathname === "/download" || url.pathname.startsWith("/download/")) && (request.method === "GET" || request.method === "HEAD")) {
      const dims = parseDims(url.searchParams);
      if (!dims.asset && url.pathname.startsWith("/download/")) {
        dims.asset = decodeURIComponent(url.pathname.slice("/download/".length));
      }
      const asset = dims.asset || DEFAULT_ASSET;
      dims.asset = asset;
      if (request.method === "GET") await increment(env, dims, request);
      return serveAsset(request, env, asset, { head: request.method === "HEAD" });
    }


    // gitbaby-seo-routes
    if ((url.pathname === "/robots.txt" || url.pathname === "/robots.txt/") && request.method === "GET") {
      const body = "User-agent: *\nAllow: /\nSitemap: " + HOST + "/sitemap.xml\n";
      return new Response(body, {
        status: 200,
        headers: { "Content-Type": "text/plain; charset=utf-8", ...corsHeaders() },
      });
    }
    if ((url.pathname === "/sitemap.xml" || url.pathname === "/sitemap.xml/") && request.method === "GET") {
      const locs = [HOST + "/", HOST + "/download", HOST + "/install.sh", HOST + "/v1/skill", HOST + "/v1/mesh", HOST + "/openapi.json", GITHUB_REPO];
      const xml = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
        + locs.map((u) => "  <url><loc>" + u + "</loc></url>").join("\n")
        + "\n</urlset>\n";
      return new Response(xml, {
        status: 200,
        headers: { "Content-Type": "application/xml; charset=utf-8", ...corsHeaders() },
      });
    }
    if ((url.pathname === "/cite.json" || url.pathname === "/cite.json/") && request.method === "GET") {
      return json({"author": "Aziel Eliab", "title": "Post-King Chess", "github": "https://github.com/AzielEliab/postking-chess", "download": "https://postking-download-tracker.vibelock.workers.dev/download", "doi": "10.5281/zenodo.21897338", "license": "CC BY 4.0", "catalog": "https://aziel-runtime.vibelock.workers.dev/"});
    }
    // /gitbaby-seo-routes
    return json({ error: "not found" }, 404);
  },
};
