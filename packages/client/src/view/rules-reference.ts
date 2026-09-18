/**
 * Rules Reference (docs/phase4-screen-gaps.md §3 "W4"): the glossary, filtered by
 * scope and search, the villain phase order, and the scenario's card list.
 *
 * **Two scopes.** "On your table" (the default with a live game) means every card
 * instance sitting somewhere a player can see its live keywords right now: every
 * identity, every player's play area, the villain area (villain(s), minions, side
 * schemes, environments) and the main scheme, plus whatever is attached to or
 * boosted onto any of those. A card asleep in a deck or discard pile doesn't widen
 * it just because it's in the pool — RRG p. 12 "Choose (Game Element)" and the
 * client's own `view/visibility.ts` already draw that line for hidden information;
 * this reuses the same idea for "what's relevant right now" rather than a
 * rules-visibility rule. "All rules" (`rulesGlossaryPoolOf`; the only scope with no
 * game) is every entry regardless of the table, with cards drawn from the whole
 * pool instead — owner feedback (2026-09-18) asked the Rules overlay to show "card
 * art if applicable" even for a keyword nothing on the table happens to carry.
 *

 * **The three entries `@mc/content`'s glossary leaves out** — "exhausted",
 * "ready", "facedown boost card" — are added here, from the client side, exactly
 * as `schema/glossary.ts`'s own file header calls for: they're genuine RRG 1.8
 * glossary terms (pp. 19, 36, 11 respectively — see `TABLE_STATE_ENTRIES`'s own
 * comment on why the third page differs from the number docs/phase4-screen-gaps.md
 * guessed), but they're runtime instance state (`CardInstance.exhausted`,
 * `CardInstance.boostCards`) that only `@mc/engine` models, not a `@mc/content`
 * schema enum — so `@mc/content` can't own them without depending on the engine,
 * which the dependency direction forbids. These three are always shown (they're
 * true of essentially every game state, not conditional on what's in play), and
 * search filters them exactly like every other entry.
 */
import type { AnyCard, KeywordInstance, KeywordName } from "@mc/content";
import { GLOSSARY_ENTRIES, glossaryEntry, type GlossaryEntry, type GlossarySource } from "@mc/content";
import {
  getInstance,
  keywordsOf,
  type EngineDeps,
  type GameState,
  type InstanceId,
  type StatusCounts,
} from "@mc/engine";

/**
 * A card that carries a glossary entry's keyword or status right now — either
 * live on the table (`instanceId` set, from `state.cardPool`) or, with no game
 * or in "all rules" scope, anywhere in the pool (`instanceId` undefined, so
 * Inspect is opened by `cardId` instead). Deduped by `cardId`: two instances
 * of the same printed card contribute one thumbnail, not two.
 */
export interface RulesCardRef {
  readonly cardId: string;
  readonly instanceId?: string;
  readonly name: string;
}

export interface RulesEntry {
  readonly id: string;
  readonly displayName: string;
  readonly definition: string;
  /** e.g. "RRG 1.8 p. 21", "February 28, 2026 - Ruling 4", joined by " · " when there is more than one. */
  readonly citeLabel: string;
  readonly unverified: boolean;
  readonly conflict?: string;
  /**
   * Cards that print this keyword (or, for a status, hold it right now) — "card art if
   * applicable" (owner feedback). Alphabetical by name. Empty for the three table-state
   * entries (`TABLE_STATE_ENTRIES`) and, in pool scope, for the three statuses (a status is
   * runtime instance state, never printed on a card, so a static pool has nothing to show).
   */
  readonly cardRefs: readonly RulesCardRef[];
}

/**
 * The three RRG glossary terms `@mc/content`'s glossary leaves out (see this
 * module's own header). Original paraphrases, not FFG's wording, matching
 * `schema/glossary.ts`'s own convention.
 *
 * Page check: this repo's copy of `mc_rulesreference_v18_compressed.pdf`, cross-checked
 * against its own two-page glossary INDEX (pp. 2-3) — "Exhausted" p. 19, "Ready" p. 36,
 * "Boost, Boost Icon" p. 11. docs/phase4-screen-gaps.md's W4 entry guessed "pp. 19, 36, 47"
 * for the three; 47 is where "Villainous" is cited (a keyword that *uses* a facedown boost
 * card), not where "Boost, Boost Icon" itself is defined — corrected here to p. 11.
 */
