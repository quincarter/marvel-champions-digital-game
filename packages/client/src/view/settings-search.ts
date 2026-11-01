/**
 * Search across Settings and every page nested under it (#576): one flat list of entries, ranked by
 * `view/deck-search.ts`, each saying what it is, where it lives and where a press goes. All of it runs in
 * `workers/settings-search.worker.ts`, through `view/settings-search-client.ts`: the scene sends what its rows say and
 * gets back results ready to draw.
 *
 * `matchRangesOf` says which letters to mark in a result. It follows the ranking's own tiers, so what is marked is what
 * matched: the letters typed, else the word one typo away, else the letters in order across a name.
 */
import {
  editDistance,
  isSubsequence,
  normalizeText,
  prepareDocuments,
  rankDocuments,
  typoLimitOf,
  type PreparedDocument,
  type SearchDocument,
} from "./deck-search.js";
import type { TextRange } from "./settings-search-line.js";
import type { SettingsItemId, SettingsTabId } from "./settings-sections.js";
import {
  controllerStateOf,
  glyphSourceRowInfoOf,
  hintSizeRowInfoOf,
  hintsToggleInfoOf,
  keyboardGroupsOf,
  keyboardHandRowInfoOf,
  nintendoToggleInfoOf,
  padFamilyRowInfoOf,
  padLayerSectionsOf,
  padRowsOf,
  type ControlsTab,
} from "./controls-rows.js";
import type { PadFamily, PadIdentity } from "./pad-family.js";
import { progressionGuideOf } from "./progression-guide.js";
import { everyGlossaryEntry, villainPhaseOrder } from "./rules-reference.js";
import type { RulesTab } from "./rules-layout.js";
import { EXPORT_ROW_DETAIL, EXPORT_ROW_TITLE, IMPORT_ROW_DETAIL, IMPORT_ROW_TITLE } from "./save-data-model.js";
import { RECEIVE_ROW_DETAIL, RECEIVE_ROW_TITLE, SEND_ROW_DETAIL, SEND_ROW_TITLE } from "./save-transfer-model.js";
import { SYNC_ROW_DETAIL, SYNC_ROW_TITLE } from "./sync-model.js";
import { GLOBAL_ROW_TITLE, globalRowDetail } from "./global-stats-ui.js";
import type { StatsTab } from "./player-stats-layout.js";
import { printAndPlayRowOf, unlockAllRowOf, unlockListRowsOf } from "./unlocks-model.js";
import type { GlobalConsent } from "../global-stats/global-consent.js";
import type { Settings } from "../settings.js";
import { Unlocks, type UnlocksInput } from "../progression/unlocks.js";
import { ASPECT_GUIDES } from "../guide/aspects.js";
import { TUTORIAL_LESSONS } from "../guide/tutorial-lessons.js";

/** Where a press on a result goes. */
export type SettingsSearchTarget =
  | { readonly kind: "setting"; readonly item: SettingsItemId; readonly tab: SettingsTabId }
  | { readonly kind: "rules"; readonly tab: RulesTab; readonly query?: string }
  | { readonly kind: "unlocks"; readonly row?: string; readonly guideSection?: number }
  | { readonly kind: "saveData"; readonly row: string }
  | { readonly kind: "controls"; readonly tab: ControlsTab }
  | { readonly kind: "stats"; readonly tab: StatsTab };

export interface SettingsSearchEntry {
  readonly id: string;
  readonly title: string;
  readonly detail: string;
  /** Where it lives, as a player would say it: "Unlocks ▸ How it works". */
  readonly place: string;
  readonly target: SettingsSearchTarget;
}

/** A Settings row, as the scene knows it (its title and detail depend on what it can draw on this device). */
export interface SettingsRowText {
  readonly title: string;
  readonly detail: string;
}

/** One entry per row Settings draws now, each under the tab it sits on. */
export function settingsRowEntriesOf(
  tabs: readonly {
    readonly id: SettingsTabId;
    readonly label: string;
    readonly sections: readonly { readonly items: readonly SettingsItemId[] }[];
  }[],
  rows: ReadonlyMap<SettingsItemId, SettingsRowText>,
): readonly SettingsSearchEntry[] {
  return tabs.flatMap((tab) =>
    tab.sections.flatMap((section) =>
      section.items.flatMap((item) => {
        const row = rows.get(item);
        if (!row) return [];
        return [
          {
            id: `setting:${item}`,
            title: row.title,
            detail: row.detail,
            place: `Settings ▸ ${tab.label}`,
            target: { kind: "setting", item, tab: tab.id } satisfies SettingsSearchTarget,
          },
        ];
      }),
    ),
  );
}

