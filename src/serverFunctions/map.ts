import { createServerFn } from "@tanstack/react-start";
import { ensureUserMiddleware } from "@every-app/sdk/tanstack-start";
import { listCatches } from "@/server/catches";
import { listPaths } from "@/server/paths";
import { listSpots } from "@/server/spots";

/** Everything the member has saved, for the map. */
export const getMapData = createServerFn()
  .middleware([ensureUserMiddleware])
  .handler(async ({ context }) => {
    const [spots, paths, catches] = await Promise.all([
      listSpots(context.user.id),
      listPaths(context.user.id),
      listCatches(context.user.id),
    ]);
    return {
      spots,
      paths,
      catches: catches.map((c) => ({ id: c.id, species: c.species, lat: c.lat, lng: c.lng })),
    };
  });
