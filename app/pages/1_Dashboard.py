"""
TeachMe · Progress Dashboard
Reads memory.json + curriculum.json and shows learner progress at a glance.
"""

import json
from pathlib import Path
from datetime import datetime

import streamlit as st

# ---------------------------------------------------------------------------
# Page config
# ---------------------------------------------------------------------------
st.set_page_config(page_title="TeachMe · Dashboard", page_icon="📊", layout="wide")

# ---------------------------------------------------------------------------
# Design system CSS (mirrors app.py)
# ---------------------------------------------------------------------------
CSS = """
<style>
@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500;700&display=swap');

:root {
  --bg-primary: #0A0A0F;
  --bg-secondary: #12121A;
  --bg-elevated: #1A1A26;
  --card-bg: rgba(22, 22, 32, 0.6);
  --card-border: rgba(255, 255, 255, 0.08);
  --accent: #7C5CFF;
  --accent-2: #00D4FF;
  --accent-3: #FF6B9D;
  --success: #34D399;
  --warning: #FBBF24;
  --error: #F87171;
  --text-1: #ECECF1;
  --text-2: #A0A0B0;
  --text-3: #6B6B7B;
  --code-bg: #0D0D14;
}

.stApp {
  background:
    radial-gradient(1200px 600px at 80% -10%, rgba(124,92,255,0.10), transparent 60%),
    radial-gradient(900px 500px at 0% 10%, rgba(0,212,255,0.06), transparent 55%),
    var(--bg-primary);
  color: var(--text-1);
  font-family: 'Inter', sans-serif;
}
.main .block-container { max-width: 1100px; padding-top: 3rem; padding-bottom: 5rem; }

h1, h2, h3, h4 { font-family: 'Space Grotesk', sans-serif; color: var(--text-1); letter-spacing: -0.02em; }
h1 { font-weight: 700; font-size: 2.2rem; line-height: 1.1; }
h2 { font-weight: 600; font-size: 1.4rem; margin-top: 1.4rem; }
p, li { color: var(--text-2); line-height: 1.7; font-size: 1.02rem; }
strong { color: var(--text-1); font-weight: 600; }

#MainMenu, footer, header { visibility: hidden; }

.tm-card {
  background: var(--card-bg);
  backdrop-filter: blur(16px) saturate(140%);
  -webkit-backdrop-filter: blur(16px) saturate(140%);
  border: 1px solid var(--card-border);
  border-radius: 18px;
  padding: 22px 24px;
  margin: 12px 0;
  box-shadow: 0 8px 40px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.04);
  animation: tm-rise 0.45s cubic-bezier(.2,.8,.2,1);
}
.tm-card:hover { border-color: rgba(124,92,255,0.25); transition: border-color .3s ease; }

@keyframes tm-rise { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: translateY(0); } }

.tm-badge {
  display: inline-flex; align-items: center; gap: 6px;
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.72rem; font-weight: 700; text-transform: uppercase;
  letter-spacing: 0.08em; padding: 5px 12px; border-radius: 999px;
  margin-bottom: 8px; border: 1px solid transparent;
}
.tm-badge.hook      { color: var(--accent-2); background: rgba(0,212,255,0.10);  border-color: rgba(0,212,255,0.3); }
.tm-badge.concept   { color: var(--accent);   background: rgba(124,92,255,0.10); border-color: rgba(124,92,255,0.3); }
.tm-badge.deepdive  { color: var(--warning);  background: rgba(251,191,36,0.10); border-color: rgba(251,191,36,0.3); }
.tm-badge.quiz      { color: var(--success);  background: rgba(52,211,153,0.10); border-color: rgba(52,211,153,0.3); }
.tm-badge.challenge { color: var(--accent-3); background: rgba(255,107,157,0.10);border-color: rgba(255,107,157,0.3); }

.tm-callout {
  border-radius: 14px; padding: 14px 18px; margin: 12px 0;
  border-left: 3px solid var(--accent);
  background: linear-gradient(90deg, rgba(124,92,255,0.10), rgba(124,92,255,0.02));
  font-size: 0.96rem;
}
.tm-callout.insight { border-left-color: var(--warning); background: linear-gradient(90deg, rgba(251,191,36,0.10), transparent); }
.tm-callout.gotcha  { border-left-color: var(--error);   background: linear-gradient(90deg, rgba(248,113,113,0.10), transparent); }
.tm-callout.tip     { border-left-color: var(--success); background: linear-gradient(90deg, rgba(52,211,153,0.10), transparent); }
.tm-callout-title { font-family:'Space Grotesk'; font-weight:600; color:var(--text-1); margin-bottom:4px; display:block; }

.tm-pill {
  display: inline-block; padding: 5px 12px; border-radius: 999px;
  background: rgba(124,92,255,0.12); color: var(--accent);
  font-family: 'JetBrains Mono'; font-size: 0.80rem;
  margin: 3px; border: 1px solid rgba(124,92,255,0.2);
}
.tm-pill.weak {
  background: rgba(248,113,113,0.12); color: #F87171;
  border-color: rgba(248,113,113,0.3);
}

section[data-testid="stSidebar"] {
  background: var(--bg-secondary);
  border-right: 1px solid var(--card-border);
}
</style>
"""

