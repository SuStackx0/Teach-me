"""
teach-me FastAPI backend — SQLite edition
"""
import json
import os
import time
from datetime import datetime, timedelta
from pathlib import Path

from collections import Counter

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, PlainTextResponse
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


def live_streak(conn) -> int:
    """Return streak only if last session was today or yesterday; else 0."""
    stored = DB.meta_get(conn, "streak", 0)
    last = DB.meta_get(conn, "last_session_date")
    if not last:
        return 0
    today = datetime.now().date()
    last_date = datetime.strptime(last, "%Y-%m-%d").date()
    if (today - last_date).days > 1:
        return 0
    return stored

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
    slot_nums = DB.get_queue_slots(_CONN)
    current = DB.get_current_lesson(_CONN)
    if current and 1 not in slot_nums:
        slot_nums = [1] + slot_nums

    slots = []
    for num in sorted(slot_nums):
        data = DB.get_queue_lesson(_CONN, num)
        if data is None:
            continue
        meta = data.get("meta", {}) if isinstance(data, dict) else {}
        slots.append({
            "slot": num,
            "slug": meta.get("slug", ""),
            "title": meta.get("title", f"Lesson {num}"),
            "status": "active" if num == 1 else "ready",
        })
    return {"slots": slots}


@app.get("/api/queue/lesson/{slot}")
def get_queue_lesson(slot: int):
    data = DB.get_queue_lesson(_CONN, slot)
    if data is None:
        raise HTTPException(status_code=404, detail=f"Queue slot {slot} not found")
    return data


