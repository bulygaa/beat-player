# Beat Player — Design & Implementation Plan

Written before any implementation code. This is the design contract. README.md describes what was built.

## Context
One auto-playing, data-driven, 30-second "film" widget (5 beats) that explains a fictional product in silence.
The point of the exercise is the state model, not visual polish. Everything follows one invariant:

> **The beat index is never stored. It is derived every frame from `Date.now() - startedAt`, and `startedAt` is the
> only persisted value.**

The brief's four requirements:
1. The sum of `durationMs` must be exactly 30000, or nothing plays and a short error shows.
2. Playhead = start timestamp + elapsed time, not a timer incrementing a counter.
3. Refresh resumes at the same elapsed time.
4. Adding a beat (sum still 30000) plays with no new markup.

---

## 0. Ambiguities → assumptions, and conflicts

### Ambiguities (assumption taken)
| # | Ambiguity | Assumption |
|---|---|---|
| A1 | What happens after 30s? | **Hold on the final beat** at full opacity, track full, and show a single "Replay" control. Rationale in §4. |
| A2 | "Resume at the same elapsed time" | Wall-clock elapsed. The film behaves like a broadcast, not a paused tape: time spent reloading, backgrounded or closed counts. It follows directly from `playhead = startedAt + elapsed`. |
| A3 | Beat shape | Exactly `{ title, text, durationMs }`. There are no extra per-beat fields (no `variant`, `image`, `layout`). Any visual differences come from generic rules (position, progress), never from per-beat data. |
| A4 | What else "valid" means beyond sum | Non-empty array; each `durationMs` is a positive safe integer; `title`/`text` are non-empty strings. Integers-only makes `=== 30000` exact, with no float equality issues. Negative durations are rejected (`[40000, -10000]` sums to 30000 but is nonsense). |
| A5 | "5–6 beats" | Content guidance, **not** a validation rule. Enforcing a count would contradict req 4, where any N beats summing to 30000 must play. |
| A6 | "No real company names" | Also covers AI/search products. The copy says "AI search", and the brand (Fernhollow) and competitor (Brightmere) are invented. |
| A7 | "Short error" | One title line plus one detail line naming the actual vs expected sum. A real diagnostic, not a metric. |
| A8 | Unknown `?beats=` value | Falls back to the default film. The error state is reserved for real validation failures. |
| A9 | Tests | Not requested. Adding a small Vitest suite (dev dependency only) for the pure modules: cheap and high-signal. |
| A10 | Returning much later (e.g. next day) | Shows the ended frame + Replay. No staleness timeout (a magic number that would break "render = f(clock)"). |

### Conflicts flagged (and resolution)
- **C1 — "CSS transitions" vs "resume mid-beat".** A CSS `transition`/`@keyframes` runs on the element's own
  timeline and replays from zero on mount. After F5 mid-beat, the fade would play again. That is exactly the
  "internal timeline state" the brief forbids. **Resolution:** the visual transition is still pure CSS
  (opacity + transform), but its input is a playhead-derived custom property `--reveal ∈ [0,1]` written every
  frame. There is no `transition:` or `@keyframes` on beat content. After a refresh at 60% of a beat, `--reveal`
  is already 1 and nothing replays.
- **C2 — "No next/prev controls" vs "what after the end".** One Replay button, rendered only in the ended state.
  It does not navigate beats; it writes a new `startedAt`. That is the only clock write besides first visit.
- **C3 — Accessibility (WCAG 2.2.2 pause for >5s auto-moving content) vs "no controls" + "startedAt is the only
  persisted value".** A pause needs a second persisted value (`pausedAt`/offset). **Not adding it.** Stated as a
  conscious trade-off in the README. Mitigations: reduced-motion is honored, and beat text sits in a polite
  `aria-live` region so the story is announced.
- **C4 — Wall clock vs monotonic clock.** `performance.now()` is monotonic but its origin resets on reload, so it
  can't be persisted. `Date.now()` is required for req 3. Clock skew is handled by clamping (§6).
