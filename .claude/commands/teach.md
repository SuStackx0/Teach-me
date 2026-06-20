# /teach — Daily AI Lesson Generator

Generate and deliver a deep, expert-level AI/ML lesson tailored to Sumanth's background, track progress, and launch the Streamlit viewer.

**Usage:** `/teach` (picks next topic) or `/teach [topic]` (e.g. `/teach speculative decoding internals`)

---

## Learner Profile

**Name:** Sumanth G  
**Role:** AI Backend Engineer at uCube.ai  
**Email:** sumanth@ucube.ai

**Already built from scratch / in production — DO NOT re-explain these:**
- LLM inference engine with PagedAttention + continuous batching
- Hybrid RAG over Neo4j + Weaviate with cross-encoder reranking + semantic caching
- LoRA fine-tuning (InLegal-BERT)
- Multi-agent systems with LangChain/LangGraph
- vLLM/SGLang deployments
- Agentic query router (Qwen-3.5-8B)

**Stack:** Python, FastAPI, PyTorch, AsyncIO, Docker, PostgreSQL, Redis

**Depth preference:** expert — peer-level, dense, production-focused  
**Session target:** ~90 minutes  
**Focus areas:** LLM Architecture, Backend Systems, System Design

---

## Step 1 — Check Memory & Avoid Repetition

Read `.teach/memory.json`:

```bash
cat /Users/sumanthg/Documents/teach-me/.teach/memory.json
```

