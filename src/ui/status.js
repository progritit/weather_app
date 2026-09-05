export const previewStates = {
  ready: "Ready",
  initial: "Initial loading",
  refreshing: "Refresh loading",
  invalid: "Invalid location",
  unavailable: "Unavailable service",
  offline: "Offline / cached",
  denied: "Location permission denied",
  missing: "Missing weather data",
};
export function renderStatus(state) {
  const messages = {
    refreshing: [
      "Updating the forecast…",
      "Your previous readings remain visible.",
    ],
    invalid: [
      "We couldn’t find that location.",
      "Try Salvador or Paris in this mock preview.",
    ],
    unavailable: [
      "Weather is temporarily unavailable.",
      "The last preview remains visible. Please try again.",
    ],
    offline: [
      "Offline · showing cached weather",
      "Sample saved at 09:40 local time on September 5, 2026. These readings may be outdated.",
    ],
    denied: [
      "Location access is unavailable.",
      "You can still search for a city. This preview does not request your location.",
    ],
    missing: [
      "Some readings are unavailable.",
      "Missing values appear as a dash; available readings remain visible.",
    ],
  };
  if (!messages[state]) return "";
  const [title, message] = messages[state];
  return `<div class="status-banner ${state}" role="${["invalid", "unavailable"].includes(state) ? "alert" : "status"}"><div><strong>${title}</strong><p>${message}</p></div>${["offline", "unavailable"].includes(state) ? '<button class="quiet-button" data-action="retry">Try again</button>' : ""}</div>`;
}
export function renderSkeleton() {
  return `<section class="loading-view" aria-busy="true" aria-label="Loading weather"><p role="status">Finding your place in the atmosphere…</p><div class="skeleton skeleton-title"></div><div class="skeleton skeleton-temperature"></div><div class="skeleton skeleton-line"></div><div class="skeleton-grid">${Array.from({ length: 4 }, () => '<div class="skeleton"></div>').join("")}</div></section>`;
}
