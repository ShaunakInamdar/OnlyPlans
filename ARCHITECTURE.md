# OnlyPlans — System Architecture

## Overview

OnlyPlans runs entirely on a single VPS (`187.77.69.95`). All services are Docker containers on a shared bridge network (`onlyplans_default`, subnet `172.18.0.0/16`). Containers communicate by service name — Docker DNS resolves `kong`, `supabase-db`, `openclaw-gateway`, etc. automatically. The VPS firewall selectively exposes a small number of ports to the public internet.

---

## Network Diagram

```
                        PUBLIC INTERNET
                              │
                    VPS: 187.77.69.95
                              │
          ┌───────────────────┼──────────────────────┐
          │                   │                      │
       :3000               :8000                  :18889
       (nginx)             (Kong)            (OpenClaw Gateway)
          │                   │                      │
          │         ┌─────────┴──────────┐           │
          │         │  Docker Bridge     │           │
          │         │  onlyplans_default │           │
          │         │  172.18.0.0/16     │           │
          │         └────────────────────┘           │
          │                                          │
    ┌─────▼──────┐                           ┌──────▼────────┐
    │  onlyplans │                           │   openclaw-   │
    │    -web    │                           │   gateway     │
    │ 172.18.0.15│                           │ 172.18.0.16   │
    └────────────┘                           │  + port :3334 │
    serves static                            │  (Telnyx hook)│
    React build                              └──────┬────────┘
                                                    │ http://kong:8000
                                      ┌─────────────▼──────────────┐
                                      │        supabase-kong        │
                                      │        172.18.0.14          │
                                      │   API gateway — validates   │
                                      │   JWT, routes all requests  │
                                      └──┬──────┬──────┬───────────┘
                                         │      │      │
                               ┌─────────▼─┐ ┌──▼──┐ ┌▼──────────────┐
                               │ supabase  │ │auth │ │  supabase-rest │
                               │    -db    │ │     │ │  (PostgREST)   │
                               │ 172.18.0.2│ └─────┘ └────────────────┘
                               └───────────┘
```

---

## Container Reference

| Container | Internal IP | Public Port | Role |
|---|---|---|---|
| `onlyplans-web` | 172.18.0.15 | :3000 | nginx — serves built React app |
| `onlyplans-openclaw-gateway` | 172.18.0.16 | :18889 (control UI), :3334 (Telnyx webhook) | AI agent — Telegram, voice calls, Claude |
| `supabase-kong` | 172.18.0.14 | :8000, :8443 | API gateway — single entry point for all Supabase services |
| `supabase-db` | 172.18.0.2 | :5432 (via pooler) | Postgres — stores all app data |
| `supabase-auth` | 172.18.0.9 | — | GoTrue — handles JWT issuance and phone/email OTP |
| `supabase-rest` | 172.18.0.11 | — | PostgREST — auto-generates REST API from Postgres schema |
| `realtime-dev.supabase-realtime` | 172.18.0.8 | — | Supabase Realtime — broadcasts DB change events over WebSocket |
| `supabase-edge-functions` | 172.18.0.13 | — | Deno runtime — runs Edge Functions (complete-task, process-call-result, etc.) |
| `supabase-storage` | 172.18.0.12 | — | File storage |
| `supabase-pooler` | 172.18.0.7 | :5432, :6543 | Supavisor — connection pooler for Postgres |
| `supabase-studio` | 172.18.0.5 | — | Supabase Studio dashboard (internal only) |
| `supabase-meta` | 172.18.0.6 | — | postgres-meta — schema introspection for Studio |
| `supabase-analytics` | 172.18.0.10 | — | Logflare — log aggregation |
| `supabase-vector` | 172.18.0.4 | — | Vector — log collector |
| `supabase-imgproxy` | 172.18.0.3 | — | Image transformation for Storage |

---

## The Three Main Players

### 1. `onlyplans-web` — Frontend (nginx)

Serves the compiled React + Vite app as **static files**. Once the browser downloads the JS bundle, all subsequent API traffic goes **directly from the user's browser to Kong** — nginx is not involved in any API calls, it is purely a file server.

- Source: `frontend/` (React + Vite + Tailwind)
- Built output: `/root/onlyplans/frontend/` on VPS
- Entry point: `index.html` → loads `/assets/index-*.js`
- Config: `/root/onlyplans/nginx/default.conf`

### 2. `supabase-kong` — API Gateway

Every request to the database layer goes through Kong. It validates the JWT on every request and routes to the correct internal service. Nothing in the app talks to Postgres directly except Supabase's own containers.

Kong routes:
| Path | Routes to |
|---|---|
| `/rest/v1/*` | `supabase-rest` (PostgREST — CRUD) |
| `/auth/v1/*` | `supabase-auth` (GoTrue — login/OTP) |
| `/realtime/v1/*` | `supabase-realtime` (WebSocket) |
| `/functions/v1/*` | `supabase-edge-functions` (Deno) |
| `/storage/v1/*` | `supabase-storage` |

### 3. `onlyplans-openclaw-gateway` — AI Agent

The brain of the app. Runs persistently, connected to Telegram and Telnyx. Uses the `service_role` JWT to read/write the database via `http://kong:8000`, bypassing RLS policies. The public-facing port `:3334` exists solely to receive Telnyx call webhooks.

