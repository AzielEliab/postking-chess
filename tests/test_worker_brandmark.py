"""Post-King Worker UI hosts the rose-star brand mark.

Public mark is /sigil.png with empty alt and no words on the mark.
Verify contracts that require Everblooming header/skill strings stay
untouched — this test only locks the public mark, not FragGate or mesh.
"""

from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
INDEX = (ROOT / "workers/download-tracker/src/index.js").read_text(encoding="utf-8")
SIGIL = ROOT / "workers/download-tracker/public/sigil.png"

BRAND_MARK = (
    '<div class="brandrow"><img class="brandmark" src="/sigil.png" '
    'width="40" height="40" alt="" decoding="async"></div>'
)


def test_official_rose_star_png_is_hosted() -> None:
    raw = SIGIL.read_bytes()
    assert SIGIL.is_file()
    assert raw[:8] == b"\x89PNG\r\n\x1a\n"
    # Official Aziel rose-star is ~75KB (196x139). Reject the 4KB 40x40 placeholder.
    assert 70_000 <= len(raw) <= 80_000


def test_homepage_and_ai_pages_use_empty_alt_brandrow() -> None:
    assert INDEX.count(BRAND_MARK) == 2
    assert ".brandrow{" in INDEX
    assert ".brandmark{" in INDEX
    home = INDEX.index("async function indexHtml")
    ai = INDEX.index("function aiHelpPage")
    assert BRAND_MARK in INDEX[home:ai]
    assert BRAND_MARK in INDEX[ai:]


def test_public_mark_has_no_everblooming_sigil_wording() -> None:
    img_start = 0
    while True:
        img_start = INDEX.find("<img class=\"brandmark\"", img_start)
        if img_start < 0:
            break
        img_end = INDEX.find(">", img_start)
        tag = INDEX[img_start : img_end + 1].lower()
        assert "everblooming" not in tag
        assert 'alt=""' in tag
        img_start = img_end + 1
    assert INDEX.count("<img class=\"brandmark\"") == 2
