import { LocateFixed, X } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { errorText } from "@/client/components/Page";
import { Alert, AlertDescription } from "@/client/components/ui/alert";
import { Button } from "@/client/components/ui/button";
import { Field, FieldGroup, FieldLabel } from "@/client/components/ui/field";
import { Input } from "@/client/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/client/components/ui/select";
import { Textarea } from "@/client/components/ui/textarea";

const COORDS = "coords";

export interface CatchValues {
  species: string;
  caughtAt: string;
  spotId: string | null;
  lat: number | null;
  lng: number | null;
  lengthCm: number | null;
  weightKg: number | null;
  gear: string;
  notes: string;
}

/** An ISO instant as the browser's local `datetime-local` value. */
function toLocalInput(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const numberOrNull = (text: string) => (text.trim() === "" ? null : Number(text));

export function CatchForm({
  initial,
  spots,
  photos = [],
  submitLabel,
  onSubmit,
  onRemovePhoto,
  onCancel,
}: {
  initial: Partial<CatchValues>;
  spots: { id: string; name: string }[];
  photos?: string[];
  submitLabel: string;
  /** Saves the catch, then the new photos. */
  onSubmit: (values: CatchValues, files: File[]) => Promise<void>;
  onRemovePhoto?: (id: string) => Promise<void>;
  onCancel?: () => void;
}) {
  const [species, setSpecies] = useState(initial.species ?? "");
  const [time, setTime] = useState(initial.caughtAt ? toLocalInput(initial.caughtAt) : "");
  const [spot, setSpot] = useState<string>(initial.spotId ?? (spots[0]?.id ?? COORDS));
  const [lat, setLat] = useState(initial.lat != null && !initial.spotId ? initial.lat.toFixed(5) : "");
  const [lng, setLng] = useState(initial.lng != null && !initial.spotId ? initial.lng.toFixed(5) : "");
  const [lengthCm, setLengthCm] = useState(initial.lengthCm?.toString() ?? "");
  const [weightKg, setWeightKg] = useState(initial.weightKg?.toString() ?? "");
  const [gear, setGear] = useState(initial.gear ?? "");
  const [notes, setNotes] = useState(initial.notes ?? "");
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  // "Now" is the browser's, so it is set after the first render.
  useEffect(() => {
    if (!initial.caughtAt) setTime(toLocalInput(new Date().toISOString()));
  }, [initial.caughtAt]);

  const items = [
    ...spots.map((s) => ({ value: s.id, label: s.name })),
    { value: COORDS, label: "Coordinates" },
  ];

  function useMyPosition() {
    navigator.geolocation?.getCurrentPosition(
      (pos) => {
        setLat(pos.coords.latitude.toFixed(5));
        setLng(pos.coords.longitude.toFixed(5));
      },
      () => setError("Couldn't get your position."),
    );
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    const when = new Date(time);
    if (Number.isNaN(when.getTime())) {
      setError("Enter the date and time.");
      return;
    }
    const byCoords = spot === COORDS;
    if (byCoords && (numberOrNull(lat) === null || numberOrNull(lng) === null)) {
      setError("Enter the coordinates or choose a spot.");
      return;
    }
    setPending(true);
    try {
      await onSubmit(
        {
          species,
          caughtAt: when.toISOString(),
          spotId: byCoords ? null : spot,
          lat: byCoords ? numberOrNull(lat) : null,
          lng: byCoords ? numberOrNull(lng) : null,
          lengthCm: numberOrNull(lengthCm),
          weightKg: numberOrNull(weightKg),
          gear,
          notes,
        },
        files,
      );
    } catch (cause) {
      setError(errorText(cause));
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      <FieldGroup>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="catch-species">Species</FieldLabel>
            <Input id="catch-species" data-testid="catch-species" value={species} onChange={(e) => setSpecies(e.target.value)} required maxLength={120} />
          </Field>
          <Field>
            <FieldLabel htmlFor="catch-time">Date and time</FieldLabel>
            <Input id="catch-time" data-testid="catch-time" type="datetime-local" value={time} onChange={(e) => setTime(e.target.value)} required />
          </Field>
        </div>
        <Field>
          <FieldLabel htmlFor="catch-spot">Location</FieldLabel>
          <Select items={items} value={spot} onValueChange={(value) => value !== null && setSpot(value)}>
            <SelectTrigger id="catch-spot" data-testid="catch-spot" className="w-full sm:w-80">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {items.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        {spot === COORDS && (
          <div className="grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
            <Field>
              <FieldLabel htmlFor="catch-lat">Latitude</FieldLabel>
              <Input id="catch-lat" data-testid="catch-lat" inputMode="decimal" value={lat} onChange={(e) => setLat(e.target.value)} />
            </Field>
            <Field>
              <FieldLabel htmlFor="catch-lng">Longitude</FieldLabel>
              <Input id="catch-lng" data-testid="catch-lng" inputMode="decimal" value={lng} onChange={(e) => setLng(e.target.value)} />
            </Field>
            <Button type="button" variant="outline" onClick={useMyPosition}>
              <LocateFixed aria-hidden />
              Use my position
            </Button>
          </div>
        )}
        <div className="grid gap-4 sm:grid-cols-3">
          <Field>
            <FieldLabel htmlFor="catch-length">Length (cm)</FieldLabel>
            <Input id="catch-length" data-testid="catch-length" type="number" min={0} step="0.1" value={lengthCm} onChange={(e) => setLengthCm(e.target.value)} />
          </Field>
          <Field>
            <FieldLabel htmlFor="catch-weight">Weight (kg)</FieldLabel>
            <Input id="catch-weight" data-testid="catch-weight" type="number" min={0} step="0.01" value={weightKg} onChange={(e) => setWeightKg(e.target.value)} />
          </Field>
          <Field>
            <FieldLabel htmlFor="catch-gear">Gear</FieldLabel>
            <Input id="catch-gear" data-testid="catch-gear" value={gear} onChange={(e) => setGear(e.target.value)} maxLength={500} />
          </Field>
        </div>
        <Field>
          <FieldLabel htmlFor="catch-notes">Notes</FieldLabel>
          <Textarea id="catch-notes" data-testid="catch-notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} maxLength={4000} />
        </Field>
        <Field>
          <FieldLabel htmlFor="catch-photos">Photos</FieldLabel>
          {photos.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {photos.map((id) => (
                <div key={id} className="relative">
                  <img src={`/photos/${id}`} alt="" className="size-20 rounded-lg border border-border object-cover" />
                  {onRemovePhoto && (
                    <Button
                      type="button"
                      variant="outline"
                      size="icon-xs"
                      aria-label="Remove photo"
                      className="absolute top-1 right-1"
                      onClick={() => onRemovePhoto(id).catch((cause) => setError(errorText(cause)))}
                    >
                      <X />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
          <Input
            id="catch-photos"
            data-testid="catch-photos-input"
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif,image/heic,image/avif"
            multiple
            onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
          />
        </Field>
      </FieldGroup>
      {error ? (
        <Alert variant="destructive" data-testid="form-error">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      <div className="flex gap-2">
        <Button type="submit" data-testid="save-catch" pending={pending}>
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

/** Uploads photos to a catch, one at a time. */
export async function uploadPhotos(catchId: string, files: File[]) {
  for (const file of files) {
    const form = new FormData();
    form.set("catchId", catchId);
    form.set("file", file);
    const response = await fetch("/photos", {
      method: "POST",
      body: form,
      headers: { "x-upload": "1" },
    });
    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      throw new Error(body?.error ?? `Couldn't upload ${file.name}.`);
    }
  }
}
