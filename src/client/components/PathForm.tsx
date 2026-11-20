import { Trash2, Undo2 } from "lucide-react";
import { useState, type FormEvent } from "react";
import { errorText } from "@/client/components/Page";
import { ColorPicker } from "@/client/components/Pickers";
import { colorOf, WorldMap, type MapSpot } from "@/client/components/WorldMap";
import { Alert, AlertDescription } from "@/client/components/ui/alert";
import { Button } from "@/client/components/ui/button";
import { Field, FieldGroup, FieldLabel } from "@/client/components/ui/field";
import { Input } from "@/client/components/ui/input";
import { Textarea } from "@/client/components/ui/textarea";
import { PATH_KINDS, type ColorKey } from "@/lib/catalog";
import { formatCoord, formatKm, formatNm, pathLength, type LatLng } from "@/lib/geo";

export interface PathValues {
  name: string;
  kind: "trotline" | "trolling";
  notes: string;
  color: ColorKey;
  points: LatLng[];
}

export function PathForm({
  initial,
  spots,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  initial: Partial<PathValues>;
  spots: MapSpot[];
  submitLabel: string;
  onSubmit: (values: PathValues) => Promise<void>;
  onCancel?: () => void;
}) {
  const [name, setName] = useState(initial.name ?? "");
  const [kind, setKind] = useState<PathValues["kind"]>(initial.kind ?? "trotline");
  const [notes, setNotes] = useState(initial.notes ?? "");
  const [color, setColor] = useState<ColorKey>(initial.color ?? "orange");
  const [points, setPoints] = useState<LatLng[]>(initial.points ?? []);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const length = pathLength(points);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    if (points.length < 2) {
      setError("Click the map at least twice to draw the path.");
      return;
    }
    setPending(true);
    try {
      await onSubmit({ name, kind, notes, color, points });
    } catch (cause) {
      setError(errorText(cause));
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="path-name">Name</FieldLabel>
          <Input id="path-name" data-testid="path-name" value={name} onChange={(e) => setName(e.target.value)} required maxLength={120} />
        </Field>
        <Field>
          <FieldLabel>Kind</FieldLabel>
          <div role="radiogroup" aria-label="Kind" className="flex gap-2">
            {(Object.keys(PATH_KINDS) as PathValues["kind"][]).map((key) => (
              <Button
                key={key}
                type="button"
                role="radio"
                aria-checked={kind === key}
                data-testid={`kind-${key}`}
                variant={kind === key ? "default" : "outline"}
                onClick={() => setKind(key)}
              >
                {PATH_KINDS[key]}
              </Button>
            ))}
          </div>
        </Field>
        <Field>
          <FieldLabel>Line</FieldLabel>
          <WorldMap
            testId="path-map"
            className="h-80"
            spots={spots}
            draft={{ points, color: colorOf(color) }}
            onPick={(point) => setPoints((p) => [...p, point])}
            interactive={false}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm">
                <span data-testid="path-length" className="font-medium tabular-nums">
                  {formatKm(length)} · {formatNm(length)}
                </span>
                <span className="text-muted-foreground"> · {points.length} points</span>
              </p>
              <div className="flex gap-2">
                <Button type="button" variant="outline" size="sm" disabled={!points.length} onClick={() => setPoints((p) => p.slice(0, -1))}>
                  <Undo2 aria-hidden />
                  Undo
                </Button>
                <Button type="button" variant="outline" size="sm" data-testid="clear-points" disabled={!points.length} onClick={() => setPoints([])}>
                  <Trash2 aria-hidden />
                  Clear
                </Button>
              </div>
            </div>
          </WorldMap>
          {points.length > 0 && (
            <ol className="grid gap-1 text-xs text-muted-foreground tabular-nums sm:grid-cols-2">
              {points.map(([lat, lng], i) => (
                <li key={i} data-testid="path-point">
                  {i + 1}. {formatCoord(lat, lng)}
                </li>
              ))}
            </ol>
          )}
        </Field>
        <Field>
          <FieldLabel>Colour</FieldLabel>
          <ColorPicker value={color} onChange={setColor} />
        </Field>
        <Field>
          <FieldLabel htmlFor="path-notes">Notes</FieldLabel>
          <Textarea id="path-notes" data-testid="path-notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} maxLength={4000} />
        </Field>
      </FieldGroup>
      {error ? (
        <Alert variant="destructive" data-testid="form-error">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      <div className="flex gap-2">
        <Button type="submit" data-testid="save-path" pending={pending}>
          {submitLabel}
        </Button>
        {onCancel ? (
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        ) : null}
      </div>
    </form>
  );
}
