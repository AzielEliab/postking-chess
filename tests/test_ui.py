"""Local UI: loopback only, Post-King page, philosophy README."""

from __future__ import annotations

import json
import threading
import urllib.error
import urllib.request

import pytest

from postking.ui import DEFAULT_PORT, LOOPBACK, make_server


def test_ui_rejects_non_loopback() -> None:
    with pytest.raises(ValueError, match="loopback"):
        make_server("0.0.0.0", 9)
    assert "127.0.0.1" in LOOPBACK


def test_ui_binds_loopback_address() -> None:
    httpd = make_server("127.0.0.1", 0)
    try:
        host, port = httpd.server_address[:2]
        assert host == "127.0.0.1"
        assert port > 0
        assert DEFAULT_PORT == 8844
    finally:
        httpd.server_close()


def _serve():
    httpd = make_server("127.0.0.1", 0)
    port = httpd.server_address[1]
    thread = threading.Thread(target=httpd.serve_forever, daemon=True)
    thread.start()
    return httpd, port


def test_ui_get_root_contains_post_king() -> None:
    httpd, port = _serve()
    try:
        with urllib.request.urlopen(f"http://127.0.0.1:{port}/", timeout=3) as resp:
            assert resp.status == 200
            html = resp.read().decode("utf-8")
        assert "Post-King" in html
        assert "The goal is not to win. The goal is to remain." in html
        assert "Witness" in html and "Steward" in html and "Remain" in html
        assert "cdn" not in html.lower()
        assert "googleapis" not in html.lower()
        with urllib.request.urlopen(f"http://127.0.0.1:{port}/style.css", timeout=3) as resp:
            css = resp.read().decode("utf-8")
        assert "gold" in css or "#c9a562" in css
        with urllib.request.urlopen(f"http://127.0.0.1:{port}/api/version", timeout=3) as resp:
            payload = json.loads(resp.read().decode("utf-8"))
        assert payload["name"] == "postking"
        assert payload["version"] == "0.1.0"
        req = urllib.request.Request(
            f"http://127.0.0.1:{port}/api/new",
            data=json.dumps({"difficulty": "steward", "seed": 1}).encode("utf-8"),
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=8) as resp:
            game = json.loads(resp.read().decode("utf-8"))["game"]
        assert game["fen"].startswith("rnbqobnr/")
        req = urllib.request.Request(
            f"http://127.0.0.1:{port}/api/move",
            data=json.dumps({"uci": "e2e4"}).encode("utf-8"),
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=8) as resp:
            moved = json.loads(resp.read().decode("utf-8"))
        assert "e2e4" in moved["game"]["history"]
    finally:
        httpd.shutdown()
        httpd.server_close()


def test_ui_philosophy_contains_remain_and_continuity() -> None:
    httpd, port = _serve()
    try:
        with urllib.request.urlopen(f"http://127.0.0.1:{port}/philosophy", timeout=3) as resp:
            assert resp.status == 200
            body = resp.read().decode("utf-8")
        assert "remain" in body.lower()
        assert "Continuity" in body
        assert "R = S²C" in body or "R = S^2C" in body or "R = S²C" in body
        assert "If it cannot continue without you, it was not redeemed." in body
        assert "Post-King" in body
    finally:
        httpd.shutdown()
        httpd.server_close()
