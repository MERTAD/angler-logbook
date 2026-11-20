import * as SunCalc from "suncalc";

/**
 * Sun, moon and fish activity for a place and day, computed locally from
 * solunar theory: activity peaks in the major periods around the moon's
 * upper and lower transits and the minor periods around moonrise and
 * moonset, more so near new and full moon and when a period meets sunrise
 * or sunset. Everything is deterministic from the date, place and offset.
 */

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const STEP = 5 * MINUTE;

export interface Period {
  kind: "major" | "minor";
  /** What the period centres on. */
  event: "overhead" | "underfoot" | "moonrise" | "moonset";
  start: number;
  end: number;
}

export interface DayForecast {
  date: string;
  offset: number;
  sunrise: number | null;
  sunset: number | null;
  moonrise: number | null;
  moonset: number | null;
  moonOverhead: number | null;
  moonUnderfoot: number | null;
  phase: number;
  phaseName: string;
  illumination: number;
  periods: Period[];
  hourly: number[];
  score: number;
}

/** Milliseconds at local midnight of `date` (YYYY-MM-DD) for a UTC offset in hours. */
function dayStart(date: string, offset: number): number {
  const [y, m, d] = date.split("-").map(Number);
  return Date.UTC(y!, m! - 1, d!) - offset * HOUR;
}

/** The local YYYY-MM-DD of an instant at a UTC offset. */
export function localDate(time: number, offset: number): string {
  return new Date(time + offset * HOUR).toISOString().slice(0, 10);
}

/** HH:MM at a UTC offset. */
export function localTime(time: number, offset: number): string {
  return new Date(time + offset * HOUR).toISOString().slice(11, 16);
}

function crossings(
  start: number,
  altitude: (t: number) => number,
  threshold: number,
): { rise: number | null; set: number | null } {
  let rise: number | null = null;
  let set: number | null = null;
  let prev = altitude(start) - threshold;
  for (let t = start + STEP; t <= start + 24 * HOUR; t += STEP) {
    const cur = altitude(t) - threshold;
    if (prev < 0 && cur >= 0 && rise === null)
      rise = t - STEP + (STEP * -prev) / (cur - prev);
    if (prev >= 0 && cur < 0 && set === null)
      set = t - STEP + (STEP * prev) / (prev - cur);
    prev = cur;
  }
  return { rise, set };
}

function extremes(
  start: number,
  altitude: (t: number) => number,
): { max: number | null; min: number | null } {
  let max: number | null = null;
  let min: number | null = null;
  let a = altitude(start - STEP);
  let b = altitude(start);
  for (let t = start; t < start + 24 * HOUR; t += STEP) {
    const c = altitude(t + STEP);
    // Refine with a parabola through the three samples.
    const shift = () => {
      const denom = a - 2 * b + c;
      return denom === 0 ? 0 : ((a - c) / (2 * denom)) * STEP;
    };
    if (b >= a && b > c && max === null) max = t + shift();
    if (b <= a && b < c && min === null) min = t + shift();
    a = b;
    b = c;
  }
  return { max, min };
}

const DEG = 180 / Math.PI;
const moonAlt = (lat: number, lng: number) => (t: number) =>
  SunCalc.getMoonPosition(new Date(t), lat, lng).altitude * DEG;
const sunAlt = (lat: number, lng: number) => (t: number) =>
  SunCalc.getPosition(new Date(t), lat, lng).altitude * DEG;

function phaseName(phase: number): string {
  if (phase < 0.03 || phase > 0.97) return "New Moon";
  if (phase < 0.22) return "Waxing Crescent";
  if (phase < 0.28) return "First Quarter";
  if (phase < 0.47) return "Waxing Gibbous";
  if (phase < 0.53) return "Full Moon";
  if (phase < 0.72) return "Waning Gibbous";
  if (phase < 0.78) return "Last Quarter";
  return "Waning Crescent";
}

export function scoreLabel(score: number): string {
  if (score < 20) return "Very low";
  if (score < 40) return "Low";
  if (score < 60) return "Average";
  if (score < 80) return "High";
  return "Very high";
}

const gauss = (dt: number, sigma: number) =>
  Math.exp(-((dt / sigma) ** 2) / 2);

/** How strongly the phase favours activity: 1 at new and full moon, 0 at the quarters. */
function phaseStrength(phase: number): number {
  return Math.abs(Math.cos(2 * Math.PI * phase));
}

function activityAt(
  t: number,
  strength: number,
  periods: Period[],
  sunEvents: number[],
): number {
  let major = 0;
  let minor = 0;
  for (const p of periods) {
    const centre = (p.start + p.end) / 2;
    if (p.kind === "major") major = Math.max(major, gauss(t - centre, 50 * MINUTE));
    else minor = Math.max(minor, gauss(t - centre, 30 * MINUTE));
  }
  let sun = 0;
  for (const s of sunEvents) sun = Math.max(sun, gauss(t - s, 60 * MINUTE));
  return Math.round(
    Math.min(100, 8 + 22 * strength + 45 * major + 28 * minor + 15 * sun),
  );
}

