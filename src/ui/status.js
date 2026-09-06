import { escapeHtml as esc } from "../utils/html.js";

const CACHED_SOURCES = new Set([
  "cache",
  "upstream-cache",
  "cache-fallback",
  "stale-cache",
]);

function retryButton() {
  return '<button class="quiet-button" data-action="retry" data-focus="retry" aria-label="Retry weather request">Try again</button>';
}

function manualSearchButton() {
  return '<button class="quiet-button" data-action="focus-search" data-focus="manual-search">Search manually</button>';
}

function loadingMessage(state) {
  if (state.pendingMode === "locating") return "Finding your location…";
  if (state.pendingMode === "refresh")
    return `Refreshing ${esc(state.pendingLabel)}…`;
  return `Searching for ${esc(state.pendingLabel)}…`;
}

export function renderStatus(state) {
  const loading = state.status === "loading" || state.status === "locating";
  if (loading && state.weather)
    return `<div class="status-banner" role="status" aria-live="polite"><div><strong>${loadingMessage(state)}</strong><p>Showing the previous forecast for ${esc(state.weather.location.label ?? "your last location")} while the new request completes.</p></div></div>`;

  if (state.error && !state.error.field) {
    const usingCache =
      state.weatherSource === "stale-cache" ||
      state.weatherSource === "cache-fallback";
    const action =
      state.error.code === "LOCATION_UNAVAILABLE"
        ? manualSearchButton()
        : state.error.retryable
          ? retryButton()
          : "";
    return `<div class="status-banner unavailable" role="alert"><div><strong>${usingCache ? "Showing the latest cached forecast while the weather service is unavailable." : esc(state.error.message)}</strong>${state.weather ? `<p>The forecast for ${esc(state.weather.location.label ?? "your last location")} may be out of date. ${esc(state.error.message)}</p>` : `<p>${state.error.code === "LOCATION_UNAVAILABLE" ? "You can search for a city or postal location instead." : "Please try again when the service is available."}</p>`}</div>${action}</div>`;
  }

  if (state.error?.field && state.weather)
    return `<div class="status-banner" role="status"><p>Still showing the previous forecast for ${esc(state.weather.location.label ?? "your last location")}.</p></div>`;

  if (state.weather && CACHED_SOURCES.has(state.weatherSource)) {
    if (state.weatherSource === "upstream-cache")
      return '<div class="status-banner cached" role="status"><p>The provider returned a cached forecast. The observed time is retained below; try again later for newer readings.</p></div>';
    return '<div class="status-banner cached" role="status"><p>Showing a cached forecast. Its retrieval time is labelled below; use refresh to check for newer readings.</p></div>';
  }

  if (state.weather && !state.weather.current)
    return '<div class="status-banner" role="status"><p>Current conditions are unavailable. Available forecast readings are shown below.</p></div>';
  return "";
}

export function renderSkeleton(
  message = "Finding your place in the atmosphere…",
) {
  return `<section class="loading-view" aria-busy="true" aria-label="Loading weather"><p role="status">${esc(message)}</p><div class="skeleton skeleton-title"></div><div class="skeleton skeleton-temperature"></div><div class="skeleton skeleton-line"></div><div class="skeleton-grid">${Array.from({ length: 4 }, () => '<div class="skeleton"></div>').join("")}</div></section>`;
}
