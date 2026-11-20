import { fileURLToPath } from "node:url";
import { createClient } from "@libsql/client";
import { callTool, listTools } from "@every-app/sdk/testing";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import { beforeAll, describe, expect, it, vi } from "vitest";
import * as schema from "@/db/schema";

const testDb = vi.hoisted(() => ({ current: null as unknown }));
vi.mock("@/db", () => ({
  get db() {
    return testDb.current;
  },
}));

const { tools } = await import("./tools");

beforeAll(async () => {
  const db = drizzle(createClient({ url: ":memory:" }), { schema });
  await migrate(db, {
    migrationsFolder: fileURLToPath(new URL("../drizzle", import.meta.url)),
  });
  testDb.current = db;
});

describe("tools", () => {
  it("lists each tool with its risk", async () => {
    const { tools: listed } = await listTools(tools);
    expect(listed.map(({ name, risk }) => [name, risk])).toEqual([
      ["create_spot", "write"],
      ["fish_activity", "read"],
      ["list_catches", "read"],
      ["list_spots", "read"],
    ]);
  });

  it("acts for the person calling, and only on their spots", async () => {
    await callTool(
      tools,
      "create_spot",
      { name: "Ana's", icon: "fish", color: "blue", lat: 10, lng: 20 },
      { user: { id: "ana" } },
    );
    const bo = await callTool(tools, "list_spots", {}, { user: { id: "bo" } });
    expect(bo).toMatchObject({ result: { content: [{ text: "[]" }] } });
  });

  it("refuses a caller whose connection may only read", async () => {
    const response = await callTool(
      tools,
      "create_spot",
      { name: "Nope", icon: "fish", color: "blue", lat: 0, lng: 0 },
      { scopes: ["mcp:read"] },
    );
    expect(response).toMatchObject({ error: { code: "forbidden" } });
  });
});
