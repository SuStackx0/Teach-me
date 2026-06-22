# teach-me Full-Stack Redesign

**Date:** 2026-06-22  
**Status:** Approved  
**Scope:** React frontend + FastAPI backend + teach.md skill fix

---

## Problem

The app currently shows only today's lesson — there is no way to browse or revisit past sessions. Completed lessons get archived to disk but are invisible in the UI. The sidebar is the only navigation surface, which is fine for one lesson but breaks down as session count grows. Additionally, the `/teach` skill unnecessarily reads from the `resume/` directory when the ai-engineer agent already has everything it needs from `memory.json`.

---

## Goals

1. Every completed lesson persists as a browsable page
2. Running `/teach` tomorrow creates a new page without touching old ones
3. Navigate freely between past sessions
4. Past lessons grouped by domain (AI Architecture, Backend, System Design, etc.)
5. Past lessons are re-attemptable (quiz/challenge work again, local state only)
6. Remove resume dependency from topic selection
7. Richer study UI (content-level improvements, typography/color handled by react-design-agent)

---

## Architecture

### Routing — React Router v6

Three routes, all in a single SPA shell:

| Route | View | Sidebar |
|---|---|---|
| `/` | Today's lesson (existing viewer) | TOC sidebar |
| `/library` | Domain-grouped past lesson cards | None |
| `/lesson/:slug` | Past lesson viewer (re-attemptable) | TOC sidebar |

Top nav bar (persistent across all routes):
- Left: `teach-me` wordmark
- Center: `Today` · `Library` nav links (active state on current route)
- Right: streak counter (from `memory.json`)

The existing TOC sidebar only renders on `/` and `/lesson/:slug`. It does not render on `/library`.

### File System as DB

No new database. Two existing files are the source of truth:

- **`.teach/memory.json`** — metadata index: completed[], each entry has slug, title, date, domain, quiz_score_pct, time_spent_minutes, weak_areas, next_review_date
- **`.teach/archive/{slug}.json`** — full lesson JSON, written by `POST /api/session/log` (already implemented)
- **`.teach/current_lesson.json`** — today's lesson only, ephemeral

### Backend — FastAPI (`app/server.py`)

#### New endpoints

**`GET /api/library`**

Reads `memory.json` completed[], cross-references with archive files, returns grouped metadata. Does not return full lesson content — just enough for cards.

```python
# Response shape
{
  "groups": [
    {
      "domain": "AI Architecture",
      "lessons": [
        {
          "slug": "gqa-vs-mla-kv-compression-mechanics",
          "title": "GQA vs MLA: KV Cache Compression",
          "date": "2026-06-22",
          "quiz_score_pct": 0.85,
          "time_spent_minutes": 38,
          "difficulty": "intermediate",
          "archived": true   # false if archive file missing
        }
      ]
    }
  ],
  "total": 1,
  "streak": 4
}
```

Domain grouping order (fixed): AI Architecture → Inference & Serving → Training & Alignment → Agentic Systems → Backend Systems → System Design → MLOps → ML/DS & Evaluation → General.

**`GET /api/lesson/{slug}`**

Reads `.teach/archive/{slug}.json`. Returns full lesson JSON (same shape as `/api/lesson`). Returns 404 if file not found.

#### Modified endpoints

**`POST /api/session/log`**

Add `domain: str = ""` to `SessionLog` model. Write it into the memory entry. Extract it from the lesson's `meta.domain` if not provided by the client (client should send it from the loaded lesson data).

#### Unchanged endpoints

- `GET /api/lesson` — today's current lesson
- `GET /api/memory` — raw memory JSON

### Frontend — React components

#### New components

**`TopNav`** (`src/components/TopNav.jsx`)
- Renders the top navigation bar (wordmark, route links, streak)
- Uses React Router `<NavLink>` for active state
- Streak fetched from `/api/memory` on mount, cached in context

**`LibraryPage`** (`src/components/LibraryPage.jsx`)
- Fetches `/api/library` on mount
- Renders domain group sections (collapsible, default open)
- Each lesson renders as a `LessonCard`

**`LessonCard`** (`src/components/LessonCard.jsx`)
- Shows: title, date, difficulty badge, quiz score (color-coded), time spent
- Clicking navigates to `/lesson/:slug`
- Score color: ≥80% green, ≥60% yellow, <60% red, null = grey "–"