export function forecastDay(
  date: string,
  lat: number,
  lng: number,
  offset: number,
): DayForecast {
  const start = dayStart(date, offset);
  const sun = crossings(start, sunAlt(lat, lng), -0.833);
  const moonAltitude = moonAlt(lat, lng);
  const moon = crossings(start, moonAltitude, 0.133);
  const transit = extremes(start, moonAltitude);
  const noon = start + 12 * HOUR;
  const illum = SunCalc.getMoonIllumination(new Date(noon));

  const periods: Period[] = [];
  const around = (
    t: number | null,
    kind: Period["kind"],
    event: Period["event"],
    half: number,
  ) => {
    if (t !== null) periods.push({ kind, event, start: t - half, end: t + half });
  };
  around(transit.max, "major", "overhead", HOUR);
  around(transit.min, "major", "underfoot", HOUR);
  around(moon.rise, "minor", "moonrise", 30 * MINUTE);
  around(moon.set, "minor", "moonset", 30 * MINUTE);
  periods.sort((a, b) => a.start - b.start);

  const strength = phaseStrength(illum.phase);
  const sunEvents = [sun.rise, sun.set].filter((t): t is number => t !== null);
  const hourly = Array.from({ length: 24 }, (_, h) => {
    let sum = 0;
    for (let q = 0; q < 4; q++)
      sum += activityAt(start + h * HOUR + q * 15 * MINUTE, strength, periods, sunEvents);
    return Math.round(sum / 4);
  });

  // A period that meets sunrise or sunset counts most.
  let overlap = 0;
  for (const p of periods) {
    const centre = (p.start + p.end) / 2;
    for (const s of sunEvents)
      overlap = Math.max(
        overlap,
        gauss(centre - s, 90 * MINUTE) * (p.kind === "major" ? 1 : 0.6),
      );
  }
  const score = Math.round(Math.min(100, 8 + 67 * strength + 25 * overlap));

  return {
    date,
    offset,
    sunrise: sun.rise,
    sunset: sun.set,
    moonrise: moon.rise,
    moonset: moon.set,
    moonOverhead: transit.max,
    moonUnderfoot: transit.min,
    phase: illum.phase,
    phaseName: phaseName(illum.phase),
    illumination: Math.round(illum.fraction * 100),
    periods,
    hourly,
    score,
  };
}

/** Each day's score for the month that holds `date`. */
export function forecastMonth(
  date: string,
  lat: number,
  lng: number,
  offset: number,
): { date: string; score: number }[] {
  const [y, m] = date.split("-").map(Number);
  const days = new Date(Date.UTC(y!, m!, 0)).getUTCDate();
  return Array.from({ length: days }, (_, i) => {
    const day = `${y}-${String(m).padStart(2, "0")}-${String(i + 1).padStart(2, "0")}`;
    return { date: day, score: forecastDay(day, lat, lng, offset).score };
  });
}

export interface Conditions {
  /** The instant the conditions are for, ISO. */
  at: string;
  offset: number;
  sunAltitude: number;
  daylight: "Daylight" | "Twilight" | "Night";
  phaseName: string;
  illumination: number;
  /** The day's activity score. */
  dayScore: number;
  /** Activity in the hour of the catch. */
  hourScore: number;
  period: "Major" | "Minor" | "None";
}

/** The conditions at one instant and place, as a catch records them. */
export function conditionsAt(at: Date, lat: number, lng: number, offset: number): Conditions {
  const t = at.getTime();
  const day = forecastDay(localDate(t, offset), lat, lng, offset);
  const sunAltitude = SunCalc.getPosition(at, lat, lng).altitude * DEG;
  const illum = SunCalc.getMoonIllumination(at);
  const inside = day.periods.filter((p) => t >= p.start && t <= p.end);
  const hour = Math.floor((t - dayStart(day.date, offset)) / HOUR);
  return {
    at: at.toISOString(),
    offset,
    sunAltitude: Math.round(sunAltitude * 10) / 10,
    daylight: sunAltitude > -0.833 ? "Daylight" : sunAltitude > -6 ? "Twilight" : "Night",
    phaseName: phaseName(illum.phase),
    illumination: Math.round(illum.fraction * 100),
    dayScore: day.score,
    hourScore: day.hourly[Math.min(23, Math.max(0, hour))]!,
    period: inside.some((p) => p.kind === "major")
      ? "Major"
      : inside.length
        ? "Minor"
        : "None",
  };
}
