/**
 * The top nav every page on the landing site shares (the landing page, the download stats page, the release history
 * and each release report): Home, Download stats and Releases. It is plain HTML, written into each page at build time
 * (`vite.site.config.ts`), so it works before any script runs and on the release pages, which are static files.
 *
 * Every label is written once per page language, and `site/shared/site-nav.css` shows the one that matches the page's
 * `<html lang>`: the landing and stats pages and the release history set it when the reader switches language, and a
 * report's Spanish copy (`index.es.html`) is written with `lang="es"`. So one copy of the markup serves every page in
 * every language.
 */
import { PAGE_LANGUAGES, type PageLanguage } from "./page-language.js";

export type SitePage = "home" | "stats" | "releases";

const PAGES: readonly SitePage[] = ["home", "stats", "releases"];

/** Where each page lives on the landing site's domain. */
export const SITE_PATHS: Readonly<Record<SitePage, string>> = {
  home: "/",
  stats: "/stats/",
  releases: "/releases/",
};

type NavKey = SitePage | "label" | "brand";

export const NAV_TEXT: Readonly<Record<PageLanguage, Readonly<Record<NavKey, string>>>> = {
  en: { home: "Home", stats: "Download stats", releases: "Releases", label: "Site", brand: "Digital Edition" },
  es: { home: "Inicio", stats: "Descargas", releases: "Novedades", label: "Sitio", brand: "Digital Edition" },
};

/** One `<span lang>` per page language; the stylesheet shows the page's own. */
function inEveryLanguage(key: NavKey): string {
  return PAGE_LANGUAGES.map((language) => `<span lang="${language}">${NAV_TEXT[language][key]}</span>`).join("");
}

/** The nav's links, with `current` marked as the page the reader is on. */
export function siteNavLinks(current: SitePage | null): string {
  const links = PAGES.map((page) => {
    const here = page === current ? ' aria-current="page"' : "";
    return `<a href="${SITE_PATHS[page]}" data-page="${page}"${here}>${inEveryLanguage(page)}</a>`;
  });
  // The nav's own accessible name can't switch language with CSS; English names it, as the release pages' own bars do.
  return `<nav class="site-nav" aria-label="${NAV_TEXT.en.label}">${links.join("")}</nav>`;
}

/**
 * The bar a release page gets: the game's name back to the landing page, and the nav. `data-history-link` makes the
 * release history drop it when it shows a report inside its own page (`public/releases/history.js`), which has a bar
 * of its own. `pinned` keeps it at the top while the page scrolls; the history page's own rail and bar pin to the top
 * already, so it has it scroll away instead.
 */
export function releaseBar(pinned: boolean): string {
  return (
    `<header class="site-top${pinned ? " pinned" : ""}" data-history-link>` +
    `<a class="site-brand" href="${SITE_PATHS.home}"><b>Marvel Champions</b>${inEveryLanguage("brand")}</a>` +
    siteNavLinks("releases") +
    `</header>`
  );
}

/** Where the release pages find the nav's stylesheet: the landing build copies it to the site's root. */
export const SITE_NAV_STYLESHEET = "/site-nav.css";

/**
 * `html` (a release page) with the nav's stylesheet in its head and the bar at the top of its body, after a "skip to
 * the content" link if the page opens with one (the history page does), so that link stays the first stop for a
 * keyboard. A page that has the bar already is left as it is, so the step can run twice.
 */
export function withReleaseBar(html: string, pinned: boolean): string {
  if (html.includes('class="site-top')) return html;
  return html
    .replace(/<\/head>/, `<link rel="stylesheet" href="${SITE_NAV_STYLESHEET}" />\n  </head>`)
    .replace(/<body[^>]*>(\s*<a class="skip"[^>]*>[^<]*<\/a>)?/, (top) => `${top}\n    ${releaseBar(pinned)}`);
}
