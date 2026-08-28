"""This tree is Post-King Chess only. Not merged into sibling products."""

from __future__ import annotations

import ast
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PKG = ROOT / "postking"

FORBIDDEN_ROOTS = frozenset(
    {
        "forgereceipts",
        "zionpattern",
        "zion_pattern",
        "zion_pattern_solver",
        "decisiongate",
        "azos",
        "az_os",
        "glossafilter",
        "veillock",
        "vibelock",
        "godlock",
        "codelock",
        "shadowlock",
        "temporallock",
        "staticclock",
        "miragegrid",
    }
)


def _root_of(name: str) -> str:
    return name.split(".")[0].lower().replace("-", "_")


def test_package_never_imports_siblings() -> None:
    import postking  # noqa: F401
    import postking.ai  # noqa: F401
    import postking.board  # noqa: F401
    import postking.cli  # noqa: F401
    import postking.continuity  # noqa: F401
    import postking.game  # noqa: F401
    import postking.ui  # noqa: F401

    for name in list(sys.modules):
        assert _root_of(name) not in FORBIDDEN_ROOTS


def test_source_imports_isolated() -> None:
    for py in PKG.rglob("*.py"):
        tree = ast.parse(py.read_text(encoding="utf-8"))
        for node in ast.walk(tree):
            if isinstance(node, ast.Import):
                for alias in node.names:
                    assert _root_of(alias.name) not in FORBIDDEN_ROOTS
            elif isinstance(node, ast.ImportFrom) and node.module:
                assert _root_of(node.module) not in FORBIDDEN_ROOTS


def test_not_inside_sibling_products() -> None:
    text = str(ROOT)
    assert text.endswith("postking-chess") or "/postking-chess" in text
    assert "forgereceipts" not in text
    assert "zion-pattern" not in text
    assert "decisiongate" not in text
    assert (PKG / "game.py").is_file()
    assert not (ROOT / "forgereceipts").exists()
    assert not (ROOT / "decisiongate").exists()
    assert not (ROOT / "azos").exists()
    assert not (ROOT / "glossafilter").exists()


def test_worker_kv_real_and_isolated() -> None:
    toml = (ROOT / "workers" / "download-tracker" / "wrangler.toml").read_text(encoding="utf-8")
    assert 'name = "postking-download-tracker"' in toml
    assert 'account_id = "ac575a9b822bea2bed97d0ab73aed238"' in toml
    assert 'binding = "DOWNLOADS"' in toml
    assert "dbb9f4b45ea14ce1afd7880305cbac3a" in toml
    assert "REPLACE_ME" not in toml
    src = (ROOT / "workers" / "download-tracker" / "src" / "index.js").read_text(encoding="utf-8")
    assert 'const PROJECT = "postking"' in src
    assert "postking-chess-0.1.0.tar.gz" in src
    assert "The goal is not to win. The goal is to remain." in src
    assert "Isolated counter" in src
    assert "postking-download-tracker" in src
    assert "env.ASSETS.fetch" in src
    assert "private, no-store" in src
    assert "totalKey()" in src
    lowered = src.lower().replace("-", "").replace("_", "").replace(" ", "")
    assert "forgereceipts" not in lowered
    assert "zionpattern" not in lowered
    assert "decisiongate" not in lowered
    assert "azos" not in lowered
    assert "glossafilter" not in lowered
    public = ROOT / "workers" / "download-tracker" / "public"
    assert (public / ".gitkeep").is_file()
    tarballs = list(public.glob("*.tar.gz"))
    assert tarballs == []


def test_runtime_has_zero_third_party_imports() -> None:
    for name in ("board.py", "ai.py", "game.py", "continuity.py", "cli.py", "ui.py"):
        src = (PKG / name).read_text(encoding="utf-8")
        assert "import chess" not in src
        assert "import numpy" not in src
        assert "import requests" not in src
        assert "openai" not in src.lower()