Components active inside OpenClaw:
- **Telegram plugin** — 3 bot accounts (`@BetterOP_bot`, `@Onlyplans3_bot`, `@Onlyplans_2Bot`)
- **Voice-call plugin** — handles Telnyx outbound calls, webhook at `:3334/voice/webhook`
- **ClawTalk plugin** — connects to ClawTalk service for agent coordination
- **AI model** — Kimi K2.5 (via Moonshot API) as the primary model; Claude Sonnet 4.6 for the onboarding agent

---

## Request Flow Examples

### User sends a chat message

```
Browser
  │  POST http://187.77.69.95:8000/rest/v1/messages
  ▼
Kong  (validates anon JWT, checks rate limits)
  │
  ▼
supabase-rest (PostgREST)
  │  RLS policy: INSERT allowed only if user_id = auth.uid() AND type='user'
  ▼
supabase-db (Postgres stores the row)
  │
  ▼
supabase-realtime (broadcasts INSERT event on 'messages' channel)
  │
  ├──► Browser WebSocket receives event → React renders new message bubble
  │
  └──► OpenClaw (subscribed to Realtime) receives the message
         │  Calls Claude/Kimi API (external)
         ▼
       OpenClaw writes reply: POST http://kong:8000/rest/v1/messages (service_role)
         │
         ▼
       supabase-realtime broadcasts again → Browser shows agent reply
```

### Telnyx voice call ends

```
Telnyx (external)
  │  POST http://187.77.69.95:3334/voice/webhook
  ▼
OpenClaw voice-call plugin
  │  Processes transcript, determines user_status, writes summary
  │
  ├──► POST http://kong:8000/rest/v1/calls       (inserts call record)
  ├──► POST http://kong:8000/rest/v1/messages    (inserts call card for chat)
  └──► PATCH http://kong:8000/rest/v1/tasks      (updates task status/notes)
         │
         ▼
       supabase-realtime broadcasts → Browser shows call card in chat
       XP trigger fires on task update → user_stats updated → Gamification screen refreshes
```

### Agent initiates a proactive call

```
pg_cron job fires at tasks.reminder_at
  │
  ▼
Edge Function: trigger-call
  │  Reads user.phone + task details + mindprint from DB
  ▼
Telnyx API (external): initiates outbound call to user's phone
  │
  ▼
Call connects → AI conversation runs
  │
  ▼
Call ends → Telnyx fires webhook → (see "Telnyx voice call ends" above)
```

---

## Authentication Model

| Key type | Used by | Can bypass RLS? | How stored |
|---|---|---|---|
| `anon` key | Browser (frontend) | No | Baked into JS build via `VITE_SUPABASE_ANON_KEY` |
| User JWT | Browser (per-user) | No — scoped to `auth.uid()` | `localStorage` as `onlyplans_token` |
| `service_role` key | OpenClaw, Edge Functions | Yes — full DB access | VPS `.env` file, never in browser |

All user data tables have **Row Level Security (RLS)** enabled. The standard policy on every table is `user_id = auth.uid()` — users can only see and modify their own rows. The service_role key (used by OpenClaw and Edge Functions) bypasses RLS entirely.

---

## Database Schema Summary

```
auth.users          ← Supabase-managed, stores credentials
      │
      └── public.users          (profile + mindprint JSONB)
              │
              ├── public.tasks              (6 fields + due_date for scheduling)
              │       └── public.subtasks   (nested checklist items)
              │
              ├── public.messages           (chat history: text + call cards)
              │       └── public.calls      (call metadata, linked to messages)
              │
              └── public.user_stats         (XP, streak, level, milestones — updated by triggers)

public.levels       ← read-only XP threshold lookup (levels 1–6)
```

---

## Environment Variables (Frontend Build)

| Variable | Value | Purpose |
|---|---|---|
| `VITE_USE_MOCK` | `false` | Use real Supabase (not in-memory mock) |
| `VITE_SUPABASE_URL` | `http://187.77.69.95:8000` | Kong API gateway public URL |
| `VITE_SUPABASE_ANON_KEY` | `eyJ...` | Public JWT for unauthenticated requests |
| `VITE_DEV_AUTH_TOKEN` | `eyJ...` | Dev-only: pre-sets a long-lived user JWT (remove when real auth is built) |

---

## Key Networking Rules

- Containers on `onlyplans_default` reach each other by **service name**, e.g. `http://kong:8000`, `http://supabase-db:5432`
- The browser is **not** on the Docker network — it reaches services only via the publicly exposed ports (`:3000`, `:8000`)
- Postgres (`:5432`) is technically exposed on the VPS but should be firewall-restricted — only the Supabase containers need it
- The `openclaw-network` (a separate bridge network) exists from an earlier setup but is currently unused — all containers are on `onlyplans_default`

---

## Files on VPS

```
/root/onlyplans/
├── .env                      ← all secrets (JWT secret, API keys, DB password)
├── docker-compose.yml        ← defines all containers and their config
├── nginx/default.conf        ← nginx routing rules
├── frontend/                 ← built React app (dist output) — served by nginx
├── data/openclaw.json        ← OpenClaw config (agents, plugins, channels)
├── volumes/
│   ├── db/                   ← Postgres data directory
│   ├── functions/            ← Edge Function source (Deno)
│   ├── api/kong.yml          ← Kong declarative config
│   └── storage/              ← uploaded files
└── Ramona/                   ← old landing page HTML files (no longer served)
```
