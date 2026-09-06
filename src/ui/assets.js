// Bounded build-time contexts; plain JSON filenames do not bundle images.
const heroes = import.meta.webpackContext("../../assets/images", {
  recursive: true,
  regExp: /\.webp$/,
});
const icons = import.meta.webpackContext("../../assets/icons/weather", {
  recursive: false,
  regExp: /\.svg$/,
});
export function heroImage(condition, phase, landscape) {
  if (!["day", "night"].includes(phase)) return null;
  const scene = ["urban", "countryside", "coastal"].includes(landscape)
    ? landscape
    : "urban";
  const weather = condition === "sleet" ? "snow" : condition;
  const prefix = scene === "coastal" ? "weather" : `weather-${scene}`;
  const filename = `${prefix}-${weather}-${phase}.webp`;
  // Resolve by filename: supports sibling weather/urban/countryside folders and the earlier nested layout.
  const key = heroes.keys().find((path) => path.split("/").at(-1) === filename);
  return key ? heroes(key) : null;
}
export function weatherIcon(condition, phase = "day") {
  const name = ["clear", "partly-cloudy"].includes(condition)
    ? `${condition}-${phase}`
    : condition;
  const key = icons.keys().includes(`./${name}.svg`)
    ? `./${name}.svg`
    : "./unknown.svg";
  return `<img class="weather-icon" src="${icons(key)}" alt="" width="36" height="36" />`;
}
