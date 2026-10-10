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

import { perPlayerCostOf, type PerPlayerCost } from "./per-player-cost.js";
import type { AbilityId, AnyCard, KeywordInstance, ResourceIconType } from "@mc/content";
import { keywordLabel } from "./keyword-label.js";
import { glossaryEntry } from "@mc/content";
import {
  activeAbilityRefs,
  cardOf,
  cardsInPlay,
  characterProfile,
  controllerOf,
  generatedResources,
  getInstance,
  handCardResources,
  keywordsOf,
  locateCard,
  maxHitPoints,
  offeredByOpenChoice,
  playCostOf,
  printedCostOf,
  printedResources,
  remainingHitPoints,
  selfDamageThreshold,
  traitsOf,
  type AbilityTriggerSpec,
  type EngineDeps,
  type GameState,
  type InstanceId,
  type LegalActions,
  type PlayerId,
  type ResourceGeneration,
  type ResourcePool,
  type TargetQuery,
} from "@mc/engine";
import { artFor, type ArtSource, type CardFace } from "../art/art-source.js";
import { abilityActionsFor } from "./highlights.js";
import { qualifiedHeroName } from "./hero-names.js";
import { abilityLabelOf } from "./ability-label.js";
import { cardHistoryOf, emptyCardHistoryLog, type CardHistoryLine, type CardHistoryLog } from "./card-history.js";
import { cardName, faceUpName } from "./names.js";
import { cardTextDisplay } from "./card-text-display.js";
import { howThisWorksFor } from "./how-this-works.js";
import { citeLabelOf, everyGlossaryEntry } from "./rules-reference.js";
import { faceVisible } from "./visibility.js";
import { poolTeamUpPairs, teamUpNoticeFor, teamUpWhyNot, type TeamUpNotice } from "./team-up-model.js";
import { hitPointFloorNote, resourceIconNote, scenarioAreaNotes } from "./inspect-notes.js";
import {
  damageNote,
  counterNote,
  countersOf,
  threatNote,
  threatOnCard,
  faceOf,
  printedStatsOf,
  profileStatTiles,
  resourceIconList,
  type StatTile,
} from "./board-model.js";
import { aspectName } from "./aspect-stamp.js";

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

/**
 * The warning a card that removes *itself* from the campaign carries (MC10's TECH upgrades: "Discard this card and
 * remove it from the campaign log → …"). RRG 1.8 p. 29 keeps that removal even when the game it happened in is lost
 * and retried, which is exactly what a player doesn't expect from "reset the scenario and try again with no
 * penalty" (MC10 p. 3) — so the sheet says it outright, and links the rule.
 */
export interface CampaignNotice {
  readonly heading: string;
  readonly text: string;
  /** What the notice's link searches the Rules glossary for: the entry's own display name, which the search matches. */
  readonly rulesQuery: string;
  /** "Rule: Removed from the campaign (RRG 1.8 p. 29)". */
  readonly linkLabel: string;
}

const SELF_REMOVAL = /remove (it|this card) from the campaign/i;

/** The notice for a card whose own text removes it from the campaign, or null. Read off the current wording. */
export function campaignNoticeFor(rulesText: string): CampaignNotice | null {
  if (!SELF_REMOVAL.test(rulesText)) return null;
  const entry = glossaryEntry("removedFromCampaign");
  return {
    heading: "Spent for good",
    text: "Once you use this card, it is removed from the campaign. Even if you lose this battle and retry, this card stays spent and removed. The game takes it out of your deck for you.",
    rulesQuery: entry?.displayName ?? "Removed from the campaign",
    linkLabel: entry ? `Rule: ${entry.displayName} (${citeLabelOf(entry.sources)})` : "Rule: Removed from the campaign",
  };
}

