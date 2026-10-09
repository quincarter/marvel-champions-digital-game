/**
 * `EffectSpec basicPowerBy` (docs/phase7-wave8.md §3.64): "that player makes a basic attack or thwart with a character
 * they control. That character gets +1 THW and +1 ATK for this use." (Cell Phone, `jubilee` 47019.)
 *
 * One effect step that needs up to three answers and then waits for the power to finish, so it runs as a small state
 * machine on the frame's own vars (`_power.step`), the way `playFromHand` does:
 *
 * 0. choose the character and the power;
 * 1. choose the target, or several for a character who may divide the power;
 * 4. (several targets only) divide the power among them;
 * 2. pay the power's own additional cost, if it has one (the cards a "discard N cards from your hand" part is paid
 *    with, then its resources), then declare the power;
 * 3. (after everything the power pushed has resolved) end a bonus the power never started.
 *
 * The power itself is the ordinary command (`basicAttack` / `basicThwart` with `BasicPowerBy.instructed`), declared
 * from here with this effects frame beneath it: nothing about how a basic power resolves is restated.
 *
 * **A divided basic power** (owner decision, 2026-10-08, docs/phase7-wave8.md §4.1 row 82): a character who may
 * divide its basic power (`RuleSpec divideBasicPower`: "Wasp may divide her basic attack among any number of
 * enemies") may divide it when a card has them make it. The card says "makes a basic attack or thwart", and RRG 1.8
 * FAQ "Wasp (#1C)" (p. 61) treats her divided attack as her basic attack; no official source speaks of a basic power
 * made on a card's instruction. The command carries the division (`divide`) and checks it as it checks the player's
 * own: distinct legal targets, shares of at least 1 that total the stat for this use, the +1 included
 * (`dividedBasicPowerValue`). A thwart made with ATK by the player's choice is not divided, as on their own turn.
 */

import {
  basicAttack,
  basicThwart,
  dividedBasicPowerValue,
  handDiscardCandidates,
  paymentOptions,
  paymentsFromOptionIds,
} from "../actions.js";
import {
  basicPowerCommand,
  basicPowerCostNeeds,
  basicPowerUses,
  type BasicPowerKind,
  type BasicPowerUse,
} from "../basic-power-uses.js";
import type { ChoiceOption } from "../choices.js";
import { type Ctx, createCtx, emit, requestChoice, setFrame } from "../ctx.js";
import type { BasicPowerShare } from "../commands.js";
import { addLastingEffect, endLastingEffect, lastingEffectIdOf } from "../effects.js";
import type { InstanceId } from "../ids.js";
import { hasKeyword } from "../keywords.js";
import type { LastingScope } from "../lasting.js";
import { mustCardOf } from "../query.js";
import { requirementTotal } from "../resources.js";
import { canDivideBasicPower } from "../rules.js";
import { type EffectContext, resolvePlayers } from "../select.js";
import type { EffectSpec } from "../spec.js";
import type { Frame } from "./frames.js";

const STEP = "_power.step";
const POWER = "_power.kind";
const WITH_ATK = "_power.atk";
const FIRST_LASTING = "_power.lasting";
const LASTING_COUNT = "_power.lastings";
const CHARACTER = "_power.character";
const TARGET = "_power.target";
/** The share of the n-th target of a divided power (`_power.share.<n>`), in the order of `TARGET`. */
const SHARE = "_power.share.";
/** The cards from hand picked to pay the power's own "discard N cards from your hand" cost. */
const DISCARD = "_power.discard";
const ATK_SUFFIX = "#atk";

const powerOptionId = (use: BasicPowerUse): string => `${use.power}:${use.characterInstanceId}`;
const targetOptionId = (use: BasicPowerUse): string =>
  use.useAtk ? `${use.targetInstanceId}${ATK_SUFFIX}` : use.targetInstanceId;