st.markdown(CSS, unsafe_allow_html=True)

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------
MEMORY_PATH = Path(__file__).parent.parent / ".teach" / "memory.json"
CURRICULUM_PATH = Path(__file__).parent.parent / ".teach" / "curriculum.json"

# ---------------------------------------------------------------------------
# Data loading
# ---------------------------------------------------------------------------

def load_json(path: Path) -> dict | list | None:
    if not path.exists():
        return None
    try:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    except (json.JSONDecodeError, OSError):
        return None


def format_date(date_str: str) -> str:
    """Format ISO date string to human-readable."""
    try:
        dt = datetime.fromisoformat(date_str.replace("Z", "+00:00"))
        return dt.strftime("%b %d, %Y")
    except Exception:
        return date_str


def get_weak_phrase(w) -> str:
    if isinstance(w, str):
        return w
    return w.get("phrase", "")


def is_retired(w) -> bool:
    if isinstance(w, dict):
        return w.get("retired", False)
    return False


# ---------------------------------------------------------------------------
# Main render
# ---------------------------------------------------------------------------

def main():
    st.markdown("# TeachMe · Progress Dashboard")

    memory = load_json(MEMORY_PATH)
    curriculum = load_json(CURRICULUM_PATH)

    if memory is None or curriculum is None:
        st.markdown(
            """<div class="tm-callout">
              <span class="tm-callout-title">No sessions yet</span>
              Run <code>/teach</code> in Claude Code to generate your first lesson and start tracking progress.
            </div>""",
            unsafe_allow_html=True,
        )
        return

    # ------------------------------------------------------------------
    # Normalise memory structure
    # ------------------------------------------------------------------
    completed: list[dict] = memory.get("completed", [])
    streak: int = memory.get("streak", 0)
    weak_areas: list = memory.get("weak_areas", [])
    last_session: str = memory.get("last_session", "") or memory.get("last_session_date", "") or ""

    # Fix: use slug as the primary identifier, falling back to topic_id/id
    completed_ids: set[str] = {s.get("slug", s.get("topic_id", s.get("id", ""))) for s in completed}
    total_topics = len(curriculum) if isinstance(curriculum, list) else 0

    # ------------------------------------------------------------------
    # Stats row
    # ------------------------------------------------------------------
    c1, c2, c3, c4 = st.columns(4)
    stat_style = "font-family:'Space Grotesk';font-size:2rem;font-weight:700;"
    label_style = "color:#6B6B7B;font-size:0.82rem;margin-top:4px;"

    with c1:
        st.markdown(
            f"""<div class="tm-card" style="text-align:center;">
              <div style="{stat_style}color:#7C5CFF;">{len(completed_ids)}/{total_topics}</div>
              <div style="{label_style}">Topics Completed</div>
            </div>""",
            unsafe_allow_html=True,
        )
    with c2:
        streak_color = "#34D399" if streak >= 3 else "#FBBF24" if streak >= 1 else "#F87171"
        st.markdown(
            f"""<div class="tm-card" style="text-align:center;">
              <div style="{stat_style}color:{streak_color};">{streak} {"🔥" if streak >= 3 else "📅"}</div>
              <div style="{label_style}">Day Streak</div>
            </div>""",
            unsafe_allow_html=True,
        )
    with c3:
        # Average quiz score — use quiz_score_pct first, fall back to quiz_score
        scores = [
            s.get("quiz_score_pct", s.get("quiz_score", 0))
            for s in completed
            if s.get("quiz_score_pct") is not None or s.get("quiz_score") is not None
        ]
        if scores:
            # If scores look like fractions (0–1), format as pct; otherwise display raw
            if all(isinstance(sc, (int, float)) and sc <= 1.0 for sc in scores):
                avg_score = f"{sum(scores)/len(scores)*100:.0f}%"
            else:
                avg_score = f"{sum(scores)/len(scores):.1f}"
        else:
            avg_score = "—"
        st.markdown(
            f"""<div class="tm-card" style="text-align:center;">
              <div style="{stat_style}color:#00D4FF;">{avg_score}</div>
              <div style="{label_style}">Avg Quiz Score</div>
            </div>""",
            unsafe_allow_html=True,
        )
    with c4:
        last_date = format_date(last_session) if last_session else "Never"
        st.markdown(
            f"""<div class="tm-card" style="text-align:center;">
              <div style="font-family:'Space Grotesk';font-size:1.1rem;font-weight:600;color:#ECECF1;margin-top:6px;">{last_date}</div>
              <div style="{label_style}">Last Session</div>
            </div>""",
            unsafe_allow_html=True,
        )

    st.markdown("<br>", unsafe_allow_html=True)

    # ------------------------------------------------------------------
    # Review Queue section
    # ------------------------------------------------------------------
    today_str = datetime.now().strftime("%Y-%m-%d")
    due_reviews = [
        s for s in completed
        if s.get("next_review_date") and s["next_review_date"] <= today_str
    ]
    due_reviews.sort(key=lambda x: x["next_review_date"])

    if due_reviews:
        rows_html = ""
        for s in due_reviews:
            title = s.get("title", s.get("slug", s.get("topic_id", "Unknown")))
            orig_date = format_date(s.get("date", ""))
            review_date = s["next_review_date"]
            try:
                delta = (datetime.strptime(today_str, "%Y-%m-%d") - datetime.strptime(review_date, "%Y-%m-%d")).days
            except Exception:
                delta = 0
            overdue_str = "due today" if delta == 0 else f"{delta}d overdue"
            rows_html += (
                f'<div style="display:flex;justify-content:space-between;align-items:center;'
                f'padding:6px 0;border-bottom:1px solid rgba(255,255,255,0.05);">'
                f'<span style="color:var(--text-1);font-family:\'Space Grotesk\';font-weight:600;font-size:0.92rem;">{title}</span>'
                f'<span style="font-family:\'JetBrains Mono\';font-size:0.72rem;color:var(--warning);">'
                f'{overdue_str} &nbsp;·&nbsp; learned {orig_date}</span>'
                f'</div>'
            )
        st.markdown(
            f"""<div class="tm-card" style="border-color: rgba(251,191,36,0.4); background: rgba(251,191,36,0.05);">
              <span class="tm-callout-title" style="color: var(--warning);">📚 Review Due ({len(due_reviews)})</span>
              <div style="margin-top:10px;">{rows_html}</div>
              <p style="color: var(--text-2); font-size: 0.88rem; margin-top: 8px; margin-bottom: 0;">
                Run <code>/teach</code> — your review session will start automatically.
              </p>
            </div>""",
            unsafe_allow_html=True,
        )
        st.markdown("<br>", unsafe_allow_html=True)

    # ------------------------------------------------------------------
    # Layout: left col = progress + weak areas, right col = upcoming + recent
    # ------------------------------------------------------------------
    left_col, right_col = st.columns([1, 1], gap="large")

    # ---- Progress by category ----
    with left_col:
        st.markdown("### Progress by Category")

        # Build category index from curriculum
        category_map: dict[str, list[dict]] = {}
        for item in (curriculum if isinstance(curriculum, list) else []):
            cat = item.get("category", "other")
            category_map.setdefault(cat, []).append(item)

        category_labels = {
            "ai-ml": "LLM & AI",
            "backend": "Backend Engineering",
            "system-design": "System Design",
        }
        category_colors = {
            "ai-ml": "#7C5CFF",
            "backend": "#00D4FF",
            "system-design": "#FF6B9D",
        }

        for cat, items in category_map.items():
            label = category_labels.get(cat, cat.replace("-", " ").title())
            color = category_colors.get(cat, "#7C5CFF")
            cat_total = len(items)
            # Fix: use slug instead of id for cross-reference
            cat_done = sum(1 for it in items if it.get("slug", "") in completed_ids)
            pct = int(cat_done / cat_total * 100) if cat_total else 0

            st.markdown(
                f"""<div class="tm-card" style="padding:16px 20px;">
                  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
                    <span style="font-family:'Space Grotesk';font-weight:600;color:#ECECF1;">{label}</span>
                    <span style="font-family:'JetBrains Mono';font-size:0.78rem;color:{color};">{cat_done}/{cat_total}</span>
                  </div>
                  <div style="height:5px;background:rgba(255,255,255,0.06);border-radius:99px;overflow:hidden;">
                    <div style="width:{pct}%;height:100%;background:{color};
                                border-radius:99px;transition:width 0.5s ease;"></div>
                  </div>
                </div>""",
                unsafe_allow_html=True,
            )

        # ---- Weak areas ----
        st.markdown("### Weak Areas")
        if weak_areas:
            active_weak_areas = [w for w in weak_areas if not is_retired(w)]
            active_phrases = [get_weak_phrase(w) for w in active_weak_areas]
            retired_count = len(weak_areas) - len(active_weak_areas)

            if active_phrases:
                chips_html = "".join(
                    f'<span class="tm-pill weak">{area}</span>'
                    for area in active_phrases
                )
                if retired_count > 0:
                    chips_html += (
                        f'<span style="color:var(--text-3);font-size:0.78rem;margin-left:8px;">'
                        f'{retired_count} retired</span>'
                    )
                st.markdown(
                    f'<div class="tm-card" style="padding:16px 20px;">{chips_html}</div>',
                    unsafe_allow_html=True,
                )
            else:
                st.markdown(
                    '<div class="tm-callout tip"><span class="tm-callout-title">All weak areas resolved</span>'
                    f'{retired_count} area{"s" if retired_count != 1 else ""} retired. Keep it up.</div>',
                    unsafe_allow_html=True,
                )
        else:
            st.markdown(
                '<div class="tm-callout tip"><span class="tm-callout-title">No weak areas flagged yet</span>'
                'Complete sessions to start tracking gaps.</div>',
                unsafe_allow_html=True,
            )

    # ---- Upcoming + Recently completed ----
    with right_col:
        st.markdown("### Next Up")
        upcoming = [
            item for item in (curriculum if isinstance(curriculum, list) else [])
            if item.get("slug", "") not in completed_ids
        ][:3]

        if upcoming:
            for item in upcoming:
                cat = item.get("category", "")
                badge_class = {"ai-ml": "concept", "backend": "hook", "system-design": "challenge"}.get(cat, "concept")
                st.markdown(
                    f"""<div class="tm-card" style="padding:14px 18px;">
                      <span class="tm-badge {badge_class}" style="margin-bottom:6px;">{cat.replace("-", " ").upper()}</span>
                      <div style="font-family:'Space Grotesk';font-weight:600;color:#ECECF1;font-size:0.96rem;">
                        {item.get("title", item.get("slug", ""))}
                      </div>
                      <div style="color:#6B6B7B;font-size:0.82rem;margin-top:4px;">
                        {item.get("estimated_minutes", "?")} min · {item.get("difficulty", "intermediate")}
                      </div>
                    </div>""",
                    unsafe_allow_html=True,
                )
        else:
            st.markdown(
                '<div class="tm-callout tip"><span class="tm-callout-title">All topics complete!</span>'
                'You\'ve finished the full curriculum. Impressive.</div>',
                unsafe_allow_html=True,
            )

        st.markdown("### Recently Completed")
        recent = list(reversed(completed))[:3]

        if recent:
            for session in recent:
                slug = session.get("slug", session.get("topic_id", session.get("id", "unknown")))
                title = session.get("title", slug.replace("-", " ").title())
                date = format_date(session.get("date", "")) if session.get("date") else "—"
                quiz_score = session.get("quiz_score_pct", session.get("quiz_score"))
                if quiz_score is not None:
                    if isinstance(quiz_score, float) and quiz_score <= 1.0:
                        score_text = f"{quiz_score*100:.0f}%"
                    else:
                        score_text = f"{quiz_score}"
                else:
                    score_text = "—"
                next_review = session.get("next_review_date", "")
                review_str = format_date(next_review) if next_review else "Not scheduled"

                st.markdown(
                    f"""<div class="tm-card" style="padding:14px 18px;">
                      <div style="display:flex;justify-content:space-between;align-items:flex-start;">
                        <div style="font-family:'Space Grotesk';font-weight:600;color:#ECECF1;font-size:0.94rem;">
                          {title}
                        </div>
                        <span style="font-family:'JetBrains Mono';font-size:0.72rem;color:#6B6B7B;white-space:nowrap;margin-left:8px;">
                          {date}
                        </span>
                      </div>
                      <div style="display:flex;gap:12px;margin-top:8px;align-items:center;">
                        <span style="font-family:'JetBrains Mono';font-size:0.76rem;
                                     color:#34D399;background:rgba(52,211,153,0.10);
                                     padding:2px 8px;border-radius:6px;">
                          quiz {score_text}
                        </span>
                        <span style="font-family:'JetBrains Mono';font-size:0.72rem;color:#6B6B7B;">
                          Next review: {review_str}
                        </span>
                      </div>
                    </div>""",
                    unsafe_allow_html=True,
                )
        else:
            st.markdown(
                '<div class="tm-callout"><span class="tm-callout-title">No completed sessions</span>'
                'Finish your first lesson to see history here.</div>',
                unsafe_allow_html=True,
            )

        # ---- Lesson Archive ----
        archive_dir = Path(__file__).parent.parent / ".teach" / "archive"
        archived = list(archive_dir.glob("*.json")) if archive_dir.exists() else []

        if archived:
            with st.expander(f"📁 Lesson Archive ({len(archived)} sessions)"):
                for completed_session in list(reversed(completed)):
                    slug = completed_session.get("slug", "")
                    archive_file = archive_dir / f"{slug}.json"
                    if archive_file.exists():
                        date = format_date(completed_session.get("date", ""))
                        score = completed_session.get("quiz_score_pct", completed_session.get("quiz_score"))
                        if score is not None:
                            if isinstance(score, float) and score <= 1.0:
                                score_str = f"{score*100:.0f}%"
                            else:
                                score_str = f"{score}"
                        else:
                            score_str = "—"
                        st.markdown(
                            f"**{completed_session.get('title', slug)}** · {date} · Quiz: {score_str}"
                        )


main()
