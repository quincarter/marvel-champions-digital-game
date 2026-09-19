/**
 * Everything the Inspect overlay shows about one card.
 *
 * The design's rule is that rules text longer than two sentences never goes on
 * the table (Components.dc.html section 06) — so the table crops, and this is
 * where the whole card lives: full current wording, the printed wording when
 * errata changed it, flavor, keywords, traits, and the set/collector footer.
 *
 * It also answers "why can't I play this?" from the engine's own
 * `legalActions`, so the overlay never forms an opinion of its own about
 * legality: the message and the target list come from the engine.
 */

import type { AbilityId, AnyCard, KeywordInstance, ResourceIconType } from "@mc/content";
import { glossaryEntry } from "@mc/content";
import {
  activeAbilityRefs,
  cardOf,
  characterProfile,
  getInstance,
  keywordsOf,
  maxHitPoints,
  playCostOf,
  printedResources,
  remainingHitPoints,
  type AbilityTriggerSpec,
  type EngineDeps,
  type GameState,
  type InstanceId,
  type LegalActions,
  type PlayerId,
} from "@mc/engine";
import { artFor, type ArtSource, type CardFace } from "../art/art-source.js";
import { abilityActionsFor } from "./highlights.js";
import { abilityLabelOf } from "./ability-label.js";
import { cardHistoryOf, emptyCardHistoryLog, type CardHistoryLine, type CardHistoryLog } from "./card-history.js";
import { cardName, faceUpName } from "./names.js";
import { citeLabelOf, everyGlossaryEntry } from "./rules-reference.js";
import { faceVisible } from "./visibility.js";
import { faceOf, printedStatsOf, profileStatTiles, resourceIconList, type StatTile } from "./board-model.js";

/** One action ability this card could use right now, named and priced. */
export interface UsableAbility {
  readonly abilityId: AbilityId;
  /** From `abilityLabelOf` — the card's own name plus its printed label or cost. Never invented. */
  readonly label: string;
  readonly needsPayment: boolean;
}

/** What the engine says about this card right now. */
export interface InspectStatus {
  /** Null when the card isn't something that could be played at all (an enemy, a scheme). */
  readonly playable: boolean | null;
  /** The engine's own sentence: why it can be played, or why it can't. */
  readonly message: string;
  /** Names of the things this card could legally be aimed at. */
  readonly targets: readonly string[];
}

/**
 * A rules glossary entry, worded for a specific ability header this card prints — "Hero Action", "Forced
 * Interrupt" — never invented prose (D08's "Timing" box). `label` is structural (derived from the ability's own
 * `AbilityTriggerSpec`, not looked-up copy); `definition`/`citeLabel` are `@mc/content`'s own glossary entry,
 * verbatim. See `timingEntriesFor`'s own doc comment for why most cards have none of these at all.
 */
export interface TimingEntry {
  readonly label: string;
  readonly definition: string;
  readonly citeLabel: string;
}

/** A keyword this card prints, with the glossary's own definition — for the Inspect sheet's "keywords" box (P14, and D08 when there's room). */
export interface KeywordDefinition {
  readonly label: string;
  readonly definition: string;
  readonly citeLabel: string;
}

/**
 * One keyword chip, as `keywords` already draws it ("Retaliate 1", never a bare "Retaliate") paired with the
 * glossary id a tap on it should open the Rules overlay at — `keywordDefinitions`'s dedupe-by-name and this array
 * are built from the same pass so a chip's tap target can never point at the wrong entry, or one this card doesn't
 * actually carry. Null `glossaryId` is the same "no entry maps this yet" case `keywordDefinitions` already omits
 * silently; a chip with no id is still shown (it is a real printed keyword) but does not open Rules on a tap.
 */
export interface KeywordChip {
  readonly text: string;
  readonly glossaryId: string | null;
}

/**
 * What the Board's open payment mode (`view/payment-model.ts`) says about this specific card, when one is open —
 * null otherwise. Threaded in from the scene (`scenes/board.ts#paymentView`), never recomputed here: this module
 * has no access to the controller's own selection state, only to what it's handed.
 */
