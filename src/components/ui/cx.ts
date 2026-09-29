/** Join class names, skipping falsy values. */
export const cx = (...c: Array<string | false | null | undefined>) => c.filter(Boolean).join(' ')
