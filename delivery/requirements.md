# Requirements — Real-time Weather App

## User Story

As a user I want to view real-time weather data for my city so that I can plan my day.

## Functional Requirements

| ID  | Requirement                                                                                              | Acceptance Test                                                                  |
| --- | -------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| F1  | User can enter a city name and view current weather (temperature, conditions, wind, humidity).           | Searching `London` returns a populated weather card.                             |
| F2  | User can use browser geolocation to fetch weather for their current coordinates.                         | Clicking "Use my location" resolves to a city-aware result.                      |
| F3  | App resolves a city name to coordinates before fetching weather (geocoding).                             | Ambiguous names return the highest-confidence match plus country/region context. |
| F4  | App displays a clear error when a city cannot be found or upstream fails.                                | Searching `zzzzzz` shows a "city not found" message, not a stack trace.          |
| F5  | App shows the data source and the time the data was fetched (so "real-time" is verifiable).              | The card includes "Updated HH:MM:SS" and a source attribution.                   |

## Non-Functional Requirements

| ID  | Requirement                                                                                              |
| --- | -------------------------------------------------------------------------------------------------------- |
| N1  | Backend p95 latency under 1.5s for cache-miss requests against Open-Meteo.                               |
| N2  | No secrets in source, env, or logs. Open-Meteo is keyless; no credentials are needed today.              |
| N3  | All untrusted input (city name, coords) is validated server-side; rejected with `400` and a safe message.|
| N4  | Backend rate-limits clients to 60 requests/minute/IP to bound abuse and upstream cost.                   |
| N5  | App degrades safely on network failure (clear error, no partial/stale render claiming freshness).        |
| N6  | Logs avoid PII; only city query and outcome status are logged.                                           |

## Security Acceptance Criteria

- City name input is constrained to a length cap (≤ 100 chars) and rejected if it contains control characters.
- Coordinate input is bounded (lat ∈ [-90, 90], lon ∈ [-180, 180]) and parsed as numbers.
- Backend never echoes raw upstream response bodies on error — only normalized error shapes.
- CORS is locked to same-origin (the static frontend is served by the same Express process).
- No outbound calls except to `geocoding-api.open-meteo.com` and `api.open-meteo.com`.

## Out of Scope

- User accounts, saved cities, push notifications.
- Historical or forecast data beyond "current".
- Internationalization of the UI strings.
- Production hosting (local-only delivery for this iteration).
