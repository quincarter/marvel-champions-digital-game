/**
 * "Exhaust this card and choose a non-Elite minion. Remove X evidence counters …, where X is equal to 2 less than that
 * minion's remaining hit points → discard that minion" (`AbilityCost.chooseTarget`; hero-pack spec H3.5): a card in
 * play the payer picks as part of the cost, bound for the rest of the cost and the effects. Which cards may be picked
 * and the check of the command's pick. `planCost` (`actions.ts`) calls these; `legalActions` offers one variant per
 * candidate (`legal.ts`). Nothing is paid: the pick is only a choice.
 */

import type { AbilityCost, EngineDeps } from "./abilities.js";
import type { CostChoices } from "./commands.js";
import type { EngineErrorCode } from "./errors.js";
import type { InstanceId, PlayerId } from "./ids.js";
import { cardsInPlay, type EffectContext, matchesQuery } from "./select.js";
import type { Bindings } from "./stack.js";
import type { GameState } from "./state.js";

type ChooseTargetCost = NonNullable<AbilityCost["chooseTarget"]>;

interface CostFault {
  readonly code: EngineErrorCode;
  readonly message: string;
}

/**
 * The cards a `chooseTarget` cost lets the payer pick: in play and matching the cost's query, read with the payer as
 * "you" and the ability's card as "self". Any player's card and an enemy alike (see `AbilityCost.chooseTarget`).
 */
export function chooseTargetCostChoices(
  state: GameState,
  deps: EngineDeps,
  sourceId: InstanceId,
  playerId: PlayerId,
  cost: ChooseTargetCost,
  bindings: Bindings = {},
): readonly InstanceId[] {
  const context: EffectContext = { selfInstanceId: sourceId, controllerId: playerId, event: null, bindings, deps };
  return cardsInPlay(state).filter((id) => matchesQuery(state, id, cost.query, context));
}

/**
 * Checks a `chooseTarget` cost against the command's pick (`choices[slot]`; forced with one candidate) and returns the
 * binding for it.
 */
export function planChooseTargetCost(
  state: GameState,
  deps: EngineDeps,
  sourceId: InstanceId,
  playerId: PlayerId,
  cost: ChooseTargetCost,
  choices: CostChoices,
  bindings: Bindings,
): Bindings | CostFault {
  const candidates = chooseTargetCostChoices(state, deps, sourceId, playerId, cost, bindings);
  const slot = cost.slot;
  if (candidates.length === 0) return { code: "no_valid_target", message: `nothing in play to choose for ${slot}` };
  const named = choices[slot] ?? (candidates.length === 1 ? candidates : undefined);
  if (!named) return { code: "invalid_choice", message: `choose the card for ${slot}` };
  const [pick, ...extra] = named;
  if (!pick || extra.length > 0) return { code: "invalid_choice", message: `choose exactly one card for ${slot}` };
  if (!candidates.includes(pick))
    return { code: "no_valid_target", message: `${pick} is not a legal choice for ${slot}` };
  return { [slot]: [pick] };
}
