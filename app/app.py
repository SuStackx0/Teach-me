"""
TeachMe — Daily AI Deep Dives
A production-quality Streamlit app for teaching one deep AI topic per day.
"""

import json
import shutil
import time
from datetime import datetime, timedelta
from pathlib import Path

import streamlit as st
from anthropic import Anthropic

# ---------------------------------------------------------------------------
# Page config — must be first Streamlit call
# ---------------------------------------------------------------------------
st.set_page_config(
    page_title="TeachMe · AI Deep Dives",
    page_icon="🧠",
    layout="wide",
    initial_sidebar_state="expanded",
)

# ---------------------------------------------------------------------------
# Design system CSS
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
.main .block-container { max-width: 960px; padding-top: 3.5rem; padding-bottom: 6rem; }

h1, h2, h3, h4 { font-family: 'Space Grotesk', sans-serif; color: var(--text-1); letter-spacing: -0.02em; }
h1 { font-weight: 700; font-size: 2.4rem; line-height: 1.1; }
h2 { font-weight: 600; font-size: 1.6rem; margin-top: 1.6rem; }
p, li { color: var(--text-2); line-height: 1.7; font-size: 1.02rem; }
strong { color: var(--text-1); font-weight: 600; }
a { color: var(--accent-2); text-decoration: none; }

#MainMenu, footer, header { visibility: hidden; }

.tm-progress-wrap {
  position: fixed; top: 0; left: 0; right: 0; height: 4px;
  background: rgba(255,255,255,0.05); z-index: 9999;
}
.tm-progress-fill {
  height: 100%;
  background: linear-gradient(90deg, var(--accent), var(--accent-2));
  box-shadow: 0 0 12px rgba(124,92,255,0.6);
  transition: width 0.5s cubic-bezier(.2,.8,.2,1);
  border-radius: 0 2px 2px 0;
}

