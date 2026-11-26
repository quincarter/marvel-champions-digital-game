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
 * glossary terms (pp. 19, 36, 11 respectively — see `tableStateEntries`'s own
 * comment on why the third page differs from the number docs/phase4-screen-gaps.md
 * guessed), but they're runtime instance state (`CardInstance.exhausted`,
 * `CardInstance.boostCards`) that only `@mc/engine` models, not a `@mc/content`
 * schema enum — so `@mc/content` can't own them without depending on the engine,
 * which the dependency direction forbids. These three are always shown (they're
 * true of essentially every game state, not conditional on what's in play), and
 * search filters them exactly like every other entry.
 *
 * **Basic concepts** (guided mode G3a) are `@mc/content`'s `kind: "concept"` glossary
 * entries — threat, main scheme, thwart, and the rest of a first-time player's starting
 * vocabulary. They're never printed on a card and never table/instance state, so unlike a
 * keyword or status they don't belong to "what's on your table right now" the way
 * `tableAssociationsOf` means it — Pause's own "on the table" cards and count
 * (`rulesGlossaryOf`'s default) leave them out. The Rules reference screen's own glossary
 * *tab*, though, wants them alongside everything else a first-time player might search for
 * regardless of scope — it opts in via `rulesGlossaryOf`'s `includeConcepts` option
 * (`conceptEntries` below) — and `rulesGlossaryPoolOf`'s "all rules" scope always includes
 * them too, the same way the three table-state entries are always included there.
 */
import { queryScoreOf } from "./deck-search.js";
import type { AnyCard, KeywordInstance, KeywordName } from "@mc/content";
import { GLOSSARY_ENTRIES, glossaryEntry, type GlossaryEntry, type GlossarySource } from "@mc/content";
import { originNoteOf } from "./new-in-box-model.js";
import { ASPECT_CARD_DEFINITION } from "./resource-limit.js";
import { artLanguageNow } from "../art/art-source.js";
import { GLOSSARY_ES } from "../content/glossary-es.js";
import { t, type MessageKey } from "../i18n/translate.js";
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
  /** e.g. "RRG 1.8 p. 21", "February 28, 2026 - Ruling 4", joined by " · " when there is more than one. Carries the implementer-facing flags ("(not in this repo)", "UNVERIFIED", "RULING CONFLICT") a screen drawing for a *player* should never render as-is — see `playerCiteLabel`. */
  readonly citeLabel: string;
  /** `citeLabel` without the implementer-facing flags — the source(s) alone, worded for a player (`playerCiteLabelOf`). */
  readonly playerCiteLabel: string;
  readonly unverified: boolean;
  /** Implementer-facing detail on an unsettled ruling; never rendered to a player directly — see `playerNote`. */
  readonly conflict?: string;
  /** The player-facing one-liner for `conflict`, when there is one — what a glossary card should actually render. */
  readonly playerNote?: string;
  /**
   * Cards that print this keyword (or, for a status, hold it right now) — "card art if
   * applicable" (owner feedback). Alphabetical by name. Empty for the three table-state
   * entries (`tableStateEntries`) and, in pool scope, for the three statuses (a status is
   * runtime instance state, never printed on a card, so a static pool has nothing to show).
   */
  readonly cardRefs: readonly RulesCardRef[];
  /** "Added with Mutant Genesis · applies to Core cards too", for an entry written for a later box that Core cards already use (`originNoteOf`). */
  readonly originNote?: string;
  /** The box page `originNote` links to (`BoxDef.id`). */
  readonly originBoxId?: string;
  /** The English term, when `displayName` is in another language: a search for "retaliate" still finds "Represalia X". */
  readonly englishName?: string;
}

/**
 * An entry's name, definition and player note in the player's language, read at call time so a language switch
 * applies: Spanish from `content/glossary-es.ts` when the card language is Spanish, else the English as given.
 */
function wordsOf(
  id: string,
  english: { readonly name: string; readonly definition: string; readonly note?: string },
): { readonly name: string; readonly definition: string; readonly note?: string; readonly englishName?: string } {
  const spanish = artLanguageNow() === "es" ? GLOSSARY_ES[id] : undefined;
  if (!spanish) return english;
  return {
    name: spanish.name,
    definition: spanish.definition,
    ...(english.note !== undefined ? { note: spanish.note ?? english.note } : {}),
    englishName: english.name,
  };
}

/**
 * The three RRG glossary terms `@mc/content`'s glossary leaves out (see this
 * module's own header). Original paraphrases, not FFG's wording, matching
 * `schema/glossary.ts`'s own convention.
 *
 * Page check: this repo's copy of `docs/rules/mc_rulesreference_v18_compressed.pdf`, cross-checked
 * against its own two-page glossary INDEX (pp. 2-3) — "Exhausted" p. 19, "Ready" p. 36,
 * "Boost, Boost Icon" p. 11. docs/phase4-screen-gaps.md's W4 entry guessed "pp. 19, 36, 47"
 * for the three; 47 is where "Villainous" is cited (a keyword that *uses* a facedown boost
 * card), not where "Boost, Boost Icon" itself is defined — corrected here to p. 11.
 */
const TABLE_STATE_SOURCES: readonly {
  readonly id: string;
  readonly name: string;
  readonly definition: string;
  readonly cite: string;
}[] = [
  {
    id: "exhausted",
    name: "Exhausted",
    definition:
      "A card rotated sideways to show it's been used or committed this way can't be exhausted again until something readies it.",
    cite: "RRG 1.8 p. 19",
  },
  {
    id: "ready",
    name: "Ready",
    definition:
      "A card's normal, upright state. Readying an exhausted card returns it to this state — unless readying it has its own cost the controller declines to pay, in which case it stays exhausted.",
    cite: "RRG 1.8 p. 36",
  },
  {
    id: "facedownBoostCard",
    name: "Facedown boost card",
    definition:
      "Dealt to an enemy from its encounter deck the moment it attacks or schemes (or, for a villainous minion, whenever it uses a basic power), then turned face up one at a time to add its icons to that activation's total.",
    cite: "RRG 1.8 p. 11",
  },
];

/** The three table-state entries, in the player's language (built per call, so a language switch applies). */
function tableStateEntries(): readonly RulesEntry[] {
  return TABLE_STATE_SOURCES.map((source) => {
    const words = wordsOf(source.id, source);
    return {
      id: source.id,
      displayName: words.name,
      definition: words.definition,
      citeLabel: source.cite,
      playerCiteLabel: source.cite,
      unverified: false,
      cardRefs: [],
      ...(words.englishName ? { englishName: words.englishName } : {}),
    };
  });
}

/**
 * Basic-concept entries (guided mode G3a): `@mc/content`'s `GlossaryEntry`s with
 * `kind: "concept"` (threat, main scheme, thwart, ...). Unlike a keyword or status, a concept
 * isn't printed on any card and isn't runtime instance state either — it's always relevant to a
 * first-time player regardless of what's on the table or in the pool, so both `rulesGlossaryOf`
 * and `rulesGlossaryPoolOf` include every one of these unconditionally, the same way they always
 * include the table-state entries. Built per call, so a language switch applies.
 */
function conceptEntries(): readonly RulesEntry[] {
  return GLOSSARY_ENTRIES.filter((entry) => entry.kind === "concept").map((entry) => toRulesEntry(entry));
}

/**
 * Joins `sources` into one label. Several RRG pages collapse into one "RRG 1.8 pp. 26, 32" (in the order given, at the
 * first page's position) so a wave 6 entry that rests on three RRG entries doesn't spend a whole line repeating "RRG 1.8".
 * `flagged` adds the implementer-facing "(not in this repo)" to an insert source.
 */
function joinCites(sources: readonly [GlossarySource, ...GlossarySource[]], flagged: boolean): string {
  const pages = sources.flatMap((source) => (source.kind === "rrg" ? [source.page] : []));
  const parts: string[] = [];
  let pagesPlaced = false;
  for (const source of sources) {
    switch (source.kind) {
      case "rrg":
        if (pagesPlaced) break;
        pagesPlaced = true;
        parts.push(pages.length === 1 ? `RRG 1.8 p. ${pages[0]}` : `RRG 1.8 pp. ${pages.join(", ")}`);
        break;
      case "ruling":
        parts.push(source.date);
        break;
      case "insert-not-in-repo":
        parts.push(flagged ? `${source.product} (not in this repo)` : source.product);
        break;
      case "card":
        parts.push(flagged ? `${source.cards} (card text)` : t("rules.cite.cardText", { cards: source.cards }));
        break;
      case "rulebook":
        parts.push(source.label);
        break;
      case "owner-ruling":
        parts.push(
          flagged ? `Ruling for this game, ${source.date}` : t("rules.cite.ownerRuling", { date: source.date }),
        );
        break;
    }
  }
  return parts.join(" · ");
}

/** "RRG 1.8 p. 21", "February 28, 2026 - Ruling 4" — shared with `view/inspect-model.ts`'s Timing/Keywords boxes, so the two screens can never word a citation differently. Carries implementer-facing flags a *player*-facing screen must not render as-is (`playerCiteLabelOf`, and this module's own `RulesEntry.citeLabel` doc comment). */
export function citeLabelOf(sources: readonly [GlossarySource, ...GlossarySource[]]): string {
  return joinCites(sources, true);
}

/**
 * `citeLabelOf`, worded for a player: the source(s) alone, with no "(not in this repo)" and no
 * trailing "· UNVERIFIED"/"· RULING CONFLICT" flag — those are this repo's own bookkeeping about
 * where a definition came from, not something a player asked to read (owner feedback, 2026-09-29:
 * "Fear No Evil rulebook, p. 3 (not in this repo) · unverified" reads as an internal note leaking
 * onto the table). The flags themselves stay on `GlossaryEntry`/`RulesEntry` for implementers and
 * tests; this function is only ever about how the source list itself is worded.
 */
export function playerCiteLabelOf(sources: readonly [GlossarySource, ...GlossarySource[]]): string {
  return joinCites(sources, false);
}

/** A content glossary entry's term and definition in the player's language, for screens that read the glossary directly (Inspect's keyword box). */
export function glossaryWordsOf(entry: GlossaryEntry): { readonly name: string; readonly definition: string } {
  const words = wordsOf(entry.id, { name: entry.displayName, definition: entry.definition });
  return { name: words.name, definition: words.definition };
}

function toRulesEntry(entry: GlossaryEntry, cardRefs: readonly RulesCardRef[] = []): RulesEntry {
  const origin = originNoteOf(entry);
  const words = wordsOf(entry.id, {
    name: entry.displayName,
    definition: entry.definition,
    ...(entry.playerNote ? { note: entry.playerNote } : {}),
  });
  return {
    id: entry.id,
    displayName: words.name,
    definition: words.definition,
    citeLabel: citeLabelOf(entry.sources),
    playerCiteLabel: playerCiteLabelOf(entry.sources),
    unverified: entry.unverified ?? false,
    cardRefs,
    ...(entry.conflict ? { conflict: entry.conflict } : {}),
    ...(words.note ? { playerNote: words.note } : {}),
    ...(origin ? { originNote: origin.text, originBoxId: origin.boxId } : {}),
    ...(words.englishName ? { englishName: words.englishName } : {}),
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

/**
 * "Aspect card" (RRG 1.8 "Aspect Card", p. 8): not a keyword, so the glossary has no entry for it, but resources such as
 * Finesse's pay only for one, and a hero's own card that shows no aspect is not one (issue #292). Listed for the table
 * when a card there says "aspect card" in its text, with those cards.
 */
function aspectCardEntry(cardRefs: readonly RulesCardRef[]): RulesEntry {
  const words = wordsOf("aspectCard", { name: "Aspect card", definition: ASPECT_CARD_DEFINITION });
  return {
    id: "aspectCard",
    displayName: words.name,
    definition: words.definition,
    citeLabel: "RRG 1.8 p. 8",
    playerCiteLabel: "RRG 1.8 p. 8",
    unverified: false,
    cardRefs,
    ...(words.englishName ? { englishName: words.englishName } : {}),
  };
}

/** Whether any of the card's printed text, on any face, says "aspect card". */
function mentionsAspectCard(card: AnyCard | undefined): boolean {
  if (!card) return false;
  const texts =
    card.type === "hero_identity"
      ? [card.hero.text.current, card.alterEgo.text.current]
      : "text" in card
        ? [(card as { readonly text: { readonly current: string } }).text.current]
        : [];
  return texts.some((text) => /\baspect cards?\b/i.test(text));
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
): {
  readonly keywords: ReadonlyMap<KeywordName, readonly RulesCardRef[]>;
  readonly statuses: ReadonlyMap<keyof StatusCounts, readonly RulesCardRef[]>;
  readonly aspectCard: readonly RulesCardRef[];
} {
  const keywordRefs = new Map<KeywordName, RulesCardRef[]>();
  const statusRefs = new Map<keyof StatusCounts, RulesCardRef[]>();
  const aspectCardRefs: RulesCardRef[] = [];
  for (const id of tableInstanceIds(state)) {
    const instance = getInstance(state, id);
    if (!instance) continue;
    const card = state.cardPool[instance.cardId as unknown as string] as AnyCard | undefined;
    const ref: RulesCardRef = {
      cardId: instance.cardId as unknown as string,
      instanceId: id as unknown as string,
      name: card?.name ?? "Unknown card",
    };
    for (const keyword of keywordsOf(state, id, deps)) {
      const list = keywordRefs.get(keyword.name) ?? [];
      list.push(ref);
      keywordRefs.set(keyword.name, list);
    }
    if (mentionsAspectCard(card)) aspectCardRefs.push(ref);
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
    aspectCard: dedupeCardRefs(aspectCardRefs),
  };
}

const normalize = (text: string): string => text.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

/**
 * `entries`, narrowed to the ones matching `query` in their term, definition, or an associated card's name — case- and
 * accent-insensitive. Empty query matches everything. A search ranks the term itself first: an entry named exactly the
 * query, then one whose name starts with it, then one whose name contains it, then the ones that only mention it
 * (searching "Stalwart" used to open on Gene Pool, whose text names it). Alphabetical order holds within a rank. In
 * Spanish the English term counts as a name too, so "retaliate" still finds "Represalia X".
 */
function filterByQuery(entries: readonly RulesEntry[], query: string): readonly RulesEntry[] {
  const needle = normalize(query.trim());
  if (!needle) return entries;
  const nameRank = (displayName: string): number => {
    const name = normalize(displayName).replace(/\s*\(.*\)$/, "");
    if (name === needle) return 0;
    if (name.startsWith(needle)) return 1;
    return name.includes(needle) ? 2 : 3;
  };
  const namesOf = (entry: RulesEntry): readonly string[] =>
    entry.englishName ? [entry.displayName, entry.englishName] : [entry.displayName];
  const rankOf = (entry: RulesEntry): number => Math.min(...namesOf(entry).map(nameRank));
  // The term itself matches the shared fuzzy way (`queryScoreOf`): a typo, a letter left out or a missing accent still
  // finds it. A definition or a card's name has to hold the whole query, so a phrase finds the one entry it describes.
  const mentions = (entry: RulesEntry): boolean =>
    normalize(entry.definition).includes(needle) || entry.cardRefs.some((ref) => normalize(ref.name).includes(needle));
  return entries
    .map((entry, index) => ({
      entry,
      index,
      rank: rankOf(entry),
      score: queryScoreOf(query, { primary: namesOf(entry) }),
    }))
    .filter((hit) => hit.score !== null || mentions(hit.entry))
    .sort((a, b) => a.rank - b.rank || (b.score ?? 0) - (a.score ?? 0) || a.index - b.index)
    .map(({ entry }) => entry);
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
 *
 * By default this is Pause's own "on the table" scope, so a basic concept (never printed, never
 * table state) is left out of both its cards and its count — pass `{ includeConcepts: true }`
 * (the Rules reference screen's glossary tab does) to fold `conceptEntries` in too, listed
 * alongside everything else once the result is sorted below.
 */
export function rulesGlossaryOf(
  state: GameState,
  deps: EngineDeps,
  query = "",
  options?: { readonly includeConcepts?: boolean },
): readonly RulesEntry[] {
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
  if (assoc.aspectCard.length > 0) entries.push(aspectCardEntry(assoc.aspectCard));
  entries.push(...tableStateEntries());
  if (options?.includeConcepts) entries.push(...conceptEntries());
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
  const entries: RulesEntry[] = GLOSSARY_ENTRIES.map((entry) =>
    toRulesEntry(entry, dedupeCardRefs(byKeyword.get(entry.id as KeywordName) ?? [])),
  );
  entries.push(
    aspectCardEntry(
      dedupeCardRefs(
        pool.filter((card) => mentionsAspectCard(card)).map((card) => ({ cardId: card.id as string, name: card.name })),
      ),
    ),
  );
  entries.push(...tableStateEntries());
  entries.sort((a, b) => a.displayName.localeCompare(b.displayName));
  return filterByQuery(entries, query);
}

/** Every glossary entry `@mc/content` and this module know about, with no card associations — kept for the existing "does the flagged conflict survive" test; a screen wanting cards too should use `rulesGlossaryPoolOf`. */
export function everyGlossaryEntry(): readonly RulesEntry[] {
  return [...GLOSSARY_ENTRIES.map((entry) => toRulesEntry(entry)), aspectCardEntry([]), ...tableStateEntries()].sort(
    (a, b) => a.displayName.localeCompare(b.displayName),
  );
}

export interface VillainPhaseStep {
  readonly id:
    | "placeThreat"
    | "enemyActivations"
    | "dealEncounterCards"
    | "revealEncounterCards"
    | "passFirstPlayer"
    | "endOfRound";
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
  const steps: readonly (Pick<VillainPhaseStep, "id" | "art"> & {
    readonly label: MessageKey;
    readonly detail: MessageKey;
  })[] = [
    {
      id: "placeThreat",
      label: "rules.villain.placeThreat.label",
      detail: "rules.villain.placeThreat.detail",
      art: "mainScheme",
    },
    {
      id: "enemyActivations",
      label: "rules.villain.enemyActivations.label",
      detail: "rules.villain.enemyActivations.detail",
      art: "villain",
    },
    {
      id: "dealEncounterCards",
      label: "rules.villain.dealEncounterCards.label",
      detail: "rules.villain.dealEncounterCards.detail",
      art: "encounterBack",
    },
    {
      id: "revealEncounterCards",
      label: "rules.villain.revealEncounterCards.label",
      detail: "rules.villain.revealEncounterCards.detail",
      art: "encounterBack",
    },
    {
      id: "passFirstPlayer",
      label: "rules.villain.passFirstPlayer.label",
      detail: "rules.villain.passFirstPlayer.detail",
      art: null,
    },
    {
      id: "endOfRound",
      label: "rules.villain.endOfRound.label",
      detail: "rules.villain.endOfRound.detail",
      art: null,
    },
  ];
  // Worded in the player's language at call time (`i18n/`), so a language switch applies.
  return steps.map((step) => ({
    id: step.id,
    label: t(step.label),
    detail: t(step.detail),
    art: step.art,
    current: step.id === currentKind,
  }));
}
