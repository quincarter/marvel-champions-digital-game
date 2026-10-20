/**
 * Everything the Board scene draws, derived from `GameState` as plain data.
 *
 * The scene reads this and nothing else, so the whole board is testable without
 * a canvas (PLAN.md Phase 4, "thin scenes, plain-TS view models"). Every number
 * that can be modified comes from the engine's own `characterProfile` /
 * `remainingHitPoints` — the client never recomputes a stat, because a
 * client-side sum is exactly how a UI starts disagreeing with the rules.
 */

import type { AbilityId, Aspect, AnyCard, ResourceIconType } from "@mc/content";
import {
  handSize,
  cardOf,
  cardsInPlay,
  characterProfile,
  controllerOf,
  currentName,
  getInstance,
  isOwnedEncounterCard,
  locateCard,
  separateDeckDefinition,
  tuckLimitOf,
  getPlayer,
  identityFace,
  iconsOn,
  boostIconsFor,
  hasStarIcon,
  isMinion,
  isCaptiveAlly,
  isHeldMinion,
  traitsOf,
  keywordsOf,
  printedKeywordsOf,
  mainSchemeStageOf,
  mainSchemeStateOf,
  maxHitPoints,
  activeEncounterDeck,
  activeVillain,
  isVillain,
  villainOf,
  minionsEngagedWith,
  playCostOf,
  playableOutsideHand,
  printedProfile,
  handCardResources,
  remainingHitPoints,
  scaleIn,
  scenarioPlayAreaOf,
  schemesInPlay,
  sharedScheme,
  sharedVillain,
  type CardInstance,
  type EngineDeps,
  type Form,
  type GameState,
  type InstanceId,
  type LegalActions,
  type PlayCost,
  type PlayerId,
  type PlayerState,
  type ViewerContext,
  mainSchemeValue,
  shownEncounterTop,
  villainStageOf,
} from "@mc/engine";
import { artFor, type ArtSource, type CardBack, type CardFace } from "../art/art-source.js";
import { POOL_ENCOUNTER_SETS } from "../content/pool.js";
import { breakPointOf } from "./break-point.js";
import { giftReaderNote, giftSeatNote } from "./gift-count.js";
import { counterGoalsOf } from "./counter-goal.js";
import { scenarioAreaLimitsOf } from "./scenario-area-limit.js";
import { counterLimitsOf } from "./counter-limit.js";
import { threatGoalOf } from "./threat-goal.js";
import { otherFaceVisible } from "./hidden-reverse.js";
import { keywordLabel } from "./keyword-label.js";
import { faceVisible } from "./visibility.js";
import { foeWord, isLeaderCard } from "./foe-words.js";
import { deckTopStatus, shownTopOf } from "./deck-top.js";
import { STATUS_DISABLES } from "../tokens.js";
import { hpFraction } from "./hp-format.js";
import type { StatusName } from "./log-lines.js";
import { heroFaceDisplayName, qualifiedHeroName } from "./hero-names.js";
import { faceUpName, playerName } from "./names.js";
import { aspectName } from "./aspect-stamp.js";

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
  if (current !== undefined && max !== undefined)
    tiles.push({ label: "HP", value: hpFraction(current, max), bonus: 0 });
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
  /**
   * Keywords the card has right now that it does not print (Hurricane's "each character gains retaliate 1"), as the
   * table words them ("Retaliate 1"), so a granted keyword is on the board and not only in Inspect.
   */
  readonly grantedKeywords: readonly string[];
  readonly statuses: readonly StatusPip[];
  readonly stats: readonly StatTile[];
  /** The scan for the face in play, or null when the content has no reference. */
  readonly art: ArtSource | null;
  readonly hp: { readonly current: number; readonly max: number } | null;
  /**
   * Set on a seat's own identity panel once that seat is out of the game: "defeated" (eliminated) or "sittingOut"
   * (sat the scenario out, decision 66B). The panel then carries no stat tiles, status chips, exhausted tag or HP
   * plate, because nothing on it can act any more; the scene draws the word instead. Absent for every other card.
   */
  readonly defeat?: "defeated" | "sittingOut";
  readonly exhausted: boolean;
  /** Facedown boost cards waiting on this enemy, shown as "Boost ?? ×2". */
  readonly boostCount: number;
  /**
   * Set (true) on a Civil War leader's panel: a villain-type card printed as a leader (MC56 p. 3). The word itself is
   * already in `subtitle`; this lets the scene give the panel the leader's frame and title. Absent on every other card.
   */
  readonly leader?: true;
  /**
   * What the facedown boost cards on a villain or leader mean, when it holds any: the cards given to it outside its
   * own activation (Falcon, Dangerous Recruits) stay facedown until it activates, and are turned up then in addition
   * to the one dealt (RRG 1.8 "Boost", p. 11). The cards are never named. Absent when none are waiting.
   */
  readonly boostNote?: string;
  /** The seat this enemy is engaged with, if any. */
  readonly engagedWith: PlayerId | null;
  /**
   * Who the enemy is engaged with, in words ("Spider-Man", or "Spider-Man 2" when two seats play the same hero), only
   * when more than one seat is playing: a solo table has no one else it could be. Null for an unengaged enemy.
   */
  readonly engagedName: string | null;
  /**
   * The basic actions this character's statuses take away. The design's rule
   * (Components.dc.html section 06): every status owns one concrete control,
   * and the UI grays exactly that one, hatched in the status hue.
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
   * Damage on a card with no hit points of its own — Ice Wall ("place that damage here instead … at least 8 damage
   * here", `iceman` 46008), Magnetic Bubble (`magneto` 49006) — as "3/8 damage" against the point its own text acts
   * at (`damageNote`). Null for a character (its HP plate already says it) and for a card with no damage and no
   * threshold.
   */
  readonly damageNote: string | null;
  /**
   * Threat on a card that is not a scheme (engine §3.59: an identity, ally, minion, villain or obligation can hold
   * `instance.threat`; Curtain Call puts it on Peter Parker, and changing form moves it to MojoMania's main scheme).
   * 0 draws nothing. A scheme's own threat is its meter (`SchemePanel.threat`), never this.
   */
  readonly threat: number;
  /**
   * The seat that owns this card when someone else controls it — a Heroic
   * Intuition played under another player's control — or null. Without it a
   * lent card is indistinguishable from one of your own.
   */
  readonly ownerName: string | null;
  /** "Hercules's Labor" on a Labor card in a play area (an encounter card a player owns); null for every other card. */
  readonly ownedBy: string | null;
  /** "Counts Gift cards you control: 2" on a card that reads the Gift count (Olympus); null for every other card. */
  readonly countNote: string | null;
  /** Lasting effects aimed at this identity's seat, as short notes ("next card costs 1 less"). */
  readonly effects: readonly string[];
  /**
   * Cards tucked under this one (RRG 1.8 "Tuck", p. 45): Silk's identity, a minion with a card under it. Out of play,
   * but a table shows what sits under a card. A facedown one is a card back, never named (`tuckedCardsUnder`).
   */
  readonly tucked: readonly TuckedCardView[];
  /** `tucked.length`; the tile's "UNDER n" count. */
  readonly tuckedCount: number;
  /**
   * Set while a card holds this character: a minion an environment holds (Thunderbolt Backup), or an ally attached
   * under no player's control (M.O.D.O.K.'s hostage). The tile says so and names the host. Null for every other card.
   */
  readonly heldBy: HeldByView | null;
  /**
   * Keywords this card has that do nothing right now, lowercase ("guard" on a held minion: it is engaged with no one,
   * so it guards no one). The tile says them as "guard off", dimmed; empty for every other card.
   */
  readonly inactiveKeywords: readonly string[];
}

/** What holds a character that sits on another card instead of in a play area. */
export interface HeldByView {
  /** "held": a minion an environment holds (engaged with nobody); "captive": an ally under no player's control. */
  readonly kind: "held" | "captive";
  readonly hostId: InstanceId;
  /** The host's name as the table reads it. */
  readonly hostName: string;
}

export interface AttachmentChip {
  readonly instanceId: InstanceId;
  readonly name: string;
  readonly exhausted: boolean;
  /** Counters left on it ("web" ×2), so a Uses card shows how many uses remain. */
  readonly counters: readonly { readonly name: string; readonly count: number }[];
  /** Damage placed on the attachment itself (Crossbones' Armor soaks Crossbones' damage, `trors` 04065). */
  readonly damage: number;
  /**
   * The damage at which the attachment's own text acts ("If there is 5 or more damage here, discard Crossbones'
   * Armor"; `selfDamageThreshold`), or null when it has no such clause. The chip reads "2/5" so the table can see
   * how close it is to breaking.
   */
  readonly damageThreshold: number | null;
  /**
   * Attached facedown — Spectrum's own two inactive "energy form" upgrades (`mts` 21001b's Setup: "Put all 3
   * energy form upgrades into play, facedown," docs/phase7-wave4.md §5): the chip must not name a facedown card
   * any more than the table's own picture of it does (`faceOf`'s own `back` branch).
   */
  readonly faceup: boolean;
  /** "Labor (Hercules)" for a Labor card hanging here (an encounter card a player owns; short, the chip is narrow); null for every other card. */
  readonly ownedBy: string | null;
  /**
   * Cards tucked under this attachment, faceup ones named (Ionic Physiology holds up to three events; RRG 1.8 "Tuck",
   * p. 45). Public information: a table shows what sits under a card. Empty for almost every attachment.
   */
  readonly tucked: readonly TuckedCardView[];
  /** `tucked.length`. */
  readonly tuckedCount: number;
  /** The most it may hold (`tuckLimitOf`, the engine's own answer), or null when no rule limits it. */
  readonly tuckMax: number | null;
  /**
   * The count against the maximum - "2 of 3 tucked" - or "2 tucked" with no maximum; null with nothing tucked and no
   * maximum. A card with a maximum says "0 of 3 tucked" at none, so the room left is read, never guessed.
   */
  readonly tuckedNote: string | null;
  /**
   * The count its own text waits for on a kind of counter ("charm": 5 on a Hypnotic Gaze), so the chip reads "3/5 charm"
   * and shows the goal even at none (`counterGoalsOf`). Absent when it waits for none.
   */
  readonly counterGoals?: Readonly<Record<string, number>>;
}

/** "Web-Shooter · 2 web · exhausted", "Crossbones' Armor · 2/5 damage" — everything a chip has room to say. */
export function attachmentChipLabel(chip: AttachmentChip): string {
  const damage = attachmentChipDamage(chip);
  return [attachmentChipText(chip), damage ? `${damage} damage` : null].filter(Boolean).join(" · ");
}

/**
 * "3/5 damage" against the point a card's own text acts at, "3 damage" with no such point, or null when there is
 * neither damage nor a threshold to show.
 */
export function damageNote(damage: number, threshold: number | null): string | null {
  if (threshold !== null) return `${damage}/${threshold} damage`;
  return damage > 0 ? `${damage} damage` : null;
}

/**
 * What a compact villain tile (the multi-villain row) says beyond its stats: statuses in words, then each attachment
 * and the card's own counters, "Stunned · Golden Horse · 1 power counter". Empty when the villain has none, so the
 * tile draws nothing. The single-villain panel draws the same facts as chips; this is their one-line form.
 */
