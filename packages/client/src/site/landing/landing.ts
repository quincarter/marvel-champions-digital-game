/**
 * The landing page at the new domain's top level (`site/landing/index.html`): what the game is, what's new, the
 * heroes and mods it offers, downloads, the community and credits. Release feed, screenshots and mods come from the
 * build (`virtual:landing-data`), so every deploy from `main` brings the page up to date; the mod list and the
 * downloads are also refreshed live.
 */
import type { PackIndexEntry } from "@mc/content";
import { BUILT_AT, MODS, RELEASES, SCREENSHOTS, type FeedRelease, type StoreMod } from "virtual:landing-data";
import { BUILT_RELEASE } from "virtual:site-release";
import { browserDevice, fetchLatestRelease, versionOf, type LatestRelease } from "../downloads.js";
import { browserLanguage, type PageLanguage } from "../page-language.js";
import { applyText, element, mountLanguageToggle, renderDownloads, translator, type Translate } from "../site-dom.js";
import { SHARED_TEXT } from "../site-text.js";
import {
  GAME_DISCORD_URL,
  GAME_URL,
  HALL_OF_HEROES_URL,
  HOMEBREW_DISCORD_EN_URL,
  HOMEBREW_DISCORD_ES_URL,
  ISSUES_URL,
  LATEST_RELEASE_API,
  MARVELCDB_URL,
  PACK_CATALOG_URL,
  PROXY_NEXUS_URL,
  REPO_URL,
} from "../site-urls.js";
import { GAME_ROSTER } from "./game-roster.js";
import { LANDING_TEXT } from "./landing-text.js";

const $ = <T extends HTMLElement = HTMLElement>(id: string): T => document.getElementById(id) as T;

const ADDRESSES = {
  game: GAME_URL,
  releases: `${GAME_URL}releases/`,
  discord: GAME_DISCORD_URL,
  homebrewEn: HOMEBREW_DISCORD_EN_URL,
  homebrewEs: HOMEBREW_DISCORD_ES_URL,
  issues: ISSUES_URL,
  repo: REPO_URL,
  proxyNexus: PROXY_NEXUS_URL,
  marvelcdb: MARVELCDB_URL,
  hallOfHeroes: HALL_OF_HEROES_URL,
};

const PLATFORM_COUNT = 5;

let language: PageLanguage = browserLanguage();
let t: Translate = textFor(language);
// The build's copy until GitHub answers, so the buttons show at once and survive GitHub's rate limit.
let release: LatestRelease | null | "loading" = BUILT_RELEASE ?? "loading";
let mods: readonly StoreMod[] = MODS;
const device = browserDevice();

function textFor(lang: PageLanguage): Translate {
  return translator(LANDING_TEXT[lang], SHARED_TEXT[lang]);
}

