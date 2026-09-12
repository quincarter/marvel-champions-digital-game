/**
 * Everything the Board scene draws, derived from `GameState` as plain data.
 *
 * The scene reads this and nothing else, so the whole board is testable without
 * a canvas (PLAN.md Phase 4, "thin scenes, plain-TS view models"). Every number
 * that can be modified comes from the engine's own `characterProfile` /
 * `remainingHitPoints` — the client never recomputes a stat, because a
 * client-side sum is exactly how a UI starts disagreeing with the rules.
 */

import type { Aspect, AnyCard, ResourceIconType } from "@mc/content";
import {
  cardOf,
  characterProfile,
  getInstance,
  getPlayer,
  isMinion,
  keywordsOf,
  mainSchemeStage,
  maxHitPoints,
  minionsEngagedWith,
  printedProfile,
  printedResources,
  remainingHitPoints,
  scale,
  schemesInPlay,
  type CardInstance,
  type EngineDeps,
  type Form,
  type GameState,
  type InstanceId,
  type PlayerId,
} from "@mc/engine";
import { artFor, type ArtSource, type CardBack, type CardFace } from "../art/art-source.js";
import { faceVisible } from "./visibility.js";
import { STATUS_DISABLES } from "../tokens.js";
import type { StatusName } from "./log-lines.js";
import { playerName } from "./names.js";

/** One of the 2px inner stat boxes in the design's entity card. */
export interface StatTile {
  readonly label: "ATK" | "THW" | "DEF" | "SCH" | "REC" | "HP";
  /** "—" for a printed dash: the character cannot use that power at all. */
  readonly value: string;
  /**
   * How far the engine's current value sits from the printed one: +1 from
   * Heroic Intuition, −1 from a condition, 0 when nothing modifies it.
   *
   * Read as modified − printed rather than summed from `statBonus`, so a "has a
   * base ATK of N" override counts too — the player cares that the number on
   * the table differs from the number on the card, whatever the cause. Always 0
   * for HP (its tile shows current/max, and the max already includes any bonus)
   * and for a printed dash, which no modifier makes usable.
   */
  readonly bonus: number;
}

/** A stat profile, as `characterProfile`/`printedProfile` both return it. */
type Profile = NonNullable<ReturnType<typeof characterProfile>>;

/**
 * The printed stats a `bonus` is measured against, or undefined when there are
 * none to measure against.
 *
 * A facedown card has no printed number. `printedProfile` reports a facedown
 * minion as all zeros, and Ultron's facedown Drones take their whole stat line
 * from base overrides (ATK 1, SCH 1, HP 1), so measuring against that zero
 * would have drawn a "+1" buff chip on every Drone in the game. Undefined
 * gives the builder nothing to subtract, which keeps `bonus` true to its own
 * promise: the table differs from *the card*, and here there is no card face.
 */
export function printedStatsOf(state: GameState, id: InstanceId): Profile | undefined {
  if (getInstance(state, id)?.facedownAs) return undefined;
  return printedProfile(state, id);
}

/**
 * The shared tile builder: board panels and the Inspect sheet both call this, so
 * the two can never disagree about what a buff looks like.
 */
export function profileStatTiles(
  profile: Profile,
  printed: Profile | undefined,
  rows: readonly ("thw" | "atk" | "def" | "rec" | "sch")[],
  current: number | undefined,
  max: number | undefined,
): readonly StatTile[] {
  const tiles: StatTile[] = rows.map((stat) => {
    const dashed = (stat === "atk" || stat === "thw" || stat === "sch") && profile.missing.includes(stat);
    return {
      label: stat.toUpperCase() as StatTile["label"],
      value: dashed ? "—" : String(profile[stat]),
      bonus: dashed || !printed ? 0 : profile[stat] - printed[stat],
    };
  });
  if (current !== undefined && max !== undefined) tiles.push({ label: "HP", value: `${current}/${max}`, bonus: 0 });
  return tiles;
}

export interface StatusPip {
  readonly status: StatusName;
  readonly count: number;
}

