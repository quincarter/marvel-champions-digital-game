/**
 * Which cards entered play after a triggering condition occurred (`TriggerEvent.enteredPlaySince`), so they do not
 * answer it (the owner's answer 43B, 2026-10-12, docs/phase7-wave10.md §4.0).
 *
 * RRG 1.8 "Triggering Condition" (p. 45): "A triggering condition is a specific occurrence that takes place in the
 * game … indicating the timing point at which the ability may be used." "Response" (p. 38): "Response abilities may
 * be resolved after the specified triggering condition occurs", once "per occurrence of the triggering condition".
 * "Ability" (p. 4): abilities on cards "may only be used if the card is in play". The RRG does not say in so many
 * words what a card that came into play between an occurrence and its response window may do; the owner's answer is
 * that the occurrence is not one of that card's: it was out of play at that timing point. The case that raised it: a "When Defeated" that reveals a side scheme reading "Forced
 * Response: After a character is defeated", during the very defeat it would answer.
 *
 * How it is recorded. Nothing is stamped on a card or an event until the rule has something to say: the moment a card
 * moves from out of play into play (`relocateCard`), every condition that has already occurred and whose response
 * window is still to open, or is open now, gets that card's id appended (`noteEnteredPlay`). The list travels with the
 * event wherever it waits (its event frame, a list of deferred, joined or held conditions, an open window), and
 * appears on the event in the log's `resolved` line and in the state, so a trace shows why a card in play was not
 * offered a response. `resolve/triggers.ts` reads it for the Response timing only.
 *
 * What keeps working, and why:
 * - **A card's own entering.** It moves into play first and its `cardEntersPlay`, `cardPlayed`, `cardAttached` or
 *   `cardRevealed` occurs afterwards, so nothing lists it. A card an event's own change puts into play (an attach
 *   still to come, made by its event's apply step) entered as part of that occurrence: `forgetEnteredWhileApplying`
 *   drops what the step itself listed on its own event.
 * - **When Revealed, When Defeated.** Not responses to a window; they resolve from their own steps.
 * - **A card put into play by an interrupt.** The condition had not occurred yet (its event had not applied), so the
 *   card is in play when it does.
 * - **Interrupts.** An interrupt window opens before its condition occurs; the list is never read for one.
 *
 * When a condition "occurs". An event's apply step makes its change, and for most events that is the occurrence: the
 * damage is taken, the character is defeated, the card has entered play. What apply pushes after it (a defeated card's
 * When Defeated abilities, an overkill spill) follows the occurrence. A few events are procedures instead: their
 * apply step starts steps that resolve on the stack, and "after [it]" is after the last of them (RRG 1.8 "Attack
 * (Enemy Activation)", p. 9, step 6: the abilities that trigger after an attack, once it has resolved). Those
 * (`PROCEDURES`) have occurred only once their response stage is reached, so a card that came into play while an
 * attack resolved was in play when it finished and answers "after … attacks". The same goes for the conditions an
 * activation holds for its own end (`deferredResponses`: RRG 1.8 "Defend, Defense", p. 16).
 *
 * A place that holds an occurred condition and is not listed here fails open: the card answers, as every card did
 * before this rule.
 *
 * A card replaced in its own slot (`noteReplacedInPlay`). A main scheme advance keeps the scheme's instance id, but RRG
 * 1.8 "Main Scheme, Main Scheme Deck" (p. 27) step 1 removes the old card from the game and the next card, out of play
 * until then ("In Play and Out of Play", p. 23: only the faceup side of the top main scheme card is in play), becomes
 * the scheme. So the new stage entered play like any other card, and more: a procedure already under way that named
 * the id (a thwart of the old stage, `eventSubjects`) named a card that has since left play, so the new stage does not
 * answer it either, even though a procedure's "after" is otherwise heard by a card that entered while it resolved. A
 * "(thwart)" ability's one thwart carries what its instances were marked with to its resolved event
 * (`ThwartSession.enteredPlaySince`), unless a later instance of it removed threat from the new stage: then it
 * thwarted that card too, and the new stage answers it.
 *
 * The marking is by card, for the whole procedure: the new stage answers none of its abilities to that procedure,
 * so a generic "after a player thwarts" on the new stage is not heard for the old stage's thwart either (it was out of
 * play when that thwart was made, as for any condition it missed).
 */

import type { InstanceId } from "./ids.js";
import type { StackFrame } from "./stack.js";
import type { GameState, ZoneId } from "./state.js";
import { eventSubjects, type TriggerEvent } from "./trigger-events.js";

/**
 * Events whose apply step starts a procedure that resolves on the stack: the condition has occurred when the
 * procedure has finished (the frame's response stage), not when it started.
 */
const PROCEDURES: ReadonlySet<TriggerEvent["kind"]> = new Set<TriggerEvent["kind"]>([
  "attack",
  "thwart",
  "enemyAttack",
  "enemyScheme",
  "enemyAttacksEnemy",
  "enemyActivating",
  "defended",
  "characterWouldAct",
  "turnEnding",
  "phaseEnding",
  "surgeResolving",
  "mainSchemeCompleting",
  "mainSchemeTurnsToB",
  "encounterCardFromPlayerDeck",
]);

const IN_PLAY_ZONES: ReadonlySet<ZoneId["kind"]> = new Set<ZoneId["kind"]>([
  "playArea",
  "villainArea",
  "attachment",
  "scenarioPlayArea",
  "identity",
]);

/**
 * Whether a move from `from` to `to` brings a card into play from out of play. Read off the zones alone: a card
 * attached facedown, or to a host that is itself out of play, is listed although it is not in play yet, which is
 * harmless (it answers nothing while out of play, and is late all the same if it comes into play afterwards).
 */