const TABLE_STATE_ENTRIES: readonly RulesEntry[] = [
  {
    id: "exhausted",
    displayName: "Exhausted",
    definition: "A card rotated sideways to show it's been used or committed this way can't be exhausted again until something readies it.",
    citeLabel: "RRG 1.8 p. 19",
    unverified: false,
    cardRefs: [],
  },
  {
    id: "ready",
    displayName: "Ready",
    definition: "A card's normal, upright state. Readying an exhausted card returns it to this state — unless readying it has its own cost the controller declines to pay, in which case it stays exhausted.",
    citeLabel: "RRG 1.8 p. 36",
    unverified: false,
    cardRefs: [],
  },
  {
    id: "facedownBoostCard",
    displayName: "Facedown boost card",
    definition: "Dealt to an enemy from its encounter deck the moment it attacks or schemes (or, for a villainous minion, whenever it uses a basic power), then turned face up one at a time to add its icons to that activation's total.",
    citeLabel: "RRG 1.8 p. 11",
    unverified: false,
    cardRefs: [],
  },
];

function citeLabelOf(sources: readonly [GlossarySource, ...GlossarySource[]]): string {
  return sources
    .map((source) => {
      switch (source.kind) {
        case "rrg":
          return `RRG 1.8 p. ${source.page}`;
        case "ruling":
          return source.date;
        case "insert-not-in-repo":
          return `${source.product} (not in this repo)`;
      }
    })
    .join(" · ");
}

function toRulesEntry(entry: GlossaryEntry, cardRefs: readonly RulesCardRef[] = []): RulesEntry {
  return {
    id: entry.id,
    displayName: entry.displayName,
    definition: entry.definition,
    citeLabel: citeLabelOf(entry.sources),
    unverified: entry.unverified ?? false,
    cardRefs,
    ...(entry.conflict ? { conflict: entry.conflict } : {}),
  };
}

/** Every instance id "on the table" right now: identities, play areas, the villain area, the main scheme, and whatever is attached to or boosted onto any of those. */
function tableInstanceIds(state: GameState): readonly InstanceId[] {
  const seats = state.players.flatMap((player) => [player.identity.instanceId, ...player.playArea]);
  const base = [...seats, ...state.villainArea, state.mainScheme.instanceId];
  const withHosted = new Set<InstanceId>(base);
  for (const id of base) {
    const instance = getInstance(state, id);
    if (!instance) continue;
    for (const attached of instance.attachments) withHosted.add(attached);
    for (const boost of instance.boostCards) withHosted.add(boost);
  }
  return [...withHosted];
}

