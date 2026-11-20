import { createFileRoute, Link } from "@tanstack/react-router";
import { Plus, Route as RouteIcon } from "lucide-react";
import { EmptyState } from "@/client/components/EmptyState";
import { LocalDateTime, Page } from "@/client/components/Page";
import { PageHeader } from "@/client/components/PageHeader";
import { colorOf } from "@/client/components/WorldMap";
import { Button } from "@/client/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/client/components/ui/table";
import { PATH_KINDS } from "@/lib/catalog";
import { formatKm } from "@/lib/geo";
import { getPaths } from "@/serverFunctions/paths";

export const Route = createFileRoute("/paths/")({
  loader: () => getPaths(),
  head: () => ({ meta: [{ title: "Paths · Angler Logbook" }] }),
  component: PathsPage,
});

function PathsPage() {
  const paths = Route.useLoaderData();
  const newPath = (
    <Button render={<Link to="/paths/new" />}>
      <Plus aria-hidden />
      New path
    </Button>
  );
  return (
    <Page>
      <PageHeader title="Paths" actions={paths.length ? newPath : null} />
      {paths.length === 0 ? (
        <EmptyState
          media="rows"
          icon={RouteIcon}
          title="No trotlines or trolling paths yet"
          description="Draw one on the map and it will appear here."
          action={newPath}
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Kind</TableHead>
              <TableHead className="text-right">Length</TableHead>
              <TableHead className="hidden sm:table-cell">Saved</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paths.map((path) => (
              <TableRow key={path.id} data-testid="path-row">
                <TableCell>
                  <Link
                    to="/paths/$pathId"
                    params={{ pathId: path.id }}
                    className="inline-flex items-center gap-2 font-medium hover:underline"
                  >
                    <span className="h-1 w-4 shrink-0 rounded-full" style={{ backgroundColor: colorOf(path.color) }} aria-hidden />
                    {path.name}
                  </Link>
                </TableCell>
                <TableCell className="text-muted-foreground">{PATH_KINDS[path.kind]}</TableCell>
                <TableCell className="text-right tabular-nums">{formatKm(path.lengthM)}</TableCell>
                <TableCell className="hidden text-muted-foreground sm:table-cell">
                  <LocalDateTime iso={path.createdAt} dateOnly />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </Page>
  );
}