- **C5 — A commented-out 6-beat array (one way to show req 4).** Commented-out code isn't type-checked, can rot,
  and can't be verified on the live URL. **Instead:** ship it as a real exported, type-checked array, selectable
  live via `?beats=six`, with a one-line swap for the default in code.
- **C6 — "Index never in state" vs React needing to re-render.** State holds a clock *sample* (`now`) and
  `startedAt`. Index, progress and reveal are computed during render. Using a rAF tick counter as a forceUpdate
  is avoided: it would look like "tick count drives playback" even if it doesn't.

---

## 1. File / module structure
Layering: `film/` (data) → `playhead/` (logic, pure except the one hook) → `ui/` (rendering). There are no upward imports.

```
CLAUDE.md                 AI-assist constraints: invariant, forbidden patterns, layering, copy rules
PLAN.md                   this plan
README.md                 reviewer-facing: mechanics, invalid sum, resume, adding a beat
eslint.config.mjs         + no-restricted-globals/properties: setInterval, setTimeout (invariant enforced by lint)
src/app/layout.tsx        <html>/<body>, next/font faces, metadata, dark ground — nothing else
src/app/page.tsx          server: read ?beats=, pick array, validate, render <BeatPlayer> or <FilmError>
src/app/globals.css       reset + color/type tokens
src/film/beats.ts         Beat type + the production 5-beat array (the only file a copy edit touches)
src/film/variants.ts      SIX_BEATS, INVALID_SUM fixtures + pickBeats(param) registry (data + a lookup)
src/playhead/validate.ts  validateFilm(beats) → Result<ValidFilm, FilmError>; describeFilmError(); fingerprint id
src/playhead/frame.ts     pure: frameAt(beats, elapsed), reveal(frame, count), segmentFill(beats, elapsed)
src/playhead/storage.ts   readStartedAt/writeStartedAt(key): try/catch, parse + sanity check, never throws
src/playhead/usePlayhead.ts  client hook: startedAt + now state, rAF loop, replay(), cross-tab storage sync
src/playhead/*.test.ts    Vitest: frame boundaries, N-beat generality, validation cases
src/ui/BeatPlayer.tsx     'use client'; ONE stage fed by the frame; track via beats.map; Replay when ended
src/ui/BeatPlayer.module.css  stage/type/track; opacity+transform from --reveal; reduced-motion override
src/ui/FilmError.tsx      server component: the refusal, rendered inside the same frame
src/ui/FilmError.module.css
```

`ValidFilm` is a **branded type** (`{ beats, totalMs, id } & { readonly __brand }`) that only
`validateFilm` can produce. `BeatPlayer`'s prop type is `ValidFilm`, so the type system itself enforces
"validation before play".

---

## 2. Beats data (sums to 30000)
Brand and competitor are invented. There are no numbers in the copy. The titles alone tell the arc.
Durations are deliberately **unequal**, which shows the prefix-sum walk rather than `elapsed / 6000`.

| # | durationMs | title | text |
|---|---|---|---|
| 1 | 5500 | Describe it once. | Fernhollow, a two-person ceramics studio, writes down what it makes and why. Just once. |
| 2 | 6000 | A film. A page. | From that one description: a short film and a public page, both in the studio's own voice. |
| 3 | 6500 | Does AI search know them? | Someone asks an AI search engine where to buy handmade stoneware. Does the answer mention Fernhollow? |
| 4 | 6500 | Or does it name a competitor? | Today the answer names Brightmere instead. They see the exact question, and who took the mention. |
| 5 | 5500 | Then, what to make next. | That gap becomes the next brief: a new film and page, made for the question they're missing. |

Sum: 5500+6000+6500+6500+5500 = **30000** ✓ (~14–16 words per beat, readable in 5.5–6.5s)

**SIX_BEATS** (req 4 demo): the same five beats, rebalanced to 4500 / 5000 / 5500 / 5500 / 5000, plus a new sixth beat:
`{ title: "Then it runs again.", text: "Publish. Ask again. Make the next piece. The loop keeps them findable.", durationMs: 4500 }`
→ 4500+5000+5500+5500+5000+4500 = **30000** ✓

