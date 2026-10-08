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
  cardOf,
  cardTypeName,
  getCard,
  getInstance,
  type EngineDeps,
  type GameEvent,
  type GameState,
  type InstanceId,
  type PlayerId,
} from "@mc/engine";
import { POOL_ENCOUNTER_SETS } from "../content/pool.js";
import { abilityShortLabelOf } from "./ability-label.js";
import { cardName, seatName } from "./names.js";

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
      text: described.text,
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
  return describe(event, state, perspectiveId, deps, redirected, faceNames, burst);
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
  const card = (id: Parameters<typeof cardName>[1]): string => faceNames?.get(id) ?? cardName(state, id);

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
      return { text: `${card(event.instanceId)} joins the fight as another villain.`, voice: "villain" };
    case "villainRemoved":
      return { text: `${card(event.instanceId)} leaves the game.`, voice: "villain" };
    case "villainSetAside":
      return { text: `${card(event.instanceId)} is set aside.`, voice: "villain" };
    case "villainReplaced":
      return {
        text:
          event.reason === "swap"
            ? `${getCard(state, event.fromCardId)?.name ?? "The villain"} swaps to ${getCard(state, event.toCardId)?.name ?? "another card"}.`
            : `${getCard(state, event.toCardId)?.name ?? "Another villain"} takes the place of ${getCard(state, event.fromCardId)?.name ?? "the defeated villain"}.`,
        voice: "villain",
      };
    case "scenarioDeckReset":
      return { text: `${event.name} was empty: its discard pile is shuffled back into it.`, voice: "scenario" };
    case "separateDeckReset":
      return {
        text: `${possessive(event.playerId)} ${event.name} deck was empty: its discard pile is shuffled back into it.`,
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
        text: `${who(event.playerId)} ${event.byEffect ? "was flipped" : "flipped"} to ${event.to === "hero" ? "hero" : "alter-ego"} form.`,
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
    // §3.66: a deck with no discard pile (the show deck) sends a would-be discard to its own bottom, facedown.
    case "returnedToScenarioDeck":
      return {
        text: `${card(event.instanceId)} goes to the bottom of ${event.name} instead of a discard pile.`,
        voice: "scenario",
      };
    // §3.66: the board shows no change, so say why the card's ability did nothing.
    case "scenarioDeckClosed":
      return {
        text: `${event.name} is closed to player card effects — ${getCard(state, event.sourceCardId)?.name ?? "a card"} has no effect on it.`,
        voice: "scenario",
      };
    case "interruptsPreempted":
      return { text: `Toughness has interrupt priority — no other interrupt fires first.`, voice: "scenario" };
    case "threatPlaced":
      return { text: `${event.amount} threat placed on ${card(event.schemeInstanceId)}.`, voice: "scenario" };
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
        text: `${card(event.enemyInstanceId)} ${event.activation === "attack" ? "attacks" : "schemes"} against ${who(event.playerId)}.`,
        voice: "villain",
      };
    case "boostCardFlipped":
      return {
        text: `Boost: ${event.boostIcons} icon${event.boostIcons === 1 ? "" : "s"} for ${card(event.enemyInstanceId)}.`,
        voice: "villain",
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
          : `${card(event.defenderInstanceId)} defends.`,
        voice: "player",
      };
    case "defenseDeclined":
      return { text: `${who(event.playerId)} did not defend.`, voice: "player" };
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
        text: `${card(event.attackerInstanceId)}'s attack on ${card(event.targetInstanceId)} ends — ${card(event.attackerInstanceId)} left play first.`,
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
      return {
        text: `${card(event.attackerInstanceId)} can't attack ${card(event.targetInstanceId)}, so it takes no damage from that attack.`,
        voice: "player",
      };
    // Bookkeeping: the attack's own damage line and its "after the attack" lines say everything a player reads.
    case "attackAwaitsAbility":
      return null;
    // The scheme half of the same breakdown, worded the same way. The third term only appears when something actually
    // changed the threat ("reduce the amount of threat placed … by 1"); an attack always has a defense term, a scheme
    // has no equivalent that is always present.
    case "schemeResolved":
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
      return { text: `The villain advances to stage ${event.stageIndex + 1}.`, voice: "villain" };
    // The Wrecking Crew's active counter moving to another villain (`state.activeVillainId`) is otherwise silent —
    // no damage, threat or status marks it — so without a line here the board's other three panels lit up ACTIVE
    // for no reason the log ever gave.
    case "activeVillainChanged":
      return {
        text:
          event.reason === "nextInRow"
            ? `The active counter moves along the row to ${card(event.to)}.`
            : `The active villain is now ${card(event.to)}.`,
        voice: "villain",
      };
    // The Collector flipping between its finite front and ∞ back (docs/phase7-wave3.md §3.1) — `hitPointsReset`
    // is present on that flip and on Risky Business's Green Goblin (whose own two faces both reset the dial), so
    // it names what actually happens to the hit point dial rather than leaving the player to infer it from the
    // panel alone. A flip between two ordinary faces that *keeps* its damage (Risky Business's Norman Osborn) has
    // nothing extra to say.
    case "villainFlipped":
      return {
        text: `${card(event.instanceId)} flips${event.hitPointsReset ? ", hit points reset," : ""} to side ${event.to}.`,
        voice: "villain",
      };
    // A card the first player controls followed the token to a new seat (the Milano, docs/phase7-wave3.md §3.13) —
    // otherwise silent, since nothing about the card's own state changes, only who may use its ability. The
    // engine's own `reason` is always "firstPlayer" today, so the line states that plainly rather than branching
    // on a value that has only ever had one shape.
    case "controllerChanged":
      return { text: `${card(event.instanceId)} now follows the first player, ${who(event.to)}.`, voice: "scenario" };
    case "mainSchemeAdvanced":
      return { text: `The main scheme advances to stage ${event.stageIndex + 1}.`, voice: "villain" };
    case "mainSchemeCompleted":
      return { text: `The main scheme is complete.`, voice: "loss" };
    case "encounterCardRevealed":
      return { text: `${who(event.playerId)} revealed ${card(event.instanceId)}.`, voice: "villain" };
    case "surgeTriggered":
      return {
        text: `Surge — ${who(event.playerId)} ${verb(event.playerId, "reveal", "reveals")} another encounter card.`,
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
    case "accelerationTokenAdded":
      return {
        text: `Acceleration: ${event.total} token${event.total === 1 ? "" : "s"} on the main scheme.`,
        voice: "villain",
      };
    case "overkillSpilled":
      return { text: `Overkill: ${event.amount} damage spills to ${card(event.toInstanceId)}.`, voice: "player" };
    case "firstPlayerChanged":
      return {
        text: `${who(event.playerId)} ${verb(event.playerId, "are", "is")} the first player.`,
        voice: "scenario",
      };
    case "playerEliminated":
      return { text: `${who(event.playerId)} ${verb(event.playerId, "are", "is")} out of the game.`, voice: "loss" };
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
        text: outcomeText(event.outcome, card),
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
      if (!short) return null;
      // A Special that blanked a text box (Blizzard) names whose, from the lasting effect it just added.
      const blanked = blankedBy(burst, state, event.instanceId);
      const blankedNote = blanked.length > 0 ? `: ${blanked.map(card).join(", ")} has a blank text box` : "";
      return { text: `${card(event.instanceId)} — ${short}${blankedNote}.`, voice: "player" };
    }

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
        text: `Villains in a row, left to right: ${event.order.map((id) => card(id)).join(", ")}.`,
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

    // Bookkeeping the player never reads: the stack, timing windows, trigger
    // announcements, per-card zone moves, and choice plumbing. The Inspect
    // overlay and the replay log carry these instead.
    default:
      return null;
  }
}

/** `Form` as the words a log line uses. */
const formWords = (form: string): string => (form === "hero" ? "hero form" : "alter-ego form");

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
  return (cardOf(state, id)?.type ?? "card").replace(/_/g, " ");
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
): string => {
  switch (outcome.reason) {
    case "villainDefeated":
      return "The villain is defeated. You win.";
    case "allVillainsDefeated":
      return "Every villain is defeated. You win.";
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
