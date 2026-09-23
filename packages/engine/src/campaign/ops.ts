/**
 * The between-games interpreter: `CampaignValue`, `CampaignPredicate`, `CampaignChoiceSource` and every
 * `CampaignOp` (design §4.4, §4.5; §11 step 4).
 *
 * Every switch here is exhaustive with no `default:`, deliberately — the requirement the whole foundation is
 * answerable to is that adding a campaign box is content-only, and the only way to know that holds is for a
 * member of the vocabulary that no built box uses to be a *compile* error if it is ever forgotten, rather than a
 * silent no-op discovered when that box ships.
 *
 * No campaign and no card is named. Everything is a pure function of the working log, the definition, the card
 * pool and the recorded answers, so re-running the same step list with the same answers produces the same log —
 * which is what `resolveBetweenGames`'s pending-choice re-entry relies on (`runner.ts`).
 */

import type { AnyCard, CardId, EncounterSetId, PlayModes, Trait } from "@mc/content";
import { matchesModes } from "@mc/content";
import type {
  CampaignCardFace,
  CampaignChoiceRecord,
  CampaignChoiceSource,
  CampaignDefinition,
  CampaignGrant,
  CampaignInstruction,
  CampaignOp,
  CampaignPredicate,
  CampaignSeat,
  CampaignStepTrace,
  CampaignValue,
  CollectionFilter,
  LogValue,
  LogWrite,
  LogWriteMode,
  ResolvedInstruction,
} from "../campaign.js";
import type { CardPool } from "../deck.js";
import { EngineInvariantError } from "../errors.js";
import { nextInt } from "../rng.js";
import type { TargetCategory } from "../spec.js";
import { addRemoval, applyLogWrite, clearLogField, fieldDefOf, readField, type CampaignWorkingLog } from "./log.js";

// ------------------------------------------------------------------------------------------------------------
// What the runner needs besides the log
// ------------------------------------------------------------------------------------------------------------

/**
 * The card data a between-games step needs. Supplied by the caller rather than looked up, for the same reason
 * `EngineDeps` is: the engine holds no registry of its own and never names a product.
 */
export interface CampaignDeps {
  /** Everything a `campaignSet`, `perSeatSet`, `collection` or `ownDeck` choice can draw from. */
  readonly pool: CardPool;
  /**
   * MC10 p. 17's four identically-numbered Expert Campaign Sets, seat 1 first. From `Campaign.perSeatSetIds`;
   * absent for the eight boxes that have no such set, where a `perSeatSet` source is a definition bug.
   */
  readonly perSeatSetIds?: readonly EncounterSetId[];
}

/** What identifies one choice, in the log and in the answers a caller hands back. Stable across a re-entry. */
export interface CampaignChoiceKey {
  readonly instructionId: string;
  readonly slot: string;
  /** The seat that chooses, by `CampaignSeat.seatNumber`; null for a group or first-player choice. */
  readonly seatNumber: number | null;
}

/** A step the runner cannot finish without a human. Plain data: the caller answers it and re-enters. */
export interface CampaignPendingChoice extends CampaignChoiceKey {
  /** The printed sentence the choice comes from, so a client can show the rulebook's own words. */
  readonly text: string;
  readonly citation: string;
  readonly chooser: "eachSeat" | "group" | "firstPlayer";
  /** Card ids, node ids or option strings, depending on the source. Always in a deterministic order. */
  readonly options: readonly string[];
  readonly count: number;
  readonly optional: boolean;
  /**
   * The choice is whether to take a **random draw**, not which card to take (`CampaignOp` `random` with
   * `optional`). Its `options` are the single `CAMPAIGN_ACCEPT` token: answering `[]` declines and answering
   * `[CAMPAIGN_ACCEPT]` accepts, after which the cards come from `CampaignLog.rng` rather than from the answer.
   * The trace still records what was drawn (`CampaignChoiceRecord.random`), so the history reads the same way.
   */
  readonly random?: true;
}

/**
 * The one option an optional `random` offers: "yes, take the draw". A token rather than a card id because the
 * players are not choosing a card — the draw is the RNG's — and a token keeps the answer shape identical to every
 * other choice, so a caller, the history and the option-membership check need no special case.
 */
export const CAMPAIGN_ACCEPT = "accept";

/** One answered choice. Recorded in the log's history, which is what makes a campaign replayable from its seed. */
export interface CampaignChoiceAnswer extends CampaignChoiceKey {
  readonly picked: readonly string[];
}

/** The answers map key. `\u0000` cannot occur in an instruction id or a slot, so the encoding is unambiguous. */
export const campaignChoiceKey = (key: CampaignChoiceKey): string =>
  `${key.instructionId}\u0000${key.slot}\u0000${key.seatNumber === null ? "" : String(key.seatNumber)}`;

export const campaignAnswerMap = (answers: readonly CampaignChoiceAnswer[]): ReadonlyMap<string, readonly string[]> =>
  new Map(answers.map((answer) => [campaignChoiceKey(answer), answer.picked]));

/** Whether the step list is running before the game (composition and setup) or after it (victory and defeat). */
export type CampaignRunPhase = "beforeGame" | "afterGame";