**INVALID_SUM** (req 1 demo): the five beats with beat 5 at 5000 → **29500**.

---

## 3. Derivation logic (pure, `src/playhead/frame.ts`)
Beat intervals are half-open `[start, start+duration)`. `elapsed === 5500` is beat 2 at 0ms.

```
frameAt(beats, rawElapsed):
  total   = sum(durationMs)                          // === 30000, guaranteed by ValidFilm
  elapsed = clamp(rawElapsed, 0, total)              // negative (clock skew) → 0
  if elapsed >= total:
    return { status: 'ended', index: last, beat: beats[last], msIntoBeat: beats[last].durationMs,
             beatProgress: 1, elapsed: total }
  acc = 0
  for i in 0..beats.length-1:
    end = acc + beats[i].durationMs
    if elapsed < end:
      ms = elapsed - acc
      return { status: 'playing', index: i, beat: beats[i], msIntoBeat: ms,
               beatProgress: ms / beats[i].durationMs, elapsed }
    acc = end
  unreachable (validated) → ended frame

reveal(frame, count):                                // drives the one transition
  if frame.status == 'ended': return 1               // final beat holds; never fades to black
  d       = frame.beat.durationMs
  IN_MS   = min(600, d * 0.2)                        // windows scale with the beat: IN_MS + OUT_MS ≤ 0.35·d,
  OUT_MS  = min(400, d * 0.15)                       // so a beat of ANY length plateaus at reveal = 1 (req 4)
  fadeIn  = frame.msIntoBeat / IN_MS
  hasNext = frame.index < count - 1                  // generic rule: fade out only if something follows
  fadeOut = hasNext ? (d - frame.msIntoBeat) / OUT_MS : Infinity
  return clamp(min(fadeIn, fadeOut), 0, 1)

segmentFill(beats, elapsed): number[]                // one fill value per beat, for the track
  acc = 0; for each beat: fill = clamp((elapsed - acc) / durationMs, 0, 1); acc += durationMs
```
It's O(n) per frame with n ≈ 6, so no memoisation needed. No branch depends on a specific beat number anywhere.

**Render** (BeatPlayer): `frame = frameAt(film.beats, now - startedAt)`. The stage is one `<h2>` + one `<p>` whose
text comes from `frame.beat`. `style={{ '--reveal': reveal(frame, n) } as React.CSSProperties}`. The cast is
intentional; don't restructure to avoid it. The counter is `index+1 / n` and the timecode
`mm:ss / 00:30`, both derived. The track is `film.beats.map` → segment `flex-grow: durationMs`, fill
`transform: scaleX(segmentFill[i])`. Adding a beat adds a segment automatically.

---

## 4. Persistence & resume (`storage.ts`, `usePlayhead.ts`)
- **Key:** `beat-player:startedAt:<film.id>`. `film.id` is a small djb2 hash of the beats (computed once in
  `validateFilm`). Why: a *different film* (edited copy, `?beats=six`, an added beat) must not resume on another
  film's clock. Same film → same key.
- **Value:** epoch ms (`Date.now()`) as a string. It's the only thing ever written.
- **Mount:** `stored = readStartedAt(key)`. If `stored` is valid, use it. Otherwise set `startedAt = Date.now()` and write it.
  The effect is idempotent under StrictMode's double-invoke: the second run reads what the first wrote.
- **During play:** the rAF loop calls `setNow(Date.now())` each frame and stops scheduling once `now - startedAt ≥ total`
  (no idle 60fps renders after the end).
- **Crossing 30000 during play → ended:** the final beat is held at `--reveal: 1`, the track is full, and Replay appears.
  `replay()` = `t = Date.now(); write(key, t); setStartedAt(t)`. The loop restarts because `startedAt` changed.
- **Mounting with elapsed ≥ 30000 → ended state, not a restart.** Justification: the screen must always be
  `f(now − startedAt)`, with no special cases. If refresh-after-end restarted at beat 1, a viewer who waits for the
  end and presses F5 would see "refresh restarts", which is the literal fail condition. Replay is an explicit,
  visible act. Same logic for a stale session (A10).
