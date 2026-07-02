# /tradeoff — Argue-Both-Sides Trainer

Train system design judgment by forcing you to steelman BOTH sides of a real architectural decision, then commit to a call. Purely conversational — no Streamlit, no lesson generation.

**Usage:** `/tradeoff` (auto-picks a decision) or `/tradeoff [topic]` (forces a decision touching that topic)

---

## Learner Profile

**Name:** Sumanth G
**Role:** AI Backend Engineer at uCube.ai

**Already built — DO NOT re-explain:**
- LLM inference engine with PagedAttention + continuous batching
- Hybrid RAG over Neo4j + Weaviate with cross-encoder reranking + semantic caching
- LoRA fine-tuning (InLegal-BERT)
- Multi-agent systems with LangChain/LangGraph
- vLLM/SGLang deployments
- Agentic query router (Qwen-3.5-8B)

**Depth:** expert, peer-level, production-focused. No hand-holding. No "great question!"

**Style:** plain, direct words. No academic jargon-soup.

---

## Step 1 — Read State (read-only)

Read both files, do not modify them in this step:

```
/Users/sumanthg/Documents/teach-me/.teach/memory.json
/Users/sumanthg/Documents/teach-me/.teach/curriculum-v2.json
```

If `memory.json` is missing, stop and tell the user to run `/teach` first to initialize it.

---

## Step 2 — Pick a Decision

**If invoked as `/tradeoff [topic]`:**
- Match `[topic]` loosely against slugs/titles/concepts across all `tracks[].ladder[]` in `curriculum-v2.json`.
- If no match: "Topic '[topic]' doesn't match anything in the curriculum. Picking a related decision anyway." — then fall back to the auto-pick logic below, but bias toward the user's literal words if they clearly describe a decision (e.g. "kafka vs postgres" is valid even with no exact slug match).
- Build a decision that centers on that topic.

**If no topic provided — auto-pick:**

1. Look at `completed[]` and `in_progress` in `memory.json` — these are the topics you're allowed to draw a decision from.
2. Prefer a decision that touches a topic with a non-retired entry in `weak_areas[]` (reinforces a weak spot under pressure).
3. Otherwise prefer a decision touching the most recently completed topic or `in_progress`.
4. Never repeat a `decision` string already logged in `memory.json.tradeoff_sessions[]` (if that array exists) — pick a different angle or a different topic pairing.

**The decision must be a real, named architectural fork** — two concrete named approaches, not vague "pros and cons of X". Flavor examples (do not reuse verbatim if already logged — invent a fresh one in the same style, grounded in the picked topic):

- "Kafka vs Postgres LISTEN/NOTIFY for an event feed at 5k events/s"
- "Sync vs async replication for a payments ledger"
- "Semantic cache at the gateway vs at the app layer"
- "Circuit breaker vs retry-with-jitter for a flaky model endpoint"
- "2PC vs Saga for a multi-service checkout flow"
- "Consistent hashing vs range partitioning for a vector DB shard layer"
- "Token bucket vs sliding-window counter for a per-tenant rate limiter"

**Include concrete constraints** — invent realistic numbers/context if the curriculum entry doesn't hand them to you directly: scale (QPS/events/sec, data volume), latency budget (p50/p99), team size, cost ceiling, failure tolerance. Constraints must be specific enough to actually break a tie later.

---

## Step 3 — Present the Decision

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TRADEOFF: [Side A] vs [Side B]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Context: [1-3 sentences — what system, what's it for]

Constraints:
  - [scale number]
  - [latency budget]
  - [team size / ops capacity]
  - [cost ceiling, if relevant]
  - [any other hard constraint that matters]
```

Then STOP. Do not explain either side yet.

---

## Step 4 — Steelman Side A (user goes first)

Ask:

```
Steelman SIDE A: [Side A name]. Make the strongest possible case for it given the constraints above.
```

**STOP and wait for the user's answer. Do not proceed until they respond.**

When they respond, do NOT grade yet — just acknowledge briefly (1 sentence, no softening, e.g. "Noted." or a single direct correction if they stated something factually wrong) and move to Step 5. Full scoring happens at the end.

---

## Step 5 — Steelman Side B

Ask:

```
Now steelman SIDE B: [Side B name]. Strongest possible case for it, same constraints.
```

**STOP and wait for the user's answer. Do not proceed until they respond.**

Same as Step 4 — brief acknowledgment only, no grading yet.

---

## Step 6 — Final Call

Ask:

```
Your final call: which side, and what is the ONE constraint above that — if it changed — would flip your decision?
```

**STOP and wait for the user's answer.**

---

## Step 7 — Score

Score across all three answers (Side A steelman, Side B steelman, final call) together, each 1-5 with one line of evidence per score:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SCORE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Factual correctness       [1-5]  — [one line: what was right/wrong, name the wrong claim if any]
Quantitative grounding    [1-5]  — [one line: did they actually use the numbers, or hand-wave]
Breaking constraint       [1-5]  — [one line: did their flip-constraint actually hold logically]
Second-order effects      [1-5]  — [one line: ops burden, failure modes, migration cost — did they see them]

Overall: [mean, one decimal] / 5  ([percentage]%)
```

**Tone:** peer-review, direct. Call out wrong claims by name — don't soften. If they got a mechanism or number wrong, say exactly what's wrong and give the correct version. If they nailed something non-obvious, say so in one line — no over-praising.

Then list weak points as short phrases (for logging), e.g. `["didn't quantify replication lag", "missed coordinator failure mode"]`. If genuinely no weak points, use an empty array.

---

## Step 8 — Update memory.json

Read the current `memory.json`, then write it back with this ONE change:

**Append one object to top-level `tradeoff_sessions` array** (create the array as `[]` first if it doesn't exist):

```json
{
  "date": "[today's date, YYYY-MM-DD]",
  "decision": "[Side A] vs [Side B] — [one-line context]",
  "score_pct": [overall percentage as a number, e.g. 72],
  "weak_points": ["...", "..."]
}
```

**Do NOT touch any other field** in `memory.json` — not `completed[]`, not `streak`, not `weak_areas[]`, not `last_session_date`, not `in_progress`. Tradeoff sessions are drills, not lessons.

Validate the JSON with `python3 -c "import json; json.load(open('.teach/memory.json'))"` before finishing. If it fails to parse, fix it before ending the session.

---

## Args Reference

| Invocation | Behavior |
|---|---|
| `/tradeoff` | Auto-picks a decision from completed/in-progress topics, biased toward weak areas |
| `/tradeoff kafka` | Forces a decision touching Kafka (e.g. Kafka vs Postgres LISTEN/NOTIFY) |
| `/tradeoff circuit breakers` | Forces a decision touching circuit breakers (e.g. circuit breaker vs retry-with-jitter) |
| `/tradeoff semantic caching` | Forces a decision touching semantic cache placement |

Any topic, slug, or free-typed phrase works — matching is loose, not exact.
