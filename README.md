# teach-me

**A daily deep-dive tutor for senior AI & backend engineers — run one command in Claude Code, get a rigorous, personalized lesson in your browser.**

`/teach` picks a topic worth your time, generates a full lesson (concepts, diagrams, a graded quiz, a real production design problem), opens it in a local web app, and remembers what you learned — score, weak areas, and a spaced-repetition schedule — so tomorrow's lesson builds on today's.

Built for people who already know the basics. No "what is attention" — it goes straight to mechanisms, math, and production tradeoffs, referencing real systems (vLLM, FlashAttention, Raft, Kafka).

---

## 60-second quickstart

Requires **Docker** and an **`ANTHROPIC_API_KEY`**.

```bash
git clone <repo-url> teach-me
cd teach-me
export ANTHROPIC_API_KEY=your_key        # first time only
docker compose up --build -d             # builds React + starts server on :8001
```

Then open Claude Code in this directory and run:

```
/teach                    # presents 3 topic options — reply 1, 2, or 3
/teach chunked prefill    # or name a topic directly
```

A lesson opens at **http://localhost:8001**. Study it, come back to Claude Code, and say **"done"** — your score, weak areas, and review schedule are saved automatically.

> One command — `docker compose up --build -d` — rebuilds the frontend and restarts the backend. Never run `npm` or `pip` directly.

---

## What you get from one `/teach`

| Section | What it is |
|---|---|
| **Hook** | A real-world production problem so the topic isn't abstract |
| **Concept map** | Mermaid diagram of how the pieces connect |
| **Core concepts** | Mechanism- and math-level explanations in clear sub-steps |
| **5-question warm-up** | Pulled from *past* lessons — surfaces what you're forgetting |
| **Graded quiz** | Scored, logged, fed into weak-area tracking |
| **Design kata** | One applied production decision you solve live, judged strict-but-fair against a hidden rubric |
| **Key insights & further reading** | Takeaways worth keeping, plus where to go deeper |

Topics never repeat. The system rotates across LLM architecture, inference & serving, backend systems, system design, agentic systems, MLOps and more — balancing domains and scaling difficulty as you complete more.

---

## The web app

Everything lives at **http://localhost:8001**:

| Page | What's there |
|---|---|
| **Today** | Current lesson — hook, diagrams, concepts, micro-quizzes, quiz, design kata |
| **Library** | Every past lesson, grouped by domain — pinned lessons at top, tag chips per lesson |
| **Stats** | Curriculum coverage, score-trend chart, weak areas, review debt, streak heatmap |
| **Review** | Lessons due for spaced-repetition recheck |
| **Search** | Full-text search across all lessons |
| **Notes** | Per-lesson notes panel (⌘L clips selected text directly) |
| **Bookmarks** | Saved sections from any lesson |
| **Highlights** | Colour-coded text highlights across lessons |
| **Glossary** | Personal term definitions, linked to source lessons |
| **Snippets** | Saved code snippets with syntax tagging |
| **Collections** | Manually curated lesson groups |
| **Planner** | Study plan with target date and per-lesson done tracking |
| **Flashcards** | Self-made flashcards from any lesson |
| **Map** | Topic graph — how domains and topics connect |
| **Timeline** | Learning history over time |
| **TIL** | "Today I Learned" wall — key insights across all lessons |
| **Wishlist ◈** | Drop in any topic; the tutor surfaces it when it fits your path |

Nav: 5 primary links + **More ▾** dropdown. Dark mode and a streak counter 🔥 in the nav.

### Lesson sidebar

While studying, the sidebar shows:
- **Table of contents** — jump to any section; checkboxes after visiting; dot colours for micro-quiz results
- **Up Next** — the queued lessons waiting after the current one; click any to switch to it immediately

### Queue management

Lessons can be queued up in advance. The active lesson is always slot 1. Click any slot in "Up Next" to make it the new active lesson — the old slot 1 and anything before it shift down. Say "done" in Claude Code to log the current lesson and auto-advance the queue.

---

## Beyond `/teach` — four training modes

| Command | What it does |
|---|---|
| `/grill [topic]` | Standalone quiz — also drains the requiz queue (topics due for a scored recheck) first |
| `/drill [category]` | 3-problem back-of-envelope capacity estimation (QPS, storage, GPU economics, sharding) |
| `/tradeoff [topic]` | Argue-both-sides trainer — steelman two real architecture options, then commit to a call |
| `/postmortem [name]` | Diagnose a real public outage from its timeline before the root cause is revealed |

---

## How it works

1. **Topic selection** — an `ai-engineer` agent scores candidates from a relevance graph (4 tracks with soft `builds_on`/`related` edges) and offers three picks: *momentum* (connected to recent sessions), *gap* (under-covered track), and *wildcard*. Free-type any topic to override.
2. **Lesson generation** — parallel agents produce concepts, quiz, insights, and a design kata, plus a warm-up drawn from your question bank (spaced-repetition weighted).
3. **The viewer** — React + Vite app served by FastAPI renders it with Mermaid diagrams, interactive quizzes, and the full annotation/progress toolkit.
4. **Logging** — on "done", the session is scored, logged to SQLite, and the curriculum graph updates; weak areas and spaced-repetition dates update automatically; the queue advances.

---

## Stack

- **Frontend** — React + Vite, built static, served by uvicorn. Mermaid diagrams, interactive quizzes, library, stats, heatmap, dark mode.
- **Backend** — FastAPI (`app/server.py`) — lesson serving, session logging, stats, search, all annotation endpoints (highlights, glossary, snippets, flashcards, etc.), queue management.
- **DB** — SQLite (`teach.db`, auto-created, Docker-volume-mounted). Schema and helpers in `app/db.py`. No JSON files at runtime.
- **Orchestration** — Claude Code slash commands in `.claude/commands/` (`teach`, `grill`, `drill`, `tradeoff`, `postmortem`). The `teach` skill calls `scripts/teach_cli.py` for all DB reads/writes.
- **Curriculum** — 4 tracks (distributed-core, backend-scale, ai-infra-design, wildcard) in `.teach/curriculum-v2.json` (gitignored; lives in SQLite at runtime).

---

## Always-on server (optional, macOS)

Run the server persistently via a LaunchAgent so it survives reboots:

```bash
cp app/com.teachme.server.plist ~/Library/LaunchAgents/
launchctl load ~/Library/LaunchAgents/com.teachme.server.plist
lsof -i :8001 | grep LISTEN   # verify
```

---

## Learner profile

The tutor adapts to what you already know. Edit the **Learner Profile** section in `CLAUDE.md` to tell it what to skip and what to go deep on. The default profile is tuned for someone who has already built LLM inference engines, hybrid RAG pipelines, LoRA fine-tuning, and multi-agent systems — skip the basics, go straight to mechanisms.
