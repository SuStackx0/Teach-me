#!/usr/bin/env python3
"""
One-time migration from .teach/*.json + archive/*.json -> teach.db
Run: python3 scripts/migrate_to_sqlite.py
"""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(ROOT / "app"))

from db import (
    get_db, init_db, DB_PATH, meta_set,
    add_session, upsert_weak_area, set_requiz_queue,
    upsert_question, save_note, add_wishlist_item,
    add_bookmark, archive_lesson, set_current_lesson,
    save_scenario, save_summary,
)

TEACH = ROOT / ".teach"


def load(path: Path, default=None):
    if not path.exists():
        return default
    try:
        return json.loads(path.read_text())
    except Exception as e:
        print(f"  WARN: could not load {path}: {e}")
        return default


def migrate():
    init_db(DB_PATH)
    conn = get_db(DB_PATH)

    # ── memory.json ──────────────────────────────────────────────────────────
    print("Migrating memory.json...")
    memory = load(TEACH / "memory.json", {})
    for entry in memory.get("completed", []):
        add_session(conn, entry)
    meta_set(conn, "in_progress", memory.get("in_progress"))
    meta_set(conn, "streak", memory.get("streak", 0))
    meta_set(conn, "last_session_date", memory.get("last_session_date"))
    meta_set(conn, "preferences", memory.get("preferences", {}))
    meta_set(conn, "learner", memory.get("learner", {}))
    for w in memory.get("weak_areas", []):
        if isinstance(w, str):
            upsert_weak_area(conn, w, None, None)
        else:
            upsert_weak_area(conn, w["phrase"], w.get("flagged_date"), w.get("source_slug"))
            conn.execute(
                "UPDATE weak_areas SET reinforced_count=?,retired=? WHERE phrase=?",
                (w.get("reinforced_count", 0), int(w.get("retired", False)), w["phrase"]),
            )
    set_requiz_queue(conn, memory.get("requiz_queue", []))
    for d in memory.get("deferred_topics", []):
        conn.execute(
            "INSERT OR IGNORE INTO deferred_topics(slug,title,domain,suggest_after,reason) VALUES(?,?,?,?,?)",
            (d["slug"], d.get("title",""), d.get("domain",""), d.get("suggest_after"), d.get("reason","")),
        )
    for slug in memory.get("presented_slugs", []):
        conn.execute("INSERT OR IGNORE INTO presented_slugs(slug) VALUES(?)", (slug,))
    conn.commit()
    print(f"  sessions: {len(memory.get('completed', []))}, weak_areas: {len(memory.get('weak_areas', []))}")

    # ── curriculum-v2.json ────────────────────────────────────────────────────
    print("Migrating curriculum-v2.json...")
    curriculum = load(TEACH / "curriculum-v2.json", {})
    tracks_meta = []
    for t in curriculum.get("tracks", []):
        ladder = t.pop("ladder", [])
        tracks_meta.append(t)
        for item in ladder:
            conn.execute(
                """INSERT OR IGNORE INTO topics(slug,track_id,title,concepts,difficulty,estimated_minutes,status,builds_on)
                   VALUES(?,?,?,?,?,?,?,?)""",
                (item["slug"], t["id"], item.get("title",""),
                 json.dumps(item.get("concepts",[])), item.get("difficulty",""),
                 item.get("estimated_minutes"), item.get("status","not_started"),
                 json.dumps(item.get("builds_on",[]))),
            )
    conn.execute(
        "INSERT OR REPLACE INTO curriculum_meta(key,value) VALUES('tracks_meta',?)",
        (json.dumps(tracks_meta),),
    )
    for key in ("version","goal","mix_targets","capstone_cadence","picker_rules","drills"):
        if key in curriculum:
            conn.execute(
                "INSERT OR REPLACE INTO curriculum_meta(key,value) VALUES(?,?)",
                (key, json.dumps(curriculum[key])),
            )
    conn.commit()
    print(f"  topics: {conn.execute('SELECT COUNT(*) FROM topics').fetchone()[0]}")

    # ── question_bank.json ────────────────────────────────────────────────────
    print("Migrating question_bank.json...")
    qb = load(TEACH / "question_bank.json", {"questions": []})
    for q in qb.get("questions", []):
        upsert_question(conn, q)
    conn.commit()
    print(f"  questions: {conn.execute('SELECT COUNT(*) FROM questions').fetchone()[0]}")

    # ── notes.json ────────────────────────────────────────────────────────────
    print("Migrating notes.json...")
    notes = load(TEACH / "notes.json", {})
    for slug, entry in notes.items():
        if isinstance(entry, dict):
            save_note(conn, slug, entry.get("note",""), entry.get("updated",""))
    conn.commit()

    # ── wishlist.json ─────────────────────────────────────────────────────────
    print("Migrating wishlist.json...")
    wishlist = load(TEACH / "wishlist.json", [])
    for item in wishlist:
        add_wishlist_item(conn, item)
    conn.commit()

    # ── bookmarks.json ────────────────────────────────────────────────────────
    print("Migrating bookmarks.json...")
    bookmarks = load(TEACH / "bookmarks.json", [])
    for bm in bookmarks:
        add_bookmark(conn, bm)
    conn.commit()

    # ── archive/*.json ────────────────────────────────────────────────────────
    print("Migrating archive/*.json...")
    archive_dir = TEACH / "archive"
    count = 0
    if archive_dir.exists():
        for f in archive_dir.glob("*.json"):
            data = load(f)
            if data:
                archive_lesson(conn, f.stem, data, str(f.stat().st_mtime))
                count += 1
    conn.commit()
    print(f"  lessons archived: {count}")

    # ── current_lesson.json ───────────────────────────────────────────────────
    print("Migrating current_lesson.json...")
    current = load(TEACH / "current_lesson.json")
    if current:
        set_current_lesson(conn, current)
        conn.commit()
        print("  current lesson set")

    # ── scenarios/*.json ──────────────────────────────────────────────────────
    print("Migrating scenarios/*.json...")
    scenarios_dir = TEACH / "scenarios"
    count = 0
    if scenarios_dir.exists():
        for f in scenarios_dir.glob("*.json"):
            data = load(f)
            if data:
                save_scenario(conn, f.stem, data)
                count += 1
    conn.commit()
    print(f"  scenarios: {count}")

    # ── summaries/*.json ──────────────────────────────────────────────────────
    print("Migrating summaries/*.json...")
    summaries_dir = TEACH / "summaries"
    count = 0
    if summaries_dir.exists():
        for f in summaries_dir.glob("summary_*.json"):
            data = load(f)
            if data:
                try:
                    n = int(f.stem.split("_")[1])
                    save_summary(conn, n, data)
                    count += 1
                except Exception:
                    pass
    conn.commit()
    print(f"  summaries: {count}")

    # ── lesson_queue.json + queue_lesson_*.json ───────────────────────────────
    print("Migrating lesson queue...")
    for slot_num in range(2, 10):
        qf = TEACH / f"queue_lesson_{slot_num}.json"
        data = load(qf)
        if data:
            conn.execute(
                "INSERT OR REPLACE INTO lesson_queue(slot,content) VALUES(?,?)",
                (slot_num, json.dumps(data)),
            )
    conn.commit()

    conn.close()
    print("\nMigration complete.")
    print(f"DB: {DB_PATH} ({DB_PATH.stat().st_size / 1024:.1f} KB)")


if __name__ == "__main__":
    migrate()
