import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './styles.css'

// Atualize esta versão apenas quando for necessário invalidar dados antigos.
const STORAGE_RESET_KEY = 'swifter-lyrics-storage-reset'
const STORAGE_RESET_VERSION = '2026-10-09-03'

function resetOldBrowserData() {
  try {
    if (localStorage.getItem(STORAGE_RESET_KEY) === STORAGE_RESET_VERSION) return

    // O reset é executado somente uma vez por origem e por versão.
    // Cada endereço onrender.com possui seu próprio armazenamento.
    localStorage.clear()
    sessionStorage.clear()
    localStorage.setItem(STORAGE_RESET_KEY, STORAGE_RESET_VERSION)
  } catch (error) {
    console.warn('Não foi possível limpar todo o armazenamento local:', error)
  }

  // Browser caches e IndexedDB são assíncronos: limpe o que existir, sem
  // impedir a abertura do site em navegadores que não oferecem essas APIs.
  if ('caches' in window) {
    void caches.keys()
      .then((names) => Promise.all(names.map((name) => caches.delete(name))))
      .catch((error) => console.warn('Falha ao limpar CacheStorage:', error))
  }

  if ('indexedDB' in window && typeof indexedDB.databases === 'function') {
    void indexedDB.databases()
      .then((databases) => {
        for (const database of databases) {
          if (database.name) indexedDB.deleteDatabase(database.name)
        }
      })
      .catch((error) => console.warn('Falha ao limpar IndexedDB:', error))
  }

  if ('serviceWorker' in navigator) {
    void navigator.serviceWorker.getRegistrations()
      .then((registrations) => Promise.all(registrations.map((registration) => registration.unregister())))
      .catch((error) => console.warn('Falha ao remover service workers antigos:', error))
  }
}

resetOldBrowserData()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