/** Everything one step list mutates. Re-created from scratch on every re-entry, never persisted. */
export interface CampaignRun {
  readonly definition: CampaignDefinition;
  readonly deps: CampaignDeps;
  readonly modes: PlayModes;
  readonly answers: ReadonlyMap<string, readonly string[]>;
  readonly phase: CampaignRunPhase;
  /** What the finished game computed for each `record` instruction, by instruction id (`afterGame` only). */
  readonly records: ReadonlyMap<string, readonly LogWrite[]>;
  /**
   * Seats sitting out this scenario's Victory steps (`CampaignGameResult.sittingOut`, design §4.6b): no per-seat op
   * runs for them. `seatCount` still counts them — "1[per_hero]" is the number of players who played the game.
   */
  readonly sittingOut: readonly number[];
  working: CampaignWorkingLog;
  /** The node whose instructions are running; `CampaignGrant.grantedAtNodeId` and `progressNode` read it. */
  nodeId: string;
  steps: CampaignStepTrace[];
  /** Set the moment a `choose` has no answer. Every caller checks it and stops. */
  pending: CampaignPendingChoice | null;
  /** `inGame` instructions collected for the game about to be built (`beforeGame` only), in printed order. */
  instructions: ResolvedInstruction[];
  composedVillain: string | null;
  /** `composeEncounterSets`, split by `into` (default `"deck"`). */
  composedEncounterSets: { deck: string[]; setAside: string[] };
  /** Choices made earlier in this same step list, by `${slot}\u0000${seat}` (`CampaignValue` `choice`). */
  slots: Map<string, readonly string[]>;
  // --- accumulators for the instruction currently resolving ---
  instructionId: string;
  writes: LogWrite[];
  choices: CampaignChoiceRecord[];
  removed: CampaignCardFace[];
  grants: CampaignGrant[];
  /** The seat `seat: "self"` means right now; null outside a `forEachSeat` and outside a per-seat expansion. */
  seatScope: number | null;
}

// ------------------------------------------------------------------------------------------------------------
// §4.4 Values
// ------------------------------------------------------------------------------------------------------------

/** What a `CampaignValue` evaluates to. A list, because one `choose` slot can hold several picks. */
export type CampaignScalar = number | string | boolean;

const seatNumbers = (run: CampaignRun): readonly number[] => run.working.seats.map((seat) => seat.seatNumber);

/** The seats a per-seat op runs for: every seat but those sitting out the Victory steps (design §4.6b). */
const participatingSeats = (run: CampaignRun): readonly number[] =>
  seatNumbers(run).filter((seatNumber) => !run.sittingOut.includes(seatNumber));

/** The complement of `participatingSeats`: only the seats sitting out (`forEachSeat`'s `scope: "sittingOut"`). */
const sittingOutSeats = (run: CampaignRun): readonly number[] =>
  seatNumbers(run).filter((seatNumber) => run.sittingOut.includes(seatNumber));

/**
 * The seat a `seat: "self" | "each"` on a *value* addresses.
 *
 * A value is singular, so `"each"` reads the same seat `"self"` does — the plural form belongs to the op that
 * carries it (`grantCard`, `LogWriteSpec`), which expands to one value per seat. With no scope active the first
 * seat is read, which is the only total answer for a definition that asked a per-seat question outside a seat.
 */
const valueSeat = (run: CampaignRun, seat?: "self" | "each"): number | null => {
  if (seat === undefined) return null;
  return run.seatScope ?? seatNumbers(run)[0] ?? null;
};

const scalarsOfLogValue = (value: LogValue | undefined): readonly CampaignScalar[] => {
  if (!value) return [];
  switch (value.kind) {
    case "number":
      return [value.value];
    case "flag":
      // An unchecked box records nothing, the way an empty `choice` and an empty `text` already do: "if the box is
      // checked" is the only sentence a rulebook writes about a flag, so `fieldIsSet` must not be satisfied by a
      // box that was explicitly written `false` (every per-seat "each player records whether …" writes one).
      return value.value ? [value.value] : [];
    case "cardList":
      return value.cardIds;
    case "cardRef":
      // Same polarity: a `cardRef` field left unset by a declined optional choice holds no card id at all.
      return value.cardId === "" ? [] : [value.cardId];
    case "choice":
      return value.option === "" ? [] : [value.option];
    case "strikeList":
      return value.struck;
    case "cardState":
      return Object.keys(value.cards);
    case "instructionList":
      return value.ids;
    case "text":
      return value.value === "" ? [] : [value.value];
  }
};

/**
 * A field read as a number for the between-games half, which — unlike the in-game `ValueSpec` — has no `of: "count"`
 * to disambiguate with. A number or a flag reads as its value; every list-shaped field reads as how many it holds,
 * because "at least 2 recorded" is the only sentence a rulebook writes about a list.
 */
const fieldNumber = (value: LogValue | undefined): number => {
  if (!value) return 0;
  if (value.kind === "number") return value.value;
  if (value.kind === "flag") return value.value ? 1 : 0;
  return scalarsOfLogValue(value).length;
};

const numeric = (scalar: CampaignScalar | undefined): number => {
  if (typeof scalar === "number") return scalar;
  if (typeof scalar === "boolean") return scalar ? 1 : 0;
  const parsed = Number(scalar);
  return Number.isFinite(parsed) ? parsed : 0;
};

/** The slot key a `choose`/`random` pick is stored under; a seat-scoped pick is addressable only by that seat. */
const slotKey = (slot: string, seatNumber: number | null): string =>
  `${slot}\u0000${seatNumber === null ? "" : String(seatNumber)}`;

