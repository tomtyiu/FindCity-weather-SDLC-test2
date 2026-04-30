import express from "express";
import rateLimit from "express-rate-limit";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { validateCity, validateCoords } from "./src/validate.js";
import {
  geocodeCity,
  fetchCurrentWeather,
  UpstreamError,
  NotFoundError,
} from "./src/openMeteo.js";
import { describeWeatherCode } from "./src/weatherCodes.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function createApp({ now = () => new Date() } = {}) {
  const app = express();

  app.disable("x-powered-by");
  app.use(express.json({ limit: "8kb" }));

  const apiLimiter = rateLimit({
    windowMs: 60_000,
    max: 60,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) =>
      res.status(429).json({ error: "rate_limited", message: "Too many requests. Try again shortly." }),
  });

  app.get("/healthz", (_req, res) => res.status(200).send("ok"));

  app.get("/api/weather", apiLimiter, async (req, res) => {
    const started = Date.now();
    let outcome = "ok";
    let cityForLog = null;

    try {
      const { city, lat, lon } = req.query;
      let location;

      if (city !== undefined) {
        const v = validateCity(city);
        if (!v.ok) {
          outcome = "invalid_request";
          return res.status(400).json({ error: "invalid_request", message: v.reason });
        }
        cityForLog = v.value;
        const geo = await geocodeCity(v.value);
        location = {
          name: geo.name,
          country: geo.country,
          region: geo.admin1,
          latitude: geo.latitude,
          longitude: geo.longitude,
          timezone: geo.timezone,
        };
      } else if (lat !== undefined || lon !== undefined) {
        const v = validateCoords(lat, lon);
        if (!v.ok) {
          outcome = "invalid_request";
          return res.status(400).json({ error: "invalid_request", message: v.reason });
        }
        cityForLog = `coords:${v.value.lat.toFixed(2)},${v.value.lon.toFixed(2)}`;
        location = {
          name: null,
          country: null,
          region: null,
          latitude: v.value.lat,
          longitude: v.value.lon,
          timezone: "auto",
        };
      } else {
        outcome = "invalid_request";
        return res
          .status(400)
          .json({ error: "invalid_request", message: "provide ?city=... or ?lat=...&lon=..." });
      }

      const current = await fetchCurrentWeather({
        latitude: location.latitude,
        longitude: location.longitude,
        timezone: location.timezone,
      });

      return res.status(200).json({
        location,
        current: {
          ...current,
          condition: describeWeatherCode(current.weatherCode),
        },
        source: "open-meteo.com",
        fetchedAt: now().toISOString(),
      });
    } catch (err) {
      if (err instanceof NotFoundError) {
        outcome = "not_found";
        return res.status(404).json({ error: "not_found", message: "We couldn't find that city." });
      }
      if (err instanceof UpstreamError) {
        outcome = "upstream_error";
        return res
          .status(502)
          .json({ error: "upstream_error", message: "Weather service is unavailable. Please retry." });
      }
      outcome = "internal_error";
      console.error(JSON.stringify({ level: "error", event: "unhandled", error: String(err) }));
      return res.status(500).json({ error: "internal_error", message: "Something went wrong." });
    } finally {
      const latencyMs = Date.now() - started;
      console.log(
        JSON.stringify({
          level: "info",
          event: "weather_request",
          query: cityForLog,
          outcome,
          latencyMs,
        }),
      );
    }
  });

  app.use(express.static(path.join(__dirname, "public")));

  return app;
}

const isMain = import.meta.url === `file://${process.argv[1]}` ||
  import.meta.url === new URL(`file:///${process.argv[1].replace(/\\/g, "/")}`).href;

if (isMain) {
  const port = Number(process.env.PORT) || 3000;
  createApp().listen(port, () => {
    console.log(JSON.stringify({ level: "info", event: "server_started", port }));
  });
}
