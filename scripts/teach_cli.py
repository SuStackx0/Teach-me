#!/usr/bin/env python3
"""
CLI wrapper for teach skill — replaces direct JSON file reads/writes.
Usage:
  python3 scripts/teach_cli.py get-memory
  python3 scripts/teach_cli.py get-curriculum
  python3 scripts/teach_cli.py get-questions
  python3 scripts/teach_cli.py set-current-lesson  (reads JSON from stdin)
  python3 scripts/teach_cli.py set-memory-key <key> <json-value>
  python3 scripts/teach_cli.py update-topic-status <slug> <status>
  python3 scripts/teach_cli.py get-lesson <slug>
  python3 scripts/teach_cli.py set-queue-lesson <slot>  (reads JSON from stdin)
  python3 scripts/teach_cli.py set-requiz-queue <json-array>
"""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(ROOT / "app"))

from db import get_db, init_db, DB_PATH, get_memory, get_curriculum, get_all_questions
from db import set_current_lesson, get_current_lesson, meta_set, update_topic_status, get_lesson_by_slug
from db import set_queue_lesson, get_queue_lesson, get_queue_slots, set_requiz_queue, upsert_weak_area

db_path = ROOT / "teach.db"
init_db(db_path)
conn = get_db(db_path)

def main():
    if len(sys.argv) < 2:
        print("Usage: teach_cli.py <command> [args...]", file=sys.stderr)
        sys.exit(1)

    cmd = sys.argv[1]

    if cmd == "get-memory":
        print(json.dumps(get_memory(conn), indent=2))

    elif cmd == "get-curriculum":
        print(json.dumps(get_curriculum(conn), indent=2))

    elif cmd == "get-questions":
        print(json.dumps({"questions": get_all_questions(conn)}, indent=2))

    elif cmd == "set-current-lesson":
        data = json.load(sys.stdin)
        set_current_lesson(conn, data)
        conn.commit()
        print("ok")

    elif cmd == "set-memory-key":
        key, value = sys.argv[2], json.loads(sys.argv[3])
        meta_set(conn, key, value)
        conn.commit()
        print("ok")

    elif cmd == "update-topic-status":
        slug, status = sys.argv[2], sys.argv[3]
        update_topic_status(conn, slug, status)
        conn.commit()
        print("ok")

    elif cmd == "get-lesson":
        slug = sys.argv[2]
        data = get_lesson_by_slug(conn, slug)
        print(json.dumps(data if data else {}, indent=2))

    elif cmd == "set-queue-lesson":
        slot = int(sys.argv[2])
        data = json.load(sys.stdin)
        set_queue_lesson(conn, slot, data)
        conn.commit()
        print("ok")

    elif cmd == "set-requiz-queue":
        slugs = json.loads(sys.argv[2])
        set_requiz_queue(conn, slugs)
        conn.commit()
        print("ok")

    elif cmd == "get-current-lesson":
        data = get_current_lesson(conn)
        print(json.dumps(data if data else {}, indent=2))

    elif cmd == "get-queue-slots":
        slots = get_queue_slots(conn)
        print(json.dumps(slots))

    elif cmd == "get-queue-lesson":
        slot = int(sys.argv[2])
        data = get_queue_lesson(conn, slot)
        print(json.dumps(data if data else {}, indent=2))

    else:
        print(f"Unknown command: {cmd}", file=sys.stderr)
        sys.exit(1)

    conn.close()


if __name__ == "__main__":
    main()
