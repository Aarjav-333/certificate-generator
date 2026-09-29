import { useEffect, useId, useRef, type ReactNode } from 'react'

/** Accessible modal built on the native <dialog> element (focus trap + Esc for free). */
export function Dialog({
  open,
  onClose,
  title,
  children,
  footer,
}: {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  footer?: ReactNode
}) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (open && !d.open) d.showModal()
    if (!open && d.open) d.close()
  }, [open])
  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onClose={onClose}
      onCancel={(e) => {
        e.preventDefault()
        onClose()
      }}
      onClick={(e) => {
        if (e.target === ref.current) onClose()
      }}
      className="m-auto w-[min(32rem,calc(100vw-2rem))] rounded-lg border border-stone-200 bg-white p-0 text-stone-900 shadow-xl backdrop:bg-stone-900/40"
    >
      <div className="border-b border-stone-200 px-5 py-4">
        <h2 id={titleId} className="text-base font-semibold">
          {title}
        </h2>
      </div>
      <div className="max-h-[60vh] overflow-y-auto px-5 py-4 text-sm">{children}</div>
      {footer && <div className="flex justify-end gap-2 border-t border-stone-200 px-5 py-3">{footer}</div>}
    </dialog>
  )
}
