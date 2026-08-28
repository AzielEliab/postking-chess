/// Tiny Dart chess for Post-King. Human (white) has a King; AI (black)
/// has a Node (`o`) that moves like a king. Capturing the Node is ordinary.
///
/// Subset (documented): no en passant, queen-only promotion, no 50-move or
/// threefold, white may castle, black cannot. Check applies to white only.
const white = 0;
const black = 1;
const pawn = 0;
const knight = 1;
const bishop = 2;
const rook = 3;
const queen = 4;
const king = 5;
const node = 6;

const startFen = 'rnbqobnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQ - 0 1';

const n = 8, s = -8, e = 1, w = -1;
const ne = 9, nw = 7, se = -7, sw = -9;
const kingDeltas = [n, s, e, w, ne, nw, se, sw];
const knightDeltas = [17, 15, 10, 6, -6, -10, -15, -17];
const rays = {
  bishop: [ne, nw, se, sw],
  rook: [n, s, e, w],
  queen: [n, s, e, w, ne, nw, se, sw],
};

int fileOf(int sq) => sq & 7;
int rankOf(int sq) => sq >> 3;

String sqName(int sq) => 'abcdefgh'[fileOf(sq)] + '12345678'[rankOf(sq)];

int parseSq(String name) {
  final t = name.trim().toLowerCase();
  if (t.length != 2) {
    throw ArgumentError('bad square: $name');
  }
  final f = 'abcdefgh'.indexOf(t[0]);
  final r = '12345678'.indexOf(t[1]);
  if (f < 0 || r < 0) throw ArgumentError('bad square: $name');
  return f + 8 * r;
}

bool onBoard(int sq, int delta) {
  final nxt = sq + delta;
  if (nxt < 0 || nxt > 63) return false;
  final df = (fileOf(nxt) - fileOf(sq)).abs();
  final dr = (rankOf(nxt) - rankOf(sq)).abs();
  if (knightDeltas.contains(delta)) return (df == 1 && dr == 2) || (df == 2 && dr == 1);
  if (delta == e || delta == w) return dr == 0 && df == 1;
  if (delta == n || delta == s) return df == 0 && dr == 1;
  if (delta == ne || delta == nw || delta == se || delta == sw) {
    return df == 1 && dr == 1;
  }
  return false;
}

class Piece {
  const Piece(this.color, this.kind);
  final int color;
  final int kind;

  String get glyph {
    if (kind == node) return color == white ? '⬡' : '○';
    const whiteSet = ['♙', '♘', '♗', '♖', '♕', '♔', '♚'];
    const blackPieces = ['♟', '♞', '♝', '♜', '♛', '♚', '○'];
    return (color == white ? whiteSet : blackPieces)[kind];
  }

  String get fenChar {
    const chars = ['P', 'N', 'B', 'R', 'Q', 'K', 'O'];
    final ch = chars[kind];
    if (kind == node) return color == white ? 'O' : 'o';
    return color == white ? ch : ch.toLowerCase();
  }
}

class Move {
  const Move(this.src, this.dst, {this.promo, this.castle});
  final int src;
  final int dst;
  final int? promo;
  final String? castle;

  String get uci {
    var s = sqName(src) + sqName(dst);
    if (promo != null) {
      s += ['p', 'n', 'b', 'r', 'q', 'k', 'o'][promo!];
    }
    return s;
  }
}

Piece? pieceFromFen(String ch) {
  if (ch == 'o' || ch == 'O') {
    return Piece(ch == 'o' ? black : white, node);
  }
  const map = {
    'P': pawn,
    'N': knight,
    'B': bishop,
    'R': rook,
    'Q': queen,
    'K': king,
  };
  final kind = map[ch.toUpperCase()];
  if (kind == null) return null;
  return Piece(ch == ch.toUpperCase() ? white : black, kind);
}

class Board {
  Board({
    required this.squares,
    this.side = white,
    this.castling = 'KQ',
  });

  List<Piece?> squares;
  int side;
  String castling;

  factory Board.start() => Board.fromFen(startFen);

