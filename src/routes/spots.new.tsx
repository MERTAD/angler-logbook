import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import { Page } from "@/client/components/Page";
import { BackLink, PageHeader } from "@/client/components/PageHeader";
import { SpotForm } from "@/client/components/SpotForm";
import { createSpot, getSpots } from "@/serverFunctions/spots";

export const Route = createFileRoute("/spots/new")({
  validateSearch: z.object({
    lat: z.coerce.number().min(-90).max(90).optional().catch(undefined),
    lng: z.coerce.number().min(-180).max(180).optional().catch(undefined),
  }),
  loader: () => getSpots(),
  head: () => ({ meta: [{ title: "New spot · Angler Logbook" }] }),
  component: NewSpot,
});

function NewSpot() {
  const spots = Route.useLoaderData();
  const { lat, lng } = Route.useSearch();
  const navigate = useNavigate();
  return (
    <Page>
      <PageHeader title="New spot" backLink={<BackLink to="/spots">Spots</BackLink>} />
      <SpotForm
        initial={{ lat, lng }}
        otherSpots={spots}
        submitLabel="Save spot"
        onSubmit={async (values) => {
          const spot = await createSpot({ data: values });
          await navigate({ to: "/spots/$spotId", params: { spotId: spot.id } });
        }}
      />
    </Page>
  );
}