/** Dedupes `refs` by `cardId` (first one seen wins its `instanceId`) and sorts alphabetically by name. */
function dedupeCardRefs(refs: readonly RulesCardRef[]): readonly RulesCardRef[] {
  const byCardId = new Map<string, RulesCardRef>();
  for (const ref of refs) if (!byCardId.has(ref.cardId)) byCardId.set(ref.cardId, ref);
  return [...byCardId.values()].sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Every keyword name and status name live on some instance "on the table" right now (see the
 * module header for what "on the table" means), each with the cards that carry it there.
 */
function tableAssociationsOf(
  state: GameState,
  deps: EngineDeps,
): { readonly keywords: ReadonlyMap<KeywordName, readonly RulesCardRef[]>; readonly statuses: ReadonlyMap<keyof StatusCounts, readonly RulesCardRef[]> } {
  const keywordRefs = new Map<KeywordName, RulesCardRef[]>();
  const statusRefs = new Map<keyof StatusCounts, RulesCardRef[]>();
  for (const id of tableInstanceIds(state)) {
    const instance = getInstance(state, id);
    if (!instance) continue;
    const card = state.cardPool[instance.cardId as unknown as string] as AnyCard | undefined;
    const ref: RulesCardRef = { cardId: instance.cardId as unknown as string, instanceId: id as unknown as string, name: card?.name ?? "Unknown card" };
    for (const keyword of keywordsOf(state, id, deps)) {
      const list = keywordRefs.get(keyword.name) ?? [];
      list.push(ref);
      keywordRefs.set(keyword.name, list);
    }
    for (const status of ["stunned", "confused", "tough"] as const) {
      if (instance.statuses[status] <= 0) continue;
      const list = statusRefs.get(status) ?? [];
      list.push(ref);
      statusRefs.set(status, list);
    }
  }
  return {
    keywords: new Map([...keywordRefs.entries()].map(([name, refs]) => [name, dedupeCardRefs(refs)])),
    statuses: new Map([...statusRefs.entries()].map(([name, refs]) => [name, dedupeCardRefs(refs)])),
  };
}

const normalize = (text: string): string => text.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

/** `entries`, narrowed to the ones matching `query` in their term, definition, or an associated card's name — case- and accent-insensitive. Empty query matches everything. */
function filterByQuery(entries: readonly RulesEntry[], query: string): readonly RulesEntry[] {
  const needle = normalize(query.trim());
  if (!needle) return entries;
  return entries.filter(
    (entry) =>
      normalize(entry.displayName).includes(needle) ||
      normalize(entry.definition).includes(needle) ||
      entry.cardRefs.some((ref) => normalize(ref.name).includes(needle)),
  );
}

/**
 * Every printed keyword name on `card`, across whichever face(s)/stage(s) carry keywords for
 * its type (`@mc/content`'s schema puts `keywords` in a different place per card type — see
 * `printedKeywordsOf` in `@mc/engine` for the instance-aware equivalent this mirrors for a
 * static pool card with no live game/instance behind it).
 */
export function cardKeywordNames(card: AnyCard): ReadonlySet<KeywordName> {
  const names = new Set<KeywordName>();
  const addAll = (list: readonly KeywordInstance[]): void => {
    for (const keyword of list) names.add(keyword.name);
  };
  switch (card.type) {
    case "hero_identity":
      addAll(card.hero.keywords);
      addAll(card.alterEgo.keywords);
      break;
    case "villain":
      for (const side of card.sides) for (const stage of side.stages) addAll(stage.keywords);
      break;
    case "main_scheme":
      for (const stage of card.stages) addAll(stage.keywords);
      break;
    default:
      if ("keywords" in card) addAll(card.keywords);
  }
  return names;
}

/**
 * The glossary panel's own "on your table" model: every entry relevant to the current table,
 * each carrying the table's own cards that show it (`RulesEntry.cardRefs`, by `instanceId` so
 * a thumbnail opens Inspect on the live card), filtered by `query` (case- and accent-insensitive
 * substring match over the term, its definition, or an associated card's name — empty matches
 * everything).
 */
export function rulesGlossaryOf(state: GameState, deps: EngineDeps, query = ""): readonly RulesEntry[] {
  const assoc = tableAssociationsOf(state, deps);
  const entries: RulesEntry[] = [];
  for (const [name, refs] of assoc.keywords) {
    const entry = glossaryEntry(name);
    if (entry) entries.push(toRulesEntry(entry, refs));
  }
  for (const [status, refs] of assoc.statuses) {
    const entry = glossaryEntry(status);
    if (entry) entries.push(toRulesEntry(entry, refs));
  }
  entries.push(...TABLE_STATE_ENTRIES);
  entries.sort((a, b) => a.displayName.localeCompare(b.displayName));
  return filterByQuery(entries, query);
}

/**
 * The glossary's "all rules" scope (no game, or the player asked to see every term regardless of
 * the table): every entry `@mc/content` knows, each carrying every *pool* card that prints its
 * keyword (by `cardId` — there is no live instance to point Inspect at), filtered the same way
 * `rulesGlossaryOf` filters the table scope. The three status entries always carry no cards here
 * (a status is runtime instance state, never printed — see `RulesEntry.cardRefs`'s own doc
 * comment), and neither do the three table-state entries.
 */
export function rulesGlossaryPoolOf(pool: readonly AnyCard[], query = ""): readonly RulesEntry[] {
  const byKeyword = new Map<KeywordName, RulesCardRef[]>();
  for (const card of pool) {
    for (const name of cardKeywordNames(card)) {
      const list = byKeyword.get(name) ?? [];
      list.push({ cardId: card.id as string, name: card.name });
      byKeyword.set(name, list);
    }
  }
  const entries: RulesEntry[] = GLOSSARY_ENTRIES.map((entry) => toRulesEntry(entry, dedupeCardRefs(byKeyword.get(entry.id as KeywordName) ?? [])));
  entries.push(...TABLE_STATE_ENTRIES);
  entries.sort((a, b) => a.displayName.localeCompare(b.displayName));
  return filterByQuery(entries, query);
}

/** Every glossary entry `@mc/content` and this module know about, with no card associations — kept for the existing "does the flagged conflict survive" test; a screen wanting cards too should use `rulesGlossaryPoolOf`. */
export function everyGlossaryEntry(): readonly RulesEntry[] {
  return [...GLOSSARY_ENTRIES.map((entry) => toRulesEntry(entry)), ...TABLE_STATE_ENTRIES].sort((a, b) => a.displayName.localeCompare(b.displayName));
}

export interface VillainPhaseStep {
  readonly id: "placeThreat" | "enemyActivations" | "dealEncounterCards" | "revealEncounterCards" | "passFirstPlayer" | "endOfRound";
  readonly label: string;
  readonly detail: string;
  /** True for the step the live game is on right now, so the reference doubles as "where are we". */
  readonly current: boolean;
  /**
   * Which picture illustrates this step, when one exists — the scene resolves this to a real
   * `CardFace`/instance (this module doesn't import Phaser/art types): `"mainScheme"` is the
   * live main scheme's own stage art, `"villain"` the live active villain's own stage art
   * (both null without a game — there is no card to point at), `"encounterBack"` is always
   * available (one of the three bundled card backs), and `null` means no picture illustrates
   * this step (RRG 1.8 p. 47 steps 5–6 are procedural, not a card).
   */
  readonly art: "mainScheme" | "villain" | "encounterBack" | null;
}

/**
 * The villain phase's own six steps (RRG 1.8 "Villain Phase", p. 47), worded as an
 * original paraphrase rather than the RRG's own text. `state` is optional so a
 * caller without a live game (or reading this list outside of Pause) can still
 * get the reference; when given, exactly the step `state.step` is on is marked
 * `current` — and only when the game is actually in the villain phase, since the
 * order is still worth reading during the player phase or setup.
 */
export function villainPhaseOrder(state?: GameState): readonly VillainPhaseStep[] {
  const currentKind = state && state.step.phase === "villain" ? state.step.kind : null;
  const steps: readonly Omit<VillainPhaseStep, "current">[] = [
    { id: "placeThreat", label: "1. Place threat", detail: "The main scheme's acceleration value, plus one per acceleration icon/token in play, is placed on it.", art: "mainScheme" },
    { id: "enemyActivations", label: "2. Enemies activate", detail: "In player order: the villain activates against that player, then each minion engaged with them, in that player's choice of order.", art: "villain" },
    { id: "dealEncounterCards", label: "3. Deal encounter cards", detail: "Each player is dealt one encounter card facedown, plus one more per hazard icon in play.", art: "encounterBack" },
    { id: "revealEncounterCards", label: "4. Reveal encounter cards", detail: "The first player reveals and resolves their dealt cards one at a time, then each other player does the same in turn order.", art: "encounterBack" },
    { id: "passFirstPlayer", label: "5. Pass first player", detail: "The first player token passes to the next player clockwise.", art: null },
    { id: "endOfRound", label: "6. End of round", detail: "\"Until end of round\" effects expire, delayed effects resolve, and a new round begins.", art: null },
  ];
  return steps.map((step) => ({ ...step, current: step.id === currentKind }));
}
