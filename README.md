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
/teach                        # AI picks today's optimal topic
/teach chunked prefill        # force a specific topic
```

The skill:

1. Selects today's topic (ai-engineer agent reads your history, balances domains)
2. Generates a full lesson with parallel agents (concepts, quiz, insights)
3. Opens `http://localhost:8001` in your browser

Study the lesson, then come back to Claude Code and say **"done"** — your score, weak areas, and spaced repetition schedule are saved automatically.

## Library

Past lessons are saved and browsable at `http://localhost:8001/library` — grouped by domain, click any to re-study it.

## Stack

- **Frontend**: React + Vite (built static, served by uvicorn) — lesson viewer with Mermaid diagrams, micro-quizzes, quiz, library of past sessions
- **Backend**: FastAPI (`app/server.py`) — serves lesson JSON, lesson archive, session logging, and the React app
- **Lesson data**: `.teach/current_lesson.json` (today's lesson), `.teach/memory.json` (progress + spaced repetition), `.teach/archive/` (past lessons)
