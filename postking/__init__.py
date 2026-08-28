"""Post-King Chess: asymmetric continuity-based game.

One side (the human) is king-bound. The other (the AI) has no king:
a Node that moves like a king but is an ordinary capture. The human
wins only by Continuity Collapse. The AI does not seek victory. The
AI seeks continuity.

Author: Aziel Eliab, August 2026.
License: CC BY 4.0.

Standalone product. Not ForgeReceipts, ZionPattern, DecisionGATE,
AZ-OS, Glossa Filter, or any *Lock.

Motto: The goal is not to win. The goal is to remain.
"""

from __future__ import annotations

__version__ = "0.1.0"
__author__ = "Aziel Eliab"
__license__ = "CC BY 4.0"
__all__ = [
    "__version__",
    "__author__",
    "__license__",
    "Board",
    "Game",
    "DIFFICULTIES",
    "choose_move",
]

from postking.board import Board
from postking.continuity import DIFFICULTIES
from postking.game import Game
from postking.ai import choose_move
