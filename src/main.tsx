import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './styles.css'

const STORAGE_RESET_KEY = 'swifter-lyrics-storage-reset'
const STORAGE_RESET_VERSION = '2026-10-07-01'

if (localStorage.getItem(STORAGE_RESET_KEY) !== STORAGE_RESET_VERSION) {
  localStorage.clear()
  localStorage.setItem(STORAGE_RESET_KEY, STORAGE_RESET_VERSION)
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
