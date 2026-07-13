"""
teach-me FastAPI backend — SQLite edition
"""
import json
import os
import time
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

import sys
sys.path.insert(0, str(Path(__file__).parent))
import db as DB

DB_PATH = Path(os.getenv("TEACH_DB_PATH", str(Path(__file__).parent.parent / "teach.db")))
DB.init_db(DB_PATH)
_CONN = DB.get_db(DB_PATH)

app = FastAPI(title="teach-me API")
app.add_middleware(
    CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"],
)

DOMAIN_DISPLAY = {
    "llm-arch": "LLM Architecture", "inference": "Inference & Serving",
    "training": "Training & Alignment", "agentic": "Agentic Systems",
    "backend": "Backend Systems", "system-design": "System Design",
    "mlops": "MLOps", "ml-ds": "ML/DS & Evaluation",
    "cross-domain": "Cross-Domain", "custom": "Custom Topics",
}
DOMAIN_ORDER = ["llm-arch","inference","training","agentic","ml-ds","mlops","backend","system-design","cross-domain","custom"]


# ── Queue ─────────────────────────────────────────────────────────────────────

@app.get("/api/queue")
def get_queue():
    slots = DB.get_queue_slots(_CONN)
    current = DB.get_current_lesson(_CONN)
    if current and 1 not in slots:
        slots = [1] + slots
    return {"slots": sorted(slots)}


@app.get("/api/queue/lesson/{slot}")
def get_queue_lesson(slot: int):
    data = DB.get_queue_lesson(_CONN, slot)
    if data is None:
        raise HTTPException(status_code=404, detail=f"Queue slot {slot} not found")
    return data


# ── Lesson ────────────────────────────────────────────────────────────────────

@app.get("/api/lesson")
def get_lesson():
    data = DB.get_current_lesson(_CONN)
    if data is None:
        raise HTTPException(status_code=404, detail="No current lesson")
    return data


@app.get("/api/lesson/{slug}")
def get_lesson_by_slug(slug: str):
    data = DB.get_lesson_by_slug(_CONN, slug)
    if data is None:
        raise HTTPException(status_code=404, detail="Lesson not found")
    return data


# ── Library ───────────────────────────────────────────────────────────────────

@app.get("/api/library")
def get_library():
    memory = DB.get_memory(_CONN)
    completed = memory["completed"]
    streak = memory["streak"]

    archived_slugs = {
        r[0] for r in _CONN.execute("SELECT slug FROM lessons WHERE is_current=0").fetchall()
    }

    groups_dict: dict = {}
    for entry in completed:
        dk = entry.get("domain", "")
        groups_dict.setdefault(dk, []).append({
            "slug": entry["slug"],
            "title": entry.get("title", ""),
            "date": entry.get("date", ""),
            "quiz_score_pct": entry.get("quiz_score_pct"),
            "time_spent_minutes": entry.get("time_spent_minutes", 0),
            "difficulty": entry.get("difficulty", ""),
            "archived": entry["slug"] in archived_slugs,
        })

    groups = []
    seen: set = set()
    for key in DOMAIN_ORDER:
        if key in groups_dict:
            groups.append({"domain": DOMAIN_DISPLAY.get(key, key), "domain_key": key, "lessons": groups_dict[key]})
            seen.add(key)
    for key, lessons in groups_dict.items():
        if key not in seen:
            groups.append({"domain": DOMAIN_DISPLAY.get(key, key) or "General", "domain_key": key, "lessons": lessons})

    return {"groups": groups, "total": len(completed), "streak": streak}


# ── Memory ────────────────────────────────────────────────────────────────────

@app.get("/api/memory")
def get_memory():
    return DB.get_memory(_CONN)


# ── Stats ─────────────────────────────────────────────────────────────────────