@app.post("/api/queue/activate/{slot}")
def activate_queue_slot(slot: int):
    ok = DB.activate_queue_slot(_CONN, slot)
    if not ok:
        raise HTTPException(status_code=404, detail=f"Queue slot {slot} not found")
    new_active = DB.get_current_lesson(_CONN)
    active_slug = new_active.get("meta", {}).get("slug", "") if new_active else ""
    _CONN.commit()
    return {"ok": True, "active_slug": active_slug}


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
    streak = live_streak(_CONN)

    archived_slugs = {
        r[0] for r in _CONN.execute("SELECT slug FROM lessons WHERE archived_at IS NOT NULL").fetchall()
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
    m = DB.get_memory(_CONN)
    m["streak"] = live_streak(_CONN)
    return m


# ── Stats ─────────────────────────────────────────────────────────────────────

@app.get("/api/stats")
def get_stats():
    memory = DB.get_memory(_CONN)
    curriculum = DB.get_curriculum(_CONN)
    completed = memory["completed"]
    streak = live_streak(_CONN)

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

    date_counts = Counter(e.get("date", "") for e in completed if e.get("date"))
    heatmap = [{"date": d, "count": c} for d, c in sorted(date_counts.items())]

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
        "heatmap": heatmap,
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

    DB.remove_and_compact_queue(_CONN)

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
        "LEFT JOIN sessions s ON l.slug=s.slug WHERE l.archived_at IS NOT NULL ORDER BY s.date DESC"
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


# ── Highlights ────────────────────────────────────────────────────────────────

class HighlightPayload(BaseModel):
    slug: str
    section: str
    text: str
    color: str = "yellow"


@app.get("/api/highlights")
def get_highlights(slug: str = ""):
    return {"highlights": DB.get_highlights(_CONN, slug or None)}


@app.post("/api/highlights")
def add_highlight(payload: HighlightPayload):
    h = {"id": f"h{int(time.time()*1000)}", "slug": payload.slug, "section": payload.section,
         "text": payload.text, "color": payload.color,
         "created_at": datetime.now().strftime("%Y-%m-%dT%H:%M:%S")}
    DB.add_highlight(_CONN, h)
    _CONN.commit()
    return {"ok": True, "id": h["id"]}


@app.delete("/api/highlights/{hid}")
def delete_highlight(hid: str):
    if not DB.delete_highlight(_CONN, hid):
        raise HTTPException(status_code=404, detail="Highlight not found")
    _CONN.commit()
    return {"ok": True}


# ── Inline Comments ───────────────────────────────────────────────────────────

class InlineCommentPayload(BaseModel):
    slug: str
    section: str
    comment: str


class InlineCommentUpdatePayload(BaseModel):
    comment: str


@app.get("/api/comments/{slug}")
def get_comments(slug: str):
    return {"comments": DB.get_inline_comments(_CONN, slug)}


@app.post("/api/comments")
def add_comment(payload: InlineCommentPayload):
    c = {"id": f"c{int(time.time()*1000)}", "slug": payload.slug, "section": payload.section,
         "comment": payload.comment, "created_at": datetime.now().strftime("%Y-%m-%dT%H:%M:%S")}
    DB.add_inline_comment(_CONN, c)
    _CONN.commit()
    return {"ok": True, "id": c["id"]}


@app.delete("/api/comments/{cid}")
def delete_comment(cid: str):
    if not DB.delete_inline_comment(_CONN, cid):
        raise HTTPException(status_code=404, detail="Comment not found")
    _CONN.commit()
    return {"ok": True}


@app.put("/api/comments/{cid}")
def update_comment(cid: str, payload: InlineCommentUpdatePayload):
    DB.update_inline_comment(_CONN, cid, payload.comment)
    _CONN.commit()
    return {"ok": True}


# ── Glossary ──────────────────────────────────────────────────────────────────

class GlossaryPayload(BaseModel):
    term: str
    definition: str
    source_slug: str = ""


class GlossaryUpdatePayload(BaseModel):
    term: str
    definition: str


@app.get("/api/glossary")
def get_glossary():
    return {"entries": DB.get_glossary(_CONN)}


@app.post("/api/glossary")
def add_glossary(payload: GlossaryPayload):
    entry = {"id": f"g{int(time.time()*1000)}", "term": payload.term.strip(),
             "definition": payload.definition.strip(), "source_slug": payload.source_slug,
             "created_at": datetime.now().strftime("%Y-%m-%dT%H:%M:%S")}
    DB.add_glossary_entry(_CONN, entry)
    _CONN.commit()
    return {"ok": True, "id": entry["id"]}


@app.delete("/api/glossary/{eid}")
def delete_glossary(eid: str):
    if not DB.delete_glossary_entry(_CONN, eid):
        raise HTTPException(status_code=404, detail="Entry not found")
    _CONN.commit()
    return {"ok": True}


@app.put("/api/glossary/{eid}")
def update_glossary(eid: str, payload: GlossaryUpdatePayload):
    DB.update_glossary_entry(_CONN, eid, payload.term, payload.definition)
    _CONN.commit()
    return {"ok": True}


# ── Snippets ──────────────────────────────────────────────────────────────────

class SnippetPayload(BaseModel):
    slug: str
    title: str
    code: str
    language: str = ""
    tag: str = ""


@app.get("/api/snippets")
def get_snippets(tag: str = ""):
    return {"snippets": DB.get_snippets(_CONN, tag or None)}


@app.post("/api/snippets")
def add_snippet(payload: SnippetPayload):
    s = {"id": f"s{int(time.time()*1000)}", "slug": payload.slug, "title": payload.title,
         "code": payload.code, "language": payload.language, "tag": payload.tag,
         "created_at": datetime.now().strftime("%Y-%m-%dT%H:%M:%S")}
    DB.add_snippet(_CONN, s)
    _CONN.commit()
    return {"ok": True, "id": s["id"]}


@app.delete("/api/snippets/{sid}")
def delete_snippet(sid: str):
    if not DB.delete_snippet(_CONN, sid):
        raise HTTPException(status_code=404, detail="Snippet not found")
    _CONN.commit()
    return {"ok": True}


# ── Self-rating ────────────────────────────────────────────────────────────────

class SelfRatingPayload(BaseModel):
    rating: int


@app.post("/api/rating/{slug}")
def set_rating(slug: str, payload: SelfRatingPayload):
    if not 1 <= payload.rating <= 5:
        raise HTTPException(status_code=400, detail="Rating must be 1-5")
    DB.set_self_rating(_CONN, slug, payload.rating)
    _CONN.commit()
    return {"ok": True}


@app.get("/api/rating/{slug}")
def get_rating(slug: str):
    return {"slug": slug, "rating": DB.get_self_rating(_CONN, slug)}


# ── Section Progress ───────────────────────────────────────────────────────────

class SectionVisitPayload(BaseModel):
    section: str


class SectionCheckPayload(BaseModel):
    section: str
    checked: bool


@app.get("/api/progress/{slug}")
def get_progress(slug: str):
    return {"slug": slug, "progress": DB.get_section_progress(_CONN, slug)}


@app.post("/api/progress/{slug}/visit")
def mark_visited(slug: str, payload: SectionVisitPayload):
    now = datetime.now().strftime("%Y-%m-%dT%H:%M:%S")
    DB.set_section_visited(_CONN, slug, payload.section, now)
    _CONN.commit()
    return {"ok": True}


@app.post("/api/progress/{slug}/check")
def mark_checked(slug: str, payload: SectionCheckPayload):
    DB.set_section_checked(_CONN, slug, payload.section, payload.checked)
    _CONN.commit()
    return {"ok": True}


# ── Review Queue ───────────────────────────────────────────────────────────────

@app.get("/api/review-queue")
def get_review_queue():
    memory = DB.get_memory(_CONN)
    completed = memory.get("completed", [])
    today = datetime.now().date()
    overdue, due_soon, upcoming = [], [], []
    for r in sorted(completed, key=lambda x: x.get("next_review_date") or ""):
        due_str = r.get("next_review_date")
        if not due_str:
            continue
        try:
            due = datetime.strptime(due_str, "%Y-%m-%d").date()
        except Exception:
            continue
        item = {
            "slug": r.get("slug", ""), "title": r.get("title", ""),
            "domain": r.get("domain", ""), "date": r.get("date", ""),
            "quiz_score_pct": r.get("quiz_score_pct"),
            "next_review_date": due_str,
            "self_rating": DB.get_self_rating(_CONN, r.get("slug", "")),
            "days_until": (due - today).days,
        }
        diff = item["days_until"]
        if diff < 0:
            overdue.append(item)
        elif diff <= 7:
            due_soon.append(item)
        else:
            upcoming.append(item)
    return {"overdue": overdue, "due_soon": due_soon, "upcoming": upcoming[:20]}


# ── Tags ──────────────────────────────────────────────────────────────────────

class LessonTagPayload(BaseModel):
    tag_name: str


@app.get("/api/tags")
def get_tags():
    return {"tags": DB.get_all_tags(_CONN)}


@app.get("/api/tags/{slug}")
def get_lesson_tags(slug: str):
    return {"slug": slug, "tags": DB.get_tags_for_lesson(_CONN, slug)}


@app.post("/api/tags/{slug}")
def add_lesson_tag(slug: str, payload: LessonTagPayload):
    name = payload.tag_name.strip().lower()
    if not name:
        raise HTTPException(status_code=400, detail="Tag name required")
    tag_id = f"t{abs(hash(name)) % 10**9}"
    DB.add_tag(_CONN, tag_id, name)
    DB.tag_lesson(_CONN, slug, tag_id)
    _CONN.commit()
    return {"ok": True}


@app.delete("/api/tags/{slug}/{tag_name}")
def remove_lesson_tag(slug: str, tag_name: str):
    row = _CONN.execute("SELECT id FROM tags WHERE name=?", (tag_name,)).fetchone()
    if row:
        DB.untag_lesson(_CONN, slug, row["id"])
        _CONN.commit()
    return {"ok": True}


# ── Collections ───────────────────────────────────────────────────────────────

class CollectionPayload(BaseModel):
    name: str
    description: str = ""


class CollectionLessonPayload(BaseModel):
    slug: str


@app.get("/api/collections")
def get_collections():
    return {"collections": DB.get_collections(_CONN)}


@app.post("/api/collections")
def create_collection(payload: CollectionPayload):
    col = {"id": f"col{int(time.time()*1000)}", "name": payload.name.strip(),
           "description": payload.description,
           "created_at": datetime.now().strftime("%Y-%m-%dT%H:%M:%S")}
    DB.create_collection(_CONN, col)
    _CONN.commit()
    return {"ok": True, "id": col["id"]}


@app.delete("/api/collections/{cid}")
def delete_collection(cid: str):
    if not DB.delete_collection(_CONN, cid):
        raise HTTPException(status_code=404, detail="Collection not found")
    _CONN.commit()
    return {"ok": True}


@app.post("/api/collections/{cid}/lessons")
def add_to_collection(cid: str, payload: CollectionLessonPayload):
    DB.add_to_collection(_CONN, cid, payload.slug)
    _CONN.commit()
    return {"ok": True}


@app.delete("/api/collections/{cid}/lessons/{slug}")
def remove_from_collection(cid: str, slug: str):
    DB.remove_from_collection(_CONN, cid, slug)
    _CONN.commit()
    return {"ok": True}


# ── Pins ──────────────────────────────────────────────────────────────────────

@app.get("/api/pins")
def get_pins():
    return {"pins": DB.get_pinned(_CONN)}


@app.post("/api/pins/{slug}")
def pin_lesson(slug: str):
    if not DB.pin_lesson(_CONN, slug):
        raise HTTPException(status_code=400, detail="Max 3 lessons can be pinned")
    _CONN.commit()
    return {"ok": True}


@app.delete("/api/pins/{slug}")
def unpin_lesson(slug: str):
    DB.unpin_lesson(_CONN, slug)
    _CONN.commit()
    return {"ok": True}


# ── Connections ───────────────────────────────────────────────────────────────

class ConnectionPayload(BaseModel):
    from_slug: str
    to_slug: str
    label: str = ""


@app.get("/api/connections/{slug}")
def get_connections(slug: str):
    return {"connections": DB.get_connections(_CONN, slug)}


@app.post("/api/connections")
def add_connection(payload: ConnectionPayload):
    conn_obj = {"id": f"conn{int(time.time()*1000)}", "from_slug": payload.from_slug,
                "to_slug": payload.to_slug, "label": payload.label,
                "created_at": datetime.now().strftime("%Y-%m-%dT%H:%M:%S")}
    DB.add_connection(_CONN, conn_obj)
    _CONN.commit()
    return {"ok": True, "id": conn_obj["id"]}


@app.delete("/api/connections/{cid}")
def delete_connection(cid: str):
    if not DB.delete_connection(_CONN, cid):
        raise HTTPException(status_code=404, detail="Connection not found")
    _CONN.commit()
    return {"ok": True}


# ── Study Planner ─────────────────────────────────────────────────────────────

class StudyPlanPayload(BaseModel):
    name: str
    description: str = ""
    target_date: str = ""


class PlanLessonPayload(BaseModel):
    slug: str


class PlanLessonDonePayload(BaseModel):
    done: bool


@app.get("/api/plans")
def get_plans():
    return {"plans": DB.get_study_plans(_CONN)}


@app.post("/api/plans")
def create_plan(payload: StudyPlanPayload):
    plan = {"id": f"plan{int(time.time()*1000)}", "name": payload.name.strip(),
            "description": payload.description, "target_date": payload.target_date or None,
            "created_at": datetime.now().strftime("%Y-%m-%dT%H:%M:%S")}
    DB.create_study_plan(_CONN, plan)
    _CONN.commit()
    return {"ok": True, "id": plan["id"]}


@app.delete("/api/plans/{pid}")
def delete_plan(pid: str):
    if not DB.delete_study_plan(_CONN, pid):
        raise HTTPException(status_code=404, detail="Plan not found")
    _CONN.commit()
    return {"ok": True}


@app.post("/api/plans/{pid}/lessons")
def add_plan_lesson(pid: str, payload: PlanLessonPayload):
    DB.add_to_plan(_CONN, pid, payload.slug)
    _CONN.commit()
    return {"ok": True}


@app.delete("/api/plans/{pid}/lessons/{slug}")
def remove_plan_lesson(pid: str, slug: str):
    DB.remove_from_plan(_CONN, pid, slug)
    _CONN.commit()
    return {"ok": True}


@app.post("/api/plans/{pid}/lessons/{slug}/done")
def toggle_done(pid: str, slug: str, payload: PlanLessonDonePayload):
    DB.toggle_plan_lesson_done(_CONN, pid, slug, payload.done)
    _CONN.commit()
    return {"ok": True}


# ── Flashcards ────────────────────────────────────────────────────────────────

class FlashcardPayload(BaseModel):
    source_slug: str = ""
    front: str
    back: str
    tag: str = ""


@app.get("/api/flashcards")
def get_flashcards(tag: str = "", source_slug: str = ""):
    return {"cards": DB.get_flashcards(_CONN, tag or None, source_slug or None)}


@app.post("/api/flashcards")
def add_flashcard(payload: FlashcardPayload):
    card = {"id": f"fc{int(time.time()*1000)}", "source_slug": payload.source_slug,
            "front": payload.front.strip(), "back": payload.back.strip(), "tag": payload.tag,
            "created_at": datetime.now().strftime("%Y-%m-%dT%H:%M:%S")}
    DB.add_flashcard(_CONN, card)
    _CONN.commit()
    return {"ok": True, "id": card["id"]}


@app.delete("/api/flashcards/{fid}")
def delete_flashcard(fid: str):
    if not DB.delete_flashcard(_CONN, fid):
        raise HTTPException(status_code=404, detail="Card not found")
    _CONN.commit()
    return {"ok": True}


# ── Lesson Visits ─────────────────────────────────────────────────────────────

@app.post("/api/visits/{slug}")
def record_visit(slug: str):
    lesson = DB.get_lesson_by_slug(_CONN, slug) or DB.get_current_lesson(_CONN)
    if not lesson:
        raise HTTPException(status_code=404, detail="Lesson not found")
    h = DB.record_lesson_visit(_CONN, slug, json.dumps(lesson, sort_keys=True))
    _CONN.commit()
    return {"ok": True, "hash": h}


@app.get("/api/visits/{slug}")
def get_visit(slug: str):
    v = DB.get_lesson_visit(_CONN, slug)
    if not v:
        return {"visited": False}
    return {"visited": True, **v}


# ── Export ────────────────────────────────────────────────────────────────────

@app.get("/api/export/{slug}")
def export_lesson(slug: str, fmt: str = "md"):
    lesson = DB.get_lesson_by_slug(_CONN, slug) or DB.get_current_lesson(_CONN)
    if not lesson:
        raise HTTPException(status_code=404, detail="Lesson not found")
    meta = lesson.get("meta", {}) if isinstance(lesson.get("meta"), dict) else {}
    title = meta.get("title", slug)
    note = DB.get_note(_CONN, slug)
    lines = [f"# {title}", ""]
    hook = lesson.get("hook", {})
    if isinstance(hook, dict) and hook.get("problem"):
        lines += ["## Hook", hook["problem"], ""]
    for c in lesson.get("core_concepts", []):
        if isinstance(c, dict):
            lines += [f"## {c.get('title', 'Concept')}", c.get("explanation", ""), ""]
    insights = lesson.get("key_insights", [])
    if insights:
        lines += ["## Key Insights"]
        for ins in insights:
            lines.append(f"- {ins}")
        lines.append("")
    if note:
        lines += ["## My Notes", note, ""]
    content = "\n".join(lines)
    filename = f"{slug}.md" if fmt == "md" else f"{slug}.txt"
    return PlainTextResponse(content=content,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'})


# Serve React build
DIST = Path(os.getenv("REACT_DIST_DIR", str(Path(__file__).parent / "react-app" / "dist")))
if DIST.exists():
    app.mount("/assets", StaticFiles(directory=str(DIST / "assets")), name="assets")

    @app.get("/{full_path:path}")
    def spa_fallback(full_path: str):
        return FileResponse(str(DIST / "index.html"))
