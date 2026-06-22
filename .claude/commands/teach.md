# /teach — Daily AI Lesson Generator

Generate and deliver a deep, expert-level lesson covering AI engineering, backend systems, and system design. Track progress and launch the React viewer.

**Usage:** `/teach` (picks next topic) or `/teach [topic]` (e.g. `/teach speculative decoding internals`)

---

## Learner Profile

Read from `memory.json` at runtime — do not hardcode here. The `learner` field in memory.json contains `name`, `role`, `company`, and `known_well[]`. The ai-engineer agent in Step 2c reads this dynamically.

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
Completed X topics · Streak: Y days 🔥
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
- Start FastAPI server if not already running:
  ```bash
  lsof -i :8001 | grep LISTEN || (cd /Users/sumanthg/Documents/teach-me/app && uvicorn server:app --port 8001 --reload > /tmp/teach-server.log 2>&1 &)
  ```
- Start React dev server if not already running:
  ```bash
  lsof -i :5173 | grep LISTEN || (cd /Users/sumanthg/Documents/teach-me/app/react-app && npm run dev > /tmp/teach-react.log 2>&1 &)
  ```
- Wait 4 seconds, then open:
  ```bash
  open http://localhost:5173
  ```
- Output:
  ```
  ⚡ Review session live — http://localhost:5173
     Come back and say "done" when finished.
  ```
- **Stop here. Do NOT start a new lesson today.** Reviews take priority over new content — same as Anki.

### Step 2c — New Topic Selection (Dynamic)

**If the user invoked `/teach [topic]`:**
- Use that text as-is (freeform — any topic the user wants to learn)
- Set: title = the user topic text, slug = kebab-case version of it, domain = "custom", concepts = [], estimated_minutes = 45, difficulty = "advanced"
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

Spawn an Agent with **subagent_type `ai-engineer`** using this exact prompt (substitute the [PLACEHOLDERS]):

```
You are an AI engineer curriculum designer selecting today's learning topic.

TODAY: [TODAY_DATE]
COMPLETED ([N_COMPLETED] topics so far):
[COMPLETED_LIST]

WEAK AREAS (reinforce naturally if possible):
[WEAK_AREAS_LIST]

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
1. NEVER repeat a completed topic. Check the COMPLETED list carefully — if a topic with the same or nearly the same slug or title appears, skip it entirely.
2. FRESH START RULE: When n_completed == 0, you MUST pick from Backend Systems or System Design/HLD. Do NOT pick any LLM Architecture topic for the very first session.
3. PREREQUISITE ORDERING (critical): Every topic you pick must have all its prerequisites already covered in the COMPLETED list, OR be a foundational topic with no prerequisites. If a topic requires prior knowledge of X and X is not in the completed list, do NOT pick that topic — pick X first (or a foundational topic from another domain instead). Example: do not pick "KV Cache Eviction Algorithms" before "Continuous Batching Internals" has been completed. Do not pick "FSDP/ZeRO Stage 3" before "Distributed Training Basics" is done. Foundational topics (e.g. "PostgreSQL MVCC", "Raft Consensus Basics", "Transformer Architecture", "HTTP/gRPC Fundamentals") have no prerequisites and are always safe to pick.
4. DOMAIN ROTATION (most important): Rotate across all 9 domains. Never pick the same category (AI-heavy = llm-arch/inference/training/agentic) more than 2 sessions in a row. After 2 AI sessions, MUST pick backend, system-design, mlops, or ml-ds next.
5. AIM FOR REAL MIX: roughly 1 in 3 sessions should be backend or system design, 1 in 3 AI/inference, 1 in 3 agentic/mlops/eval. Check last 3 completed domains — if all are AI-heavy, force a backend or HLD topic now.
6. Difficulty: <10 done → intermediate, 10–25 → advanced, >25 → expert
7. Cross-domain topics (e.g., "LLM serving system design" = AI + HLD): pick roughly 1 in 5 — high value
8. Be specific — not "Attention Mechanisms" but "Transformer Self-Attention: Scaled Dot-Product and Why It Works"
9. Session must fit in 30–60 minutes — pick topics that can be fully taught in that window, not sprawling overviews

Return ONLY valid JSON, no markdown fences:
{
  "title": "Specific descriptive title",
  "slug": "kebab-case-unique-slug",
  "domain": "llm-arch|inference|training|agentic|ml-ds|mlops|backend|system-design|cross-domain",
  "concepts": ["specific concept 1", "concept 2", "concept 3"],
  "why_next": "1-2 direct sentences: why this fills a gap for him right now",
  "difficulty": "intermediate|advanced|expert",
  "estimated_minutes": 45
}
```

