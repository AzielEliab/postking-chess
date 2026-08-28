"""Stdlib chess kernel for Post-King Chess. Zero runtime deps.

Human (white) has a King. AI (black) has a Node (`o` in FEN) instead of
a king. Node moves like a king; capturing it is ordinary, not terminal.
AI cannot castle. Human may castle if otherwise legal.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Iterator, Optional

WHITE, BLACK = 0, 1
PAWN, KNIGHT, BISHOP, ROOK, QUEEN, KING, NODE = range(7)

KIND_CHARS = {
    PAWN: "P",
    KNIGHT: "N",
    BISHOP: "B",
    ROOK: "R",
    QUEEN: "Q",
    KING: "K",
    NODE: "O",
}
CHAR_KINDS = {v: k for k, v in KIND_CHARS.items()}
CHAR_KINDS["o"] = NODE  # FEN node is lowercase o for black

MATERIAL = {
    PAWN: 1,
    KNIGHT: 3,
    BISHOP: 3,
    ROOK: 5,
    QUEEN: 9,
    KING: 0,
    NODE: 3,
}

START_FEN = "rnbqobnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQ - 0 1"

N, S, E, W = 8, -8, 1, -1
NE, NW, SE, SW = 9, 7, -7, -9
RAYS = {
    BISHOP: (NE, NW, SE, SW),
    ROOK: (N, S, E, W),
    QUEEN: (N, S, E, W, NE, NW, SE, SW),
}
KING_DELTAS = (N, S, E, W, NE, NW, SE, SW)
KNIGHT_DELTAS = (17, 15, 10, 6, -6, -10, -15, -17)


def file_of(sq: int) -> int:
    return sq & 7


def rank_of(sq: int) -> int:
    return sq >> 3


def sq_name(sq: int) -> str:
    return "abcdefgh"[file_of(sq)] + "12345678"[rank_of(sq)]


def parse_sq(name: str) -> int:
    name = name.strip().lower()
    if len(name) != 2 or name[0] not in "abcdefgh" or name[1] not in "12345678":
        raise ValueError(f"bad square: {name}")
    return "abcdefgh".index(name[0]) + 8 * "12345678".index(name[1])


def _on_board(sq: int, delta: int) -> bool:
    nxt = sq + delta
    if nxt < 0 or nxt > 63:
        return False
    df = abs(file_of(nxt) - file_of(sq))
    dr = abs(rank_of(nxt) - rank_of(sq))
    if delta in KNIGHT_DELTAS:
        return (df, dr) in ((1, 2), (2, 1))
    if delta in (E, W):
        return dr == 0 and df == 1
    if delta in (N, S):
        return df == 0 and dr == 1
    if delta in (NE, NW, SE, SW):
        return df == 1 and dr == 1
    return False


@dataclass(frozen=True)
class Piece:
    color: int
    kind: int

    def fen_char(self) -> str:
        ch = KIND_CHARS[self.kind]
        if self.kind == NODE:
            return "O" if self.color == WHITE else "o"
        return ch if self.color == WHITE else ch.lower()


@dataclass(frozen=True)
class Move:
    src: int
    dst: int
    promo: int | None = None
    castle: str | None = None  # "K" or "Q"
    ep: bool = False

    def uci(self) -> str:
        s = sq_name(self.src) + sq_name(self.dst)
        if self.promo is not None:
            s += KIND_CHARS[self.promo].lower()
        return s


def parse_uci(text: str) -> Move:
    raw = text.strip().lower().replace("-", "").replace(" ", "")
    if raw in ("o-o", "00", "0-0"):
        return Move(parse_sq("e1"), parse_sq("g1"), castle="K")
    if raw in ("o-o-o", "000", "0-0-0"):
        return Move(parse_sq("e1"), parse_sq("c1"), castle="Q")
    if len(raw) < 4:
        raise ValueError(f"bad move: {text}")
    src = parse_sq(raw[0:2])
    dst = parse_sq(raw[2:4])
    promo = None
    castle = None
    if len(raw) >= 5 and raw[4] in "qrbn":
        promo = CHAR_KINDS[raw[4].upper()]
    if src == parse_sq("e1") and dst == parse_sq("g1"):
        castle = "K"
    elif src == parse_sq("e1") and dst == parse_sq("c1"):
        castle = "Q"
    return Move(src, dst, promo=promo, castle=castle)


def piece_from_fen(ch: str) -> Piece:
    if ch == "o" or ch == "O":
        return Piece(BLACK if ch == "o" else WHITE, NODE)
    color = WHITE if ch.isupper() else BLACK
    kind = CHAR_KINDS[ch.upper()]
    return Piece(color, kind)


class Board:
    """8x8 mailbox. squares[0] = a1, squares[63] = h8."""

    __slots__ = ("squares", "side", "castling", "ep", "halfmove", "fullmove")

    def __init__(
        self,
        squares: list[Optional[Piece]],
        side: int = WHITE,
        castling: str = "KQ",
        ep: int | None = None,
        halfmove: int = 0,
        fullmove: int = 1,
    ) -> None:
        self.squares = squares
        self.side = side
        self.castling = castling
        self.ep = ep
        self.halfmove = halfmove
        self.fullmove = fullmove

    @classmethod
    def start(cls) -> "Board":
        return cls.from_fen(START_FEN)

    @classmethod
    def from_fen(cls, fen: str) -> "Board":
        parts = fen.strip().split()
        if len(parts) < 1:
            raise ValueError("empty FEN")
        placement = parts[0]
        side = WHITE
        if len(parts) > 1:
            side = WHITE if parts[1] == "w" else BLACK
        castling = parts[2] if len(parts) > 2 and parts[2] != "-" else ""
        # AI cannot castle: drop black rights if present
        castling = "".join(c for c in castling if c in "KQ")
        ep = None
        if len(parts) > 3 and parts[3] != "-":
            ep = parse_sq(parts[3])
        halfmove = int(parts[4]) if len(parts) > 4 else 0
        fullmove = int(parts[5]) if len(parts) > 5 else 1
        squares: list[Optional[Piece]] = [None] * 64
        rank = 7
        file = 0
        for ch in placement:
            if ch == "/":
                rank -= 1
                file = 0
                continue
            if ch.isdigit():
                file += int(ch)
                continue
            squares[file + rank * 8] = piece_from_fen(ch)
            file += 1
        return cls(squares, side, castling, ep, halfmove, fullmove)

    def fen(self) -> str:
        rows = []
        for rank in range(7, -1, -1):
            empty = 0
            row = []
            for file in range(8):
                p = self.squares[file + rank * 8]
                if p is None:
                    empty += 1
                else:
                    if empty:
                        row.append(str(empty))
                        empty = 0
                    row.append(p.fen_char())
            if empty:
                row.append(str(empty))
            rows.append("".join(row))
        placement = "/".join(rows)
        side = "w" if self.side == WHITE else "b"
        castle = self.castling if self.castling else "-"
        ep = sq_name(self.ep) if self.ep is not None else "-"
        return f"{placement} {side} {castle} {ep} {self.halfmove} {self.fullmove}"

    def copy(self) -> "Board":
        b = Board.__new__(Board)
        b.squares = self.squares[:]
        b.side = self.side
        b.castling = self.castling
        b.ep = self.ep
        b.halfmove = self.halfmove
        b.fullmove = self.fullmove
        return b

    def piece_at(self, sq: int) -> Optional[Piece]:
        return self.squares[sq]

    def king_square(self, color: int) -> int | None:
        for i, p in enumerate(self.squares):
            if p is not None and p.color == color and p.kind == KING:
                return i
        return None

    def node_square(self) -> int | None:
        for i, p in enumerate(self.squares):
            if p is not None and p.kind == NODE:
                return i
        return None

    def pieces_of(self, color: int) -> list[tuple[int, Piece]]:
        out = []
        for i, p in enumerate(self.squares):
            if p is not None and p.color == color:
                out.append((i, p))
        return out

    def count_kind(self, color: int, kind: int) -> int:
        n = 0
        for p in self.squares:
            if p is not None and p.color == color and p.kind == kind:
                n += 1
        return n


def _slide(board: Board, sq: int, delta: int) -> Iterator[int]:
    cur = sq
    while _on_board(cur, delta):
        cur = cur + delta
        yield cur
        if board.squares[cur] is not None:
            return


def attacks_from(board: Board, sq: int) -> list[int]:
    p = board.squares[sq]
    if p is None:
        return []
    out: list[int] = []
    kind = p.kind
    if kind == PAWN:
        dir_ = N if p.color == WHITE else S
        for df in (-1, 1):
            dst = sq + dir_ + df
            if 0 <= dst < 64 and abs(file_of(dst) - file_of(sq)) == 1:
                out.append(dst)
        return out
    if kind == KNIGHT:
        for d in KNIGHT_DELTAS:
            if _on_board(sq, d):
                out.append(sq + d)
        return out
    if kind in (KING, NODE):
        for d in KING_DELTAS:
            if _on_board(sq, d):
                out.append(sq + d)
        return out
    rays = RAYS.get(kind, ())
    for d in rays:
        out.extend(_slide(board, sq, d))
    return out


def is_attacked(board: Board, sq: int, by_color: int) -> bool:
    for i, p in enumerate(board.squares):
        if p is None or p.color != by_color:
            continue
        if sq in attacks_from(board, i):
            return True
    return False


def attacked_squares(board: Board, by_color: int) -> list[bool]:
    mask = [False] * 64
    for i, p in enumerate(board.squares):
        if p is None or p.color != by_color:
            continue
        for a in attacks_from(board, i):
            mask[a] = True
    return mask


def _pawn_pushes(board: Board, sq: int, color: int) -> Iterator[int]:
    dir_ = N if color == WHITE else S
    start_rank = 1 if color == WHITE else 6
    one = sq + dir_
    if 0 <= one < 64 and board.squares[one] is None:
        yield one
        two = one + dir_
        if rank_of(sq) == start_rank and 0 <= two < 64 and board.squares[two] is None:
            yield two


def _promos(color: int, src: int, dst: int) -> Iterator[Move]:
    last = 7 if color == WHITE else 0
    if rank_of(dst) == last:
        for k in (QUEEN, ROOK, BISHOP, KNIGHT):
            yield Move(src, dst, promo=k)
    else:
        yield Move(src, dst)


def pseudo_legal(board: Board, color: int) -> list[Move]:
    """Generate moves. Human color still includes moves that leave king in check."""
    moves: list[Move] = []
    for sq, p in board.pieces_of(color):
        if p.kind == PAWN:
            for dst in _pawn_pushes(board, sq, color):
                moves.extend(_promos(color, sq, dst))
            dir_ = N if color == WHITE else S
            for df in (-1, 1):
                dst = sq + dir_ + df
                if not (0 <= dst < 64) or abs(file_of(dst) - file_of(sq)) != 1:
                    continue
                target = board.squares[dst]
                if target is not None and target.color != color:
                    moves.extend(_promos(color, sq, dst))
                elif board.ep is not None and dst == board.ep:
                    moves.append(Move(sq, dst, ep=True))
            continue
        if p.kind == KNIGHT:
            targets = [sq + d for d in KNIGHT_DELTAS if _on_board(sq, d)]
        elif p.kind in (KING, NODE):
            targets = [sq + d for d in KING_DELTAS if _on_board(sq, d)]
        else:
            targets = []
            for d in RAYS[p.kind]:
                targets.extend(_slide(board, sq, d))
        for dst in targets:
            t = board.squares[dst]
            if t is None or t.color != color:
                moves.append(Move(sq, dst))
    if color == WHITE:
        moves.extend(_castling_moves(board))
    moves.sort(key=lambda m: m.uci())
    return moves


def _castling_moves(board: Board) -> list[Move]:
    out: list[Move] = []
    king_sq = parse_sq("e1")
    king = board.squares[king_sq]
    if king is None or king.color != WHITE or king.kind != KING:
        return out
    if is_attacked(board, king_sq, BLACK):
        return out
    if "K" in board.castling:
        # f1, g1 empty; rook on h1; not through check
        f1, g1, h1 = parse_sq("f1"), parse_sq("g1"), parse_sq("h1")
        rook = board.squares[h1]
        if (
            board.squares[f1] is None
            and board.squares[g1] is None
            and rook is not None
            and rook.color == WHITE
            and rook.kind == ROOK
            and not is_attacked(board, f1, BLACK)
            and not is_attacked(board, g1, BLACK)
        ):
            out.append(Move(king_sq, g1, castle="K"))
    if "Q" in board.castling:
        b1, c1, d1, a1 = parse_sq("b1"), parse_sq("c1"), parse_sq("d1"), parse_sq("a1")
        rook = board.squares[a1]
        if (
            board.squares[b1] is None
            and board.squares[c1] is None
            and board.squares[d1] is None
            and rook is not None
            and rook.color == WHITE
            and rook.kind == ROOK
            and not is_attacked(board, d1, BLACK)
            and not is_attacked(board, c1, BLACK)
        ):
            out.append(Move(king_sq, c1, castle="Q"))
    return out


def apply_move(board: Board, move: Move) -> Board:
    b = board.copy()
    piece = b.squares[move.src]
    if piece is None:
        raise ValueError(f"no piece at {sq_name(move.src)}")
    captured = b.squares[move.dst]
    reset_half = piece.kind == PAWN or captured is not None or move.ep
    if move.ep:
        # captured pawn sits behind the destination
        cap_sq = move.dst + (S if piece.color == WHITE else N)
        b.squares[cap_sq] = None
        captured = Piece(1 - piece.color, PAWN)
        reset_half = True
    b.squares[move.dst] = piece
    b.squares[move.src] = None
    if move.promo is not None:
        b.squares[move.dst] = Piece(piece.color, move.promo)
    if move.castle == "K":
        b.squares[parse_sq("h1")] = None
        b.squares[parse_sq("f1")] = Piece(WHITE, ROOK)
        b.squares[parse_sq("g1")] = Piece(WHITE, KING)
    elif move.castle == "Q":
        b.squares[parse_sq("a1")] = None
        b.squares[parse_sq("d1")] = Piece(WHITE, ROOK)
        b.squares[parse_sq("c1")] = Piece(WHITE, KING)
    # castling rights
    rights = list(b.castling)
    if piece.kind == KING and piece.color == WHITE:
        rights = [c for c in rights if c not in "KQ"]
    if move.src == parse_sq("h1") or move.dst == parse_sq("h1"):
        rights = [c for c in rights if c != "K"]
    if move.src == parse_sq("a1") or move.dst == parse_sq("a1"):
        rights = [c for c in rights if c != "Q"]
    b.castling = "".join(rights)
    # en passant target
    b.ep = None
    if piece.kind == PAWN and abs(move.dst - move.src) == 16:
        b.ep = (move.src + move.dst) // 2
    if reset_half:
        b.halfmove = 0
    else:
        b.halfmove += 1
    if piece.color == BLACK:
        b.fullmove += 1
    b.side = 1 - piece.color
    return b


def in_check(board: Board, color: int) -> bool:
    k = board.king_square(color)
    if k is None:
        return True
    return is_attacked(board, k, 1 - color)


def legal_moves(board: Board, color: int | None = None) -> list[Move]:
    color = board.side if color is None else color
    raw = pseudo_legal(board, color)
    if color == BLACK:
        # AI: no check condition. May move into attack. May capture the king.
        return raw
    # Human: may not leave own king in check.
    out: list[Move] = []
    for m in raw:
        nxt = apply_move(board, m)
        if nxt.king_square(WHITE) is None:
            continue
        if not in_check(nxt, WHITE):
            out.append(m)
    return out


def match_uci(board: Board, text: str) -> Move:
    want = parse_uci(text)
    for m in legal_moves(board):
        if m.src == want.src and m.dst == want.dst:
            if want.promo is None or m.promo == want.promo:
                if want.promo is None and m.promo is not None:
                    # default queen promotion if omitted
                    if m.promo == QUEEN:
                        return m
                    continue
                return m
    raise ValueError(f"illegal move: {text}")


def material_of(board: Board, color: int) -> int:
    total = 0
    for _, p in board.pieces_of(color):
        total += MATERIAL[p.kind]
    return total


def captured_kind(before: Board, move: Move) -> int | None:
    if move.ep:
        return PAWN
    t = before.squares[move.dst]
    return None if t is None else t.kind