const slotValues = (run: CampaignRun, slot: string): readonly string[] =>
  run.slots.get(slotKey(slot, run.seatScope)) ?? run.slots.get(slotKey(slot, null)) ?? [];

/** Every value a `CampaignValue` names. Ops that take one card use the first; ops that take a list use them all. */
export function campaignValues(run: CampaignRun, value: CampaignValue): readonly CampaignScalar[] {
  switch (value.kind) {
    case "const":
      return [value.value];
    case "field":
      return scalarsOfLogValue(readField(run.definition, run.working, value.field, valueSeat(run, value.seat)));
    case "count":
      return [fieldNumber(readField(run.definition, run.working, value.field, run.seatScope))];
    case "sum":
      return [value.of.reduce((total, part) => total + campaignNumber(run, part), 0)];
    case "difference":
      return [
        value.of
          .slice(1)
          .reduce((total, part) => total - campaignNumber(run, part), campaignNumber(run, value.of[0] ?? zero)),
      ];
    case "min":
      return [Math.min(...value.of.map((part) => campaignNumber(run, part)))];
    case "max":
      return [Math.max(...value.of.map((part) => campaignNumber(run, part)))];
    case "clampAtZero":
      // MC27 p. 5 and ruling August 3, 2026 (4) answer 2: negative victory points mark no reputation-track nodes.
      return [Math.max(0, campaignNumber(run, value.of))];
    case "choice":
      return slotValues(run, value.slot);
    case "seatCount":
      return [seatNumbers(run).length];
    case "divide": {
      const raw = campaignNumber(run, value.of) / value.by;
      return [value.round === "down" ? Math.floor(raw) : Math.ceil(raw)];
    }
  }
}

const zero: CampaignValue = { kind: "const", value: 0 };

export const campaignNumber = (run: CampaignRun, value: CampaignValue): number =>
  numeric(campaignValues(run, value)[0]);

export const campaignString = (run: CampaignRun, value: CampaignValue): string => {
  const [first] = campaignValues(run, value);
  return first === undefined ? "" : String(first);
};

export const campaignStrings = (run: CampaignRun, value: CampaignValue): readonly string[] =>
  campaignValues(run, value).map(String);

// ------------------------------------------------------------------------------------------------------------
// §4.4 Predicates
// ------------------------------------------------------------------------------------------------------------

/**
 * The seats a `seat: "self"` on a *predicate* asks about.
 *
 * Inside a seat scope it is that seat. Outside one — an instruction-level `when` gate, which runs once for the
 * whole table — it is "any seat", because the printed sentences that gate this way read "If a player has …".
 */
const predicateSeats = (run: CampaignRun, seat?: "self"): readonly (number | null)[] => {
  if (seat === undefined) return [null];
  if (run.seatScope !== null) return [run.seatScope];
  const numbers = seatNumbers(run);
  return numbers.length === 0 ? [null] : numbers;
};

export function evaluateCampaignPredicate(run: CampaignRun, predicate: CampaignPredicate): boolean {
  switch (predicate.kind) {
    case "fieldAtLeast":
      return predicateSeats(run, predicate.seat).some(
        (seat) => fieldNumber(readField(run.definition, run.working, predicate.field, seat)) >= predicate.amount,
      );
    case "fieldIsSet":
      return predicateSeats(run, predicate.seat).some((seat) => {
        const value = readField(run.definition, run.working, predicate.field, seat);
        return value !== undefined && scalarsOfLogValue(value).length > 0;
      });
    case "fieldContains":
      return predicateSeats(run, predicate.seat).some((seat) =>
        scalarsOfLogValue(readField(run.definition, run.working, predicate.field, seat)).some(
          (scalar) => String(scalar) === predicate.value,
        ),
      );
    case "notStruck": {
      // MC45 p. 5: "MISSION side schemes are available unless their name has been struck from the campaign log."
      const value = readField(run.definition, run.working, predicate.field, run.seatScope);
      return !(value?.kind === "strikeList" && value.struck.includes(predicate.option));
    }
    case "nodeResolved": {
      const resolved = run.working.resolved[predicate.nodeId];
      return predicate.as === undefined ? resolved !== undefined : resolved === predicate.as;
    }
    case "choiceMade":
      // The counterpart of `optional` on `choose`/`random`: a seat that declined recorded an empty pick, so this
      // is false for that seat and true for one that took it (MC10 p. 12's "each player … **may** replace").
      return slotValues(run, predicate.slot).length > 0;
    case "modes":
      return matchesModes(run.modes, predicate.of);
    case "not":
      return !evaluateCampaignPredicate(run, predicate.of);
    case "and":
      return predicate.of.every((part) => evaluateCampaignPredicate(run, part));
    case "or":
      return predicate.of.some((part) => evaluateCampaignPredicate(run, part));
    case "valueAtLeast":
      return campaignNumber(run, predicate.value) >= campaignNumber(run, predicate.amount);
  }
}

// ------------------------------------------------------------------------------------------------------------
// §4.5 Choice sources
// ------------------------------------------------------------------------------------------------------------

