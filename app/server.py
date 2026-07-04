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

try:
    import anthropic as _anthropic
    _ANTHROPIC_AVAILABLE = True
except ImportError:
    _ANTHROPIC_AVAILABLE = False

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

NOTES_PATH = BASE / "notes.json"

BOOKMARKS_PATH = BASE / "bookmarks.json"
SUMMARIES_DIR = BASE / "summaries"
SCENARIOS_DIR = BASE / "scenarios"

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


def _compute_next_topics(current_slug: str) -> list:
    curriculum = _load_json_safe(CURRICULUM_PATH)
    memory = _load_json_safe(MEMORY_PATH)
    completed_slugs = {
        c.get("slug", "") for c in memory.get("completed", []) if isinstance(c, dict)
    }
    completed_slugs.add(current_slug)

    all_topics: list = []
    current_track_id = None
    for track in curriculum.get("tracks", []):
        if not isinstance(track, dict):
            continue
        track_id = track.get("id", "")
        for item in track.get("ladder", []):
            if not isinstance(item, dict):
                continue
            slug = item.get("slug", "")
            if slug == current_slug:
                current_track_id = track_id
            if slug in completed_slugs:
                continue
            all_topics.append({
                "slug": slug,
                "title": item.get("title", ""),
                "difficulty": item.get("difficulty", ""),
                "builds_on": item.get("builds_on", []),
                "related": item.get("related", []),
                "track_id": track_id,
                "track_title": track.get("title", ""),
                "concepts": item.get("concepts", []),
            })

    def score(t: dict) -> int:
        if current_slug in t["builds_on"]:
            return 3
        if t["track_id"] == current_track_id:
            return 2
        if current_slug in t.get("related", []):
            return 1
        return 0

    scored = sorted(all_topics, key=lambda t: -score(t))
    top = [t for t in scored if score(t) > 0][:3]
    if len(top) < 3:
        top += [t for t in scored if t not in top and t.get("track_id") == current_track_id][:3 - len(top)]
    if len(top) < 3:
        top += [t for t in scored if t not in top][:3 - len(top)]

    result = []
    for t in top[:3]:
        s = score(t)
        if s == 3:
            why = "Directly builds on today's lesson"
        elif s == 2:
            why = f"Next step in {t['track_title']}"
        else:
            why = "Related — worth exploring after this"
        result.append({
            "slug": t["slug"],
            "title": t["title"],
            "difficulty": t["difficulty"],
            "why": why,
            "concepts": t["concepts"][:2],
        })
    return result


@app.get("/api/lesson")
def get_lesson():
    data = _read_json(LESSON_PATH)
    if isinstance(data, dict):
        slug = data.get("meta", {}).get("slug", "") if isinstance(data.get("meta"), dict) else ""
        if slug and "next_topics" not in data:
            data["next_topics"] = _compute_next_topics(slug)
    return data


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

    # Trigger 10-session summary in background (inline, haiku is fast)
    completed_count = len(memory.get("completed", []))
    if completed_count > 0 and completed_count % 10 == 0 and _ANTHROPIC_AVAILABLE:
        _generate_summary(memory["completed"], completed_count)

    return {"ok": True, "streak": memory["streak"]}


class NotesPayload(BaseModel):
    note: str


class BookmarkPayload(BaseModel):
    slug: str
    title: str
    section: str
    content: str


@app.get("/api/notes")
def get_all_notes():
    notes = _load_json_safe(NOTES_PATH)
    try:
        memory = json.loads(MEMORY_PATH.read_text()) if MEMORY_PATH.exists() else {}
    except json.JSONDecodeError:
        memory = {}
    completed = memory.get("completed", [])
    slug_to_meta = {c["slug"]: c for c in completed if isinstance(c, dict) and c.get("slug")}

    result = []
    for slug, data in notes.items():
        if not isinstance(data, dict) or not data.get("note", "").strip():
            continue
        meta = slug_to_meta.get(slug, {})
        result.append({
            "slug": slug,
            "title": meta.get("title", slug),
            "domain": meta.get("domain", ""),
            "date": meta.get("date", ""),
            "note": data.get("note", ""),
            "updated": data.get("updated", ""),
        })

    result.sort(key=lambda x: x.get("updated") or "", reverse=True)
    return {"notes": result, "total": len(result)}


