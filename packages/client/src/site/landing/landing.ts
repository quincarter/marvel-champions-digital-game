/**
 * The landing page at the new domain's top level (`site/landing/index.html`). It leads with the game's own art: a
 * title wallpaper behind the top, gameplay screenshots, every hero's portrait, the villains' artwork and the store's
 * mod covers, with Play now and Download pinned in the bar. Release feed, screenshots, art and mods come from the build
 * (`virtual:landing-data`), so every deploy from `main` brings the page up to date; the mod list and the downloads are
 * also refreshed live, each redrawing only its own part.
 */
import type { PackIndexEntry } from "@mc/content";
import {
  COMIC_PAGES,
  HERO_ART,
  MODS,
  RELEASES,
  SCREENSHOTS,
  VILLAIN_ART,
  WALLPAPERS,
  type FeedRelease,
  type StoreMod,
} from "virtual:landing-data";
import { BUILT_RELEASE } from "virtual:site-release";
import {
  browserDevice,
  downloadsOf,
  fetchLatestRelease,
  primaryDownload,
  versionOf,
  type LatestRelease,
} from "../downloads.js";
import { browserLanguage, type PageLanguage } from "../page-language.js";
import { applyText, element, mountLanguageToggle, renderDownloads, translator, type Translate } from "../site-dom.js";
import { fileKey, SHARED_TEXT } from "../site-text.js";
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
import { creatorsOf } from "./creators.js";
import { GAME_ROSTER } from "./game-roster.js";
import { LANDING_TEXT } from "./landing-text.js";
import { onScrollFrame, reducedMotion, revealOnScroll, scrollSteps, scrollTopForStep } from "./scroll-motion.js";
import boardShot from "../../../site/landing/showcase/board-play.jpg";
import scenarioShot from "../../../site/landing/showcase/scenario-select.jpg";
import seatsShot from "../../../site/landing/showcase/seats.jpg";
import setupShot from "../../../site/landing/showcase/setup-deal.jpg";
import batchArt from "../../../site/landing/showcase/custom-content-batch-1.jpg";

const $ = <T extends HTMLElement = HTMLElement>(id: string): T => document.getElementById(id) as T;

const ADDRESSES: Readonly<Record<string, string>> = {
  game: GAME_URL,
  // The release pages ship with this page (vite.site.config.ts copies public/releases), so they live on this domain.
  releases: "releases/",
  discord: GAME_DISCORD_URL,
  homebrewEn: HOMEBREW_DISCORD_EN_URL,
  homebrewEs: HOMEBREW_DISCORD_ES_URL,
  issues: ISSUES_URL,
  repo: REPO_URL,
  proxyNexus: PROXY_NEXUS_URL,
  marvelcdb: MARVELCDB_URL,
  hallOfHeroes: HALL_OF_HEROES_URL,
};

const ASPECTS = ["aggression", "justice", "leadership", "protection", "pool"] as const;
type AspectFilter = (typeof ASPECTS)[number] | "all";
const FILTERS: readonly AspectFilter[] = ["all", ...ASPECTS];
/** How many villains show before Show all. */
const VILLAINS_SHOWN = 12;

let language: PageLanguage = browserLanguage();
let t: Translate = textFor(language);
// The build's copy until GitHub answers, so the buttons show at once and survive GitHub's rate limit.
let release: LatestRelease | null | "loading" = BUILT_RELEASE ?? "loading";
let mods: readonly StoreMod[] = MODS;
let aspect: AspectFilter = "all";
let villainsOpen = false;
const device = browserDevice();
interface StageShot {
  readonly src: string;
  /** A landing text key, or the release report's own caption and alt text. */
  readonly caption: string | Readonly<Record<PageLanguage, string>>;
  readonly alt?: Readonly<Record<PageLanguage, string>>;
}

/**
 * The stage: the game's own screens first (taken from the game at 1600x1000 for this page, `site/landing/showcase/`),
 * then the newest release reports' desktop screenshots. Phone screenshots are framed for a tall screen; the stage is
 * wide.
 */