/** `AnyCard["type"]` as the categories a `CollectionFilter` names. The in-play twin is `select.ts`'s `categoriesOf`. */
const CARD_DATA_CATEGORIES: Readonly<Record<AnyCard["type"], readonly TargetCategory[]>> = {
  hero_identity: ["identity", "character"],
  ally: ["ally", "character"],
  event: ["event"],
  support: ["support"],
  upgrade: ["upgrade"],
  resource: ["resource"],
  player_side_scheme: ["sideScheme", "scheme"],
  villain: ["villain", "enemy", "character"],
  minion: ["minion", "enemy", "character"],
  attachment: ["attachment"],
  main_scheme: ["mainScheme", "scheme"],
  side_scheme: ["sideScheme", "scheme"],
  treachery: ["treachery"],
  obligation: ["obligation"],
  environment: ["environment"],
  evidence: [],
};

/**
 * RRG 1.8 "Player Deck" (p. 33). A collection or own-deck choice *is* a deckbuilding choice, so only these
 * qualify — which is a rule about those two sources, not about the filter: a campaign set holds whatever the box
 * printed in it, and a card of one reaches a deck only because a `grantCard` op put it there (RRG 1.8 p. 11).
 */
const DECKABLE: ReadonlySet<AnyCard["type"]> = new Set<AnyCard["type"]>([
  "ally",
  "event",
  "support",
  "upgrade",
  "resource",
  "player_side_scheme",
]);

const poolCards = (pool: CardPool): readonly AnyCard[] => (Array.isArray(pool) ? pool : Object.values(pool));

const cardTraits = (card: AnyCard): readonly Trait[] => {
  if (card.type === "hero_identity") return [...card.hero.traits, ...card.alterEgo.traits];
  if (card.type === "villain") return card.sides.flatMap((side) => side.stages.flatMap((stage) => stage.traits));
  return "traits" in card ? card.traits : [];
};

const inEncounterSet = (card: AnyCard, setId: string): boolean => {
  if ("specificTo" in card && card.specificTo?.encounterSetId === setId) return true;
  return "encounterSetIds" in card && card.encounterSetIds.includes(setId as EncounterSetId);
};

/** Cards this seat's deck already lists, which is where a `grantCard` puts one. */
const grantedTo = (seat: CampaignSeat | undefined): ReadonlySet<string> =>
  new Set((seat?.grants ?? []).map((grant) => grant.cardId as string));

/**
 * `excludeGranted` is **group-wide**: once a campaign card has been added to someone's deck, the physical card is
 * taken. MC16 p. 5 prints the same rule for its Market ("only one copy per campaign for the players as a group").
 * Flagged rather than assumed to be per-seat, because no box prints the per-seat reading.
 *
 * It reads the *grants*, so a table-wide single-copy pool must be written as a `forEachSeat` whose ops choose and
 * then grant for each seat in turn (MC10 p. 5's "each player chooses one of the TECH upgrades"). A flat `choose`
 * with `chooser: "eachSeat"` asks every seat before any `grantCard` runs, so nothing has been taken yet and two
 * seats could name the same copy — the ordering is the definition's to get right, and is why the per-seat shape
 * is the one both synthetic fixtures use.
 */
const anyGranted = (run: CampaignRun): ReadonlySet<string> =>
  new Set(run.working.seats.flatMap((seat) => seat.grants.map((grant) => grant.cardId as string)));

const isRemoved = (run: CampaignRun, cardId: string): boolean =>
  run.working.removedFromCampaign.some((face) => face.cardId === cardId && face.face === undefined);

function matchesCollectionFilter(
  run: CampaignRun,
  card: AnyCard,
  filter: CollectionFilter,
  seat: CampaignSeat | undefined,
): boolean {
  const categories = CARD_DATA_CATEGORIES[card.type];
  if (filter.categories && !filter.categories.some((category) => categories.includes(category))) return false;
  if (filter.aspects && !filter.aspects.includes("aspect" in card ? (card.aspect as string) : "")) return false;
  const traits = cardTraits(card);
  // Any, not every: the printed filters that name several traits ("an Avenger or X-Men ally") are alternatives.
  if (filter.traits && !filter.traits.some((trait) => traits.includes(trait))) return false;
  if (filter.sharesTraitWithIdentity) {
    // MC45 p. 20: "the ally you choose during Setup must share a trait with your hero."
    const identity = poolCards(run.deps.pool).find((candidate) => candidate.id === seat?.identityCardId);
    const identityTraits = identity ? cardTraits(identity) : [];
    if (!traits.some((trait) => identityTraits.includes(trait))) return false;
  }
  if (filter.maxPrintedCost !== undefined) {
    if (!("cost" in card) || typeof card.cost !== "number" || card.cost > filter.maxPrintedCost) return false;
  }
  if (filter.unitCostExactly !== undefined) {
    if (!("unitCost" in card) || card.unitCost !== filter.unitCostExactly) return false;
  }
  if (filter.excludeCardIds?.includes(card.id)) return false;
  return true;
}

/** A deckbuilding choice's candidates: the filter, plus RRG 1.8 p. 33's "what may be in a player deck at all". */
const matchesDeckbuildingFilter = (
  run: CampaignRun,
  card: AnyCard,
  filter: CollectionFilter,
  seat: CampaignSeat | undefined,
): boolean => DECKABLE.has(card.type) && matchesCollectionFilter(run, card, filter, seat);

/**
 * One encounter set's cards, narrowed the way a `campaignSet`/`perSeatSet` source asks: the printed set, minus
 * what a grant has already taken, minus the box's own sub-pool filter (MC10 p. 5's TECH upgrades against MC10
 * p. 7's Condition upgrades, both printed in one set).
 */