.tm-card {
  background: var(--card-bg);
  backdrop-filter: blur(16px) saturate(140%);
  -webkit-backdrop-filter: blur(16px) saturate(140%);
  border: 1px solid var(--card-border);
  border-radius: 18px;
  padding: 26px 28px;
  margin: 18px 0;
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
  margin-bottom: 14px; border: 1px solid transparent;
}
.tm-badge.hook      { color: var(--accent-2); background: rgba(0,212,255,0.10);  border-color: rgba(0,212,255,0.3); }
.tm-badge.concept   { color: var(--accent);   background: rgba(124,92,255,0.10); border-color: rgba(124,92,255,0.3); }
.tm-badge.deepdive  { color: var(--warning);  background: rgba(251,191,36,0.10); border-color: rgba(251,191,36,0.3); }
.tm-badge.quiz      { color: var(--success);  background: rgba(52,211,153,0.10); border-color: rgba(52,211,153,0.3); }
.tm-badge.challenge { color: var(--accent-3); background: rgba(255,107,157,0.10);border-color: rgba(255,107,157,0.3); }
.tm-badge.review    { color: #C4B5FD;         background: rgba(196,181,253,0.10);border-color: rgba(196,181,253,0.3); }

.tm-callout {
  border-radius: 14px; padding: 16px 20px; margin: 16px 0;
  border-left: 3px solid var(--accent);
  background: linear-gradient(90deg, rgba(124,92,255,0.10), rgba(124,92,255,0.02));
  font-size: 0.98rem;
}
.tm-callout.insight { border-left-color: var(--warning); background: linear-gradient(90deg, rgba(251,191,36,0.10), transparent); }
.tm-callout.gotcha  { border-left-color: var(--error);   background: linear-gradient(90deg, rgba(248,113,113,0.10), transparent); }
.tm-callout.tip     { border-left-color: var(--success); background: linear-gradient(90deg, rgba(52,211,153,0.10), transparent); }
.tm-callout.neutral { border-left-color: var(--text-3);  background: rgba(255,255,255,0.03); }
.tm-callout-title { font-family:'Space Grotesk'; font-weight:600; color:var(--text-1); margin-bottom:4px; display:block; }

/* Challenge attempt text area — dark themed */
.tm-attempt-area textarea {
  background: #0D0D14 !important;
  border: 1px solid rgba(255,107,157,0.25) !important;
  border-radius: 12px !important;
  color: #ECECF1 !important;
  font-family: 'JetBrains Mono', monospace !important;
  font-size: 0.88rem !important;
  line-height: 1.6 !important;
}
.tm-attempt-area textarea:focus {
  border-color: rgba(255,107,157,0.55) !important;
  box-shadow: 0 0 0 2px rgba(255,107,157,0.12) !important;
}
.tm-attempt-area textarea::placeholder { color: #4A4A5A !important; }

/* Micro-quiz styled text area */
.stTextArea textarea {
  background: #0D0D14 !important;
  border: 1px solid var(--card-border) !important;
  border-radius: 12px !important;
  color: var(--text-1) !important;
  font-family: 'JetBrains Mono', monospace !important;
  font-size: 0.88rem !important;
}

/* Micro-quiz separator */
.tm-mq-divider {
  border: none;
  border-top: 1px solid rgba(255,255,255,0.06);
  margin: 28px 0 20px 0;
}

/* Quick-check badge — small inline badge */
.tm-mq-badge {
  display: inline-flex; align-items: center; gap: 5px;
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.68rem; font-weight: 700; text-transform: uppercase;
  letter-spacing: 0.09em; padding: 3px 10px; border-radius: 999px;
  color: var(--success); background: rgba(52,211,153,0.09);
  border: 1px solid rgba(52,211,153,0.22); margin-bottom: 12px;
}

/* Got it / Missed it grading buttons */
div[data-testid="stButton"] > button.mq-got-it {
  background: rgba(52,211,153,0.12) !important;
  border-color: rgba(52,211,153,0.4) !important;
  color: var(--success) !important;
}
div[data-testid="stButton"] > button.mq-missed-it {
  background: rgba(248,113,113,0.12) !important;
  border-color: rgba(248,113,113,0.4) !important;
  color: var(--error) !important;
}

/* Completion hero area */
.tm-complete { text-align: center; padding: 40px 20px 28px; animation: tm-rise 0.6s ease; }
.tm-score { font-family: 'Space Grotesk'; font-size: 4rem; font-weight: 700; background: linear-gradient(135deg, var(--accent), var(--accent-2)); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }

/* Celebration success card */
.tm-success-banner {
  background: linear-gradient(135deg, rgba(52,211,153,0.12), rgba(0,212,255,0.06));
  border: 1px solid rgba(52,211,153,0.3);
  border-radius: 18px;
  padding: 28px 32px;
  text-align: center;
  animation: tm-rise 0.5s ease;
}

.stCodeBlock, pre {
  background: var(--code-bg) !important;
  border: 1px solid rgba(124,92,255,0.15) !important;
  border-radius: 14px !important;
}
code, pre { font-family: 'JetBrains Mono', monospace !important; font-size: 0.88rem !important; }
:not(pre) > code {
  background: rgba(124,92,255,0.12); color: #C4B5FD;
  padding: 2px 7px; border-radius: 6px;
}

div[data-testid="stButton"] > button {
  width: 100%; text-align: left; justify-content: flex-start;
  background: var(--bg-elevated);
  border: 1px solid var(--card-border);
  color: var(--text-1);
  border-radius: 12px; padding: 14px 18px;
  font-family: 'Inter', sans-serif; font-size: 0.98rem; font-weight: 500;
  transition: all 0.18s ease; margin-bottom: 6px;
}
div[data-testid="stButton"] > button:hover {
  border-color: var(--accent); background: rgba(124,92,255,0.10);
  transform: translateX(3px);
}

div[data-testid="stButton"] > button[kind="primary"] {
  background: linear-gradient(135deg, var(--accent), #5B3FD6);
  border: none; color: white; font-weight: 600;
  text-align: center; justify-content: center;
  box-shadow: 0 4px 20px rgba(124,92,255,0.35);
}
div[data-testid="stButton"] > button[kind="primary"]:hover { filter: brightness(1.1); transform: translateY(-1px); }

/* Log session button — larger emphasis */
div[data-testid="stButton"] > button[kind="primary"].btn-log {
  padding: 18px 24px !important;
  font-size: 1.05rem !important;
  box-shadow: 0 6px 30px rgba(124,92,255,0.45) !important;
}

section[data-testid="stSidebar"] {
  background: var(--bg-secondary);
  border-right: 1px solid var(--card-border);
}
.tm-toc-item {
  display: flex; align-items: center; gap: 10px;
  padding: 9px 12px; border-radius: 10px; margin: 2px 0;
  color: var(--text-2); font-size: 0.91rem;
}
.tm-toc-item.active { background: rgba(124,92,255,0.14); color: var(--text-1); font-weight: 600; }
.tm-dot { width: 9px; height: 9px; border-radius: 50%; flex-shrink: 0; border: 1.5px solid var(--text-3); }
.tm-dot.done     { background: var(--success); border-color: var(--success); box-shadow: 0 0 6px rgba(52,211,153,0.5); }
.tm-dot.active   { background: var(--accent);  border-color: var(--accent);  animation: tm-pulse 1.8s infinite; }
.tm-dot.got-it   { background: var(--success); border-color: var(--success); box-shadow: 0 0 6px rgba(52,211,153,0.5); }
.tm-dot.missed   { background: var(--warning); border-color: var(--warning); box-shadow: 0 0 6px rgba(251,191,36,0.4); }
@keyframes tm-pulse { 0%,100%{box-shadow:0 0 6px rgba(124,92,255,0.6);}50%{box-shadow:0 0 14px rgba(124,92,255,0.9);} }

.stTabs [data-baseweb="tab-list"] { gap: 6px; background: transparent; border-bottom: 1px solid var(--card-border); }
.stTabs [data-baseweb="tab"] { background: transparent; color: var(--text-2); border-radius: 10px 10px 0 0; padding: 10px 18px; font-family: 'Space Grotesk'; font-weight: 500; }
.stTabs [aria-selected="true"] { color: var(--text-1) !important; background: rgba(124,92,255,0.10) !important; border-bottom: 2px solid var(--accent) !important; }

.stChatMessage { background: var(--card-bg); border: 1px solid var(--card-border); border-radius: 14px; }

.tm-pill { display:inline-block; padding:6px 14px; border-radius:999px; background:rgba(124,92,255,0.12); color:var(--accent); font-family:'JetBrains Mono'; font-size:0.82rem; margin:3px; border: 1px solid rgba(124,92,255,0.2); }
.tm-diagram { background: var(--code-bg); border: 1px solid var(--card-border); border-radius: 14px; padding: 20px; margin: 14px 0; overflow-x: auto; }

/* Text input / text area dark theming */
div[data-testid="stTextInput"] input,
div[data-testid="stTextArea"] textarea {
  background: #0D0D14 !important;
  border: 1px solid rgba(255,255,255,0.10) !important;
  border-radius: 10px !important;
  color: var(--text-1) !important;
  font-family: 'Inter', sans-serif !important;
}
div[data-testid="stTextInput"] input:focus,
div[data-testid="stTextArea"] textarea:focus {
  border-color: rgba(124,92,255,0.5) !important;
  box-shadow: 0 0 0 2px rgba(124,92,255,0.12) !important;
}
</style>
"""

st.markdown(CSS, unsafe_allow_html=True)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------
LESSON_PATH = Path(__file__).parent.parent / ".teach" / "current_lesson.json"
MEMORY_PATH = Path(__file__).parent.parent / ".teach" / "memory.json"
ARCHIVE_DIR = Path(__file__).parent.parent / ".teach" / "archive"

# ---------------------------------------------------------------------------
# Anthropic client (cached)
# ---------------------------------------------------------------------------
@st.cache_resource
def get_client():
    import os
    key = os.environ.get("ANTHROPIC_API_KEY", "")
    if not key:
        st.warning("Set ANTHROPIC_API_KEY to enable interactive features")
        return None
    return Anthropic(api_key=key)


# ---------------------------------------------------------------------------
# Lesson loading
# ---------------------------------------------------------------------------
def load_lesson() -> dict | None:
    if not LESSON_PATH.exists():
        return None
    try:
        with open(LESSON_PATH, "r", encoding="utf-8") as f:
            return json.load(f)
    except (json.JSONDecodeError, OSError):
        return None


# ---------------------------------------------------------------------------
# Section building
# ---------------------------------------------------------------------------
def build_sections(lesson: dict) -> list[str]:
    # Handle review sessions — just quiz + completion
    if lesson.get("meta", {}).get("is_review_session"):
        return ["quiz", "complete"]

    s = []
    if lesson.get("warm_up"):
        s.append("warm_up")
    s += ["hook", "concept_map"]

    # Insert challenge_attempt BEFORE concepts if challenge is already loaded
    if lesson.get("coding_challenge"):
        s.append("challenge_attempt")

    for i in range(len(lesson.get("core_concepts", []))):
        s.append(f"concept:{i}")
    s += ["insights", "quiz", "challenge", "summary", "complete"]
    return s


def section_label(section: str, lesson: dict) -> str:
    if section == "hook":
        return "Hook"
    if section == "concept_map":
        return "Concept Map"
    if section.startswith("concept:"):
        idx = int(section.split(":")[1])
        concepts = lesson.get("core_concepts", [])
        if idx < len(concepts):
            return concepts[idx].get("title", f"Concept {idx + 1}")
        return f"Concept {idx + 1}"
    labels = {
        "warm_up": "Warm-Up",
        "insights": "Key Insights",
        "quiz": "Quiz",
        "challenge": "Coding Challenge",
        "challenge_attempt": "Challenge Attempt",
        "summary": "Summary",
        "complete": "Complete",
    }
    return labels.get(section, section.title())


# ---------------------------------------------------------------------------
# Session state initialisation
# ---------------------------------------------------------------------------
def init_state(lesson: dict):
    if "lesson_loaded" not in st.session_state:
        st.session_state.lesson_loaded = True
        st.session_state.lesson = lesson
        st.session_state.sections = build_sections(lesson)
        st.session_state.section_idx = 0
        st.session_state.visited = set()
        st.session_state.start_time = time.time()
        # Quiz
        st.session_state.quiz_idx = 0
        st.session_state.quiz_answers = {}
        st.session_state.quiz_revealed = set()
        st.session_state.quiz_score = 0
        # Challenge
        st.session_state.challenge_hints = 0
        st.session_state.challenge_solution = False
        st.session_state.challenge_code = lesson.get("coding_challenge", {}).get("starter_code", "")
        # Warm-up
        st.session_state.warmup_idx = 0
        st.session_state.warmup_scores = {}
        # Chat rail
        st.session_state.chat_messages = []
        # Session log state
        st.session_state.session_logged = False


# ---------------------------------------------------------------------------
# Utility helpers
# ---------------------------------------------------------------------------
def nav_prev():
    if st.session_state.section_idx > 0:
        st.session_state.visited.add(st.session_state.section_idx)
        st.session_state.section_idx -= 1
        st.rerun()


def nav_next():
    sections = st.session_state.sections
    idx = st.session_state.section_idx
    st.session_state.visited.add(idx)
    if idx < len(sections) - 1:
        st.session_state.section_idx = idx + 1
    st.rerun()


def advance_section():
    """Advance to next section without rerun (caller handles rerun)."""
    sections = st.session_state.sections
    idx = st.session_state.section_idx
    st.session_state.visited.add(idx)
    if idx < len(sections) - 1:
        st.session_state.section_idx = idx + 1


def jump_to(idx: int):
    st.session_state.visited.add(st.session_state.section_idx)
    st.session_state.section_idx = idx
    st.rerun()


def render_mermaid(content: str, height: int = 280):
    import streamlit.components.v1 as components
    safe = content.replace("`", "&#96;").replace("\\", "\\\\")
    html = f"""<!DOCTYPE html><html><body style="background:#0D0D14;margin:0;padding:16px;">
    <div id="diagram-container">
      <pre class="mermaid" style="background:transparent;color:#ECECF1">{safe}</pre>
    </div>
    <div id="fallback-container" style="display:none;">
      <div style="color:#F87171;font-family:'JetBrains Mono';font-size:0.8rem;margin-bottom:8px;">
        Diagram unavailable offline — raw source:
      </div>
      <pre style="color:#A0A0B0;font-family:'JetBrains Mono';font-size:0.78rem;white-space:pre-wrap;">{safe}</pre>
    </div>
    <script>
      function showFallback() {{
        document.getElementById('diagram-container').style.display = 'none';
        document.getElementById('fallback-container').style.display = 'block';
      }}
      var script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js';
      script.onerror = function() {{ showFallback(); }};
      script.onload = function() {{
        try {{
          mermaid.initialize({{startOnLoad:true,theme:'dark',darkMode:true,fontFamily:'JetBrains Mono'}});
        }} catch(e) {{ showFallback(); }}
      }};
      document.head.appendChild(script);
      setTimeout(function() {{
        var svg = document.querySelector('#diagram-container svg');
        if (!svg) {{ showFallback(); }}
      }}, 5000);
    </script>
    </body></html>"""
    components.html(html, height=height, scrolling=False)


def render_diagram(diagram: dict | None):
    if not diagram:
        return
    content = diagram.get("content", "")
    dtype = diagram.get("type", "ascii")
    if not content:
        return
    if dtype == "mermaid":
        render_mermaid(content)
    else:
        st.markdown('<div class="tm-diagram">', unsafe_allow_html=True)
        st.code(content, language=None)
        st.markdown("</div>", unsafe_allow_html=True)


def render_nav(prev_ok: bool = True, next_ok: bool = True, next_label: str = "Next →"):
    st.markdown("<br>", unsafe_allow_html=True)
    col1, col2, col3 = st.columns([1, 4, 1])
    with col1:
        if prev_ok and st.session_state.section_idx > 0:
            if st.button("← Back", key=f"nav_prev_{st.session_state.section_idx}"):
                nav_prev()
    with col3:
        if next_ok:
            sections = st.session_state.sections
            idx = st.session_state.section_idx
            if idx < len(sections) - 1:
                if st.button(next_label, key=f"nav_next_{idx}", type="primary"):
                    nav_next()


def reload_lesson():
    """Re-read current_lesson.json and update session state (for progressive loading)."""
    lesson = load_lesson()
    if lesson:
        st.session_state.lesson = lesson
        new_sections = build_sections(lesson)
        # Only extend sections if Phase 2 arrived (more sections available)
        if len(new_sections) > len(st.session_state.sections):
            st.session_state.sections = new_sections


def elapsed_str() -> str:
    secs = int(time.time() - st.session_state.start_time)
    m, s = divmod(secs, 60)
    h, m = divmod(m, 60)
    if h:
        return f"{h}h {m}m"
    return f"{m}m {s}s"


def elapsed_minutes() -> float:
    secs = time.time() - st.session_state.start_time
    return round(secs / 60, 1)


# ---------------------------------------------------------------------------
# Micro-quiz scoring helpers
# ---------------------------------------------------------------------------
def _concept_mq_dot_class(concept_idx: int, lesson: dict) -> str:
    """
    Returns the sidebar dot class for a concept section based on micro-quiz grades.
    - All 'Got it' → 'got-it' (green)
    - Any 'Missed it' → 'missed' (yellow)
    - No answers yet → '' (default gray)
    """
    concepts = lesson.get("core_concepts", [])
    if concept_idx >= len(concepts):
        return ""
    micro_quiz = concepts[concept_idx].get("micro_quiz", [])
    if not micro_quiz:
        return ""

    any_scored = False
    any_missed = False
    all_got = True

    for q_idx in range(len(micro_quiz)):
        score_key = f"mq_score_{concept_idx}_{q_idx}"
        val = st.session_state.get(score_key)
        if val is None:
            all_got = False
        else:
            any_scored = True
            if val == 0:
                any_missed = True
                all_got = False

    if not any_scored:
        return ""
    if any_missed:
        return "missed"
    if all_got:
        return "got-it"
    return ""


# ---------------------------------------------------------------------------
# Session logging
# ---------------------------------------------------------------------------
def log_session_to_disk(lesson: dict, debrief_phrase: str, quiz_score_input: str, time_spent_minutes: float) -> int:
    """Write completed session to memory.json and archive the lesson. Returns new streak."""
    ARCHIVE_DIR.mkdir(exist_ok=True)

    try:
        with open(MEMORY_PATH) as f:
            memory = json.load(f)
    except (OSError, json.JSONDecodeError):
        memory = {"completed": [], "streak": 0, "weak_areas": [], "last_session_date": None, "in_progress": None}

    slug = lesson.get("meta", {}).get("slug", "unknown")
    title = lesson.get("meta", {}).get("title", "Unknown")
    today = datetime.now().strftime("%Y-%m-%d")

    # Parse quiz score
    quiz_score_pct = None
    if quiz_score_input and quiz_score_input.strip().lower() != "skipped":
        try:
            parts = quiz_score_input.strip().split("/")
            quiz_score_pct = float(parts[0]) / float(parts[1])
        except Exception:
            pass

    # Compute next_review_date
    if quiz_score_pct is None:
        days = 7
    elif quiz_score_pct >= 0.8:
        days = 14
    elif quiz_score_pct >= 0.6:
        days = 7
    else:
        days = 2
    next_review = (datetime.now() + timedelta(days=days)).strftime("%Y-%m-%d")

    entry = {
        "slug": slug,
        "title": title,
        "date": today,
        "quiz_score_pct": quiz_score_pct,
        "time_spent_minutes": time_spent_minutes,
        "weak_areas": [debrief_phrase] if debrief_phrase else [],
        "notes": "",
        "next_review_date": next_review,
    }

    # Avoid double-logging
    existing_slugs = [c.get("slug", "") for c in memory.get("completed", [])]
    if slug not in existing_slugs:
        memory.setdefault("completed", []).append(entry)

    # Update streak
    last = memory.get("last_session_date")
    yesterday = (datetime.now() - timedelta(days=1)).strftime("%Y-%m-%d")
    if last == yesterday:
        memory["streak"] = memory.get("streak", 0) + 1
    elif last == today:
        pass  # same day, keep streak
    else:
        memory["streak"] = 1
    memory["last_session_date"] = today
    memory["in_progress"] = None

    # Update global weak_areas (structured format)
    if debrief_phrase:
        weak_areas = memory.get("weak_areas", [])
        normalized = []
        for w in weak_areas:
            if isinstance(w, str):
                normalized.append({"phrase": w, "flagged_date": None, "reinforced_count": 0, "retired": False, "source_slug": None})
            else:
                normalized.append(w)
        existing_phrases = [w["phrase"] for w in normalized if not w.get("retired", False)]
        if debrief_phrase not in existing_phrases:
            normalized.append({"phrase": debrief_phrase, "flagged_date": today, "reinforced_count": 0, "retired": False, "source_slug": slug})
        memory["weak_areas"] = normalized

    with open(MEMORY_PATH, "w") as f:
        json.dump(memory, f, indent=2)

    # Archive lesson
    archive_path = ARCHIVE_DIR / f"{slug}.json"
    if LESSON_PATH.exists():
        shutil.copy(LESSON_PATH, archive_path)

    return memory.get("streak", 1)


def log_review_session_to_disk(lesson: dict, quiz_score_input: str) -> None:
    """For review sessions: update next_review_date on existing completed entry only."""
    try:
        with open(MEMORY_PATH) as f:
            memory = json.load(f)
    except (OSError, json.JSONDecodeError):
        return

    slug = lesson.get("meta", {}).get("slug", "unknown")
    today = datetime.now().strftime("%Y-%m-%d")

    quiz_score_pct = None
    if quiz_score_input and quiz_score_input.strip().lower() != "skipped":
        try:
            parts = quiz_score_input.strip().split("/")
            quiz_score_pct = float(parts[0]) / float(parts[1])
        except Exception:
            pass

    if quiz_score_pct is None:
        days = 7
    elif quiz_score_pct >= 0.8:
        days = 21
    elif quiz_score_pct >= 0.6:
        days = 14
    else:
        days = 7
    next_review = (datetime.now() + timedelta(days=days)).strftime("%Y-%m-%d")

    for entry in memory.get("completed", []):
        if entry.get("slug") == slug:
            entry["next_review_date"] = next_review
            break

    with open(MEMORY_PATH, "w") as f:
        json.dump(memory, f, indent=2)


def _days_until_review(quiz_score_input: str) -> int:
    """Return number of days until next review based on score string."""
    if not quiz_score_input or quiz_score_input.strip().lower() == "skipped":
        return 7
    try:
        parts = quiz_score_input.strip().split("/")
        pct = float(parts[0]) / float(parts[1])
    except Exception:
        return 7
    if pct >= 0.8:
        return 14
    if pct >= 0.6:
        return 7
    return 2


# ---------------------------------------------------------------------------
# Progress bar
# ---------------------------------------------------------------------------
def render_top_progress():
    sections = st.session_state.sections
    total = len([s for s in sections if s != "complete"])
    idx = st.session_state.section_idx
    pct = min(int(idx / max(total, 1) * 100), 100)
    st.markdown(
        f'<div class="tm-progress-wrap"><div class="tm-progress-fill" style="width:{pct}%"></div></div>',
        unsafe_allow_html=True,
    )


# ---------------------------------------------------------------------------
# Sidebar
# ---------------------------------------------------------------------------
def render_sidebar():
    lesson = st.session_state.lesson
    meta = lesson.get("meta", {})
    sections = st.session_state.sections
    current_idx = st.session_state.section_idx
    is_review = meta.get("is_review_session", False)

    with st.sidebar:
        # Title block
        diff = meta.get("difficulty", "intermediate")
        diff_color = {"intermediate": "#7C5CFF", "advanced": "#FBBF24", "expert": "#F87171"}.get(diff, "#7C5CFF")

        # Use distinct header for review sessions
        if is_review:
            sidebar_title = "Review Session"
            sidebar_subtitle = meta.get("title", "")
        else:
            sidebar_title = meta.get("title", "Today's Lesson")
            sidebar_subtitle = ""

        st.markdown(
            f"""
            <div style="padding:16px 4px 8px 4px;">
              <div style="font-family:'Space Grotesk';font-weight:700;font-size:1.05rem;
                          color:#ECECF1;line-height:1.3;margin-bottom:10px;">
                {sidebar_title}
              </div>
              {"<div style='font-size:0.80rem;color:#A0A0B0;margin-bottom:8px;line-height:1.4;'>" + sidebar_subtitle + "</div>" if sidebar_subtitle else ""}
              <span style="font-family:'JetBrains Mono';font-size:0.68rem;font-weight:700;
                           text-transform:uppercase;letter-spacing:0.08em;
                           color:{diff_color};background:rgba(124,92,255,0.12);
                           padding:4px 10px;border-radius:999px;border:1px solid {diff_color}44;">
                {"review" if is_review else diff}
              </span>
              <span style="font-family:'Inter';font-size:0.8rem;color:#6B6B7B;margin-left:10px;">
                ~{meta.get("estimated_minutes", "?")} min
              </span>
            </div>
            """,
            unsafe_allow_html=True,
        )

        st.markdown(
            '<hr style="border:none;border-top:1px solid rgba(255,255,255,0.06);margin:6px 0 10px 0;">',
            unsafe_allow_html=True,
        )

        # TOC items
        for i, section in enumerate(sections):
            if section == "complete":
                continue
            label = section_label(section, lesson)
            is_active = i == current_idx
            is_done = i in st.session_state.visited

            # Determine dot class — concept sections get micro-quiz performance color
            if section.startswith("concept:"):
                concept_idx = int(section.split(":")[1])
                mq_dot = _concept_mq_dot_class(concept_idx, lesson)
                if mq_dot:
                    dot_class = mq_dot
                elif is_active:
                    dot_class = "active"
                elif is_done:
                    dot_class = "done"
                else:
                    dot_class = ""
            else:
                dot_class = "active" if is_active else ("done" if is_done else "")

            item_class = "active" if is_active else ""

            st.markdown(
                f"""
                <div class="tm-toc-item {item_class}" style="cursor:pointer;">
                  <div class="tm-dot {dot_class}"></div>
                  <span>{label}</span>
                </div>
                """,
                unsafe_allow_html=True,
            )
            # Invisible button for click navigation
            if st.button(label, key=f"toc_{i}", help=f"Jump to {label}"):
                jump_to(i)

        st.markdown(
            '<hr style="border:none;border-top:1px solid rgba(255,255,255,0.06);margin:10px 0 6px 0;">',
            unsafe_allow_html=True,
        )

        # Bottom stats
        quiz_total = len(lesson.get("quiz", []))
        quiz_score = st.session_state.quiz_score
        st.markdown(
            f"""
            <div style="padding:6px 4px;font-size:0.82rem;color:#6B6B7B;font-family:'Inter';">
              <div style="display:flex;justify-content:space-between;margin-bottom:4px;">
                <span>Elapsed</span><span style="color:#A0A0B0;">{elapsed_str()}</span>
              </div>
              <div style="display:flex;justify-content:space-between;">
                <span>Quiz</span><span style="color:#34D399;">{quiz_score}/{quiz_total}</span>
              </div>
            </div>
            """,
            unsafe_allow_html=True,
        )


# ---------------------------------------------------------------------------
# Section renderers
# ---------------------------------------------------------------------------

def render_hook():
    lesson = st.session_state.lesson
    hook = lesson.get("hook", {})

    st.markdown('<span class="tm-badge hook">◉ Hook</span>', unsafe_allow_html=True)
    st.markdown(f"# {lesson.get('meta', {}).get('title', 'Today\'s Lesson')}")

    st.markdown('<div class="tm-card">', unsafe_allow_html=True)
    st.markdown(f"**{hook.get('problem', '')}**")
    st.markdown(hook.get("narrative", ""))
    st.markdown("</div>", unsafe_allow_html=True)

    why = hook.get("why_it_matters", "")
    if why:
        st.markdown(
            f"""<div class="tm-callout insight">
              <span class="tm-callout-title">Why This Matters</span>
              {why}
            </div>""",
            unsafe_allow_html=True,
        )

    meta = lesson.get("meta", {})
    prereqs = meta.get("prerequisites", [])
    concepts = meta.get("concepts", [])
    if prereqs or concepts:
        cols = st.columns(2)
        with cols[0]:
            if prereqs:
                st.markdown("**Prerequisites**")
                for p in prereqs:
                    st.markdown(f"- {p}")
        with cols[1]:
            if concepts:
                st.markdown("**You'll Learn**")
                for c in concepts:
                    st.markdown(f"- {c}")

    render_nav(prev_ok=False)


def render_warm_up():
    lesson = st.session_state.lesson
    questions = lesson.get("warm_up", [])

    st.markdown('<span class="tm-badge deepdive">Warm-Up</span>', unsafe_allow_html=True)
    st.markdown("## Weak Area Warm-Up")
    st.markdown(
        '<div class="tm-callout gotcha"><span class="tm-callout-title">Targeting your weak areas</span>'
        'These questions reinforce gaps flagged in past sessions before you start today\'s new content.</div>',
        unsafe_allow_html=True,
    )

    if not questions:
        render_nav(prev_ok=False)
        return

    total = len(questions)
    w_idx = st.session_state.get("warmup_idx", 0)
    warmup_scores = st.session_state.get("warmup_scores", {})

    # Progress bar
    answered = len(warmup_scores)
    st.markdown(
        f"""<div style="display:flex;align-items:center;gap:12px;margin-bottom:20px;">
          <div style="flex:1;height:3px;background:rgba(255,255,255,0.06);border-radius:99px;overflow:hidden;">
            <div style="width:{int(answered/total*100)}%;height:100%;
                        background:linear-gradient(90deg,#F87171,#FBBF24);"></div>
          </div>
          <span style="font-family:'JetBrains Mono';font-size:0.78rem;color:#6B6B7B;white-space:nowrap;">
            {answered}/{total}
          </span>
        </div>""",
        unsafe_allow_html=True,
    )

    if w_idx >= total:
        strongs = sum(1 for v in warmup_scores.values() if v == "strong")
        st.markdown(
            f"""<div class="tm-card" style="text-align:center;">
              <div style="font-size:1.1rem;font-family:'Space Grotesk';font-weight:600;color:#ECECF1;margin-bottom:12px;">Warm-Up Complete!</div>
              <div style="color:#34D399;font-family:'JetBrains Mono';font-size:1.4rem;font-weight:700;">{strongs}/{total} Strong</div>
            </div>""",
            unsafe_allow_html=True,
        )
        render_nav(prev_ok=False)
        return

    q = questions[w_idx]
    graded = w_idx in warmup_scores
    weak_area = q.get("target_weak_area", "")

    if weak_area:
        st.markdown(
            f'<div style="font-family:\'JetBrains Mono\';font-size:0.72rem;color:#F87171;'
            f'background:rgba(248,113,113,0.08);padding:4px 10px;border-radius:6px;'
            f'display:inline-block;margin-bottom:12px;">targeting: {weak_area}</div>',
            unsafe_allow_html=True,
        )

    st.markdown('<div class="tm-card">', unsafe_allow_html=True)
    st.markdown(f"**{q.get('question', '')}**")
    st.markdown("</div>", unsafe_allow_html=True)

    chat_key = f"warmup_chat_{w_idx}"
    if chat_key not in st.session_state:
        st.session_state[chat_key] = []
    chat_history = st.session_state[chat_key]

    for msg in chat_history:
        with st.chat_message(msg["role"]):
            st.markdown(msg["content"])

    if not graded:
        user_input = st.chat_input("Answer...", key=f"warmup_input_{w_idx}")
        if user_input:
            chat_history.append({"role": "user", "content": user_input})
            client = get_client()
            if client:
                expected_points = q.get("expected_points", [])
                points_text = "\n".join(f"- {p}" for p in expected_points)
                system_prompt = f"""You are grading an AI systems engineering answer.

Question: {q.get('question', '')}
Expected points:
{points_text}

Grade as "strong", "partial", or "weak".
Start with: "**Grade: [strong/partial/weak]**"
Then 2-3 sentences of direct peer-level feedback."""
                with st.chat_message("assistant"):
                    full_response = ""
                    ph = st.empty()
                    with client.messages.stream(
                        model="claude-haiku-4-5",
                        max_tokens=400,
                        system=system_prompt,
                        messages=[{"role": "user", "content": user_input}],
                    ) as stream:
                        for text in stream.text_stream:
                            full_response += text
                            ph.markdown(full_response + "▌")
                    ph.markdown(full_response)
                chat_history.append({"role": "assistant", "content": full_response})
                grade = "partial"
                if "grade: strong" in full_response.lower():
                    grade = "strong"
                elif "grade: weak" in full_response.lower():
                    grade = "weak"
                if "warmup_scores" not in st.session_state:
                    st.session_state.warmup_scores = {}
                st.session_state.warmup_scores[w_idx] = grade
                st.rerun()
    else:
        grade = warmup_scores.get(w_idx, "partial")
        color = {"strong": "#34D399", "partial": "#FBBF24", "weak": "#F87171"}.get(grade, "#FBBF24")
        st.markdown(
            f'<div style="background:rgba(255,255,255,0.04);border:1px solid {color}44;'
            f'border-radius:12px;padding:10px 16px;margin:8px 0;">'
            f'<span style="color:{color};font-family:\'JetBrains Mono\';font-size:0.78rem;'
            f'font-weight:700;text-transform:uppercase;">Grade: {grade}</span></div>',
            unsafe_allow_html=True,
        )
        follow_up = q.get("follow_up")
        if follow_up and grade == "strong":
            st.markdown(
                f'<div class="tm-callout"><span class="tm-callout-title">Follow-up</span>{follow_up}</div>',
                unsafe_allow_html=True,
            )
        if w_idx < total - 1:
            if st.button("Next →", key=f"warmup_next_{w_idx}", type="primary", use_container_width=True):
                st.session_state.warmup_idx = w_idx + 1
                st.rerun()
        else:
            if st.button("Start Lesson →", key="warmup_done", type="primary", use_container_width=True):
                st.session_state.warmup_idx = total
                st.rerun()

    all_done = len(st.session_state.get("warmup_scores", {})) >= total
    render_nav(prev_ok=False, next_ok=all_done)


def render_concept_map():
    lesson = st.session_state.lesson
    cm = lesson.get("concept_map", {})

    st.markdown('<span class="tm-badge concept">◈ Concept Map</span>', unsafe_allow_html=True)
    st.markdown("## Concept Map")

    summary = cm.get("summary", "")
    if summary:
        st.markdown('<div class="tm-card">', unsafe_allow_html=True)
        st.markdown(summary)
        st.markdown("</div>", unsafe_allow_html=True)

    fits_with = cm.get("fits_with", [])
    if fits_with:
        st.markdown("### Related Topics")
        for item in fits_with:
            topic = item.get("topic", "")
            relation = item.get("relation", "")
            st.markdown(
                f"""<div class="tm-callout">
                  <span class="tm-callout-title">{topic}</span>
                  {relation}
                </div>""",
                unsafe_allow_html=True,
            )

    diagram = cm.get("diagram")
    if diagram:
        st.markdown("### Diagram")
        render_diagram(diagram)

    render_nav()


def render_challenge_attempt():
    """
    Show the challenge upfront so learners attempt before reading theory.
    Pedagogical framing: productive failure — getting stuck primes understanding.
    """
    lesson = st.session_state.lesson
    challenge = lesson.get("coding_challenge", {})
    if not challenge:
        advance_section()
        st.rerun()
        return

    st.markdown('<span class="tm-badge challenge">Try First</span>', unsafe_allow_html=True)
    st.markdown(f"## {challenge.get('title', 'The Challenge')}")

    # Pedagogical framing — intentional, not rushed
    st.markdown(
        """<div class="tm-callout neutral" style="border-left-color:#7C5CFF;background:linear-gradient(90deg,rgba(124,92,255,0.08),transparent);">
          <span class="tm-callout-title" style="color:#C4B5FD;">Productive failure — attempt before the theory</span>
          <span style="color:#A0A0B0;font-size:0.95rem;">
            Struggling with a problem before seeing the solution is one of the most effective ways to learn.
            Write rough pseudocode, sketch your approach, note where you get stuck. Getting it wrong is the point —
            the theory coming up will hit harder because of it. No pressure to get it right.
          </span>
        </div>""",
        unsafe_allow_html=True,
    )

    # Challenge prompt
    st.markdown('<div class="tm-card">', unsafe_allow_html=True)
    st.markdown(challenge.get("prompt", ""))
    st.markdown("</div>", unsafe_allow_html=True)

    # Starter code — styled consistently with the rest of the design system
    if challenge.get("starter_code"):
        st.markdown(
            '<div style="font-family:\'JetBrains Mono\';font-size:0.75rem;color:#6B6B7B;'
            'margin-bottom:4px;margin-top:8px;">starter_code.py</div>',
            unsafe_allow_html=True,
        )
        st.code(challenge["starter_code"], language="python")

    # Attempt area — dark themed via CSS class on the container
    st.markdown('<div class="tm-attempt-area">', unsafe_allow_html=True)
    st.text_area(
        "Your attempt",
        height=220,
        key="challenge_attempt_notes",
        placeholder="Sketch your approach here — pseudocode, notes, or partial code. No grade, just priming.",
        label_visibility="collapsed",
    )
    st.markdown("</div>", unsafe_allow_html=True)

    st.markdown(
        '<div style="color:#6B6B7B;font-size:0.82rem;margin-top:-8px;margin-bottom:20px;">'
        'Your notes are session-only and not saved anywhere.'
        '</div>',
        unsafe_allow_html=True,
    )

    if st.button(
        "Done attempting — show me the theory",
        type="primary",
        key="btn_challenge_attempt",
        use_container_width=True,
    ):
        advance_section()
        st.rerun()


def render_core_concept(idx: int):
    lesson = st.session_state.lesson
    concepts = lesson.get("core_concepts", [])
    if idx >= len(concepts):
        st.warning("Concept not found.")
        render_nav()
        return

    concept = concepts[idx]
    total = len(concepts)
    st.session_state.concept_idx = idx

    st.markdown(
        f'<span class="tm-badge concept">◈ Concept {idx + 1}/{total}</span>',
        unsafe_allow_html=True,
    )
    st.markdown(f"## {concept.get('title', '')}")

    explanation = concept.get("explanation", "")
    if explanation:
        st.markdown('<div class="tm-card">', unsafe_allow_html=True)
        st.markdown(explanation)
        st.markdown("</div>", unsafe_allow_html=True)

    analogy = concept.get("analogy", "")
    if analogy:
        st.markdown(
            f"""<div class="tm-callout tip">
              <span class="tm-callout-title">Analogy</span>
              {analogy}
            </div>""",
            unsafe_allow_html=True,
        )

    diagram = concept.get("diagram")
    if diagram:
        render_diagram(diagram)

    code_examples = concept.get("code_examples", [])
    if code_examples:
        st.markdown("### Code Examples")
        for ex in code_examples:
            filename = ex.get("filename")
            lang = ex.get("language", "python")
            code = ex.get("code", "")
            line_by_line = ex.get("line_by_line", [])

            if filename:
                st.markdown(
                    f'<div style="font-family:\'JetBrains Mono\';font-size:0.78rem;color:#6B6B7B;'
                    f'margin-bottom:4px;">📄 {filename}</div>',
                    unsafe_allow_html=True,
                )
            st.code(code, language=lang)

            if line_by_line:
                with st.expander("Line-by-line breakdown"):
                    for entry in line_by_line:
                        lines = entry.get("lines", "")
                        expl = entry.get("explanation", "")
                        st.markdown(
                            f"""<div style="display:flex;gap:12px;margin-bottom:10px;">
                              <code style="flex-shrink:0;font-size:0.78rem;color:#7C5CFF;
                                           background:rgba(124,92,255,0.1);padding:3px 8px;
                                           border-radius:6px;white-space:nowrap;">
                                L{lines}
                              </code>
                              <span style="color:#A0A0B0;font-size:0.9rem;">{expl}</span>
                            </div>""",
                            unsafe_allow_html=True,
                        )

    # --- Micro-quiz ---
    micro_quiz = concept.get("micro_quiz", [])
    if micro_quiz:
        # Visual separator between content and quiz
        st.markdown('<hr class="tm-mq-divider">', unsafe_allow_html=True)
        st.markdown('<span class="tm-mq-badge">✦ Quick check</span>', unsafe_allow_html=True)

        for i, mq in enumerate(micro_quiz):
            mq_key = f"mq_{idx}_{i}"
            revealed_key = f"mq_revealed_{idx}_{i}"
            score_key = f"mq_score_{idx}_{i}"

            # Question — visually distinct and readable
            st.markdown(
                f'<div style="color:#ECECF1;font-size:1.0rem;font-weight:500;'
                f'line-height:1.6;margin-bottom:10px;">{mq["question"]}</div>',
                unsafe_allow_html=True,
            )

            if not st.session_state.get(revealed_key, False):
                # Subtle reveal button — secondary style
                reveal_col, _ = st.columns([2, 5])
                with reveal_col:
                    if st.button(
                        "Reveal answer",
                        key=f"btn_reveal_{mq_key}",
                        help="Show the answer when you're ready",
                    ):
                        st.session_state[revealed_key] = True
                        st.rerun()
            else:
                st.markdown(
                    f'<div class="tm-callout tip"><span class="tm-callout-title">Answer</span>{mq["answer"]}</div>',
                    unsafe_allow_html=True,
                )
                if mq.get("explanation"):
                    st.markdown(
                        f'<div class="tm-callout insight"><span class="tm-callout-title">Why it matters</span>{mq["explanation"]}</div>',
                        unsafe_allow_html=True,
                    )

                if score_key not in st.session_state:
                    grade_col1, grade_col2, _ = st.columns([2, 2, 3])
                    with grade_col1:
                        if st.button(
                            "Got it",
                            key=f"btn_got_{mq_key}",
                            help="I understood this",
                            use_container_width=True,
                        ):
                            st.session_state[score_key] = 1
                            st.rerun()
                    with grade_col2:
                        if st.button(
                            "Missed it",
                            key=f"btn_miss_{mq_key}",
                            help="I need more practice on this",
                            use_container_width=True,
                        ):
                            st.session_state[score_key] = 0
                            st.rerun()
                else:
                    score = st.session_state[score_key]
                    if score == 1:
                        st.markdown(
                            '<div style="display:inline-flex;align-items:center;gap:6px;'
                            'color:#34D399;font-size:0.85rem;font-family:\'JetBrains Mono\';">'
                            '<span style="width:8px;height:8px;border-radius:50%;'
                            'background:#34D399;display:inline-block;"></span>'
                            'Got it</div>',
                            unsafe_allow_html=True,
                        )
                    else:
                        st.markdown(
                            '<div style="display:inline-flex;align-items:center;gap:6px;'
                            'color:#FBBF24;font-size:0.85rem;font-family:\'JetBrains Mono\';">'
                            '<span style="width:8px;height:8px;border-radius:50%;'
                            'background:#FBBF24;display:inline-block;"></span>'
                            'Missed it — flagged for later</div>',
                            unsafe_allow_html=True,
                        )

            # Small gap between multiple micro-quiz questions
            if i < len(micro_quiz) - 1:
                st.markdown("<div style='height:16px;'></div>", unsafe_allow_html=True)

    render_nav()


def render_insights():
    lesson = st.session_state.lesson
    status = lesson.get("_generation_status", "complete")
    if status != "complete" and not lesson.get("key_insights"):
        st.markdown('<span class="tm-badge deepdive">Generating...</span>', unsafe_allow_html=True)
        st.markdown("## Still Generating")
        st.markdown(
            '<div class="tm-callout insight"><span class="tm-callout-title">Quiz & assessments are generating in the background</span>'
            'Core concepts are ready above. Come back to this section in ~2 minutes.</div>',
            unsafe_allow_html=True,
        )
        if st.button("Check Now", key="refresh_btn_key_insights", type="primary"):
            reload_lesson()
            st.rerun()
        return
    insights = lesson.get("key_insights", [])

    st.markdown('<span class="tm-badge deepdive">★ Key Insights</span>', unsafe_allow_html=True)
    st.markdown("## Key Insights")

    if not insights:
        st.info("No insights in this lesson.")
    else:
        for item in insights:
            kind = item.get("kind", "insight")
            title = item.get("title", "")
            text = item.get("text", "")
            icon = {"insight": "💡", "gotcha": "⚠️", "tip": "✅"}.get(kind, "💡")
            title_html = f'<span class="tm-callout-title">{icon} {title}</span>' if title else ""
            st.markdown(
                f"""<div class="tm-callout {kind}">
                  {title_html}
                  {text}
                </div>""",
                unsafe_allow_html=True,
            )

    render_nav()


def render_quiz():
    lesson = st.session_state.lesson
    meta = lesson.get("meta", {})
    is_review = meta.get("is_review_session", False)
    status = lesson.get("_generation_status", "complete")

    if status != "complete" and not lesson.get("quiz"):
        st.markdown('<span class="tm-badge deepdive">Generating...</span>', unsafe_allow_html=True)
        st.markdown("## Still Generating")
        st.markdown(
            '<div class="tm-callout insight"><span class="tm-callout-title">Quiz & assessments are generating in the background</span>'
            'Core concepts are ready above. Come back to this section in ~2 minutes.</div>',
            unsafe_allow_html=True,
        )
        if st.button("Check Now", key="refresh_btn_quiz", type="primary"):
            reload_lesson()
            st.rerun()
        return
    questions = lesson.get("quiz", [])

    # Review sessions get a distinct header
    if is_review:
        original_title = meta.get("title", "")
        st.markdown('<span class="tm-badge review">Review</span>', unsafe_allow_html=True)
        st.markdown(f"## Recall Quiz")
        if original_title:
            st.markdown(
                f'<div style="color:#A0A0B0;font-size:0.95rem;margin-top:-12px;margin-bottom:20px;">'
                f'{original_title}</div>',
                unsafe_allow_html=True,
            )
    else:
        st.markdown('<span class="tm-badge quiz">✦ Quiz</span>', unsafe_allow_html=True)
        st.markdown("## Knowledge Check")

    if not questions:
        st.info("No quiz questions in this lesson.")
        render_nav()
        return

    total_q = len(questions)
    q_idx = st.session_state.quiz_idx

    # Progress indicator
    answered = len(st.session_state.quiz_revealed)
    st.markdown(
        f"""<div style="display:flex;align-items:center;gap:12px;margin-bottom:20px;">
          <div style="flex:1;height:3px;background:rgba(255,255,255,0.06);border-radius:99px;overflow:hidden;">
            <div style="width:{int(answered/total_q*100)}%;height:100%;
                        background:linear-gradient(90deg,#34D399,#00D4FF);"></div>
          </div>
          <span style="font-family:'JetBrains Mono';font-size:0.78rem;color:#6B6B7B;white-space:nowrap;">
            {answered}/{total_q}
          </span>
        </div>""",
        unsafe_allow_html=True,
    )

    if q_idx >= total_q:
        # All done summary
        score = st.session_state.quiz_score
        st.markdown(
            f"""<div class="tm-card" style="text-align:center;">
              <div style="font-family:'Space Grotesk';font-size:3rem;font-weight:700;
                          background:linear-gradient(135deg,#7C5CFF,#00D4FF);
                          -webkit-background-clip:text;-webkit-text-fill-color:transparent;">
                {score}/{total_q}
              </div>
              <div style="color:#A0A0B0;margin-top:8px;">Quiz Complete!</div>
            </div>""",
            unsafe_allow_html=True,
        )
        render_nav(next_ok=True)
        return

    q = questions[q_idx]
    qid = q.get("id", q_idx)
    qtype = q.get("type", "multiple_choice")
    revealed = qid in st.session_state.quiz_revealed

    st.markdown('<div class="tm-card">', unsafe_allow_html=True)
    st.markdown(
        f"""<div style="display:flex;align-items:center;gap:10px;margin-bottom:16px;">
          <span style="font-family:'JetBrains Mono';font-size:0.72rem;color:#6B6B7B;">
            Q{q_idx + 1} of {total_q}
          </span>
          <span style="font-family:'JetBrains Mono';font-size:0.68rem;text-transform:uppercase;
                       color:#7C5CFF;background:rgba(124,92,255,0.12);padding:2px 8px;border-radius:6px;">
            {qtype.replace("_", " ")}
          </span>
        </div>""",
        unsafe_allow_html=True,
    )

    code = q.get("code")
    if code:
        st.code(code, language="python")

    st.markdown(f"**{q.get('question', '')}**")
    st.markdown("</div>", unsafe_allow_html=True)

    correct_answer = str(q.get("answer", "")).strip().lower()
    accepted = [str(a).strip().lower() for a in (q.get("accepted_answers") or [correct_answer])]
    user_answer = st.session_state.quiz_answers.get(qid)

    if qtype in ("multiple_choice", "true_false", "code_reading"):
        options = q.get("options") or (["True", "False"] if qtype == "true_false" else [])
        if not revealed:
            for opt in options:
                if st.button(opt, key=f"quiz_opt_{qid}_{opt}", use_container_width=True):
                    st.session_state.quiz_answers[qid] = opt
                    st.session_state.quiz_revealed.add(qid)
                    if opt.strip().lower() in accepted:
                        st.session_state.quiz_score += 1
                    st.rerun()
        else:
            # Show styled result
            for opt in options:
                opt_lower = opt.strip().lower()
                is_correct = opt_lower in accepted
                is_selected = user_answer == opt
                if is_correct:
                    bg = "rgba(52,211,153,0.12)"
                    border = "#34D399"
                    label_color = "#34D399"
                    icon = "✓"
                elif is_selected and not is_correct:
                    bg = "rgba(248,113,113,0.12)"
                    border = "#F87171"
                    label_color = "#F87171"
                    icon = "✗"
                else:
                    bg = "rgba(255,255,255,0.03)"
                    border = "rgba(255,255,255,0.08)"
                    label_color = "#6B6B7B"
                    icon = " "
                st.markdown(
                    f"""<div style="background:{bg};border:1px solid {border};border-radius:12px;
                                    padding:12px 16px;margin-bottom:6px;display:flex;align-items:center;gap:10px;">
                          <span style="color:{label_color};font-weight:700;width:16px;">{icon}</span>
                          <span style="color:{label_color if is_correct or is_selected else '#A0A0B0'};">{opt}</span>
                        </div>""",
                    unsafe_allow_html=True,
                )

    elif qtype == "fill_in_blank":
        if not revealed:
            fill_val = st.text_input(
                "Your answer:",
                key=f"quiz_fill_{qid}",
                placeholder="Type your answer here...",
            )
            if st.button("Submit Answer", key=f"quiz_submit_{qid}", type="primary", use_container_width=True):
                if fill_val.strip():
                    st.session_state.quiz_answers[qid] = fill_val.strip()
                    st.session_state.quiz_revealed.add(qid)
                    if fill_val.strip().lower() in accepted:
                        st.session_state.quiz_score += 1
                    st.rerun()
        else:
            is_correct = str(user_answer or "").strip().lower() in accepted
            color = "#34D399" if is_correct else "#F87171"
            icon = "✓" if is_correct else "✗"
            st.markdown(
                f"""<div style="background:rgba(255,255,255,0.04);border:1px solid {color};
                                border-radius:12px;padding:12px 16px;margin-bottom:8px;">
                      <span style="color:{color};font-weight:700;">{icon}</span>
                      <span style="color:#A0A0B0;margin-left:8px;">Your answer: </span>
                      <span style="color:{color};">{user_answer}</span>
                    </div>""",
                unsafe_allow_html=True,
            )
            if not is_correct:
                st.markdown(
                    f"""<div style="background:rgba(52,211,153,0.08);border:1px solid #34D399;
                                    border-radius:12px;padding:12px 16px;margin-bottom:8px;">
                          <span style="color:#34D399;">Correct: {q.get('answer', '')}</span>
                        </div>""",
                    unsafe_allow_html=True,
                )

    # Explanation callout (after reveal)
    if revealed:
        explanation = q.get("explanation", "")
        if explanation:
            st.markdown(
                f"""<div class="tm-callout tip">
                  <span class="tm-callout-title">Explanation</span>
                  {explanation}
                </div>""",
                unsafe_allow_html=True,
            )

        # Next question button
        if q_idx < total_q - 1:
            if st.button("Next Question →", key=f"quiz_next_{qid}", type="primary", use_container_width=True):
                st.session_state.quiz_idx += 1
                st.rerun()
        else:
            if st.button("Finish Quiz →", key=f"quiz_finish_{qid}", type="primary", use_container_width=True):
                st.session_state.quiz_idx = total_q
                st.rerun()

    # Section nav — only enabled when all questions revealed
    all_answered = len(st.session_state.quiz_revealed) >= total_q
    render_nav(next_ok=all_answered, next_label="Next Section →")


def render_challenge():
    lesson = st.session_state.lesson
    status = lesson.get("_generation_status", "complete")
    if status != "complete" and not lesson.get("coding_challenge"):
        st.markdown('<span class="tm-badge deepdive">Generating...</span>', unsafe_allow_html=True)
        st.markdown("## Still Generating")
        st.markdown(
            '<div class="tm-callout insight"><span class="tm-callout-title">Quiz & assessments are generating in the background</span>'
            'Core concepts are ready above. Come back to this section in ~2 minutes.</div>',
            unsafe_allow_html=True,
        )
        if st.button("Check Now", key="refresh_btn_coding_challenge", type="primary"):
            reload_lesson()
            st.rerun()
        return
    challenge = lesson.get("coding_challenge", {})

    st.markdown('<span class="tm-badge challenge">⚡ Challenge</span>', unsafe_allow_html=True)
    st.markdown(f"## {challenge.get('title', 'Coding Challenge')}")

    prompt = challenge.get("prompt", "")
    if prompt:
        st.markdown('<div class="tm-card">', unsafe_allow_html=True)
        st.markdown(prompt)
        st.markdown("</div>", unsafe_allow_html=True)

    reqs = challenge.get("requirements", [])
    if reqs:
        st.markdown("**Requirements**")
        for r in reqs:
            st.markdown(f"- {r}")

    starter = challenge.get("starter_code", "")
    if starter:
        st.markdown(
            '<div style="font-family:\'JetBrains Mono\';font-size:0.75rem;color:#6B6B7B;margin-bottom:4px;">starter_code.py</div>',
            unsafe_allow_html=True,
        )
        st.code(starter, language="python")

    # Hints
    hints = challenge.get("hints", [])
    n_hints = st.session_state.challenge_hints
    if hints:
        st.markdown("---")
        if n_hints > 0:
            st.markdown("**Hints unlocked:**")
            for i in range(min(n_hints, len(hints))):
                st.markdown(
                    f"""<div class="tm-callout tip">
                      <span class="tm-callout-title">Hint {i + 1}</span>
                      {hints[i]}
                    </div>""",
                    unsafe_allow_html=True,
                )
        if n_hints < len(hints):
            if st.button(f"Reveal Hint {n_hints + 1}", key="challenge_hint"):
                st.session_state.challenge_hints += 1
                st.rerun()

    # Solution toggle
    solution = challenge.get("solution", "")
    if solution:
        if st.session_state.challenge_solution:
            st.markdown("**Solution**")
            st.code(solution, language="python")
        else:
            if st.button("Show Solution", key="challenge_solution_btn"):
                st.session_state.challenge_solution = True
                st.rerun()

    # Extension
    extension = challenge.get("extension")
    if extension:
        st.markdown(
            f"""<div class="tm-callout">
              <span class="tm-callout-title">Extension Challenge</span>
              {extension}
            </div>""",
            unsafe_allow_html=True,
        )

    render_nav()


def render_summary():
    lesson = st.session_state.lesson
    status = lesson.get("_generation_status", "complete")
    if status != "complete" and not lesson.get("summary"):
        st.markdown('<span class="tm-badge deepdive">Generating...</span>', unsafe_allow_html=True)
        st.markdown("## Still Generating")
        st.markdown(
            '<div class="tm-callout insight"><span class="tm-callout-title">Quiz & assessments are generating in the background</span>'
            'Core concepts are ready above. Come back to this section in ~2 minutes.</div>',
            unsafe_allow_html=True,
        )
        if st.button("Check Now", key="refresh_btn_summary", type="primary"):
            reload_lesson()
            st.rerun()
        return
    summary = lesson.get("summary", {})
    further = lesson.get("further_reading", [])

    st.markdown('<span class="tm-badge concept">◎ Summary</span>', unsafe_allow_html=True)
    st.markdown("## Summary")

    one_liner = summary.get("one_liner", "")
    if one_liner:
        st.markdown('<div class="tm-card">', unsafe_allow_html=True)
        st.markdown(f"*{one_liner}*")
        st.markdown("</div>", unsafe_allow_html=True)

    takeaways = summary.get("takeaways", [])
    if takeaways:
        st.markdown("### Key Takeaways")
        for t in takeaways:
            st.markdown(
                f"""<div class="tm-callout tip" style="margin:8px 0;">
                  {t}
                </div>""",
                unsafe_allow_html=True,
            )

    if further:
        st.markdown("### Further Reading")
        kind_icons = {
            "paper": "📄",
            "blog": "📝",
            "code": "💻",
            "docs": "📚",
            "video": "🎥",
        }
        for item in further:
            title = item.get("title", "")
            url = item.get("url")
            kind = item.get("kind", "docs")
            why = item.get("why", "")
            icon = kind_icons.get(kind, "🔗")
            title_html = f'<a href="{url}" target="_blank">{icon} {title}</a>' if url else f'{icon} {title}'
            st.markdown(
                f"""<div class="tm-card" style="margin:8px 0;padding:16px 20px;">
                  <div style="font-weight:600;margin-bottom:4px;">{title_html}</div>
                  <div style="color:#6B6B7B;font-size:0.88rem;">{why}</div>
                </div>""",
                unsafe_allow_html=True,
            )

    render_nav()


def render_complete():
    lesson = st.session_state.lesson
    meta = lesson.get("meta", {})
    summary = lesson.get("summary", {})
    quiz_total = len(lesson.get("quiz", []))
    quiz_score = st.session_state.quiz_score
    time_mins = elapsed_minutes()
    is_review = meta.get("is_review_session", False)

    # --- Review session: simplified, focused completion ---
    if is_review:
        st.markdown('<span class="tm-badge review">Review Complete</span>', unsafe_allow_html=True)
        st.markdown("## Well done!")

        # Score card
        st.markdown(
            f"""<div class="tm-card" style="text-align:center;padding:36px 28px;">
              <div style="font-family:'Space Grotesk';font-size:3.2rem;font-weight:700;
                          background:linear-gradient(135deg,#7C5CFF,#00D4FF);
                          -webkit-background-clip:text;-webkit-text-fill-color:transparent;">
                {quiz_score}/{quiz_total}
              </div>
              <div style="color:#A0A0B0;margin-top:6px;font-size:1.0rem;">Recall Quiz Score</div>
            </div>""",
            unsafe_allow_html=True,
        )

        if not st.session_state.get("session_logged", False):
            st.markdown("---")
            review_score_input = st.text_input(
                "Confirm quiz score (edit if needed):",
                value=f"{quiz_score}/{quiz_total}" if quiz_total else "",
                key="review_score_input",
            )
            st.markdown("<div style='height:8px;'></div>", unsafe_allow_html=True)
            if st.button("Log Review Session", type="primary", key="btn_log_review", use_container_width=True):
                try:
                    log_review_session_to_disk(lesson, review_score_input)
                    st.session_state.session_logged = True
                    st.session_state.review_score_input_saved = review_score_input
                    st.rerun()
                except Exception:
                    st.error("Couldn't save session — check .teach/memory.json permissions")
        else:
            saved_score = st.session_state.get("review_score_input_saved", f"{quiz_score}/{quiz_total}")
            days = _days_until_review(saved_score)
            next_date = (datetime.now() + timedelta(days=days)).strftime("%b %d")
            st.markdown(
                f"""<div class="tm-success-banner">
                  <div style="font-family:'Space Grotesk';font-size:1.2rem;font-weight:600;
                              color:#34D399;margin-bottom:8px;">Review logged</div>
                  <div style="color:#A0A0B0;font-size:0.95rem;">
                    Next review scheduled in <strong style="color:#ECECF1;">{days} days</strong>
                    ({next_date})
                  </div>
                </div>""",
                unsafe_allow_html=True,
            )
        return

    # --- Normal session: celebration + debrief ---

    # Hero score
    st.markdown(
        f"""<div class="tm-complete">
          <div style="font-size:0.78rem;color:#6B6B7B;font-family:'JetBrains Mono';
                      text-transform:uppercase;letter-spacing:0.12em;margin-bottom:16px;">
            Session Complete
          </div>
          <div class="tm-score">{quiz_score}/{quiz_total}</div>
          <div style="color:#A0A0B0;margin-top:6px;font-size:1.0rem;">Quiz Score</div>
        </div>""",
        unsafe_allow_html=True,
    )

    # Stats row — three cards
    c1, c2, c3 = st.columns(3)
    with c1:
        st.markdown(
            f"""<div class="tm-card" style="text-align:center;padding:20px 16px;">
              <div style="font-family:'Space Grotesk';font-size:1.9rem;font-weight:700;
                          color:#34D399;">{quiz_score}/{quiz_total}</div>
              <div style="color:#6B6B7B;font-size:0.8rem;margin-top:6px;font-family:'JetBrains Mono';
                          text-transform:uppercase;letter-spacing:0.06em;">Quiz Score</div>
            </div>""",
            unsafe_allow_html=True,
        )
    with c2:
        st.markdown(
            f"""<div class="tm-card" style="text-align:center;padding:20px 16px;">
              <div style="font-family:'Space Grotesk';font-size:1.9rem;font-weight:700;
                          color:#00D4FF;">{elapsed_str()}</div>
              <div style="color:#6B6B7B;font-size:0.8rem;margin-top:6px;font-family:'JetBrains Mono';
                          text-transform:uppercase;letter-spacing:0.06em;">Time Spent</div>
            </div>""",
            unsafe_allow_html=True,
        )

    # Micro-quiz summary (only for non-review sessions)
    mq_scores = {k: v for k, v in st.session_state.items() if k.startswith("mq_score_")}
    mq_total = len(mq_scores)
    mq_correct = sum(1 for v in mq_scores.values() if v == 1)
    with c3:
        mq_display = f"{mq_correct}/{mq_total}" if mq_total else "—"
        mq_color = "#FBBF24" if mq_total else "#6B6B7B"
        st.markdown(
            f"""<div class="tm-card" style="text-align:center;padding:20px 16px;">
              <div style="font-family:'Space Grotesk';font-size:1.9rem;font-weight:700;
                          color:{mq_color};">{mq_display}</div>
              <div style="color:#6B6B7B;font-size:0.8rem;margin-top:6px;font-family:'JetBrains Mono';
                          text-transform:uppercase;letter-spacing:0.06em;">Quick Checks</div>
            </div>""",
            unsafe_allow_html=True,
        )

    # Takeaway pills
    takeaways = summary.get("takeaways", [])
    if takeaways:
        st.markdown("### What You Learned")
        pills_html = "".join(
            f'<span class="tm-pill">{t[:65]}{"..." if len(t) > 65 else ""}</span>'
            for t in takeaways
        )
        st.markdown(f'<div style="margin:12px 0 24px 0;">{pills_html}</div>', unsafe_allow_html=True)

    # --- Log session form ---
    if not st.session_state.get("session_logged", False):
        st.markdown(
            '<hr style="border:none;border-top:1px solid rgba(255,255,255,0.07);margin:8px 0 24px 0;">',
            unsafe_allow_html=True,
        )
        st.markdown(
            '<div style="font-family:\'Space Grotesk\';font-size:1.15rem;font-weight:600;'
            'color:#ECECF1;margin-bottom:6px;">Archive this session</div>',
            unsafe_allow_html=True,
        )
        st.markdown(
            '<div style="color:#6B6B7B;font-size:0.88rem;margin-bottom:20px;">'
            'Logging locks in your score and schedules the next review. '
            'One phrase is enough for the debrief — just name what tripped you up.'
            '</div>',
            unsafe_allow_html=True,
        )

        debrief_phrase = st.text_input(
            "What gave you trouble? (optional)",
            key="debrief_phrase",
            placeholder="e.g. NTK scaling math, ALiBi slope derivation...",
        )
        quiz_score_input = st.text_input(
            "Quiz score",
            value=f"{quiz_score}/{quiz_total}" if quiz_total else "",
            key="quiz_score_input",
            help="Format: correct/total, e.g. 6/8. Type 'skipped' if you didn't take the quiz.",
        )

        st.markdown("<div style='height:10px;'></div>", unsafe_allow_html=True)

        if st.button(
            "Log Session & Archive",
            type="primary",
            key="btn_log_session",
            use_container_width=True,
        ):
            try:
                new_streak = log_session_to_disk(lesson, debrief_phrase, quiz_score_input, time_mins)
                st.session_state.session_logged = True
                st.session_state.session_streak = new_streak
                st.session_state.session_quiz_score_input = quiz_score_input
                st.rerun()
            except Exception:
                st.error("Couldn't save session — check .teach/memory.json permissions")

    else:
        # Success state — feels earned
        new_streak = st.session_state.get("session_streak", 1)
        quiz_score_input = st.session_state.get("session_quiz_score_input", "")
        days_until_review = _days_until_review(quiz_score_input)
        next_review_date = (datetime.now() + timedelta(days=days_until_review)).strftime("%b %d")

        streak_label = f"{new_streak} day streak" if new_streak > 1 else "Day 1 — let's build a streak"
        streak_icon = "" if new_streak <= 1 else ("🔥" if new_streak >= 3 else "✓")

        st.markdown(
            f"""<div class="tm-success-banner">
              <div style="font-size:1.8rem;margin-bottom:10px;">{streak_icon}</div>
              <div style="font-family:'Space Grotesk';font-size:1.25rem;font-weight:700;
                          color:#34D399;margin-bottom:8px;">{streak_label}</div>
              <div style="color:#A0A0B0;font-size:0.95rem;line-height:1.6;">
                Session logged and archived.<br>
                Next review in <strong style="color:#ECECF1;">{days_until_review} days</strong>
                ({next_review_date}).
              </div>
            </div>""",
            unsafe_allow_html=True,
        )

    st.markdown("<div style='height:16px;'></div>", unsafe_allow_html=True)
    if st.button("← Review Lesson", key="complete_back"):
        nav_prev()


# ---------------------------------------------------------------------------
# Dispatch
# ---------------------------------------------------------------------------
def render_current_section():
    sections = st.session_state.sections
    idx = st.session_state.section_idx
    section = sections[idx]

    if section == "warm_up":
        render_warm_up()
    elif section == "hook":
        render_hook()
    elif section == "concept_map":
        render_concept_map()
    elif section == "challenge_attempt":
        render_challenge_attempt()
    elif section.startswith("concept:"):
        render_core_concept(int(section.split(":")[1]))
    elif section == "insights":
        render_insights()
    elif section == "quiz":
        render_quiz()
    elif section == "challenge":
        render_challenge()
    elif section == "summary":
        render_summary()
    elif section == "complete":
        render_complete()
    else:
        st.warning(f"Unknown section: {section}")


# ---------------------------------------------------------------------------
# Chat rail
# ---------------------------------------------------------------------------
def render_chat_rail():
    lesson = st.session_state.lesson
    sections = st.session_state.sections
    current_section = sections[st.session_state.section_idx]
    section_name = section_label(current_section, lesson)
    lesson_title = lesson.get("meta", {}).get("title", "today's lesson")

    st.markdown(
        f"""<div style="padding:12px 4px 8px 4px;">
          <div style="font-family:'Space Grotesk';font-weight:600;font-size:0.88rem;color:#ECECF1;">
            Ask Claude
          </div>
          <div style="font-size:0.76rem;color:#6B6B7B;margin-top:2px;">
            Re: {section_name}
          </div>
        </div>""",
        unsafe_allow_html=True,
    )

    # Show message history
    chat_container = st.container()
    with chat_container:
        for msg in st.session_state.chat_messages:
            with st.chat_message(msg["role"]):
                st.markdown(msg["content"])

    user_input = st.chat_input("Ask anything...", key="chat_rail_input")
    if user_input:
        st.session_state.chat_messages.append({"role": "user", "content": user_input})

        client = get_client()
        if client:
            system = (
                f"You are a sharp AI systems engineering mentor teaching {lesson_title}. "
                f"The student is currently on the '{section_name}' section. "
                "Answer concisely and with depth — no fluff. "
                "Use code snippets when helpful. Treat the student as a senior engineer."
            )
            api_messages = [
                {"role": m["role"], "content": m["content"]}
                for m in st.session_state.chat_messages
            ]
            with st.chat_message("assistant"):
                full_response = ""
                placeholder = st.empty()
                with client.messages.stream(
                    model="claude-sonnet-4-6",
                    max_tokens=1024,
                    system=system,
                    messages=api_messages,
                ) as stream:
                    for text in stream.text_stream:
                        full_response += text
                        placeholder.markdown(full_response + "▌")
                placeholder.markdown(full_response)
            st.session_state.chat_messages.append({"role": "assistant", "content": full_response})
        else:
            with st.chat_message("assistant"):
                st.markdown("*Set `ANTHROPIC_API_KEY` to enable the chat rail.*")
            st.session_state.chat_messages.append(
                {"role": "assistant", "content": "*Set `ANTHROPIC_API_KEY` to enable the chat rail.*"}
            )
        st.rerun()


# ---------------------------------------------------------------------------
# No-lesson screen
# ---------------------------------------------------------------------------
def render_no_lesson():
    st.markdown(
        """
        <div style="display:flex;flex-direction:column;align-items:center;
                    justify-content:center;min-height:60vh;padding:40px 20px;">
          <div class="tm-card" style="max-width:560px;text-align:center;padding:52px 44px;">
            <div style="font-size:3rem;margin-bottom:20px;">🧠</div>
            <h1 style="font-size:1.9rem;margin-bottom:14px;">No Lesson Loaded</h1>
            <p style="color:#A0A0B0;margin-bottom:28px;line-height:1.7;">
              Your daily lesson hasn't been generated yet.
              Head to your terminal and invoke the <code>/teach</code> command
              in Claude Code to generate today's deep dive — it will
              produce a lesson JSON, then launch this app automatically.
            </p>
            <div style="background:#0D0D14;border:1px solid rgba(124,92,255,0.28);border-radius:12px;
                        padding:16px 20px;text-align:left;font-family:'JetBrains Mono';
                        font-size:0.9rem;color:#C4B5FD;margin-bottom:20px;">
              /teach
            </div>
            <div style="color:#6B6B7B;font-size:0.82rem;line-height:1.6;">
              Or pick a specific topic:<br>
              <span style="font-family:'JetBrains Mono';color:#7C5CFF;">/teach speculative-decoding</span>
            </div>
            <div style="margin-top:24px;color:#6B6B7B;font-size:0.80rem;">
              After generating, refresh this page to begin.
            </div>
          </div>
        </div>
        """,
        unsafe_allow_html=True,
    )


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------
def main():
    # Load lesson once into session state
    if "lesson_loaded" not in st.session_state:
        lesson = load_lesson()
        if lesson is None:
            render_no_lesson()
            return
        init_state(lesson)

    # After init, guard against missing lesson key (defensive)
    if "lesson" not in st.session_state:
        render_no_lesson()
        return

    render_top_progress()
    render_sidebar()

    main_col, chat_col = st.columns([3, 1])
    with main_col:
        render_current_section()
    with chat_col:
        render_chat_rail()


if __name__ == "__main__":
    main()
