import { test, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { createApp } from "../server.js";

let server;
let baseUrl;
const realFetch = globalThis.fetch;

function jsonResponse(body, { status = 200 } = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

before(async () => {
  const app = createApp({ now: () => new Date("2026-04-30T12:00:00Z") });
  server = app.listen(0);
  await new Promise((r) => server.once("listening", r));
  const { port } = server.address();
  baseUrl = `http://127.0.0.1:${port}`;
});

after(() => {
  globalThis.fetch = realFetch;
  server.close();
});

beforeEach(() => {
  globalThis.fetch = realFetch;
});

test("GET /healthz → 200 ok", async () => {
  const res = await fetch(`${baseUrl}/healthz`);
  assert.equal(res.status, 200);
  assert.equal(await res.text(), "ok");
});

test("GET /api/weather without params → 400 invalid_request", async () => {
  const res = await fetch(`${baseUrl}/api/weather`);
  assert.equal(res.status, 400);
  const body = await res.json();
  assert.equal(body.error, "invalid_request");
});

test("GET /api/weather with invalid city characters → 400", async () => {
  const res = await fetch(`${baseUrl}/api/weather?city=${encodeURIComponent("<script>")}`);
  assert.equal(res.status, 400);
});

test("GET /api/weather with out-of-range coords → 400", async () => {
  const res = await fetch(`${baseUrl}/api/weather?lat=999&lon=0`);
  assert.equal(res.status, 400);
});

test("GET /api/weather with valid city → 200 normalized payload", async () => {
  globalThis.fetch = async (url, init) => {
    const u = String(url);
    if (u.startsWith(baseUrl)) return realFetch(url, init);
    if (u.includes("geocoding-api.open-meteo.com")) {
      return jsonResponse({
        results: [
          {
            name: "London",
            country: "United Kingdom",
            admin1: "England",
            latitude: 51.5074,
            longitude: -0.1278,
            timezone: "Europe/London",
          },
        ],
      });
    }
    if (u.includes("api.open-meteo.com")) {
      return jsonResponse({
        current: {
          time: "2026-04-30T11:00",
          temperature_2m: 12.4,
          apparent_temperature: 10.1,
          relative_humidity_2m: 78,
          wind_speed_10m: 14.2,
          wind_direction_10m: 230,
          weather_code: 3,
          is_day: 1,
        },
      });
    }
    throw new Error(`unexpected URL: ${u}`);
  };

  const res = await fetch(`${baseUrl}/api/weather?city=London`);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.location.name, "London");
  assert.equal(body.location.country, "United Kingdom");
  assert.equal(body.location.region, "England");
  assert.equal(body.current.temperatureC, 12.4);
  assert.equal(body.current.condition, "Overcast");
  assert.equal(body.current.isDay, true);
  assert.equal(body.source, "open-meteo.com");
  assert.equal(body.fetchedAt, "2026-04-30T12:00:00.000Z");
});

test("GET /api/weather with unknown city → 404 not_found", async () => {
  globalThis.fetch = async (url, init) => {
    const u = String(url);
    if (u.startsWith(baseUrl)) return realFetch(url, init);
    if (u.includes("geocoding-api.open-meteo.com")) {
      return jsonResponse({ results: [] });
    }
    throw new Error("forecast should not be called");
  };

  const res = await fetch(`${baseUrl}/api/weather?city=zzzzzzzzz`);
  assert.equal(res.status, 404);
  const body = await res.json();
  assert.equal(body.error, "not_found");
});

test("GET /api/weather with upstream 5xx → 502 upstream_error", async () => {
  globalThis.fetch = async (url, init) => {
    const u = String(url);
    if (u.startsWith(baseUrl)) return realFetch(url, init);
    return jsonResponse({ message: "boom" }, { status: 503 });
  };
  const res = await fetch(`${baseUrl}/api/weather?city=Paris`);
  assert.equal(res.status, 502);
  const body = await res.json();
  assert.equal(body.error, "upstream_error");
});

test("GET /api/weather with valid coords → 200 (skips geocoder)", async () => {
  let geocoderCalled = false;
  globalThis.fetch = async (url, init) => {
    const u = String(url);
    if (u.startsWith(baseUrl)) return realFetch(url, init);
    if (u.includes("geocoding-api.open-meteo.com")) {
      geocoderCalled = true;
      return jsonResponse({ results: [] });
    }
    return jsonResponse({
      current: {
        time: "2026-04-30T11:00",
        temperature_2m: 5,
        apparent_temperature: 3,
        relative_humidity_2m: 90,
        wind_speed_10m: 8,
        wind_direction_10m: 180,
        weather_code: 0,
        is_day: 0,
      },
    });
  };

  const res = await fetch(`${baseUrl}/api/weather?lat=40.7128&lon=-74.006`);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(geocoderCalled, false, "geocoder must not be called when coords are provided");
  assert.equal(body.location.latitude, 40.7128);
  assert.equal(body.current.condition, "Clear sky");
  assert.equal(body.current.isDay, false);
});