export function compactVillainNote(panel: CharacterPanel): string {
  const statuses = panel.statuses.map((pip) => {
    const word = pip.status.charAt(0).toUpperCase() + pip.status.slice(1);
    return pip.count > 1 ? `${word} ×${pip.count}` : word;
  });
  return [...statuses, ...panel.attachments.map(attachmentChipText), counterNote(panel.counters)]
    .filter(Boolean)
    .join(" · ");
}

/** The chip's label without its damage: the part that may be clipped when the chip is narrow. */
export function attachmentChipText(chip: AttachmentChip): string {
  const goals = chip.counterGoals ?? {};
  const toward = Object.entries(goals).map(([name, goal]) => {
    const count = chip.counters.find((counter) => counter.name === name)?.count ?? 0;
    return `${count}/${goal} ${name}`;
  });
  return [
    chip.name,
    ...toward,
    ...chip.counters.filter((counter) => !(counter.name in goals)).map((counter) => `${counter.count} ${counter.name}`),
    chip.ownedBy,
    chip.tuckedNote,
    chip.exhausted ? "exhausted" : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

/**
 * "2/5" against the point the attachment breaks at, "3" when it has none, or null with no damage and no break point.
 * Drawn apart from the name so a narrow chip clips the name, never the number the table is watching.
 */
export function attachmentChipDamage(chip: AttachmentChip): string | null {
  if (chip.damageThreshold !== null) return `${chip.damage}/${chip.damageThreshold}`;
  return chip.damage > 0 ? `${chip.damage}` : null;
}

/** `attachmentChipDamage` with the word: "0/3 dmg", so a count on a chip never rests on its red alone. */
export function attachmentChipDamageTag(chip: AttachmentChip): string | null {
  const damage = attachmentChipDamage(chip);
  return damage === null ? null : `${damage} dmg`;
}

export interface SchemePanel {
  readonly instanceId: InstanceId;
  readonly name: string;
  /** "Main scheme 1B · Accel ×1", "Side scheme · Crisis". */
  readonly subtitle: string;
  readonly threat: number;
  /** The threshold, or null for a scheme with none. */
  readonly target: number | null;
  /** True for a main scheme whose target threat is printed "—" (RRG p. 15): shown "N / —", never "reached". */
  readonly targetDashed?: boolean;
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
  /**
   * "vs Spider-Man": whose game area this scheme belongs to (Kang's per-player areas), null for a scheme every player
   * shares and in every scenario with one game area.
   */
  readonly areaLabel?: string | null;
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
  /**
   * The cards tucked under this scheme, in order, as `tuckedCardsUnder` words them (a facedown one is a card back,
   * never named): Negative Zone Prison's defeated allies (docs/phase7-wave10.md §3.15). Empty for every other scheme.
   */
  readonly tucked: readonly TuckedCardView[];
  /** "Defeated allies, facedown: 2" over the row of backs; null with nothing under the scheme. */
  readonly tuckedLabel: string | null;
  /**
   * A main scheme with cards under it: "Target 7, 2 facedown under it". The 7 is the engine's computed target (the
   * printed target and what lowers it are not both exposed, so the arithmetic is never shown); null otherwise.
   */
  readonly targetNote: string | null;
  readonly art: ArtSource | null;
  /**
   * Cards attached to this scheme — Odin attached to the main scheme, captive side faceup (Hela, `mts` 21139a,
   * docs/phase7-wave4.md §3.8), and Focused Defense attached to whichever main scheme is currently active (Tower
   * Defense, §3.2). Empty for every scheme nothing is attached to, which is every scheme before wave 4.
   */
  readonly attachments: readonly AttachmentChip[];
  /** Counters on the scheme card itself (En Sabah Nur's Pyramid collects power counters). Empty draws nothing. */
  readonly counters: readonly { readonly name: string; readonly count: number }[];
  /** Each scenario area, on the central main scheme only (`SchemeAreaNote`); absent on every other scheme. */
  readonly areaNotes?: readonly SchemeAreaNote[];
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
  /** The villain's printed "Activation Order N" (The Sinister Six), null for a villain without one. */
  readonly activationOrder: number | null;
  /** "vs Spider-Man": whose game area this villain is in (Kang's per-player areas); null when it is every player's. */
  readonly areaLabel: string | null;
  /** Null for a villain with no signature side scheme (every scenario before The Wrecking Crew). */
  readonly signatureScheme: VillainSchemeLink | null;
  /** This villain's own encounter deck (`VillainState.encounterDeckId`) — every villain shares one deck outside The Wrecking Crew. */
  readonly deck: PileCounts;
}

export interface SetAsidePanel {
  readonly count: number;
  /** Each set's printed name, in the order they were chosen ("Crime", "Sci-Fi"). */
  readonly names: readonly string[];
}

/** The encounter set's printed name, falling back to its id with the first letter raised for a set outside the pool. */
function encounterSetName(id: string): string {
  return SET_NAMES.get(id) ?? id.charAt(0).toUpperCase() + id.slice(1);
}

/**
 * Whether a card in the villain area reads the set-aside modular sets while the game runs (MojoMania's Wheel of
 * Genres loses the game when the deck resets with none left). Thunderbolts also sets sets aside, but shuffles them
 * all in during Setup: an empty list there is not a countdown, and "SET ASIDE 0 · NONE LEFT" would be a false alarm.
 */
function villainAreaReadsSetAside(state: GameState, deps: EngineDeps): boolean {
  return state.villainArea.some((id) => {
    const code = (state.instances[id]?.cardId as string | undefined)?.replace(/[ab]$/, "");
    if (!code) return false;
    return Object.entries(deps.abilities).some(
      ([abilityKey, definition]) =>
        abilityKey.startsWith(`${code}`) &&
        /"(setAsideModularSetCount|placeSetAsideModularSet)"/.test(JSON.stringify(definition)),
    );
  });
}

/**
 * The set-aside footer's numbers. Null when the scenario set none aside, and when it set some aside but has none left
 * and nothing in play counts them (Thunderbolts, after Setup shuffled its sets in).
 */
export function setAsidePanel(state: GameState, deps?: EngineDeps): SetAsidePanel | null {
  if (state.setAsideModularSets === undefined) return null;
  if (state.setAsideModularSets.length === 0 && deps && !villainAreaReadsSetAside(state, deps)) return null;
  return {
    count: state.setAsideModularSets.length,
    names: state.setAsideModularSets.map((set) => encounterSetName(set.encounterSetId)),
  };
}

/**
 * One card tucked under another (RRG 1.8 "Tuck", p. 45): out of play, but a table shows what sits under a card.
 * A card tucked facedown stays hidden information (`view/visibility.ts`): present and counted, never named.
 */
export interface TuckedCardView {
  readonly instanceId: InstanceId;
  readonly name: string;
  readonly faceup: boolean;
  /** Null for a facedown card. */
  readonly art: ArtSource | null;
}

export interface EnvironmentPanel {
  readonly instanceId: InstanceId;
  /** The face in play: "Criminal Enterprise", or "State of Madness" once it has flipped. */
  readonly name: string;
  readonly subtitle: string;
  /**
   * Every counter kind on the card, with its count: `[{ name: "infamy", count: 4 }]`. A kind the card's own text caps
   * (`counterLimitsOf`: "Max 1 [per player] synergy counters here") is listed at 0 too and carries its `limit`, so
   * the table reads "0/1" rather than nothing. Threat on the environment leads the list as a "threat" entry, with
   * the line its own text waits for as its `limit` ("3/4": Alert Level, issue 182), and `danger` when reaching
   * that line loses the game.
   */
  readonly counters: readonly {
    readonly name: string;
    readonly count: number;
    readonly limit?: number;
    readonly danger?: true;
  }[];
  readonly art: ArtSource | null;
  /**
   * Damage placed on this environment (Avengers Tower, Tower Defense's own "Forced Response: After damage is
   * placed here...", `mts` 21100a, docs/phase7-wave4.md §5) — 0 for every environment nothing damages, which is
   * every environment before wave 4. An environment prints no HP of its own (unlike a character), so this is a
   * running count, not a fraction of a max.
   */
  readonly damage: number;
  /** The cards tucked under this environment (Routed's defeated villains), in the order they went under. */
  readonly tucked: readonly TuckedCardView[];
  /** `tucked.length`; the board's count badge. */
  readonly tuckedCount: number;
}

/**
 * A scenario's own out-of-play game area — "The Collection" (Infiltrate/Escape the Museum, `gmw`; docs/phase7-
 * wave3.md §3.14), the shape `ZoneId scenarioArea`/`GameState.scenarioAreas` names generically, since a later
 * scenario may add one of its own. Every card in it is faceup (MC16 p. 10: "put ... faceup into The Collection"),
 * so unlike a deck this shows every card, not just a count — a scenario area is shared table information, closer
 * to a discard pile than to a hidden zone.
 */
export interface ScenarioAreaPanel {
  readonly name: string;
  readonly instanceIds: readonly InstanceId[];
  /** The topmost card's art, for the pile's own face — null when the area is empty. */
  readonly topArt: ArtSource | null;
  readonly count: number;
  /**
   * The count a main scheme's own text acts at (The Grand Collection 1B: "at least 5[per_hero] cards in The
   * Collection" loses the game), for the current player count; null when no scheme reads this area
   * (`scenarioAreaLimitsOf`).
   */
  readonly limit: number | null;
}

/**
 * A scenario area as a line on the main scheme's own panel, so the tally the scheme loses on sits beside the scheme
 * and not only in the encounter piles' column (a phone keeps that column on another tab). Tapping it opens the cards.
 */
export interface SchemeAreaNote {
  readonly name: string;
  readonly count: number;
  readonly limit: number | null;
  readonly instanceIds: readonly InstanceId[];
  /** "The Collection · lose at 5": the strip's caption, with `scenarioAreaTag` as its right-edge tag. */
  readonly caption: string;
  /** True once one more card would reach the limit: the strip turns red. */
  readonly urgent: boolean;
}

/**
 * One card in an in-play scenario area such as the mission area (`ZoneId scenarioPlayArea`, docs/phase7-wave8.md
 * §3.33): in play, owned but controlled by nobody. It carries what the ally and villain-area panels carry: `panel` is
 * the character panel (name, type line, hit points or damage, counters, exhausted, keywords, statuses, art) for every
 * card, and `scheme` adds the threat meter when the card is a side scheme (the mission itself). Upgrades and other
 * attachments hang under their host on `panel.attachments` (and `scheme.attachments`), not as cards of their own.
 */
export interface ScenarioPlayAreaCard {
  readonly instanceId: InstanceId;
  readonly name: string;
  /** "Ally", "Side scheme · Crisis": the type line. */
  readonly subtitle: string;
  readonly panel: CharacterPanel;
  /** The scheme meter for a side scheme, else null. */
  readonly scheme: SchemePanel | null;
  /** Threat on the card: a scheme's meter, or threat a character holds. 0 draws nothing. */
  readonly threat: number;
  /**
   * A few words under the card, or null: the pod's neutral cards say what their shared numbers do ("Flips at 10 left",
   * "Lose at 2 threat"); every other card in an area has none.
   */
  readonly note: string | null;
}

/** An in-play scenario area: its name and its unattached cards in the order they entered it. */
export interface ScenarioPlayAreaPanel {
  readonly name: string;
  /** A closed area is not reached by an ability that does not name it (MC45 p. 5). */
  readonly closed: boolean;
  /** The pod's neutral area (Loki, God of Lies and Worlds Collide): shared by the whole pod, so the board names it so. */
  readonly neutral: boolean;
  readonly cards: readonly ScenarioPlayAreaCard[];
  readonly count: number;
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
  /** "Counts Gift cards you control: 2" on a hand card that reads the Gift count; null for every other card. */
  readonly countNote: string | null;
  /** Current (errata'd) rules text; the table caps it, Inspect shows it whole. */
  readonly rulesText: string;
  /** The icons this card produces when spent as a resource. */
  readonly resourceIcons: readonly ResourceIconType[];
  /** The whole card scan; the hand draws it behind the frame. */
  readonly art: ArtSource | null;
  /**
   * Where the card is, when that is not your hand: "on Hawkeye's Quiver" for an Arrow event attached to the Quiver,
   * "in your discard" for a card whose own text lets it be played from there. The engine lets you play these "as if
   * they were in your hand", so they ride at the end of the hand strip with this as their tag. Null for a real hand
   * card. (2026-09-21: an Arrow the Quiver found was legal to play but drawn nowhere on the table.)
   */
  readonly from: string | null;
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
  /** The faceup top card of this seat's deck, which every player may read; null when the deck is facedown. */
  readonly shownTop: { readonly instanceId: InstanceId; readonly name: string } | null;
  readonly eliminated: boolean;
  /** True for a seat that sat the scenario out (owner decision 66B): `eliminated` too, but read "Sitting out", not defeated. */
  readonly sittingOut: boolean;
  /** True once this seat's turn is done this round. Never true for an eliminated seat. */
  readonly done: boolean;
  /** The seat's identity card, so a beat or a target on this hero lands on its row. */
  readonly identityInstanceId: InstanceId;
  /** Lasting effects aimed at this seat ("next card costs 1 less"). */
  readonly effects: readonly string[];
  /** Cards this seat controls that another player owns: "Heroic Intuition · from Black Panther". */
  readonly borrowed: readonly string[];
  /** Facedown encounter cards dealt to this seat and not yet revealed, oldest first. Ids only: nobody reads the cards. */
  readonly dealtFacedown: readonly InstanceId[];
}

/** The faceup top card of a player's deck (Magik): the card itself, its price from the top, and whether it can be played. */
export interface DeckTopView {
  /** The shown card; `currentCost` is what the engine charges to play it from the deck (1 less for Magik). */
  readonly card: HandCardView;
  readonly playable: boolean;
  /** In a few words, when the card is shown but cannot be played now. */
  readonly reason: string | null;
  /** The reason in two words, for a tag on the pile. */
  readonly tag: string | null;
}

/** The shown top card of the encounter deck, readable at a glance: Falcon's whole kit reads its boost icons. */
export interface EncounterTopView {
  readonly instanceId: InstanceId;
  readonly name: string;
  /** The boost icons the card counts now (`boostIconsFor`: printed, plus modifiers). */
  readonly boostIcons: number;
  /** A printed boost star: the card has a Boost ability (RRG 1.8 "Boost Icon", p. 11). Not an icon itself. */
  readonly star: boolean;
  /** "BOOST 2 \u2605", "BOOST 0": the count and the star in words and a symbol, never color alone. */
  readonly boostLine: string;
}

/** The boost line of a card: the icon count, then a star when its boost area prints one. */
export function boostLineOf(boostIcons: number, star: boolean): string {
  return `BOOST ${boostIcons}${star ? " \u2605" : ""}`;
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
  /** Set when the seat shown is out of the game (eliminated, or sitting out), so the board can say so. */
  readonly meOut: "defeated" | "sittingOut" | null;
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
  /**
   * Other main schemes active at the same time as `mainScheme` — Tower Defense's own two (`mts` 21098a, MC21 p. 10:
   * "Both main schemes are active each round"), empty for every other scenario (`GameState.extraMainSchemes`,
   * docs/phase7-wave4.md §3.2). Each is a full main scheme: it gains threat, feels acceleration/crisis icons, and
   * can be completed, the same as `mainScheme` — the board must show both, or a second main scheme accelerating
   * unseen would look like nothing happened.
   */
  readonly extraMainSchemes: readonly SchemePanel[];
  readonly sideSchemes: readonly SchemePanel[];
  readonly minions: readonly CharacterPanel[];
  /** Environment cards in the villain area, in play order. Empty for every scenario that uses none. */
  readonly environments: readonly EnvironmentPanel[];
  /** The scenario's own out-of-play areas (The Collection, docs/phase7-wave3.md §3.14). Empty for every scenario that has none. */
  readonly scenarioAreas: readonly ScenarioAreaPanel[];
  /** The scenario's in-play areas no player controls (the mission area, docs/phase7-wave8.md §3.33). Empty for every scenario that has none. */
  readonly scenarioPlayAreas: readonly ScenarioPlayAreaPanel[];
  /**
   * The modular sets still set aside, for a scenario that set some aside (MojoMania's genre sets; Wheel of Genres
   * loses the game when the deck resets with none remaining). Null when the game never set any aside, which is
   * every other scenario; present with `count: 0` once the last has been shuffled in.
   */
  readonly setAside: SetAsidePanel | null;
  /** Every named scenario deck in play — the Infinity Stone deck (`GameState.scenarioDecks`). Empty for every scenario that has none. */
  readonly scenarioDecks: readonly ScenarioDeckPanel[];
  readonly me: CharacterPanel;
  readonly myForm: Form;
  readonly myPlayArea: readonly CharacterPanel[];
  readonly hand: readonly HandCardView[];
  readonly handLimit: number;
  /** My hand size now (`handSize`): the caption prints it beside the count, so a full hand of 1 reads as full (#150). */
  readonly myHandSize: number;
  readonly myPiles: PileCounts;
  /** My deck's faceup top card, when the engine shows one; null while the deck is facedown. */
  readonly myDeckTop: DeckTopView | null;
  /** Your discard pile, top card first. Discard piles are open information (`view/visibility.ts`). */
  readonly myDiscard: readonly InstanceId[];
  /** The top of your discard, which the pile box shows faceup. */
  readonly myDiscardTop: ArtSource | null;
  readonly encounterPiles: PileCounts;
  /**
   * Encounter cards dealt facedown to you and not yet revealed (Expert setup deals one per player in the Age of
   * Apocalypse; the villain phase deals them; they flip in step four). Public as a count, never as a card: nobody looks
   * at them (MC45 p. 3). A teammate's are on their `SeatRow`. Empty when none are out.
   */
  readonly myDealt: readonly InstanceId[];
  /** The top of the encounter discard, which is faceup at the table. */
  readonly encounterDiscardTop: ArtSource | null;
  /** The encounter deck's own top card, for Inspect — facedown at the table (D08's own subtitle: "any card, anywhere, including facedown counts"), so the sheet shows a card back rather than its face. Null with an empty deck. */
  readonly encounterDeckTopInstanceId: InstanceId | null;
  /**
   * The encounter deck's top card face, only while the engine shows it (`shownEncounterTop`: Falcon's hero form, Black
   * Widow's scenario); null while it is facedown, so the tile keeps the card back.
   */
  readonly encounterDeckTopArt: ArtSource | null;
  /**
   * The faceup top card of the encounter deck as words the tile can wear: its name and printed boost, only while the
   * engine shows it (the same condition as `encounterDeckTopArt`). Null while it is facedown or the deck is empty.
   */
  readonly encounterDeckTop: EncounterTopView | null;
  /** The encounter discard's own top card, for Inspect — faceup, since a discard pile is open information. Null with an empty pile. */
  readonly encounterDiscardTopInstanceId: InstanceId | null;
  /** Every card in the encounter discard, most recent first, for the pile overlay. */
  readonly encounterDiscard: readonly InstanceId[];
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
  /**
   * Loki's own victory count (`ScenarioRules.victoryCondition`, docs/phase7-wave4.md §3.7): "If the number of Lokis
   * in the victory display is equal to the victory condition, the players win the game" (21165b). Null for every
   * other scenario — the board had no reader for either field at all before this wave, so a Loki win in progress
   * showed nothing counting toward it.
   */
  readonly victoryCondition: { readonly count: number; readonly target: number } | null;
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
  /** The deck by its owner, as the table says it: "Hercules's Labor deck" (the per-pile wording; the label stays short). */
  readonly ownerLabel: string;
  /** `"encounter"`: a deck of encounter cards a player owns (Hercules's Labor deck); `"player"` for every other deck. */
  readonly family: "player" | "encounter";
  /** The deck's printed `topCardFaceup`. False: no one may look at the top card, and Inspect on the pile shows a back. */
  readonly topFaceup: boolean;
  /** False when the deck's cards never enter a discard pile (`discardPile: "none"`): the pile draws no discard box and no count. */
  readonly hasDiscard: boolean;
  /** Whether Inspect on this pile may show a card (its top is faceup). False reads "Facedown. No one may look at it." */
  readonly inspectable: boolean;
  /** "Facedown. No one may look at it. 3 cards." for a pile whose cards are hidden; null when the top is faceup. */
  readonly hiddenNote: string | null;
  /**
   * The deck's own cards that are out of it and where they are - revealed, in play, in the victory display - for an
   * encounter-card deck only (Hercules's Labor cards: a card is dealt faceup while it is revealed, then sits in play
   * or in the victory display, or goes back to the bottom of the deck). Empty for every other deck.
   */
  readonly outside: readonly SeparateDeckOutsideCard[];
}

/** One card of an encounter-card separate deck that is not in it now (`locateCard` says where). */
export interface SeparateDeckOutsideCard {
  readonly instanceId: InstanceId;
  readonly name: string;
  readonly where: "revealed" | "in play" | "attached" | "victory display";
  /** "Defeat the Hydra - attached to Rhino", the line the zone draws. */
  readonly line: string;
}

const ROMAN = ["I", "II", "III", "IV", "V"] as const;

/** The encounter discard is faceup, so its top card is public information. */
/**
 * The faceup card on top of a discard pile. The engine puts a discarded card on
 * top by *prepending* it (`moveCard(..., "top")`), so the top is index 0 — this
 * used to read the last element, and the encounter discard showed the first
 * card ever discarded instead of the latest.
 */
/** The shown encounter top's face, or null while the deck's top is facedown or the deck is empty. */
function encounterDeckTopArt(state: GameState, deps: EngineDeps): ArtSource | null {
  const top = shownEncounterTop(state, deps);
  return top === null ? null : artFor(cardOf(state, top), { kind: "front" });
}

function encounterDeckTopView(state: GameState, deps: EngineDeps): EncounterTopView | null {
  const top = shownEncounterTop(state, deps);
  if (top === null) return null;
  const boostIcons = boostIconsFor(state, deps, top);
  const star = hasStarIcon(state, top);
  return {
    instanceId: top,
    name: currentName(state, top) ?? cardOf(state, top)?.name ?? "Card",
    boostIcons,
    star,
    boostLine: boostLineOf(boostIcons, star),
  };
}

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
    const definition = separateDeckDefinition(state, me.playerId, name);
    const family = definition?.cardFamily === "encounter" ? "encounter" : "player";
    const topFaceup = definition?.topCardFaceup ?? true;
    const noun = /\bdeck$/i.test(name) ? name : `${name} deck`;
    return {
      name,
      deckCount: pile.deck.length,
      discardCount: pile.discard.length,
      topInstanceId: top,
      topArt: top ? artFor(cardOf(state, top), faceOf(state, top)) : null,
      discardTopInstanceId: discardTop,
      discardTopArt: discardTop ? artFor(cardOf(state, discardTop), { kind: "front" }) : null,
      ownerLabel: `${possessiveName(playerName(state, me.playerId))} ${noun}`,
      family,
      topFaceup,
      hasDiscard: (definition?.discardPile ?? "own") !== "none",
      inspectable: topFaceup,
      hiddenNote: topFaceup
        ? null
        : `Facedown. No one may look at it. ${pile.deck.length} card${pile.deck.length === 1 ? "" : "s"}.`,
      outside: family === "encounter" ? outsideCardsOf(state, me.playerId, name, pile.deck) : [],
    };
  });
}

