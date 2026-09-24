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

import type { EngineDeps, GameEvent, GameState, PlayerId } from "@mc/engine";
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

  for (const event of events) {
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
    const described = describe(event, state, perspectiveId, deps, redirected);
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
): Beat | null {
  return describe(event, state, perspectiveId, deps, redirected);
}

function describe(
  event: GameEvent,
  state: GameState,
  viewer: PlayerId | null,
  deps: EngineDeps,
  redirected = false,
): Beat | null {
  const who = (id: PlayerId): string => seatName(state, id, viewer);
  /** "You draw" vs "Spider-Man draws": the second person takes no -s. */
  const verb = (id: PlayerId, plural: string, singular: string): string => (id === viewer ? plural : singular);
  /** "Your deck" vs "Spider-Man's deck": "you" possessive isn't "you's". */
  const possessive = (id: PlayerId): string => (id === viewer ? "Your" : `${who(id)}'s`);
  const card = (id: Parameters<typeof cardName>[1]): string => cardName(state, id);

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
      return null;
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
    case "damageDealt":
      return { text: `${card(event.targetInstanceId)} took ${event.amount} damage.`, voice: "player" };
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
    case "uniqueEntryBlocked":
      return {
        text:
          `${card(event.instanceId)} can't enter play — ${card(event.matchedInstanceId)} is already in play` +
          (event.disposition === "discarded" ? ", so it is discarded." : "."),
        voice: event.disposition === "discarded" ? "scenario" : "player",
      };
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
            : `${card(event.instanceId)}'s boost icons are cancelled.`,
        voice: "player",
      };
    case "defenderDeclared":
      return { text: `${card(event.defenderInstanceId)} defends.`, voice: "player" };
    case "defenseDeclined":
      return { text: `${who(event.playerId)} did not defend.`, voice: "player" };
    case "attackResolved":
      return {
        text: `${card(event.enemyInstanceId)} hit ${card(event.targetInstanceId)} for ${event.damageDealt} (ATK ${event.baseAtk} + ${event.boostIcons} boost − ${event.defenseReduction} defense).`,
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
    // The scheme half of the same breakdown, worded the same way. The third term only appears when something actually
    // changed the threat ("reduce the amount of threat placed … by 1"); an attack always has a defense term, a scheme
    // has no equivalent that is always present.
    case "schemeResolved":
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
      return { text: `The active villain is now ${card(event.to)}.`, voice: "villain" };
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
        text: `${card(event.instanceId)} gains surge — first of its kind revealed this round.`,
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
    // RRG 1.8 "Player Deck" (p. 33): a deck that empties reshuffles its discard pile at once, and the player is
    // dealt a facedown encounter card for it — a rule that used to run silently, with only the following draw or
    // discard-cost payment as any evidence it happened.
    case "playerDeckReset":
      return { text: `${possessive(event.playerId)} deck is shuffled from the discard pile.`, voice: "scenario" };
    case "cardPutIntoPlayFacedown":
      return { text: `A facedown ${event.as} entered play engaged with ${who(event.playerId)}.`, voice: "villain" };
    case "gameEnded":
      return {
        text: outcomeText(event.outcome),
        // A concession is neither a win nor a defeat (the RRG has no concede rule; see `GameOutcome`), so it takes
        // the neutral voice rather than being coloured as a loss.
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
      return { text: `${card(event.instanceId)} — ${short}.`, voice: "player" };
    }

    // Bookkeeping the player never reads: the stack, timing windows, trigger
    // announcements, per-card zone moves, and choice plumbing. The Inspect
    // overlay and the replay log carry these instead.
    default:
      return null;
  }
}

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

const outcomeText = (outcome: { readonly result: string; readonly reason: string }): string => {
  switch (outcome.reason) {
    case "villainDefeated":
      return "The villain is defeated. You win.";
    case "allVillainsDefeated":
      return "Every villain is defeated. You win.";
    case "mainSchemeCompleted":
      return "The main scheme completed. You lose.";
    case "playerConceded":
      return "The game was conceded.";
    default:
      return "Every hero is defeated. You lose.";
  }
};