function rulesEntries(): readonly SettingsSearchEntry[] {
  return [
    ...everyGlossaryEntry().map((entry): SettingsSearchEntry => ({
      id: `rules:${entry.id}`,
      title: entry.displayName,
      detail: entry.definition,
      place: "Rules reference",
      target: { kind: "rules", tab: "glossary", query: entry.displayName },
    })),
    ...villainPhaseOrder().map((step): SettingsSearchEntry => ({
      id: `rules-villain:${step.id}`,
      title: step.label,
      detail: step.detail,
      place: "Rules reference ▸ Villain phase",
      target: { kind: "rules", tab: "villainPhase" },
    })),
  ];
}

function unlocksEntries(unlocks: Unlocks): readonly SettingsSearchEntry[] {
  const row = (id: string, title: string, detail: string): SettingsSearchEntry => ({
    id: `unlocks:${id}`,
    title,
    detail,
    place: "Unlocks",
    target: { kind: "unlocks", row: id },
  });
  const all = unlockAllRowOf(unlocks);
  const printAndPlay = printAndPlayRowOf(unlocks);
  return [
    row("all", all.title, all.detail),
    row("pnp", printAndPlay.title, printAndPlay.detail),
    ...unlockListRowsOf(unlocks).flatMap((item) => {
      if (item.kind === "section") return [];
      return [row(item.id, item.title, item.kind === "wave" ? item.status : item.detail)];
    }),
    ...progressionGuideOf().map((section, index): SettingsSearchEntry => ({
      id: `unlocks-guide:${index}`,
      title: section.heading,
      detail: [...section.paragraphs, ...section.bullets].join(" "),
      place: "Unlocks ▸ How it works",
      target: { kind: "unlocks", guideSection: index },
    })),
  ];
}

function saveDataEntries(globalConsent: GlobalConsent): readonly SettingsSearchEntry[] {
  const row = (id: string, title: string, detail: string): SettingsSearchEntry => ({
    id: `save-data:${id}`,
    title,
    detail,
    place: "Save data",
    target: { kind: "saveData", row: id },
  });
  return [
    row("export", EXPORT_ROW_TITLE, EXPORT_ROW_DETAIL),
    row("import", IMPORT_ROW_TITLE, IMPORT_ROW_DETAIL),
    row("send", SEND_ROW_TITLE, SEND_ROW_DETAIL),
    row("receive", RECEIVE_ROW_TITLE, RECEIVE_ROW_DETAIL),
    row("sync", SYNC_ROW_TITLE, SYNC_ROW_DETAIL),
    row("global", GLOBAL_ROW_TITLE, globalRowDetail(globalConsent)),
  ];
}

function controlsEntries(settings: Settings, family: PadFamily, swap: boolean): readonly SettingsSearchEntry[] {
  const entry = (id: string, title: string, detail: string, tab: ControlsTab): SettingsSearchEntry => ({
    id: `controls:${tab}:${id}`,
    title,
    detail,
    place: `Controls ▸ ${tab === "controller" ? "Controller" : "Keyboard"}`,
    target: { kind: "controls", tab },
  });
  const labels = padFamilyRowInfoOf(settings);
  const nintendo = nintendoToggleInfoOf(settings, null);
  const hints = hintsToggleInfoOf(settings);
  const source = glyphSourceRowInfoOf(settings);
  const size = hintSizeRowInfoOf(settings);
  const hand = keyboardHandRowInfoOf(settings);
  return [
    entry("labels", labels.title, labels.detail, "controller"),
    entry("nintendo", nintendo.title, nintendo.detail, "controller"),
    entry("hints", hints.title, hints.detail, "controller"),
    entry("source", source.title, source.detail, "controller"),
    entry("hint-size", size.title, size.detail, "controller"),
    entry("hand", hand.title, hand.detail, "keyboard"),
    ...padRowsOf(family, swap).map((row) => entry(row.id, row.action, row.note, "controller")),
    ...padLayerSectionsOf(family, swap).flatMap((section) =>
      section.rows.map((row) => entry(`${section.id}:${row.id}`, row.action, row.note, "controller")),
    ),
    ...keyboardGroupsOf(settings.keyboardHand).flatMap((group) =>
      group.rows.map((row) => entry(`${group.id}:${row.id}`, row.action, row.note, "keyboard")),
    ),
  ];
}

