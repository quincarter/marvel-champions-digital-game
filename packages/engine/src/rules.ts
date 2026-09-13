import type { EngineDeps, RuleSpec } from "./abilities.js";
import type { InstanceId, PlayerId } from "./ids.js";
import { getInstance, villainOf } from "./query.js";
import { activeAbilityRefs, cardsInPlay, controllerOf, evaluate, matchesQuery, resolvePlayers, type EffectContext } from "./select.js";
import type { PlayerRef } from "./spec.js";
import type { GameState } from "./state.js";

/**
 * Rule restrictions from constant abilities in play ("cannot take damage",
 * "threat cannot be removed", ally limit, "must defend with an ally"). Like
 * modifiers, they are recomputed on every check (RRG "Constant Abilities").
 */
interface ActiveRule<K extends RuleSpec["kind"]> {
  readonly rule: Extract<RuleSpec, { kind: K }>;
  readonly context: EffectContext;
}

function activeRules<K extends RuleSpec["kind"]>(state: GameState, deps: EngineDeps, kind: K): readonly ActiveRule<K>[] {
  const found: ActiveRule<K>[] = [];
  for (const sourceId of cardsInPlay(state)) {
    for (const ref of activeAbilityRefs(state, sourceId)) {
      const definition = deps.abilities[ref.id];
      if (definition?.trigger.kind !== "constant") continue;
      for (const rule of definition.trigger.rules ?? []) {
        if (rule.kind !== kind) continue;
        const context: EffectContext = {
          selfInstanceId: sourceId,
          controllerId: controllerOf(state, sourceId),
          event: null,
          bindings: {},
          deps,
        };
        if ("while" in rule && rule.while && !evaluate(state, rule.while, context)) continue;
        found.push({ rule: rule as Extract<RuleSpec, { kind: K }>, context });
      }
    }
  }
  return found;
}

/** "X cannot take damage [while …] [from …]". `sources` are the damage's source and the card it came through. */
export function cannotTakeDamage(
  state: GameState,
  deps: EngineDeps,
  targetId: InstanceId,
  sources: readonly (InstanceId | null | undefined)[],
): boolean {
  return activeRules(state, deps, "cannotTakeDamage").some(({ rule, context }) => {
    if (!matchesQuery(state, targetId, rule.target, context)) return false;
    if (!rule.fromSource) return true;
    const query = rule.fromSource;
    return sources.some((id) => id !== null && id !== undefined && matchesQuery(state, id, query, context));
  });
}

/** "Threat cannot be removed from this scheme" (Countdown to Oblivion); a `by: "thwart"` rule only stops a thwart. */
export const threatCannotBeRemoved = (state: GameState, deps: EngineDeps, schemeId: InstanceId, byThwart = false): boolean =>
  activeRules(state, deps, "threatCannotBeRemoved").some(
    ({ rule, context }) => (rule.by !== "thwart" || byThwart) && matchesQuery(state, schemeId, rule.target, context),
  );

/**
 * Who "you" is for a player-scoped rule on a card: its controller, else the controller of the card it is attached to
 * (Media Coverage on your identity), else the player whose area it is in (an engaged minion, an obligation).
 */
function speakerOf(state: GameState, sourceId: InstanceId | null): PlayerId | null {
  if (!sourceId) return null;
  const controller = controllerOf(state, sourceId);
  if (controller) return controller;
  const host = getInstance(state, sourceId)?.attachedTo;
  const hostController = host ? controllerOf(state, host) : null;
  if (hostController) return hostController;
  return state.players.find((p) => p.playArea.includes(sourceId))?.playerId ?? null;
}

const rulePlayers = (state: GameState, rule: { readonly player: PlayerRef }, context: EffectContext): readonly PlayerId[] =>
  resolvePlayers(state, rule.player, { ...context, controllerId: speakerOf(state, context.selfInstanceId) });

/** "While Baron Zemo is engaged with you, you cannot thwart." */
export const cannotThwart = (state: GameState, deps: EngineDeps, playerId: PlayerId): boolean =>
  activeRules(state, deps, "cannotThwart").some(({ rule, context }) => rulePlayers(state, rule, context).includes(playerId));

/** "You cannot change form." */
export const cannotChangeForm = (state: GameState, deps: EngineDeps, playerId: PlayerId): boolean =>
  activeRules(state, deps, "cannotChangeForm").some(({ rule, context }) => rulePlayers(state, rule, context).includes(playerId));

/** "… cannot ready." */
export const cannotReady = (state: GameState, deps: EngineDeps, id: InstanceId): boolean =>
  activeRules(state, deps, "cannotReady").some(({ rule, context }) => matchesQuery(state, id, rule.target, context));

/** How many additional times this player resolves each When Revealed ability they reveal (Media Coverage). */
export const whenRevealedRepeats = (state: GameState, deps: EngineDeps, playerId: PlayerId): number =>
  activeRules(state, deps, "repeatWhenRevealed")
    .filter(({ rule, context }) => rulePlayers(state, rule, context).includes(playerId))
    .reduce((sum, { rule }) => sum + rule.times, 0);

/** RRG "Ally Limit": three, plus "increase your ally limit" abilities on cards that player controls. */
export const allyLimitFor = (state: GameState, deps: EngineDeps, playerId: PlayerId): number =>
  3 +
  activeRules(state, deps, "allyLimit")
    .filter(({ context }) => context.controllerId === playerId)
    .reduce((sum, { rule }) => sum + rule.amount, 0);

/** "This card cannot leave play while …" (`cannotLeavePlay`). */
export const cannotLeavePlay = (state: GameState, deps: EngineDeps, id: InstanceId): boolean =>
  activeRules(state, deps, "cannotLeavePlay").some(({ rule, context }) => matchesQuery(state, id, rule.target, context));

/** A side scheme at no threat that is not defeated for it (`notDefeatedWithoutThreat`; signature side schemes). */
export const notDefeatedWithoutThreat = (state: GameState, deps: EngineDeps, id: InstanceId): boolean =>
  activeRules(state, deps, "notDefeatedWithoutThreat").some(({ rule, context }) => matchesQuery(state, id, rule.target, context));

/** Where a scheme activation by this enemy places its threat instead of the main scheme (`schemeThreatDestination`), or null. */
export function schemeThreatDestination(state: GameState, deps: EngineDeps, enemyId: InstanceId): InstanceId | null {
  const redirected = activeRules(state, deps, "schemeThreatDestination").some(({ rule, context }) => matchesQuery(state, enemyId, rule.enemy, context));
  if (!redirected) return null;
  const scheme = villainOf(state, enemyId)?.signatureSideSchemeId ?? null;
  return scheme !== null && cardsInPlay(state).includes(scheme) ? scheme : null;
}

/** "The engaged player must defend against [this enemy]'s attacks with an ally they control, if able" (Melter). */
export const mustDefendWithAlly = (state: GameState, deps: EngineDeps, attackerId: InstanceId): boolean =>
  activeRules(state, deps, "mustDefendWithAlly").some(({ rule, context }) =>
    matchesQuery(state, attackerId, rule.attacker, context),
  );
