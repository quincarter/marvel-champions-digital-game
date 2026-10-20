/**
 * The game log, built from the engine's `GameEvent` stream.
 *
 * The design canvas (Components.dc.html section 05) shows the log as numbered
 * beats with status tags inline, and struck through when a status is spent:
 *
 *     R3.2  You played Stun → STUNNED attached to Klaw.
 *     R3.5  Klaw's attack cancelled — STUNNED discarded.
 *     R3.5  She-Hulk took 0 damage — TOUGH spent.
 *
 * Most `GameEvent`s are bookkeeping the player should never read (stack frames,
 * timing windows, trigger announcements). `logLine` returns null for those, so
 * the log stays a readable account of the table rather than an engine trace.
 * The full trace is still in the session log for replay.
 */

import {
  activeVillain,
  cardOf,
  cardTypeName,
  getCard,
  getInstance,
  isOwnedEncounterCard,
  playerCardOwnerOf,
  tuckLimitOf,
  type EngineDeps,
  type GameEvent,
  type GameState,
  type InstanceId,
  type PlayerId,
} from "@mc/engine";
import { POOL_ENCOUNTER_SETS } from "../content/pool.js";
import { abilityShortLabelOf } from "./ability-label.js";
import { facedownRoleName, facedownUntilLater } from "./facedown-history.js";
import { foeWord } from "./foe-words.js";
import { cardName, faceUpName, formWords, optionLabelOf, playerName, seatName } from "./names.js";

/** A line that opens with a card named only as far as the table may see it ("a facedown card") starts with a capital. */
const cap = (text: string): string => text.charAt(0).toUpperCase() + text.slice(1);

export type StatusName = "stunned" | "confused" | "tough";

/** A status token rendered inside a line; `spent` draws it struck through. */
export interface LogTag {
  readonly status: StatusName;
  readonly spent: boolean;
}

/** Which side of the table the beat came from, for the line's ink treatment. */
export type LogVoice = "player" | "villain" | "scenario" | "win" | "loss";

export interface LogLine {
  /** Stable key for the virtualized list; never reused. */
  readonly id: string;
  /** The design's beat reference: round, then the beat's place in it. */
  readonly ref: string;
  readonly round: number;
  readonly text: string;
  readonly tags: readonly LogTag[];
  readonly voice: LogVoice;
}

export interface LogState {
  readonly lines: readonly LogLine[];
  /** Beats so far in the current round, for the `R3.5` reference. */
  readonly round: number;
  readonly beat: number;
  readonly nextId: number;
}

export const emptyLog = (): LogState => ({ lines: [], round: 0, beat: 0, nextId: 1 });

/** What a single event says, or null when it is engine bookkeeping. */
interface Beat {
  readonly text: string;
  readonly tags?: readonly LogTag[];
  readonly voice: LogVoice;
}

/** The id of the log's opening "Seed …" line (`withSeedLine`). */
export const SEED_LINE_ID = "line-seed";

/**
 * The log with its opening line naming the game's seed, for replaying a game exactly and for bug reports. Added once,
 * before anything else: a log that already has lines (or the seed line) is returned as it is.
 */
export function withSeedLine(log: LogState, seed: number): LogState {
  if (log.lines.length > 0) return log;
  const line: LogLine = {
    id: SEED_LINE_ID,
    ref: "SEED",
    round: 0,
    text: `Seed ${seed}. The same seed and the same moves replay this game exactly.`,
    tags: [],
    voice: "scenario",
  };
  return { ...log, lines: [line] };
}

/**
 * Folds a command's events onto the log. `state` is the state *after* the
 * command, which is what the client holds; names are resolved from its card
 * pool, so a card that left play is still named.
 */
export function appendEvents(
  log: LogState,
  events: readonly GameEvent[],
  state: GameState,
  perspectiveId: PlayerId | null,
  deps: EngineDeps,
  /** Caps the retained lines so the list never grows without bound. */
  limit = 400,
): LogState {
  let round = log.round;
  let beat = log.beat;
  let nextId = log.nextId;
  const lines = [...log.lines];
  let previous: GameEvent | undefined;

  for (const [at, event] of events.entries()) {
    if (event.type === "roundStarted") {
      round = event.round;
      beat = 0;
    }
    // A card moving into a scenario area only reads as a *redirect* ("instead of a discard pile") when it actually
    // was on its way to one: `leavePlay` emits `cardDiscardedFromPlay` right before the `cardMoved` it redirects
    // (engine `effects.ts`'s own comment, "The discard is still attempted ... so it is logged as one"). A plain move
    // into a scenario area — The Grand Collection's own Setup, Collector II/III's When Revealed — has no such event
    // in front of it, and calling that "instead of a discard pile" is simply wrong: nothing here was ever headed to
    // one.
    const redirected =
      event.type === "cardMoved" &&
      event.to.kind === "scenarioArea" &&
      previous?.type === "cardDiscardedFromPlay" &&
      previous.instanceId === event.instanceId;
    const described = describe(event, state, perspectiveId, deps, redirected, undefined, { events, at });
    previous = event;
    if (!described) continue;
    beat += 1;
    lines.push({
      id: `line-${nextId++}`,
      ref: `R${round}.${beat}`,
      round,
      text: lowerMidSentenceYou(described.text),
      tags: described.tags ?? [],
      voice: described.voice,
    });
  }

  return {
    lines: lines.length > limit ? lines.slice(lines.length - limit) : lines,
    round,
    beat,
    nextId,
  };
}

/**
 * Exposed for tests: one event's line, or null if it isn't player-readable. `redirected` is the one piece of
 * context that depends on the event before it in the same burst (`appendEvents`'s own lookback) — see that
 * function's comment on `cardMoved`/`discardRedirected`.
 */
export function logLine(
  event: GameEvent,
  state: GameState,
  perspectiveId: PlayerId | null,
  deps: EngineDeps,
  redirected = false,
  faceNames?: ReadonlyMap<InstanceId, string>,
  burst?: Burst,
): Beat | null {
  const beat = describe(event, state, perspectiveId, deps, redirected, faceNames, burst);
  return beat ? { ...beat, text: lowerMidSentenceYou(beat.text) } : beat;
}

/**
 * "Wrecker schemes against You." becomes "...against you.": the viewer's seat is named "You", which stays capital
 * only at the start of a sentence. A "You" after a lowercase word and a space is mid-sentence.
 */
export function lowerMidSentenceYou(text: string): string {
  return text.replace(/(?<=[a-z,;] )You\b/g, "you");
}

/** A beat's text with its status tags written as words, for a surface that draws no chips (the rail, the recap). */
export function beatTextWithStatus(beat: { readonly text: string; readonly tags?: readonly LogTag[] }): string {
  const tags = beat.tags ?? [];
  if (tags.length === 0 || /[.!]$/.test(beat.text)) return beat.text;
  return `${beat.text} ${tags.map((tag) => tag.status).join(" and ")}.`;
}

/**
 * A line as plain text, for a surface with no status chips (the setup log): the Board's log ends "Unus is" and draws a
 * STUNNED chip after it, so a surface without chips must say the word itself.
 */
export function plainLogLine(line: LogLine): LogLine {
  if (line.tags.length === 0 || /[.!]$/.test(line.text)) return { ...line, tags: [] };
  const words = line.tags.map((tag) => tag.status).join(" and ");
  return { ...line, text: `${line.text} ${words}.`, tags: [] };
}

/** True when an ability's effects hold a play the player must make (`playFromHand.mustPay`, owner rulings 62B and 63B). */
const mustPlayCardIn = (definition: unknown): boolean =>
  definition !== undefined && JSON.stringify(definition).includes('"mustPay":true');

/** The card is revealed next, before any step change or other move: it was parked, not dealt. */
function revealedAtOnce(burst: Burst, instanceId: InstanceId): boolean {
  for (let i = burst.at + 1; i < burst.events.length; i++) {
    const next = burst.events[i]!;
    if (next.type === "framePushed" || next.type === "framePopped" || next.type === "triggerEvent") continue;
    return next.type === "encounterCardRevealed" && next.instanceId === instanceId;
  }
  return false;
}

/**
 * The name a villain went by when `event` happened, when the same command swaps it for another card of its title
 * afterward (`villainReplaced`, reason `swap`: God of Lies's Avatars). The log is written from the state after the whole
 * command, where the instance already holds the new card, so without this "Loki the Wretch gets 5 shatter counters"
 * reads "Loki the Knave gets ..." (the counters were on the Wretch). A reveal is left alone: it names the card now up.
 */
function swappedOutName(state: GameState, id: InstanceId, event: GameEvent, burst: Burst | undefined): string | null {
  if (!burst || event.type === "encounterCardRevealed" || event.type === "villainReplaced") return null;
  for (let i = burst.at + 1; i < burst.events.length; i++) {
    const later = burst.events[i]!;
    if (later.type === "villainReplaced" && later.instanceId === id && later.reason === "swap") {
      return getCard(state, later.fromCardId)?.name ?? null;
    }
  }
  return null;
}

/** A facedown card's role, for a line about it before a later event in the command took it out of play (#291). */
function hiddenThenName(id: InstanceId, burst: Burst | undefined): string | null {
  const role = burst ? facedownUntilLater(burst.events, burst.at, id) : null;
  return role ? facedownRoleName(role) : null;
}

/** The command's whole event list and where `event` sits in it: a few lines read the events around them. */
export interface Burst {
  readonly events: readonly GameEvent[];
  readonly at: number;
}

