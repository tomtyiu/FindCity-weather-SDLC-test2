# FindCity Weather

Real-time weather lookup by city. A small full-stack app: an Express backend that proxies [Open-Meteo](https://open-meteo.com), a vanilla-JS frontend, and a `node:test` test suite.

## Why a backend at all?

Open-Meteo is keyless, so the frontend could call it directly. We still proxy because the backend gives us:

- a single seam for input validation and rate limiting,
- normalized error shapes (so the UI doesn't depend on upstream changes),
- a stable place to add caching or an API key later without touching the client.

## Requirements

- Node.js **>= 20** (uses native `fetch` and `node:test`). Verified on Node 22.
- Internet access to `*.open-meteo.com`.

## Run

```bash
npm install
npm start
# → http://localhost:3000
```

Override the port with `PORT=4000 npm start`.

## Test

```bash
npm test
```

24 tests cover input validation, weather-code mapping, and the HTTP endpoint (with mocked upstream calls — no network required).

## API

### `GET /healthz`

Returns `200 ok`. Use for liveness checks.

### `GET /api/weather`

Query parameters (one of two modes):

- **City mode**: `?city=<string, 1..100 chars>`
- **Coords mode**: `?lat=<-90..90>&lon=<-180..180>`

#### Example

```bash
curl 'http://localhost:3000/api/weather?city=London'
```

```json
{
  "location": {
    "name": "London",
    "country": "United Kingdom",
    "region": "England",
    "latitude": 51.50853,
    "longitude": -0.12574,
    "timezone": "Europe/London"
  },
  "current": {
    "temperatureC": 16.9,
    "apparentTemperatureC": 13.4,
    "humidity": 40,
    "windSpeedKmh": 13.3,
    "windDirectionDeg": 88,
    "weatherCode": 0,
    "isDay": false,
    "observedAt": "2026-04-30T20:30",
    "condition": "Clear sky"
  },
  "source": "open-meteo.com",
  "fetchedAt": "2026-04-30T19:31:56.430Z"
}
```

#### Errors

| Status | When                                   |
| ------ | -------------------------------------- |
| 400    | Missing or invalid `city`/`lat`/`lon`. |
| 404    | City not found by geocoding.           |
| 429    | More than 60 requests/minute per IP.   |
| 502    | Upstream Open-Meteo failure.           |

## Project layout

```
.
├── server.js              # Express app: routing, validation, rate limit, error normalization
├── src/
│   ├── validate.js        # Pure input validation
│   ├── openMeteo.js       # Geocoding + forecast client (timeouts, scoped error types)
│   └── weatherCodes.js    # WMO code → human-readable condition
├── public/
│   ├── index.html         # UI
│   ├── style.css
│   └── app.js             # City search, geolocation, render
├── tests/
│   ├── validate.test.js
│   ├── weatherCodes.test.js
│   └── server.test.js     # End-to-end with mocked upstream
└── delivery/
    ├── requirements.md
    ├── design.md
    ├── test-plan.md
    └── release-checklist.md
```

## Security notes

- **No secrets in repo.** Open-Meteo is keyless today; if a key is added later it must come from `process.env` and never be logged.
- **Input validation** at the boundary: city is character-allowlisted and length-capped; coords are numeric-bounded.
- **Rate limit**: 60 rpm/IP via `express-rate-limit`.
- **Outbound timeout**: 5s `AbortController` on every upstream call.
- **No raw upstream bodies in errors.** The client only ever sees normalized error shapes.
- **Logs** record query and outcome only — no PII, no upstream payloads.

## Rollback

Local-only delivery. To roll back, stop the process (Ctrl-C) and `git revert` the change set once it's committed. There is no database, no migration, and no remote state.