@app.get("/api/notes/{slug}")
def get_note(slug: str):
    notes = _load_json_safe(NOTES_PATH)
    entry = notes.get(slug, {})
    return {"slug": slug, "note": entry.get("note", "") if isinstance(entry, dict) else ""}


@app.put("/api/notes/{slug}")
def save_note(slug: str, payload: NotesPayload):
    notes = _load_json_safe(NOTES_PATH)
    now = datetime.now().strftime("%Y-%m-%dT%H:%M:%S")
    notes[slug] = {"note": payload.note, "updated": now}
    NOTES_PATH.write_text(json.dumps(notes, indent=2))
    return {"ok": True}


@app.post("/api/chat")
def chat_placeholder():
    raise HTTPException(status_code=501, detail="Chat not implemented yet")


# ---------------------------------------------------------------------------
# Search
# ---------------------------------------------------------------------------

@app.get("/api/search")
def search(q: str = ""):
    if len(q) < 2:
        return {"results": [], "total": 0}

    q_lower = q.lower()
    results = []

    # --- lessons: search archive/*.json ---
    try:
        memory = json.loads(MEMORY_PATH.read_text()) if MEMORY_PATH.exists() else {}
    except json.JSONDecodeError:
        memory = {}
    completed = memory.get("completed", [])
    slug_to_meta = {c.get("slug", ""): c for c in completed if isinstance(c, dict)}

    for archive_file in sorted(ARCHIVE_DIR.glob("*.json")) if ARCHIVE_DIR.exists() else []:
        slug = archive_file.stem
        try:
            data = json.loads(archive_file.read_text(encoding="utf-8"))
        except Exception:
            continue

        meta = data.get("meta", {}) if isinstance(data, dict) else {}
        title = meta.get("title", slug) if isinstance(meta, dict) else slug
        domain = slug_to_meta.get(slug, {}).get("domain", "")
        date = slug_to_meta.get(slug, {}).get("date", "")

        excerpt = ""
        # Build haystack and find excerpt
        haystack_parts = [title]
        for c in data.get("core_concepts", []) if isinstance(data, dict) else []:
            if isinstance(c, dict):
                haystack_parts.append(c.get("title", "") + " " + c.get("explanation", ""))
        for insight in data.get("key_insights", []) if isinstance(data, dict) else []:
            if isinstance(insight, str):
                haystack_parts.append(insight)
            elif isinstance(insight, dict):
                haystack_parts.append(str(insight))

        matched = False
        for part in haystack_parts:
            if q_lower in part.lower():
                excerpt = part[:150]
                matched = True
                break

        if matched:
            results.append({
                "type": "lesson",
                "slug": slug,
                "title": title,
                "domain": domain,
                "date": date,
                "excerpt": excerpt,
            })

    # --- notes ---
    notes = _load_json_safe(NOTES_PATH)
    for slug, entry in notes.items():
        if not isinstance(entry, dict):
            continue
        note_text = entry.get("note", "")
        if q_lower in note_text.lower():
            meta = slug_to_meta.get(slug, {})
            results.append({
                "type": "note",
                "slug": slug,
                "title": meta.get("title", slug),
                "domain": meta.get("domain", ""),
                "date": meta.get("date", ""),
                "excerpt": note_text[:150],
            })

    return {"results": results, "total": len(results)}


# ---------------------------------------------------------------------------
# Bookmarks
# ---------------------------------------------------------------------------

@app.get("/api/bookmarks")
def get_bookmarks():
    try:
        if not BOOKMARKS_PATH.exists():
            return {"bookmarks": []}
        return {"bookmarks": json.loads(BOOKMARKS_PATH.read_text(encoding="utf-8"))}
    except Exception:
        return {"bookmarks": []}


