"""AI constraints: two clusters, seed stability, difficulties."""

from __future__ import annotations

from postking.ai import choose_move
from postking.board import Board, apply_move
from postking.continuity import DIFFICULTIES, cluster_count, normalize_difficulty
from postking.game import Game


def test_ai_prefers_two_clusters() -> None:
    # Node a1 + pawn a2: 1 cluster. Pawn pushes split; node slides stay connected.
    board = Board.from_fen("o7/p7/8/8/8/8/8/4K3 b - - 0 1")
    assert cluster_count(board) == 1
    move = choose_move(board, difficulty="steward", seed=1, nonce=0)
    assert move is not None
    after = apply_move(board, move)
    assert cluster_count(after) >= 2


def test_same_seed_same_reply() -> None:
    a = Game.new("steward", seed=1)
    b = Game.new("steward", seed=1)
    a.human_move("e2e4")
    b.human_move("e2e4")
    assert a.history == b.history
    assert a.history[-1] == b.history[-1]
    assert a.board.fen() == b.board.fen()


def test_three_difficulties_witness() -> None:
    cfg = DIFFICULTIES[normalize_difficulty("witness")]
    assert cfg["n"] == 2 and cfg["m"] == 1 and cfg["threshold"] == 0.18
    game = Game.new("witness", seed=1)
    assert game.cfg["search"] == 1
    game.human_move("e2e4")
    assert game.history[0] == "e2e4"
    assert game.result is None


def test_three_difficulties_steward() -> None:
    cfg = DIFFICULTIES[normalize_difficulty("steward")]
    assert cfg["n"] == 3 and cfg["m"] == 2 and cfg["threshold"] == 0.12
    game = Game.new("steward", seed=7)
    game.human_move("d2d4")
    assert len(game.history) >= 2


def test_three_difficulties_remain() -> None:
    cfg = DIFFICULTIES[normalize_difficulty("remain")]
    assert cfg["n"] == 5 and cfg["m"] == 3 and cfg["threshold"] == 0.08
    game = Game.new("remain", seed=3)
    assert game.cfg["label"] == "Remain"
    game.human_move("c2c4")
    assert game.difficulty == "remain"


def test_unknown_difficulty_rejected() -> None:
    try:
        normalize_difficulty("apocalypse")
        raise AssertionError("should reject")
    except ValueError:
        pass
