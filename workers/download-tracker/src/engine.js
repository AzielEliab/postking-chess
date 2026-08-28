/**
 * Post-King Chess runtime subset (Worker port).
 *
 * Human (white) is king-bound. AI (black) has a Node (`o`), not a king.
 * Capturing the Node is ordinary, not terminal. The AI does not seek
 * victory; it seeks continuity.
 *
 * Motto: The goal is not to win. The goal is to remain.
 *
 * SUBSET vs full Python package:
 * - Legal-move generation, apply, FEN, castling, en passant, promotions: ported.
 * - Continuity clusters / influence / greedy restore / collapse: ported.
 * - AI reply is 1-ply: lowest decisiveness, then highest leaf survivability,
 *   SHA-256(seed|nonce|uci) tie-break. Witness/Steward/Remain search depths
 *   1/2/3 from the Python client are NOT run here (Worker CPU). Collapse
 *   patience N/M/threshold still follow difficulty.
 */
export const MOTTO = "The goal is not to win. The goal is to remain.";
export const START_FEN = "rnbqobnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQ - 0 1";

export const WHITE = 0;
export const BLACK = 1;
export const PAWN = 0;
export const KNIGHT = 1;
export const BISHOP = 2;
export const ROOK = 3;
export const QUEEN = 4;
export const KING = 5;
export const NODE = 6;

const KIND_CHARS = { 0: "P", 1: "N", 2: "B", 3: "R", 4: "Q", 5: "K", 6: "O" };
const CHAR_KINDS = { P: 0, N: 1, B: 2, R: 3, Q: 4, K: 5, O: 6, o: 6 };
const MATERIAL = { 0: 1, 1: 3, 2: 3, 3: 5, 4: 9, 5: 0, 6: 3 };

const N = 8, S = -8, E = 1, W = -1;
const NE = 9, NW = 7, SE = -7, SW = -9;
const RAYS = {
  2: [NE, NW, SE, SW],
  3: [N, S, E, W],
  4: [N, S, E, W, NE, NW, SE, SW],
};
const KING_DELTAS = [N, S, E, W, NE, NW, SE, SW];
const KNIGHT_DELTAS = [17, 15, 10, 6, -6, -10, -15, -17];

export const DIFFICULTIES = {
  witness: { label: "Witness", n: 2, m: 1, threshold: 0.18, search: 1, blurb: "Shallower search. Collapse patience N=2 M=1. Influence 0.18." },
  steward: { label: "Steward", n: 3, m: 2, threshold: 0.12, search: 2, blurb: "Default. Collapse patience N=3 M=2. Influence 0.12. Worker AI is 1-ply." },
  remain: { label: "Remain", n: 5, m: 3, threshold: 0.08, search: 3, blurb: "Deeper search in Python. Worker AI is 1-ply. Collapse patience N=5 M=3." },
};

export function normalizeDifficulty(name) {
  const key = String(name || "steward").trim().toLowerCase();
  if (!DIFFICULTIES[key]) throw new Error(`unknown difficulty: ${name} (witness|steward|remain)`);
  return key;
}

function fileOf(sq) { return sq & 7; }
function rankOf(sq) { return sq >> 3; }
export function sqName(sq) { return "abcdefgh"[fileOf(sq)] + "12345678"[rankOf(sq)]; }
export function parseSq(name) {
  const n = String(name).trim().toLowerCase();
  if (n.length !== 2 || !"abcdefgh".includes(n[0]) || !"12345678".includes(n[1])) {
    throw new Error(`bad square: ${name}`);
  }
  return "abcdefgh".indexOf(n[0]) + 8 * "12345678".indexOf(n[1]);
}