const shots: readonly StageShot[] = [
  { src: scenarioShot, caption: "shots.scenario" },
  { src: seatsShot, caption: "shots.seats" },
  { src: setupShot, caption: "shots.setup" },
  { src: boardShot, caption: "shots.board" },
  ...SCREENSHOTS.filter((s) => !/phone/i.test(s.src))
    .slice(0, 2)
    .map((s) => ({
      src: s.src,
      caption: { en: `${s.version} · ${s.caption.en}`, es: `${s.version} · ${s.caption.es}` },
      alt: s.alt,
    })),
];

const captionOf = (s: StageShot): string => (typeof s.caption === "string" ? t(s.caption) : s.caption[language]);

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
  return entry.report ? `releases/${entry.version}/${entry.reportFile}` : `releases/?lang=${language}#${entry.version}`;
}

function feed(): readonly FeedRelease[] {
  return RELEASES[language].length > 0 ? RELEASES[language] : RELEASES.en;
}

function drawArt(): void {
  const art = $("hero-art");
  if (art.childElementCount > 0 || !WALLPAPERS.wide) return;
  const sources: HTMLElement[] = [];
  if (WALLPAPERS.tall) sources.push(element("source", { media: "(max-aspect-ratio: 3/4)", srcset: WALLPAPERS.tall }));
  art.replaceChildren(...sources, element("img", { src: WALLPAPERS.wide, alt: "", fetchpriority: "high" }));
  for (const [i, src] of WALLPAPERS.bands.entries()) {
    const band = document.getElementById(`band-${i}`);
    if (band) band.style.backgroundImage = `url("${src}")`;
  }
}

/** The hero's second button: the visitor's installer, straight from the release, else the download section. */
function drawHeroDownload(): void {
  const ctas = $("hero-ctas");
  ctas.querySelector(".dl-cta")?.remove();
  const known = release !== "loading" && release !== null ? release : null;
  const primary = known ? primaryDownload(downloadsOf(known, language), device) : undefined;
  ctas.append(
    primary && known
      ? element(
          "a",
          { class: "btn gold big dl-cta", href: primary.url, rel: "noopener" },
          element("span", {}, t("dl.forDevice", { device: t(`device.${device}`) })),
          element("small", {}, `${t(fileKey(primary.id))} · v${versionOf(known)}`),
        )
      : element("a", { class: "btn gold big dl-cta", href: "#download" }, element("span", {}, t("bar.download"))),
  );
}

function drawStats(): void {
  const stats: [number, string][] = [
    [GAME_ROSTER.heroCount, t("stat.heroes")],
    [GAME_ROSTER.scenarioCount, t("stat.scenarios")],
    [mods.length, t("stat.mods")],
  ];
  $("stats").replaceChildren(
    ...stats.map(([n, label]) => element("li", {}, element("b", {}, String(n)), element("span", {}, label))),
    element("li", { class: "langs" }, element("span", {}, t("stat.languages"))),
  );
}

/** One step of a pinned section: a picture and its caption. */
interface PinnedStep {
  readonly src: string;
  readonly alt: string;
  readonly caption: string;
}

/**
 * A section that pins while the page scrolls through it (`.scrolly`): several screens tall, its frame sticky, each
 * step a layer in the frame, with numbered captions beside it that jump to their step. `ids` names its parts in the
 * page (`<prefix>-sec`, `-frame`, `-steps`, `-caption`, `-bar`). With `pan`, the picture in front also travels
 * across its own width or height as its step scrolls by, so a comic page reads panel by panel.
 */
