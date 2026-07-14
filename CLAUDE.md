# teach-me — Daily AI Deep Dive System

* [ ]

## Quick Start

```bash
# In Claude Code, generate today's lesson:
/teach

# Or pick a specific topic:
/teach chunked prefill internals

# After session, log it:
# Tell Claude "done" in the same conversation
```

## Commands

| Command                | What it does                                                                                          |
| ---------------------- | ----------------------------------------------------------------------------------------------------- |
| `/teach [topic]`     | Full lesson generation (concepts, quiz, insights, design kata) — launches the React viewer           |
| `/grill [topic]`     | Standalone terminal quiz session on a past or new topic; also drains the requiz queue                 |
| `/drill [category]`  | 3-problem back-of-envelope capacity-estimation drill (QPS, storage, GPU economics, etc.)              |
| `/tradeoff [topic]`  | Argue-both-sides trainer — steelman two sides of a real architecture decision, then commit to a call |
| `/postmortem [name]` | Diagnose a real public outage from its timeline before the root cause is revealed                     |

* [ ] 

## Project Layout

```
teach-me/
├── .claude/commands/            # Skill files: teach, grill, drill, tradeoff, postmortem
├── .teach/
│   ├── memory.json              # Session progress, streak, weak areas, requiz queue
│   ├── curriculum-v2.json       # Topic graph (tracks/ladder/capstones)
│   ├── question_bank.json       # Pool of past quiz/micro-quiz questions, used for warm-ups
│   ├── drill_stats.json         # /drill history + accuracy by category (created on first run)
│   ├── archive/                 # Past lessons, one JSON per completed topic
│   └── current_lesson.json      # Generated lesson (gitignored, regenerated each run)
├── app/
│   ├── server.py                # FastAPI backend (localhost:8001)
│   └── react-app/                # React + Vite viewer (lesson, library, stats)
├── resume/                       # Reference only (gitignored)
└── CLAUDE.md                     # This file
```

## Skill: /teach

When invoked, Claude:

1. Checks memory.json for progress, streak, and weak areas (never repeats completed topics)
2. Runs a startup consistency check: repairs stale `in_progress` state if it doesn't match `current_lesson.json`, and fixes any `completed[]` topic whose status drifted out of sync in `curriculum-v2.json`
3. Spawns an `ai-engineer` agent that scores candidates from the curriculum graph (`.teach/curriculum-v2.json`) and presents 3 options: momentum / gap / wildcard — or uses your typed override
4. Generates the lesson JSON via parallel concept agents (capstone design sessions instead run produce-then-critique in the terminal), including a 5-question warm-up pulled from `.teach/question_bank.json` and a **design kata** — one applied production decision you solve before seeing a strong-answer verdict
5. Launches the React viewer at http://localhost:8001
6. After you say "done", debriefs the warm-up and design kata, logs the session (quiz score, weak areas) to memory.json, updates the topic's status in curriculum-v2.json, and writes warm-up results back to `question_bank.json`

## Warm-Up Question Bank

Every `/teach` session opens with 5 warm-up questions pulled from `.teach/question_bank.json` (never generated fresh) — built from every quiz and micro-quiz question across `.teach/archive/*.json`. Selection prioritizes questions due for spaced review, low-scoring topics, weak-area overlap, and least-recently-asked. Each answer updates `times_asked`/`times_correct` on the bank entry, and correct answers tied to a weak area count toward retiring it (`reinforced_count >= 2`).

## Requiz Queue

Topics that need a scored recheck (e.g. an overdue spaced-repetition review, or a topic flagged during a session) sit in `memory.json`'s top-level `requiz_queue` array. `/grill` always drains this queue first — grilling the first slug in it, scoring the session, updating that topic's `quiz_score_pct` and `next_review_date`, and removing it from the queue.

## Design Katas

Each generated lesson can include a `design_kata` — one concrete, applied production scenario tied to the day's topic. You answer it during the debrief; Claude judges it strict-but-fair against a `strong_answer` rubric (never shown to you) and logs a pass/fail (`kata_passed`) on the `completed[]` entry.