export interface InspectPayment {
  /** The card being paid for, or null for an ability with no hand-card subject. */
  readonly subjectInstanceId: InstanceId | null;
  readonly paid: number;
  readonly required: number;
  /** Every instance id the open payment could still spend — a superset of what's already spent. */
  readonly spendableInstanceIds: ReadonlySet<InstanceId>;
}

export interface InspectModel {
  readonly instanceId: InstanceId;
  readonly name: string;
  /** "Event · Attack · Justice" — type, first traits, aspect. */
  readonly typeLine: string;
  /** The printed cost, or null for a card that has none. */
  readonly cost: number | null;
  /**
   * Why this card does not cost what it prints, named — "Steve Rogers: 3 → 2" — or null when it does.
   *
   * The sheet is where a player comes to settle an argument with the table, so it is where the answer to
   * "why is this cheaper than the pip says?" belongs. Null on a sheet with no game behind it (the Title
   * screen's pickers), where there is no table to price against.
   */
  readonly priceNote: string | null;
  readonly rulesText: string;
  /**
   * The original wording, only when errata changed it. The content package
   * keeps both on purpose, and a player deserves to see that the card in their
   * hand no longer says what it says on the cardboard.
   */
  readonly printedText: string | null;
  readonly flavor: string | null;
  readonly resourceIcons: readonly ResourceIconType[];
  readonly stats: readonly StatTile[];
  /** "Retaliate 1", "Uses 3 snoop" — the keyword with its value, never bare. */
  readonly keywords: readonly string[];
  /** `keywords`, paired with where a tap on each chip should open the Rules overlay. Same order, same length. */
  readonly keywordChips: readonly KeywordChip[];
  readonly traits: readonly string[];
  readonly art: ArtSource | null;
  /** "Core Set · 004". */
  readonly footerLeft: string;
  /** "Unique · ×2 in set". */
  readonly footerRight: string;
  readonly status: InspectStatus;
  /**
   * Action abilities this card could use right now, straight off the
   * engine's `legalActions` — never the card's `AbilityReference`s, which
   * says nothing about whether one is currently legal. Empty for a card with
   * no usable ability (which is most cards, most of the time) and for a
   * card with no game behind it. The "Play it" button is for a hand card;
   * this is what makes an ability on a card already in play reachable at all
   * (PLAN.md Phase 4).
   */
  readonly abilities: readonly UsableAbility[];
  /** True for a card the viewer isn't allowed to see the face of. */
  readonly hidden: boolean;
  /**
   * "A Hero Action can only be played during your turn in hero form." — one entry per printed ability header this
   * card carries, mapped to `@mc/content`'s glossary. Empty when no ability on the card maps to a real glossary
   * entry (most action/interrupt/response headers have none — see `timingEntriesFor`'s own comment) or when there
   * is no game to ask (`cardInspectModel`).
   */
  readonly timing: readonly TimingEntry[];
  /** Every keyword this card prints, each with the glossary's own definition — `keywords` above, defined. */
  readonly keywordDefinitions: readonly KeywordDefinition[];
  /**
   * "Round 1 — drawn ...", oldest first: every batch of the client's own accumulated event history
   * (`view/card-history.ts`) that names this instance. Empty for a card with no game behind it, and for a card
   * that hasn't done anything yet this session (drawn but never played, an untouched enemy).
   */
  readonly history: readonly CardHistoryLine[];
  /** True when an open payment (threaded in as `InspectPayment`) could still spend this exact card. */
  readonly canPayAsResource: boolean;
}