export function executeBasicPowerBy(
  ctx: Ctx,
  frame: Frame<"effects">,
  effect: Extract<EffectSpec, { kind: "basicPowerBy" }>,
  context: EffectContext,
): void {
  const [playerId] = resolvePlayers(ctx.state, effect.player, context);
  const source = frame.selfInstanceId;
  const step = frame.vars[STEP] ?? 0;
  const vars = Object.fromEntries(Object.entries(frame.vars).filter(([key]) => !key.startsWith("_power.")));
  const bindings = Object.fromEntries(Object.entries(frame.bindings).filter(([key]) => !key.startsWith("_power.")));
  const done = (): void => setFrame(ctx, { ...frame, answer: null, vars, bindings, cursor: frame.cursor + 1 });
  const notMade = (reason: "noLegalUse" | "costNotPaid" | "refused", message?: string): void => {
    emit(ctx, {
      type: "basicPowerNotMade",
      playerId: playerId ?? null,
      sourceInstanceId: source,
      reason,
      ...(message !== undefined ? { message } : {}),
    });
    done();
  };

  // Step 3: the power, and everything it pushed, has resolved. A bonus still waiting on a power that was never used (a
  // stunned attack, a confused thwart, an additional thwart cost declined) was "for this use" and ends here.
  if (step === 3) {
    const first = frame.vars[FIRST_LASTING] ?? 0;
    for (let n = 0; n < (frame.vars[LASTING_COUNT] ?? 0); n++) {
      const id = lastingEffectIdOf(first + n);
      const waiting = ctx.state.lastingEffects.find((e) => e.id === id && e.duration.kind === "nextBasicPower");
      if (waiting) endLastingEffect(ctx, id, "expired");
    }
    return done();
  }

  if (!playerId) return notMade("noLegalUse");
  const uses = [...basicPowerUses(ctx.state, ctx.deps, playerId, effect.powers)];

  if (step === 0) {
    if (uses.length === 0) return notMade("noLegalUse");
    if (frame.answer === null) {
      const options: ChoiceOption[] = [];
      for (const use of uses) {
        if (options.some((option) => option.optionId === powerOptionId(use))) continue;
        options.push({
          optionId: powerOptionId(use),
          label: use.power === "attack" ? "Attack" : "Thwart",
          ref: { kind: "card", instanceId: use.characterInstanceId },
        });
      }
      requestChoice(ctx, {
        playerId,
        prompt: { kind: "chooseBasicPower", powers: effect.powers, sourceInstanceId: source },
        options,
        minSelections: 1,
        maxSelections: 1,
        frameId: frame.frameId,
      });
      return;
    }
    const picked = uses.find((use) => powerOptionId(use) === frame.answer?.[0]);
    if (!picked) return notMade("noLegalUse");
    setFrame(ctx, {
      ...frame,
      answer: null,
      vars: { ...frame.vars, [STEP]: 1, [POWER]: picked.power === "attack" ? 1 : 2 },
      bindings: { ...frame.bindings, [CHARACTER]: [picked.characterInstanceId] },
    });
    return;
  }

  const [character] = frame.bindings[CHARACTER] ?? [];
  const power: BasicPowerKind = frame.vars[POWER] === 2 ? "thwart" : "attack";
  const candidates = uses.filter((use) => use.characterInstanceId === character && use.power === power);
  if (!character || candidates.length === 0) return notMade("noLegalUse");

  // The targets a division may name: each one this character could make the power against alone. Not a scheme
  // thwarted with ATK by the player's choice, which the command does not divide.
  const divisible = candidates.filter((use) => !use.useAtk);
  const mayDivide = canDivideBasicPower(ctx.state, ctx.deps, character, power) && divisible.length > 1;

  if (step === 1) {
    const picks = (frame.answer ?? []).map((optionId) => candidates.find((use) => targetOptionId(use) === optionId));
    const [picked] = picks;
    // Several targets are a division: distinct, and none of them a thwart with ATK by choice.
    const legal =
      picked !== undefined &&
      (picks.length === 1 ||
        (mayDivide &&
          picks.every((use) => use !== undefined && !use.useAtk) &&
          new Set(picks.map((use) => use?.targetInstanceId)).size === picks.length));
    if (frame.answer === null || (!legal && frame.answer.length > 1)) {
      setFrame(ctx, { ...frame, answer: null });
      requestChoice(ctx, {
        playerId,
        prompt: {
          kind: "chooseBasicPowerTarget",
          power,
          characterInstanceId: character,
          ...(mayDivide ? { mayDivide: true as const } : {}),
        },
        options: candidates.map((use) => ({
          optionId: targetOptionId(use),
          label: `${mustCardOf(ctx.state, use.targetInstanceId).name}${use.useAtk ? " (with ATK)" : ""}`,
          ref: { kind: "card", instanceId: use.targetInstanceId } as const,
        })),
        minSelections: 1,
        maxSelections: mayDivide ? divisible.length : 1,
        frameId: frame.frameId,
      });
      return;
    }
    if (!legal || !picked) return notMade("noLegalUse");
    const chosen = picks.flatMap((use) => (use ? [use.targetInstanceId] : []));
    setFrame(ctx, {
      ...frame,
      answer: null,
      vars: { ...frame.vars, [STEP]: chosen.length > 1 ? 4 : 2, [WITH_ATK]: picked.useAtk ? 1 : 0 },
      bindings: { ...frame.bindings, [TARGET]: chosen },
    });
    return;
  }

  const targets = frame.bindings[TARGET] ?? [];
  const [target] = targets;
  const use = candidates.find(
    (candidate) => candidate.targetInstanceId === target && candidate.useAtk === (frame.vars[WITH_ATK] === 1),
  );
  // A division still needs the rule that allows it and every one of its targets still legal.
  const divided = targets.length > 1;
  const stillDivisible =
    mayDivide && targets.every((id) => divisible.some((candidate) => candidate.targetInstanceId === id));
  if (!use || (divided && !stillDivisible)) return notMade("noLegalUse");

  const scope: LastingScope = {
    selfInstanceId: source,
    controllerId: frame.controllerId,
    vars,
    bindings,
  };
  const bonuses = (["thw", "atk"] as const).filter((stat) => (effect.bonus?.[stat] ?? 0) !== 0);
  const reach = { targets: [character] as readonly InstanceId[], affects: null };
  /** "+1 THW and +1 ATK for this use", waiting on the power: added to `to` (the game, or a scratch copy of it). */
  const addBonuses = (to: Ctx): void => {
    for (const stat of bonuses) {
      addLastingEffect(
        to,
        { kind: "statModifier", stat, amount: { kind: "const", value: effect.bonus?.[stat] ?? 0 }, scope, ...reach },
        { kind: "nextBasicPower", characterIds: [character], powers: [power] },
      );
    }
  };

  // Step 4: divide the power among the targets chosen. What there is to divide is the stat this use will have, read
  // on a scratch copy of the game with this effect's own bonus waiting on it, as it will be when the power is declared.
  if (step === 4) {
    const scratch = createCtx(ctx.state, ctx.deps);
    addBonuses(scratch);
    // RRG 1.8 "Assault" (p. 8): any scheme of the division with assault makes the whole thwart use ATK.
    const stat =
      power === "attack" || targets.some((id) => hasKeyword(ctx.state, id, "assault", ctx.deps)) ? "atk" : "thw";
    const amount = dividedBasicPowerValue(scratch.state, ctx.deps, playerId, character, power, stat, targets);
    // Fewer points than targets cannot give each a share: the targets are chosen again.
    if (amount < targets.length) {
      const { [TARGET]: _targets, ...kept } = frame.bindings;
      setFrame(ctx, { ...frame, answer: null, vars: { ...frame.vars, [STEP]: 1 }, bindings: kept });
      return;
    }
    const shareOf = (id: InstanceId): number =>
      (frame.answer ?? []).filter((optionId) => optionId.slice(0, optionId.lastIndexOf("#")) === id).length;
    if (frame.answer === null || targets.some((id) => shareOf(id) < 1)) {
      setFrame(ctx, { ...frame, answer: null });
      // Each target has one option fewer than the whole amount for every other target, which must get at least 1.
      const most = amount - (targets.length - 1);
      requestChoice(ctx, {
        playerId,
        prompt: { kind: "divide", what: power === "attack" ? "damage" : "threat", amount, eachAtLeast: 1 },
        options: targets.flatMap((id) =>
          Array.from({ length: most }, (_, n) => ({
            optionId: `${id}#${n + 1}`,
            label: mustCardOf(ctx.state, id).name,
            ref: { kind: "card", instanceId: id } as const,
          })),
        ),
        minSelections: amount,
        maxSelections: amount,
        frameId: frame.frameId,
      });
      return;
    }
    const shares = Object.fromEntries(targets.map((id, index) => [`${SHARE}${index}`, shareOf(id)]));
    setFrame(ctx, { ...frame, answer: null, vars: { ...frame.vars, ...shares, [STEP]: 2 } });
    return;
  }
  const divide: readonly BasicPowerShare[] | undefined = divided
    ? targets.map((targetInstanceId, index) => ({ targetInstanceId, amount: frame.vars[`${SHARE}${index}`] ?? 0 }))
    : undefined;

  // Step 2. A power with an additional cost of its own asks for it first, as a timing window asks an interrupt's
  // (RRG 1.8 "Initiating Abilities", p. 24: the cost is determined, then paid): the cards a "discard N cards from
  // your hand" part is paid with, then the payment of its resources ("that hero must spend 1 of any resource"). The
  // command checks and pays all of it with the power's other costs.
  const picked = frame.bindings[DISCARD];
  const needs = basicPowerCostNeeds(ctx.state, ctx.deps, playerId, character, power, picked);
  if (needs && !("fault" in needs) && needs.asksDiscard && picked === undefined) {
    const part = needs.cost.discardFromHand;
    const from = handDiscardCandidates(ctx.state, ctx.deps, character, playerId, needs.cost);
    if (frame.answer === null) {
      requestChoice(ctx, {
        playerId,
        prompt: {
          kind: "chooseCostCards",
          instanceId: character,
          abilityId: needs.abilityId,
          slot: "discard",
          mode: "discardFromHand",
        },
        options: from.map((id) => ({
          optionId: id,
          label: mustCardOf(ctx.state, id).name,
          ref: { kind: "card", instanceId: id } as const,
        })),
        // Selecting fewer than the cost needs backs out of the power, as it backs out of an interrupt.
        minSelections: 0,
        maxSelections: Math.min(from.length, part?.max ?? from.length),
        frameId: frame.frameId,
      });
      return;
    }
    const chosen = from.filter((id) => frame.answer?.includes(id));
    if (chosen.length < Math.max(part?.min ?? 0, 1)) return notMade("costNotPaid");
    // Kept in the order of the hand; the resources are asked next, on the frame's next run.
    setFrame(ctx, { ...frame, answer: null, bindings: { ...frame.bindings, [DISCARD]: chosen } });
    return;
  }
  if (needs && "fault" in needs) return notMade("costNotPaid", needs.fault);
  if (needs && requirementTotal(needs.requirement) > 0 && frame.answer === null) {
    // A card picked to be discarded is not also spent.
    const kept = new Set((needs.discard ?? []).map((id) => `hand:${id}`));
    const options = paymentOptions(ctx, playerId, null).filter((option) => !kept.has(option.optionId));
    if (options.length > 0) {
      requestChoice(ctx, {
        playerId,
        prompt: { kind: "spendResources", requirement: needs.requirement },
        options,
        minSelections: 0,
        maxSelections: options.length,
        frameId: frame.frameId,
      });
      return;
    }
  }
  const payment = needs ? paymentsFromOptionIds(frame.answer ?? []) : [];

  // "+1 THW and +1 ATK for this use": in place before the power is declared, started by the power's own event frame
  // (`startNextBasicPowerEffects`) and ended with it. The frame then waits beneath the power (step 3).
  const firstLasting = ctx.state.nextLastingSeq;
  // The answer is cleared and the step advanced before anything is pushed, so the frame is never read stale.
  setFrame(ctx, {
    ...frame,
    answer: null,
    vars: { ...frame.vars, [STEP]: 3, [FIRST_LASTING]: firstLasting, [LASTING_COUNT]: bonuses.length },
  });
  addBonuses(ctx);
  emit(ctx, {
    type: "basicPowerInstructed",
    playerId,
    characterInstanceId: character,
    power,
    targetInstanceId: use.targetInstanceId,
    sourceInstanceId: source,
    ...(use.useAtk ? { useAtk: true as const } : {}),
    ...(divide ? { divide } : {}),
  });
  const command = { ...basicPowerCommand(playerId, use, payment, picked), ...(divide ? { divide } : {}) };
  const by = { instructed: true };
  const error = command.type === "basicAttack" ? basicAttack(ctx, command, by) : basicThwart(ctx, command, by);
  if (error) {
    emit(ctx, {
      type: "basicPowerNotMade",
      playerId,
      sourceInstanceId: source,
      reason: error.code === "insufficient_resources" ? "costNotPaid" : "refused",
      message: error.message,
    });
  }
}