@app.get("/api/stats")
def get_stats():
    memory = DB.get_memory(_CONN)
    curriculum = DB.get_curriculum(_CONN)
    completed = memory["completed"]
    streak = memory["streak"]

    tracks_raw = curriculum.get("tracks", [])
    mix_targets = curriculum.get("mix_targets", {})

    slug_to_track: dict = {}
    for t in tracks_raw:
        for item in t.get("ladder", []):
            if item.get("slug"):
                slug_to_track[item["slug"]] = t["id"]

    completed_count_by_track: dict = {}
    for entry in completed:
        tid = slug_to_track.get(entry.get("slug", ""))
        if tid:
            completed_count_by_track[tid] = completed_count_by_track.get(tid, 0) + 1

    total_in_tracks = sum(completed_count_by_track.values())

    tracks_out = []
    for t in tracks_raw:
        tid = t.get("id", "")
        completed_n = completed_count_by_track.get(tid, 0)
        tracks_out.append({
            "id": tid, "title": t.get("title", tid),
            "completed": completed_n, "total": len(t.get("ladder", [])),
            "target_pct": mix_targets.get(tid),
            "actual_pct": (completed_n / total_in_tracks) if total_in_tracks else 0,
        })

    score_trend = [
        {"date": e.get("date"), "title": e.get("title", ""), "score_pct": e.get("quiz_score_pct")}
        for e in sorted(completed, key=lambda x: x.get("date") or "")
    ]

    today = datetime.now().date()
    weak_areas_out = []
    for w in memory["weak_areas"]:
        fd = w.get("flagged_date")
        age_days = None
        if fd:
            try:
                age_days = (today - datetime.strptime(fd, "%Y-%m-%d").date()).days
            except Exception:
                pass
        weak_areas_out.append({
            "phrase": w["phrase"], "age_days": age_days,
            "reinforced_count": w.get("reinforced_count", 0),
            "retired": bool(w.get("retired", False)),
        })

    overdue, next_7 = [], []
    for entry in completed:
        due = entry.get("next_review_date")
        if not due:
            continue
        try:
            due_date = datetime.strptime(due, "%Y-%m-%d").date()
        except Exception:
            continue
        item = {"slug": entry["slug"], "title": entry.get("title", ""), "due": due}
        if due_date < today:
            overdue.append(item)
        elif due_date <= today + timedelta(days=7):
            next_7.append(item)

    return {
        "tracks": tracks_out,
        "score_trend": score_trend,
        "weak_areas": weak_areas_out,
        "review_debt": {
            "overdue": sorted(overdue, key=lambda x: x["due"]),
            "next_7_days": sorted(next_7, key=lambda x: x["due"]),
        },
        "streak": streak,
        "requiz_queue": memory["requiz_queue"],
    }


# ── Session log ───────────────────────────────────────────────────────────────

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
    today = datetime.now().strftime("%Y-%m-%d")

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

    difficulty = payload.difficulty
    if not difficulty:
        current = DB.get_current_lesson(_CONN)
        if current:
            difficulty = current.get("meta", {}).get("difficulty", "")

    entry = {
        "slug": payload.slug, "title": payload.title, "domain": payload.domain,
        "date": today, "quiz_score_pct": quiz_score_pct,
        "time_spent_minutes": payload.time_spent_minutes, "difficulty": difficulty,
        "weak_areas": [payload.debrief_phrase] if payload.debrief_phrase else [],
        "notes": "", "next_review_date": next_review,
    }
    DB.add_session(_CONN, entry)

    last = DB.meta_get(_CONN, "last_session_date")
    yesterday = (datetime.now() - timedelta(days=1)).strftime("%Y-%m-%d")
    streak = DB.meta_get(_CONN, "streak", 0)
    if last == yesterday:
        streak += 1
    elif last != today:
        streak = 1
    DB.meta_set(_CONN, "streak", streak)
    DB.meta_set(_CONN, "last_session_date", today)
    DB.meta_set(_CONN, "in_progress", None)

    if payload.debrief_phrase:
        DB.upsert_weak_area(_CONN, payload.debrief_phrase, today, payload.slug)

    current = DB.get_current_lesson(_CONN)
    if current:
        DB.archive_lesson(_CONN, payload.slug, current, today)

    _CONN.commit()

    completed_count = _CONN.execute("SELECT COUNT(*) FROM sessions").fetchone()[0]
    if completed_count > 0 and completed_count % 10 == 0 and _ANTHROPIC_AVAILABLE:
        memory = DB.get_memory(_CONN)
        _generate_summary(memory["completed"], completed_count)

    return {"ok": True, "streak": streak}


# ── Notes ─────────────────────────────────────────────────────────────────────

class NotesPayload(BaseModel):
    note: str


@app.get("/api/notes")
def get_all_notes():
    notes = DB.get_all_notes(_CONN)
    sessions = {r["slug"]: dict(r) for r in _CONN.execute("SELECT slug,title,domain,date FROM sessions").fetchall()}
    result = []
    for n in notes:
        meta = sessions.get(n["slug"], {})
        result.append({
            "slug": n["slug"], "title": meta.get("title", n["slug"]),
            "domain": meta.get("domain", ""), "date": meta.get("date", ""),
            "note": n["note"], "updated": n.get("updated", ""),
        })
    return {"notes": result, "total": len(result)}


