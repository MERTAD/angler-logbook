import { createServerFn } from "@tanstack/react-start";
import { ensureUserMiddleware } from "@every-app/sdk/tanstack-start";
import * as paths from "@/server/paths";

const NOT_FOUND = "That path doesn't exist.";

export const getPaths = createServerFn()
  .middleware([ensureUserMiddleware])
  .handler(({ context }) => paths.listPaths(context.user.id));

export const getPath = createServerFn()
  .middleware([ensureUserMiddleware])
  .validator((data: unknown) => paths.pathIdInput.parse(data))
  .handler(({ data, context }) => paths.getPath(context.user.id, data.id));

export const createPath = createServerFn({ method: "POST" })
  .middleware([ensureUserMiddleware])
  .validator((data: unknown) => paths.createPathInput.parse(data))
  .handler(({ data, context }) => paths.createPath(context.user.id, data));

export const updatePath = createServerFn({ method: "POST" })
  .middleware([ensureUserMiddleware])
  .validator((data: unknown) => paths.updatePathInput.parse(data))
  .handler(async ({ data, context }) => {
    const path = await paths.updatePath(context.user.id, data);
    if (!path) throw new Error(NOT_FOUND);
    return path;
  });

export const deletePath = createServerFn({ method: "POST" })
  .middleware([ensureUserMiddleware])
  .validator((data: unknown) => paths.pathIdInput.parse(data))
  .handler(async ({ data, context }) => {
    const path = await paths.deletePath(context.user.id, data.id);
    if (!path) throw new Error(NOT_FOUND);
    return { id: path.id };
  });
