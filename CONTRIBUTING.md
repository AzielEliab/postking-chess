# Contributing to Post-King Chess

**Forks are first-class.** This project is CC BY 4.0; you do not need
permission to fork, patch, or redistribute.

**Forks are welcome and always allowed.**

## How to run tests

```bash
python -m venv .venv
source .venv/bin/activate
pip install -e ".[dev]"
python -m pytest -q
```

Python 3.10+. Core is stdlib only (`dataclasses`, `json`, `http.server`,
`argparse`, `hashlib`). pytest is the dev extra. No network. No ML.

## Ground rules

1. **The AI seeks continuity, not victory.** Do not add king-hunting
   as a primary eval. Survivability outranks advantage.
2. **Continuity Collapse needs all three conditions.** Capture of the
   Node is ordinary. Do not make Node capture terminal.
3. **Human remains king-bound.** Checkmate and king capture are losses.
   The human may not move into check. Castling is legal for white only.
4. **Keep the dependency list tiny.** Stdlib only in the core.
5. **UI binds loopback only** (`127.0.0.1`). Do not listen on `0.0.0.0`.
   No CDN.
6. **Do not merge this product into ForgeReceipts, ZionPattern Solver,
   DecisionGATE, AZ-OS, Glossa Filter, or any *Lock tree.** Post-King
   Chess is standalone.
7. **Do not deploy the download tracker** from this tree. Parent ships.
8. New behavior needs a test that fails without the change.
9. Difficulties stay in one copy: Witness, Steward, Remain. Do not
   split them into separate packages.
10. Determinism stays seed-stable. Same seed, same reply.

## Where to change things

- Chess kernel: `postking/board.py`
- Clusters / influence / collapse: `postking/continuity.py`
- AI constraints and ranking: `postking/ai.py`
- Game state: `postking/game.py`
- CLI: `postking/cli.py`
- UI: `postking/ui.py` and `postking/web/`
- Philosophy README: `docs/philosophy.md` (copied into package data)

The goal is not to win. The goal is to remain.