**`HistoryLessonView`** (`src/components/HistoryLessonView.jsx`)
- Fetches `/api/lesson/:slug`
- Renders the same section viewer as today's lesson (`App.jsx` logic extracted into a shared hook)
- Shows a thin "Studied [date] · [score]%" banner at top (fades out after 4s)
- Complete screen: no debrief form, no session log POST. Shows a "Back to Library" button instead.
- Quiz/challenge scores are local component state — not written to memory.

#### Modified components

**`App.jsx`**
- Wraps everything in `<BrowserRouter>`
- Defines the three `<Route>` entries
- Extracts lesson-fetching + section-building logic into `useLessonSession(url)` hook so both `TodayView` and `HistoryLessonView` share it

**`Sidebar.jsx`**
- No structural changes. Now receives lesson data via the shared hook instead of directly from App state.

**`Complete.jsx`** (today's view)
- Unchanged — debrief form and session log POST stay here

**`CoreConcept.jsx`**, **`Quiz.jsx`**, **`ConceptMap.jsx`**
- Content-level improvements (see Study UI section below)

#### Routing entry in `vite.config.js`

Add `historyApiFallback: true` (already in Vite dev server by default). Ensure the FastAPI server is not catching `/lesson/*` paths — it won't since the React app is served separately on port 5173.

---

## Study UI Improvements

These are content-level changes only. Typography and color scheme are handled separately by the react-design-agent (docs-style direction, not the current purple dark theme).

### CoreConcept
- Explanation text: increase to `font-size: 1.05rem`, `line-height: 1.8`, max-width capped at 680px for readability
- Math expressions: any text matching `\$...\$` or wrapped in backticks with `=` signs gets a distinct display block (light background, monospace, centered) instead of inline treatment
- Code examples: add syntax-aware line highlighting via CSS classes (no new lib — just color classes on `<span>` elements already present in the lesson JSON `line_by_line` field)

### Quiz
- On answer selection: immediately show the explanation text (currently hidden until next question)
- Correct answer always revealed after selection, even if user got it right (current behavior only reveals on wrong)

### ConceptMap
- If `concept_map.diagram` field is present, render it as a Mermaid diagram (already supported via `MermaidDiagram` component)
- If no diagram field, fall back to current pill layout

### Sidebar stats
- Add domain tag next to lesson title (pulled from `lesson.meta.domain` or `lesson.domain`)

---

## teach.md Skill Fix

Remove the block that reads from `resume/`. The ai-engineer agent prompt should only receive:
- `memory.json` content (completed topics, weak areas, learner profile)
- The full domain list from CLAUDE.md

The learner profile in `memory.json` (`learner.known_well[]`) already captures what Sumanth has built — no resume needed.

---

## Data Changes

### `memory.json` — completed entry schema (additive)

```json
{
  "slug": "gqa-vs-mla-kv-compression-mechanics",
  "title": "GQA vs MLA: KV Cache Compression Mechanics",
  "date": "2026-06-22",
  "domain": "AI Architecture",
  "quiz_score_pct": 0.85,
  "time_spent_minutes": 38,
  "weak_areas": [],
  "next_review_date": "2026-07-06"
}
```

`domain` is new. Existing entries without it will show under "General" in the library.

### `SessionLog` Pydantic model — add field

```python
class SessionLog(BaseModel):
    slug: str
    title: str
    domain: str = ""        # new
    debrief_phrase: str = ""
    quiz_score_input: str = ""
    time_spent_minutes: float = 0.0
```

---

## Error States

| Scenario | Behavior |
|---|---|
| `/api/library` — memory.json missing | Return `{ "groups": [], "total": 0, "streak": 0 }` |
| `/api/lesson/{slug}` — archive file missing | 404 with `{ "detail": "Lesson not found" }` |
| Library card for lesson with no archive file | Card renders with `archived: false`, shows "File missing" badge, click disabled |
| Today's lesson missing | Existing "No Lesson Loaded" screen unchanged |

---

## Out of Scope

- Search across lessons
- Tags / manual annotation
- Spaced repetition scheduling UI (next_review_date exists in data but not surfaced yet)
- User accounts / multi-user
- Stats/analytics page (route reserved but not built)

---

## Implementation Order

1. Backend: `GET /api/library`, `GET /api/lesson/{slug}`, `domain` field on session log
2. Frontend routing: install React Router, define routes, extract `useLessonSession` hook
3. TopNav component
4. LibraryPage + LessonCard
5. HistoryLessonView
6. Study UI content improvements
7. teach.md resume fix
8. React design agent pass: typography + color (docs-style)
