import { describe, expect, it } from "vitest";
import { parseStartedAt } from "./storage";

describe("parseStartedAt", () => {
  const now = 1_800_000_000_000;

  it("accepts a past epoch-ms timestamp", () => {
    expect(parseStartedAt(String(now - 12_000), now)).toBe(now - 12_000);
  });

  it.each([null, "", "abc", "NaN", "-5", "0", "12.5", String(now + 1)])("treats %j as absent", (raw) => {
    expect(parseStartedAt(raw, now)).toBeNull();
  });
});
