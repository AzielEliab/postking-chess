"""Post-King AI: continuity constraints, deterministic move selection.

Hard constraints (not preferences):
- May not leave 1 cluster if a 2-cluster move exists.
- May not trade 2+ pieces for 1 threat unless continuity improves.
- Choose survivability over hunting the king.

Ranking of valid moves: lowest decisiveness, then highest survivability.
Tie-break is a SHA-256 of (seed, history nonce, uci) so the same seed
replays the same reply. No learning. No hidden eval. Stdlib only.
"""

from __future__ import annotations

import hashlib
from typing import Callable

from postking.board import (
    BLACK,
    KING,
    QUEEN,
    ROOK,
    BISHOP,
    KNIGHT,
    PAWN,
    Board,
    Move,
    apply_move,
    captured_kind,
    is_attacked,
    legal_moves,
    material_of,
)
from postking.continuity import (
    DIFFICULTIES,
    cluster_count,
    hanging_ai,
    influence,
    is_spof,
    normalize_difficulty,
)


def _tie_key(seed: int, nonce: int, uci: str) -> int:
    digest = hashlib.sha256(f"{seed}|{nonce}|{uci}".encode("utf-8")).digest()
    return int.from_bytes(digest[:8], "big")


def _leaf_survivability(board: Board) -> float:
    c = cluster_count(board)
    inf = influence(board)
    hang = hanging_ai(board)
    mat = material_of(board, BLACK)
    pieces = len(board.pieces_of(BLACK))
    spof = 25.0 if is_spof(board) else 0.0
    return c * 100.0 + inf * 140.0 + pieces * 3.0 + mat * 0.8 - hang * 10.0 - spof


def _decisiveness(before: Board, move: Move, after: Board) -> float:
    kind = captured_kind(before, move)
    score = 0.0
    if kind == KING:
        score += 10000.0
    elif kind == QUEEN:
        score += 26.0
    elif kind == ROOK:
        score += 14.0
    elif kind in (BISHOP, KNIGHT):
        score += 8.0
    elif kind == PAWN:
        score += 2.0
    k = after.king_square(WHITE := 0)
    if k is not None and is_attacked(after, k, BLACK):
        score += 18.0
    if move.promo is not None:
        score += 10.0
    # Quiet centralizing toward the king is still hunting.
    if kind is None and k is not None:
        before_dist = abs((move.src & 7) - (k & 7)) + abs((move.src >> 3) - (k >> 3))
        after_dist = abs((move.dst & 7) - (k & 7)) + abs((move.dst >> 3) - (k >> 3))
        if after_dist < before_dist:
            score += 1.5
    return score


def _bad_two_for_one(before: Board, move: Move, after: Board) -> bool:
    """Reject 2+ hanging pieces for a single capture unless continuity improved."""
    captured = captured_kind(before, move)
    if captured is None:
        return False
    extra_hang = hanging_ai(after) - hanging_ai(before)
    if extra_hang < 2:
        return False
    if cluster_count(after) > cluster_count(before):
        return False
    if influence(after) > influence(before) + 0.005:
        return False
    return True


def _valid_afters(board: Board) -> list[tuple[Move, Board]]:
    moves = legal_moves(board, BLACK)
    afters = [(m, apply_move(board, m)) for m in moves]
    if not afters:
        return []
    can_two = any(cluster_count(b) >= 2 for _, b in afters)
    if can_two:
        afters = [(m, b) for m, b in afters if cluster_count(b) >= 2]
    kept = [(m, b) for m, b in afters if not _bad_two_for_one(board, m, b)]
    return kept if kept else afters


def _human_replies(board: Board, cap: int) -> list[Move]:
    """Most forcing human replies (captures, then checks), capped."""
    side = board.side
    board.side = 0  # WHITE
    replies = legal_moves(board, 0)
    board.side = side
    if not replies:
        return []

    def force(m: Move) -> tuple[int, int, str]:
        cap_kind = captured_kind(board, m)
        force_n = 0 if cap_kind is None else (10 if cap_kind == KING else 6 if cap_kind == QUEEN else 3)
        nxt = apply_move(board, m)
        check = 1 if nxt.king_square(BLACK) is None else 0
        # Human checking the node is ordinary; still a forcing recapture.
        return (-force_n, -check, m.uci())

    replies = sorted(replies, key=force)
    return replies[: max(0, cap)]


def _lookahead_survivability(board: Board, depth: int, reply_cap: int) -> float:
    base = _leaf_survivability(board)
    if depth <= 1:
        return base
    replies = _human_replies(board, reply_cap)
    if not replies:
        return base
    worst = None
    for rm in replies:
        nxt = apply_move(board, rm)
        if nxt.king_square(0) is None:
            # Human king already gone — not a survivability line we take on purpose.
            score = _leaf_survivability(nxt) - 50.0
        elif depth >= 3:
            # One greedy continuity reply from AI, then leaf.
            cand = _valid_afters(nxt) if nxt.side == BLACK else []
            if cand:
                best_c = max(_leaf_survivability(b) for _, b in cand)
                score = best_c
            else:
                score = _leaf_survivability(nxt)
        else:
            score = _leaf_survivability(nxt)
        if worst is None or score < worst:
            worst = score
    return worst if worst is not None else base


def choose_move(
    board: Board,
    difficulty: str = "steward",
    seed: int = 1,
    nonce: int = 0,
) -> Move | None:
    """Select one legal AI move. None if the AI has no moves (pass)."""
    key = normalize_difficulty(difficulty)
    cfg = DIFFICULTIES[key]
    depth = int(cfg["search"])
    reply_cap = {1: 0, 2: 5, 3: 4}.get(depth, 4)
    afters = _valid_afters(board)
    if not afters:
        return None

    ranked: list[tuple[float, float, int, Move]] = []
    for move, after in afters:
        dec = _decisiveness(board, move, after)
        surv = _lookahead_survivability(after, depth, reply_cap)
        ranked.append((dec, -surv, _tie_key(seed, nonce, move.uci()), move))
    ranked.sort(key=lambda t: (t[0], t[1], t[2]))
    return ranked[0][3]


def rank_moves(
    board: Board,
    difficulty: str = "steward",
    seed: int = 1,
    nonce: int = 0,
) -> list[tuple[Move, float, float]]:
    """Return valid moves as (move, decisiveness, survivability) already sorted."""
    key = normalize_difficulty(difficulty)
    cfg = DIFFICULTIES[key]
    depth = int(cfg["search"])
    reply_cap = {1: 0, 2: 5, 3: 4}.get(depth, 4)
    out: list[tuple[Move, float, float, int]] = []
    for move, after in _valid_afters(board):
        dec = _decisiveness(board, move, after)
        surv = _lookahead_survivability(after, depth, reply_cap)
        out.append((move, dec, surv, _tie_key(seed, nonce, move.uci())))
    out.sort(key=lambda t: (t[1], -t[2], t[3]))
    return [(m, d, s) for m, d, s, _ in out]