  factory Board.fromFen(String fen) {
    final parts = fen.trim().split(RegExp(r'\s+'));
    final placement = parts[0];
    final side = parts.length > 1 && parts[1] == 'b' ? black : white;
    var castling = parts.length > 2 && parts[2] != '-' ? parts[2] : '';
    castling = castling.split('').where((c) => c == 'K' || c == 'Q').join();
    final squares = List<Piece?>.filled(64, null);
    var rank = 7;
    var file = 0;
    for (final ch in placement.split('')) {
      if (ch == '/') {
        rank -= 1;
        file = 0;
        continue;
      }
      final d = int.tryParse(ch);
      if (d != null) {
        file += d;
        continue;
      }
      squares[file + rank * 8] = pieceFromFen(ch);
      file += 1;
    }
    return Board(squares: squares, side: side, castling: castling);
  }

  Board copy() => Board(
        squares: List<Piece?>.from(squares),
        side: side,
        castling: castling,
      );

  int? kingSquare(int color) {
    for (var i = 0; i < 64; i++) {
      final p = squares[i];
      if (p != null && p.color == color && p.kind == king) return i;
    }
    return null;
  }

  Iterable<(int, Piece)> piecesOf(int color) sync* {
    for (var i = 0; i < 64; i++) {
      final p = squares[i];
      if (p != null && p.color == color) yield (i, p);
    }
  }
}

Iterable<int> _slide(Board board, int sq, int delta) sync* {
  var cur = sq;
  while (onBoard(cur, delta)) {
    cur = cur + delta;
    yield cur;
    if (board.squares[cur] != null) return;
  }
}

List<int> attacksFrom(Board board, int sq) {
  final p = board.squares[sq];
  if (p == null) return [];
  final out = <int>[];
  if (p.kind == pawn) {
    final dir = p.color == white ? n : s;
    for (final df in [-1, 1]) {
      final dst = sq + dir + df;
      if (dst >= 0 && dst < 64 && (fileOf(dst) - fileOf(sq)).abs() == 1) {
        out.add(dst);
      }
    }
    return out;
  }
  if (p.kind == knight) {
    for (final d in knightDeltas) {
      if (onBoard(sq, d)) out.add(sq + d);
    }
    return out;
  }
  if (p.kind == king || p.kind == node) {
    for (final d in kingDeltas) {
      if (onBoard(sq, d)) out.add(sq + d);
    }
    return out;
  }
  for (final d in rays[p.kind] ?? const <int>[]) {
    out.addAll(_slide(board, sq, d));
  }
  return out;
}

bool isAttacked(Board board, int sq, int byColor) {
  for (var i = 0; i < 64; i++) {
    final p = board.squares[i];
    if (p == null || p.color != byColor) continue;
    if (attacksFrom(board, i).contains(sq)) return true;
  }
  return false;
}

List<bool> attackedMask(Board board, int byColor) {
  final mask = List<bool>.filled(64, false);
  for (var i = 0; i < 64; i++) {
    final p = board.squares[i];
    if (p == null || p.color != byColor) continue;
    for (final a in attacksFrom(board, i)) {
      mask[a] = true;
    }
  }
  return mask;
}

bool inCheck(Board board, int color) {
  final k = board.kingSquare(color);
  if (k == null) return false;
  return isAttacked(board, k, 1 - color);
}

List<Move> _castling(Board board) {
  final out = <Move>[];
  final kingSq = parseSq('e1');
  final k = board.squares[kingSq];
  if (k == null || k.color != white || k.kind != king) return out;
  if (isAttacked(board, kingSq, black)) return out;
  if (board.castling.contains('K')) {
    final f1 = parseSq('f1');
    final g1 = parseSq('g1');
    final h1 = parseSq('h1');
    final rook = board.squares[h1];
    if (board.squares[f1] == null &&
        board.squares[g1] == null &&
        rook != null &&
        rook.color == white &&
        rook.kind == 3 &&
        !isAttacked(board, f1, black) &&
        !isAttacked(board, g1, black)) {
      out.add(Move(kingSq, g1, castle: 'K'));
    }
  }
  if (board.castling.contains('Q')) {
    final b1 = parseSq('b1');
    final c1 = parseSq('c1');
    final d1 = parseSq('d1');
    final a1 = parseSq('a1');
    final rookP = board.squares[a1];
    if (board.squares[b1] == null &&
        board.squares[c1] == null &&
        board.squares[d1] == null &&
        rookP != null &&
        rookP.color == white &&
        rookP.kind == 3 &&
        !isAttacked(board, d1, black) &&
        !isAttacked(board, c1, black)) {
      out.add(Move(kingSq, c1, castle: 'Q'));
    }
  }
  return out;
}

