"""Where the ticket store keeps its one JSON document.

Locally that is a file. On Vercel, where a function's filesystem is ephemeral,
it is a Vercel Blob, chosen automatically when BLOB_READ_WRITE_TOKEN is set.
Both backends expose the same two calls, so the store does not care which.

Reads: BLOB_READ_WRITE_TOKEN from the environment (in `backend_from_env`); the
document itself on `load` and, when it has changed since, on `refresh`. Writes:
the whole document on `save`. A missing or unreadable document loads as an
empty list, which is what triggers seeding.

`refresh` exists because a deployed engine runs as several function instances,
each holding the store in memory: a ticket created on one instance must be
visible to a request served by another. The check is cheap when nothing has
changed (a file mtime; a conditional GET answered with 304).
"""
from __future__ import annotations

import json
import os
import tempfile
import urllib.error
import urllib.request
from pathlib import Path
from typing import Protocol


def writable_dir(preferred: Path) -> Path:
    """`preferred` if it can be created and written to, else a same-named directory
    under the system temp dir. Serverless runtimes mount the code read-only and
    leave only /tmp writable; locally the preferred path is always used."""
    try:
        preferred.mkdir(parents=True, exist_ok=True)
        probe = preferred / ".write-test"
        probe.touch()
        probe.unlink()
        return preferred
    except OSError:
        fallback = Path(tempfile.gettempdir()) / preferred.name
        fallback.mkdir(parents=True, exist_ok=True)
        return fallback


class Backend(Protocol):
    """A list of ticket dicts, loaded and saved whole."""

    def load(self) -> list[dict]: ...
    def save(self, rows: list[dict]) -> None: ...
    def refresh(self) -> list[dict] | None:
        """The document if another writer changed it since the last load or save, else None."""
        ...


class FileBackend:
    """One JSON file on local disk. The directory is resolved once through
    `writable_dir`, so on a read-only filesystem the file lands in /tmp instead."""

    def __init__(self, path: Path) -> None:
        self.path = writable_dir(path.parent) / path.name
        self._mtime = 0

    def _stamp(self) -> int:
        return self.path.stat().st_mtime_ns if self.path.exists() else 0

    def load(self) -> list[dict]:
        self._mtime = self._stamp()
        return json.loads(self.path.read_text()) if self.path.exists() else []

    def save(self, rows: list[dict]) -> None:
        self.path.write_text(json.dumps(rows))
        self._mtime = self._stamp()

    def refresh(self) -> list[dict] | None:
        return self.load() if self._stamp() != self._mtime else None


class BlobBackend:
    """Vercel Blob over its REST API, using only urllib so the engine keeps
    zero third-party runtime dependencies beyond LangGraph itself.

    The store is private, so every read carries the bearer token and the
    blob's URL is learned from the list API (or the PUT response) rather than
    guessed. The blob's ETag is remembered so `refresh` can ask "changed since?"
    with a conditional GET. Network and decode errors on load degrade to an
    empty list rather than failing the request; errors on save propagate."""

    API = "https://blob.vercel-storage.com"
    API_VERSION = "12"

    def __init__(self, token: str, pathname: str = "triage/tickets.json") -> None:
        self.token = token
        self.pathname = pathname
        self._url: str | None = None    # the blob's URL, learned on first list or write
        self._etag: str | None = None   # of the document last loaded or saved

    def _headers(self, extra: dict | None = None) -> dict:
        """Auth, API-version and private-access headers, plus any per-request extras."""
        return {"authorization": f"Bearer {self.token}", "x-api-version": self.API_VERSION,
                "x-vercel-blob-access": "private", **(extra or {})}

    def _find_url(self) -> str | None:
        """Look the blob up by pathname; None if it does not exist yet or the API is unreachable."""
        if self._url:
            return self._url
        req = urllib.request.Request(f"{self.API}/?prefix={self.pathname}&limit=1", headers=self._headers())
        try:
            with urllib.request.urlopen(req, timeout=10) as r:
                blobs = json.load(r).get("blobs", [])
        except urllib.error.URLError:
            return None
        self._url = blobs[0]["url"] if blobs else None
        return self._url

    def _fetch(self, *, conditional: bool) -> list[dict] | None:
        """GET the document. None when it does not exist, cannot be read, or
        (with `conditional`) has not changed since the remembered ETag."""
        url = self._find_url()
        if not url:
            return None
        headers = {"authorization": f"Bearer {self.token}"}
        if conditional and self._etag:
            headers["if-none-match"] = self._etag
        # cache=0 bypasses the CDN so a fresh function instance sees the last save
        req = urllib.request.Request(f"{url}?cache=0", headers=headers)
        try:
            with urllib.request.urlopen(req, timeout=10) as r:
                self._etag = r.headers.get("etag")
                return json.load(r)
        except (urllib.error.URLError, json.JSONDecodeError):   # HTTPError (incl. 304 Not Modified) is a URLError
            return None

    def load(self) -> list[dict]:
        self._etag = None
        return self._fetch(conditional=False) or []

    def refresh(self) -> list[dict] | None:
        return self._fetch(conditional=True)

    def save(self, rows: list[dict]) -> None:
        # fixed pathname, overwrite in place, no CDN caching: the document must read back exactly as written
        body = json.dumps(rows).encode()
        req = urllib.request.Request(
            f"{self.API}/?pathname={self.pathname}", data=body, method="PUT",
            headers=self._headers({"x-content-type": "application/json", "x-add-random-suffix": "0",
                                   "x-allow-overwrite": "1", "x-cache-control-max-age": "0"}),
        )
        with urllib.request.urlopen(req, timeout=15) as r:
            meta = json.load(r)
        self._url = meta.get("url", self._url)
        self._etag = meta.get("etag", None)   # the PUT reports the new document's ETag; None forces a re-read next time


def backend_from_env(default_path: Path) -> Backend:
    """Blob when BLOB_READ_WRITE_TOKEN is set (i.e. on Vercel), else the local file."""
    token = os.getenv("BLOB_READ_WRITE_TOKEN")
    return BlobBackend(token) if token else FileBackend(default_path)
