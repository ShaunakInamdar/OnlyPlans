# The Baseline

A hackathon starter template. Clone, fill in env vars, and start building.

## Stack

| Layer | Tech |
|-------|------|
| Framework | Next.js 15 (App Router, TypeScript) |
| Auth | Clerk |
| Database | Supabase (Postgres) |
| AI | Anthropic Claude |
| Styling | Tailwind CSS |

## Quick Start

```bash
# 1. Clone and install
git clone https://github.com/YOUR_USERNAME/the-baseline.git
cd the-baseline
npm install

# 2. Set up environment variables
cp .env.example .env.local
# Fill in your keys (see below)

# 3. Run
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Environment Variables

Copy `.env.example` → `.env.local` and fill these in:

### Clerk (auth)
1. Go to [dashboard.clerk.com](https://dashboard.clerk.com) → Create application
2. Copy **Publishable Key** and **Secret Key** into `.env.local`

### Supabase (database)
1. Go to [supabase.com](https://supabase.com) → New project
2. Settings → API → copy **URL**, **anon key**, and **service_role key**

### Anthropic (AI)
1. Go to [console.anthropic.com](https://console.anthropic.com) → API Keys
2. Copy your key into `.env.local`

---

## Supabase Setup

Run this SQL in your Supabase SQL editor to create the example table:

```sql
create table items (
  id uuid default gen_random_uuid() primary key,
  user_id text not null,
  content text,
  created_at timestamptz default now()
);

-- Row-level security: users can only see their own rows
alter table items enable row level security;

create policy "Users see own items" on items
  for all using (user_id = auth.uid()::text);
```

> **Note:** The API routes use the service role key (bypasses RLS), so the policy above applies to client-side queries only. Adjust as needed.

---

## Project Structure

```
the-baseline/
├── app/
│   ├── layout.tsx              # Root layout (ClerkProvider)
│   ├── page.tsx                # Landing page
│   ├── dashboard/
│   │   └── page.tsx            # Protected dashboard + AI chat
│   ├── sign-in/[[...sign-in]]/
│   │   └── page.tsx            # Clerk sign-in
│   ├── sign-up/[[...sign-up]]/
│   │   └── page.tsx            # Clerk sign-up
│   └── api/
│       ├── ai/route.ts         # POST /api/ai — Claude chat endpoint
│       └── data/route.ts       # GET/POST/DELETE /api/data — Supabase CRUD
├── components/
│   └── chat.tsx                # Client-side chat UI
├── lib/
│   ├── ai.ts                   # Anthropic client + helpers
│   └── supabase.ts             # Supabase client (client + server)
├── middleware.ts               # Clerk route protection
└── .env.example                # All required env vars
```

---

## Extending It

- **Add a new page:** create `app/your-page/page.tsx`
- **Protect a route:** add its path to `isProtectedRoute` in `middleware.ts`
- **Add a new table:** create it in Supabase and add routes in `app/api/`
- **Change the AI model:** edit `model` in `lib/ai.ts` and `app/api/ai/route.ts`

---

## Deploy

The easiest deploy target is [Vercel](https://vercel.com):

```bash
npx vercel
```

Add all your `.env.local` variables in the Vercel project settings.
