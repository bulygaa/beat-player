import { describe, expect, it } from "vitest";
import { BEATS, type Beat } from "../film/beats";
import { INVALID_SUM, SIX_BEATS } from "../film/variants";
import { describeFilmError, validateFilm } from "./validate";

const beat = (durationMs: number, title = "t", text = "x"): Beat => ({ title, text, durationMs });

describe("validateFilm", () => {
  it.each([
    ["the production film", BEATS],
    ["the six-beat film", SIX_BEATS],
  ])("accepts %s", (_, beats) => {
    expect(validateFilm(beats).ok).toBe(true);
  });

  it("refuses a total that is not exactly 30000 ms", () => {
    expect(validateFilm(INVALID_SUM)).toEqual({
      ok: false,
      error: { kind: "wrong-total", totalMs: 29_500, expectedMs: 30_000 },
    });
    expect(validateFilm([beat(30_001)])).toMatchObject({ ok: false, error: { kind: "wrong-total" } });
  });

  it("refuses an empty film", () => {
    expect(validateFilm([])).toEqual({ ok: false, error: { kind: "empty" } });
  });

  it.each([
    ["zero", [beat(0), beat(30_000)], 0],
    ["negative (even though the sum is 30000)", [beat(40_000), beat(-10_000)], 1],
    ["fractional", [beat(15_000.5), beat(14_999.5)], 0],
    ["non-numeric", [beat(Number.NaN), beat(30_000)], 0],
  ])("refuses a %s duration", (_, beats, index) => {
    expect(validateFilm(beats)).toEqual({ ok: false, error: { kind: "bad-beat", index, field: "durationMs" } });
  });

  it("refuses a blank title or text", () => {
    expect(validateFilm([beat(30_000, "  ")])).toEqual({
      ok: false,
      error: { kind: "bad-beat", index: 0, field: "title" },
    });
    expect(validateFilm([beat(30_000, "t", "")])).toEqual({
      ok: false,
      error: { kind: "bad-beat", index: 0, field: "text" },
    });
  });
});

describe("film id", () => {
  const idOf = (beats: readonly Beat[]) => {
    const result = validateFilm(beats);
    if (!result.ok) throw new Error("expected a valid film");
    return result.film.id;
  };

  it("is stable for the same content and changes when the content does", () => {
    expect(idOf(BEATS)).toBe(idOf(BEATS.map((b) => ({ ...b }))));
    expect(idOf(SIX_BEATS)).not.toBe(idOf(BEATS));
    const retitled = BEATS.map((b, i) => (i === 0 ? { ...b, title: "Say it once." } : b));
    expect(idOf(retitled)).not.toBe(idOf(BEATS));
  });
});

describe("describeFilmError", () => {
  it("names the actual and the expected total", () => {
    expect(describeFilmError({ kind: "wrong-total", totalMs: 29_500, expectedMs: 30_000 })).toBe(
      "Beat durations sum to 29,500 ms. They must sum to exactly 30,000 ms.",
    );
  });
});
