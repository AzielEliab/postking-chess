import * as engine from "./engine.js";
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
 */

const PROJECT = "postking";
const DEFAULT_ASSET = "postking-chess-0.1.0.tar.gz";
const DEFAULT_OWNER = "AzielEliab";
const DEFAULT_REPO = "postking-chess";
const DEFAULT_BRANCH = "main";
const GITHUB_RELEASES = "https://github.com/AzielEliab/postking-chess/releases";
const GITHUB_LATEST = "https://github.com/AzielEliab/postking-chess/releases/latest";
const HOST = "https://postking-download-tracker.vibelock.workers.dev";
const SKILL = "---\nname: Post-King Chess\ndescription: Use when playing or explaining Post-King Chess (asymmetric continuity; Node not a king). Hosted AI is a 1-ply subset. Hosted /v1 via this Worker or aziel-runtime. Author Aziel Eliab.\n---\n\n# Post-King Chess\n\nThe goal is not to win. The goal is to remain.\n\nAuthor: **Aziel Eliab**.\n\nUse when playing or explaining Post-King Chess (asymmetric continuity; Node not a king). Hosted AI is a 1-ply subset.\n\nAlways send `User-Agent: Mozilla/5.0`. Cloudflare Workers may 403 an empty agent.\n\n## Endpoints (this Worker)\n\nHost: `https://postking-download-tracker.vibelock.workers.dev`\n\n| Method | Path | What |\n|--------|------|------|\n| GET | `/v1/health` | Liveness. Does not increment downloads. |\n| GET | `/v1/skill` | This markdown. Does not increment downloads. |\n| POST | `/v1/new` | Start a game. Body: {difficulty, seed}. |\n| POST | `/v1/move` | Play a human UCI move. Returns AI reply. |\n| POST | `/v1/status` | Continuity status for a FEN/state. Stateless. |\n\nOpenAPI: `https://postking-download-tracker.vibelock.workers.dev/openapi.json`\n\nCatalog OpenAPI: `https://aziel-runtime.vibelock.workers.dev/openapi.json`\n\nMCP: `POST https://aziel-runtime.vibelock.workers.dev/mcp`\n\nCatalog aliases under `/p/postking/\u2026`.\n\n## How to call (Mozilla/5.0)\n\n```bash\ncurl -s -A 'Mozilla/5.0' https://postking-download-tracker.vibelock.workers.dev/v1/health\ncurl -s -A 'Mozilla/5.0' -X POST https://postking-download-tracker.vibelock.workers.dev/v1/new \\\n  -H 'content-type: application/json' \\\n  -d '{\"difficulty\":\"steward\",\"seed\":1}'\ncurl -s -A 'Mozilla/5.0' https://postking-download-tracker.vibelock.workers.dev/v1/skill\n```\n\nGrok: import the catalog OpenAPI as a custom tool. ChatGPT: GPT Actions. Venice: HTTP tools.\n\n## Local (after one-click install)\n\n```bash\ncurl -fsSL https://postking-download-tracker.vibelock.workers.dev/install.sh | bash\npostking ui\n```\n\nThen open http://127.0.0.1:8844 (this computer only).\n\n## Honest banner\n\nTHIS IS: asymmetric continuity-based chess. Human is king-bound; AI has a Node. Capture of the Node is not an ending. THIS IS NOT: standard chess, a rating engine, or a truth score. Author Aziel Eliab.\n\nDOI: https://doi.org/10.5281/zenodo.21897338  \nRecord: https://zenodo.org/records/21897338\n\nLicense: CC BY 4.0 (not Apache). Forks are welcome and always allowed.\n";

const GITHUB_REPO = "https://github.com/AzielEliab/postking-chess";
const INSTALL_LINE = "curl -fsSL https://postking-download-tracker.vibelock.workers.dev/install.sh | bash";
const DOI = "https://doi.org/10.5281/zenodo.21897338";
const ZENODO = "https://zenodo.org/records/21897338";


