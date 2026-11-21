/**
 * The download stats page (`site/landing/stats/index.html`, at `/stats/` on the landing site): how often each release
 * has been downloaded, by platform, with the top five releases, the card-language split and the Install for Steam
 * runs. Every number comes from the build (`virtual:download-stats`), which a scheduled deploy refreshes twice a day when the counts move, so the
 * page asks nothing of GitHub when it opens.
 */
import { DOWNLOAD_STATS, RELEASE_TITLES } from "virtual:download-stats";
import { WALLPAPERS } from "virtual:site-wallpapers";
import { browserLanguage, LANGUAGE_NAMES, PAGE_LANGUAGES, type PageLanguage } from "../page-language.js";
import { mountSteamButton } from "../site-bar.js";
import { applyText, element, mountLanguageToggle, translator, type Translate } from "../site-dom.js";
import { SHARED_TEXT } from "../site-text.js";
import { GAME_URL, ISSUES_URL, RELEASES_URL, REPO_URL } from "../site-urls.js";
import { STATS_TEXT } from "./stats-text.js";
import {
  FILE_KINDS,
  PLATFORMS,
  percent,
  type DownloadStats,
  type FileKind,
  type Platform,
  type ReleaseDownloads,
} from "./download-stats.js";

const $ = <T extends HTMLElement = HTMLElement>(id: string): T => document.getElementById(id) as T;

const ADDRESSES: Readonly<Record<string, string>> = { game: GAME_URL, repo: REPO_URL, issues: ISSUES_URL };

const PLATFORM_NAMES: Readonly<Record<Platform, string>> = {
  android: "Android",
  ios: "iOS",
  windows: "Windows",
  mac: "macOS",
  linux: "Linux",
};
const FILE_NAMES: Readonly<Record<FileKind, string>> = {
  apk: "apk",
  ipa: "ipa",
  exe: "Setup.exe",
  msi: "AllUsers.msi",
  dmg: "dmg",
  appTarGz: "app.tar.gz",
  appImage: "AppImage",
  deb: "deb",
  rpm: "rpm",
};

let language: PageLanguage = browserLanguage();
let t: Translate = textFor(language);

function textFor(next: PageLanguage): Translate {
  return translator(STATS_TEXT[next], SHARED_TEXT[next]);
}

const number = (n: number): string => n.toLocaleString(language);
const day = (iso: string, withYear = false): string =>
  iso
    ? new Date(iso).toLocaleDateString(language, {
        month: "short",
        day: "numeric",
        ...(withYear ? { year: "numeric" } : {}),
        timeZone: "UTC",
      })
    : "";

/** A platform's share as "41%", or "<1%" for a platform with downloads that rounds to nothing (a new one, like iOS). */
const shareText = (part: number, whole: number): string => {
  const at = percent(part, whole);
  return at === 0 && part > 0 ? "<1%" : `${at}%`;
};

/** A bar split by platform, each part as wide as its share of `scale`. */
function platformBar(platforms: Readonly<Record<Platform, number>>, scale: number, className: string): HTMLElement {
  return element(
    "span",
    { class: className, "aria-hidden": "true" },
    ...PLATFORMS.filter((platform) => platforms[platform] > 0).map((platform) =>
      element("i", {
        class: `p-${platform}`,
        style: `width:${((platforms[platform] / scale) * 100).toFixed(2)}%`,
        title: `${PLATFORM_NAMES[platform]}: ${number(platforms[platform])}`,
      }),
    ),
  );
}

function drawHead(stats: DownloadStats): void {
  const newest = stats.releases[0];
  const oldest = stats.releases.at(-1);
  $("head-title").innerHTML = t("head.title", { total: number(stats.installers) });
  $("head-range").textContent = [
    t("head.range", {
      since: stats.since,
      latest: newest?.version ?? stats.since,
      count: stats.releases.length,
      from: day(oldest?.date ?? ""),
      to: day(newest?.date ?? "", true),
    }),
    t("head.counted", { date: day(stats.countedAt, true) }),
  ].join(" · ");
  const days = oldest?.date
    ? Math.max(1, (Date.parse(stats.countedAt) - Date.parse(oldest.date)) / 86_400_000)
    : stats.releases.length;
  $("lead").innerHTML = t("lead.text", {
    since: stats.since,
    total: number(stats.installers),
    perDay: number(Math.round(stats.installers / days)),
  });
}

