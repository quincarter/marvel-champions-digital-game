/**
 * The top bar every page on the landing site shares (the landing page, the download stats page, the release history
 * and each release report): the game's name back to the landing page, the nav (Home, Download stats, Releases), the
 * English/Español toggle, and Steam, Download and Play now. It is plain HTML, written into each page at build time
 * (`vite.site.config.ts`), so it works before any script runs and on the release pages, which are static files.
 *
 * Every label is written once per page language, and `site/shared/site-nav.css` shows the one that matches the page's
 * `<html lang>`: the landing and stats pages and the release history set it when the reader switches language, and a
 * report's Spanish copy (`index.es.html`) is written with `lang="es"`. So one copy of the markup serves every page in
 * every language.
 *
 * The toggle is a group of buttons a page's own script wires up (`mountLanguageToggle` on the landing and stats pages,
 * `history.js` on the release history), except on a release report, where each language is a page of its own and the
 * toggle links to it. The Steam button stays hidden until a script finds an Install for Steam script for the reader's
 * computer in the latest release (`site-bar.ts`).
 */
import { LANGUAGE_NAMES, PAGE_LANGUAGES, type PageLanguage } from "./page-language.js";
import { GAME_URL } from "./site-urls.js";

export type SitePage = "home" | "stats" | "releases";

const PAGES: readonly SitePage[] = ["home", "stats", "releases"];

/** Where each page lives on the landing site's domain. */
export const SITE_PATHS: Readonly<Record<SitePage, string>> = {
  home: "/",
  stats: "/stats/",
  releases: "/releases/",
};

type NavKey = SitePage | "label" | "brand" | "language" | "steam" | "download" | "play";

export const NAV_TEXT: Readonly<Record<PageLanguage, Readonly<Record<NavKey, string>>>> = {
  en: {
    home: "Home",
    stats: "Download stats",
    releases: "Releases",
    label: "Site",
    brand: "Digital Edition",
    language: "Language",
    steam: "Steam",
    download: "Download",
    play: "Play now",
  },
  es: {
    home: "Inicio",
    stats: "Descargas",
    releases: "Novedades",
    label: "Sitio",
    brand: "Digital Edition",
    language: "Idioma",
    steam: "Steam",
    download: "Descargar",
    play: "Jugar",
  },
};

/** Where the bar's Steam logo lives: the landing build copies it to the site's root. */
export const STEAM_LOGO_PATH = "/steam-logo.svg";

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

/** A release report's own pages, one per language it has, for the toggle to link to. */
export interface LanguageLinks {
  readonly current: PageLanguage;
  readonly hrefs: Readonly<Record<PageLanguage, string>>;
}

/** A language's name, with its code standing in where a narrow bar has no room (site-nav.css, `.code`). */
function languageLabel(language: PageLanguage): string {
  return (
    `<span class="name">${LANGUAGE_NAMES[language]}</span>` +
    `<span class="code" aria-hidden="true">${language.toUpperCase()}</span>`
  );
}

/**
 * The toggle: buttons a page's script wires up (the first language pressed until it does), or, for a release report,
 * links to the report's page in each language.
 */
function languageToggle(links: LanguageLinks | undefined): string {
  const items = PAGE_LANGUAGES.map((language) => {
    const name = `lang="${language}" aria-label="${LANGUAGE_NAMES[language]}"`;
    if (links) {
      const here = language === links.current ? ' aria-current="true"' : "";
      return `<a href="${links.hrefs[language]}" hreflang="${language}" ${name}${here}>${languageLabel(language)}</a>`;
    }
    const pressed = language === PAGE_LANGUAGES[0];
    return `<button type="button" data-language="${language}" ${name} aria-pressed="${pressed}">${languageLabel(language)}</button>`;
  });
  const id = links ? "" : ' id="language"';
  return `<div class="site-lang"${id} role="group" aria-label="${NAV_TEXT.en.language}">${items.join("")}</div>`;
}

