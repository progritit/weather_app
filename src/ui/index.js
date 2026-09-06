import mark from "../../assets/branding/solaris-mark.svg";
import { temperature } from "../utils/units.js";
import { formatLocal, timestampLabel } from "../utils/dates.js";
import { selectForecast, forecastWindowKey } from "../data/selectForecast.js";
import {
  currentAppearance,
  conditionKey,
  phaseFor,
  visualProfile,
  activeAlerts,
} from "../utils/conditions.js";
import { escapeHtml as esc } from "../utils/html.js";
import { MAX_SAVED } from "../storage.js";
import { heroImage, weatherIcon, hydrateWeatherIcons } from "./assets.js";
import { renderHourly, renderDaily, renderMetrics } from "./forecast.js";
import { renderCurrent } from "./current.js";
import { renderStatus, renderSkeleton } from "./status.js";

const CACHED_SOURCES = new Set([
  "cache",
  "upstream-cache",
  "cache-fallback",
  "stale-cache",
]);

function renderAlertList(weather, alerts) {
  if (!alerts.length)
    return '<p class="drawer-intro">No current alerts were supplied for this location.</p>';
  return `<p class="drawer-intro">${esc(weather.location.label)}</p>${alerts.map((alert) => `<article class="provider-alert" ${alert.language ? `lang="${esc(alert.language)}"` : ""}><h3>${esc(alert.headline ?? alert.event ?? "Weather alert")}</h3><p class="subtle">From ${esc(timestampLabel(alert.onset.timestampMs, weather.location.timezone))} · Until ${esc(timestampLabel(alert.ends.timestampMs, weather.location.timezone))} local</p><p class="alert-description">${esc(alert.description ?? "No description was supplied.")}</p>${alert.link ? `<a href="${esc(alert.link)}" target="_blank" rel="noopener noreferrer">Read the issuing authority’s notice ↗</a>` : ""}</article>`).join("")}`;
}

