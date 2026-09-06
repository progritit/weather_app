import { WORLD_LOCATIONS } from "../data/worldLocations.js";

export function validateLocation(input) {
  if (typeof input === "string") {
    const query = input.normalize("NFKC").trim().replace(/\s+/gu, " ");
    if (!query) throw new Error("Enter a city or postal location to search.");
    if (
      query.length < 2 ||
      query.length > 120 ||
      !/^[\p{L}\p{M}\p{N} .,'’()-]+$/u.test(query) ||
      !/[\p{L}\p{N}]/u.test(query)
    ) {
      throw new Error(
        "Use a city or postal location between 2 and 120 characters.",
      );
    }
    return query;
  }
  if (
    input &&
    typeof input === "object" &&
    Number.isFinite(input.latitude) &&
    Math.abs(input.latitude) <= 90 &&
    Number.isFinite(input.longitude) &&
    Math.abs(input.longitude) <= 180
  ) {
    return {
      latitude: Number(input.latitude.toFixed(3)),
      longitude: Number(input.longitude.toFixed(3)),
    };
  }
  throw new Error("Enter a valid city or location.");
}

const LOWERCASE_PARTICLES = new Set([
  "a",
  "and",
  "da",
  "das",
  "de",
  "del",
  "der",
  "di",
  "do",
  "dos",
  "du",
  "d",
  "l",
  "la",
  "le",
  "of",
  "van",
  "von",
]);

function isSeparator(part) {
  return /^[\s-]+$/u.test(part) || part === "'" || part === "’";
}

function capitalizePart(part) {
  if (!part) return part;
  // Preserve intentional abbreviations such as D.C. and US state codes.
  if (/^(?:[A-ZÀ-ÖØ-Þ]\.){2,}$/u.test(part) || /^[A-Z]{2,3}$/u.test(part))
    return part;
  const lower = part.toLocaleLowerCase();
  return `${lower.charAt(0).toLocaleUpperCase()}${lower.slice(1)}`;
}

function folded(value) {
  return typeof value === "string"
    ? value
        .normalize("NFKD")
        .replace(/[\u0300-\u036f]/gu, "")
        .toLocaleLowerCase()
        .replace(/[^\p{L}\p{N}]+/gu, " ")
        .trim()
    : "";
}

function canonicalPart(primary, fallback) {
  if (!primary) return fallback;
  if (!fallback) return primary;
  return folded(primary) === folded(fallback) ? fallback : primary;
}

function catalogContext(resolved, fallback) {
  const city = folded(resolved.city ?? fallback.city);
  if (!city) return null;
  const candidates = WORLD_LOCATIONS.filter(
    (location) => folded(location.city) === city,
  );
  if (candidates.length !== 1) return null;
  const [candidate] = candidates;
  const country = folded(resolved.country ?? fallback.country);
  const countryMatches =
    Boolean(country) && folded(candidate.country) === country;
  const regionMatches =
    !resolved.region || folded(candidate.region) === folded(resolved.region);
  return {
    city: candidate.city,
    region:
      (countryMatches && (regionMatches || !resolved.region)) ||
      (Boolean(resolved.region) && regionMatches)
        ? candidate.region
        : null,
    country: countryMatches ? candidate.country : null,
  };
}

/**
 * Formats a location component without stripping its accents. Hyphenated and
 * apostrophe-separated names retain their natural punctuation, while common
 * connector words remain lower-case after the first word.
 */
export function titleCaseLocationPart(value) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().replace(/\s+/gu, " ");
  if (!trimmed) return null;
  return trimmed
    .split(/([\s-]+|'|’)/u)
    .map((part, index) => {
      if (isSeparator(part)) return part;
      const lower = part.toLocaleLowerCase();
      return index > 0 && LOWERCASE_PARTICLES.has(lower)
        ? lower
        : capitalizePart(part);
    })
    .join("");
}

function splitLocation(value) {
  if (typeof value !== "string")
    return { city: null, region: null, country: null };
  const parts = value
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  if (!parts.length) return { city: null, region: null, country: null };
  const postalPrefix =
    parts.length > 2 &&
    /\d/u.test(parts[0]) &&
    /^[A-Z0-9][A-Z0-9 -]{2,12}$/iu.test(parts[0]);
  const locationParts = postalPrefix ? parts.slice(1) : parts;
  if (locationParts.length === 1)
    return { city: locationParts[0], region: null, country: null };
  return {
    city: locationParts[0],
    region:
      locationParts.length > 2 ? locationParts.slice(1, -1).join(", ") : null,
    country: locationParts.at(-1),
  };
}

/**
 * Converts a provider address into a stable display model. Visual Crossing
 * can return only a city or a differently cased address, so the validated
 * search query is used to fill missing region/country components. The source
 * region is retained even when it shares the city name (for example, São
 * Paulo city and São Paulo state), because that repetition can carry real
 * administrative meaning.
 */
export function formatResolvedLocation(label, fallbackQuery) {
  const resolved = splitLocation(label);
  const fallback = splitLocation(fallbackQuery);
  const catalog = catalogContext(resolved, fallback);
  const city = titleCaseLocationPart(
    canonicalPart(resolved.city, catalog?.city ?? fallback.city),
  );
  const country = titleCaseLocationPart(
    canonicalPart(resolved.country, catalog?.country ?? fallback.country),
  );
  const region = titleCaseLocationPart(
    canonicalPart(resolved.region, fallback.region ?? catalog?.region),
  );
  const displayParts = [city, region, country].filter(Boolean);
  const displayLabel = displayParts.length
    ? displayParts.join(", ")
    : titleCaseLocationPart(label ?? fallbackQuery);
  return { city, region, country, label: displayLabel };
}

export function locationKey(query) {
  return typeof query === "string"
    ? `place:${query
        .normalize("NFKD")
        .replace(/[\u0300-\u036f]/gu, "")
        .toLocaleLowerCase()}`
    : `coordinates:${query.latitude},${query.longitude}`;
}

export function queryLabel(query) {
  return typeof query === "string"
    ? query
    : `${query.latitude}, ${query.longitude}`;
}

export function placeFromWeather(weather, originalQuery) {
  const { label } = weather.location;
  let query = originalQuery;
  // Keep named searches as addresses when revisited. Coordinate responses need
  // not include a human-readable city name; geolocation remains a coordinate query.
  if (typeof originalQuery === "string" && label) {
    try {
      query = validateLocation(label);
    } catch {
      /* Retain the user's validated query if the resolved label is too long. */
    }
  }
  return {
    id: locationKey(query),
    query,
    label: label || queryLabel(originalQuery),
  };
}
