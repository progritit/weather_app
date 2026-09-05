// Fixed fixtures only: no live readings or network requests.
export const locations = {
  salvador: {
    name: "Salvador",
    region: "Bahia, Brazil",
    timezone: "America/Bahia",
    landscape: "coastal",
    base: 28,
    sunrise: "05:35",
    sunset: "17:31",
  },
  paris: {
    name: "Paris",
    region: "Île-de-France, France",
    timezone: "Europe/Paris",
    landscape: "urban",
    base: 22,
    sunrise: "07:14",
    sunset: "20:24",
  },
};
export const conditions = {
  clear: "Clear skies",
  "partly-cloudy": "Partly cloudy",
  overcast: "Overcast",
  rain: "Rain",
  thunderstorm: "Thunderstorms",
  snow: "Snow",
  fog: "Fog",
};
export function getMockWeather(locationId, condition, phase) {
  const location = locations[locationId];
  const wet = ["rain", "thunderstorm"].includes(condition);
  const temperature =
    condition === "snow"
      ? 1
      : location.base - (wet ? 3 : 0) - (phase === "night" ? 4 : 0);
  const start = phase === "night" ? 20 : 10;
  const hourly = Array.from({ length: 24 }, (_, index) => {
    const hour = (start + index) % 24;
    return {
      hour,
      label: index === 0 ? "Now" : `${String(hour).padStart(2, "0")}:00`,
      temperature: Math.round(temperature + 2 * Math.sin(index / 3)),
      rain:
        condition === "snow"
          ? 60
          : wet
            ? 65 + (index % 4) * 8
            : 5 + (index % 3) * 5,
      condition,
      phase: hour >= 6 && hour < 18 ? "day" : "night",
    };
  });
  const daily = [
    condition,
    "partly-cloudy",
    "rain",
    "rain",
    "overcast",
    "clear",
    "partly-cloudy",
  ].map((weather, index) => ({
    index,
    date: new Date(Date.UTC(2026, 8, 5 + index, 12)),
    condition: weather,
    high:
      index === 0
        ? temperature + 2
        : location.base + [0, 1, -2, -1, 0, 2, 1][index],
    low: index === 0 ? temperature - 3 : location.base - 5,
    rain: ["rain", "thunderstorm"].includes(weather)
      ? 80
      : weather === "snow"
        ? 60
        : 10,
  }));
  return {
    location,
    temperature,
    condition,
    phase,
    hourly,
    daily,
    feelsLike: temperature + 2,
    humidity: wet ? 89 : 72,
    wind: wet ? 22 : 14,
    gusts: wet ? 36 : 23,
    uv: phase === "night" ? 0 : wet ? 3 : 7,
    visibility: condition === "fog" ? 0.4 : wet ? 6 : 16,
    pressure: wet ? 1007 : 1014,
    precipitation: wet ? 4.2 : condition === "snow" ? 1.5 : 0,
    time: phase === "night" ? "20:42" : "10:42",
    updated: phase === "night" ? "20:40" : "10:40",
  };
}