- **Cross-tab:** a `storage` event listener for our key updates `startedAt`, so Replay in one tab re-syncs the
  others. About five lines, and it keeps one source of truth.

---

## 5. Validation
- **Where:** `src/app/page.tsx` (server component), before any client code exists:
  `const result = validateFilm(pickBeats(searchParams.beats))`
  → `result.ok ? <BeatPlayer film={result.film} /> : <FilmError message={describeFilmError(result.error)} />`.
  On failure, the player is **not in the tree at all**, not even in the SSR HTML. No clock is read and no storage key is written.
- **Returns:** a discriminated union.
  ```ts
  type FilmError =
    | { kind: 'empty' }
    | { kind: 'bad-beat'; index: number; field: 'title' | 'text' | 'durationMs' }
    | { kind: 'wrong-total'; totalMs: number; expectedMs: 30000 };
  type Validation = { ok: true; film: ValidFilm } | { ok: false; error: FilmError };
  ```
  Checks run in order: empty → per-beat shape → total.
- **Error render:** the same dark 16:9 frame as the player, so it reads as *the widget refusing*, not a page.
  Title "Not playing." Detail: "Beat durations sum to 29,500 ms. They must sum to exactly 30,000 ms."
  `role="alert"`, no track, no timecode.
- **Live verification without polluting the production path:** `?beats=invalid` and `?beats=six` only select
  *which array* is passed in. The validator and player have zero awareness of demos: no `if (demo)` anywhere.
  The invalid array goes through the real guard, so the live refusal proves the real code. Only the
  selected array is serialized to the client; the fixtures never ship in the client bundle.

---

## 6. Edge cases
| Case | Handling |
|---|---|
| Tab backgrounded | rAF callbacks are deferred and the clock keeps running. The pending rAF fires on return, reads `Date.now()`, and the frame jumps to the true position at the correct `--reveal`. No `visibilitychange` code needed. If the film ended while hidden, the ended state shows and the loop stops. bfcache restore behaves the same. |
| localStorage unavailable (blocked, sandboxed, throws on access) | All access goes through `try/catch` in `storage.ts`. Reads return `null` and writes are no-ops, so it plays from an in-memory `startedAt`. Refresh restarts, which is unavoidable without storage. Documented in the README. |
| localStorage corrupt | Parse with `Number()`. Must be a safe integer > 0 and ≤ `Date.now()`. Anything else (garbage, `NaN`, a future timestamp) → treated as absent and overwritten. |
| Clock moved backwards mid-play | `elapsed < 0` → clamped to 0 in `frameAt`, never a crash or negative index. |
| SSR / hydration | Server and first client render both have `startedAt = now = null`. The stage renders with empty text, `--reveal: 0`, an empty track and the counter as `— / 05`. Identical markup, so no mismatch. No `Date.now()`, `localStorage` or `typeof window` in render paths. The first effect reads storage and starts rAF. Crucially, **SSR never shows beat 1**, so a refresh at beat 3 never flashes beat 1. `<noscript>` line: "This film needs JavaScript." |
| prefers-reduced-motion | CSS media query drops the `translateY` rise. The opacity fade remains (not vestibular motion). The track's linear fill stays because it's informational. |
| React StrictMode double effects | The mount effect is idempotent, and rAF cleanup cancels the pending frame. |

---

## 7. Visual direction
- The page is nothing but a near-black ground (`#0b0b0c`) and one centered 16:9 frame with a hairline border (`#26262a`).
  There is no hero, nav or footer.
- Type: beat title in **Instrument Serif** (large, `clamp(2rem, 5vw, 3.5rem)`, tight leading). Body in **Inter** at ~1.125rem,
  off-white (`#e8e6e1`) at ~70% opacity. Counter and timecode in Inter tabular numerals, small, uppercase, tracked.
  Both self-hosted via `next/font`, with no runtime dependency.
- The one transition is **fade-through-black with a 12px rise**: opacity = `--reveal`, `translateY((1 − --reveal) × 12px)`.
  In over min(600ms, 20% of the beat), out over min(400ms, 15% of the beat), all derived from the playhead.
