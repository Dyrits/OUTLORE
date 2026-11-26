/** The outcome of an operation that can fail in an expected way: a value, or a named kind of failure. */
export type Result<Value, Kind extends string> = { ok: true; value: Value } | { kind: Kind; ok: false };

/** A successful `Result` holding `value`. */
export function succeed<Value>(value: Value): { ok: true; value: Value } {
  return { ok: true, value };
}

/** A failed `Result` of the named kind. */
export function fail<Kind extends string>(kind: Kind): { kind: Kind; ok: false } {
  return { kind, ok: false };
}
