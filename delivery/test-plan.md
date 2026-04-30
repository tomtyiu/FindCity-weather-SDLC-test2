# Test Plan

## Layer matrix

| Layer       | Coverage                                                                                | Tooling                  |
| ----------- | --------------------------------------------------------------------------------------- | ------------------------ |
| Unit        | `validateCity`, `validateCoords`, `describeWeatherCode`                                 | `node:test`              |
| HTTP/integ. | `/healthz`, `/api/weather` happy path, 400, 404, 502, coords-skip-geocoder branch       | `node:test` + mock fetch |
| Manual      | Live smoke against Open-Meteo for `?city=London`, `?city=zzzzzzzzz`, missing params     | curl                     |
| Manual UI   | Search a city in browser, error state on bogus city, geolocation flow                   | Browser                  |

## Automated tests (24 total)

- **Validation (13)**: ASCII names, whitespace trimming, Unicode, hyphen/apostrophe/period/comma, empty, non-string, length cap, suspicious chars, coord parsing, coord range, missing args.
- **Weather codes (3)**: known codes, unknown codes, non-numeric input safety.
- **HTTP (8)**: health, missing params, invalid city chars, out-of-range coords, valid city happy path, unknown city → 404, upstream 5xx → 502, coords skip geocoder.

Mocked upstream uses a localhost passthrough so the test client's own request to the test server is not intercepted.

## Manual smoke (executed 2026-04-30)

| Step                                         | Expected           | Actual              |
| -------------------------------------------- | ------------------ | ------------------- |
| `GET /healthz`                               | `200 ok`           | `200 ok`            |
| `GET /api/weather?city=London`               | 200 + payload      | 200, 16.9°C clear   |
| `GET /api/weather?city=zzzzzzzzz`            | 404                | 404                 |
| `GET /api/weather` (no params)               | 400                | 400                 |
| `GET /` (static)                             | 200 HTML           | 200                 |
| `GET /style.css`, `GET /app.js`              | 200                | 200                 |

## Gaps / deferred

- No load test: 60 rpm rate limiter is exercised only by code review, not by load.
- No browser automation; UI verified by hand.
- No CSP / helmet; would be added before any non-local deploy.
