/**
 * "Cards left": what is still unseen of a deck, as counts and never in order (`scenes/deck-left.ts`). Off by setting
 * where it could spoil a scenario (`deckLeftTabsOf`).
 *
 * Working this out is the players' right: a deck's order is secret (RRG 1.8 p. 15 "Deck", p. 17 "Encounter Deck"), but
 * they built the deck and every discard pile is open (p. 16), and you may count what is left (ruling, Jan 11, 2026 (1)).
 * So the rows are sorted by type and name, and nothing here reads a deck's order.
 *
 * RRG 1.8 p. 11 Boost, p. 15 Dealt, p. 19 Find: facedown cards are hidden until turned faceup; they are counted as
 * unseen with their home deck, so the list cannot reveal them by elimination. They are not in the deck, so the view
 * keeps the deck's own count and says how many are facedown. A facedown card stays against its home deck across a
 * reshuffle: it left before the reshuffle and the discard pile that became the new deck does not hold it.
 *
 * Two kinds of card are counted, never named, in one row of their own, because the players did not choose them: a
 * modular set no card of which has turned up in a Civil War game played blind (docs/phase7-wave10-client.md 2.6), and
 * the cards of Shadow Labyrinth's drawn villain while it waits facedown (docs/phase7-shadowland.md, question 2: it
 * "stays facedown until Whisper in the Dark or 2A reveals it"), whose linked cards would name it. That villain's set
 * holds only it and its linked cards; back in the set-aside area facedown, it is masked again.
 *
 * Above the encounter deck's cards sit the faces of the villain in play: the stage showing and the ones still ahead, on
 * every side (Hela's A1 and A2). The stages already beaten have left the game (RRG 1.8 p. 47), a stage before the
 * game's first was never in it, and a villain still set aside is not listed.
 */
import type { AnyCard, VillainCard } from "@mc/content";
import {
  activeEncounterDeck,
  activeEncounterDeckId,
  boostIconsFor,
  cardOf,
  getInstance,
  getPlayer,
  hasStarIcon,
  locateCard,
  type EngineDeps,
  type GameState,
  type InstanceId,
  type PlayerId,
} from "@mc/engine";
import { artFor, CARD_BACKS, type ArtSource } from "../art/art-source.js";
import type { Settings } from "../settings.js";
import type { BlindReveal } from "./civil-war-blind.js";
import { faceRefOf, type FaceRef } from "./civil-war-builder-art.js";
import { faceVisible } from "./visibility.js";

export type DeckLeftTab = "hero" | "encounter";

export const DECK_LEFT_TAB_LABELS: Readonly<Record<DeckLeftTab, string>> = {
  hero: "Your deck",
  encounter: "Encounter deck",
};

/** The tabs these settings open: the encounter's for its list, its boost line, or both. Empty: no entry point at all. */
export function deckLeftTabsOf(
  settings: Pick<Settings, "deckCountsHero" | "deckCountsEncounter" | "deckBoostAverage">,
): readonly DeckLeftTab[] {
  return [
    ...(settings.deckCountsHero ? (["hero"] as const) : []),
    ...(settings.deckCountsEncounter || settings.deckBoostAverage ? (["encounter"] as const) : []),
  ];
}

export interface DeckLeftRow {
  /** Stable within a view: the card id, or "hidden" for the unnamed cards. */
  readonly key: string;
  readonly name: string;
  readonly count: number;
  /** The printed card; null for the unnamed cards, which have no hover and no Inspect. */
  readonly face: FaceRef | null;
  readonly art: ArtSource | null;
  /** A villain stage's row, which has no count: whether it is the face up now. Absent on a deck card's. */
  readonly inPlay?: boolean;
}

/** RRG 1.8 p. 11: a star is not a boost icon; stars are reported separately from the icon average. */
export interface BoostTally {
  readonly icons: number;
  /** The cards the tally read: every unseen card that has a name here. */
  readonly cards: number;
  /** `icons / cards`; 0 with no cards. */
  readonly average: number;
  /** Cards printing a star, whatever their icons. */
  readonly stars: number;
  /** The unnamed cards, left out of the tally. */
  readonly hidden: number;
}

export interface DeckLeftView {
  readonly tab: DeckLeftTab;
  /** The deck's own count, as its pile shows it. */
  readonly inDeck: number;
  /** Cards out of the deck, never turned over, that are listed with it. */
  readonly facedown: number;
  /** Empty when the list is off and only the boost line shows. */
  readonly rows: readonly DeckLeftRow[];
  /** The villain's faces above the cards (see the file comment); empty off the encounter tab or with the list off. */
  readonly stages: readonly DeckLeftRow[];
  /** Null when the boost line is off, and on the hero tab. */
  readonly boost: BoostTally | null;
  /** The lines above the list. */
  readonly summary: readonly string[];
}

