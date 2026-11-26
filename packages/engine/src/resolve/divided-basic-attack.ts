/**
 * The division of a divided basic attack is chosen as its damage is dealt, from the ATK it has then (issue #1012 §5,
 * owner decision A). Wasp's Giant form (13001c): "Damage you deal using your basic attack power (ATK) can be divided
 * among enemies as you choose"; RRG 1.8 FAQ "Wasp (#1C)" (p. 61): the targets are chosen and checked when the power is
 * used. Rapid Growth (13005), "Hero Interrupt: When you use a basic power, … +2 to that power for this use", resolves
 * in the power's `basicPowerUsing` window, after the command fixed the targets: the +2 is part of what is divided
 * (replay 9c75786e #195-197 dealt 1 + 1 from the base ATK, losing the +2).
 *
 * The command still names the targets and a division (`basicAttack.divide`), the one its player meant with the ATK
 * the power had when it was used; each target is still its own `attack` event (`makeBasicAttack`). The first share's
 * event carries the targets (`attack.divisionToChoose`), and as it applies, after its interrupt window and the power's
 * `basicPowerUsing` window before it, the ATK it deals is read as an undivided basic attack reads it
 * (`applyPlayerAttack`: ATK with every modifier active, "for this use" and "for this attack" included):
 *
 * - **the same total** as the declared shares: the player's division stands, and nobody is asked again;
 * - **another total**: the player divides it again among the same targets (a `divide` choice, each at least 1 when
 *   there is enough for each), and every share's event takes its new amount.
 *
 * Engine readings (authority step 5), no official source covering them:
 * - ATK that fell below the number of targets (an interrupt lowered it) divides with no minimum: a target given 0 is
 *   still attacked for 0, as it was chosen when the power was used (FAQ p. 61). 0 ATK is all-zero with no question.
 * - A chosen target that left play in an interrupt window keeps its share whether or not the total changed, and that
 *   damage goes nowhere: its attack ends unmade (RRG 1.8 "Consequential Damage", p. 13). The targets were fixed when
 *   the power was used (FAQ p. 61), so the damage is not moved onto the others, and a new division still offers it.
 * - A mandatory even split (Bombshell, `divideBasicPower.evenly`; ruling January 11, 2026 R4) is split evenly again
 *   among the same targets, not asked: the remainder goes to the targets that had the larger shares, in order.
 * - The total is read on the first share's frame: a "+X ATK for this attack" an interrupt gives another share's own
 *   event later still does not reach the division (each share deals its own fixed amount), as before.
 *
/**
 * Basic thwart divisions are not touched here: they are still fixed as the command is made.
 */
import { type Ctx, findFrame, requestChoice, setFrame, updateFrame } from "../ctx.js";
import type { InstanceId } from "../ids.js";
import { characterProfile } from "../query.js";
import { statUsedInPlaceOf } from "../rules.js";
import { displayNameOf } from "../visibility.js";
import type { Frame } from "./frames.js";

/** The attack a division is settled for, without its `divisionToChoose`: the event as it deals its damage. */
function settled(frame: Frame<"event">, amount: number): Frame<"event"> {
  if (frame.event.kind !== "attack") return frame;
  const { divisionToChoose: _settled, ...event } = frame.event;
  return { ...frame, answer: null, event: { ...event, amount } };
}

const amountOf = (f: Frame<"event">): number => (f.event.kind === "attack" ? (f.event.amount ?? 0) : 0);
const targetOf = (f: Frame<"event">): InstanceId | null =>
  f.event.kind === "attack" ? f.event.targetInstanceId : null;

/** `total` split as evenly as possible among `targets`; the remainder to those with the larger `declared` shares. */
function evenSplit(
  targets: readonly InstanceId[],
  declared: ReadonlyMap<InstanceId, number>,
  total: number,
): Record<string, number> {
  const base = Math.floor(total / targets.length);
  const extra = total % targets.length;
  // A stable sort: ties keep the order the targets were chosen in.
  const first = [...targets].sort((a, b) => (declared.get(b) ?? 0) - (declared.get(a) ?? 0)).slice(0, extra);
  return Object.fromEntries(targets.map((id) => [id, base + (first.includes(id) ? 1 : 0)]));
}

