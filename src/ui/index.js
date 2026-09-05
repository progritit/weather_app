import mark from "../../assets/branding/solaris-mark.svg";
import { locations, conditions, getMockWeather } from "../data/mockWeather.js";
import { temperature } from "../utils/units.js";
import { heroImage, weatherIcon } from "./assets.js";
import { renderHourly, renderDaily, renderMetrics } from "./forecast.js";
import { previewStates, renderStatus, renderSkeleton } from "./status.js";

// Transient demo state only. The shared state/storage layers are connected later.
export function mountApp(root) {
  const demo = {
    location: "salvador",
    unit: "C",
    condition: "clear",
    phase: "day",
    status: "ready",
    day: null,
    saved: ["salvador", "paris"],
    defaultLocation: "salvador",
    alert: false,
  };
  let dialogReturnFocus = null;
  root.innerHTML = `<header class="site-header"><a class="brand" href="#overview" aria-label="Solaris Atmosphere Scanner overview"><img src="${mark}" width="40" height="40" alt="" /><span>SOLARIS<small>ATMOSPHERE SCANNER</small></span></a>
    <form class="search-form" role="search"><label class="sr-only" for="location-search">Search location</label><span aria-hidden="true">⌕</span><input id="location-search" name="location" placeholder="Search a city…" autocomplete="off" list="demo-locations" required /><datalist id="demo-locations"><option value="Salvador"></option><option value="Paris"></option></datalist><button type="submit" class="search-submit">Search</button></form>
    <nav class="header-actions" aria-label="Weather controls"><button class="quiet-button locate-button" data-action="locate"><span aria-hidden="true">◎</span> Use my location</button><div class="unit-switch" role="group" aria-label="Temperature units"><button data-unit="C" aria-pressed="true">°C</button><button data-unit="F" aria-pressed="false">°F</button></div><button class="saved-trigger quiet-button" data-action="saved">Saved locations <span aria-hidden="true">☰</span></button></nav></header>
    <main id="overview" tabindex="-1"><div class="observatory-line"><span>EARTH OBSERVATORY <span class="line-divider">/</span> OVERVIEW</span><span class="mock-badge">MOCK DATA · 05 SEP 2026</span></div><div id="weather-content"></div></main>
    <footer class="site-footer"><span>SOLARIS <span class="subtle">/ Atmosphere Scanner</span></span><p>Mock forecast · Planned provider: <a href="https://www.visualcrossing.com/weather-api/">Visual Crossing</a></p><span>© ${new Date().getFullYear()} Clebson Web Dev</span></footer>
    <details class="preview-tools"><summary>Explore the static preview</summary><div class="preview-controls"><label>Weather<select id="preview-condition">${Object.entries(
      conditions,
    )
      .map(([key, value]) => `<option value="${key}">${value}</option>`)
      .join(
        "",
      )}</select></label><label>Local light<select id="preview-phase"><option value="day">Day</option><option value="night">Night</option></select></label><label>Interface state<select id="preview-status">${Object.entries(
      previewStates,
    )
      .map(([key, value]) => `<option value="${key}">${value}</option>`)
      .join(
        "",
      )}</select></label><label class="checkbox-label"><input type="checkbox" id="preview-alert" /> Sample weather alert</label></div><p>All readings and alerts are fictional. Search supports Salvador and Paris. Weather overrides demonstrate image themes, including scenarios outside a city’s typical climate. Saved locations reset on reload.</p></details>
    <dialog class="saved-drawer" aria-labelledby="saved-title"></dialog><dialog class="alert-dialog" aria-labelledby="alert-title"><div class="drawer-heading"><h2 id="alert-title">Sample heavy rain alert</h2><button class="icon-button" data-action="close-alert" aria-label="Close alert">×</button></div><p class="eyebrow">FICTIONAL ALERT · PREVIEW ONLY</p><p>Example advisory for heavy rainfall and reduced visibility, valid September 5 from 12:00–18:00 local time.</p><p>Live alerts will appear here only when supplied by the weather provider, with their source, times, and full description.</p></dialog><div class="sr-only" id="announcer" role="status" aria-live="polite"></div>`;
  const content = root.querySelector("#weather-content");
  const drawer = root.querySelector(".saved-drawer");
  const alertDialog = root.querySelector(".alert-dialog");
  const announce = (message) => {
    root.querySelector("#announcer").textContent = message;
  };
  function render() {
    const weather = getMockWeather(demo.location, demo.condition, demo.phase);
    root.dataset.phase = demo.phase;
    root
      .querySelectorAll("[data-unit]")
      .forEach((button) =>
        button.setAttribute("aria-pressed", button.dataset.unit === demo.unit),
      );
    root.querySelector("#preview-status").value = demo.status;
    content.innerHTML = `${renderStatus(demo.status)}${
      demo.status === "initial"
        ? renderSkeleton()
        : `
      ${demo.alert ? '<div class="alert-banner"><span><strong>Sample weather alert</strong> · Heavy rain advisory</span><button class="quiet-button" data-action="alert">View details →</button></div>' : ""}
      <section class="weather-hero" aria-labelledby="location-title" style="--hero-image: url('${heroImage(demo.condition, demo.phase, weather.location.landscape)}')"><div class="hero-top"><div><p class="eyebrow">${weather.location.region.toUpperCase()}</p><h1 id="location-title">${weather.location.name}<span>.</span></h1><p class="local-time">Saturday, September 5 · ${weather.time} local time</p></div><button class="favorite-button" data-action="favorite" aria-label="${demo.saved.includes(demo.location) ? "Remove from" : "Add to"} saved locations" aria-pressed="${demo.saved.includes(demo.location)}">${demo.saved.includes(demo.location) ? "★" : "☆"}</button></div>
      <div class="hero-reading"><div class="hero-temperature">${temperature(weather.temperature, demo.unit)}<span>${demo.unit}</span></div><div class="hero-condition">${weatherIcon(demo.condition, demo.phase)}<h2>${conditions[demo.condition]}</h2><p>Feels like ${temperature(weather.feelsLike, demo.unit)} <span>·</span> H ${temperature(weather.daily[0].high, demo.unit)} / L ${temperature(weather.daily[0].low, demo.unit)}</p></div></div>
      <div class="hero-bottom"><span>${demo.status === "offline" ? "Cached Sep 5 · 09:40 local" : `Sample updated ${weather.updated} local`} <button class="inline-button" data-action="refresh" aria-label="Preview refreshing weather">↻</button></span><span>Illustrative atmosphere · ${demo.phase === "day" ? "Daylight" : "After dark"}</span></div></section>
      ${renderHourly(weather, demo.unit)}<div class="forecast-layout">${renderDaily(weather, demo.unit, demo.day)}${renderMetrics(weather, demo.status === "missing")}</div>`
    }`;
  }
  function renderDrawer() {
    drawer.innerHTML = `<div class="drawer-heading"><div><p class="eyebrow">YOUR PLACES</p><h2 id="saved-title">Saved locations</h2></div><button class="icon-button" data-action="close-saved" aria-label="Close saved locations">×</button></div><p class="drawer-intro">A little closer, wherever you are.</p><div class="saved-list">${
      demo.saved.length
        ? demo.saved
            .map((id) => {
              const weather = getMockWeather(id, demo.condition, demo.phase);
              return `<article class="saved-card"><button class="saved-location" data-location="${id}"><span><strong>${weather.location.name}</strong><span>${weather.location.region}</span></span><span class="saved-temperature">${temperature(weather.temperature, demo.unit)}</span></button><p>${weatherIcon(demo.condition, demo.phase)} ${conditions[demo.condition]} · Sample updated ${weather.updated} local</p><div class="saved-card-actions"><button class="quiet-button" data-default="${id}" aria-pressed="${demo.defaultLocation === id}">${demo.defaultLocation === id ? "★ Default location" : "Set as default"}</button><button class="quiet-button" data-remove="${id}" aria-label="Remove ${weather.location.name}">Remove</button></div></article>`;
            })
            .join("")
        : '<p class="empty-saved">No saved locations yet. Add a place below to keep it close.</p>'
    }</div><form class="add-location-form"><label for="saved-city">Add a location</label><div class="add-location-controls"><select id="saved-city" name="savedCity" ${demo.saved.length === 2 ? "disabled" : ""}>${Object.entries(
      locations,
    )
      .filter(([id]) => !demo.saved.includes(id))
      .map(
        ([id, location]) => `<option value="${id}">${location.name}</option>`,
      )
      .join(
        "",
      )}</select><button class="primary-button" ${demo.saved.length === 2 ? "disabled" : ""}>Add</button></div>${demo.saved.length === 2 ? '<p class="subtle">Both preview locations are saved.</p>' : ""}</form><p class="drawer-footnote">Preview only · changes last until this page is reloaded.</p>`;
  }
  function openDialog(dialog) {
    dialogReturnFocus = document.activeElement;
    dialog.showModal();
    document.body.classList.add("dialog-open");
  }
  [drawer, alertDialog].forEach((dialog) => {
    dialog.addEventListener("close", () => {
      document.body.classList.remove("dialog-open");
      dialogReturnFocus?.focus();
    });
    dialog.addEventListener("click", (event) => {
      if (event.target === dialog) {
        const rect = dialog.getBoundingClientRect();
        if (
          event.clientX < rect.left ||
          event.clientX > rect.right ||
          event.clientY < rect.top ||
          event.clientY > rect.bottom
        )
          dialog.close();
      }
    });
  });
  root.addEventListener("submit", (event) => {
    event.preventDefault();
    if (event.target.matches(".search-form")) {
      const query = root
        .querySelector("#location-search")
        .value.trim()
        .toLowerCase();
      const match = Object.entries(locations).find(
        ([, location]) => location.name.toLowerCase() === query,
      );
      if (match) {
        demo.location = match[0];
        demo.status = "ready";
        demo.day = null;
        announce(`Showing sample weather for ${match[1].name}.`);
      } else demo.status = "invalid";
      render();
    } else if (event.target.matches(".add-location-form")) {
      const id = drawer.querySelector("#saved-city").value;
      if (locations[id] && !demo.saved.includes(id)) {
        demo.saved.push(id);
        demo.defaultLocation ??= id;
        renderDrawer();
        render();
        drawer.querySelector(".icon-button").focus();
        announce(`${locations[id].name} saved.`);
      }
    }
  });
  root.addEventListener("change", (event) => {
    const key = {
      "preview-condition": "condition",
      "preview-phase": "phase",
      "preview-status": "status",
    }[event.target.id];
    if (key) demo[key] = event.target.value;
    else if (event.target.id === "preview-alert")
      demo.alert = event.target.checked;
    render();
  });
  root.addEventListener("click", (event) => {
    const button = event.target.closest("button");
    if (!button) return;
    const {
      action,
      unit,
      day,
      location,
      default: defaultId,
      remove,
    } = button.dataset;
    if (unit) demo.unit = unit;
    if (day !== undefined)
      demo.day = demo.day === Number(day) ? null : Number(day);
    if (location) {
      demo.location = location;
      demo.status = "ready";
      demo.day = null;
      drawer.close();
      announce(`Showing sample weather for ${locations[location].name}.`);
    }
    if (defaultId) {
      demo.defaultLocation = defaultId;
      renderDrawer();
      drawer.querySelector(`[data-default="${defaultId}"]`).focus();
      announce(`${locations[defaultId].name} is the preview default.`);
    }
    if (remove) {
      demo.saved = demo.saved.filter((id) => id !== remove);
      if (demo.defaultLocation === remove)
        demo.defaultLocation = demo.saved[0] ?? null;
      renderDrawer();
      drawer.querySelector(".icon-button").focus();
      announce(`${locations[remove].name} removed.`);
    }
    if (action === "saved") {
      renderDrawer();
      openDialog(drawer);
      return;
    }
    if (action === "close-saved") {
      drawer.close();
      return;
    }
    if (action === "alert") {
      openDialog(alertDialog);
      return;
    }
    if (action === "close-alert") {
      alertDialog.close();
      return;
    }
    if (action === "locate") demo.status = "denied";
    if (action === "refresh") demo.status = "refreshing";
    if (action === "retry") demo.status = "ready";
    if (action === "favorite") {
      if (demo.saved.includes(demo.location)) {
        demo.saved = demo.saved.filter((id) => id !== demo.location);
        if (demo.defaultLocation === demo.location)
          demo.defaultLocation = demo.saved[0] ?? null;
      } else {
        demo.saved.push(demo.location);
        demo.defaultLocation ??= demo.location;
      }
    }
    render();
    if (day !== undefined)
      content.querySelector(`[data-day="${day}"]`)?.focus();
    else if (["favorite", "refresh", "retry"].includes(action))
      content
        .querySelector(
          `[data-action="${action === "retry" ? "refresh" : action}"]`,
        )
        ?.focus();
  });
  render();
}