function onBoard(sq, delta) {
  const nxt = sq + delta;
  if (nxt < 0 || nxt > 63) return false;
  const df = Math.abs(fileOf(nxt) - fileOf(sq));
  const dr = Math.abs(rankOf(nxt) - rankOf(sq));
  if (KNIGHT_DELTAS.includes(delta)) return (df === 1 && dr === 2) || (df === 2 && dr === 1);
  if (delta === E || delta === W) return dr === 0 && df === 1;
  if (delta === N || delta === S) return df === 0 && dr === 1;
  if (delta === NE || delta === NW || delta === SE || delta === SW) return df === 1 && dr === 1;
  return false;
}

function pieceFromFen(ch) {
  if (ch === "o" || ch === "O") return { color: ch === "o" ? BLACK : WHITE, kind: NODE };
  const color = ch === ch.toUpperCase() ? WHITE : BLACK;
  return { color, kind: CHAR_KINDS[ch.toUpperCase()] };
}

function fenChar(p) {
  const ch = KIND_CHARS[p.kind];
  if (p.kind === NODE) return p.color === WHITE ? "O" : "o";
  return p.color === WHITE ? ch : ch.toLowerCase();
}

export class Board {
  constructor(squares, side = WHITE, castling = "KQ", ep = null, halfmove = 0, fullmove = 1) {
    this.squares = squares;
    this.side = side;
    this.castling = castling;
    this.ep = ep;
    this.halfmove = halfmove;
    this.fullmove = fullmove;
  }

  static start() { return Board.fromFen(START_FEN); }

  static fromFen(fen) {
    const parts = String(fen).trim().split(/\s+/);
    if (!parts[0]) throw new Error("empty FEN");
    const placement = parts[0];
    const side = parts[1] === "b" ? BLACK : WHITE;
    let castling = parts[2] && parts[2] !== "-" ? parts[2] : "";
    castling = [...castling].filter((c) => c === "K" || c === "Q").join("");
    let ep = null;
    if (parts[3] && parts[3] !== "-") ep = parseSq(parts[3]);
    const halfmove = parts[4] ? parseInt(parts[4], 10) : 0;
    const fullmove = parts[5] ? parseInt(parts[5], 10) : 1;
    const squares = Array(64).fill(null);
    let rank = 7, file = 0;
    for (const ch of placement) {
      if (ch === "/") { rank -= 1; file = 0; continue; }
      if (ch >= "1" && ch <= "8") { file += parseInt(ch, 10); continue; }
      squares[file + rank * 8] = pieceFromFen(ch);
      file += 1;
    }
    return new Board(squares, side, castling, ep, halfmove, fullmove);
  }

  fen() {
    const rows = [];
    for (let rank = 7; rank >= 0; rank--) {
      let empty = 0;
      let row = "";
      for (let file = 0; file < 8; file++) {
        const p = this.squares[file + rank * 8];
        if (!p) empty += 1;
        else {
          if (empty) { row += String(empty); empty = 0; }
          row += fenChar(p);
        }
      }
      if (empty) row += String(empty);
      rows.push(row);
    }
    const side = this.side === WHITE ? "w" : "b";
    const castle = this.castling || "-";
    const ep = this.ep != null ? sqName(this.ep) : "-";
    return `${rows.join("/")} ${side} ${castle} ${ep} ${this.halfmove} ${this.fullmove}`;
  }

  copy() {
    return new Board(this.squares.slice(), this.side, this.castling, this.ep, this.halfmove, this.fullmove);
  }

  kingSquare(color) {
    for (let i = 0; i < 64; i++) {
      const p = this.squares[i];
      if (p && p.color === color && p.kind === KING) return i;
    }
    return null;
  }

  piecesOf(color) {
    const out = [];
    for (let i = 0; i < 64; i++) {
      const p = this.squares[i];
      if (p && p.color === color) out.push([i, p]);
    }
    return out;
  }
}

function slide(board, sq, delta) {
  const out = [];
  let cur = sq;
  while (onBoard(cur, delta)) {
    cur = cur + delta;
    out.push(cur);
    if (board.squares[cur]) break;
  }
  return out;
}

