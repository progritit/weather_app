import { WORLD_LOCATIONS } from "../data/worldLocations.js";

function fold(value) {
  return typeof value === "string"
    ? value
        .normalize("NFKD")
        .replace(/[\u0300-\u036f]/gu, "")
        .toLocaleLowerCase()
        .replace(/[^\p{L}\p{N}]+/gu, " ")
        .trim()
    : "";
}

function editDistance(left, right) {
  const previous = Array.from({ length: right.length + 1 }, (_, i) => i);
  for (let row = 1; row <= left.length; row += 1) {
    let diagonal = previous[0];
    previous[0] = row;
    for (let column = 1; column <= right.length; column += 1) {
      const above = previous[column];
      previous[column] =
        left[row - 1] === right[column - 1]
          ? diagonal
          : Math.min(diagonal, previous[column - 1], above) + 1;
      diagonal = above;
    }
  }
  return previous[right.length];
}

function locationScore(location, input) {
  const query = fold(input);
  if (!query) return null;
  const city = fold(location.city);
  const region = fold(location.region);
  const country = fold(location.country);
  const full = fold(location.query);
  const tokens = query.split(" ").filter(Boolean);
  const haystack = `${city} ${region} ${country}`;

  if (full === query) return 0;
  if (city === query) return 4;
  if (city.startsWith(query)) return 10 + city.length / 100;
  if (full.startsWith(query)) return 20 + full.length / 100;
  if (!query.includes(" ") && query.length >= 4 && city.length >= 4) {
    const distance = editDistance(query, city);
    const tolerance = Math.max(1, Math.ceil(city.length / 4));
    if (distance <= tolerance) return 24 + distance + city.length / 100;
  }
  if (
    tokens.every((token) =>
      haystack.split(" ").some((part) => part.startsWith(token)),
    )
  )
    return 30 + full.length / 100;
  if (haystack.includes(query)) return 50 + full.length / 100;
  return null;
}

/**
 * Returns ranked local matches for the search field. No network request is
 * made while typing; the selected canonical query is sent to Visual Crossing
 * only after the user chooses a result or submits the form.
 */
export function suggestLocations(
  input,
  { limit = 6, locations = WORLD_LOCATIONS } = {},
) {
  const value = typeof input === "string" ? input.trim() : "";
  if (fold(value).length < 2 || !Number.isInteger(limit) || limit < 1)
    return [];
  return locations
    .map((location, index) => ({
      ...location,
      _index: index,
      _score: locationScore(location, value),
    }))
    .filter((location) => location._score !== null)
    .sort((a, b) => a._score - b._score || a._index - b._index)
    .slice(0, limit)
    .map(({ city, region, country, query }) => ({
      city,
      region,
      country,
      query,
    }));
}

export function locationMatchText(location) {
  return [location.region, location.country].filter(Boolean).join(" · ");
}
