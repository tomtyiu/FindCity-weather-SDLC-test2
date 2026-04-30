# Design — Real-time Weather App

## Architecture

```
┌─────────────┐     HTTP      ┌──────────────────────┐     HTTPS    ┌────────────────────────────┐
│  Browser    │ ────────────▶ │  Express server      │ ───────────▶ │ geocoding-api.open-meteo   │
│  (static    │ ◀──────────── │  - validates input   │ ◀─────────── │ api.open-meteo.com         │
│   HTML/JS)  │     JSON      │  - rate limits       │     JSON     └────────────────────────────┘
└─────────────┘               │  - normalizes errors │
                              │  - serves /public    │
                              └──────────────────────┘
```

Single Express process serves both the static frontend and the JSON API. This eliminates CORS, simplifies deployment, and gives us a single seam for logging and rate limiting.

## Components

- `server.js` — Express app: static file serving, `/api/weather`, validation, rate limiting, error normalization, and the upstream client.
- `public/index.html`, `public/style.css`, `public/app.js` — UI that calls `/api/weather` and renders results.
- `tests/validate.test.js`, `tests/weatherCodes.test.js`, `tests/server.test.js` — `node:test` unit and HTTP-integration tests (the integration tests use a mocked `globalThis.fetch` with a localhost passthrough so the test client's own request to the test server is not intercepted).

## API Contract

### `GET /api/weather`

Query parameters (one of two modes):

- **City mode**: `?city=<string, 1..100 chars>`
- **Coords mode**: `?lat=<-90..90>&lon=<-180..180>`

Response (`200`):

```json
{
  "location": { "name": "London", "country": "United Kingdom", "latitude": 51.5074, "longitude": -0.1278, "timezone": "Europe/London" },
  "current": {
    "temperatureC": 12.4,
    "apparentTemperatureC": 10.1,
    "humidity": 78,
    "windSpeedKmh": 14.2,
    "windDirectionDeg": 230,
    "weatherCode": 3,
    "condition": "Overcast",
    "isDay": true,
    "observedAt": "2026-04-30T11:00:00Z"
  },
  "source": "open-meteo.com",
  "fetchedAt": "2026-04-30T11:02:14.512Z"
}
```

Errors:

| Status | When                                | Body shape                              |
| ------ | ----------------------------------- | --------------------------------------- |
| 400    | Missing/invalid city or coords      | `{ "error": "invalid_request", ... }`   |
| 404    | City not found by geocoding         | `{ "error": "not_found", ... }`         |
| 429    | Rate limit exceeded                 | `{ "error": "rate_limited", ... }`      |
| 502    | Upstream failure                    | `{ "error": "upstream_error", ... }`    |
| 500    | Anything else                       | `{ "error": "internal_error", ... }`    |

## Data Flow

1. Frontend captures input (city or coords) and calls `/api/weather`.
2. Backend validates input (length, character set for city; numeric bounds for coords).
3. If city: backend calls Open-Meteo geocoding → picks top match → uses its lat/lon.
4. Backend calls Open-Meteo forecast `current=...` for that lat/lon.
5. Backend maps WMO weather code → human-readable condition.
6. Backend returns the normalized payload above.

## Trust Boundaries & Threat Model

| Boundary             | Threat                                  | Mitigation                                              |
| -------------------- | --------------------------------------- | ------------------------------------------------------- |
| Browser → backend    | Crafted city / huge payload             | Length cap + character allowlist; numeric coord bounds. |
| Browser → backend    | Abuse / cost amplification              | Per-IP rate limit (60 rpm); `express.json({ limit })`.  |
| Backend → upstream   | Slow / failing upstream                 | `AbortController` timeout (5s); 502 on failure.         |
| Backend → upstream   | Untrusted upstream JSON                 | Read only known fields; type-check before use.          |
| Logs                 | Leakage of raw upstream payloads        | Log query + outcome only; never raw bodies.             |
| Static assets        | Path traversal                          | `express.static` with default safe defaults; no symlinks.|

No secrets are involved today (Open-Meteo is keyless). If a key is added later, it lives in `process.env` and is never logged or echoed.

## Failure Modes & Recovery

| Failure                                  | Behavior                                                              |
| ---------------------------------------- | --------------------------------------------------------------------- |
| Geocoder returns 0 results               | `404 not_found`; UI shows "We couldn't find that city."               |
| Upstream timeout / 5xx                   | `502 upstream_error`; UI shows "Weather service is unavailable."      |
| Network failure on the client            | UI catches `fetch` rejection and shows a generic offline message.     |
| Invalid input                            | `400 invalid_request`; UI surfaces the validation message.            |

## Rollback

Local-only delivery. Rollback = `git revert` (once committed) or stop the process and restore prior `server.js`. No database, no migrations, no remote state.

## Observability

- Console logs are structured-ish: `level`, `event`, `query`, `outcome`, `latencyMs`.
- `/healthz` returns `200 ok` for smoke checks.
- No metrics backend in this iteration (out of scope).