export function inspectModel(
  state: GameState,
  instanceId: InstanceId,
  legal: LegalActions | null,
  perspectiveId: PlayerId,
  deps: EngineDeps,
  opts: { readonly history?: CardHistoryLog; readonly payment?: InspectPayment | null } = {},
): InspectModel {
  const history = opts.history ?? emptyCardHistoryLog();
  const payment = opts.payment ?? null;
  const instance = getInstance(state, instanceId);
  const card = cardOf(state, instanceId);
  const hidden = !faceVisible(state, instanceId);

  if (!instance || !card || hidden) {
    return {
      instanceId,
      name: cardName(state, instanceId),
      typeLine: "Facedown",
      cost: null,
      priceNote: null,
      // A hidden card is exactly as informative as the table makes it.
      rulesText: "This card is facedown. Nothing about its face is known to you.",
      printedText: null,
      flavor: null,
      resourceIcons: [],
      stats: [],
      keywords: [],
      keywordChips: [],
      traits: instance?.facedownAs ? instance.facedownAs.traits : [],
      // The back of whichever deck it came from — which is exactly what a
      // player sees at the table, and gives the sheet something true to show.
      art: artFor(undefined, faceOf(state, instanceId)),
      footerLeft: "",
      footerRight: "",
      status: { playable: null, message: "", targets: [] },
      abilities: [],
      hidden: true,
      timing: [],
      keywordDefinitions: [],
      // A facedown card's history is still real — a player can watch their own card get drawn, then played
      // facedown as a boost or a Drone before it's ever revealed — so this one branch keeps it, unlike every
      // other field here, which has nothing honest to say about a face nobody can see.
      history: cardHistoryOf(history, instanceId, state, perspectiveId, deps),
      canPayAsResource: false,
    };
  }

  const profile = characterProfile(state, instanceId, deps);
  const current = remainingHitPoints(state, instanceId, deps);
  const max = maxHitPoints(state, instanceId, deps);
  const keywordChips = keywordsOf(state, instanceId, deps).map(
    (keyword): KeywordChip => ({ text: keywordLabel(keyword), glossaryId: glossaryEntry(keyword.name) ? keyword.name : null }),
  );

  return {
    instanceId,
    name: cardName(state, instanceId),
    typeLine: typeLineOf(card),
    cost: "cost" in card && typeof card.cost === "number" ? card.cost : null,
    priceNote: priceNoteFor(state, perspectiveId, instanceId, deps),
    rulesText: textOf(card).current,
    printedText: errataDiff(card),
    flavor: "flavor" in card && card.flavor ? card.flavor : null,
    resourceIcons: resourceIconList(printedResources(card)),
    // The shared builder the board uses, so a buff reads the same in both places.
    // Every stat the card prints, since the sheet describes the card rather than
    // the face in play.
    stats: profile
      ? profileStatTiles(
          profile,
          printedStatsOf(state, instanceId),
          profile.kind === "identity" ? ["thw", "atk", "def", "rec"] : profile.kind === "ally" ? ["thw", "atk"] : ["atk", "sch"],
          current,
          max,
        )
      : [],
    keywords: keywordChips.map((chip) => chip.text),
    keywordChips,
    traits: "traits" in card ? (card.traits as readonly string[]) : [],
    // The face in play, not "the front": a villain's picture lives on its
    // stage and a main scheme's on its side, so asking for a front gets
    // nothing at all for exactly the cards a player most wants to read.
    art: artFor(card, faceOf(state, instanceId)),
    footerLeft: `${card.setCode as string} · ${card.collectorNumber}`,
    footerRight: [card.unique ? "Unique" : null, `×${card.quantityInSet} in set`].filter(Boolean).join(" · "),
    status: statusOf(state, instanceId, legal, perspectiveId, payment),
    abilities: usableAbilitiesOf(state, instanceId, legal, deps),
    hidden: false,
    timing: timingEntriesFor(state, instanceId, deps),
    keywordDefinitions: keywordDefinitionsFor(state, instanceId, deps),
    history: cardHistoryOf(history, instanceId, state, perspectiveId, deps),
    canPayAsResource: payment !== null && payment.spendableInstanceIds.has(instanceId),
  };
}

/**
 * "Steve Rogers: 3 → 2" — the cards changing this card's price, and the price they change it to. Null when the
 * table charges exactly what the card prints, which is most cards most of the time.
 *
 * Priced for the viewer, since a cost modifier can be one seat's and not another's, and with no attachment host:
 * an upgrade's host isn't chosen until the play is under way, so a host-conditional price isn't earned yet.
 */