/** Villain, minion, hero identity or ally — the design's one "character panel". */
export interface CharacterPanel {
  readonly instanceId: InstanceId;
  readonly name: string;
  /** "Villain · Stage I", "Hero · Protection", "ALLY". */
  readonly subtitle: string;
  readonly traits: readonly string[];
  readonly keywords: readonly string[];
  readonly statuses: readonly StatusPip[];
  readonly stats: readonly StatTile[];
  /** The scan for the face in play, or null when the content has no reference. */
  readonly art: ArtSource | null;
  readonly hp: { readonly current: number; readonly max: number } | null;
  readonly exhausted: boolean;
  /** Facedown boost cards waiting on this enemy, shown as "Boost ?? ×2". */
  readonly boostCount: number;
  /** The seat this enemy is engaged with, if any. */
  readonly engagedWith: PlayerId | null;
  /**
   * The basic actions this character's statuses take away. The design's rule
   * (Components.dc.html section 06): every status owns one concrete control,
   * and the UI greys exactly that one, hatched in the status hue.
   */
  readonly disabledActions: readonly ("attack" | "thwart")[];
  /** Upgrades and attachments hanging off this card. */
  readonly attachments: readonly AttachmentChip[];
}

export interface AttachmentChip {
  readonly instanceId: InstanceId;
  readonly name: string;
  readonly exhausted: boolean;
}

export interface SchemePanel {
  readonly instanceId: InstanceId;
  readonly name: string;
  /** "Main scheme 1B · Accel ×1", "Side scheme · Crisis". */
  readonly subtitle: string;
  readonly threat: number;
  /** The threshold, or null for a scheme with none. */
  readonly target: number | null;
  /**
   * The number the threat meter is drawn against, or null when there is nothing
   * to draw one against.
   *
   * For a main scheme this is `target`, the threshold it fills toward. A side
   * scheme has no threshold — it is defeated when thwarted to 0 — but it is not
   * therefore progress-less: the honest denominator is the threat it entered
   * play with, and the bar then *empties* as the players clear it, which is the
   * direction a side scheme actually moves. Kept at or above the threat now on
   * it, because effects can add threat past where it started and a meter must
   * not overflow its own box.
   */
  readonly meterMax: number | null;
  readonly isMain: boolean;
  readonly crisis: boolean;
  readonly accelerationTokens: number;
  readonly art: ArtSource | null;
}

export interface HandCardView {
  readonly instanceId: InstanceId;
  readonly name: string;
  /** "EVENT · ATTACK", "ALLY", "UPGRADE". */
  readonly typeLine: string;
  /** Null for a resource card, which has no cost. */
  readonly cost: number | null;
  /** Current (errata'd) rules text; the table caps it, Inspect shows it whole. */
  readonly rulesText: string;
  /** The icons this card produces when spent as a resource. */
  readonly resourceIcons: readonly ResourceIconType[];
  /** The whole card scan; the hand draws it behind the frame. */
  readonly art: ArtSource | null;
}

/** One of the other seats, as the design's compact "other heroes" row. */
export interface SeatRow {
  readonly playerId: PlayerId;
  readonly name: string;
  readonly form: Form;
  readonly hp: { readonly current: number; readonly max: number } | null;
  readonly handCount: number;
  readonly minionCount: number;
  readonly statuses: readonly StatusPip[];
  readonly isFirstPlayer: boolean;
  readonly eliminated: boolean;
  /** True once this seat's turn is done this round. */
  readonly done: boolean;
}

export interface PileCounts {
  readonly deck: number;
  readonly discard: number;
}

export interface BoardModel {
  readonly round: number;
  /** "PLAYER" / "VILLAIN", the design's two-state phase toggle. */
  readonly phase: "setup" | "player" | "villain" | "gameOver";
  /** "Your turn — Captain Marvel", "Villain phase · step 3 of 5". */
  readonly stepLabel: string;
  readonly firstPlayerId: PlayerId;
  /** Whose side of the table this is: whoever must act. */
  readonly perspectiveId: PlayerId;
  readonly villain: CharacterPanel;
  readonly mainScheme: SchemePanel;
  readonly sideSchemes: readonly SchemePanel[];
  readonly minions: readonly CharacterPanel[];
  readonly me: CharacterPanel;
  readonly myForm: Form;
  readonly myPlayArea: readonly CharacterPanel[];
  readonly hand: readonly HandCardView[];
  readonly handLimit: number;
  readonly myPiles: PileCounts;
  readonly encounterPiles: PileCounts;
  /** The top of the encounter discard, which is faceup at the table. */
  readonly encounterDiscardTop: ArtSource | null;
  readonly team: readonly SeatRow[];
  readonly outcome: GameState["outcome"];
}

