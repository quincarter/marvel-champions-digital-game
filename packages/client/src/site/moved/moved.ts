/**
 * The "we have moved" page (`site/moved/index.html`): what the old Netlify address serves once the game lives on
 * Cloudflare (docs/custom-content-packs.md §4.1). It stays on the old origin on purpose: IndexedDB and `localStorage`
 * belong to an origin, so only a page here can read the saves a web player left behind. It hands them over as the same
 * save file the game exports (`save-data/save-data.ts`), shows the sync recovery code so linked devices can join again
 * at the new address, and offers the app downloads.
 */
import { exportSaveData } from "../../save-data/save-data.js";
import { deliverSaveFile } from "../../save-data/file-transfer.js";
import { saveFileNameOf, saveFileSummaryOf, type SaveFile } from "../../save-data/save-file.js";
import { SYNC_CODE_STORAGE_KEY } from "../../sync/sync-credentials.js";
import { BUILT_RELEASE } from "virtual:site-release";
import { browserDevice, fetchLatestRelease, type LatestRelease } from "../downloads.js";
import { browserLanguage, storageRead, type PageLanguage } from "../page-language.js";
import { applyText, element, mountLanguageToggle, renderDownloads, translator, type Translate } from "../site-dom.js";
import { SHARED_TEXT } from "../site-text.js";
import {
  GAME_DISCORD_URL,
  GAME_URL,
  ISSUES_URL,
  LANDING_URL,
  LATEST_RELEASE_API,
  REPO_URL,
  SITE_DOMAIN,
} from "../site-urls.js";
import { WALLPAPERS } from "virtual:site-wallpapers";
import { IdbPackStore, type InstalledPack } from "../../packs/pack-store.js";
import { gameLinkOf } from "./game-link.js";
import { MOVED_TEXT } from "./moved-text.js";
import { describeSaved, hasSaves } from "./saved-summary.js";

const $ = <T extends HTMLElement = HTMLElement>(id: string): T => document.getElementById(id) as T;

const ADDRESSES = {
  game: GAME_URL,
  gameHost: new URL(GAME_URL).host,
  landing: LANDING_URL,
  domain: SITE_DOMAIN,
  discord: GAME_DISCORD_URL,
  issues: ISSUES_URL,
  repo: REPO_URL,
};

type SaveState =
  | { readonly kind: "reading" }
  | { readonly kind: "blocked" }
  | { readonly kind: "ready"; readonly file: SaveFile }
  | { readonly kind: "done"; readonly file: SaveFile; readonly name: string }
  | { readonly kind: "failed"; readonly file: SaveFile; readonly error: string };

let language: PageLanguage = browserLanguage();
let t: Translate = textFor(language);
let saves: SaveState = { kind: "reading" };
// The build's copy until GitHub answers, so the buttons show at once and survive GitHub's rate limit.
let release: LatestRelease | null | "loading" = BUILT_RELEASE ?? "loading";
let codeShown = false;
let delivering = false;
const device = browserDevice();
const syncCode = storageRead(SYNC_CODE_STORAGE_KEY);
// A replay, transfer or device link made for the old address: carried on to the new one, fragment and all. Read once
// and taken out of the address bar, as the game does, so a transfer key doesn't linger in history.
const gameLink = gameLinkOf(location.hash, GAME_URL);
if (gameLink) history.replaceState(null, "", `${location.pathname}${location.search}`);

function textFor(lang: PageLanguage): Translate {
  const base = translator(MOVED_TEXT[lang], SHARED_TEXT[lang]);
  return (key, params) => base(key, { ...ADDRESSES, ...params });
}

function drawSaves(): void {
  const status = $("save-status");
  const unavailable = saves.kind === "reading" || saves.kind === "blocked" || delivering;
  for (const id of ["save-button", "cta-save"]) $<HTMLButtonElement>(id).disabled = unavailable;
  status.classList.toggle("ok", saves.kind === "done");
  switch (saves.kind) {
    case "reading":
      status.textContent = t("step1.reading");
      break;
    case "blocked":
      status.textContent = t("step1.blocked");
      break;
    case "ready": {
      const summary = saveFileSummaryOf(saves.file);
      status.textContent = hasSaves(summary) ? t("step1.found", { what: describeSaved(summary, t) }) : t("step1.empty");
      break;
    }
    case "done":
      status.textContent = t("step1.done", { file: saves.name });
      break;
    case "failed":
      status.textContent = t("step1.failed", { error: saves.error });
      break;
  }
}

