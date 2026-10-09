import type { EngineDeps } from "./abilities.js";
import type { InstanceId, PlayerId } from "./ids.js";
import { cardOf } from "./query.js";
import { grantedIcons, iconLossTest, printedAmplifyOn } from "./rules.js";
import {
  AFFECTED_SLOT,
  cardsInPlay,
  constantAbilityRefs,
  constantYouOf,
  constantSources,
  evaluate,
  lastingContext,
  lastingReaches,
  matchesQuery,
  resolveValue,
  type EffectContext,
  reachOf,
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

  for (const sourceId of constantSources(state, deps)) {
    for (const ref of constantAbilityRefs(state, sourceId, deps)) {
      const definition = deps.abilities[ref.id];
      if (!definition || definition.trigger.kind !== "constant") continue;
      // "You" is the card's speaker (`constantYouOf`): "Your hero gets -1 THW" on an obligation speaks for the player
      // whose play area holds it (RRG 1.8 "Obligation", p. 30), an engaged minion's "you" is its engaged player.
      const context: EffectContext = {
        selfInstanceId: sourceId,
        controllerId: constantYouOf(state, sourceId),
        event: null,
        bindings: {},
        deps,
        ...reachOf(definition),
      };
      for (const modifier of definition.trigger.modifiers ?? []) {
        if (!wanted(modifier.stat)) continue;
        if (!matchesQuery(state, targetId, modifier.target, context)) continue;
        // The card being read is bound (`AFFECTED_SLOT`), as a lasting modifier binds it below: "each [X-Men]
        // character gets +1 THW while making a basic thwart against this scheme" holds for the one making it.
        const reading =
          modifier.while || typeof modifier.amount !== "number"
            ? { ...context, bindings: { ...context.bindings, [AFFECTED_SLOT]: [targetId] } }
            : context;
        if (modifier.while && !evaluate(state, modifier.while, reading)) continue;
        const amount =
          typeof modifier.amount === "number" ? modifier.amount : resolveValue(state, modifier.amount, reading, deps);
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
    // The card being read is bound (`AFFECTED_SLOT`): "they get +2 ATK" read per character (docs/phase7-wave6.md §3.43).
    const context = lastingContext(effect.scope, deps);
    const reading = { ...context, bindings: { ...context.bindings, [AFFECTED_SLOT]: [targetId] } };
    const amount = resolveValue(state, effect.amount, reading, deps);
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
 *
 * `youId`: who "you" is in the card's own text, which no card state says for a card out of play: the same player its
 * "Boost" ability resolves as ("…if at least one Goblin minion is engaged with you"), the defending player of the
 * attack it was turned up in (RRG 1.8 "Defend, Defense", p. 16), who is the attacked player when nobody else's
 * character defends, or the player the scheme it was turned up in is against. Null outside an activation (icons
 * counted on a discarded card), where its own "you" names no one.
 */
export function boostIconsFor(
  state: GameState,
  deps: EngineDeps,
  id: InstanceId,
  youId: PlayerId | null = null,
): number {
  const card = cardOf(state, id);
  const printed = card && "boostIcons" in card ? card.boostIcons : 0;
  let own = 0;
  if (card && "abilities" in card && !cardsInPlay(state).includes(id)) {
    const context: EffectContext = { selfInstanceId: id, controllerId: youId, event: null, bindings: {}, deps };
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
 * facedown as something else prints nothing, nor does a blanked one. Every game area's icons count: the rule says "in
 * play", and no printed card puts amplify in a separate game area yet (docs/phase7-wave3.md §4).
 */
export function amplifyIconsInPlay(state: GameState, deps: EngineDeps): number {
  // A blanked card has no icons (`rules.ts` `iconsBlankedOn`: FFG email relayed on Reddit, confirmed by the user
  // 2026-09-28). A card that loses the icon shows none, and a gained one counts (`RuleSpec gainsIcon`,
  // docs/phase7-wave6.md §3.38).
  const loses = iconLossTest(state, deps, "amplify");
  let total = 0;
  for (const id of cardsInPlay(state)) total += printedAmplifyOn(state, deps, id, loses);
  return total + grantedIcons(state, deps, "amplify");
}

/**
 * "Increase the amount of damage that event deals by 2" (Embiggen!) / "…threat that event removes…" (Shrink): the
 * bonus one resolving card carries, added to every instance that card's own effects produce (RRG 1.8 "Event", p. 19).
 * A lasting bonus over every card of a kind ("each ATTACK event deals 1 additional damage", `cardEffectBonusFor`) is
 * part of it while the resolving card matches.
 *
 * Per instance means per instance (owner ruling Q53, docs/phase7-wave8.md §4.1; RRG 1.8 "Attack (Player Ability
 * Type)", p. 10; "For Each", p. 20): the caller adds this to each damage instruction of the card, and leaves it off
 * an instruction that is itself additional damage of an earlier instance (`EffectSpec dealDamage.additional`; RRG 1.8
 * "Alteration Effect", p. 7: "Additional").
 */
export function cardEffectBonus(
  state: GameState,
  deps: EngineDeps,
  sourceId: InstanceId | null,
  field: "damage" | "threatRemoved",
): number {
  if (!sourceId) return 0;
  let total = 0;
  for (const effect of state.lastingEffects) {
    if (effect.kind === "cardEffectBonus") {
      if (effect.sourceInstanceId === sourceId) total += effect[field];
    } else if (effect.kind === "cardEffectBonusFor" && effect[field] !== 0) {
      const context: EffectContext = { ...effect.scope, event: null, deps, reaches: "all" };
      if (matchesQuery(state, sourceId, effect.cards, context)) total += effect[field];
    }
  }
  return total;
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
