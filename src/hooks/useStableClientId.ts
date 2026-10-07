import { useMemo } from 'react'

const STORAGE_KEY = 'swifter-lyrics-client-id'

export function useStableClientId() {
  return useMemo(() => {
    const current = localStorage.getItem(STORAGE_KEY)
    if (current) return current

    const created = crypto.randomUUID()
    localStorage.setItem(STORAGE_KEY, created)
    return created
  }, [])
}
