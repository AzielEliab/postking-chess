import 'package:flutter/material.dart';

import 'chess/board.dart';
import 'philosophy.dart';
import 'theme.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(const PostKingApp());
}

class PostKingApp extends StatelessWidget {
  const PostKingApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Post-King Chess',
      debugShowCheckedModeBanner: false,
      theme: buildAppTheme(),
      home: const BoardPage(),
    );
  }
}

class BoardPage extends StatefulWidget {
  const BoardPage({super.key});

  @override
  State<BoardPage> createState() => _BoardPageState();
}

class _BoardPageState extends State<BoardPage> {
  late Game _game;
  String _diff = 'steward';
  int? _selected;
  String? _hint;

  @override
  void initState() {
    super.initState();
    _game = Game.newGame(difficulty: _diff);
  }

  void _newGame() {
    setState(() {
      _game = Game.newGame(difficulty: _diff);
      _selected = null;
      _hint = null;
    });
  }

  void _tapSquare(int sq) {
    if (_game.gameOver) return;
    final piece = _game.board.squares[sq];
    if (_selected == null) {
      if (piece != null && piece.color == white) {
        setState(() {
          _selected = sq;
          _hint = null;
        });
      }
      return;
    }
    if (sq == _selected) {
      setState(() => _selected = null);
      return;
    }
    final err = _game.playHuman(_selected!, sq);
    setState(() {
      _selected = null;
      _hint = err;
    });
  }

  @override
  Widget build(BuildContext context) {
    final board = _game.board;
    final cfg = _game.cfg;
    final dests = _selected == null
        ? <int>{}
        : legalMoves(board, white)
            .where((m) => m.src == _selected)
            .map((m) => m.dst)
            .toSet();
    return Scaffold(
      appBar: AppBar(
        title: const Text('Post-King Chess'),
        actions: [
          IconButton(
            tooltip: 'Philosophy',
            icon: const Icon(Icons.menu_book),
            onPressed: () {
              Navigator.of(context).push(
                MaterialPageRoute<void>(
                  builder: (_) => const PhilosophyPage(),
                ),
              );
            },
          ),
        ],
      ),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 4),
            child: Text(
              'The goal is not to win. The goal is to remain.',
              style: Theme.of(context).textTheme.titleMedium?.copyWith(
                    color: kGold,
                    fontStyle: FontStyle.italic,
                  ),
            ),
          ),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: SegmentedButton<String>(
              segments: const [
                ButtonSegment(value: 'witness', label: Text('Witness')),
                ButtonSegment(value: 'steward', label: Text('Steward')),
                ButtonSegment(value: 'remain', label: Text('Remain')),
              ],
              selected: {_diff},
              onSelectionChanged: (s) {
                _diff = s.first;
                _newGame();
              },
            ),
          ),
          Padding(
            padding: const EdgeInsets.all(8),
            child: Text(
              '${cfg.label}  N=${cfg.n} M=${cfg.m} infl=${cfg.threshold}  ·  '
              'clusters ${clusterCount(board)}  infl ${influence(board).toStringAsFixed(2)}  '
              'streak ${_game.lowInfluenceStreak}',
              style: Theme.of(context).textTheme.bodySmall,
            ),
          ),
          if (_game.result != null)
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: Text(
                _game.result == 'human'
                    ? 'Continuity Collapse. ${_game.resultReason}'
                    : 'Human lost. ${_game.resultReason}',
                style: const TextStyle(color: kGold, fontWeight: FontWeight.w600),
              ),
            ),
          if (_hint != null)
            Text(_hint!, style: const TextStyle(color: Color(0xFFB54A4A))),
          Expanded(
            child: Center(
              child: AspectRatio(
                aspectRatio: 1,
                child: Padding(
                  padding: const EdgeInsets.all(12),
                  child: GridView.builder(
                    physics: const NeverScrollableScrollPhysics(),
                    gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                      crossAxisCount: 8,
                    ),
                    itemCount: 64,
                    itemBuilder: (context, i) {
                      // Display rank 8 at top: visual row 0 = rank 7.
                      final file = i % 8;
                      final rank = 7 - (i ~/ 8);
                      final sq = file + rank * 8;
                      final dark = (file + rank) % 2 == 0;
                      final p = board.squares[sq];
                      final sel = _selected == sq;
                      final dest = dests.contains(sq);
                      return GestureDetector(
                        onTap: () => _tapSquare(sq),
                        child: Container(
                          decoration: BoxDecoration(
                            color: sel
                                ? const Color(0x55C9A227)
                                : dest
                                    ? const Color(0x332E6B4A)
                                    : (dark
                                    ? const Color(0xFF1A1A1A)
                                    : const Color(0xFF2A2A2A)),
                            border: Border.all(
                              color: const Color(0x33C9A227),
                              width: 0.5,
                            ),
                          ),
                          alignment: Alignment.center,
                          child: Text(
                            p?.glyph ?? '',
                            style: TextStyle(
                              fontSize: 22,
                              color: p != null && p.kind == node
                                  ? kGold
                                  : kIvory,
                            ),
                          ),
                        ),
                      );
                    },
                  ),
                ),
              ),
            ),
          ),
          Padding(
            padding: const EdgeInsets.only(bottom: 16),
            child: OutlinedButton(
              onPressed: _newGame,
              child: const Text('New game'),
            ),
          ),
        ],
      ),
    );
  }
}
