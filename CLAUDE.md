# CLAUDE.md

Constraints for AI-assisted work on this repo. Read this before changing anything.

## What this is
One auto-playing widget: a silent, 30-second "film" of text beats that explains a fictional product. The page is
the widget and nothing else. The design contract is in PLAN.md; reviewer-facing notes are in README.md.

## The invariant
The current beat index is NEVER stored in state. It is derived, every frame, from elapsed time:

    elapsed   = Date.now() - startedAt
    beatIndex = walk prefix sums of durationMs until the running total exceeds elapsed

`startedAt` is the only persisted value. If a beat index ever lives in `useState` (or `useRef`, context, or storage)
and something advances it, the work is wrong regardless of how correct the output looks.

Everything visible is a pure function of `(beats, now - startedAt)`, computed during render by
`src/playhead/frame.ts`: which beat, its opacity and rise, the track fill, the counter and the timecode.

## Forbidden
- `setInterval` / `setTimeout` anywhere in `src/`. ESLint enforces this. `requestAnimationFrame` only triggers
  re-renders; the clock is the source of truth, never a tick count.
- A beat index, beat progress, or "current beat" held in `useState`, `useRef`, context, or storage.
- Per-beat components, `switch`/`if` on a beat number, or literal indexing such as `beats[2]` in UI code. The UI
  maps over the array.
- CSS `transition` or `@keyframes` on beat content. They run on the element's own timeline and replay on mount,
  which breaks mid-beat resume. Drive visuals from the `--reveal` custom property.
- Extra fields on a beat. The shape is exactly `{ title, text, durationMs }`.
- Playing an unvalidated array. `BeatPlayer` accepts only `ValidFilm`, which only `validateFilm` can produce. Do
  not cast around the brand.
- Demo or variant branches below `src/app/page.tsx`. `?beats=` selects an array; nothing else knows it exists.
- A landing page, hero, nav, footer, or anything else on the page around the widget.
- Runtime dependencies beyond `next`, `react` and `react-dom`. No Tailwind, no animation libraries.
- Additional markdown files. The repo has exactly three: CLAUDE.md, PLAN.md, README.md.

## Allowed state
- `usePlayhead` holds two numbers: `startedAt` (persisted to localStorage) and `now` (the latest `Date.now()`
  sample, set once per animation frame). Both start as `null`, so the server render and the first client render
  are identical.
- Only two things write `startedAt`: first visit (no valid stored value) and Replay.

## Layering
Imports only go downward: `app → ui → playhead → film`.
- `src/film/`: data only. The beat arrays and a lookup by name.
- `src/playhead/`: logic. `frame.ts`, `validate.ts` and `storage.ts` are plain TypeScript with no React.
  `usePlayhead.ts` is the only hook.
- `src/ui/`: rendering only. It reads a frame and maps over beats, with no timing math.
- `src/app/page.tsx`: picks the array, validates it on the server, and renders `BeatPlayer` or `FilmError`.

## Copy rules
- No numbers, metrics, percentages or rankings in beat copy.
- No real company, product or AI-service names. The brand and the competitor are invented.
- Dark, serious and short. Each beat must be readable within its duration, and the story must work in silence.
- Beat durations must sum to exactly 30000. When the validator refuses an array, that is the feature working,
  not a bug to work around.

## Commands
- `npm run dev`: local dev server
- `npm run lint`: ESLint, including the timer ban
- `npm test`: Vitest for the pure modules
- `npm run build`: production build

## Definition of done
- `npm run lint`, `npm test` and `npm run build` are green.
- `rg "setInterval|setTimeout|switch *\(|beats\[[0-9]" src/ui src/app` returns nothing.
- The README's reviewer checklist passes: plays, F5 resumes mid-beat, `?beats=invalid` refuses, `?beats=six` plays
  six beats.
