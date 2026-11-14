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
import { applyText, mountLanguageToggle, renderDownloads, translator, type Translate } from "../site-dom.js";
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
const device = browserDevice();
const syncCode = storageRead(SYNC_CODE_STORAGE_KEY);

function textFor(lang: PageLanguage): Translate {
  const base = translator(MOVED_TEXT[lang], SHARED_TEXT[lang]);
  return (key, params) => base(key, { ...ADDRESSES, ...params });
}

function drawSaves(): void {
  const status = $("save-status");
  const button = $<HTMLButtonElement>("save-button");
  button.disabled = saves.kind === "reading" || saves.kind === "blocked";
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
  $("sync-show").textContent = t(codeShown ? "step2.hide" : "step2.show");
}

function draw(): void {
  document.documentElement.lang = language;
  document.title = t("meta.title");
  applyText(document, t);
  $("ai-note").hidden = t("lang.aiNote") === "";
  mountLanguageToggle($("language"), language, t("lang.label"), (next) => {
    language = next;
    t = textFor(next);
    draw();
  });
  for (const link of document.querySelectorAll<HTMLAnchorElement>("[data-href]")) {
    link.href = ADDRESSES[link.dataset.href as keyof typeof ADDRESSES];
  }
  drawSaves();
  drawSync();
  renderDownloads($("downloads"), { release, device, language, gameUrl: GAME_URL }, t);
}

async function downloadSaves(): Promise<void> {
  if (saves.kind === "reading" || saves.kind === "blocked") return;
  // Read again at the moment of the click, so whatever another tab saved since the page opened is in the file.
  let file = saves.file;
  try {
    file = await exportSaveData();
  } catch {
    // The first read worked; hand over that one.
  }
  try {
    await deliverSaveFile(file);
    saves = { kind: "done", file, name: saveFileNameOf(file.exportedAt) };
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") return;
    saves = { kind: "failed", file, error: error instanceof Error ? error.message : String(error) };
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
    void navigator.clipboard?.writeText(syncCode).then(() => {
      const button = $("sync-copy");
      button.textContent = t("step2.copied");
      setTimeout(() => (button.textContent = t("step2.copy")), 2000);
    });
  });
}

wire();
draw();

exportSaveData()
  .then((file) => {
    saves = { kind: "ready", file };
  })
  .catch(() => {
    saves = { kind: "blocked" };
  })
  .finally(drawSaves);

void fetchLatestRelease(LATEST_RELEASE_API).then((latest) => {
  release = latest ?? BUILT_RELEASE;
  renderDownloads($("downloads"), { release, device, language, gameUrl: GAME_URL }, t);
});