@app.post("/api/bookmarks")
def add_bookmark(payload: BookmarkPayload):
    try:
        existing: list = json.loads(BOOKMARKS_PATH.read_text(encoding="utf-8")) if BOOKMARKS_PATH.exists() else []
    except Exception:
        existing = []

    bookmark_id = f"{payload.slug}_{int(datetime.now().timestamp())}"
    bookmark = {
        "id": bookmark_id,
        "slug": payload.slug,
        "title": payload.title,
        "section": payload.section,
        "content": payload.content,
        "created_at": datetime.now().strftime("%Y-%m-%dT%H:%M:%S"),
    }
    existing.append(bookmark)
    BOOKMARKS_PATH.write_text(json.dumps(existing, indent=2))
    return {"ok": True, "id": bookmark_id}


@app.delete("/api/bookmarks/{bookmark_id}")
def delete_bookmark(bookmark_id: str):
    try:
        existing: list = json.loads(BOOKMARKS_PATH.read_text(encoding="utf-8")) if BOOKMARKS_PATH.exists() else []
    except Exception:
        existing = []

    new_list = [b for b in existing if b.get("id") != bookmark_id]
    if len(new_list) == len(existing):
        raise HTTPException(status_code=404, detail="Bookmark not found")

    BOOKMARKS_PATH.write_text(json.dumps(new_list, indent=2))
    return {"ok": True}


# ---------------------------------------------------------------------------
# Curriculum
# ---------------------------------------------------------------------------

@app.get("/api/curriculum")
def get_curriculum():
    return _read_json(CURRICULUM_PATH)


# ---------------------------------------------------------------------------
# Scenario (AI-generated production scenario for a lesson)
# ---------------------------------------------------------------------------

@app.get("/api/scenario/{slug}")
def get_scenario(slug: str):
    scenario_path = SCENARIOS_DIR / f"{slug}.json"
    if scenario_path.exists():
        try:
            return json.loads(scenario_path.read_text(encoding="utf-8"))
        except Exception:
            pass

    if not _ANTHROPIC_AVAILABLE:
        raise HTTPException(status_code=503, detail="anthropic not installed")

    # Gather lesson context
    lesson_title = slug
    concepts_list: list = []

    archive_path = ARCHIVE_DIR / f"{slug}.json"
    lesson_source = archive_path if archive_path.exists() else (LESSON_PATH if LESSON_PATH.exists() else None)
    if lesson_source:
        try:
            lesson_data = json.loads(lesson_source.read_text(encoding="utf-8"))
            meta = lesson_data.get("meta", {}) if isinstance(lesson_data, dict) else {}
            if isinstance(meta, dict) and meta.get("title"):
                lesson_title = meta["title"]
            for c in lesson_data.get("core_concepts", []) if isinstance(lesson_data, dict) else []:
                if isinstance(c, dict) and c.get("title"):
                    concepts_list.append(c["title"])
        except Exception:
            pass

    try:
        client = _anthropic.Anthropic()
        resp = client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=1500,
            messages=[{
                "role": "user",
                "content": (
                    f"Generate a concrete end-to-end production scenario for this AI/backend topic: '{lesson_title}'. "
                    f"Key concepts: {concepts_list}. "
                    "Return ONLY valid JSON with these exact fields: "
                    "title (str), problem (str, 2-3 sentences), system_description (str, describe a real system), "
                    "how_concept_applies (str, 2-3 sentences), what_breaks_without_it (str, 2-3 sentences), "
                    "real_world_examples (list of 3 strings naming real systems that use this). "
                    "Be specific, production-focused, no hand-waving."
                ),
            }],
        )
        text = resp.content[0].text.strip()
        if text.startswith("```"):
            text = text.split("```")[1].lstrip("json").strip().rstrip("```").strip()
        data = json.loads(text)
        SCENARIOS_DIR.mkdir(exist_ok=True)
        scenario_path.write_text(json.dumps(data, indent=2))
        return data
    except json.JSONDecodeError as e:
        raise HTTPException(status_code=500, detail=f"Failed to parse scenario JSON: {e}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Scenario generation failed: {e}")


# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------