const ROMAN = ["I", "II", "III", "IV", "V"] as const;

/** The encounter discard is faceup, so its top card is public information. */
function topOfDiscard(state: GameState): ArtSource | null {
  const top = state.encounterDiscard[state.encounterDiscard.length - 1];
  return top ? artFor(cardOf(state, top), { kind: "front" }) : null;
}

export function boardModel(state: GameState, perspectiveId: PlayerId, deps: EngineDeps): BoardModel {
  const me = getPlayer(state, perspectiveId);
  if (!me) throw new Error(`no seat ${perspectiveId}`);

  const schemes = schemesInPlay(state);
  const sideSchemes = schemes
    .filter((id) => id !== state.mainScheme.instanceId)
    .map((id) => schemePanel(state, id, deps, false));

  return {
    round: state.round,
    phase: phaseOf(state),
    stepLabel: stepLabel(state, perspectiveId),
    firstPlayerId: state.firstPlayerId,
    perspectiveId,
    villain: characterPanel(state, state.villain.instanceId, deps),
    mainScheme: schemePanel(state, state.mainScheme.instanceId, deps, true),
    sideSchemes,
    minions: minionsOf(state).map((id) => characterPanel(state, id, deps)),
    me: characterPanel(state, me.identity.instanceId, deps),
    myForm: me.identity.form,
    myPlayArea: me.playArea
      // An attachment is drawn on its host — except an upgrade on your own
      // identity, which is a card you played and must be able to find. On the
      // table those sit in front of you, not stacked on your identity card, so
      // the play area is where a player looks for them.
      .filter((id) => {
        const attachedTo = getInstance(state, id)?.attachedTo ?? null;
        return attachedTo === null || attachedTo === me.identity.instanceId;
      })
      .map((id) => characterPanel(state, id, deps)),
    hand: me.hand.map((id) => handCardView(state, id)),
    handLimit: me.hand.length,
    myPiles: { deck: me.deck.length, discard: me.discard.length },
    encounterPiles: { deck: state.encounterDeck.length, discard: state.encounterDiscard.length },
    encounterDiscardTop: topOfDiscard(state),
    team: state.players
      .filter((player) => player.playerId !== perspectiveId)
      .map((player) => seatRow(state, player.playerId, deps)),
    outcome: state.outcome,
  };
}

const phaseOf = (state: GameState): BoardModel["phase"] => {
  switch (state.step.phase) {
    case "setup":
      return "setup";
    case "player":
      return "player";
    case "villain":
      return "villain";
    default:
      return "gameOver";
  }
};

/** The design's five-step villain phase, in the order `GameStep` runs them. */
const VILLAIN_STEPS = ["placeThreat", "enemyActivations", "dealEncounterCards", "revealEncounterCards", "passFirstPlayer"] as const;

function stepLabel(state: GameState, perspectiveId: PlayerId): string {
  const { step } = state;
  if (state.outcome) return state.outcome.result === "win" ? "Victory" : "Defeat";
  switch (step.phase) {
    case "setup":
      return step.kind === "mulligan" ? "Setup — mulligan" : "Setup — draw starting hands";
    case "player": {
      if (step.kind !== "turn") return "End of player phase";
      const yours = step.activePlayerId === perspectiveId;
      return yours
        ? `Your turn — ${playerName(state, step.activePlayerId)}`
        : `${playerName(state, step.activePlayerId)}'s turn`;
    }
    case "villain": {
      const index = VILLAIN_STEPS.indexOf(step.kind as (typeof VILLAIN_STEPS)[number]);
      return index >= 0 ? `Villain phase · step ${index + 1} of 5` : "End of round";
    }
    default:
      return "Game over";
  }
}

