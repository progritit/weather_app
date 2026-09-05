import "./styles.css";

const heading = document.querySelector("h1");
const status = document.querySelector("[data-status]");

if (!heading || !status) {
  throw new Error("The starter interface is missing required HTML elements.");
}

heading.textContent = "Webpack starter is working";
status.textContent = "Development environment ready";
status.classList.add("status--ready");