/** "Hercules's", "Thor's": always 's, as the plan and the cards say it. */
const possessiveName = (name: string): string => `${name}'s`;

/**
 * The cards whose home is this encounter-card deck and that are out of it, in instance order, with where each is now.
 * A revealed card is `dealtEncounter` while it is revealed; one in play sits in a play area or hangs on a card; a
 * defeated or completed one is in the victory display (RRG 1.8 FAQ "Hercules Hero Pack - Labor Cards", p. 65).
 *
 * Each line leads with where the card is ("In play: Defeat the Hydra on Lernean Hydra"). It hangs under the pile's
 * boxes, so a bare card name there read as the pile's own name (click-through F9: a card back captioned
 * "DEFEAT THE HYDRA"); the place first says it is a card that left the deck, and a clipped tail loses only the host.
 */
function outsideCardsOf(
  state: GameState,
  playerId: PlayerId,
  deckName: string,
  inDeck: readonly InstanceId[],
): readonly SeparateDeckOutsideCard[] {
  const out: SeparateDeckOutsideCard[] = [];
  for (const instance of Object.values(state.instances)) {
    if (instance.ownerId !== playerId || instance.home.kind !== "separateDeck" || instance.home.name !== deckName) {
      continue;
    }
    if (inDeck.includes(instance.instanceId)) continue;
    const zone = locateCard(state, instance.instanceId);
    const name = currentName(state, instance.instanceId) ?? cardOf(state, instance.instanceId)?.name ?? "Card";
    const entry = (where: SeparateDeckOutsideCard["where"], line: string): void => {
      out.push({ instanceId: instance.instanceId, name, where, line });
    };
    if (zone?.kind === "dealtEncounter") entry("revealed", `Revealing: ${name}`);
    else if (zone?.kind === "victoryDisplay") entry("victory display", `Victory display: ${name}`);
    else if (zone?.kind === "attachment") {
      entry("attached", `In play: ${name} on ${faceUpName(state, zone.hostInstanceId)}`);
    } else if (zone?.kind === "playArea") entry("in play", `In play: ${name}`);
  }
  return out;
}