const cardsOfSet = (
  run: CampaignRun,
  setId: string,
  granted: ReadonlySet<string>,
  filter: CollectionFilter | undefined,
  seat: CampaignSeat | undefined,
): readonly string[] =>
  poolCards(run.deps.pool)
    .filter(
      (card) =>
        inEncounterSet(card, setId) &&
        !granted.has(card.id) &&
        (filter === undefined || matchesCollectionFilter(run, card, filter, seat)),
    )
    .map((card) => card.id);

/** The nodes still playable: never resolved, and — for a `choice` graph — passing the graph's `available` gate. */
export function availableNodeIds(run: CampaignRun, filter: "unresolved" | "available"): readonly string[] {
  const graph = run.definition.graph;
  const unresolved = graph.nodes.filter((node) => run.working.resolved[node.id] === undefined).map((node) => node.id);
  if (filter === "unresolved") return unresolved;
  if (graph.kind === "linear") {
    // A linear graph offers exactly one node: MC10 p. 3, "win all five scenarios in numerical order".
    return unresolved.slice(0, 1);
  }
  return unresolved.filter(() => evaluateCampaignPredicate(run, graph.available));
}

/** The options a `choose` or `random` op draws from, in a deterministic order (pool order, then log order). */
export function resolveChoiceSource(
  run: CampaignRun,
  source: CampaignChoiceSource,
  seatNumber: number | null,
): readonly string[] {
  const seat = run.working.seats.find((candidate) => candidate.seatNumber === seatNumber);
  const usable = (ids: readonly string[]): readonly string[] => ids.filter((id) => !isRemoved(run, id));
  switch (source.kind) {
    case "cards":
      return usable(source.cardIds);
    case "campaignSet": {
      const granted = source.excludeGranted ? anyGranted(run) : new Set<string>();
      return usable(cardsOfSet(run, source.encounterSetId, granted, source.filter, seat));
    }
    case "perSeatSet": {
      // MC10 p. 17: "they must take that card from the set that matches their player number."
      if (seatNumber === null) {
        throw new EngineInvariantError("a perSeatSet campaign choice needs a seat, and none is in scope");
      }
      const setId = run.deps.perSeatSetIds?.[seatNumber - 1];
      if (setId === undefined) {
        throw new EngineInvariantError(
          `campaign ${run.definition.campaignId} draws from the numbered set for seat ${seatNumber}, which is not configured`,
        );
      }
      const granted = source.excludeGranted ? grantedTo(seat) : new Set<string>();
      return usable(cardsOfSet(run, setId, granted, source.filter, seat));
    }
    case "collection":
      return usable(
        poolCards(run.deps.pool)
          .filter((card) => matchesDeckbuildingFilter(run, card, source.filter, seat))
          .map((card) => card.id),
      );
    case "fieldOptions": {
      const declared = fieldDefOf(run.definition, source.field);
      if (declared.type.kind !== "choice" && declared.type.kind !== "strikeList") {
        throw new EngineInvariantError(
          `campaign log field "${source.field}" is a ${declared.type.kind} field and has no options to choose from`,
        );
      }
      const recorded = readField(run.definition, run.working, source.field, seatNumber);
      const struck = recorded?.kind === "strikeList" ? recorded.struck : [];
      return source.unstruckOnly
        ? declared.type.options.filter((option) => !struck.includes(option))
        : [...declared.type.options];
    }
    case "nodes":
      return availableNodeIds(run, source.filter);
    case "ownDeck": {
      const cards = poolCards(run.deps.pool);
      const listed = (seat?.deck.cards ?? []).map((line) => line.cardId as string);
      if (!source.filter) return usable(listed);
      const filter = source.filter;
      return usable(
        listed.filter((id) => {
          const card = cards.find((candidate) => candidate.id === id);
          return card !== undefined && matchesDeckbuildingFilter(run, card, filter, seat);
        }),
      );
    }
  }
}

// ------------------------------------------------------------------------------------------------------------
// §4.5 Ops
// ------------------------------------------------------------------------------------------------------------

/** Writes one field and records the write in the current instruction's trace. */
function write(run: CampaignRun, field: string, seatNumber: number | null, mode: LogWriteMode, value: LogValue): void {
  const applied = applyLogWrite(run.definition, run.working, { field, seatNumber, mode, value });
  if (applied) run.writes.push(applied);
}

/** The `LogValue` a `CampaignValue` becomes in a field of the declared kind. Exhaustive, so no kind is forgotten. */
function logValueFor(run: CampaignRun, field: string, value: CampaignValue): LogValue {
  const declared = fieldDefOf(run.definition, field);
  switch (declared.type.kind) {
    case "number":
      return { kind: "number", value: campaignNumber(run, value) };
    case "flag": {
      // Nothing to write is an *unchecked* box. The earlier `true` default had the polarity backwards: a box a
      // rulebook means to check is written `{ kind: "const", value: true }`, while a value that resolves to
      // nothing — an unset field, a declined optional choice — is exactly the case that must not check it.
      const [first] = campaignValues(run, value);
      return { kind: "flag", value: first === undefined ? false : Boolean(first) };
    }
    case "cardList":
      return { kind: "cardList", cardIds: campaignStrings(run, value) as readonly CardId[] };
    case "cardRef":
      return { kind: "cardRef", cardId: campaignString(run, value) as CardId };
    case "choice":
      return { kind: "choice", option: campaignString(run, value) };
    case "strikeList":
      return { kind: "strikeList", struck: campaignStrings(run, value) };
    case "instructionList":
      return { kind: "instructionList", ids: campaignStrings(run, value) };
    case "text":
      return { kind: "text", value: campaignString(run, value) };
    case "cardState":
      throw new EngineInvariantError(
        `campaign log field "${field}" is a cardState field, which the between-games vocabulary cannot yet write`,
      );
  }
}

