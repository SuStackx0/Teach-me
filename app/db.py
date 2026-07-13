"""
Single source of truth for all DB access.
All functions accept an optional `conn` for caller-managed transactions.
"""
import json
import sqlite3
from pathlib import Path
from typing import Any

DB_PATH = Path(__file__).parent.parent / "teach.db"


def get_db(path: Path = DB_PATH) -> sqlite3.Connection:
    conn = sqlite3.connect(str(path), check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA synchronous=NORMAL")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


def init_db(path: Path = DB_PATH) -> None:
    conn = get_db(path)
    conn.executescript(SCHEMA)
    conn.commit()
    conn.close()


SCHEMA = """
CREATE TABLE IF NOT EXISTS meta (
    key TEXT PRIMARY KEY, value TEXT
);
CREATE TABLE IF NOT EXISTS sessions (
    slug TEXT PRIMARY KEY, title TEXT, domain TEXT, date TEXT,
    quiz_score_pct REAL, time_spent_minutes REAL, difficulty TEXT,
    weak_areas TEXT DEFAULT '[]', notes TEXT DEFAULT '',
    next_review_date TEXT, kata_passed INTEGER
);
CREATE INDEX IF NOT EXISTS idx_sessions_date        ON sessions(date);
CREATE INDEX IF NOT EXISTS idx_sessions_next_review ON sessions(next_review_date);
CREATE INDEX IF NOT EXISTS idx_sessions_domain      ON sessions(domain);
CREATE TABLE IF NOT EXISTS weak_areas (
    phrase TEXT PRIMARY KEY, flagged_date TEXT,
    reinforced_count INTEGER DEFAULT 0, retired INTEGER DEFAULT 0, source_slug TEXT
);
CREATE TABLE IF NOT EXISTS requiz_queue (
    position INTEGER PRIMARY KEY, slug TEXT UNIQUE
);
CREATE TABLE IF NOT EXISTS deferred_topics (
    slug TEXT PRIMARY KEY, title TEXT, domain TEXT, suggest_after TEXT, reason TEXT
);
CREATE TABLE IF NOT EXISTS presented_slugs (slug TEXT PRIMARY KEY);
CREATE TABLE IF NOT EXISTS curriculum_meta (key TEXT PRIMARY KEY, value TEXT);
CREATE TABLE IF NOT EXISTS topics (
    slug TEXT PRIMARY KEY, track_id TEXT, title TEXT, concepts TEXT,
    difficulty TEXT, estimated_minutes INTEGER,
    status TEXT DEFAULT 'not_started', builds_on TEXT DEFAULT '[]'
);
CREATE INDEX IF NOT EXISTS idx_topics_track  ON topics(track_id);
CREATE INDEX IF NOT EXISTS idx_topics_status ON topics(status);
CREATE TABLE IF NOT EXISTS questions (
    id TEXT PRIMARY KEY, source_slug TEXT, source_title TEXT, domain TEXT,
    type TEXT, question TEXT, options TEXT, answer TEXT, explanation TEXT,
    times_asked INTEGER DEFAULT 0, times_correct INTEGER DEFAULT 0, last_asked TEXT
);
CREATE INDEX IF NOT EXISTS idx_questions_source_slug ON questions(source_slug);
CREATE INDEX IF NOT EXISTS idx_questions_domain      ON questions(domain);
CREATE TABLE IF NOT EXISTS notes (slug TEXT PRIMARY KEY, note TEXT DEFAULT '', updated TEXT);
CREATE TABLE IF NOT EXISTS wishlist (
    id TEXT PRIMARY KEY, topic TEXT, added_date TEXT, surfaced INTEGER DEFAULT 0
);
CREATE TABLE IF NOT EXISTS bookmarks (
    id TEXT PRIMARY KEY, slug TEXT, title TEXT, section TEXT, content TEXT, created_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_bookmarks_slug ON bookmarks(slug);
CREATE TABLE IF NOT EXISTS lessons (
    slug TEXT PRIMARY KEY, content TEXT, searchable_text TEXT,
    is_current INTEGER DEFAULT 0, archived_at TEXT
);
CREATE VIRTUAL TABLE IF NOT EXISTS lessons_fts USING fts5(
    slug, title, body, content=lessons, content_rowid=rowid
);
CREATE TABLE IF NOT EXISTS scenarios (slug TEXT PRIMARY KEY, content TEXT);
CREATE TABLE IF NOT EXISTS summaries (session_count INTEGER PRIMARY KEY, content TEXT);
CREATE TABLE IF NOT EXISTS lesson_queue (slot INTEGER PRIMARY KEY, content TEXT);
"""

# ── Meta helpers ──────────────────────────────────────────────────────────────

def meta_get(conn: sqlite3.Connection, key: str, default: Any = None) -> Any:
    row = conn.execute("SELECT value FROM meta WHERE key=?", (key,)).fetchone()
    if row is None:
        return default
    return json.loads(row["value"])


def meta_set(conn: sqlite3.Connection, key: str, value: Any) -> None:
    conn.execute(
        "INSERT INTO meta(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
        (key, json.dumps(value)),
    )


# ── Memory ────────────────────────────────────────────────────────────────────

def get_memory(conn: sqlite3.Connection) -> dict:
    completed = [
        {**dict(r), "weak_areas": json.loads(r["weak_areas"])}
        for r in conn.execute("SELECT * FROM sessions ORDER BY date").fetchall()
    ]
    weak_areas = [dict(r) for r in conn.execute("SELECT * FROM weak_areas").fetchall()]
    for w in weak_areas:
        w["retired"] = bool(w["retired"])
    requiz_queue = [
        r["slug"] for r in conn.execute("SELECT slug FROM requiz_queue ORDER BY position").fetchall()
    ]
    deferred = [dict(r) for r in conn.execute("SELECT * FROM deferred_topics").fetchall()]
    presented = [r["slug"] for r in conn.execute("SELECT slug FROM presented_slugs").fetchall()]
    return {
        "completed": completed,
        "in_progress": meta_get(conn, "in_progress"),
        "requiz_queue": requiz_queue,
        "streak": meta_get(conn, "streak", 0),
        "last_session_date": meta_get(conn, "last_session_date"),
        "weak_areas": weak_areas,
        "deferred_topics": deferred,
        "presented_slugs": presented,
        "preferences": meta_get(conn, "preferences", {}),
        "learner": meta_get(conn, "learner", {}),
    }


def add_session(conn: sqlite3.Connection, entry: dict) -> None:
    conn.execute(
        """INSERT INTO sessions
           (slug,title,domain,date,quiz_score_pct,time_spent_minutes,
            difficulty,weak_areas,notes,next_review_date,kata_passed)
           VALUES(?,?,?,?,?,?,?,?,?,?,?)
           ON CONFLICT(slug) DO NOTHING""",
        (
            entry["slug"], entry.get("title",""), entry.get("domain",""),
            entry.get("date",""), entry.get("quiz_score_pct"),
            entry.get("time_spent_minutes",0), entry.get("difficulty",""),
            json.dumps(entry.get("weak_areas",[])), entry.get("notes",""),
            entry.get("next_review_date"), entry.get("kata_passed"),
        ),
    )


def upsert_weak_area(conn: sqlite3.Connection, phrase: str, flagged_date: str, source_slug: str) -> None:
    conn.execute(
        """INSERT INTO weak_areas(phrase,flagged_date,reinforced_count,retired,source_slug)
           VALUES(?,?,0,0,?) ON CONFLICT(phrase) DO NOTHING""",
        (phrase, flagged_date, source_slug),
    )


def set_requiz_queue(conn: sqlite3.Connection, slugs: list) -> None:
    conn.execute("DELETE FROM requiz_queue")
    for i, slug in enumerate(slugs):
        conn.execute("INSERT OR IGNORE INTO requiz_queue(position,slug) VALUES(?,?)", (i, slug))


def get_requiz_queue(conn: sqlite3.Connection) -> list:
    return [r["slug"] for r in conn.execute("SELECT slug FROM requiz_queue ORDER BY position").fetchall()]


# ── Lessons ───────────────────────────────────────────────────────────────────

def _make_searchable(data: dict) -> str:
    parts = []
    meta = data.get("meta", {})
    if isinstance(meta, dict):
        parts.append(meta.get("title", ""))
    for c in data.get("core_concepts", []):
        if isinstance(c, dict):
            parts.append(c.get("title","") + " " + c.get("explanation",""))
    for ins in data.get("key_insights", []):
        parts.append(ins if isinstance(ins, str) else str(ins))
    return " ".join(parts)


def set_current_lesson(conn: sqlite3.Connection, data: dict) -> None:
    conn.execute("UPDATE lessons SET is_current=0 WHERE is_current=1")
    slug = data.get("meta", {}).get("slug", "current") or "current"
    searchable = _make_searchable(data)
    content = json.dumps(data)
    conn.execute(
        """INSERT INTO lessons(slug,content,searchable_text,is_current)
           VALUES(?,?,?,1)
           ON CONFLICT(slug) DO UPDATE SET content=excluded.content,
           searchable_text=excluded.searchable_text, is_current=1""",
        (slug, content, searchable),
    )


def get_current_lesson(conn: sqlite3.Connection) -> dict | None:
    row = conn.execute("SELECT content FROM lessons WHERE is_current=1").fetchone()
    if row is None:
        return None
    return json.loads(row["content"])


def archive_lesson(conn: sqlite3.Connection, slug: str, data: dict, archived_at: str) -> None:
    searchable = _make_searchable(data)
    content = json.dumps(data)
    conn.execute(
        """INSERT INTO lessons(slug,content,searchable_text,is_current,archived_at)
           VALUES(?,?,?,0,?)
           ON CONFLICT(slug) DO UPDATE SET content=excluded.content,
           searchable_text=excluded.searchable_text, archived_at=excluded.archived_at""",
        (slug, content, searchable, archived_at),
    )
    title = data.get("meta",{}).get("title","") if isinstance(data.get("meta"), dict) else ""
    conn.execute(
        "INSERT OR REPLACE INTO lessons_fts(rowid,slug,title,body) SELECT rowid,slug,?,searchable_text FROM lessons WHERE slug=?",
        (title, slug),
    )


def get_lesson_by_slug(conn: sqlite3.Connection, slug: str) -> dict | None:
    row = conn.execute("SELECT content FROM lessons WHERE slug=?", (slug,)).fetchone()
    if row is None:
        return None
    return json.loads(row["content"])


def search_lessons(conn: sqlite3.Connection, q: str) -> list:
    rows = conn.execute(
        """SELECT l.slug, l.searchable_text
           FROM lessons_fts f JOIN lessons l ON f.rowid=l.rowid
           WHERE lessons_fts MATCH ? AND l.is_current=0
           LIMIT 30""",
        (q,),
    ).fetchall()
    return [dict(r) for r in rows]


# ── Questions ─────────────────────────────────────────────────────────────────

def get_all_questions(conn: sqlite3.Connection) -> list:
    rows = conn.execute("SELECT * FROM questions").fetchall()
    return [{**dict(r), "options": json.loads(r["options"] or "[]")} for r in rows]


def upsert_question(conn: sqlite3.Connection, q: dict) -> None:
    conn.execute(
        """INSERT INTO questions(id,source_slug,source_title,domain,type,question,options,
           answer,explanation,times_asked,times_correct,last_asked)
           VALUES(?,?,?,?,?,?,?,?,?,?,?,?)
           ON CONFLICT(id) DO UPDATE SET times_asked=excluded.times_asked,
           times_correct=excluded.times_correct, last_asked=excluded.last_asked""",
        (q["id"], q.get("source_slug",""), q.get("source_title",""), q.get("domain",""),
         q.get("type",""), q.get("question",""), json.dumps(q.get("options",[])),
         q.get("answer",""), q.get("explanation",""),
         q.get("times_asked",0), q.get("times_correct",0), q.get("last_asked")),
    )


def update_question_stats(conn: sqlite3.Connection, qid: str, times_asked: int, times_correct: int, last_asked: str) -> None:
    conn.execute(
        "UPDATE questions SET times_asked=?,times_correct=?,last_asked=? WHERE id=?",
        (times_asked, times_correct, last_asked, qid),
    )


# ── Notes ─────────────────────────────────────────────────────────────────────

def get_note(conn: sqlite3.Connection, slug: str) -> str:
    row = conn.execute("SELECT note FROM notes WHERE slug=?", (slug,)).fetchone()
    return row["note"] if row else ""


def save_note(conn: sqlite3.Connection, slug: str, note: str, updated: str) -> None:
    conn.execute(
        "INSERT INTO notes(slug,note,updated) VALUES(?,?,?) ON CONFLICT(slug) DO UPDATE SET note=excluded.note,updated=excluded.updated",
        (slug, note, updated),
    )


def get_all_notes(conn: sqlite3.Connection) -> list:
    return [dict(r) for r in conn.execute("SELECT * FROM notes WHERE note!='' ORDER BY updated DESC").fetchall()]


# ── Wishlist ──────────────────────────────────────────────────────────────────

def get_wishlist(conn: sqlite3.Connection) -> list:
    return [dict(r) for r in conn.execute("SELECT * FROM wishlist ORDER BY added_date DESC").fetchall()]


def add_wishlist_item(conn: sqlite3.Connection, item: dict) -> None:
    conn.execute(
        "INSERT INTO wishlist(id,topic,added_date,surfaced) VALUES(?,?,?,?)",
        (item["id"], item["topic"], item["added_date"], 0),
    )


def delete_wishlist_item(conn: sqlite3.Connection, item_id: str) -> bool:
    cur = conn.execute("DELETE FROM wishlist WHERE id=?", (item_id,))
    return cur.rowcount > 0


# ── Bookmarks ─────────────────────────────────────────────────────────────────

def get_bookmarks(conn: sqlite3.Connection) -> list:
    return [dict(r) for r in conn.execute("SELECT * FROM bookmarks ORDER BY created_at DESC").fetchall()]


def add_bookmark(conn: sqlite3.Connection, bm: dict) -> None:
    conn.execute(
        "INSERT INTO bookmarks(id,slug,title,section,content,created_at) VALUES(?,?,?,?,?,?)",
        (bm["id"], bm["slug"], bm["title"], bm["section"], bm["content"], bm["created_at"]),
    )


def delete_bookmark(conn: sqlite3.Connection, bookmark_id: str) -> bool:
    cur = conn.execute("DELETE FROM bookmarks WHERE id=?", (bookmark_id,))
    return cur.rowcount > 0


# ── Curriculum ────────────────────────────────────────────────────────────────

def get_curriculum(conn: sqlite3.Connection) -> dict:
    meta_rows = {r["key"]: json.loads(r["value"]) for r in conn.execute("SELECT * FROM curriculum_meta").fetchall()}
    topic_rows = conn.execute("SELECT * FROM topics").fetchall()

    tracks_meta = meta_rows.get("tracks_meta", [])
    for t in tracks_meta:
        t["ladder"] = [
            {**dict(r), "concepts": json.loads(r["concepts"]), "builds_on": json.loads(r["builds_on"])}
            for r in topic_rows if r["track_id"] == t["id"]
        ]
    return {
        "version": meta_rows.get("version", "2"),
        "goal": meta_rows.get("goal", ""),
        "mix_targets": meta_rows.get("mix_targets", {}),
        "capstone_cadence": meta_rows.get("capstone_cadence", {}),
        "picker_rules": meta_rows.get("picker_rules", {}),
        "tracks": tracks_meta,
        "drills": meta_rows.get("drills", []),
    }


def update_topic_status(conn: sqlite3.Connection, slug: str, status: str) -> None:
    conn.execute("UPDATE topics SET status=? WHERE slug=?", (status, slug))


# ── Scenarios ─────────────────────────────────────────────────────────────────

def get_scenario(conn: sqlite3.Connection, slug: str) -> dict | None:
    row = conn.execute("SELECT content FROM scenarios WHERE slug=?", (slug,)).fetchone()
    return json.loads(row["content"]) if row else None


def save_scenario(conn: sqlite3.Connection, slug: str, data: dict) -> None:
    conn.execute(
        "INSERT INTO scenarios(slug,content) VALUES(?,?) ON CONFLICT(slug) DO UPDATE SET content=excluded.content",
        (slug, json.dumps(data)),
    )


# ── Summaries ─────────────────────────────────────────────────────────────────

def get_latest_summary(conn: sqlite3.Connection) -> dict | None:
    row = conn.execute("SELECT content FROM summaries ORDER BY session_count DESC LIMIT 1").fetchone()
    return json.loads(row["content"]) if row else None


def save_summary(conn: sqlite3.Connection, session_count: int, data: dict) -> None:
    conn.execute(
        "INSERT INTO summaries(session_count,content) VALUES(?,?) ON CONFLICT(session_count) DO UPDATE SET content=excluded.content",
        (session_count, json.dumps(data)),
    )


# ── Lesson Queue ──────────────────────────────────────────────────────────────

def get_queue_slots(conn: sqlite3.Connection) -> list:
    return [r["slot"] for r in conn.execute("SELECT slot FROM lesson_queue ORDER BY slot").fetchall()]


def get_queue_lesson(conn: sqlite3.Connection, slot: int) -> dict | None:
    if slot == 1:
        return get_current_lesson(conn)
    row = conn.execute("SELECT content FROM lesson_queue WHERE slot=?", (slot,)).fetchone()
    return json.loads(row["content"]) if row else None


def set_queue_lesson(conn: sqlite3.Connection, slot: int, data: dict) -> None:
    conn.execute(
        "INSERT INTO lesson_queue(slot,content) VALUES(?,?) ON CONFLICT(slot) DO UPDATE SET content=excluded.content",
        (slot, json.dumps(data)),
    )
