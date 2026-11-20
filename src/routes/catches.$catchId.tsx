import { createFileRoute, Link, useNavigate, useRouter } from "@tanstack/react-router";
import { Pencil, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { CatchForm, uploadPhotos } from "@/client/components/CatchForm";
import { ConfirmDialog } from "@/client/components/ConfirmDialog";
import { Detail, errorText, LocalDateTime, NotFoundState, Page } from "@/client/components/Page";
import { BackLink, PageHeader } from "@/client/components/PageHeader";
import { Alert, AlertDescription } from "@/client/components/ui/alert";
import { Button } from "@/client/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/client/components/ui/card";
import { formatCoord, formatOffset } from "@/lib/geo";
import { localDate, localTime, scoreLabel } from "@/lib/solunar";
import { deleteCatch, deletePhoto, getCatch, updateCatch } from "@/serverFunctions/catches";
import { getSpots } from "@/serverFunctions/spots";

export const Route = createFileRoute("/catches/$catchId")({
  loader: async ({ params }) => {
    const [found, spots] = await Promise.all([
      getCatch({ data: { id: params.catchId } }).catch(() => null),
      getSpots(),
    ]);
    return { found, spots: spots.map((s) => ({ id: s.id, name: s.name })) };
  },
  head: ({ loaderData }) => ({
    meta: [{ title: `${loaderData?.found?.species ?? "Catch"} · Angler Logbook` }],
  }),
  component: CatchPage,
});

function CatchPage() {
  const { found, spots } = Route.useLoaderData();
  const router = useRouter();
  const navigate = useNavigate();
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const back = <BackLink to="/catches">Catches</BackLink>;

  if (!found)
    return (
      <Page>
        <PageHeader title="Catch" backLink={back} />
        <NotFoundState what="Catch" />
      </Page>
    );
  const c = found;
  const cond = c.conditions;
  const at = new Date(cond.at).getTime();

  async function remove() {
    setPending(true);
    setError(null);
    try {
      await deleteCatch({ data: { id: c.id } });
      await navigate({ to: "/catches" });
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
        title={c.species}
        description={<LocalDateTime iso={c.caughtAt} />}
        backLink={back}
        actions={
          editing ? null : (
            <>
              <Button variant="outline" data-testid="edit-catch" onClick={() => setEditing(true)}>
                <Pencil aria-hidden />
                Edit
              </Button>
              <Button variant="outline" data-testid="delete-catch" onClick={() => setConfirming(true)}>
                <Trash2 aria-hidden />
                Delete
              </Button>
            </>
          )
        }
      />
      {editing ? (
        <CatchForm
          initial={c}
          spots={spots}
          photos={c.photos}
          submitLabel="Save changes"
          onCancel={() => setEditing(false)}
          onRemovePhoto={async (id) => {
            await deletePhoto({ data: { id } });
            await router.invalidate();
          }}
          onSubmit={async (values, files) => {
            await updateCatch({ data: { id: c.id, ...values } });
            try {
              await uploadPhotos(c.id, files);
            } catch (cause) {
              toast.error(errorText(cause));
            }
            await router.invalidate();
            setEditing(false);
          }}
        />
      ) : (
        <>
          <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Detail label="Where">
              {c.spotId && c.spotName ? (
                <Link
                  to="/spots/$spotId"
                  params={{ spotId: c.spotId }}
                  data-testid="catch-spot-link"
                  className="font-medium hover:underline"
                >
                  {c.spotName}
                </Link>
              ) : (
                <span className="tabular-nums">{formatCoord(c.lat, c.lng)}</span>
              )}
            </Detail>
            <Detail label="Length">{c.lengthCm != null ? `${c.lengthCm} cm` : "—"}</Detail>
            <Detail label="Weight">{c.weightKg != null ? `${c.weightKg} kg` : "—"}</Detail>
            <Detail label="Gear">{c.gear || "—"}</Detail>
          </dl>
          {c.notes ? (
            <Detail label="Notes">
              <p className="whitespace-pre-wrap">{c.notes}</p>
            </Detail>
          ) : null}
          {c.photos.length > 0 && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {c.photos.map((id) => (
                <a key={id} href={`/photos/${id}`} target="_blank" rel="noreferrer">
                  <img
                    data-testid="catch-photo"
                    src={`/photos/${id}`}
                    alt={c.species}
                    className="aspect-square w-full rounded-lg border border-border object-cover"
                  />
                </a>
              ))}
            </div>
          )}
          <Card>
            <CardHeader>
              <CardTitle>Conditions</CardTitle>
              <p className="text-sm text-muted-foreground" data-testid="cond-recorded-for">
                {localDate(at, cond.offset)} {localTime(at, cond.offset)} {formatOffset(cond.offset)}
              </p>
            </CardHeader>
            <CardContent>
              <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                <Detail label="Fish activity, day">
                  <span className="text-lg font-semibold tabular-nums" data-testid="cond-score">
                    {cond.dayScore}
                  </span>{" "}
                  <span className="text-muted-foreground">{scoreLabel(cond.dayScore)}</span>
                </Detail>
                <Detail label="Fish activity, that hour">
                  <span className="tabular-nums">{cond.hourScore}</span>
                </Detail>
                <Detail label="Solunar period" testId="cond-period">
                  {cond.period}
                </Detail>
                <Detail label="Light" testId="cond-daylight">
                  {cond.daylight}
                </Detail>
                <Detail label="Sun altitude">
                  <span className="tabular-nums">{cond.sunAltitude}°</span>
                </Detail>
                <Detail label="Moon">
                  <span data-testid="cond-moon-phase">{cond.phaseName}</span>,{" "}
                  <span data-testid="cond-illumination">{cond.illumination}%</span> lit
                </Detail>
              </dl>
            </CardContent>
          </Card>
        </>
      )}
      {error ? (
        <Alert variant="destructive" data-testid="form-error">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      {confirming ? (
        <ConfirmDialog
          title={`Delete this ${c.species}?`}
          confirmLabel="Delete catch"
          destructive
          pending={pending}
          onConfirm={remove}
          onClose={() => setConfirming(false)}
        >
          Its photos are deleted too.
        </ConfirmDialog>
      ) : null}
    </Page>
  );
}