/** The seats an op with `seat: "self"` runs for: the scoped one, or every seat in turn (`grantCard`'s "each"). */
const targetSeats = (run: CampaignRun, seat: "self" | "each" | undefined): readonly (number | null)[] => {
  if (seat === undefined) return [null];
  if (seat === "each") return participatingSeats(run);
  return run.seatScope === null ? participatingSeats(run) : [run.seatScope];
};

const withSeat = (run: CampaignRun, seatNumber: number | null, body: () => void): void => {
  const outer = run.seatScope;
  run.seatScope = seatNumber ?? outer;
  try {
    body();
  } finally {
    run.seatScope = outer;
  }
};

function updateSeat(run: CampaignRun, seatNumber: number, update: (seat: CampaignSeat) => CampaignSeat): void {
  run.working.seats = run.working.seats.map((seat) => (seat.seatNumber === seatNumber ? update(seat) : seat));
}

/** MC10 p. 3: a granted card goes into the deck, and is remembered as a grant so deck size can exempt it. */
function grantCard(
  run: CampaignRun,
  seatNumber: number,
  cardId: CardId,
  permanence: CampaignGrant["permanence"],
): void {
  const grant: CampaignGrant = { cardId, permanence, grantedAtNodeId: run.nodeId };
  updateSeat(run, seatNumber, (seat) => {
    const line = seat.deck.cards.find((entry) => entry.cardId === cardId);
    return {
      ...seat,
      deck: {
        ...seat.deck,
        cards: line
          ? seat.deck.cards.map((entry) =>
              entry.cardId === cardId ? { ...entry, quantity: entry.quantity + 1 } : entry,
            )
          : [...seat.deck.cards, { cardId, quantity: 1 }],
      },
      grants: [...seat.grants, grant],
    };
  });
  run.grants.push(grant);
}

function revokeCard(run: CampaignRun, seatNumber: number, cardId: CardId): void {
  updateSeat(run, seatNumber, (seat) => {
    const index = seat.grants.findIndex((grant) => grant.cardId === cardId);
    if (index < 0) return seat;
    return {
      ...seat,
      deck: {
        ...seat.deck,
        cards: seat.deck.cards.flatMap((entry) =>
          entry.cardId === cardId ? (entry.quantity > 1 ? [{ ...entry, quantity: entry.quantity - 1 }] : []) : [entry],
        ),
      },
      grants: seat.grants.filter((_, at) => at !== index),
    };
  });
}

/** MC60 p. 9 step 3. The mark is counted here; how many marks fail a node is the *box's* number, not the engine's. */
function progressNode(run: CampaignRun, nodeId: string): void {
  const marks = (run.working.progress[nodeId] ?? 0) + 1;
  run.working.progress = { ...run.working.progress, [nodeId]: marks };
  const graph = run.definition.graph;
  const threshold = graph.kind === "choice" ? graph.progressToFail : undefined;
  if (threshold !== undefined && marks >= threshold && run.working.resolved[nodeId] === undefined) {
    run.working.resolved = { ...run.working.resolved, [nodeId]: "failed" };
  }
}

/** Draws `count` distinct options from the log's own RNG, so a client cannot reroll by reloading. */
function drawRandom(run: CampaignRun, options: readonly string[], count: number): readonly string[] {
  const remaining = [...options];
  const picked: string[] = [];
  for (let i = 0; i < count && remaining.length > 0; i++) {
    const [index, next] = nextInt(run.working.rng, remaining.length);
    run.working.rng = next;
    picked.push(remaining.splice(index, 1)[0] as string);
  }
  return picked;
}

function recordChoice(
  run: CampaignRun,
  slot: string,
  seatNumber: number | null,
  picked: readonly string[],
  random?: true,
): void {
  run.slots.set(slotKey(slot, seatNumber), picked);
  run.choices.push(random ? { slot, seatNumber, picked, random } : { slot, seatNumber, picked });
}

/** The seats a `choose`/`random` asks. `eachSeat` inside a `forEachSeat` is just that seat. */
const choosingSeats = (run: CampaignRun, chooser: "eachSeat" | "group" | "firstPlayer"): readonly (number | null)[] => {
  if (chooser !== "eachSeat") return [null];
  return run.seatScope === null ? participatingSeats(run) : [run.seatScope];
};

