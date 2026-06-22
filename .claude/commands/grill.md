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
/Users/sumanthg/Documents/teach-me/.teach/curriculum.json
```

If `memory.json` is missing, create it fresh:
```json
{"streak": 0, "completed": [], "in_progress": null, "last_session_date": null, "weak_areas": []}
```

---

## Step 2 — Pick a Topic

**If invoked as `/grill [slug]`:**
- Look up the slug in `curriculum.json`
- If not found: "Slug '[slug]' not found. Available slugs: [list first 10]."
- Proceed with that topic regardless of completion status

**If no slug provided — pick in this priority order:**

1. **Weak-area targeting:** If `memory.json.weak_areas` is non-empty AND at least one topic in `completed[]` exists — find the completed topic whose `concepts[]` most overlap with the weak area strings. Use that topic.
2. **Random from completed:** If completed topics exist but no weak-area match is strong — pick one at random from `completed[]`.
3. **First from curriculum:** If no topics are completed — use the first topic in `curriculum.json`.

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

Read the current `memory.json`, then write it back with ONE change only:

**Append to `weak_areas`** (global top-level list): add any concept strings from WEAK or PARTIAL questions that are not already present.

**Do NOT:**
- Mark any curriculum topic as completed
- Update streak
- Update last_session_date
- Modify the `completed[]` array

Grill sessions are drills, not lessons. They never mark a topic done.

---

## Args Reference

| Invocation | Behavior |
|---|---|
| `/grill` | Auto-picks topic (weak-area target → random completed → first in curriculum) |
| `/grill speculative-decoding` | Forces grill on speculative-decoding |
| `/grill flashattention-internals` | Forces grill on FlashAttention internals |
| `/grill moe-routing-serving` | Forces grill on MoE routing and serving |

Any slug present in `curriculum.json` is valid.
