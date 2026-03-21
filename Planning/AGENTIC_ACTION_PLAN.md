# Only Plans - Agentic Build Action Plan

## Goal
Build Only Plans with an agent-first workflow where AI handles most execution and the team handles decisions, user access, and external setup.

Target split:
- 80-90% execution by agents
- 10-20% human decisions and external actions

## Team Operating Model
- Product owner (rotating founder each sprint): sets one weekly outcome.
- Agent (Cursor): decomposes tasks, implements, tests, documents, and updates backlog.
- Domain owners (human): Growth, Tech/Infra, User Research, Partnerships.
- Daily 20-minute sync: only unblock decisions and dependencies.

## Ownership Split

### Agent can do independently
- Convert launch docs into backlog (epics, tasks, acceptance criteria).
- Implement product code (frontend, backend, API routes, data model).
- Build onboarding, task logic, priority flow, and dashboard.
- Add integrations at code level (Supabase/Clerk/Stripe/Google Calendar/Twilio).
- Write tests, run linting, prepare CI scripts, and migration files.
- Draft landing and outreach copy variants.
- Define analytics events and reporting structure.
- Produce weekly progress reports and next sprint recommendations.

### Team must do
- Provide credentials/secrets and configure external accounts.
- Make product decisions (pricing, UX tone, call behavior, trade-offs).
- Handle legal/compliance (privacy, consent, call recording and regional rules). - not needed yet
- Recruit and interview real users.
- Validate motivation quality and call usefulness with real feedback.
- Publish externally (domains, social accounts, billing verification).

## Weekly Agentic Workflow
1. Human sets one objective for the week.
2. Agent converts objective into prioritized implementation tasks.
3. Agent executes the smallest working vertical slice.
4. Human runs a short decision gate (approve/reject trade-offs).
5. Agent applies feedback and finalizes release checklist.
6. Team ships and runs user outreach/interviews.
7. Agent synthesizes feedback into next sprint backlog.

## Phased Plan (Aligned to Launch Plan)

### Phase A - Stage 2: Magic Interaction (Week 1)
Goal: prove behavioral signal.

Build:
- Task input + one scheduled AI call.
- Minimal "most important task right now" view.

Measure:
- `call_answered`
- `returned_to_task_within_5m`

Team inputs:
- Twilio setup and test numbers.
- 3 internal testers.

### Phase B - Stage 3: First 10 Real Users (Weeks 2-3)
Goal: get real usage signal, not scale.

Build:
- Lightweight onboarding.
- Post-call feedback capture ("helpful / not helpful").

Team inputs:
- Recruit 10 target users from defined channels.
- Complete at least 5 real user conversations.

### Phase C - Stage 4: Full MVP Skeleton (Weeks 4-7)
Goal: complete sellable product skeleton.

Build:
- Auth + user persistence.
- Task breakdown engine.
- Calendar integration.
- Reward system.
- Stripe free trial + paid tier.

Team inputs:
- Final pricing and packaging.
- Legal docs and billing setup.

### Phase D - Stage 5: Growth Loop (Ongoing)
Goal: first 10 paying customers and repeatable channel.

Build:
- Landing page variants.
- Referral hooks.
- AARRR dashboard (Activation first).

Team inputs:
- Founder-led weekly distribution and direct outreach.

## Collaboration Rules
- One active sprint goal at a time.
- No feature starts without a success metric.
- Use launch doc + backlog as single source of truth.
- If metrics miss, iterate behavior before adding complexity.
- Keep implementation small and vertical.

## What We Need From Team Before Week 1 Starts
- Confirm stack choices (e.g., Next.js, Supabase, Twilio).
- Provide environment variable names and service ownership.
- Confirm testing users and outreach owner.
- Confirm call compliance constraints by target region.

## Week 1 Default Sprint Objective
"Users can enter tasks and receive one proactive AI accountability call that helps them refocus within 5 minutes."

