import { useEffect, useState } from 'react'

// Persisted state backed by localStorage. Falls back gracefully if unavailable.
export function useLocalStorage(key, initial) {
  const [value, setValue] = useState(() => {
    try {
      const stored = localStorage.getItem(key)
      return stored ? JSON.parse(stored) : initial
    } catch {
      return initial
    }
  })

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value))
    } catch {
      // storage full / unavailable — ignore
    }
  }, [key, value])

  return [value, setValue]
}
