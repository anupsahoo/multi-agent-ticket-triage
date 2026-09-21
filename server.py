"""Local development server for the triage engine. Standard library only.

    python server.py            # http://localhost:8765

All routing lives in triage/api.py; this file only speaks HTTP: it parses the
path, query string and JSON body, hands them to `dispatch`, and writes the
JSON reply with the CORS headers the Next.js dev server needs.
"""
from __future__ import annotations

import json
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlparse

from triage.api import dispatch, engine

HOST = "127.0.0.1"
PORT = 8765


class Handler(BaseHTTPRequestHandler):
    """GET/POST/PUT → dispatch; OPTIONS answers the CORS preflight."""

    def log_message(self, *_: object) -> None:  # keep the terminal quiet
        pass

    def _respond(self, status: int, payload: object) -> None:
        body = json.dumps(payload).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Access-Control-Allow-Methods", "GET,POST,PUT,OPTIONS")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _handle(self, method: str) -> None:
        url = urlparse(self.path)
        query = {k: v[0] for k, v in parse_qs(url.query).items()}   # first value wins for repeated keys
        length = int(self.headers.get("Content-Length", 0))
        body = json.loads(self.rfile.read(length) or b"{}") if length else {}
        self._respond(*dispatch(method, url.path, query, body))

    def do_OPTIONS(self) -> None:
        self._respond(200, {})

    def do_GET(self) -> None:
        self._handle("GET")

    def do_POST(self) -> None:
        self._handle("POST")

    def do_PUT(self) -> None:
        self._handle("PUT")


if __name__ == "__main__":
    e = engine()   # build (and seed) before accepting requests, so the first request is fast
    print(f"engine on http://localhost:{PORT} · decisions={e.decisions} language={e.language} · {len(e.store.all())} tickets", flush=True)
    ThreadingHTTPServer((HOST, PORT), Handler).serve_forever()