export interface InspectModel {
  readonly instanceId: InstanceId;
  readonly name: string;
  /** "Event · Attack · Justice" — type, first traits, aspect. */
  readonly typeLine: string;
  /**
   * The printed cost in this game, or null for a card that has none. A per player cost is already scaled (2 per
   * player in a 2-player game is 4): the badge prints this, and `perPlayerCost` says where it came from.
   */
  readonly cost: number | null;
  /** The per player icon on the cost, worded for the badge and the cost line; null for a flat cost. */
  readonly perPlayerCost: PerPlayerCost | null;
  /**
   * What it costs to play right now (`playCostOf`): `cost` unless something on the table changes the price. What a
   * Play button prints, since the table charges this and not the scan's pip. Equals `cost` with no game behind the sheet.
   */
  readonly currentCost: number | null;
  /**
   * Why this card does not cost what it prints, named — "Steve Rogers: 3 → 2" — or null when it does.
   *
   * The sheet is where a player comes to settle an argument with the table, so it is where the answer to
   * "why is this cheaper than the pip says?" belongs. Null on a sheet with no game behind it (the Title
   * screen's pickers), where there is no table to price against.
   */
  readonly priceNote: string | null;
  /**
   * For a card whose resources depend on the table (Band Together, `mts` 21018: "generates [wild] for each ally you
   * control (to a maximum of 3)"): what it is worth right now and why, since it prints no fixed resource icon. Null
   * for every card whose resources are simply printed.
   */
  readonly resourceNote: string | null;
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
  /**
   * "3/5 damage" on a card in play with no hit points of its own (Crossbones' Armor, Ice Wall, Avengers Tower),
   * against the point its own text acts at. A character's damage is already its HP stat, so it is null there, and
   * null for a card with no damage and no threshold, or no game behind it.
   */
  readonly damageNote: string | null;
  /** "2 threat" on a card that is not a scheme but holds threat (engine §3.59); null at 0 and for every scheme. */
  readonly threatNote: string | null;
  /** "3 ratings counters, 1 infamy counter" on the card itself (MaGog's crowds, Quinjet's time), null with none. */
  readonly counterNote: string | null;
  /** "Considered to have at least 1 hit point" while a rule sets a floor (`hitPointFloor`, wave 8 §3.10); else null. */
  readonly hitPointFloorNote: string | null;
  /** "Resource icons: energy, wild (not printed: wild)" for a card in play a rule gives an icon (§3.42); else null. */
  readonly resourceIconNote: string | null;
  /** For a card in a scenario play area (the mission area, §3.33): no controller, closed area, blank ally text. */
  readonly areaNotes: readonly string[];
  /** True when an open payment (threaded in as `InspectPayment`) could still spend this exact card. */
  readonly canPayAsResource: boolean;
  /**
   * The one-line "How this works" note for a card whose wording is easy to misread (`view/how-this-works.ts`, guided
   * mode section 3.14), or null. A paraphrase, shown at every guide level in the RULES & STATE panel, and the same on a
   * sheet with no game behind it.
   */
  readonly howItWorks: string | null;
  /** `campaignNoticeFor` — set only on a card whose own text removes it from the campaign. */
  readonly campaignNotice: CampaignNotice | null;
  /**
   * The Team-Up callout (`teamUpNoticeFor`), shown first in RULES & STATE: on a Team-Up card whether its pair is
   * active, and on an ally in hand that would complete a pair. Null on every other card.
   */
  readonly teamUpNotice: TeamUpNotice | null;
}

