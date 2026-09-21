#!/usr/bin/env bash
# Run the whole console locally with one command: the Python engine on :8765
# and the Next.js console on :3000. Ctrl-C stops both.
set -euo pipefail
cd "$(dirname "$0")"

if [ ! -d .venv ]; then
  echo "→ creating .venv and installing the engine"
  python3.11 -m venv .venv 2>/dev/null || python3 -m venv .venv
  .venv/bin/pip install -q -e ".[dev]"
fi
[ -d node_modules ] || { echo "→ installing console dependencies"; pnpm install; }

.venv/bin/python server.py &
ENGINE=$!
trap 'kill $ENGINE 2>/dev/null' EXIT

pnpm dev