const TYPE_ORDER: readonly { readonly type: string; readonly one: string; readonly many: string }[] = [
  { type: "ally", one: "ally", many: "allies" },
  { type: "event", one: "event", many: "events" },
  { type: "resource", one: "resource", many: "resources" },
  { type: "support", one: "support", many: "supports" },
  { type: "upgrade", one: "upgrade", many: "upgrades" },
  { type: "player_side_scheme", one: "player side scheme", many: "player side schemes" },
  { type: "minion", one: "minion", many: "minions" },
  { type: "treachery", one: "treachery", many: "treacheries" },
  { type: "attachment", one: "attachment", many: "attachments" },
  { type: "environment", one: "environment", many: "environments" },
  { type: "side_scheme", one: "side scheme", many: "side schemes" },
  { type: "obligation", one: "obligation", many: "obligations" },
];

const typeRank = (type: string): number => {
  const rank = TYPE_ORDER.findIndex((entry) => entry.type === type);
  return rank < 0 ? TYPE_ORDER.length : rank;
};

/**
 * Cards of this home that no one may read and that are not in a deck: boost cards, dealt cards, a facedown Drone, and a
 * player card tucked facedown (under Operation Zero Tolerance, 32098; Bastion's Machinations, 32169). An encounter card
 * tucked facedown stays out: no card takes one unseen out of an encounter deck, and some come from the set-aside area,
 * which were never in it (Kang's stages). A player card tucked from a hand, play or a discard pile is known already, and
 * listing it only under-claims.
 */
function facedownOf(state: GameState, deps: EngineDeps, belongs: (id: InstanceId) => boolean): readonly InstanceId[] {
  return (Object.keys(state.instances) as InstanceId[]).filter((id) => {
    const instance = getInstance(state, id);
    if (!instance || instance.faceup || !belongs(id)) return false;
    const zone = locateCard(state, id)?.kind;
    const hidden =
      zone === "dealtEncounter" ||
      zone === "boost" ||
      instance.facedownAs !== null ||
      (zone === "tucked" && instance.home.kind === "player");
    return hidden && !faceVisible(state, id, { deps });
  });
}

/** The unseen cards of a tab: the deck first, then the facedown ones. The ids never reach a row in this order. */
function poolOf(
  state: GameState,
  deps: EngineDeps,
  tab: DeckLeftTab,
  perspectiveId: PlayerId,
): { readonly deck: readonly InstanceId[]; readonly facedown: readonly InstanceId[] } {
  if (tab === "hero") {
    const belongs = (id: InstanceId): boolean => {
      const instance = getInstance(state, id);
      return instance?.ownerId === perspectiveId && instance.home.kind === "player";
    };
    return { deck: getPlayer(state, perspectiveId)?.deck ?? [], facedown: facedownOf(state, deps, belongs) };
  }
  // Each villain keeps its own deck (The Wrecking Crew): this is the active one, the one the board's pile shows.
  const deckId = activeEncounterDeckId(state);
  const belongs = (id: InstanceId): boolean => {
    const home = getInstance(state, id)?.home;
    return home?.kind === "encounterDeck" ? home.deckId === deckId : home?.kind === "activeEncounterDeck";
  };
  return { deck: activeEncounterDeck(state).deck, facedown: facedownOf(state, deps, belongs) };
}

const setIdsOf = (card: AnyCard | undefined): readonly string[] =>
  card && "encounterSetIds" in card ? (card.encounterSetIds as readonly string[]) : [];

/** The encounter sets whose cards are not named yet: see the file comment. */
function unnamedSetsOf(state: GameState, reveal: BlindReveal | null): ReadonlySet<string> {
  const unnamed = new Set(reveal?.modularSetIds.filter((id) => !reveal.revealedSetIds.has(id)) ?? []);
  const villain = state.chosenVillainId;
  if (villain && state.encounterSetAside.includes(villain) && !getInstance(state, villain)?.faceup)
    for (const id of setIdsOf(cardOf(state, villain))) unnamed.add(id);
  return unnamed;
}

const plural = (count: number, one: string, many: string): string => `${count} ${count === 1 ? one : many}`;

/** "Boost: 1.4 icons per card (31 icons in 22 cards), plus 3 ★". */
export function boostSummaryOf(boost: BoostTally): string {
  if (boost.cards === 0 && boost.hidden === 0) return "Boost: no cards left";
  const stars = boost.stars > 0 ? `, plus ${boost.stars} ★` : "";
  const hidden = boost.hidden > 0 ? ` · ${plural(boost.hidden, "hidden card", "hidden cards")} not counted` : "";
  return (
    `Boost: ${boost.average.toFixed(1)} icons per card ` +
    `(${plural(boost.icons, "icon", "icons")} in ${plural(boost.cards, "card", "cards")})${stars}${hidden}`
  );
}

const NUMERALS: readonly string[] = ["", "I", "II", "III", "IV", "V"];

