/** The player declares the wilds of a payment just made: the step a play frame and an ability frame share. */

import { type Ctx, emit, requestChoice, setFrame } from "../ctx.js";
import type { PlayerId } from "../ids.js";
import {
  declaredPool,
  paidSetOptionId,
  paidSetsAsDeclared,
  paidTypesReading,
  poolTotal,
  RESOURCE_TYPES,
  wildDeclarationFault,
  wildTypeOptionId,
  wildTypesFromOptionIds,
  type ResourcePool,
  type ResourceType,
} from "../resources.js";
import { paidAsVars, type UndeclaredWilds } from "../stack.js";
import type { Frame } from "./frames.js";

/** A set of paid resources in words, for a `choosePaidResources` option: "1 physical, 2 mental". */
const describePaidSet = (paid: ResourcePool): string =>
  RESOURCE_TYPES.filter((type) => paid[type] > 0)
    .map((type) => `${paid[type]} ${type}`)
    .join(", ");

/**
 * The player declares the wilds of the payment just made for this card or this ability (docs/phase7-wave8.md §3.62,
 * §4.1 Q33 = B; RRG 1.8 "Wild Resource", p. 48). Asked by the frame the payment paid for: a play's own frame, so the
 * command, a timing window's payment and an effect's payment all reach it, or an ability's frame, for an action
 * (`useAbility`) and for an interrupt or response paid inside a window. It is asked before the card enters play or
 * the ability resolves anything, so every reader of the payment reads the declaration. The frame is below the
 * payment's own announcements (`announceResourcesSpent`), which do not read a wild's type: a wild is only a wild
 * outside the cost it pays (p. 48).
 *
 * Answered, the paid resources are the ones that give the most declared types (`paidSetsAsDeclared`; §4.1 Q34 = A and
 * its follow-up), recorded as `paid.as.<type>` and logged. `resolveChoice` has already refused an illegal declaration;
 * one that is illegal here all the same is asked again.
 *
 * **Which resources were paid** (owner decision, 2026-10-08, §4.1 row 79; RRG 1.8 "Cost", p. 13, says overpaid
 * resources "were not paid" without saying which they are). When several sets give as many types and the payment's
 * readers (`UndeclaredWilds.reads`) read them differently, the player chooses the set in a second choice
 * (`choosePaidResources`), asked by this same frame once the wilds are declared (`UndeclaredWilds.declared`, which is
 * all a payment with no wild, or with its wilds declared on the command, waits here for). When every set reads the
 * same the first is taken and nobody is asked.
 */
export function declareWildTypes(
  ctx: Ctx,
  frame: Frame<"playCard"> | Frame<"ability">,
  playerId: PlayerId,
  undeclared: UndeclaredWilds,
): void {
  const { pool, requirement, only, reads = [] } = undeclared;
  const abilityId = frame.kind === "ability" ? frame.abilityId : undefined;
  const named = abilityId ? { instanceId: frame.instanceId, abilityId } : { instanceId: frame.instanceId };
  const setsOf = (types: readonly ResourceType[]): readonly ResourcePool[] =>
    wildDeclarationFault(pool, types, requirement, only) === null
      ? paidSetsAsDeclared(declaredPool(pool, types), requirement)
      : [];

  // The wilds: as recorded, or this answer.
  const answered = undeclared.declared === undefined && frame.answer !== null;
  const types = undeclared.declared?.types ?? (answered ? wildTypesFromOptionIds(frame.answer ?? [], pool.wild) : null);
  const sets = types ? setsOf(types) : [];
  const [first] = sets;
  if (!types || !first) {
    setFrame(ctx, { ...frame, answer: null });
    const order: readonly ResourceType[] = ["energy", "mental", "physical", "wild"];
    requestChoice(ctx, {
      playerId,
      prompt: {
        kind: "declareWildTypes",
        ...named,
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
  const declared = undeclared.declared ?? { types, skipped: false };

  // The paid resources: the one reading there is, or the set this answer names.
  const tied = new Set(sets.map((paid) => paidTypesReading(paid, reads))).size > 1;
  const [picked] = !answered && frame.answer?.length === 1 ? frame.answer : [];
  const chosen = tied ? sets.find((paid) => paidSetOptionId(paid) === picked) : first;
  if (!chosen) {
    setFrame(ctx, { ...frame, answer: null, undeclaredWilds: { ...undeclared, declared } });
    requestChoice(ctx, {
      playerId,
      prompt: {
        kind: "choosePaidResources",
        ...named,
        pool: declaredPool(pool, declared.types),
        paidCount: poolTotal(first),
        sets,
      },
      options: sets.map((paid) => ({
        optionId: paidSetOptionId(paid),
        label: `Paid: ${describePaidSet(paid)}`,
        ref: { kind: "none" as const },
      })),
      minSelections: 1,
      maxSelections: 1,
      frameId: frame.frameId,
    });
    return;
  }
  const { undeclaredWilds: _asked, ...rest } = frame;
  setFrame(ctx, { ...rest, answer: null, vars: { ...frame.vars, ...paidAsVars(chosen) } });
  if (declared.types.length > 0) {
    emit(ctx, {
      type: "wildTypesDeclared",
      playerId,
      ...named,
      declared: declared.types,
      skipped: declared.skipped,
      paidAs: chosen,
    });
  }
  if (tied) {
    const all = declaredPool(pool, declared.types);
    const overpaidAs = { ...all };
    for (const type of RESOURCE_TYPES) overpaidAs[type] -= chosen[type];
    emit(ctx, { type: "paidResourcesChosen", playerId, ...named, paidAs: chosen, overpaidAs });
  }
}