function priceNoteFor(state: GameState, perspectiveId: PlayerId, instanceId: InstanceId, deps: EngineDeps): string | null {
  const price = playCostOf(state, perspectiveId, instanceId, deps);
  if (!price || price.current === price.printed) return null;
  const names: string[] = [];
  for (const { sourceInstanceId } of price.contributions) {
    if (sourceInstanceId === instanceId) continue;
    const name = faceUpName(state, sourceInstanceId);
    if (name && !names.includes(name)) names.push(name);
  }
  return `${names.length > 0 ? `${names.join(", ")}: ` : ""}${price.printed} → ${price.current}`;
}

/** Every action ability `legalActions` currently lists for this card, named and priced. */
function usableAbilitiesOf(state: GameState, instanceId: InstanceId, legal: LegalActions | null, deps: EngineDeps): readonly UsableAbility[] {
  if (!legal) return [];
  return abilityActionsFor(legal, instanceId).map((entry) => ({
    abilityId: entry.action.abilityId,
    label: abilityLabelOf(state, instanceId, entry.action.abilityId, deps),
    needsPayment: entry.needsPayment,
  }));
}

/** Every card kind's text, since the schema keeps it in a different place per kind. */
function textOf(card: AnyCard, face: CardFace = { kind: "front" }): { readonly printed: string; readonly current: string } {
  if ("text" in card) return card.text;
  if (card.type === "hero_identity") return face.kind === "alterEgo" ? card.alterEgo.text : card.hero.text;
  if (card.type === "villain") {
    const side = face.kind === "villainStage" ? (card.sides[face.sideIndex] ?? card.sides[0]) : card.sides[0];
    const stage = face.kind === "villainStage" ? (side.stages[face.stageIndex] ?? side.stages[0]) : side.stages[0];
    return stage.text;
  }
  if (card.type === "main_scheme") {
    const stage = face.kind === "mainSchemeStage" ? (card.stages[face.stageIndex] ?? card.stages[0]) : card.stages[0];
    return face.kind === "mainSchemeStage" && face.side === "A" ? stage.aSide.text : stage.text;
  }
  return { printed: "", current: "" };
}

/** The keywords printed on one face, without a game to ask about granted ones. */
function printedKeywordsOf(card: AnyCard, face: CardFace): readonly KeywordInstance[] {
  if (card.type === "hero_identity") return face.kind === "alterEgo" ? card.alterEgo.keywords : card.hero.keywords;
  if (card.type === "villain") {
    const side = face.kind === "villainStage" ? (card.sides[face.sideIndex] ?? card.sides[0]) : card.sides[0];
    return (face.kind === "villainStage" ? (side.stages[face.stageIndex] ?? side.stages[0]) : side.stages[0]).keywords;
  }
  if (card.type === "main_scheme") {
    return (face.kind === "mainSchemeStage" ? (card.stages[face.stageIndex] ?? card.stages[0]) : card.stages[0]).keywords;
  }
  return "keywords" in card ? card.keywords : [];
}

/** The traits printed on one face. A hero's two sides do not share them. */
function printedTraitsOf(card: AnyCard, face: CardFace): readonly string[] {
  if (card.type === "hero_identity") {
    return (face.kind === "alterEgo" ? card.alterEgo.traits : card.hero.traits) as readonly string[];
  }
  if (card.type === "villain") {
    const side = face.kind === "villainStage" ? (card.sides[face.sideIndex] ?? card.sides[0]) : card.sides[0];
    const stage = face.kind === "villainStage" ? (side.stages[face.stageIndex] ?? side.stages[0]) : side.stages[0];
    return stage.traits as readonly string[];
  }
  return "traits" in card ? (card.traits as readonly string[]) : [];
}

/**
 * The sheet for a card with no game behind it — the Title screen's scenario and
 * hero pickers, where nothing has been dealt yet.
 *
 * Everything that comes from `@mc/content` is here; everything that needs a
 * game is empty, because there is no honest value for it. No live stats: the
 * scan prints them, and inventing a number for a card that isn't in play would
 * be the client stating a rule.
 */
