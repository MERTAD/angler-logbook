import { fileURLToPath } from "node:url";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import { beforeAll, describe, expect, it, vi } from "vitest";
import * as schema from "@/db/schema";

// An in-memory SQLite with the app's migrations stands in for D1.
const testDb = vi.hoisted(() => ({ current: null as unknown }));
vi.mock("@/db", () => ({
  get db() {
    return testDb.current;
  },
}));

const spots = await import("./spots");
const paths = await import("./paths");
const catches = await import("./catches");
const { toGpx } = await import("./gpx");

beforeAll(async () => {
  const db = drizzle(createClient({ url: ":memory:" }), { schema });
  await migrate(db, {
    migrationsFolder: fileURLToPath(new URL("../../drizzle", import.meta.url)),
  });
  testDb.current = db;
});

const spotInput = (name: string) => ({
  name,
  notes: "",
  icon: "fish" as const,
  color: "blue" as const,
  lat: 41.6,
  lng: -82.6,
});

describe("spots", () => {
  it("belong to the member who saved them", async () => {
    const mine = await spots.createSpot("alice", spotInput("Reef"));
    await spots.createSpot("bob", spotInput("Bob's"));
    expect((await spots.listSpots("alice")).map((s) => s.name)).toEqual(["Reef"]);
    expect(await spots.getSpot("bob", mine.id)).toBeNull();
    expect(await spots.updateSpot("bob", { ...spotInput("X"), id: mine.id })).toBeNull();
    expect(await spots.deleteSpot("bob", mine.id)).toBeNull();
    expect((await spots.getSpot("alice", mine.id))?.name).toBe("Reef");
    const renamed = await spots.updateSpot("alice", { ...spotInput("Reef 2"), id: mine.id });
    expect(renamed?.name).toBe("Reef 2");
  });

  it("rejects coordinates off the globe", () => {
    expect(() => spots.createSpotInput.parse({ ...spotInput("A"), lat: 91 })).toThrow();
    expect(() => spots.createSpotInput.parse({ ...spotInput("A"), lng: -181 })).toThrow();
    expect(() => spots.createSpotInput.parse({ ...spotInput(" ") })).toThrow();
  });
});

describe("paths", () => {
  it("need two points, keep their length and stay private", async () => {
    expect(() =>
      paths.createPathInput.parse({ name: "A", kind: "trotline", color: "red", points: [[0, 0]] }),
    ).toThrow();
    const path = await paths.createPath("alice", {
      name: "Line",
      kind: "trotline",
      notes: "",
      color: "red",
      points: [
        [0, 0],
        [0, 1],
      ],
    });
    expect(path.lengthM).toBeGreaterThan(111_000);
    expect(path.lengthM).toBeLessThan(111_400);
    expect(await paths.getPath("bob", path.id)).toBeNull();
    expect(await paths.deletePath("bob", path.id)).toBeNull();
    expect(await paths.listPaths("bob")).toEqual([]);
  });
});

describe("catches", () => {
  it("record conditions, link only to the member's spots, and stay private", async () => {
    const spot = await spots.createSpot("carol", spotInput("Bay"));
    const bobSpot = await spots.createSpot("bob", spotInput("Bob bay"));
    const base = {
      species: "Walleye",
      caughtAt: "2026-06-15T23:30:00.000Z",
      lat: null,
      lng: null,
      lengthCm: 60,
      weightKg: 2,
      gear: "",
      notes: "",
    };
    await expect(
      catches.createCatch("carol", { ...base, spotId: bobSpot.id }),
    ).rejects.toThrow("no longer exists");
    const made = await catches.createCatch("carol", { ...base, spotId: spot.id });
    expect(made.spotName).toBe("Bay");
    expect(made.conditions.dayScore).toBeGreaterThanOrEqual(0);
    expect(made.conditions.dayScore).toBeLessThanOrEqual(100);
    expect(await catches.getCatch("bob", made.id)).toBeNull();
    expect(await catches.updateCatch("bob", { ...base, spotId: null, lat: 1, lng: 1, id: made.id })).toBeNull();
    expect(await catches.deleteCatch("bob", made.id)).toBeNull();

    const moved = await catches.updateCatch("carol", {
      ...base,
      id: made.id,
      spotId: null,
      lat: 10,
      lng: 10,
      caughtAt: "2026-01-02T03:00:00.000Z",
    });
    expect(moved?.conditions.at).toBe("2026-01-02T03:00:00.000Z");

    const photo = await catches.addPhoto("carol", made.id, "image/png");
    expect(await catches.getPhoto("bob", photo.id)).toBeNull();
    expect(await catches.deleteCatch("carol", made.id)).toEqual({ r2Keys: [photo.r2Key] });
    expect(await catches.getPhoto("carol", photo.id)).toBeNull();
  });

  it("keep their coordinates when their spot is deleted", async () => {
    const spot = await spots.createSpot("dan", spotInput("Gone"));
    const made = await catches.createCatch("dan", {
      species: "Perch",
      caughtAt: "2026-05-01T12:00:00.000Z",
      spotId: spot.id,
      lat: null,
      lng: null,
      lengthCm: null,
      weightKg: null,
      gear: "",
      notes: "",
    });
    await spots.deleteSpot("dan", spot.id);
    const after = await catches.getCatch("dan", made.id);
    expect(after?.spotId).toBeNull();
    expect(after?.lat).toBe(41.6);
  });
});

describe("gpx", () => {
  it("writes waypoints and tracks, escaped", async () => {
    const spot = await spots.createSpot("erin", { ...spotInput("A & B <reef>"), notes: "x" });
    const gpx = toGpx([spot], [
      {
        id: "p",
        name: "Run",
        kind: "trolling",
        notes: "",
        color: "red",
        points: [
          [1, 2],
          [3, 4],
        ],
        lengthM: 0,
        createdAt: "",
        updatedAt: "",
      },
    ]);
    expect(gpx).toContain('<wpt lat="41.6" lon="-82.6">');
    expect(gpx).toContain("<name>A &amp; B &lt;reef&gt;</name>");
    expect(gpx).toContain('<trkpt lat="3" lon="4"></trkpt>');
  });
});
