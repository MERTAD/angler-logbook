import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Page } from "@/client/components/Page";
import { BackLink, PageHeader } from "@/client/components/PageHeader";
import { PathForm } from "@/client/components/PathForm";
import { createPath } from "@/serverFunctions/paths";
import { getSpots } from "@/serverFunctions/spots";

export const Route = createFileRoute("/paths/new")({
  loader: () => getSpots(),
  head: () => ({ meta: [{ title: "New path · Angler Logbook" }] }),
  component: NewPath,
});

function NewPath() {
  const spots = Route.useLoaderData();
  const navigate = useNavigate();
  return (
    <Page>
      <PageHeader title="New path" backLink={<BackLink to="/paths">Paths</BackLink>} />
      <PathForm
        initial={{}}
        spots={spots}
        submitLabel="Save path"
        onSubmit={async (values) => {
          const path = await createPath({ data: values });
          await navigate({ to: "/paths/$pathId", params: { pathId: path.id } });
        }}
      />
    </Page>
  );
}