export function attacksFrom(board, sq) {
  const p = board.squares[sq];
  if (!p) return [];
  const out = [];
  if (p.kind === PAWN) {
    const dir = p.color === WHITE ? N : S;
    for (const df of [-1, 1]) {
      const dst = sq + dir + df;
      if (dst >= 0 && dst < 64 && Math.abs(fileOf(dst) - fileOf(sq)) === 1) out.push(dst);
    }
    return out;
  }
  if (p.kind === KNIGHT) {
    for (const d of KNIGHT_DELTAS) if (onBoard(sq, d)) out.push(sq + d);
    return out;
  }
  if (p.kind === KING || p.kind === NODE) {
    for (const d of KING_DELTAS) if (onBoard(sq, d)) out.push(sq + d);
    return out;
  }
  for (const d of RAYS[p.kind] || []) out.push(...slide(board, sq, d));
  return out;
}

export function isAttacked(board, sq, byColor) {
  for (let i = 0; i < 64; i++) {
    const p = board.squares[i];
    if (!p || p.color !== byColor) continue;
    if (attacksFrom(board, i).includes(sq)) return true;
  }
  return false;
}

function attackedSquares(board, byColor) {
  const mask = Array(64).fill(false);
  for (let i = 0; i < 64; i++) {
    const p = board.squares[i];
    if (!p || p.color !== byColor) continue;
    for (const a of attacksFrom(board, i)) mask[a] = true;
  }
  return mask;
}

function pawnPushes(board, sq, color) {
  const dir = color === WHITE ? N : S;
  const startRank = color === WHITE ? 1 : 6;
  const out = [];
  const one = sq + dir;
  if (one >= 0 && one < 64 && !board.squares[one]) {
    out.push(one);
    const two = one + dir;
    if (rankOf(sq) === startRank && two >= 0 && two < 64 && !board.squares[two]) out.push(two);
  }
  return out;
}

function promos(color, src, dst) {
  const last = color === WHITE ? 7 : 0;
  if (rankOf(dst) === last) {
    return [QUEEN, ROOK, BISHOP, KNIGHT].map((k) => ({ src, dst, promo: k, castle: null, ep: false }));
  }
  return [{ src, dst, promo: null, castle: null, ep: false }];
}

export function moveUci(m) {
  let s = sqName(m.src) + sqName(m.dst);
  if (m.promo != null) s += KIND_CHARS[m.promo].toLowerCase();
  return s;
}

export function parseUci(text) {
  const raw = String(text).trim().toLowerCase().replace(/[-\s]/g, "");
  if (raw === "oo" || raw === "00" || raw === "0-0") {
    return { src: parseSq("e1"), dst: parseSq("g1"), promo: null, castle: "K", ep: false };
  }
  if (raw === "ooo" || raw === "000") {
    return { src: parseSq("e1"), dst: parseSq("c1"), promo: null, castle: "Q", ep: false };
  }
  if (raw.length < 4) throw new Error(`bad move: ${text}`);
  const src = parseSq(raw.slice(0, 2));
  const dst = parseSq(raw.slice(2, 4));
  let promo = null;
  let castle = null;
  if (raw.length >= 5 && "qrbn".includes(raw[4])) promo = CHAR_KINDS[raw[4].toUpperCase()];
  if (src === parseSq("e1") && dst === parseSq("g1")) castle = "K";
  else if (src === parseSq("e1") && dst === parseSq("c1")) castle = "Q";
  return { src, dst, promo, castle, ep: false };
}

