import { and, desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { catches, spots } from "@/db/schema";
import { COLOR_KEYS, ICONS } from "@/lib/catalog";

export const latitude = z.number().min(-90).max(90);
export const longitude = z.number().min(-180).max(180);

const spotFields = {
  name: z.string().trim().min(1, "Name is required").max(120),
  notes: z.string().trim().max(4000).default(""),
  icon: z.enum(ICONS),
  color: z.enum(COLOR_KEYS),
  lat: latitude,
  lng: longitude,
};
export const createSpotInput = z.object(spotFields).strict();
export const updateSpotInput = z
  .object({ id: z.string().uuid(), ...spotFields })
  .strict();
export const spotIdInput = z.object({ id: z.string().uuid() }).strict();

const shown = {
  id: spots.id,
  name: spots.name,
  notes: spots.notes,
  icon: spots.icon,
  color: spots.color,
  lat: spots.lat,
  lng: spots.lng,
  createdAt: spots.createdAt,
  updatedAt: spots.updatedAt,
};
export type Spot = {
  id: string;
  name: string;
  notes: string;
  icon: string;
  color: string;
  lat: number;
  lng: number;
  createdAt: string;
  updatedAt: string;
};

export function listSpots(userId: string): Promise<Spot[]> {
  return db
    .select(shown)
    .from(spots)
    .where(eq(spots.userId, userId))
    .orderBy(desc(spots.createdAt), spots.id);
}

/** The spot, or null when this user has none with the id. */
export async function getSpot(userId: string, id: string): Promise<Spot | null> {
  const [spot] = await db
    .select(shown)
    .from(spots)
    .where(and(eq(spots.id, id), eq(spots.userId, userId)));
  return spot ?? null;
}

export async function createSpot(
  userId: string,
  input: z.infer<typeof createSpotInput>,
): Promise<Spot> {
  const [spot] = await db
    .insert(spots)
    .values({ id: crypto.randomUUID(), userId, ...input })
    .returning(shown);
  return spot!;
}

export async function updateSpot(
  userId: string,
  { id, ...change }: z.infer<typeof updateSpotInput>,
): Promise<Spot | null> {
  const [spot] = await db
    .update(spots)
    .set({ ...change, updatedAt: sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))` })
    .where(and(eq(spots.id, id), eq(spots.userId, userId)))
    .returning(shown);
  return spot ?? null;
}

/** Deletes the spot; catches logged there keep their coordinates. */
export async function deleteSpot(userId: string, id: string): Promise<Spot | null> {
  const [spot] = await db
    .delete(spots)
    .where(and(eq(spots.id, id), eq(spots.userId, userId)))
    .returning(shown);
  if (!spot) return null;
  await db
    .update(catches)
    .set({ spotId: null })
    .where(and(eq(catches.spotId, id), eq(catches.userId, userId)));
  return spot;
}
