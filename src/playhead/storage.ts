/**
 * The one persisted value: when each film started, as epoch milliseconds.
 *
 * localStorage holds the durable copy. Renders read this in-memory cache, so playback keeps working when storage
 * is blocked, sandboxed or full (it just can't survive a refresh then). Keys include the film id, so a different
 * film never resumes on another film's clock.
 */
const PREFIX = "beat-player:startedAt:";

const cache = new Map<string, number | null>();
const listeners = new Set<() => void>();

export function readStartedAt(filmId: string): number | null {
  const key = PREFIX + filmId;
  if (!cache.has(key)) cache.set(key, parseStartedAt(readRaw(key), Date.now()));
  return cache.get(key) ?? null;
}

export function writeStartedAt(filmId: string, startedAt: number): void {
  const key = PREFIX + filmId;
  cache.set(key, startedAt);
  try {
    window.localStorage.setItem(key, String(startedAt));
  } catch {
    // Storage unavailable: the in-memory copy still drives playback.
  }
  for (const listener of listeners) listener();
}

export function subscribeStartedAt(onChange: () => void): () => void {
  // Another tab replayed the film or cleared storage: drop the cached copy and re-read.
  const onStorage = (event: StorageEvent) => {
    if (event.key === null) cache.clear();
    else if (event.key.startsWith(PREFIX)) cache.delete(event.key);
    else return;
    onChange();
  };
  listeners.add(onChange);
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onStorage);
  };
}

/** A stored value counts only if it is a whole, positive, past timestamp. Garbage or a future time reads as absent. */
export function parseStartedAt(raw: string | null, now: number): number | null {
  if (raw === null) return null;
  const value = Number(raw);
  return Number.isSafeInteger(value) && value > 0 && value <= now ? value : null;
}

function readRaw(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}
