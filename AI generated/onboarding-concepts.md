# Only Plans — Onboarding Concepts

What the agent needs to know from onboarding, why it matters, and how it follows up.

The onboarding builds a **user model** — a structured profile the agent references on every interaction. There are 5 core concepts.

---

## 1. Availability Window
*When can the agent reach the user, and when must it stay silent.*

The agent needs to know peak hours (when to schedule important check-ins) and blocked hours (when to never call). Without this, calls feel intrusive and get ignored.

---

## 2. The Goal + The Why
*What the user wants to achieve, broken into a first concrete step — and the personal reason behind it.*

The agent needs both. The task gives it something to track. The why gives it something to refer back to when the user is losing motivation. A goal without a why is just a to-do item.

**Follow-up example:**
> User: "I want to finish my website."
> Agent: "Nice. Is this for a business, a side project, or something personal?"
> Agent: "What would 'finished' look like — like, what's the version you could actually launch?"
> Agent: "What's been stopping you so far — do you know?"

---

## 3. Work Style
*How the user operates — structured vs. flexible, self-starter vs. needs a push.*

This determines how the agent frames its check-ins. Someone who likes structure wants a clear schedule and expects the agent to hold them to it. Someone flexible wants gentle nudges, not a rigid timetable.

**Follow-up example:**
> User: "I like flexibility."
> Agent: "Got it — so you don't want me to lock you into a fixed schedule. Should I still suggest a rough time to work on things, or just check in and see where you're at?"

---

## 4. Accountability Style
*How the user wants to be held accountable — the tone, the pressure level, and what happens when they fall short.*

This is the agent's "personality setting" for this user. Get this wrong and the agent feels annoying or useless. The agent needs to know: how direct, how often, and what to do when there's no response.

**Follow-up example:**
> User: "Be direct with me."
> Agent: "Respect. Just to be clear — if you told me you'd finish something and you didn't, do you want me to call that out straight, or just move forward and reset?"
> Agent: "And if you don't pick up — should I try again, send a text, or leave it and wait for you?"

---

## 5. Motivation Driver
*What actually moves this person — reward, consequence, progress, or external pressure.*

The agent uses this to frame every check-in. A reward-driven user hears: "You're one step away from completing this." A consequence-driven user hears: "You said this was due today — let's make sure it happens." Wrong framing = user tunes out.

**Follow-up example:**
> User: "Rewards work for me."
> Agent: "Love it. What kind of reward feels meaningful — is it more about the streak, seeing progress on a board, or something you'd actually treat yourself to?"
> User: "I'm not sure."
> Agent: "No worries. Let's start with tracking your wins and see what feels good. We can adjust."

---

## What Gets Stored

After onboarding, the agent holds the full user profile plus a precise first task:

### User Profile

| Field | Example |
|---|---|
| `peak_hours` | 8am – 11am |
| `blocked_hours` | 12–1pm, after 8pm |
| `work_style` | Flexible |
| `accountability_style` | Direct |
| `motivation_driver` | Rewards |
| `check_in_frequency` | Twice a day |
| `fallback_on_no_answer` | Text after 30 min |
| `tone` | Straight, no fluff |

### First Task Card

| Field | Example |
|---|---|
| `task` | Write the About page for my website |
| `goal_why` | "I want to go freelance" |
| `timeframe` | Today, 9am – 11am |
| `reminder_at` | 8:45am — 15 min before start |
| `details` | Focus on the intro paragraph first. Don't touch the design yet. |

---

## Agent Goal

The agent treats the first task as its own objective — not just something to track, but something it is actively trying to define together with the user. The agent's goal in the opening call is:

> **Gather enough detail about the first task to make it actionable.**

This means the agent doesn't move on until it has a clear task, a timeframe, a reminder window, and any relevant details. It asks follow-up questions until the picture is complete — then locks it in and confirms back to the user.

| Field | Example |
|---|---|
| `agent_goal` | Fully define: "Write the About page" |
| `success_condition` | Task, timeframe, reminder, and details are all confirmed by the user |
| `if_too_vague` | Ask follow-up questions to narrow it down |
| `if_too_large` | Suggest breaking it into a smaller first step |
| `confirm_at_end` | Read the full task card back and get a yes |
