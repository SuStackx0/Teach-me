# Teach Me

A daily AI-powered learning system for AI/ML and backend engineering. Type one command, get a full expert lesson with concepts, code, quizzes, and a coding challenge — all in a clean React study UI. Tracks progress, schedules spaced repetition reviews, and rotates across LLM architecture, inference, backend, and system design.

## Setup

```bash
# Backend (FastAPI)
pip install fastapi uvicorn

# Frontend (React + Vite)
cd app/react-app && npm install

# Set API key
export ANTHROPIC_API_KEY=your_key
```

## Usage

```bash
/teach                        # start today's lesson (AI picks the topic)
/teach speculative decoding   # force a specific topic
```

The lesson opens at `http://localhost:5173`. The FastAPI backend runs on `http://localhost:8001`. When done, say "done" in Claude Code — progress and spaced repetition dates are saved automatically.

## Stack

- **Frontend**: React + Vite (`app/react-app/`) — dark study UI with Mermaid diagrams, micro-quizzes, and a coding challenge
- **Backend**: FastAPI (`app/server.py`) — serves lesson JSON, handles session logging
- **Lesson data**: `.teach/current_lesson.json` (generated), `.teach/memory.json` (progress)
