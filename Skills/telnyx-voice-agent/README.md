# Only Plans — Telnyx Voice Agent

Outbound AI phone call that runs the Only Plans onboarding script. Powered by Telnyx Call Control + Claude.

## How it works

1. You POST `/call?to=+1XXXXXXXXXX` to trigger an outbound call
2. Telnyx calls the number and hits `/webhook` when answered
3. Claude runs the onboarding conversation (speak → listen → respond loop)
4. On completion, the session summary is logged (ready to save to DB)

---

## Local setup

### 1. Install dependencies
```bash
npm install
```

### 2. Configure env vars
```bash
cp .env.example .env
# Fill in all values
```

You need:
- **TELNYX_API_KEY** — from [telnyx.com/account/api-keys](https://portal.telnyx.com/#/app/api-keys)
- **TELNYX_FROM_NUMBER** — a Telnyx phone number in E.164 format
- **TELNYX_CONNECTION_ID** — from Telnyx portal > Connections (create a Call Control connection if you haven't)
- **ANTHROPIC_API_KEY** — from [console.anthropic.com](https://console.anthropic.com)
- **WEBHOOK_BASE_URL** — your public URL (use ngrok for local testing)

### 3. Expose localhost with ngrok
```bash
ngrok http 3000
# Copy the https:// URL into WEBHOOK_BASE_URL in your .env
```

### 4. Start the server
```bash
npm start
# or: npm run dev  (auto-restarts on change)
```

### 5. Trigger a call
```bash
curl -X POST "http://localhost:3000/call?to=+1XXXXXXXXXX"
```

---

## VPS / OpenClaw deployment

1. Copy this folder to your VPS
2. Set env vars (or use a `.env` file)
3. Run `npm install && npm start`
4. Point `WEBHOOK_BASE_URL` to your VPS public URL
5. No ngrok needed — Telnyx will call your VPS directly

For OpenClaw integration, the `/call` endpoint is the entry point. OpenClaw can trigger it with a user's phone number when onboarding starts.

---

## Files

| File | Purpose |
|------|---------|
| `server.js` | Express server — webhook handler + call initiation |
| `onboarding.js` | System prompt that drives the AI conversation |
| `.env.example` | Template for required env vars |
