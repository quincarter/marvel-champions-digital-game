/**
 * "Why not the others?" — the cards an open choice could plausibly have offered, and the clause that excluded each.
 *
 * `legalActions` answers this for top-level commands (`blockedTargets`), but it cannot for a pending choice: while one
 * is open it returns the choice and nothing else, and a `PendingChoice`'s `options` are built from the *already
 * filtered* legal set, so an illegal target is simply absent with no record of why. This recovers the record without
 * putting a new field on `PendingChoice`: the choice names the frame it belongs to, that frame still has the effect
 * that requested it under its cursor, and the context it evaluated in is rebuildable from the frame itself.
 *
 * It reports **codes, not sentences**. These are the names of the clauses in `explainQuery` (and of the three
 * conditions `legalDefenders` filters on), and the engine has no player-facing copy for them — unlike
 * `EngineError.message`, which is written for exactly that. A client keeps one small code→wording table.
 *
 * A prompt with no meaningful universe of candidates returns `[]`: honestly empty, never a fabricated reason.
 */

import { DEFAULT_DEPS, type EngineDeps } from "./abilities.js";
import { type DefenseBar, defenseBarFor, windowDefenseBar } from "./defense-claim.js";
import { deckTopPermission, playsOwnCardFromHand } from "./actions.js";
import type { InstanceId, PlayerId } from "./ids.js";
import { cardOf, getInstance, playerOrder } from "./query.js";
import { contextOf } from "./resolve/effects-frame.js";
import { defenseCostPayable, legalDefenders } from "./resolve/enemy-activation.js";
import { defenseBarredCandidates } from "./resolve/triggers.js";
import { attackTargetAllowed, slotTargetValid } from "./resolve/target-validity.js";
import { cannotDefend, mustDefendWithAlly } from "./rules.js";
import { cardsInPlay, controllerOf, explainQuery, isAlly, type QueryExclusion } from "./select.js";
import type { GameState } from "./state.js";

/**
 * Why a card the deciding player can see was not among the options.
 *
 * The `QueryExclusion` half comes from the query filter itself; the rest are the conditions that build a defend
 * prompt's option list (RRG 1.8 "Attack (Enemy Activation)" step 2, p. 9; "Defend, Defense", p. 16).
 */
export type ExclusionCode =
  | QueryExclusion
  /** Not in play at all. */
  | "notInPlay"
  /** An identity in alter-ego form cannot defend (p. 16: a *hero* or ally exhausts to defend). */
  | "alterEgoForm"
  /** Only a hero or an ally may be declared the defender. */
  | "notHeroOrAlly"
  /** A "(defense)" ability already made someone the defender, so nobody else may defend this attack (p. 16). */
  | "defenderAlreadyDeclared"
  /**
   * The attack in progress is closed to this card's player (RRG 1.8 "Defend, Defense", pp. 14-15; `defenseBarFor`):
   * `anotherPlayerDefending`, "While a player is defending, other players cannot defend against that same attack";
   * `anotherPlayerUsedDefense`, "Once a player resolves a defense-labeled ability during an enemy attack, other
   * players cannot resolve defense-labeled abilities for that same attack". Reported for a character left out of a
   * defend prompt and for a "(defense)" card or ability left out of a `chooseTriggers` prompt, where the card may be
   * in the player's hand rather than in play.
   */
  | DefenseBar
  /** "Must defend with an ally they control, if able": only the engaged player's ready allies are offered. */
  | "mustDefendWithAlly"
  /** "Vision cannot attack or defend." (`RuleSpec cannotDefend`, docs/phase7-wave4.md §3.31). */
  | "cannotDefend"
  /**
   * A scheme the choice's query matches that the thwart or threat removal it is chosen for cannot remove threat from
   * right now (a move of threat off it included: RRG 1.8 "Move", p. 30), so it is not a valid target (RRG 1.8
   * "Target", pp. 42–43): "Characters other than [X] cannot remove
   * threat from [this scheme]" (`RuleSpec threatCannotBeRemoved.exceptBy`, docs/phase7-wave7.md §3.51), and equally a
   * crisis icon, an engaged patrol minion or a `cannotThwart` rule.
   */
  | "cannotRemoveThreat"
  /**
   * The top card of the deciding player's deck, which a `playableTopOfDeck` permission lets them play "as if it was in
   * your hand", was left out because the permission's limit is used ("once per phase"; docs/phase7-wave8.md §3.49,
   * RRG 1.8 "Limit", p. 27). Reported for a "play a card from your hand" card choice and for a `chooseTriggers`
   * prompt whose timing the card could have been played in. Not reported while no permission is in force (the other
   * form, a blank text box): the card is then simply in the deck.
   */
  | "deckTopPlayLimitUsed";

export interface ChoiceExclusion {
  readonly instanceId: InstanceId;
  readonly reason: ExclusionCode;
}

