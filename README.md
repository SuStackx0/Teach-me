# Teach Me

A daily AI-powered learning system for AI/ML and backend engineering. One command in Claude Code — servers start automatically, lesson opens in the browser, study it, say "done" to log the session.

Covers: LLM architecture, inference & serving, backend systems, system design, agentic systems, MLOps, and more. Rotates domains, never repeats topics, tracks spaced repetition.

## Setup (first time only)

```bash
# Install backend dependencies
pip install fastapi uvicorn

# Install frontend dependencies
cd app/react-app && npm install

# Set your Anthropic API key
export ANTHROPIC_API_KEY=your_key
```

## Usage

Open Claude Code in this directory, then:

```bash
/teach                        # AI picks today's optimal topic
/teach chunked prefill        # force a specific topic
```

That's it. The skill:
1. Selects today's topic (ai-engineer agent reads your history, balances domains)
2. Generates a full lesson with parallel agents (concepts, quiz, insights)
3. Starts the FastAPI server and React app automatically
4. Opens `http://localhost:5173` in your browser

Study the lesson, then come back to Claude Code and say **"done"** — your score, weak areas, and spaced repetition schedule are saved automatically.

## Library

Past lessons are saved and browsable at `http://localhost:5173/library` — grouped by domain, click any to re-study it.

## Stack

- **Frontend**: React + Vite (`app/react-app/`) — lesson viewer with Mermaid diagrams, micro-quizzes, quiz, library of past sessions
- **Backend**: FastAPI (`app/server.py`) — serves lesson JSON, lesson archive, session logging
- **Lesson data**: `.teach/current_lesson.json` (today's lesson), `.teach/memory.json` (progress + spaced repetition), `.teach/archive/` (past lessons)
