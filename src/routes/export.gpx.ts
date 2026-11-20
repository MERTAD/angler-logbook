import { createFileRoute } from "@tanstack/react-router";
import { getEveryAppUser } from "@every-app/sdk/server";
import { env } from "cloudflare:workers";
import { toGpx } from "@/server/gpx";
import { listPaths } from "@/server/paths";
import { listSpots } from "@/server/spots";

// The member's own spots and paths as a GPX download.
export const Route = createFileRoute("/export/gpx")({
  server: {
    handlers: {
      GET: async ({ request }: { request: Request }) => {
        const user = await getEveryAppUser(request, env);
        if (!user) return new Response("Unauthorized", { status: 401 });
        const [spots, paths] = await Promise.all([
          listSpots(user.id),
          listPaths(user.id),
        ]);
        return new Response(toGpx(spots, paths), {
          headers: {
            "content-type": "application/gpx+xml; charset=utf-8",
            "content-disposition": 'attachment; filename="angler-logbook.gpx"',
            "cache-control": "private, no-store",
          },
        });
      },
    },
  },
});