Extract and display:
- Number of completed topics (count of `completed[]`)
- Current streak from `streak`
- Any `weak_areas` from memory (you'll reinforce these naturally in the lesson)

Output exactly:

```
Completed X/60 topics · Streak: Y days 🔥
```

If `weak_areas` is non-empty, note them internally — weave reinforcement into the lesson where natural (don't announce it).

When reading `weak_areas` for any purpose (warm-up generation, reinforcement), filter to items where `retired == false`. Extract `phrase` from each. Backward compat: if an item is a plain string (not an object), treat it as `{"phrase": item, "flagged_date": null, "reinforced_count": 0, "retired": false, "source_slug": null}`.

---

## Step 2 — Select Today's Topic

### Step 2a — Crash Recovery Check

Check if `in_progress != null` AND `.teach/current_lesson.json` exists AND its `_generation_status == "generating_assessments"`:

```bash
cat /Users/sumanthg/Documents/teach-me/.teach/current_lesson.json 2>/dev/null | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('_generation_status',''))"
```

If the above condition is true:
- Output: `⚠️  Found incomplete session: [in_progress slug]. Phase 1 is on disk but assessments didn't finish.`
- Output: `Resuming Phase 2...`
- Run Step 4d immediately, using the existing `current_lesson.json`'s `core_concepts` titles and key points as context for the assessment agents.
- After merge, jump directly to Step 5 (deliver summary). Do NOT select a new topic.

### Step 2b — Review Queue Check

Read `completed[]` from `memory.json`. Find any entry where `next_review_date <= today's date` (today = 2026-06-21).

If any are due:
- Select the one with the **earliest** `next_review_date`
- Output: `📚 Review due: [slug title]. Spaced repetition session starting...`
- Check if `.teach/archive/[slug].json` exists. If yes, load it to get quiz questions + core_concepts.
- Generate 10 review questions (use the archived lesson's quiz + generate new ones from its `core_concepts` titles). Questions test recall — no explanations shown upfront, just question → user answers → reveal answer.
- Write review session JSON to `.teach/current_lesson.json`:
  ```json
  {
    "meta": {
      "slug": "review-[slug]",
      "title": "Review: [original title]",
      "is_review_session": true,
      "estimated_minutes": 15
    },
    "quiz": [ ... 10 questions ... ],
    "_generation_status": "complete"
  }
  ```
- Update `memory.json`: set `in_progress` to `"review-[slug]"`
- Launch Streamlit:
  ```bash
  cd /Users/sumanthg/Documents/teach-me/app && streamlit run app.py &
  ```
- Wait 3 seconds, then open http://localhost:8501
- Output:
  ```
  ⚡ Review session in Streamlit — http://localhost:8501
     Say 'done' when finished.
  ```
- **Stop here. Do NOT start a new lesson today.** Reviews take priority over new content — same as Anki.

### Step 2c — New Topic Selection (Dynamic)

**If the user invoked `/teach [topic]`:**
- Use that text as-is (freeform — any topic the user wants to learn)
- Set: title = the user topic text, slug = kebab-case version of it, domain = "custom", concepts = [], estimated_minutes = 75, difficulty = "advanced"
- Output: `📖 Custom topic: [topic]. Generating lesson...`
- Skip the agent selection below. Jump to Step 3.

**If no topic provided:**

Build context strings from memory.json:
```python
completed_list = "\n".join([
    f"- {e['title']} ({e.get('domain', '?')})"
    for e in memory['completed']
]) or "None yet"
n_completed = len(memory['completed'])
weak_areas_list = ", ".join([
    (w['phrase'] if isinstance(w, dict) else w)
    for w in memory.get('weak_areas', [])
    if not (isinstance(w, dict) and w.get('retired'))
]) or "None"
```

Spawn an Agent with **subagent_type `voltagent-data-ai:ai-engineer`** using this exact prompt (substitute the [PLACEHOLDERS]):

```
You are an AI engineer curriculum designer selecting today's learning topic for Sumanth G.

LEARNER: AI Backend Engineer, uCube.ai
TODAY: [TODAY_DATE]
COMPLETED ([N_COMPLETED] topics so far):
[COMPLETED_LIST]

WEAK AREAS (reinforce naturally if possible):
[WEAK_AREAS_LIST]

KNOWS WELL — NEVER RE-TEACH:
- PagedAttention + continuous batching (built from scratch)
- Hybrid RAG (Neo4j + Weaviate, cross-encoder reranking, semantic caching)
- LoRA fine-tuning, multi-agent systems (LangGraph), vLLM/SGLang deployments
- FastAPI + AsyncIO + Redis + PyTorch + Docker

FULL AI ENGINEER KNOWLEDGE DOMAIN — cover ALL of these over time:
- LLM Architecture: attention variants (GQA/MLA/MHA), quantization (GPTQ/AWQ/FP8/GGUF), speculative decoding (Medusa/EAGLE/SpecInfer), MoE routing & capacity factor, SSMs/Mamba selective scan, FlashAttention 2/3 tiling, positional encodings (RoPE/YaRN/ALiBi), pre-training objectives, tokenization internals (BPE/unigram/byte-level)
- Inference & Serving: tensor/pipeline/sequence parallelism, KV cache eviction & quantization (KIVI/H2O), continuous batching internals, prefix caching, disaggregated prefill & chunked prefill (vLLM v2), Triton kernel writing, GPU profiling (roofline model, Nsight), torch.compile & CUDA graphs
- Training & Alignment: RLHF, DPO, RLAIF, Constitutional AI, FSDP/ZeRO (stages 1/2/3), gradient checkpointing, scaling laws (Chinchilla/Kaplan), pre-training data curation (dedup, quality filtering), synthetic data & knowledge distillation, model merging (TIES/DARE/SLERP/task arithmetic), PEFT variants (QLoRA/DoRA/LoRA-FA)
- Agentic Systems: agent architectures (ReAct/Reflexion/Plan-Execute/LATS/Voyager), tool use & function calling patterns, agent memory (episodic/semantic/procedural/external), multi-agent orchestration & communication protocols, agent evaluation & benchmarking, LLM-as-judge, planning under uncertainty, agent reliability & failure modes
- ML/DS & Evaluation: evaluation metrics (BLEU/ROUGE/BERTScore/human eval/G-Eval), calibration & uncertainty (conformal prediction, semantic entropy, temperature scaling), mechanistic interpretability (induction heads, superposition, SAEs, activation patching), contrastive learning & embedding training, retrieval eval (nDCG/MRR/Recall@K), statistical significance testing
- MLOps: experiment tracking (MLflow/W&B), model versioning & registry, A/B testing for LLMs, shadow deployments, data/model drift detection, feedback loop design, CI/CD for ML pipelines, feature stores for ML
- Backend Systems: PostgreSQL query planner & MVCC & VACUUM, Redis internals (RDB/AOF/clustering/Streams/Lua), Kafka (partitioning/consumer groups/exactly-once), rate limiting algorithms (token bucket/sliding window), circuit breakers & resilience patterns, gRPC & protobuf streaming, REST API design & versioning, database transactions & isolation levels (MVCC/SSI/write skew), caching strategies & invalidation at scale
- System Design / HLD: distributed consensus (Raft/Paxos), consistent hashing & virtual nodes, CAP/PACELC & consistency models, event sourcing/CQRS, saga pattern & distributed transactions, microservices/DDD bounded contexts, Kubernetes scheduling & HPA/VPA, service mesh (Istio/Envoy), observability (OpenTelemetry/traces/RED metrics), SLOs & error budgets, HLD case studies (Twitter feed, Uber geo, YouTube CDN)
- Cross-domain (HIGH VALUE — pick 1 in 5): vector DB internals (HNSW/IVF-PQ indexing), LLM serving system design end-to-end, streaming inference pipelines, AI feature stores, online learning systems, LLM eval infrastructure at scale, semantic caching architectures, multi-model deployment orchestration, speculative decoding meets continuous batching

SELECTION RULES:
1. NEVER repeat a completed topic (check the list)
2. Balance domains — avoid same domain 3× in a row (check last 3 completed domains)
3. Build on what he knows — reference his stack naturally
4. Difficulty: <10 done → intermediate, 10–25 → advanced, >25 → expert
5. Cross-domain topics: pick roughly 1 in 5 sessions — they teach the most
6. Be specific — not "Attention Mechanisms" but "GQA vs MLA: KV Cache Math and DeepSeek Production Tradeoffs"

Return ONLY valid JSON, no markdown fences:
{
  "title": "Specific descriptive title",
  "slug": "kebab-case-unique-slug",
  "domain": "llm-arch|inference|training|agentic|ml-ds|mlops|backend|system-design|cross-domain",
  "concepts": ["specific concept 1", "concept 2", "concept 3", "concept 4", "concept 5"],
  "why_next": "1-2 direct sentences: why this fills a gap for him right now",
  "difficulty": "intermediate|advanced|expert",
  "estimated_minutes": 75
}
```

Substitute: [TODAY_DATE] = today's date, [N_COMPLETED] = n_completed, [COMPLETED_LIST] = completed_list, [WEAK_AREAS_LIST] = weak_areas_list

Parse the agent's JSON response. If parse fails, fallback:
- title = "Disaggregated Prefill & Chunked Prefill: vLLM v2 Architecture"
- slug = "disaggregated-prefill-chunked-vllm-v2"
- domain = "inference"
- concepts = ["prefill vs decode disaggregation", "chunked prefill scheduler", "KV cache transfer across nodes", "vLLM v2 architecture changes", "latency vs throughput tradeoffs"]
- why_next = "Direct extension of your continuous batching work."
- difficulty = "advanced"
- estimated_minutes = 75

Output: `🤖 Today's topic: [title]`

**Fast-path check (run after topic is determined, before Step 3):**

Check if `/Users/sumanthg/Documents/teach-me/.teach/next_lesson.json` exists:
- Read it and check `meta.slug`
- If `meta.slug` matches the selected topic slug:
  - Copy `next_lesson.json` → `current_lesson.json` (use the Write tool: read next_lesson.json, write its content to current_lesson.json)
  - Delete `next_lesson.json` (run `rm /Users/sumanthg/Documents/teach-me/.teach/next_lesson.json`)
  - Update `memory.json`: set `in_progress` to the topic slug
  - Output: `⚡ Lesson pre-generated — instant launch!`
  - Skip Steps 3 and 4 entirely. Jump to Step 5 (launch Streamlit).
  - If the copied lesson has `_generation_status: "complete"`: after launching Streamlit, skip assessment generation and go straight to Step 5 (deliver summary).
  - If `_generation_status: "generating_assessments"`: after launching Streamlit, run Step 4d (parallel assessment agents) as normal.
- If file does not exist or slug does not match: proceed normally through Steps 3 and 4.

---

## Step 3 — Brief the User

Output a short pre-flight summary, then immediately proceed to Step 4 — no confirmation needed:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
NEXT UP: [Topic Title]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Why this for you: [from agent response .why_next]

Difficulty: [from agent response .difficulty]  ·  ~[from agent response .estimated_minutes] min
Concepts: [from agent response .concepts joined as comma-separated list]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## Step 4 — Generate the Lesson (Parallel Subagents)

**Do NOT generate the lesson serially. Use the Agent tool to parallelise.**

Output:
```
Spinning up parallel agents...
```

---

### Step 4a — Generate skeleton (you do this inline, fast)

Generate this lean skeleton yourself — no agents needed, just fill the fields:

```json
{
  "meta": { "slug": "...", "title": "...", "difficulty": "...", "estimated_minutes": 90, "prerequisites": [...], "concepts": [...] },
  "hook": { "problem": "...", "narrative": "...", "why_it_matters": "..." },
  "concept_map": { "summary": "...", "fits_with": [...], "diagram": { "type": "mermaid|ascii", "content": "..." } },
  "concept_outlines": [
    { "index": 0, "title": "...", "key_points": ["...", "..."] },
    { "index": 1, "title": "...", "key_points": ["...", "..."] }
  ]
}
```

Design 4–5 concept outlines covering the topic's key mechanisms. The outlines guide the concept agents — make them specific (not just "overview of X").

---

### Step 4b — Spawn concept agents in parallel

Output: `Skeleton ready · spawning [N] concept agents...`

**In a single message, call the Agent tool once per concept outline (all at once).** Each agent generates exactly ONE `core_concept` object and returns it as raw JSON text.

As each agent returns, log: `Concept [i+1]/[N] done: [title]`

Agent prompt template for each concept (substitute `[INDEX]`, `[TOTAL]`, `[TOPIC]`, `[TITLE]`, `[KEY_POINTS]`, `[OTHER_TITLES]`):

```
You are generating core concept [INDEX+1] of [TOTAL] for an expert lesson on "[TOPIC]" for Sumanth G (AI Backend Engineer, uCube.ai).

LEARNER PROFILE — already built from scratch, NEVER re-explain:
- LLM inference engine with PagedAttention + continuous batching
- Hybrid RAG (Neo4j + Weaviate, cross-encoder reranking, semantic caching)
- LoRA fine-tuning (InLegal-BERT), multi-agent systems (LangGraph), vLLM/SGLang deployments

Other concepts in this lesson (avoid overlap): [OTHER_TITLES]

YOUR CONCEPT: [TITLE]
Key points to cover: [KEY_POINTS]

QUALITY RULES:
- Peer-level, dense, no filler. Reference real systems: vLLM, FlashAttention, EAGLE, Medusa, SGLang, Triton, etc.
- LANGUAGE: Use plain, direct words. Write like you're explaining to a colleague in a code review, not writing a paper. Short sentences. No academic jargon-stacking. No phrases like "it is worth noting", "fundamentally", "in essence". Say the thing directly.
- Math is encouraged (LaTeX inline). Give formulas with conditions, not hand-waving.
- Code must be REAL and runnable: full imports, no `...` placeholders, production-adjacent variable names.
- line_by_line entries must reference actual line ranges (e.g. "lines": "12-15").
- Diagrams: mermaid must use flowchart TD or graph LR with no spaces in node labels.
- micro_quiz: exactly 1-2 questions. Ask about the mechanism, not trivia. The question should require understanding the WHY, not just recalling a name.

OUTPUT LIMITS (strictly enforced for speed):
- explanation: max 200 words. Cover the mechanism and why it matters. Nothing else.
- analogy: max 2 sentences.
- diagram: include ONLY if it genuinely clarifies something text can't. Skip if in doubt.
- code_examples: exactly 1 example. Max 25 lines of actual code (not counting imports). Real and runnable.
- line_by_line: max 3 entries. Only for non-obvious lines. Skip obvious ones.
- micro_quiz: exactly 1 question (not 1-2).

Return ONLY a valid JSON object — no markdown, no explanation, just the JSON:
{
  "title": "string",
  "explanation": "string — plain direct language, peer-level, short sentences",
  "analogy": "string — precise analogy mapping to the mechanism",
  "diagram": {"type": "mermaid|ascii", "content": "string"} or null,
  "code_examples": [
    {
      "language": "python|bash|triton|cuda",
      "filename": "string or null",
      "code": "string — full runnable code with imports",
      "line_by_line": [{"lines": "N-M", "explanation": "string"}]
    }
  ],
  "micro_quiz": [
    {
      "question": "string — 1 specific question testing the core mechanism of this concept",
      "answer": "string — direct 1-3 sentence answer",
      "explanation": "string — why this matters or common mistake to avoid"
    }
  ]
}
```

Wait for all concept agents to return before proceeding.

---

### Step 4c — Assemble Phase 1, write file, launch Streamlit

Parse each concept agent's JSON output. Each parsed concept object (including its `micro_quiz` field) is included as-is in `core_concepts`. Build Phase 1:

```json
{
  "meta": { ...from skeleton... },
  "hook": { ...from skeleton... },
  "concept_map": { ...from skeleton... },
  "core_concepts": [ concept0, concept1, concept2, ... ],
  "warm_up": [],
  "_generation_status": "generating_assessments"
}
```

**warm_up**: Only add if `memory.json` has non-empty `weak_areas` (filter to `retired == false` items). If so, generate 5 questions inline (no agent needed):
```json
{ "id": N, "question": "...", "expected_points": [...], "difficulty": "warmup", "target_weak_area": "...", "follow_up": "..." }
```

Write Phase 1 JSON to `/Users/sumanthg/Documents/teach-me/.teach/current_lesson.json`.
Update `memory.json`: set `in_progress` to the topic slug.

Output: `Phase 1 written · launching Streamlit...`

Launch Streamlit:
```bash
cd /Users/sumanthg/Documents/teach-me/app && streamlit run app.py &
```
Wait 3 seconds, then:
```bash
open http://localhost:8501
```

Output:
```
⚡ Lesson in Streamlit — http://localhost:8501
   Spawning assessment agents in parallel...
```

---

### Step 4d — Spawn assessment agents in parallel

Output: `Spawning assessment agents (quiz+insights · challenge)...`

**In a single message, call the Agent tool 2 times simultaneously** (quiz+insights, challenge). Pass the topic title and a summary of each concept's title + key points as context.

**Quiz+Insights agent prompt:**
```
Generate quiz questions AND key insights for an expert lesson on "[TOPIC]".
Concepts: [CONCEPT_TITLES_AND_SUMMARIES]
Learner: senior AI backend engineer (PagedAttention, vLLM, LoRA, RAG — skip basics).

QUIZ: 5 questions (not more). Include at least 1 code_reading. Distractors must be plausible to experts.
Each explanation says why each wrong option fails.

INSIGHTS: 2-3 items max (insight/gotcha/tip). Gotchas must be real production traps.

SUMMARY: one_liner + 4-5 tight bullets. No padding.

FURTHER_READING: 2-3 resources. Say exactly why THIS resource for THIS person.

OUTPUT LIMITS: Be concise. Quiz explanations max 3 sentences each. Insights max 2 sentences each.

Return ONLY a single JSON object (no markdown):
{
  "quiz": [{"id": N, "type": "...", "question": "...", "code": null, "options": [...], "answer": "...", "accepted_answers": [...], "explanation": "..."}],
  "key_insights": [{"kind": "insight|gotcha|tip", "title": "...", "text": "..."}],
  "summary": {"one_liner": "...", "takeaways": ["..."]},
  "further_reading": [{"title": "...", "url": null, "kind": "...", "why": "..."}]
}
```

**Challenge agent prompt:**
```
Generate a coding challenge for an expert lesson on "[TOPIC]".
Concepts: [CONCEPT_TITLES_AND_SUMMARIES]
Learner: senior AI backend engineer building LLM inference or AI backend systems.

The challenge must build something that slots into a real system (inference engine, serving layer, etc.).
starter_code: real scaffold with TODO markers + a runnable test harness at the bottom.
solution: full working code with inline comments.
hints: 3–4 progressive, from gentle to revealing.

Return ONLY a JSON object (no markdown):
{"title": "...", "prompt": "...", "starter_code": "...", "requirements": [...], "hints": [...], "solution": "...", "extension": "...|null"}
```

Wait for both agents. As each returns, log: `Quiz+Insights done` / `Challenge done`. Then:
1. Parse each result
2. Read `/Users/sumanthg/Documents/teach-me/.teach/current_lesson.json`
3. From the quiz+insights agent result, extract: `quiz`, `key_insights`, `summary`, `further_reading`
4. Merge in: `key_insights`, `quiz`, `coding_challenge`, `summary`, `further_reading`
5. Set `_generation_status: "complete"`
6. Write merged JSON back to `current_lesson.json`
7. Output: `Generation complete.`

---

## Lesson Generation Rules — Read These Every Time

### Depth & Tone
- Peer-level. Dense. No filler. No "in today's fast-paced AI landscape."
- **LANGUAGE: Plain, direct words.** Write like explaining to a smart colleague, not writing a paper. Short sentences. No academic jargon-stacking ("leverages", "facilitates", "it is worth noting", "fundamentally", "in essence"). Say the thing directly.
- Reference real systems by name: vLLM, FlashAttention, DeepSeek, Triton kernels, Megatron-LM, KIVI, H2O, SGLang, Medusa, EAGLE, SpecInfer, etc.
- Frame everything as "here's what breaks in production" — Sumanth ships real systems.
- When claiming a number (acceptance rate bound, memory formula, FLOP count), give the formula or the precise condition it holds under. No hand-waving.
- **Do NOT explain** things he already knows cold: attention mechanism basics, KV cache fundamentals, LoRA basics, RAG retrieval basics, PagedAttention block management, Docker/FastAPI patterns.
- Connect every concept back to his stack where natural (e.g., "in your continuous batching scheduler, this would manifest as...").

### Code Rules
- All code must be **real and runnable** in Python/PyTorch (or Triton/CUDA where appropriate).
- No `...` placeholders unless you explicitly label them `# ELIDED: [what's here]` with a clear explanation.
- Full imports at the top of every code block.
- `line_by_line` explanations must reference **actual line ranges** (e.g., `"lines": "12-15"`).
- Code examples should be production-adjacent: proper error handling, realistic variable names, not toy naming.

### Quiz Rules (5-8 questions)
- Include all 4 types; at least 1 `code_reading`.
- Distractors must be **plausible to an expert** — common misconceptions, off-by-one conditions, things that are true in related contexts but not here.
- Explanations must explain **why each wrong option is wrong**, not just confirm the right answer.
- Avoid trivial recall questions. Every question should require understanding, not memory.

### Diagram Rules
- Mermaid must be syntactically valid: use `flowchart TD` or `graph LR`
- Node labels: no spaces — use underscores or CamelCase (e.g., `Draft_Model` not `Draft Model`)
- ASCII diagrams: use consistent column alignment
- At minimum: one concept_map diagram + at least one diagram per major core concept

### Weak Areas Reinforcement
- If `memory.json` has `weak_areas` entries (filter `retired == false`), identify where in the lesson those areas naturally come up
- Add a `key_insights` entry of kind `"gotcha"` that directly addresses the weak area
- Do not announce "I'm reinforcing your weak area" — just do it

---

## Step 5 — Deliver the Summary to the User

Output exactly this block (fill in the bracketed values):

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📚  TODAY'S LESSON: [TITLE IN CAPS]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Why this topic for you:
[1-2 sentences specific to his background — e.g., "You built the continuous
batching scheduler from scratch; speculative decoding slots directly into
the verify step of that autoregressive loop."]

Difficulty: [difficulty]  ·  ~[X] min

🌐  http://localhost:8501

Sections you'll work through:
  ⚡ Hook → 🗺️ Concept Map → 🧠 Core Concepts × [N]
  → 💡 Key Insights → 🧪 Quiz ([Q] questions) → 🏗️ Coding Challenge → 📋 Summary

When you're done, come back here and say "done" — I'll log your session.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## Step 8 — Session Completion

**Trigger:** user says "done", "finished", "complete", or similar.

### Step 8a — Check for Already-Logged Session

Read `memory.json`. If `in_progress == null` AND the topic slug already appears in `completed[].slug`:

```
Session already logged via Streamlit.
Progress: [X]/60 topics · [N]-day streak
See you next time!
```

Stop here. Do not double-log.

### Step 8b — Handle Review Session Completion

If `in_progress` starts with `"review-"`, run this flow instead of the normal debrief:

1. Ask: `Review score? (e.g. 8/10)`
2. Parse the score. Compute `next_review_date` based on score percentage:
   - score >= 80% → next_review_date = today + 28 days
   - score 60–79% → next_review_date = today + 14 days
   - score < 60% → next_review_date = today + 7 days
3. In `memory.json`, find the `completed[]` entry for the original slug (strip the `"review-"` prefix). Update its `next_review_date`.
4. Set `in_progress` to `null`.
5. Write `memory.json`.
6. Output: `📚 Review logged. Next review of [topic title] in [N] days.`
7. Ask: `Start today's new lesson? (y/n)` — if yes, re-run Step 2 normally (now with no due reviews).

### Step 8c — Normal Session Debrief

If `in_progress` is set and is NOT a review session, run the full debrief:

Ask:

```
Quick debrief — what gave you the most trouble? (a word or short phrase,
e.g. "batch speculation", "acceptance rate math", "warp scheduling")
```

Wait for their answer. Use it to populate `weak_areas`.

Then ask:

```
What was your quiz score? (e.g. "6/8" or "skipped")
```

### Compute next_review_date

From quiz score:
- quiz_score_pct >= 0.8 → next_review_date = today + 14 days
- quiz_score_pct 0.6–0.79 → next_review_date = today + 7 days
- quiz_score_pct < 0.6 → next_review_date = today + 2 days
- None/skipped → next_review_date = today + 7 days

### Update memory.json

Read the current `.teach/memory.json`, then write back with these changes:

1. **Move `in_progress` → `completed[]`** by appending a new entry:
   ```json
   {
     "slug": "[topic slug]",
     "title": "[topic title]",
     "domain": "[from topic selection agent response]",
     "date": "[today YYYY-MM-DD]",
     "quiz_score_pct": [score as decimal, e.g. 0.75, or null if skipped],
     "time_spent_minutes": [estimate from session start to now],
     "weak_areas": ["[their debrief answer]"],
     "notes": "[1-2 sentence summary of the session — what they got, what they missed]",
     "next_review_date": "[computed date YYYY-MM-DD]"
   }
   ```

2. **Set `in_progress`** to `null`

3. **Update `streak`:**
   - If `last_session_date` == yesterday's date (YYYY-MM-DD): `streak + 1`
   - If `last_session_date` == today (duplicate session): keep streak unchanged
   - Otherwise (gap > 1 day or null): reset `streak` to 1

4. **Set `last_session_date`** to today's date (YYYY-MM-DD)

5. **Append to global `weak_areas`** list: The global `weak_areas` in memory.json is an array of objects. When appending the debrief phrase:
   - Check if a non-retired item with the same `phrase` already exists. If yes, skip.
   - If not, append:
     ```json
     {
       "phrase": "[debrief answer]",
       "flagged_date": "[today YYYY-MM-DD]",
       "reinforced_count": 0,
       "retired": false,
       "source_slug": "[topic slug]"
     }
     ```

### Archive the Lesson

After writing `memory.json`:

```bash
mkdir -p /Users/sumanthg/Documents/teach-me/.teach/archive
cp /Users/sumanthg/Documents/teach-me/.teach/current_lesson.json /Users/sumanthg/Documents/teach-me/.teach/archive/[slug].json
```

Output: `📁 Lesson archived → .teach/archive/[slug].json`

### Completion Output

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ Session logged!

Progress: [X]/60 topics complete · [N]-day streak 🔥

Weak areas flagged: "[their answer]"
→ I'll reinforce this in a future session.

Next review of this topic: [next_review_date]

Tomorrow's suggestion: [next-topic title]
→ [why_next from agent selection for that topic]

See you tomorrow! 🧠
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## Step 8.5 — Pre-generate Next Lesson (runs after Step 8 completion output)

After the completion output, pre-generate tomorrow's lesson for instant startup.

1. Build updated context: include the just-completed topic in completed_list, increment n_completed
2. Spawn a **voltagent-data-ai:ai-engineer** Agent with the same topic-selection prompt from Step 2c (with updated context)
3. Parse the returned JSON to get the next topic {title, slug, domain, concepts, why_next, difficulty, estimated_minutes}
4. If agent fails or parse fails: output `⚠️  Pre-generation skipped — next topic will be selected fresh on next /teach` and stop
5. If successful: Generate the full lesson using SAME parallel agent structure as Steps 4a–4d:
   - Write Phase 1 to a temp variable (do NOT overwrite current_lesson.json)
   - After all agents complete, assemble the FULL lesson JSON (both phases merged)
   - Set `_generation_status: "complete"`
   - Write to `/Users/sumanthg/Documents/teach-me/.teach/next_lesson.json`
6. Output: `⚡ Next lesson pre-generated: [Next Topic Title] — instant on next /teach`

---

## Error Handling

| Problem | Response |
|---|---|
| `.teach/memory.json` missing | Create it fresh with the default schema (streak: 0, completed: [], in_progress: null, last_session_date: null, weak_areas: []). |
| Streamlit not installed | "Run: `pip install -r /Users/sumanthg/Documents/teach-me/app/requirements.txt`" |
| Port 8501 already in use | "Port 8501 is busy — Streamlit may already be running. Try: `open http://localhost:8501`" |
| ai-engineer agent fails to return valid JSON | Use the fallback topic defined in Step 2c and proceed normally. |

---

## Args Reference

The skill accepts one optional positional argument: any topic description (freeform — not from a fixed list).

| Invocation | Behavior |
|---|---|
| `/teach` | ai-engineer agent selects today's optimal topic based on your history |
| `/teach speculative decoding internals` | Generates a lesson on that exact topic |
| `/teach gRPC for LLM serving` | Generates a cross-domain lesson on that topic |
| `/teach [any topic]` | Generates a lesson on any topic you specify |

When a topic is provided, the ai-engineer selection is skipped and a lesson is generated directly.

---

## Memory Schema Reference

```json
{
  "completed": [
    {
      "slug": "transformer-micro-architecture",
      "title": "...",
      "domain": "llm-arch",
      "date": "2026-06-20",
      "quiz_score_pct": 0.75,
      "time_spent_minutes": 45,
      "weak_areas": ["rope extrapolation"],
      "notes": "...",
      "next_review_date": "2026-07-04"
    }
  ],
  "in_progress": null,
  "streak": 0,
  "last_session_date": null,
  "weak_areas": [
    {
      "phrase": "rope extrapolation",
      "flagged_date": "2026-06-20",
      "reinforced_count": 0,
      "retired": false,
      "source_slug": "transformer-micro-architecture"
    }
  ],
  "preferences": {"depth": "expert", "session_minutes": 60, "focus_areas": ["ai-ml", "backend", "system-design"]},
  "learner": {"name": "Sumanth", "role": "AI Backend Engineer", "company": "uCube.ai"}
}
```