function runChoose(
  run: CampaignRun,
  op: Extract<CampaignOp, { kind: "choose" }>,
  instruction: CampaignInstruction,
): void {
  const count = op.count ?? 1;
  for (const seatNumber of choosingSeats(run, op.chooser)) {
    const key: CampaignChoiceKey = { instructionId: instruction.id, slot: op.slot, seatNumber };
    const options = resolveChoiceSource(run, op.from, seatNumber);
    const answer = run.answers.get(campaignChoiceKey(key));
    if (answer === undefined) {
      run.pending = {
        ...key,
        text: instruction.text,
        citation: instruction.citation,
        chooser: op.chooser,
        options,
        count,
        optional: op.optional === true,
      };
      return;
    }
    for (const picked of answer) {
      if (!options.includes(picked)) {
        throw new EngineInvariantError(
          `campaign choice "${op.slot}" of ${instruction.id} was answered with "${picked}", which is not one of its options`,
        );
      }
    }
    if (new Set(answer).size !== answer.length) {
      throw new EngineInvariantError(`campaign choice "${op.slot}" of ${instruction.id} picked the same option twice`);
    }
    const least = op.optional ? 0 : Math.min(count, options.length);
    if (answer.length > count || answer.length < least) {
      throw new EngineInvariantError(
        `campaign choice "${op.slot}" of ${instruction.id} needs ${least === count ? String(count) : `${least} to ${count}`} picks, and was answered with ${answer.length}`,
      );
    }
    recordChoice(run, op.slot, seatNumber, answer);
  }
}

/**
 * A random draw, and the consent an `optional` one needs first.
 *
 * `optional` is the printed "each player **may** add 1 random …" (MC10 p. 7): the players decide *whether*, never
 * *which*, so the pending choice offers the single `CAMPAIGN_ACCEPT` token and the cards still come from the log's
 * RNG. A declined draw records an empty pick — the same shape a declined `choose` records — so `choiceMade` reads
 * it, and the trace says the draw was offered rather than saying nothing at all.
 */
function runRandom(
  run: CampaignRun,
  op: Extract<CampaignOp, { kind: "random" }>,
  instruction: CampaignInstruction,
): void {
  const options = resolveChoiceSource(run, op.from, run.seatScope);
  const count = op.count ?? 1;
  if (op.optional) {
    const key: CampaignChoiceKey = { instructionId: instruction.id, slot: op.slot, seatNumber: run.seatScope };
    const answer = run.answers.get(campaignChoiceKey(key));
    if (answer === undefined) {
      run.pending = {
        ...key,
        text: instruction.text,
        citation: instruction.citation,
        chooser: run.seatScope === null ? "group" : "eachSeat",
        options: [CAMPAIGN_ACCEPT],
        count: 1,
        optional: true,
        random: true,
      };
      return;
    }
    if (answer.length > 1 || answer.some((picked) => picked !== CAMPAIGN_ACCEPT)) {
      throw new EngineInvariantError(
        `campaign draw "${op.slot}" of ${instruction.id} is answered with [] to decline or ["${CAMPAIGN_ACCEPT}"] to take it, and was answered with [${answer.join(", ")}]`,
      );
    }
    if (answer.length === 0) {
      recordChoice(run, op.slot, run.seatScope, [], true);
      return;
    }
  }
  // Drawn from `CampaignLog.rng`, which advances as part of the log's state: a client cannot reroll by reloading,
  // and the whole campaign replays from its seed (MC27 p. 22, MC45 p. 5, MC60 p. 9 step 2).
  recordChoice(run, op.slot, run.seatScope, drawRandom(run, options, count), true);
}

/**
 * One op. **Exhaustive with no `default:`** — see this module's header: a member no built box uses must still be
 * interpreted, because the requirement is that a later box is content-only.
 */
