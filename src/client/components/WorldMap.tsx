import { Link } from "@tanstack/react-router";
import { Fish, LocateFixed, Minus, Plus } from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Button } from "@/client/components/ui/button";
import { ICON_COMPONENTS } from "@/client/lib/icons";
import { COLORS, type ColorKey, type IconKey } from "@/lib/catalog";
import type { LatLng } from "@/lib/geo";

/** World units: the Mercator square is WORLD × WORLD. */
const WORLD = 1024;
const TILE = 256;
const MAX_LAT = 85.05;

function project([lat, lng]: LatLng): [number, number] {
  const clamped = Math.max(-MAX_LAT, Math.min(MAX_LAT, lat));
  const phi = (clamped * Math.PI) / 180;
  return [
    ((lng + 180) / 360) * WORLD,
    ((1 - Math.log(Math.tan(phi) + 1 / Math.cos(phi)) / Math.PI) / 2) * WORLD,
  ];
}

function unproject([x, y]: [number, number]): LatLng {
  const lng = (x / WORLD) * 360 - 180;
  const lat =
    (Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / WORLD))) * 180) / Math.PI;
  return [lat, ((((lng + 180) % 360) + 360) % 360) - 180];
}

export const colorOf = (key: string) =>
  COLORS[key as ColorKey]?.token ?? COLORS.blue.token;

type Polygonal = GeoJSON.FeatureCollection<GeoJSON.MultiPolygon | GeoJSON.Polygon>;

/** Polygons as one SVG path in world units. */
function toPath(collection: Polygonal): string {
  const parts: string[] = [];
  for (const feature of collection.features) {
    if (!feature.geometry) continue;
    const polys =
      feature.geometry.type === "Polygon"
        ? [feature.geometry.coordinates]
        : feature.geometry.coordinates;
    for (const poly of polys)
      for (const ring of poly) {
        let d = "";
        ring.forEach(([lng, lat], i) => {
          const [x, y] = project([lat!, lng!]);
          d += `${i ? "L" : "M"}${x.toFixed(2)} ${y.toFixed(2)}`;
        });
        parts.push(d + "Z");
      }
  }
  return parts.join("");
}

let basePromise: Promise<{ land: string; lakes: string }> | null = null;
/** The bundled coastline and large lakes. */
function loadBase() {
  basePromise ??= Promise.all([
    import("world-atlas/land-50m.json"),
    import("@geo-maps/earth-lakes-10km/map.geo.json"),
    import("topojson-client"),
  ]).then(([atlas, lakes, topojson]) => {
    const topology = (atlas.default ?? atlas) as unknown as Parameters<
      typeof topojson.feature
    >[0];
    const land = topojson.feature(
      topology,
      (topology.objects as Record<string, never>).land,
    ) as unknown as Polygonal;
    return {
      land: toPath(land),
      lakes: toPath({
        type: "FeatureCollection",
        features: (
          (lakes.default ?? lakes) as unknown as {
            geometries: (GeoJSON.MultiPolygon | GeoJSON.Polygon)[];
          }
        ).geometries.map((geometry) => ({ type: "Feature", properties: {}, geometry })),
      }),
    };
  });
  return basePromise;
}

export interface MapSpot {
  id: string;
  name: string;
  lat: number;
  lng: number;
  icon: string;
  color: string;
}
export interface MapPath {
  id: string;
  name: string;
  points: LatLng[];
  color: string;
}
export interface MapCatch {
  id: string;
  species: string;
  lat: number;
  lng: number;
}

interface View {
  cx: number;
  cy: number;
  zoom: number;
}

/** A view that shows every coordinate, or the whole world when there are none. */
function fitView(points: LatLng[], width: number, height: number): View {
  if (!points.length) {
    const zoom = Math.max(0, Math.log2(Math.min(width, height) / TILE));
    return { cx: WORLD / 2, cy: WORLD / 2, zoom };
  }
  const xy = points.map(project);
  const xs = xy.map((p) => p[0]);
  const ys = xy.map((p) => p[1]);
  const [minX, maxX, minY, maxY] = [
    Math.min(...xs),
    Math.max(...xs),
    Math.min(...ys),
    Math.max(...ys),
  ];
  const spanX = Math.max(maxX - minX, 1e-6);
  const spanY = Math.max(maxY - minY, 1e-6);
  const zoom = Math.min(
    14,
    Math.log2((Math.min((width * 0.6) / spanX, (height * 0.6) / spanY) * WORLD) / TILE),
  );
  return { cx: (minX + maxX) / 2, cy: (minY + maxY) / 2, zoom: Math.max(1, zoom) };
}

