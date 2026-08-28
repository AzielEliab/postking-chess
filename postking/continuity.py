"""Continuity metrics: clusters, influence, collapse, SPOF.

Clusters are 8-adjacent connected components of AI (black) pieces.
Board influence is the fraction of squares attacked by at least one AI piece.

Continuity Collapse requires ALL three:
  1. Fewer than two independent clusters (0 or 1 group of AI pieces).
  2. Influence below the difficulty threshold for N consecutive full turns.
  3. No legal AI move restores ≥2 clusters within M plies of greedy restore.

Capture alone is not a win. Material alone is not a win.
"""

from __future__ import annotations

from dataclasses import dataclass

from postking.board import (
    BLACK,
    Board,
    WHITE,
    apply_move,
    attacked_squares,
    legal_moves,
    material_of,
)

DIFFICULTIES = {
    "witness": {
        "label": "Witness",
        "n": 2,
        "m": 1,
        "threshold": 0.18,
        "search": 1,
        "blurb": "Shallower search. Collapse patience N=2 M=1. Influence 0.18.",
    },
    "steward": {
        "label": "Steward",
        "n": 3,
        "m": 2,
        "threshold": 0.12,
        "search": 2,
        "blurb": "Default. Collapse patience N=3 M=2. Influence 0.12.",
    },
    "remain": {
        "label": "Remain",
        "n": 5,
        "m": 3,
        "threshold": 0.08,
        "search": 3,
        "blurb": "Deeper search. Collapse patience N=5 M=3. Influence 0.08.",
    },
}


def normalize_difficulty(name: str) -> str:
    key = (name or "steward").strip().lower()
    if key not in DIFFICULTIES:
        raise ValueError(f"unknown difficulty: {name} (witness|steward|remain)")
    return key


def cluster_squares(board: Board) -> list[list[int]]:
    """8-adjacent connected components of AI pieces."""
    cells = [i for i, p in enumerate(board.squares) if p is not None and p.color == BLACK]
    remaining = set(cells)
    clusters: list[list[int]] = []
    while remaining:
        start = min(remaining)
        stack = [start]
        remaining.remove(start)
        group = [start]
        while stack:
            sq = stack.pop()
            f, r = sq & 7, sq >> 3
            for df in (-1, 0, 1):
                for dr in (-1, 0, 1):
                    if df == 0 and dr == 0:
                        continue
                    nf, nr = f + df, r + dr
                    if 0 <= nf < 8 and 0 <= nr < 8:
                        nxt = nf + nr * 8
                        if nxt in remaining:
                            remaining.remove(nxt)
                            stack.append(nxt)
                            group.append(nxt)
        clusters.append(sorted(group))
    clusters.sort(key=lambda g: (g[0] if g else 99, len(g)))
    return clusters


def cluster_count(board: Board) -> int:
    return len(cluster_squares(board))


def influence(board: Board) -> float:
    mask = attacked_squares(board, BLACK)
    return sum(1 for x in mask if x) / 64.0


def optionality(board: Board) -> int:
    """Count of legal AI replies in this position (mobility / optionality)."""
    side = board.side
    board.side = BLACK
    n = len(legal_moves(board, BLACK))
    board.side = side
    return n


def is_spof(board: Board) -> bool:
    """True if all remaining AI pieces defend one common square (single point of failure)."""
    squares = [i for i, p in enumerate(board.squares) if p is not None and p.color == BLACK]
    if len(squares) < 3:
        return False
    from postking.board import attacks_from

    hit = [0] * 64
    for sq in squares:
        for a in attacks_from(board, sq):
            hit[a] += 1
    n = len(squares)
    defended_by_all = [i for i, c in enumerate(hit) if c == n]
    if not defended_by_all:
        return False
    # Star around one square, one cluster: classic SPOF.
    return cluster_count(board) == 1


def can_restore_clusters(board: Board, m: int) -> bool:
    """Greedy AI-only lookahead: can cluster count reach ≥2 within M plies?"""
    if cluster_count(board) >= 2:
        return True
    if m <= 0:
        return False
    side = board.side
    board.side = BLACK
    moves = legal_moves(board, BLACK)
    board.side = side
    if not moves:
        return False
    scored: list[tuple[int, float, str, Board]] = []
    for mv in moves:
        nxt = apply_move(board, mv)
        c = cluster_count(nxt)
        if c >= 2:
            return True
        scored.append((c, influence(nxt), mv.uci(), nxt))
    scored.sort(key=lambda t: (-t[0], -t[1], t[2]))
    return can_restore_clusters(scored[0][3], m - 1)


def hanging_ai(board: Board) -> int:
    """AI pieces attacked by human and not defended by AI."""
    from postking.board import is_attacked

    n = 0
    for sq, p in board.pieces_of(BLACK):
        if is_attacked(board, sq, WHITE) and not is_attacked(board, sq, BLACK):
            n += 1
    return n


@dataclass(frozen=True)
class ContinuitySnapshot:
    clusters: int
    influence: float
    optionality: int
    spof: bool
    material_ai: int
    can_restore: bool


def snapshot(board: Board, m: int) -> ContinuitySnapshot:
    return ContinuitySnapshot(
        clusters=cluster_count(board),
        influence=influence(board),
        optionality=optionality(board),
        spof=is_spof(board),
        material_ai=material_of(board, BLACK),
        can_restore=can_restore_clusters(board, m),
    )


def insufficient_material(board: Board) -> bool:
    """King vs Node (no other pieces, no pawns): documented draw.

    A lone node cannot form two clusters. Collapse via hunting the last
    node would be capture-alone. Play may still proceed until this is
    detected; callers treat it as a draw.
    """
    from postking.board import KING, NODE, PAWN

    white = board.pieces_of(WHITE)
    black = board.pieces_of(BLACK)
    if any(p.kind == PAWN for _, p in white + black):
        return False
    if len(white) == 1 and white[0][1].kind == KING and len(black) == 1 and black[0][1].kind == NODE:
        return True
    if len(white) == 1 and white[0][1].kind == KING and len(black) == 0:
        # 0 AI pieces is collapse (0 clusters), not insufficient-material draw
        return False
    return False
