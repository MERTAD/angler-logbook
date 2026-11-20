import { createServerFn } from "@tanstack/react-start";
import { env } from "cloudflare:workers";
import { ensureUserMiddleware } from "@every-app/sdk/tanstack-start";
import * as catches from "@/server/catches";

const NOT_FOUND = "That catch doesn't exist.";

export const getCatches = createServerFn()
  .middleware([ensureUserMiddleware])
  .handler(({ context }) => catches.listCatches(context.user.id));

export const getCatch = createServerFn()
  .middleware([ensureUserMiddleware])
  .validator((data: unknown) => catches.catchIdInput.parse(data))
  .handler(({ data, context }) => catches.getCatch(context.user.id, data.id));

export const createCatch = createServerFn({ method: "POST" })
  .middleware([ensureUserMiddleware])
  .validator((data: unknown) => catches.createCatchInput.parse(data))
  .handler(({ data, context }) => catches.createCatch(context.user.id, data));

export const updateCatch = createServerFn({ method: "POST" })
  .middleware([ensureUserMiddleware])
  .validator((data: unknown) => catches.updateCatchInput.parse(data))
  .handler(async ({ data, context }) => {
    const updated = await catches.updateCatch(context.user.id, data);
    if (!updated) throw new Error(NOT_FOUND);
    return updated;
  });

/** Deletes the catch with its photos. */
export const deleteCatch = createServerFn({ method: "POST" })
  .middleware([ensureUserMiddleware])
  .validator((data: unknown) => catches.catchIdInput.parse(data))
  .handler(async ({ data, context }) => {
    const gone = await catches.deleteCatch(context.user.id, data.id);
    if (!gone) throw new Error(NOT_FOUND);
    if (gone.r2Keys.length) await env.photos.delete(gone.r2Keys);
    return { id: data.id };
  });

export const deletePhoto = createServerFn({ method: "POST" })
  .middleware([ensureUserMiddleware])
  .validator((data: unknown) => catches.photoIdInput.parse(data))
  .handler(async ({ data, context }) => {
    const gone = await catches.deletePhoto(context.user.id, data.id);
    if (!gone) throw new Error("That photo doesn't exist.");
    await env.photos.delete(gone.r2Key);
    return { id: data.id };
  });