/**
 * A pan-and-zoom map on the bundled coastline. Spots, paths and catches
 * open their pages when `interactive`; `onPick` gets the coordinates of a
 * click on the map itself.
 */
export function WorldMap({
  testId,
  spots = [],
  paths = [],
  catches = [],
  fit = [],
  draft,
  onPick,
  interactive = true,
  className = "h-96",
  children,
}: {
  testId: string;
  spots?: MapSpot[];
  paths?: MapPath[];
  catches?: MapCatch[];
  /** Extra coordinates the first view should include. */
  fit?: LatLng[];
  /** A line being drawn or measured, and an optional marker. */
  draft?: { points: LatLng[]; color?: string; marker?: LatLng | null };
  onPick?: (point: LatLng) => void;
  /** False while the map is in a mode where clicks pick coordinates. */
  interactive?: boolean;
  className?: string;
  children?: ReactNode;
}) {
  const box = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const [view, setView] = useState<View | null>(null);
  const [base, setBase] = useState<{ land: string; lakes: string } | null>(null);
  const [me, setMe] = useState<LatLng | null>(null);
  const drag = useRef<{ x: number; y: number; view: View; moved: boolean } | null>(null);

  const initial = useMemo<LatLng[]>(
    () => [
      ...spots.map((s): LatLng => [s.lat, s.lng]),
      ...paths.flatMap((p) => p.points),
      ...catches.map((c): LatLng => [c.lat, c.lng]),
      ...fit,
      ...(draft?.points ?? []),
    ],
    // Only the first view fits the data; later changes keep the person's view.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  useEffect(() => {
    void loadBase().then(setBase);
    const el = box.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry!.contentRect;
      setSize({ w: width, h: height });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (size && !view) setView(fitView(initial, size.w, size.h));
  }, [size, view, initial]);

  const scale = view ? (TILE * 2 ** view.zoom) / WORLD : 1;
  const toPixel = useCallback(
    (point: LatLng): [number, number] => {
      if (!view || !size) return [0, 0];
      const [x, y] = project(point);
      return [(x - view.cx) * scale + size.w / 2, (y - view.cy) * scale + size.h / 2];
    },
    [view, size, scale],
  );
  const fromPixel = (px: number, py: number): LatLng => {
    const [lat, lng] = unproject([
      view!.cx + (px - size!.w / 2) / scale,
      view!.cy + (py - size!.h / 2) / scale,
    ]);
    return [Number(lat.toFixed(5)), Number(lng.toFixed(5))];
  };

  function zoomBy(delta: number, around?: [number, number]) {
    setView((v) => {
      if (!v || !size) return v;
      const zoom = Math.max(0, Math.min(18, v.zoom + delta));
      const k = 2 ** (zoom - v.zoom);
      const s = (TILE * 2 ** v.zoom) / WORLD;
      const [px, py] = around ?? [size.w / 2, size.h / 2];
      const wx = v.cx + (px - size.w / 2) / s;
      const wy = v.cy + (py - size.h / 2) / s;
      return { zoom, cx: wx - (wx - v.cx) / k, cy: wy - (wy - v.cy) / k };
    });
  }

  function locate() {
    navigator.geolocation?.getCurrentPosition((pos) => {
      const point: LatLng = [pos.coords.latitude, pos.coords.longitude];
      const [x, y] = project(point);
      setMe(point);
      setView((v) => ({ cx: x, cy: y, zoom: Math.max(v?.zoom ?? 1, 11) }));
    });
  }

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const rect = el.getBoundingClientRect();
      zoomBy(event.deltaY < 0 ? 0.5 : -0.5, [event.clientX - rect.left, event.clientY - rect.top]);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  });

  const line = (points: LatLng[]) =>
    points.map((p) => toPixel(p).map((n) => n.toFixed(1)).join(",")).join(" ");
  const ready = Boolean(view && size);

  return (
    <div className="space-y-2">
      <div
        ref={box}
        data-testid={testId}
        className={`relative touch-none overflow-hidden rounded-lg border border-border bg-card select-none ${className} ${onPick && !interactive ? "cursor-crosshair" : "cursor-grab"}`}
        onPointerDown={(event) => {
          if (!view) return;
          (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
          drag.current = { x: event.clientX, y: event.clientY, view, moved: false };
        }}
        onPointerMove={(event) => {
          const d = drag.current;
          if (!d) return;
          const dx = event.clientX - d.x;
          const dy = event.clientY - d.y;
          if (Math.abs(dx) + Math.abs(dy) > 4) d.moved = true;
          if (!d.moved) return;
          const s = (TILE * 2 ** d.view.zoom) / WORLD;
          setView({ ...d.view, cx: d.view.cx - dx / s, cy: d.view.cy - dy / s });
        }}
        onPointerUp={(event) => {
          const d = drag.current;
          drag.current = null;
          if (!d || d.moved || !onPick || !size) return;
          const rect = event.currentTarget.getBoundingClientRect();
          onPick(fromPixel(event.clientX - rect.left, event.clientY - rect.top));
        }}
        onPointerCancel={() => (drag.current = null)}
      >
        {ready && (
          <svg className="absolute inset-0 size-full" aria-hidden={!interactive}>
            <rect width="100%" height="100%" className="fill-info/15" />
            {base && (
              <g transform={`translate(${size!.w / 2 - view!.cx * scale} ${size!.h / 2 - view!.cy * scale}) scale(${scale})`}>
                <path
                  data-testid={`${testId}-land`}
                  d={base.land}
                  fillRule="evenodd"
                  className="fill-card stroke-border"
                  strokeWidth={1}
                  vectorEffect="non-scaling-stroke"
                />
                <path
                  d={base.lakes}
                  fillRule="evenodd"
                  className="fill-info/15 stroke-border"
                  strokeWidth={1}
                  vectorEffect="non-scaling-stroke"
                />
              </g>
            )}
            <Graticule view={view!} size={size!} toPixel={toPixel} />
            {paths.map((path) => (
              <PathLine
                key={path.id}
                path={path}
                points={line(path.points)}
                interactive={interactive}
              />
            ))}
            {draft && draft.points.length > 0 && (
              <g>
                <polyline
                  points={line(draft.points)}
                  fill="none"
                  stroke={draft.color ?? "var(--foreground)"}
                  strokeWidth={3}
                  strokeDasharray="6 4"
                />
                {draft.points.map((p, i) => {
                  const [x, y] = toPixel(p);
                  return (
                    <circle
                      key={i}
                      cx={x}
                      cy={y}
                      r={5}
                      className="fill-background"
                      stroke={draft.color ?? "var(--foreground)"}
                      strokeWidth={2}
                    />
                  );
                })}
              </g>
            )}
            {me && (() => {
              const [x, y] = toPixel(me);
              return <circle cx={x} cy={y} r={7} className="fill-info stroke-background" strokeWidth={3} />;
            })()}
          </svg>
        )}
        {ready &&
          spots.map((spot) => {
            const [x, y] = toPixel([spot.lat, spot.lng]);
            const Icon = ICON_COMPONENTS[spot.icon as IconKey]?.icon ?? Fish;
            return (
              <Link
                key={spot.id}
                to="/spots/$spotId"
                params={{ spotId: spot.id }}
                data-testid="map-spot"
                title={spot.name}
                aria-label={spot.name}
                onPointerDown={(e) => e.stopPropagation()}
                className={`absolute flex size-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-background text-background shadow-sm ${interactive ? "" : "pointer-events-none"}`}
                style={{ left: x, top: y, backgroundColor: colorOf(spot.color) }}
              >
                <Icon className="size-4" aria-hidden />
              </Link>
            );
          })}
        {ready &&
          catches.map((c) => {
            const [x, y] = toPixel([c.lat, c.lng]);
            return (
              <Link
                key={c.id}
                to="/catches/$catchId"
                params={{ catchId: c.id }}
                data-testid="map-catch"
                title={c.species}
                aria-label={c.species}
                onPointerDown={(e) => e.stopPropagation()}
                className={`absolute size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-background bg-foreground shadow-sm ${interactive ? "" : "pointer-events-none"}`}
                style={{ left: x + 10, top: y - 10 }}
              />
            );
          })}
        {ready && draft?.marker && (() => {
          const [x, y] = toPixel(draft.marker);
          return (
            <span
              className="pointer-events-none absolute size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-background bg-primary shadow"
              style={{ left: x, top: y }}
            />
          );
        })()}
        <div
          className="absolute top-2 right-2 flex flex-col gap-1"
          onPointerDown={(e) => e.stopPropagation()}
          onPointerUp={(e) => e.stopPropagation()}
        >
          <Button type="button" variant="outline" size="icon-sm" aria-label="Zoom in" onClick={() => zoomBy(1)}>
            <Plus />
          </Button>
          <Button type="button" variant="outline" size="icon-sm" aria-label="Zoom out" onClick={() => zoomBy(-1)}>
            <Minus />
          </Button>
          <Button type="button" variant="outline" size="icon-sm" aria-label="My position" data-testid="map-locate" onClick={locate}>
            <LocateFixed />
          </Button>
        </div>
      </div>
      {children}
    </div>
  );
}