/** The cards the open choice is offering, as a set, so the universe can be narrowed to what it left out. */
const offeredIds = (state: GameState): ReadonlySet<string> =>
  new Set(
    (state.pendingChoice?.options ?? []).flatMap((option) =>
      option.ref.kind === "card" ? [option.ref.instanceId as string] : [],
    ),
  );

/**
 * Every card in play that the open choice did not offer, each labeled with the clause that rejected it.
 *
 * Empty unless the open prompt is one whose universe is "the cards in play": a `chooseTarget` (and the attachment
 * variant of it), or a defend prompt. A `chooseTriggers` prompt reports only the "(defense)" cards and abilities the
 * attack in progress is closed to (`defenseTriggerExclusions`).
 */
export function choiceExclusions(state: GameState, deps: EngineDeps = DEFAULT_DEPS): readonly ChoiceExclusion[] {
  const choice = state.pendingChoice;
  if (!choice) return [];
  const offered = offeredIds(state);

  if (choice.prompt.kind === "declareDefender") return defenderExclusions(state, deps, offered);
  if (choice.prompt.kind === "chooseTriggers")
    return [...defenseTriggerExclusions(state, deps), ...deckTopTriggerExclusions(state, deps)];
  const frame = state.stack.find((f) => f.frameId === choice.frameId);
  if (choice.prompt.kind === "chooseCards") {
    // "Play a card from your hand": the card choice of `EffectSpec playFromHand` from the hand.
    const asking = frame?.kind === "effects" ? frame.effects[frame.cursor] : undefined;
    if (asking?.kind !== "playFromHand" || (asking.from ?? "hand") !== "hand") return [];
    const used = usedDeckTop(state, deps, choice.playerId);
    return used ? [{ instanceId: used, reason: "deckTopPlayLimitUsed" }] : [];
  }
  if (choice.prompt.kind !== "chooseTarget") return [];

  if (frame?.kind !== "effects") return [];
  // `requestTargetChoice` parks the choice *without* advancing the cursor, so the effect that asked is still here.
  const effect = frame.effects[frame.cursor];
  if (!effect || effect.kind !== "chooseTarget") return [];

  const context = contextOf(frame, deps);
  // The rest of the program, which the offer judged each candidate against (`requestTargetChoice`): a scheme the
  // query matched but a thwart or removal aimed at the chosen slot cannot take threat from was left out there.
  const rest = frame.effects.slice(frame.cursor + 1);
  const removesThreat = rest.some((next) => {
    if (next.kind === "moveThreat") return next.from.kind === "slot" && next.from.slot === effect.slot;
    return (
      (next.kind === "thwart" || next.kind === "removeThreat") &&
      next.target.kind === "slot" &&
      next.target.slot === effect.slot
    );
  });
  const movesFromSlot = rest.some(
    (next) => next.kind === "moveThreat" && next.from.kind === "slot" && next.from.slot === effect.slot,
  );
  const exclusions: ChoiceExclusion[] = [];
  for (const id of cardsInPlay(state)) {
    if (offered.has(id)) continue;
    const reason = explainQuery(state, id, effect.query, context);
    if (reason !== null) exclusions.push({ instanceId: id, reason });
    // A scheme with no threat is no source for a move either (RRG 1.8 "Move", p. 30); that is not a removal bar, so
    // it is left unreported rather than given this code.
    else if (
      removesThreat &&
      !slotTargetValid(state, deps, rest, effect.slot, id, context) &&
      (!movesFromSlot || (getInstance(state, id)?.threat ?? 0) > 0)
    ) {
      exclusions.push({ instanceId: id, reason: "cannotRemoveThreat" });
    }
    // An enemy an "(attack)" ability would attack through this slot that its player's identity may not attack (guard;
    // owner ruling Q49, `attackTargetAllowed`): the same code an `attackableBy` query gives.
    else if (!attackTargetAllowed(state, deps, rest, effect.slot, id, context)) {
      exclusions.push({ instanceId: id, reason: "cannotBeAttacked" });
    }
  }
  return exclusions;
}

/** The top card of the player's deck when a `playableTopOfDeck` permission stands over it with its limit used. */
function usedDeckTop(state: GameState, deps: EngineDeps, playerId: PlayerId): InstanceId | null {
  const permission = deckTopPermission(state, deps, playerId);
  return permission?.limitUsed ? permission.instanceId : null;
}

/**
 * A `chooseTriggers` prompt's missing top-of-deck card: the permission's limit is used, and the card is one that could
 * be played in a window of this timing (an event with an interrupt or response of that timing, or an in-hand ability
 * that plays its own card). Whether its trigger matched this occurrence is not judged: the limit excluded it first.
 */
