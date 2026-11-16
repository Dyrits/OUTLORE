import { Clock, Effect } from "effect";

/** How many sources a window remembers at most; beyond it the oldest are forgotten, so memory stays bounded. */
const maxSources = 5_000;

/**
 * A sliding window of attempts per key: a key is admitted while it has fewer than `limit` attempts in the last
 * `windowMillis`. A refused attempt is not recorded, so a refusal never lengthens the wait. Kept in memory only.
 */
export class RateWindow {
  readonly #hits = new Map<string, number[]>();
  readonly #limit: number;
  readonly #maxKeys: number;
  readonly #windowMillis: number;

  constructor(limit: number, windowMillis: number, maxKeys: number = maxSources) {
    this.#limit = limit;
    this.#windowMillis = windowMillis;
    this.#maxKeys = maxKeys;
  }

  /** Whether `key` would be admitted at `now`, without recording an attempt. */
  has(key: string, now: number): boolean {
    return this.#recent(key, now).length < this.#limit;
  }

  /** Records an attempt at `now` and says whether it is within the limit. */
  admit(key: string, now: number): boolean {
    const recent = this.#recent(key, now);
    if (recent.length >= this.#limit) return false;
    recent.push(now);
    this.#hits.set(key, recent);
    if (this.#hits.size > this.#maxKeys) this.#forget(now);
    return true;
  }

  /** How many keys are remembered. */
  size(): number {
    return this.#hits.size;
  }

  #recent(key: string, now: number): number[] {
    return (this.#hits.get(key) ?? []).filter((hit) => now - hit < this.#windowMillis);
  }

  // Drops the keys whose attempts have all aged out; if that is not enough, the oldest keys.
  #forget(now: number): void {
    for (const [key, hits] of this.#hits) {
      const newest = hits.at(-1);
      if (newest === void 0 || now - newest >= this.#windowMillis) this.#hits.delete(key);
    }
    for (const key of this.#hits.keys()) {
      if (this.#hits.size <= this.#maxKeys) break;
      this.#hits.delete(key);
    }
  }
}

/** How many connection attempts one source may make. */
export type SourceLimits = {
  /** The most attempts in any hour. */
  readonly perHour: number;
  /** The most attempts in any minute. */
  readonly perMinute: number;
};

/**
 * The default attempts per source. A host and each paired device retry at 1, 2, 4, 8 and 16 s and then every 30 s:
 * 6 attempts in the first minute and at most about 130 in an hour. A host with three devices, all failing, makes
 * four times that, and stays under both limits.
 */
export const defaultSourceLimits = { perHour: 600, perMinute: 60 } as const satisfies SourceLimits;

/**
 * The gate in front of the rooms: counts connection attempts per source (an address) over a minute and an hour, so
 * that one source cannot wake a Durable Object at will. The counts live in the memory of the process that holds the
 * gate, which makes the limit approximate across Cloudflare locations and isolates, and costs no request.
 */
export class SourceGate {
  readonly #hour: RateWindow;
  readonly #minute: RateWindow;

  constructor(limits: Partial<SourceLimits> = {}) {
    const { perHour, perMinute } = { ...defaultSourceLimits, ...limits };
    this.#hour = new RateWindow(perHour, 3_600_000);
    this.#minute = new RateWindow(perMinute, 60_000);
  }

  /** Counts an attempt by `source`, and says whether it is admitted. A refused attempt is not counted. */
  admit(source: string): Effect.Effect<boolean> {
    return Clock.currentTimeMillis.pipe(
      Effect.map((now) => {
        if (!this.#minute.has(source, now) || !this.#hour.has(source, now)) return false;
        this.#minute.admit(source, now);
        this.#hour.admit(source, now);
        return true;
      }),
    );
  }
}
