/**
 * A cache of fetched images by identifier, holding at most `limit` characters of data: when a fetched image takes it over the limit, the least recently shown ones are dropped, and shown again they are fetched again.
 * A fetch still running is kept until it settles, so showing the same image twice makes one request; a failed fetch is forgotten.
 * An image the app already holds can be put in, so it is not fetched back.
 */
export function imageCache(limit: number) {
  const entries = new Map<string, { promise: Promise<string>; size: number; value: string | null }>();
  let total = 0;
  const evict = (keep: string) => {
    for (const [id, entry] of entries) {
      if (total <= limit) return;
      // An image still being fetched counts nothing yet, and the one just fetched or put stays however large.
      if (entry.size === 0 || id === keep) continue;
      total -= entry.size;
      entries.delete(id);
    }
  };
  return {
    /** Forgets the image, or the fetch still running for it. */
    forget(id: string) {
      const entry = entries.get(id);
      if (entry === undefined) return;
      total -= entry.size;
      entries.delete(id);
    },
    has: (id: string) => entries.has(id),
    /** The image's data, fetched with `fetch` unless already held. */
    load(id: string, fetch: () => Promise<string>) {
      const held = entries.get(id);
      if (held !== undefined) {
        // Most recently shown goes last.
        entries.delete(id);
        entries.set(id, held);
        return held.promise;
      }
      const entry: { promise: Promise<string>; size: number; value: string | null } = {
        promise: fetch(),
        size: 0,
        value: null,
      };
      entries.set(id, entry);
      entry.promise.then(
        (data) => {
          if (entries.get(id) !== entry) return;
          entry.value = data;
          entry.size = data.length;
          total += data.length;
          evict(id);
        },
        () => {
          if (entries.get(id) === entry) entries.delete(id);
        },
      );
      return entry.promise;
    },
    /** The already-resolved image data if held, or null while uncached or still loading. */
    peek: (id: string): string | null => entries.get(id)?.value ?? null,
    /** Holds an image the app already has, unless one is held for the identifier. */
    put(id: string, data: string) {
      if (entries.has(id)) return;
      entries.set(id, { promise: Promise.resolve(data), size: data.length, value: data });
      total += data.length;
      evict(id);
    },
    get size() {
      return total;
    },
  };
}