function drawSync(): void {
  const on = syncCode !== null && syncCode !== "";
  $("sync-text").innerHTML = t(on ? "step2.on" : "step2.off");
  $("sync-tools").hidden = !on;
  if (!on) return;
  const code = $("sync-code");
  code.textContent = codeShown ? syncCode : "•".repeat(syncCode.length);
  code.classList.toggle("masked", !codeShown);
  // A screen reader would read the mask out bullet by bullet.
  if (codeShown) code.removeAttribute("aria-label");
  else code.setAttribute("aria-label", t("step2.hidden"));
  const show = $("sync-show");
  show.textContent = t(codeShown ? "step2.hide" : "step2.show");
  show.setAttribute("aria-pressed", String(codeShown));
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
    const key = link.dataset.href as keyof typeof ADDRESSES;
    link.href = key === "game" && gameLink ? gameLink.url : ADDRESSES[key];
  }
  $("game-link").hidden = !gameLink;
  if (gameLink) {
    $("game-link-text").textContent = t(`link.${gameLink.kind}`);
    $<HTMLAnchorElement>("game-link-open").href = gameLink.url;
  }
  drawSaves();
  drawSync();
  drawMods();
  renderDownloads($("downloads"), { release, device, language, gameUrl: GAME_URL }, t);
}

async function downloadSaves(): Promise<void> {
  if (saves.kind === "reading" || saves.kind === "blocked" || delivering) return;
  delivering = true;
  drawSaves();
  // Read again at the moment of the click, so whatever another tab saved since the page opened is in the file. If that
  // read fails, say so and leave the button to retry: handing over the page-load copy instead could miss the newest
  // games, and the player imports this file over whatever is at the new address.
  let file: SaveFile;
  try {
    file = await exportSaveData();
  } catch (error) {
    saves = { kind: "failed", file: saves.file, error: error instanceof Error ? error.message : String(error) };
    delivering = false;
    drawSaves();
    return;
  }
  try {
    await deliverSaveFile(file);
    saves = { kind: "done", file, name: saveFileNameOf(file.exportedAt) };
  } catch (error) {
    if (!(error instanceof DOMException && error.name === "AbortError")) {
      saves = { kind: "failed", file, error: error instanceof Error ? error.message : String(error) };
    }
  } finally {
    delivering = false;
  }
  drawSaves();
}

function wire(): void {
  for (const button of [$("save-button"), $("cta-save")]) {
    button.addEventListener("click", () => {
      if (button.id === "cta-save") $("step-1").scrollIntoView({ behavior: "smooth", block: "start" });
      void downloadSaves();
    });
  }
  $("sync-show").addEventListener("click", () => {
    codeShown = !codeShown;
    drawSync();
  });
  $("sync-copy").addEventListener("click", () => {
    if (!syncCode) return;
    const button = $("sync-copy");
    const copied = () => {
      button.textContent = t("step2.copied");
      setTimeout(() => (button.textContent = t("step2.copy")), 2000);
    };
    // No clipboard here (an older browser, a blocked permission): show the code, select it, and say to copy by hand.
    const byHand = () => {
      codeShown = true;
      drawSync();
      getSelection()?.selectAllChildren($("sync-code"));
      $("sync-copy-failed").hidden = false;
    };
    if (!navigator.clipboard?.writeText) {
      byHand();
      return;
    }
    navigator.clipboard.writeText(syncCode).then(copied, byHand);
  });
}

/** The title wallpaper behind the top (a tall one on phones) and the band between sections. */
function drawArt(): void {
  if (WALLPAPERS.wide) {
    const sources = WALLPAPERS.tall
      ? [element("source", { media: "(max-aspect-ratio: 3/4)", srcset: WALLPAPERS.tall })]
      : [];
    $("hero-art").replaceChildren(...sources, element("img", { src: WALLPAPERS.wide, alt: "", fetchpriority: "high" }));
  }
  const band = WALLPAPERS.bands[0];
  if (band) $("band-0").style.backgroundImage = `url("${band}")`;
  else $("band-0").hidden = true;
}

/** The mods installed here: they live in their own database, outside the save file, so the page names them. */
let installedMods: readonly InstalledPack[] = [];

const escapeHtml = (text: string): string =>
  text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");

function drawMods(): void {
  const note = $("mods-note");
  note.hidden = installedMods.length === 0;
  if (installedMods.length === 0) return;
  const names = (packs: readonly InstalledPack[]) => escapeHtml(packs.map((pack) => pack.manifest.name).join(", "));
  const gone = installedMods.filter((pack) => pack.withdrawn);
  const listed = installedMods.filter((pack) => !pack.withdrawn);
  note.innerHTML = [
    listed.length > 0 ? t("step1.mods", { names: names(listed) }) : "",
    gone.length > 0 ? t("step1.modsGone", { names: names(gone) }) : "",
  ]
    .filter(Boolean)
    .join(" ");
}

wire();
drawArt();
draw();

new IdbPackStore()
  .list()
  .then((packs) => {
    installedMods = packs;
    drawMods();
  })
  .catch(() => {
    // No pack database here, or storage is blocked: nothing to name.
  });

exportSaveData()
  .then((file) => {
    saves = { kind: "ready", file };
  })
  .catch(() => {
    saves = { kind: "blocked" };
  })
  .finally(drawSaves);

void fetchLatestRelease(LATEST_RELEASE_API).then((latest) => {
  const next = latest ?? BUILT_RELEASE;
  // The build's copy already shows that release: leave the panel (and the focus in it) alone.
  if (next === null ? release === null : release !== "loading" && release?.tag_name === next.tag_name) return;
  release = next;
  renderDownloads($("downloads"), { release, device, language, gameUrl: GAME_URL }, t);
});