/** The villain stages in play and still ahead, printed side first: see the file comment. */
function villainStagesOf(state: GameState): readonly DeckLeftRow[] {
  return state.villains.flatMap((villain) => {
    if (villain.defeated) return [];
    const card = cardOf(state, villain.instanceId) as VillainCard | undefined;
    if (card?.type !== "villain") return [];
    return card.sides.flatMap((side, sideIndex) =>
      side.stages.flatMap((stage, stageIndex): readonly DeckLeftRow[] => {
        if (stageIndex < villain.stageIndex || stageIndex > villain.lastStageIndex) return [];
        const label = stage.stageLabel ?? NUMERALS[stage.stageNumber] ?? String(stage.stageNumber);
        const name = `${side.name} ${label}`;
        const face = faceRefOf(card, { kind: "villainStage", sideIndex, stageIndex }, name);
        return [
          {
            key: `stage:${villain.instanceId as string}:${sideIndex}:${stageIndex}`,
            name,
            count: 1,
            face,
            art: artFor(card, face.face),
            inPlay: side.side === villain.side && stageIndex === villain.stageIndex,
          },
        ];
      }),
    );
  });
}

/**
 * The grid's cells, left to right: the villain's stages, blanks to the end of their last row so the cards start on a
 * new one, then the cards.
 */
export function deckLeftCellsOf(view: DeckLeftView | null, columns: number): readonly (DeckLeftRow | null)[] {
  if (!view) return [];
  const stages = view.stages.length;
  const blanks = stages === 0 || view.rows.length === 0 ? 0 : (columns - (stages % columns)) % columns;
  return [...view.stages, ...Array<null>(blanks).fill(null), ...view.rows];
}

export function deckLeftViewOf(
  state: GameState,
  deps: EngineDeps,
  tab: DeckLeftTab,
  perspectiveId: PlayerId,
  shown: { readonly list: boolean; readonly boost: boolean },
  reveal: BlindReveal | null = null,
): DeckLeftView {
  const { deck, facedown } = poolOf(state, deps, tab, perspectiveId);
  const pool = [...deck, ...facedown];

  const unnamed = unnamedSetsOf(state, reveal);
  const counts = new Map<string, { card: AnyCard; count: number }>();
  const named: InstanceId[] = [];
  let hidden = 0;
  for (const id of pool) {
    const card = cardOf(state, id);
    if (!card) continue;
    if (setIdsOf(card).some((setId) => unnamed.has(setId))) {
      hidden += 1;
      continue;
    }
    named.push(id);
    const entry = counts.get(card.id as string);
    if (entry) entry.count += 1;
    else counts.set(card.id as string, { card, count: 1 });
  }

  const sorted = [...counts.values()].sort(
    (a, b) =>
      typeRank(a.card.type) - typeRank(b.card.type) ||
      a.card.name.localeCompare(b.card.name) ||
      (a.card.id as string).localeCompare(b.card.id as string),
  );
  const rows: readonly DeckLeftRow[] = !shown.list
    ? []
    : [
        ...sorted.map(({ card, count }): DeckLeftRow => {
          const face = faceRefOf(card);
          return { key: card.id as string, name: card.name, count, face, art: artFor(card, face.face) };
        }),
        ...(hidden > 0
          ? [{ key: "hidden", name: "Hidden cards", count: hidden, face: null, art: CARD_BACKS.encounter }]
          : []),
      ];

  let boost: BoostTally | null = null;
  if (tab === "encounter" && shown.boost) {
    const icons = named.reduce((sum, id) => sum + boostIconsFor(state, deps, id), 0);
    boost = {
      icons,
      cards: named.length,
      average: named.length === 0 ? 0 : icons / named.length,
      stars: named.filter((id) => hasStarIcon(state, id)).length,
      hidden,
    };
  }

  const typeCounts = TYPE_ORDER.flatMap(({ type, one, many }) => {
    const count = sorted.filter((entry) => entry.card.type === type).reduce((sum, entry) => sum + entry.count, 0);
    return count > 0 ? [plural(count, one, many)] : [];
  });
  const hiddenWord = hidden > 0 ? [plural(hidden, "hidden card", "hidden cards")] : [];
  const typeLine = [...typeCounts, ...hiddenWord].join(" · ");
  const stages = tab === "encounter" && shown.list ? villainStagesOf(state) : [];
  const summary = [
    ...(facedown.length > 0 ? [`${pool.length} unseen: ${deck.length} in deck, ${facedown.length} facedown`] : []),
    ...(shown.list && typeLine !== "" ? [typeLine] : []),
    ...(boost ? [boostSummaryOf(boost)] : []),
    // Last, over the tiles it names.
    ...(stages.length > 0 ? [`Villain stages: ${stages.map((stage) => stage.name).join(" · ")}`] : []),
  ];
  return { tab, inDeck: deck.length, facedown: facedown.length, rows, stages, boost, summary };
}
