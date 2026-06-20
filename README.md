# Teach Me

A daily AI-powered learning system for AI/ML and backend engineering. Type one command, get a full expert lesson with concepts, code, quizzes, and a coding challenge — all in a local Streamlit app. Tracks progress, schedules spaced repetition reviews, and pre-generates the next lesson so startup is instant.

## Setup

1. Add your resume to `resume/` (Claude uses it to personalize lessons to your background)
2. Install deps: `pip install -r app/requirements.txt`
3. Set `ANTHROPIC_API_KEY` in your environment
4. Open the project in Claude Code: `claude`

## Usage

```bash
/teach                        # start today's lesson
/teach speculative-decoding   # force a specific topic
```

The lesson opens at `http://localhost:8501`. When done, log the session from the Complete screen — progress and next review date are saved automatically.
