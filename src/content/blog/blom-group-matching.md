---
title: "Building an AI-Assisted Group Matching Engine"
date: 2026-03-15
excerpt: "How I built Blom — a full-stack system that takes a room of strangers, runs them through a feature engineering pipeline and constrained assignment algorithm, then hands the result to an LLM for review before a human operator signs off."
draft: false
tags: ["python", "react", "machine-learning", "llm", "synthetic-data", "pii", "matching", "langgraph"]
coverImage: "https://images.pexels.com/photos/6955659/pexels-photo-6955659.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=1"
coverImageAlt: "A diverse group of young adults laughing together over a candlelit dinner party"
faqs:
  - question: "What is Blom?"
    answer: >-
      Blom is an algorithmic group-matching system built for Blom Social, a platform that runs structured social events. It automates the process of dividing event attendees into well-balanced groups using quiz responses, cosine similarity, and a constrained greedy assignment algorithm, with LLM review and a human operator sign-off step before groups are finalised.
  - question: "What is the tech stack?"
    answer: >-
      Python (FastAPI, LangGraph, NumPy, scikit-learn) for the backend pipeline; React, D3 force simulation, and Zustand for the frontend operator tool; Railway for backend hosting and Vercel for the frontend.
  - question: "Can I try the demo?"
    answer: >-
      Yes — the live operator tool is embedded in this post. You can drag nodes between groups, approve groups, import stragglers, and delete groups. All data is synthetic with no real PII.
---

Every social event planner faces the same problem: given a room of strangers, how do you divide them into groups that actually work?