/**
 * "Hercules's Labor" for an encounter card a player owns (a Labor card; `isOwnedEncounterCard`), null for every other
 * card. An encounter card all the same, so no one controls it: the label says whose deck it came from.
 */
export function ownedEncounterLabel(state: GameState, id: InstanceId, short = false): string | null {
  if (!isOwnedEncounterCard(state, id)) return null;
  const instance = getInstance(state, id);
  if (!instance || instance.ownerId === null || instance.home.kind !== "separateDeck") return null;
  const owner = playerName(state, instance.ownerId);
  // The short form is for a chip on the card it hangs from, a narrow strip that wraps and clips a long possessive
  // ("HERCULES'S..." cut the owner off): the kind of card first, the owner in brackets, "Labor (Hercules)".
  return short ? `${instance.home.name} (${owner})` : `${possessiveName(owner)} ${instance.home.name}`;
}

/**
 * "vs Spider-Man" for a villain or scheme that sits in a separate game area (Kang's per-player areas), naming the area's
 * players; null for anything outside one, so a scenario with a single game area labels nothing.
 */
export function areaLabelOf(state: GameState, id: InstanceId): string | null {
  const area = state.gameAreas.find(
    (candidate) =>
      candidate.mainScheme?.instanceId === id ||
      candidate.villainIds.includes(id) ||
      candidate.sideSchemeIds.includes(id),
  );
  if (!area || area.playerIds.length === 0) return null;
  // "Spider-Man (Peter Parker)" is "Spider-Man" here: the chip is a short line on a tile, and the hero is who is meant.
  const names = area.playerIds.map((player) => playerName(state, player).replace(/\s*\([^)]*\)\s*$/, ""));
  return `vs ${names.join(" + ")}`;
}

/**
 * Every villain of the scenario, printed order, defeated ones included — The Wrecking Crew's Breakout has four;
 * every other scenario so far has one. Built from `state.villains`/`state.activeVillainId` directly rather than
 * from `activeVillain(state)`, which only ever names the one with the active counter.
 */
function villainPanels(state: GameState, deps: EngineDeps): readonly VillainPanel[] {
  // A villain tucked under a card (Routed) is out of play: not on the table, not a target, not "defeated" in the row.
  const tucked = new Set(Object.values(state.instances).flatMap((instance) => instance.tucked));
  // A villain row (Four Horsemen) sets the left-to-right order; villains it omits follow in printed order.
  const row = state.villainRow;
  const rank = (id: InstanceId): number => {
    const at = row ? row.indexOf(id) : -1;
    return at < 0 ? (row?.length ?? 0) : at;
  };
  const ordered = row ? [...state.villains].sort((a, b) => rank(a.instanceId) - rank(b.instanceId)) : state.villains;
  return (
    ordered
      .filter((villain) => !tucked.has(villain.instanceId))
      // A `bySetup` scenario (God of Lies, On the Run) starts with a placeholder villain its main scheme's Setup then
      // replaces: defeated and never turned faceup, it was never on the table, so it gets no tile in the row.
      .filter((villain) => !(villain.defeated && getInstance(state, villain.instanceId)?.faceup === false))
      .map((villain) => ({
        panel: characterPanel(state, villain.instanceId, deps),
        active: villain.instanceId === state.activeVillainId,
        defeated: villain.defeated,
        activationOrder: (() => {
          const card = cardOf(state, villain.instanceId);
          return card?.type === "villain" ? (card.activationOrder ?? null) : null;
        })(),
        areaLabel: areaLabelOf(state, villain.instanceId),
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
      }))
  );
}