export function cardInspectModel(card: AnyCard | undefined, face: CardFace): InspectModel {
  if (!card) {
    return {
      instanceId: "" as InstanceId,
      name: "Unknown card",
      typeLine: "",
      cost: null,
      priceNote: null,
      rulesText: "",
      printedText: null,
      flavor: null,
      resourceIcons: [],
      stats: [],
      keywords: [],
      keywordChips: [],
      traits: [],
      art: null,
      footerLeft: "",
      footerRight: "",
      status: { playable: null, message: "", targets: [] },
      abilities: [],
      hidden: false,
      timing: [],
      keywordDefinitions: [],
      history: [],
      canPayAsResource: false,
    };
  }
  const text = textOf(card, face);
  const keywordChips = printedKeywordsOf(card, face).map(
    (keyword): KeywordChip => ({ text: keywordLabel(keyword), glossaryId: glossaryEntry(keyword.name) ? keyword.name : null }),
  );
  return {
    instanceId: "" as InstanceId,
    name: faceNameOf(card, face),
    typeLine: typeLineOf(card),
    cost: "cost" in card && typeof card.cost === "number" ? card.cost : null,
    priceNote: null,
    rulesText: text.current,
    printedText: text.printed && text.printed !== text.current ? text.printed : null,
    flavor: flavorOf(card, face),
    resourceIcons: resourceIconList(printedResources(card)),
    stats: [],
    keywords: keywordChips.map((chip) => chip.text),
    keywordChips,
    traits: printedTraitsOf(card, face),
    art: artFor(card, face),
    footerLeft: `${card.setCode as string} · ${card.collectorNumber}`,
    footerRight: [card.unique ? "Unique" : null, `×${card.quantityInSet} in set`].filter(Boolean).join(" · "),
    status: { playable: null, message: "", targets: [] },
    // No game behind this sheet, so there is no honest verdict on what's
    // usable — the same reasoning `cardInspectModel`'s header already gives
    // for leaving `stats` empty.
    abilities: [],
    hidden: false,
    // No ability trigger data reaches this far without an `EngineDeps` — `activeAbilityRefs` needs a live instance
    // this sheet doesn't have — so Timing stays empty here, the same honest omission as `stats`/`abilities` above.
    timing: [],
    // Keywords need no game: they're printed on the card, and the glossary is `@mc/content`'s own data.
    keywordDefinitions: printedKeywordDefinitions(card, face),
    // Neither does "this card, this game": there is no game.
    history: [],
    canPayAsResource: false,
  };
}

/** `keywordDefinitionsFor`'s no-game equivalent: the glossary entry for every keyword printed on this face. */
function printedKeywordDefinitions(card: AnyCard, face: CardFace): readonly KeywordDefinition[] {
  const seen = new Set<string>();
  const entries: KeywordDefinition[] = [];
  for (const keyword of printedKeywordsOf(card, face)) {
    if (seen.has(keyword.name)) continue;
    seen.add(keyword.name);
    const entry = glossaryEntry(keyword.name);
    if (!entry) continue;
    entries.push({ label: entry.displayName, definition: entry.definition, citeLabel: citeLabelOf(entry.sources) });
  }
  return entries;
}

/** A hero identity names its two sides differently; everything else has one name. */
function faceNameOf(card: AnyCard, face: CardFace): string {
  if (card.type !== "hero_identity") return card.name;
  return face.kind === "alterEgo" ? card.alterEgo.faceName : card.hero.faceName;
}

function flavorOf(card: AnyCard, face: CardFace): string | null {
  if (card.type === "hero_identity") {
    return (face.kind === "alterEgo" ? card.alterEgo.flavor : card.hero.flavor) ?? null;
  }
  return "flavor" in card && card.flavor ? card.flavor : null;
}

/** The printed wording, only when it differs from what the game plays by. */
function errataDiff(card: AnyCard): string | null {
  const text = textOf(card);
  return text.printed && text.printed !== text.current ? text.printed : null;
}

function typeLineOf(card: AnyCard): string {
  const parts: string[] = [card.type.replace(/_/g, " ")];
  if ("traits" in card) parts.push(...(card.traits as readonly string[]).slice(0, 2));
  if ("aspect" in card && typeof card.aspect === "string" && !card.aspect.startsWith("hero:")) {
    parts.push(card.aspect);
  }
  return parts.join(" · ").toUpperCase();
}

