import type { EngineDeps } from "./abilities.js";
import type { InstanceId } from "./ids.js";
import { cardOf } from "./query.js";
import {
  activeAbilityRefs,
  cardsInPlay,
  controllerOf,
  evaluate,
  lastingContext,
  lastingReaches,
  matchesQuery,
  resolveValue,
  uncontrolledYouOf,
  type EffectContext,
} from "./select.js";
import type { SchemeValueName, StatName } from "./spec.js";
import type { GameState } from "./state.js";

/**
 * `consequentialAttack` / `consequentialThwart`: "takes +1 consequential damage after it attacks" (Enraged), the
 * small number printed under an ally's ATK/THW (RRG 1.8 "Consequential Damage").
 */
export type ModifiedStat =
  | StatName
  | "hp"
  | "handSize"
  | SchemeValueName
  | "boostIcons"
  | "consequentialAttack"
  | "consequentialThwart";

export interface ActiveModifier {
  /** The card whose printed stat box, constant ability, or lasting effect produced this. */
  readonly sourceInstanceId: InstanceId | null;
  readonly stat: ModifiedStat;
  readonly amount: number;
  readonly origin: "attachment" | "constant" | "lasting";
  /** Replaces the printed base value instead of adding to it ("has a base ATK of 1"). */
  readonly setBase?: boolean;
}

/**
 * Constant abilities and lasting effects are never "applied" to state — they
 * are recomputed on every read (RRG "Modifiers": the game recalculates a
 * modified quantity from the base value and all active modifiers each time it
 * is checked). Passing `stat` evaluates only that stat's modifiers, which also
 * keeps a value like "ATK = remaining hit points" from recursing into itself.
 */
export function modifiersFor(
  state: GameState,
  deps: EngineDeps,
  targetId: InstanceId,
  stat?: ModifiedStat,
): readonly ActiveModifier[] {
  const found: ActiveModifier[] = [];
  const wanted = (s: ModifiedStat) => stat === undefined || stat === s;

  // Printed stat boxes on an attachment modify its host while attached (Charge +3 ATK).
  for (const attachmentId of state.instances[targetId]?.attachments ?? []) {
    const card = cardOf(state, attachmentId);
    if (card?.type !== "attachment" || !card.statModifiers) continue;
    for (const [s, amount] of Object.entries(card.statModifiers)) {
      if (typeof amount === "number" && amount !== 0 && wanted(s as ModifiedStat)) {
        found.push({ sourceInstanceId: attachmentId, stat: s as ModifiedStat, amount, origin: "attachment" });
      }
    }
  }

  for (const sourceId of cardsInPlay(state)) {
    for (const ref of activeAbilityRefs(state, sourceId, deps)) {
      const definition = deps.abilities[ref.id];
      if (!definition || definition.trigger.kind !== "constant") continue;
      // "Your hero gets -1 THW" on an obligation (Anti-Hero Propaganda) speaks for the player whose play area holds it
      // (RRG 1.8 "Obligation", p. 30), as its triggered abilities already do (`uncontrolledYouOf`).
      const context: EffectContext = {
        selfInstanceId: sourceId,
        controllerId: controllerOf(state, sourceId) ?? uncontrolledYouOf(state, sourceId),
        event: null,
        bindings: {},
        deps,
      };
      for (const modifier of definition.trigger.modifiers ?? []) {
        if (!wanted(modifier.stat)) continue;
        if (modifier.while && !evaluate(state, modifier.while, context)) continue;
        if (!matchesQuery(state, targetId, modifier.target, context)) continue;
        const amount =
          typeof modifier.amount === "number" ? modifier.amount : resolveValue(state, modifier.amount, context, deps);
        found.push({
          sourceInstanceId: sourceId,
          stat: modifier.stat,
          amount,
          origin: "constant",
          ...(modifier.setBase ? { setBase: true } : {}),
        });
      }
    }
  }

  for (const effect of state.lastingEffects) {
    if (effect.kind !== "statModifier" || !wanted(effect.stat)) continue;
    if (!lastingReaches(state, effect, targetId, deps)) continue;
    const amount = resolveValue(state, effect.amount, lastingContext(effect.scope, deps), deps);
    found.push({ sourceInstanceId: effect.scope.selfInstanceId, stat: effect.stat, amount, origin: "lasting" });
  }
  return found;
}

