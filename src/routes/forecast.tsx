import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight, LocateFixed } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Detail, NotFoundState, Page } from "@/client/components/Page";
import { PageHeader } from "@/client/components/PageHeader";
import { Button } from "@/client/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/client/components/ui/card";
import { Field, FieldLabel } from "@/client/components/ui/field";
import { Input } from "@/client/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/client/components/ui/select";
import { formatCoord, formatOffset } from "@/lib/geo";
import { localTime, scoreLabel, type DayForecast } from "@/lib/solunar";
import { forecastInput, getForecast } from "@/serverFunctions/forecast";

export const Route = createFileRoute("/forecast")({
  validateSearch: (search) => {
    const parsed = forecastInput.safeParse(search);
    return parsed.success ? parsed.data : {};
  },
  loaderDeps: ({ search }) => search,
  loader: ({ deps }) => getForecast({ data: deps }),
  head: () => ({ meta: [{ title: "Forecast · Angler Logbook" }] }),
  component: ForecastPage,
});

const COORDS = "coords";

function ForecastPage() {
  const result = Route.useLoaderData();
  const search = Route.useSearch();
  if (result.missing)
    return (
      <Page>
        <PageHeader title="Forecast" />
        <NotFoundState what="Spot" />
      </Page>
    );
  return (
    <Page>
      <PageHeader title="Forecast" />
      <PlaceForm spots={result.spots} search={search} place={result.place} />
      {result.place ? (
        <Forecast
          place={result.place}
          day={result.day!}
          month={result.month!}
          offset={result.offset!}
          search={search}
        />
      ) : null}
    </Page>
  );
}

type Search = ReturnType<typeof Route.useSearch>;