Substitute: [TODAY_DATE] = today's date, [N_COMPLETED] = n_completed, [COMPLETED_LIST] = completed_list, [WEAK_AREAS_LIST] = weak_areas_list

Parse the agent's JSON response. If parse fails, fallback:
- title = "Raft Consensus: Leader Election and Log Replication"
- slug = "raft-consensus-internals"
- domain = "system-design"
- concepts = ["leader election", "log replication", "split-brain prevention"]
- why_next = "Core distributed systems building block behind etcd, Kafka, and Kubernetes — gaps here hurt HLD interviews."
- difficulty = "intermediate"
- estimated_minutes = 45

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
  "meta": { "slug": "...", "title": "...", "difficulty": "...", "estimated_minutes": 45, "prerequisites": [...], "concepts": [...] },
  "hook": { "problem": "...", "narrative": "...", "why_it_matters": "..." },
  "concept_map": { "summary": "...", "fits_with": [...], "diagram": { "type": "mermaid|ascii", "content": "..." } },
  "concept_outlines": [
    { "index": 0, "title": "...", "key_points": ["...", "..."] },
    { "index": 1, "title": "...", "key_points": ["...", "..."] }
  ]
}
```

Design 3–4 concept outlines covering the topic's key mechanisms. Keep it lean — 3 concepts that land deeply beat 5 concepts skimmed. The outlines guide the concept agents — make them specific (not just "overview of X"). Order concepts from foundational to advanced — each concept should build on the one before it.

---

### Step 4b — Spawn concept agents in parallel

Output: `Skeleton ready · spawning [N] concept agents...`

**In a single message, call the Agent tool once per concept outline (all at once).** Each agent generates exactly ONE `core_concept` object and returns it as raw JSON text.

As each agent returns, log: `Concept [i+1]/[N] done: [title]`

Agent prompt template for each concept (substitute `[INDEX]`, `[TOTAL]`, `[TOPIC]`, `[TITLE]`, `[KEY_POINTS]`, `[OTHER_TITLES]`):

```
You are generating core concept [INDEX+1] of [TOTAL] for an expert lesson on "[TOPIC]".

Other concepts in this lesson (avoid overlap): [OTHER_TITLES]

YOUR CONCEPT: [TITLE]
Key points to cover: [KEY_POINTS]

QUALITY RULES:
- LEAD WITH A SCENARIO, NOT A DEFINITION. Open with a concrete, real-world situation — something you'd hit in production. "A vLLM deployment runs OOM at batch_size=8..." or "Two workers grab the same job from the Postgres queue..." Make the reader feel the problem before you explain the solution.
- EXPLAIN THOROUGHLY. This is a teaching document, not a bullet list. Walk through the mechanism step by step. Use sub-paragraphs. Cover the why, the how, the what-breaks-if-you-get-it-wrong. Minimum 350 words in the explanation — longer is fine if the topic warrants it.
- USE SIMPLE EXAMPLES THROUGHOUT. Don't save examples for the end. Weave small concrete examples into the explanation as you go. "For example, if you have 4 query heads and 1 KV head..." or "Imagine token 42 has xmin=1500 and xmax=0 — that means..."
- ASSUME NO PRIOR KNOWLEDGE beyond general software engineering. Explain every concept fully from the ground up, including prerequisites.
- USE PLAIN, SHORT WORDS. Write like you're explaining this over lunch to a smart colleague. Not a paper. Not a lecture.
- BANNED PHRASES: "it is worth noting", "fundamentally", "in essence", "leverages", "facilitates", "at its core", "underpins", "elucidates", "inherently". If you wrote any of these, rewrite that sentence.
- Reference real systems by name where relevant: vLLM, Kafka, Redis, PostgreSQL, FlashAttention, Raft, etcd, Kubernetes, etc.
- Math: include when it unlocks understanding. Show a worked example with real numbers.
- Code snippets: short and illustrative only (5-10 lines). NO full programs, NO imports. Just the key lines that show the concept. Pseudocode is fine if it's clearer.
- Diagrams: mermaid must use flowchart TD or graph LR. No spaces in node labels (use underscores). Only include if it shows something text genuinely can't convey.
- micro_quiz: 1 simple question. Test whether they understood the mechanism with a basic scenario. Keep it approachable — not a gotcha.

