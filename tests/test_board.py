"""Stdlib chess kernel: node, king, castling, check."""

from __future__ import annotations

from postking.board import (
    BLACK,
    KING,
    NODE,
    START_FEN,
    WHITE,
    Board,
    apply_move,
    in_check,
    legal_moves,
    match_uci,
    parse_sq,
)
from postking.continuity import cluster_count, influence


def test_start_fen_has_node_not_black_king() -> None:
    b = Board.start()
    assert b.fen().startswith("rnbqobnr/")
    assert START_FEN.split()[0].startswith("rnbqobnr")
    assert b.king_square(WHITE) == parse_sq("e1")
    assert b.king_square(BLACK) is None
    assert b.node_square() == parse_sq("e8")
    node = b.piece_at(parse_sq("e8"))
    assert node is not None and node.kind == NODE and node.color == BLACK


def test_human_cannot_move_into_check() -> None:
    b = Board.from_fen("k7/8/8/8/8/8/1o6/K7 w - - 0 1")
    ucis = {m.uci() for m in legal_moves(b, WHITE)}
    assert "a1a2" not in ucis  # adjacent to node, still in check
    assert "a1b1" not in ucis  # adjacent to node
    assert "a1b2" in ucis  # capturing the unprotected node gets out of check
    assert in_check(b, WHITE)


def test_human_may_castle_if_legal() -> None:
    b = Board.from_fen("rnbqobnr/pppppppp/8/8/8/8/PPPPPPPP/R3K2R w KQ - 0 1")
    ucis = {m.uci() for m in legal_moves(b, WHITE)}
    assert "e1g1" in ucis
    assert "e1c1" in ucis
    nxt = apply_move(b, match_uci(b, "e1g1"))
    assert nxt.piece_at(parse_sq("g1")).kind == KING
    assert nxt.piece_at(parse_sq("f1")) is not None


def test_ai_cannot_castle() -> None:
    b = Board.from_fen("r3ob2/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR b KQ - 0 1")
    ucis = {m.uci() for m in legal_moves(b, BLACK)}
    assert "e8g8" not in ucis
    assert "e8c8" not in ucis
    # Node still moves like a king by one square.
    assert "e8d8" in ucis or "e8d7" in ucis or "e8e7" in ucis


def test_node_moves_like_king() -> None:
    b = Board.from_fen("4o3/8/8/8/8/8/8/4K3 b - - 0 1")
    ucis = {m.uci() for m in legal_moves(b, BLACK)}
    for dest in ("d8", "d7", "e7", "f7", "f8"):
        assert "e8" + dest in ucis
    assert "e8e6" not in ucis  # not a queen


def test_influence_is_fraction() -> None:
    b = Board.start()
    inf = influence(b)
    assert 0.0 < inf < 1.0
    assert inf > 0.18


def test_starting_pieces_are_one_cluster() -> None:
    assert cluster_count(Board.start()) == 1


def test_match_uci_rejects_illegal() -> None:
    b = Board.start()
    try:
        match_uci(b, "e2e5")
        raise AssertionError("should reject")
    except ValueError as exc:
        assert "illegal" in str(exc).lower() or "bad" in str(exc).lower()
