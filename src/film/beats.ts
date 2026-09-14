/**
 * A beat is data. The player renders any array of these through one stage; there is no per-beat markup.
 */
export type Beat = {
  readonly title: string;
  readonly text: string;
  readonly durationMs: number;
};

/**
 * The film. Durations must sum to exactly 30000 ms, or the page refuses to play it.
 * They are deliberately unequal: the playhead walks prefix sums and never divides by a fixed beat length.
 */
export const BEATS: readonly Beat[] = [
  {
    title: "Describe it once.",
    text: "Fernhollow, a two-person ceramics studio, writes down what it makes and why. Just once.",
    durationMs: 5500,
  },
  {
    title: "A film. A page.",
    text: "From that one description: a short film and a public page, both in the studio’s own voice.",
    durationMs: 6000,
  },
  {
    title: "Does AI search know them?",
    text: "Someone asks an AI search engine where to buy handmade stoneware. Does the answer mention Fernhollow?",
    durationMs: 6500,
  },
  {
    title: "Or does it name a competitor?",
    text: "Today the answer names Brightmere instead. They see the exact question, and who took the mention.",
    durationMs: 6500,
  },
  {
    title: "Then, what to make next.",
    text: "That gap becomes the next brief: a new film and page, made for the question they’re missing.",
    durationMs: 5500,
  },
];
