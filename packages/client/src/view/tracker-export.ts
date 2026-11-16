/**
 * Finished games as a CSV for marvelchampionstracker.com (MCT) (issue #757), one row per game, so players who log
 * their physical games there can add the digital ones. MCT's importer format is not public (it is offered on request),
 * so the columns follow what an MCT game log holds, in plain words, to be mapped onto its fields or adjusted once MCT
 * confirms the format. Pure: `scenes/past-games.ts` hands it the saves and the names, and saves the text it returns.
 *
 * Columns, in order (the header is always the same, with four hero slots):
 *  - Date: the day the game ended, `YYYY-MM-DD`, local time.
 *  - Title: "<villain> — <hero> & <hero>".
 *  - Result: `Win` or `Loss`. Only won and lost games are exported; a game given up or left unfinished is not a result.
 *  - Scenario, Villain: the scenario's name and the villain(s) the game faced (a villain's stages share one name).
 *  - Modular sets: the set(s) played, printed names, semicolon-separated: the scenario's or chosen sets, then extra
 *    sets added on top (Longshot), then the sets a scenario sets aside (The Hood, Mojo), each marked "(set aside)": the config's own picks, or The
 *    Hood's default seven when it names none (Mojo's random picks are not in the save, so none are listed then); then
 *    sets the "extra modular sets" house rule added, each marked "(house rule)".
 *  - Modular sets source: `Recommended` (the scenario's own pick, nothing added) or `Chosen` (the table picked others
 *    or added any extra, set-aside or house-rule set by choice).
 *  - House rules: names of the house rules switched on, semicolon-separated; empty for none.
 *  - Difficulty: `Standard` or `Expert` (`Extreme` for a per-villain version game).
 *  - Heroic level: the heroic level, 0 for none.
 *  - Mode: empty, `Skirmish`, or `Campaign: <name>` (`Expert Campaign: <name>`); a skirmish campaign game says both.
 *  - Players: how many heroes sat the game.
 *  - For each slot 1 to 4: Hero N (the plain hero name, "Spider-Man"), Identity N (the identity as the game shows it,
 *    "Spider-Man (Peter Parker)" where two heroes share a name), Aspects N (semicolon-separated), Piloted N (always
 *    `Yes`: every seat here is played by the one person at the device), Deck N (the deck's name), Decklist N (the
 *    MarvelCDB link when the deck was imported from MarvelCDB, else empty). An empty slot is empty cells.
 *  - Rounds: the round the game ended in.
 *  - Notes: "Played in Marvel Champions: Digital Edition vX", with how a loss came about.
 *
 * The text is RFC 4180 CSV (CRLF rows, quotes doubled) after a UTF-8 byte order mark, which Excel needs to read the
 * dashes and accents. A text cell that begins with `= + - @` gets a leading apostrophe so a spreadsheet does not read a
 * deck's name as a formula.
 */
import type { SaveMeta } from "../engine/game-storage.js";
import { CLIENT_VERSION } from "../version.js";
import {
  isPastGame,
  pastGameRowsOf,
  type PastGameNames,
  type PastGameReason,
  type PastGameRow,
} from "./past-games-model.js";

/** The seats a table holds, so the header has the same columns for every game. */
export const TRACKER_HERO_SLOTS = 4;

type Packs = SaveMeta["config"]["packs"];

/** What the export needs to say beyond a Past games row. */
export interface TrackerExportNames extends PastGameNames {
  /** A hero identity's plain hero-side name and alter ego, from the game's own packs first; undefined when unknown. */
  readonly heroFace: (
    identityCardId: string,
    packs: Packs,
  ) => { readonly hero: string; readonly alterEgo: string } | undefined;
  /** An encounter set's printed name, from the game's own packs first. */
  readonly setName: (setId: string, packs: Packs) => string | undefined;
  /** The scenario's recommended modular set ids, undefined when the scenario is not known. */
  readonly recommendedSets: (scenarioId: string, packs: Packs) => readonly string[] | undefined;
  /**
   * The modular sets a scenario sets aside when the game's config names none (The Hood's own default seven); undefined
   * when the scenario sets none aside or picks them at random (Mojo), which the saved config alone cannot say.
   */
  readonly defaultSetAsideSets?: (
    scenarioId: string,
    playerCount: number,
    packs: Packs,
  ) => readonly string[] | undefined;
}

export interface TrackerExportInput {
  readonly saves: readonly SaveMeta[];
  readonly names: TrackerExportNames;
  /** A saved deck's MarvelCDB link by `deckId`, for the decks imported from MarvelCDB (`marvelcdbLinksOf`). */
  readonly deckLinks?: ReadonlyMap<string, string>;
  readonly appVersion?: string;
}

export interface TrackerExportRow {
  /** Every cell, in `TRACKER_COLUMNS` order. */
  readonly cells: readonly string[];
}

