import type { Beat } from "../film/beats";

/**
 * Everything the player shows, derived from elapsed time alone. Nothing here is stored between frames:
 * the same (beats, elapsed) always yields the same frame, which is what makes refresh-resume exact.
 */
export type Frame = {
  readonly status: "playing" | "ended";
  readonly index: number;
  readonly beat: Beat;
  readonly msIntoBeat: number;
  readonly elapsedMs: number;
};

const FADE_IN_MS = 600;
const FADE_OUT_MS = 400;

/** Walks prefix sums of durationMs. Beats occupy half-open intervals [start, end). */
export function frameAt(beats: readonly Beat[], rawElapsedMs: number): Frame {
  const totalMs = beats.reduce((sum, beat) => sum + beat.durationMs, 0);
  // A clock that moved backwards reads as the start; anything past the end reads as the end.
  const elapsedMs = clamp(rawElapsedMs, 0, totalMs);

  let startMs = 0;
  for (const [index, beat] of beats.entries()) {
    const endMs = startMs + beat.durationMs;
    if (elapsedMs < endMs) return { status: "playing", index, beat, msIntoBeat: elapsedMs - startMs, elapsedMs };
    startMs = endMs;
  }

  const index = beats.length - 1;
  return { status: "ended", index, beat: beats[index], msIntoBeat: beats[index].durationMs, elapsedMs: totalMs };
}

/**
 * The envelope for the one transition, from 0 (hidden) to 1 (fully shown). CSS maps it to opacity and rise.
 * The fade windows shrink for short beats (at most 35% of a beat in total), so a beat of any length peaks at 1.
 * A beat only fades out if another beat follows it; the last one holds.
 */
export function reveal(frame: Frame, beatCount: number): number {
  if (frame.status === "ended") return 1;
  const durationMs = frame.beat.durationMs;
  const fadeIn = frame.msIntoBeat / Math.min(FADE_IN_MS, durationMs * 0.2);
  const hasNext = frame.index < beatCount - 1;
  const fadeOut = hasNext ? (durationMs - frame.msIntoBeat) / Math.min(FADE_OUT_MS, durationMs * 0.15) : Infinity;
  return clamp(Math.min(fadeIn, fadeOut), 0, 1);
}

/** How full each beat's track segment is, from 0 to 1, in beat order. */
export function segmentFill(beats: readonly Beat[], elapsedMs: number): number[] {
  let startMs = 0;
  return beats.map((beat) => {
    const fill = clamp((elapsedMs - startMs) / beat.durationMs, 0, 1);
    startMs += beat.durationMs;
    return fill;
  });
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