List<Move> pseudoLegal(Board board, int color) {
  final moves = <Move>[];
  for (final (sq, p) in board.piecesOf(color)) {
    if (p.kind == pawn) {
      final dir = color == white ? n : s;
      final startRank = color == white ? 1 : 6;
      final last = color == white ? 7 : 0;
      final one = sq + dir;
      if (one >= 0 && one < 64 && board.squares[one] == null) {
        if (rankOf(one) == last) {
          moves.add(Move(sq, one, promo: queen));
        } else {
          moves.add(Move(sq, one));
          final two = one + dir;
          if (rankOf(sq) == startRank &&
              two >= 0 &&
              two < 64 &&
              board.squares[two] == null) {
            moves.add(Move(sq, two));
          }
        }
      }
      for (final df in [-1, 1]) {
        final dst = sq + dir + df;
        if (dst < 0 || dst > 63 || (fileOf(dst) - fileOf(sq)).abs() != 1) {
          continue;
        }
        final t = board.squares[dst];
        if (t != null && t.color != color) {
          if (rankOf(dst) == last) {
            moves.add(Move(sq, dst, promo: queen));
          } else {
            moves.add(Move(sq, dst));
          }
        }
      }
      continue;
    }
    List<int> targets;
    if (p.kind == knight) {
      targets = [for (final d in knightDeltas) if (onBoard(sq, d)) sq + d];
    } else if (p.kind == king || p.kind == node) {
      targets = [for (final d in kingDeltas) if (onBoard(sq, d)) sq + d];
    } else {
      targets = [for (final d in rays[p.kind] ?? const <int>[]) ..._slide(board, sq, d)];
    }
    for (final dst in targets) {
      final t = board.squares[dst];
      if (t == null || t.color != color) moves.add(Move(sq, dst));
    }
  }
  if (color == white) moves.addAll(_castling(board));
  moves.sort((a, b) => a.uci.compareTo(b.uci));
  return moves;
}

Board applyMove(Board board, Move move) {
  final b = board.copy();
  final piece = b.squares[move.src];
  if (piece == null) {
    throw StateError('no piece at ${sqName(move.src)}');
  }
  b.squares[move.dst] = piece;
  b.squares[move.src] = null;
  if (move.promo != null) {
    b.squares[move.dst] = Piece(piece.color, move.promo!);
  }
  if (move.castle == 'K') {
    b.squares[parseSq('h1')] = null;
    b.squares[parseSq('f1')] = const Piece(white, rook);
    b.squares[parseSq('g1')] = const Piece(white, king);
  } else if (move.castle == 'Q') {
    b.squares[parseSq('a1')] = null;
    b.squares[parseSq('d1')] = const Piece(white, rook);
    b.squares[parseSq('c1')] = const Piece(white, king);
  }
  var rights = b.castling.split('');
  if (piece.kind == king && piece.color == white) {
    rights = rights.where((c) => c != 'K' && c != 'Q').toList();
  }
  if (move.src == parseSq('h1') || move.dst == parseSq('h1')) {
    rights = rights.where((c) => c != 'K').toList();
  }
  if (move.src == parseSq('a1') || move.dst == parseSq('a1')) {
    rights = rights.where((c) => c != 'Q').toList();
  }
  b.castling = rights.join();
  b.side = 1 - board.side;
  return b;
}

List<Move> legalMoves(Board board, [int? color]) {
  final c = color ?? board.side;
  final raw = pseudoLegal(board, c);
  if (c != white) return raw;
  final out = <Move>[];
  for (final m in raw) {
    final next = applyMove(board, m);
    if (!inCheck(next, white)) out.add(m);
  }
  return out;
}

int clusterCount(Board board) {
  final seen = List<bool>.filled(64, false);
  var count = 0;
  for (var i = 0; i < 64; i++) {
    final p = board.squares[i];
    if (p == null || p.color != black || seen[i]) continue;
    count += 1;
    final q = <int>[i];
    seen[i] = true;
    while (q.isNotEmpty) {
      final cur = q.removeLast();
      for (final d in kingDeltas) {
        if (!onBoard(cur, d)) continue;
        final nxt = cur + d;
        if (seen[nxt]) continue;
        final np = board.squares[nxt];
        if (np != null && np.color == black) {
          seen[nxt] = true;
          q.add(nxt);
        }
      }
    }
  }
  return count;
}

