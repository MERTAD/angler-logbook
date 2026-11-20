import { and, desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { paths } from "@/db/schema";
import { COLOR_KEYS } from "@/lib/catalog";
import { pathLength, type LatLng } from "@/lib/geo";
import { latitude, longitude } from "./spots";

const pathFields = {
  name: z.string().trim().min(1, "Name is required").max(120),
  kind: z.enum(["trotline", "trolling"]),
  notes: z.string().trim().max(4000).default(""),
  color: z.enum(COLOR_KEYS),
  points: z
    .array(z.tuple([latitude, longitude]))
    .min(2, "A path needs at least two points")
    .max(2000),
};
export const createPathInput = z.object(pathFields).strict();
export const updatePathInput = z
  .object({ id: z.string().uuid(), ...pathFields })
  .strict();
export const pathIdInput = z.object({ id: z.string().uuid() }).strict();

export interface Path {
  id: string;
  name: string;
  kind: "trotline" | "trolling";
  notes: string;
  color: string;
  points: LatLng[];
  lengthM: number;
  createdAt: string;
  updatedAt: string;
}

const shown = {
  id: paths.id,
  name: paths.name,
  kind: paths.kind,
  notes: paths.notes,
  color: paths.color,
  points: paths.points,
  lengthM: paths.lengthM,
  createdAt: paths.createdAt,
  updatedAt: paths.updatedAt,
};
type Row = Omit<Path, "points"> & { points: string };
const parse = (row: Row): Path => ({ ...row, points: JSON.parse(row.points) });

export async function listPaths(userId: string): Promise<Path[]> {
  const rows = await db
    .select(shown)
    .from(paths)
    .where(eq(paths.userId, userId))
    .orderBy(desc(paths.createdAt), paths.id);
  return rows.map(parse);
}

export async function getPath(userId: string, id: string): Promise<Path | null> {
  const [row] = await db
    .select(shown)
    .from(paths)
    .where(and(eq(paths.id, id), eq(paths.userId, userId)));
  return row ? parse(row) : null;
}

export async function createPath(
  userId: string,
  { points, ...input }: z.infer<typeof createPathInput>,
): Promise<Path> {
  const [row] = await db
    .insert(paths)
    .values({
      id: crypto.randomUUID(),
      userId,
      ...input,
      points: JSON.stringify(points),
      lengthM: pathLength(points),
    })
    .returning(shown);
  return parse(row!);
}

export async function updatePath(
  userId: string,
  { id, points, ...change }: z.infer<typeof updatePathInput>,
): Promise<Path | null> {
  const [row] = await db
    .update(paths)
    .set({
      ...change,
      points: JSON.stringify(points),
      lengthM: pathLength(points),
      updatedAt: sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`,
    })
    .where(and(eq(paths.id, id), eq(paths.userId, userId)))
    .returning(shown);
  return row ? parse(row) : null;
}

export async function deletePath(userId: string, id: string): Promise<Path | null> {
  const [row] = await db
    .delete(paths)
    .where(and(eq(paths.id, id), eq(paths.userId, userId)))
    .returning(shown);
  return row ? parse(row) : null;
}
