import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { catchPhotos, catches, spots } from "@/db/schema";
import { offsetFromLongitude } from "@/lib/geo";
import { conditionsAt, type Conditions } from "@/lib/solunar";
import { latitude, longitude } from "./spots";

const optionalMeasure = z.number().min(0).max(100_000).nullable().default(null);

const catchFields = {
  species: z.string().trim().min(1, "Species is required").max(120),
  caughtAt: z.string().datetime({ offset: true }),
  /** A saved spot of the same member; its coordinates are the catch's. */
  spotId: z.string().uuid().nullable().default(null),
  lat: latitude.nullable().default(null),
  lng: longitude.nullable().default(null),
  lengthCm: optionalMeasure,
  weightKg: optionalMeasure,
  gear: z.string().trim().max(500).default(""),
  notes: z.string().trim().max(4000).default(""),
};
export const createCatchInput = z.object(catchFields).strict();
export const updateCatchInput = z
  .object({ id: z.string().uuid(), ...catchFields })
  .strict();
export const catchIdInput = z.object({ id: z.string().uuid() }).strict();
export const photoIdInput = z.object({ id: z.string().uuid() }).strict();

class CatchInputError extends Error {}

export interface Catch {
  id: string;
  species: string;
  caughtAt: string;
  spotId: string | null;
  spotName: string | null;
  lat: number;
  lng: number;
  lengthCm: number | null;
  weightKg: number | null;
  gear: string;
  notes: string;
  conditions: Conditions;
  photos: string[];
}

const shown = {
  id: catches.id,
  species: catches.species,
  caughtAt: catches.caughtAt,
  spotId: catches.spotId,
  spotName: spots.name,
  lat: catches.lat,
  lng: catches.lng,
  lengthCm: catches.lengthCm,
  weightKg: catches.weightKg,
  gear: catches.gear,
  notes: catches.notes,
  conditions: catches.conditions,
};

function selectCatches(userId: string) {
  return db
    .select(shown)
    .from(catches)
    .leftJoin(
      spots,
      and(eq(spots.id, catches.spotId), eq(spots.userId, catches.userId)),
    );
}

async function photosOf(userId: string, catchIds: string[]) {
  const byCatch = new Map<string, string[]>();
  if (!catchIds.length) return byCatch;
  const rows = await db
    .select({ id: catchPhotos.id, catchId: catchPhotos.catchId })
    .from(catchPhotos)
    .where(eq(catchPhotos.userId, userId))
    .orderBy(catchPhotos.createdAt, catchPhotos.id);
  const wanted = new Set(catchIds);
  for (const row of rows) {
    if (!wanted.has(row.catchId)) continue;
    byCatch.set(row.catchId, [...(byCatch.get(row.catchId) ?? []), row.id]);
  }
  return byCatch;
}

/** Newest first. */
export async function listCatches(userId: string): Promise<Catch[]> {
  const rows = await selectCatches(userId)
    .where(eq(catches.userId, userId))
    .orderBy(desc(catches.caughtAt), catches.id);
  const photos = await photosOf(userId, rows.map((r) => r.id));
  return rows.map((row) => ({
    ...row,
    conditions: JSON.parse(row.conditions),
    photos: photos.get(row.id) ?? [],
  }));
}

export async function getCatch(userId: string, id: string): Promise<Catch | null> {
  const [row] = await selectCatches(userId).where(
    and(eq(catches.id, id), eq(catches.userId, userId)),
  );
  if (!row) return null;
  const photos = await photosOf(userId, [id]);
  return {
    ...row,
    conditions: JSON.parse(row.conditions),
    photos: photos.get(id) ?? [],
  };
}

