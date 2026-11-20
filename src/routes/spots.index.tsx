import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowDown, ArrowUp, Download, MapPin, Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { EmptyState } from "@/client/components/EmptyState";
import { LocalDateTime, Page } from "@/client/components/Page";
import { PageHeader } from "@/client/components/PageHeader";
import { colorOf } from "@/client/components/WorldMap";
import { ICON_COMPONENTS } from "@/client/lib/icons";
import { Button } from "@/client/components/ui/button";
import { Input } from "@/client/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/client/components/ui/table";
import type { IconKey } from "@/lib/catalog";
import { formatCoord } from "@/lib/geo";
import { getSpots } from "@/serverFunctions/spots";

export const Route = createFileRoute("/spots/")({
  loader: () => getSpots(),
  head: () => ({ meta: [{ title: "Spots · Angler Logbook" }] }),
  component: SpotsPage,
});

type Sort = { by: "name" | "date"; asc: boolean };

function SpotsPage() {
  const spots = Route.useLoaderData();
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<Sort>({ by: "date", asc: false });

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = spots.filter((s) => s.name.toLowerCase().includes(q));
    list.sort((a, b) => {
      const order = sort.by === "name" ? a.name.localeCompare(b.name) : a.createdAt.localeCompare(b.createdAt);
      return sort.asc ? order : -order;
    });
    return list;
  }, [spots, query, sort]);

  function sortBy(by: Sort["by"]) {
    setSort((s) => (s.by === by ? { by, asc: !s.asc } : { by, asc: by === "name" }));
  }
  const arrow = (by: Sort["by"]) =>
    sort.by === by ? (sort.asc ? <ArrowUp aria-hidden /> : <ArrowDown aria-hidden />) : null;

  return (
    <Page>
      <PageHeader
        title="Spots"
        actions={
          <>
            {spots.length > 0 && (
              <Button variant="outline" data-testid="export-gpx" render={<a href="/export/gpx" download />}>
                <Download aria-hidden />
                Export GPX
              </Button>
            )}
            <Button render={<Link to="/spots/new" />}>
              <Plus aria-hidden />
              New spot
            </Button>
          </>
        }
      />
      {spots.length === 0 ? (
        <EmptyState
          media="rows"
          icon={MapPin}
          title="No spots yet"
          description="Save a spot and it will appear here and on the map."
          action={<Button render={<Link to="/spots/new" />}>New spot</Button>}
        />
      ) : (
        <div className="space-y-3">
          <Input
            data-testid="spot-search"
            type="search"
            placeholder="Search by name"
            aria-label="Search by name"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="max-w-xs"
          />
          {shown.length === 0 ? (
            <EmptyState kind="filtered" title="No spots match that name" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>
                    <Button variant="ghost" size="sm" data-testid="sort-name" onClick={() => sortBy("name")}>
                      Name {arrow("name")}
                    </Button>
                  </TableHead>
                  <TableHead className="hidden sm:table-cell">Coordinates</TableHead>
                  <TableHead>
                    <Button variant="ghost" size="sm" data-testid="sort-date" onClick={() => sortBy("date")}>
                      Saved {arrow("date")}
                    </Button>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {shown.map((spot) => {
                  const Icon = ICON_COMPONENTS[spot.icon as IconKey]?.icon ?? MapPin;
                  return (
                    <TableRow key={spot.id} data-testid="spot-row">
                      <TableCell>
                        <Link
                          to="/spots/$spotId"
                          params={{ spotId: spot.id }}
                          className="inline-flex items-center gap-2 font-medium hover:underline"
                        >
                          <Icon className="size-4 shrink-0" style={{ color: colorOf(spot.color) }} aria-hidden />
                          {spot.name}
                        </Link>
                      </TableCell>
                      <TableCell className="hidden text-muted-foreground tabular-nums sm:table-cell">
                        {formatCoord(spot.lat, spot.lng)}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        <LocalDateTime iso={spot.createdAt} dateOnly />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </div>
      )}
    </Page>
  );
}