/** Your stats' tabs, in the words a player would look for. The numbers themselves are the player's, read off their saves. */
const STATS_TABS: readonly { readonly tab: StatsTab; readonly title: string; readonly detail: string }[] = [
  { tab: "overview", title: "Overview", detail: "Your record, games played, wins and losses, and win rate." },
  { tab: "heroes", title: "Heroes", detail: "Your record with each hero." },
  { tab: "villains", title: "Villains", detail: "Your record against each villain." },
  { tab: "aspects", title: "Aspects", detail: "How often you play each aspect, and how it goes." },
  { tab: "encounter", title: "Encounter", detail: "The encounter sets and side schemes you have met." },
  { tab: "records", title: "Records", detail: "Your best games, and the devices you have played on." },
  { tab: "all-cards", title: "Cards", detail: "The cards you play the most across every hero." },
  { tab: "cards", title: "Cards by hero", detail: "Each hero's most played, most used and rarely played cards." },
];

function statsEntries(): readonly SettingsSearchEntry[] {
  return STATS_TABS.map(({ tab, title, detail }) => ({
    id: `stats:${tab}`,
    title,
    detail,
    place: "Your stats",
    target: { kind: "stats", tab },
  }));
}

/** The "How to play" hub's lessons. It has no way in of its own here: a press goes to the Settings row that opens it. */
function howToPlayEntries(): readonly SettingsSearchEntry[] {
  const lesson = (id: string, title: string, detail: string, item: SettingsItemId): SettingsSearchEntry => ({
    id: `how-to-play:${id}`,
    title,
    detail,
    place: "Guide ▸ How to play",
    target: { kind: "setting", item, tab: "guide" },
  });
  return [
    ...TUTORIAL_LESSONS.map((entry) => lesson(entry.id, entry.title, "A lesson in the tutorial.", "play-tutorial")),
    ...ASPECT_GUIDES.filter((guide) => guide.aspect !== "basic").map((guide) =>
      lesson(guide.aspect, guide.name, guide.tagline, "aspect-lessons"),
    ),
  ];
}

/** Every page below Settings. */
export function nestedPageEntriesOf(input: {
  readonly settings: Settings;
  readonly unlocks: Unlocks;
  readonly family: PadFamily;
  readonly swap: boolean;
  readonly globalConsent: GlobalConsent;
  /** False where Settings leaves the Controls page out (`settingsSectionsOf`). */
  readonly controls: boolean;
}): readonly SettingsSearchEntry[] {
  return [
    ...rulesEntries(),
    ...unlocksEntries(input.unlocks),
    ...saveDataEntries(input.globalConsent),
    ...(input.controls ? controlsEntries(input.settings, input.family, input.swap) : []),
    ...statsEntries(),
    ...howToPlayEntries(),
  ];
}

/** Title first, then its description; the place last, so "sound" finds a row that only lives under Sound. */
export function searchDocumentsOf(entries: readonly SettingsSearchEntry[]): readonly SearchDocument[] {
  return entries.map((entry) => ({
    id: entry.id,
    primary: [entry.title],
    secondary: [entry.detail],
    notes: [entry.place],
  }));
}

/** `text` folded as the ranking folds it, with where each folded letter came from. */
function foldedOf(text: string): { readonly text: string; readonly at: readonly number[] } {
  let folded = "";
  const at: number[] = [];
  for (let i = 0; i < text.length; i++) {
    const letter = normalizeText(text[i]!);
    folded += letter;
    for (let n = 0; n < letter.length; n++) at.push(i);
  }
  return { text: folded, at };
}

function wordsWithPlaceOf(text: string): readonly (TextRange & { readonly word: string })[] {
  return [...text.matchAll(/[a-z0-9]+/g)].map((m) => ({
    word: m[0],
    start: m.index,
    end: m.index + m[0].length,
  }));
}

