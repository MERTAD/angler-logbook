import { Link } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { AppShell } from "@/client/components/AppShell";
import { EmptyState } from "@/client/components/EmptyState";

const LINKS = [
  { to: "/", label: "Map" },
  { to: "/spots", label: "Spots" },
  { to: "/paths", label: "Paths" },
  { to: "/catches", label: "Catches" },
  { to: "/forecast", label: "Forecast" },
] as const;

/** The app's frame: the shell with the section links. */
export function Page({ children }: { children: ReactNode }) {
  return (
    <AppShell
      nav={
        <nav className="flex min-w-0 items-center gap-3 overflow-x-auto text-sm">
          {LINKS.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              activeOptions={{ exact: link.to === "/" }}
              className="shrink-0 text-muted-foreground transition-colors hover:text-foreground data-[status=active]:font-medium data-[status=active]:text-foreground"
            >
              {link.label}
            </Link>
          ))}
        </nav>
      }
    >
      {children}
    </AppShell>
  );
}

export function NotFoundState({ what }: { what: string }) {
  return (
    <div data-testid="not-found">
      <EmptyState kind="filtered" title={`${what} not found`} />
    </div>
  );
}

/** True after the first render in the browser. */
function useMounted() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted;
}

/** A date and time in the browser's time zone. */
export function LocalDateTime({ iso, dateOnly = false }: { iso: string; dateOnly?: boolean }) {
  const mounted = useMounted();
  const date = new Date(iso);
  const text = mounted
    ? dateOnly
      ? date.toLocaleDateString(undefined, { dateStyle: "medium" })
      : date.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })
    : iso.slice(0, dateOnly ? 10 : 16).replace("T", " ");
  return <time dateTime={iso}>{text}</time>;
}

export function errorText(cause: unknown): string {
  if (cause instanceof Error) {
    try {
      // A validation error carries zod's issues as JSON.
      const issues = JSON.parse(cause.message) as { message: string }[];
      if (Array.isArray(issues) && issues[0]?.message) return issues[0].message;
    } catch {
      // A plain message.
    }
    return cause.message;
  }
  return "That didn't work.";
}

/** A labelled value in a detail list. */
export function Detail({ label, children, testId }: { label: string; children: ReactNode; testId?: string }) {
  return (
    <div className="space-y-0.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm" data-testid={testId}>
        {children}
      </dd>
    </div>
  );
}
