// The app's tools for AI clients, served by the Gateway at /mcp and called
// with the signed-in member. They use the same queries as the pages.
import { defineTools } from "@every-app/sdk/server";
import { z } from "zod";
import { offsetFromLongitude } from "@/lib/geo";
import { forecastDay, localDate, localTime } from "@/lib/solunar";
import * as catches from "@/server/catches";
import * as spots from "@/server/spots";

export const tools = defineTools(
  {
    list_spots: {
      description: "List the member's saved spots with their coordinates.",
      risk: "read",
      input: z.object({}).strict(),
      handler: (_input, { user }) => spots.listSpots(user.id),
    },
    create_spot: {
      description: "Save a spot at coordinates. The server assigns its id.",
      risk: "write",
      idempotent: false,
      input: spots.createSpotInput,
      handler: (input, { user }) => spots.createSpot(user.id, input),
    },
    list_catches: {
      description:
        "List the member's catches, newest first, with the conditions recorded for each.",
      risk: "read",
      input: z.object({}).strict(),
      handler: (_input, { user }) => catches.listCatches(user.id),
    },
    fish_activity: {
      description:
        "Fish activity score (0-100), major and minor periods, sun and moon times for a place and day. Times are local at the offset given, or one estimated from longitude.",
      risk: "read",
      input: z
        .object({
          lat: z.number().min(-90).max(90),
          lng: z.number().min(-180).max(180),
          date: z
            .string()
            .regex(/^\d{4}-\d{2}-\d{2}$/)
            .optional(),
          utcOffsetHours: z.number().int().min(-12).max(14).optional(),
        })
        .strict(),
      handler: ({ lat, lng, date, utcOffsetHours }) => {
        const offset = utcOffsetHours ?? offsetFromLongitude(lng);
        const day = forecastDay(date ?? localDate(Date.now(), offset), lat, lng, offset);
        const at = (t: number | null) => (t === null ? null : localTime(t, offset));
        return {
          date: day.date,
          utcOffsetHours: offset,
          score: day.score,
          sunrise: at(day.sunrise),
          sunset: at(day.sunset),
          moonrise: at(day.moonrise),
          moonset: at(day.moonset),
          moonPhase: day.phaseName,
          illuminationPercent: day.illumination,
          periods: day.periods.map((p) => ({
            kind: p.kind,
            start: at(p.start),
            end: at(p.end),
          })),
        };
      },
    },
  },
  {
    instructions:
      "Spots, catches and forecasts for one angler. Never guess ids: list first.",
  },
);
