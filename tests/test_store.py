"""The ticket store behind the console API: tickets survive a restart, and a
write made by one process is seen by another. The second property is what
keeps a multi-instance deployment coherent; it is exercised here with the file
backend, which shares the ETag-style contract of the Blob backend.
"""
import time

from triage.persistence import FileBackend
from triage.store import TicketStore


def test_store_persists_across_instances(make_app, tmp_path):
    """A ticket run on one store instance is loaded by a fresh instance on the same backend."""
    path = tmp_path / "runs" / "tickets.json"
    first = TicketStore(FileBackend(path))
    t = first.run(make_app(), "What are your support hours?")

    second = TicketStore(FileBackend(path))
    assert second.get(t["ticket_id"])["status"] == t["status"]


def test_refresh_picks_up_another_writer(make_app, tmp_path):
    """Two live stores on one backend: a write on A appears on B after refresh, and an unchanged backend is a no-op."""
    path = tmp_path / "runs" / "tickets.json"
    a, b = TicketStore(FileBackend(path)), TicketStore(FileBackend(path))
    b.refresh()
    assert b.all() == []

    time.sleep(0.01)   # file mtimes are coarse on some filesystems
    t = a.run(make_app(), "How do I export my data?")
    b.refresh()
    assert b.get(t["ticket_id"]) is not None

    a.refresh()        # a's own write must not be re-read as a change
    assert a.get(t["ticket_id"]) is not None
