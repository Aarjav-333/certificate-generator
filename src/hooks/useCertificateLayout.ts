import { useDeferredValue, useEffect, useState } from 'react'
import { loadFonts } from '../lib/fonts/loader'
import type { CertificateLayout } from '../lib/layout/displayList'
import { getTemplate } from '../templates'
import { composeCertificate, requiredFonts } from '../templates/engine'
import type { CertificateConfig } from '../types/certificate'

interface State {
  layout: CertificateLayout | null
  error: string | null
  loading: boolean
}

/**
 * Compose the live preview. Fonts load asynchronously (once per face); after
 * that composition is synchronous and fast, so the preview tracks every edit.
 */
export function useCertificateLayout(config: CertificateConfig): State {
  const deferred = useDeferredValue(config)
  const [state, setState] = useState<State>({ layout: null, error: null, loading: true })

  useEffect(() => {
    let cancelled = false
    loadFonts(requiredFonts(deferred))
      .then((fonts) => {
        if (cancelled) return
        const layout = composeCertificate(deferred, getTemplate(deferred.templateId), fonts)
        setState({ layout, error: null, loading: false })
      })
      .catch((e: unknown) => {
        if (cancelled) return
        console.error(e)
        setState((s) => ({ ...s, error: e instanceof Error ? e.message : 'Could not render the certificate.', loading: false }))
      })
    return () => {
      cancelled = true
    }
  }, [deferred])

  return state
}
