"""
teach-me FastAPI backend
Serves lesson/memory JSON and handles session logging.

Run:
    uvicorn server:app --port 8001 --reload
"""

import json
import shutil
from datetime import datetime, timedelta
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

app = FastAPI(title="teach-me API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:4173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

BASE = Path(__file__).parent.parent / ".teach"
LESSON_PATH = BASE / "current_lesson.json"
MEMORY_PATH = BASE / "memory.json"
ARCHIVE_DIR = BASE / "archive"


def _read_json(path: Path) -> dict:
    if not path.exists():
        raise HTTPException(status_code=404, detail=f"{path.name} not found")
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as e:
        raise HTTPException(status_code=500, detail=f"JSON parse error: {e}")


@app.get("/api/lesson")
def get_lesson():
    return _read_json(LESSON_PATH)


@app.get("/api/memory")
def get_memory():
    return _read_json(MEMORY_PATH)


class SessionLog(BaseModel):
    slug: str
    title: str
    domain: str = ""
    debrief_phrase: str = ""
    quiz_score_input: str = ""
    time_spent_minutes: float = 0.0


@app.post("/api/session/log")
def log_session(payload: SessionLog):
    try:
        memory = json.loads(MEMORY_PATH.read_text()) if MEMORY_PATH.exists() else {}
    except json.JSONDecodeError:
        memory = {}

    memory.setdefault("completed", [])
    memory.setdefault("streak", 0)
    memory.setdefault("weak_areas", [])
    memory.setdefault("last_session_date", None)

    today = datetime.now().strftime("%Y-%m-%d")

    # Parse quiz score
    quiz_score_pct = None
    qs = (payload.quiz_score_input or "").strip()
    if qs and qs.lower() != "skipped":
        try:
            parts = qs.split("/")
            quiz_score_pct = float(parts[0]) / float(parts[1])
        except Exception:
            pass

    days = 7
    if quiz_score_pct is not None:
        days = 14 if quiz_score_pct >= 0.8 else (7 if quiz_score_pct >= 0.6 else 2)
    next_review = (datetime.now() + timedelta(days=days)).strftime("%Y-%m-%d")

    entry = {
        "slug": payload.slug,
        "title": payload.title,
        "date": today,
        "quiz_score_pct": quiz_score_pct,
        "time_spent_minutes": payload.time_spent_minutes,
        "weak_areas": [payload.debrief_phrase] if payload.debrief_phrase else [],
        "notes": "",
        "next_review_date": next_review,
    }

    existing_slugs = [c.get("slug", "") for c in memory["completed"]]
    if payload.slug not in existing_slugs:
        memory["completed"].append(entry)

    # Streak
    last = memory.get("last_session_date")
    yesterday = (datetime.now() - timedelta(days=1)).strftime("%Y-%m-%d")
    if last == yesterday:
        memory["streak"] = memory.get("streak", 0) + 1
    elif last == today:
        pass
    else:
        memory["streak"] = 1
    memory["last_session_date"] = today
    memory["in_progress"] = None

    # Weak areas
    if payload.debrief_phrase:
        weak_areas = memory.get("weak_areas", [])
        normalized = []
        for w in weak_areas:
            if isinstance(w, str):
                normalized.append({"phrase": w, "flagged_date": None, "reinforced_count": 0, "retired": False, "source_slug": None})
            else:
                normalized.append(w)
        existing_phrases = [w["phrase"] for w in normalized if not w.get("retired", False)]
        if payload.debrief_phrase not in existing_phrases:
            normalized.append({
                "phrase": payload.debrief_phrase,
                "flagged_date": today,
                "reinforced_count": 0,
                "retired": False,
                "source_slug": payload.slug,
            })
        memory["weak_areas"] = normalized

    MEMORY_PATH.write_text(json.dumps(memory, indent=2))

    # Archive
    ARCHIVE_DIR.mkdir(exist_ok=True)
    if LESSON_PATH.exists():
        shutil.copy(LESSON_PATH, ARCHIVE_DIR / f"{payload.slug}.json")

    return {"ok": True, "streak": memory["streak"]}


@app.post("/api/chat")
def chat_placeholder():
    raise HTTPException(status_code=501, detail="Chat not implemented yet")