export function mountApp(root, { store, storage, search }) {
  root.innerHTML = `<header class="site-header"><a class="brand" href="#overview" aria-label="Solaris Atmosphere Scanner overview"><img src="${mark}" width="40" height="40" alt="" /><span>SOLARIS<small>ATMOSPHERE SCANNER</small></span></a>
    <div class="search-region"><form class="search-form" role="search" novalidate><label class="sr-only" for="location-search">Search location</label><span aria-hidden="true">⌕</span><input id="location-search" name="location" placeholder="Search a city or postal code…" autocomplete="off" maxlength="120" required aria-describedby="search-error" /><button type="submit" class="search-submit">Search</button></form><p id="search-error" class="search-error" role="alert" hidden></p><details class="recent-searches"><summary>Recent searches</summary><div id="recent-list"></div></details></div>
    <nav class="header-actions" aria-label="Weather controls"><button class="quiet-button locate-button" data-action="locate"><span aria-hidden="true">◎</span> Use my location</button><div class="unit-switch" role="group" aria-label="Temperature units"><button data-unit="C" aria-pressed="true">°C</button><button data-unit="F" aria-pressed="false">°F</button></div><button class="saved-trigger quiet-button" data-action="saved">Saved locations <span aria-hidden="true">☰</span></button></nav></header>
    <main id="overview" tabindex="-1"><div class="observatory-line"><span>EARTH OBSERVATORY <span class="line-divider">/</span> OVERVIEW</span><span class="data-badge">VISUAL CROSSING</span></div><p id="feedback" class="action-feedback" role="status" hidden></p><div id="weather-status" aria-live="polite" aria-atomic="true"></div><div id="weather-content"></div></main>
    <footer class="site-footer"><span>SOLARIS <span class="subtle">/ Atmosphere Scanner</span></span><p>Weather data by <a href="https://www.visualcrossing.com/weather-api/">Visual Crossing</a></p><span>© ${new Date().getFullYear()} Clebson Web Dev</span></footer>
    <dialog class="saved-drawer" aria-labelledby="saved-title"><div class="drawer-heading"><div><p class="eyebrow">YOUR PLACES</p><h2 id="saved-title">Saved locations</h2></div><button class="icon-button" data-action="close-saved" aria-label="Close saved locations">×</button></div><p class="drawer-intro">A little closer, wherever you are.</p><div id="saved-content"></div></dialog>
    <dialog class="alert-dialog" aria-labelledby="alert-title"><div class="drawer-heading"><h2 id="alert-title">Weather alerts</h2><button class="icon-button" data-action="close-alert" aria-label="Close alerts">×</button></div><div id="alert-content"></div></dialog><div class="sr-only" id="announcer" role="status" aria-live="polite"></div>`;

  const content = root.querySelector("#weather-content");
  const input = root.querySelector("#location-search");
  const drawer = root.querySelector(".saved-drawer");
  const alertDialog = root.querySelector(".alert-dialog");
  let dialogReturnFocus = null;
  let lastWeather = null;
  let lastError = null;
  let lastPlaceId = null;
  let displayedAlertSignature = "";
  let displayedWindowSignature = "";
  const announce = (message) => {
    root.querySelector("#announcer").textContent = message;
  };
  const feedback = (message) => {
    const element = root.querySelector("#feedback");
    element.textContent = message;
    element.hidden = !message;
  };

  function updateClock() {
    const state = store.getState();
    if (!state.weather) return;
    const now = Date.now();
    const weather = selectForecast(state.weather, now);
    if (
      JSON.stringify(activeAlerts(weather, now)) !== displayedAlertSignature ||
      forecastWindowKey(weather) !== displayedWindowSignature
    ) {
      render(state);
      return;
    }
    const clock = root.querySelector("#local-clock");
    if (clock) {
      const label = formatLocal(now, weather.location.timezone, {
        weekday: "long",
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
        timeZoneName: "shortOffset",
      });
      clock.textContent =
        label === "—" ? "Local time unavailable" : `${label} · local time`;
    }
    const { condition, phase } = currentAppearance(weather, now);
    const profile = visualProfile(condition, phase);
    root.dataset.condition = profile.condition;
    root.dataset.phase = profile.phase;
    root.dataset.visualTheme = profile.theme;
    root.dataset.visualAccent = profile.accent;
    const hero = root.querySelector(".weather-hero");
    const image = heroImage(condition, phase, state.landscape);
    if (hero)
      hero.style.setProperty(
        "--hero-image",
        image ? `url("${image}")` : "none",
      );
    const phaseLabel = root.querySelector("#phase-label");
    const icon = hero?.querySelector(".hero-condition .weather-icon");
    if (icon) icon.outerHTML = weatherIcon(condition, phase);
    void hydrateWeatherIcons(root);
    if (phaseLabel)
      phaseLabel.textContent =
        phase === "day"
          ? "Daylight"
          : phase === "night"
            ? "After dark"
            : "Light unavailable";
  }

  function renderDrawer(state) {
    const priorValue = drawer.querySelector("#saved-city")?.value ?? "";
    drawer.querySelector("#saved-content").innerHTML =
      `<div class="saved-list">${
        state.saved.length
          ? state.saved
              .map((place, index) => {
                const summary = state.summaries[place.id];
                const refreshing =
                  state.status === "loading" &&
                  state.pendingPlaceId === place.id;
                const summaryTime = summary
                  ? timestampLabel(
                      summary.cachedAtMs ?? summary.fetchedAtMs,
                      summary.timezone,
                    )
                  : "—";
                const freshness = summary
                  ? `${CACHED_SOURCES.has(summary.source) ? "Cached" : "Updated"} ${summaryTime} local`
                  : "Open to load weather.";
                const sourceTimeLabel =
                  summary && CACHED_SOURCES.has(summary.source)
                    ? "Source reading"
                    : "Retrieved";
                return `<article class="saved-card"><button class="saved-location" data-saved="${index}" data-focus="saved-${index}"><span><strong>${esc(place.label)}</strong></span><span class="saved-temperature">${temperature(summary?.current?.temperature, state.unit, { includeUnit: true })}</span></button><p>${summary ? `${weatherIcon(conditionKey(summary.current?.icon), phaseFor(summary.current))} ${esc(summary.current?.condition ?? "Conditions unavailable")} · Observed ${esc(timestampLabel(summary.current?.timestampMs, summary.timezone))} · ${sourceTimeLabel} ${esc(timestampLabel(summary.fetchedAtMs, summary.timezone))} local · ${esc(freshness)}` : freshness}</p><div class="saved-card-actions"><button class="quiet-button" data-default="${index}" data-focus="default-${index}" aria-pressed="${state.defaultId === place.id}">${state.defaultId === place.id ? "★ Default location" : "Set as default"}</button><button class="quiet-button saved-refresh" data-refresh-saved="${index}" data-focus="refresh-saved-${index}" aria-disabled="${refreshing}" aria-busy="${refreshing}">${refreshing ? "Refreshing…" : "Refresh"}</button><button class="quiet-button" data-remove="${index}" data-focus="remove-${index}" aria-label="Remove ${esc(place.label)}">Remove</button></div></article>`;
              })
              .join("")
          : '<p class="empty-saved">No saved locations yet. Save a place using the star or search below.</p>'
      }</div><form class="add-location-form" novalidate><label for="saved-city">Find and save a location</label><div class="add-location-controls"><input id="saved-city" name="savedCity" placeholder="City, country" maxlength="120" required data-focus="saved-city" /><button class="primary-button" ${state.saved.length >= MAX_SAVED ? "disabled" : ""}>Save</button></div></form><p class="drawer-footnote">${state.saved.length >= MAX_SAVED ? `You have saved ${MAX_SAVED} locations. Remove one to add another.` : "Places are saved on this device. Open a place to refresh its weather."}</p>`;
    drawer.querySelector("#saved-city").value = priorValue;
  }

  function render(state) {
    const now = Date.now();
    const weather = state.weather ? selectForecast(state.weather, now) : null;
    const focused = document.activeElement?.dataset.focus;
    const selection =
      document.activeElement === drawer.querySelector("#saved-city")
        ? document.activeElement.selectionStart
        : null;
    const scrolls =
      state.currentPlace?.id === lastPlaceId
        ? [...content.querySelectorAll(".hourly-scroll")].map((element) => [
            element.dataset.focus,
            element.scrollLeft,
          ])
        : [];
    const busy = state.status === "loading" || state.status === "locating";
    root.querySelector(".search-form").setAttribute("aria-busy", String(busy));
    content.setAttribute("aria-busy", String(busy));
    root.querySelector("[data-action='locate']").disabled =
      state.status === "locating";
    root
      .querySelectorAll("[data-unit]")
      .forEach((button) =>
        button.setAttribute(
          "aria-pressed",
          String(button.dataset.unit === state.unit),
        ),
      );
    const error = root.querySelector("#search-error");
    error.textContent = state.error?.field ? state.error.message : "";
    error.hidden = !error.textContent;
    input.setAttribute("aria-invalid", String(Boolean(state.error?.field)));
    root.querySelector("#recent-list").innerHTML = state.recent.length
      ? `<ul>${state.recent.map((place, index) => `<li><button class="quiet-button" data-recent="${index}" data-focus="recent-${index}">${esc(place.label)}</button></li>`).join("")}</ul><button class="quiet-button" data-action="clear-recent" data-focus="clear-recent">Clear recent searches</button>`
      : '<p class="subtle">Successful searches will appear here.</p>';
    root.querySelector("#weather-status").innerHTML = renderStatus(state);
    const alerts = weather ? activeAlerts(weather, now) : [];
    displayedAlertSignature = JSON.stringify(alerts);
    displayedWindowSignature = weather ? forecastWindowKey(weather) : "";
    content.innerHTML = weather
      ? `${alerts.length ? `<div class="alert-banner"><span><strong>${esc(alerts[0].event ?? "Weather alert")}</strong>${alerts.length > 1 ? ` · ${alerts.length} notices` : ""}</span><button class="quiet-button" data-action="alert" data-focus="alert">View details →</button></div>` : ""}${renderCurrent({ ...state, weather }, now, weatherIcon)}${renderHourly(weather, state.unit, weatherIcon)}<div class="forecast-layout">${renderDaily(weather, state.unit, state.day, weatherIcon)}${renderMetrics(weather)}</div>`
      : busy
        ? renderSkeleton(
            state.status === "locating"
              ? "Finding your location…"
              : "Finding your place in the atmosphere…",
          )
        : '<section class="loading-view empty-weather"><h2>Find your forecast</h2><p>Search for a city or postal location to see its weather.</p></section>';
    if (drawer.open) renderDrawer(state);
    if (alertDialog.open)
      root.querySelector("#alert-content").innerHTML = renderAlertList(
        state.weather,
        alerts,
      );
    updateClock();
    scrolls.forEach(([key, left]) => {
      const element = [...content.querySelectorAll(".hourly-scroll")].find(
        (item) => item.dataset.focus === key,
      );
      if (element) element.scrollLeft = left;
    });
    if (focused) {
      const target = [...root.querySelectorAll("[data-focus]")].find(
        (element) => element.dataset.focus === focused,
      );
      if (target) {
        target.focus({ preventScroll: true });
        if (selection !== null)
          target.setSelectionRange?.(selection, selection);
      } else if (drawer.open) drawer.querySelector(".icon-button").focus();
      else if (
        !document.activeElement ||
        document.activeElement === document.body
      )
        input.focus({ preventScroll: true });
    }
    if (state.weather && state.weather !== lastWeather)
      announce(`Showing weather for ${state.currentPlace.label}.`);
    if (state.error && state.error !== lastError && !state.error.field)
      announce(
        state.weatherSource === "stale-cache" ||
          state.weatherSource === "cache-fallback"
          ? "Showing cached weather while the service is unavailable."
          : state.error.message,
      );
    if (state.error && state.error !== lastError && state.error.field)
      input.focus({ preventScroll: true });
    lastWeather = state.weather;
    lastError = state.error;
    lastPlaceId = state.currentPlace?.id ?? null;
  }

  function persist(patch) {
    const state = { ...store.getState(), ...patch };
    storage.writePreferences(state);
    store.setState(patch);
  }
  function openDialog(dialog) {
    dialogReturnFocus = document.activeElement;
    dialog.showModal();
    document.body.classList.add("dialog-open");
  }
  [drawer, alertDialog].forEach((dialog) => {
    dialog.addEventListener("close", () => {
      document.body.classList.remove("dialog-open");
      if (dialogReturnFocus?.isConnected) dialogReturnFocus.focus();
      else input.focus();
    });
    dialog.addEventListener("click", (event) => {
      if (event.target !== dialog) return;
      const rect = dialog.getBoundingClientRect();
      if (
        event.clientX < rect.left ||
        event.clientX > rect.right ||
        event.clientY < rect.top ||
        event.clientY > rect.bottom
      )
        dialog.close();
    });
  });

  root.addEventListener("submit", (event) => {
    if (!event.target.matches(".search-form, .add-location-form")) return;
    event.preventDefault();
    feedback("");
    root.querySelector(".recent-searches").open = false;
    if (event.target.matches(".add-location-form")) {
      if (store.getState().saved.length >= MAX_SAVED) return;
      const query = drawer.querySelector("#saved-city").value;
      drawer.close();
      input.value = query;
      void search.search(query, { save: true });
    } else void search.search(input.value);
  });

  root.addEventListener("change", (event) => {
    if (event.target.id === "landscape")
      persist({ landscape: event.target.value });
  });

  root.addEventListener("click", (event) => {
    const button = event.target.closest("button");
    if (
      !button ||
      button.disabled ||
      button.getAttribute("aria-disabled") === "true"
    )
      return;
    const state = store.getState();
    const {
      action,
      unit,
      day,
      recent,
      saved,
      refreshSaved,
      default: defaultIndex,
      remove,
    } = button.dataset;
    if (unit) {
      if (store.setUnit(unit)) {
        storage.writePreferences(store.getState());
        announce(
          `Temperatures shown in ${unit === "F" ? "Fahrenheit" : "Celsius"}. Other measurements stay metric.`,
        );
      }
      return;
    }
    if (day !== undefined) {
      const date = state.weather?.daily.find((item) => item.date === day)?.date;
      if (date) store.setState({ day: state.day === date ? null : date });
      return;
    }
    if (refreshSaved !== undefined) {
      const place = state.saved[Number(refreshSaved)];
      if (!place) return;
      feedback(`Refreshing ${place.label}…`);
      void search
        .refreshSaved(place)
        .then((weather) => {
          const summary = store.getState().summaries[place.id];
          if (!weather)
            feedback(`${place.label} could not be refreshed. Try again.`);
          else if (CACHED_SOURCES.has(summary?.source))
            feedback(`${place.label} is still showing cached weather.`);
          else feedback(`${place.label} weather summary updated.`);
        })
        .catch(() =>
          feedback(`${place.label} could not be refreshed. Try again.`),
        );
      return;
    }
    if (recent !== undefined || saved !== undefined) {
      const place =
        recent !== undefined
          ? state.recent[Number(recent)]
          : state.saved[Number(saved)];
      if (!place) return;
      drawer.close();
      root.querySelector(".recent-searches").open = false;
      input.value = place.label;
      feedback("");
      void search.search(place.query);
      return;
    }
    if (defaultIndex !== undefined) {
      const place = state.saved[Number(defaultIndex)];
      if (place) {
        persist({ defaultId: place.id });
        announce(`${place.label} is your default location.`);
      }
      return;
    }
    if (remove !== undefined) {
      const place = state.saved[Number(remove)];
      if (!place) return;
      persist({
        saved: state.saved.filter((item) => item.id !== place.id),
        defaultId: state.defaultId === place.id ? null : state.defaultId,
      });
      drawer.querySelector(".icon-button").focus();
      announce(`${place.label} removed.`);
      return;
    }
    if (action === "saved") {
      renderDrawer(state);
      void hydrateWeatherIcons(drawer);
      openDialog(drawer);
    }
    if (action === "close-saved") drawer.close();
    if (action === "alert") {
      root.querySelector("#alert-content").innerHTML = renderAlertList(
        state.weather,
        activeAlerts(state.weather, Date.now()),
      );
      openDialog(alertDialog);
    }
    if (action === "close-alert") alertDialog.close();
    if (action === "focus-search") {
      if (drawer.open) drawer.close();
      input.focus({ preventScroll: true });
      input.select();
      announce("Search manually for a city or postal location.");
    }
    if (action === "locate") {
      feedback("");
      void search.locate();
    }
    if (action === "refresh" && state.currentPlace) {
      feedback("");
      void search.search(state.currentPlace.query, {
        remember: false,
        force: true,
        refreshing: true,
      });
    }
    if (action === "retry") {
      feedback("");
      void search.retry();
    }
    if (action === "clear-recent") {
      storage.writeRecent([]);
      store.setState({ recent: [] });
      root.querySelector(".recent-searches summary").focus();
      feedback("Recent searches cleared.");
    }
    if (action === "favorite" && state.currentPlace) {
      const place = state.currentPlace;
      const exists = state.saved.some((item) => item.id === place.id);
      if (!exists && state.saved.length >= MAX_SAVED) {
        feedback(
          `You can save up to ${MAX_SAVED} locations. Remove a place to add another.`,
        );
        return;
      }
      persist({
        saved: exists
          ? state.saved.filter((item) => item.id !== place.id)
          : [...state.saved, place],
        defaultId:
          exists && state.defaultId === place.id ? null : state.defaultId,
      });
      feedback(
        `${place.label} ${exists ? "removed from" : "added to"} saved locations.`,
      );
    }
  });

  const unsubscribe = store.subscribe(render);
  render(store.getState());
  const clock = setInterval(updateClock, 60_000);
  const resume = () => {
    if (!document.hidden) updateClock();
  };
  document.addEventListener("visibilitychange", resume);
  return () => {
    unsubscribe();
    clearInterval(clock);
    document.removeEventListener("visibilitychange", resume);
    search.cancel();
  };
}