export const TRACKER_COLUMNS: readonly string[] = [
  "Date",
  "Title",
  "Result",
  "Scenario",
  "Villain",
  "Modular sets",
  "Modular sets source",
  "House rules",
  "Difficulty",
  "Heroic level",
  "Mode",
  "Players",
  ...Array.from({ length: TRACKER_HERO_SLOTS }, (_, i) =>
    ["Hero", "Identity", "Aspects", "Piloted", "Deck", "Decklist"].map((name) => `${name} ${i + 1}`),
  ).flat(),
  "Rounds",
  "Notes",
];

const LOSS_NOTES: Readonly<Partial<Record<PastGameReason, string>>> = {
  schemeCompleted: "Lost: the main scheme was completed.",
  heroesDefeated: "Lost: every hero was defeated.",
  cardLoss: "Lost: a card's text lost the game.",
  encounterDeckExhausted: "Lost: the encounter deck ran out.",
};

/** The saved decks' MarvelCDB links by deck id: the deck's recorded URL only (a deck id is not a decklist id, so none is guessed). */
export function marvelcdbLinksOf(
  decks: readonly {
    readonly id: string;
    readonly source: { readonly kind: string; readonly marvelcdbDeckId?: string | null; readonly url?: string | null };
  }[],
): ReadonlyMap<string, string> {
  const links = new Map<string, string>();
  for (const deck of decks) {
    if (deck.source.kind !== "imported") continue;
    const link = deck.source.url;
    if (link) links.set(deck.id, link);
  }
  return links;
}

/** The tracker export, run: what the scene did, so Back pressed mid-way is testable (it delivers nothing then). */
export type TrackerExportOutcome =
  | { readonly kind: "left" }
  | { readonly kind: "none" }
  | { readonly kind: "done"; readonly games: number };

/**
 * Lists the saved decks for their decklist links (a bonus: a deck store that will not list leaves the cells empty),
 * then, only if the visit is still current, builds the CSV and hands it to `deliver`.
 */
export async function runTrackerExport(args: {
  readonly saves: readonly SaveMeta[];
  readonly names: TrackerExportNames;
  readonly listDecks: () => Promise<Parameters<typeof marvelcdbLinksOf>[0]>;
  readonly isCurrent: () => boolean;
  readonly deliver: (csv: string, fileName: string) => Promise<unknown>;
  readonly now: () => number;
}): Promise<TrackerExportOutcome> {
  let decks: Awaited<ReturnType<typeof args.listDecks>> = [];
  try {
    decks = await args.listDecks();
  } catch (cause) {
    console.warn("MC Tracker export: no decklist links", cause);
  }
  // Back pressed while the deck store was pending: no save dialog or share sheet over another screen.
  if (!args.isCurrent()) return { kind: "left" };
  const rows = trackerRowsOf({ saves: args.saves, names: args.names, deckLinks: marvelcdbLinksOf(decks) });
  if (rows.length === 0) return { kind: "none" };
  await args.deliver(trackerCsvOfRows(rows), trackerFileNameOf(args.now()));
  return { kind: "done", games: rows.length };
}

