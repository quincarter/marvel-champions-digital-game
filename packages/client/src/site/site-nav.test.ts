import { describe, expect, it } from "vitest";
import {
  SITE_BACKDROP,
  SITE_BAR_SCRIPT,
  SITE_NAV_STYLESHEET,
  siteBar,
  siteNavLinks,
  STEAM_LOGO_PATH,
  withReleaseBar,
} from "./site-nav.js";
import { GAME_URL } from "./site-urls.js";

describe("siteNavLinks", () => {
  it("links Home, Download stats and Releases in every page language, marking the current page", () => {
    const html = siteNavLinks("stats");
    expect(html.match(/<a /g)).toHaveLength(3);
    expect(html).toContain('href="/" data-page="home">');
    expect(html).toContain('href="/stats/" data-page="stats" aria-current="page">');
    expect(html).toContain('href="/releases/" data-page="releases">');
    expect(html).toContain('<span lang="en">Download stats</span><span lang="es">Descargas</span>');
    expect(html).toContain('<span lang="en">Releases</span><span lang="es">Novedades</span>');
  });

  it("marks no page on a page outside the three", () => {
    expect(siteNavLinks(null)).not.toContain("aria-current");
  });
});

describe("siteBar", () => {
  it("carries the name, the nav, the language toggle, Steam, Download and Play now on every page", () => {
    for (const page of ["home", "stats", "releases"] as const) {
      const html = siteBar(page, { pinned: true });
      expect(html).toMatch(/^<header class="site-bar pinned"/);
      expect(html).toContain('class="site-brand"');
      expect(html).toContain(`data-page="${page}" aria-current="page"`);
      expect(html).toContain('<div class="site-lang" id="language" role="group" aria-label="Language">');
      expect(html).toContain('id="bar-steam" rel="noopener" hidden>');
      expect(html).toContain(`src="${STEAM_LOGO_PATH}"`);
      expect(html).toContain('<span lang="en">Download</span><span lang="es">Descargar</span>');
      expect(html).toContain(
        `<a class="site-btn play" href="${GAME_URL}"><span lang="en">Play now</span><span lang="es">Jugar</span></a>`,
      );
    }
  });

  it("offers English and Español as buttons for the page's script, English pressed until it runs", () => {
    const html = siteBar("stats", { pinned: true });
    expect(html).toContain(
      '<button type="button" data-language="en" lang="en" aria-label="English" aria-pressed="true">',
    );
    expect(html).toContain(
      '<button type="button" data-language="es" lang="es" aria-label="Español" aria-pressed="false">',
    );
    expect(html).toContain('<span class="code" aria-hidden="true">ES</span>');
  });

  it("points the name and Download at the landing page, or within it on the landing page itself", () => {
    expect(siteBar("home", { pinned: true })).toContain('class="site-brand" href="#top"');
    expect(siteBar("home", { pinned: true })).toContain('class="site-btn gold" href="#download"');
    expect(siteBar("stats", { pinned: true })).toContain('class="site-brand" href="/"');
    expect(siteBar("stats", { pinned: true })).toContain('class="site-btn gold" href="/#download"');
  });

  it("links a report's toggle to its page in each language, marking the one open", () => {
    const html = siteBar("releases", {
      pinned: true,
      languages: { current: "es", hrefs: { en: "index.html", es: "index.es.html" } },
    });
    expect(html).not.toContain("<button");
    expect(html).not.toContain('id="language"');
    expect(html).toContain('<a href="index.html" hreflang="en" lang="en" aria-label="English">');
    expect(html).toContain('<a href="index.es.html" hreflang="es" lang="es" aria-label="Español" aria-current="true">');
  });
});

describe("withReleaseBar", () => {
  const report = `<html lang="es"><head><title>v1</title></head><body>\n<div class="wrap">Report</div></body></html>`;
  const languages = { current: "es", hrefs: { en: "index.html", es: "index.es.html" } } as const;

  it("adds the stylesheet, art and a bar the release history strips from its copy of the report, and the script", () => {
    const html = withReleaseBar(report, { pinned: true, languages });
    expect(html).toContain(`<link rel="stylesheet" href="${SITE_NAV_STYLESHEET}" />`);
    expect(html).toMatch(/<body class="has-backdrop">\s*<picture class="site-backdrop"[^>]*data-history-link>/);
    expect(html).toMatch(/<\/picture>\s*<header class="site-bar pinned" data-history-link>/);
    expect(html).toContain('aria-current="page"');
    expect(html).toContain(`<script type="module" src="${SITE_BAR_SCRIPT}"></script>`);
    expect(html.indexOf("site-bar")).toBeLessThan(html.indexOf("Report"));
    // The art goes behind the report's top too; the history drops it with the bar from its copy of the report.
    expect(html).toContain('<body class="has-backdrop">');
    expect(html).toContain('<picture class="site-backdrop" aria-hidden="true" data-history-link>');
  });

  const history =
    `<head></head><body>\n    <a class="skip" id="skip" href="#content">Skip to the release</a>\n<div class="layout">` +
    `<div class="bar">x</div>\n        <div class="language" id="language" role="group" aria-label="Language">\n` +
    `          <button type="button" data-language="en" lang="en" aria-pressed="true">English</button>\n` +
    `          <button type="button" data-language="es" lang="es" aria-pressed="false">Español</button>\n` +
    `        </div>\n<main id="content"></main></div></body>`;

  it("moves the history page's toggle into the bar, keeps its skip link first and puts the art behind its top", () => {
    const html = withReleaseBar(history, { pinned: false, history: true });
    expect(html.indexOf('class="skip"')).toBeLessThan(html.indexOf("site-bar"));
    expect(html).toContain('<header class="site-bar" data-history-link>');
    expect(html).not.toContain('class="language"');
    expect(html.match(/id="language"/g)).toHaveLength(1);
    expect(html).toContain('<div class="site-lang" id="language"');
    expect(html).toContain('<body class="has-backdrop">');
    expect(html).toContain(`<img src="${SITE_BACKDROP.wide}"`);
    expect(html.indexOf("site-backdrop")).toBeLessThan(html.indexOf("site-bar"));
  });

  it("runs twice without a second bar", () => {
    const once = withReleaseBar(report, { pinned: true, languages });
    expect(withReleaseBar(once, { pinned: true, languages })).toBe(once);
    expect(siteBar("releases", { pinned: false })).not.toContain("pinned");
  });
});
