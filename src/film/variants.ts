import { BEATS, type Beat } from "./beats";

/**
 * Requirement 4, checkable live at /?beats=six: the same story plus a sixth beat, with durations rebalanced so
 * the total is still 30000 ms. It renders through exactly the same markup as the five-beat film.
 */
export const SIX_BEATS: readonly Beat[] = [
  {
    title: "Describe it once.",
    text: "Fernhollow, a two-person ceramics studio, writes down what it makes and why. Just once.",
    durationMs: 4500,
  },
  {
    title: "A film. A page.",
    text: "From that one description: a short film and a public page, both in the studio’s own voice.",
    durationMs: 5000,
  },
  {
    title: "Does AI search know them?",
    text: "Someone asks an AI search engine where to buy handmade stoneware. Does the answer mention Fernhollow?",
    durationMs: 5500,
  },
  {
    title: "Or does it name a competitor?",
    text: "Today the answer names Brightmere instead. They see the exact question, and who took the mention.",
    durationMs: 5500,
  },
  {
    title: "Then, what to make next.",
    text: "That gap becomes the next brief: a new film and page, made for the question they’re missing.",
    durationMs: 5000,
  },
  {
    title: "Then it runs again.",
    text: "Publish. Ask again. Make the next piece. The loop keeps them findable.",
    durationMs: 4500,
  },
];

/**
 * Requirement 1, checkable live at /?beats=invalid: the production film with its last beat 500 ms short
 * (29500 ms in total). It goes through the real validator and must be refused.
 */
export const INVALID_SUM: readonly Beat[] = BEATS.map((beat, index) =>
  index === BEATS.length - 1 ? { ...beat, durationMs: beat.durationMs - 500 } : beat,
);

const VARIANTS: Readonly<Record<string, readonly Beat[]>> = {
  six: SIX_BEATS,
  invalid: INVALID_SUM,
};

/** Resolves the ?beats= query value. A missing or unknown value gets the production film. */
export function pickBeats(name: string | string[] | undefined): readonly Beat[] {
  return typeof name === "string" && Object.hasOwn(VARIANTS, name) ? VARIANTS[name] : BEATS;
}