- Track: a segmented hairline along the frame's bottom edge, segment widths ∝ `durationMs`. It's the visual proof that beats are data.

---

## 8. Documentation (exactly three markdown files)
- **CLAUDE.md**
  - One-paragraph purpose.
  - The invariant, verbatim.
  - Forbidden list:
    - `setInterval`/`setTimeout` (also lint-enforced)
    - beat index or progress in `useState`/`useRef`
    - `switch`/`if` on beat number, or literal `beats[N]` in UI
    - per-beat components
    - CSS `transition`/`@keyframes` on beat content
    - a landing page, hero, nav or footer
    - runtime deps beyond react/react-dom/next, Tailwind, or animation libs
    - more markdown files
  - Layering rules (`film/` data only, `playhead/` pure except `usePlayhead`, `ui/` renders only via `map` + frame).
  - Copy rules: no numbers or metrics in beat copy, no real company or product names, dark and serious.
  - Commands.
  - Definition of done: lint + test + build green, plus the manual checklist.
- **PLAN.md**: this plan, committed before any implementation code.
- **README.md** (reviewer-facing)
  - Live URL.
  - A 60-second check list: `/`, F5 mid-film, `/?beats=invalid`, `/?beats=six`.
  - Playhead mechanics (formula + links to `frame.ts` and `usePlayhead.ts`).
  - Refresh, resume and ended behavior, including the storage-unavailable case.
  - Invalid-sum behavior and where validation runs.
  - How to add a beat: live via `?beats=six`; in code, a one-line swap in `variants.ts`/`beats.ts`, or append an object and rebalance durations.
  - Why there's no CSS `transition` or animation library.
  - Trade-offs: no pause (C3), wall clock.
  - Run locally.

---

## 9. Implementation order (riskiest first)
1. Scaffold: Next.js 16.3.5 (TS, App Router, ESLint flat config, `src/`, no Tailwind). Strip the boilerplate,
   add the ESLint timer ban and Vitest (dev only), pin exact versions. Next 16 `searchParams` is a Promise and
   must be awaited in `page.tsx`.
2. Pure core: `frame.ts` + `validate.ts` + tests covering:
   - boundaries at 0 / 5499 / 5500 / 29999 / 30000
   - negative elapsed
   - 6- and 7-beat arrays
   - wrong total, zero or negative duration, empty
   - fingerprint stability
   - reveal: a 4-beat array (sum 30000) with one 800ms beat still reaches `reveal === 1`; the ended frame → 1;
     the last beat never fades out
3. **Riskiest:** `storage.ts` + `usePlayhead.ts` + an unstyled `BeatPlayer` (title, text, timecode).
   Verify F5 resume, no hydration warnings, no beat-1 flash, backgrounded tab, corrupt and blocked storage,
   StrictMode. Deploy early to surface prod-only issues (dynamic `searchParams`, fonts).
4. `variants.ts` + `pickBeats` + `page.tsx` + `FilmError`. Verify `?beats=invalid` / `?beats=six`.
5. Copy and visual pass: type, track, `--reveal` CSS, reduced motion, phone width, `aria-live`.
6. README, then the full verification checklist on the live URL.

---

## Verification (end-to-end)
- `npm run lint` (proves no timers), `npm test`, `npm run build`, all green.
- `rg "setInterval|setTimeout|switch *\(|beats\[[0-9]" src/ui src/app` → no hits.
- Live `/`: beats advance with unequal durations. At ~12s press F5: the same beat and timecode (~12s + reload time) show
  with text at full opacity (no replayed fade) and no flash of beat 1.
- Wait past 30s: the final beat holds and Replay appears. F5: still ended. Replay: restarts, and other open tabs follow.
- Background the tab for 10s: on return it jumps to the right position.
- `/?beats=invalid` → the refusal message, no track or timecode, no storage key written (check DevTools).
- `/?beats=six` → six segments, six beats, zero markup diff (`git log -p` shows only data files).
- DevTools: set the storage value to `"abc"` → fresh start, no error. Block site data → plays, refresh restarts.
  Emulate reduced motion → no rise. Console: no hydration warnings. 400px width: readable.
