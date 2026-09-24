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
      theme: buildAppTheme(brightness: Brightness.light),
      darkTheme: buildAppTheme(brightness: Brightness.dark),
      themeMode: ThemeMode.system,
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
    final darkBoard = Theme.of(context).brightness == Brightness.dark;
    final lightSq = darkBoard ? const Color(0xFF2A2A2A) : const Color(0xFFE7E0D2);
    final darkSq = darkBoard ? const Color(0xFF1A1A1A) : const Color(0xFFCFC6B4);
    final humanInk = darkBoard ? kIvory : const Color(0xFF1C1914);
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
          const Padding(
            padding: EdgeInsets.symmetric(horizontal: 16),
            child: Text('You keep a king. The other side tries to remain.'),
          ),
          if (_game.result != null)
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
              child: Text(
                _game.result == 'human'
                    ? 'Continuity collapse. The other side did not remain.'
                    : 'Your king fell. ${_game.resultReason}',
                style: const TextStyle(color: kGold, fontWeight: FontWeight.w600),
              ),
            ),
          if (_hint != null)
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
              child: Text(
                _hint!,
                style: TextStyle(color: Theme.of(context).colorScheme.error),
              ),
            ),
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
                      return Material(
                        color: sel
                            ? const Color(0x55C9A227)
                            : dest
                                ? const Color(0x332E6B4A)
                                : (dark ? darkSq : lightSq),
                        child: InkWell(
                          onTap: () => _tapSquare(sq),
                          focusColor: const Color(0x88C9A227),
                          child: Container(
                            alignment: Alignment.center,
                            decoration: BoxDecoration(
                              border: Border.all(
                                color: const Color(0x33C9A227),
                                width: 0.5,
                              ),
                            ),
                            child: Text(
                              p?.glyph ?? '',
                              style: TextStyle(
                                fontSize: 22,
                                color: p != null && p.kind == node ? kGold : humanInk,
                              ),
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
            padding: const EdgeInsets.fromLTRB(16, 0, 16, 4),
            child: Align(
              alignment: Alignment.centerLeft,
              child: _game.gameOver
                  ? FilledButton(onPressed: _newGame, child: const Text('New game'))
                  : TextButton(onPressed: _newGame, child: const Text('New game')),
            ),
          ),
          ExpansionTile(
            title: const Text('Advanced'),
            children: [
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    SegmentedButton<String>(
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
                    const SizedBox(height: 8),
                    Text(
                      '${cfg.label}. Clusters ${clusterCount(board)}. '
                      'Influence ${influence(board).toStringAsFixed(2)}. '
                      'Streak ${_game.lowInfluenceStreak} of ${cfg.n}. '
                      'Changing difficulty starts a new game.',
                    ),
                  ],
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
