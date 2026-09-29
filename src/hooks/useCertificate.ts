import { useCallback, useMemo, useState } from 'react'
import { blankSignatory } from '../lib/config'
import { MAX_SIGNATORIES, type CertificateConfig, type Signatory } from '../types/certificate'

type Patch<K extends keyof CertificateConfig> = Partial<CertificateConfig[K]>

/**
 * Certificate state with small, typed updaters. Updates are immutable spreads
 * (not deep clones) so large embedded images are never copied on keystrokes.
 */
export function useCertificate(initial: CertificateConfig) {
  const [config, setConfig] = useState(initial)

  const patch = useCallback(<K extends 'institution' | 'participant' | 'event' | 'eventGraphic' | 'background' | 'design'>(key: K, value: Patch<K>) => {
    setConfig((c) => ({ ...c, [key]: { ...c[key], ...value } }))
  }, [])

  const actions = useMemo(
    () => ({
      set: (value: Partial<CertificateConfig>) => setConfig((c) => ({ ...c, ...value })),
      replace: (next: CertificateConfig) => setConfig(next),
      institution: (v: Patch<'institution'>) => patch('institution', v),
      participant: (v: Patch<'participant'>) => patch('participant', v),
      event: (v: Patch<'event'>) => patch('event', v),
      eventGraphic: (v: Patch<'eventGraphic'>) => patch('eventGraphic', v),
      background: (v: Patch<'background'>) => patch('background', v),
      design: (v: Patch<'design'>) => patch('design', v),
      signatory: (id: string, v: Partial<Signatory>) =>
        setConfig((c) => ({ ...c, signatories: c.signatories.map((s) => (s.id === id ? { ...s, ...v } : s)) })),
      addSignatory: () =>
        setConfig((c) =>
          c.signatories.length >= MAX_SIGNATORIES ? c : { ...c, signatories: [...c.signatories, blankSignatory()] },
        ),
      removeSignatory: (id: string) => setConfig((c) => ({ ...c, signatories: c.signatories.filter((s) => s.id !== id) })),
      moveSignatory: (id: string, dir: -1 | 1) =>
        setConfig((c) => {
          const i = c.signatories.findIndex((s) => s.id === id)
          const j = i + dir
          if (i < 0 || j < 0 || j >= c.signatories.length) return c
          const list = [...c.signatories]
          ;[list[i], list[j]] = [list[j], list[i]]
          return { ...c, signatories: list }
        }),
    }),
    [patch],
  )

  return { config, actions }
}

export type CertificateActions = ReturnType<typeof useCertificate>['actions']
