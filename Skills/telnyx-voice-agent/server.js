require('dotenv').config();

const express = require('express');
const axios = require('axios');
const Anthropic = require('@anthropic-ai/sdk');
const { SYSTEM_PROMPT } = require('./onboarding');

// ─── Config ──────────────────────────────────────────────────────────────────

const PORT = process.env.PORT || 3000;
const TELNYX_API_KEY = process.env.TELNYX_API_KEY;
const TELNYX_FROM_NUMBER = process.env.TELNYX_FROM_NUMBER;   // E.164 e.g. +12025551234
const TELNYX_CONNECTION_ID = process.env.TELNYX_CONNECTION_ID; // From Telnyx portal
const WEBHOOK_BASE_URL = process.env.WEBHOOK_BASE_URL;         // e.g. https://abc.ngrok.io
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

// Validate required env vars on startup
const required = {
  TELNYX_API_KEY,
  TELNYX_FROM_NUMBER,
  TELNYX_CONNECTION_ID,
  WEBHOOK_BASE_URL,
  ANTHROPIC_API_KEY,
};
const missing = Object.entries(required).filter(([, v]) => !v).map(([k]) => k);
if (missing.length) {
  console.error('Missing required env vars:', missing.join(', '));
  process.exit(1);
}

// ─── Clients ─────────────────────────────────────────────────────────────────

const telnyxApi = axios.create({
  baseURL: 'https://api.telnyx.com/v2',
  headers: {
    Authorization: `Bearer ${TELNYX_API_KEY}`,
    'Content-Type': 'application/json',
  },
});

const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

// ─── In-memory session store ──────────────────────────────────────────────────
// Keyed by call_control_id. Each session holds the conversation history.

const sessions = {};

// ─── Telnyx Call Control helpers ─────────────────────────────────────────────

// Speak text, then start transcription once TTS finishes (via call.speak.ended).
async function speakAndListen(callControlId, text) {
  const session = sessions[callControlId];
  if (session) session.waitingForSpeakEnd = true;
  await telnyxApi.post(`/calls/${callControlId}/actions/speak`, {
    payload: text,
    voice: 'female',
    language: 'en-US',
  });
}

async function startListening(callControlId) {
  await telnyxApi.post(`/calls/${callControlId}/actions/transcription_start`, {
    transcription_engine: 'B',
    language: 'en-US',
  });
}

async function stopListening(callControlId) {
  await telnyxApi.post(`/calls/${callControlId}/actions/transcription_stop`, {}).catch(() => {});
}

async function speak(callControlId, text) {
  await telnyxApi.post(`/calls/${callControlId}/actions/speak`, {
    payload: text,
    voice: 'female',
    language: 'en-US',
  });
}

async function hangup(callControlId) {
  await telnyxApi.post(`/calls/${callControlId}/actions/hangup`, {});
}

// ─── AI response ─────────────────────────────────────────────────────────────

async function getAIResponse(history) {
  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 200,
    system: SYSTEM_PROMPT,
    messages: history.length === 0 ? [{ role: 'user', content: 'begin' }] : history,
  });
  return message.content[0].text.trim();
}

// ─── Conversation logic ───────────────────────────────────────────────────────

async function handleTurn(callControlId, userTranscript) {
  const session = sessions[callControlId];
  if (!session) return;

  if (userTranscript) {
    session.history.push({ role: 'user', content: userTranscript });
    console.log(`[${callControlId}] USER: ${userTranscript}`);
  }

  const aiResponse = await getAIResponse(session.history);
  const isComplete = aiResponse.includes('[ONBOARDING_COMPLETE]');
  const cleanResponse = aiResponse.replace('[ONBOARDING_COMPLETE]', '').trim();

  session.history.push({ role: 'assistant', content: cleanResponse });
  console.log(`[${callControlId}] AGENT: ${cleanResponse}`);

  if (isComplete) {
    await speak(callControlId, cleanResponse);
    // Give TTS time to finish before hanging up
    setTimeout(() => hangup(callControlId), 5000);
  } else {
    await speakAndListen(callControlId, cleanResponse);
  }
}

// ─── Express app ─────────────────────────────────────────────────────────────

const app = express();
app.use(express.json());

// POST /call?to=+12025559999
// Initiates an outbound call to the given number.
app.post('/call', async (req, res) => {
  const to = req.query.to || req.body.to;
  if (!to) return res.status(400).json({ error: 'Missing "to" phone number' });

  try {
    const { data } = await telnyxApi.post('/calls', {
      connection_id: TELNYX_CONNECTION_ID,
      to,
      from: TELNYX_FROM_NUMBER,
      webhook_url: `${WEBHOOK_BASE_URL}/webhook`,
      webhook_events_failover_url: `${WEBHOOK_BASE_URL}/webhook`,
      answer_on_human_only: false,
      record_channels: 'dual', // optional — remove if you don't want recording
    });

    const callControlId = data.data.call_control_id;
    sessions[callControlId] = { history: [], to };
    console.log(`[CALL INITIATED] call_control_id=${callControlId} to=${to}`);
    res.json({ call_control_id: callControlId, status: 'initiated' });
  } catch (err) {
    console.error('Failed to initiate call:', err.response?.data || err.message);
    res.status(500).json({ error: err.response?.data || err.message });
  }
});

// POST /webhook
// Receives all Telnyx call events.
app.post('/webhook', async (req, res) => {
  // Respond immediately — Telnyx requires a fast 200
  res.sendStatus(200);

  const { event_type, payload } = req.body?.data || {};
  if (!event_type || !payload) return;

  const callControlId = payload.call_control_id;
  console.log(`[EVENT] ${event_type} call_control_id=${callControlId}`);

  try {
    switch (event_type) {

      case 'call.answered': {
        // Call picked up — start onboarding
        if (!sessions[callControlId]) {
          sessions[callControlId] = { history: [] };
        }
        await handleTurn(callControlId, null); // null = no user input yet, AI opens
        break;
      }

      case 'call.speak.ended': {
        // TTS finished — start listening for the user's response
        const session = sessions[callControlId];
        if (session?.waitingForSpeakEnd) {
          session.waitingForSpeakEnd = false;
          await startListening(callControlId);
        }
        break;
      }

      case 'call.transcription': {
        const data = payload.transcription_data;
        if (!data?.is_final || !data.transcript?.trim()) break;
        // Got a complete utterance — stop transcription and process it
        await stopListening(callControlId);
        await handleTurn(callControlId, data.transcript.trim());
        break;
      }

      case 'call.hangup': {
        const session = sessions[callControlId];
        console.log(`[CALL ENDED] call_control_id=${callControlId}`);
        if (session?.history?.length) {
          console.log(`[SESSION SUMMARY] ${session.history.length} turns recorded.`);
        }
        delete sessions[callControlId];
        break;
      }

    }
  } catch (err) {
    console.error(`[ERROR] handling ${event_type}:`, err.message);
  }
});

// Health check
app.get('/health', (req, res) => res.json({ status: 'ok' }));

app.listen(PORT, () => {
  console.log(`Only Plans voice agent running on port ${PORT}`);
  console.log(`Webhook URL: ${WEBHOOK_BASE_URL}/webhook`);
  console.log(`Initiate a call: POST ${WEBHOOK_BASE_URL}/call?to=+1XXXXXXXXXX`);
});
