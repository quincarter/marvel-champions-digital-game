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
import {
  cardOf,
  characterProfile,
  getInstance,
  keywordsOf,
  maxHitPoints,
  printedResources,
  remainingHitPoints,
  type EngineDeps,
  type GameState,
  type InstanceId,
  type LegalActions,
  type PlayerId,
} from "@mc/engine";
import { artFor, type ArtSource, type CardFace } from "../art/art-source.js";
import { abilityActionsFor } from "./highlights.js";
import { abilityLabelOf } from "./ability-label.js";
import { cardName } from "./names.js";
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

export interface InspectModel {
  readonly instanceId: InstanceId;
  readonly name: string;
  /** "Event · Attack · Justice" — type, first traits, aspect. */
  readonly typeLine: string;
  /** The printed cost, or null for a card that has none. */
  readonly cost: number | null;
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
}

export function inspectModel(
  state: GameState,
  instanceId: InstanceId,
  legal: LegalActions | null,
  perspectiveId: PlayerId,
  deps: EngineDeps,
): InspectModel {
  const instance = getInstance(state, instanceId);
  const card = cardOf(state, instanceId);
  const hidden = !faceVisible(state, instanceId);

  if (!instance || !card || hidden) {
    return {
      instanceId,
      name: cardName(state, instanceId),
      typeLine: "Facedown",
      cost: null,
      // A hidden card is exactly as informative as the table makes it.
      rulesText: "This card is facedown. Nothing about its face is known to you.",
      printedText: null,
      flavor: null,
      resourceIcons: [],
      stats: [],
      keywords: [],
      traits: instance?.facedownAs ? instance.facedownAs.traits : [],
      // The back of whichever deck it came from — which is exactly what a
      // player sees at the table, and gives the sheet something true to show.
      art: artFor(undefined, faceOf(state, instanceId)),
      footerLeft: "",
      footerRight: "",
      status: { playable: null, message: "", targets: [] },
      abilities: [],
      hidden: true,
    };
  }

  const profile = characterProfile(state, instanceId, deps);
  const current = remainingHitPoints(state, instanceId, deps);
  const max = maxHitPoints(state, instanceId, deps);

  return {
    instanceId,
    name: cardName(state, instanceId),
    typeLine: typeLineOf(card),
    cost: "cost" in card && typeof card.cost === "number" ? card.cost : null,
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
    keywords: keywordsOf(state, instanceId, deps).map(keywordLabel),
    traits: "traits" in card ? (card.traits as readonly string[]) : [],
    // The face in play, not "the front": a villain's picture lives on its
    // stage and a main scheme's on its side, so asking for a front gets
    // nothing at all for exactly the cards a player most wants to read.
    art: artFor(card, faceOf(state, instanceId)),
    footerLeft: `${card.setCode as string} · ${card.collectorNumber}`,
    footerRight: [card.unique ? "Unique" : null, `×${card.quantityInSet} in set`].filter(Boolean).join(" · "),
    status: statusOf(state, instanceId, legal, perspectiveId),
    abilities: usableAbilitiesOf(state, instanceId, legal, deps),
    hidden: false,
  };
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
      rulesText: "",
      printedText: null,
      flavor: null,
      resourceIcons: [],
      stats: [],
      keywords: [],
      traits: [],
      art: null,
      footerLeft: "",
      footerRight: "",
      status: { playable: null, message: "", targets: [] },
      abilities: [],
      hidden: false,
    };
  }
  const text = textOf(card, face);
  return {
    instanceId: "" as InstanceId,
    name: faceNameOf(card, face),
    typeLine: typeLineOf(card),
    cost: "cost" in card && typeof card.cost === "number" ? card.cost : null,
    rulesText: text.current,
    printedText: text.printed && text.printed !== text.current ? text.printed : null,
    flavor: flavorOf(card, face),
    resourceIcons: resourceIconList(printedResources(card)),
    stats: [],
    keywords: printedKeywordsOf(card, face).map(keywordLabel),
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
  };
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
      message: playable.needsPayment ? "Playable — you can afford it." : "Playable.",
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
