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
import type { InstanceId } from "./ids.js";
import { cardOf, playerOrder } from "./query.js";
import { contextOf } from "./resolve/effects-frame.js";
import { legalDefenders } from "./resolve/enemy-activation.js";
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
  /** "Must defend with an ally they control, if able": only the engaged player's ready allies are offered. */
  | "mustDefendWithAlly"
  /** "Vision cannot attack or defend." (`RuleSpec cannotDefend`, docs/phase7-wave4.md §3.31). */
  | "cannotDefend";

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
 * Every card in play that the open choice did not offer, each labelled with the clause that rejected it.
 *
 * Empty unless the open prompt is one whose universe is "the cards in play": a `chooseTarget` (and the attachment
 * variant of it), or a defend prompt.
 */
export function choiceExclusions(state: GameState, deps: EngineDeps = DEFAULT_DEPS): readonly ChoiceExclusion[] {
  const choice = state.pendingChoice;
  if (!choice) return [];
  const offered = offeredIds(state);

  if (choice.prompt.kind === "declareDefender") return defenderExclusions(state, deps, offered);
  if (choice.prompt.kind !== "chooseTarget") return [];

  const frame = state.stack.find((f) => f.frameId === choice.frameId);
  if (frame?.kind !== "effects") return [];
  // `requestTargetChoice` parks the choice *without* advancing the cursor, so the effect that asked is still here.
  const effect = frame.effects[frame.cursor];
  if (!effect || effect.kind !== "chooseTarget") return [];

  const context = contextOf(frame, deps);
  const exclusions: ChoiceExclusion[] = [];
  for (const id of cardsInPlay(state)) {
    if (offered.has(id)) continue;
    const reason = explainQuery(state, id, effect.query, context);
    if (reason !== null) exclusions.push({ instanceId: id, reason });
  }
  return exclusions;
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
    if (existing !== null) exclusions.push({ instanceId: id, reason: "defenderAlreadyDeclared" });
    else if (forcedAlly) exclusions.push({ instanceId: id, reason: "mustDefendWithAlly" });
  }
  return exclusions;
}
