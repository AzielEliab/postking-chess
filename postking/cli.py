"""Command-line interface for Post-King Chess.

    postking
    postking ui
    postking new --difficulty steward --seed 1
    postking move e2e4
    postking status

The goal is not to win. The goal is to remain.
"""

from __future__ import annotations

import argparse
import json
import sys
from typing import Sequence

from postking import __version__
from postking.continuity import normalize_difficulty
from postking.game import DEFAULT_SAVE, Game, GameError, default_save_path

AUTHOR = "Aziel Eliab"
MOTTO = "The goal is not to win. The goal is to remain."

HELP = f"""\
postking — play Post-King Chess on this computer

You keep a king. The other side tries to remain.
{MOTTO}

Usage:
  postking
  postking <command> [options]

Common commands:
  ui        Open the board at http://127.0.0.1:8844
  new       Start a saved game
  move      Play a move, for example e2e4
  status    Show the saved game
  doctor    Check this install

Advanced:
  version   Print the package version
  import    Store a JSON file on this computer
  export    Write the stored JSON file
  help      Show this help

Options:
  --json         Print JSON for programs (people see text by default)
  --save PATH    Saved game path (default {DEFAULT_SAVE})
  --seed N       Same seed, same game
  --difficulty   witness, steward, or remain
  --port PORT    Board port (default 8844)
  --host HOST    Loopback host (default 127.0.0.1)
  -h, --help     Show this help

Examples:
  postking ui
  postking new --difficulty steward --seed 1
  postking move e2e4
  postking status
  postking doctor --json

Author: {AUTHOR}
"""

WELCOME = f"""\
Post-King Chess

You keep a king. The other side tries to remain. Open the board on this computer.

Next:
  postking ui        Open http://127.0.0.1:8844/
  postking new       Start a saved game
  postking doctor    Check this install
  postking --help    All commands

Author: {AUTHOR}
"""


class HumanParser(argparse.ArgumentParser):
    def format_help(self) -> str:
        return HELP if HELP.endswith("\n") else HELP + "\n"

    def error(self, message: str) -> None:
        text = message.strip()
        lower = text.lower()
        if "invalid choice" in lower:
            name = "that"
            marker = "invalid choice: '"
            start = lower.find(marker)
            if start >= 0:
                rest = text[start + len(marker) :]
                name = rest.split("'", 1)[0]
            self.exit(2, f'Unknown command "{name}". Try: postking ui   or   postking --help\n')
        if "the following arguments are required" in lower:
            if "uci" in lower:
                self.exit(2, "A move is required, for example e2e4. Try: postking move e2e4\n")
            if "path" in lower:
                self.exit(2, "A file path is required. Try: postking import notes.json   or   postking --help\n")
            self.exit(2, "A command is required. Try: postking ui   or   postking --help\n")
        if lower.startswith("unrecognized arguments"):
            self.exit(2, f'Unknown option in "{text}". Try: postking --help\n')
        self.exit(2, f"{text}\nTry: postking --help\n")


def _json_parent() -> argparse.ArgumentParser:
    parent = argparse.ArgumentParser(add_help=False)
    parent.add_argument(
        "--json",
        action="store_true",
        dest="as_json",
        default=argparse.SUPPRESS,
        help="Print JSON for programs.",
    )
    return parent


def _build_parser() -> argparse.ArgumentParser:
    common = _json_parent()
    parser = HumanParser(prog="postking", parents=[common])
    sub = parser.add_subparsers(dest="cmd", required=False)

    sub.add_parser("help", parents=[common], help="Show help.")
    sub.add_parser("version", parents=[common], help="Print the package version.")

    p_ui = sub.add_parser("ui", parents=[common], help="Open the board on this computer.")
    p_ui.add_argument("--host", default="127.0.0.1", help="Loopback host (default 127.0.0.1).")
    p_ui.add_argument("--port", type=int, default=8844, help="Port (default 8844).")

    p_new = sub.add_parser("new", parents=[common], help="Start a saved game.")
    p_new.add_argument(
        "--difficulty",
        default="steward",
        help="witness, steward, or remain (default steward).",
    )
    p_new.add_argument("--seed", type=int, default=1, help="Same seed, same game.")
    p_new.add_argument("--save", "--file", dest="save", default=None, help=f"Save path (default {DEFAULT_SAVE}).")

    p_move = sub.add_parser("move", parents=[common], help="Play a move, for example e2e4.")
    p_move.add_argument("uci", help="Move in UCI, for example e2e4 or e1g1.")
    p_move.add_argument("--save", "--file", dest="save", default=None, help=f"Save path (default {DEFAULT_SAVE}).")

    p_status = sub.add_parser("status", parents=[common], help="Show the saved game.")
    p_status.add_argument("--save", "--file", dest="save", default=None, help=f"Save path (default {DEFAULT_SAVE}).")

    sub.add_parser("doctor", parents=[common], help="Check this install. No network.")

    p_imp = sub.add_parser("import", parents=[common], help="Store a JSON file on this computer.")
    p_imp.add_argument("path", help="Path to a JSON file.")

    p_exp = sub.add_parser("export", parents=[common], help="Write the stored JSON file.")
    p_exp.add_argument("path", help="Path to write.")

    return parser


