const form = document.getElementById("search-form");
const cityInput = document.getElementById("city-input");
const searchBtn = document.getElementById("search-btn");
const geoBtn = document.getElementById("geo-btn");
const statusEl = document.getElementById("status");
const card = document.getElementById("weather-card");

const els = {
  locName: document.getElementById("loc-name"),
  locSub: document.getElementById("loc-sub"),
  temp: document.getElementById("temp"),
  feels: document.getElementById("feels"),
  humidity: document.getElementById("humidity"),
  wind: document.getElementById("wind"),
  windDir: document.getElementById("wind-dir"),
  condition: document.getElementById("condition"),
  dayNight: document.getElementById("day-night"),
  updated: document.getElementById("updated"),
};

function setStatus(message, { error = false } = {}) {
  statusEl.textContent = message;
  statusEl.classList.toggle("error", Boolean(error));
}

function setBusy(busy) {
  searchBtn.disabled = busy;
  geoBtn.disabled = busy;
}

function show(value) {
  return value === null || value === undefined || Number.isNaN(value) ? "—" : value;
}

function render(data) {
  const { location, current, fetchedAt } = data;
  const subParts = [location.region, location.country].filter(Boolean);
  els.locName.textContent = location.name ?? `${location.latitude.toFixed(3)}, ${location.longitude.toFixed(3)}`;
  els.locSub.textContent = subParts.join(", ");
  els.temp.textContent = show(current.temperatureC);
  els.feels.textContent = show(current.apparentTemperatureC);
  els.humidity.textContent = show(current.humidity);
  els.wind.textContent = show(current.windSpeedKmh);
  els.windDir.textContent = show(current.windDirectionDeg);
  els.condition.textContent = current.condition ?? "Unknown";
  els.dayNight.textContent = current.isDay ? "Daytime" : "Nighttime";
  els.updated.textContent = new Date(fetchedAt).toLocaleTimeString();
  card.hidden = false;
}

async function fetchWeather(params) {
  const url = new URL("/api/weather", window.location.origin);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);

  setBusy(true);
  setStatus("Loading…");
  try {
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg = body.message || `Request failed (${res.status})`;
      setStatus(msg, { error: true });
      card.hidden = true;
      return;
    }
    render(body);
    setStatus("");
  } catch (err) {
    setStatus("We couldn't reach the weather service. Check your connection and try again.", { error: true });
    card.hidden = true;
  } finally {
    setBusy(false);
  }
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  const city = cityInput.value.trim();
  if (!city) {
    setStatus("Please enter a city.", { error: true });
    return;
  }
  fetchWeather({ city });
});

geoBtn.addEventListener("click", () => {
  if (!("geolocation" in navigator)) {
    setStatus("Geolocation isn't available in this browser.", { error: true });
    return;
  }
  setStatus("Getting your location…");
  setBusy(true);
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      setBusy(false);
      fetchWeather({ lat: pos.coords.latitude, lon: pos.coords.longitude });
    },
    (err) => {
      setBusy(false);
      const msg = err.code === err.PERMISSION_DENIED
        ? "Location permission denied. Try entering a city instead."
        : "Couldn't get your location. Try entering a city instead.";
      setStatus(msg, { error: true });
    },
    { enableHighAccuracy: false, timeout: 8000, maximumAge: 60_000 },
  );
});
