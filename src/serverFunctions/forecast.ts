import { createServerFn } from "@tanstack/react-start";
import { ensureUserMiddleware } from "@every-app/sdk/tanstack-start";
import { z } from "zod";
import { offsetFromLongitude } from "@/lib/geo";
import { forecastDay, forecastMonth, localDate } from "@/lib/solunar";
import * as spots from "@/server/spots";

export const forecastInput = z.object({
  spot: z.string().uuid().optional(),
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  tz: z.coerce.number().int().min(-12).max(14).optional(),
});

/**
 * The forecast for a saved spot or coordinates on a day. `place` is null
 * when nothing is chosen yet, `missing` when the spot isn't the member's.
 */
export const getForecast = createServerFn()
  .middleware([ensureUserMiddleware])
  .validator((data: unknown) => forecastInput.parse(data))
  .handler(async ({ data, context }) => {
    const mySpots = await spots.listSpots(context.user.id);
    const choices = mySpots.map((s) => ({ id: s.id, name: s.name }));
    let place: { name: string | null; spotId: string | null; lat: number; lng: number } | null = null;
    if (data.spot) {
      const spot = mySpots.find((s) => s.id === data.spot);
      if (!spot) return { missing: true as const, spots: choices };
      place = { name: spot.name, spotId: spot.id, lat: spot.lat, lng: spot.lng };
    } else if (data.lat !== undefined && data.lng !== undefined) {
      place = { name: null, spotId: null, lat: data.lat, lng: data.lng };
    }
    if (!place) return { missing: false as const, spots: choices, place: null };
    const offset = data.tz ?? offsetFromLongitude(place.lng);
    const date = data.date ?? localDate(Date.now(), offset);
    return {
      missing: false as const,
      spots: choices,
      place,
      offset,
      date,
      day: forecastDay(date, place.lat, place.lng, offset),
      month: forecastMonth(date, place.lat, place.lng, offset),
    };
  });