function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
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

async function increment(env, dims) {
  const key = kvKey(dims);
  const n = parseInt((await env.DOWNLOADS.get(key)) || "0", 10) + 1;
  await env.DOWNLOADS.put(key, String(n));
  const tot = parseInt((await env.DOWNLOADS.get(totalKey())) || "0", 10) + 1;
  await env.DOWNLOADS.put(totalKey(), String(tot));
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

async function collectStats(env) {
  const keys = await listAllKeys(env);
  let total = 0;
  const by_repo = {};
  const by_branch = {};
  const by_fork = { "0": 0, "1": 0 };
  const breakdown = [];

  for (const k of keys) {
    const name = k.name;
    if (name === viewsKey() || name === totalKey() || name === githubCacheKey()) continue;
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
  return {
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

async function incrementViews(env) {
  const n = parseInt((await env.DOWNLOADS.get(viewsKey())) || "0", 10) + 1;
  await env.DOWNLOADS.put(viewsKey(), String(n));
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
<title>Post-King Chess downloads</title>
<style>
  :root { color-scheme: dark; }
  body { font: 16px/1.45 system-ui, sans-serif; max-width: 42rem; margin: 3rem auto; padding: 0 1.25rem 4rem; background: #0e1014; color: #e8eaef; }
  h1 { font-size: 1.75rem; margin: 0 0 .35rem; }
  .motto { color: #9aa3b2; margin: 0 0 1.5rem; }
  .card { border: 1px solid #2a3140; border-radius: 12px; padding: 1.25rem 1.35rem; background: #151922; }
  .nums { display: grid; grid-template-columns: 1fr 1fr; gap: .8rem; margin: 0 0 1rem; }
  .count { font-size: 2.2rem; font-variant-numeric: tabular-nums; font-weight: 700; margin: 0; }
  .count span { display: block; font-size: .95rem; font-weight: 500; color: #9aa3b2; }
  .btns { display: grid; grid-template-columns: 1fr 1fr; gap: .75rem; margin: 0 0 .85rem; }
  @media (max-width: 520px) { .btns { grid-template-columns: 1fr; } }
  a.btn, button.btn { display: block; width: 100%; box-sizing: border-box; text-align: center; font: inherit; font-size: 1.2rem; font-weight: 750; padding: 1rem 1.1rem; border-radius: 10px; border: 0; cursor: pointer; text-decoration: none; }
  a.btn.primary { background: #e8eaef; color: #0e1014; }
  button.btn.install { background: #c9a227; color: #14110a; }
  button.btn.install.copied { background: #7dcf9a; color: #0e1014; }
  .kid { font-size: 1.05rem; margin: 0 0 1rem; }
  .meta { margin-top: 1.1rem; color: #9aa3b2; font-size: .92rem; }
  .meta a { color: #c9d4ff; }
  .iso { margin-top: .85rem; font-size: .85rem; color: #7d8696; }
  .banner { border: 1px solid #5c4a1a; background: #241c0d; color: #f0d78c; padding: .85rem 1rem; border-radius: 8px; margin: 0 0 1.2rem; font-size: .92rem; }
  pre { background: #0e1014; padding: .75rem .9rem; overflow: auto; border-radius: 8px; font-size: .82rem; }
  code { font-size: .88rem; }
</style>
<body>
  <h1>Post-King Chess</h1>
  <p class="motto">The goal is not to win. The goal is to remain. Author Aziel Eliab.</p>
  <p class="banner">THIS IS: asymmetric continuity-based chess. Human is king-bound; AI has a Node. Capture of the Node is not an ending. THIS IS NOT: standard chess, a rating engine, or a truth score. Author Aziel Eliab.</p>
  <div class="card">
    <div class="nums">
      <p class="count">${v}<span>Views</span></p>
      <p class="count">${n}<span>Downloads</span></p>
    </div>
    <p class="kid"><strong>Two big buttons.</strong> Download saves the gzip (the Downloads number goes up). One-click install copies a Terminal command. After it finishes, type <code>postking ui</code>.</p>
    <div class="btns">
      <a class="btn primary dl" href="/download?asset=${DEFAULT_ASSET}">Download</a>
      <button type="button" class="btn install" id="install-btn">One-click install</button>
    </div>
    <pre id="install-cmd">${INSTALL_LINE}</pre>
    <p class="kid">Then run: <code>postking ui</code> and open http://127.0.0.1:8844 (this computer only).</p>
    <p class="meta">The download count ticks on the Download click. The Worker serves the gzip (HTTP 200). No 302 to GitHub. Forks using this same link are counted automatically. ${DEFAULT_ASSET} — ${n} counted.</p>
    <p class="iso">Isolated counter: Worker <code>postking-download-tracker</code>, project <code>${PROJECT}</code>, KV <code>POSTKING_DOWNLOADS</code>. Not mixed with any other product. /v1 does not increment downloads.</p>
    <p class="meta">GitHub: stars ${gh.stars || 0} · forks ${gh.forks || 0} · watchers ${gh.watchers || 0} · release assets ${gh.release_download_count || 0}</p>
    <p class="meta">Paper: <a href="${DOI}">doi:10.5281/zenodo.21897338</a> · <a href="${ZENODO}">Zenodo</a> · CC BY 4.0 · Eliab, Aziel</p>
    <p class="meta"><a href="/stats">JSON stats</a> · <a href="/openapi.json">OpenAPI</a> · <a href="/v1/skill">Skill</a> · <a href="/ai">AI runtime</a> · <a href="${GITHUB_REPO}">GitHub</a> · <a href="${GITHUB_LATEST}">releases</a></p>
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
    </script>
    <h2>Per repo / branch / fork</h2>
    <ul>${breakdown}</ul>
  </div>
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
</style>
<body>
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
      ok: true,
      product: "postking",
      runtime: true,
      kv_increment: false,
      motto: engine.MOTTO,
      subset: "1-ply continuity AI; full legal-move kernel",
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
    return json({ error: "not found", hint: "GET /v1/health GET /v1/skill POST /v1/new /v1/move /v1/status", motto: engine.MOTTO }, 404);
  }
  return null;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders() });
    }

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
      await incrementViews(env);
      return new Response(await indexHtml(env), {
        headers: { "Content-Type": "text/html; charset=utf-8", ...corsHeaders() },
      });
    }

    if (url.pathname === "/count" && request.method === "GET") {
      const stats = await collectStats(env);
      return json({ project: PROJECT, views: stats.views || 0, downloads: stats.downloads || stats.total || 0, total: stats.total || 0 });
    }

    if (url.pathname === "/stats" && request.method === "GET") {
      return json(await collectStats(env));
    }

    if (url.pathname === "/event" && request.method === "POST") {
      let body;
      try {
        body = await request.json();
      } catch {
        return json({ error: "JSON body required" }, 400);
      }
      const dims = parseDims(body || {});
      const count = await increment(env, dims);
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
      if (request.method === "GET") await increment(env, dims);
      return serveAsset(request, env, asset, { head: request.method === "HEAD" });
    }

    if ((url.pathname === "/download" || url.pathname.startsWith("/download/")) && (request.method === "GET" || request.method === "HEAD")) {
      const dims = parseDims(url.searchParams);
      if (!dims.asset && url.pathname.startsWith("/download/")) {
        dims.asset = decodeURIComponent(url.pathname.slice("/download/".length));
      }
      const asset = dims.asset || DEFAULT_ASSET;
      dims.asset = asset;
      if (request.method === "GET") await increment(env, dims);
      return serveAsset(request, env, asset, { head: request.method === "HEAD" });
    }

    return json({ error: "not found" }, 404);
  },
};