*This system was built for [Blom Social](https://blom.social) — a platform that runs structured social events in London and Cape Town.*

Too random and you get a table where nobody talks. Too deliberate and you violate privacy by visibly sorting people. And if you're running fifty events a month, doing it by hand at all stops being feasible.

This is the problem Blom is built to solve. Over several weeks I built an end-to-end system — from raw quiz responses through a matching algorithm, LLM review layer, and drag-and-drop operator UI — that makes group assignment fast, auditable, and explainable. Here's how it works.

---

## The pipeline at a glance

The system has four layers that each hand off to the next:

1. **Feature engineering** — quiz responses are encoded into fixed-length vectors, with sensitive fields handled separately depending on the operator's chosen mode
2. **Similarity + assignment** — cosine similarity drives an affinity matrix; a constrained greedy algorithm assigns attendees to groups while respecting hard constraints (friend pairs, group size bounds)
3. **LLM review** — a LangGraph agentic workflow explains each group, flags potential issues, and waits for a human checkpoint before compiling the final output
4. **Operator UI** — a force-directed canvas lets the operator inspect fit scores, drag nodes, freeze approved groups, and handle late sign-ups before committing

Each layer produces a typed Pydantic model that the next layer consumes. Nothing reaches the frontend that hasn't passed through anonymisation.

<svg viewBox="0 0 660 635" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Blom pipeline diagram: quiz responses through feature engineering, user embeddings, constrained matching, LLM review, to groups dispatched — with post-event ratings feeding back into matching" style="width:100%;max-width:520px;margin:2.5rem auto;display:block;">
  <defs>
    <marker id="arr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto">
      <path d="M0,0 L10,5 L0,10 z" fill="rgba(240,236,228,0.35)"/>
    </marker>
    <marker id="arr-amber" viewBox="0 0 10 10" refX="1" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
      <path d="M10,0 L0,5 L10,10 z" fill="rgba(212,148,60,0.6)"/>
    </marker>
  </defs>
  <rect x="120" y="20" width="340" height="52" rx="12" fill="rgba(107,114,128,0.12)" stroke="rgba(107,114,128,0.5)" stroke-width="1.5"/>
  <text x="290" y="51" text-anchor="middle" font-family="-apple-system,BlinkMacSystemFont,'SF Pro Display',sans-serif" font-size="15" font-weight="600" fill="rgba(250,248,245,0.9)">Quiz responses</text>
  <line x1="290" y1="72" x2="290" y2="108" stroke="rgba(240,236,228,0.3)" stroke-width="1.5" marker-end="url(#arr)"/>
  <rect x="120" y="112" width="340" height="72" rx="12" fill="rgba(99,102,241,0.12)" stroke="rgba(129,140,248,0.5)" stroke-width="1.5"/>
  <text x="290" y="145" text-anchor="middle" font-family="-apple-system,BlinkMacSystemFont,'SF Pro Display',sans-serif" font-size="15" font-weight="600" fill="rgba(250,248,245,0.9)">Feature engineering</text>
  <text x="290" y="167" text-anchor="middle" font-family="-apple-system,BlinkMacSystemFont,'SF Pro Display',sans-serif" font-size="12" fill="rgba(250,248,245,0.4)">Encode, scale, derive Big Five proxies</text>
  <line x1="290" y1="184" x2="290" y2="220" stroke="rgba(240,236,228,0.3)" stroke-width="1.5" marker-end="url(#arr)"/>
  <rect x="120" y="224" width="340" height="52" rx="12" fill="rgba(99,102,241,0.12)" stroke="rgba(129,140,248,0.5)" stroke-width="1.5"/>
  <text x="290" y="255" text-anchor="middle" font-family="-apple-system,BlinkMacSystemFont,'SF Pro Display',sans-serif" font-size="15" font-weight="600" fill="rgba(250,248,245,0.9)">User embeddings</text>
  <line x1="290" y1="276" x2="290" y2="312" stroke="rgba(240,236,228,0.3)" stroke-width="1.5" marker-end="url(#arr)"/>
  <rect x="120" y="316" width="340" height="72" rx="12" fill="rgba(16,185,129,0.1)" stroke="rgba(52,211,153,0.45)" stroke-width="1.5"/>
  <text x="290" y="349" text-anchor="middle" font-family="-apple-system,BlinkMacSystemFont,'SF Pro Display',sans-serif" font-size="15" font-weight="600" fill="rgba(250,248,245,0.9)">Constrained matching</text>
  <text x="290" y="371" text-anchor="middle" font-family="-apple-system,BlinkMacSystemFont,'SF Pro Display',sans-serif" font-size="12" fill="rgba(250,248,245,0.4)">Optimise within-group similarity</text>
  <line x1="290" y1="388" x2="290" y2="424" stroke="rgba(240,236,228,0.3)" stroke-width="1.5" marker-end="url(#arr)"/>
  <rect x="120" y="428" width="340" height="72" rx="12" fill="rgba(212,148,60,0.1)" stroke="rgba(212,148,60,0.45)" stroke-width="1.5"/>
  <text x="290" y="461" text-anchor="middle" font-family="-apple-system,BlinkMacSystemFont,'SF Pro Display',sans-serif" font-size="15" font-weight="600" fill="rgba(250,248,245,0.9)">LLM review layer</text>
  <text x="290" y="483" text-anchor="middle" font-family="-apple-system,BlinkMacSystemFont,'SF Pro Display',sans-serif" font-size="12" fill="rgba(250,248,245,0.4)">Explain groupings, flag issues</text>
  <line x1="290" y1="500" x2="290" y2="536" stroke="rgba(240,236,228,0.3)" stroke-width="1.5" marker-end="url(#arr)"/>
  <rect x="120" y="540" width="340" height="52" rx="12" fill="rgba(16,185,129,0.1)" stroke="rgba(52,211,153,0.45)" stroke-width="1.5"/>
  <text x="290" y="571" text-anchor="middle" font-family="-apple-system,BlinkMacSystemFont,'SF Pro Display',sans-serif" font-size="15" font-weight="600" fill="rgba(250,248,245,0.9)">Groups dispatched</text>
  <polyline points="460,566 510,566 510,352 460,352" fill="none" stroke="rgba(212,148,60,0.45)" stroke-width="1.5" stroke-dasharray="5,4" marker-end="url(#arr-amber)"/>
  <text x="518" y="453" font-family="-apple-system,BlinkMacSystemFont,'SF Pro Display',sans-serif" font-size="11" fill="rgba(212,148,60,0.65)" text-anchor="start">Post-event</text>
  <text x="518" y="469" font-family="-apple-system,BlinkMacSystemFont,'SF Pro Display',sans-serif" font-size="11" fill="rgba(212,148,60,0.65)" text-anchor="start">ratings</text>
</svg>

---

## Feature engineering: turning a quiz into a vector

Attendees fill in a quiz with twenty fields — twelve Likert-scale personality traits, two ordinal preference questions, and six categorical fields (dietary requirements, accessibility needs, and so on).

The encoder produces different vector lengths depending on mode:

- **Neutral mode** (38 dimensions) — sensitive fields are excluded entirely
- **Affinity mode** (67 dimensions) — all fields included, with configurable per-field weights
- **Diversity mode** — same as affinity but with inverted weights, so dissimilar people are grouped together

A modifier pass adjusts weights after each real event based on attendee feedback, so the algorithm improves over time.

One non-obvious detail: the `high_anxiety` flag is computed from the raw quiz value *before* imputation. If we filled missing values with the median first, we'd generate false positives — encoding "probably not anxious" as "definitely not anxious".

---

## Group assignment: greedy with hard constraints

Once we have an affinity matrix of pairwise similarity scores, we run a constrained greedy assignment:

- Groups are seeded by selecting the highest-similarity unassigned pair
- Each subsequent attendee is added to the group that maximises their average similarity to existing members
- Hard constraints are enforced throughout: friend pairs must end up in the same group, no group may exceed `maxSize`, and high-anxiety attendees aren't isolated

The algorithm runs in O(n²) time against the affinity matrix, which is fine for the corpus sizes Blom handles (10–500 attendees per event).

---

## LLM review: explanation before approval

Raw algorithmic output isn't enough. An operator needs to understand *why* a group looks the way it does before approving it, especially when something looks off.

The review layer uses a four-node LangGraph workflow:

1. **Explain** — Claude generates a plain-English description of each group's composition
2. **Flag** — potential issues are surfaced (e.g. an isolated attendee, a group with unusually high dominance imbalance)
3. **Human checkpoint** — the graph pauses with `interrupt_before=["human_checkpoint"]`; the operator reviews flags in the UI before resuming
4. **Compile** — approved overrides are parsed from natural language, validated against known attendee IDs, and merged into the final assignment

LangSmith tracing is on by default, so every LLM call is logged with a `workflow_trace_id` that links back to the specific event run.

---

## The operator tool

The frontend is where all of this becomes usable. Try it below — all data is synthetic.

<div class="demo-embed">
  <iframe
    src="https://blom-matching.vercel.app"
    title="Blom Group Matching — live demo"
    loading="lazy"
  ></iframe>
</div>
<p class="demo-caption">Live operator tool — synthetic data, no real PII</p>

The canvas uses a D3 force simulation with custom attractors that pull nodes toward their group centre. Each node is coloured by fit score:

- **Green** — high fit (good value alignment, balanced dominance, compatible pairs)
- **Amber** — moderate fit — worth a look but not necessarily wrong
- **Red** — low fit — the algorithm flagged this assignment

Fit score is a composite of three axes: *values cohesion* (how similar attendees' values are), *dominance balance* (whether the group has a healthy catalyst-to-participant ratio), and *pair compatibility* (for events where known friend pairs or incompatible pairs exist).

The operator can:

- **Drag nodes** between groups to manually reassign
- **Freeze and approve** a group to lock it — approved groups show a padlock badge and block further dragging
- **Import stragglers** — late sign-ups appear as unassigned nodes and can be dragged to any non-approved group
- **Delete a group** by dragging it to the bin zone; its members redistribute automatically
- Switch between three event types (pub quiz, dinner, networking) — each has a different activity profile that adjusts catalyst targets, weight priorities, and group size bounds

---

## What makes this interesting to build

A few things I found genuinely worth solving:

**Circular imports in FastAPI.** The route modules needed `SESSION_STORE` from `main.py`, but `main.py` imported the routers. The fix was extracting shared state and exceptions into a neutral `state.py` module that both sides import without creating a cycle.

**Fit score stability.** The catalyst balance component (which measures whether a group has the right proportion of high-energy people) returns zero for any group outside the target window. Early on this meant entire event runs would show all-amber nodes because the synthetic seed had zero catalysts. The fix was ensuring the demo seed includes at least one attendee whose trait vector puts them above the catalyst threshold for the target event type.

**Pointer events vs. `setPointerCapture`.** The D3 drag interaction originally used `setPointerCapture` on nodes, which routed subsequent events to the node element — but that also meant click events on the SVG background fired *through* the drag, clearing selection immediately. Switching to `window` listeners for `pointermove` and `pointerup` fixed this because window events don't fire through the SVG's own handlers.

---

## Stack

| Layer | Technology |
|---|---|
| Backend pipeline | Python 3.14, NumPy, scikit-learn |
| Agent workflow | LangGraph, LangSmith, Claude (Anthropic) |
| API | FastAPI, slowapi, Pydantic v2 |
| Frontend | React, D3 v7, Zustand, TypeScript |
| Deployment | Railway (backend), Vercel (frontend) |

The backend runs as a single-worker uvicorn process on Railway — in-memory session store keeps things simple for v0.1. The frontend is a static Vite build with an SPA rewrite rule on Vercel.

---

The system isn't connected to a live database yet — that's the next phase, where the operator tool will write group assignments back to Blom Social's platform. For now, the matching pipeline, LLM review layer, and operator tool all work end-to-end on synthetic data.

If you're building something that needs structured group assignment — events, classroom seating, team formation — the core algorithm is transferable. The tricky part is always the constraint handling and making the output legible enough for a human to actually trust it.