function pinnedSection(prefix: string, pan: boolean) {
  const part = (name: string) => $(`${prefix}-${name}`);
  let steps: readonly PinnedStep[] = [];

  function draw(next: readonly PinnedStep[], pickLabel: (n: number) => string): void {
    steps = next;
    const section = part("sec");
    section.hidden = steps.length === 0;
    if (steps.length === 0) return;
    section.classList.toggle("static", reducedMotion());
    section.style.setProperty("--steps", String(steps.length));
    part("frame").replaceChildren(
      ...steps.map((s, i) =>
        element(
          "figure",
          { class: "layer" },
          element("img", { src: s.src, alt: s.alt, decoding: "async", ...(i > 0 ? { loading: "lazy" } : {}) }),
          element("figcaption", {}, s.caption),
        ),
      ),
    );
    part("steps").replaceChildren(
      ...steps.map((s, i) => {
        const button = element(
          "button",
          { type: "button", "aria-label": pickLabel(i + 1) },
          element("b", {}, String(i + 1).padStart(2, "0")),
          element("span", {}, s.caption),
        );
        button.addEventListener("click", () => {
          if (section.classList.contains("static")) return;
          const rect = section.getBoundingClientRect();
          scrollTo({
            top: scrollTopForStep(rect.top + scrollY, rect.height, innerHeight, steps.length, i),
            behavior: "smooth",
          });
        });
        return element("li", {}, button);
      }),
    );
    move();
  }

  /** Puts the scroll position's step in front: the one before slides up and away, the next waits below. */
  function move(): void {
    const section = part("sec");
    if (section.hidden || section.classList.contains("static") || steps.length === 0) return;
    const rect = section.getBoundingClientRect();
    const { index, within, progress } = scrollSteps(rect.top, rect.height, innerHeight, steps.length);
    for (const [i, layer] of [...part("frame").children].entries()) {
      const el = layer as HTMLElement;
      const offset = i - index;
      el.classList.toggle("on", offset === 0);
      el.style.setProperty("--o", offset === 0 ? "0" : offset < 0 ? "-1" : "1");
      // A comic page in front pans from its first panels to its last; the ones behind rest where they ended.
      if (pan) el.style.setProperty("--pan", `${Math.round((offset === 0 ? within : offset < 0 ? 1 : 0) * 100)}%`);
    }
    for (const [i, li] of [...part("steps").children].entries()) li.classList.toggle("on", i === index);
    part("bar").style.width = `${Math.round(progress * 100)}%`;
    const caption = part("caption");
    const text = steps[index]?.caption ?? "";
    if (caption.textContent !== text) caption.textContent = text;
  }

  return { draw, move };
}

const shotsSection = pinnedSection("scrolly", false);
const storySection = pinnedSection("story", true);

function drawShots(): void {
  shotsSection.draw(
    shots.map((s) => ({ src: s.src, alt: s.alt?.[language] ?? captionOf(s), caption: captionOf(s) })),
    (n) => t("shots.pick", { n }),
  );
}