function deckTopTriggerExclusions(state: GameState, deps: EngineDeps): readonly ChoiceExclusion[] {
  const choice = state.pendingChoice;
  if (!choice || choice.prompt.kind !== "chooseTriggers") return [];
  const timing = choice.prompt.timing;
  const used = usedDeckTop(state, deps, choice.playerId);
  const card = used ? cardOf(state, used) : undefined;
  if (!used || !card || !("abilities" in card)) return [];
  const playedHere = card.abilities.some((ref) => {
    const definition = deps.abilities[ref.id];
    if (!definition || definition.trigger.kind !== timing || definition.trigger.forced) return false;
    return definition.activeIn === "hand" ? playsOwnCardFromHand(definition) : card.type === "event";
  });
  return playedHere ? [{ instanceId: used, reason: "deckTopPlayLimitUsed" }] : [];
}

/**
 * The defend prompt's own three filters, reported the same way (`resolve/enemy-activation.ts`): who may defend at all,
 * then whether a "(defense)" defender has already been declared, then whether an ally is compulsory.
 */
function defenderExclusions(
  state: GameState,
  deps: EngineDeps,
  offered: ReadonlySet<string>,
): readonly ChoiceExclusion[] {
  const choice = state.pendingChoice;
  const frame = choice ? state.stack.find((f) => f.frameId === choice.frameId) : undefined;
  if (frame?.kind !== "enemyAttack") return [];

  const eligible = new Set<string>(legalDefenders(state, frame.attackedPlayerId, deps, frame.enemyInstanceId));
  const existing = frame.defenderInstanceId;
  const forcedAlly =
    existing === null &&
    mustDefendWithAlly(state, deps, frame.enemyInstanceId) &&
    [...eligible].some(
      (id) => isAlly(state, id as InstanceId) && controllerOf(state, id as InstanceId) === frame.attackedPlayerId,
    );

  const exclusions: ChoiceExclusion[] = [];
  for (const id of cardsInPlay(state)) {
    if (offered.has(id)) continue;
    const card = cardOf(state, id);
    const isIdentity = state.players.some((player) => player.identity.instanceId === id);
    if (!isIdentity && card?.type !== "ally") continue; // Not a candidate in any sense; no reason to report.
    // The same order the option list is built in: who may defend at all, then the two narrowings.
    if (!eligible.has(id)) {
      const owner = playerOrder(state).find((player) => player.identity.instanceId === id);
      if (owner && owner.identity.form !== "hero") exclusions.push({ instanceId: id, reason: "alterEgoForm" });
      else if (state.instances[id]?.exhausted) exclusions.push({ instanceId: id, reason: "exhausted" });
      else if (cannotDefend(state, deps, id, frame.enemyInstanceId))
        exclusions.push({ instanceId: id, reason: "cannotDefend" });
      else exclusions.push({ instanceId: id, reason: "notHeroOrAlly" });
      continue;
    }
    // A character of another player's than the one defending, or the one who used a "(defense)" ability.
    const barred = defenseBarFor(state, controllerOf(state, id));
    if (barred !== null) exclusions.push({ instanceId: id, reason: barred });
    // Its controller cannot pay the additional cost to defend with it, or was asked during this step and did not
    // (`RuleSpec additionalPowerCost`, docs/phase7-wave9.md §3.31). Reported under the nearest existing code.
    else if (!defenseCostPayable(state, deps, id) || frame.defendersNotPaidFor?.includes(id))
      exclusions.push({ instanceId: id, reason: "cannotDefend" });
    else if (existing !== null) exclusions.push({ instanceId: id, reason: "defenderAlreadyDeclared" });
    else if (forcedAlly) exclusions.push({ instanceId: id, reason: "mustDefendWithAlly" });
  }
  return exclusions;
}

/**
 * The deciding player's "(defense)" cards and abilities a `chooseTriggers` prompt left out because the attack is
 * closed to them: those the window never gathered (`defenseBarredCandidates`), and those held back because an earlier
 * player's pick in this window is still queued (`windowDefenseBar`).
 */
function defenseTriggerExclusions(state: GameState, deps: EngineDeps): readonly ChoiceExclusion[] {
  const choice = state.pendingChoice;
  const frame = choice ? state.stack.find((f) => f.frameId === choice.frameId) : undefined;
  if (!choice || frame?.kind !== "window") return [];
  const found = new Map<InstanceId, DefenseBar>();
  for (const event of [...(frame.alsoEvents ?? []), frame.event]) {
    for (const { candidate, reason } of defenseBarredCandidates(state, deps, event, frame.timing, false)) {
      if (candidate.controllerId === choice.playerId && !found.has(candidate.instanceId))
        found.set(candidate.instanceId, reason);
    }
  }
  for (const candidate of frame.pending) {
    if (candidate.controllerId !== choice.playerId || found.has(candidate.instanceId)) continue;
    const reason = windowDefenseBar(state, deps, frame.queue, candidate);
    if (reason !== null) found.set(candidate.instanceId, reason);
  }
  return [...found].map(([instanceId, reason]) => ({ instanceId, reason }));
}
