import { describe, expect, it } from "vitest";
import { releaseBar, siteNavLinks, withReleaseBar, SITE_NAV_STYLESHEET } from "./site-nav.js";

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

describe("withReleaseBar", () => {
  const report = `<html lang="es"><head><title>v1</title></head><body>\n<div class="wrap">Report</div></body></html>`;

  it("adds the stylesheet and a bar the release history strips from its copy of the report", () => {
    const html = withReleaseBar(report, true);
    expect(html).toContain(`<link rel="stylesheet" href="${SITE_NAV_STYLESHEET}" />`);
    expect(html).toMatch(/<body>\s*<header class="site-top pinned" data-history-link>/);
    expect(html).toContain('aria-current="page"');
    expect(html.indexOf("site-top")).toBeLessThan(html.indexOf("Report"));
  });

  it("keeps the history page's skip link first", () => {
    const history = `<head></head><body>\n    <a class="skip" id="skip" href="#content">Skip to the release</a>\n<div class="layout"></div></body>`;
    const html = withReleaseBar(history, false);
    expect(html.indexOf('class="skip"')).toBeLessThan(html.indexOf("site-top"));
    expect(html).toContain('<header class="site-top" data-history-link>');
  });

  it("runs twice without a second bar", () => {
    const once = withReleaseBar(report, true);
    expect(withReleaseBar(once, true)).toBe(once);
    expect(releaseBar(false)).not.toContain("pinned");
  });
});
