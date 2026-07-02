# /postmortem — Real-World Incident Analysis

Standalone terminal session. You get a real, publicly documented outage, see it unfold up to the point where something is visibly broken, and you diagnose it before the reveal. Read-only — no lesson generation, no Streamlit/React, no file writes except the final memory log.

**Usage:** `/postmortem` (auto-picks an incident) or `/postmortem [name]` (e.g. `/postmortem gitlab`, `/postmortem cloudflare regex`)

---

## Learner Profile

**Name:** Sumanth G
**Role:** AI Backend Engineer at uCube.ai
**Depth:** expert, peer-level, production-focused. No hand-holding. No "great question!"

---

## Step 1 — Read State (read-only)

Read:

```
/Users/sumanthg/Documents/teach-me/.teach/memory.json
```

Do not write anything yet. Extract:
- `completed[]` — slugs, titles, domains, concepts (concepts live in curriculum-v2.json, cross-reference by slug if needed for overlap scoring)
- `postmortem_sessions` (top-level array) — if missing, treat as `[]`. It will be created on first log.

---

## Step 2 — The Incident Library

This is the full set of incidents this skill can run. Pick only from this list. Each has a 1-line summary and the curriculum concepts it exercises (match these against the learner's `completed[]` topics/domains to score overlap).

| id | Incident | Summary | Exercises concepts |
|---|---|---|---|
| `cloudflare-2019-regex` | Cloudflare, July 2 2019 | A single WAF regex rule with catastrophic backtracking pegged CPU across the edge fleet worldwide, taking most of Cloudflare's network down for ~27 minutes. | regex/CPU exhaustion, global config rollout blast radius, kill-switch design, canarying config changes |
| `github-2018-mysql` | GitHub, Oct 21 2018 | A 43-second network partition between two US East Coast facilities caused MySQL primary election to split; GitHub ran with inconsistent data across DCs for ~24 hours while reconciling. | split-brain, leader election, cross-DC replication lag, quorum writes, consistency vs availability tradeoffs |
| `aws-s3-2017-typo` | AWS S3, Feb 28 2017 | An engineer running a documented debugging playbook fat-fingered an input to a script, removing more capacity from the S3 index subsystem than intended, taking indexing and placement services down and cascading to much of the internet's us-east-1 dependents. | blast radius of operational tooling, missing input validation/dry-run guards, dependency fan-out, slow restart of large stateful subsystems |
| `gitlab-2017-db-deletion` | GitLab, Jan 31 2017 | An engineer, trying to fix replication lag caused by spam load, ran `rm -rf` against the wrong (production) database directory. Backups had been silently failing for weeks across all 5 backup mechanisms. | replication lag, backup verification (or lack of it), human-in-the-loop destructive ops, defense in depth failing all layers at once |
| `slack-2021-tgw` | Slack, Jan 4 2021 | A surge in traffic (return-to-work Monday) triggered autoscaling that overwhelmed AWS Transit Gateway's ability to scale ENIs fast enough, causing packet loss between AZs that cascaded into Slack-wide connectivity failure. | autoscaling lag vs demand spike, cross-AZ networking dependency, capacity headroom planning, retry storms amplifying load |
| `roblox-2021-consul` | Roblox, Oct 28-31 2021 | A subtle bug in Consul's streaming feature caused excessive CPU load on the Consul server cluster under specific traffic patterns; combined with an unrelated latent issue, this caused a cascading failure that took Roblox down for ~73 hours. | service discovery as single point of failure, control-plane vs data-plane coupling, cascading failure, debugging under extreme time pressure |
| `cloudflare-2020-backbone` | Cloudflare, Jul 17 2020 | A route leak from a bad actor network at a shared IXP propagated a huge number of bad routes into Cloudflare's backbone, causing congestion and packet loss across multiple major cities for ~27 minutes. | BGP route leaks, blast radius of peering/transit trust, backbone traffic engineering, detection lag on network-layer issues |
| `facebook-2021-bgp` | Facebook/Meta, Oct 4 2021 | A routine maintenance command intended to assess backbone capacity accidentally took down all backbone connections, which withdrew Facebook's BGP routes and made its DNS servers (and everything else) unreachable from the internet for ~6 hours. | BGP withdrawal, DNS dependency on network reachability, out-of-band access for recovery (they had to physically access data centers), tooling that permits its own catastrophic misuse |
| `datadog-2023-systemd` | Datadog, Mar 8 2023 | A routine Ubuntu systemd package update, rolled out via automated OS patching across a large fleet, triggered a bug that caused hosts to lose network connectivity, taking down multiple Datadog services simultaneously across regions. | fleet-wide automated patching blast radius, canarying OS/dependency upgrades, correlated failure across "independent" regions, recovery via manual fleet remediation |
| `salesforce-2021-dns` | Salesforce, May 2021 | A DNS update meant to be limited in scope was pushed more broadly than intended (config error in a network change), making Salesforce services unreachable for several hours across multiple instances. | DNS as a control plane, scope-limiting config rollouts, staged/canary rollout of network changes, detection and rollback speed |

If the user asks about an incident not on this list, say so plainly: "Not in the library. Available: [list ids]." Do not invent details for incidents outside this set — only present facts you're confident are publicly documented for the incidents above, and keep the detail level accurate to what's publicly known. If unsure of a specific number or timestamp, keep it approximate rather than inventing false precision.

---

## Step 3 — Pick the Incident

**If invoked as `/postmortem [name]`:** fuzzy-match `name` against the `id` or `Incident` column above (e.g. "gitlab", "regex", "bgp", "consul" all resolve). If no match, list available ids and stop.

**If invoked as `/postmortem` with no argument — auto-pick:**

1. Read `postmortem_sessions[]` from memory.json — exclude any `incident` id already present there.
2. From the remaining incidents, score each by concept overlap with the learner's `completed[]` topics (match on domain and concept keywords — e.g. completed Raft/replication/quorum topics → favor `github-2018-mysql`; completed circuit-breaker/resilience topics → favor `roblox-2021-consul` or `slack-2021-tgw`; completed caching/DNS-adjacent backend topics → favor `salesforce-2021-dns`).
3. Pick the highest-overlap remaining incident. If it's a tie, pick the one least recently added to the library order (top of table wins).
4. If every incident has already been done (`postmortem_sessions` covers all 10), say so and let the user pick a repeat: "You've done every incident in the library. Reply with one to redo, or say a topic and I'll tell you if there's a fit." Wait for their reply before proceeding.

Display:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
POSTMORTEM: [Incident title]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

If picked via overlap, add one line: `Chosen because it overlaps with: [the completed topic(s) that drove the match]`

---

## Step 4 — Present Setup + Timeline (STOP before root cause)

Write out, in plain short words, no jargon-soup:

1. **The setup** — what system, what scale, what was true right before this happened (2-4 sentences).
2. **The timeline up to the visible failure** — a chronological sequence of what engineers/users actually observed, minute by minute or event by event, using only publicly documented facts. Stop the instant the failure is visible (alerts firing, users seeing errors, dashboards red) — do NOT reveal the root cause, the fix, or any diagnostic step engineers took after that point.

Format:

```
Setup:
[2-4 sentences]

Timeline:
[HH:MM or T+Nmin] — [what was observed]
[HH:MM or T+Nmin] — [what was observed]
...
[last line = the moment the failure became visible, and nothing more]
```

Then output exactly:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
What's your leading hypothesis? What 3 things do you check first, in order?
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**STOP HERE. Do NOT reveal anything past this point. Wait for the user's answer.**

---

## Step 5 — Reveal and Score

Once the user answers:

1. **Reveal what actually happened**, step by step — root cause, why it was hard to see, how it was actually found, how it was fixed, how long it took. Plain words, short sentences, scenario-first tone (matches the rest of this project's teaching style).

2. **Score their answer** against reality, 1-5 on each axis, with a one-line justification per axis:
   - **Plausibility** — was their hypothesis in the right causal family, even if not exact?
   - **Diagnostic efficiency** — would their 3 checks, in that order, have actually surfaced the problem fast, or wasted time on low-yield checks first?
   - **Considered the class of cause** — did they think of the right *category* (e.g. network partition vs application bug vs config rollout vs capacity exhaustion) even if the specific mechanism differs?

   Be direct. No softening, no "good attempt." If their hypothesis was in the wrong causal family entirely, say so and say what family it should have been.

Format:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
WHAT ACTUALLY HAPPENED
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[step-by-step reveal]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SCORING YOUR CALL
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Plausibility:              [1-5]  [one line why]
Diagnostic efficiency:     [1-5]  [one line why]
Considered class of cause: [1-5]  [one line why]

Total: [sum]/15
```

---

## Step 6 — Transferable Lesson + Log

Close with:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
THE TRANSFERABLE LESSON
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[2-4 sentences: the general principle this incident teaches, stated so it
transfers to a different system — not just a recap of what Company X did wrong.]

Maps to your curriculum: [name the specific completed topic(s)/concepts this
connects to, from memory.json]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

Then log the session. Compute `score_pct = total / 15` (from Step 5's Total, rounded to 2 decimals).

Read the current `memory.json`, then write it back with ONE change: append to top-level `postmortem_sessions` (create the array if it doesn't exist):

```json
{
  "date": "[today YYYY-MM-DD]",
  "incident": "[incident id from the table]",
  "score_pct": [total/15 as decimal]
}
```

Do NOT touch `completed[]`, `streak`, `in_progress`, `last_session_date`, or `weak_areas` — postmortems are drills, not lessons, same rule as `/grill`.

Validate the JSON with `python3 -c "import json; json.load(open('.../memory.json'))"` before finishing.

Output: `📁 Postmortem logged: [incident title] · [total]/15`

---

## Args Reference

| Invocation | Behavior |
|---|---|
| `/postmortem` | Auto-picks incident by best overlap with completed topics, skipping ones already done |
| `/postmortem gitlab` | Forces the GitLab Jan 2017 database deletion incident |
| `/postmortem cloudflare regex` | Forces the Cloudflare 2019 regex CPU exhaustion incident |
| `/postmortem bgp` | Forces the Facebook 2021 BGP withdrawal incident |

Any `id` in the Step 2 table (or a clear fuzzy match on its name) is valid.