/** Enemies in the villain area and engaged with a player, villain excluded. */
function minionsOf(state: GameState): readonly InstanceId[] {
  const fromVillainArea = state.villainArea.filter((id) => id !== state.villain.instanceId && isMinion(state, id));
  const engaged = state.players.flatMap((player) => minionsEngagedWith(state, player.playerId));
  // A minion can only be in one zone, so the two lists never overlap.
  return [...fromVillainArea, ...engaged];
}

export function characterPanel(state: GameState, id: InstanceId, deps: EngineDeps): CharacterPanel {
  const instance = getInstance(state, id);
  if (!instance) throw new Error(`no card instance ${id}`);
  const card = cardOf(state, id);
  const profile = characterProfile(state, id, deps);
  const current = remainingHitPoints(state, id, deps);
  const max = maxHitPoints(state, id, deps);

  const statuses = statusPips(instance);
  return {
    instanceId: id,
    name: displayName(state, instance, card),
    subtitle: subtitleOf(state, instance, card),
    traits: card && "traits" in card ? (card.traits as readonly string[]) : [],
    keywords: keywordsOf(state, id, deps).map((keyword) => keyword.name),
    statuses,
    stats: statTiles(state, id, profile, identityForm(state, instance), current, max),
    art: artFor(card, faceOf(state, id)),
    hp: current !== undefined && max !== undefined ? { current, max } : null,
    exhausted: instance.exhausted,
    boostCount: instance.boostCards.length,
    engagedWith: instance.engagedWith,
    disabledActions: statuses
      .map(({ status }) => STATUS_DISABLES[status])
      .filter((action): action is "attack" | "thwart" => action !== null),
    attachments: instance.attachments.map((attachmentId) => ({
      instanceId: attachmentId,
      name: cardOf(state, attachmentId)?.name ?? "Attachment",
      exhausted: getInstance(state, attachmentId)?.exhausted ?? false,
    })),
  };
}

/**
 * Which deck a hidden card came from, and therefore which back it shows.
 *
 * Decided from ownership, never from the card: `ownerId` is set for anything
 * out of a player's deck and null for encounter and scenario cards, and which
 * deck a facedown card came from is not a secret — the players watched it be
 * dealt. Reading the card's own type here would be reading the thing the card
 * is facedown to hide.
 */
function backKindOf(state: GameState, instance: CardInstance | undefined): CardBack {
  if (!instance) return "encounter";
  if (instance.instanceId === state.villain.instanceId) return "villain";
  return instance.ownerId !== null ? "player" : "encounter";
}

/**
 * Which printed face this instance is showing right now.
 *
 * A facedown card gets none: the engine deliberately says only what a facedown
 * card is *treated as*, and drawing its front would leak what the players
 * aren't allowed to see.
 */
export function faceOf(state: GameState, instanceId: InstanceId): CardFace {
  const instance = getInstance(state, instanceId);
  const card = cardOf(state, instanceId);
  if (!instance || !card || !faceVisible(state, instanceId)) {
    return { kind: "back", back: backKindOf(state, instance) };
  }
  switch (card.type) {
    case "hero_identity":
      return (identityForm(state, instance) ?? "hero") === "hero" ? { kind: "hero" } : { kind: "alterEgo" };
    case "villain":
      return {
        kind: "villainStage",
        sideIndex: Math.max(0, card.sides.findIndex((side) => side.side === state.villain.side)),
        stageIndex: state.villain.stageIndex,
      };
    case "main_scheme":
      // The B side is the one on the table: it carries the threat values shown,
      // and it is the side with a picture. Asking a main scheme for its "front"
      // gets nothing, because the schema puts the image on the stage.
      return { kind: "mainSchemeStage", stageIndex: state.mainScheme.stageIndex, side: "B" };
    default:
      return { kind: "front" };
  }
}

/** The form an identity card is showing, or null when the card isn't an identity. */
function identityForm(state: GameState, instance: CardInstance): Form | null {
  const player = state.players.find((seat) => seat.identity.instanceId === instance.instanceId);
  return player ? player.identity.form : null;
}