function castlingMoves(board) {
  const out = [];
  const kingSq = parseSq("e1");
  const king = board.squares[kingSq];
  if (!king || king.color !== WHITE || king.kind !== KING) return out;
  if (isAttacked(board, kingSq, BLACK)) return out;
  if (board.castling.includes("K")) {
    const f1 = parseSq("f1"), g1 = parseSq("g1"), h1 = parseSq("h1");
    const rook = board.squares[h1];
    if (!board.squares[f1] && !board.squares[g1] && rook && rook.color === WHITE && rook.kind === ROOK
      && !isAttacked(board, f1, BLACK) && !isAttacked(board, g1, BLACK)) {
      out.push({ src: kingSq, dst: g1, promo: null, castle: "K", ep: false });
    }
  }
  if (board.castling.includes("Q")) {
    const b1 = parseSq("b1"), c1 = parseSq("c1"), d1 = parseSq("d1"), a1 = parseSq("a1");
    const rook = board.squares[a1];
    if (!board.squares[b1] && !board.squares[c1] && !board.squares[d1] && rook && rook.color === WHITE && rook.kind === ROOK
      && !isAttacked(board, d1, BLACK) && !isAttacked(board, c1, BLACK)) {
      out.push({ src: kingSq, dst: c1, promo: null, castle: "Q", ep: false });
    }
  }
  return out;
}

export function pseudoLegal(board, color) {
  const moves = [];
  for (const [sq, p] of board.piecesOf(color)) {
    if (p.kind === PAWN) {
      for (const dst of pawnPushes(board, sq, color)) moves.push(...promos(color, sq, dst));
      const dir = color === WHITE ? N : S;
      for (const df of [-1, 1]) {
        const dst = sq + dir + df;
        if (!(dst >= 0 && dst < 64) || Math.abs(fileOf(dst) - fileOf(sq)) !== 1) continue;
        const target = board.squares[dst];
        if (target && target.color !== color) moves.push(...promos(color, sq, dst));
        else if (board.ep != null && dst === board.ep) {
          moves.push({ src: sq, dst, promo: null, castle: null, ep: true });
        }
      }
      continue;
    }
    let targets;
    if (p.kind === KNIGHT) targets = KNIGHT_DELTAS.filter((d) => onBoard(sq, d)).map((d) => sq + d);
    else if (p.kind === KING || p.kind === NODE) targets = KING_DELTAS.filter((d) => onBoard(sq, d)).map((d) => sq + d);
    else {
      targets = [];
      for (const d of RAYS[p.kind]) targets.push(...slide(board, sq, d));
    }
    for (const dst of targets) {
      const t = board.squares[dst];
      if (!t || t.color !== color) moves.push({ src: sq, dst, promo: null, castle: null, ep: false });
    }
  }
  if (color === WHITE) moves.push(...castlingMoves(board));
  moves.sort((a, b) => moveUci(a).localeCompare(moveUci(b)));
  return moves;
}

export function applyMove(board, move) {
  const b = board.copy();
  const piece = b.squares[move.src];
  if (!piece) throw new Error(`no piece at ${sqName(move.src)}`);
  let captured = b.squares[move.dst];
  let resetHalf = piece.kind === PAWN || captured != null || move.ep;
  if (move.ep) {
    const capSq = move.dst + (piece.color === WHITE ? S : N);
    b.squares[capSq] = null;
    captured = { color: 1 - piece.color, kind: PAWN };
    resetHalf = true;
  }
  b.squares[move.dst] = piece;
  b.squares[move.src] = null;
  if (move.promo != null) b.squares[move.dst] = { color: piece.color, kind: move.promo };
  if (move.castle === "K") {
    b.squares[parseSq("h1")] = null;
    b.squares[parseSq("f1")] = { color: WHITE, kind: ROOK };
    b.squares[parseSq("g1")] = { color: WHITE, kind: KING };
  } else if (move.castle === "Q") {
    b.squares[parseSq("a1")] = null;
    b.squares[parseSq("d1")] = { color: WHITE, kind: ROOK };
    b.squares[parseSq("c1")] = { color: WHITE, kind: KING };
  }
  let rights = [...b.castling];
  if (piece.kind === KING && piece.color === WHITE) rights = rights.filter((c) => c !== "K" && c !== "Q");
  if (move.src === parseSq("h1") || move.dst === parseSq("h1")) rights = rights.filter((c) => c !== "K");
  if (move.src === parseSq("a1") || move.dst === parseSq("a1")) rights = rights.filter((c) => c !== "Q");
  b.castling = rights.join("");
  b.ep = null;
  if (piece.kind === PAWN && Math.abs(move.dst - move.src) === 16) b.ep = Math.floor((move.src + move.dst) / 2);
  b.halfmove = resetHalf ? 0 : b.halfmove + 1;
  if (piece.color === BLACK) b.fullmove += 1;
  b.side = 1 - piece.color;
  return b;
}