/** The campaigns' comic pages, in story order, each with the beat it tells. */
function drawStory(): void {
  storySection.draw(
    COMIC_PAGES.map((page) => ({
      src: page.src,
      alt: t(`story.${page.key}.alt`),
      caption: t(`story.${page.key}`),
    })),
    (n) => t("story.pick", { n }),
  );
}
/** Wallpaper bands drift slower than the page, so they read as a window onto the art behind it. */
function moveBands(): void {
  if (reducedMotion()) return;
  for (const band of document.querySelectorAll<HTMLElement>(".art-band, .band-bg")) {
    const rect = band.getBoundingClientRect();
    if (rect.bottom < 0 || rect.top > innerHeight) continue;
    const t = (rect.top + rect.height / 2 - innerHeight / 2) / innerHeight;
    band.style.backgroundPositionY = `${50 + t * 30}%`;
  }
}
function drawHeroes(): void {
  $("heroes-title").textContent = t("heroes.title", { n: GAME_ROSTER.heroCount });
  const chips = $("aspect-chips");
  chips.replaceChildren(
    ...FILTERS.map((key, i) => {
      const chip = element(
        "button",
        { type: "button", class: `chip${key === "all" ? "" : ` a-${key}`}` },
        t(key === "all" ? "heroes.all" : `aspect.${key}`),
      );
      chip.setAttribute("aria-pressed", String(aspect === key));
      chip.addEventListener("click", () => {
        aspect = key;
        drawHeroes();
        chips.querySelectorAll("button")[i]?.focus();
      });
      return chip;
    }),
  );
  const heroes = GAME_ROSTER.waves.flatMap((wave) => wave.heroes.map((hero) => ({ ...hero, wave: wave.name })));
  $("portraits").replaceChildren(
    ...heroes
      .filter((hero) => aspect === "all" || hero.aspects.includes(aspect))
      .map((hero, i) => {
        const art = HERO_ART[hero.id];
        return element(
          "li",
          {
            class: `portrait reveal${art ? "" : " no-art"}`,
            title: `${hero.name} · ${hero.wave}`,
            style: `--i: ${i % 8}`,
          },
          art
            ? element("img", {
                src: art.src,
                alt: "",
                loading: "lazy",
                decoding: "async",
                style: `object-position: ${art.position}`,
              })
            : element("div", { class: "blank" }),
          element(
            "div",
            { class: "plate" },
            element("b", {}, hero.name),
            element(
              "span",
              { class: "bars" },
              ...hero.aspects.map((a) => element("i", { class: `a-${a}`, title: t(`aspect.${a}`) })),
            ),
          ),
        );
      }),
  );
}

function drawVillains(): void {
  const all = GAME_ROSTER.scenarios.filter((scenario) => VILLAIN_ART[scenario.id]);
  $("villains-title").textContent = t("villains.title", { n: GAME_ROSTER.scenarioCount });
  const shown = villainsOpen ? all : all.slice(0, VILLAINS_SHOWN);
  $("villain-list").replaceChildren(
    ...shown.map((scenario, i) =>
      element(
        "li",
        { class: "villain reveal", style: `--i: ${i % 4}` },
        element("img", { src: VILLAIN_ART[scenario.id]!, alt: "", loading: "lazy", decoding: "async" }),
        element("b", {}, scenario.name),
      ),
    ),
  );
  const more = $<HTMLButtonElement>("villains-more");
  more.hidden = all.length <= VILLAINS_SHOWN;
  more.textContent = villainsOpen ? t("villains.less") : t("villains.more", { n: all.length });
  more.setAttribute("aria-expanded", String(villainsOpen));
}

/** A mod's store cover, or a plain tile where it has none or it fails to load. */
function coverOf(mod: StoreMod): HTMLElement {
  if (!mod.thumbnail) return element("div", { class: "blank" });
  const img = element("img", { src: mod.thumbnail, alt: "", loading: "lazy", decoding: "async" });
  img.addEventListener("error", () => img.replaceWith(element("div", { class: "blank" })), { once: true });
  return img;
}

function drawMods(): void {
  // The store's first batch, as the owner's poster of it; opens full size.
  const batch = $<HTMLAnchorElement>("batch-art");
  batch.href = batchArt;
  const poster = $<HTMLImageElement>("batch-img");
  poster.src = batchArt;
  poster.alt = t("mods.batchAlt");
  const list = $("mod-list");
  if (mods.length === 0) {
    list.replaceChildren(element("li", { class: "empty" }, t("mods.empty")));
  } else {
    const sorted = [...mods].sort((a, b) => a.kind.localeCompare(b.kind) || a.name.localeCompare(b.name));
    list.replaceChildren(
      ...sorted.map((mod, i) =>
        element(
          "li",
          { class: "mod reveal", title: mod.summary, style: `--i: ${i % 4}` },
          coverOf(mod),
          element(
            "div",
            { class: "mod-plate" },
            element("span", { class: "kind" }, t(`mods.kind.${mod.kind}`)),
            element("b", {}, mod.name),
            element("span", { class: "by" }, t("mods.by", { creator: mod.creator })),
          ),
        ),
      ),
    );
  }
  const creators = creatorsOf(mods.map((mod) => mod.creator));
  $("credit-mods").replaceChildren(...creators.map((name) => element("li", {}, name)));
}

