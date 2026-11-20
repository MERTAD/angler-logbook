import { sql } from "drizzle-orm";
import {
  index,
  integer,
  real,
  sqliteTable,
  text,
} from "drizzle-orm/sqlite-core";

const createdAt = () =>
  text("created_at")
    .notNull()
    .default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`);

/** Members the app has seen, keyed by the Gateway's user id. */
export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull(),
  createdAt: createdAt(),
});

// Every row below carries the Gateway's user id; every query filters by it.
export const spots = sqliteTable(
  "spots",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    name: text("name").notNull(),
    notes: text("notes").notNull().default(""),
    icon: text("icon").notNull(),
    color: text("color").notNull(),
    lat: real("lat").notNull(),
    lng: real("lng").notNull(),
    createdAt: createdAt(),
    updatedAt: createdAt(),
  },
  (t) => [index("spots_user_idx").on(t.userId)],
);

export const paths = sqliteTable(
  "paths",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    name: text("name").notNull(),
    kind: text("kind", { enum: ["trotline", "trolling"] }).notNull(),
    notes: text("notes").notNull().default(""),
    color: text("color").notNull(),
    /** JSON array of [lat, lng] pairs, in order. */
    points: text("points").notNull(),
    lengthM: real("length_m").notNull(),
    createdAt: createdAt(),
    updatedAt: createdAt(),
  },
  (t) => [index("paths_user_idx").on(t.userId)],
);

export const catches = sqliteTable(
  "catches",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    spotId: text("spot_id"),
    species: text("species").notNull(),
    caughtAt: text("caught_at").notNull(),
    lat: real("lat").notNull(),
    lng: real("lng").notNull(),
    lengthCm: real("length_cm"),
    weightKg: real("weight_kg"),
    gear: text("gear").notNull().default(""),
    notes: text("notes").notNull().default(""),
    /** JSON of the conditions computed for caught_at at lat/lng. */
    conditions: text("conditions").notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("catches_user_idx").on(t.userId, t.caughtAt)],
);

export const catchPhotos = sqliteTable(
  "catch_photos",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    catchId: text("catch_id").notNull(),
    r2Key: text("r2_key").notNull(),
    contentType: text("content_type").notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("catch_photos_catch_idx").on(t.catchId)],
);
