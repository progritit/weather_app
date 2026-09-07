import mark from "../../assets/branding/solaris-mark.svg";
import "./footer.css";

/*!
 * Social icons: Bootstrap Icons, https://icons.getbootstrap.com/.
 * The MIT License (MIT)
 * Copyright (c) 2019-2024 The Bootstrap Authors
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 */

const CREATION_YEAR = 2026;

const SOCIAL_LINKS = [
  {
    name: "GitHub",
    href: "https://github.com/progritit",
    path: "M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8",
  },
  {
    name: "LinkedIn",
    href: "https://www.linkedin.com/in/clebsoncosta/",
    path: "M0 1.146C0 .513.526 0 1.175 0h13.65C15.474 0 16 .513 16 1.146v13.708c0 .633-.526 1.146-1.175 1.146H1.175C.526 16 0 15.487 0 14.854zm4.943 12.248V6.169H2.542v7.225zm-1.2-8.212c.837 0 1.358-.554 1.358-1.248-.015-.709-.52-1.248-1.342-1.248S2.4 3.226 2.4 3.934c0 .694.521 1.248 1.327 1.248zm4.908 8.212V9.359c0-.216.016-.432.08-.586.173-.431.568-.878 1.232-.878.869 0 1.216.662 1.216 1.634v3.865h2.401V9.25c0-2.22-1.184-3.252-2.764-3.252-1.274 0-1.845.7-2.165 1.193v.025h-.016l.016-.025V6.169h-2.4c.03.678 0 7.225 0 7.225z",
  },
];

export function renderFooter() {
  const currentYear = new Date().getFullYear();
  const copyrightYears =
    currentYear === CREATION_YEAR
      ? String(CREATION_YEAR)
      : `${CREATION_YEAR}–${currentYear}`;

  return `<footer class="site-footer solaris-footer">
    <a class="footer-brand" href="#overview" aria-label="Solaris Atmosphere Scanner, back to overview">
      <img src="${mark}" width="32" height="32" alt="" />
      <span><strong>SOLARIS</strong><small>Atmosphere Scanner</small></span>
    </a>
    <p class="footer-source">
      <span>Weather data by</span>
      <a href="https://www.visualcrossing.com/weather-api/" target="_blank" rel="noopener noreferrer">
        Visual Crossing <span aria-hidden="true">↗</span>
        <span class="sr-only"> (opens in a new tab)</span>
      </a>
    </p>
    <div class="footer-author">
      <p class="footer-copyright">© ${copyrightYears} <span>Clebson Web Dev</span></p>
      <nav class="footer-socials" aria-label="Clebson Web Dev social profiles">
        ${SOCIAL_LINKS.map(
          ({
            name,
            href,
            path,
          }) => `<a class="footer-social" href="${href}" target="_blank" rel="noopener noreferrer">
            <svg width="18" height="18" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true" focusable="false"><path d="${path}" /></svg>
            <span>${name}</span><span class="sr-only"> (opens in a new tab)</span>
          </a>`,
        ).join("")}
      </nav>
    </div>
  </footer>`;
}