@app.get("/api/notes/{slug}")
def get_note(slug: str):
    return {"slug": slug, "note": DB.get_note(_CONN, slug)}


@app.put("/api/notes/{slug}")
def save_note(slug: str, payload: NotesPayload):
    now = datetime.now().strftime("%Y-%m-%dT%H:%M:%S")
    DB.save_note(_CONN, slug, payload.note, now)
    _CONN.commit()
    return {"ok": True}


# ── Search ────────────────────────────────────────────────────────────────────

@app.get("/api/search")
def search(q: str = ""):
    if len(q) < 2:
        return {"results": [], "total": 0}

    sessions = {r["slug"]: dict(r) for r in _CONN.execute("SELECT slug,domain,date FROM sessions").fetchall()}
    results = []

    for row in DB.search_lessons(_CONN, q):
        slug = row["slug"]
        meta = sessions.get(slug, {})
        excerpt = (row.get("searchable_text") or "")[:150]
        title_row = _CONN.execute("SELECT content FROM lessons WHERE slug=?", (slug,)).fetchone()
        title = slug
        if title_row:
            try:
                title = json.loads(title_row["content"]).get("meta", {}).get("title", slug)
            except Exception:
                pass
        results.append({
            "type": "lesson", "slug": slug, "title": title,
            "domain": meta.get("domain", ""), "date": meta.get("date", ""), "excerpt": excerpt,
        })

    q_lower = q.lower()
    for n in DB.get_all_notes(_CONN):
        if q_lower in (n.get("note") or "").lower():
            meta = sessions.get(n["slug"], {})
            results.append({
                "type": "note", "slug": n["slug"],
                "title": meta.get("title", n["slug"]),
                "domain": meta.get("domain", ""), "date": meta.get("date", ""),
                "excerpt": n["note"][:150],
            })

    return {"results": results, "total": len(results)}


# ── Bookmarks ─────────────────────────────────────────────────────────────────

class BookmarkPayload(BaseModel):
    slug: str
    title: str
    section: str
    content: str


@app.get("/api/bookmarks")
def get_bookmarks():
    return {"bookmarks": DB.get_bookmarks(_CONN)}


@app.post("/api/bookmarks")
def add_bookmark(payload: BookmarkPayload):
    bm_id = f"{payload.slug}_{int(time.time())}"
    bm = {
        "id": bm_id, "slug": payload.slug, "title": payload.title,
        "section": payload.section, "content": payload.content,
        "created_at": datetime.now().strftime("%Y-%m-%dT%H:%M:%S"),
    }
    DB.add_bookmark(_CONN, bm)
    _CONN.commit()
    return {"ok": True, "id": bm_id}


@app.delete("/api/bookmarks/{bookmark_id}")
def delete_bookmark(bookmark_id: str):
    if not DB.delete_bookmark(_CONN, bookmark_id):
        raise HTTPException(status_code=404, detail="Bookmark not found")
    _CONN.commit()
    return {"ok": True}


# ── Curriculum ────────────────────────────────────────────────────────────────

@app.get("/api/curriculum")
def get_curriculum():
    return DB.get_curriculum(_CONN)


# ── Scenario ──────────────────────────────────────────────────────────────────

@app.get("/api/scenario/{slug}")
def get_scenario(slug: str):
    data = DB.get_scenario(_CONN, slug)
    if data:
        return data
    if not _ANTHROPIC_AVAILABLE:
        raise HTTPException(status_code=503, detail="anthropic not installed")

    lesson = DB.get_lesson_by_slug(_CONN, slug) or DB.get_current_lesson(_CONN) or {}
    meta = lesson.get("meta", {}) if isinstance(lesson, dict) else {}
    lesson_title = meta.get("title", slug) if isinstance(meta, dict) else slug
    concepts_list = [c["title"] for c in lesson.get("core_concepts", []) if isinstance(c, dict) and c.get("title")]

    try:
        client = _anthropic.Anthropic()
        resp = client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=1500,
            messages=[{"role": "user", "content": (
                f"Generate a concrete end-to-end production scenario for: '{lesson_title}'. "
                f"Key concepts: {concepts_list}. Return ONLY valid JSON with: "
                "title, problem, system_description, how_concept_applies, "
                "what_breaks_without_it, real_world_examples (list of 3)."
            )}],
        )
        text = resp.content[0].text.strip()
        if text.startswith("```"):
            text = text.split("```")[1].lstrip("json").strip().rstrip("```").strip()
        data = json.loads(text)
        DB.save_scenario(_CONN, slug, data)
        _CONN.commit()
        return data
    except json.JSONDecodeError as e:
        raise HTTPException(status_code=500, detail=f"Failed to parse scenario JSON: {e}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Scenario generation failed: {e}")