OUTPUT FORMAT — return ONLY a valid JSON object, no markdown wrapper:
{
  "title": "string",
  "explanation": "string — thorough, scenario-first, example-rich, plain language. Minimum 350 words.",
  "analogy": "string — 1-3 sentences. Must map precisely to the mechanism, not just vibes.",
  "diagram": {"type": "mermaid|ascii", "content": "string"} or null,
  "code_snippets": [
    {
      "language": "python|sql|bash",
      "caption": "string — one sentence explaining what this snippet shows",
      "code": "string — 5-10 lines max, illustrative only, no imports needed"
    }
  ],
  "micro_quiz": [
    {
      "question": "string — simple scenario question testing the core mechanism",
      "answer": "string — clear direct answer",
      "explanation": "string — why this is the right answer, what the common mistake is"
    }
  ]
}
```

Wait for all concept agents to return before proceeding.

---

### Step 4c — Assemble Phase 1, write file, launch React app

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

Output: `Phase 1 written · starting servers...`

Start FastAPI server if not already running:
```bash
lsof -i :8001 | grep LISTEN || (cd /Users/sumanthg/Documents/teach-me/app && uvicorn server:app --port 8001 --reload > /tmp/teach-server.log 2>&1 &)
```

Start React dev server if not already running:
```bash
lsof -i :5173 | grep LISTEN || (cd /Users/sumanthg/Documents/teach-me/app/react-app && npm run dev > /tmp/teach-react.log 2>&1 &)
```

Wait 4 seconds, then open:
```bash
open http://localhost:5173
```

Output:
```
⚡ http://localhost:5173 — study this, come back and say "done" when finished.
   Assessment agents generating in background...
```

---

### Step 4d — Spawn quiz+insights agent

Output: `Spawning assessment agent (quiz + insights)...`

**Call the Agent tool once** for quiz+insights. Pass the topic title and a summary of each concept's title + key points as context.

**Quiz+Insights agent prompt:**
```
Generate quiz questions AND key insights for a lesson on "[TOPIC]".
Concepts: [CONCEPT_TITLES_AND_SUMMARIES]

QUIZ: exactly 5 questions. Use simple, concrete scenarios — not gotchas. Each question should test whether the reader understood the mechanism, not whether they memorized a fact. Use plain situations: "You have a table with 10M rows and 2M dead tuples..." or "A model has H=32 query heads and G=4 KV heads...". Include at least 1 multiple_choice and at least 1 scenario-based question. Distractors should be plausible but clearly wrong once you understand the concept. Each explanation must be 2-4 sentences: state the right answer, explain why the wrong options fail, and call out the common mistake.

INSIGHTS: 2-3 items. Write like a colleague saying "hey, watch out for this in production." Real gotchas only — things that actually bite people.

SUMMARY: one clear sentence + 4-5 bullets of the most important takeaways. No fluff.

FURTHER_READING: 2-3 resources. One sentence each on why this specific resource matters for this specific person.

LANGUAGE: Short sentences. Plain words. No "it is worth noting", "fundamentally", "in essence".