## Stats Page

`http://localhost:8001/stats` — per-track curriculum coverage vs. target mix, a score trend chart, weak-areas list (with age and reinforcement progress), review debt (overdue + next 7 days), streak, and requiz queue at a glance.

## Memory

Progress is tracked in `.teach/memory.json`. It records:

- Completed topics (with date, quiz score, weak areas)
- Current streak
- Weak areas to reinforce in future sessions
- Domain of each completed topic (for balance tracking)

## Dynamic Curriculum (relevance graph)

Topics live in `.teach/curriculum-v2.json` — 4 tracks (distributed-core, backend-scale, ai-infra-design, wildcard) whose topics carry soft `builds_on`/`related` edges. **Nothing is ever locked** — the graph only shapes scoring. Each `/teach` spawns an `ai-engineer` subagent that picks 3 options from the graph:

1. **Momentum** — most connected (via graph edges) to the last 1–3 sessions
2. **Gap** — from the track furthest below its `mix_targets` ratio, weighted toward weak areas
3. **Wildcard** — rotation-seeded draw from anywhere

Free-typing any topic still bypasses everything. Each track ends in a **capstone design session** (you produce a design against requirements; the agent critiques it against a rubric: requirements, capacity math, bottleneck, failure modes, tradeoffs). Capstones are offered automatically once most of their building blocks are complete, and run in the terminal — no React app.

Completed sessions update both `memory.json` and the topic's `status` in `curriculum-v2.json`; custom topics get appended to the wildcard track so future momentum scoring sees them.

**Domain coverage across the tracks:**

- **LLM Architecture** — attention variants (GQA/MLA), quantization (GPTQ/AWQ/FP8), speculative decoding, MoE, Mamba/SSMs, FlashAttention internals, positional encodings, tokenization
- **Inference & Serving** — tensor/pipeline parallelism, KV cache eviction & quantization, prefix caching, disaggregated prefill, Triton/CUDA kernels, GPU profiling, roofline model
- **Training & Alignment** — RLHF, DPO, RLAIF, FSDP/ZeRO distributed training, scaling laws, data curation, knowledge distillation, model merging
- **Agentic Systems** — agent architectures (ReAct/Reflexion/LATS), tool use patterns, agent memory, multi-agent orchestration, agent evaluation, planning under uncertainty
- **ML/DS & Evaluation** — calibration & uncertainty, mechanistic interpretability, embedding evaluation, retrieval metrics, statistical testing
- **MLOps** — experiment tracking, model versioning, A/B testing for LLMs, drift detection, CI/CD for ML, feature stores
- **Backend Systems** — PostgreSQL internals, Redis clustering, Kafka, rate limiting, circuit breakers, gRPC, API design, caching strategies
- **System Design / HLD** — Raft consensus, consistent hashing, CAP/PACELC, event sourcing/CQRS, saga pattern, microservices/DDD, Kubernetes, service mesh, observability, SLOs
- **Cross-domain** (high value) — vector DB internals, LLM serving system design, streaming inference, AI feature stores, semantic caching architectures

The agent balances domains, scales difficulty as completed count grows, and never repeats covered topics.

## Learner Profile

Sumanth has already built: LLM inference engines with PagedAttention + continuous batching,
hybrid RAG (Neo4j + Weaviate), LoRA fine-tuning, multi-agent systems, vLLM/SGLang deployments.

**Never re-explain**: attention basics, KV cache basics, RAG basics, LoRA basics.
**Do**: go to mechanisms, math, production tradeoffs, reference real systems (vLLM, FlashAttention, etc.)

## App Setup & Deployment

**IMPORTANT: This project runs in Docker. NEVER run `npm run build` or `pip install` directly.**

To apply any frontend or backend changes:

```bash
docker compose up --build -d
```

That's the only command needed — it rebuilds the React app and restarts the server.

```bash
# First-time setup only — set in your shell environment:
export ANTHROPIC_API_KEY=...
```

See README.md for the always-on LaunchAgent setup.