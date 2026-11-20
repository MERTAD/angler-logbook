/** A coordinate as [lat, lng] in degrees. */
export type LatLng = [number, number];

const EARTH_RADIUS_M = 6_371_008.8;
const METERS_PER_NM = 1852;

/** Great-circle distance in metres. */
function haversine([lat1, lng1]: LatLng, [lat2, lng2]: LatLng): number {
  const rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad;
  const dLng = (lng2 - lng1) * rad;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(a)));
}

/** The sum of the great-circle legs, in metres. */
export function pathLength(points: LatLng[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i++)
    total += haversine(points[i - 1]!, points[i]!);
  return total;
}

export function formatKm(meters: number): string {
  const km = meters / 1000;
  return `${km < 10 ? km.toFixed(2) : km.toFixed(1)} km`;
}

export function formatNm(meters: number): string {
  const nm = meters / METERS_PER_NM;
  return `${nm < 10 ? nm.toFixed(2) : nm.toFixed(1)} NM`;
}

export function formatCoord(lat: number, lng: number): string {
  return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
}

/** UTC offset in whole hours from longitude, the zone used when none is given. */
export function offsetFromLongitude(lng: number): number {
  return Math.max(-12, Math.min(14, Math.round(lng / 15)));
}

export function formatOffset(hours: number): string {
  if (hours === 0) return "UTC";
  return `UTC${hours > 0 ? "+" : "−"}${Math.abs(hours)}`;
}