export function inspectModel(
  state: GameState,
  instanceId: InstanceId,
  legal: LegalActions | null,
  perspectiveId: PlayerId,
  deps: EngineDeps,
  opts: {
    readonly history?: CardHistoryLog;
    readonly payment?: InspectPayment | null;
    /** Show this printed face instead of the live one (an identity ability's own side, `abilityFaceOf`). */
    readonly face?: CardFace;
  } = {},
): InspectModel {
  const history = opts.history ?? emptyCardHistoryLog();
  const payment = opts.payment ?? null;
  const instance = getInstance(state, instanceId);
  const card = cardOf(state, instanceId);
  // Seen through this seat's eyes: a card only this player may look at (the encounter deck's top card under a "you may
  // look at the top card of the encounter deck" rule, docs/phase7-wave5.md §3.28) shows its face here and nowhere else.
  // A card the open decision offers is read by the player it belongs to (the engine's rule), whoever's seat is up.
  const view = {
    viewer: offeredByOpenChoice(state, instanceId) ? (state.pendingChoice?.playerId ?? perspectiveId) : perspectiveId,
    deps,
  };
  const hidden = !faceVisible(state, instanceId, view);

  if (!instance || !card || hidden) {
    // A card in a facedown pile (the encounter deck, Storm's Weather deck, an Invocation deck) is not "a facedown
    // card": the pile is what the player tapped, and its size is the one thing the table lets them know.
    const pile = facedownPileOf(state, instanceId);
    return {
      instanceId,
      name: pile ? pile.name : cardName(state, instanceId),
      typeLine: pile ? `Facedown · ${pile.count} card${pile.count === 1 ? "" : "s"}` : "Facedown",
      cost: null,
      perPlayerCost: null,
      currentCost: null,
      priceNote: null,
      resourceNote: null,
      // A hidden card is exactly as informative as the table makes it.
      rulesText: pile
        ? "These cards are facedown. Nothing about their faces is known to you."
        : "This card is facedown. Nothing about its face is known to you.",
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
      damageNote: null,
      threatNote: null,
      counterNote: null,
      hitPointFloorNote: null,
      resourceIconNote: null,
      areaNotes: [],
      canPayAsResource: false,
      howItWorks: null,
      campaignNotice: null,
      teamUpNotice: null,
    };
  }

  const profile = characterProfile(state, instanceId, deps);
  const current = remainingHitPoints(state, instanceId, deps);
  const max = maxHitPoints(state, instanceId, deps);
  const keywordChips = keywordsOf(state, instanceId, deps).map((keyword): KeywordChip => ({
    text: keywordLabel(keyword),
    glossaryId: glossaryEntry(keyword.name) ? keyword.name : null,
  }));

  // The face in play, asked for once and used for everything the sheet prints. The art always followed it; the
  // name, type line, stats and text used to read the card's *front* — so Wanda Maximoff's picture sat over the
  // name "Scarlet Witch", hero stats of 0 and Chaos Control, a power she doesn't have in that form, while the
  // button below correctly offered Superpowered Siblings. Reported from play. The same default read a villain on
  // stage II as stage I.
  const face = opts.face ?? faceOf(state, instanceId, view);

  return {
    instanceId,
    name:
      card.type === "hero_identity" || face.kind === "flipSide"
        ? faceNameOf(card, face)
        : cardName(state, instanceId, view),
    typeLine: typeLineOf(card, face),
    cost: "cost" in card && typeof card.cost === "number" ? printedCostOf(state, card) : null,
    perPlayerCost: perPlayerCostOf(state, card),
    currentCost: currentCostFor(state, perspectiveId, instanceId, card, deps),
    priceNote: priceNoteFor(state, perspectiveId, instanceId, deps),
    resourceNote:
      liveResourceNote(state, instanceId, card, deps) ?? resourceAbilityNote(state, instanceId, deps, payment),
    rulesText: cardTextDisplay(textOf(card, face).current),
    printedText: errataDiff(card, face),
    flavor: flavorOf(card, face),
    resourceIcons: resourceIconList(printedResources(card, face.kind === "flipSide")),
    // The shared builder the board uses, so a buff reads the same in both places.
    // An identity shows the stats of the form it is in: an alter-ego prints REC and no THW/ATK/DEF, and listing
    // those as 0 beside it read as a hero who had been weakened rather than one who isn't here.
    stats: profile
      ? profileStatTiles(
          profile,
          printedStatsOf(state, instanceId),
          profile.kind === "identity"
            ? face.kind === "alterEgo"
              ? ["rec"]
              : ["thw", "atk", "def"]
            : profile.kind === "ally"
              ? ["thw", "atk"]
              : ["atk", "sch"],
          current,
          max,
        )
      : [],
    keywords: keywordChips.map((chip) => chip.text),
    keywordChips,
    // `traitsOf` (`@mc/engine`), not `"traits" in card`: a villain's and a main scheme's printed traits live on
    // their *stage* (`VillainStage.traits`/`MainSchemeStage.traits`), never on the top-level card, so the naive
    // field check silently read as "no traits" for every villain and every main scheme — found inspecting Rhino
    // (BRUTE. CRIMINAL. on the card, nothing in the sheet's traits chips) while verifying this rebuild in the
    // browser. `traitsOf` is the same per-face/per-stage/granted-traits lookup `keywordsOf` above already uses.
    traits: traitsOf(state, instanceId, deps),
    // The face in play, not "the front": a villain's picture lives on its
    // stage and a main scheme's on its side, so asking for a front gets
    // nothing at all for exactly the cards a player most wants to read.
    art: artFor(card, face),
    footerLeft: `${card.setCode as string} · ${card.collectorNumber}`,
    footerRight: [card.unique ? "Unique" : null, `×${card.quantityInSet} in set`].filter(Boolean).join(" · "),
    status: statusOf(state, instanceId, legal, perspectiveId, payment),
    abilities: usableAbilitiesOf(state, instanceId, legal, deps),
    hidden: false,
    timing: timingEntriesFor(state, instanceId, deps),
    keywordDefinitions: keywordDefinitionsFor(state, instanceId, deps),
    history: cardHistoryOf(history, instanceId, state, perspectiveId, deps),
    damageNote:
      current === undefined ? damageNote(instance.damage, selfDamageThreshold(state, instanceId, deps)) : null,
    threatNote: threatNote(threatOnCard(state, instanceId)),
    counterNote: counterNote(countersOf(state, instanceId)),
    hitPointFloorNote: hitPointFloorNote(state, instanceId, deps),
    resourceIconNote: resourceIconNote(state, deps, instanceId),
    areaNotes: scenarioAreaNotes(state, deps, instanceId),
    canPayAsResource: payment !== null && payment.spendableInstanceIds.has(instanceId),
    howItWorks: howThisWorksFor(card),
    campaignNotice: campaignNoticeFor(textOf(card, face).current),
    teamUpNotice: teamUpNoticeFor(state, card, instanceId, poolTeamUpPairs(state)),
  };
}

