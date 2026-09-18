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
  currentName,
  getInstance,
  getPlayer,
  isMinion,
  keywordsOf,
  mainSchemeStage,
  maxHitPoints,
  activeEncounterDeck,
  activeVillain,
  isVillain,
  villainOf,
  minionsEngagedWith,
  playCostOf,
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
  type PlayCost,
  type PlayerId,
  type PlayerState,
} from "@mc/engine";
import { artFor, type ArtSource, type CardBack, type CardFace } from "../art/art-source.js";
import { faceVisible } from "./visibility.js";
import { STATUS_DISABLES } from "../tokens.js";
import type { StatusName } from "./log-lines.js";
import { faceUpName, playerName } from "./names.js";

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
  /**
   * Counters on the card itself, as opposed to an attachment's own
   * (`AttachmentChip.counters`) — Quinjet's time counters (`03019`, PLAN.md
   * Phase 7: "the board has to show counters on a support"), Web-Shooter's
   * uses when it sits unattached, or any future card that keeps its own
   * tally in play. Empty is the common case (most cards never hold one) and
   * draws nothing.
   */
  readonly counters: readonly { readonly name: string; readonly count: number }[];
  /**
   * The seat that owns this card when someone else controls it — a Heroic
   * Intuition played under another player's control — or null. Without it a
   * lent card is indistinguishable from one of your own.
   */
  readonly ownerName: string | null;
  /** Lasting effects aimed at this identity's seat, as short notes ("next card costs 1 less"). */
  readonly effects: readonly string[];
}

export interface AttachmentChip {
  readonly instanceId: InstanceId;
  readonly name: string;
  readonly exhausted: boolean;
  /** Counters left on it ("web" ×2), so a Uses card shows how many uses remain. */
  readonly counters: readonly { readonly name: string; readonly count: number }[];
}

/** "Web-Shooter · 2 web · exhausted" — everything a chip has room to say. */
export function attachmentChipLabel(chip: AttachmentChip): string {
  return [chip.name, ...chip.counters.map((counter) => `${counter.count} ${counter.name}`), chip.exhausted ? "exhausted" : null]
    .filter(Boolean)
    .join(" · ");
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
  /**
   * Cards tucked facedown under this scheme (RRG "Tuck") — Open the Dark
   * Dimension holding the Invocation deck's top card (`09029`), Highway
   * Robbery holding a hand card from each player (`01166`, Core). Shown as a
   * count only: a tucked card is genuinely hidden information (`view/
   * visibility.ts`), the same "present, not named" treatment `boostCount`
   * already gives a facedown boost card.
   */
  readonly tuckedCount: number;
  readonly art: ArtSource | null;
}

/**
 * An environment card in the villain area — Risky Business's Criminal Enterprise / State of Madness.
 *
 * It is neither a character nor a scheme, so it fitted none of the panels above and was drawn nowhere at all:
 * the card sat in `state.villainArea` doing the whole job of gating the scenario while the table showed no sign
 * it existed. Its counters are the point of it ("if there are no infamy counters here, flip Norman Osborn"), so
 * they are first-class here rather than a footnote on a chip.
 */
/**
 * This villain's signature side scheme (`VillainState.signatureSideSchemeId`), and where it currently sits — set
 * aside at setup, in play on the table, or removed from the game once its villain was defeated (RRG 1.8 "Villain
 * Defeat", p. 47: "their side scheme is also removed from the game", whether it was in play or still set aside).
 * `schemePanel` reads a card's instance data regardless of which of those zones it's in, so this is buildable for
 * all three — the compact villain panel and the schemes zone can each decide what a non-`"inPlay"` scheme looks like.
 */
export interface VillainSchemeLink {
  readonly scheme: SchemePanel;
  readonly status: "setAside" | "inPlay" | "removed";
}

/**
 * One villain of the scenario (The Wrecking Crew's four are the only scenario with more than one today), in
 * printed order. A single-villain scenario's `BoardModel.villains` still has exactly one of these, identical in
 * shape to every other scenario's — so a screen reading `villains` never has to special-case "just one."
 */
