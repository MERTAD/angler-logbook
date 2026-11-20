import { createFileRoute } from "@tanstack/react-router";
import { getEveryAppUser } from "@every-app/sdk/server";
import { env } from "cloudflare:workers";
import { getPhoto } from "@/server/catches";

// A catch photo, only for the member who owns it.
export const Route = createFileRoute("/photos/$photoId")({
  server: {
    handlers: {
      GET: async ({ request, params }: { request: Request; params: { photoId: string } }) => {
        const user = await getEveryAppUser(request, env);
        if (!user) return new Response("Unauthorized", { status: 401 });
        const notFound = new Response("Not found", { status: 404 });
        if (!/^[0-9a-f-]{36}$/.test(params.photoId)) return notFound;
        const photo = await getPhoto(user.id, params.photoId);
        if (!photo) return notFound;
        const object = await env.photos.get(photo.r2Key);
        if (!object) return notFound;
        return new Response(object.body, {
          headers: {
            "content-type": photo.contentType,
            "cache-control": "private, max-age=3600",
            "x-content-type-options": "nosniff",
          },
        });
      },
    },
  },
});