def _load_or_error(path) -> Game:
    if not path.is_file():
        raise GameError(f"no saved game at {path}. Start one with: postking new")
    return Game.load(path)


def _welcome_payload() -> dict:
    return {
        "name": "postking",
        "version": __version__,
        "author": AUTHOR,
        "motto": MOTTO,
        "next": [
            "postking ui",
            "postking new",
            "postking doctor",
            "postking --help",
        ],
    }


def _emit_json(payload: object) -> None:
    sys.stdout.write(json.dumps(payload, indent=2, ensure_ascii=False) + "\n")


def _fail(message: str, hint: str) -> int:
    print(f"error: {message}", file=sys.stderr)
    if "Try:" not in message and "with:" not in message and "run:" not in message:
        print(f"Try: {hint}", file=sys.stderr)
    return 1


def _print_human_game(game: Game, path, played: dict | None = None) -> None:
    state = game.to_dict()
    if state["result"] == "human_win":
        print("Continuity collapse. The other side did not remain.")
    elif state["result"] == "human_loss":
        print("Your king fell.")
    elif state["result"] == "draw":
        print(f"Draw ({state['result_reason'] or 'draw'}).")
    elif state["side"] == "white":
        print("Your move.")
    else:
        print("The other side is to move.")
    print(game.status_text())
    if played and played.get("ai"):
        print(f"ai {played['ai']}")
    if path is not None:
        print(f"saved {path}")
    if not state["result"]:
        print("Next: postking move <uci>   or   postking ui")


def _print_record(rec: dict, *, verb: str) -> None:
    if verb == "import":
        print(f"Imported {rec.get('imported')}")
        print(f"Stored {rec.get('stored')}")
    else:
        print(f"Exported {rec.get('exported')}")
    print(f"Author: {rec.get('author') or AUTHOR}")


def main(argv: Sequence[str] | None = None) -> int:
    parser = _build_parser()
    args = parser.parse_args(list(argv) if argv is not None else None)
    as_json = bool(getattr(args, "as_json", False))

    if args.cmd in (None, "help"):
        if args.cmd == "help":
            sys.stdout.write(parser.format_help())
            return 0
        if as_json:
            _emit_json(_welcome_payload())
        else:
            sys.stdout.write(WELCOME if WELCOME.endswith("\n") else WELCOME + "\n")
        return 0

    if args.cmd == "version":
        if as_json:
            _emit_json({"name": "postking", "version": __version__, "author": AUTHOR})
        else:
            print(f"postking {__version__}")
        return 0

    if args.cmd == "ui":
        from postking.ui import serve

        try:
            serve(host=args.host, port=args.port)
        except ValueError as exc:
            print(f"error: {exc}", file=sys.stderr)
            return 2
        except OSError as exc:
            reason = exc.strerror or str(exc)
            print(f"error: could not open the board on port {args.port} ({reason}).", file=sys.stderr)
            print("Try: postking ui --port 8845", file=sys.stderr)
            return 2
        return 0

    if args.cmd == "new":
        try:
            normalize_difficulty(args.difficulty)
        except ValueError as exc:
            return _fail(str(exc), "postking new --difficulty steward")
        path = default_save_path(args.save)
        game = Game.new(difficulty=args.difficulty, seed=args.seed)
        game.save(path)
        if as_json:
            _emit_json({"saved": str(path), "game": game.to_dict()})
        else:
            _print_human_game(game, path)
        return 0

    if args.cmd == "move":
        path = default_save_path(args.save)
        try:
            game = _load_or_error(path)
            played = game.human_move(args.uci)
        except GameError as exc:
            return _fail(str(exc), "postking move e2e4")
        game.save(path)
        if as_json:
            _emit_json({"saved": str(path), "played": played, "game": game.to_dict()})
        else:
            _print_human_game(game, path, played)
        return 0

    if args.cmd == "status":
        path = default_save_path(args.save)
        try:
            game = _load_or_error(path)
        except GameError as exc:
            return _fail(str(exc), "postking new")
        if as_json:
            _emit_json({"game": game.to_dict()})
        else:
            _print_human_game(game, None)
        return 0

    if args.cmd == "doctor":
        from postking.doctor import run_doctor

        return run_doctor(as_json=as_json)

    if args.cmd == "import":
        from postking.jsonio import import_json

        try:
            rec = import_json(args.path)
        except FileNotFoundError:
            return _fail(f"no file at {args.path}", "postking import notes.json")
        except json.JSONDecodeError:
            return _fail("that file is not JSON", "postking import notes.json")
        except ValueError as exc:
            return _fail(str(exc), "postking import notes.json")
        if as_json:
            _emit_json(rec)
        else:
            _print_record(rec, verb="import")
        return 0

    if args.cmd == "export":
        from postking.jsonio import export_json

        try:
            rec = export_json(args.path)
        except OSError as exc:
            return _fail(exc.strerror or str(exc), "postking export notes.json")
        if as_json:
            _emit_json(rec)
        else:
            _print_record(rec, verb="export")
        return 0

    parser.error(f"unknown command {args.cmd}")
    return 2


if __name__ == "__main__":
    raise SystemExit(main())
