/**
 * VoiceButton
 *
 * A floating microphone button accessible on all screens.
 * Uses the browser's Web Speech API for speech-to-text transcription,
 * then sends the result as a user message via the messages service.
 *
 * ─── Voice-to-text (browser-native) ──────────────────────────────────────────
 * No backend call is needed for transcription — the browser handles it via
 * the Web Speech API (SpeechRecognition). Only the final text is sent to the API.
 *
 * Browser support: Chrome, Safari (webkit prefix), Edge.
 * Firefox does not support SpeechRecognition — button is hidden if unsupported.
 *
 * ─── On send ─────────────────────────────────────────────────────────────────
 * Calls: sendMessage(transcript)
 * API:   POST /rest/v1/messages  { type: 'user', kind: 'text', text: transcript }
 *
 * The agent processes the message and responds via the real-time subscription
 * in ChatScreen (subscribeToMessages).
 */
import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Mic, MicOff, X } from 'lucide-react'
import { useMessages } from '../context/MessagesContext'

export default function VoiceButton() {
  // addMessage from context — same function ChatScreen uses for typed messages.
  // Calling it here means the sent message appears in ChatScreen instantly,
  // because both share the same React state via MessagesContext.
  const { addMessage } = useMessages()

  const [listening,   setListening]   = useState(false)
  const [transcript,  setTranscript]  = useState('')
  const [supported,   setSupported]   = useState(false)
  const [sending,     setSending]     = useState(false)
  const [recognition, setRecognition] = useState(null)

  // ── Initialise SpeechRecognition on mount ───────────────────────────────────
  // Checks for browser support before enabling the button.
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SpeechRecognition) return
    setSupported(true)

    const rec = new SpeechRecognition()
    rec.continuous     = true
    rec.interimResults = true  // show partial transcription as user speaks
    rec.lang           = 'en-US'

    rec.onresult = (e) => {
      // Concatenate all result segments into one string
      const t = Array.from(e.results).map((r) => r[0].transcript).join('')
      setTranscript(t)
    }
    rec.onend = () => setListening(false)
    setRecognition(rec)
  }, [])

  // ── Toggle recording ────────────────────────────────────────────────────────
  const toggle = () => {
    if (!supported || !recognition) return
    if (listening) {
      recognition.stop()
      setListening(false)
    } else {
      setTranscript('')
      recognition.start()
      setListening(true)
    }
  }

  // ── Send the transcribed text ───────────────────────────────────────────────
  // API: POST /rest/v1/messages  { type: 'user', kind: 'text', text: transcript }
  //
  // addMessage() comes from MessagesContext — the same shared state that
  // ChatScreen reads. Calling it here is all that's needed for the message
  // to appear in the chat list. No events, no bus, no prop drilling.
  const handleSend = async () => {
    const text = transcript.trim()
    if (!text) return
    if (listening) recognition.stop()
    setSending(true)
    setListening(false)
    try {
      await addMessage(text)
      setTranscript('')
    } finally {
      setSending(false)
    }
  }

  const dismiss = () => {
    if (listening) recognition.stop()
    setListening(false)
    setTranscript('')
  }

  // Hide button entirely if browser doesn't support SpeechRecognition
  if (!supported) return null

  return (
    <>
      {/* Transcript overlay — shown while listening OR while a transcript exists.
          Keeping it visible after recording stops lets the user review the text
          and tap Send without racing against the overlay disappearing. */}
      <AnimatePresence>
        {(listening || transcript) && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="absolute bottom-28 left-4 right-4 z-50 rounded-2xl p-4 shadow-lg border"
            style={{ background: '#fff', borderColor: '#D0BFA5' }}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1">
                <p className="text-xs font-medium mb-1" style={{ color: '#B12A42' }}>
                  {listening ? 'Listening…' : 'Review & send'}
                </p>
                {/* Live transcript — updated as user speaks via rec.onresult */}
                <p className="text-sm min-h-[40px]" style={{ color: '#1A1A1A' }}>
                  {transcript || <span style={{ color: '#6B7A7F' }}>Start speaking…</span>}
                </p>
              </div>
              <button onClick={dismiss} style={{ color: '#6B7A7F' }}>
                <X size={16} />
              </button>
            </div>

            {/* Send button — appears once there's a transcript */}
            {transcript && (
              <button
                onClick={handleSend}
                disabled={sending}
                className="mt-3 w-full py-2 rounded-xl text-white text-sm font-medium transition-opacity"
                style={{ background: '#B12A42', opacity: sending ? 0.6 : 1 }}
              >
                {sending ? 'Sending…' : 'Send'}
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating mic button */}
      <motion.button
        onClick={toggle}
        whileTap={{ scale: 0.9 }}
        className="absolute bottom-6 right-6 z-50 w-14 h-14 rounded-full shadow-lg flex items-center justify-center"
        style={{ background: listening ? '#023544' : '#B12A42' }}
        aria-label={listening ? 'Stop recording' : 'Start voice input'}
      >
        {listening ? (
          <motion.div
            animate={{ scale: [1, 1.2, 1] }}
            transition={{ repeat: Infinity, duration: 1 }}
          >
            <MicOff size={22} color="white" />
          </motion.div>
        ) : (
          <Mic size={22} color="white" />
        )}
      </motion.button>
    </>
  )
}
