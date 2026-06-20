# teach-me — Daily AI Deep Dive System

A personalized daily teaching tool for Sumanth (AI Backend Engineer, uCube.ai).

## Quick Start

```bash
# In Claude Code, generate today's lesson:
/teach

# Or pick a specific topic:
/teach chunked prefill internals

# After session, log it:
# Tell Claude "done" in the same conversation
```

## Project Layout

```
teach-me/
├── .claude/commands/teach.md   # The /teach skill
├── .teach/
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
2. Spawns a `voltagent-data-ai:ai-engineer` agent to select today's optimal topic based on memory (or uses your override)
3. Generates a full lesson JSON directly
4. Launches Streamlit at http://localhost:8501
5. After you say "done", logs the session with quiz scores and weak areas

## Memory

Progress is tracked in `.teach/memory.json`. It records:

- Completed topics (with date, quiz score, weak areas)
- Current streak
- Weak areas to reinforce in future sessions
- Domain of each completed topic (for balance tracking)

## Dynamic Curriculum

No fixed topic list. Each `/teach` invocation spawns a `voltagent-data-ai:ai-engineer` subagent that reads your session memory and selects today's optimal topic.

**Full AI engineer domain coverage** — rotates across all of these:

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

## App Setup (first time)

```bash
cd app
pip install -r requirements.txt
# Set ANTHROPIC_API_KEY in environment for interactive features
```
