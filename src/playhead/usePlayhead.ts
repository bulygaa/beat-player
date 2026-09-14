import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { frameAt, type Frame } from "./frame";
import { readStartedAt, subscribeStartedAt, writeStartedAt } from "./storage";
import type { ValidFilm } from "./validate";

export type Playhead = {
  /** null until mounted: the server render and the hydration render show an empty stage, never beat 1. */
  frame: Frame | null;
  replay: () => void;
};

/**
 * State is two clock readings: when this film started (the persisted store) and the latest Date.now() sample,
 * refreshed once per animation frame. The frame (beat index, time into the beat, ...) is derived from them during
 * render and never stored. Both read as null on the server and during hydration, so the markup matches.
 */
export function usePlayhead(film: ValidFilm): Playhead {
  const startedAt = useSyncExternalStore(subscribeStartedAt, () => readStartedAt(film.id), () => null);
  const [now, setNow] = useState<number | null>(null);

  // First visit, or a corrupt or unreadable value: the film starts now. Re-reading keeps this idempotent.
  useEffect(() => {
    if (readStartedAt(film.id) === null) writeStartedAt(film.id, Date.now());
  }, [film.id, startedAt]);

  // One clock sample per frame, until the film ends. A hidden tab pauses requestAnimationFrame but not the
  // clock, so the first frame back reads Date.now() and lands at the true position.
  useEffect(() => {
    if (startedAt === null) return;
    let request = requestAnimationFrame(function tick() {
      const sample = Date.now();
      setNow(sample);
      if (sample - startedAt < film.totalMs) request = requestAnimationFrame(tick);
    });
    return () => cancelAnimationFrame(request);
  }, [startedAt, film.totalMs]);

  const replay = useCallback(() => writeStartedAt(film.id, Date.now()), [film.id]);

  const frame = startedAt === null || now === null ? null : frameAt(film.beats, now - startedAt);
  return { frame, replay };
}