function displayName(state: GameState, instance: CardInstance, card: AnyCard | undefined): string {
  if (!instance.faceup) return instance.facedownAs ? instance.facedownAs.traits.join(" ") : "Facedown card";
  if (!card) return "Unknown card";
  // A hero identity card carries both faces; the panel names the one in play.
  if (card.type === "hero_identity") {
    return (identityForm(state, instance) ?? "hero") === "hero" ? card.hero.faceName : card.alterEgo.faceName;
  }
  return card.name;
}

function subtitleOf(state: GameState, instance: CardInstance, card: AnyCard | undefined): string {
  if (!card) return "";
  switch (card.type) {
    case "villain":
      return `Villain · Stage ${ROMAN[state.villain.stageIndex] ?? String(state.villain.stageIndex + 1)}`;
    case "hero_identity": {
      const player = state.players.find((seat) => seat.identity.instanceId === instance.instanceId);
      const form = player?.identity.form ?? "hero";
      const aspect = player ? deckAspect(state, player.playerId) : null;
      return `${form === "hero" ? "Hero" : "Alter-ego"}${aspect ? ` · ${aspectLabel(aspect)}` : ""}`;
    }
    case "minion":
      return "Minion";
    case "ally":
      return "Ally";
    case "upgrade":
      return "Upgrade";
    case "support":
      return "Support";
    default:
      return card.type.replace(/_/g, " ");
  }
}

/**
 * A deck is built around one aspect, so the seat's aspect is the aspect of its
 * non-basic, non-hero-specific cards. Derived rather than stored because the
 * engine has no use for it — only the panel subtitle does.
 */
export function deckAspect(state: GameState, playerId: PlayerId): Aspect | null {
  const player = getPlayer(state, playerId);
  if (!player) return null;
  const counts = new Map<Aspect, number>();
  for (const id of [...player.deck, ...player.hand, ...player.discard, ...player.playArea]) {
    const card = cardOf(state, id);
    if (!card || !("aspect" in card)) continue;
    const aspect = card.aspect as Aspect;
    if (aspect === "basic" || aspect.startsWith("hero:")) continue;
    counts.set(aspect, (counts.get(aspect) ?? 0) + 1);
  }
  let best: Aspect | null = null;
  let bestCount = 0;
  for (const [aspect, count] of counts) {
    if (count > bestCount) {
      best = aspect;
      bestCount = count;
    }
  }
  return best;
}

const aspectLabel = (aspect: Aspect): string => aspect.charAt(0).toUpperCase() + aspect.slice(1);

function statusPips(instance: CardInstance): readonly StatusPip[] {
  const pips: StatusPip[] = [];
  if (instance.statuses.stunned > 0) pips.push({ status: "stunned", count: instance.statuses.stunned });
  if (instance.statuses.confused > 0) pips.push({ status: "confused", count: instance.statuses.confused });
  if (instance.statuses.tough > 0) pips.push({ status: "tough", count: instance.statuses.tough });
  return pips;
}

/**
 * The stat triplet the design shows, in the order each kind of character prints
 * them. A stat printed "—" renders as a dash: the RRG is explicit that a dash
 * is not a zero, and the player has to be able to tell them apart.
 */
function statTiles(
  state: GameState,
  id: InstanceId,
  profile: ReturnType<typeof characterProfile>,
  form: Form | null,
  current: number | undefined,
  max: number | undefined,
): readonly StatTile[] {
  if (!profile) return [];
  const printed = printedStatsOf(state, id);
  // An alter-ego prints REC where a hero prints THW/ATK/DEF, so the panel shows
  // the row that side of the card actually has. Villains and minions: the
  // design's "ATK 2 · SCH 14 · HP 14/22" row.
  const rows: readonly ("thw" | "atk" | "def" | "rec" | "sch")[] =
    profile.kind === "identity"
      ? form === "alterEgo"
        ? ["rec"]
        : ["thw", "atk", "def"]
      : profile.kind === "ally"
        ? ["thw", "atk"]
        : ["atk", "sch"];
  return profileStatTiles(profile, printed, rows, current, max);
}

