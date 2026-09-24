# Post-King Chess

You keep a king. The other side tries to remain.

**Author:** Aziel Eliab
**License:** [CC BY 4.0](LICENSE)
**Version:** 0.1.0

> The goal is not to win. The goal is to remain.

## Start

1. Install on this computer:

```bash
python -m venv .venv && source .venv/bin/activate && pip install -e .
```

2. Open the board:

```bash
postking ui
```

3. Open http://127.0.0.1:8844/

The board stays on this computer. `postking` with no arguments shows the same next step. `postking --help` lists commands.

## Play in the terminal

```bash
postking new --difficulty steward --seed 1
postking move e2e4
postking status
```

People see plain text. Add `--json` when a program should read the result. `postking doctor` checks this install.

## The game

- You play white, with a king. You lose if that king is captured or checkmated.
- The other side has a Node on e8, not a king. Capturing the Node does not end the game.
- You win by Continuity Collapse: fewer than two groups of its pieces, its influence held under the line for N turns, and no move that restores two groups within M plies.
- Difficulties: Witness, Steward (default), and Remain. The same seed plays the same game.
- The board listens on 127.0.0.1 only.

Philosophy and the papers: [docs/philosophy.md](docs/philosophy.md). Phone notes: [mobile/README.md](mobile/README.md).

## Commands

| Command | What it does |
| --- | --- |
| `ui` | Open the board at http://127.0.0.1:8844 |
| `new` | Start a saved game (`game.json`) |
| `move` | Play one move; the other side replies |
| `status` | Show the saved game |
| `doctor` | Check this install |
| `version` | Print the package version |
| `import` / `export` | Store or write a JSON file on this computer |

Advanced options (`--difficulty`, `--seed`, `--save`, `--port`, `--json`) are listed by `postking --help`.

## One-click install

```bash
curl -fsSL https://postking-download-tracker.vibelock.workers.dev/install.sh | bash
```

Then run `postking ui` and open http://127.0.0.1:8844/.

Counted download: https://postking-download-tracker.vibelock.workers.dev/

GitHub: https://github.com/AzielEliab/postking-chess

DOI: https://doi.org/10.5281/zenodo.21897338

How to contribute: [CONTRIBUTING.md](CONTRIBUTING.md).

## Hosted play

This package is the local game. A hosted subset also answers at
https://postking-download-tracker.vibelock.workers.dev/v1/health
with OpenAPI at https://postking-download-tracker.vibelock.workers.dev/openapi.json.
`/v1` does not count downloads. The skill for that host is [SKILL.md](SKILL.md).

## Cite

Aziel Eliab. Post-King Chess. https://github.com/AzielEliab/postking-chess. https://doi.org/10.5281/zenodo.21897338.
