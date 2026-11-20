import type { Path } from "./paths";
import type { Spot } from "./spots";

const escape = (text: string) =>
  text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

/** GPX 1.1: spots as waypoints, paths as tracks. */
export function toGpx(spots: Spot[], paths: Path[]): string {
  const lines = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<gpx version="1.1" creator="Angler Logbook" xmlns="http://www.topografix.com/GPX/1/1">',
  ];
  for (const spot of spots) {
    lines.push(`  <wpt lat="${spot.lat}" lon="${spot.lng}">`);
    lines.push(`    <time>${new Date(spot.createdAt).toISOString()}</time>`);
    lines.push(`    <name>${escape(spot.name)}</name>`);
    if (spot.notes) lines.push(`    <desc>${escape(spot.notes)}</desc>`);
    lines.push(`    <sym>${escape(spot.icon)}</sym>`);
    lines.push("  </wpt>");
  }
  for (const path of paths) {
    lines.push("  <trk>");
    lines.push(`    <name>${escape(path.name)}</name>`);
    if (path.notes) lines.push(`    <desc>${escape(path.notes)}</desc>`);
    lines.push(`    <type>${path.kind}</type>`);
    lines.push("    <trkseg>");
    for (const [lat, lng] of path.points)
      lines.push(`      <trkpt lat="${lat}" lon="${lng}"></trkpt>`);
    lines.push("    </trkseg>");
    lines.push("  </trk>");
  }
  lines.push("</gpx>");
  return lines.join("\n") + "\n";
}
