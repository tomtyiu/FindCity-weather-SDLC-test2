// Input validation for the public API. Pure functions, easy to unit-test.

const CITY_MAX_LEN = 100;
// Allow letters (incl. Unicode letters), digits, spaces, comma, period, apostrophe, hyphen.
// Disallow control chars, angle brackets, quotes, slashes — anything that would suggest injection.
const CITY_PATTERN = /^[\p{L}\p{N} ,.'\-]+$/u;

export function validateCity(raw) {
  if (typeof raw !== "string") return { ok: false, reason: "city must be a string" };
  const city = raw.trim();
  if (city.length === 0) return { ok: false, reason: "city is required" };
  if (city.length > CITY_MAX_LEN) return { ok: false, reason: `city exceeds ${CITY_MAX_LEN} chars` };
  if (!CITY_PATTERN.test(city)) return { ok: false, reason: "city contains invalid characters" };
  return { ok: true, value: city };
}

export function validateCoords(rawLat, rawLon) {
  if (rawLat === undefined || rawLon === undefined) {
    return { ok: false, reason: "lat and lon are required" };
  }
  const lat = Number(rawLat);
  const lon = Number(rawLon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return { ok: false, reason: "lat and lon must be numbers" };
  }
  if (lat < -90 || lat > 90) return { ok: false, reason: "lat must be between -90 and 90" };
  if (lon < -180 || lon > 180) return { ok: false, reason: "lon must be between -180 and 180" };
  return { ok: true, value: { lat, lon } };
}