export interface VillainPanel {
  readonly panel: CharacterPanel;
  /** Whether this is the villain the active counter is on: the one that activates, and whose deck is "the encounter deck" (`state.activeVillainId`). */
  readonly active: boolean;
  readonly defeated: boolean;
  /** Null for a villain with no signature side scheme (every scenario before The Wrecking Crew). */
  readonly signatureScheme: VillainSchemeLink | null;
  /** This villain's own encounter deck (`VillainState.encounterDeckId`) — every villain shares one deck outside The Wrecking Crew. */
  readonly deck: PileCounts;
}

export interface EnvironmentPanel {
  readonly instanceId: InstanceId;
  /** The face in play: "Criminal Enterprise", or "State of Madness" once it has flipped. */
  readonly name: string;
  readonly subtitle: string;
  /** Every counter kind on the card, with its count: `[{ name: "infamy", count: 4 }]`. */
  readonly counters: readonly { readonly name: string; readonly count: number }[];
  readonly art: ArtSource | null;
}

export interface HandCardView {
  readonly instanceId: InstanceId;
  readonly name: string;
  /** "EVENT · ATTACK", "ALLY", "UPGRADE". */
  readonly typeLine: string;
  /** The cost printed on the card. Null for a resource card, which has no cost. */
  readonly cost: number | null;
  /**
   * What the card costs to play right now. Equal to `cost` unless something on the table is changing the price —
   * Steve Rogers' Living Legend, an Avengers Tower reduction, Man Out of Time's surcharge — in which case the
   * scan's printed pip is wrong and the hand has to say so.
   */
  readonly currentCost: number | null;
  /**
   * The cards moving the price, by name, so the table can answer "why is this cheaper?" without the player
   * hunting for the ability. Empty when nothing is, or when the change came from a pending "next card"
   * reduction, which carries no source card of its own.
   */
  readonly costSources: readonly string[];
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
  /** True once this seat's turn is done this round. Never true for an eliminated seat. */
  readonly done: boolean;
  /** The seat's identity card, so a beat or a target on this hero lands on its row. */
  readonly identityInstanceId: InstanceId;
  /** Lasting effects aimed at this seat ("next card costs 1 less"). */
  readonly effects: readonly string[];
  /** Cards this seat controls that another player owns: "Heroic Intuition · from Black Panther". */
  readonly borrowed: readonly string[];
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
  /**
   * The active villain's panel — "the villain" everywhere a screen only ever meant one (PLAN.md Phase 7's own
   * scenarios). Kept as its own field, identical to `villains.find((v) => v.active)!.panel`, so every consumer
   * from before The Wrecking Crew's four villains keeps working unchanged.
   */
  readonly villain: CharacterPanel;
  /**
   * Every villain of the scenario, printed order, defeated ones included (`state.villains`). One entry for every
   * scenario so far; four for The Wrecking Crew's Breakout, where they used to be invisible — the board built only
   * `villain` above, so Thunderball, Piledriver and Bulldozer were in play with nothing drawn for them at all.
   */
  readonly villains: readonly VillainPanel[];
  readonly mainScheme: SchemePanel;
  readonly sideSchemes: readonly SchemePanel[];
  readonly minions: readonly CharacterPanel[];
  /** Environment cards in the villain area, in play order. Empty for every scenario that uses none. */
  readonly environments: readonly EnvironmentPanel[];
  readonly me: CharacterPanel;
  readonly myForm: Form;
  readonly myPlayArea: readonly CharacterPanel[];
  readonly hand: readonly HandCardView[];
  readonly handLimit: number;
  readonly myPiles: PileCounts;
  /** Your discard pile, top card first. Discard piles are open information (`view/visibility.ts`). */
  readonly myDiscard: readonly InstanceId[];
  /** The top of your discard, which the pile box shows faceup. */
  readonly myDiscardTop: ArtSource | null;
  readonly encounterPiles: PileCounts;
  /** The top of the encounter discard, which is faceup at the table. */
  readonly encounterDiscardTop: ArtSource | null;
  /**
   * A second deck your identity brings besides your player deck — Doctor
   * Strange's Invocation deck (`HeroIdentityCard.separateDecks`) — one entry
   * per named deck, empty for every identity that has none. The board had no
   * zone for this at all (PLAN.md Phase 7: "the board has no Invocation
   * deck; the client never mentions `separateDeck`"), so a card whose entire
   * action reads its top card had nothing on the table to point at.
   */
  readonly separateDecks: readonly SeparateDeckPile[];
  readonly team: readonly SeatRow[];
  readonly outcome: GameState["outcome"];
}

