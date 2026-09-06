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

export function locationKey(query) {
  return typeof query === "string"
    ? `place:${query.toLowerCase()}`
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