Return ONLY a single JSON object (no markdown):
{
  "quiz": [{"id": N, "type": "multiple_choice|scenario|true_false", "question": "...", "code": null, "options": ["A. ...", "B. ...", "C. ...", "D. ..."], "answer": "A", "accepted_answers": ["A"], "explanation": "..."}],
  "key_insights": [{"kind": "insight|gotcha|tip", "title": "...", "text": "..."}],
  "summary": {"one_liner": "...", "takeaways": ["..."]},
  "further_reading": [{"title": "...", "url": null, "kind": "paper|blog|docs|book", "why": "..."}]
}
```

Wait for the agent. Log: `Quiz+Insights done`. Then:
1. Parse the result
2. Read `/Users/sumanthg/Documents/teach-me/.teach/current_lesson.json`
3. Merge in: `key_insights`, `quiz`, `summary`, `further_reading`
4. Set `_generation_status: "complete"`
5. Write merged JSON back to `current_lesson.json`
6. Output: `Generation complete.`

---

## Lesson Generation Rules — Read These Every Time

### Depth & Tone
- **SCENARIO FIRST, ALWAYS.** Every concept and section should open with a concrete situation, not a definition. Bad: "Raft is a consensus algorithm." Good: "Your Redis cluster just lost its primary. Three replicas are now fighting over who's in charge. Without consensus, they'll all start accepting writes and split-brain will corrupt your data."
- **PLAIN WORDS, SHORT SENTENCES.** Write like a Slack message to a smart colleague, not a conference paper. Never use: "leverages", "facilitates", "fundamentally", "in essence", "it is worth noting", "underpins", "inherently".
- Reference real systems: vLLM, FlashAttention, Kafka, Redis, etcd, Kubernetes, Raft, PostgreSQL, Triton, SGLang, Medusa, EAGLE.
- Numbers and math only when the formula unlocks understanding. Always say what breaks if you get it wrong.

### Code Rules
- Code in concepts is **illustrative snippets only** — 5-10 lines, no imports needed, pseudocode-adjacent is fine.
- The goal is to show the concept, not to ship runnable code. Clarity beats completeness.
- Use realistic variable names and values (e.g. `H=64, G=8` not `x=4, y=1`).
- No `line_by_line` field — the snippet caption + the explanation text carries that context.

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

Why this topic:
[from agent response .why_next]

Difficulty: [difficulty]  ·  ~[X] min

🌐  http://localhost:5173

Sections you'll work through:
  ⚡ Hook → 🗺️ Concept Map → 🧠 Core Concepts × [N]
  → 💡 Key Insights → 🧪 Quiz ([Q] questions) → 📋 Summary

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
Progress: [X] topics · [N]-day streak
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

Progress: [X] topics complete · [N]-day streak 🔥

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
2. Spawn an **ai-engineer** Agent with the same topic-selection prompt from Step 2c (with updated context)
3. Parse the returned JSON to get the next topic {title, slug, domain, concepts, why_next, difficulty, estimated_minutes}
4. If agent fails or parse fails: output `⚠️  Pre-generation skipped — next topic will be selected fresh on next /teach` and stop
5. If successful: Generate the full lesson using SAME parallel agent structure as Steps 4a–4d (no coding challenge):
   - Write Phase 1 to a temp variable (do NOT overwrite current_lesson.json)
   - After all agents complete, assemble the FULL lesson JSON (both phases merged, no coding_challenge field)
   - Set `_generation_status: "complete"`
   - Write to `/Users/sumanthg/Documents/teach-me/.teach/next_lesson.json`
6. Output: `⚡ Next lesson pre-generated: [Next Topic Title] — instant on next /teach`

---

## Error Handling

| Problem | Response |
|---|---|
| `.teach/memory.json` missing | Create it fresh with the default schema (streak: 0, completed: [], in_progress: null, last_session_date: null, weak_areas: []). |
| React dev server not running | Auto-started by the skill — check `/tmp/teach-react.log` if the page won't load |
| FastAPI server not running | Auto-started by the skill — check `/tmp/teach-server.log` if API calls fail |
| Port 5173 already in use | React already running — just open http://localhost:5173 |
| Port 8001 already in use | FastAPI already running — no action needed |
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
