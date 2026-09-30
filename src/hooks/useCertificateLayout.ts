import { useCallback, useDeferredValue, useEffect, useRef, useState } from 'react'
import { loadFonts } from '../lib/fonts/loader'
import type { CertificateLayout } from '../lib/layout/displayList'
import { getTemplate } from '../templates'
import { composeCertificate, requiredFonts } from '../templates/engine'
import type { CertificateConfig } from '../types/certificate'

interface State {
  layout: CertificateLayout | null
  error: string | null
  loading: boolean
  /** An automatic retry is scheduled after a failed font download. */
  retrying: boolean
}

/** Delays (ms) before automatic retries of a failed font download. */
const RETRY_DELAYS = [1000, 3000, 8000]

/**
 * Compose the live preview. Fonts load asynchronously (once per face); after
 * that composition is synchronous and fast, so the preview tracks every edit.
 *
 * A failed font download (network blip, flaky connection) is retried
 * automatically a few times with back-off; `retry()` lets the user try again
 * after that. The font loader drops failed downloads from its cache, so every
 * attempt fetches afresh.
 */
export function useCertificateLayout(config: CertificateConfig): State & { retry: () => void } {
  const deferred = useDeferredValue(config)
  const [state, setState] = useState<State>({ layout: null, error: null, loading: true, retrying: false })
  // Bumped to re-run the effect for a retry without changing the config.
  const [attempt, setAttempt] = useState(0)
  const autoRetries = useRef(0)

  useEffect(() => {
    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | undefined
    loadFonts(requiredFonts(deferred))
      .then((fonts) => {
        if (cancelled) return
        autoRetries.current = 0
        const layout = composeCertificate(deferred, getTemplate(deferred.templateId), fonts)
        setState({ layout, error: null, loading: false, retrying: false })
      })
      .catch((e: unknown) => {
        if (cancelled) return
        console.error(e)
        const delay = RETRY_DELAYS[autoRetries.current]
        if (delay !== undefined) {
          autoRetries.current += 1
          timer = setTimeout(() => setAttempt((a) => a + 1), delay)
        }
        const message = /font/i.test(e instanceof Error ? e.message : '')
          ? 'The certificate fonts could not be downloaded. Check your internet connection.'
          : 'The certificate could not be rendered.'
        setState((s) => ({ ...s, error: message, loading: false, retrying: delay !== undefined }))
      })
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [deferred, attempt])

  const retry = useCallback(() => {
    autoRetries.current = 0
    setState((s) => ({ ...s, loading: true, retrying: false }))
    setAttempt((a) => a + 1)
  }, [])

  return { ...state, retry }
}