export const movesIntoPlay = (from: ZoneId | null, to: ZoneId): boolean =>
  IN_PLAY_ZONES.has(to.kind) && (from === null || !IN_PLAY_ZONES.has(from.kind));

/** Whether `id` entered play after `event` occurred, and so does not answer it in a response window. */
export const enteredPlaySince = (event: TriggerEvent, id: InstanceId): boolean =>
  event.enteredPlaySince !== undefined && event.enteredPlaySince.includes(id);

/**
 * `id` has just entered play: it is listed on every condition on the stack that has already occurred and still has
 * its response window to come or open (the module docblock says which those are). Returns the same state when there
 * is none, which is every entry made with nothing pending.
 */
export function noteEnteredPlay(state: GameState, id: InstanceId): GameState {
  return note(state, id, false);
}

/**
 * `id` keeps its instance but is a new card in play: a main scheme's next stage (the module docblock). What
 * `noteEnteredPlay` lists, and also each procedure already under way that names `id`, with what is held for it.
 */
export function noteReplacedInPlay(state: GameState, id: InstanceId): GameState {
  return note(state, id, true);
}

/** Whether `event` is about the card `id` (a source or a target of it). */
const names = (event: TriggerEvent, id: InstanceId): boolean => {
  const subjects = eventSubjects(event);
  return subjects.sources.includes(id) || subjects.targets.includes(id);
};

function note(state: GameState, id: InstanceId, replaced: boolean): GameState {
  if (state.stack.length === 0) return state;
  let changed = false;
  const mark = <E extends TriggerEvent>(event: E): E => {
    if (enteredPlaySince(event, id)) return event;
    changed = true;
    return { ...event, enteredPlaySince: [...(event.enteredPlaySince ?? []), id] };
  };
  const markAll = (events: readonly TriggerEvent[]): readonly TriggerEvent[] => events.map(mark);

  const stack = state.stack.map((frame): StackFrame => {
    switch (frame.kind) {
      case "event": {
        // `responses` with its apply step done: occurred, unless it is a procedure still resolving above this frame.
        // A replaced card: a procedure under way that named it named the card that left (`noteReplacedInPlay`).
        const occurred =
          frame.stage === "responses" && (!PROCEDURES.has(frame.event.kind) || (replaced && names(frame.event, id)));
        // Future-proofing: only "after … defends" and `basicPowerUsed` are held for an activation's end today, and a
        // main scheme advance names neither, but a held condition about the replaced card is no more the new card's.
        const held = replaced ? frame.deferredResponses?.filter((event) => names(event, id)) : undefined;
        const lists =
          frame.joinedResponses !== undefined ||
          frame.announceAfter !== undefined ||
          frame.keywordsIgnored !== undefined ||
          (held !== undefined && held.length > 0);
        if (!occurred && !lists) return frame;
        return {
          ...frame,
          ...(occurred ? { event: mark(frame.event) } : {}),
          ...(held !== undefined && held.length > 0
            ? { deferredResponses: frame.deferredResponses!.map((e) => (names(e, id) ? mark(e) : e)) }
            : {}),
          ...(frame.joinedResponses !== undefined ? { joinedResponses: markAll(frame.joinedResponses) } : {}),
          ...(frame.announceAfter !== undefined ? { announceAfter: markAll(frame.announceAfter) } : {}),
          ...(frame.keywordsIgnored !== undefined ? { keywordsIgnored: markAll(frame.keywordsIgnored) } : {}),
        };
      }
      case "window": {
        if (frame.timing !== "response") return frame;
        return {
          ...frame,
          event: mark(frame.event),
          ...(frame.alsoEvents !== undefined ? { alsoEvents: markAll(frame.alsoEvents) } : {}),
        };
      }
      case "reveal":
        return frame.heldResponses !== undefined ? { ...frame, heldResponses: markAll(frame.heldResponses) } : frame;
      case "damageGroup": {
        if (frame.stage !== "responses") return frame;
        return {
          ...frame,
          members: frame.members.map((member) =>
            member.cancelled ? member : { ...member, event: mark(member.event) },
          ),
        };
      }
      case "effects": {
        // A "(thwart)" ability's one thwart, still to be announced, that thwarted the replaced card.
        const session = frame.thwart;
        const thwarted =
          replaced &&
          session !== undefined &&
          !session.announced &&
          session.instances.some((instance) => instance.schemeInstanceId === id) &&
          !session.enteredPlaySince?.includes(id);
        if (thwarted) changed = true;
        const marked: typeof frame = thwarted
          ? { ...frame, thwart: { ...session, enteredPlaySince: [...(session.enteredPlaySince ?? []), id] } }
          : frame;
        // Characters defeated together (`resolve/defeated-together.ts`): each defeat that has happened.
        const step = marked.effects[marked.cursor];
        if (step?.kind !== "defeatedTogether" || step.stage === "apply") return marked;
        const members = step.members.map((member) =>
          member.defeated && !member.cancelled ? { ...member, event: mark(member.event) } : member,
        );
        return { ...marked, effects: marked.effects.map((e, i) => (i === marked.cursor ? { ...step, members } : e)) };
      }
      default:
        return frame;
    }
  });
  return changed ? { ...state, stack } : state;
}

/**
 * An event's apply step has just run: the cards it put into play itself entered as part of the occurrence, not after
 * it, so its own event's list goes back to what it was before the step (`before`). Conditions that had occurred
 * earlier keep the cards the step listed on them.
 */
export function forgetEnteredWhileApplying(frame: StackFrame, before: readonly InstanceId[] | undefined): StackFrame {
  if (frame.kind !== "event" || frame.event.enteredPlaySince === before) return frame;
  const { enteredPlaySince: _listed, ...event } = frame.event;
  return { ...frame, event: before === undefined ? event : { ...event, enteredPlaySince: before } };
}