export function statBonus(state: GameState, deps: EngineDeps, targetId: InstanceId, stat: ModifiedStat): number {
  return modifiersFor(state, deps, targetId, stat)
    .filter((modifier) => !modifier.setBase)
    .reduce((sum, modifier) => sum + modifier.amount, 0);
}

/**
 * A boost card's icons as they count now (RRG 1.8 "Boost", p. 11): printed, plus "This card gets +1 boost icon if …"
 * constant modifiers on the card itself (read although it is not in play: it is resolving as a boost card), plus
 * `boostIcons` modifiers from cards in play (docs/phase7-wave1.md §3.9).
 */
export function boostIconsFor(state: GameState, deps: EngineDeps, id: InstanceId): number {
  const card = cardOf(state, id);
  const printed = card && "boostIcons" in card ? card.boostIcons : 0;
  let own = 0;
  if (card && "abilities" in card && !cardsInPlay(state).includes(id)) {
    const context: EffectContext = { selfInstanceId: id, controllerId: null, event: null, bindings: {}, deps };
    for (const ref of card.abilities) {
      const definition = deps.abilities[ref.id];
      if (definition?.trigger.kind !== "constant") continue;
      for (const modifier of definition.trigger.modifiers ?? []) {
        if (modifier.stat !== "boostIcons" || !matchesQuery(state, id, modifier.target, context)) continue;
        if (modifier.while && !evaluate(state, modifier.while, context)) continue;
        own +=
          typeof modifier.amount === "number" ? modifier.amount : resolveValue(state, modifier.amount, context, deps);
      }
    }
  }
  return Math.max(0, printed + own + statBonus(state, deps, id, "boostIcons"));
}

/**
 * Every amplify icon printed on a face-up card in play (RRG 1.8 "Amplify Icon", p. 7: "add one additional boost icon to
 * that card for each amplify icon in play"; docs/phase7-wave3.md §3.6). A flipped card counts its other face's icons
 * (The Galaxy's Most Wanted's expert Campaign Challenge faces print one, the standard faces none), and a card in play
 * facedown as something else prints nothing. Every game area's icons count: the rule says "in play", and no printed
 * card puts amplify in a separate game area yet (docs/phase7-wave3.md §4).
 */
export function amplifyIconsInPlay(state: GameState): number {
  let total = 0;
  for (const id of cardsInPlay(state)) {
    const instance = state.instances[id];
    const card = cardOf(state, id);
    if (!instance || !card || instance.facedownAs) continue;
    const back = "flipSide" in card ? card.flipSide : undefined;
    total += (instance.flipped ? back?.amplifyIcons : card.amplifyIcons) ?? 0;
  }
  return total;
}

/**
 * "Increase the amount of damage that event deals by 2" (Embiggen!) / "…threat that event removes…" (Shrink): the
 * bonus one resolving card carries, added to every instance that card's own effects produce (RRG 1.8 "Event", p. 19).
 */
export function cardEffectBonus(
  state: GameState,
  sourceId: InstanceId | null,
  field: "damage" | "threatRemoved",
): number {
  if (!sourceId) return 0;
  return state.lastingEffects.reduce(
    (sum, effect) =>
      effect.kind === "cardEffectBonus" && effect.sourceInstanceId === sourceId ? sum + effect[field] : sum,
    0,
  );
}

/** The base value set by a "has a base X of N" ability, if any (the last one in play order wins). */
export function baseOverride(
  state: GameState,
  deps: EngineDeps,
  targetId: InstanceId,
  stat: ModifiedStat,
): number | undefined {
  const bases = modifiersFor(state, deps, targetId, stat).filter((modifier) => modifier.setBase);
  return bases.length > 0 ? bases[bases.length - 1]?.amount : undefined;
}