export interface SeparateDeckPile {
  readonly name: string;
  readonly deckCount: number;
  readonly discardCount: number;
  /** The deck's own top card, for the pile's tap-to-inspect target. Null when the deck is empty. */
  readonly topInstanceId: InstanceId | null;
  /** The top card's face — faceup for every printed separate deck so far (`topCardFaceup`), so this is its scan. */
  readonly topArt: ArtSource | null;
  /**
   * This deck's *own* discard pile — apart from the player's own discard, the
   * same way the encounter deck's discard is its own pile rather than
   * folding into anyone's. Open information, like every discard pile
   * (`view/visibility.ts`): the deck's cards are hidden, its discard is not.
   */
  readonly discardTopInstanceId: InstanceId | null;
  readonly discardTopArt: ArtSource | null;
}

const ROMAN = ["I", "II", "III", "IV", "V"] as const;

/** The encounter discard is faceup, so its top card is public information. */
/**
 * The faceup card on top of a discard pile. The engine puts a discarded card on
 * top by *prepending* it (`moveCard(..., "top")`), so the top is index 0 — this
 * used to read the last element, and the encounter discard showed the first
 * card ever discarded instead of the latest.
 */
function topOfDiscard(state: GameState, pile: readonly InstanceId[]): ArtSource | null {
  const top = pile[0];
  return top ? artFor(cardOf(state, top), { kind: "front" }) : null;
}

/**
 * Every separate deck this identity brings, by printed name — Doctor
 * Strange's Invocation deck is the only one today, but this reads
 * `PlayerState.separateDecks` itself rather than naming it, so a later
 * identity with a deck of its own needs no client change.
 */
function separateDeckPiles(state: GameState, me: PlayerState): readonly SeparateDeckPile[] {
  return Object.entries(me.separateDecks).map(([name, pile]) => {
    const top = pile.deck[0] ?? null;
    const discardTop = pile.discard[0] ?? null;
    // `topCardFaceup` (RRG-scoped to the deck's own definition) keeps the engine's `CardInstance.faceup` true for
    // this card, so `faceOf` — the same visibility-aware face lookup every other pile on the table already uses —
    // reads it correctly without this file re-deriving "is the top card visible" itself.
    return {
      name,
      deckCount: pile.deck.length,
      discardCount: pile.discard.length,
      topInstanceId: top,
      topArt: top ? artFor(cardOf(state, top), faceOf(state, top)) : null,
      discardTopInstanceId: discardTop,
      discardTopArt: discardTop ? artFor(cardOf(state, discardTop), { kind: "front" }) : null,
    };
  });
}

/**
 * Every villain of the scenario, printed order, defeated ones included — The Wrecking Crew's Breakout has four;
 * every other scenario so far has one. Built from `state.villains`/`state.activeVillainId` directly rather than
 * from `activeVillain(state)`, which only ever names the one with the active counter.
 */
function villainPanels(state: GameState, deps: EngineDeps): readonly VillainPanel[] {
  return state.villains.map((villain) => ({
    panel: characterPanel(state, villain.instanceId, deps),
    active: villain.instanceId === state.activeVillainId,
    defeated: villain.defeated,
    signatureScheme: villain.signatureSideSchemeId
      ? {
          scheme: schemePanel(state, villain.signatureSideSchemeId, deps, false),
          status: state.removedFromGame.includes(villain.signatureSideSchemeId)
            ? "removed"
            : state.villainArea.includes(villain.signatureSideSchemeId)
              ? "inPlay"
              : "setAside",
        }
      : null,
    deck: {
      deck: state.encounterDecks[villain.encounterDeckId]?.deck.length ?? 0,
      discard: state.encounterDecks[villain.encounterDeckId]?.discard.length ?? 0,
    },
  }));
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
    villain: characterPanel(state, activeVillain(state).instanceId, deps),
    villains: villainPanels(state, deps),
    mainScheme: schemePanel(state, state.mainScheme.instanceId, deps, true),
    sideSchemes,
    minions: minionsOf(state).map((id) => characterPanel(state, id, deps)),
    environments: state.villainArea.filter((id) => cardOf(state, id)?.type === "environment").map((id) => environmentPanel(state, id)),
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
    hand: me.hand.map((id) => handCardView(state, id, perspectiveId, deps)),
    handLimit: me.hand.length,
    myPiles: { deck: me.deck.length, discard: me.discard.length },
    encounterPiles: { deck: activeEncounterDeck(state).deck.length, discard: activeEncounterDeck(state).discard.length },
    myDiscard: me.discard,
    myDiscardTop: topOfDiscard(state, me.discard),
    encounterDiscardTop: topOfDiscard(state, activeEncounterDeck(state).discard),
    separateDecks: separateDeckPiles(state, me),
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
  // Three outcomes, not two: a conceded game is neither a win nor a defeat (see `GameOutcome`).
  if (state.outcome) return state.outcome.result === "win" ? "Victory" : state.outcome.result === "conceded" ? "Conceded" : "Defeat";
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
  const fromVillainArea = state.villainArea.filter((id) => !isVillain(state, id) && isMinion(state, id));
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
      counters: countersOf(state, attachmentId),
    })),
    counters: countersOf(state, id),
    ownerName:
      instance.ownerId !== null && instance.controllerId !== null && instance.ownerId !== instance.controllerId
        ? playerName(state, instance.ownerId)
        : null,
    effects: seatEffectsOf(state, state.players.find((seat) => seat.identity.instanceId === id)?.playerId ?? null),
  };
}

