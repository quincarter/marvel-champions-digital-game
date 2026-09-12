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

import type { AnyCard, KeywordInstance, ResourceIconType } from "@mc/content";
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
import { artFor, type ArtSource } from "../art/art-source.js";
import { cardName } from "./names.js";
import { resourceIconList, type StatTile } from "./board-model.js";

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
  const hidden = !instance?.faceup;

  if (!instance || !card || hidden) {
    return {
      instanceId,
      name: cardName(state, instanceId),
      typeLine: "Facedown",
      cost: null,
      // A facedown card is exactly as informative as the engine says it is.
      rulesText: "This card is facedown. Nothing about its face is known to you.",
      printedText: null,
      flavor: null,
      resourceIcons: [],
      stats: [],
      keywords: [],
      traits: instance?.facedownAs ? instance.facedownAs.traits : [],
      art: null,
      footerLeft: "",
      footerRight: "",
      status: { playable: null, message: "", targets: [] },
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
    stats: profile ? profileTiles(profile, current, max) : [],
    keywords: keywordsOf(state, instanceId, deps).map(keywordLabel),
    traits: "traits" in card ? (card.traits as readonly string[]) : [],
    art: artFor(card, { kind: "front" }),
    footerLeft: `${card.setCode as string} · ${card.collectorNumber}`,
    footerRight: [card.unique ? "Unique" : null, `×${card.quantityInSet} in set`].filter(Boolean).join(" · "),
    status: statusOf(state, instanceId, legal, perspectiveId),
    hidden: false,
  };
}

/** Every card kind's text, since the schema keeps it in a different place per kind. */
function textOf(card: AnyCard): { readonly printed: string; readonly current: string } {
  if ("text" in card) return card.text;
  if (card.type === "hero_identity") return card.hero.text;
  if (card.type === "villain") return card.sides[0].stages[0].text;
  if (card.type === "main_scheme") return card.stages[0].text;
  return { printed: "", current: "" };
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

function profileTiles(
  profile: NonNullable<ReturnType<typeof characterProfile>>,
  current: number | undefined,
  max: number | undefined,
): readonly StatTile[] {
  const dash = (stat: "atk" | "thw" | "sch", amount: number): string =>
    profile.missing.includes(stat) ? "—" : String(amount);
  const tiles: StatTile[] = [];
  if (profile.kind === "identity") {
    tiles.push({ label: "THW", value: dash("thw", profile.thw) });
    tiles.push({ label: "ATK", value: dash("atk", profile.atk) });
    tiles.push({ label: "DEF", value: String(profile.def) });
    tiles.push({ label: "REC", value: String(profile.rec) });
  } else if (profile.kind === "ally") {
    tiles.push({ label: "THW", value: dash("thw", profile.thw) });
    tiles.push({ label: "ATK", value: dash("atk", profile.atk) });
  } else {
    tiles.push({ label: "ATK", value: dash("atk", profile.atk) });
    tiles.push({ label: "SCH", value: dash("sch", profile.sch) });
  }
  if (current !== undefined && max !== undefined) tiles.push({ label: "HP", value: `${current}/${max}` });
  return tiles;
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
