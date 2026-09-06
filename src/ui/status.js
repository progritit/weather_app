import { escapeHtml as esc } from "../utils/html.js";

export function renderStatus(state) {
  const loading = state.status === "loading" || state.status === "locating";
  if (loading && state.weather)
    return `<div class="status-banner" role="status"><div><strong>${state.status === "locating" ? "Finding your location…" : `Searching for ${esc(state.pendingLabel)}…`}</strong><p>Showing the previous forecast for ${esc(state.weather.location.label ?? "your last location")} while the new request completes.</p></div></div>`;
  if (state.error && !state.error.field)
    return `<div class="status-banner unavailable" role="alert"><div><strong>${state.weatherSource === "stale-cache" || state.weatherSource === "cache-fallback" ? "Showing the latest cached forecast while the weather service is unavailable." : esc(state.error.message)}</strong>${state.weather ? `<p>The forecast for ${esc(state.weather.location.label ?? "your last location")} may be out of date. ${esc(state.error.message)}</p>` : ""}</div>${state.error.retryable ? '<button class="quiet-button" data-action="retry" data-focus="retry">Try again</button>' : ""}</div>`;
  if (state.error?.field && state.weather)
    return `<div class="status-banner"><p>Still showing the previous forecast for ${esc(state.weather.location.label ?? "your last location")}.</p></div>`;
  if (state.weather && state.weatherSource === "cache")
    return '<div class="status-banner cached" role="status"><p>Showing a short-lived cached forecast. Use refresh to check for newer readings.</p></div>';
  if (state.weather && !state.weather.current)
    return '<div class="status-banner" role="status"><p>Current conditions are unavailable. Available forecast readings are shown below.</p></div>';
  return "";
}

export function renderSkeleton() {
  return `<section class="loading-view" aria-busy="true" aria-label="Loading weather"><p role="status">Finding your place in the atmosphere…</p><div class="skeleton skeleton-title"></div><div class="skeleton skeleton-temperature"></div><div class="skeleton skeleton-line"></div><div class="skeleton-grid">${Array.from({ length: 4 }, () => '<div class="skeleton"></div>').join("")}</div></section>`;
}