function PlaceForm({
  spots,
  search,
  place,
}: {
  spots: { id: string; name: string }[];
  search: Search;
  place: { spotId: string | null; lat: number; lng: number } | null;
}) {
  const navigate = useNavigate();
  const [lat, setLat] = useState(place && !place.spotId ? String(place.lat) : "");
  const [lng, setLng] = useState(place && !place.spotId ? String(place.lng) : "");
  const which = search.spot ?? COORDS;
  const items = [
    ...spots.map((s) => ({ value: s.id, label: s.name })),
    { value: COORDS, label: "Coordinates" },
  ];

  function go(event?: FormEvent) {
    event?.preventDefault();
    if (lat.trim() === "" || lng.trim() === "") return;
    void navigate({
      to: "/forecast",
      search: { lat: Number(lat), lng: Number(lng), date: search.date },
    });
  }

  return (
    <div className="flex flex-wrap items-end gap-3">
      <Field className="w-56">
        <FieldLabel htmlFor="forecast-spot">Place</FieldLabel>
        <Select
          items={items}
          value={which}
          onValueChange={(value) => {
            if (value && value !== COORDS)
              void navigate({ to: "/forecast", search: { spot: value, date: search.date } });
            else if (value === COORDS) void navigate({ to: "/forecast", search: { date: search.date } });
          }}
        >
          <SelectTrigger id="forecast-spot" data-testid="forecast-spot" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {items.map((item) => (
              <SelectItem key={item.value} value={item.value}>
                {item.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      {which === COORDS && (
        <form onSubmit={go} className="flex flex-wrap items-end gap-3">
          <Field className="w-32">
            <FieldLabel htmlFor="forecast-lat">Latitude</FieldLabel>
            <Input id="forecast-lat" data-testid="forecast-lat" inputMode="decimal" value={lat} onChange={(e) => setLat(e.target.value)} />
          </Field>
          <Field className="w-32">
            <FieldLabel htmlFor="forecast-lng">Longitude</FieldLabel>
            <Input id="forecast-lng" data-testid="forecast-lng" inputMode="decimal" value={lng} onChange={(e) => setLng(e.target.value)} />
          </Field>
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label="Use my position"
            onClick={() =>
              navigator.geolocation?.getCurrentPosition((pos) => {
                setLat(pos.coords.latitude.toFixed(5));
                setLng(pos.coords.longitude.toFixed(5));
              })
            }
          >
            <LocateFixed />
          </Button>
          <Button type="submit" data-testid="forecast-go">
            Show forecast
          </Button>
        </form>
      )}
    </div>
  );
}

const longDate = (date: string) =>
  new Date(`${date}T12:00:00Z`).toLocaleDateString("en-US", {
    timeZone: "UTC",
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });

function shiftMonth(date: string, by: number): string {
  const d = new Date(`${date}T12:00:00Z`);
  const target = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + by, 1, 12));
  const days = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(d.getUTCDate(), days));
  return target.toISOString().slice(0, 10);
}

const BUCKETS = [
  "bg-muted text-muted-foreground",
  "bg-primary/15 text-foreground",
  "bg-primary/30 text-foreground",
  "bg-primary/60 text-primary-foreground",
  "bg-primary text-primary-foreground",
];
const bucket = (score: number) => BUCKETS[Math.min(4, Math.floor(score / 20))];

function Forecast({
  place,
  day,
  month,
  offset,
  search,
}: {
  place: { name: string | null; lat: number; lng: number };
  day: DayForecast;
  month: { date: string; score: number }[];
  offset: number;
  search: Search;
}) {
  const navigate = useNavigate();
  const time = (t: number | null) => (t === null ? "None" : localTime(t, offset));
  const start = Date.parse(`${day.date}T00:00:00Z`) - offset * 3600_000;
  const inPeriod = (hour: number, kind: "major" | "minor") =>
    day.periods.some(
      (p) => p.kind === kind && p.start < start + (hour + 1) * 3600_000 && p.end > start + hour * 3600_000,
    );
  const firstWeekday = new Date(`${month[0]!.date}T12:00:00Z`).getUTCDay();
  const offsets = Array.from({ length: 27 }, (_, i) => i - 12);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <p className="text-lg font-semibold" data-testid="forecast-place">
            {place.name ?? formatCoord(place.lat, place.lng)}
          </p>
          <p className="text-sm text-muted-foreground" data-testid="forecast-date">
            {longDate(day.date)}
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <Field className="w-40">
            <FieldLabel htmlFor="forecast-day">Date</FieldLabel>
            <Input
              id="forecast-day"
              type="date"
              value={day.date}
              onChange={(e) =>
                e.target.value &&
                void navigate({ to: "/forecast", search: { ...search, date: e.target.value } })
              }
            />
          </Field>
          <Field className="w-28">
            <FieldLabel htmlFor="forecast-tz">Time zone</FieldLabel>
            <Select
              items={offsets.map((o) => ({ value: String(o), label: formatOffset(o) }))}
              value={String(offset)}
              onValueChange={(v) =>
                v !== null && void navigate({ to: "/forecast", search: { ...search, tz: Number(v) } })
              }
            >
              <SelectTrigger id="forecast-tz" data-testid="timezone" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {offsets.map((o) => (
                  <SelectItem key={o} value={String(o)}>
                    {formatOffset(o)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Fish activity</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex items-baseline gap-2">
            <span className="text-4xl font-semibold tabular-nums" data-testid="day-score">
              {day.score}
            </span>
            <span className="text-muted-foreground">/ 100 · {scoreLabel(day.score)}</span>
          </div>
          <div>
            <div className="flex h-32 items-end gap-0.5" role="img" aria-label="Activity by hour">
              {day.hourly.map((score, hour) => (
                <div
                  key={hour}
                  data-testid="hour-bar"
                  title={`${String(hour).padStart(2, "0")}:00 · ${score}`}
                  className={`flex-1 rounded-t-sm ${inPeriod(hour, "major") ? "bg-primary" : inPeriod(hour, "minor") ? "bg-primary/60" : "bg-primary/25"}`}
                  style={{ height: `${Math.max(3, score)}%` }}
                />
              ))}
            </div>
            <div className="mt-1 flex justify-between text-xs text-muted-foreground tabular-nums">
              <span>00</span>
              <span>06</span>
              <span>12</span>
              <span>18</span>
              <span>23</span>
            </div>
          </div>
          <ul className="grid gap-2 text-sm sm:grid-cols-2">
            {day.periods.map((p) => (
              <li key={p.start} data-testid={`${p.kind}-period`} className="flex justify-between gap-3 rounded-lg border border-border px-3 py-2">
                <span className="font-medium">{p.kind === "major" ? "Major" : "Minor"}</span>
                <span className="text-muted-foreground">
                  {EVENT_LABEL[p.event]}
                </span>
                <span className="tabular-nums">
                  {localTime(p.start, offset)}–{localTime(p.end, offset)}
                </span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Sun and moon</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Detail label="Sunrise" testId="sunrise">{time(day.sunrise)}</Detail>
            <Detail label="Sunset" testId="sunset">{time(day.sunset)}</Detail>
            <Detail label="Moonrise" testId="moonrise">{time(day.moonrise)}</Detail>
            <Detail label="Moonset" testId="moonset">{time(day.moonset)}</Detail>
            <Detail label="Moon overhead" testId="moon-overhead">{time(day.moonOverhead)}</Detail>
            <Detail label="Moon underfoot" testId="moon-underfoot">{time(day.moonUnderfoot)}</Detail>
            <Detail label="Phase" testId="moon-phase">{day.phaseName}</Detail>
            <Detail label="Illumination" testId="illumination">{day.illumination}%</Detail>
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>
            {new Date(`${day.date}T12:00:00Z`).toLocaleDateString("en-US", { timeZone: "UTC", month: "long", year: "numeric" })}
          </CardTitle>
          <div className="flex gap-1">
            <Button variant="ghost" size="icon-sm" aria-label="Previous month" render={<Link to="/forecast" search={{ ...search, date: shiftMonth(day.date, -1) }} />}>
              <ChevronLeft />
            </Button>
            <Button variant="ghost" size="icon-sm" aria-label="Next month" render={<Link to="/forecast" search={{ ...search, date: shiftMonth(day.date, 1) }} />}>
              <ChevronRight />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-7 gap-1 text-center text-xs text-muted-foreground">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
              <div key={d}>{d}</div>
            ))}
            {Array.from({ length: firstWeekday }, (_, i) => (
              <div key={`blank-${i}`} />
            ))}
            {month.map((m) => (
              <Link
                key={m.date}
                to="/forecast"
                search={{ ...search, date: m.date }}
                data-testid="calendar-day"
                aria-current={m.date === day.date ? "date" : undefined}
                className={`flex flex-col items-center rounded-md py-1.5 ${bucket(m.score)} ${m.date === day.date ? "ring-2 ring-ring" : ""}`}
              >
                <span className="text-sm font-medium">{Number(m.date.slice(8))}</span>
                <span className="text-xs tabular-nums opacity-80">{m.score}</span>
              </Link>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

const EVENT_LABEL = {
  overhead: "Moon overhead",
  underfoot: "Moon underfoot",
  moonrise: "Moonrise",
  moonset: "Moonset",
} as const;