export function runCampaignOp(run: CampaignRun, op: CampaignOp, instruction: CampaignInstruction): void {
  if (run.pending) return;
  switch (op.kind) {
    case "setField":
      for (const seatNumber of targetSeats(run, op.seat)) {
        withSeat(run, seatNumber, () => write(run, op.field, seatNumber, "set", logValueFor(run, op.field, op.value)));
      }
      return;
    case "addToField":
      for (const seatNumber of targetSeats(run, op.seat)) {
        withSeat(run, seatNumber, () =>
          write(run, op.field, seatNumber, "add", { kind: "number", value: campaignNumber(run, op.value) }),
        );
      }
      return;
    case "appendToList":
      for (const seatNumber of targetSeats(run, op.seat)) {
        withSeat(run, seatNumber, () =>
          write(run, op.field, seatNumber, "append", logValueFor(run, op.field, op.value)),
        );
      }
      return;
    case "strike":
      for (const seatNumber of targetSeats(run, op.seat)) {
        withSeat(run, seatNumber, () =>
          write(run, op.field, seatNumber, "strike", { kind: "strikeList", struck: campaignStrings(run, op.option) }),
        );
      }
      return;
    case "clearField":
      for (const seatNumber of targetSeats(run, op.seat)) {
        clearLogField(run.definition, run.working, op.field, seatNumber);
      }
      return;
    case "grantCard":
      for (const seatNumber of targetSeats(run, op.seat)) {
        if (seatNumber === null) continue;
        withSeat(run, seatNumber, () => {
          for (const cardId of campaignStrings(run, op.card))
            grantCard(run, seatNumber, cardId as CardId, op.permanence);
        });
      }
      return;
    case "revokeCard":
      for (const seatNumber of targetSeats(run, op.seat)) {
        if (seatNumber === null) continue;
        withSeat(run, seatNumber, () => {
          for (const cardId of campaignStrings(run, op.card)) revokeCard(run, seatNumber, cardId as CardId);
        });
      }
      return;
    case "removeFromCampaign":
      // RRG 1.8 p. 29. By face (ruling April 30, 2026 (4) answer 2); a between-games op names the front face,
      // because the face a card is showing is a fact about a game and there is no game here.
      for (const value of op.cards) {
        for (const cardId of campaignStrings(run, value)) {
          const face: CampaignCardFace = { cardId: cardId as CardId };
          if (addRemoval(run.working, face)) run.removed.push(face);
        }
      }
      return;
    case "setGrantFace": {
      // MC10 p. 12 ("replace their 'Basic' Condition upgrade with its 'Improved' side"); MC27 p. 22's Enhanced side.
      const cardId = campaignString(run, op.card) as CardId;
      run.working.seats = run.working.seats.map((seat) => ({
        ...seat,
        grants: seat.grants.map((grant) => (grant.cardId === cardId ? { ...grant, face: op.face } : grant)),
      }));
      return;
    }
    case "choose":
      runChoose(run, op, instruction);
      return;
    case "random":
      runRandom(run, op, instruction);
      return;
    case "spend": {
      // MC16 p. 5: "Subtract that card's Unit Cost value from the value recorded in your 'Unspent Units' box."
      for (const seatNumber of targetSeats(run, op.seat)) {
        withSeat(run, seatNumber, () =>
          write(run, op.field, seatNumber, "add", { kind: "number", value: -campaignNumber(run, op.amount) }),
        );
      }
      return;
    }
    case "progressNode":
      for (const nodeId of campaignStrings(run, op.node)) progressNode(run, nodeId);
      return;
    case "markNode":
      for (const nodeId of campaignStrings(run, op.node)) {
        run.working.resolved = { ...run.working.resolved, [nodeId]: op.as };
      }
      return;
    case "endCampaign":
      // MC45 p. 20: winning the last scenario can still lose the campaign.
      run.working.status = op.result;
      run.working.nextNodeId = null;
      return;
    case "composeVillain":
      run.composedVillain = campaignString(run, op.villain);
      return;
    case "composeEncounterSets": {
      const bucket = op.into ?? "deck";
      run.composedEncounterSets[bucket] = [
        ...run.composedEncounterSets[bucket],
        ...op.sets.flatMap((set) => campaignStrings(run, set)),
      ];
      return;
    }
    case "forEachSeat":
      for (const seatNumber of op.scope === "sittingOut" ? sittingOutSeats(run) : participatingSeats(run)) {
        withSeat(run, seatNumber, () => {
          for (const inner of op.ops) runCampaignOp(run, inner, instruction);
        });
        if (run.pending) return;
      }
      return;
    case "if": {
      const branch = evaluateCampaignPredicate(run, op.when) ? op.then : (op.else ?? []);
      for (const inner of branch) runCampaignOp(run, inner, instruction);
      return;
    }
  }
}

// ------------------------------------------------------------------------------------------------------------
// Instructions
// ------------------------------------------------------------------------------------------------------------

const beginInstruction = (run: CampaignRun, instruction: CampaignInstruction): void => {
  run.instructionId = instruction.id;
  run.writes = [];
  run.choices = [];
  run.removed = [];
  run.grants = [];
};

const traceOf = (
  run: CampaignRun,
  instruction: CampaignInstruction,
  skipped?: CampaignStepTrace["skipped"],
): CampaignStepTrace => ({
  instructionId: instruction.id,
  text: instruction.text,
  citation: instruction.citation,
  kind: instruction.step.kind,
  ...(skipped ? { skipped } : {}),
  writes: run.writes,
  choices: run.choices,
  removedFromCampaign: run.removed,
  grants: run.grants,
});

/**
 * Resolves one printed instruction, in printed order, and traces it either way — a skipped instruction is part of
 * the record, because "why did nothing happen?" is exactly the question a campaign log has to answer.
 */
export function runCampaignInstruction(run: CampaignRun, instruction: CampaignInstruction): void {
  if (run.pending) return;
  beginInstruction(run, instruction);
  if (!matchesModes(run.modes, instruction.whenModes)) {
    run.steps.push(traceOf(run, instruction, "modes"));
    return;
  }
  if (instruction.when && !evaluateCampaignPredicate(run, instruction.when)) {
    run.steps.push(traceOf(run, instruction, "condition"));
    return;
  }
  switch (instruction.step.kind) {
    case "betweenGames":
      for (const op of instruction.step.ops) runCampaignOp(run, op, instruction);
      // A pending choice leaves the instruction untraced: the re-entry re-runs it from the start, so tracing a
      // half-finished instruction would double-count everything before the choice.
      if (run.pending) return;
      break;
    case "inGame":
      if (run.phase === "afterGame") {
        throw new EngineInvariantError(
          `campaign instruction ${instruction.id} resolves in a game, and cannot be a victory or defeat instruction`,
        );
      }
      run.instructions.push({
        instructionId: instruction.id,
        text: instruction.text,
        citation: instruction.citation,
        window: instruction.step.window,
        effects: instruction.step.effects,
      });
      break;
    case "record": {
      if (run.phase === "beforeGame") {
        throw new EngineInvariantError(
          `campaign instruction ${instruction.id} records a finished game, and cannot be a setup instruction`,
        );
      }
      for (const computed of run.records.get(instruction.id) ?? []) {
        const applied = applyLogWrite(run.definition, run.working, computed);
        if (applied) run.writes.push(applied);
      }
      break;
    }
  }
  run.steps.push(traceOf(run, instruction));
}

export function runCampaignInstructions(run: CampaignRun, instructions: readonly CampaignInstruction[]): void {
  for (const instruction of instructions) {
    runCampaignInstruction(run, instruction);
    if (run.pending) return;
  }
}
