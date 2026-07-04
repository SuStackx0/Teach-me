
# /teach — Daily AI Lesson Generator

Generate and deliver a deep, expert-level lesson covering AI engineering, backend systems, and system design. Track progress and launch the React viewer.

**Usage:** `/teach` (presents 3 topic options, you pick) or `/teach [topic]` (e.g. `/teach speculative decoding internals`)

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

### Step 1b — Startup Consistency Check

Run these checks every time, right after reading `memory.json`. Fix silently (no need to announce success — only note if a repair happened).

**(a) Stale in_progress vs current_lesson:**
If `in_progress != null`: read `.teach/current_lesson.json` (if it exists) and compare `meta.slug` to `in_progress`.

- If `current_lesson.json` does not exist, OR its `meta.slug` does not match `in_progress`: set `in_progress = null` in `memory.json` and write it back. Note internally: "state repaired". Do not alarm the user — just proceed with a clean state.
- If it matches, leave as-is (normal crash-recovery flow in Step 2a still applies).

**(b) Completed-status drift vs curriculum-v2.json:**
Read `/Users/sumanthg/Documents/teach-me/.teach/curriculum-v2.json`. For every slug in `memory.json`'s `completed[]`: find that slug in any track's `ladder[]` (or as a track's `capstone`). If found and its `status` is not `"completed"`, set `status: "completed"` there (add `completed_date`/`quiz_score_pct` from the memory entry if those fields are missing). Write `curriculum-v2.json` back if any change was made. Slugs not found in the graph (custom/wildcard topics) are not an error — skip them.

Validate both files with `python3 -c "import json; json.load(open(...))"` after any write in this step.

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

Read `completed[]` from `memory.json`. Find any entry where `next_review_date <= today's date` (use the actual current date — check with `date +%F`).

If any are due:

- Select the one with the **earliest** `next_review_date` (this is the one-review-per-day pick).
- **Uniqueness guard:** this selection step never changes existing dates — the guard below only applies when a *new* `next_review_date` is computed in Step 8. Whenever Step 8 computes a new `next_review_date` for any `completed[]` entry, check every OTHER entry's `next_review_date` in `completed[]`. If the new date collides with one already in use, push the new date forward by one day, repeat the collision check, until it lands on a date no other entry has.
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
- Start server if not already running:
  ```bash
  lsof -i :8001 | grep LISTEN || (cd /Users/sumanthg/Documents/teach-me && docker compose up -d)
  sleep 2
  lsof -i :8001 | grep LISTEN
  ```
- If 8001 is up, open it:
  ```bash
  open http://localhost:8001
  ```
- If 8001 is NOT up, output: `⚠️  Run in terminal: cd /Users/sumanthg/Documents/teach-me && docker compose up -d` and stop.
- Output:
  ```
  ⚡ Review session live — http://localhost:8001
     Come back and say "done" when finished.
  ```
- **Stop here. Do NOT start a new lesson today.** Reviews take priority over new content — same as Anki.

### Step 2c — New Topic Selection (Dynamic)

**If the user invoked `/teach [topic]`:**

- Use that text as-is (freeform — any topic the user wants to learn)
- Set: title = the user topic text, slug = kebab-case version of it, domain = "custom", concepts = [], estimated_minutes = 45, difficulty = "advanced"
- Output: `📖 Custom topic: [topic]. Generating lesson...`
- Skip the agent selection and topic picker below. Jump to Step 3.

**If no topic provided — score candidates from the curriculum graph:**

Read `/Users/sumanthg/Documents/teach-me/.teach/curriculum-v2.json` and `/Users/sumanthg/Documents/teach-me/.teach/wishlist.json` (if it exists). Build the candidate pool and context:

```python
import json, datetime
cur = json.load(open('/Users/sumanthg/Documents/teach-me/.teach/curriculum-v2.json'))
today = datetime.date.today().isoformat()

done_slugs = {t['slug'] for tr in cur['tracks'] for t in tr['ladder'] if t['status'] == 'completed'}

candidates = []
for tr in cur['tracks']:
    for t in tr['ladder']:
        ok = t['status'] == 'available' or (t['status'] == 'deferred' and t.get('suggest_after', '9999-12-31') <= today)
        if ok:
            candidates.append({**t, 'track': tr['id'], 'kind': 'lesson'})
    cap = tr.get('capstone')
    if cap and cap.get('status') != 'completed':
        # soft gate: offer the capstone once all-but-one of its building blocks are done
        if sum(r in done_slugs for r in cap['requires']) >= len(cap['requires']) - 1:
            # Capstones only have {slug, title, prompt, requires, type, status, requires_note} —
            # synthesize the fields the picker/brief templates always render so they never
            # show blank values for a design_session candidate.
            cap_defaults = {'estimated_minutes': 50, 'difficulty': 'design-session', 'concepts': []}
            candidates.append({**cap_defaults, **cap, 'track': tr['id'], 'kind': 'design_session'})

# coverage deficit per track (positive = under-covered vs mix_targets)
by_track = {tr['id']: sum(1 for t in tr['ladder'] if t['status'] == 'completed') for tr in cur['tracks']}
total = sum(by_track.values()) or 1
deficits = {k: round(v - by_track.get(k, 0) / total, 2) for k, v in cur['mix_targets'].items()}

recent = sorted(memory['completed'], key=lambda e: e['date'])[-3:]  # last 3 sessions by date, oldest first
weak_areas_list = ", ".join([
    (w['phrase'] if isinstance(w, dict) else w)
    for w in memory.get('weak_areas', [])
    if not (isinstance(w, dict) and w.get('retired'))
]) or "None"
rotation_hint = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")

# Read wishlist
import pathlib, json as _json
_wl_path = pathlib.Path('/Users/sumanthg/Documents/teach-me/.teach/wishlist.json')
wishlist_items = []
if _wl_path.exists():
    try:
        wishlist_items = [i for i in _json.loads(_wl_path.read_text()) if not i.get('surfaced')]
    except Exception:
        wishlist_items = []
wishlist_topics = [i['topic'] for i in wishlist_items]
```

Spawn **one Agent** with **subagent_type `ai-engineer`** using this exact prompt (substitute the [PLACEHOLDERS]):

```
You are a curriculum picker. Choose exactly 3 options for today's session from CANDIDATES below. Pick ONLY from CANDIDATES — never invent a topic.

TODAY: [TODAY]
ROTATION HINT: [ROTATION_HINT] — randomization seed for the wildcard pick.

RECENT SESSIONS (most recent last — one line each: date · title · slug · quiz score · weak areas · notes):
[RECENT]

WEAK AREAS (non-retired): [WEAK_AREAS_LIST]

TRACK DEFICITS (positive = under-covered vs target mix): [DEFICITS]

WISHLIST (topics the user flagged to study — highest priority signal):
[WISHLIST_TOPICS]

CANDIDATES (fields: slug, title, track, kind, concepts, builds_on, related, difficulty, estimated_minutes, note):
[CANDIDATES_JSON]

SELECTION RULES:
1. OPTION 1 — MOMENTUM. The candidate most connected to RECENT SESSIONS via builds_on/related edges (either direction) or direct conceptual continuity. In why_next, name the recent session it continues and how.
2. OPTION 2 — GAP. From the track with the largest positive deficit, and a different track than option 1. Prefer candidates whose concepts overlap WEAK AREAS.
3. OPTION 3 — WILDCARD. Seeded by ROTATION HINT — any remaining candidate, from a third track if possible.
4. CAPSTONE PRIORITY: if any candidate has kind "design_session", it MUST be option 1 — its building blocks are done, time to compose them.
5. Readiness is soft: few completed builds_on lowers preference but never disqualifies. If you pick a low-readiness candidate, say so in why_next ("we'll backfill X inline").
6. WISHLIST PRIORITY (overrides rules 1-3 when applicable): If any WISHLIST topic matches a candidate slug or title closely → that candidate MUST appear as one of the 3 options (replace the lowest-priority of momentum/gap/wildcard). If a wishlist topic needs prerequisites not yet completed → surface the prerequisite candidate instead, and note "prerequisite for [wishlist topic]" in why_next. Use your judgment on readiness — don't surface a wishlist topic if its required concepts aren't in place. Each option can only serve one wishlist item.

Return ONLY a valid JSON array of exactly 3 objects — each copied verbatim from CANDIDATES with two fields added:
"why_next": "1-2 direct sentences", "basis": "momentum|gap|wildcard|capstone"
No markdown fences.
```

Substitute: [TODAY] = today, [ROTATION_HINT] = rotation_hint, [RECENT] = formatted recent list, [WEAK_AREAS_LIST] = weak_areas_list, [DEFICITS] = deficits dict, [CANDIDATES_JSON] = the candidates list as JSON, [WISHLIST_TOPICS] = wishlist_topics as a JSON array (empty array if no wishlist items).

Parse the agent's JSON array. Validate: every returned slug must exist in the candidate pool — discard invented items.

**Fallback (agent fails, bad JSON, or <3 valid items) — pick deterministically from candidates, no agent needed:**

1. momentum: a candidate sharing a builds_on/related edge (either direction) with the most recent completed slug; if none, any candidate in that same track
2. gap: first candidate in the highest-deficit track not already picked
3. wildcard: any remaining candidate from a third track
   Write a one-line why_next from each candidate's `note`/`concepts`; set `basis` accordingly.

**Present the 3 options to the user and STOP:**

Output exactly this block:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Pick today's topic:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1️⃣  [option[0].title]
   ~[option[0].estimated_minutes] min · [option[0].difficulty] · [option[0].track] · [option[0].basis]
   [option[0].why_next]

2️⃣  [option[1].title]
   ~[option[1].estimated_minutes] min · [option[1].difficulty] · [option[1].track] · [option[1].basis]
   [option[1].why_next]

3️⃣  [option[2].title]
   ~[option[2].estimated_minutes] min · [option[2].difficulty] · [option[2].track] · [option[2].basis]
   [option[2].why_next]

Reply 1, 2, or 3 — or type any topic to use something else entirely.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**STOP HERE. Do NOT proceed until the user replies.**

When the user replies:

- "1", "2", or "3": use that option's full JSON object as the chosen topic
- Any other text: treat as a custom topic override (title = that text, slug = kebab-case of it, track = "wildcard", domain = "custom", concepts = [], estimated_minutes = 45, difficulty = "advanced", kind = "lesson")

Output: `🤖 Going with: [chosen title]`

**Mark wishlist item as surfaced** (if the chosen topic matches one): Check if the chosen topic's title or slug fuzzy-matches any item in `wishlist_items`. If so, update that item's `surfaced: true` in `wishlist.json` and write it back.

If the chosen option has `kind == "design_session"`: skip the fast-path check and Steps 3–4 entirely — go directly to **Step 4-DS**.

If an option has kind `design_session`, prefix its title in the picker block with 🏗️ and note "(design session — you design, I critique)". Its `estimated_minutes`/`difficulty`/`concepts` in the picker line come from the synthetic defaults set in Step 2c's candidate-building code (design sessions have no `concepts` field in curriculum-v2.json, so render that segment as "design session" instead of a concept list).

**Fast-path check (run after user picks, before Step 3):**

Check if `/Users/sumanthg/Documents/teach-me/.teach/next_lesson.json` exists:

- Read it and check `meta.slug`
- If `meta.slug` matches the chosen topic slug:
  - Copy `next_lesson.json` → `current_lesson.json` (use the Write tool: read next_lesson.json, write its content to current_lesson.json)
  - Delete `next_lesson.json` (run `rm /Users/sumanthg/Documents/teach-me/.teach/next_lesson.json`)
  - Update `memory.json`: set `in_progress` to the topic slug
  - Output: `⚡ Lesson pre-generated — instant launch!`
  - Skip Steps 3 and 4 entirely. Jump to Step 5 (launch server).
  - If the copied lesson has `_generation_status: "complete"`: after launching, skip assessment generation and go straight to Step 5 (deliver summary).
  - If `_generation_status: "generating_assessments"`: after launching, run Step 4d (parallel assessment agents) as normal.
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

**warm_up**: ALWAYS build exactly 5 questions, drawn from `.teach/question_bank.json` (not generated fresh). This runs every session, regardless of whether weak areas exist.

Read `/Users/sumanthg/Documents/teach-me/.teach/question_bank.json`. Its `questions[]` array has fields: `id, source_slug, source_title, domain, type, question, options, answer, explanation, times_asked, times_correct, last_asked`.

**Selection — pick 5 questions in this priority order, filling from each bucket before moving to the next, skipping already-picked questions:**

1. **(a) Due for review:** questions whose `source_slug` matches a `completed[]` entry with `next_review_date` within 3 days of today (i.e. `today <= next_review_date <= today+3`).
2. **(b) Weak scorers:** questions whose `source_slug` matches a `completed[]` entry with `quiz_score_pct < 0.6` or `quiz_score_pct == null`.
3. **(c) Weak-area text overlap:** questions whose `question` text overlaps (shares a key phrase/word) with any non-retired `weak_areas[].phrase`.
4. **(d) Least-recently-asked:** fill any remaining slots with questions ordered by `last_asked` ascending, `null` first (never-asked questions come before asked ones).

**Diversity constraint:** no two selected questions may share the same `source_slug`, unless the bank has too few distinct `source_slug` values to fill 5 slots (then allow repeats, still preferring the priority order above).

**After selecting the 5**, update each chosen question in `question_bank.json`: `times_asked += 1`, `last_asked = today (YYYY-MM-DD)`. Write `question_bank.json` back and validate with `python3 json.load`.

**Map each selected bank question into the warm_up JSON shape** the React app reads (field names must match exactly — do not invent new ones):

```json
{
  "id": N,
  "question": "[bank question.question, prefixed with its code block inline if the bank item had one]",
  "expected_points": ["[bank question.answer]", "[bank question.explanation]"],
  "difficulty": "warmup",
  "target_weak_area": "[the matching weak_areas[].phrase if selected via rule (c), else null]",
  "follow_up": "[one short natural follow-up question you write, deepening the same concept]"
}
```

`id` is a fresh sequential integer (1-5) local to this lesson's `warm_up` array — it is NOT the bank's `id` string (keep the bank id only inside your own bookkeeping for Step 8c write-back; store it as `source_question_id` alongside the mapped object so debrief can update the right bank entry).

Write Phase 1 JSON to `/Users/sumanthg/Documents/teach-me/.teach/current_lesson.json`.
Update `memory.json`: set `in_progress` to the topic slug.

Output: `Phase 1 written · starting servers...`

Check and start server:

```bash
lsof -i :8001 | grep LISTEN || (cd /Users/sumanthg/Documents/teach-me && docker compose up -d)
sleep 2
lsof -i :8001 | grep LISTEN
```

If port 8001 is up after the sleep, open it:

```bash
open http://localhost:8001
```

If port 8001 is NOT up after the sleep, output this message and stop:

```
⚠️  Server didn't start automatically.
Run this in a terminal: cd /Users/sumanthg/Documents/teach-me && docker compose up -d
Then open: http://localhost:8001
```

Output:

```
⚡ http://localhost:8001 — study this, come back and say "done" when finished.
   Assessment agents generating in background...
```

---

### Step 4d — Spawn quiz+insights agent

Output: `Spawning assessment agent (quiz + insights)...`

**Call the Agent tool once** for quiz+insights. Pass the topic title, a summary of each concept's title + key points, and the available topics list as context.

Before spawning, build the available topics list:
```python
import json
cur = json.load(open('/Users/sumanthg/Documents/teach-me/.teach/curriculum-v2.json'))
mem = json.load(open('/Users/sumanthg/Documents/teach-me/.teach/memory.json'))
done = {c['slug'] for c in mem.get('completed', [])}
done.add(chosen_slug)  # exclude current lesson too
available_topics = [
    {"slug": t['slug'], "title": t['title']}
    for tr in cur['tracks'] for t in tr['ladder']
    if t['slug'] not in done
]
```
Substitute `[AVAILABLE_TOPICS_JSON]` in the prompt with `json.dumps(available_topics)`.

**Quiz+Insights agent prompt:**

```
Generate quiz questions AND key insights for a lesson on "[TOPIC]".
Concepts: [CONCEPT_TITLES_AND_SUMMARIES]

QUIZ: exactly 5 questions. Use simple, concrete scenarios — not gotchas. Each question should test whether the reader understood the mechanism, not whether they memorized a fact. Use plain situations: "You have a table with 10M rows and 2M dead tuples..." or "A model has H=32 query heads and G=4 KV heads...". Include at least 1 multiple_choice and at least 1 scenario-based question. Distractors should be plausible but clearly wrong once you understand the concept. Each explanation must be 2-4 sentences: state the right answer, explain why the wrong options fail, and call out the common mistake.

INSIGHTS: 2-3 items. Write like a colleague saying "hey, watch out for this in production." Real gotchas only — things that actually bite people.

SUMMARY: one clear sentence + 4-5 bullets of the most important takeaways. No fluff.

FURTHER_READING: 2-3 resources. One sentence each on why this specific resource matters for this specific person.

DESIGN_KATA: one applied, 5-minute design decision using today's topic, phrased as a concrete production situation — something with real constraints (traffic numbers, latency budget, failure scenario), asking the reader to make and justify one decision. Not a full system design — a single focused call.

SCENARIO: a concrete end-to-end production scenario showing this topic in action. A real system, a real problem, how the concept solves it, what breaks without it.

SUGGESTIONS: exactly 3 topic suggestions for what to study next, chosen from AVAILABLE_TOPICS below. Pick topics where studying them NOW, right after this lesson, would create a strong knowledge connection — not just "what's next in the curriculum" but what would genuinely deepen or extend today's understanding. Each suggestion needs a one-sentence reason that is specific to what was just covered (e.g. "You saw how tool calls work in MCP; this shows how to make them reliable under failure" — not generic).

AVAILABLE_TOPICS: [AVAILABLE_TOPICS_JSON]

LANGUAGE: Short sentences. Plain words. No "it is worth noting", "fundamentally", "in essence".

Return ONLY a single JSON object (no markdown):
{
  "quiz": [{"id": N, "type": "multiple_choice|scenario|true_false", "question": "...", "code": null, "options": ["A. ...", "B. ...", "C. ...", "D. ..."], "answer": "A", "accepted_answers": ["A"], "explanation": "..."}],
  "key_insights": [{"kind": "insight|gotcha|tip", "title": "...", "text": "..."}],
  "summary": {"one_liner": "...", "takeaways": ["..."]},
  "further_reading": [{"title": "...", "url": null, "kind": "paper|blog|docs|book", "why": "..."}],
  "design_kata": {"prompt": "one applied 5-minute design decision using today's topic, phrased as a concrete production situation", "strong_answer": "what a strong answer covers, 3-4 bullets"},
  "scenario": {"title": "str", "problem": "2-3 sentences describing the real production problem", "system_description": "describe the real system and its components", "how_concept_applies": "2-3 sentences on exactly how today's topic solves the problem", "what_breaks_without_it": "2-3 sentences on what fails if this concept isn't used", "real_world_examples": ["name of real system 1", "name of real system 2", "name of real system 3"]},
  "_suggestions": [{"slug": "...", "title": "...", "reason": "one sentence, specific to what was just covered"}]
}
```

Wait for the agent. Log: `Quiz+Insights done`. Then:

1. Parse the result
2. Read `/Users/sumanthg/Documents/teach-me/.teach/current_lesson.json`
3. Merge in: `key_insights`, `quiz`, `summary`, `further_reading`, `design_kata`, `scenario`, `_suggestions`
4. Set `_generation_status: "complete"`
5. Write merged JSON back to `current_lesson.json`
6. Output: `Generation complete.`

---

## Step 4-DS — Design Session (Capstones)

Capstones are produce-then-critique sessions. They run **entirely in the terminal** — no lesson generation, no concept agents, no server, no React app.

Update `memory.json`: set `in_progress` to the capstone slug. Then:

1. **Present the brief.** Output the capstone's `prompt` requirements, then:

   ```
   Your move — write your design:
   • components & data flow
   • data model / partitioning
   • capacity math (show the numbers)
   • failure modes & degradation policy
   • the tradeoffs you chose and why
   Bullet points are fine. Say "hint" if stuck.
   ```

   **STOP and wait for their design.**
2. **Critique against the rubric.** Peer-review tone — direct, evidence-based, no cheerleading. Score each dimension 1–5 with a one-line justification:

   - **Requirements** — did they pin down scale, latency, consistency needs before designing?
   - **Capacity math** — do the numbers exist, and do they add up?
   - **Bottleneck** — did they identify the real one?
   - **Failure modes** — crash, partition, overload all handled?
   - **Tradeoffs** — articulated and justified, not just asserted?
     Cross-reference their completed topics from `curriculum-v2.json`: "you covered quorum writes — where are they in this design?"
3. **One revision round.** Invite a revision targeting the weakest 1–2 dimensions. Re-score only those. If the user says "done" instead, proceed to logging.
4. **Log on "done".** Compute `overall = mean(final dimension scores) / 5`. Then:

   - `memory.json`: append to `completed[]` — `{slug, title, domain: "design-session", date: today, quiz_score_pct: overall, time_spent_minutes: estimate, weak_areas: [each dimension scoring <= 2, as a short phrase like "capacity math"], notes: "1-2 sentence summary of design strengths/gaps", next_review_date: per the normal score rules}`. Set `in_progress: null`. Update `streak` and `last_session_date` per the normal rules.
   - `curriculum-v2.json`: set the capstone's `status: "completed"`, add `completed_date` and `quiz_score_pct`.
   - **Skip the normal Step 8 debrief questions** — the rubric already captured scores and weak areas.
   - Output the normal completion block from Step 8c, using the rubric summary in place of the debrief answer.

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

🌐  http://localhost:8001

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
Session already logged.
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
     Apply the same **uniqueness guard** as Step 8: if this date collides with another entry's `next_review_date` in `completed[]`, push forward one day at a time until unique.
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

**Design kata.** If `current_lesson.json` has a `design_kata` field and the user hasn't seen it yet this session, show it now:

```
One more thing — a quick design call:

[design_kata.prompt]
```

Wait for their answer. Judge it pass/fail against `design_kata.strong_answer` — be strict but fair. Give a one-line verdict:

```
Verdict: PASS — [one clause on why] / FAIL — [one clause on what was missing]
```

Remember this as `kata_passed: true/false` for the `completed[]` entry written later in this step. If there is no `design_kata` field on the lesson (e.g. an older pre-generated lesson), skip this and omit `kata_passed` from the completed entry.

**Warm-up recap.** Ask:

```
Warm-up: which question numbers did you miss? (e.g. 2,4 — or none)
```

Wait for their answer. Parse the numbers (or "none" = all 5 correct). For each of the 5 warm-up questions:

- If its number was NOT in the missed list (i.e. answered correctly):
  - In `question_bank.json`, find the bank question by the `source_question_id` you stored when building `warm_up` (Step 4c) and increment its `times_correct += 1`.
  - If that warm-up item's `target_weak_area` is non-null: find the matching entry in `memory.json`'s `weak_areas[]` by `phrase` and increment its `reinforced_count += 1`. If `reinforced_count` reaches `>= 2`, set `retired: true` on that entry.
- If its number WAS in the missed list: no bank or weak_area update for that question (a miss doesn't reinforce anything).

Write `question_bank.json` and `memory.json` back after this step; validate both with `python3 json.load`.

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

**Uniqueness guard:** before writing this date, check it against every `next_review_date` already present in `completed[]`. If it collides with an existing one, push it forward one day and re-check, repeating until it is unique across all `completed[]` entries (including the one you're about to add).

### Update memory.json

Read the current `.teach/memory.json`, then write back with these changes:

1. **Move `in_progress` → `completed[]`** by appending a new entry:

   ```json
   {
     "slug": "[topic slug]",
     "title": "[topic title]",
     "domain": "[the chosen option's track id, or \"custom\" for free-typed topics]",
     "date": "[today YYYY-MM-DD]",
     "quiz_score_pct": [score as decimal, e.g. 0.75, or null if skipped],
     "time_spent_minutes": [estimate from session start to now],
     "weak_areas": ["[their debrief answer]"],
     "notes": "[1-2 sentence summary of the session — what they got, what they missed]",
     "next_review_date": "[computed date YYYY-MM-DD]",
     "kata_passed": [true|false — omit this field entirely if the lesson had no design_kata]
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

### Update curriculum-v2.json

Read `/Users/sumanthg/Documents/teach-me/.teach/curriculum-v2.json`:

- If the completed slug exists in any track's `ladder[]` (or is a track's capstone): set its `status: "completed"`, add `completed_date` (today) and `quiz_score_pct`.
- If the slug is NOT in the graph (custom free-typed topic): append it to the `wildcard` track's ladder as `{slug, title, concepts: [], builds_on: [], difficulty, estimated_minutes, status: "completed", completed_date, quiz_score_pct}` — so future momentum scoring can see it.
- Write the file back.

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

See you tomorrow! 🧠
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## Step 8.5 — Pre-generate Next Lesson (runs immediately after Step 8's completion output)

Immediately after printing Step 8's completion output, pre-generate tomorrow's lesson for instant startup. This step computes tomorrow's topic itself — Step 8's output above intentionally does NOT include a "tomorrow's suggestion" line, because that data does not exist until this step runs.

1. Build updated context: include the just-completed topic in completed_list, increment n_completed
2. Spawn an **ai-engineer** Agent with the same topic-selection prompt from Step 2c (with updated context)
3. Parse the returned JSON array and take the momentum pick (option 1) as the next topic — unless it's a `design_session`, in which case take option 2 (design sessions can't be pre-generated)
4. If agent fails or parse fails: output `⚠️  Pre-generation skipped — next topic will be selected fresh on next /teach` and stop
5. If successful: Generate the full lesson using SAME parallel agent structure as Steps 4a–4d (no coding challenge):
   - Write Phase 1 to a temp variable (do NOT overwrite current_lesson.json)
   - After all agents complete, assemble the FULL lesson JSON (both phases merged, no coding_challenge field)
   - Set `_generation_status: "complete"`
   - Write to `/Users/sumanthg/Documents/teach-me/.teach/next_lesson.json`
6. Output:
   ```
   ⚡ Next lesson pre-generated: [Next Topic Title] — instant on next /teach
      Why: [why_next from the momentum pick]
   ```

---

## Error Handling

| Problem                                      | Response                                                                                                                        |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `.teach/memory.json` missing               | Create it fresh with the default schema (streak: 0, completed: [], in_progress: null, last_session_date: null, weak_areas: []). |
| Server not running                           | Auto-started by the skill — check`/tmp/teach-server.log` if the page won't load                                              |
| Port 8001 already in use                     | API server already running — just open http://localhost:8001                                                                   |
| ai-engineer agent fails to return valid JSON | Use the fallback topic defined in Step 2c and proceed normally.                                                                 |

---

## Args Reference

The skill accepts one optional positional argument: any topic description (freeform — not from a fixed list).

| Invocation                                | Behavior                                                                                    |
| ----------------------------------------- | ------------------------------------------------------------------------------------------- |
| `/teach`                                | Presents 3 diverse topic options (from different domains), waits for you to pick 1, 2, or 3 |
| `/teach speculative decoding internals` | Skips the picker, generates a lesson on that exact topic immediately                        |
| `/teach gRPC for LLM serving`           | Skips the picker, generates a cross-domain lesson on that topic                             |
| `/teach [any topic]`                    | Skips the picker, generates a lesson on any topic you specify                               |

When a topic is provided directly, the picker is skipped and generation starts immediately.
When using the picker, you can also type any topic name instead of 1/2/3 to override the suggestions.

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
      "next_review_date": "2026-07-04",
      "kata_passed": true
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
  "learner": {"name": "Sumanth", "role": "AI Backend Engineer", "company": "uCube.ai"},
  "requiz_queue": ["speculative-decoding-eagle2-draft-trees-acceptance"]
}
```

## Question Bank Schema Reference (`.teach/question_bank.json`)

```json
{
  "questions": [
    {
      "id": "agent-memory-episodic-semantic-procedural-retrieval-q1",
      "source_slug": "agent-memory-episodic-semantic-procedural-retrieval",
      "source_title": "...",
      "domain": "agentic",
      "type": "multiple_choice|scenario|true_false|open",
      "question": "...",
      "options": ["A. ...", "B. ...", "C. ...", "D. ..."],
      "answer": "...",
      "explanation": "...",
      "times_asked": 0,
      "times_correct": 0,
      "last_asked": null
    }
  ]
}
```
