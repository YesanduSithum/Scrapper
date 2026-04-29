from urllib.parse import parse_qsl, urlencode, urlparse, urlunparse

from sqlalchemy import create_engine
from sqlalchemy.orm import Session, declarative_base, sessionmaker

from app.core.config import settings


def _normalize_database_url(database_url: str) -> str:
    parsed = urlparse(database_url)
    if not parsed.query:
        return database_url

    filtered_query = [(key, value) for key, value in parse_qsl(parsed.query) if key.lower() != "schema"]
    rebuilt = parsed._replace(query=urlencode(filtered_query))
    return urlunparse(rebuilt)


engine = create_engine(_normalize_database_url(settings.database_url))
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    db: Session = SessionLocal()
    try:
        yield db
    finally:
        db.close()