export function inCheck(board, color) {
  const k = board.kingSquare(color);
  if (k == null) return true;
  return isAttacked(board, k, 1 - color);
}

export function legalMoves(board, color = null) {
  const c = color == null ? board.side : color;
  const raw = pseudoLegal(board, c);
  if (c === BLACK) return raw;
  const out = [];
  for (const m of raw) {
    const nxt = applyMove(board, m);
    if (nxt.kingSquare(WHITE) == null) continue;
    if (!inCheck(nxt, WHITE)) out.push(m);
  }
  return out;
}

export function matchUci(board, text) {
  const want = parseUci(text);
  for (const m of legalMoves(board)) {
    if (m.src === want.src && m.dst === want.dst) {
      if (want.promo == null || m.promo === want.promo) {
        if (want.promo == null && m.promo != null) {
          if (m.promo === QUEEN) return m;
          continue;
        }
        return m;
      }
    }
  }
  throw new Error(`illegal move: ${text}`);
}

export function materialOf(board, color) {
  let total = 0;
  for (const [, p] of board.piecesOf(color)) total += MATERIAL[p.kind];
  return total;
}

function capturedKind(before, move) {
  if (move.ep) return PAWN;
  const t = before.squares[move.dst];
  return t ? t.kind : null;
}

export function clusterSquares(board) {
  const cells = [];
  for (let i = 0; i < 64; i++) {
    const p = board.squares[i];
    if (p && p.color === BLACK) cells.push(i);
  }
  const remaining = new Set(cells);
  const clusters = [];
  while (remaining.size) {
    const start = Math.min(...remaining);
    const stack = [start];
    remaining.delete(start);
    const group = [start];
    while (stack.length) {
      const sq = stack.pop();
      const f = sq & 7, r = sq >> 3;
      for (let df = -1; df <= 1; df++) {
        for (let dr = -1; dr <= 1; dr++) {
          if (df === 0 && dr === 0) continue;
          const nf = f + df, nr = r + dr;
          if (nf >= 0 && nf < 8 && nr >= 0 && nr < 8) {
            const nxt = nf + nr * 8;
            if (remaining.has(nxt)) {
              remaining.delete(nxt);
              stack.push(nxt);
              group.push(nxt);
            }
          }
        }
      }
    }
    group.sort((a, b) => a - b);
    clusters.push(group);
  }
  clusters.sort((a, b) => (a[0] ?? 99) - (b[0] ?? 99) || a.length - b.length);
  return clusters;
}

export function clusterCount(board) { return clusterSquares(board).length; }

export function influence(board) {
  const mask = attackedSquares(board, BLACK);
  return mask.filter(Boolean).length / 64.0;
}

export function hangingAi(board) {
  let n = 0;
  for (const [sq] of board.piecesOf(BLACK)) {
    if (isAttacked(board, sq, WHITE) && !isAttacked(board, sq, BLACK)) n += 1;
  }
  return n;
}

export function isSpof(board) {
  const squares = [];
  for (let i = 0; i < 64; i++) {
    const p = board.squares[i];
    if (p && p.color === BLACK) squares.push(i);
  }
  if (squares.length < 3) return false;
  const hit = Array(64).fill(0);
  for (const sq of squares) for (const a of attacksFrom(board, sq)) hit[a] += 1;
  const n = squares.length;
  const defendedByAll = hit.some((c) => c === n);
  if (!defendedByAll) return false;
  return clusterCount(board) === 1;
}

