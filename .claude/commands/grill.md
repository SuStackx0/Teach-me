# /grill — Standalone Terminal Grill Session

Run a focused 10-question grill session on any curriculum topic. Purely conversational — no Streamlit, no lesson generation.

**Usage:** `/grill` (auto-picks topic) or `/grill [slug]` (e.g. `/grill speculative-decoding`)

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

---

## Step 1 — Read State

Read both files:

```
/Users/sumanthg/Documents/teach-me/.teach/memory.json
/Users/sumanthg/Documents/teach-me/.teach/curriculum-v2.json
```

If `memory.json` is missing, create it fresh:
```json
{"streak": 0, "completed": [], "in_progress": null, "last_session_date": null, "weak_areas": []}
```

---

## Step 2 — Pick a Topic

**If invoked as `/grill [slug]`:**
- Look up the slug across all `tracks[].ladder[]` entries in `curriculum-v2.json`
- If not found: "Slug '[slug]' not found. Available slugs: [list first 10]."
- Proceed with that topic regardless of completion status

**If no slug provided — pick in this priority order:**

1. **Requiz queue (top priority):** If `memory.json.requiz_queue` is non-empty — grill the **first slug** in that array. Load its archived lesson from `.teach/archive/[slug].json` for question material (quiz + core_concepts). Note internally that this is a requiz session (needed later for Step 6 score write-back). Skip priorities 2-4 below.
2. **Weak-area targeting:** If `memory.json.weak_areas` is non-empty AND at least one topic in `completed[]` exists — find the completed topic whose `concepts[]` most overlap with the weak area strings. Use that topic.
3. **Random from completed:** If completed topics exist but no weak-area match is strong — pick one at random from `completed[]`.
4. **First from curriculum:** If no topics are completed — use the first `available` topic in `curriculum-v2.json` (first track's ladder, top to bottom).

**Display:**

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
GRILL SESSION: [Topic Title]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

If targeting a weak area, add one line:
```
Targeting weak area: "[weak_area string]"
```

If this is a requiz-queue session, add one line instead:
```
Requiz — this topic is due for a scored recheck.
```

---

## Step 3 — Generate 10 Grill Questions

Generate exactly 10 questions for the chosen topic internally before asking any of them.

**Question structure (internal, do not display as JSON):**
```
id: 1-10
question: open-ended — why/how/design/derive/what-breaks/trace-through
expected_points: 3-5 specific bullets a strong answer must hit
difficulty: warmup | core | deep | edge
follow_up: a harder follow-on question (always include one)
```

**Ordering:** 2-3 warmup → 3-4 core → 2-3 deep → 1-2 edge

**Rules:**
- All questions open-ended. Never ask "what is X?" — that's recall, not understanding.
- Expert depth: production tradeoffs, failure modes, real system behavior (vLLM, FlashAttention, Megatron-LM, SGLang, Medusa, EAGLE, Triton, etc.)
- `expected_points`: specific, not vague — "explain that acceptance rate α depends on the ratio of draft to target logits" not "explain acceptance rate"
- Frame around: what breaks, how you'd debug it, what the tradeoff is, how you'd design it

---

## Step 4 — Run the Session Interactively

For each question (1 through 10):

**4a. Display the question:**

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[WARMUP|CORE|DEEP|EDGE] · Q{n}/10
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
{question text}
```

**4b. Wait for Sumanth's answer.**

**4c. Grade and give feedback:**

Score against `expected_points`:
- **STRONG:** hits 4+ expected points with precision
- **PARTIAL:** hits 2-3 points or hits most but with imprecision
- **WEAK:** misses core points or gets the mechanism wrong

Output:

```
Grade: [STRONG / PARTIAL / WEAK]

[2-4 sentences of direct, peer-level feedback. Call out exactly what they
nailed and exactly what they missed or got imprecise. No softening. No
"good attempt." If they got the math wrong, say so and give the correct form.]

Expected points:
  ✓/✗  [bullet 1]
  ✓/✗  [bullet 2]
  ✓/✗  [bullet 3]
  ...

Follow-up: [follow_up question — only show if grade was STRONG or PARTIAL; skip if WEAK]
```

If follow-up is shown, wait for a response, then give a 1-2 sentence reaction (no re-grading, just a quick "yes, that's it" or correction).

**4d. Proceed to the next question without asking for confirmation.**

---

## Step 5 — Final Summary

After all 10 questions are answered:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
GRILL COMPLETE · [Topic Title]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Strong: X  ·  Partial: Y  ·  Weak: Z

Weak areas flagged:
  [list the concept(s) from questions graded WEAK or PARTIAL]
→ These will be reinforced in your next lesson.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

If all 10 were STRONG: "Clean sweep — no weak areas flagged."

---

## Step 6 — Update memory.json

Read the current `memory.json`, then write it back with these changes:

**Append to `weak_areas`** (global top-level list): The global `weak_areas` in memory.json is an array of objects (see teach.md's Memory Schema Reference) — never append bare strings. For each concept string from questions graded WEAK or PARTIAL:
- Check if a non-retired item with the same `phrase` already exists (comparing against `phrase` for object entries, or the raw string for any legacy plain-string entries). If yes, skip.
- If not, append:
  ```json
  {
    "phrase": "[concept string]",
    "flagged_date": "[today YYYY-MM-DD]",
    "reinforced_count": 0,
    "retired": false,
    "source_slug": "[the grilled topic's slug]"
  }
  ```

**If this session's topic was picked from `requiz_queue` (priority 1 in Step 2):** also write back the score:
1. Compute the session score as a percentage: `Strong = 1.0, Partial = 0.5, Weak = 0.0` per question, averaged over all 10 (i.e. `(Strong_count*1.0 + Partial_count*0.5) / 10`).
2. Find the `completed[]` entry for the grilled slug in `memory.json`. Set its `quiz_score_pct` to this computed score.
3. Recompute its `next_review_date` from the score:
   - score >= 0.8 → today + 14 days
   - score 0.6–0.79 → today + 7 days
   - score < 0.6 → today + 2 days
   **Uniqueness guard:** check this date against every other `next_review_date` in `completed[]`; if it collides, push forward one day at a time until unique.
4. Remove this slug from `requiz_queue`.

Validate `memory.json` with `python3 json.load` before finishing.

**Do NOT (for non-requiz sessions or beyond the requiz write-back above):**
- Mark any curriculum topic as completed
- Update streak
- Update last_session_date
- Modify the `completed[]` array except for the requiz `quiz_score_pct` / `next_review_date` write-back described above

Grill sessions are drills, not lessons. They never mark a topic done — a requiz score update is not a completion, it's a recheck of an already-completed topic.

---

## Args Reference

| Invocation | Behavior |
|---|---|
| `/grill` | Auto-picks topic (requiz queue → weak-area target → random completed → first in curriculum) |
| `/grill speculative-decoding` | Forces grill on speculative-decoding |
| `/grill flashattention-internals` | Forces grill on FlashAttention internals |
| `/grill moe-routing-serving` | Forces grill on MoE routing and serving |

Any slug present in `curriculum-v2.json` (any track's ladder) is valid.
