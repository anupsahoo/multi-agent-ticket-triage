"""Vercel serverless entry point for the triage engine.

Vercel serves this file at /api and the Next.js rewrite sends every /api/* request
here with its original path intact, so triage/api.py routes exactly as it does
locally. Ticket state persists in Vercel Blob (see triage/persistence.py).

This adapter parses the path, query string and JSON body, hands them to
`dispatch`, and writes the JSON reply. No CORS headers: the console and the
function share an origin in production.
"""
from __future__ import annotations

import json
import sys
from http.server import BaseHTTPRequestHandler
from pathlib import Path
from urllib.parse import parse_qs, urlparse

# The function runs from the repository root; make the engine importable.
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from triage.api import dispatch  # noqa: E402


class handler(BaseHTTPRequestHandler):  # Vercel requires this exact class name
    """GET/POST/PUT → dispatch."""

    def _handle(self, method: str) -> None:
        url = urlparse(self.path)
        query = {k: v[0] for k, v in parse_qs(url.query).items()}   # first value wins for repeated keys
        length = int(self.headers.get("Content-Length", 0))
        body = json.loads(self.rfile.read(length) or b"{}") if length else {}
        status, payload = dispatch(method, url.path, query, body)
        data = json.dumps(payload).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self) -> None:
        self._handle("GET")

    def do_POST(self) -> None:
        self._handle("POST")

    def do_PUT(self) -> None:
        self._handle("PUT")