function formatDate(date: string): string {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString(language, {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}

function releaseUrl(entry: FeedRelease): string {
  return entry.report
    ? `${GAME_URL}releases/${entry.version}/${entry.reportFile}`
    : `${GAME_URL}releases/?lang=${language}#${entry.version}`;
}

function feed(): readonly FeedRelease[] {
  return RELEASES[language].length > 0 ? RELEASES[language] : RELEASES.en;
}

/** The version the page names as latest: GitHub's, once known, else the newest the build knows. */
function latestVersion(): string {
  if (release !== "loading" && release !== null) return versionOf(release);
  return feed()[0]?.version.replace(/^v/, "") ?? "";
}

function drawNumbers(): void {
  const tiles: [string, number][] = [
    ["heroes", GAME_ROSTER.heroCount],
    ["scenarios", GAME_ROSTER.scenarioCount],
    ["mods", mods.length],
    ["platforms", PLATFORM_COUNT],
  ];
  $("numbers").replaceChildren(
    ...tiles.map(([key, n], i) =>
      element(
        "div",
        { class: i === 0 ? "tile big" : "tile" },
        element("h4", {}, t(`num.${key}`)),
        element("div", { class: `n${i === 0 ? "" : ` c${i}`}` }, String(n)),
        element("p", {}, t(`num.${key}.p`)),
      ),
    ),
  );
}

function drawWhatsNew(): void {
  const [latest, ...rest] = feed();
  if (!latest) return;
  $("new-latest").replaceChildren(
    element("div", { class: "eb" }, `${latest.version} · ${t("new.released", { date: formatDate(latest.date) })}`),
    element("h3", {}, latest.title),
    element("p", { html: latest.summaryHtml }),
    element(
      "a",
      { class: "btn primary", href: releaseUrl(latest) },
      t(latest.report ? "new.report" : "new.notes"),
      " ↗",
    ),
  );
  $("feed-list").replaceChildren(
    ...rest.map((entry) =>
      element(
        "li",
        {},
        element(
          "a",
          { href: releaseUrl(entry) },
          element("span", { class: "v" }, entry.version),
          element("span", { class: "d" }, formatDate(entry.date)),
          element("span", { class: "tt" }, entry.title),
        ),
      ),
    ),
  );
}

function drawScreenshots(): void {
  $("shots").replaceChildren(
    ...SCREENSHOTS.map((shot) =>
      element(
        "figure",
        { class: "a" },
        element(
          "a",
          { href: shot.src, target: "_blank", rel: "noopener" },
          element("img", { src: shot.src, alt: shot.alt[language], loading: "lazy", decoding: "async" }),
        ),
        element("figcaption", {}, `${shot.version} · ${shot.caption[language]}`),
      ),
    ),
  );
}

function drawHeroes(): void {
  $("heroes").replaceChildren(
    ...GAME_ROSTER.waves.map((wave) =>
      element(
        "div",
        { class: "wave" },
        element("h3", {}, wave.name),
        element(
          "ul",
          {},
          ...wave.heroes.map((hero) =>
            element(
              "li",
              {},
              element("span", { class: "hero" }, hero.name),
              ...hero.aspects.map((aspect) =>
                element("span", { class: `aspect a-${aspect}`, title: t(`aspect.${aspect}`) }, t(`aspect.${aspect}`)),
              ),
            ),
          ),
        ),
      ),
    ),
  );
}

/** A mod's store thumbnail, or a plain tile where it has none or it fails to load. */
function thumbnailOf(mod: StoreMod): HTMLElement {
  if (!mod.thumbnail) return element("div", { class: "thumb" });
  const img = element("img", {
    src: mod.thumbnail,
    alt: "",
    loading: "lazy",
    decoding: "async",
    width: "96",
    height: "96",
  });
  img.addEventListener("error", () => img.replaceWith(element("div", { class: "thumb" })), { once: true });
  return img;
}

function drawMods(): void {
  const list = $("mods");
  if (mods.length === 0) {
    list.replaceChildren(element("p", { class: "lead" }, t("mods.empty")));
    return;
  }
  const sorted = [...mods].sort((a, b) => a.kind.localeCompare(b.kind) || a.name.localeCompare(b.name));
  list.replaceChildren(
    ...sorted.map((mod) =>
      element(
        "article",
        { class: "mod" },
        thumbnailOf(mod),
        element(
          "div",
          {},
          element("div", { class: "eb" }, t(`mods.kind.${mod.kind}`), ` · v${mod.latest}`),
          element("h3", {}, mod.name),
          element("div", { class: "by" }, t("mods.by", { creator: mod.creator })),
          element("p", {}, mod.summary),
        ),
      ),
    ),
  );
}

function drawCredits(): void {
  const creators = [...new Set(mods.map((mod) => mod.creator))].sort((a, b) => a.localeCompare(b));
  $("credit-mods").replaceChildren(...creators.map((name) => element("li", {}, name)));
  $("credit-decks").replaceChildren(...GAME_ROSTER.deckAuthors.map((name) => element("li", {}, name)));
}

function drawHomebrew(): void {
  // The Spanish community's server first for a Spanish reader.
  const en = $("homebrew-en");
  const es = $("homebrew-es");
  const box = en.parentElement!;
  if (language === "es") box.insertBefore(es, en);
  else box.insertBefore(en, es);
}

function draw(): void {
  document.documentElement.lang = language;
  document.title = t("meta.title");
  const tt: Translate = (key, params) =>
    t(key, {
      ...ADDRESSES,
      version: latestVersion(),
      heroes: GAME_ROSTER.heroCount,
      scenarios: GAME_ROSTER.scenarioCount,
      ...params,
    });
  applyText(document, tt);
  $("ai-note").hidden = t("lang.aiNote") === "";
  mountLanguageToggle($("language"), language, t("lang.label"), (next) => {
    language = next;
    t = textFor(next);
    draw();
  });
  for (const link of document.querySelectorAll<HTMLAnchorElement>("[data-href]")) {
    link.href = ADDRESSES[link.dataset.href as keyof typeof ADDRESSES];
  }
  drawNumbers();
  drawWhatsNew();
  drawScreenshots();
  drawHeroes();
  drawMods();
  drawCredits();
  drawHomebrew();
  renderDownloads($("downloads"), { release, device, language, gameUrl: GAME_URL }, t);
  $("built").textContent = BUILT_AT.slice(0, 10);
}

draw();

void fetchLatestRelease(LATEST_RELEASE_API).then((latest) => {
  release = latest ?? BUILT_RELEASE;
  draw();
});

// The live catalog, where the store's CORS lets this origin read it; the build's copy stays otherwise.
void fetch(PACK_CATALOG_URL, { signal: AbortSignal.timeout(6000) })
  .then((response) => (response.ok ? (response.json() as Promise<{ packs?: PackIndexEntry[] }>) : null))
  .then((data) => {
    const live = data?.packs?.filter((pack) => !pack.withdrawn);
    if (live && live.length > 0) {
      mods = live;
      draw();
    }
  })
  .catch(() => {
    // Out of reach or not allowed: the build's list stands.
  });
