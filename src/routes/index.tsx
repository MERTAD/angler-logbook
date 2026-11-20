import { createFileRoute, Link } from "@tanstack/react-router";
import { CalendarDays, MapPin, Plus, Route as RouteIcon } from "lucide-react";
import { useState } from "react";
import { Page } from "@/client/components/Page";
import { PageHeader } from "@/client/components/PageHeader";
import { WorldMap } from "@/client/components/WorldMap";
import { Button } from "@/client/components/ui/button";
import { formatCoord, formatKm, formatNm, pathLength, type LatLng } from "@/lib/geo";
import { getMapData } from "@/serverFunctions/map";

export const Route = createFileRoute("/")({
  loader: () => getMapData(),
  head: () => ({ meta: [{ title: "Angler Logbook" }] }),
  component: MapPage,
});

type Mode = "browse" | "measure" | "pick";
const MODES: { value: Mode; label: string }[] = [
  { value: "browse", label: "Browse" },
  { value: "measure", label: "Measure" },
  { value: "pick", label: "Pick a point" },
];

function MapPage() {
  const { spots, paths, catches } = Route.useLoaderData();
  const [mode, setMode] = useState<Mode>("browse");
  const [measure, setMeasure] = useState<LatLng[]>([]);
  const [picked, setPicked] = useState<LatLng | null>(null);
  const distance = pathLength(measure);

  function choose(next: Mode) {
    setMode(next);
    setMeasure([]);
    setPicked(null);
  }

  return (
    <Page>
      <PageHeader
        title="Map"
        actions={
          <div className="flex gap-1" role="group" aria-label="Map mode">
            {MODES.map((m) => (
              <Button
                key={m.value}
                size="sm"
                variant={mode === m.value ? "default" : "outline"}
                aria-pressed={mode === m.value}
                data-testid={`mode-${m.value}`}
                onClick={() => choose(m.value)}
              >
                {m.label}
              </Button>
            ))}
          </div>
        }
      />
      <WorldMap
        testId="main-map"
        className="h-[28rem]"
        spots={spots}
        paths={paths}
        catches={catches}
        interactive={mode === "browse"}
        draft={
          mode === "measure"
            ? { points: measure }
            : mode === "pick"
              ? { points: [], marker: picked }
              : undefined
        }
        onPick={
          mode === "measure"
            ? (p) => setMeasure((m) => [...m, p])
            : mode === "pick"
              ? setPicked
              : undefined
        }
      >
        {mode === "measure" && (
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
            {measure.length < 2 ? (
              <span className="text-muted-foreground">Click two or more points on the map.</span>
            ) : (
              <span data-testid="measure-result" className="font-medium tabular-nums">
                {formatKm(distance)} · {formatNm(distance)}
              </span>
            )}
            <Button size="sm" variant="outline" disabled={!measure.length} onClick={() => setMeasure([])}>
              Clear
            </Button>
          </div>
        )}
        {mode === "pick" &&
          (picked ? (
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="font-medium tabular-nums" data-testid="picked-point">
                {formatCoord(...picked)}
              </span>
              <Button size="sm" data-testid="pick-new-spot" render={<Link to="/spots/new" search={{ lat: picked[0], lng: picked[1] }} />}>
                <MapPin aria-hidden />
                New spot here
              </Button>
              <Button size="sm" variant="outline" render={<Link to="/paths/new" />}>
                <RouteIcon aria-hidden />
                New path
              </Button>
              <Button size="sm" variant="outline" render={<Link to="/forecast" search={{ lat: picked[0], lng: picked[1] }} />}>
                <CalendarDays aria-hidden />
                Forecast here
              </Button>
            </div>
          ) : null)}
        {mode === "browse" && spots.length + paths.length + catches.length === 0 && (
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="text-muted-foreground">Nothing saved yet.</span>
            <Button size="sm" variant="outline" render={<Link to="/spots/new" />}>
              <Plus aria-hidden />
              New spot
            </Button>
          </div>
        )}
      </WorldMap>
    </Page>
  );
}