/**
 * Lasting effects aimed at a seat, as the notes its panel and seat row wear.
 * A "choose a player" effect that lingers (Helicarrier: "reduce the resource
 * cost of the next card that player plays") otherwise leaves no trace on the
 * table that it happened, or to whom.
 */
function seatEffectsOf(state: GameState, playerId: PlayerId | null): readonly string[] {
  if (playerId === null) return [];
  const reduction = state.lastingEffects.reduce(
    (total, effect) => (effect.kind === "costReduction" && effect.playerId === playerId ? total + effect.amount : total),
    0,
  );
  return reduction > 0 ? [`next card costs ${reduction} less`] : [];
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
  if (isVillain(state, instance.instanceId)) return "villain";
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
    case "villain": {
      const villain = villainOf(state, instanceId) ?? activeVillain(state);
      return {
        kind: "villainStage",
        sideIndex: Math.max(0, card.sides.findIndex((side) => side.side === villain.side)),
        stageIndex: villain.stageIndex,
      };
    }
    case "main_scheme":
      // The B side is the one on the table: it carries the threat values shown,
      // and it is the side with a picture. Asking a main scheme for its "front"
      // gets nothing, because the schema puts the image on the stage.
      return { kind: "mainSchemeStage", stageIndex: state.mainScheme.stageIndex, side: "B" };
    default:
      // A flipped double-sided encounter card shows its other face, not its front (Criminal Enterprise once it
      // has become State of Madness). Without this the table keeps drawing the side that is no longer in play.
      return instance.flipped && "flipSide" in card && card.flipSide ? { kind: "flipSide" } : { kind: "front" };
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
  // Every other double-sided card is named for the face in play too, and only the engine knows which that is: a
  // villain's active side (Risky Business's card is titled "Norman Osborn", but once he flips the table is facing
  // Green Goblin) and a flipped encounter card's other face. `card.name` alone left the villain panel naming a
  // side that was no longer there, while the damage and the abilities came from the other one.
  return currentName(state, instance.instanceId) ?? card.name;
}

