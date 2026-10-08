/**
 * `EffectSpec basicPowerBy` (docs/phase7-wave8.md §3.64): "that player makes a basic attack or thwart with a character
 * they control. That character gets +1 THW and +1 ATK for this use." (Cell Phone, `jubilee` 47019.)
 *
 * One effect step that needs up to three answers and then waits for the power to finish, so it runs as a small state
 * machine on the frame's own vars (`_power.step`), the way `playFromHand` does:
 *
 * 0. choose the character and the power;
 * 1. choose the target;
 * 2. pay the power's own additional resource cost, if it has one, then declare the power;
 * 3. (after everything the power pushed has resolved) end a bonus the power never started.
 *
 * The power itself is the ordinary command (`basicAttack` / `basicThwart` with `BasicPowerBy.instructed`), declared
 * from here with this effects frame beneath it: nothing about how a basic power resolves is restated.
 */

import { basicAttack, basicThwart, paymentOptions, paymentsFromOptionIds } from "../actions.js";
import {
  basicPowerCommand,
  basicPowerResourceCost,
  basicPowerUses,
  type BasicPowerKind,
  type BasicPowerUse,
} from "../basic-power-uses.js";
import type { ChoiceOption } from "../choices.js";
import { type Ctx, emit, requestChoice, setFrame } from "../ctx.js";
import { addLastingEffect, endLastingEffect, lastingEffectIdOf } from "../effects.js";
import type { InstanceId } from "../ids.js";
import type { LastingScope } from "../lasting.js";
import { mustCardOf } from "../query.js";
import { combineRequirements } from "../resources.js";
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

  if (step === 1) {
    if (frame.answer === null) {
      requestChoice(ctx, {
        playerId,
        prompt: { kind: "chooseBasicPowerTarget", power, characterInstanceId: character },
        options: candidates.map((use) => ({
          optionId: targetOptionId(use),
          label: `${mustCardOf(ctx.state, use.targetInstanceId).name}${use.useAtk ? " (with ATK)" : ""}`,
          ref: { kind: "card", instanceId: use.targetInstanceId } as const,
        })),
        minSelections: 1,
        maxSelections: 1,
        frameId: frame.frameId,
      });
      return;
    }
    const picked = candidates.find((use) => targetOptionId(use) === frame.answer?.[0]);
    if (!picked) return notMade("noLegalUse");
    setFrame(ctx, {
      ...frame,
      answer: null,
      vars: { ...frame.vars, [STEP]: 2, [WITH_ATK]: picked.useAtk ? 1 : 0 },
      bindings: { ...frame.bindings, [TARGET]: [picked.targetInstanceId] },
    });
    return;
  }

  const [target] = frame.bindings[TARGET] ?? [];
  const use = candidates.find(
    (candidate) => candidate.targetInstanceId === target && candidate.useAtk === (frame.vars[WITH_ATK] === 1),
  );
  if (!use) return notMade("noLegalUse");

  // Step 2. A power with an additional resource cost of its own ("that hero must spend 1 of any resource") asks for
  // the payment first; the command checks and spends it with the power's other costs.
  const resources = basicPowerResourceCost(ctx.state, ctx.deps, character, power);
  if (resources !== null && frame.answer === null) {
    const options = paymentOptions(ctx, playerId, null);
    if (options.length > 0) {
      requestChoice(ctx, {
        playerId,
        prompt: { kind: "spendResources", requirement: combineRequirements(resources, 0) },
        options,
        minSelections: 0,
        maxSelections: options.length,
        frameId: frame.frameId,
      });
      return;
    }
  }
  const payment = resources !== null ? paymentsFromOptionIds(frame.answer ?? []) : [];

  // "+1 THW and +1 ATK for this use": in place before the power is declared, started by the power's own event frame
  // (`startNextBasicPowerEffects`) and ended with it. The frame then waits beneath the power (step 3).
  const scope: LastingScope = {
    selfInstanceId: source,
    controllerId: frame.controllerId,
    vars,
    bindings,
  };
  const firstLasting = ctx.state.nextLastingSeq;
  const bonuses = (["thw", "atk"] as const).filter((stat) => (effect.bonus?.[stat] ?? 0) !== 0);
  const reach = { targets: [character] as readonly InstanceId[], affects: null };
  // The answer is cleared and the step advanced before anything is pushed, so the frame is never read stale.
  setFrame(ctx, {
    ...frame,
    answer: null,
    vars: { ...frame.vars, [STEP]: 3, [FIRST_LASTING]: firstLasting, [LASTING_COUNT]: bonuses.length },
  });
  for (const stat of bonuses) {
    addLastingEffect(
      ctx,
      { kind: "statModifier", stat, amount: { kind: "const", value: effect.bonus?.[stat] ?? 0 }, scope, ...reach },
      { kind: "nextBasicPower", characterIds: [character], powers: [power] },
    );
  }
  emit(ctx, {
    type: "basicPowerInstructed",
    playerId,
    characterInstanceId: character,
    power,
    targetInstanceId: use.targetInstanceId,
    sourceInstanceId: source,
    ...(use.useAtk ? { useAtk: true as const } : {}),
  });
  const command = basicPowerCommand(playerId, use, payment);
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