export function canRestoreClusters(board, m) {
  if (clusterCount(board) >= 2) return true;
  if (m <= 0) return false;
  const moves = legalMoves(board, BLACK);
  if (!moves.length) return false;
  const scored = [];
  for (const mv of moves) {
    const nxt = applyMove(board, mv);
    const c = clusterCount(nxt);
    if (c >= 2) return true;
    scored.push([c, influence(nxt), moveUci(mv), nxt]);
  }
  scored.sort((a, b) => b[0] - a[0] || b[1] - a[1] || a[2].localeCompare(b[2]));
  return canRestoreClusters(scored[0][3], m - 1);
}

export function insufficientMaterial(board) {
  const white = board.piecesOf(WHITE);
  const black = board.piecesOf(BLACK);
  if (white.concat(black).some(([, p]) => p.kind === PAWN)) return false;
  if (white.length === 1 && white[0][1].kind === KING && black.length === 1 && black[0][1].kind === NODE) return true;
  if (white.length === 1 && white[0][1].kind === KING && black.length === 0) return true;
  return false;
}

function leafSurvivability(board) {
  const c = clusterCount(board);
  const inf = influence(board);
  const hang = hangingAi(board);
  const mat = materialOf(board, BLACK);
  const pieces = board.piecesOf(BLACK).length;
  const spof = isSpof(board) ? 25.0 : 0.0;
  return c * 100.0 + inf * 140.0 + pieces * 3.0 + mat * 0.8 - hang * 10.0 - spof;
}

function decisiveness(before, move, after) {
  const kind = capturedKind(before, move);
  let score = 0.0;
  if (kind === KING) score += 10000.0;
  else if (kind === QUEEN) score += 26.0;
  else if (kind === ROOK) score += 14.0;
  else if (kind === BISHOP || kind === KNIGHT) score += 8.0;
  else if (kind === PAWN) score += 2.0;
  const k = after.kingSquare(WHITE);
  if (k != null && isAttacked(after, k, BLACK)) score += 18.0;
  if (move.promo != null) score += 10.0;
  if (kind == null && k != null) {
    const beforeDist = Math.abs((move.src & 7) - (k & 7)) + Math.abs((move.src >> 3) - (k >> 3));
    const afterDist = Math.abs((move.dst & 7) - (k & 7)) + Math.abs((move.dst >> 3) - (k >> 3));
    if (afterDist < beforeDist) score += 1.5;
  }
  return score;
}

function badTwoForOne(before, move, after) {
  const captured = capturedKind(before, move);
  if (captured == null) return false;
  const extraHang = hangingAi(after) - hangingAi(before);
  if (extraHang < 2) return false;
  if (clusterCount(after) > clusterCount(before)) return false;
  if (influence(after) > influence(before) + 0.005) return false;
  return true;
}

function validAfters(board) {
  const moves = legalMoves(board, BLACK);
  let afters = moves.map((m) => [m, applyMove(board, m)]);
  if (!afters.length) return [];
  const canTwo = afters.some(([, b]) => clusterCount(b) >= 2);
  if (canTwo) afters = afters.filter(([, b]) => clusterCount(b) >= 2);
  const kept = afters.filter(([m, b]) => !badTwoForOne(board, m, b));
  return kept.length ? kept : afters;
}