export interface SiteBarOptions {
  /** Keeps the bar at the top while the page scrolls. */
  readonly pinned: boolean;
  /** For a release report: its page in each language. Without it the toggle is buttons for the page's script. */
  readonly languages?: LanguageLinks;
}

/**
 * The bar, with `page` marked in the nav. `data-history-link` makes the release history drop it when it shows a report
 * inside its own page (`public/releases/history.js`), which has the bar already.
 */
export function siteBar(page: SitePage | null, { pinned, languages }: SiteBarOptions): string {
  const download = page === "home" ? "#download" : `${SITE_PATHS.home}#download`;
  return (
    `<header class="site-bar${pinned ? " pinned" : ""}" data-history-link>` +
    `<a class="site-brand" href="${page === "home" ? "#top" : SITE_PATHS.home}" aria-label="Marvel Champions: Digital Edition">` +
    `<b>Marvel Champions</b>${inEveryLanguage("brand")}</a>` +
    siteNavLinks(page) +
    languageToggle(languages) +
    `<a class="site-btn steam" id="bar-steam" rel="noopener" hidden>` +
    `<img class="steam-logo" src="${STEAM_LOGO_PATH}" alt="" width="22" height="22" />${inEveryLanguage("steam")}</a>` +
    `<a class="site-btn gold" href="${download}">${inEveryLanguage("download")}</a>` +
    `<a class="site-btn play" href="${GAME_URL}">${inEveryLanguage("play")}</a>` +
    `</header>`
  );
}

/** Where the release pages find the bar's stylesheet: the landing build copies it to the site's root. */
export const SITE_NAV_STYLESHEET = "/site-nav.css";
/** The script that shows the bar's Steam button on the release pages, built beside the landing page. */
export const SITE_BAR_SCRIPT = "/site-bar.js";
/** The art behind the top of the release pages, written to the site's root by the landing build. */
export const SITE_BACKDROP = { wide: "/site-backdrop.webp", tall: "/site-backdrop-tall.webp" } as const;

export interface ReleaseBarOptions extends SiteBarOptions {
  /** The release history page itself: its own toggle moves into the bar. */
  readonly history?: boolean;
}

/**
 * The art behind the top of a release page: a picture faded into the page (site-nav.css, `.site-backdrop`). Like the
 * bar, the release history drops it from a report it shows inside its own page, which has the art already.
 */
function backdrop(): string {
  return (
    `<picture class="site-backdrop" aria-hidden="true" data-history-link>` +
    `<source media="(max-aspect-ratio: 3/4)" srcset="${SITE_BACKDROP.tall}" />` +
    `<img src="${SITE_BACKDROP.wide}" alt="" fetchpriority="high" /></picture>`
  );
}

/**
 * `html` (a release page) with the bar's stylesheet in its head, the bar at the top of its body, after a "skip to the
 * content" link if the page opens with one (the history page does), so that link stays the first stop for a keyboard,
 * the art behind the page's top, and the script that shows the bar's Steam button at the end. On the history page the bar's toggle takes the place
 * of the one the page draws over its content (`history.js` finds it by its id). A page that has the bar already is
 * left as it is, so the step can run twice.
 */
export function withReleaseBar(html: string, options: ReleaseBarOptions): string {
  if (html.includes('class="site-bar')) return html;
  const page = (
    options.history ? html.replace(/\s*<div class="language" id="language"[^>]*>[\s\S]*?<\/div>/, "") : html
  ).replace(/<body/, '<body class="has-backdrop"');
  const top = `${backdrop()}\n    ${siteBar("releases", options)}`;
  return page
    .replace(/<\/head>/, `<link rel="stylesheet" href="${SITE_NAV_STYLESHEET}" />\n  </head>`)
    .replace(/<body[^>]*>(\s*<a class="skip"[^>]*>[^<]*<\/a>)?/, (start) => `${start}\n    ${top}`)
    .replace(/<\/body>/, `<script type="module" src="${SITE_BAR_SCRIPT}"></script>\n  </body>`);
}
