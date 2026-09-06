import fallbackIcon from "../../assets/icons/weather/unknown.svg";
import fallbackHero from "../../assets/images/weather/weather-fallback.svg";
import { iconKey, conditionKey } from "../utils/conditions.js";

// The context is deliberately limited to the curated hero folder. Webpack
// emits every matching image and the runtime selects only known filenames.
const heroes = import.meta.webpackContext("../../assets/images", {
  recursive: true,
  regExp: /\.webp$/,
});

// Dynamic imports stay behind this allow-list. A provider string can never
// become an arbitrary import path, and unknown keys use the bundled fallback.
const ICON_IMPORTS = Object.freeze({
  "clear-day": () =>
    import(
      /* webpackChunkName: "weather-icon-clear-day" */ "../../assets/icons/weather/clear-day.svg"
    ),
  "clear-night": () =>
    import(
      /* webpackChunkName: "weather-icon-clear-night" */ "../../assets/icons/weather/clear-night.svg"
    ),
  "partly-cloudy-day": () =>
    import(
      /* webpackChunkName: "weather-icon-partly-cloudy-day" */ "../../assets/icons/weather/partly-cloudy-day.svg"
    ),
  "partly-cloudy-night": () =>
    import(
      /* webpackChunkName: "weather-icon-partly-cloudy-night" */ "../../assets/icons/weather/partly-cloudy-night.svg"
    ),
  overcast: () =>
    import(
      /* webpackChunkName: "weather-icon-overcast" */ "../../assets/icons/weather/overcast.svg"
    ),
  rain: () =>
    import(
      /* webpackChunkName: "weather-icon-rain" */ "../../assets/icons/weather/rain.svg"
    ),
  sleet: () =>
    import(
      /* webpackChunkName: "weather-icon-sleet" */ "../../assets/icons/weather/sleet.svg"
    ),
  snow: () =>
    import(
      /* webpackChunkName: "weather-icon-snow" */ "../../assets/icons/weather/snow.svg"
    ),
  thunderstorm: () =>
    import(
      /* webpackChunkName: "weather-icon-thunderstorm" */ "../../assets/icons/weather/thunderstorm.svg"
    ),
  fog: () =>
    import(
      /* webpackChunkName: "weather-icon-fog" */ "../../assets/icons/weather/fog.svg"
    ),
  wind: () =>
    import(
      /* webpackChunkName: "weather-icon-wind" */ "../../assets/icons/weather/wind.svg"
    ),
});

const iconPromises = new Map();

function iconUrl(key) {
  if (!ICON_IMPORTS[key]) return Promise.resolve(fallbackIcon);
  if (!iconPromises.has(key)) {
    iconPromises.set(
      key,
      ICON_IMPORTS[key]()
        .then((module) => module.default ?? module)
        .catch(() => fallbackIcon),
    );
  }
  return iconPromises.get(key);
}

export function heroImage(condition, phase, landscape) {
  if (!["day", "night"].includes(phase)) return fallbackHero;
  const scene = ["urban", "countryside", "coastal"].includes(landscape)
    ? landscape
    : "urban";
  const weather = conditionKey(condition);
  const filenameWeather = weather === "sleet" ? "snow" : weather;
  const prefix = scene === "coastal" ? "weather" : `weather-${scene}`;
  const filename = `${prefix}-${filenameWeather}-${phase}.webp`;
  // Resolve by filename: supports sibling weather/urban/countryside folders
  // and the earlier nested layout without accepting arbitrary paths.
  const key = heroes.keys().find((path) => path.split("/").at(-1) === filename);
  return key ? heroes(key) : fallbackHero;
}

// Render a bundled fallback immediately; hydrateWeatherIcons() swaps in the
// mapped icon after its small Webpack chunk has loaded.
export function weatherIcon(condition, phase) {
  const key = iconKey(condition, phase);
  return `<img class="weather-icon weather-icon-pending" src="${fallbackIcon}" data-weather-icon="${key}" alt="" width="36" height="36" />`;
}

export function hydrateWeatherIcons(container) {
  if (!container?.querySelectorAll) return Promise.resolve();
  const nodes = [...container.querySelectorAll("img[data-weather-icon]")];
  return Promise.all(
    nodes.map(async (node) => {
      const key = node.dataset.weatherIcon;
      const src = await iconUrl(key);
      if (!node.isConnected) return;
      node.src = src;
      node.dataset.resolvedIcon = ICON_IMPORTS[key] ? key : "unknown";
      node.classList.remove("weather-icon-pending");
      node.classList.add("weather-icon-ready");
    }),
  );
}