function PathLine({
  path,
  points,
  interactive,
}: {
  path: MapPath;
  points: string;
  interactive: boolean;
}) {
  const [hover, setHover] = useState(false);
  return (
    <Link
      to="/paths/$pathId"
      params={{ pathId: path.id }}
      data-testid="map-path"
      aria-label={path.name}
      onPointerDown={(e) => e.stopPropagation()}
      onPointerEnter={() => setHover(true)}
      onPointerLeave={() => setHover(false)}
      className={interactive ? "" : "pointer-events-none"}
    >
      <title>{path.name}</title>
      <polyline points={points} fill="none" stroke="transparent" strokeWidth={14} />
      <polyline
        points={points}
        fill="none"
        stroke={colorOf(path.color)}
        strokeWidth={hover ? 5 : 3}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Link>
  );
}

/** Latitude and longitude lines, spaced for the zoom, so a blank stretch still has bearings. */
function Graticule({
  view,
  size,
  toPixel,
}: {
  view: View;
  size: { w: number; h: number };
  toPixel: (point: LatLng) => [number, number];
}) {
  const scale = (TILE * 2 ** view.zoom) / WORLD;
  const [north, west] = unproject([view.cx - size.w / 2 / scale, view.cy - size.h / 2 / scale]);
  const [south] = unproject([view.cx + size.w / 2 / scale, view.cy + size.h / 2 / scale]);
  const spanLng = (size.w / scale / WORLD) * 360;
  const step = [30, 10, 5, 2, 1, 0.5, 0.2, 0.1, 0.05, 0.02, 0.01, 0.005].find((s) => spanLng / s >= 4) ?? 0.005;
  const lines: { d: string; key: string }[] = [];
  const westEdge = (view.cx - size.w / 2 / scale) / WORLD * 360 - 180;
  for (let lng = Math.ceil(westEdge / step) * step, i = 0; lng <= westEdge + spanLng && i < 200; lng += step, i++) {
    const [x] = toPixel([0, lng]);
    lines.push({ key: `x${i}`, d: `M${x} 0V${size.h}` });
  }
  for (let lat = Math.ceil(south / step) * step, i = 0; lat <= north && i < 200; lat += step, i++) {
    const [, y] = toPixel([lat, west]);
    lines.push({ key: `y${i}`, d: `M0 ${y}H${size.w}` });
  }
  return (
    <g className="stroke-border" strokeWidth={1} strokeDasharray="2 4">
      {lines.map((l) => (
        <path key={l.key} d={l.d} />
      ))}
    </g>
  );
}
