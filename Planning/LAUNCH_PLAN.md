# 🎯 Only Plans — Pirate Launch Plan

> From hackathon prototype to paying customers

---

## The Three Questions (Stage 1)

| | |
|---|---|
| **❓ Problem** | People — especially those with ADHD or undiagnosed attention struggles — have too many tasks, no clear priorities, fall into rabbit holes, and end the week having achieved nothing. Existing tools (Notion, Todoist, etc.) are passive. They wait for you to open them. Nobody calls you back. |
| **👤 Audience** | Individuals aged 20–40 who are self-aware about their focus struggles — diagnosed ADHD/ADD or undiagnosed spectrum. They've tried apps before. They want a solution that meets them where they are, not one that adds another thing to manage. |
| **💡 Solution** | An AI agent that understands how you think (via onboarding), proactively calls you throughout the day to keep you on track, breaks your goals into manageable steps, and adapts its motivation style to what actually works for you — rewards, accountability, or both. |

---

## ✨ Stage 2 — Prototype: The Magic Interaction

> **The magic moment:** The first time the AI agent calls you, identifies exactly what you should be working on right now, and keeps you from drifting. Not a notification. Not a push alert. An actual call.

**Behavioral Signal to test:**
> Did the user receive a call, get refocused, and return to work within 5 minutes?

### Stage 2 Checklist

| Action Item | Status | Notes |
|---|---|---|
| Define the magic interaction in one sentence | ✅ Done | AI call that refocuses |
| Build MVP: task input + one scheduled AI call | 🔜 Next | No auth needed yet |
| Deploy to live URL (Vercel / Railway) | 🔜 Next | Next.js recommended |
| Test with 3 people internally | ⬜ Later | Team only |
| Define behavioral signal clearly | ⬜ Later | See above |

---

## 📞 Stage 3 — Contact: First Real Users

Get the live URL in front of exactly 10 real people — not to get signups, but to get your behavioral signal.

### 10 Places / People to Reach First

| Contact Point | Status | Notes |
|---|---|---|
| Hackathon participants and jury members | 🔜 Next | Warm, already aware |
| ADHD communities on Reddit (r/ADHD, r/productivity) | 🔜 Next | Write as a founder |
| Personal LinkedIn / Twitter / X network | 🔜 Next | Build in public post |
| WhatsApp groups — friends who struggle with focus | 🔜 Next | Personal outreach |
| Product Hunt upcoming page (register early) | ⬜ Later | Prep for Stage 5 |
| Indie Hackers community post | ⬜ Later | Builder audience |
| Local co-working spaces / Slack groups | ⬜ Later | Cologne / remote |
| ADHS Deutschland e.V. community | ⬜ Later | German ADHD org |
| Podcasts / YouTube channels on ADHD productivity | ⬜ Later | Outreach for collabs |
| Existing customers / colleagues in your network | 🔜 Next | Highest trust |

> ⚠️ **If nobody triggered the behavioral signal and you haven't had a real conversation with at least 5 people who fit the problem — go back to Stage 2. Do not add auth. Do not add payments yet.**

---

## 🛠️ Stage 4 — Build: The Full MVP

People used the magic interaction. Now build the full SaaS skeleton — everything that makes it real and sellable.

### MVP Components

| Component | Status | Notes |
|---|---|---|
| Landing page — one promise, one CTA | ⬜ Later | Use `LANDING_PAGE.md` |
| Personalized onboarding — interview or game format | ⬜ Later | Unique differentiator |
| Core: AI call agent (proactive, not reactive) | 🔜 Next | The magic |
| Task breakdown — big goals into subtasks | ⬜ Later | Core feature |
| Calendar integration (Google Calendar) | ⬜ Later | Key differentiator |
| Auth — Clerk or Supabase Auth | ⬜ Later | After Stage 3 |
| Database — Supabase (user data + task persistence) | ⬜ Later | |
| Reward system — scaled to task difficulty | ⬜ Later | Gamification layer |
| Stripe integration — free trial + paid tier | ⬜ Later | Card on file |
| Clear overview dashboard (priorities + progress) | ⬜ Later | |

---

## 📈 Stage 5 — Grow: From Users to Customers

Pick **one** acquisition channel and go all in. Three channels half-done gives noise. One channel with intention gives signal.

### Recommended Primary Channel: Organic (Build in Public)

| Action Item | Status | Notes |
|---|---|---|
| Set up dedicated @OnlyPlans social profile | ⬜ Later | LinkedIn + X/Twitter |
| Post founder story — Eugene's fidgeting opener | ⬜ Later | Hook: personal & raw |
| Weekly "build in public" update posts | ⬜ Later | Every Monday |
| ADHD audience content (tips, relatable moments) | ⬜ Later | Builds trust |
| Founder-led posts on personal profiles (all 4 team) | ⬜ Later | More reach |
| Target: first 10 paying customers via direct outreach | ⬜ Later | |

### Pricing Hypothesis

| | Free | Pro — €9.99/mo | Max — €19.99/mo |
|---|---|---|---|
| Tasks | 3/day | Unlimited | Unlimited |
| AI Calls | 1/day | Up to 5/day | Unlimited |
| Calendar sync | ❌ | ✅ | ✅ |
| Reward system | ❌ | ✅ | ✅ |
| Custom motivation style | ❌ | ❌ | ✅ |
| Priority support | ❌ | ❌ | ✅ |

---

## 🔁 Stage 6 — Repeat: Build. Grow. Repeat.

### Metrics to Track (AARRR — Priority Order)

| Metric | Definition | Priority |
|---|---|---|
| **Activation** | Did new users experience an AI call? | 1st |
| **Retention** | Did they open the app 3+ days in a week? | 2nd |
| **Revenue** | Did anyone convert from free to paid? | 3rd |
| **Acquisition** | Weekly new signups | 4th |
| **Referral** | Did any user invite someone else? | 5th |

> 🟢 **PMF Signal:** Ask users *"How disappointed would you be if you could no longer use Only Plans?"*
> If **40%+** say "Very disappointed" — you have product-market fit. Aim for this within 90 days.

---

## 🎤 The Combined 2-Minute Pitch

> *"End of the week, you look back and think — where did the time go? I had so much to do, and I got nothing done."*

You had the intention. You had the energy. But somewhere between the hundred open tabs, the thirty tasks, and the rabbit hole you didn't plan to fall into — the important things just didn't happen.

Whether you're diagnosed with ADHD, somewhere on the spectrum without a label, or simply living in a world designed to distract you — this is a growing problem. And the apps you've tried? They wait for you to open them. Nobody calls you back.

**That's why we built Only Plans.**

Only Plans is your personal AI accountability partner. It starts by learning how your mind works — through a short interview or game. Then it builds a structure around your life, not a generic template.

Throughout your day, your AI agent calls you. It checks in, brings you back to focus, and makes sure the most important thing actually gets done. Not a notification. Not a nudge. **A call.**

It breaks your big goals into small, doable steps. It connects to your calendar. It reminds you of deadlines — including the small stuff like taxes and birthdays. And when you finish something, it rewards you.

Need more accountability? Done. Need to be called every hour? Done. Need a streak and a reward to stay motivated? We've got that too. Only Plans adapts to you — not the other way around.

With a clean, simple overview, you always know what the single most important task is right now.

Stop planning to plan. Only Plans holds your hand, calls you out, and celebrates every win — until your goals are done.

---

> **Your goals. Your deadline. Your accountability partner.**
> *Only Plans.*

---

*Built at a hackathon · Team: Shaunak, Oliver, Eugene, Ramona*
