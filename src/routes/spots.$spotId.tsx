import { createFileRoute, Link, useNavigate, useRouter } from "@tanstack/react-router";
import { CalendarDays, Fish, MapPin, Pencil, Trash2 } from "lucide-react";
import { useState } from "react";
import { ConfirmDialog } from "@/client/components/ConfirmDialog";
import { Detail, errorText, LocalDateTime, NotFoundState, Page } from "@/client/components/Page";
import { BackLink, PageHeader } from "@/client/components/PageHeader";
import { SpotForm } from "@/client/components/SpotForm";
import { colorOf, WorldMap } from "@/client/components/WorldMap";
import { ICON_COMPONENTS } from "@/client/lib/icons";
import { Alert, AlertDescription } from "@/client/components/ui/alert";
import { Button } from "@/client/components/ui/button";
import { COLORS, type ColorKey, type IconKey } from "@/lib/catalog";
import { formatCoord } from "@/lib/geo";
import { deleteSpot, getSpot, getSpots, updateSpot } from "@/serverFunctions/spots";

export const Route = createFileRoute("/spots/$spotId")({
  loader: async ({ params }) => {
    const [spot, spots] = await Promise.all([
      getSpot({ data: { id: params.spotId } }).catch(() => null),
      getSpots(),
    ]);
    return { spot, others: spots.filter((s) => s.id !== params.spotId) };
  },
  head: ({ loaderData }) => ({
    meta: [{ title: `${loaderData?.spot?.name ?? "Spot"} · Angler Logbook` }],
  }),
  component: SpotPage,
});

function SpotPage() {
  const { spot, others } = Route.useLoaderData();
  const router = useRouter();
  const navigate = useNavigate();
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const back = <BackLink to="/spots">Spots</BackLink>;

  if (!spot)
    return (
      <Page>
        <PageHeader title="Spot" backLink={back} />
        <NotFoundState what="Spot" />
      </Page>
    );

  const Icon = ICON_COMPONENTS[spot.icon as IconKey]?.icon ?? MapPin;

  async function remove() {
    setPending(true);
    setError(null);
    try {
      await deleteSpot({ data: { id: spot!.id } });
      await navigate({ to: "/spots" });
    } catch (cause) {
      setError(errorText(cause));
      setConfirming(false);
    } finally {
      setPending(false);
    }
  }

  return (
    <Page>
      <PageHeader
        title={spot.name}
        backLink={back}
        actions={
          editing ? null : (
            <>
              <Button variant="outline" data-testid="edit-spot" onClick={() => setEditing(true)}>
                <Pencil aria-hidden />
                Edit
              </Button>
              <Button variant="outline" data-testid="delete-spot" onClick={() => setConfirming(true)}>
                <Trash2 aria-hidden />
                Delete
              </Button>
            </>
          )
        }
      />
      {editing ? (
        <SpotForm
          initial={{ ...spot, icon: spot.icon as IconKey, color: spot.color as ColorKey }}
          otherSpots={others}
          submitLabel="Save changes"
          onCancel={() => setEditing(false)}
          onSubmit={async (values) => {
            await updateSpot({ data: { id: spot.id, ...values } });
            await router.invalidate();
            setEditing(false);
          }}
        />
      ) : (
        <>
          <dl className="grid gap-4 sm:grid-cols-3">
            <Detail label="Coordinates" testId="spot-coordinates">
              <span className="tabular-nums">{formatCoord(spot.lat, spot.lng)}</span>
            </Detail>
            <Detail label="Marker">
              <span className="inline-flex items-center gap-2">
                <Icon className="size-4" style={{ color: colorOf(spot.color) }} aria-hidden />
                {ICON_COMPONENTS[spot.icon as IconKey]?.label}, {COLORS[spot.color as ColorKey]?.label}
              </span>
            </Detail>
            <Detail label="Saved">
              <LocalDateTime iso={spot.createdAt} />
            </Detail>
          </dl>
          {spot.notes ? (
            <Detail label="Notes">
              <p className="whitespace-pre-wrap" data-testid="spot-notes-view">
                {spot.notes}
              </p>
            </Detail>
          ) : null}
          <WorldMap testId="spot-view-map" className="h-72" spots={[spot]} />
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" render={<Link to="/forecast" search={{ spot: spot.id }} />}>
              <CalendarDays aria-hidden />
              Forecast
            </Button>
            <Button variant="outline" render={<Link to="/catches/new" search={{ spot: spot.id }} />}>
              <Fish aria-hidden />
              Log a catch here
            </Button>
          </div>
        </>
      )}
      {error ? (
        <Alert variant="destructive" data-testid="form-error">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      {confirming ? (
        <ConfirmDialog
          title={`Delete ${spot.name}?`}
          confirmLabel="Delete spot"
          destructive
          pending={pending}
          onConfirm={remove}
          onClose={() => setConfirming(false)}
        >
          Catches logged here keep their coordinates.
        </ConfirmDialog>
      ) : null}
    </Page>
  );
}
