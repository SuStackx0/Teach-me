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
    conn = sqlite3.connect(str(path), check_same_thread=False, isolation_level=None)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA synchronous=NORMAL")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


def init_db(path: Path = DB_PATH) -> None:
    conn = get_db(path)
    conn.executescript(SCHEMA)
    # Migration: add self_rating column if it doesn't exist yet
    try:
        conn.execute("ALTER TABLE sessions ADD COLUMN self_rating INTEGER DEFAULT NULL")
    except Exception:
        pass
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

-- ── Annotations (Group 1) ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS highlights (
    id TEXT PRIMARY KEY,
    slug TEXT NOT NULL,
    section TEXT NOT NULL,
    text TEXT NOT NULL,
    color TEXT DEFAULT 'yellow',
    created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_highlights_slug ON highlights(slug);
CREATE TABLE IF NOT EXISTS inline_comments (
    id TEXT PRIMARY KEY,
    slug TEXT NOT NULL,
    section TEXT NOT NULL,
    comment TEXT NOT NULL,
    created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_inline_comments_slug ON inline_comments(slug);
CREATE TABLE IF NOT EXISTS glossary (
    id TEXT PRIMARY KEY,
    term TEXT NOT NULL,
    definition TEXT NOT NULL,
    source_slug TEXT DEFAULT '',
    created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_glossary_term ON glossary(term);
CREATE TABLE IF NOT EXISTS snippets (
    id TEXT PRIMARY KEY,
    slug TEXT NOT NULL,
    title TEXT NOT NULL,
    code TEXT NOT NULL,
    language TEXT DEFAULT '',
    tag TEXT DEFAULT '',
    created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_snippets_slug ON snippets(slug);

-- ── Progress & Recall (Group 2) ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS section_progress (
    slug TEXT NOT NULL,
    section TEXT NOT NULL,
    checked INTEGER DEFAULT 0,
    visited_at TEXT,
    PRIMARY KEY (slug, section)
);

-- ── Organization (Group 3) ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tags (
    id TEXT PRIMARY KEY,
    name TEXT UNIQUE NOT NULL
);
CREATE TABLE IF NOT EXISTS lesson_tags (
    slug TEXT NOT NULL,
    tag_id TEXT NOT NULL,
    PRIMARY KEY (slug, tag_id),
    FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_lesson_tags_slug ON lesson_tags(slug);
CREATE TABLE IF NOT EXISTS collections (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT DEFAULT '',
    created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS collection_lessons (
    collection_id TEXT NOT NULL,
    slug TEXT NOT NULL,
    position INTEGER DEFAULT 0,
    PRIMARY KEY (collection_id, slug),
    FOREIGN KEY (collection_id) REFERENCES collections(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_collection_lessons_cid ON collection_lessons(collection_id);
CREATE TABLE IF NOT EXISTS pinned_lessons (
    slug TEXT PRIMARY KEY,
    pinned_at TEXT NOT NULL,
    position INTEGER DEFAULT 0
);
CREATE TABLE IF NOT EXISTS lesson_connections (
    id TEXT PRIMARY KEY,
    from_slug TEXT NOT NULL,
    to_slug TEXT NOT NULL,
    label TEXT DEFAULT '',
    created_at TEXT NOT NULL,
    UNIQUE(from_slug, to_slug)
);
CREATE INDEX IF NOT EXISTS idx_connections_from ON lesson_connections(from_slug);
CREATE INDEX IF NOT EXISTS idx_connections_to ON lesson_connections(to_slug);

-- ── Planning & Export (Group 4) ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS study_plans (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT DEFAULT '',
    target_date TEXT,
    created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS study_plan_lessons (
    plan_id TEXT NOT NULL,
    slug TEXT NOT NULL,
    position INTEGER DEFAULT 0,
    done INTEGER DEFAULT 0,
    PRIMARY KEY (plan_id, slug),
    FOREIGN KEY (plan_id) REFERENCES study_plans(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_spl_plan ON study_plan_lessons(plan_id);
CREATE TABLE IF NOT EXISTS flashcards (
    id TEXT PRIMARY KEY,
    source_slug TEXT DEFAULT '',
    front TEXT NOT NULL,
    back TEXT NOT NULL,
    tag TEXT DEFAULT '',
    created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_flashcards_source ON flashcards(source_slug);
CREATE TABLE IF NOT EXISTS lesson_visits (
    slug TEXT PRIMARY KEY,
    last_visited TEXT NOT NULL,
    content_hash TEXT DEFAULT ''
);
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
           WHERE lessons_fts MATCH ? AND l.archived_at IS NOT NULL
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


def activate_queue_slot(conn: sqlite3.Connection, slot: int) -> bool:
    """Promote queue slot N to slot 1, shifting slots 1..N-1 down by one.

    Slot 1's content is also written into the lessons table as the current
    lesson. Does NOT commit — caller commits.
    """
    if slot == 1:
        return True

    row = conn.execute("SELECT content FROM lesson_queue WHERE slot=?", (slot,)).fetchone()
    if row is None:
        return False
    target_content = json.loads(row["content"])

    # Shift: copy slot i-1 into slot i, for i from N down to 2.
    for i in range(slot, 1, -1):
        prev = conn.execute("SELECT content FROM lesson_queue WHERE slot=?", (i - 1,)).fetchone()
        if prev is None:
            continue
        conn.execute(
            "INSERT INTO lesson_queue(slot,content) VALUES(?,?) "
            "ON CONFLICT(slot) DO UPDATE SET content=excluded.content",
            (i, prev["content"]),
        )

    # Write target content into slot 1.
    conn.execute(
        "INSERT INTO lesson_queue(slot,content) VALUES(1,?) "
        "ON CONFLICT(slot) DO UPDATE SET content=excluded.content",
        (json.dumps(target_content),),
    )

    # Keep the lessons table in sync with the newly activated slot 1.
    set_current_lesson(conn, target_content)
    return True


def remove_and_compact_queue(conn: sqlite3.Connection) -> None:
    """Delete slot 1 and re-number remaining rows contiguously from 1.

    Keeps the lessons table's current lesson in sync with the new slot 1.
    Does NOT commit — caller commits.
    """
    # Read all slots except slot 1 before touching anything.
    rows = conn.execute(
        "SELECT content FROM lesson_queue WHERE slot != 1 ORDER BY slot ASC"
    ).fetchall()
    remaining = [r["content"] for r in rows]

    # Write new slots first (UPSERT so no gap is ever visible), then delete
    # any trailing slot that's no longer needed.
    old_count = len(conn.execute("SELECT slot FROM lesson_queue").fetchall())
    for new_slot, content in enumerate(remaining, start=1):
        conn.execute(
            "INSERT INTO lesson_queue(slot,content) VALUES(?,?) "
            "ON CONFLICT(slot) DO UPDATE SET content=excluded.content",
            (new_slot, content),
        )
    # Remove any slots beyond the new length (including old slot 1 if untouched).
    new_count = len(remaining)
    for dead_slot in range(new_count + 1, old_count + 1):
        conn.execute("DELETE FROM lesson_queue WHERE slot=?", (dead_slot,))

    if remaining:
        set_current_lesson(conn, json.loads(remaining[0]))
    else:
        conn.execute("UPDATE lessons SET is_current=0 WHERE is_current=1")


# ── Highlights ────────────────────────────────────────────────────────────────

def get_highlights(conn, slug=None):
    if slug:
        rows = conn.execute("SELECT * FROM highlights WHERE slug=? ORDER BY created_at DESC", (slug,)).fetchall()
    else:
        rows = conn.execute("SELECT * FROM highlights ORDER BY created_at DESC").fetchall()
    return [dict(r) for r in rows]


def add_highlight(conn, h):
    conn.execute(
        "INSERT INTO highlights(id,slug,section,text,color,created_at) VALUES(?,?,?,?,?,?)",
        (h["id"], h["slug"], h["section"], h["text"], h.get("color", "yellow"), h["created_at"]),
    )


def delete_highlight(conn, hid):
    cur = conn.execute("DELETE FROM highlights WHERE id=?", (hid,))
    return cur.rowcount > 0


# ── Inline Comments ───────────────────────────────────────────────────────────

def get_inline_comments(conn, slug):
    rows = conn.execute("SELECT * FROM inline_comments WHERE slug=? ORDER BY created_at DESC", (slug,)).fetchall()
    return [dict(r) for r in rows]


def add_inline_comment(conn, c):
    conn.execute(
        "INSERT INTO inline_comments(id,slug,section,comment,created_at) VALUES(?,?,?,?,?)",
        (c["id"], c["slug"], c["section"], c["comment"], c["created_at"]),
    )


def delete_inline_comment(conn, cid):
    cur = conn.execute("DELETE FROM inline_comments WHERE id=?", (cid,))
    return cur.rowcount > 0


def update_inline_comment(conn, cid, comment):
    conn.execute("UPDATE inline_comments SET comment=? WHERE id=?", (comment, cid))


# ── Glossary ──────────────────────────────────────────────────────────────────

def get_glossary(conn):
    rows = conn.execute("SELECT * FROM glossary ORDER BY term COLLATE NOCASE").fetchall()
    return [dict(r) for r in rows]


def add_glossary_entry(conn, entry):
    conn.execute(
        "INSERT INTO glossary(id,term,definition,source_slug,created_at) VALUES(?,?,?,?,?)",
        (entry["id"], entry["term"], entry["definition"], entry.get("source_slug", ""), entry["created_at"]),
    )


def delete_glossary_entry(conn, eid):
    cur = conn.execute("DELETE FROM glossary WHERE id=?", (eid,))
    return cur.rowcount > 0


def update_glossary_entry(conn, eid, term, definition):
    conn.execute("UPDATE glossary SET term=?,definition=? WHERE id=?", (term, definition, eid))


# ── Snippets ──────────────────────────────────────────────────────────────────

def get_snippets(conn, tag=None):
    if tag:
        rows = conn.execute("SELECT * FROM snippets WHERE tag=? ORDER BY created_at DESC", (tag,)).fetchall()
    else:
        rows = conn.execute("SELECT * FROM snippets ORDER BY created_at DESC").fetchall()
    return [dict(r) for r in rows]


def add_snippet(conn, s):
    conn.execute(
        "INSERT INTO snippets(id,slug,title,code,language,tag,created_at) VALUES(?,?,?,?,?,?,?)",
        (s["id"], s["slug"], s["title"], s["code"], s.get("language", ""), s.get("tag", ""), s["created_at"]),
    )


def delete_snippet(conn, sid):
    cur = conn.execute("DELETE FROM snippets WHERE id=?", (sid,))
    return cur.rowcount > 0


# ── Self-rating ────────────────────────────────────────────────────────────────

def set_self_rating(conn, slug, rating):
    conn.execute("UPDATE sessions SET self_rating=? WHERE slug=?", (rating, slug))


def get_self_rating(conn, slug):
    row = conn.execute("SELECT self_rating FROM sessions WHERE slug=?", (slug,)).fetchone()
    return row["self_rating"] if row else None


# ── Section Progress ───────────────────────────────────────────────────────────

def get_section_progress(conn, slug):
    rows = conn.execute(
        "SELECT section, checked, visited_at FROM section_progress WHERE slug=?", (slug,)
    ).fetchall()
    return {r["section"]: {"checked": bool(r["checked"]), "visited_at": r["visited_at"]} for r in rows}


def set_section_visited(conn, slug, section, visited_at):
    conn.execute(
        """INSERT INTO section_progress(slug,section,checked,visited_at) VALUES(?,?,0,?)
           ON CONFLICT(slug,section) DO UPDATE SET visited_at=excluded.visited_at""",
        (slug, section, visited_at),
    )


def set_section_checked(conn, slug, section, checked):
    from datetime import datetime as _dt
    now = _dt.now().strftime("%Y-%m-%dT%H:%M:%S")
    conn.execute(
        """INSERT INTO section_progress(slug,section,checked,visited_at) VALUES(?,?,?,?)
           ON CONFLICT(slug,section) DO UPDATE SET checked=excluded.checked, visited_at=excluded.visited_at""",
        (slug, section, int(checked), now),
    )


# ── Tags ──────────────────────────────────────────────────────────────────────

def get_all_tags(conn):
    rows = conn.execute(
        """SELECT t.id, t.name, COUNT(lt.slug) as lesson_count
           FROM tags t LEFT JOIN lesson_tags lt ON t.id=lt.tag_id
           GROUP BY t.id ORDER BY t.name COLLATE NOCASE"""
    ).fetchall()
    return [dict(r) for r in rows]


def get_tags_for_lesson(conn, slug):
    rows = conn.execute(
        """SELECT t.id, t.name FROM tags t
           JOIN lesson_tags lt ON t.id=lt.tag_id WHERE lt.slug=?
           ORDER BY t.name COLLATE NOCASE""",
        (slug,),
    ).fetchall()
    return [dict(r) for r in rows]


def add_tag(conn, tag_id, name):
    conn.execute("INSERT OR IGNORE INTO tags(id,name) VALUES(?,?)", (tag_id, name))


def tag_lesson(conn, slug, tag_id):
    conn.execute("INSERT OR IGNORE INTO lesson_tags(slug,tag_id) VALUES(?,?)", (slug, tag_id))


def untag_lesson(conn, slug, tag_id):
    conn.execute("DELETE FROM lesson_tags WHERE slug=? AND tag_id=?", (slug, tag_id))


def get_lessons_by_tag(conn, tag_name):
    rows = conn.execute(
        "SELECT lt.slug FROM lesson_tags lt JOIN tags t ON lt.tag_id=t.id WHERE t.name=?",
        (tag_name,),
    ).fetchall()
    return [r["slug"] for r in rows]


# ── Collections ───────────────────────────────────────────────────────────────

def get_collections(conn):
    rows = conn.execute("SELECT * FROM collections ORDER BY created_at DESC").fetchall()
    result = []
    for r in rows:
        c = dict(r)
        lesson_rows = conn.execute(
            "SELECT slug FROM collection_lessons WHERE collection_id=? ORDER BY position", (c["id"],)
        ).fetchall()
        c["slugs"] = [l["slug"] for l in lesson_rows]
        c["lesson_count"] = len(c["slugs"])
        result.append(c)
    return result


def create_collection(conn, col):
    conn.execute(
        "INSERT INTO collections(id,name,description,created_at) VALUES(?,?,?,?)",
        (col["id"], col["name"], col.get("description", ""), col["created_at"]),
    )


def delete_collection(conn, cid):
    cur = conn.execute("DELETE FROM collections WHERE id=?", (cid,))
    return cur.rowcount > 0


def add_to_collection(conn, collection_id, slug):
    max_pos = conn.execute(
        "SELECT MAX(position) as m FROM collection_lessons WHERE collection_id=?", (collection_id,)
    ).fetchone()["m"] or 0
    conn.execute(
        "INSERT OR IGNORE INTO collection_lessons(collection_id,slug,position) VALUES(?,?,?)",
        (collection_id, slug, max_pos + 1),
    )


def remove_from_collection(conn, collection_id, slug):
    conn.execute("DELETE FROM collection_lessons WHERE collection_id=? AND slug=?", (collection_id, slug))


# ── Pins ──────────────────────────────────────────────────────────────────────

def get_pinned(conn):
    rows = conn.execute("SELECT slug, pinned_at, position FROM pinned_lessons ORDER BY position").fetchall()
    return [dict(r) for r in rows]


def pin_lesson(conn, slug):
    count = conn.execute("SELECT COUNT(*) as c FROM pinned_lessons").fetchone()["c"]
    if count >= 3:
        return False
    from datetime import datetime as _dt
    conn.execute(
        "INSERT OR IGNORE INTO pinned_lessons(slug,pinned_at,position) VALUES(?,?,?)",
        (slug, _dt.now().strftime("%Y-%m-%dT%H:%M:%S"), count),
    )
    return True


def unpin_lesson(conn, slug):
    cur = conn.execute("DELETE FROM pinned_lessons WHERE slug=?", (slug,))
    return cur.rowcount > 0


# ── Connections ───────────────────────────────────────────────────────────────

def get_connections(conn, slug):
    rows = conn.execute(
        "SELECT * FROM lesson_connections WHERE from_slug=? OR to_slug=?", (slug, slug)
    ).fetchall()
    return [dict(r) for r in rows]


def add_connection(conn, conn_obj):
    conn.execute(
        "INSERT OR IGNORE INTO lesson_connections(id,from_slug,to_slug,label,created_at) VALUES(?,?,?,?,?)",
        (conn_obj["id"], conn_obj["from_slug"], conn_obj["to_slug"], conn_obj.get("label", ""), conn_obj["created_at"]),
    )


def delete_connection(conn, cid):
    cur = conn.execute("DELETE FROM lesson_connections WHERE id=?", (cid,))
    return cur.rowcount > 0


# ── Study Planner ─────────────────────────────────────────────────────────────

def get_study_plans(conn):
    rows = conn.execute("SELECT * FROM study_plans ORDER BY created_at DESC").fetchall()
    result = []
    for r in rows:
        p = dict(r)
        lessons = conn.execute(
            "SELECT slug, position, done FROM study_plan_lessons WHERE plan_id=? ORDER BY position", (p["id"],)
        ).fetchall()
        p["lessons"] = [dict(l) for l in lessons]
        done = sum(1 for l in p["lessons"] if l["done"])
        p["progress"] = f"{done}/{len(p['lessons'])}"
        result.append(p)
    return result


def create_study_plan(conn, plan):
    conn.execute(
        "INSERT INTO study_plans(id,name,description,target_date,created_at) VALUES(?,?,?,?,?)",
        (plan["id"], plan["name"], plan.get("description", ""), plan.get("target_date"), plan["created_at"]),
    )


def delete_study_plan(conn, pid):
    cur = conn.execute("DELETE FROM study_plans WHERE id=?", (pid,))
    return cur.rowcount > 0


def add_to_plan(conn, plan_id, slug):
    max_pos = conn.execute(
        "SELECT MAX(position) as m FROM study_plan_lessons WHERE plan_id=?", (plan_id,)
    ).fetchone()["m"] or 0
    conn.execute(
        "INSERT OR IGNORE INTO study_plan_lessons(plan_id,slug,position,done) VALUES(?,?,?,0)",
        (plan_id, slug, max_pos + 1),
    )


def remove_from_plan(conn, plan_id, slug):
    conn.execute("DELETE FROM study_plan_lessons WHERE plan_id=? AND slug=?", (plan_id, slug))


def toggle_plan_lesson_done(conn, plan_id, slug, done):
    conn.execute(
        "UPDATE study_plan_lessons SET done=? WHERE plan_id=? AND slug=?", (int(done), plan_id, slug)
    )


# ── Flashcards ────────────────────────────────────────────────────────────────

def get_flashcards(conn, tag=None, source_slug=None):
    if source_slug:
        rows = conn.execute(
            "SELECT * FROM flashcards WHERE source_slug=? ORDER BY created_at DESC", (source_slug,)
        ).fetchall()
    elif tag:
        rows = conn.execute(
            "SELECT * FROM flashcards WHERE tag=? ORDER BY created_at DESC", (tag,)
        ).fetchall()
    else:
        rows = conn.execute("SELECT * FROM flashcards ORDER BY created_at DESC").fetchall()
    return [dict(r) for r in rows]


def add_flashcard(conn, card):
    conn.execute(
        "INSERT INTO flashcards(id,source_slug,front,back,tag,created_at) VALUES(?,?,?,?,?,?)",
        (card["id"], card.get("source_slug", ""), card["front"], card["back"], card.get("tag", ""), card["created_at"]),
    )


def delete_flashcard(conn, fid):
    cur = conn.execute("DELETE FROM flashcards WHERE id=?", (fid,))
    return cur.rowcount > 0


# ── Lesson Visits ─────────────────────────────────────────────────────────────

def record_lesson_visit(conn, slug, content):
    import hashlib
    h = hashlib.md5(content.encode()).hexdigest()[:12]
    from datetime import datetime as _dt
    conn.execute(
        """INSERT INTO lesson_visits(slug,last_visited,content_hash) VALUES(?,?,?)
           ON CONFLICT(slug) DO UPDATE SET last_visited=excluded.last_visited, content_hash=excluded.content_hash""",
        (slug, _dt.now().strftime("%Y-%m-%dT%H:%M:%S"), h),
    )
    return h


def get_lesson_visit(conn, slug):
    row = conn.execute("SELECT * FROM lesson_visits WHERE slug=?", (slug,)).fetchone()
    return dict(row) if row else None
