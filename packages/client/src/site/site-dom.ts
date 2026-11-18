/**
 * The DOM side of the two site pages: putting a catalog's text into the page, the language toggle, and the download
 * panel. The pages' markup names each piece of text with `data-t="<key>"` (its HTML) or `data-t-<attr>="<key>"` (an
 * attribute), so the static HTML carries no copy of its own and a language switch redraws in place.
 */
import {
  downloadsOf,
  primaryButtons,
  steamButtonFor,
  versionOf,
  type DeviceKind,
  type Download,
  type LatestRelease,
} from "./downloads.js";
import { LANGUAGE_KEY, LANGUAGE_NAMES, PAGE_LANGUAGES, storageWrite, type PageLanguage } from "./page-language.js";
import { fileKey, fill, type SharedKey } from "./site-text.js";
import { LATEST_RELEASE_URL } from "./site-urls.js";
import steamLogo from "./steam-logo.svg";

export type Translate = (key: string, params?: Readonly<Record<string, string | number>>) => string;

/** A translator over `catalogs` merged in order: a page's own, then the shared one. */
export function translator(...catalogs: readonly Readonly<Record<string, string>>[]): Translate {
  return (key, params) => {
    for (const catalog of catalogs) {
      const text = catalog[key];
      if (text !== undefined) return fill(text, params);
    }
    return key;
  };
}

const ATTRIBUTES = ["alt", "aria-label", "title", "content"] as const;

/** Fills every `data-t` element's HTML and every `data-t-<attr>` attribute under `root` from `t`. */
export function applyText(root: ParentNode, t: Translate): void {
  for (const element of root.querySelectorAll<HTMLElement>("[data-t]")) element.innerHTML = t(element.dataset.t!);
  for (const name of ATTRIBUTES) {
    for (const element of root.querySelectorAll<HTMLElement>(`[data-t-${name}]`)) {
      element.setAttribute(name, t(element.getAttribute(`data-t-${name}`)!));
    }
  }
}

export function element<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Readonly<Record<string, string>> = {},
  ...children: readonly (Node | string)[]
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  for (const [name, value] of Object.entries(attrs)) {
    if (name === "html") node.innerHTML = value;
    else node.setAttribute(name, value);
  }
  node.append(...children);
  return node;
}

/**
 * The language buttons, one per page language, made once: a pick only moves `aria-pressed`, so keyboard focus stays on
 * the button that was pressed while `onPick` redraws the rest of the page. Returns a setter for the group's label.
 */
export function mountLanguageToggle(
  container: HTMLElement,
  current: PageLanguage,
  onPick: (language: PageLanguage) => void,
): (label: string) => void {
  let chosen = current;
  const buttons = PAGE_LANGUAGES.map((language) => {
    // The code ("ES") stands in for the name where a narrow bar has no room (site.css, `.lang .code`).
    const button = element(
      "button",
      { type: "button", lang: language, "aria-label": LANGUAGE_NAMES[language] },
      element("span", { class: "name" }, LANGUAGE_NAMES[language]),
      element("span", { class: "code", "aria-hidden": "true" }, language.toUpperCase()),
    );
    button.addEventListener("click", () => {
      if (language === chosen) return;
      chosen = language;
      storageWrite(LANGUAGE_KEY, language);
      const url = new URL(location.href);
      url.searchParams.delete("lang");
      history.replaceState(null, "", url);
      for (const [i, other] of buttons.entries())
        other.setAttribute("aria-pressed", String(PAGE_LANGUAGES[i] === chosen));
      onPick(language);
    });
    button.setAttribute("aria-pressed", String(language === current));
    return button;
  });
  container.replaceChildren(...buttons);
  container.setAttribute("role", "group");
  return (label) => container.setAttribute("aria-label", label);
}

const DEVICE_ORDER: readonly Download["device"][] = ["windows", "mac", "linux", "android"];

function languageName(code: string | null): string | null {
  if (code === null) return null;
  const lower = code.toLowerCase();
  return (PAGE_LANGUAGES as readonly string[]).includes(lower) ? LANGUAGE_NAMES[lower as PageLanguage] : code;
}

export interface DownloadPanelState {
  readonly release: LatestRelease | null | "loading";
  readonly device: DeviceKind;
  readonly language: PageLanguage;
  readonly gameUrl: string;
}

