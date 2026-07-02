# Teach Me

A daily AI-powered learning system for AI/ML and backend engineering. One command in Claude Code — server starts automatically, lesson opens in the browser, study it, say "done" to log the session.

Covers: LLM architecture, inference & serving, backend systems, system design, agentic systems, MLOps, and more. Rotates domains, never repeats topics, tracks spaced repetition.

## Setup (first time only)

```bash
# Install backend dependencies
pip install fastapi uvicorn

# Install frontend dependencies and build React app
cd app/react-app && npm install && npm run build

# Set your Anthropic API key
export ANTHROPIC_API_KEY=your_key
```

## Auto-start server (always-on)

The server runs persistently via a macOS LaunchAgent and auto-restarts on crash:

```bash
# Install (one time)
cp app/com.teachme.server.plist ~/Library/LaunchAgents/
launchctl load ~/Library/LaunchAgents/com.teachme.server.plist

# Verify it's running
lsof -i :8001 | grep LISTEN
```

After this, the server survives reboots and shell session ends. No need to keep a terminal open.

## Usage

Open Claude Code in this directory and run:

```bash
/teach                        # presents 3 topic options, you pick 1/2/3
/teach chunked prefill        # skip the picker, generate that topic directly
```

The skill:

1. Spawns an ai-engineer agent to generate **3 diverse topic options** from different domains
2. Presents them — reply `1`, `2`, or `3` to choose (or type any topic to override)
3. Generates the full lesson with parallel agents (concepts, quiz, insights) — plus a 5-question warm-up pulled from past sessions and a **design kata** (an applied production decision you answer live)
4. Opens `http://localhost:8001` in your browser

Study the lesson, then come back to Claude Code and say **"done"** — your score, weak areas, and spaced repetition schedule are saved automatically.

## Other commands

| Command | What it does |
|---|---|
| `/grill [topic]` | Standalone terminal quiz — no browser needed. Also drains the requiz queue (topics due for a scored recheck) first. |
| `/drill [category]` | 3-problem back-of-envelope capacity-estimation drill (QPS, storage, GPU economics, sharding, latency budgets, etc.) |
| `/tradeoff [topic]` | Argue-both-sides trainer — steelman two real architecture options, then commit to a call and defend it |
| `/postmortem [name]` | Diagnose a real public outage from its timeline, before the root cause is revealed |

These are terminal-only and log to their own history (`memory.json`'s `tradeoff_sessions` / `postmortem_sessions`, or `.teach/drill_stats.json`) — they never touch your streak or completed-topics list.

## Library & Stats

Past lessons are saved and browsable at `http://localhost:8001/library` — grouped by domain, click any to re-study it.

`http://localhost:8001/stats` shows curriculum coverage per track, a score trend chart, weak areas with reinforcement progress, review debt (overdue + upcoming), streak, and the requiz queue.

## Stack

- **Frontend**: React + Vite (built static, served by uvicorn) — lesson viewer with Mermaid diagrams, micro-quizzes, quiz, library of past sessions, stats dashboard
- **Backend**: FastAPI (`app/server.py`) — serves lesson JSON, lesson archive, session logging, stats aggregation, and the React app
- **Lesson data**: `.teach/current_lesson.json` (today's lesson), `.teach/memory.json` (progress + spaced repetition + requiz queue), `.teach/question_bank.json` (warm-up question pool), `.teach/drill_stats.json` (`/drill` history), `.teach/archive/` (past lessons)
