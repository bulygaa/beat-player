import { describe, expect, it } from "vitest";
import { BEATS, type Beat } from "../film/beats";
import { SIX_BEATS } from "../film/variants";
import { frameAt, reveal, segmentFill } from "./frame";

const beat = (durationMs: number): Beat => ({ title: "t", text: "x", durationMs });

/** Each beat's start time, computed from the data rather than written down. */
function startTimes(beats: readonly Beat[]): number[] {
  let startMs = 0;
  return beats.map((b) => {
    const start = startMs;
    startMs += b.durationMs;
    return start;
  });
}

describe("frameAt", () => {
  it.each([
    [0, 0, 0],
    [5499, 0, 5499],
    [5500, 1, 0],
    [11_500, 2, 0],
    [29_999, 4, 5499],
  ])("at %i ms plays beat %i, %i ms in", (elapsed, index, msIntoBeat) => {
    expect(frameAt(BEATS, elapsed)).toMatchObject({ status: "playing", index, msIntoBeat });
  });

  it("ends at exactly 30000 ms and holds the last beat however late it is read", () => {
    for (const elapsed of [30_000, 30_001, 86_400_000]) {
      expect(frameAt(BEATS, elapsed)).toMatchObject({ status: "ended", index: 4, elapsedMs: 30_000 });
    }
  });

  it("reads a negative elapsed time (clock moved backwards) as the start", () => {
    expect(frameAt(BEATS, -2000)).toMatchObject({ status: "playing", index: 0, msIntoBeat: 0, elapsedMs: 0 });
  });

  it.each([
    ["six beats", SIX_BEATS],
    ["seven uneven beats", [1000, 9000, 2500, 7500, 3000, 4000, 3000].map(beat)],
  ])("plays every one of %s at its own start time", (_, beats) => {
    startTimes(beats).forEach((start, index) => {
      expect(frameAt(beats, start)).toMatchObject({ status: "playing", index, msIntoBeat: 0 });
    });
  });
});

describe("reveal", () => {
  it("fades in from 0, holds at 1, and fades out before the next beat", () => {
    expect(reveal(frameAt(BEATS, 0), 5)).toBe(0);
    expect(reveal(frameAt(BEATS, 300), 5)).toBeCloseTo(0.5);
    expect(reveal(frameAt(BEATS, 2750), 5)).toBe(1);
    expect(reveal(frameAt(BEATS, 5300), 5)).toBeCloseTo(0.5);
  });

  it("is already fully shown mid-beat, so a refresh there has no fade to replay", () => {
    expect(reveal(frameAt(BEATS, 14_000), 5)).toBe(1);
  });

  it("never fades the last beat out, and holds it once ended", () => {
    expect(reveal(frameAt(BEATS, 29_999), 5)).toBe(1);
    expect(reveal(frameAt(BEATS, 30_000), 5)).toBe(1);
  });

  it("reaches full opacity even for a beat shorter than fixed fade windows would allow", () => {
    const beats = [800, 9200, 10_000, 10_000].map(beat);
    const shortBeat = Array.from({ length: 800 }, (_, ms) => reveal(frameAt(beats, ms), beats.length));
    expect(Math.max(...shortBeat)).toBe(1);
  });
});

describe("segmentFill", () => {
  it("fills one segment per beat, in order", () => {
    expect(segmentFill(BEATS, 0)).toEqual([0, 0, 0, 0, 0]);
    expect(segmentFill(BEATS, 8500)).toEqual([1, 0.5, 0, 0, 0]);
    expect(segmentFill(BEATS, 30_000)).toEqual([1, 1, 1, 1, 1]);
  });
});
