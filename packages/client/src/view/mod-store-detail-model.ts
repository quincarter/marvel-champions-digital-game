/**
 * The pieces of a pack's page that are words, as plain data (`components/mod-store/mc-pack-detail`): the status line, the
 * title block, the text and the gallery's count line. The pictures, the cards and what the buttons do are the scene's and
 * the store's; this only says what the page reads, so all of it is tested without a screen.
 */
import { t } from "../i18n/translate.js";
import { progressOf, type ModStoreTile, type PackPage } from "./mod-store-model.js";
import { galleryCountText, loadStatusText, type LoadStatusLine } from "./pack-gallery-model.js";
import { stateChipOf } from "./mod-store-page-model.js";
import type { PackStatusModel } from "../components/mod-store/mc-pack-status/mc-pack-status.types.js";
import type { PackTitleModel } from "../components/mod-store/mc-pack-title/mc-pack-title.types.js";
import type { InstallProgress } from "../packs/install-pack.js";

/**
 * The line over the buttons: the last failure (an install's, else a removal's) in words, else the requirement the pack waits
 * on, else the progress of the install going, else nothing. A running install with no report yet says it is starting.
 */
export function packStatusOf(input: {
  readonly running: { readonly error: string | null; readonly progress: InstallProgress | null } | null;
  readonly removeError: string | null;
  readonly requirement: string | undefined;
}): PackStatusModel {
  const failure = input.running?.error ?? input.removeError;
  if (failure) return { kind: "failure", text: failure };
  if (!input.running) return input.requirement ? { kind: "requirement", text: input.requirement } : { kind: "none" };
  const { fraction, text } = input.running.progress
    ? progressOf(input.running.progress)
    : { fraction: 0, text: t("modStore.starting") };
  return { kind: "progress", text, fraction };
}

export function packTitleOf(tile: ModStoreTile, page: PackPage, failed: boolean): PackTitleModel {
  const chip = stateChipOf(tile, failed);
  return { name: page.title, byline: page.byline, meta: page.meta, chip: chip.text, solid: chip.solid };
}

/** The scrolling text: the load status leads (an installed pack says whether it is working, or why it is not). */
export function packBodyOf(loadStatus: LoadStatusLine | null, body: string): string {
  return loadStatus ? `${loadStatusText(loadStatus)}\n\n${body}` : body;
}

/** The count line over the gallery: "CARDS  ·  9 cards", or the preview's own heading before an install. */
export function galleryHeadingOf(installedOrLoaded: boolean, cardCount: number): string {
  return `${t(installedOrLoaded ? "modStore.cards" : "modStore.cardsPreview")}  ·  ${galleryCountText(cardCount)}`;
}
