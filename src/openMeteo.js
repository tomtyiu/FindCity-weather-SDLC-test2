// Thin client for Open-Meteo's geocoding and forecast APIs.
// Uses native fetch (Node >= 18) with an AbortController-backed timeout.

const GEOCODE_URL = "https://geocoding-api.open-meteo.com/v1/search";
const FORECAST_URL = "https://api.open-meteo.com/v1/forecast";
const DEFAULT_TIMEOUT_MS = 5000;

class UpstreamError extends Error {
  constructor(message, { status, cause } = {}) {
    super(message);
    this.name = "UpstreamError";
    this.status = status;
    if (cause) this.cause = cause;
  }
}

class NotFoundError extends Error {
  constructor(message) {
    super(message);
    this.name = "NotFoundError";
  }
}

async function fetchJson(url, { timeoutMs = DEFAULT_TIMEOUT_MS, fetchImpl = fetch } = {}) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const res = await fetchImpl(url, { signal: ctl.signal });
    if (!res.ok) {
      throw new UpstreamError(`upstream ${res.status}`, { status: res.status });
    }
    return await res.json();
  } catch (err) {
    if (err instanceof UpstreamError) throw err;
    throw new UpstreamError("upstream request failed", { cause: err });
  } finally {
    clearTimeout(timer);
  }
}

export async function geocodeCity(city, opts = {}) {
  const url = new URL(GEOCODE_URL);
  url.searchParams.set("name", city);
  url.searchParams.set("count", "1");
  url.searchParams.set("language", "en");
  url.searchParams.set("format", "json");

  const data = await fetchJson(url.toString(), opts);
  const top = Array.isArray(data?.results) ? data.results[0] : null;
  if (!top) throw new NotFoundError(`no geocoding match for "${city}"`);

  // Read only the fields we use; ignore the rest.
  return {
    name: String(top.name ?? city),
    country: typeof top.country === "string" ? top.country : null,
    admin1: typeof top.admin1 === "string" ? top.admin1 : null,
    latitude: Number(top.latitude),
    longitude: Number(top.longitude),
    timezone: typeof top.timezone === "string" ? top.timezone : "auto",
  };
}

export async function fetchCurrentWeather({ latitude, longitude, timezone = "auto" }, opts = {}) {
  const url = new URL(FORECAST_URL);
  url.searchParams.set("latitude", String(latitude));
  url.searchParams.set("longitude", String(longitude));
  url.searchParams.set("timezone", timezone);
  url.searchParams.set(
    "current",
    [
      "temperature_2m",
      "apparent_temperature",
      "relative_humidity_2m",
      "wind_speed_10m",
      "wind_direction_10m",
      "weather_code",
      "is_day",
    ].join(","),
  );
  url.searchParams.set("wind_speed_unit", "kmh");
  url.searchParams.set("temperature_unit", "celsius");

  const data = await fetchJson(url.toString(), opts);
  const c = data?.current;
  if (!c || typeof c !== "object") {
    throw new UpstreamError("upstream response missing 'current'");
  }

  return {
    temperatureC: numberOrNull(c.temperature_2m),
    apparentTemperatureC: numberOrNull(c.apparent_temperature),
    humidity: numberOrNull(c.relative_humidity_2m),
    windSpeedKmh: numberOrNull(c.wind_speed_10m),
    windDirectionDeg: numberOrNull(c.wind_direction_10m),
    weatherCode: numberOrNull(c.weather_code),
    isDay: c.is_day === 1 || c.is_day === true,
    observedAt: typeof c.time === "string" ? c.time : null,
  };
}

function numberOrNull(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export { UpstreamError, NotFoundError };