function drawNews(): void {
  const [latest, ...rest] = feed();
  if (!latest) return;
  $("news-latest").replaceChildren(
    element("div", { class: "eb" }, t("news.released", { version: latest.version, date: formatDate(latest.date) })),
    element("h3", {}, latest.title),
    element("p", { html: latest.summaryHtml }),
    element(
      "a",
      { class: "btn primary", href: releaseUrl(latest) },
      t(latest.report ? "news.report" : "news.notes"),
      " ↗",
    ),
  );
  $("news-feed").replaceChildren(
    ...rest
      .slice(0, 5)
      .map((entry) =>
        element(
          "li",
          {},
          element(
            "a",
            { href: releaseUrl(entry) },
            element("span", { class: "v" }, entry.version),
            element("span", { class: "tt" }, entry.title),
          ),
        ),
      ),
    element("li", { class: "all" }, element("a", { href: ADDRESSES.releases! }, t("news.all"), " ↗")),
  );
}

function drawDownloads(): void {
  renderDownloads($("downloads"), { release, device, language, gameUrl: GAME_URL }, t);
  drawHeroDownload();
}

function drawHomebrew(): void {
  // The Spanish community's server first for a Spanish reader.
  const en = $("homebrew-en");
  const es = $("homebrew-es");
  if (language === "es") en.before(es);
  else es.before(en);
}

const labelLanguages = mountLanguageToggle($("language"), language, (next) => {
  language = next;
  t = textFor(next);
  draw();
});

function draw(): void {
  document.documentElement.lang = language;
  document.title = t("meta.title");
  applyText(document, t);
  $("ai-note").hidden = t("lang.aiNote") === "";
  labelLanguages(t("lang.label"));
  for (const link of document.querySelectorAll<HTMLAnchorElement>("[data-href]")) {
    link.href = ADDRESSES[link.dataset.href!] ?? "#";
  }
  drawArt();
  drawStats();
  drawShots();
  drawStory();
  drawHeroes();
  drawVillains();
  drawMods();
  drawNews();
  drawDownloads();
  drawHomebrew();
  $("credit-decks").replaceChildren(...GAME_ROSTER.deckAuthors.map((name) => element("li", {}, name)));
  // A redraw replaces the walls' tiles; ones already scrolled past show at once rather than rising again.
  for (const tile of document.querySelectorAll(".reveal"))
    if (tile.getBoundingClientRect().top < innerHeight) tile.classList.add("in");
}

const reveal = revealOnScroll(document);

$("villains-more").addEventListener("click", () => {
  villainsOpen = !villainsOpen;
  drawVillains();
  reveal();
});

draw();
reveal();
onScrollFrame(() => {
  shotsSection.move();
  storySection.move();
  moveBands();
});

void fetchLatestRelease(LATEST_RELEASE_API).then((latest) => {
  const next = latest ?? BUILT_RELEASE;
  // The build's copy already shows that release: leave the panel (and any focus in it) alone.
  if (next === null ? release === null : release !== "loading" && release?.tag_name === next.tag_name) return;
  release = next;
  drawDownloads();
});

// The live catalog, where the store's CORS lets this origin read it; the build's copy stays otherwise.
void fetch(PACK_CATALOG_URL, { signal: AbortSignal.timeout(6000) })
  .then((response) => (response.ok ? (response.json() as Promise<{ packs?: PackIndexEntry[] }>) : null))
  .then((data) => {
    const live = data?.packs?.filter((pack) => !pack.withdrawn);
    if (!live || live.length === 0) return;
    const ids = (list: readonly StoreMod[]) => list.map((mod) => `${mod.id}@${mod.latest}`).join();
    if (ids(live) === ids(mods)) return;
    mods = live;
    drawMods();
    drawStats();
    reveal();
  })
  .catch(() => {
    // Out of reach or not allowed: the build's list stands.
  });
