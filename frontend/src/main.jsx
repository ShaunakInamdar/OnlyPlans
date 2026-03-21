import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { setAuthToken } from './api/client.js'

// Dev-only: pre-set a long-lived JWT so the app works without a login screen.
// Remove this when a real auth flow is implemented.
if (import.meta.env.VITE_DEV_AUTH_TOKEN) {
  setAuthToken(import.meta.env.VITE_DEV_AUTH_TOKEN)
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