/** A keyword with the value it was printed with: "Retaliate 1", never a bare "Retaliate". */
function keywordLabel(keyword: KeywordInstance): string {
  // "teamUp" is printed "Team-Up"; the union's other names are single words.
  const pretty = keyword.name.replace(/([A-Z])/g, " $1");
  switch (keyword.name) {
    case "retaliate":
    case "incite":
    case "hinder":
    case "victory":
      return `${pretty} ${keyword.value}`;
    case "uses":
      return `${pretty} ${keyword.count} ${keyword.counterType}`;
    case "find":
      return keyword.count === undefined ? pretty : `${pretty} ${keyword.count}`;
    case "requirement":
      return `${pretty} ${keyword.icon}`;
    case "teamwork":
      return `${pretty} ${keyword.sharedTrait as string}`;
    case "discount":
      return keyword.value === undefined ? pretty : `${pretty} ${keyword.value}`;
    default:
      return pretty;
  }
}


/**
 * "Right now", straight off `legalActions`. Nothing here decides legality: it
 * finds this card among the actions the engine already ruled on and repeats
 * what the engine said.
 */
function statusOf(
  state: GameState,
  instanceId: InstanceId,
  legal: LegalActions | null,
  perspectiveId: PlayerId,
  payment: InspectPayment | null,
): InspectStatus {
  if (!legal || legal.kind !== "turn") {
    return { playable: null, message: legal?.kind === "choice" ? "A decision is open — answer it first." : "", targets: [] };
  }
  const owned = state.players.find((player) => player.playerId === perspectiveId)?.hand.includes(instanceId) ?? false;

  const playable = legal.legal.find(
    (entry) => (entry.action.kind === "playCard" || entry.action.kind === "useAbility") && entry.action.instanceId === instanceId,
  );
  if (playable) {
    return {
      playable: true,
      // The design's own sentence ("Playable. Cost 3 — you have 2 resources committed, 1 short.") only exists
      // while a payment for *this exact card* is actually open — the Board opens payment mode the moment a hand
      // card with a cost is tapped, and a right-click/hold on it while that's happening is exactly the mid-payment
      // scenario the mock draws. Outside that, "2 resources committed" isn't a number the engine has an answer
      // for yet (nothing has been picked), so the plainer sentence stands rather than inventing one.
      message: paymentMessage(payment, instanceId) ?? (playable.needsPayment ? "Playable — you can afford it." : "Playable."),
      targets: playable.targets.map((target) => cardName(state, target)),
    };
  }
  const illegal = legal.illegal.find(
    (entry) => (entry.action.kind === "playCard" || entry.action.kind === "useAbility") && entry.action.instanceId === instanceId,
  );
  if (illegal) return { playable: false, message: illegal.message, targets: [] };

  // Not a card the player could play — but it may be something they can aim at.
  const aimedAt = legal.legal.filter((entry) => entry.targets.includes(instanceId));
  if (aimedAt.length > 0) {
    return { playable: null, message: `A legal target for: ${aimedAt.map((entry) => entry.action.kind).join(", ")}.`, targets: [] };
  }
  const blocked = legal.legal
    .flatMap((entry) => entry.blockedTargets)
    .concat(legal.illegal.flatMap((entry) => entry.blockedTargets))
    .find((target) => target.instanceId === instanceId);
  if (blocked) return { playable: false, message: blocked.message, targets: [] };

  // In hand and named by no action at all: the engine had nothing to say, and
  // neither does this panel.
  return { playable: owned ? false : null, message: "", targets: [] };
}

/** "Cost 3 — you have 2 resources committed, 1 short." — null unless `payment` is open for this exact instance. */
function paymentMessage(payment: InspectPayment | null, instanceId: InstanceId): string | null {
  if (!payment || payment.subjectInstanceId !== instanceId) return null;
  const short = payment.required - payment.paid;
  const committed = `${payment.paid} resource${payment.paid === 1 ? "" : "s"} committed`;
  return `Playable. Cost ${payment.required} — you have ${committed}${short > 0 ? `, ${short} short` : ", enough"}.`;
}

