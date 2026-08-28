"""Command-line interface for Post-King Chess.

    postking version
    postking ui
    postking new --difficulty steward --seed 1
    postking move e2e4
    postking status

The goal is not to win. The goal is to remain.
"""

from __future__ import annotations

import argparse
import sys
from typing import Sequence

from postking import __version__
from postking.continuity import normalize_difficulty
from postking.game import DEFAULT_SAVE, Game, GameError, default_save_path


def _build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="postking",
        description=(
            "Post-King Chess — asymmetric continuity-based game "
            "(Aziel Eliab, 2026). The goal is not to win. The goal is to remain."
        ),
    )
    sub = parser.add_subparsers(dest="cmd", required=True)

    sub.add_parser("version", help="Print package version.")

    p_ui = sub.add_parser("ui", help="Serve the local game UI on 127.0.0.1:8844.")
    p_ui.add_argument("--host", default="127.0.0.1", help="Loopback host (default 127.0.0.1).")
    p_ui.add_argument("--port", type=int, default=8844, help="Port (default 8844).")

    p_new = sub.add_parser("new", help="Start a new game and write the save file.")
    p_new.add_argument(
        "--difficulty",
        default="steward",
        help="witness | steward | remain (default steward).",
    )
    p_new.add_argument("--seed", type=int, default=1, help="Deterministic AI seed.")
    p_new.add_argument("--save", "--file", dest="save", default=None, help=f"Save path (default {DEFAULT_SAVE}).")

    p_move = sub.add_parser("move", help="Play a human UCI move; AI replies.")
    p_move.add_argument("uci", help="Move in UCI, e.g. e2e4 or e1g1.")
    p_move.add_argument("--save", "--file", dest="save", default=None, help=f"Save path (default {DEFAULT_SAVE}).")

    p_status = sub.add_parser("status", help="Print the current saved game.")
    p_status.add_argument("--save", "--file", dest="save", default=None, help=f"Save path (default {DEFAULT_SAVE}).")

    return parser


def _load_or_error(path) -> Game:
    if not path.is_file():
        raise GameError(f"no saved game at {path}; run: postking new")
    return Game.load(path)


def main(argv: Sequence[str] | None = None) -> int:
    parser = _build_parser()
    args = parser.parse_args(list(argv) if argv is not None else None)

    if args.cmd == "version":
        print(f"postking {__version__}")
        return 0

    if args.cmd == "ui":
        from postking.ui import serve

        try:
            serve(host=args.host, port=args.port)
        except ValueError as exc:
            print(str(exc), file=sys.stderr)
            return 2
        return 0

    if args.cmd == "new":
        try:
            normalize_difficulty(args.difficulty)
        except ValueError as exc:
            print(f"error: {exc}", file=sys.stderr)
            return 1
        path = default_save_path(args.save)
        game = Game.new(difficulty=args.difficulty, seed=args.seed)
        game.save(path)
        print(game.status_text())
        print(f"saved {path}")
        return 0

    if args.cmd == "move":
        path = default_save_path(args.save)
        try:
            game = _load_or_error(path)
            played = game.human_move(args.uci)
        except GameError as exc:
            print(f"error: {exc}", file=sys.stderr)
            return 1
        game.save(path)
        print(game.status_text())
        if played.get("ai"):
            print(f"ai {played['ai']}")
        print(f"saved {path}")
        return 0

    if args.cmd == "status":
        path = default_save_path(args.save)
        try:
            game = _load_or_error(path)
        except GameError as exc:
            print(f"error: {exc}", file=sys.stderr)
            return 1
        print(game.status_text())
        return 0

    parser.error(f"unknown command {args.cmd}")
    return 2


if __name__ == "__main__":
    raise SystemExit(main())