@app.get("/api/summary/latest")
def get_latest_summary():
    if not SUMMARIES_DIR.exists():
        return {"exists": False}
    summary_files = sorted(SUMMARIES_DIR.glob("summary_*.json"))
    if not summary_files:
        return {"exists": False}
    # Pick the one with the highest number
    def _summary_num(p: Path) -> int:
        try:
            return int(p.stem.split("_")[1])
        except Exception:
            return -1

    latest = max(summary_files, key=_summary_num)
    try:
        data = json.loads(latest.read_text(encoding="utf-8"))
        return {"exists": True, **data}
    except Exception:
        return {"exists": False}


# ---------------------------------------------------------------------------
# Internal: generate 10-session summary (called inline from log_session)
# ---------------------------------------------------------------------------

def _generate_summary(completed: list, count: int) -> None:
    try:
        recent = completed[-10:]
        titles = [e.get("title", "") for e in recent]
        scores = [e.get("quiz_score_pct") for e in recent if e.get("quiz_score_pct") is not None]
        avg_score = sum(scores) / len(scores) if scores else None
        weak: list = []
        for e in recent:
            wa = e.get("weak_areas", [])
            weak.extend(wa if isinstance(wa, list) else [])

        client = _anthropic.Anthropic()
        resp = client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=1000,
            messages=[{
                "role": "user",
                "content": (
                    f"Analyze these 10 AI engineering study sessions and generate a concise digest. "
                    f"Sessions: {titles}. Average quiz score: {avg_score}. Weak areas flagged: {weak}. "
                    "Return ONLY valid JSON with: summary_title (str), sessions_covered (list of str), "
                    "avg_score_pct (float or null), strengths (list of 2-3 str), gaps (list of 2-3 str), "
                    "next_focus (list of 2-3 topic recommendations), generated_date (today's date YYYY-MM-DD). "
                    "Be specific and actionable."
                ),
            }],
        )
        text = resp.content[0].text.strip()
        if text.startswith("```"):
            text = text.split("```")[1].lstrip("json").strip().rstrip("```").strip()
        data = json.loads(text)
        SUMMARIES_DIR.mkdir(exist_ok=True)
        (SUMMARIES_DIR / f"summary_{count}.json").write_text(json.dumps(data, indent=2))
    except Exception:
        pass  # Never crash the session log



@app.get("/api/til")
def get_til():
    """Return hook data from all archived lessons, sorted newest first."""
    try:
        memory = json.loads(MEMORY_PATH.read_text()) if MEMORY_PATH.exists() else {}
    except Exception:
        memory = {}
    completed = memory.get("completed", [])
    slug_to_meta = {e["slug"]: e for e in completed if isinstance(e, dict) and e.get("slug")}

    items = []
    if ARCHIVE_DIR.exists():
        for path in ARCHIVE_DIR.glob("*.json"):
            try:
                data = json.loads(path.read_text(encoding="utf-8"))
            except Exception:
                continue
            slug = path.stem
            hook = data.get("hook", {})
            if not isinstance(hook, dict):
                continue
            problem = hook.get("problem", "").strip()
            why = hook.get("why_it_matters", "").strip()
            narrative = hook.get("narrative", "").strip()
            if not problem and not narrative:
                continue
            meta = slug_to_meta.get(slug, {})
            items.append({
                "slug": slug,
                "title": data.get("meta", {}).get("title", slug),
                "date": meta.get("date", ""),
                "domain": meta.get("domain", ""),
                "problem": problem,
                "why_it_matters": why,
            })

    items.sort(key=lambda x: x["date"] or "", reverse=True)
    return {"items": items, "total": len(items)}


# Serve React build — must come after all API routes
DIST = Path(os.getenv("REACT_DIST_DIR", str(Path(__file__).parent / "react-app" / "dist")))
if DIST.exists():
    app.mount("/assets", StaticFiles(directory=str(DIST / "assets")), name="assets")

    @app.get("/{full_path:path}")
    def spa_fallback(full_path: str):
        return FileResponse(str(DIST / "index.html"))
