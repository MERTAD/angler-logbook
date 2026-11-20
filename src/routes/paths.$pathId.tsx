import { createFileRoute, useNavigate, useRouter } from "@tanstack/react-router";
import { Pencil, Trash2 } from "lucide-react";
import { useState } from "react";
import { ConfirmDialog } from "@/client/components/ConfirmDialog";
import { Detail, errorText, LocalDateTime, NotFoundState, Page } from "@/client/components/Page";
import { BackLink, PageHeader } from "@/client/components/PageHeader";
import { PathForm } from "@/client/components/PathForm";
import { WorldMap } from "@/client/components/WorldMap";
import { Alert, AlertDescription } from "@/client/components/ui/alert";
import { Button } from "@/client/components/ui/button";
import { PATH_KINDS, type ColorKey } from "@/lib/catalog";
import { formatCoord, formatKm, formatNm } from "@/lib/geo";
import { deletePath, getPath, updatePath } from "@/serverFunctions/paths";
import { getSpots } from "@/serverFunctions/spots";

export const Route = createFileRoute("/paths/$pathId")({
  loader: async ({ params }) => {
    const [path, spots] = await Promise.all([
      getPath({ data: { id: params.pathId } }).catch(() => null),
      getSpots(),
    ]);
    return { path, spots };
  },
  head: ({ loaderData }) => ({
    meta: [{ title: `${loaderData?.path?.name ?? "Path"} · Angler Logbook` }],
  }),
  component: PathPage,
});

function PathPage() {
  const { path, spots } = Route.useLoaderData();
  const router = useRouter();
  const navigate = useNavigate();
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const back = <BackLink to="/paths">Paths</BackLink>;

  if (!path)
    return (
      <Page>
        <PageHeader title="Path" backLink={back} />
        <NotFoundState what="Path" />
      </Page>
    );

  async function remove() {
    setPending(true);
    setError(null);
    try {
      await deletePath({ data: { id: path!.id } });
      await navigate({ to: "/paths" });
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
        title={path.name}
        backLink={back}
        actions={
          editing ? null : (
            <>
              <Button variant="outline" data-testid="edit-path" onClick={() => setEditing(true)}>
                <Pencil aria-hidden />
                Edit
              </Button>
              <Button variant="outline" data-testid="delete-path" onClick={() => setConfirming(true)}>
                <Trash2 aria-hidden />
                Delete
              </Button>
            </>
          )
        }
      />
      {editing ? (
        <PathForm
          initial={{ ...path, color: path.color as ColorKey }}
          spots={spots}
          submitLabel="Save changes"
          onCancel={() => setEditing(false)}
          onSubmit={async (values) => {
            await updatePath({ data: { id: path.id, ...values } });
            await router.invalidate();
            setEditing(false);
          }}
        />
      ) : (
        <>
          <dl className="grid gap-4 sm:grid-cols-3">
            <Detail label="Kind" testId="path-kind">
              {PATH_KINDS[path.kind]}
            </Detail>
            <Detail label="Length" testId="path-length">
              <span className="tabular-nums">
                {formatKm(path.lengthM)} · {formatNm(path.lengthM)}
              </span>
            </Detail>
            <Detail label="Saved">
              <LocalDateTime iso={path.createdAt} />
            </Detail>
          </dl>
          {path.notes ? (
            <Detail label="Notes">
              <p className="whitespace-pre-wrap">{path.notes}</p>
            </Detail>
          ) : null}
          <WorldMap testId="path-view-map" className="h-80" paths={[path]} />
          <ol className="grid gap-1 text-xs text-muted-foreground tabular-nums sm:grid-cols-2">
            {path.points.map(([lat, lng], i) => (
              <li key={i} data-testid="path-point">
                {i + 1}. {formatCoord(lat, lng)}
              </li>
            ))}
          </ol>
        </>
      )}
      {error ? (
        <Alert variant="destructive" data-testid="form-error">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      {confirming ? (
        <ConfirmDialog
          title={`Delete ${path.name}?`}
          confirmLabel="Delete path"
          destructive
          pending={pending}
          onConfirm={remove}
          onClose={() => setConfirming(false)}
        />
      ) : null}
    </Page>
  );
}
