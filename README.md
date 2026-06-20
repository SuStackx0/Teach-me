# Teach Me

A personal daily learning system for AI/ML and backend engineering. Generates expert-level lessons via Claude Code, renders them in a Streamlit app, and tracks progress with spaced repetition.

Built for: Sumanth G — AI Backend Engineer at uCube.ai.

---

## What It Does

Type `/teach` in Claude Code → a full lesson generates in ~60 seconds → Streamlit opens at `localhost:8501` → work through concepts, attempt the coding challenge, take the quiz → log the session → next lesson is pre-generated for instant startup tomorrow.

The system tracks what you've learned, schedules reviews, and surfaces weak areas in future warm-ups.

---

## Setup

```bash
# 1. Install dependencies
cd app
pip install -r requirements.txt

# 2. Set your Anthropic API key
export ANTHROPIC_API_KEY=sk-...

# 3. Open the project in Claude Code
cd /path/to/teach-me
claude
```

---

## Usage

```bash
# Start today's lesson (auto-selects next topic)
/teach

# Force a specific topic
/teach speculative-decoding
/teach flashattention-internals
/teach kafka-internals

# When you finish, log the session from the Streamlit Complete screen
# or say "done" in the Claude Code terminal
```

---

## How a Session Works

```
/teach
  ├── Crash recovery check (resumes incomplete sessions)
  ├── Spaced repetition check (review due? runs review quiz first)
  └── New lesson generation
        ├── Skeleton (inline, instant)
        ├── 4–5 concept agents in parallel     ~30s
        ├── Streamlit launches ← you start reading
        └── Quiz + Challenge agents in parallel ~30s
              └── Merged into lesson on disk
```

**Lesson flow in Streamlit:**

`Warm-up → Hook → Concept Map → Challenge Attempt → Concepts (×4-5) → Insights → Quiz → Challenge → Summary → Complete`

- **Challenge Attempt** — attempt the coding problem *before* reading theory (productive failure)
- **Micro-quizzes** — 1 question per concept, reveal-and-grade inline
- **Log Session** — the Complete screen writes directly to `memory.json` and archives the lesson

---

## Curriculum

60 topics across two interleaved tracks — one AI/ML session, one Backend/System Design session, alternating daily.

**AI / ML (30 topics):** Transformer micro-architecture, tokenization internals, embedding models, speculative decoding, FlashAttention, MoE routing, GQA/MQA/MLA, quantization (GPTQ/AWQ/FP8), LoRA/QLoRA/DoRA, RLHF/DPO, Mamba/SSM, Triton kernels, GPU profiling, reasoning models, and more.

**Backend + System Design (30 topics):** FastAPI internals, PostgreSQL/Redis internals, gRPC, Kafka, consistent hashing, CAP theorem, event sourcing/CQRS, saga pattern, CRDT, Kubernetes, service mesh, distributed tracing, system design deep-dives (Twitter, Uber, YouTube), and more.

---

## Progress Tracking

Progress is stored in `.teach/memory.json`:

- **Completed sessions** — slug, date, quiz score, weak areas, next review date
- **Spaced repetition** — review dates computed from quiz score (2 / 7 / 14 days)
- **Weak areas** — structured, retires after 2 successful reinforcements
- **Streak** — consecutive days with a session

Completed lessons are archived to `.teach/archive/{slug}.json` for review.

The dashboard at `localhost:8501/Dashboard` shows:
- Progress by category (with working progress bars)
- Review queue (topics due for spaced repetition)
- Recently completed sessions with next review dates
- Active weak areas

---

## Project Layout

```
teach-me/
├── .claude/
│   └── commands/
│       └── teach.md          # /teach skill — lesson generation logic
├── .teach/
│   ├── curriculum.json       # 60 ordered topics
│   ├── memory.json           # progress, streak, weak areas
│   ├── current_lesson.json   # active lesson (gitignored)
│   └── archive/              # completed lesson JSONs (gitignored)
├── app/
│   ├── app.py                # Streamlit lesson viewer
│   ├── pages/
│   │   └── 1_Dashboard.py   # Progress dashboard
│   └── requirements.txt
├── CLAUDE.md                 # Project instructions for Claude Code
└── README.md
```

---

## Learner Profile

Topics assume you've already built:
- LLM inference engines with PagedAttention + continuous batching
- Hybrid RAG (Neo4j + Weaviate, cross-encoder reranking, semantic caching)
- LoRA fine-tuning, multi-agent systems (LangGraph), vLLM/SGLang deployments

Topics never re-explain attention basics, KV cache fundamentals, LoRA mechanics, or RAG retrieval. They go straight to mechanisms, production tradeoffs, and real system references.

---

## Requirements

- Claude Code CLI with an Anthropic API key
- Python 3.10+
- Streamlit, anthropic SDK (see `app/requirements.txt`)
- macOS (uses `open` to launch browser)
