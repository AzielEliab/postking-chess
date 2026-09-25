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


def test_help_lists_ui_and_version() -> None:
    from postking.cli import _build_parser

    text = _build_parser().format_help()
    assert "ui" in text
    assert "version" in text
    assert "127.0.0.1:8844" in text or "postking ui" in text
    assert "Author: Aziel Eliab" in text


def test_bare_command_welcomes(capsys) -> None:
    assert main([]) == 0
    out = capsys.readouterr().out
    assert "Post-King Chess" in out
    assert "postking ui" in out
    assert "required" not in out.lower()


def test_unknown_command_has_next_step(capsys) -> None:
    import pytest

    with pytest.raises(SystemExit) as caught:
        main(["bogus"])
    assert caught.value.code == 2
    err = capsys.readouterr().err
    assert 'Unknown command "bogus"' in err
    assert "postking --help" in err


def test_status_json_keeps_game_fields(capsys, tmp_path: Path) -> None:
    import json

    save = str(tmp_path / "game.json")
    assert main(["new", "--save", save, "--json"]) == 0
    capsys.readouterr()
    assert main(["--json", "status", "--save", save]) == 0
    payload = json.loads(capsys.readouterr().out)
    assert payload["game"]["fen"].startswith("rnbqobnr/")
    assert payload["game"]["difficulty"] == "steward"
