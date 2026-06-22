---
name: ui-patterns
description: Key Streamlit UI patterns in teach-me: sidebar dot logic, micro-quiz grading, session logging, review session mode
metadata:
  type: project
---

# teach-me UI Patterns

## Sidebar dot coloring for concept sections
Function `_concept_mq_dot_class(concept_idx, lesson)` reads `mq_score_{idx}_{q_idx}` keys from session_state:
- All graded + all got-it → `"got-it"` (green dot)
- Any missed → `"missed"` (yellow dot)
- Nothing graded yet → `""` (default gray)
CSS classes `.tm-dot.got-it` and `.tm-dot.missed` handle the colors.

## Micro-quiz flow
In `render_core_concept()`:
1. `tm-mq-divider` HR + `tm-mq-badge` "Quick check" badge introduce the section
2. Question shown as styled div (not `st.markdown("**Q:**")`)
3. Reveal answer button: subtle secondary style, small column `[2, 5]` layout
4. After reveal: `tm-callout tip` for answer, `tm-callout insight` for explanation
5. Got it / Missed it: `[2, 2, 3]` column layout, `use_container_width=True`
6. After grading: inline colored dot + label (no button remount)

## Challenge attempt section
- Badge: `"Try First"` (not "Challenge Attempt")
- Pedagogical framing callout uses `.neutral` variant with purple left border override
- Starter code labeled with `starter_code.py` mono caption
- Text area wrapped in `<div class="tm-attempt-area">` for dark CSS override
- Button: `use_container_width=True`, full sentence label

## Session logging (normal sessions)
- Stats shown FIRST in 3-card row before the form
- Log form: plain section heading + small descriptor text, NOT a bold "### Log This Session"
- "Log Session & Archive" button: `use_container_width=True`, `type="primary"`
- try/except around `log_session_to_disk()` → `st.error("Couldn't save session — check .teach/memory.json permissions")`
- Success state: `.tm-success-banner` card with streak count + next review date

## Review session mode
- `meta.is_review_session: true` → `build_sections()` returns `["quiz", "complete"]`
- Sidebar title: "Review Session" (not lesson title); subtitle shows the original topic title
- Quiz header: "Recall Quiz" badge class `.review` (purple-ish), subtitle shows original title
- Complete section: no micro-quiz stat card (mq_scores irrelevant), simplified success banner
- try/except around `log_review_session_to_disk()` → `st.error()`

## Score → days-until-review mapping (DRY helper)
`_days_until_review(quiz_score_input: str) -> int` centralizes the pct→days logic so
both the pre-log display and the post-log success banner use the same values.
Previously duplicated inline in `render_complete()`.
