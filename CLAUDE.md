# teach-me — Daily AI Deep Dive System

A personalized daily teaching tool for Sumanth (AI Backend Engineer, uCube.ai).

## Quick Start

```bash
# In Claude Code, generate today's lesson:
/teach

# Or pick a specific topic:
/teach speculative-decoding

# After session, log it:
# Tell Claude "done" in the same conversation
```

## Project Layout

```
teach-me/
├── .claude/commands/teach.md   # The /teach skill
├── .teach/
│   ├── curriculum.json         # 30 ordered topics (LLM arch / backend / system design)
│   ├── memory.json             # Session progress, streak, weak areas
│   └── current_lesson.json    # Generated lesson (gitignored, regenerated each run)
├── app/
│   ├── app.py                  # Streamlit teaching UI (localhost:8501)
│   └── requirements.txt
├── resume/                     # Reference only (gitignored)
└── CLAUDE.md                   # This file
```

## Skill: /teach

When invoked, Claude:

1. Checks memory.json for completed topics (never repeats)
2. Selects next topic from curriculum (or uses your override)
3. Generates a full lesson JSON directly
4. Launches Streamlit at http://localhost:8501
5. After you say "done", logs the session with quiz scores and weak areas

## Memory

Progress is tracked in `.teach/memory.json`. It records:

- Completed topics (with date, quiz score, weak areas)
- Current streak
- Weak areas to reinforce in future sessions

## Curriculum

60 topics across two groups, interleaved so every other day alternates AI ↔ Backend:

- **AI/ML (30 topics)**: LLM architecture internals, quantization, speculative decoding, FlashAttention, MoE, GQA/MLA, RLHF/DPO, PEFT, scaling laws, reasoning models, mech-interp, Mamba/SSM, GPU profiling, Triton kernels, etc.
- **Backend + System Design (30 topics)**: FastAPI internals, PostgreSQL/Redis internals, gRPC, Kafka, consistent hashing, CAP theorem, event sourcing/CQRS, saga pattern, CRDT, Kubernetes, service mesh, distributed tracing, HLD (Twitter/Uber/YouTube), LLD/SOLID, etc.

Both groups sorted intermediate → advanced → expert; prerequisites within each group are respected.

## Learner Profile

Sumanth has already built: LLM inference engines with PagedAttention + continuous batching,
hybrid RAG (Neo4j + Weaviate), LoRA fine-tuning, multi-agent systems, vLLM/SGLang deployments.

**Never re-explain**: attention basics, KV cache basics, RAG basics, LoRA basics.
**Do**: go to mechanisms, math, production tradeoffs, reference real systems (vLLM, FlashAttention, etc.)

## App Setup (first time)

```bash
cd app
pip install -r requirements.txt
# Set ANTHROPIC_API_KEY in environment for interactive features
```
