/**
 * Lightweight fixed-window rate limiter kept in function memory.
 *
 * Limitation (documented in the README): Vercel may run several instances of
 * a function, each with its own counters, so this is a per-instance,
 * best-effort limit — it stops runaway loops and casual abuse, not a
 * determined distributed attacker. A global limit can be added with a Vercel
 * WAF rate-limit rule without changing this code.
 */
const WINDOW_MS = 60_000
const buckets = new Map<string, { start: number; used: number }>()

export interface RateResult {
  ok: boolean
  remaining: number
  /** Seconds until the window resets. */
  retryAfter: number
}

export function takeTokens(key: string, cost: number, limit: number, now = Date.now()): RateResult {
  if (buckets.size > 10_000) {
    for (const [k, b] of buckets) if (now - b.start >= WINDOW_MS) buckets.delete(k)
  }
  let b = buckets.get(key)
  if (!b || now - b.start >= WINDOW_MS) {
    b = { start: now, used: 0 }
    buckets.set(key, b)
  }
  const retryAfter = Math.max(1, Math.ceil((b.start + WINDOW_MS - now) / 1000))
  if (b.used + cost > limit) return { ok: false, remaining: Math.max(0, limit - b.used), retryAfter }
  b.used += cost
  return { ok: true, remaining: limit - b.used, retryAfter }
}

/** For tests. */
export function resetRateLimits(): void {
  buckets.clear()
}
