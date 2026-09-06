import { temperature } from "../utils/units.js";
import { localDate, timestampLabel } from "../utils/dates.js";
import { currentAppearance } from "../utils/conditions.js";
import { escapeHtml as esc } from "../utils/html.js";

// Assets are supplied by the app shell; this renderer needs neither Webpack nor the DOM.
export function renderCurrent(state, now, weatherIcon) {
  const { weather, currentPlace, unit, landscape } = state;
  const current = weather.current;
  const label = weather.location.label ?? currentPlace.label;
  const [name, ...region] = label.split(",");
  const today = weather.daily.find(
    (day) => day.date === localDate(now, weather.location.timezone),
  );
  const saved = state.saved.some((place) => place.id === currentPlace.id);
  const { condition, phase } = currentAppearance(weather, now);
  const temp = (value) => temperature(value, unit, { includeUnit: true });
  const cached = [
    "cache",
    "upstream-cache",
    "cache-fallback",
    "stale-cache",
  ].includes(state.weatherSource);
  const freshnessTimestamp = cached
    ? (state.cacheTimestampMs ?? weather.meta.fetchedAtMs)
    : weather.meta.fetchedAtMs;
  const freshnessLabel = cached ? "Cached" : "Retrieved";
  return `<section class="weather-hero" aria-labelledby="location-title"><div class="hero-top"><div><p class="eyebrow">${esc(region.join(",").trim() || "CURRENT CONDITIONS")}</p><h1 id="location-title">${esc(name)}<span>.</span></h1><p class="resolved-location">${esc(label)}</p><p class="local-time" id="local-clock"></p></div><button class="favorite-button" data-action="favorite" data-focus="favorite" aria-label="${saved ? "Remove from" : "Add to"} saved locations" aria-pressed="${saved}">${saved ? "★" : "☆"}</button></div>
    <div class="hero-reading"><div class="hero-temperature" aria-label="${Number.isFinite(current?.temperature) ? `Temperature ${temp(current.temperature)}` : "Temperature unavailable"}">${temperature(current?.temperature, unit)}${Number.isFinite(current?.temperature) ? `<span>${unit}</span>` : ""}</div><div class="hero-condition">${weatherIcon(condition, phase)}<h2>${esc(current?.condition ?? "Conditions unavailable")}</h2><p>Feels like ${temp(current?.feelsLike)} <span>·</span> H ${temp(today?.high)} / L ${temp(today?.low)}</p></div></div>
    <div class="hero-bottom"><span>Observed ${esc(timestampLabel(current?.timestampMs, weather.location.timezone))} · ${freshnessLabel} ${esc(timestampLabel(freshnessTimestamp, weather.location.timezone))} local <button class="inline-button" data-action="refresh" data-focus="refresh" aria-label="Refresh this location’s weather">↻</button></span><span>Illustrative atmosphere · <span id="phase-label"></span></span></div>
    <div class="scene-controls"><label for="landscape">Scenery</label><select id="landscape" data-focus="landscape">${[
      ["urban", "Urban"],
      ["countryside", "Countryside"],
      ["coastal", "Coastal"],
    ]
      .map(
        ([value, text]) =>
          `<option value="${value}" ${landscape === value ? "selected" : ""}>${text}</option>`,
      )
      .join("")}</select></div></section>`;
}