/**
 * The glossary entry for one printed ability header on this card ("Hero Action", "Forced Interrupt", "Setup",
 * "Boost"…), mapped structurally from the ability's own `AbilityTriggerSpec` — never a hand-picked label.
 *
 * Most trigger kinds have **no** matching entry: `@mc/content`'s glossary (`schema/glossary.ts`, S6) only covers
 * keywords and the three status cards, not ability-timing headers — there is no RRG glossary term titled "Hero
 * Action" or "Interrupt" for it to cite. Only two trigger kinds resolve to a real entry today: `setup` (the
 * glossary's own "Setup" term) and `boost` (`view/rules-reference.ts`'s client-side "Facedown boost card" entry,
 * which is the RRG's actual "Boost, Boost Icon" glossary term, p. 11 — `@mc/content` can't own it itself, since
 * it's runtime instance state, not schema data; see that module's header). Every other kind (`action`, `resource`,
 * `interrupt`, `response`, `whenRevealed`, `whenDefeated`, `whenCompleted`, `special`, `stateCheck`, `constant`)
 * returns nothing here — not a made-up paraphrase — per this task's own instruction not to write rules prose for a
 * kind the glossary doesn't cover. A future content pass that adds those RRG terms to the glossary would only need
 * to widen `TRIGGER_GLOSSARY_ID` below; nothing here would need to change shape.
 */
const TRIGGER_GLOSSARY_ID: Partial<Record<AbilityTriggerSpec["kind"], string>> = {
  setup: "setup",
  boost: "facedownBoostCard",
};

/** "Hero Action", "Forced Interrupt", "When Revealed" — the structural name of one ability header, from its trigger spec alone. */
function triggerLabel(trigger: AbilityTriggerSpec): string {
  const form = "form" in trigger && trigger.form ? (trigger.form === "hero" ? "Hero " : "Alter-Ego ") : "";
  switch (trigger.kind) {
    case "action":
      return `${form}Action`;
    case "resource":
      return `${form}Resource`;
    case "interrupt":
      return `${form}${trigger.forced ? "Forced Interrupt" : "Interrupt"}`;
    case "response":
      return `${form}${trigger.forced ? "Forced Response" : "Response"}`;
    case "whenRevealed":
      return "When Revealed";
    case "whenDefeated":
      return "When Defeated";
    case "whenCompleted":
      return "When Completed";
    case "boost":
      return "Boost";
    case "setup":
      return "Setup";
    case "special":
      return "Special";
    case "stateCheck":
      return "Forced";
    case "constant":
      return "Constant";
  }
}

/** Every ability header on this card that maps to a real glossary entry — see `TRIGGER_GLOSSARY_ID`'s own comment. */
function timingEntriesFor(state: GameState, instanceId: InstanceId, deps: EngineDeps): readonly TimingEntry[] {
  const glossary = everyGlossaryEntry();
  const seen = new Set<string>();
  const entries: TimingEntry[] = [];
  for (const ref of activeAbilityRefs(state, instanceId)) {
    const trigger = deps.abilities[ref.id]?.trigger;
    if (!trigger) continue;
    const glossaryId = TRIGGER_GLOSSARY_ID[trigger.kind];
    if (!glossaryId || seen.has(glossaryId)) continue;
    seen.add(glossaryId);
    const entry = glossary.find((candidate) => candidate.id === glossaryId);
    if (!entry) continue;
    entries.push({ label: triggerLabel(trigger), definition: entry.definition, citeLabel: entry.citeLabel });
  }
  return entries;
}

/** Every keyword this card prints, with the glossary's own definition — for the Inspect sheet's "keywords" box. */
function keywordDefinitionsFor(state: GameState, instanceId: InstanceId, deps: EngineDeps): readonly KeywordDefinition[] {
  const seen = new Set<string>();
  const entries: KeywordDefinition[] = [];
  for (const keyword of keywordsOf(state, instanceId, deps)) {
    if (seen.has(keyword.name)) continue;
    seen.add(keyword.name);
    const entry = glossaryEntry(keyword.name);
    if (!entry) continue;
    entries.push({ label: entry.displayName, definition: entry.definition, citeLabel: citeLabelOf(entry.sources) });
  }
  return entries;
}
