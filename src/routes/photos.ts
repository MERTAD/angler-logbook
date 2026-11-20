import { createFileRoute } from "@tanstack/react-router";
import { getEveryAppUser } from "@every-app/sdk/server";
import { env } from "cloudflare:workers";
import { addPhoto, ownsCatch } from "@/server/catches";

const MAX_BYTES = 10 * 1024 * 1024;
const TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/heic", "image/avif"];

// Adds a photo to one of the member's catches. The custom header keeps
// cross-site forms out: a browser can't send it without a CORS preflight.
export const Route = createFileRoute("/photos")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        const user = await getEveryAppUser(request, env);
        if (!user) return new Response("Unauthorized", { status: 401 });
        if (request.headers.get("x-upload") !== "1")
          return new Response("Bad request", { status: 400 });
        const form = await request.formData().catch(() => null);
        const catchId = form?.get("catchId");
        const file = form?.get("file");
        if (typeof catchId !== "string" || !(file instanceof File))
          return Response.json({ error: "Send a catch and a file." }, { status: 400 });
        if (!/^[0-9a-f-]{36}$/.test(catchId) || !(await ownsCatch(user.id, catchId)))
          return Response.json({ error: "Not found" }, { status: 404 });
        if (!TYPES.includes(file.type))
          return Response.json({ error: "Photos must be JPEG, PNG, WebP, GIF, HEIC or AVIF." }, { status: 415 });
        if (file.size > MAX_BYTES)
          return Response.json({ error: "Photos can be up to 10 MB." }, { status: 413 });
        const photo = await addPhoto(user.id, catchId, file.type);
        await env.photos.put(photo.r2Key, file.stream(), {
          httpMetadata: { contentType: file.type },
        });
        return Response.json({ id: photo.id }, { status: 201 });
      },
    },
  },
});