function drawTiles(stats: DownloadStats): void {
  const newest = stats.releases[0]?.version ?? stats.since;
  const tile = (label: string, value: number, note: string, kind = "") =>
    element(
      "li",
      { class: `tile ${kind}`.trim() },
      element("span", { class: "tile-label" }, label),
      element("b", {}, number(value)),
      element("span", { class: "tile-note" }, note),
    );
  const tiles = [
    tile(t("tile.total"), stats.installers, t("tile.total.note", { since: stats.since, latest: newest }), "big"),
    ...PLATFORMS.map((platform) =>
      tile(PLATFORM_NAMES[platform], stats.platforms[platform], t(`tile.${platform}.note`), `p-${platform}`),
    ),
  ];
  if (stats.steam.since) {
    tiles.push(tile(t("tile.steam"), stats.steam.total, t("tile.steam.note", { since: stats.steam.since })));
  }
  if (stats.releases.length > 0) {
    tiles.push(
      tile(
        t("tile.average"),
        Math.round(stats.installers / stats.releases.length),
        t("tile.average.note", { count: stats.releases.length }),
      ),
    );
  }
  $("tiles").replaceChildren(...tiles);
}

function drawShare(stats: DownloadStats): void {
  $("share-sub").textContent = t("share.sub", { total: number(stats.installers) });
  const share = $("share");
  share.replaceChildren(
    ...PLATFORMS.filter((platform) => stats.platforms[platform] > 0).map((platform) => {
      const at = shareText(stats.platforms[platform], stats.installers);
      return element(
        "span",
        { class: `p-${platform}`, style: `flex-grow:${stats.platforms[platform]}` },
        element("b", {}, PLATFORM_NAMES[platform]),
        element("span", {}, at),
      );
    }),
  );
  $("share-files").replaceChildren(
    ...PLATFORMS.map((platform) =>
      element(
        "li",
        { class: `p-${platform}` },
        element(
          "b",
          {},
          `${PLATFORM_NAMES[platform]} `,
          element(
            "span",
            {},
            `${number(stats.platforms[platform])} · ${shareText(stats.platforms[platform], stats.installers)}`,
          ),
        ),
        ...FILE_KINDS[platform].map((kind) =>
          element("span", { class: "file" }, element("em", {}, number(stats.files[kind])), ` ${FILE_NAMES[kind]}`),
        ),
      ),
    ),
  );
}

function releaseLink(version: string): string {
  return `${RELEASES_URL}/tag/${version}`;
}

function drawReleases(stats: DownloadStats): void {
  $("legend").replaceChildren(
    ...PLATFORMS.map((platform) => element("li", { class: `p-${platform}` }, PLATFORM_NAMES[platform])),
  );
  const most = Math.max(1, ...stats.releases.map((release) => release.installers));
  $("rows").replaceChildren(
    ...stats.releases.map((release) =>
      element(
        "li",
        {},
        element("a", { class: "row-v", href: releaseLink(release.version), rel: "noopener" }, release.version),
        element("span", { class: "row-d" }, day(release.date)),
        platformBar(release.platforms, most, "row-bar"),
        element("b", { class: "row-n" }, number(release.installers)),
      ),
    ),
  );

  const head = element(
    "tr",
    {},
    ...[
      t("table.release"),
      t("table.date"),
      ...PLATFORMS.map((platform) => PLATFORM_NAMES[platform]),
      t("table.steam"),
      t("table.installers"),
    ].map((label) => element("th", { scope: "col" }, label)),
  );
  const cell = (n: number | null) => element("td", {}, n === null ? "–" : number(n));
  const rows = stats.releases.map((release: ReleaseDownloads) =>
    element(
      "tr",
      {},
      element("th", { scope: "row" }, release.version),
      element("td", {}, day(release.date)),
      ...PLATFORMS.map((platform) => cell(release.platforms[platform])),
      cell(release.steam),
      element("td", {}, element("b", {}, number(release.installers))),
    ),
  );
  const total = element(
    "tr",
    { class: "sum" },
    element("th", { scope: "row" }, t("table.total")),
    element("td", {}, ""),
    ...PLATFORMS.map((platform) => cell(stats.platforms[platform])),
    cell(stats.steam.total),
    element("td", {}, element("b", {}, number(stats.installers))),
  );
  $("table").replaceChildren(element("thead", {}, head), element("tbody", {}, ...rows, total));
}

