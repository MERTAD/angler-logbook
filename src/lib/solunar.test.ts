import { describe, expect, it } from "vitest";
import { conditionsAt, forecastDay, forecastMonth, localTime } from "./solunar";

describe("forecast", () => {
  const day = forecastDay("2026-06-15", 41.62, -82.66, -4);

  it("finds sun times at the place's offset", () => {
    expect(localTime(day.sunrise!, -4)).toMatch(/^05:[45]\d$/);
    expect(localTime(day.sunset!, -4)).toMatch(/^21:\d\d$/);
  });

  it("puts major periods on the moon's transits and minor ones on rise and set", () => {
    const majors = day.periods.filter((p) => p.kind === "major");
    expect(majors.length).toBeGreaterThanOrEqual(1);
    for (const p of majors) expect(p.end - p.start).toBe(2 * 3600_000);
    const minors = day.periods.filter((p) => p.kind === "minor");
    for (const p of minors) expect(p.end - p.start).toBe(3600_000);
  });

  it("scores 0-100 by the day and the hour", () => {
    expect(day.hourly).toHaveLength(24);
    for (const v of [...day.hourly, day.score]) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(100);
    }
    const month = forecastMonth("2026-06-15", 41.62, -82.66, -4);
    expect(month).toHaveLength(30);
    // Near new or full moon scores higher than at a quarter.
    const full = forecastDay("2026-06-29", 41.62, -82.66, -4); // full moon
    const quarter = forecastDay("2026-06-22", 41.62, -82.66, -4); // first quarter
    expect(full.score).toBeGreaterThan(quarter.score);
  });

  it("names the moon phase", () => {
    expect(forecastDay("2026-06-29", 0, 0, 0).phaseName).toBe("Full Moon");
  });

  it("records conditions deterministically", () => {
    const at = new Date("2026-06-15T23:30:00Z");
    expect(conditionsAt(at, 41.62, -82.66, -6)).toEqual(conditionsAt(at, 41.62, -82.66, -6));
    expect(conditionsAt(new Date("2026-06-15T17:00:00Z"), 41.62, -82.66, -6).daylight).toBe("Daylight");
    expect(conditionsAt(new Date("2026-06-15T07:00:00Z"), 41.62, -82.66, -6).daylight).toBe("Night");
  });
});
