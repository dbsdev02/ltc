"""Database engine for serverless use.

Each request opens a short-lived connection through Neon's pooled endpoint
(PgBouncer) and returns it right away: NullPool keeps no idle connections
around between invocations, which is what Vercel functions need.
"""

from __future__ import annotations

import ssl
from collections.abc import Iterator
from functools import lru_cache
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

from sqlalchemy import Engine, create_engine, event
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker
from sqlalchemy.pool import NullPool

from app.config import get_settings


class Base(DeclarativeBase):
    pass


# Query parameters libpq understands but pg8000 doesn't; SSL is configured below instead.
_LIBPQ_ONLY_PARAMS = {"sslmode", "channel_binding", "sslrootcert", "options"}


def normalise_url(url: str) -> tuple[str, dict]:
    """Turns a Neon/libpq URL into a SQLAlchemy pg8000 URL plus connect args."""
    if url.startswith("sqlite"):
        return url, {}
    parts = urlsplit(url)
    scheme = "postgresql+pg8000"
    query = dict(parse_qsl(parts.query))
    needs_ssl = query.get("sslmode", "require") != "disable" and parts.hostname not in {"localhost", "127.0.0.1"}
    query = {k: v for k, v in query.items() if k not in _LIBPQ_ONLY_PARAMS}
    connect_args: dict = {"timeout": 10}
    if needs_ssl:
        connect_args["ssl_context"] = ssl.create_default_context()
    return urlunsplit((scheme, parts.netloc, parts.path, urlencode(query), "")), connect_args


@lru_cache
def get_engine() -> Engine:
    url = get_settings().database_url
    if not url:
        raise RuntimeError("DATABASE_URL is not set.")
    sa_url, connect_args = normalise_url(url)
    if sa_url.startswith("sqlite"):
        engine = create_engine(sa_url, connect_args={"check_same_thread": False})

        @event.listens_for(engine, "connect")
        def _sqlite_fk(dbapi_conn, _):  # pragma: no cover - test/dev only
            dbapi_conn.execute("PRAGMA foreign_keys = ON")

        return engine
    return create_engine(sa_url, poolclass=NullPool, connect_args=connect_args)


@lru_cache
def _session_factory() -> sessionmaker[Session]:
    return sessionmaker(bind=get_engine(), autoflush=False, expire_on_commit=False)


def get_db() -> Iterator[Session]:
    db = _session_factory()()
    try:
        yield db
    finally:
        db.close()
