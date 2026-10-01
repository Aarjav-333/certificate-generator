import { useEffect, useRef, useState } from 'react'
import { saveDraft } from '../lib/storage.js'
import type { CertificateConfig } from '../types/certificate.js'

export type AutosaveStatus = 'idle' | 'saving' | 'saved' | 'error'

/** Debounced autosave of the working draft so a refresh never loses work. */
export function useAutosave(config: CertificateConfig, enabled: boolean, delay = 800): AutosaveStatus {
  const [status, setStatus] = useState<AutosaveStatus>('idle')
  const first = useRef(true)
  useEffect(() => {
    if (!enabled) return
    if (first.current) {
      first.current = false
      return
    }
    const t = setTimeout(() => {
      setStatus('saving')
      saveDraft(config)
        .then(() => setStatus('saved'))
        .catch(() => setStatus('error'))
    }, delay)
    return () => clearTimeout(t)
  }, [config, enabled, delay])
  return status
}
