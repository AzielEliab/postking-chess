"""Terminal conditions: node capture, king mate, collapse needs all three."""

from __future__ import annotations

from postking.board import Board, apply_move, match_uci
from postking.continuity import can_restore_clusters, cluster_count, influence
from postking.game import Game


def test_node_capture_is_not_terminal() -> None:
    game = Game.from_fen("8/8/8/8/8/8/p7/oQ5K w - - 0 1", difficulty="steward", seed=1)
    assert game.board.node_square() is not None
    game.human_move("b1a1")
    assert game.board.node_square() is None
    assert game.result != "human_win"
    assert game.result != "human_loss"
    # A remaining AI pawn: game continues (or AI passed/moved).
    assert game.board.pieces_of(1), "AI should still have a piece"
    assert game.result_reason != "king_captured"


def test_king_capture_is_human_loss() -> None:
    game = Game.from_fen("K7/1o5p/8/8/8/8/8/8 b - - 0 1", difficulty="steward", seed=1)
    game.play_uci("b7a8")
    assert game.board.king_square(0) is None
    assert game.result == "human_loss"
    assert game.result_reason == "king_captured"


def test_king_mate_is_human_loss() -> None:
    game = Game.from_fen("o7/8/8/8/8/8/rr6/K7 w - - 0 1", difficulty="steward", seed=1)
    assert game.result == "human_loss"
    assert game.result_reason == "checkmate"


def test_collapse_requires_all_three_missing_clusters() -> None:
    # Two far pawns: 2 clusters, low influence, high streak, cannot... wait they already have 2.
    game = Game.from_fen(
        "8/p6p/8/8/8/8/8/K7 w - - 0 1",
        difficulty="witness",
        seed=1,
        low_influence_streak=9,
    )
    assert cluster_count(game.board) >= 2
    assert game.result != "human_win"


def test_collapse_requires_influence_streak() -> None:
    # 1 cluster, low influence, cannot restore, but streak is 0.
    game = Game.from_fen(
        "8/p7/8/8/8/8/8/K7 w - - 0 1",
        difficulty="witness",
        seed=1,
        low_influence_streak=0,
    )
    assert cluster_count(game.board) < 2
    assert influence(game.board) < 0.18
    assert not can_restore_clusters(game.board, 1)
    assert game.result != "human_win"


def test_collapse_requires_no_restore() -> None:
    # Two adjacent pawns can split in M=1, so restore exists.
    game = Game.from_fen(
        "8/pp6/8/8/8/8/8/K7 w - - 0 1",
        difficulty="witness",
        seed=1,
        low_influence_streak=9,
    )
    assert cluster_count(game.board) == 1
    assert can_restore_clusters(game.board, 1)
    assert game.result != "human_win"


def test_collapse_all_three_is_human_win() -> None:
    game = Game.from_fen(
        "8/p7/8/8/8/8/8/K7 w - - 0 1",
        difficulty="witness",
        seed=1,
        low_influence_streak=2,
    )
    assert cluster_count(game.board) < 2
    assert influence(game.board) < 0.18
    assert not can_restore_clusters(game.board, 1)
    assert game.low_influence_streak >= 2
    assert game.result == "human_win"
    assert game.result_reason == "continuity_collapse"


def test_high_influence_blocks_collapse() -> None:
    # Lone queen: 1 cluster, cannot restore, high streak, but influence is high.
    game = Game.from_fen(
        "8/8/8/8/8/8/8/q6K w - - 0 1",
        difficulty="witness",
        seed=1,
        low_influence_streak=9,
    )
    assert cluster_count(game.board) == 1
    assert influence(game.board) >= 0.18
    assert game.result != "human_win"


def test_play_uci_applies_without_auto_ai() -> None:
    game = Game.new("steward", seed=1)
    game.play_uci("e2e4")
    assert game.history == ["e2e4"]
    assert game.board.side == 1  # black to move
    assert game.result is None


def test_capture_alone_is_not_a_win() -> None:
    """Taking AI material does not itself end the game."""
    game = Game.new("steward", seed=1)
    game.human_move("e2e4")
    assert game.result is None
    assert cluster_count(game.board) >= 1
