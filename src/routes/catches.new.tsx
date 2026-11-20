import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { z } from "zod";
import { CatchForm, uploadPhotos } from "@/client/components/CatchForm";
import { errorText, Page } from "@/client/components/Page";
import { BackLink, PageHeader } from "@/client/components/PageHeader";
import { createCatch } from "@/serverFunctions/catches";
import { getSpots } from "@/serverFunctions/spots";

export const Route = createFileRoute("/catches/new")({
  validateSearch: z.object({ spot: z.string().optional().catch(undefined) }),
  loader: () => getSpots(),
  head: () => ({ meta: [{ title: "Log a catch · Angler Logbook" }] }),
  component: NewCatch,
});

function NewCatch() {
  const spots = Route.useLoaderData();
  const { spot } = Route.useSearch();
  const navigate = useNavigate();
  return (
    <Page>
      <PageHeader title="Log a catch" backLink={<BackLink to="/catches">Catches</BackLink>} />
      <CatchForm
        initial={{ spotId: spots.some((s) => s.id === spot) ? spot : undefined }}
        spots={spots}
        submitLabel="Save catch"
        onSubmit={async (values, files) => {
          const made = await createCatch({ data: values });
          try {
            await uploadPhotos(made.id, files);
          } catch (cause) {
            toast.error(errorText(cause));
          }
          await navigate({ to: "/catches/$catchId", params: { catchId: made.id } });
        }}
      />
    </Page>
  );
}
