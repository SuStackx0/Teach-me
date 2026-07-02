"""
teach-me FastAPI backend
Serves lesson/memory JSON and handles session logging.

Run:
    uvicorn server:app --port 8001 --reload
"""

import json
import os
import shutil
from datetime import datetime, timedelta
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

app = FastAPI(title="teach-me API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

BASE = Path(os.getenv("TEACH_DATA_DIR", str(Path(__file__).parent.parent / ".teach")))
LESSON_PATH = BASE / "current_lesson.json"
MEMORY_PATH = BASE / "memory.json"
ARCHIVE_DIR = BASE / "archive"
CURRICULUM_PATH = BASE / "curriculum-v2.json"

DOMAIN_DISPLAY = {
    "llm-arch": "LLM Architecture",
    "inference": "Inference & Serving",
    "training": "Training & Alignment",
    "agentic": "Agentic Systems",
    "backend": "Backend Systems",
    "system-design": "System Design",
    "mlops": "MLOps",
    "ml-ds": "ML/DS & Evaluation",
    "cross-domain": "Cross-Domain",
    "custom": "Custom Topics",
}
DOMAIN_ORDER = ["llm-arch", "inference", "training", "agentic", "ml-ds", "mlops", "backend", "system-design", "cross-domain", "custom"]


def _read_json(path: Path) -> dict:
    if not path.exists():
        raise HTTPException(status_code=404, detail=f"{path.name} not found")
    try:
        text = path.read_text(encoding="utf-8")
    except OSError:
        # APFS-compressed/dataless files cause EDEADLK in Docker — rewrite to hydrate
        try:
            import tempfile
            data = json.loads(path.read_bytes())
            tmp = path.with_suffix(".tmp")
            tmp.write_text(json.dumps(data), encoding="utf-8")
            tmp.replace(path)
            return data
        except Exception as e:
            raise HTTPException(status_code=503, detail=f"File read error: {e}")
    try:
        return json.loads(text)
    except json.JSONDecodeError as e:
        raise HTTPException(status_code=500, detail=f"JSON parse error: {e}")


@app.get("/api/lesson")
def get_lesson():
    return _read_json(LESSON_PATH)


@app.get("/api/library")
def get_library():
    try:
        memory = json.loads(MEMORY_PATH.read_text()) if MEMORY_PATH.exists() else {}
    except json.JSONDecodeError:
        memory = {}

    completed = memory.get("completed", [])
    streak = memory.get("streak", 0)

    # Group by domain
    groups_dict: dict = {}
    for entry in completed:
        domain_key = entry.get("domain", "")
        if domain_key not in groups_dict:
            groups_dict[domain_key] = []
        slug = entry.get("slug", "")
        archived = (ARCHIVE_DIR / f"{slug}.json").exists()
        groups_dict[domain_key].append({
            "slug": slug,
            "title": entry.get("title", ""),
            "date": entry.get("date", ""),
            "quiz_score_pct": entry.get("quiz_score_pct"),
            "time_spent_minutes": entry.get("time_spent_minutes", 0),
            "difficulty": entry.get("difficulty", ""),
            "archived": archived,
        })

    # Build ordered groups
    groups = []
    seen: set = set()
    for key in DOMAIN_ORDER:
        if key in groups_dict:
            groups.append({
                "domain": DOMAIN_DISPLAY.get(key, key),
                "domain_key": key,
                "lessons": groups_dict[key],
            })
            seen.add(key)
    for key, lessons in groups_dict.items():
        if key not in seen:
            groups.append({
                "domain": DOMAIN_DISPLAY.get(key, key) or "General",
                "domain_key": key,
                "lessons": lessons,
            })

    return {"groups": groups, "total": len(completed), "streak": streak}


@app.get("/api/lesson/{slug}")
def get_lesson_by_slug(slug: str):
    path = ARCHIVE_DIR / f"{slug}.json"
    if not path.exists():
        raise HTTPException(status_code=404, detail="Lesson not found")
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as e:
        raise HTTPException(status_code=500, detail=f"JSON parse error: {e}")


@app.get("/api/memory")
def get_memory():
    return _read_json(MEMORY_PATH)


def _load_json_safe(path: Path) -> dict:
    try:
        if not path.exists():
            return {}
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return {}


@app.get("/api/stats")
def get_stats():
    memory = _load_json_safe(MEMORY_PATH)
    curriculum = _load_json_safe(CURRICULUM_PATH)

    completed = memory.get("completed", []) if isinstance(memory, dict) else []
    if not isinstance(completed, list):
        completed = []
    streak = memory.get("streak", 0) if isinstance(memory, dict) else 0

    tracks_raw = curriculum.get("tracks", []) if isinstance(curriculum, dict) else []
    if not isinstance(tracks_raw, list):
        tracks_raw = []
    mix_targets = curriculum.get("mix_targets", {}) if isinstance(curriculum, dict) else {}
    if not isinstance(mix_targets, dict):
        mix_targets = {}

    # Map slug -> track id, using the curriculum ladder
    slug_to_track: dict = {}
    for t in tracks_raw:
        if not isinstance(t, dict):
            continue
        track_id = t.get("id", "")
        ladder = t.get("ladder", [])
        if not isinstance(ladder, list):
            continue
        for item in ladder:
            if isinstance(item, dict) and item.get("slug"):
                slug_to_track[item["slug"]] = track_id

    completed_count_by_track: dict = {}
    for entry in completed:
        if not isinstance(entry, dict):
            continue
        slug = entry.get("slug", "")
        track_id = slug_to_track.get(slug)
        if track_id:
            completed_count_by_track[track_id] = completed_count_by_track.get(track_id, 0) + 1

    total_completed_in_tracks = sum(completed_count_by_track.values())

    tracks_out = []
    for t in tracks_raw:
        if not isinstance(t, dict):
            continue
        track_id = t.get("id", "")
        title = t.get("title", track_id)
        ladder = t.get("ladder", [])
        total = len(ladder) if isinstance(ladder, list) else 0
        completed_n = completed_count_by_track.get(track_id, 0)
        target_pct = mix_targets.get(track_id)
        actual_pct = (completed_n / total_completed_in_tracks) if total_completed_in_tracks > 0 else 0
        tracks_out.append({
            "id": track_id,
            "title": title,
            "completed": completed_n,
            "total": total,
            "target_pct": target_pct,
            "actual_pct": actual_pct,
        })

    # Score trend — completed sorted by date, nulls included
    def _sort_key(entry):
        return entry.get("date") or ""

    score_trend = []
    for entry in sorted((e for e in completed if isinstance(e, dict)), key=_sort_key):
        score_trend.append({
            "date": entry.get("date"),
            "title": entry.get("title", ""),
            "score_pct": entry.get("quiz_score_pct"),
        })

    # Weak areas
    weak_areas_raw = memory.get("weak_areas", []) if isinstance(memory, dict) else []
    if not isinstance(weak_areas_raw, list):
        weak_areas_raw = []
    today = datetime.now().date()
    weak_areas = []
    for w in weak_areas_raw:
        if isinstance(w, str):
            weak_areas.append({"phrase": w, "age_days": None, "reinforced_count": 0, "retired": False})
            continue
        if not isinstance(w, dict):
            continue
        flagged_date = w.get("flagged_date")
        age_days = None
        if flagged_date:
            try:
                age_days = (today - datetime.strptime(flagged_date, "%Y-%m-%d").date()).days
            except Exception:
                age_days = None
        weak_areas.append({
            "phrase": w.get("phrase", ""),
            "age_days": age_days,
            "reinforced_count": w.get("reinforced_count", 0),
            "retired": w.get("retired", False),
        })

    # Review debt — from next_review_date on completed entries
    overdue = []
    next_7_days = []
    for entry in completed:
        if not isinstance(entry, dict):
            continue
        due = entry.get("next_review_date")
        if not due:
            continue
        try:
            due_date = datetime.strptime(due, "%Y-%m-%d").date()
        except Exception:
            continue
        item = {"slug": entry.get("slug", ""), "title": entry.get("title", ""), "due": due}
        if due_date < today:
            overdue.append(item)
        elif due_date <= today + timedelta(days=7):
            next_7_days.append(item)

    overdue.sort(key=lambda x: x["due"])
    next_7_days.sort(key=lambda x: x["due"])

    requiz_queue = memory.get("requiz_queue", []) if isinstance(memory, dict) else []
    if not isinstance(requiz_queue, list):
        requiz_queue = []

    return {
        "tracks": tracks_out,
        "score_trend": score_trend,
        "weak_areas": weak_areas,
        "review_debt": {
            "overdue": overdue,
            "next_7_days": next_7_days,
        },
        "streak": streak if isinstance(streak, int) else 0,
        "requiz_queue": requiz_queue,
    }


class SessionLog(BaseModel):
    slug: str
    title: str
    domain: str = ""
    debrief_phrase: str = ""
    quiz_score_input: str = ""
    time_spent_minutes: float = 0.0
    difficulty: str = ""


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

    # Read difficulty from current lesson file
    difficulty = payload.difficulty
    if not difficulty and LESSON_PATH.exists():
        try:
            lesson_data = json.loads(LESSON_PATH.read_text())
            difficulty = lesson_data.get("meta", {}).get("difficulty", "")
        except Exception:
            pass
    entry["difficulty"] = difficulty

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


# Serve React build — must come after all API routes
DIST = Path(os.getenv("REACT_DIST_DIR", str(Path(__file__).parent / "react-app" / "dist")))
if DIST.exists():
    app.mount("/assets", StaticFiles(directory=str(DIST / "assets")), name="assets")

    @app.get("/{full_path:path}")
    def spa_fallback(full_path: str):
        return FileResponse(str(DIST / "index.html"))
