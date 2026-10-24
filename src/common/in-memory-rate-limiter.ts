/**
 * A sliding-window rate limiter held in process memory.
 *
 * WHY THIS AND NOT @nestjs/throttler
 * The HTTP throttler guards controllers; it never sees a WebSocket frame. A
 * socket that has already completed the handshake can emit `chat:join` in a
 * tight loop and the request never passes through Express, so nothing counts it.
 * This is the smallest thing that closes that specific hole.
 *
 * WHAT IT IS NOT
 * It is per process. With more than one replica the effective limit is
 * `limit x replicas`, and an attacker holding several accounts is several keys,
 * so a determined attacker can still outrun it. Redis is the correct fix and
 * this does not pretend to be it. What it does buy: keying by user and by IP
 * rather than by socket means a reconnect does not reset the count, which is
 * enough to stop the trivial flood that is reachable without a shared store.
 */
export class InMemoryRateLimiter {
    private readonly hits = new Map<string, number[]>();

    constructor(
        private readonly limit: number,
        private readonly windowMs: number,
    ) {}

    /**
     * Record an attempt for `key` and report whether it is allowed.
     *
     * The timestamps are kept sorted because they are only ever appended in
     * order, so the window is dropped from the front in one pass.
     */
    allow(key: string, now: number = Date.now()): boolean {
        const cutoff = now - this.windowMs;
        const recent = this.hits.get(key);
        const kept = recent ? recent.filter((t) => t > cutoff) : [];

        if (kept.length >= this.limit) {
            // Store the pruned list so a blocked caller still ages out.
            this.hits.set(key, kept);
            return false;
        }

        kept.push(now);
        this.hits.set(key, kept);
        return true;
    }

    /** Drop keys whose window has fully elapsed, so idle callers do not leak. */
    prune(now: number = Date.now()): void {
        const cutoff = now - this.windowMs;
        for (const [key, times] of this.hits) {
            const kept = times.filter((t) => t > cutoff);
            if (kept.length === 0) this.hits.delete(key);
            else this.hits.set(key, kept);
        }
    }

    /** Visible for tests. */
    size(): number {
        return this.hits.size;
    }
}