function describe(
  event: GameEvent,
  state: GameState,
  viewer: PlayerId | null,
  deps: EngineDeps,
  redirected = false,
  faceNames?: ReadonlyMap<InstanceId, string>,
  burst?: Burst,
): Beat | null {
  const who = (id: PlayerId): string => seatName(state, id, viewer);
  /** "You draw" vs "Spider-Man draws": the second person takes no -s. */
  const verb = (id: PlayerId, plural: string, singular: string): string => (id === viewer ? plural : singular);
  /** "Your deck" vs "Spider-Man's deck": "you" possessive isn't "you's". */
  const possessive = (id: PlayerId): string => (id === viewer ? "Your" : `${who(id)}'s`);
  const card = (id: Parameters<typeof cardName>[1]): string =>
    faceNames?.get(id) ?? hiddenThenName(id, burst) ?? swappedOutName(state, id, event, burst) ?? cardName(state, id);

  switch (event.type) {
    case "roundStarted":
      return { text: `Round ${event.round} begins.`, voice: "scenario" };
    /**
     * Most `cardMoved`s are bookkeeping the player watches happen on the board
     * (a card sliding from hand to play). Dealt encounter cards are the
     * exception: RRG "Villain Phase" step 3 moves a card straight into a
     * facedown zone with no other event marking it, so without this case the
     * step produced zero beats and read as broken (the walkthrough showed
     * "Happening now" for every other step but this one).
     *
     * The card is never named here, even though `card()` would resolve to the
     * right name once revealed: this command usually runs step 4 (reveal)
     * right after step 3 in the same burst, so by the *final* state the card
     * may already be faceup in a new zone and `cardName` would say its name —
     * spoiling step 4's own reveal beat by answering it one step early. "A
     * facedown encounter card" is true regardless of what happens later in the
     * same command.
     */
    case "cardMoved":
      if (event.to.kind === "dealtEncounter") {
        // A card parked there from anywhere but an encounter deck (`revealCard`: MojoMania 1B's SHOW environment from
        // a set-aside set, a search, a discard pile) is not dealt to anyone: the reveal's own line follows.
        if (event.from.kind !== "encounterDeck" && event.from.kind !== "dealtEncounter") return null;
        // A reveal outside the villain phase (a setup reveal) parks the card there for a moment too, but is revealed at
        // once, with no step between: that is a reveal, not a deal, and the reveal's own line follows.
        if (burst && revealedAtOnce(burst, event.instanceId)) return null;
        return {
          text: `${who(event.to.playerId)} ${verb(event.to.playerId, "are", "is")} dealt a facedown encounter card.`,
          voice: "villain",
        };
      }
      // A card moving into a scenario area: a card that would have gone to a discard pile went there instead (The
      // Collector's redirect, docs/phase7-wave3.md §3.14) — otherwise silent: the card just vanishes from play with
      // nothing on the log explaining where it went, since it never touches a discard pile a player might think to
      // check. A plain move into the area (The Grand Collection's own Setup, Collector II/III's When Revealed) gets
      // its own, unrelated wording: it was never headed to a discard pile, so saying "instead of" one is wrong.
      if (event.to.kind === "scenarioArea") {
        return redirected
          ? {
              text: `${card(event.instanceId)} goes into ${event.to.name} instead of a discard pile.`,
              voice: "villain",
            }
          : { text: `${card(event.instanceId)} is put into ${event.to.name}.`, voice: "villain" };
      }
      // The mission area (wave 8 §3.33): in play, under no player's control. A move into it that the area's own
      // `scenarioPlayAreaEntered` already words (the event beside it) is left to that line.
      if (event.to.kind === "scenarioPlayArea") {
        if (event.from.kind === "scenarioPlayArea") {
          return {
            text: `${card(event.instanceId)} moves from the ${event.from.name} area to the ${event.to.name} area.`,
            voice: "villain",
          };
        }
        const worded = burst?.events.some(
          (other, at) =>
            other.type === "scenarioPlayAreaEntered" &&
            other.instanceId === event.instanceId &&
            Math.abs(at - burst.at) <= 2,
        );
        if (worded) return null;
        return { text: `${card(event.instanceId)} is put into the ${event.to.name} area.`, voice: "villain" };
      }
      if (event.from.kind === "scenarioPlayArea") {
        return { text: `${card(event.instanceId)} leaves the ${event.from.name} area.`, voice: "villain" };
      }
      // docs/phase7-wave10.md §3.15: a defeated ally goes facedown under the main scheme. Seen when it was defeated.
      if (
        event.to.kind === "tucked" &&
        burst?.events.some((other) => other.type === "characterDefeated" && other.instanceId === event.instanceId)
      ) {
        return {
          text: `${cardOf(state, event.instanceId)?.name ?? "A card"} was defeated and placed facedown under ${faceUpName(state, event.to.hostInstanceId)}.`,
          voice: "villain",
        };
      }
      // docs/phase7-wave10-hero-packs.md H3.12 (Ionic Physiology): a card tucked under another card, and one leaving
      // from under it (the basic attack discards them). A defeated ally's tuck is worded above; a spent tucked card
      // has its own line (`tuckedCardSpent`).
      if (
        event.to.kind === "tucked" &&
        event.from.kind !== "tucked" &&
        !burst?.events.some((other) => other.type === "cardNotTucked" && other.instanceId === event.instanceId)
      ) {
        return {
          text: cap(`${card(event.instanceId)} is tucked under ${faceUpName(state, event.to.hostInstanceId)}.`),
          voice: "player",
        };
      }
      if (
        event.from.kind === "tucked" &&
        event.to.kind === "discard" &&
        !burst?.events.some((other) => other.type === "tuckedCardSpent" && other.instanceId === event.instanceId)
      ) {
        return {
          text: cap(
            `${card(event.instanceId)} is discarded from under ${faceUpName(state, event.from.hostInstanceId)}.`,
          ),
          voice: "player",
        };
      }
      // A Labor card (an encounter card a player owns, H3.1) that is defeated or completed reaches the victory display.
      if (event.to.kind === "victoryDisplay" && isOwnedEncounterCard(state, event.instanceId)) {
        return { text: cap(`${card(event.instanceId)} goes to the victory display.`), voice: "player" };
      }
      // A minion a card held (Thunderbolt Backup's end-of-round swap) comes off it and engages a player: the engine
      // records only the move, so without this line the swap read as one minion being held and nothing else.
      if (
        event.from.kind === "attachment" &&
        event.to.kind === "playArea" &&
        cardOf(state, event.instanceId)?.type === "minion" &&
        !burst?.events.some((other) => other.type === "cardDetached" && other.instanceId === event.instanceId)
      ) {
        return {
          text: `${card(event.instanceId)} leaves ${faceUpName(state, event.from.hostInstanceId)} and engages ${who(event.to.playerId)}.`,
          voice: "villain",
        };
      }
      return null;
    // A set-aside modular set joining the deck (Mojo's 1B, The Hood): which one, since the board only shows a deck grow.
    case "setAsideModularSetShuffledIn":
      return {
        text:
          event.placement === "shuffledOnTop"
            ? `The set-aside ${setLabel(event.encounterSetId)} set is shuffled and placed on top of the encounter deck.`
            : `The set-aside ${setLabel(event.encounterSetId)} set is shuffled into the encounter deck.`,
        voice: "scenario",
      };
    case "villainAdded":
      return {
        text: `${card(event.instanceId)} joins the fight as another ${foeWord(cardOf(state, event.instanceId), { lower: true })}.`,
        voice: "villain",
      };
    case "villainRemoved":
      return { text: `${card(event.instanceId)} leaves the game.`, voice: "villain" };
    case "villainSetAside":
      return { text: `${card(event.instanceId)} is set aside.`, voice: "villain" };
    case "villainReplaced":
      return {
        text:
          event.reason === "swap"
            ? `${getCard(state, event.fromCardId)?.name ?? `The ${foeWord(getCard(state, event.fromCardId), { lower: true })}`} swaps to ${getCard(state, event.toCardId)?.name ?? "another card"}.`
            : `${getCard(state, event.toCardId)?.name ?? `Another ${foeWord(getCard(state, event.toCardId), { lower: true })}`} takes the place of ${getCard(state, event.fromCardId)?.name ?? `the defeated ${foeWord(getCard(state, event.fromCardId), { lower: true })}`}.`,
        voice: "villain",
      };
    case "scenarioDeckReset":
      return { text: `${event.name} was empty: its discard pile is shuffled back into it.`, voice: "scenario" };
    case "separateDeckReset":
      return {
        text: `${possessive(event.playerId)} ${event.name} deck was empty: its discard pile is shuffled back into it.`,
        voice: "player",
      };
    // RRG 1.8 FAQ "Hercules Hero Pack - Labor Cards" (p. 65): a revealed attachment that found nothing to attach to.
    case "revealedCardDiscarded":
      return {
        text: cap(
          `${card(event.instanceId)} had nothing to attach to when ${who(event.playerId)} revealed it, so it is discarded.`,
        ),
        voice: "villain",
      };
    // docs/phase7-wave10-box-heroes.md B3.1 (Hunted): the board shows nothing change for the upgrade, so say why.
    case "playedUpgradeHasNoHost":
      return {
        text: cap(`${card(event.instanceId)} has nothing to attach to, so it is discarded. What was paid stays paid.`),
        voice: "player",
      };
    // docs/phase7-wave10-hero-packs.md H3.12: "Max 3 cards tucked here."
    case "cardNotTucked": {
      const limit = tuckLimitOf(state, deps, event.hostInstanceId);
      return {
        text: cap(
          `${card(event.instanceId)} is not tucked under ${faceUpName(state, event.hostInstanceId)}: it holds ${limit === null ? "no more" : `at most ${limit}`}.`,
        ),
        voice: "player",
      };
    }
    // RRG 1.8 "Interrupt" (p. 25): the damage changed under it, so it does not initiate (owner decision 29B).
    case "interruptConditionLapsed":
      return {
        text: cap(`${card(event.instanceId)}'s interrupt does not resolve: the damage it was to answer has changed.`),
        voice: "player",
      };
    // docs/phase7-wave10-box-heroes.md B3.3 (Skrull Business): taken away from the discard, still counted as discarded.
    case "deckDiscardStillCounted":
      return {
        text:
          event.takenByInstanceId === null
            ? cap(`${card(event.instanceId)} was taken from the discard pile and still counts as discarded.`)
            : cap(
                `${card(event.instanceId)} was taken by ${card(event.takenByInstanceId)} and still counts as discarded.`,
              ),
        voice: "player",
      };
    case "returnedToSeparateDeck":
      return {
        text: `${card(event.instanceId)} goes back into ${possessive(event.playerId)} ${event.name} deck, facedown, instead of leaving it.`,
        voice: "player",
      };
    case "attackRetargeted":
      return {
        text: `${card(event.enemyInstanceId)}'s attack now targets ${card(event.targetInstanceId)}.`,
        voice: "villain",
      };
    case "accelerationTokenRedirected":
      return {
        text: `The acceleration token goes on ${card(event.to)} instead of ${card(event.from)}.`,
        voice: "villain",
      };
    case "turnStarted":
      return { text: `${who(event.playerId)} ${verb(event.playerId, "take", "takes")} a turn.`, voice: "player" };
    case "formChanged":
      return {
        text: `${who(event.playerId)} ${event.byEffect ? verb(event.playerId, "were flipped", "was flipped") : "flipped"} to ${event.to === "hero" ? "hero" : "alter-ego"} form.`,
        voice: "player",
      };
    case "cardPlayed":
      return {
        text: `${who(event.playerId)} played ${card(event.instanceId)}${event.resourcesPaid > 0 ? ` for ${event.resourcesPaid}` : ""}.`,
        voice: "player",
      };
    // Star-Lord's "What could go wrong?" and its own shape of ability (docs/phase7-wave3.md §3.20): the reduction
    // is named on the play itself, not offered in the printed Interrupt's own window, so without a line here a
    // card costing less than it should looked unexplained — `cardPlayed`'s own "for N" already shows the reduced
    // price, but not why.
    case "playCostReduced":
      return {
        text: `${card(event.instanceId)} reduces the cost of ${card(event.cardInstanceId)} by ${event.amount}.`,
        voice: "player",
      };
    case "damageDealt": {
      // An ally's consequential damage (RRG 1.8 "Consequential Damage", p. 13) is dealt to it by itself, right after
      // its own attack or thwart. The event carries no flag for it, so it is read from what the ally just did in this
      // command; self-damage with no such attack or thwart before it stays "from" itself.
      const selfDealt = event.sourceInstanceId !== null && event.sourceInstanceId === event.targetInstanceId;
      const doing = selfDealt ? whatItJustDid(burst, event.targetInstanceId) : null;
      if (doing) {
        return {
          text: `${card(event.targetInstanceId)} took ${event.amount} consequential damage for ${doing}.`,
          voice: "player",
        };
      }
      return {
        text: `${card(event.targetInstanceId)} took ${event.amount} damage${event.sourceInstanceId ? ` from ${selfDealt ? "itself" : card(event.sourceInstanceId)}` : ""}.`,
        voice: "player",
      };
    }
    case "damagePrevented":
      return {
        text: `${card(event.targetInstanceId)} took 0 damage.`,
        // "Tough" is the only prevention with a token to strike through.
        ...(event.reason === "tough" ? { tags: [{ status: "tough", spent: true } as const] } : {}),
        voice: "player",
      };
    case "damageHealed":
      return { text: `${card(event.targetInstanceId)} healed ${event.amount} damage.`, voice: "player" };
    // A tough status card has timing priority over every other interrupt that would otherwise fire first
    // (docs/phase7-wave3.md §3.12) — logged only when some other interrupt was actually waiting, so the ordinary
    // "took 0 damage — TOUGH spent" line stays the whole story the rest of the time.
    // docs/phase7-wave6.md §3.12: the board shows no change, so say why the heal did nothing.
    case "healBlocked":
      return {
        text: `${card(event.targetInstanceId)} can't be healed${event.sourceInstanceId ? ` by ${card(event.sourceInstanceId)}` : ""}.`,
        voice: "scenario",
      };
    // §3.3: a cap on sustained damage, not a prevention.
    case "damageCapped":
      return {
        text: `${card(event.targetInstanceId)} can't take more damage — ${event.amount} not taken.`,
        voice: "scenario",
      };
    // An interrupt lowered the damage dealt (Metal Bracer; ruling August 26, 2026 - Ruling 2), not a prevention.
    case "damageReduced":
      return { text: `Damage to ${card(event.targetInstanceId)} reduced by ${event.amount}.`, voice: "player" };
    // docs/phase7-wave11-scenarios.md §S3.5: "cannot be dealt damage", so none was dealt (not a prevention).
    case "damageNotDealt":
      return {
        text: `${card(event.targetInstanceId)} can't be dealt damage — ${event.amount} not dealt.`,
        voice: "scenario",
      };
    // §3.68: say why the damage is more than was dealt.
    case "damageDoubled":
      return {
        text: `Damage to ${card(event.targetInstanceId)} is doubled — ${event.from} becomes ${event.to}.`,
        voice: "scenario",
      };
    // §3.15: an activation that dealt no boost card, so a missing boost isn't read as a bug.
    case "boostWithheld":
      return {
        text: `No boost card is dealt for ${card(event.enemyInstanceId)}'s ${event.activation}.`,
        voice: "villain",
      };
    // §3.34: the activation never began.
    case "activationBlocked":
      return {
        text: `${card(event.enemyInstanceId)} can't ${event.activation === "attack" ? "attack" : "scheme"}.`,
        voice: "villain",
      };
    case "consequentialDamageModified":
      return {
        text: `${card(event.instanceId)}'s consequential damage changes from ${event.from} to ${event.to}.`,
        voice: "player",
      };
    // §3.18: the order is for the replay log only; never name a stage here.
    case "mainSchemeStagesShuffled":
      return { text: `The main scheme stages are shuffled.`, voice: "scenario" };
    case "mainSchemeStageToVictoryDisplay":
      return {
        text: `${card(event.schemeInstanceId)}'s stage ${event.stageIndex + 1} goes to the victory display.`,
        voice: "player",
      };
    // docs/phase7-wave6.md §3.69: "any number of …" - say what was chosen, so the effect that follows reads.
    case "numberChosen":
      return {
        text: `${who(event.playerId)} ${verb(event.playerId, "choose", "chooses")} ${event.amount}.`,
        voice: "player",
      };
    // docs/phase7-wave7.md §3.33: "choose a card type" - the type the rest of the ability reads.
    case "cardTypeChosen":
      return {
        text: `${who(event.playerId)} chose the card type ${cardTypeName(event.cardType)}.`,
        voice: "player",
      };
    // docs/phase7-wave7.md §3.83: a reported fact from outside the game - the number the next effect reads.
    case "factReported": {
      const minutes = `${event.amount} ${event.amount === 1 ? "minute" : "minutes"}`;
      return {
        text:
          event.fact === "minutesAway"
            ? `${who(event.playerId)} ${verb(event.playerId, "were", "was")} away for ${minutes}.`
            : `${who(event.playerId)} ${event.amount === 1 ? "talked" : "did not talk"} this phase.`,
        voice: "player",
      };
    }
    // docs/phase7-wave7.md §3.81: the found card is not named; where it goes (facedown or not) is the next effect's.
    case "cardAddedFromCollection":
      return {
        text: `${who(event.ownerId)} ${verb(event.ownerId, "add", "adds")} a card from ${verb(event.ownerId, "your", "their")} collection.`,
        voice: "player",
      };
    // §3.66: the board shows no change, so say why the card's ability did nothing.
    case "scenarioDeckClosed":
      return {
        text: `${event.name} is closed to player card effects — ${getCard(state, event.sourceCardId)?.name ?? "a card"} has no effect on it.`,
        voice: "scenario",
      };
    case "interruptsPreempted":
      return { text: `Toughness has interrupt priority — no other interrupt fires first.`, voice: "scenario" };
    case "threatPlaced": {
      // Issue 182: Security Cameras on an exhausted character places the threat with no prompt, and a bare "2 threat
      // placed on Alert Level." reads as threat from nowhere.
      const forced = onlyOptionBefore(burst);
      const why =
        forced === undefined
          ? ""
          : forced === null
            ? " (the only option left)"
            : ` (the only option left for ${card(forced)})`;
      return { text: `${event.amount} threat placed on ${card(event.schemeInstanceId)}${why}.`, voice: "scenario" };
    }
    case "threatRemoved":
      return { text: `${event.amount} threat removed from ${card(event.schemeInstanceId)}.`, voice: "player" };
    case "threatRemovalBlocked":
      return {
        text: `Threat can't be removed from ${card(event.schemeInstanceId)} — ${event.reason === "crisis" ? "Crisis" : event.reason === "patrol" ? "Patrol" : "a rule"}.`,
        voice: "scenario",
      };
    /**
     * Worth a line for the same reason `threatRemovalBlocked` is: the board
     * shows no change, so without it a card that refused to enter play reads as
     * a bug. RRG 1.8 "Unique Icon" gives the two dispositions — a player card's
     * effect simply has no effect, a non-villain encounter card is discarded.
     */
    case "uniqueEntryBlocked": {
      // Both cards usually carry the same title, so each is named by its type ("the Proxima Midnight minion",
      // "the villain Proxima Midnight") and the reason is said in a few words (RRG 1.8 "Unique", pp. 45-46).
      // A blocked flip names the face that could not enter (`event.cardId`), not the card still showing its old one.
      const face = getCard(state, event.cardId);
      const flipped = face !== undefined && getInstance(state, event.instanceId)?.cardId !== event.cardId;
      const blocked = face?.name ?? card(event.instanceId);
      const blockedType = face ? face.type.replace(/_/g, " ") : typeWord(state, event.instanceId);
      const matchedType = typeWord(state, event.matchedInstanceId);
      const inPlay =
        blockedType === matchedType && blocked === card(event.matchedInstanceId)
          ? "another is already in play"
          : `the ${matchedType} ${card(event.matchedInstanceId)} is in play`;
      const subject = /^the /i.test(blocked) ? `${blocked} ${blockedType}` : `The ${blocked} ${blockedType}`;
      if (flipped) {
        const before = card(event.instanceId);
        return {
          text:
            event.disposition === "discarded"
              ? `${before} can't flip to ${subject}, so it is discarded: unique, and ${inPlay}.`
              : `${before} can't flip to ${subject}: unique, and ${inPlay}.`,
          voice: event.disposition === "discarded" ? "scenario" : "player",
        };
      }
      return {
        text:
          event.disposition === "discarded"
            ? `${subject} is discarded: unique, and ${inPlay}.`
            : `${subject} has no effect: unique, and ${inPlay}.`,
        voice: event.disposition === "discarded" ? "scenario" : "player",
      };
    }
    // An upgrade put into play with no legal host stays where it was (RRG 1.8 "Attach To", p. 8).
    case "putIntoPlayRefused":
      if (event.reason === "cannotEnterPlay")
        return { text: `${card(event.instanceId)} cannot enter play during this game.`, voice: "player" };
      if (event.reason === "noSuchArea")
        return { text: `${card(event.instanceId)} stays where it was: there is no such area.`, voice: "player" };
      if (event.reason === "cardType")
        return {
          text: `${card(event.instanceId)} stays where it was: that kind of card can't go there.`,
          voice: "player",
        };
      // RRG 1.8 "Max, Maximum" (p. 28): no one can take control of another copy of a "Max 1 per player" card.
      if (event.reason === "maxPerPlayer")
        return {
          text: `${card(event.instanceId)} stays where it was: no one can control another copy (max per player).`,
          voice: "player",
        };
      return { text: `${card(event.instanceId)} has nothing to attach to and stays where it was.`, voice: "player" };
    case "statusGiven":
      return { text: `${card(event.instanceId)} is`, tags: [{ status: event.status, spent: false }], voice: "player" };
    case "statusRemoved":
      return {
        text: statusRemovedText(event.reason, card(event.instanceId)),
        tags: [{ status: event.status, spent: true }],
        voice: event.reason === "cancelledAttack" || event.reason === "cancelledSchemeOrThwart" ? "villain" : "player",
      };
    case "enemyActivated":
      return {
        text: `${card(event.enemyInstanceId)} ${event.activation === "attack" ? "attacks" : "schemes against"} ${who(event.playerId)}.`,
        voice: "villain",
      };
    case "boostCardFlipped":
      return {
        text: `Boost: ${event.boostIcons} icon${event.boostIcons === 1 ? "" : "s"} for ${card(event.enemyInstanceId)}.`,
        voice: "villain",
      };
    // docs/phase7-wave11-scenarios.md §S3.7: a villainous ally or hero turns up its boost card as its basic power
    // resolves; the icons go to the stat powering that use.
    case "characterBoostCardFlipped":
      return {
        text: `Villainous: ${card(event.characterInstanceId)} turns up ${card(event.instanceId)}, ${event.boostIcons} boost icon${event.boostIcons === 1 ? "" : "s"} to ${event.stat.toUpperCase()}.`,
        voice: "scenario",
      };
    // A player card (Attacrobatics, Target Acquired) cancelling all or part of a just-flipped boost card
    // (RRG 1.8 "Boost", p. 11) — worded so the villain-phase breakdown can show it beside the boost card itself.
    case "boostCancelled":
      return {
        text:
          event.scope === "ability"
            ? `${card(event.instanceId)}'s Boost ability is cancelled.`
            : event.scope === "discarded"
              ? `${card(event.instanceId)} is discarded instead of being turned faceup.`
              : `${card(event.instanceId)}'s boost icons are cancelled.`,
        voice: "player",
      };
    case "defenderDeclared":
      // A card ability declared the defender (`byEffect`): no exhaustion or choice is implied, so it is not "defends".
      return {
        text: event.byEffect
          ? `${card(event.defenderInstanceId)} is declared the defender against ${card(event.attackInstanceId)}.`
          : `${card(event.defenderInstanceId)} defends${event.withoutExhausting ? " without exhausting" : ""}.`,
        voice: "player",
      };
    case "defenseDeclined":
      // By name once there is more than one seat: a line baked in under one seat's perspective would otherwise read
      // "You did not defend" to the seat that was not even attacked.
      return {
        text: `${state.players.length > 1 ? playerName(state, event.playerId) : who(event.playerId)} did not defend.`,
        voice: "player",
      };
    // Psychic Misdirection (`modifyAttack.damageTo`, docs/phase7-wave6.md §3.36): the whole amount lands on another
    // enemy, and the attacked character takes none.
    case "attackResolved":
      // Determined Defense (`modifyAttack.removesThreatFrom`): no damage, threat comes off a scheme instead. The
      // `thwart` / `removeThreat` event that follows says how much really came off (a crisis icon can stop it).
      if (event.removesThreatFrom !== undefined) {
        const amount = event.threatInstead ?? 0;
        return {
          text: `${card(event.enemyInstanceId)} attacked ${card(event.targetInstanceId)}, but removed ${amount} threat from ${card(event.removesThreatFrom)} instead of dealing damage (ATK ${event.baseAtk} + ${event.boostIcons} boost − ${event.defenseReduction} defense).`,
          voice: "villain",
        };
      }
      return {
        text: `${card(event.enemyInstanceId)} hit ${card(event.damageTo ?? event.targetInstanceId)} for ${event.damageDealt}${event.damageTo ? ` instead of ${card(event.targetInstanceId)}` : ""} (ATK ${event.baseAtk} + ${event.boostIcons} boost − ${event.defenseReduction} defense).`,
        voice: "villain",
      };
    // Moondragon's "that minion attacks another enemy of your choice" (docs/phase7-wave3.md §3.23) — an enemy
    // attacking a different enemy, rather than a player, which nothing else on the board shows happening.
    case "enemyAttackedEnemy":
      return {
        text: event.skipped
          ? `${card(event.attackerInstanceId)}'s attack on ${card(event.targetInstanceId)} doesn't happen — ${enemyAttackSkipReason(event.skipped)}.`
          : `${card(event.attackerInstanceId)} attacks ${card(event.targetInstanceId)} for ${event.damageDealt}.`,
        voice: "villain",
      };
    // A player's attack whose attacker left play first (Speed Demon's attack defeating the attacking ally;
    // docs/phase7-wave4.md §4 Q20): without this line the attack silently does nothing.
    case "playerAttackEnded":
      return {
        text: `${card(event.attackerInstanceId)}'s attack on ${card(event.targetInstanceId)} ends — ${card(event.reason === "targetLeftPlay" ? event.targetInstanceId : event.attackerInstanceId)} left play first.`,
        voice: "player",
      };
    // An "(attack)" ability's damage instruction skipped an enemy its player cannot attack (guard): without this line
    // the villain silently takes none of "each enemy"'s damage.
    case "attackTargetSkipped":
      // Owner decision, 2026-10-08 (docs/phase7-wave8.md §4.1 row 65): the enemy could be attacked, but the attack was
      // canceled, so the instruction's damage to it isn't dealt. Not "can't attack": that is the guard reading below.
      if (event.reason === "attackCancelled") {
        return {
          text: `${card(event.attackerInstanceId)}'s attack on ${card(event.targetInstanceId)} was canceled, so it takes no damage.`,
          voice: "player",
        };
      }
      // An attack ability that moved to a new target (A.I.M. Grunt's Preparation): the other targets aren't attacked.
      if (event.reason === "attackRetargeted") {
        return {
          text: `${card(event.attackerInstanceId)}'s attack moved to another target, so ${card(event.targetInstanceId)} takes no damage.`,
          voice: "player",
        };
      }
      return {
        text: `${card(event.attackerInstanceId)} can't attack ${card(event.targetInstanceId)}, so it takes no damage from that attack.`,
        voice: "player",
      };
    // Bookkeeping: the attack's own damage line and its "after the attack" lines say everything a player reads.
    case "attackAwaitsAbility":
      return null;
    // An "(attack)" ability's damage instruction took over the attack its ability began (the attack takes its target
    // and amount now); the damage itself has its own line right after.
    case "attackResumed":
      return {
        text: `${card(event.attackerInstanceId)} attacks ${card(event.targetInstanceId)} for ${event.amount}${
          event.keywords.length > 0 ? ` (${event.keywords.join(", ")})` : ""
        }.`,
        voice: "player",
      };
    // The scheme half of the same breakdown, worded the same way. The third term only appears when something actually
    // changed the threat ("reduce the amount of threat placed … by 1"); an attack always has a defense term, a scheme
    // has no equivalent that is always present.
    case "schemeResolved":
      // Part of the total went on another card (`enemyScheme.divert`): its own `threatPlaced` line comes first.
      if (event.diverted) {
        return {
          text: `${card(event.enemyInstanceId)} schemed: ${event.diverted.amount} threat goes on ${card(event.diverted.toInstanceId)}, ${event.threatPlaced} on ${card(event.schemeInstanceId)}.`,
          voice: "villain",
        };
      }
      // Psychic Manipulation (`modifyAttack.removesThreat`, §3.35): the total comes off the scheme instead of going on.
      if (event.removesThreat) {
        const total = Math.max(0, event.baseSch + event.boostIcons + event.threatBonus);
        return {
          text: `${card(event.enemyInstanceId)} schemed, but removed ${total} threat from ${card(event.schemeInstanceId)} instead of placing it.`,
          voice: "player",
        };
      }
      return {
        text: `${card(event.enemyInstanceId)} schemed for ${event.threatPlaced} threat on ${card(event.schemeInstanceId)} (SCH ${event.baseSch} + ${event.boostIcons} boost${event.threatBonus === 0 ? "" : ` ${event.threatBonus < 0 ? "−" : "+"} ${Math.abs(event.threatBonus)} threat`}).`,
        voice: "villain",
      };
    case "characterDefeated":
      return { text: `${card(event.instanceId)} was defeated.`, voice: "player" };
    case "schemeDefeated":
      return { text: `${card(event.instanceId)} was cleared.`, voice: "player" };
    case "villainStageAdvanced":
      return {
        text: `The ${foeWord(cardOf(state, event.instanceId), { lower: true })} advances to stage ${event.stageIndex + 1}.`,
        voice: "villain",
      };
    // The Wrecking Crew's active counter moving to another villain (`state.activeVillainId`) is otherwise silent —
    // no damage, threat or status marks it — so without a line here the board's other three panels lit up ACTIVE
    // for no reason the log ever gave.
    case "activeVillainChanged":
      return {
        text:
          event.reason === "nextInRow"
            ? `The active counter moves along the row to ${card(event.to)}.`
            : `The active ${foeWord(cardOf(state, event.to), { lower: true })} is now ${card(event.to)}.`,
        voice: "villain",
      };
    // The Collector flipping between its finite front and ∞ back (docs/phase7-wave3.md §3.1) — `hitPointsReset`
    // is present on that flip and on Risky Business's Green Goblin (whose own two faces both reset the dial), so
    // it names what actually happens to the hit point dial rather than leaving the player to infer it from the
    // panel alone. A flip between two ordinary faces that *keeps* its damage (Risky Business's Norman Osborn) has
    // nothing extra to say.
    case "villainFlipped":
      // An Avatar of Loki that would be defeated flips to its Fading Figment (the pod's neutral cards are in play).
      if (state.pod?.neutral && event.from === "A" && event.to === "B")
        return { text: "An Avatar of Loki would be defeated: it flips to a Fading Figment.", voice: "villain" };
      return {
        text: `${card(event.instanceId)} flips${event.hitPointsReset ? ", hit points reset," : ""} to side ${event.to}.`,
        voice: "villain",
      };
    // docs/phase7-wave11-scenarios.md §S3.4: the face a villain is put into play on (Disturbed Psyche's Setup). Not a
    // flip, so it reads as where the villain starts.
    case "villainSideSet":
      return {
        text: `${card(event.instanceId)} starts on side ${event.to}${event.random ? " (drawn at random)" : ""}.`,
        voice: "villain",
      };
    // A card the first player controls followed the token to a new seat (the Milano, docs/phase7-wave3.md §3.13) —
    // otherwise silent, since nothing about the card's own state changes, only who may use its ability. The
    // engine's own `reason` is always "firstPlayer" today, so the line states that plainly rather than branching
    // on a value that has only ever had one shape.
    case "controllerChanged":
      return { text: `${card(event.instanceId)} now follows the first player, ${who(event.to)}.`, voice: "scenario" };
    case "mainSchemeAdvanced": {
      // The stage's printed number: its index is not that on a card holding several stages of one number, or when the
      // main scheme deck is chosen stages of the card (docs/phase7-wave10.md §3.2).
      const scheme = cardOf(state, event.schemeInstanceId ?? state.mainScheme.instanceId);
      const printed = scheme?.type === "main_scheme" ? scheme.stages[event.stageIndex]?.stageNumber : undefined;
      return { text: `The main scheme advances to stage ${printed ?? event.stageIndex + 1}.`, voice: "villain" };
    }
    case "mainSchemeCompleted":
      return { text: `The main scheme is complete.`, voice: "loss" };
    // docs/phase7-wave10.md §3.2: the stages picked for this game, by name, in the order they are played.
    case "mainSchemeStagesChosen": {
      const scheme = cardOf(state, event.schemeInstanceId);
      const stages = scheme?.type === "main_scheme" ? scheme.stages : [];
      const names = event.order.map(
        (index) => stages[index]?.name ?? `stage ${stages[index]?.stageNumber ?? index + 1}`,
      );
      return { text: `Main scheme stages for this game: ${names.join(", then ")}.`, voice: "scenario" };
    }
    // docs/phase7-wave11-scenarios.md §S3.1: a main scheme per player, each in its play area.
    case "mainSchemesChosen": {
      const picks = event.picks.map((pick) => `${who(pick.playerId)}: ${card(pick.schemeInstanceId)}`);
      const random = event.picks.some((pick) => pick.random) ? " (drawn at random)" : "";
      return { text: `Main schemes for this game${random}: ${picks.join("; ")}.`, voice: "scenario" };
    }
    // docs/phase7-wave10.md §3.19 (MC56 p. 20): a permanent attachment (Cap's Shield) whose holder left play moves on.
    case "permanentAttachmentRehosted":
      return {
        text:
          event.fromInstanceId === null
            ? `${card(event.instanceId)} is attached to ${faceUpName(state, event.hostInstanceId)}.`
            : `${card(event.instanceId)} moves from ${faceUpName(state, event.fromInstanceId)} to ${faceUpName(state, event.hostInstanceId)}.`,
        voice: "villain",
      };
    // docs/phase7-wave10.md §3.10: a defeated minion given to a foe as a facedown boost card. It was seen when it was
    // defeated, so its name is said; a boost card dealt from a deck is never named.
    case "boostCardDealt": {
      if (!event.outsideActivation) return null;
      const seen = burst?.events.some(
        (other) => other.type === "characterDefeated" && other.instanceId === event.instanceId,
      );
      return {
        text: seen
          ? `${cardOf(state, event.instanceId)?.name ?? "A card"} was given to ${faceUpName(state, event.enemyInstanceId)} as a facedown boost card.`
          : `${faceUpName(state, event.enemyInstanceId)} was dealt a facedown boost card.`,
        voice: "scenario",
      };
    }
    case "encounterCardRevealed": {
      // A Labor card is an encounter card its owner's identity holds in a separate deck (H3.1): say which deck.
      const owned = getInstance(state, event.instanceId);
      if (isOwnedEncounterCard(state, event.instanceId) && owned?.home.kind === "separateDeck" && owned.ownerId) {
        return {
          text: `${who(event.playerId)} revealed ${card(event.instanceId)} from ${owned.ownerId === viewer ? "your" : `${who(owned.ownerId)}'s`} ${owned.home.name} deck.`,
          voice: "villain",
        };
      }
      return { text: `${who(event.playerId)} revealed ${card(event.instanceId)}.`, voice: "villain" };
    }
    case "surgeTriggered":
      return {
        // Owner decision 22B: a surge deals a facedown encounter card that waits for the reveal step.
        text: `Surge — ${who(event.playerId)} ${verb(event.playerId, "are", "is")} dealt another encounter card.`,
        voice: "villain",
      };
    // "The first [Technique] attachment revealed each round gains surge" (Nebula I-III) or "the first treachery the
    // engaged player reveals each villain phase gains surge" (Mister Knife) — a printed rule handing the card a
    // keyword it wasn't dealt with, otherwise indistinguishable from the card just printing surge itself
    // (docs/phase7-wave3.md §3.8).
    case "surgeGranted":
      return {
        // From a printed rule (the first of its kind each round) or another card's ability: the event names neither.
        text: `${card(event.instanceId)} gains surge.`,
        voice: "villain",
      };
    // Run Them to Ground (`jj` 61020): the round ends with no villain phase (hero-pack spec H3.7).
    case "villainPhaseSkipped":
      return { text: `The villain phase is skipped this round.`, voice: "villain" };
    case "accelerationTokenAdded":
      return {
        text: `Acceleration: ${event.total} token${event.total === 1 ? "" : "s"} on the main scheme.`,
        voice: "villain",
      };
    case "overkillSpilled":
      return { text: `Overkill: ${event.amount} damage spills to ${card(event.toInstanceId)}.`, voice: "player" };
    // MC56 p. 6: a choice the first player made for "the enemy team" (the grim rule). The chosen names come from the
    // matching `choiceRequested` earlier in the same burst; without it the line says only who decided.
    case "choiceResolved": {
      if (!event.onBehalfOf) return null;
      const requested = burst?.events.find(
        (other) => other.type === "choiceRequested" && other.choice.choiceId === event.choiceId,
      );
      const options = requested?.type === "choiceRequested" ? requested.choice.options : null;
      if (!options)
        return { text: `The enemy team's choice was decided by ${who(event.playerId)}.`, voice: "scenario" };
      const chosen = event.selectedOptionIds.map((id) => {
        const option = options.find((o) => o.optionId === id);
        return option ? optionLabelOf(state, option) : id;
      });
      const named = chosen.length === 0 ? "nothing" : chosen.join(chosen.length === 2 ? " and " : ", ");
      return { text: `The enemy team (decided by ${who(event.playerId)}) chose ${named}.`, voice: "scenario" };
    }
    case "firstPlayerChanged":
      return {
        text: `${who(event.playerId)} ${verb(event.playerId, "are", "is")} the first player.`,
        voice: "scenario",
      };
    case "playerEliminated":
      // A seat that sits a scenario out is eliminated with no defeat, and `playerSatOut` follows it in the same
      // burst (owner decision 66B): that pair reads as one neutral line, not as a loss.
      if (burst?.events.slice(burst.at + 1).some((e) => e.type === "playerSatOut" && e.playerId === event.playerId)) {
        return null;
      }
      return { text: `${who(event.playerId)} ${verb(event.playerId, "are", "is")} out of the game.`, voice: "loss" };
    case "playerSatOut":
      return {
        text: `${who(event.playerId)} ${verb(event.playerId, "sit", "sits")} this scenario out. Set for ${event.startingPlayerCount} ${event.startingPlayerCount === 1 ? "player" : "players"}.`,
        voice: "scenario",
      };
    case "cardDiscardedFromPlay":
      return { text: `${card(event.instanceId)} left play.`, voice: "player" };
    case "playerSideSchemeLimitDiscard":
      return {
        text: `${who(event.chosenBy)} discarded ${card(event.instanceId)} for the player side scheme limit.`,
        voice: "player",
      };
    // RRG 1.8 "Player Deck" (p. 33): a deck that empties reshuffles its discard pile at once, and the player is
    // dealt a facedown encounter card for it — a rule that used to run silently, with only the following draw or
    // discard-cost payment as any evidence it happened.
    case "playerDeckReset":
      return { text: `${possessive(event.playerId)} deck is shuffled from the discard pile.`, voice: "scenario" };
    case "cardPutIntoPlayFacedown":
      return { text: `A facedown ${event.as} entered play engaged with ${who(event.playerId)}.`, voice: "villain" };
    case "gameEnded":
      return {
        text: outcomeText(
          event.outcome,
          card,
          foeWord(cardOf(state, activeVillain(state).instanceId), { lower: true }),
        ),
        // A concession is neither a win nor a defeat (the RRG has no concede rule; see `GameOutcome`), so it takes
        // the neutral voice rather than being colored as a loss.
        voice: event.outcome.result === "win" ? "win" : event.outcome.result === "conceded" ? "scenario" : "loss",
      };
    /**
     * The engine emits one of these for *every* resolved ability — a
     * "when revealed" on an encounter card, a constant's own resource
     * ability, a forced interrupt — most of which is exactly the bookkeeping
     * this switch otherwise stays quiet about, and whose own effects already
     * speak for themselves elsewhere (damage, threat, a status). Reported
     * (2026-09-16): Doctor Strange's Invocation cards resolved with nothing
     * in the log to say so ("the Special doesn't seem to be firing, or I
     * can't tell") — Spell Mastery pays an Invocation card's cost and
     * resolves its "Special" with no event of its own besides this one, so
     * without a line here the whole action was silent.
     *
     * The filter, found by scanning a real Doctor Strange playthrough
     * (`abilityLabelOf`'s own test file runs the same real-content check):
     * only an ability with something to actually say — a printed sub-ability
     * name ("Spell Mastery", "Natural Talent") or a `special` trigger (every
     * Invocation card's "Special", always worth naming even with no printed
     * label of its own) — gets a line. Every other resolution (when-revealed,
     * an unlabeled forced interrupt/response, a plain action with no printed
     * name) stays quiet, the same as before this case existed: `card()`
     * alone, with no ability name attached, would only repeat information
     * already on the board with nothing new to say.
     */
    case "abilityResolved": {
      const short = abilityShortLabelOf(state, event.instanceId, event.abilityId, deps);
      // A Forced Action the player had to use (Trance, Temptation): always told, so the log shows it was paid.
      if (event.forced) {
        // A "must play it" Forced Action (Alluring Call, Trance of Greed; `playFromHand.mustPay`) that found no card
        // legal to play and payable plays nothing and asks nothing: the log says so, or the outcome is invisible.
        const unplayed =
          mustPlayCardIn(deps.abilities[event.abilityId]) &&
          !burst?.events
            .slice(burst.at + 1)
            .some((later) => later.type === "cardPlayed" || later.type === "choiceRequested");
        return {
          text: `${card(event.instanceId)}: Forced Action used${short ? ` (${short})` : ""}.${unplayed ? " No card could be played." : ""}`,
          voice: "player",
        };
      }
      if (!short) return null;
      // A Special that blanked a text box (Blizzard) names whose, from the lasting effect it just added.
      const blanked = blankedBy(burst, state, event.instanceId);
      const blankedNote = blanked.length > 0 ? `: ${blanked.map(card).join(", ")} has a blank text box` : "";
      return { text: `${card(event.instanceId)} — ${short}${blankedNote}.`, voice: "player" };
    }

    // Forced Actions still owed when the last turn ended (RRG 1.8 "Action", p. 6): each is put to its player before the
    // phase can end.
    case "forcedActionsRequired": {
      const owed = event.actions.map((action) => `${who(action.playerId)}: ${card(action.instanceId)}`);
      return { text: `Forced Action owed, ${owed.join("; ")}. Use it to end the phase.`, voice: "scenario" };
    }
    // Double-sided cards whose other side nobody may read until each flips (Hypnotic Gaze). Only the front's name is
    // told: the event names the instances, and they all share one front.
    case "reversesHidden": {
      const names = [...new Set(event.instanceIds.map((id) => card(id)))];
      return { text: `${names.join(", ")}: other side hidden until it flips.`, voice: "scenario" };
    }
    // The pod's shared record (docs/phase7-wave9.md section 3.66; God of Lies): Loki's hit points and Worlds Collide's
    // threat live in the pod, not on their cards, so these two events are the only trace of a change to either. A
    // `sharedStateChanged` carries the same change as the event before it and stays silent.
    case "sharedEventEmitted": {
      const neutral = state.pod?.neutral;
      if (event.event.type === "sharedVillainDamaged") {
        const loki = neutral ? card(neutral.villainInstanceId) : "The shared villain";
        return {
          text: `${loki} takes ${event.event.amount} damage.`,
          voice: "villain",
        };
      }
      const worlds = neutral ? card(neutral.mainSchemeInstanceId) : "The shared scheme";
      const n = event.event.amount;
      return {
        text:
          event.event.cause === "identityDefeated"
            ? `${worlds} gets ${n} threat instead of a hero's defeat.`
            : `${worlds} gets ${n} threat instead of the scheme completing.`,
        voice: "villain",
      };
    }
    case "sharedResultApplied": {
      const neutral = state.pod?.neutral;
      const loki = neutral ? card(neutral.villainInstanceId) : "The shared villain";
      const worlds = neutral ? card(neutral.mainSchemeInstanceId) : "The shared scheme";
      if (event.result === "sharedVillainFlipped")
        return { text: `${loki} flips: defeat him to win the game.`, voice: "scenario" };
      if (event.result === "sharedVillainDefeated") return { text: `${loki} is defeated.`, voice: "scenario" };
      return { text: `${worlds} is complete: defeat ${loki} or the players lose.`, voice: "loss" };
    }
    // A dial set rather than damaged or healed: an Avatar swapped in starts at its printed hit points.
    case "hitPointsSet":
      return { text: `${card(event.instanceId)}'s hit points are set to ${event.remaining}.`, voice: "villain" };
    // A counter limit ("Max 1 synergy counter here"): the counters that did not fit are not placed.
    case "countersNotPlaced":
      return {
        text: `${event.amount} ${event.counterType} counter${event.amount === 1 ? "" : "s"} not placed on ${card(event.instanceId)} (its limit).`,
        voice: "player",
      };
    // A double-sided card turned over by a card (Phoenix Force, RRG 1.8 "Flip", p. 20): without a line its face, its
    // traits and its text changed with nothing in the log to say so.
    case "cardFlipped": {
      const pooled = cardOf(state, event.instanceId);
      const face = event.flipped ? (pooled && "flipSide" in pooled ? pooled.flipSide : undefined) : pooled;
      const named = face && "traits" in face ? face.traits[0] : undefined;
      return {
        text: `${card(event.instanceId)} flipped to ${named ? named.toUpperCase() : event.flipped ? "its other side" : "its front side"}.`,
        voice: "player",
      };
    }
    // docs/phase7-wave11-scenarios.md §S3.15: a card put into play on its other face ("Failed side faceup", MC60 p. 9
    // step 12). Not a flip, so it reads as the face the card starts on.
    case "cardEnteredOnOtherFace": {
      const pooled = cardOf(state, event.instanceId);
      const face = pooled && "flipSide" in pooled ? pooled.flipSide : undefined;
      // The face's first trait is its printed side name on the campaign environments (COMPLETED / FAILED, MC60 205-209).
      const named = face && "traits" in face ? face.traits[0] : undefined;
      return {
        text: `${card(event.instanceId)} enters play ${named ? `${named.toUpperCase()} side` : "on its other side"} faceup.`,
        voice: "scenario",
      };
    }
    // A counter put on or taken off a card by an ability (Phoenix Force's power counters, a Uses card's tokens).
    case "counterAdded":
    case "counterRemoved": {
      // RRG 1.8 "Main Scheme" (p. 27), step 1: a main scheme's counters go back to the pool as it advances.
      if (event.type === "counterRemoved" && event.returnedOnAdvance) {
        return {
          text: `${event.amount} ${event.counterType} counter${event.amount === 1 ? "" : "s"} return${event.amount === 1 ? "s" : ""} to the pool as ${card(event.instanceId)} advances.`,
          voice: "villain",
        };
      }
      const added = event.type === "counterAdded";
      return {
        text: `${card(event.instanceId)} ${added ? "gets" : "loses"} ${event.amount} ${event.counterType} counter${event.amount === 1 ? "" : "s"}.`,
        voice: "player",
      };
    }
    // A hero readied right after a card turned a card over or changed form (Phoenix Firebird readies the hero as the
    // form changes): the ordinary ready step has no line, so only a ready that follows one is told.
    // A card an encounter card exhausts (Sonic Boom, Exhaustion, Melter's boost): the player did not choose it, and a card
    // exhausted in the villain phase stays exhausted through the next player phase (RRG 1.8 "End of Player Phase", p. 18,
    // readies at the end of the player phase), so without a line it reads as a card that failed to ready (issue 136).
    // The player's own exhausts (costs, attacks, thwarts, defenses) stay quiet: the board shows them as they are made.
    case "cardExhausted": {
      const source = event.sourceInstanceId;
      if (!source || source === event.instanceId || playerCardOwnerOf(state, source) !== null) return null;
      return { text: `${card(source)} exhausts ${card(event.instanceId)}.`, voice: "villain" };
    }
    case "cardReadied": {
      const cause = burst && burst.at > 0 ? burst.events[burst.at - 1] : undefined;
      if (cause?.type !== "formChanged" && cause?.type !== "cardFlipped") return null;
      return { text: `${card(event.instanceId)} readies.`, voice: "player" };
    }
    // Storm's Weather Control / Weather Goddess, and every other swap (RRG 1.8 "Swap", p. 42).
    case "cardsSwapped":
      return {
        text:
          event.how === "outOfPlay"
            ? `${card(event.outgoing)} and ${card(event.incoming)} swapped places.`
            : `${card(event.outgoing)} leaves play; ${card(event.incoming)} enters play.`,
        voice: "player",
      };
    case "swapRefused":
      return { text: `The swap can't happen: ${swapRefusedReason(event.reason)}.`, voice: "player" };
    // docs/phase7-wave11-scenarios.md §S3.2 (Change of Venue): a main scheme swapped with a set-aside one.
    case "mainSchemeSwapped": {
      const owner = event.playArea === viewer ? "your" : event.playArea === null ? "" : `${who(event.playArea)}'s`;
      const where = event.playArea === null ? "" : ` in ${owner} play area`;
      return {
        text: `${card(event.incoming)} replaces ${card(event.outgoing)}${where}; ${card(event.outgoing)} is set aside.`,
        voice: "scenario",
      };
    }

    // docs/phase7-wave8.md §3.63: an additional cost to change form (Spectrum-style "2 resources of the same type").
    // The cards that print it are not named: they are in the form-change prompt's header and in Inspect.
    case "formChangeCostAsked":
      return {
        text: `Changing to ${formWords(event.to)} costs extra.`,
        voice: "player",
      };
    case "formChangeCostSettled":
      return {
        text:
          event.outcome === "paid"
            ? `${who(event.playerId)} paid the extra cost to change to ${formWords(event.to)}.`
            : event.outcome === "declined"
              ? `${who(event.playerId)} declined the extra cost; the form stays.`
              : `${who(event.playerId)} can't pay the extra cost; the form stays.`,
        voice: "player",
      };
    // docs/phase7-wave8.md §3.64: a card has a player make a basic attack or thwart.
    case "basicPowerInstructed": {
      const from = `${event.sourceInstanceId ? `${card(event.sourceInstanceId)}: ` : ""}${card(event.characterInstanceId)}`;
      const verbWord = event.power === "attack" ? "attacks" : "thwarts";
      // Owner row 82: a divided basic power names each share ("Spider-Man attacks Rhino 2, Vulture 1").
      if (event.divide && event.divide.length > 1) {
        const shares = event.divide.map((share) => `${card(share.targetInstanceId)} ${share.amount}`).join(", ");
        return { text: `${from} ${verbWord} ${shares}.`, voice: "player" };
      }
      return {
        text: `${from} ${verbWord} ${card(event.targetInstanceId)}${event.useAtk ? " with ATK" : ""}.`,
        voice: "player",
      };
    }
    case "basicPowerNotMade":
      return {
        text: `${event.sourceInstanceId ? `${card(event.sourceInstanceId)}: ` : ""}${
          event.reason === "noLegalUse"
            ? "no basic attack or thwart is possible."
            : event.reason === "costNotPaid"
              ? "the extra cost wasn't paid, so no basic power."
              : "the basic power couldn't be declared."
        }`,
        voice: "player",
      };
    // docs/phase7-wave8.md §3.54: "ready [a card] →".
    case "readyCardsCostSettled": {
      const names = event.instanceIds.map((id) => card(id)).join(", ");
      return {
        text: event.paid
          ? `${names || "No card"} readied as a cost.`
          : `${names || "No card"} didn't ready, so the cost wasn't paid.`,
        voice: "player",
      };
    }
    // docs/phase7-wave8.md §3.55: "discard up to N cards from the top of your deck →".
    case "deckDiscardCostSettled": {
      const count = (n: number): string => `${n} card${n === 1 ? "" : "s"}`;
      const subject = event.playerId ? who(event.playerId) : "A player";
      const own = event.playerId ? (event.playerId === viewer ? "your" : "their") : "the";
      return {
        text: event.paid
          ? `${subject} discarded ${count(event.discarded.length)} from the top of ${own} deck as a cost.`
          : `${subject} could discard only ${event.discarded.length} of ${count(event.chosen)}, so the cost wasn't paid.`,
        voice: "player",
      };
    }
    // docs/phase7-wave8.md §3.5: an optional setup rule, with the amount the players stated.
    case "setupOptionApplied":
      return { text: `Setup option: ${plainRuleText(event.text)}`, voice: "scenario" };
    // docs/phase7-wave8.md §3.7: villains laid out in a row, left to right.
    case "villainRowSet":
      return {
        text: `${foeWord(event.order[0] ? cardOf(state, event.order[0]) : undefined, { plural: true })} in a row, left to right: ${event.order.map((id) => card(id)).join(", ")}.`,
        voice: "scenario",
      };
    // docs/phase7-wave8.md §3.39 / §3.71: a raised moment is bookkeeping, except one that carries a count of cards
    // pulled (a "discard N cards" cost that something answers), which is worth a line.
    case "momentRaised": {
      const pulled = event.carriedVars?.["pulled.count"];
      if (pulled === undefined) return null;
      return {
        text: `${who(event.playerId)} discarded ${pulled} card${pulled === 1 ? "" : "s"}.`,
        voice: "player",
      };
    }
    // docs/phase7-wave8.md §3.48: the top card of a deck is public while a rule says so.
    case "deckTopShown":
      return {
        text: `${possessive(event.playerId)} top card is faceup: ${getCard(state, event.cardId)?.name ?? "a card"}.`,
        voice: "player",
      };
    case "deckTopHidden":
      return { text: `${possessive(event.playerId)} top card is facedown again.`, voice: "player" };
    // docs/phase7-wave8.md §3.62: the declared types of a payment's wilds. A declaration the engine skipped as
    // equivalent was not the player's decision, so it says nothing.
    case "wildTypesDeclared":
      if (event.skipped) return null;
      return {
        text: `${who(event.playerId)} ${verb(event.playerId, "count", "counts")} the wild${event.declared.length === 1 ? "" : "s"} as ${event.declared.join(", ")}.`,
        voice: "player",
      };
    // Owner row 79: the player said which resources of a payment were the paid ones; the rest is overpaid.
    case "paidResourcesChosen": {
      const paid = poolWords(event.paidAs);
      const over = poolWords(event.overpaidAs);
      return {
        text: `${who(event.playerId)} paid ${card(event.instanceId)} with ${paid}${over ? `; ${over} overpaid` : ""}.`,
        voice: "player",
      };
    }
    // docs/phase7-wave8.md §3.11: "resolve its 'Forced Response' / 'Special' →" as the cost.
    case "resolveAbilityCostSettled": {
      const what = event.trigger === "special" ? "Special" : "Forced Response";
      return {
        text: event.paid
          ? `${card(event.ofInstanceId)}'s ${what} resolved as a cost.`
          : `${card(event.ofInstanceId)}'s ${what} didn't resolve, so the cost wasn't paid.`,
        voice: "player",
      };
    }
    // docs/phase7-wave8.md §3.18: a villain's next stage revealed with no defeat.
    case "villainStageRevealed":
      return {
        text: `${card(event.instanceId)} moves to stage ${event.toStageNumber}, at full hit points.`,
        voice: "villain",
      };
    // docs/phase7-wave8.md §3.21: an ability that had triggered but a rule says to ignore.
    case "abilityIgnored": {
      const label = abilityShortLabelOf(state, event.instanceId, event.abilityId, deps);
      return {
        text: `${card(event.instanceId)}'s ${label ?? "ability"} is ignored.`,
        voice: "scenario",
      };
    }
    // docs/phase7-wave8.md §3.10: a "considered to have hit points" rule stopped applying with the dial at zero.
    case "hitPointsFell":
      return {
        text: `${card(event.instanceId)}'s hit points fell to ${event.to}, below its ${event.damage} damage.`,
        voice: "player",
      };
    // docs/phase7-wave8.md §3.33: the mission area.
    case "scenarioPlayAreaCreated":
      return {
        text: `The ${event.name} area is set up${event.closed ? ", closed to most card abilities" : ""}.`,
        voice: "scenario",
      };
    case "scenarioPlayAreaEntered":
      return {
        text:
          event.from === "inPlay"
            ? `${card(event.instanceId)} moves to the ${event.name} area; no player controls it now.`
            : `${card(event.instanceId)} enters play in the ${event.name} area, under no player's control.`,
        voice: "villain",
      };
    // docs/phase7-wave8.md §3.36: a pairing; a pair that doesn't match is said in words, never by color alone.
    case "cardsPaired": {
      const subject = event.playerId ? who(event.playerId) : "A player";
      if (event.pairs.length === 0) return { text: `${subject} had no cards to pair.`, voice: "player" };
      const pairs = event.pairs
        .map(
          (pair) =>
            `${card(pair.cardInstanceId)} with ${card(pair.characterInstanceId)} (${pair.matched ? "match" : "no match"})`,
        )
        .join(", ");
      return {
        text: `${subject} paired ${pairs}.`,
        voice: "player",
      };
    }
    // docs/phase7-wave8.md §3.37: a pool of damage dealt out one character at a time.
    case "damagePoolResolved":
      return {
        text: `Damage pool of ${event.pool}: ${event.dealt} dealt${event.lost > 0 ? `, ${event.lost} lost` : ""}.`,
        voice: "player",
      };
    // docs/phase7-wave8.md §3.44: cards already held that count toward the starting hand.
    case "startingHandCredited":
      return {
        text: `${who(event.playerId)} ${verb(event.playerId, "count", "counts")} ${event.amount} card${event.amount === 1 ? "" : "s"} toward the starting hand${event.credit !== event.amount ? ` (${event.credit} in all)` : ""}.`,
        voice: "player",
      };
    case "startingHandCreditApplied":
      return {
        text: `${who(event.playerId)} ${verb(event.playerId, "draw", "draws")} ${event.drawn} for a hand of ${event.handSize}; ${event.credit} already counted.`,
        voice: "player",
      };
    // RRG 1.8 "End of Player Phase" (p. 18) step 2, said for a full hand too, so a hand size of 1 (Iron Man with no
    // Tech upgrades) does not read as a draw that never happened (issue #150).
    case "handRefilled":
      return {
        text:
          event.drawn === 0
            ? `${who(event.playerId)} ${verb(event.playerId, "draw", "draws")} nothing: the hand is already at its hand size of ${event.handSize}.`
            : `${who(event.playerId)} ${verb(event.playerId, "draw", "draws")} ${event.drawn} card${event.drawn === 1 ? "" : "s"} up to a hand size of ${event.handSize}.`,
        voice: "player",
      };
    // RRG 1.8 "Ownership and Control" (p. 31): a player became a card's owner by taking it.
    case "ownershipChanged":
      return {
        text: `${who(event.playerId)} ${verb(event.playerId, "take", "takes")} ownership of ${card(event.instanceId)}.`,
        voice: "player",
      };
    case "deckDiscardNotCounted":
      return { text: `${card(event.instanceId)} doesn't count as discarded.`, voice: "player" };

    case "keywordResolved":
      return event.keyword === "temporary"
        ? { text: `${card(event.instanceId)} — Temporary: discarded at the end of the round.`, voice: "player" }
        : null;

    // Wave 9 (docs/phase7-wave9.md). `card()` names a card only as far as this table may see it, so a facedown card
    // in a line below reads "a facedown card".

    // §3.31: an extra cost to attack, thwart or defend with a character.
    case "additionalPowerCostPaid":
      return {
        text: `${who(event.playerId)} paid an extra cost to ${event.power} with ${card(event.characterInstanceId)}.`,
        voice: "player",
      };
    case "additionalPowerCostAsked":
      return {
        text: `${card(event.characterInstanceId)} needs an extra cost to defend. ${who(event.playerId)} ${verb(event.playerId, "choose", "chooses")} whether to pay.`,
        voice: "player",
      };
    case "additionalPowerCostNotPaid":
      return {
        text: `${card(event.characterInstanceId)} does not defend: the extra cost was not paid.`,
        voice: "player",
      };
    // docs/phase7-wave10-hero-packs.md H3.16: an extra cost to attack one enemy (Brother vs. Brother). The discard
    // itself has no line, so this one says why a card left the hand.
    case "additionalAttackCostPaid":
      return {
        text: `${who(event.playerId)} paid the extra cost of ${card(event.sourceInstanceId)} to attack ${card(event.targetInstanceId)}.`,
        voice: "player",
      };
    case "additionalAttackCostNotPaid":
      return {
        text: `The extra cost of ${card(event.sourceInstanceId)} to attack ${card(event.targetInstanceId)} was not paid.`,
        voice: "player",
      };

    // §3.29 (b): Baron Zemo's accusation. The guess and the mole are open to every player (the pile was turned faceup
    // just before `moleIdentified`), so the board members may be named.
    case "accusationMade":
      return {
        text: `${who(event.playerId)} ${verb(event.playerId, "accuse", "accuses")} ${cardIdName(state, event.accused.boardMember)}.`,
        voice: "player",
      };
    case "moleIdentified": {
      if (!event.mole) return { text: `The ${pileLabel(event.pile)} cards match no board member.`, voice: "scenario" };
      const mole = `The mole is ${cardIdName(state, event.mole.boardMember)}.`;
      if (!event.accused) return { text: mole, voice: "scenario" };
      return {
        text:
          event.wrong.length === 0
            ? `${mole} The accusation was correct.`
            : `${mole} ${event.wrong.length} of 4 guesses ${event.wrong.length === 1 ? "was" : "were"} wrong.`,
        voice: "scenario",
      };
    }

    // §3.29 (a): hidden piles. `hiddenPilesDealt` carries sizes only, so only sizes are said; the other two carry card
    // ids because the engine has already made those cards open to every player.
    case "hiddenPilesDealt":
      if (event.kept) return null;
      return {
        text: `Hidden piles dealt: ${event.piles.map((p) => `${pileLabel(p.pile)} ${p.size}`).join(", ")}.`,
        voice: "scenario",
      };
    case "hiddenPileCardsGained":
      return {
        text:
          event.cardIds.length === 0
            ? `The ${pileLabel(event.pile)} pile is empty.`
            : `The players gain ${event.cardIds.map((id) => cardIdName(state, id)).join(", ")} from the ${pileLabel(event.pile)} pile.`,
        voice: "player",
      };
    case "hiddenPileRevealed":
      return {
        text:
          event.cardIds.length === 0
            ? `The ${pileLabel(event.pile)} pile is turned faceup: it is empty.`
            : `The ${pileLabel(event.pile)} pile is turned faceup: ${event.cardIds.map((id) => cardIdName(state, id)).join(", ")}.`,
        voice: "scenario",
      };

    // §3.26: a card that turned over to another card and kept its counters.
    case "cardFlippedToOtherFace": {
      const kept = Object.entries(event.keptCounters ?? {}).filter(([, n]) => n > 0);
      const keeps = kept.map(([type, n]) => `${n} ${type} counter${n === 1 ? "" : "s"}`).join(", ");
      return {
        text: `${card(event.instanceId)} turns over${keeps ? ` and keeps ${keeps}` : ""}.`,
        voice: "scenario",
      };
    }
    // §3.6: counters moved between cards; an all-purpose counter takes the type of its new card.
    case "countersMoved": {
      const words = (type: string): string => type.replace(/_/g, " ");
      const noun = (type: string, n: number): string => `${words(type)} counter${n === 1 ? "" : "s"}`;
      const became =
        event.toCounterType && event.toCounterType !== event.counterType
          ? ` and become${event.amount === 1 ? "s" : ""} ${words(event.toCounterType)}`
          : "";
      return {
        text: `${event.amount} ${noun(event.counterType, event.amount)} move${event.amount === 1 ? "s" : ""} from ${card(event.from)} to ${card(event.to)}${became}.`,
        voice: "player",
      };
    }

    // §3.19, §3.21: an ally held captive, a minion held by an environment.
    case "controlReleased":
      return {
        text: `${card(event.instanceId)} is held captive by ${faceUpName(state, event.hostInstanceId)}.`,
        voice: "villain",
      };
    case "minionHeld":
      // The holder by the face that is up: Thunderbolt Backup is the flipped side of its card, which `cardName` would not name.
      return {
        text: `${card(event.instanceId)} is held by ${faceUpName(state, event.hostInstanceId)}.`,
        voice: "villain",
      };
    // §3.24
    case "engagementRotated":
      return {
        text: `Engaged minions pass to the next player (${event.moves.length}).`,
        voice: "villain",
      };
    // §3.17: the top card of a scenario deck comes into play.
    case "scenarioDeckTopEnteredPlay":
      return { text: `${card(event.instanceId)} enters play from ${event.name}.`, voice: "villain" };

    // §3.42: the encounter deck's top card shown to everyone while a rule says so (`deckTopShown`'s sibling).
    case "encounterTopShown":
      return { text: `The encounter deck's top card is faceup: ${cardIdName(state, event.cardId)}.`, voice: "villain" };
    case "encounterTopHidden":
      return { text: `The encounter deck's top card is facedown again.`, voice: "villain" };
    // §3.43: discards from the top of the encounter deck. The card went to the discard pile faceup; one shuffled into
    // a reset deck is named by `card()` only if this table can see it.
    case "cardDiscardedFromEncounterDeck":
      return {
        text: `${card(event.instanceId)} is discarded from the encounter deck.`,
        voice: "villain",
      };
    case "encounterDiscardCostSettled": {
      const n = event.discarded.length;
      const by = event.playerId ? `${who(event.playerId)} ${verb(event.playerId, "discard", "discards")}` : "Discard";
      return {
        text: event.paid
          ? `${by} ${n} card${n === 1 ? "" : "s"} from the encounter deck.`
          : `${by} nothing: the encounter deck cost was not paid.`,
        voice: "player",
      };
    }
    // §3.46 (c): a tucked card spent as if from hand.
    case "tuckedCardSpent":
      return {
        text: `${who(event.playerId)} ${verb(event.playerId, "spend", "spends")} ${card(event.instanceId)} from under ${card(event.hostInstanceId)}.`,
        voice: "player",
      };
    // A card spent from a hand that is not the acting player's, while a card is played or an ability used: another
    // player is helping pay (an Alliance card, Coordinated Effort's "any player may help pay"). Every other hand
    // discard (a cost the player pays, an effect) stays silent here, as it always did.
    case "cardDiscardedFromHand": {
      const step = state.step;
      const active = step.phase === "player" && step.kind === "turn" ? step.activePlayerId : null;
      const paying = burst?.events.some((other) => other.type === "cardPlayed" || other.type === "abilityResolved");
      if (!paying || active === null || event.playerId === active) return null;
      return {
        text: `${who(event.playerId)} ${verb(event.playerId, "discard", "discards")} ${card(event.instanceId)} to help pay.`,
        voice: "player",
      };
    }
    // Hero packs H3.19: another player pays a part of a cost in the user's place (Coordinated Effort).
    case "costPartPaidBy": {
      const parts = {
        damageSelf: "the damage",
        indirectDamage: "the indirect damage",
        discardFromDeck: "the discard from the deck",
        discardRandomFromHand: "the random discard from hand",
        dealEncounterCards: "the encounter card dealt",
      } as const;
      return {
        text: `${who(event.helperId)} ${verb(event.helperId, "help", "helps")} pay for ${card(event.sourceInstanceId)}: ${parts[event.part]}.`,
        voice: "player",
      };
    }
    // §3.41: a reveal replaced by other reveals (each logs its own `encounterCardRevealed`).
    case "revealReplaced":
      return {
        text: `${card(event.instanceId)} is replaced: ${who(event.playerId)} ${verb(event.playerId, "reveal", "reveals")} ${event.withInstanceIds.length} other card${event.withInstanceIds.length === 1 ? "" : "s"} instead.`,
        voice: "villain",
      };
    // §3.1: Vulnerable discards a character that became stunned or confused.
    case "vulnerableDiscarded":
      return {
        text: `${card(event.instanceId)} is ${event.status} and Vulnerable: it is discarded.`,
        voice: "player",
      };
    // §3.12: a look-at that put the cards back in an order of the player's choosing. Which card went where is not on
    // the event, and not said here: the cards are facedown.
    case "cardsRearranged":
      return {
        text:
          event.moved === 0
            ? `${who(event.playerId)} put the cards back in the same order.`
            : `${who(event.playerId)} rearranged ${event.instanceIds.length} cards.`,
        voice: "player",
      };

    // Skipped on purpose (wave 9), no line:
    // - `scenarioDeckTopLeft`: the card's own move or flip says where it went, and the next top card's
    //   `scenarioDeckTopEnteredPlay` follows.
    // - `threatCostSettled`: the `threatRemoved` before it is the line.
    // - `damageBeyondZeroLost`: a dial correction; the damage was already logged in full and the card shows its hit points.
    // - `abilityGained.grantedByInstanceId`: rules bookkeeping on an event already skipped; Inspect shows the ability.

    // Bookkeeping the player never reads: the stack, timing windows, trigger
    // announcements, per-card zone moves, and choice plumbing. The Inspect
    // overlay and the replay log carry these instead.
    default:
      return null;
  }
}

