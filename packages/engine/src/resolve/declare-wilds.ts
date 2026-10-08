/** The player declares the wilds of a payment just made: the step a play frame and an ability frame share. */

import { type Ctx, emit, requestChoice, setFrame } from "../ctx.js";
import type { PlayerId } from "../ids.js";
import {
  declaredPool,
  paidAsDeclared,
  wildDeclarationFault,
  wildTypeOptionId,
  wildTypesFromOptionIds,
  type ResourceType,
} from "../resources.js";
import { paidAsVars, type UndeclaredWilds } from "../stack.js";
import type { Frame } from "./frames.js";

/**
 * The player declares the wilds of the payment just made for this card or this ability (docs/phase7-wave8.md §3.62,
 * §4.1 Q33 = B; RRG 1.8 "Wild Resource", p. 48). Asked by the frame the payment paid for: a play's own frame, so the
 * command, a timing window's payment and an effect's payment all reach it, or an ability's frame, for an action
 * (`useAbility`) and for an interrupt or response paid inside a window. It is asked before the card enters play or
 * the ability resolves anything, so every reader of the payment reads the declaration. The frame is below the
 * payment's own announcements (`announceResourcesSpent`), which do not read a wild's type: a wild is only a wild
 * outside the cost it pays (p. 48).
 *
 * Answered, the paid resources are the ones that give the most declared types (`paidAsDeclared`; §4.1 Q34 = A and its
 * follow-up), recorded as `paid.as.<type>` and logged. Against a cost the player sized (`ResourcesChoice`) nothing is
 * overpaid, so they are the whole pool and nothing is selected. `resolveChoice` has already refused an illegal
 * declaration; one that is illegal here all the same is asked again.
 */
export function declareWildTypes(
  ctx: Ctx,
  frame: Frame<"playCard"> | Frame<"ability">,
  playerId: PlayerId,
  undeclared: UndeclaredWilds,
): void {
  const { pool, requirement, only } = undeclared;
  const abilityId = frame.kind === "ability" ? frame.abilityId : undefined;
  const declared = frame.answer === null ? null : wildTypesFromOptionIds(frame.answer, pool.wild);
  const paidAs =
    declared && wildDeclarationFault(pool, declared, requirement, only) === null
      ? paidAsDeclared(declaredPool(pool, declared), requirement)
      : null;
  if (!declared || !paidAs) {
    setFrame(ctx, { ...frame, answer: null });
    const order: readonly ResourceType[] = ["energy", "mental", "physical", "wild"];
    requestChoice(ctx, {
      playerId,
      prompt: {
        kind: "declareWildTypes",
        instanceId: frame.instanceId,
        ...(abilityId ? { abilityId } : {}),
        wilds: pool.wild,
        pool,
        requirement,
        ...(only ? { only } : {}),
      },
      options: Array.from({ length: pool.wild }, (_, index) =>
        order.map((type) => ({
          optionId: wildTypeOptionId(index, type),
          label: `Wild ${index + 1}: ${type}`,
          ref: { kind: "none" as const },
        })),
      ).flat(),
      minSelections: pool.wild,
      maxSelections: pool.wild,
      frameId: frame.frameId,
    });
    return;
  }
  const { undeclaredWilds: _asked, ...rest } = frame;
  setFrame(ctx, { ...rest, answer: null, vars: { ...frame.vars, ...paidAsVars(paidAs) } });
  emit(ctx, {
    type: "wildTypesDeclared",
    playerId,
    instanceId: frame.instanceId,
    ...(abilityId ? { abilityId } : {}),
    declared,
    skipped: false,
    paidAs,
  });
}
