# Beat Player

A 30-second silent film in one auto-playing widget. The beats are data (`{ title, text, durationMs }`), and the UI
plays only from that array. As an implementation choice, the current beat isn't stored: each frame derives it from
`Date.now() - startedAt`.

**Live:** _URL added after deploy_

## Check it in 60 seconds

| Check | What you should see |
|---|---|
| Open `/` | Five beats play automatically, with unequal durations. The top-right timecode is the playhead. |
| Press F5 mid-film | The same beat at the same time, plus however long the reload took. No flash of beat 1, no replayed fade. |
| Wait past `00:30` | The last beat holds and **Replay** appears. F5 keeps it ended; it does not restart. |
| Open `/?beats=invalid` | **Requirement 1.** The page is given an array that sums to 29,500 ms. It shows "Not playing." with the actual and expected sums. No player mounts and nothing is written to storage. |
| Open `/?beats=six` | **Requirement 4.** The page is given the same story plus a sixth beat, rebalanced to 30,000 ms. Six beats and six track segments, with no new markup. |

Each film keeps its own saved clock (the storage key includes a hash of the beats), so switching between them
never resumes one film on another film's clock.

## How the playhead works

```
elapsed   = Date.now() - startedAt
beatIndex = walk prefix sums of durationMs until the running total exceeds elapsed
```

- The implementation persists one value, `startedAt` (epoch milliseconds, in localStorage), and derives everything
  else from it. The brief asks for a start timestamp plus elapsed time; storing nothing else is my choice, to keep
  the model small.
- [`frameAt`](src/playhead/frame.ts) is a pure function of `(beats, elapsed)`. It returns the beat index, the time
  into that beat, and whether the film has ended. `reveal` and `segmentFill` in the same file derive the
  transition and the track the same way.
- [`usePlayhead`](src/playhead/usePlayhead.ts) keeps two clock readings as state: `startedAt` and the latest
  `Date.now()` sample. `requestAnimationFrame` takes a fresh sample each frame; the position comes from the clock,
  not from counting frames. The loop stops once the film ends.
- The code uses no `setInterval` or `setTimeout`, and an ESLint rule flags them in `src/`.
- A hidden tab pauses animation frames but not the clock, so the first frame back lands at the true position.

## Refresh, resume and the end

- **First visit:** `startedAt = Date.now()` is saved. **F5** reads it back and derives the frame again, so playback
  resumes wherever the wall clock says, including the time the reload took.
- **Before hydration** the server can't know `startedAt`, so the frame renders empty: no beat, counter, timecode or
  track. A zeroed timecode would look like a restart. The real frame then lands in the same space with no layout
  shift, and a mid-beat resume is fully revealed on its first paint.
- **After 30 s** the last beat holds and Replay appears. Opening or refreshing after the end shows the ended frame
  rather than restarting. I chose this so the screen stays a function of `now - startedAt`, with no special case
  for reloads. Apart from the first visit, Replay is the only thing that writes `startedAt`, and other open tabs
  follow it through the `storage` event.
- **Storage blocked or full:** playback runs from an in-memory copy, so a refresh starts over. Corrupt or future
  values are treated as absent and overwritten.

## Invalid sum

Validation runs in [page.tsx](src/app/page.tsx), a server component, before any client code runs.
[`validateFilm`](src/playhead/validate.ts) returns either a `ValidFilm` or a typed error, and refuses when:

- the durations don't sum to exactly 30,000 ms;
- the array is empty;
- a beat has a blank title or text, or a duration that isn't a positive whole number, so `[40000, -10000]` can't
  sum its way through.

As a design choice, `BeatPlayer` takes a `ValidFilm`, a branded type that `validateFilm` returns. That makes the
compiler flag code that passes an unvalidated array to the player. It's a compile-time aid, not a runtime guarantee:
a type cast would get past it. On failure the page renders [FilmError](src/ui/FilmError.tsx) in the same frame
instead, so the player isn't mounted, no clock is read and nothing is written to storage.

`?beats=` only picks which array goes in ([variants.ts](src/film/variants.ts)). The validator and the player have no
demo-specific code, so the refusal you see live goes through the same validation as the default film.

## Adding a beat

Live: `/?beats=six`. In code: append an object to `BEATS` in [beats.ts](src/film/beats.ts) and rebalance the
durations so they still sum to 30000. Nothing else changes. The counter, the track segments (their widths are
proportional to `durationMs`) and the timing all come from the array. Tests cover six- and seven-beat arrays and an
800 ms beat.

## Why no CSS `transition` and no animation library

A CSS `transition` or `@keyframes` runs on the element's own timeline, so after a refresh mid-beat the fade would
replay from zero. Instead, each frame writes one derived number, `--reveal` (from 0 to 1), and CSS maps it to
opacity and a 12 px rise. The fade windows scale down for short beats, so every beat reaches full opacity. I judged
that five text beats and one transition didn't justify a dependency. Under `prefers-reduced-motion`, the rise is dropped and the
fade stays.

## Trade-offs

- **No pause control.** Pausing would need a second persisted value (a paused-at offset). I kept persistence to the
  single start timestamp, and the brief doesn't ask for a pause. The cost is a gap against WCAG 2.2.2, which asks
  for a pause on moving content longer than 5 s. Mitigations: reduced motion is respected, and beat text is in a
  polite `aria-live` region.
- **Wall clock.** I use `Date.now()` so the position survives a reload (`performance.now()` restarts at zero on
  every page load). If the system clock moves backwards mid-play, elapsed time clamps to the start and the stage
  stays blank until the clock catches up. That is deliberately not handled, because it would add branching to the
  derivation path.
- **Much later visits** show the ended frame with Replay. There is no staleness timeout.

## Project layout

```
src/film/      data: the beats and the ?beats= variants
src/playhead/  logic: frame derivation, validation, storage and the one hook, with tests
src/ui/        rendering: BeatPlayer, FilmError and the shared frame
src/app/       the page (validates on the server) and the layout
```

[PLAN.md](PLAN.md) is the design, written before implementation. [CLAUDE.md](CLAUDE.md) is hand-written and holds
the constraints for AI-assisted work on this repo. `agentRules: false` in `next.config.ts` stops Next 16's
`next dev` from appending its own generated agent rules to that file.

## Run locally

```bash
npm install
npm run dev     # http://localhost:3000
npm test        # Vitest: frame derivation, validation, storage parsing
npm run lint    # includes the setInterval/setTimeout ban
npm run build
```
