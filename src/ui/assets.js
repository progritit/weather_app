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
  const prefix =
    landscape === "coastal"
      ? "./weather/weather"
      : `./${landscape}/weather-${landscape}`;

  return heroes(`${prefix}-${condition}-${phase}.webp`);
}
export function weatherIcon(condition, phase = "day") {
  const name = ["clear", "partly-cloudy"].includes(condition)
    ? `${condition}-${phase}`
    : condition;
  return `<img class="weather-icon" src="${icons(`./${name}.svg`)}" alt="" width="36" height="36" />`;
}