/**
 * Settles the division of a divided basic attack at its first share's apply step (file header). True when a choice
 * was asked, or the frame was rewritten and must be run again from the stack; false when there is nothing to settle.
 */
export function settleBasicAttackDivision(ctx: Ctx, frame: Frame<"event">): boolean {
  const event = frame.event;
  if (event.kind !== "attack" || event.divisionToChoose === undefined || frame.cancelled) return false;
  const { targets, shareFrameIds, evenly } = event.divisionToChoose;
  const attacker = event.attackerInstanceId;
  // The other shares' event frames, still on the stack beneath this one.
  const others = shareFrameIds
    .filter((id) => id !== frame.frameId)
    .map((id) => findFrame(ctx.state, id))
    .filter((f): f is Frame<"event"> => f?.kind === "event" && f.event.kind === "attack");
  const declared = new Map<InstanceId, number>(
    [frame, ...others].flatMap((f) => {
      const target = targetOf(f);
      return target === null ? [] : [[target, amountOf(f)] as const];
    }),
  );
  const declaredTotal = [...declared.values()].reduce((sum, n) => sum + n, 0);
  // ATK as an undivided basic attack would deal it now (`applyPlayerAttack`): "+X ATK for this attack" counts unless
  // another stat is used in place of ATK. A printed '—' ATK never got here (the command refuses it).
  const profile = characterProfile(ctx.state, attacker, ctx.deps);
  const atkBonus =
    statUsedInPlaceOf(ctx.state, ctx.deps, attacker, "atk") === undefined ? (frame.vars.atkBonus ?? 0) : 0;
  const total = profile === undefined ? declaredTotal : Math.max(0, profile.atk + atkBonus);
  if (total === declaredTotal) {
    setFrame(ctx, settled(frame, event.amount ?? 0));
    return true;
  }
  // Every chosen target keeps its place in the division, one that left play included (file header).
  const chosen = targets.filter((id) => declared.has(id));
  if (total === 0 || chosen.length === 0) {
    applyShares(ctx, frame, others, {});
    return true;
  }
  if (evenly) {
    applyShares(ctx, frame, others, evenSplit(chosen, declared, total));
    return true;
  }
  if (chosen.length === 1) {
    applyShares(ctx, frame, others, { [chosen[0]!]: total });
    return true;
  }
  const eachAtLeast = total >= chosen.length ? 1 : 0;
  if (frame.answer === null) {
    const most = total - eachAtLeast * (chosen.length - 1);
    requestChoice(ctx, {
      playerId: event.playerId,
      prompt: { kind: "divide", what: "damage", amount: total, ...(eachAtLeast > 0 ? { eachAtLeast } : {}) },
      options: chosen.flatMap((id) =>
        Array.from({ length: most }, (_, n) => ({
          optionId: `${id}#${n + 1}`,
          label: displayNameOf(ctx.state, id),
          ref: { kind: "card", instanceId: id } as const,
        })),
      ),
      minSelections: total,
      maxSelections: total,
      frameId: frame.frameId,
    });
    return true;
  }
  const shares: Record<string, number> = {};
  for (const optionId of frame.answer) {
    const id = optionId.slice(0, optionId.lastIndexOf("#"));
    shares[id] = (shares[id] ?? 0) + 1;
  }
  applyShares(ctx, frame, others, shares);
  return true;
}

/** Each share's event takes its amount from `shares` (0 where it names none); this frame's division is settled. */
function applyShares(
  ctx: Ctx,
  frame: Frame<"event">,
  others: readonly Frame<"event">[],
  shares: Readonly<Record<string, number>>,
): void {
  for (const other of others) {
    updateFrame(ctx, other.frameId, (f) =>
      f.kind === "event" && f.event.kind === "attack" && f.event.targetInstanceId !== null
        ? { ...f, event: { ...f.event, amount: shares[f.event.targetInstanceId] ?? 0 } }
        : f,
    );
  }
  const target = targetOf(frame);
  setFrame(ctx, settled(frame, target === null ? 0 : (shares[target] ?? 0)));
}