# ── Summary ───────────────────────────────────────────────────────────────────

@app.get("/api/summary/latest")
def get_latest_summary():
    data = DB.get_latest_summary(_CONN)
    if data is None:
        return {"exists": False}
    return {"exists": True, **data}


def _generate_summary(completed: list, count: int) -> None:
    try:
        recent = completed[-10:]
        titles = [e.get("title", "") for e in recent]
        scores = [e.get("quiz_score_pct") for e in recent if e.get("quiz_score_pct") is not None]
        avg_score = sum(scores) / len(scores) if scores else None
        weak = [w for e in recent for w in (e.get("weak_areas") or [])]
        client = _anthropic.Anthropic()
        resp = client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=1000,
            messages=[{"role": "user", "content": (
                f"Analyze these 10 AI engineering study sessions: {titles}. "
                f"Avg score: {avg_score}. Weak areas: {weak}. "
                "Return ONLY valid JSON with: summary_title, sessions_covered, avg_score_pct, "
                "strengths, gaps, next_focus, generated_date (YYYY-MM-DD)."
            )}],
        )
        text = resp.content[0].text.strip()
        if text.startswith("```"):
            text = text.split("```")[1].lstrip("json").strip().rstrip("```").strip()
        DB.save_summary(_CONN, count, json.loads(text))
        _CONN.commit()
    except Exception:
        pass


# ── Wishlist ──────────────────────────────────────────────────────────────────

class WishlistItem(BaseModel):
    topic: str


@app.get("/api/wishlist")
def get_wishlist():
    return {"items": DB.get_wishlist(_CONN)}


@app.post("/api/wishlist")
def add_wishlist(payload: WishlistItem):
    topic = payload.topic.strip()
    if not topic:
        raise HTTPException(status_code=400, detail="Topic cannot be empty")
    item = {
        "id": f"w{int(time.time() * 1000)}", "topic": topic,
        "added_date": datetime.now().strftime("%Y-%m-%d"), "surfaced": False,
    }
    DB.add_wishlist_item(_CONN, item)
    _CONN.commit()
    return {"ok": True, "id": item["id"]}


@app.delete("/api/wishlist/{item_id}")
def delete_wishlist(item_id: str):
    if not DB.delete_wishlist_item(_CONN, item_id):
        raise HTTPException(status_code=404, detail="Item not found")
    _CONN.commit()
    return {"ok": True}


# ── TIL ───────────────────────────────────────────────────────────────────────

@app.get("/api/til")
def get_til():
    rows = _CONN.execute(
        "SELECT l.slug, l.content, s.date, s.domain FROM lessons l "
        "LEFT JOIN sessions s ON l.slug=s.slug WHERE l.is_current=0 ORDER BY s.date DESC"
    ).fetchall()
    items = []
    for row in rows:
        try:
            data = json.loads(row["content"])
        except Exception:
            continue
        hook = data.get("hook", {})
        if not isinstance(hook, dict):
            continue
        problem = hook.get("problem", "").strip()
        if not problem:
            continue
        items.append({
            "slug": row["slug"],
            "title": data.get("meta", {}).get("title", row["slug"]),
            "date": row["date"] or "",
            "domain": row["domain"] or "",
            "problem": problem,
            "why_it_matters": hook.get("why_it_matters", "").strip(),
        })
    return {"items": items, "total": len(items)}


@app.post("/api/chat")
def chat_placeholder():
    raise HTTPException(status_code=501, detail="Chat not implemented yet")


# Serve React build
DIST = Path(os.getenv("REACT_DIST_DIR", str(Path(__file__).parent / "react-app" / "dist")))
if DIST.exists():
    app.mount("/assets", StaticFiles(directory=str(DIST / "assets")), name="assets")

    @app.get("/{full_path:path}")
    def spa_fallback(full_path: str):
        return FileResponse(str(DIST / "index.html"))
