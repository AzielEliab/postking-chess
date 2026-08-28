import 'package:flutter/material.dart';

import 'theme.dart';

class PhilosophyPage extends StatelessWidget {
  const PhilosophyPage({super.key});

  static const body =
      'The goal is not to win. The goal is to remain.\n\n'
      'Post-King Chess is asymmetric continuity-based chess. One side keeps '
      'a king. The other side does not. Capture is not an ending for the '
      'Post-King side. Only Continuity Collapse is.\n\n'
      'King-bound side (human, white)\n'
      'Possesses a King. Capture of the King is an immediate loss. Checkmate '
      'is a loss. Moving into check is illegal. Castling is allowed if '
      'otherwise legal. This side represents historical power logic: victory '
      'through decisive elimination.\n\n'
      'Post-King side (AI, black)\n'
      'No King exists. e8 is a Node (○). The Node moves like a king. '
      'Capturing it is ordinary, not terminal. The AI has no check. The AI '
      'cannot castle. Loss is defined only by structural collapse. The AI '
      'does not seek victory. The AI seeks continuity.\n\n'
      'Continuity Collapse (human win) needs all three on desktop: (1) fewer '
      'than two 8-adjacent AI clusters; (2) influence below the difficulty '
      'threshold for N full turns; (3) no legal AI move restores ≥2 clusters '
      'within M plies. This phone kernel uses a simplified check: conditions '
      '1 and 2 plus a 1-ply restore (M-ply search omitted).\n\n'
      'Difficulties: Witness (N=2, M=1, infl=0.18), Steward (N=3, M=2, '
      'infl=0.12), Remain (N=5, M=3, infl=0.08).\n\n'
      'Continuity Loop: Sacrifice → Stewardship → Continuation. '
      'Redemption equation: R = S²C. If it cannot continue without you, '
      'it was not redeemed.\n\n'
      'Legal-move subset in this app: no en passant, queen-only promotion, '
      'no 50-move or threefold. Tiny Dart chess, not a full FIDE engine.';

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Philosophy')),
      body: const SingleChildScrollView(
        padding: EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'The goal is not to win. The goal is to remain.',
              style: TextStyle(
                color: kGold,
                fontSize: 20,
                fontStyle: FontStyle.italic,
                height: 1.4,
              ),
            ),
            SizedBox(height: 16),
            Text(body, style: TextStyle(height: 1.45)),
          ],
        ),
      ),
    );
  }
}