double influence(Board board) {
  final mask = attackedMask(board, black);
  var nHit = 0;
  for (final v in mask) {
    if (v) nHit++;
  }
  return nHit / 64.0;
}

class Difficulty {
  const Difficulty(this.id, this.label, this.n, this.m, this.threshold);
  final String id;
  final String label;
  final int n;
  final int m;
  final double threshold;
}

const difficulties = {
  'witness': Difficulty('witness', 'Witness', 2, 1, 0.18),
  'steward': Difficulty('steward', 'Steward', 3, 2, 0.12),
  'remain': Difficulty('remain', 'Remain', 5, 3, 0.08),
};

class Game {
  Game({
    required this.board,
    this.difficulty = 'steward',
    this.lowInfluenceStreak = 0,
    this.result,
    this.resultReason,
    List<String>? history,
  }) : history = history ?? [];

  Board board;
  String difficulty;
  int lowInfluenceStreak;
  String? result;
  String? resultReason;
  List<String> history;

  factory Game.newGame({String difficulty = 'steward'}) =>
      Game(board: Board.start(), difficulty: difficulty);

  Difficulty get cfg => difficulties[difficulty] ?? difficulties['steward']!;

  bool get gameOver => result != null;

  void _terminal({required bool fullTurn}) {
    if (result != null) return;
    if (board.kingSquare(white) == null) {
      result = 'ai';
      resultReason = 'Human king captured.';
      return;
    }
    if (board.side == white &&
        legalMoves(board, white).isEmpty &&
        inCheck(board, white)) {
      result = 'ai';
      resultReason = 'Checkmate.';
      return;
    }
    if (!fullTurn) return;
    final clusters = clusterCount(board);
    final inf = influence(board);
    if (inf < cfg.threshold) {
      lowInfluenceStreak += 1;
    } else {
      lowInfluenceStreak = 0;
    }
    var canRestore = false;
    if (clusters < 2) {
      for (final m in legalMoves(board, black)) {
        final nxt = applyMove(board, m);
        if (clusterCount(nxt) >= 2) {
          canRestore = true;
          break;
        }
      }
    }
    // Simplified collapse: clusters < 2, streak >= N, and no single AI
    // move restores >=2 clusters (M-ply search omitted; see README).
    if (clusters < 2 && lowInfluenceStreak >= cfg.n && !canRestore) {
      result = 'human';
      resultReason = 'Continuity Collapse.';
    }
  }

  String? playHuman(int src, int dst) {
    if (gameOver) return 'game over';
    if (board.side != white) return 'not your turn';
    final legal = legalMoves(board, white);
    Move? chosen;
    for (final m in legal) {
      if (m.src == src && m.dst == dst) {
        chosen = m;
        break;
      }
    }
    if (chosen == null) return 'illegal';
    board = applyMove(board, chosen);
    history.add(chosen.uci);
    _terminal(fullTurn: false);
    if (!gameOver) playAi();
    return null;
  }

  void playAi() {
    if (gameOver || board.side != black) return;
    final moves = legalMoves(board, black);
    if (moves.isEmpty) {
      result = 'human';
      resultReason = 'AI has no legal move; treated as collapse.';
      return;
    }
    // Continuity-seeking: maximize clusters, then influence, then UCI.
    // Does not hunt the king as a primary eval.
    Move? best;
    var bestKey = (-999, -1.0, '');
    for (final m in moves) {
      final nxt = applyMove(board, m);
      final key = (clusterCount(nxt), influence(nxt), m.uci);
      if (best == null ||
          key.$1 > bestKey.$1 ||
          (key.$1 == bestKey.$1 && key.$2 > bestKey.$2) ||
          (key.$1 == bestKey.$1 &&
              key.$2 == bestKey.$2 &&
              key.$3.compareTo(bestKey.$3) < 0)) {
        best = m;
        bestKey = key;
      }
    }
    board = applyMove(board, best!);
    history.add(best.uci);
    _terminal(fullTurn: true);
  }
}