function formatDate(iso: string | undefined, language: PageLanguage): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString(language, {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}

function fileLink(download: Download, t: Translate): HTMLAnchorElement {
  const name = languageName(download.language);
  return element(
    "a",
    { class: "file", href: download.url, rel: "noopener" },
    element("span", { class: "file-name" }, t(fileKey(download.id))),
    element(
      "span",
      { class: "file-meta" },
      download.id.startsWith("steam-")
        ? t("dl.steamNote" satisfies SharedKey)
        : name
          ? t("dl.cardLanguage" satisfies SharedKey, { language: name })
          : download.fileName,
    ),
  );
}

/** Draws the download panel into `container` (`.dl` markup the pages style). */
export function renderDownloads(container: HTMLElement, state: DownloadPanelState, t: Translate): void {
  const { release, device, language, gameUrl } = state;
  const main = element("div", { class: "dl-main" });
  const notes: HTMLElement[] = [];
  const play = element("a", { class: "btn ghost", href: gameUrl }, t("dl.play"), " ↗");

  if (release === "loading") {
    notes.push(element("p", { class: "dl-note" }, t("dl.loading")));
    main.append(play);
    container.replaceChildren(main, ...notes);
    return;
  }
  if (release === null) {
    main.append(play);
    notes.push(element("p", { class: "dl-note", html: t("dl.offline", { url: LATEST_RELEASE_URL }) }));
    container.replaceChildren(main, ...notes);
    return;
  }

  const downloads = downloadsOf(release, language);
  // A Mac gets one button per chip (`primaryButtons`), each named from the installer it links to.
  const buttons = primaryButtons(downloads, device);
  const primary = buttons[0]?.download;
  if (primary) {
    main.append(
      ...buttons.map(({ download, labelKey }, i) =>
        element(
          "a",
          { class: i === 0 ? "btn primary" : "btn", href: download.url, rel: "noopener" },
          element("span", {}, t("dl.forDevice", { device: t(labelKey) })),
          element("small", {}, t(fileKey(download.id))),
        ),
      ),
      play,
    );
  } else {
    // A phone without an app, or a device we can't name: the browser is the main way in.
    play.className = "btn primary";
    main.append(play);
    notes.push(element("p", { class: "dl-note" }, t(device === "ios" ? "dl.iosNote" : "dl.otherNote")));
  }
  // The Install for Steam script for this computer, as a button of its own beside the installer, and how to run it:
  // a downloaded script needs execute permission on macOS and Linux, and Windows asks before it runs a downloaded file.
  const steam = steamButtonFor(downloads, device);
  if (steam) {
    main.insertBefore(
      element(
        "a",
        { class: "btn steam", href: steam.url, rel: "noopener" },
        element("img", { class: "steam-logo", src: steamLogo, alt: "", width: "36", height: "36" }),
        element(
          "span",
          { class: "steam-text" },
          element("span", {}, t("dl.steam")),
          element("small", {}, steam.fileName),
        ),
      ),
      play,
    );
  }
  const steamHelp = steam
    ? [
        element(
          "div",
          { class: "dl-steam" },
          element("h4", {}, t("dl.steamTitle")),
          element("p", {}, t("dl.steamWhat")),
          element("p", { html: t(`steam.how.${steam.device}`, { file: steam.fileName }) }),
        ),
      ]
    : [];
  notes.unshift(
    element(
      "p",
      { class: "dl-version" },
      t("dl.version", { version: versionOf(release), date: formatDate(release.published_at, language) }),
    ),
  );

  const groups = element("div", { class: "dl-groups" });
  const order = [...DEVICE_ORDER].sort((a, b) => Number(b === device) - Number(a === device));
  for (const kind of order) {
    const files = downloads.filter((download) => download.device === kind);
    if (files.length === 0) continue;
    groups.append(
      element(
        "div",
        { class: "dl-group" },
        element("h4", {}, t(`device.${kind}`)),
        ...files.map((file) => fileLink(file, t)),
      ),
    );
  }
  const more = element(
    "details",
    { class: "dl-more" },
    element("summary", {}, t("dl.other")),
    groups,
    element("a", { class: "all", href: release.html_url, rel: "noopener" }, t("dl.allFiles"), " ↗"),
  );
  // A redraw (a language switch, GitHub answering) keeps the list open if the visitor opened it.
  if (!primary || container.querySelector<HTMLDetailsElement>("details.dl-more")?.open) more.open = true;
  container.replaceChildren(main, ...notes, ...steamHelp, more);
}
