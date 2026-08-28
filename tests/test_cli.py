"""CLI: version, new, move, status."""

from __future__ import annotations

from pathlib import Path

from postking import __version__
from postking.cli import main


def test_cli_version(capsys) -> None:
    assert main(["version"]) == 0
    assert capsys.readouterr().out.strip() == f"postking {__version__}"
    assert __version__ == "0.1.0"


def test_cli_new_move_status(capsys, tmp_path: Path) -> None:
    save = str(tmp_path / "game.json")
    assert main(["new", "--difficulty", "steward", "--seed", "1", "--save", save]) == 0
    out = capsys.readouterr().out
    assert "Steward" in out or "steward" in out.lower()
    assert "clusters" in out
    assert Path(save).is_file()

    assert main(["move", "e2e4", "--save", save]) == 0
    out = capsys.readouterr().out
    assert "e2e4" in out
    assert "ai " in out or "moves e2e4" in out

    assert main(["status", "--save", save]) == 0
    out = capsys.readouterr().out
    assert "e2e4" in out
    assert "fen" in out
    assert "in_play" in out or "result" in out


def test_cli_move_without_save_fails(capsys, tmp_path: Path, monkeypatch) -> None:
    monkeypatch.chdir(tmp_path)
    code = main(["move", "e2e4", "--save", str(tmp_path / "missing.json")])
    assert code == 1
    err = capsys.readouterr().err
    assert "no saved game" in err or "error" in err