export function schemePanel(state: GameState, id: InstanceId, _deps: EngineDeps, isMain: boolean): SchemePanel {
  const instance = getInstance(state, id);
  if (!instance) throw new Error(`no card instance ${id}`);
  const card = cardOf(state, id);
  // Crisis is a printed icon in the threat box (RRG "Crisis Icon"), not a keyword.
  const crisis = card?.type === "side_scheme" ? card.icons.includes("crisis") : mainSchemeStage(state).icons.includes("crisis");

  if (isMain) {
    const stage = mainSchemeStage(state);
    const accel = state.mainScheme.accelerationTokens;
    return {
      instanceId: id,
      name: stage.name ?? card?.name ?? "Main scheme",
      subtitle: `Main scheme ${state.mainScheme.stageIndex + 1}${accel > 0 ? ` · Accel ×${accel}` : ""}`,
      threat: instance.threat,
      // The stage's target threat, scaled the way the engine scales it: the
      // player count is fixed at setup, so eliminations don't change it.
      target: scale(stage.targetThreat, state.startingPlayerCount),
      meterMax: scale(stage.targetThreat, state.startingPlayerCount),
      isMain: true,
      crisis,
      accelerationTokens: accel,
      art: artFor(card, faceOf(state, id)),
    };
  }

  return {
    instanceId: id,
    name: card?.name ?? "Side scheme",
    subtitle: `Side scheme${crisis ? " · Crisis" : ""}`,
    threat: instance.threat,
    // A side scheme has no threshold: it is defeated when thwarted to 0.
    target: null,
    meterMax:
      card?.type === "side_scheme"
        ? Math.max(scale(card.startingThreat, state.startingPlayerCount), instance.threat)
        : null,
    isMain: false,
    crisis,
    accelerationTokens: 0,
    art: artFor(card, { kind: "front" }),
  };
}

export function handCardView(state: GameState, id: InstanceId): HandCardView {
  const card = cardOf(state, id);
  if (!card) {
    return { instanceId: id, name: "Unknown card", typeLine: "", cost: null, rulesText: "", resourceIcons: [], art: null };
  }

  const traits = "traits" in card ? (card.traits as readonly string[]) : [];
  const typeLine = [card.type.replace(/_/g, " "), ...traits.slice(0, 1)].join(" · ").toUpperCase();
  return {
    instanceId: id,
    name: card.name,
    typeLine,
    cost: "cost" in card && typeof card.cost === "number" ? card.cost : null,
    // `current`, not `printed`: the errata'd wording is what the game plays by.
    rulesText: "text" in card ? card.text.current : "",
    resourceIcons: resourceIconList(printedResources(card)),
    art: artFor(card, { kind: "front" }),
  };
}

/** A resource pool flattened to one entry per icon, for drawing pips. */
export function resourceIconList(pool: Readonly<Record<ResourceIconType, number>>): readonly ResourceIconType[] {
  const icons: ResourceIconType[] = [];
  for (const type of ["physical", "mental", "energy", "wild"] as const) {
    for (let i = 0; i < pool[type]; i++) icons.push(type);
  }
  return icons;
}

export function seatRow(state: GameState, playerId: PlayerId, deps: EngineDeps): SeatRow {
  const player = getPlayer(state, playerId);
  if (!player) throw new Error(`no seat ${playerId}`);
  const identity = player.identity.instanceId;
  const current = remainingHitPoints(state, identity, deps);
  const max = maxHitPoints(state, identity, deps);
  const instance = getInstance(state, identity);
  const { step } = state;

  return {
    playerId,
    name: playerName(state, playerId),
    form: player.identity.form,
    hp: current !== undefined && max !== undefined ? { current, max } : null,
    handCount: player.hand.length,
    minionCount: player.playArea.filter((id) => isMinion(state, id)).length,
    statuses: instance ? statusPips(instance) : [],
    isFirstPlayer: state.firstPlayerId === playerId,
    eliminated: player.eliminated,
    // Turns run off `remainingPlayerIds`: a seat not in that list has had its turn.
    done:
      step.phase === "player" && step.kind === "turn"
        ? step.activePlayerId !== playerId && !step.remainingPlayerIds.includes(playerId)
        : false,
  };
}