function drawTop(stats: DownloadStats): void {
  const titles = RELEASE_TITLES[language] ?? RELEASE_TITLES.en;
  $("top").replaceChildren(
    ...stats.top.map((release, i) => {
      const about = titles[release.version] ?? RELEASE_TITLES.en[release.version];
      return element(
        "li",
        { class: "reveal in" },
        element(
          "div",
          { class: "top-head" },
          element("span", { class: "top-rank" }, `#${i + 1}`),
          element("span", { class: "top-v" }, `${release.version} · ${day(release.date)}`),
          element("b", { class: "top-n" }, number(release.installers)),
        ),
        element("h3", {}, about?.title ?? release.version),
        ...(about ? [element("p", { class: "top-sum", html: about.summaryHtml })] : []),
        platformBar(release.platforms, release.installers || 1, "row-bar"),
        element(
          "p",
          { class: "top-split" },
          PLATFORMS.map((platform) => `${PLATFORM_NAMES[platform]} ${number(release.platforms[platform])}`).join(" · "),
        ),
        element("a", { href: `/releases/#${release.version}` }, t("top.read"), " →"),
      );
    }),
  );
}

function drawWays(stats: DownloadStats): void {
  const ways: HTMLElement[] = [];
  if (stats.languages) {
    const counts = stats.languages.counts;
    const all = Object.values(counts).reduce((sum, n) => sum + n, 0);
    // The share of the first language that isn't English: the one the split exists for.
    const other = PAGE_LANGUAGES.find((code) => code !== "en" && (counts[code] ?? 0) > 0);
    const name = (code: string) => LANGUAGE_NAMES[code as PageLanguage] ?? code.toUpperCase();
    ways.push(
      element(
        "article",
        { class: "way" },
        element("span", { class: "kick" }, t("lang.kick")),
        element("b", { class: "way-n" }, other ? `${percent(counts[other]!, all)}%` : number(all)),
        element("p", {
          html: other
            ? t("lang.text", {
                since: stats.languages.since,
                share: percent(counts[other]!, all),
                language: name(other),
              })
            : "",
        }),
        element(
          "ul",
          { class: "way-split" },
          ...Object.entries(counts)
            .sort(([, a], [, b]) => b - a)
            .map(([code, count]) => element("li", {}, t("lang.split", { count: number(count), language: name(code) }))),
        ),
      ),
    );
  }
  if (stats.steam.since) {
    ways.push(
      element(
        "article",
        { class: "way" },
        element("span", { class: "kick" }, t("steam.kick")),
        element("b", { class: "way-n" }, number(stats.steam.total)),
        element("h3", {}, t("steam.title")),
        element(
          "p",
          {},
          t("steam.text", {
            since: stats.steam.since,
            linux: number(stats.steam.linux),
            windows: number(stats.steam.windows),
            mac: number(stats.steam.mac),
          }),
        ),
      ),
    );
  }
  $("ways").replaceChildren(...ways);
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
  const stats = DOWNLOAD_STATS;
  $("stats-body").hidden = stats === null;
  $("stats-offline").hidden = stats !== null;
  if (stats === null) {
    $("head-title").textContent = t("head.kick");
    $("head-range").textContent = "";
    $("lead").textContent = "";
    $("offline-text").innerHTML = t("offline.text", { url: RELEASES_URL });
    $("foot-counted").textContent = "";
    return;
  }
  drawHead(stats);
  drawTiles(stats);
  drawShare(stats);
  drawReleases(stats);
  drawTop(stats);
  drawWays(stats);
  $("foot-counted").textContent = t("foot.counted", { date: day(stats.countedAt, true) });
}

/** The art behind the top of the page, as on the landing page's first screen (site-nav.css, `.site-backdrop`). */
function drawBackdrop(): void {
  const src = WALLPAPERS.bands[0] ?? WALLPAPERS.wide;
  if (src) $("site-backdrop").replaceChildren(element("img", { src, alt: "", fetchpriority: "high" }));
}

drawBackdrop();
draw();
mountSteamButton();
