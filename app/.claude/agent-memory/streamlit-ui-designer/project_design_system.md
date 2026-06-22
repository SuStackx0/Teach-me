---
name: project-design-system
description: teach-me app dark premium design system — palette, fonts, CSS classes, and theming conventions
metadata:
  type: project
---

# teach-me Design System

**App file:** `/Users/sumanthg/Documents/teach-me/app/app.py`

## Palette (CSS vars)
- `--bg-primary: #0A0A0F` — page background
- `--bg-secondary: #12121A` — sidebar
- `--bg-elevated: #1A1A26` — button resting state
- `--card-bg: rgba(22,22,32,0.6)` — glass card
- `--accent: #7C5CFF` — primary purple
- `--accent-2: #00D4FF` — cyan secondary
- `--accent-3: #FF6B9D` — pink (challenge sections)
- `--success: #34D399`, `--warning: #FBBF24`, `--error: #F87171`
- `--text-1: #ECECF1`, `--text-2: #A0A0B0`, `--text-3: #6B6B7B`
- `--code-bg: #0D0D14`

## Fonts
- Headings: Space Grotesk
- Body: Inter
- Code / badges / monospaced UI: JetBrains Mono

## CSS Classes
- `.tm-card` — glass card with backdrop-filter, 18px radius, rise animation
- `.tm-badge` — pill badge; variants: `.hook`, `.concept`, `.deepdive`, `.quiz`, `.challenge`, `.review`
- `.tm-callout` — left-bordered callout; variants: `.insight` (warning), `.gotcha` (error), `.tip` (success), `.neutral`
- `.tm-callout-title` — bold label inside callout
- `.tm-dot` — sidebar TOC dot; variants: `.done`, `.active`, `.got-it` (green), `.missed` (yellow)
- `.tm-toc-item` — sidebar TOC row; `.active` state highlighted purple
- `.tm-complete` — centered completion hero wrapper
- `.tm-score` — gradient large score number (4rem)
- `.tm-success-banner` — green-tinted success card (session logged state)
- `.tm-pill` — topic pill chip in accent purple
- `.tm-diagram` — code-dark container for ASCII diagrams
- `.tm-mq-divider` — subtle HR before micro-quiz
- `.tm-mq-badge` — small green "Quick check" inline badge
- `.tm-attempt-area` — wrapper that forces dark styling on the challenge text area

## Layout
- `layout="wide"` with `max-width: 960px` for main content
- Always `main_col, chat_col = st.columns([3, 1])` at top level
- Sidebar shows TOC + elapsed time + quiz score

**Why:** Sumanth's aesthetic preference is dark premium, understated, no loud gradients on content — only on hero numbers and progress fills.