/** Where one query word matched in `folded`: the same order of preference as the ranking. */
function tokenRanges(token: string, folded: string, loose: boolean): readonly TextRange[] {
  const words = wordsWithPlaceOf(folded);
  const atWordStart = words
    .filter(({ word }) => word.startsWith(token))
    .map(({ start }) => ({ start, end: start + token.length }));
  if (atWordStart.length > 0) return atWordStart;
  const inside: TextRange[] = [];
  for (let at = folded.indexOf(token); at >= 0; at = folded.indexOf(token, at + token.length))
    inside.push({ start: at, end: at + token.length });
  if (inside.length > 0) return inside;
  const limit = typoLimitOf(token);
  if (limit > 0) {
    const close = words.filter(
      ({ word }) =>
        word[0] === token[0] &&
        (editDistance(token, word, limit) <= limit ||
          (word.length > token.length && editDistance(token, word.slice(0, token.length), limit) <= limit)),
    );
    if (close.length > 0) return close.map(({ start, end }) => ({ start, end }));
  }
  if (!loose || token.length < 5 || folded[0] !== token[0] || !isSubsequence(token, folded)) return [];
  const letters: TextRange[] = [];
  let next = 0;
  for (let at = 0; at < folded.length && next < token.length; at++) {
    if (folded[at] !== token[next]) continue;
    letters.push({ start: at, end: at + 1 });
    next++;
  }
  return letters;
}

/**
 * Which parts of `text` to mark for `query`: sorted, none overlapping, in `text`'s own positions. `loose` is for a
 * title: the ranking only takes letters in order across a name.
 */
export function matchRangesOf(text: string, query: string, loose = false): readonly TextRange[] {
  const folded = foldedOf(text);
  const tokens = normalizeText(query).match(/[a-z0-9]+/g) ?? [];
  const found = tokens
    .flatMap((token) => tokenRanges(token, folded.text, loose))
    .map(({ start, end }) => ({ start: folded.at[start]!, end: folded.at[end - 1]! + 1 }))
    .sort((a, b) => a.start - b.start);
  const merged: { start: number; end: number }[] = [];
  for (const range of found) {
    const last = merged.at(-1);
    if (last && range.start <= last.end) last.end = Math.max(last.end, range.end);
    else merged.push({ ...range });
  }
  return merged;
}

/** What the scene sends once per open: all plain data, so it crosses to the worker as it is. */
export interface SettingsSearchIndexInput {
  readonly tabs: Parameters<typeof settingsRowEntriesOf>[0];
  readonly rows: readonly (readonly [SettingsItemId, SettingsRowText])[];
  readonly settings: Settings;
  readonly pad: PadIdentity | null;
  readonly unlocks: UnlocksInput;
  readonly globalConsent: GlobalConsent;
  readonly controls: boolean;
}

/** A match, with which letters of its title and description to mark. */
export interface SettingsSearchResult {
  readonly entry: SettingsSearchEntry;
  readonly titleRanges: readonly TextRange[];
  readonly detailRanges: readonly TextRange[];
}

export type SettingsSearchRequest =
  | { readonly type: "index"; readonly input: SettingsSearchIndexInput }
  | { readonly type: "query"; readonly requestId: number; readonly query: string };

export interface SettingsSearchResponse {
  readonly requestId: number;
  readonly results: readonly SettingsSearchResult[];
}

/** Holds the index and answers queries: in the worker, or here where there is none. */
export class SettingsSearchHost {
  #entries: ReadonlyMap<string, SettingsSearchEntry> = new Map();
  #documents: readonly PreparedDocument[] = [];

  index(input: SettingsSearchIndexInput): void {
    const { settings, pad, globalConsent, controls } = input;
    const { family, swap } = controllerStateOf(settings, pad);
    const entries = [
      ...settingsRowEntriesOf(input.tabs, new Map(input.rows)),
      ...nestedPageEntriesOf({ settings, unlocks: new Unlocks(input.unlocks), family, swap, globalConsent, controls }),
    ];
    this.#entries = new Map(entries.map((entry) => [entry.id, entry]));
    this.#documents = prepareDocuments(searchDocumentsOf(entries));
  }

  search(query: string): readonly SettingsSearchResult[] {
    // Punctuation alone is no search, though an empty query ranks everything.
    if (!/[a-z0-9]/.test(normalizeText(query))) return [];
    return rankDocuments(this.#documents, query).flatMap(({ id }) => {
      const entry = this.#entries.get(id);
      if (!entry) return [];
      return [
        {
          entry,
          titleRanges: matchRangesOf(entry.title, query, true),
          detailRanges: matchRangesOf(entry.detail, query),
        },
      ];
    });
  }
}