/** A printed rule's text with its icon markup spoken: "Place 2[per_hero] threat" reads "Place 2 per hero threat". */
function plainRuleText(text: string): string {
  return text
    .replace(/\[per_hero\]/g, " per hero")
    .replace(/\[([a-z_]+)\]/g, (_, name: string) => name.replace(/_/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

/** A card's type as a word for a log sentence: "minion", "villain", "side scheme". */
function typeWord(state: GameState, id: InstanceId): string {
  const card = cardOf(state, id);
  if (card?.type === "villain") return foeWord(card, { lower: true });
  return (card?.type ?? "card").replace(/_/g, " ");
}

/**
 * What `id` just did in this command, before the event being described: "attacking" if it dealt damage to another
 * card, "thwarting" if it removed threat. Null when it did neither.
 */
function whatItJustDid(burst: Burst | undefined, id: InstanceId): "attacking" | "thwarting" | null {
  if (!burst) return null;
  for (let i = burst.at - 1; i >= 0; i--) {
    const earlier = burst.events[i]!;
    if (earlier.type === "damageDealt" && earlier.sourceInstanceId === id && earlier.targetInstanceId !== id) {
      return "attacking";
    }
    if (earlier.type === "threatRemoved" && earlier.sourceInstanceId === id) return "thwarting";
    if (earlier.type === "roundStarted") return null;
  }
  return null;
}

/** Bookkeeping events that sit between an effect and the one it caused without changing what happened. */
const isFrameEvent = (event: GameEvent): boolean =>
  event.type === "framePushed" || event.type === "framePopped" || event.type === "triggerEvent";

/**
 * When the event being described comes straight from a "choose one" that asked nobody (`optionChosen.onlyOption`):
 * the card that pass of a "for each" was about (its `targetChosen` just before), or null when there was none.
 * Undefined when the event did not come from such a choice.
 */
function onlyOptionBefore(burst: Burst | undefined): InstanceId | null | undefined {
  if (!burst) return undefined;
  let i = burst.at - 1;
  while (i >= 0 && isFrameEvent(burst.events[i]!)) i--;
  const chosen = burst.events[i];
  if (chosen?.type !== "optionChosen" || chosen.onlyOption !== true) return undefined;
  for (i--; i >= 0 && isFrameEvent(burst.events[i]!); i--);
  const target = burst.events[i];
  return target?.type === "targetChosen" && target.instanceIds.length === 1 ? target.instanceIds[0]! : null;
}

/** The cards a blanking lasting effect from `source`'s card was just placed on, in this command. */
function blankedBy(burst: Burst | undefined, state: GameState, source: InstanceId): readonly InstanceId[] {
  if (!burst) return [];
  const cardId = state.instances[source]?.cardId;
  for (let i = burst.at; i >= 0; i--) {
    const earlier = burst.events[i]!;
    if (earlier.type !== "lastingEffectAdded" || earlier.effect.kind !== "blankTextBox") continue;
    if (earlier.effect.sourceCardId === undefined || earlier.effect.sourceCardId === cardId) {
      return earlier.effect.targets;
    }
  }
  return [];
}

const swapRefusedReason = (
  reason: "missingCard" | "bothInPlay" | "cannotLeavePlay" | "unsupported" | "unique" | "cannotEnterPlay",
): string => {
  switch (reason) {
    case "cannotEnterPlay":
      return "the card coming in cannot enter play during this game";
    case "cannotLeavePlay":
      return "the card in play cannot leave it";
    case "unique":
      return "the card coming in is unique and already in play";
    case "bothInPlay":
      return "both cards are already in play";
    default:
      return "a card to swap was missing";
  }
};

/** A card's printed name from its id; only for cards an event has already made open to every player. */
const cardIdName = (state: GameState, cardId: Parameters<typeof getCard>[1]): string =>
  getCard(state, cardId)?.name ?? "a card";

/** A hidden pile's table name: the pile ids are scenario-defined, so only the known envelopes are dressed up. */
const pileLabel = (pile: string): string => (pile === "aim" ? "A.I.M." : pile === "shield" ? "S.H.I.E.L.D." : pile);

/** An encounter set's display name, or its id when the pool doesn't know it. */
const setLabel = (id: string): string => POOL_ENCOUNTER_SETS.find((set) => (set.id as string) === id)?.name ?? id;

const enemyAttackSkipReason = (skipped: "leftPlay" | "cannotAttack" | "dashedStat"): string => {
  switch (skipped) {
    case "leftPlay":
      return "the target already left play";
    case "cannotAttack":
      return "the attacker cannot attack";
    default:
      return "the attacker has no printed ATK";
  }
};

const statusRemovedText = (reason: string, name: string): string => {
  switch (reason) {
    case "cancelledAttack":
      return `${name}'s attack cancelled —`;
    case "cancelledSchemeOrThwart":
      return `${name}'s scheme cancelled —`;
    case "preventedDamage":
      return `${name} took 0 damage —`;
    case "piercing":
      return `Piercing ignored ${name}'s`;
    default:
      return `${name} lost`;
  }
};

const outcomeText = (
  outcome: {
    readonly result: string;
    readonly reason: string;
    readonly sourceInstanceId?: InstanceId;
    readonly causeInstanceId?: InstanceId;
  },
  card: (id: InstanceId) => string,
  foe = "villain",
): string => {
  switch (outcome.reason) {
    case "villainDefeated":
      return `The ${foe} is defeated. You win.`;
    case "allVillainsDefeated":
      return `Every ${foe} is defeated. You win.`;
    case "mainSchemeCompleted":
      return "The main scheme completed. You lose.";
    case "playerConceded":
      return "The game was conceded.";
    // A card's own text lost it (The Champion's ratings, Robert Kelly leaving play). The engine names the card, and
    // the card that met its condition when that is another one; a log saved before it always did may name neither.
    case "cardAbility":
      if (!outcome.sourceInstanceId) return "A card's own text ended the game. You lose.";
      return outcome.causeInstanceId
        ? `${card(outcome.causeInstanceId)} left play. ${card(outcome.sourceInstanceId)} ended the game. You lose.`
        : `${card(outcome.sourceInstanceId)} ended the game. You lose.`;
    // RRG 1.8 "Encounter Deck" (p. 17): no cards in both the encounter deck and its discard pile.
    case "encounterDeckExhausted":
      return "The encounter deck and its discard pile are both empty. You lose.";
    default:
      return "Every hero is defeated. You lose.";
  }
};

/** "1 physical, 1 mental" for a resource pool (zero entries left out); empty for an empty pool. */
function poolWords(pool: Readonly<Record<"physical" | "mental" | "energy" | "wild", number>>): string {
  return (["physical", "mental", "energy", "wild"] as const)
    .filter((type) => pool[type] > 0)
    .map((type) => `${pool[type]} ${type}`)
    .join(", ");
}
