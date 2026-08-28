"""Allow ``python -m postking`` to invoke the CLI."""

from postking.cli import main

if __name__ == "__main__":
    raise SystemExit(main())
