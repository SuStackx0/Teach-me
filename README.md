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
3. Generates the full lesson with parallel agents (concepts, quiz, insights)
4. Opens `http://localhost:8001` in your browser

Study the lesson, then come back to Claude Code and say **"done"** — your score, weak areas, and spaced repetition schedule are saved automatically.

## Library

Past lessons are saved and browsable at `http://localhost:8001/library` — grouped by domain, click any to re-study it.

## Stack

- **Frontend**: React + Vite (built static, served by uvicorn) — lesson viewer with Mermaid diagrams, micro-quizzes, quiz, library of past sessions
- **Backend**: FastAPI (`app/server.py`) — serves lesson JSON, lesson archive, session logging, and the React app
- **Lesson data**: `.teach/current_lesson.json` (today's lesson), `.teach/memory.json` (progress + spaced repetition), `.teach/archive/` (past lessons)
