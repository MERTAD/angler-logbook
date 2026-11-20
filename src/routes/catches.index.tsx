import { createFileRoute, Link } from "@tanstack/react-router";
import { Fish, Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { EmptyState } from "@/client/components/EmptyState";
import { LocalDateTime, Page } from "@/client/components/Page";
import { PageHeader } from "@/client/components/PageHeader";
import { Button } from "@/client/components/ui/button";
import { Input } from "@/client/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/client/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/client/components/ui/table";
import { getCatches } from "@/serverFunctions/catches";
import { getSpots } from "@/serverFunctions/spots";

export const Route = createFileRoute("/catches/")({
  loader: async () => {
    const [catches, spots] = await Promise.all([getCatches(), getSpots()]);
    return { catches, spots };
  },
  head: () => ({ meta: [{ title: "Catches · Angler Logbook" }] }),
  component: CatchesPage,
});

const ANY = "any";

function CatchesPage() {
  const { catches, spots } = Route.useLoaderData();
  const [species, setSpecies] = useState("");
  const [spot, setSpot] = useState(ANY);
  const shown = useMemo(() => {
    const q = species.trim().toLowerCase();
    return catches.filter(
      (c) => c.species.toLowerCase().includes(q) && (spot === ANY || c.spotId === spot),
    );
  }, [catches, species, spot]);
  const spotItems = [{ value: ANY, label: "All spots" }, ...spots.map((s) => ({ value: s.id, label: s.name }))];
  const logButton = (
    <Button render={<Link to="/catches/new" search={{}} />}>
      <Plus aria-hidden />
      Log a catch
    </Button>
  );

  return (
    <Page>
      <PageHeader title="Catches" actions={catches.length ? logButton : null} />
      {catches.length === 0 ? (
        <EmptyState
          media="rows"
          icon={Fish}
          title="No catches yet"
          description="Log a catch and it will appear here."
          action={logButton}
        />
      ) : (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <Input
              data-testid="filter-species"
              type="search"
              placeholder="Species"
              aria-label="Species"
              value={species}
              onChange={(e) => setSpecies(e.target.value)}
              className="max-w-48"
            />
            <Select items={spotItems} value={spot} onValueChange={(v) => v !== null && setSpot(v)}>
              <SelectTrigger data-testid="filter-spot" aria-label="Spot" className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {spotItems.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {shown.length === 0 ? (
            <EmptyState kind="filtered" title="No catches match these filters" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Species</TableHead>
                  <TableHead>When</TableHead>
                  <TableHead className="hidden sm:table-cell">Where</TableHead>
                  <TableHead className="text-right">Size</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {shown.map((c) => (
                  <TableRow key={c.id} data-testid="catch-row">
                    <TableCell>
                      <Link to="/catches/$catchId" params={{ catchId: c.id }} className="font-medium hover:underline">
                        {c.species}
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      <LocalDateTime iso={c.caughtAt} />
                    </TableCell>
                    <TableCell className="hidden text-muted-foreground sm:table-cell">
                      {c.spotName ?? `${c.lat.toFixed(3)}, ${c.lng.toFixed(3)}`}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground tabular-nums">
                      {[c.lengthCm != null && `${c.lengthCm} cm`, c.weightKg != null && `${c.weightKg} kg`]
                        .filter(Boolean)
                        .join(" · ")}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      )}
    </Page>
  );
}
