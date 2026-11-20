import { LocateFixed } from "lucide-react";
import { useState, type FormEvent } from "react";
import { errorText } from "@/client/components/Page";
import { ColorPicker, IconPicker } from "@/client/components/Pickers";
import { WorldMap, type MapSpot } from "@/client/components/WorldMap";
import { Alert, AlertDescription } from "@/client/components/ui/alert";
import { Button } from "@/client/components/ui/button";
import { Field, FieldGroup, FieldLabel } from "@/client/components/ui/field";
import { Input } from "@/client/components/ui/input";
import { Textarea } from "@/client/components/ui/textarea";
import type { ColorKey, IconKey } from "@/lib/catalog";
import type { LatLng } from "@/lib/geo";

export interface SpotValues {
  name: string;
  notes: string;
  icon: IconKey;
  color: ColorKey;
  lat: number;
  lng: number;
}

export function SpotForm({
  initial,
  otherSpots,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  initial: Partial<SpotValues>;
  otherSpots: MapSpot[];
  submitLabel: string;
  onSubmit: (values: SpotValues) => Promise<void>;
  onCancel?: () => void;
}) {
  const [name, setName] = useState(initial.name ?? "");
  const [notes, setNotes] = useState(initial.notes ?? "");
  const [icon, setIcon] = useState<IconKey>(initial.icon ?? "fish");
  const [color, setColor] = useState<ColorKey>(initial.color ?? "blue");
  const [lat, setLat] = useState(initial.lat?.toFixed(5) ?? "");
  const [lng, setLng] = useState(initial.lng?.toFixed(5) ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [locating, setLocating] = useState(false);

  const point: LatLng | null =
    lat.trim() !== "" && lng.trim() !== "" && Number.isFinite(Number(lat)) && Number.isFinite(Number(lng))
      ? [Number(lat), Number(lng)]
      : null;

  function setPoint([a, b]: LatLng) {
    setLat(a.toFixed(5));
    setLng(b.toFixed(5));
  }

  function useMyPosition() {
    if (!navigator.geolocation) {
      setError("This browser can't share its position.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        setPoint([pos.coords.latitude, pos.coords.longitude]);
      },
      () => {
        setLocating(false);
        setError("Couldn't get your position.");
      },
    );
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    if (!point) {
      setError("Enter coordinates, use your position or pick a point on the map.");
      return;
    }
    setPending(true);
    try {
      await onSubmit({ name, notes, icon, color, lat: point[0], lng: point[1] });
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
          <FieldLabel htmlFor="spot-name">Name</FieldLabel>
          <Input id="spot-name" data-testid="spot-name" value={name} onChange={(e) => setName(e.target.value)} required maxLength={120} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <Field>
            <FieldLabel htmlFor="spot-lat">Latitude</FieldLabel>
            <Input id="spot-lat" data-testid="spot-lat" inputMode="decimal" placeholder="41.61950" value={lat} onChange={(e) => setLat(e.target.value)} />
          </Field>
          <Field>
            <FieldLabel htmlFor="spot-lng">Longitude</FieldLabel>
            <Input id="spot-lng" data-testid="spot-lng" inputMode="decimal" placeholder="-82.66020" value={lng} onChange={(e) => setLng(e.target.value)} />
          </Field>
          <Button type="button" variant="outline" data-testid="use-my-position" pending={locating} onClick={useMyPosition}>
            <LocateFixed aria-hidden />
            Use my position
          </Button>
        </div>
        <WorldMap
          testId="spot-map"
          className="h-72"
          spots={otherSpots}
          fit={point ? [point] : []}
          draft={{ points: [], marker: point }}
          onPick={setPoint}
          interactive={false}
        >
          <p className="text-xs text-muted-foreground">Click the map to place the spot.</p>
        </WorldMap>
        <Field>
          <FieldLabel>Icon</FieldLabel>
          <IconPicker value={icon} color={color} onChange={setIcon} />
        </Field>
        <Field>
          <FieldLabel>Colour</FieldLabel>
          <ColorPicker value={color} onChange={setColor} />
        </Field>
        <Field>
          <FieldLabel htmlFor="spot-notes">Notes</FieldLabel>
          <Textarea id="spot-notes" data-testid="spot-notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={4} maxLength={4000} />
        </Field>
      </FieldGroup>
      {error ? (
        <Alert variant="destructive" data-testid="form-error">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      <div className="flex gap-2">
        <Button type="submit" data-testid="save-spot" pending={pending}>
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
