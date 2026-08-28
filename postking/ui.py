"""Local Post-King Chess UI. Bind 127.0.0.1 only. No CDN.

Screens: start (title, motto, difficulties, New game, Philosophy),
board (click-to-move, cluster/influence/collapse meters).
GET /philosophy is the in-game README from docs/philosophy.md.
"""

from __future__ import annotations

import json
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from importlib.resources import files
from pathlib import Path
from urllib.parse import urlparse

from postking import __version__
from postking.continuity import DIFFICULTIES, normalize_difficulty
from postking.game import Game, GameError
from postking.markdown import markdown_to_html

LOOPBACK = frozenset({"127.0.0.1", "localhost", "::1"})
WEB = files("postking") / "web"
MIME = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "application/javascript; charset=utf-8",
    ".md": "text/markdown; charset=utf-8",
}
DEFAULT_PORT = 8844


def _web_bytes(name: str) -> bytes:
    return (WEB / name).read_bytes()


def _philosophy_text() -> str:
    candidates = []
    try:
        candidates.append(files("postking") / "docs" / "philosophy.md")
    except Exception:
        pass
    root = Path(__file__).resolve().parents[1]
    candidates.append(root / "docs" / "philosophy.md")
    candidates.append(Path.cwd() / "docs" / "philosophy.md")
    for path in candidates:
        try:
            return path.read_text(encoding="utf-8")
        except Exception:
            continue
    return (
        "# Post-King Chess\n\n"
        "The goal is not to win. The goal is to remain.\n\n"
        "Continuity Loop R = S²C\n"
        "If it cannot continue without you, it was not redeemed.\n"
    )


def _philosophy_html() -> bytes:
    body = markdown_to_html(_philosophy_text())
    page = f"""<!doctype html>
<html lang="en">
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Post-King Chess — Philosophy</title>
<link rel="stylesheet" href="/style.css">
<body class="philosophy">
  <header>
    <div class="tag">Post-King Chess · philosophy README · CC BY 4.0</div>
    <h1>Philosophy</h1>
    <p class="motto">The goal is not to win. The goal is to remain.</p>
    <p><a class="text-link" href="/">Back to the board</a></p>
  </header>
  <article class="readme doc">{body}</article>
</body>
</html>
"""
    return page.encode("utf-8")


class Handler(BaseHTTPRequestHandler):
    server_version = f"PostKing/{__version__}"
    game: Game | None = None

    def log_message(self, fmt: str, *args: object) -> None:
        return

    def _send(self, status: int, body: bytes, content_type: str) -> None:
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def _json(self, status: int, obj: object) -> None:
        body = json.dumps(obj, indent=2, ensure_ascii=False).encode("utf-8")
        self._send(status, body, "application/json; charset=utf-8")

    def do_GET(self) -> None:  # noqa: N802
        path = urlparse(self.path).path
        if path in {"/", "/index.html"}:
            self._send(200, _web_bytes("index.html"), MIME[".html"])
            return
        if path == "/style.css":
            self._send(200, _web_bytes("style.css"), MIME[".css"])
            return
        if path == "/app.js":
            self._send(200, _web_bytes("app.js"), MIME[".js"])
            return
        if path in {"/philosophy", "/philosophy.html"}:
            self._send(200, _philosophy_html(), MIME[".html"])
            return
        if path == "/philosophy.md":
            self._send(200, _philosophy_text().encode("utf-8"), MIME[".md"])
            return
        if path == "/api/version":
            self._json(
                200,
                {
                    "name": "postking",
                    "version": __version__,
                    "motto": "The goal is not to win. The goal is to remain.",
                    "port": DEFAULT_PORT,
                },
            )
            return
        if path == "/api/difficulties":
            payload = {
                key: {
                    "id": key,
                    "label": val["label"],
                    "n": val["n"],
                    "m": val["m"],
                    "threshold": val["threshold"],
                    "search": val["search"],
                    "blurb": val["blurb"],
                }
                for key, val in DIFFICULTIES.items()
            }
            self._json(200, {"difficulties": payload})
            return
        if path == "/api/state":
            game = Handler.game
            if game is None:
                self._json(200, {"game": None})
                return
            self._json(200, {"game": game.to_dict()})
            return
        self._json(404, {"error": "not found"})

    def do_POST(self) -> None:  # noqa: N802
        path = urlparse(self.path).path
        length = int(self.headers.get("Content-Length") or "0")
        raw = self.rfile.read(length) if length else b"{}"
        try:
            payload = json.loads(raw.decode("utf-8") or "{}")
        except json.JSONDecodeError:
            self._json(400, {"error": "JSON body required"})
            return
        if not isinstance(payload, dict):
            payload = {}

        if path == "/api/new":
            difficulty = str(payload.get("difficulty") or "steward")
            seed = int(payload.get("seed") or 1)
            try:
                normalize_difficulty(difficulty)
            except ValueError as exc:
                self._json(400, {"error": str(exc)})
                return
            Handler.game = Game.new(difficulty=difficulty, seed=seed)
            self._json(200, {"game": Handler.game.to_dict()})
            return

        if path == "/api/move":
            if Handler.game is None:
                self._json(400, {"error": "no game; start a new game"})
                return
            uci = str(payload.get("uci") or payload.get("move") or "").strip()
            if not uci:
                self._json(400, {"error": "uci required"})
                return
            try:
                played = Handler.game.human_move(uci)
            except GameError as exc:
                self._json(400, {"error": str(exc)})
                return
            self._json(200, {"played": played, "game": Handler.game.to_dict()})
            return

        if path == "/api/resign":
            if Handler.game is None:
                self._json(400, {"error": "no game; start a new game"})
                return
            self._json(200, {"game": Handler.game.resign()})
            return

        self._json(404, {"error": "not found"})


def make_server(host: str = "127.0.0.1", port: int = DEFAULT_PORT) -> ThreadingHTTPServer:
    if host not in LOOPBACK:
        raise ValueError("Post-King Chess UI binds loopback only (127.0.0.1)")
    Handler.game = None
    return ThreadingHTTPServer((host, port), Handler)


def serve(host: str = "127.0.0.1", port: int = DEFAULT_PORT) -> None:
    httpd = make_server(host, port)
    bound_host, bound_port = httpd.server_address[:2]
    print(
        f"Post-King Chess UI http://{bound_host}:{bound_port} "
        "(loopback only; the goal is to remain)"
    )
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nstopped")
    finally:
        httpd.server_close()