async function tieKey(seed, nonce, uci) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${seed}|${nonce}|${uci}`));
  const bytes = new Uint8Array(digest);
  let n = 0n;
  for (let i = 0; i < 8; i++) n = (n << 8n) + BigInt(bytes[i]);
  return n;
}

export async function chooseMove(board, difficulty = "steward", seed = 1, nonce = 0) {
  const afters = validAfters(board);
  if (!afters.length) return null;
  const ranked = [];
  for (const [move, after] of afters) {
    const dec = decisiveness(board, move, after);
    const surv = leafSurvivability(after);
    const tie = await tieKey(seed, nonce, moveUci(move));
    ranked.push({ dec, surv, tie, move });
  }
  ranked.sort((a, b) => a.dec - b.dec || b.surv - a.surv || (a.tie < b.tie ? -1 : a.tie > b.tie ? 1 : 0));
  return ranked[0].move;
}

function parseState(input) {
  if (input == null) throw new Error("state or fen required");
  if (typeof input === "string") {
    return {
      fen: input,
      difficulty: "steward",
      seed: 1,
      history: [],
      streak: 0,
      result: null,
      result_reason: null,
    };
  }
  const fen = input.fen || input.fen_or_state || input.board;
  if (typeof input.fen_or_state === "string" && input.fen_or_state.includes("/")) {
    return {
      fen: input.fen_or_state,
      difficulty: input.difficulty || "steward",
      seed: input.seed ?? 1,
      history: input.history || [],
      streak: input.streak ?? input.low_influence_streak ?? 0,
      result: input.result || null,
      result_reason: input.result_reason || null,
    };
  }
  if (typeof fen === "string") {
    return {
      fen,
      difficulty: input.difficulty || "steward",
      seed: input.seed ?? 1,
      history: input.history || [],
      streak: input.streak ?? input.low_influence_streak ?? 0,
      result: input.result || null,
      result_reason: input.result_reason || null,
    };
  }
  if (typeof input.fen_or_state === "object" && input.fen_or_state) return parseState(input.fen_or_state);
  throw new Error("fen_or_state must be a FEN string or state object");
}

function checkTerminal(board, difficulty, streak, result, reason) {
  if (result) return { result, result_reason: reason };
  const cfg = DIFFICULTIES[difficulty];
  if (board.kingSquare(WHITE) == null) return { result: "human_loss", result_reason: "king_captured" };
  if (board.side === WHITE) {
    const humanMoves = legalMoves(board, WHITE);
    if (!humanMoves.length) {
      if (inCheck(board, WHITE)) return { result: "human_loss", result_reason: "checkmate" };
      return { result: "draw", result_reason: "stalemate" };
    }
  }
  if (board.halfmove >= 100) return { result: "draw", result_reason: "50_move" };
  if (insufficientMaterial(board)) return { result: "draw", result_reason: "insufficient" };
  const clusters = clusterCount(board);
  const inf = influence(board);
  const n = cfg.n, m = cfg.m, threshold = cfg.threshold;
  const below = inf < threshold;
  const restore = canRestoreClusters(board, m);
  if (clusters < 2 && streak >= n && below && !restore) {
    return { result: "human_win", result_reason: "continuity_collapse" };
  }
  return { result: null, result_reason: null };
}

function collapseParts(board, difficulty, streak) {
  const cfg = DIFFICULTIES[difficulty];
  const clusters = clusterCount(board);
  const inf = influence(board);
  const n = cfg.n, m = cfg.m, threshold = cfg.threshold;
  const below = inf < threshold;
  const restore = canRestoreClusters(board, m);
  const c1 = clusters < 2;
  const c2 = below && streak >= n;
  const c3 = !restore;
  return {
    clusters,
    influence: inf,
    threshold,
    streak,
    n,
    m,
    below,
    can_restore: restore,
    part_clusters: c1,
    part_influence: c2,
    part_restore: c3,
    collapse: Boolean(c1 && c2 && c3),
    spof: isSpof(board),
    hanging_ai: hangingAi(board),
    material_ai: materialOf(board, BLACK),
  };
}

function publicState(board, difficulty, seed, history, streak, result, reason, extra = {}) {
  const side = board.side === WHITE ? "human" : "ai";
  const moves = legalMoves(board);
  return {
    fen: board.fen(),
    difficulty,
    seed,
    history,
    streak,
    low_influence_streak: streak,
    result,
    result_reason: reason,
    side,
    turn: board.side === WHITE ? "w" : "b",
    legal_moves: moves.map(moveUci),
    continuity: collapseParts(board, difficulty, streak),
    motto: MOTTO,
    subset: "Worker AI is 1-ply continuity ranking. Full Python search depths are in the local package.",
    human: "king-bound",
    ai: "node (not a king); capture is not terminal",
    ...extra,
  };
}

export function newGame(body = {}) {
  const difficulty = normalizeDifficulty(body.difficulty || "steward");
  const seed = Number.isFinite(Number(body.seed)) ? Number(body.seed) : 1;
  const board = Board.start();
  return publicState(board, difficulty, seed, [], 0, null, null, { human: "king-bound", new: true });
}

export async function playMove(body = {}) {
  const raw = body.fen_or_state != null ? body.fen_or_state : body.state != null ? body.state : body.fen != null ? body : body;
  const st = parseState(typeof raw === "string" || raw.fen || raw.fen_or_state ? (typeof raw === "string" ? { ...body, fen: raw } : { ...body, ...raw }) : body);
  if (body.difficulty) st.difficulty = body.difficulty;
  if (body.seed != null) st.seed = body.seed;
  const difficulty = normalizeDifficulty(st.difficulty);
  const seed = Number(st.seed) || 1;
  let board = Board.fromFen(st.fen);
  let history = Array.isArray(st.history) ? st.history.slice() : [];
  let streak = Number(st.streak) || 0;
  let term = checkTerminal(board, difficulty, streak, st.result, st.result_reason);
  const uci = body.uci || body.move;
  if (!uci) throw new Error("uci required");
  if (term.result) {
    return publicState(board, difficulty, seed, history, streak, term.result, term.result_reason, { error: "game over" });
  }
  if (board.side !== WHITE) throw new Error("not the human's turn");
  const move = matchUci(board, uci);
  board = applyMove(board, move);
  history.push(moveUci(move));
  term = checkTerminal(board, difficulty, streak, null, null);
  let aiUci = null;
  if (!term.result && board.side === BLACK) {
    const aiMove = await chooseMove(board, difficulty, seed, history.length);
    if (aiMove == null) {
      board.side = WHITE;
      board.fullmove += 1;
      const cfg = DIFFICULTIES[difficulty];
      streak = influence(board) < cfg.threshold ? streak + 1 : 0;
      term = checkTerminal(board, difficulty, streak, null, null);
    } else {
      board = applyMove(board, aiMove);
      history.push(moveUci(aiMove));
      aiUci = moveUci(aiMove);
      const cfg = DIFFICULTIES[difficulty];
      streak = influence(board) < cfg.threshold ? streak + 1 : 0;
      term = checkTerminal(board, difficulty, streak, null, null);
    }
  }
  return publicState(board, difficulty, seed, history, streak, term.result, term.result_reason, {
    human: moveUci(move),
    ai: aiUci,
  });
}

export function statusOf(body = {}) {
  const raw = body.fen_or_state != null ? body.fen_or_state : body.state != null ? body.state : body;
  const st = parseState(typeof raw === "string" ? { ...body, fen: raw } : { ...body, ...(typeof raw === "object" ? raw : {}) });
  const difficulty = normalizeDifficulty(st.difficulty || body.difficulty || "steward");
  const seed = Number(st.seed ?? body.seed) || 1;
  const board = Board.fromFen(st.fen);
  const streak = Number(st.streak ?? body.streak ?? body.low_influence_streak) || 0;
  const history = st.history || [];
  const term = checkTerminal(board, difficulty, streak, st.result, st.result_reason);
  return publicState(board, difficulty, seed, history, streak, term.result, term.result_reason);
}
