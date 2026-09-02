"""Post-King game state: play, collapse, persistence.

Human (white) is king-bound. AI (black) has a Node. Human win is
Continuity Collapse (all three conditions). Human loss is king captured
or checkmated. Deterministic by seed. Stdlib only.
"""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Optional

from postking.ai import choose_move
from postking.board import (
    BLACK,
    WHITE,
    Board,
    Move,
    apply_move,
    in_check,
    legal_moves,
    match_uci,
    sq_name,
)
from postking.continuity import (
    DIFFICULTIES,
    can_restore_clusters,
    cluster_count,
    influence,
    insufficient_material,
    normalize_difficulty,
    snapshot,
)

DEFAULT_SAVE = "game.json"


class GameError(ValueError):
    """Illegal play or missing save."""


@dataclass
class Game:
    board: Board
    difficulty: str = "steward"
    seed: int = 1
    low_influence_streak: int = 0
    history: list[str] = field(default_factory=list)
    result: Optional[str] = None
    result_reason: Optional[str] = None

    def __post_init__(self) -> None:
        self.difficulty = normalize_difficulty(self.difficulty)
        self._check_terminal()

    @classmethod
    def new(cls, difficulty: str = "steward", seed: int = 1) -> "Game":
        return cls(board=Board.start(), difficulty=difficulty, seed=int(seed))

    @classmethod
    def from_dict(cls, data: dict) -> "Game":
        """Restore from game.json / to_dict payload."""
        src = data.get("game") if isinstance(data.get("game"), dict) else data
        return cls(
            board=Board.from_fen(src["fen"]),
            difficulty=src.get("difficulty", "steward"),
            seed=int(src.get("seed", 1)),
            low_influence_streak=int(src.get("low_influence_streak", src.get("streak", 0))),
            history=list(src.get("history") or []),
            result=src.get("result"),
            result_reason=src.get("result_reason"),
        )

    @classmethod
    def from_fen(
        cls,
        fen: str,
        difficulty: str = "steward",
        seed: int = 1,
        low_influence_streak: int = 0,
    ) -> "Game":
        return cls(
            board=Board.from_fen(fen),
            difficulty=difficulty,
            seed=int(seed),
            low_influence_streak=int(low_influence_streak),
        )

    @property
    def cfg(self) -> dict:
        return DIFFICULTIES[self.difficulty]

    def continuity(self):
        return snapshot(self.board, int(self.cfg["m"]))

    def _check_terminal(self) -> None:
        if self.result:
            return
        if self.board.king_square(WHITE) is None:
            self.result = "human_loss"
            self.result_reason = "king_captured"
            return
        if self.board.side == WHITE:
            human_moves = legal_moves(self.board, WHITE)
            if not human_moves:
                if in_check(self.board, WHITE):
                    self.result = "human_loss"
                    self.result_reason = "checkmate"
                else:
                    self.result = "draw"
                    self.result_reason = "stalemate"
                return
        if self.board.halfmove >= 100:
            self.result = "draw"
            self.result_reason = "50_move"
            return
        if insufficient_material(self.board):
            self.result = "draw"
            self.result_reason = "insufficient"
            return
        clusters = cluster_count(self.board)
        inf = influence(self.board)
        n = int(self.cfg["n"])
        m = int(self.cfg["m"])
        threshold = float(self.cfg["threshold"])
        below = inf < threshold
        restore = can_restore_clusters(self.board, m)
        if clusters < 2 and self.low_influence_streak >= n and below and not restore:
            self.result = "human_win"
            self.result_reason = "continuity_collapse"

    def collapse_parts(self) -> dict[str, Any]:
        clusters = cluster_count(self.board)
        inf = influence(self.board)
        n = int(self.cfg["n"])
        m = int(self.cfg["m"])
        threshold = float(self.cfg["threshold"])
        below = inf < threshold
        restore = can_restore_clusters(self.board, m)
        c1 = clusters < 2
        c2 = below and self.low_influence_streak >= n
        c3 = not restore
        return {
            "clusters": clusters,
            "influence": inf,
            "threshold": threshold,
            "streak": self.low_influence_streak,
            "n": n,
            "m": m,
            "below": below,
            "can_restore": restore,
            "part_clusters": c1,
            "part_influence": c2,
            "part_restore": c3,
            "collapse": bool(c1 and c2 and c3),
        }

    def _apply(self, move: Move) -> None:
        self.board = apply_move(self.board, move)
        self.history.append(move.uci())

    def _tick_influence(self) -> None:
        threshold = float(self.cfg["threshold"])
        if influence(self.board) < threshold:
            self.low_influence_streak += 1
        else:
            self.low_influence_streak = 0

    def human_move(self, uci: str) -> dict[str, Any]:
        if self.result:
            raise GameError(f"game over ({self.result}: {self.result_reason})")
        if self.board.side != WHITE:
            raise GameError("not the human's turn")
        try:
            move = match_uci(self.board, uci)
        except ValueError as exc:
            raise GameError(str(exc)) from exc
        self._apply(move)
        self._check_terminal()
        ai_uci = None
        if not self.result and self.board.side == BLACK:
            ai_uci = self.ai_reply()
        self._check_terminal()
        return {"human": move.uci(), "ai": ai_uci, "result": self.result}

    def ai_reply(self) -> Optional[str]:
        if self.result:
            return None
        if self.board.side != BLACK:
            return None
        move = choose_move(
            self.board,
            difficulty=self.difficulty,
            seed=self.seed,
            nonce=len(self.history),
        )
        if move is None:
            # Pass: no legal AI move. Side returns to white; streak still ticks.
            self.board.side = WHITE
            self.board.fullmove += 1
            self._tick_influence()
            self._check_terminal()
            return None
        self._apply(move)
        self._tick_influence()
        self._check_terminal()
        return move.uci()

    def resign(self) -> dict:
        """Human king-loss by resignation."""
        if not self.result:
            self.result = "human_loss"
            self.result_reason = "resign"
        return self.to_dict()

    def play_uci(self, uci: str) -> str:
        """Apply one UCI move for the side to move (no auto-reply). Test helper."""
        if self.result:
            raise GameError(f"game over ({self.result})")
        move = match_uci(self.board, uci)
        side = self.board.side
        self._apply(move)
        if side == BLACK:
            self._tick_influence()
        self._check_terminal()
        return move.uci()

    def to_dict(self) -> dict[str, Any]:
        parts = self.collapse_parts()
        snap = self.continuity()
        pieces = []
        for i, p in enumerate(self.board.squares):
            if p is None:
                continue
            pieces.append(
                {
                    "sq": i,
                    "name": sq_name(i),
                    "color": "white" if p.color == WHITE else "black",
                    "kind": p.kind,
                    "fen": p.fen_char(),
                }
            )
        human_legal = []
        if not self.result and self.board.side == WHITE:
            human_legal = [m.uci() for m in legal_moves(self.board, WHITE)]
        return {
            "fen": self.board.fen(),
            "side": "white" if self.board.side == WHITE else "black",
            "difficulty": self.difficulty,
            "difficulty_label": self.cfg["label"],
            "seed": self.seed,
            "history": list(self.history),
            "result": self.result,
            "result_reason": self.result_reason,
            "clusters": snap.clusters,
            "influence": snap.influence,
            "optionality": snap.optionality,
            "spof": snap.spof,
            "material_ai": snap.material_ai,
            "can_restore": snap.can_restore,
            "streak": self.low_influence_streak,
            "n": int(self.cfg["n"]),
            "m": int(self.cfg["m"]),
            "threshold": float(self.cfg["threshold"]),
            "collapse": parts,
            "pieces": pieces,
            "legal": human_legal,
            "castling": self.board.castling,
            "fullmove": self.board.fullmove,
            "motto": "The goal is not to win. The goal is to remain.",
        }

    def ascii(self) -> str:
        rows = []
        for rank in range(7, -1, -1):
            cells = []
            for file in range(8):
                p = self.board.squares[file + rank * 8]
                cells.append(p.fen_char() if p is not None else ".")
            rows.append(f"{rank + 1}  " + " ".join(cells))
        rows.append("   a b c d e f g h")
        return "\n".join(rows)

    def status_text(self) -> str:
        d = self.to_dict()
        lines = [
            f"Post-King Chess  difficulty={d['difficulty_label']}  seed={d['seed']}",
            self.ascii(),
            f"fen {d['fen']}",
            (
                f"clusters {d['clusters']}  influence {d['influence']:.4f} "
                f"(threshold {d['threshold']:.2f})  streak {d['streak']}/{d['n']}  "
                f"restore_m={d['m']} can_restore={d['can_restore']}"
            ),
            f"side {d['side']}  ply {len(d['history'])}  result {d['result'] or 'in_play'}"
            + (f" ({d['result_reason']})" if d['result_reason'] else ""),
        ]
        if d["history"]:
            lines.append("moves " + " ".join(d["history"]))
        return "\n".join(lines)

    def save(self, path: str | Path) -> None:
        payload = {
            "fen": self.board.fen(),
            "difficulty": self.difficulty,
            "seed": self.seed,
            "low_influence_streak": self.low_influence_streak,
            "history": list(self.history),
            "result": self.result,
            "result_reason": self.result_reason,
        }
        Path(path).write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")

    @classmethod
    def load(cls, path: str | Path) -> "Game":
        raw = Path(path).read_text(encoding="utf-8")
        data = json.loads(raw)
        return cls.from_dict(data)


def default_save_path(explicit: str | None = None) -> Path:
    if explicit:
        return Path(explicit)
    return Path(DEFAULT_SAVE)