/**
 * What the viewer pays to play this card right now, from the engine's own price (`playCostOf`), which a Play button
 * prints instead of the scan's pip. The printed cost when the engine has no price for it, null for a card with none.
 */
function currentCostFor(
  state: GameState,
  perspectiveId: PlayerId,
  instanceId: InstanceId,
  card: AnyCard,
  deps: EngineDeps,
): number | null {
  const printed = "cost" in card && typeof card.cost === "number" ? card.cost : null;
  if (printed === null) return null;
  return playCostOf(state, perspectiveId, instanceId, deps)?.current ?? printed;
}

/**
 * "Steve Rogers: 3 → 2" — the cards changing this card's price, and the price they change it to. Null when the
 * table charges exactly what the card prints, which is most cards most of the time.
 *
 * Priced for the viewer, since a cost modifier can be one seat's and not another's, and with no attachment host:
 * an upgrade's host isn't chosen until the play is under way, so a host-conditional price isn't earned yet.
 */
function priceNoteFor(
  state: GameState,
  perspectiveId: PlayerId,
  instanceId: InstanceId,
  deps: EngineDeps,
): string | null {
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

/** The hand-resource rule a card's own constant ability sets (`handGenerates`, docs/phase7-wave4.md §3.38), if any. */
function handGenerationOf(card: AnyCard, deps: EngineDeps): ResourceGeneration | undefined {
  const refs = "abilities" in card ? (card.abilities as readonly { readonly id: AbilityId }[]) : [];
  for (const ref of refs) {
    const trigger = deps.abilities[ref.id]?.trigger;
    if (trigger?.kind === "constant" && trigger.handGenerates !== undefined) return trigger.handGenerates;
  }
  return undefined;
}

/** "ally you control", from the query a per-card generation counts. */
function describeCounted(query: TargetQuery): string {
  const kinds = (query.categories ?? []).map((category) => category.replace(/_/g, " ")).join(" or ") || "card";
  return query.controller === "you" ? `${kinds} you control` : kinds;
}

/** "1 wild per ally you control, up to 3": a per-card generation in words, or null for any other kind. */
function perCardClause(generation: ResourceGeneration | undefined): string | null {
  if (typeof generation !== "object" || !("kind" in generation) || generation.kind !== "perCard") return null;
  const cap = generation.max !== undefined ? `, up to ${generation.max}` : "";
  return `1 ${generation.resource} per ${describeCounted(generation.per)}${cap}`;
}

/** What the card is worth if its owner spends it now, and the rule behind the number. */
function liveResourceNote(state: GameState, instanceId: InstanceId, card: AnyCard, deps: EngineDeps): string | null {
  const generation = handGenerationOf(card, deps);
  const clause = perCardClause(generation);
  const owner = getInstance(state, instanceId)?.ownerId;
  if (!clause || !owner || typeof generation !== "object" || !("kind" in generation) || generation.kind !== "perCard")
    return null;
  const now = handCardResources(state, deps, instanceId, owner, null)[generation.resource];
  return `Worth ${now} ${generation.resource} right now: ${clause}. It can pay any cost.`;
}

/** The hero name a player's identity goes by on the table, or null if it cannot be read. */
function identityNameOf(state: GameState, playerId: PlayerId): string | null {
  const identity = state.players.find((player) => player.playerId === playerId)?.identity;
  const card = identity ? cardOf(state, identity.instanceId) : undefined;
  return card?.type === "hero_identity" ? qualifiedHeroName(card, card.hero.faceName) : null;
}

/**
 * A resource ability's generation spec in plain words: a fixed amount ("1 physical"), a per-count amount ("1 physical
 * for each tough status card on Colossus (now: 2)"), a per-card one, and any other shape as "resources (now: ...)".
 * `now` is the engine's own reading of what it would generate this moment, `pool` the same as numbers.
 */
export function describeGeneration(
  generation: ResourceGeneration | undefined,
  now: string,
  pool: Partial<ResourcePool>,
  identityName: string | null = null,
): string {
  if (generation === undefined || typeof generation === "number" || !("kind" in generation)) return now;
  if (generation.kind === "perCard") return `${perCardClause(generation)} (now: ${now})`;
  if (generation.kind === "amount" && generation.amount.kind === "statusCount") {
    const of = generation.amount.of;
    const name =
      of.kind === "identityOf" ? (identityName ?? undefined) : of.kind === "each" ? of.query.name : undefined;
    const holder = name ?? (of.kind === "host" ? "the card it is attached to" : "this card");
    return `1 ${generation.resource} for each ${generation.amount.status} status card on ${holder} (now: ${pool[generation.resource] ?? 0})`;
  }
  if (generation.kind === "amount" && generation.amount.kind === "const") {
    return `${generation.amount.value} ${generation.resource}`;
  }
  return `resources (now: ${now})`;
}

/**
 * For a card in play with a resource ability the player can use while paying (Titanium Muscles: "Hero Resource:
 * Exhaust this card -> generate a [physical] resource for each tough status card on Colossus"): says so plainly, with
 * what it would generate right now, and, while a payment is open and could spend it, that it is available. Read from
 * the registry's own ability definitions (`trigger.kind === "resource"`), never from card names. Null for every card
 * with no such ability, and for any card not in play.
 */
function resourceAbilityNote(
  state: GameState,
  instanceId: InstanceId,
  deps: EngineDeps,
  payment: InspectPayment | null,
): string | null {
  if (!cardsInPlay(state).includes(instanceId)) return null;
  const instance = getInstance(state, instanceId);
  const controller = controllerOf(state, instanceId);
  if (!instance || !controller) return null;
  for (const ref of activeAbilityRefs(state, instanceId, deps)) {
    const definition = deps.abilities[ref.id];
    const trigger = definition?.trigger;
    if (!definition || trigger?.kind !== "resource") continue;
    const pool = generatedResources(state, definition.generates, null, {
      deps,
      sourceId: instanceId,
      playerId: controller,
    });
    const parts = (["physical", "mental", "energy", "wild"] as const)
      .filter((type) => pool[type] > 0)
      .map((type) => `${pool[type]} ${type}`);
    const now = parts.length > 0 ? parts.join(" and ") : "nothing";
    const generates = describeGeneration(definition.generates, now, pool, identityNameOf(state, controller));
    const form =
      "form" in trigger && trigger.form ? ` in ${trigger.form === "alterEgo" ? "alter-ego" : "hero"} form` : "";
    const exhaust = definition.cost?.exhaustSelf === true;
    let text =
      `Can be used as a resource${form} while you pay for a card: ${exhaust ? "exhaust it to generate" : "generates"} ` +
      `${generates}.`;
    if (exhaust && instance.exhausted) text += " It is exhausted right now, so it has to ready first.";
    else if (payment !== null && payment.spendableInstanceIds.has(instanceId)) {
      text += " Available right now: tap it in the payment row.";
    }
    return text;
  }
  return null;
}

/** Every action ability `legalActions` currently lists for this card, named and priced. */
function usableAbilitiesOf(
  state: GameState,
  instanceId: InstanceId,
  legal: LegalActions | null,
  deps: EngineDeps,
): readonly UsableAbility[] {
  if (!legal) return [];
  return abilityActionsFor(legal, instanceId).map((entry) => ({
    abilityId: entry.action.abilityId,
    label: abilityLabelOf(state, instanceId, entry.action.abilityId, deps),
    needsPayment: entry.needsPayment,
  }));
}

/**
 * The hero face a `CardFace` names: `card.hero` for `{ kind: "hero" }` or anything else, or `additionalHeroForms[i
 * - 1]` for `{ kind: "heroForm", index: i }` — Spectrum's energy/density/mass forms and Ant-Man/Wasp's Giant form
 * (docs/phase7-wave2.md §3.2, docs/phase7-wave4.md §5). Falls back to `card.hero` for an out-of-range index rather
 * than throwing, the same defensive default `art-source.ts`'s own `localRefFor`/`imageRefFor` use.
 */
function heroFaceOf(card: Extract<AnyCard, { readonly type: "hero_identity" }>, face: CardFace) {
  if (face.kind === "heroForm") return card.additionalHeroForms?.[face.index - 1] ?? card.hero;
  return card.hero;
}

/** Every card kind's text, since the schema keeps it in a different place per kind. */
function textOf(
  card: AnyCard,
  face: CardFace = { kind: "front" },
): { readonly printed: string; readonly current: string } {
  // Checked before the generic `"text" in card` branch below: a flip-side face (MC27 p. 22's Enhanced S.H.I.E.L.D.
  // Tech, Criminal Enterprise → State of Madness) still has its own top-level `text`, so that branch would
  // otherwise always win and this face's own printed text would never be reachable.
  if (face.kind === "flipSide" && "flipSide" in card && card.flipSide) return card.flipSide.text;
  if ("text" in card) return card.text;
  if (card.type === "hero_identity") return face.kind === "alterEgo" ? card.alterEgo.text : heroFaceOf(card, face).text;
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
  if (face.kind === "flipSide" && "flipSide" in card && card.flipSide) return card.flipSide.keywords;
  if (card.type === "hero_identity")
    return face.kind === "alterEgo" ? card.alterEgo.keywords : heroFaceOf(card, face).keywords;
  if (card.type === "villain") {
    const side = face.kind === "villainStage" ? (card.sides[face.sideIndex] ?? card.sides[0]) : card.sides[0];
    return (face.kind === "villainStage" ? (side.stages[face.stageIndex] ?? side.stages[0]) : side.stages[0]).keywords;
  }
  if (card.type === "main_scheme") {
    return (face.kind === "mainSchemeStage" ? (card.stages[face.stageIndex] ?? card.stages[0]) : card.stages[0])
      .keywords;
  }
  return "keywords" in card ? card.keywords : [];
}

/** The traits printed on one face. A hero's two sides do not share them. */
function printedTraitsOf(card: AnyCard, face: CardFace): readonly string[] {
  if (face.kind === "flipSide" && "flipSide" in card && card.flipSide) return card.flipSide.traits as readonly string[];
  if (card.type === "hero_identity") {
    return (face.kind === "alterEgo" ? card.alterEgo.traits : heroFaceOf(card, face).traits) as readonly string[];
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
      perPlayerCost: null,
      currentCost: null,
      priceNote: null,
      resourceNote: null,
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
      damageNote: null,
      threatNote: null,
      counterNote: null,
      hitPointFloorNote: null,
      resourceIconNote: null,
      areaNotes: [],
      canPayAsResource: false,
      howItWorks: null,
      campaignNotice: null,
      teamUpNotice: null,
    };
  }
  const text = textOf(card, face);
  const keywordChips = printedKeywordsOf(card, face).map((keyword): KeywordChip => ({
    text: keywordLabel(keyword),
    glossaryId: glossaryEntry(keyword.name) ? keyword.name : null,
  }));
  return {
    instanceId: "" as InstanceId,
    name: faceNameOf(card, face),
    typeLine: typeLineOf(card, face),
    cost: "cost" in card && typeof card.cost === "number" ? card.cost : null,
    perPlayerCost: perPlayerCostOf(null, card),
    currentCost: "cost" in card && typeof card.cost === "number" ? card.cost : null,
    priceNote: null,
    resourceNote: null,
    rulesText: cardTextDisplay(text.current),
    printedText: text.printed && text.printed !== text.current ? text.printed : null,
    flavor: flavorOf(card, face),
    resourceIcons: resourceIconList(printedResources(card, face.kind === "flipSide")),
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
    damageNote: null,
    threatNote: null,
    counterNote: null,
    hitPointFloorNote: null,
    resourceIconNote: null,
    areaNotes: [],
    canPayAsResource: false,
    howItWorks: howThisWorksFor(card),
    campaignNotice: campaignNoticeFor(text.current),
    teamUpNotice: teamUpNoticeFor(null, card, null, []),
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
  if (face.kind === "flipSide" && "flipSide" in card && card.flipSide) return card.flipSide.name;
  if (card.type !== "hero_identity") return card.name;
  return face.kind === "alterEgo" ? card.alterEgo.faceName : qualifiedHeroName(card, heroFaceOf(card, face).faceName);
}

function flavorOf(card: AnyCard, face: CardFace): string | null {
  if (card.type === "hero_identity") {
    return (face.kind === "alterEgo" ? card.alterEgo.flavor : heroFaceOf(card, face).flavor) ?? null;
  }
  return "flavor" in card && card.flavor ? card.flavor : null;
}

/** The printed wording, only when it differs from what the game plays by. */
function errataDiff(card: AnyCard, face: CardFace = { kind: "front" }): string | null {
  const text = textOf(card, face);
  return text.printed && text.printed !== text.current ? text.printed : null;
}

/** "Weather deck" and how many cards it holds, for a card sitting in a facedown deck; null anywhere else. */
export function facedownPileOf(
  state: GameState,
  instanceId: InstanceId,
): { readonly name: string; readonly count: number } | null {
  const where = locateCard(state, instanceId);
  if (!where) return null;
  const named = (name: string): string => (/\bdeck$/i.test(name) ? name : `${name} deck`);
  switch (where.kind) {
    case "encounterDeck":
      return { name: "Encounter deck", count: state.encounterDecks[where.deckId]?.deck.length ?? 0 };
    case "scenarioDeck":
      return { name: named(where.name), count: state.scenarioDecks[where.name]?.deck.length ?? 0 };
    case "separateDeck": {
      const player = state.players.find((seat) => seat.playerId === where.playerId);
      return { name: named(where.name), count: player?.separateDecks[where.name]?.deck.length ?? 0 };
    }
    case "deck": {
      const player = state.players.find((seat) => seat.playerId === where.playerId);
      return { name: "Deck", count: player?.deck.length ?? 0 };
    }
    default:
      return null;
  }
}

function typeLineOf(card: AnyCard, face: CardFace = { kind: "front" }): string {
  // An identity's type line is its form's: "ALTER-EGO · MYSTIC", not "HERO IDENTITY" for both sides.
  if (card.type === "hero_identity") {
    const side = face.kind === "alterEgo" ? card.alterEgo : card.hero;
    return [face.kind === "alterEgo" ? "alter-ego" : "hero", ...(side.traits as readonly string[]).slice(0, 2)]
      .join(" · ")
      .toUpperCase();
  }
  const parts: string[] = [card.type.replace(/_/g, " ")];
  // The face showing, not the front: Phoenix Force flipped to Unleashed reads UNLEASHED, never RESTRAINED.
  if (face.kind === "flipSide" && "flipSide" in card && card.flipSide) {
    parts.push(...(card.flipSide.traits as readonly string[]).slice(0, 2));
  } else if ("traits" in card) parts.push(...(card.traits as readonly string[]).slice(0, 2));
  if ("aspect" in card && typeof card.aspect === "string" && !card.aspect.startsWith("hero:")) {
    parts.push(aspectName(card.aspect));
  }
  return parts.join(" · ").toUpperCase();
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
  // A non-active seat's off-turn Actions (`notYourTurn`) carry the same legal and illegal lists as a turn.
  if (!legal || (legal.kind !== "turn" && legal.kind !== "notYourTurn")) {
    return {
      playable: null,
      message: legal?.kind === "choice" ? "A decision is open — answer it first." : "",
      targets: [],
    };
  }
  const owned = state.players.find((player) => player.playerId === perspectiveId)?.hand.includes(instanceId) ?? false;

  const playable = legal.legal.find(
    (entry) =>
      (entry.action.kind === "playCard" || entry.action.kind === "useAbility") &&
      entry.action.instanceId === instanceId,
  );
  if (playable) {
    return {
      playable: true,
      // The design's own sentence ("Playable. Cost 3 — you have 2 resources committed, 1 short.") only exists
      // while a payment for *this exact card* is actually open — the Board opens payment mode the moment a hand
      // card with a cost is tapped, and a right-click/hold on it while that's happening is exactly the mid-payment
      // scenario the mock draws. Outside that, "2 resources committed" isn't a number the engine has an answer
      // for yet (nothing has been picked), so the plainer sentence stands rather than inventing one.
      message:
        paymentMessage(payment, instanceId) ?? (playable.needsPayment ? "Playable — you can afford it." : "Playable."),
      targets: playable.targets.map((target) => cardName(state, target)),
    };
  }
  const illegal = legal.illegal.find(
    (entry) =>
      (entry.action.kind === "playCard" || entry.action.kind === "useAbility") &&
      entry.action.instanceId === instanceId,
  );
  if (illegal) return { playable: false, message: teamUpWhyNot(state, instanceId, illegal.message), targets: [] };

  // Not a card the player could play — but it may be something they can aim at.
  const aimedAt = legal.legal.filter((entry) => entry.targets.includes(instanceId));
  if (aimedAt.length > 0) {
    return {
      playable: null,
      message: `A legal target for: ${aimedAt.map((entry) => entry.action.kind).join(", ")}.`,
      targets: [],
    };
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

/**
 * "Hero Action", "Forced Interrupt", "When Revealed" — the structural name of one ability header, from its trigger
 * spec alone. Exported for `view/choice-source-panel.ts`, which needs the same header on a choice's own source card
 * ("Response — Backflip") and would otherwise be re-deriving it from `AbilityTriggerSpec` a second time.
 */
export function triggerLabel(trigger: AbilityTriggerSpec): string {
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
    case "preparation":
      return "Preparation";
    // "Attach to … If you cannot, …": the printed attach instruction, which has no header of its own.
    case "cannotAttach":
      return "Attach To";
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
function keywordDefinitionsFor(
  state: GameState,
  instanceId: InstanceId,
  deps: EngineDeps,
): readonly KeywordDefinition[] {
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
