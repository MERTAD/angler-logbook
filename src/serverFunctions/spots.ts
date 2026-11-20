import { createServerFn } from "@tanstack/react-start";
import { ensureUserMiddleware } from "@every-app/sdk/tanstack-start";
import * as spots from "@/server/spots";

const NOT_FOUND = "That spot doesn't exist.";

export const getSpots = createServerFn()
  .middleware([ensureUserMiddleware])
  .handler(({ context }) => spots.listSpots(context.user.id));

/** Null when the member has no spot with the id. */
export const getSpot = createServerFn()
  .middleware([ensureUserMiddleware])
  .validator((data: unknown) => spots.spotIdInput.parse(data))
  .handler(({ data, context }) => spots.getSpot(context.user.id, data.id));

export const createSpot = createServerFn({ method: "POST" })
  .middleware([ensureUserMiddleware])
  .validator((data: unknown) => spots.createSpotInput.parse(data))
  .handler(({ data, context }) => spots.createSpot(context.user.id, data));

export const updateSpot = createServerFn({ method: "POST" })
  .middleware([ensureUserMiddleware])
  .validator((data: unknown) => spots.updateSpotInput.parse(data))
  .handler(async ({ data, context }) => {
    const spot = await spots.updateSpot(context.user.id, data);
    if (!spot) throw new Error(NOT_FOUND);
    return spot;
  });

export const deleteSpot = createServerFn({ method: "POST" })
  .middleware([ensureUserMiddleware])
  .validator((data: unknown) => spots.spotIdInput.parse(data))
  .handler(async ({ data, context }) => {
    const spot = await spots.deleteSpot(context.user.id, data.id);
    if (!spot) throw new Error(NOT_FOUND);
    return { id: spot.id };
  });
