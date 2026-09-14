import type { Beat } from "../film/beats";

export const FILM_LENGTH_MS = 30_000;

/**
 * A beat array that passed validation. Only `validateFilm` produces one, and `BeatPlayer` accepts nothing else,
 * so an unvalidated array cannot reach the player.
 */
export type ValidFilm = {
  readonly beats: readonly Beat[];
  readonly totalMs: typeof FILM_LENGTH_MS;
  /** Content fingerprint. It keys the persisted startedAt, so a different film never resumes on another's clock. */
  readonly id: string;
  readonly __brand: "ValidFilm";
};

export type FilmError =
  | { kind: "empty" }
  | { kind: "bad-beat"; index: number; field: "title" | "text" | "durationMs" }
  | { kind: "wrong-total"; totalMs: number; expectedMs: typeof FILM_LENGTH_MS };

export type Validation = { ok: true; film: ValidFilm } | { ok: false; error: FilmError };

export function validateFilm(beats: readonly Beat[]): Validation {
  if (beats.length === 0) return { ok: false, error: { kind: "empty" } };

  for (const [index, beat] of beats.entries()) {
    if (!isFilled(beat.title)) return { ok: false, error: { kind: "bad-beat", index, field: "title" } };
    if (!isFilled(beat.text)) return { ok: false, error: { kind: "bad-beat", index, field: "text" } };
    // Positive integers only: the total check below is then exact, and [40000, -10000] cannot sneak through.
    if (!Number.isSafeInteger(beat.durationMs) || beat.durationMs <= 0) {
      return { ok: false, error: { kind: "bad-beat", index, field: "durationMs" } };
    }
  }

  const totalMs = beats.reduce((sum, beat) => sum + beat.durationMs, 0);
  if (totalMs !== FILM_LENGTH_MS) {
    return { ok: false, error: { kind: "wrong-total", totalMs, expectedMs: FILM_LENGTH_MS } };
  }

  return { ok: true, film: { beats, totalMs: FILM_LENGTH_MS, id: fingerprint(beats) } as ValidFilm };
}

export function describeFilmError(error: FilmError): string {
  switch (error.kind) {
    case "empty":
      return "There are no beats to play.";
    case "bad-beat":
      return `Beat ${error.index + 1} has an invalid ${error.field}.`;
    case "wrong-total":
      return `Beat durations sum to ${ms(error.totalMs)}. They must sum to exactly ${ms(error.expectedMs)}.`;
  }
}

function isFilled(value: unknown): boolean {
  return typeof value === "string" && value.trim() !== "";
}

function ms(value: number): string {
  return `${value.toLocaleString("en-US")} ms`;
}

/** djb2 over the serialized beats: a stable, cheap content id. Not a security hash. */
function fingerprint(beats: readonly Beat[]): string {
  const input = JSON.stringify(beats.map(({ title, text, durationMs }) => [title, text, durationMs]));
  let hash = 5381;
  for (let i = 0; i < input.length; i++) hash = ((hash << 5) + hash + input.charCodeAt(i)) | 0;
  return (hash >>> 0).toString(36);
}