/** The catch's place: the member's own spot, or the coordinates given. */
async function place(
  userId: string,
  input: z.infer<typeof createCatchInput>,
): Promise<{ spotId: string | null; lat: number; lng: number }> {
  if (input.spotId) {
    const [spot] = await db
      .select({ lat: spots.lat, lng: spots.lng })
      .from(spots)
      .where(and(eq(spots.id, input.spotId), eq(spots.userId, userId)));
    if (!spot) throw new CatchInputError("That spot no longer exists.");
    return { spotId: input.spotId, ...spot };
  }
  if (input.lat === null || input.lng === null)
    throw new CatchInputError("Choose a spot or enter coordinates.");
  return { spotId: null, lat: input.lat, lng: input.lng };
}

function record(
  input: z.infer<typeof createCatchInput>,
  where: { spotId: string | null; lat: number; lng: number },
) {
  const caughtAt = new Date(input.caughtAt);
  return {
    species: input.species,
    caughtAt: caughtAt.toISOString(),
    ...where,
    lengthCm: input.lengthCm,
    weightKg: input.weightKg,
    gear: input.gear,
    notes: input.notes,
    conditions: JSON.stringify(
      conditionsAt(caughtAt, where.lat, where.lng, offsetFromLongitude(where.lng)),
    ),
  };
}

export async function createCatch(
  userId: string,
  input: z.infer<typeof createCatchInput>,
): Promise<Catch> {
  const id = crypto.randomUUID();
  await db
    .insert(catches)
    .values({ id, userId, ...record(input, await place(userId, input)) });
  return (await getCatch(userId, id))!;
}

/** Saves the change and records the conditions again for the time and place. */
export async function updateCatch(
  userId: string,
  { id, ...input }: z.infer<typeof updateCatchInput>,
): Promise<Catch | null> {
  const [owned] = await db
    .select({ id: catches.id })
    .from(catches)
    .where(and(eq(catches.id, id), eq(catches.userId, userId)));
  if (!owned) return null;
  await db
    .update(catches)
    .set(record(input, await place(userId, input)))
    .where(and(eq(catches.id, id), eq(catches.userId, userId)));
  return getCatch(userId, id);
}

/** Deletes the catch and its photo rows; returns the photo keys to remove from storage. */
export async function deleteCatch(
  userId: string,
  id: string,
): Promise<{ r2Keys: string[] } | null> {
  const photos = await db
    .select({ r2Key: catchPhotos.r2Key })
    .from(catchPhotos)
    .where(and(eq(catchPhotos.catchId, id), eq(catchPhotos.userId, userId)));
  const [gone] = await db
    .delete(catches)
    .where(and(eq(catches.id, id), eq(catches.userId, userId)))
    .returning({ id: catches.id });
  if (!gone) return null;
  await db
    .delete(catchPhotos)
    .where(and(eq(catchPhotos.catchId, id), eq(catchPhotos.userId, userId)));
  return { r2Keys: photos.map((p) => p.r2Key) };
}

/** Whether this user owns the catch. */
export async function ownsCatch(userId: string, id: string): Promise<boolean> {
  const [row] = await db
    .select({ id: catches.id })
    .from(catches)
    .where(and(eq(catches.id, id), eq(catches.userId, userId)));
  return Boolean(row);
}

export async function addPhoto(
  userId: string,
  catchId: string,
  contentType: string,
): Promise<{ id: string; r2Key: string }> {
  const id = crypto.randomUUID();
  const r2Key = `${userId}/${catchId}/${id}`;
  await db
    .insert(catchPhotos)
    .values({ id, userId, catchId, r2Key, contentType });
  return { id, r2Key };
}

export async function getPhoto(userId: string, id: string) {
  const [row] = await db
    .select({ r2Key: catchPhotos.r2Key, contentType: catchPhotos.contentType })
    .from(catchPhotos)
    .where(and(eq(catchPhotos.id, id), eq(catchPhotos.userId, userId)));
  return row ?? null;
}

export async function deletePhoto(userId: string, id: string) {
  const [row] = await db
    .delete(catchPhotos)
    .where(and(eq(catchPhotos.id, id), eq(catchPhotos.userId, userId)))
    .returning({ r2Key: catchPhotos.r2Key });
  return row ?? null;
}