function subtitleOf(state: GameState, instance: CardInstance, card: AnyCard | undefined): string {
  if (!card) return "";
  switch (card.type) {
    case "villain": {
      const villain = villainOf(state, instance.instanceId) ?? activeVillain(state);
      return `Villain · Stage ${ROMAN[villain.stageIndex] ?? String(villain.stageIndex + 1)}`;
    }
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
      subtitle: `Main scheme ${state.mainScheme.stageIndex + 1}${accel > 0 ? ` · Accel ×${accel}` : ""}${instance.tucked.length > 0 ? ` · ${instance.tucked.length} tucked` : ""}`,
      threat: instance.threat,
      // The stage's target threat, scaled the way the engine scales it: the
      // player count is fixed at setup, so eliminations don't change it.
      target: scale(stage.targetThreat, state.startingPlayerCount),
      meterMax: scale(stage.targetThreat, state.startingPlayerCount),
      isMain: true,
      crisis,
      accelerationTokens: accel,
      tuckedCount: instance.tucked.length,
      art: artFor(card, faceOf(state, id)),
    };
  }

  // A signature side scheme (The Wrecking Crew's Thunderstruck, Pile It On!, …) is tied to one villain (`VillainState.
  // signatureSideSchemeId`), and the table has to say whose: with four in play at once under one "side schemes"
  // list, "Side scheme · Crisis" told the player nothing about which villain it was thwarting toward.
  const signatureOf = state.villains.find((villain) => villain.signatureSideSchemeId === id);
  const villainName = signatureOf ? (currentName(state, signatureOf.instanceId) ?? cardOf(state, signatureOf.instanceId)?.name ?? null) : null;

  return {
    instanceId: id,
    name: card?.name ?? "Side scheme",
    subtitle: `Side scheme${crisis ? " · Crisis" : ""}${villainName ? ` · ${villainName}` : ""}${instance.tucked.length > 0 ? ` · ${instance.tucked.length} tucked` : ""}`,
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
    tuckedCount: instance.tucked.length,
    art: artFor(card, { kind: "front" }),
  };
}

export function environmentPanel(state: GameState, id: InstanceId): EnvironmentPanel {
  const card = cardOf(state, id);
  return {
    instanceId: id,
    // `currentName`, not `card.name`: a flipped card is a different card as far as the table is concerned.
    name: currentName(state, id) ?? card?.name ?? "Environment",
    subtitle: "Environment",
    counters: countersOf(state, id),
    art: artFor(card, faceOf(state, id)),
  };
}

/** Every counter kind on a card, in a stable order, skipping kinds that have run to zero. */
function countersOf(state: GameState, id: InstanceId): readonly { readonly name: string; readonly count: number }[] {
  return Object.entries(getInstance(state, id)?.counters ?? {})
    .filter(([, count]) => count > 0)
    .map(([name, count]) => ({ name, count }));
}

export function handCardView(state: GameState, id: InstanceId, playerId: PlayerId, deps: EngineDeps): HandCardView {
  const card = cardOf(state, id);
  if (!card) {
    return { instanceId: id, name: "Unknown card", typeLine: "", cost: null, currentCost: null, costSources: [], rulesText: "", resourceIcons: [], art: null };
  }

  const traits = "traits" in card ? (card.traits as readonly string[]) : [];
  const typeLine = [card.type.replace(/_/g, " "), ...traits.slice(0, 1)].join(" · ").toUpperCase();
  // Priced with no attachment host: an upgrade's host is only chosen once the play is under way, and a
  // host-conditional modifier that hasn't been earned yet must not quote a price the player can't get.
  const price = playCostOf(state, playerId, id, deps);
  return {
    instanceId: id,
    name: card.name,
    typeLine,
    cost: price?.printed ?? null,
    currentCost: price?.current ?? null,
    costSources: price ? costSourceNames(state, price) : [],
    // `current`, not `printed`: the errata'd wording is what the game plays by.
    rulesText: "text" in card ? card.text.current : "",
    resourceIcons: resourceIconList(printedResources(card)),
    art: artFor(card, { kind: "front" }),
  };
}

/** The distinct names behind a price change, in the engine's own order. A card can't be its own reason. */
function costSourceNames(state: GameState, price: PlayCost): readonly string[] {
  const names: string[] = [];
  for (const { sourceInstanceId } of price.contributions) {
    const name = faceUpName(state, sourceInstanceId);
    if (name && !names.includes(name)) names.push(name);
  }
  return names;
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
    // Turns run off `remainingPlayerIds`: a seat not in that list has had its
    // turn. An eliminated seat is dropped from that list too, which read as
    // "done" — a defeated hero looking like one waiting for the next round.
    done:
      !player.eliminated && step.phase === "player" && step.kind === "turn"
        ? step.activePlayerId !== playerId && !step.remainingPlayerIds.includes(playerId)
        : false,
    identityInstanceId: identity,
    effects: seatEffectsOf(state, playerId),
    borrowed: player.playArea.flatMap((id) => {
      const ownerId = getInstance(state, id)?.ownerId ?? null;
      return ownerId !== null && ownerId !== playerId ? [`${cardOf(state, id)?.name ?? "a card"} · from ${playerName(state, ownerId)}`] : [];
    }),
  };
}