/** `2026-11-02`: the local calendar day of `ms`. */
function dayOf(ms: number): string {
  const date = new Date(ms);
  const pad = (n: number): string => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function difficultyOf(
  save: SaveMeta,
  campaignName: string | null,
): { readonly difficulty: string; readonly heroic: number; readonly mode: string } {
  const { config } = save;
  const modes = config.modes;
  const expert = modes?.expert === true || config.difficulty === "expert";
  const campaign = modes?.campaign;
  const parts: string[] = [];
  if (modes?.skirmish) parts.push("Skirmish");
  if (save.campaignId !== null || campaign) {
    parts.push(
      `${campaign?.expertCampaign ? "Expert Campaign" : "Campaign"}: ${campaignName ?? save.campaignId ?? ""}`.trim(),
    );
  }
  return {
    difficulty: config.difficulty === "extreme" ? "Extreme" : expert ? "Expert" : "Standard",
    heroic: modes?.heroic ?? 0,
    mode: parts.join("; "),
  };
}

function rowOf(row: PastGameRow, input: TrackerExportInput): TrackerExportRow {
  const { save } = row;
  const { names } = input;
  const packs = save.config.packs;
  // A pack's villain card is named by the game's own packs, as the row's label is.
  const gameNames = packs && packs.length > 0 && names.forPacks ? names.forPacks(packs) : names;
  const heroNames = row.seats.map((seat) => names.heroFace(seat.identityCardId, packs)?.hero ?? seat.name);
  const summaryVillains = save.summary?.villains ?? [];
  const villain =
    summaryVillains.length > 0
      ? summaryVillains.join("; ")
      : ((row.villainCardId ? gameNames.cardName?.(row.villainCardId) : undefined) ??
        row.villainName ??
        row.scenarioId);

  const chosen = save.config.modularSetIds;
  const recommended = names.recommendedSets(save.config.scenarioId, packs) ?? [];
  const extras = save.config.extraModularSetIds ?? [];
  const houseSets = save.config.houseModularSetIds ?? [];
  const setLabel = (id: string): string => names.setName(id, packs) ?? id;
  const explicitSetAside = save.config.setAsideModularSetIds;
  const setAside =
    explicitSetAside ?? names.defaultSetAsideSets?.(save.config.scenarioId, save.config.players.length, packs) ?? [];
  const setLabels = [
    ...(chosen ?? recommended).map(setLabel),
    ...extras.map(setLabel),
    ...setAside.map((id) => `${setLabel(id)} (set aside)`),
    ...houseSets.map((id) => `${setLabel(id)} (house rule)`),
  ];
  const sameAsRecommended =
    extras.length === 0 &&
    houseSets.length === 0 &&
    explicitSetAside === undefined &&
    (chosen === undefined || (chosen.length === recommended.length && chosen.every((id) => recommended.includes(id))));
  const houseRules = (save.config.houseRules ?? []).map(
    (id) => (packs ?? []).find((pack) => pack.id === id)?.name ?? id,
  );
  const { difficulty, heroic, mode } = difficultyOf(save, row.campaign);

  // `row.seats` leaves out a seat that sat the scenario out; the summary's seats and the config's players do not, so
  // each shown seat is matched to them by its unfiltered index (as `seatsOf` in past-games-model.ts walks them).
  const summarized = save.summary?.seats;
  const seatIndexes =
    summarized && summarized.length > 0
      ? summarized.flatMap((seat, i) => (seat.satOut === true ? [] : [i]))
      : save.config.players.flatMap((player, i) => {
          const identity =
            "identityCardId" in player ? player.identityCardId : gameNames.starterIdentity(player.starterDeckId);
          return identity ? [i] : [];
        });
  const slots: string[] = [];
  for (let slot = 0; slot < TRACKER_HERO_SLOTS; slot += 1) {
    const seat = row.seats[slot];
    if (!seat) {
      slots.push("", "", "", "", "", "");
      continue;
    }
    const at = seatIndexes[slot] ?? slot;
    const player = save.config.players[at];
    const deckId = save.summary?.seats?.[at]?.deckId ?? (player && "deckId" in player ? player.deckId : undefined);
    slots.push(
      heroNames[slot]!,
      seat.name,
      seat.aspects.join("; "),
      "Yes",
      seat.deckName ?? "",
      (deckId ? input.deckLinks?.get(deckId) : undefined) ?? "",
    );
  }
  const notes = [
    `Played in Marvel Champions: Digital Edition v${input.appVersion ?? CLIENT_VERSION}`,
    ...(row.result === "lost" ? [LOSS_NOTES[row.reason] ?? "Lost."] : []),
  ].join(". ");

  return {
    cells: [
      dayOf(row.endedAt),
      `${villain} — ${heroNames.join(" & ")}`,
      row.result === "won" ? "Win" : "Loss",
      row.villainName ?? row.scenarioId,
      villain,
      setLabels.join("; "),
      sameAsRecommended ? "Recommended" : "Chosen",
      houseRules.join("; "),
      difficulty,
      String(heroic),
      mode,
      String(row.seats.length),
      ...slots,
      String(row.round),
      notes,
    ],
  };
}

/** The export's rows, oldest game first (a log reads forward); won and lost games only. */
export function trackerRowsOf(input: TrackerExportInput): readonly TrackerExportRow[] {
  const finished = input.saves.filter((save) => isPastGame(save, input.appVersion));
  return pastGameRowsOf(finished, input.names, "all", input.appVersion)
    .filter((row) => row.result === "won" || row.result === "lost")
    .reverse()
    .map((row) => rowOf(row, input));
}

/**
 * One CSV cell: quoted when it holds a comma, quote, or line break; quotes doubled; text a spreadsheet would read as a
 * formula (a leading `=`, `+`, `-`, `@`, tab or carriage return) gets a leading apostrophe, so a deck name starting
 * with a sign arrives with that apostrophe.
 */
export function csvCell(value: string): string {
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return /[",\r\n]/.test(safe) ? `"${safe.replaceAll('"', '""')}"` : safe;
}

/** The UTF-8 byte order mark Excel looks for. */
export const CSV_BOM = "\uFEFF";

/** The file's text from rows already built: BOM, header, then a row per game, CRLF between rows (RFC 4180). */
export function trackerCsvOfRows(rows: readonly { readonly cells: readonly string[] }[]): string {
  const lines = [TRACKER_COLUMNS, ...rows.map((row) => row.cells)].map((cells) => cells.map(csvCell).join(","));
  return `${CSV_BOM}${lines.join("\r\n")}\r\n`;
}

/** The file's text: BOM, header, then a row per game, CRLF between rows (RFC 4180). */
export function trackerCsv(input: TrackerExportInput): string {
  return trackerCsvOfRows(trackerRowsOf(input));
}

/** The file's name: `marvel-champions-mc-tracker-2026-11-16.csv`. */
export function trackerFileNameOf(now: number): string {
  return `marvel-champions-mc-tracker-${dayOf(now)}.csv`;
}
