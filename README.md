# Post-King Chess

Asymmetric continuity-based chess. One side keeps a king. The other side
does not. Capture is not an ending for the Post-King side. Only
**Continuity Collapse** is.

**Author:** Aziel Eliab
**Date:** August 2026
**License:** [CC BY 4.0](LICENSE)
**Version:** 0.1.0

> The goal is not to win. The goal is to remain.

How to contribute: [CONTRIBUTING.md](CONTRIBUTING.md).

**Forks are welcome and always allowed.**

This tree is a standalone product; not ForgeReceipts / ZionPattern /
DecisionGATE / AZ-OS / Glossa Filter / any *Lock.

Counted downloads (number on the button, no user reporting):
[https://postking-download-tracker.vibelock.workers.dev/](https://postking-download-tracker.vibelock.workers.dev/)

Direct counted tarball:
[postking-chess-0.1.0.tar.gz](https://postking-download-tracker.vibelock.workers.dev/download?asset=postking-chess-0.1.0.tar.gz)

GitHub: [https://github.com/AzielEliab/postking-chess](https://github.com/AzielEliab/postking-chess)

Papers live in [docs/source](docs/source). The in-game Philosophy README
is [docs/philosophy.md](docs/philosophy.md).

---

## What it is

- Human (white): standard chess including King. Loses if the King is
  captured or checkmated. May not move into check. Castling allowed if
  legal.
- Post-King AI (black): no King. `e8` is a **Node** (`o` / `O`) that
  moves like a king. Capturing it is ordinary, not terminal. No check.
  Cannot castle.
- Human win = Continuity Collapse. All three: (1) fewer than two
  8-adjacent AI clusters; (2) AI influence below the difficulty
  threshold for N full turns; (3) no legal AI move restores ≥2 clusters
  within M plies.
- Difficulties in this copy: Witness (N=2, M=1, infl=0.18, shallow),
  Steward default (N=3, M=2, infl=0.12), Remain (N=5, M=3, infl=0.08,
  deeper).
- Deterministic by seed. Stdlib chess kernel. Zero runtime deps.
- Local UI on `127.0.0.1:8844`. Matte black board, subtle gold grid.
  No CDN.

The AI does not seek victory. The AI seeks continuity. It may not leave
one cluster if a two-cluster move exists. It ranks valid moves by
lowest decisiveness, then highest survivability.

## Quick start

Python 3.10+. Stdlib only at runtime. Motto: *The goal is not to win. The goal is to remain.*
Philosophy: [docs/philosophy.md](docs/philosophy.md).

```bash
python -m venv .venv
source .venv/bin/activate
pip install -e ".[dev]"
postking ui                                   # 127.0.0.1:8844 loopback only
python -m pytest -q
```

## CLI

```bash
postking version                              # postking 0.1.0
postking ui                                   # 127.0.0.1:8844 loopback only
postking new --difficulty steward --seed 1
postking move e2e4
postking status
```

`postking ui` binds loopback only. GET `/philosophy` serves the in-game
README (systems paper + chess rules + Continuity Loop R=S²C).

## Continuity Loop

Sacrifice → Stewardship → Continuation.

Redemption equation: **R = S²C**

If it cannot continue without you, it was not redeemed.

## Worker

`workers/download-tracker/` is shipped, not deployed from this tree.
Parent ships. Isolated counter: Worker `postking-download-tracker`,
project `postking`.