export function boardModel(
  state: GameState,
  perspectiveId: PlayerId,
  deps: EngineDeps,
  /** The viewer's legal actions, which say whether the shown top card can be played and why not. */
  actions: LegalActions | null = null,
): BoardModel {
  const me = getPlayer(state, perspectiveId);
  if (!me) throw new Error(`no seat ${perspectiveId}`);

  const schemes = schemesInPlay(state);
  // Every main scheme in play (Tower Defense has two, §3.2) is drawn as a main scheme, never again as a side scheme.
  // A separate game area's own stage (The Master of Time's stage 3, `GameAreaState.mainScheme`) is a main scheme too:
  // the engine's `mainSchemeStates` lists it, and it is neither `state.mainScheme` nor in `extraMainSchemes`, so it would fall
  // through to the side scheme list and draw as the bare card ("Kang's Arrival", no threshold, wrong inspect face).
  const otherMainSchemes = [
    ...(state.extraMainSchemes ?? []),
    ...state.gameAreas.flatMap((area) => (area.mainScheme ? [area.mainScheme] : [])),
  ];
  const mainSchemeIds = new Set([state.mainScheme.instanceId, ...otherMainSchemes.map((scheme) => scheme.instanceId)]);
  const scenarioAreas = scenarioAreaPanels(state, deps, [...mainSchemeIds]);
  const sideSchemes = schemes.filter((id) => !mainSchemeIds.has(id)).map((id) => schemePanel(state, id, deps, false));

  return {
    round: state.round,
    phase: phaseOf(state),
    stepLabel: stepLabel(state, perspectiveId),
    meOut: outStatusOf(me),
    firstPlayerId: state.firstPlayerId,
    perspectiveId,
    villain: characterPanel(state, activeVillain(state).instanceId, deps),
    villains: villainPanels(state, deps),
    mainScheme: withAreaNotes(schemePanel(state, state.mainScheme.instanceId, deps, true), scenarioAreas),
    extraMainSchemes: otherMainSchemes.map((scheme) => schemePanel(state, scheme.instanceId, deps, true)),
    sideSchemes,
    minions: minionsOf(state).map((id) => characterPanel(state, id, deps)),
    environments: state.villainArea
      .filter((id) => cardOf(state, id)?.type === "environment")
      .map((id) => environmentPanel(state, id, deps)),
    scenarioAreas,
    scenarioPlayAreas: scenarioPlayAreaPanels(state, deps),
    setAside: setAsidePanel(state, deps),
    scenarioDecks: scenarioDeckPanels(state),
    me: characterPanel(state, me.identity.instanceId, deps),
    myForm: me.identity.form,
    // An attachment is drawn on its host — except an upgrade on your own
    // identity, which is a card you played and must be able to find. On the
    // table those sit in front of you, not stacked on your identity card, so
    // the play area is where a player looks for them. The engine keeps them on
    // the identity's own `attachments`, not in `playArea`, so they are read
    // from there; what the encounter deck hangs on you stays on the identity.
    myPlayArea: [
      ...(getInstance(state, me.identity.instanceId)?.attachments ?? []).filter(
        (id) => cardOf(state, id)?.type === "upgrade" && !me.playArea.includes(id),
      ),
      ...me.playArea.filter((id) => {
        // An engaged minion lives in `playArea` too (engine/src/query.ts `minionsEngagedWith`), but it belongs to
        // the enemies zone, not this player's own cards — `minionsOf` already draws it there.
        if (isMinion(state, id)) return false;
        const attachedTo = getInstance(state, id)?.attachedTo ?? null;
        return attachedTo === null || attachedTo === me.identity.instanceId;
      }),
    ].map((id) => characterPanel(state, id, deps)),
    hand: [
      ...me.hand.map((id) => handCardView(state, id, perspectiveId, deps)),
      ...playableOutsideHandOf(state, perspectiveId, deps).map(({ id, from }) => ({
        ...handCardView(state, id, perspectiveId, deps),
        from,
      })),
    ],
    handLimit: me.hand.length,
    myHandSize: handSize(state, perspectiveId, deps),
    myPiles: { deck: me.deck.length, discard: me.discard.length },
    myDeckTop: myDeckTopView(state, perspectiveId, deps, actions),
    encounterPiles: {
      deck: activeEncounterDeck(state).deck.length,
      discard: activeEncounterDeck(state).discard.length,
    },
    myDealt: [...me.dealtEncounter],
    myDiscard: me.discard,
    myDiscardTop: topOfDiscard(state, me.discard),
    encounterDiscardTop: topOfDiscard(state, activeEncounterDeck(state).discard),
    encounterDeckTopInstanceId: activeEncounterDeck(state).deck[0] ?? null,
    encounterDeckTopArt: encounterDeckTopArt(state, deps),
    encounterDeckTop: encounterDeckTopView(state, deps),
    encounterDiscardTopInstanceId: activeEncounterDeck(state).discard[0] ?? null,
    encounterDiscard: activeEncounterDeck(state).discard,
    separateDecks: separateDeckPiles(state, me),
    team: state.players
      .filter((player) => player.playerId !== perspectiveId)
      .map((player) => seatRow(state, player.playerId, deps)),
    outcome: state.outcome,
    victoryCondition:
      state.scenarioRules.victoryCondition !== undefined
        ? { count: state.victoryDisplay.length, target: state.scenarioRules.victoryCondition }
        : null,
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
const VILLAIN_STEPS = [
  "placeThreat",
  "enemyActivations",
  "dealEncounterCards",
  "revealEncounterCards",
  "passFirstPlayer",
] as const;

/** How a seat that is out of the game reads, or null for a live one. */
function outStatusOf(player: {
  readonly eliminated: boolean;
  readonly sittingOut?: boolean;
}): "defeated" | "sittingOut" | null {
  if (player.sittingOut === true) return "sittingOut";
  return player.eliminated ? "defeated" : null;
}

/** An identity's or villain's hit point dial stops at 0 (RRG 1.8 "Hit Points", p. 22); a token (ally, minion) is left as is. */
function dialValue(state: GameState, id: InstanceId, current: number | undefined): number | undefined {
  if (current === undefined || current >= 0) return current;
  const isIdentity = state.players.some((player) => player.identity.instanceId === id);
  return isIdentity || isVillain(state, id) ? 0 : current;
}

function stepLabel(state: GameState, perspectiveId: PlayerId): string {
  const label = liveStepLabel(state, perspectiveId);
  if (state.outcome) return label;
  const out = outStatusOf(getPlayer(state, perspectiveId) ?? { eliminated: false });
  if (out === null) return label;
  const { step } = state;
  const tag = out === "sittingOut" ? "you are sitting out" : "you are out";
  // The turn can still sit on the dead seat for a moment (or the engine can keep it there): never "Your turn".
  if (step.phase === "player" && step.kind === "turn" && step.activePlayerId === perspectiveId)
    return out === "sittingOut"
      ? `${playerName(state, perspectiveId)} is sitting out`
      : `${playerName(state, perspectiveId)} is defeated`;
  return `${label} · ${tag}`;
}

function liveStepLabel(state: GameState, perspectiveId: PlayerId): string {
  const { step } = state;
  // Three outcomes, not two: a conceded game is neither a win nor a defeat (see `GameOutcome`).
  if (state.outcome)
    return state.outcome.result === "win" ? "Victory" : state.outcome.result === "conceded" ? "Conceded" : "Defeat";
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
  // A minion can only be in one zone, so the lists never overlap. What a card holds comes first, next to its host.
  return [...heldCharacters(state), ...fromVillainArea, ...engaged];
}

/** The seat an enemy is engaged with, named for a chip on the minion; null in a solo game or when unengaged. */
export function engagedNameOf(state: GameState, seat: PlayerId | null): string | null {
  if (seat === null || state.players.length < 2) return null;
  const name = playerName(state, seat);
  const same = state.players.filter((player) => playerName(state, player.playerId) === name);
  if (same.length < 2) return name;
  return `${name} ${state.players.findIndex((player) => player.playerId === seat) + 1}`;
}

const SET_NAMES: ReadonlyMap<string, string> = new Map(POOL_ENCOUNTER_SETS.map((set) => [set.id as string, set.name]));

export function characterPanel(state: GameState, id: InstanceId, deps: EngineDeps): CharacterPanel {
  const instance = getInstance(state, id);
  if (!instance) throw new Error(`no card instance ${id}`);
  const card = cardOf(state, id);
  const profile = characterProfile(state, id, deps);
  const current = dialValue(state, id, remainingHitPoints(state, id, deps));
  const max = maxHitPoints(state, id, deps);

  const seat = state.players.find((player) => player.identity.instanceId === id);
  const defeat = seat ? outStatusOf(seat) : null;
  const statuses = defeat ? [] : statusPips(instance);
  return {
    instanceId: id,
    name: displayName(state, instance, card),
    subtitle: subtitleOf(state, instance, card),
    // `traitsOf` (not the printed `card.traits`): a card "treated as" another kind shows its new traits — Fallen
    // Warrior's ally treated as an [Undead] minion, and the mirror, a minion treated as an ally (docs/phase7-
    // wave4.md §3.9, §3.29) — and any trait a lasting effect has granted, which the printed field never carried.
    traits: card ? traitsOf(state, id, deps) : [],
    keywords: keywordsOf(state, id, deps).map((keyword) => keyword.name),
    grantedKeywords: grantedKeywordLabels(state, id, deps),
    statuses,
    stats: defeat ? [] : statTiles(state, id, profile, identityForm(state, instance), current, max),
    art: artFor(card, faceOf(state, id)),
    hp: !defeat && current !== undefined && max !== undefined ? { current, max } : null,
    ...(defeat ? { defeat } : {}),
    exhausted: defeat ? false : instance.exhausted,
    boostCount: instance.boostCards.length,
    ...(card && isLeaderCard(card) ? { leader: true as const } : {}),
    ...(card?.type === "villain" && instance.boostCards.length > 0
      ? { boostNote: boostNoteOf(instance.boostCards.length) }
      : {}),
    engagedWith: instance.engagedWith,
    engagedName: engagedNameOf(state, instance.engagedWith),
    disabledActions: statuses
      .map(({ status }) => STATUS_DISABLES[status])
      .filter((action): action is "attack" | "thwart" => action !== null),
    attachments: attachmentChipsOf(state, instance, deps),
    counters: countersOf(state, id),
    damageNote: current === undefined ? damageNote(instance.damage, breakPointOf(state, id, deps)) : null,
    threat: threatOnCard(state, id),
    ownerName:
      instance.ownerId !== null && instance.controllerId !== null && instance.ownerId !== instance.controllerId
        ? playerName(state, instance.ownerId)
        : null,
    ownedBy: ownedEncounterLabel(state, id),
    countNote: giftReaderNote(state, id, controllerOf(state, id) ?? state.players[0]!.playerId, deps),
    effects: seatNotesOf(state, state.players.find((seat) => seat.identity.instanceId === id)?.playerId ?? null, deps),
    tucked: tuckedCardsUnder(state, id),
    tuckedCount: instance.tucked.length,
    heldBy: heldByOf(state, id),
    inactiveKeywords: inactiveKeywordsOf(state, id, deps),
  };
}

/** "2 facedown boost cards waiting", with when they are turned up. Counts only; the cards are never named. */
export function boostNoteOf(count: number): string {
  return `${count} facedown boost card${count === 1 ? "" : "s"} waiting, turned up at the next activation in addition to the one dealt`;
}

/** What a held minion's keywords do while it is held: Guard needs an engagement to protect, and it has none. */
function inactiveKeywordsOf(state: GameState, id: InstanceId, deps: EngineDeps): readonly string[] {
  if (heldByOf(state, id)?.kind !== "held") return [];
  return keywordsOf(state, id, deps)
    .filter((keyword) => keyword.name === "guard")
    .map(keywordLabel);
}

/**
 * "UNDER 2" for a tile with room for a count only, "UNDER 2 · Albert Moon, Facedown card" where the names fit. A facedown
 * tucked card is only ever "Facedown card" (`tuckedCardsUnder`). Empty when nothing is tucked here.
 */
export function tuckedLine(panel: Pick<CharacterPanel, "tucked" | "tuckedCount">, names: boolean): string {
  if (panel.tuckedCount === 0) return "";
  const head = `UNDER ${panel.tuckedCount}`;
  return names ? `${head} \u00b7 ${panel.tucked.map((card) => card.name).join(", ")}` : head;
}

/** What holds `id`, when it is a held minion or a captive ally on another card; null for every other card. */
export function heldByOf(state: GameState, id: InstanceId): HeldByView | null {
  const hostId = getInstance(state, id)?.attachedTo ?? null;
  if (hostId === null) return null;
  const kind = isHeldMinion(state, id) ? "held" : isCaptiveAlly(state, id) ? "captive" : null;
  if (kind === null) return null;
  return { kind, hostId, hostName: currentName(state, hostId) ?? cardOf(state, hostId)?.name ?? "a card" };
}

/** Held minions and captive allies in play, oldest first: the engine's own two predicates, so a rule is never restated. */
function heldCharacters(state: GameState): readonly InstanceId[] {
  const inPlay = new Set(cardsInPlay(state));
  return Object.values(state.instances)
    .filter((instance) => instance.attachedTo !== null && inPlay.has(instance.instanceId))
    .map((instance) => instance.instanceId)
    .filter((id) => heldByOf(state, id) !== null);
}

/**
 * Lasting effects aimed at a seat, as the notes its panel and seat row wear.
 * A "choose a player" effect that lingers (Helicarrier: "reduce the resource
 * cost of the next card that player plays") otherwise leaves no trace on the
 * table that it happened, or to whom.
 */
/** The seat's lasting effects and, for a hero with a Gift deck, the Gift count as the engine reads it. */
function seatNotesOf(state: GameState, playerId: PlayerId | null, deps: EngineDeps): readonly string[] {
  const gift = playerId === null ? null : giftSeatNote(state, playerId, deps);
  return [...seatEffectsOf(state, playerId), ...(gift ? [gift] : [])];
}

function seatEffectsOf(state: GameState, playerId: PlayerId | null): readonly string[] {
  if (playerId === null) return [];
  const reduction = state.lastingEffects.reduce(
    (total, effect) =>
      effect.kind === "costReduction" && effect.playerId === playerId ? total + effect.amount : total,
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
export function faceOf(state: GameState, instanceId: InstanceId, view?: ViewerContext): CardFace {
  const instance = getInstance(state, instanceId);
  const card = cardOf(state, instanceId);
  if (!instance || !card || !faceVisible(state, instanceId, view)) {
    return { kind: "back", back: backKindOf(state, instance) };
  }
  switch (card.type) {
    case "hero_identity": {
      const player = state.players.find((seat) => seat.identity.instanceId === instance.instanceId);
      if (!player) return { kind: "hero" };
      if (player.identity.form === "alterEgo") return { kind: "alterEgo" };
      // Spectrum's energy/density/mass forms and Ant-Man/Wasp's Giant form (docs/phase7-wave2.md §3.2, docs/
      // phase7-wave4.md §5): `heroFormIndex` 0 is the printed `hero` face itself, n > 0 is `additionalHeroForms[n - 1]`.
      const formIndex = player.identity.heroFormIndex ?? 0;
      return formIndex > 0 ? { kind: "heroForm", index: formIndex } : { kind: "hero" };
    }
    case "villain": {
      const villain = villainOf(state, instanceId) ?? activeVillain(state);
      return {
        kind: "villainStage",
        sideIndex: Math.max(
          0,
          card.sides.findIndex((side) => side.side === villain.side),
        ),
        stageIndex: villain.stageIndex,
      };
    }
    case "main_scheme":
      // The B side is the one on the table: it carries the threat values shown,
      // and it is the side with a picture. Asking a main scheme for its "front"
      // gets nothing, because the schema puts the image on the stage.
      // This instance's own stage: a game area's stage 3 is a second instance of the same card at another stage.
      return {
        kind: "mainSchemeStage",
        stageIndex: (mainSchemeStateOf(state, instanceId) ?? state.mainScheme).stageIndex,
        side: "B",
      };
    default:
      // A flipped double-sided encounter card shows its other face, not its front (Criminal Enterprise once it
      // has become State of Madness). Without this the table keeps drawing the side that is no longer in play.
      // Never the other face of a card whose reverse is hidden (`otherFaceVisible`): the stand-in's own `flipSide` is some
      // other card's Trance.
      return instance.flipped && otherFaceVisible(state, instanceId) && "flipSide" in card && card.flipSide
        ? { kind: "flipSide" }
        : { kind: "front" };
  }
}

/**
 * The printed face an identity's ability belongs to, for a panel that is *about that ability* (a choice's source
 * card, a trigger offer). Only the live face's abilities are ever active (`activeAbilityRefs`), so this is `faceOf`
 * in every ordinary case; it differs only when the form changed between the ability being offered and drawn — then
 * the panel still shows the side that prints it ("I Object!" is Jennifer Walters', not She-Hulk's). Any other card,
 * or an ability no face of the identity prints, answers `faceOf`.
 */
export function abilityFaceOf(
  state: GameState,
  instanceId: InstanceId,
  abilityId: AbilityId | null,
  view?: ViewerContext,
): CardFace {
  const live = faceOf(state, instanceId, view);
  const card = cardOf(state, instanceId);
  // A main scheme's Setup is printed on its A side, but by the time the choice is asked the scheme shows its B side:
  // the panel about that Setup shows the A side's text, not the side's Forced Response.
  if (abilityId && card?.type === "main_scheme" && live.kind === "mainSchemeStage") {
    const stage = card.stages[live.stageIndex];
    if (stage?.aSide.abilities.some((ability) => ability.id === abilityId))
      return { kind: "mainSchemeStage", stageIndex: live.stageIndex, side: "A" };
  }
  if (!abilityId || card?.type !== "hero_identity" || live.kind === "back") return live;
  const prints = (abilities: readonly { readonly id: AbilityId }[]): boolean =>
    abilities.some((ability) => ability.id === abilityId);
  const heroFormAbilities = (index: number) =>
    index > 0 ? (card.additionalHeroForms?.[index - 1]?.abilities ?? []) : card.hero.abilities;
  const liveAbilities =
    live.kind === "alterEgo" ? card.alterEgo.abilities : heroFormAbilities(live.kind === "heroForm" ? live.index : 0);
  if (prints(liveAbilities)) return live;
  if (prints(card.alterEgo.abilities)) return { kind: "alterEgo" };
  if (prints(card.hero.abilities)) return { kind: "hero" };
  const index = (card.additionalHeroForms ?? []).findIndex((form) => prints(form.abilities));
  return index >= 0 ? { kind: "heroForm", index: index + 1 } : live;
}

/** The form an identity card is showing, or null when the card isn't an identity. */
function identityForm(state: GameState, instance: CardInstance): Form | null {
  const player = state.players.find((seat) => seat.identity.instanceId === instance.instanceId);
  return player ? player.identity.form : null;
}

function displayName(state: GameState, instance: CardInstance, card: AnyCard | undefined): string {
  if (!instance.faceup) {
    // `facedownAs.kind === "blank"` (Bruno Carrelli's own "attach 1 card from your hand facedown here" — RRG says
    // it "has no title" while facedown, `state.ts`'s own docblock) can print no traits at all: Spectrum's own three
    // energy form upgrades sit facedown, untitled, unattached (`mts` 21001b's Setup, docs/phase7-wave4.md §5).
    // "No title" is correct for the rules (nothing reads it), but an empty label reads as a bug on the table, so
    // this still shows something legible rather than blank text.
    const traits = instance.facedownAs?.traits.join(" ");
    return traits ? traits : "Facedown card";
  }
  if (!card) return "Unknown card";
  // A hero identity card carries both faces (and, for Spectrum/Ant-Man/Wasp, more than one hero face); the panel
  // names the one in play, straight off the engine's own `identityFace` so a client-side "hero or alter-ego" guess
  // can't disagree with `heroFormIndex`.
  if (card.type === "hero_identity") {
    const player = state.players.find((seat) => seat.identity.instanceId === instance.instanceId);
    if (!player) return heroFaceDisplayName(card);
    return qualifiedHeroName(card, identityFace(state, player).face.faceName);
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
      // The pod's neutral villain (Loki, God of Lies) is no `VillainState`: it has no stage of its own to number.
      if (state.pod?.neutral?.villainInstanceId === instance.instanceId) return "Neutral villain";
      const villain = villainOf(state, instance.instanceId) ?? activeVillain(state);
      // Loki's own victory count (docs/phase7-wave4.md §3.7): defeating one stage only ever advances to another
      // random set-aside Loki, never wins by itself, so the running count toward ScenarioRules.victoryCondition is
      // the only sign of progress the villain panel can give.
      const victory =
        state.scenarioRules.victoryCondition !== undefined
          ? ` · Victory ${state.victoryDisplay.length}/${state.scenarioRules.victoryCondition}`
          : "";
      // The Four Horsemen print a version letter (A/B) on each card instead of a stage (`stageLabel`): a roman
      // numeral would call War's B card "Stage I".
      const letter = villainStageOf(state, instance.instanceId).stageLabel;
      if (letter) return `${foeWord(card)} · Side ${letter}${victory}`;
      return `${foeWord(card)} · Stage ${ROMAN[villain.stageIndex] ?? String(villain.stageIndex + 1)}${victory}`;
    }
    case "hero_identity": {
      const player = state.players.find((seat) => seat.identity.instanceId === instance.instanceId);
      // A hero from the collection in play as a minion (Reluctant Foe) is no seat's identity: its hero side, treated as a minion.
      if (!player && instance.treatedAs?.kind === "minion") return "Minion (treated as)";
      const form = player?.identity.form ?? "hero";
      const aspects = player ? deckAspects(state, player.playerId) : [];
      const label = aspects.map(aspectLabel).join(" + ");
      return `${form === "hero" ? "Hero" : "Alter-ego"}${label ? ` · ${label}` : ""}`;
    }
    case "minion":
      // Mind Control, Redemption, Karma (docs/phase7-wave4.md §3.29): a minion "treated as an ally" for its
      // controller stays the same printed card — the badge is the only sign anything changed.
      return instance.treatedAs?.kind === "ally" ? "Ally (treated as)" : "Minion";
    case "ally":
      // Fallen Warrior, Beguiled (docs/phase7-wave4.md §3.9): the attached ally "is essentially a status change"
      // (Dec 17, 2025 ruling (1) #3) — it never leaves play, so the subtitle is the only visible sign it is now a
      // minion engaged with its controller rather than an ordinary ally.
      return instance.treatedAs?.kind === "minion" ? "Minion (treated as)" : "Ally";
    case "upgrade":
      return "Upgrade";
    case "support":
      return "Support";
    case "environment":
      // A Spell card put into a player's own play area (Ebony Maw's own "puts that card into play in their play
      // area", `mts` 21076-21078, docs/phase7-wave4.md §3.17/§5) is drawn through here — the ordinary
      // `characterPanel` play-area path, not the villain-area-only `environmentPanel` — so it needs its own title
      // case rather than falling through to the generic snake_case default below.
      return "Environment";
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
  return deckAspects(state, playerId)[0] ?? null;
}

/**
 * Every aspect tied for the most cards in a player's cards, in first-seen order: one for an ordinary deck, all four for
 * Adam Warlock, whose deckbuilding needs an equal number from each ("Avatar of Life", `mts` 21031a).
 */
export function deckAspects(state: GameState, playerId: PlayerId): readonly Aspect[] {
  const player = getPlayer(state, playerId);
  if (!player) return [];
  const counts = new Map<Aspect, number>();
  for (const id of [...player.deck, ...player.hand, ...player.discard, ...player.playArea]) {
    const card = cardOf(state, id);
    if (!card || !("aspect" in card)) continue;
    const aspect = card.aspect as Aspect;
    if (aspect === "basic" || aspect.startsWith("hero:")) continue;
    counts.set(aspect, (counts.get(aspect) ?? 0) + 1);
  }
  const most = Math.max(0, ...counts.values());
  return [...counts].filter(([, count]) => count === most && count > 0).map(([aspect]) => aspect);
}

const aspectLabel = (aspect: Aspect): string => aspectName(aspect);

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

/**
 * The stage as the card prints it ("2", or "2B" on a lettered branch), never the stage's position in the card's own
 * `stages` list: a card can list several stages that share a printed number (Mansion Attack's main scheme has four
 * stage 2 cards), so the position would name a stage that does not exist.
 */
function printedStageOf(stage: { readonly stageNumber: number; readonly stageLetter?: string }): string {
  return `${stage.stageNumber}${stage.stageLetter?.toUpperCase() ?? ""}`;
}

export function schemePanel(state: GameState, id: InstanceId, deps: EngineDeps, isMain: boolean): SchemePanel {
  const instance = getInstance(state, id);
  if (!instance) throw new Error(`no card instance ${id}`);
  const card = cardOf(state, id);

  if (isMain) {
    // `mainSchemeStateOf` (not `state.mainScheme` unconditionally): Tower Defense's own second main scheme
    // (`GameState.extraMainSchemes`, docs/phase7-wave4.md §3.2) has its own stage index and acceleration tokens,
    // not the central scheme's — reading `state.mainScheme` here regardless of `id` would draw both main scheme
    // panels identically, borrowing the central one's numbers for the other.
    const scheme = mainSchemeStateOf(state, id) ?? state.mainScheme;
    const stage = mainSchemeStageOf(state, scheme);
    const accel = scheme.accelerationTokens;
    const attachments = attachmentChipsOf(state, instance, deps);
    // Odin (Hela, docs/phase7-wave4.md §3.8) and Focused Defense (Tower Defense, §3.2) are printed abilities that
    // attach to a main scheme rather than a character — the subtitle line is the only room a scheme panel has for
    // this, the same "· X tucked" pattern already appends here.
    const attachedNote = attachments.length > 0 ? ` · ${attachments.map((a) => a.name).join(", ")}` : "";
    return {
      instanceId: id,
      name: stage.name ?? card?.name ?? "Main scheme",
      subtitle: `Main scheme ${printedStageOf(stage)}${accel > 0 ? ` · Accel ×${accel}` : ""}${instance.tucked.length > 0 ? ` · ${instance.tucked.length} tucked` : ""}${attachedNote}`,
      threat: instance.threat,
      // The engine's own target (`mainSchemeValue`): scaled per player, and for a printed "X" (Apocalypse's scheme)
      // the ability-defined value, not the 0 the card data prints.
      // A dashed target ("—", RRG p. 15) is never reached: no target, so no threshold state and no meter.
      target: stage.dashedValues?.includes("targetThreat")
        ? null
        : mainSchemeValue(state, "targetThreat", deps, scheme),
      meterMax: stage.dashedValues?.includes("targetThreat")
        ? null
        : mainSchemeValue(state, "targetThreat", deps, scheme),
      ...(stage.dashedValues?.includes("targetThreat") ? { targetDashed: true } : {}),
      isMain: true,
      areaLabel: areaLabelOf(state, id),
      // Crisis is a printed (or gained) icon in the threat box (RRG "Crisis Icon"), not a keyword; `iconsOn` reads
      // 0 while the scheme's text box is blanked.
      crisis: iconsOn(state, deps, id, "crisis") > 0,
      accelerationTokens: accel,
      tuckedCount: instance.tucked.length,
      ...schemeTuckFields(
        state,
        id,
        stage.dashedValues?.includes("targetThreat") ? null : mainSchemeValue(state, "targetThreat", deps, scheme),
      ),
      art: artFor(card, faceOf(state, id)),
      attachments,
      counters: countersOf(state, id),
    };
  }

  // Crisis is a printed (or gained) icon in the threat box (RRG "Crisis Icon"), not a keyword; `iconsOn` reads 0
  // while the scheme's text box is blanked.
  const crisis = iconsOn(state, deps, id, "crisis") > 0;

  // A signature side scheme (The Wrecking Crew's Thunderstruck, Pile It On!, …) is tied to one villain (`VillainState.
  // signatureSideSchemeId`), and the table has to say whose: with four in play at once under one "side schemes"
  // list, "Side scheme · Crisis" told the player nothing about which villain it was thwarting toward.
  const signatureOf = state.villains.find((villain) => villain.signatureSideSchemeId === id);
  const villainName = signatureOf
    ? (currentName(state, signatureOf.instanceId) ?? cardOf(state, signatureOf.instanceId)?.name ?? null)
    : null;

  return {
    instanceId: id,
    name: card?.name ?? "Side scheme",
    subtitle: `Side scheme${crisis ? " · Crisis" : ""}${villainName ? ` · ${villainName}` : ""}${instance.tucked.length > 0 ? ` · ${instance.tucked.length} tucked` : ""}`,
    threat: instance.threat,
    // A side scheme has no threshold: it is defeated when thwarted to 0.
    target: null,
    meterMax: card?.type === "side_scheme" ? Math.max(scaleIn(state, card.startingThreat), instance.threat) : null,
    isMain: false,
    areaLabel: areaLabelOf(state, id),
    crisis,
    accelerationTokens: 0,
    tuckedCount: instance.tucked.length,
    ...schemeTuckFields(state, id, null),
    art: artFor(card, { kind: "front" }),
    attachments: attachmentChipsOf(state, instance, deps),
    counters: countersOf(state, id),
  };
}

/** The tucked list and its words for a scheme panel (docs/phase7-wave10.md §3.15); the target is the engine's number. */
function schemeTuckFields(
  state: GameState,
  id: InstanceId,
  target: number | null,
): Pick<SchemePanel, "tucked" | "tuckedLabel" | "targetNote"> {
  const tucked = tuckedCardsUnder(state, id);
  if (tucked.length === 0) return { tucked, tuckedLabel: null, targetNote: null };
  const facedown = tucked.filter((card) => !card.faceup).length;
  const allAllies = tucked.every((card) => cardOf(state, card.instanceId)?.type === "ally");
  const tuckedLabel =
    facedown === tucked.length && allAllies
      ? `Defeated allies, facedown: ${facedown}`
      : `Under this scheme: ${tucked.length}${facedown > 0 ? `, ${facedown} facedown` : ""}`;
  return { tucked, tuckedLabel, targetNote: target === null ? null : `Target ${target}, ${tucked.length} under it` };
}

/**
 * `CardInstance.attachments`, as chips — shared by `characterPanel` and `schemePanel`: Odin attached to the main
 * scheme captive-side faceup (Hela, `mts` 21139a, docs/phase7-wave4.md §3.8) and Focused Defense attached to
 * whichever main scheme is active (Tower Defense, `mts` 21101, §3.2) are both scheme attachments, not character
 * ones, and used to be invisible for it — `SchemePanel` had no `attachments` field at all.
 */
function attachmentChipsOf(state: GameState, instance: CardInstance, deps: EngineDeps): readonly AttachmentChip[] {
  return instance.attachments.map((attachmentId): AttachmentChip => {
    const attachmentInstance = getInstance(state, attachmentId);
    const faceup = attachmentInstance?.faceup ?? true;
    return {
      instanceId: attachmentId,
      name: faceup
        ? (currentName(state, attachmentId) ?? cardOf(state, attachmentId)?.name ?? "Attachment")
        : "Facedown card",
      exhausted: attachmentInstance?.exhausted ?? false,
      counters: countersOf(state, attachmentId),
      damage: attachmentInstance?.damage ?? 0,
      // A facedown card's text is hidden, so its threshold is too.
      damageThreshold: faceup ? breakPointOf(state, attachmentId, deps) : null,
      faceup,
      ownedBy: ownedEncounterLabel(state, attachmentId, true),
      ...tuckFacts(state, attachmentId, deps),
      ...(faceup && Object.keys(counterGoalsOf(state, attachmentId, deps)).length > 0
        ? { counterGoals: counterGoalsOf(state, attachmentId, deps) }
        : {}),
    };
  });
}

/**
 * What a card holds under it against what it may hold (`tuckLimitOf`): the cards, the count, the engine's maximum and the
 * words for them. The client never counts room itself: a maximum is the engine's number or there is none.
 */
export function tuckFacts(
  state: GameState,
  id: InstanceId,
  deps: EngineDeps,
): Pick<AttachmentChip, "tucked" | "tuckedCount" | "tuckMax" | "tuckedNote"> {
  const tucked = tuckedCardsUnder(state, id);
  const tuckMax = tuckLimitOf(state, deps, id);
  return {
    tucked,
    tuckedCount: tucked.length,
    tuckMax,
    tuckedNote:
      tuckMax !== null ? `${tucked.length} of ${tuckMax} tucked` : tucked.length > 0 ? `${tucked.length} tucked` : null,
  };
}

/**
 * Every scenario area in play, by name, in a stable order (`Object.entries`' own insertion order — the order
 * `createScenarioArea` created them in, since `GameState.scenarioAreas` is a plain record built one
 * `EffectSpec createScenarioArea` at a time). Empty for every scenario that has none — `GameState.scenarioAreas`
 * is absent until a scenario's own Setup creates one, so this reads as `[]` rather than needing a special case at
 * every call site.
 */
/**
 * A named scenario deck (`GameState.scenarioDecks`, docs/phase7-wave2.md §3.3) — the Infinity Stone deck (`mts`
 * MC21 p. 16: every card printing the Infinity Stone trait, built from the encounter deck at setup with no card
 * text asking, docs/phase7-wave4.md §3.6). The board had no zone for one at all before this wave: the deck itself
 * is facedown like any encounter deck, and its own discard pile is separate from the encounter discard (a stone
 * that resolves its own Special boost text is placed "in the infinity stone deck discard pile" by name, not the
 * ordinary one).
 */
export interface ScenarioDeckPanel {
  readonly name: string;
  readonly deckCount: number;
  readonly discardCount: number;
  /**
   * False for a deck with no discard pile at all (`ScenarioDeckState.discardPile: "none"`, Spiral's show deck, MojoMania
   * insert p. 11): the board draws the deck and never a discard slot for it.
   */
  readonly hasDiscard: boolean;
  /** Faceup, like every discard pile (`view/visibility.ts`). Null with an empty pile. */
  readonly discardTopInstanceId: InstanceId | null;
  readonly discardTopArt: ArtSource | null;
}

/** Every scenario deck in play, by name, in `GameState.scenarioDecks`' own (insertion) order. */
export function scenarioDeckPanels(state: GameState): readonly ScenarioDeckPanel[] {
  return Object.entries(state.scenarioDecks ?? {}).map(([name, deck]) => {
    const topId = deck.discard[0] ?? null;
    return {
      name,
      deckCount: deck.deck.length,
      discardCount: deck.discard.length,
      hasDiscard: deck.discardPile !== "none",
      discardTopInstanceId: topId,
      discardTopArt: topId ? artFor(cardOf(state, topId), faceOf(state, topId)) : null,
    };
  });
}

/** `schemeIds` are the main schemes whose own text may set a limit; without `deps` no limit is read. */
export function scenarioAreaPanels(
  state: GameState,
  deps?: EngineDeps,
  schemeIds: readonly InstanceId[] = [state.mainScheme.instanceId],
): readonly ScenarioAreaPanel[] {
  const limits = deps ? scenarioAreaLimitsOf(state, schemeIds, deps) : {};
  return Object.entries(state.scenarioAreas ?? {}).map(([name, instanceIds]) => ({
    name,
    instanceIds,
    topArt: instanceIds[0] ? artFor(cardOf(state, instanceIds[0]), faceOf(state, instanceIds[0])) : null,
    count: instanceIds.length,
    limit: limits[name] ?? null,
  }));
}

/** The main scheme's panel with a line per scenario area (`SchemeAreaNote`); the panel as it was when there is none. */
function withAreaNotes(scheme: SchemePanel, areas: readonly ScenarioAreaPanel[]): SchemePanel {
  return areas.length === 0 ? scheme : { ...scheme, areaNotes: areas.map(schemeAreaNote) };
}

export function schemeAreaNote(area: ScenarioAreaPanel): SchemeAreaNote {
  return {
    name: area.name,
    count: area.count,
    limit: area.limit,
    instanceIds: area.instanceIds,
    caption: area.limit === null ? area.name : `${area.name} · lose at ${area.limit}`,
    urgent: area.limit !== null && area.count >= area.limit - 1,
  };
}

/** "3/5", or a bare "3" when nothing sets a limit: the count the scheme's strip and the pile tile show. */
export function scenarioAreaTag(area: { readonly count: number; readonly limit: number | null }): string {
  return area.limit === null ? String(area.count) : `${area.count}/${area.limit}`;
}

/**
 * Every in-play scenario area, in the order they were created, each with its cards in the order they entered it.
 * Built from `state.scenarioPlayAreas` alone; empty when the game has none.
 */
export function scenarioPlayAreaPanels(state: GameState, deps: EngineDeps): readonly ScenarioPlayAreaPanel[] {
  const neutralName = state.pod?.neutral?.area ?? null;
  return Object.entries(state.scenarioPlayAreas ?? {}).map(([name, area]) => {
    const cards = area.cards.map((id): ScenarioPlayAreaCard => {
      const neutral = name === neutralName ? neutralCard(state, id, deps) : null;
      if (neutral) return neutral;
      const panel = characterPanel(state, id, deps);
      const isScheme = cardOf(state, id)?.type === "side_scheme" || cardOf(state, id)?.type === "player_side_scheme";
      const scheme = isScheme ? schemePanel(state, id, deps, false) : null;
      return {
        instanceId: id,
        name: panel.name,
        subtitle: scheme?.subtitle ?? panel.subtitle,
        panel,
        scheme,
        threat: scheme?.threat ?? panel.threat,
        note: null,
      };
    });
    return { name, closed: area.closed, neutral: name === neutralName, cards, count: cards.length };
  });
}

/**
 * One of the pod's two neutral cards (docs/phase7-wave9.md §3.59, §3.66): Loki, God of Lies or Worlds Collide. Neither
 * is a `VillainState` or a `MainSchemeState`, and neither keeps its numbers on its own instance: the hit points and
 * the threat are the pod's shared record (`sharedVillain`, `sharedScheme`), so those are what the panels read. Null
 * for any other card.
 */
function neutralCard(state: GameState, id: InstanceId, deps: EngineDeps): ScenarioPlayAreaCard | null {
  const villain = sharedVillain(state);
  const scheme = sharedScheme(state);
  if (villain && villain.instanceId === id) {
    const base = characterPanel(state, id, deps);
    const remaining = Math.max(0, villain.remaining);
    const tiles: readonly StatTile[] = [{ label: "HP", value: hpFraction(remaining, villain.hp), bonus: 0 }];
    const panel: CharacterPanel = { ...base, hp: { current: remaining, max: villain.hp }, stats: tiles };
    return {
      instanceId: id,
      name: panel.name,
      subtitle: panel.subtitle,
      panel,
      scheme: null,
      threat: 0,
      note: villain.flipped
        ? "Flipped · defeat him to win"
        : villain.flipAtRemaining === null
          ? null
          : `Flips at ${villain.flipAtRemaining} left`,
    };
  }
  if (scheme && scheme.instanceId === id) {
    const card = cardOf(state, id);
    const instance = getInstance(state, id);
    const name = currentName(state, id) ?? card?.name ?? "Worlds Collide";
    const panel: SchemePanel = {
      instanceId: id,
      name,
      subtitle: "Neutral scheme",
      threat: scheme.threat,
      target: scheme.target,
      meterMax: scheme.target,
      isMain: true,
      crisis: false,
      accelerationTokens: 0,
      tuckedCount: instance?.tucked.length ?? 0,
      ...schemeTuckFields(state, id, null),
      art: artFor(card, faceOf(state, id)),
      attachments: instance ? attachmentChipsOf(state, instance, deps) : [],
      counters: countersOf(state, id),
    };
    return {
      instanceId: id,
      name,
      subtitle: panel.subtitle,
      panel: characterPanel(state, id, deps),
      scheme: panel,
      threat: scheme.threat,
      note:
        scheme.status === "schemeCompleted"
          ? "Complete · defeat Loki or lose"
          : scheme.status === "lost"
            ? "Complete · you lose"
            : `Lose at ${scheme.target} threat`,
    };
  }
  return null;
}

export function environmentPanel(state: GameState, id: InstanceId, deps: EngineDeps): EnvironmentPanel {
  const card = cardOf(state, id);
  const damage = getInstance(state, id)?.damage ?? 0;
  const note = damageNote(damage, breakPointOf(state, id, deps));
  const tucked = tuckedCardsUnder(state, id);
  const limits = counterLimitsOf(state, id, deps);
  const held = countersOf(state, id);
  const threat = threatOnCard(state, id);
  const goal = threatGoalOf(state, id, deps);
  const threatEntry =
    goal !== null || threat > 0
      ? [
          {
            name: "threat",
            count: threat,
            ...(goal ? { limit: goal.goal } : {}),
            ...(goal?.outcome === "loss" ? { danger: true as const } : {}),
          },
        ]
      : [];
  // "Lose at 4" / "Flips at 4" (the chip below says threat): the same number means a flip on one face and the game on the other.
  const goalNote =
    goal?.outcome === "loss" ? `Lose at ${goal.goal}` : goal?.outcome === "flip" ? `Flips at ${goal.goal}` : null;
  const counters = [
    ...threatEntry,
    ...held.map((counter) => (counter.name in limits ? { ...counter, limit: limits[counter.name]! } : counter)),
    ...Object.entries(limits)
      .filter(([name]) => !held.some((counter) => counter.name === name))
      .map(([name, limit]) => ({ name, count: 0, limit })),
  ];
  return {
    instanceId: id,
    // `currentName`, not `card.name`: a flipped card is a different card as far as the table is concerned.
    name: currentName(state, id) ?? card?.name ?? "Environment",
    // "Environment · 4/9 damage": Avengers Tower flips at 9[per_hero], and the table should see how close it is.
    subtitle: [goalNote ?? "Environment", note].filter((part) => part !== null).join(" · "),
    counters,
    art: artFor(card, faceOf(state, id)),
    damage,
    tucked,
    tuckedCount: tucked.length,
  };
}

/** The cards tucked under `id`, in order, faceup ones named and facedown ones only counted. */
export function tuckedCardsUnder(state: GameState, id: InstanceId): readonly TuckedCardView[] {
  return (getInstance(state, id)?.tucked ?? []).map((tuckedId) => {
    const faceup = getInstance(state, tuckedId)?.faceup !== false;
    const card = cardOf(state, tuckedId);
    return {
      instanceId: tuckedId,
      faceup,
      name: faceup ? (currentName(state, tuckedId) ?? card?.name ?? "Card") : "Facedown card",
      art: faceup ? artFor(card, faceOf(state, tuckedId)) : null,
    };
  });
}

/** Threat on a card that is not a scheme: a scheme's threat is its meter, drawn by `SchemePanel`. */
export function threatOnCard(state: GameState, id: InstanceId): number {
  const type = cardOf(state, id)?.type;
  if (type === undefined || type === "main_scheme" || type === "side_scheme") return 0;
  return Math.max(0, getInstance(state, id)?.threat ?? 0);
}

/** "2 threat" for a card holding threat, null at 0: the line the panel strip and Inspect both say. */
export function threatNote(threat: number): string | null {
  return threat > 0 ? `${threat} threat` : null;
}

/**
 * "3 ratings counters, 1 time counter": every counter kind on a card spelled out, so a bare "3 ratings" never has to
 * be read as a stat. Null when the card holds none.
 */
export function counterNote(
  counters: readonly { readonly name: string; readonly count: number }[],
  /** The count the card's own text waits for per kind (`counterGoalsOf`): "3 of 5 charm counters". */
  goals: Readonly<Record<string, number>> = {},
  /** The most the card may hold per kind (`counterLimitsOf`): "0/1 synergy counters (max)". */
  limits: Readonly<Record<string, number>> = {},
): string | null {
  const shown = [
    ...counters,
    ...Object.keys({ ...goals, ...limits })
      .filter((name) => !counters.some((counter) => counter.name === name))
      .map((name) => ({ name, count: 0 })),
  ];
  if (shown.length === 0) return null;
  return shown
    .map((counter) => {
      const goal = goals[counter.name];
      const limit = limits[counter.name];
      if (limit !== undefined && goal === undefined) return `${counter.count}/${limit} ${counter.name} counters (max)`;
      const noun = `${counter.name} counter${counter.count === 1 && goal === undefined ? "" : "s"}`;
      return goal === undefined ? `${counter.count} ${noun}` : `${counter.count} of ${goal} ${noun}`;
    })
    .join(", ");
}

/** The mission's internal mark of its own defeat, read by its back face; never shown. */
const INTERNAL_AREA_COUNTER = "defeated";

/** Every counter kind on a card, in a stable order, skipping kinds that have run to zero. */
export function countersOf(
  state: GameState,
  id: InstanceId,
): readonly { readonly name: string; readonly count: number }[] {
  // A mission carries an internal "defeated" mark its back face reads ("if the mission was defeated"); it is bookkeeping,
  // not a counter a player places or removes, so it is hidden on a card in a scenario play area. "attempt" is shown.
  const inArea = scenarioPlayAreaOf(state, id) !== null;
  return Object.entries(getInstance(state, id)?.counters ?? {})
    .filter(([name, count]) => count > 0 && !(inArea && name === INTERNAL_AREA_COUNTER))
    .map(([name, count]) => ({ name, count }));
}

export function handCardView(state: GameState, id: InstanceId, playerId: PlayerId, deps: EngineDeps): HandCardView {
  const card = cardOf(state, id);
  if (!card) {
    return {
      instanceId: id,
      name: "Unknown card",
      typeLine: "",
      cost: null,
      currentCost: null,
      costSources: [],
      countNote: null,
      rulesText: "",
      resourceIcons: [],
      art: null,
      from: null,
    };
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
    countNote: giftReaderNote(state, id, playerId, deps),
    // `current`, not `printed`: the errata'd wording is what the game plays by.
    rulesText: "text" in card ? card.text.current : "",
    // What it generates right now, not only printed icons: Band Together (`mts` 21018) prints none and generates a
    // [wild] per ally you control (docs/phase7-wave4.md §3.38).
    resourceIcons: resourceIconList(handCardResources(state, deps, id, playerId, null)),
    art: artFor(card, { kind: "front" }),
    from: null,
  };
}

/**
 * The cards this player may play from somewhere other than their hand (`playableOutsideHand`, `@mc/engine`), with
 * where each one is: attached to a card in play (Hawkeye's Quiver) or in their discard pile. Attached cards first, in
 * play order, then the discard from the top.
 */
function myDeckTopView(
  state: GameState,
  playerId: PlayerId,
  deps: EngineDeps,
  actions: LegalActions | null,
): DeckTopView | null {
  const top = shownTopOf(state, playerId, deps);
  if (top === null) return null;
  return { card: handCardView(state, top, playerId, deps), ...deckTopStatus(actions, top) };
}

function playableOutsideHandOf(
  state: GameState,
  playerId: PlayerId,
  deps: EngineDeps,
): readonly { readonly id: InstanceId; readonly from: string }[] {
  const player = state.players.find((seat) => seat.playerId === playerId);
  if (!player) return [];
  const attached = cardsInPlay(state).flatMap((host) =>
    (getInstance(state, host)?.attachments ?? [])
      .filter((id) => playableOutsideHand(state, deps, playerId, id))
      .map((id) => ({ id, from: `on ${cardOf(state, host)?.name ?? "a card in play"}` })),
  );
  const discard = player.discard
    .filter((id) => playableOutsideHand(state, deps, playerId, id))
    .map((id) => ({ id, from: "in your discard" }));
  return [...attached, ...discard];
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

function shownSeatTop(state: GameState, playerId: PlayerId, deps: EngineDeps): SeatRow["shownTop"] {
  const id = shownTopOf(state, playerId, deps);
  return id === null ? null : { instanceId: id, name: cardOf(state, id)?.name ?? "A card" };
}

export function seatRow(state: GameState, playerId: PlayerId, deps: EngineDeps): SeatRow {
  const player = getPlayer(state, playerId);
  if (!player) throw new Error(`no seat ${playerId}`);
  const identity = player.identity.instanceId;
  const current = dialValue(state, identity, remainingHitPoints(state, identity, deps));
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
    shownTop: shownSeatTop(state, playerId, deps),
    eliminated: player.eliminated,
    sittingOut: player.sittingOut === true,
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
      return ownerId !== null && ownerId !== playerId
        ? [`${cardOf(state, id)?.name ?? "a card"} · from ${playerName(state, ownerId)}`]
        : [];
    }),
    dealtFacedown: [...player.dealtEncounter],
  };
}

/** The keywords a card has that it does not print, worded as the table prints them ("Retaliate 1"). */
function grantedKeywordLabels(state: GameState, id: InstanceId, deps: EngineDeps): readonly string[] {
  const printed = new Set(printedKeywordsOf(state, id, deps).map(keywordLabel));
  return keywordsOf(state, id, deps)
    .map(keywordLabel)
    .filter((text) => !printed.has(text));
}
