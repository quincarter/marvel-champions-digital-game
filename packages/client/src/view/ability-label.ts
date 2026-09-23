/**
 * A human name for one action ability on a card in play, for the board's
 * ability affordance and the Inspect picker (PLAN.md Phase 4, "Abilities on
 * cards in play are not reachable from the UI").
 *
 * `AbilityReference.label` — the printed sub-ability name, e.g. "Rechannel",
 * "Spider-Sense" — only exists "when the card names it" (`@mc/content`
 * `schema/abilities.ts`). Scanning every real Core game (Rhino solo, Klaw
 * 2-player, Ultron 4-player; see this file's test), no action ability that
 * ever reaches the player through `useAbility` carries one: the labeled ones
 * in Core content are all resource or interrupt/response abilities, consumed
 * as payment or triggers rather than tapped from the board. So the fallback
 * path below — the card's own name plus its cost, read straight off the
 * engine's `AbilityCost` — is what every real Core case uses today. This
 * still checks the printed label first, so a future card that does name an
 * action ability is named correctly rather than by its cost alone.
 *
 * Either way, nothing here is invented: every word traces back to
 * `AbilityReference.label`, `faceUpName`, or a field on `AbilityCost`.
 */

import type { AbilityId } from "@mc/content";
import {
  activeAbilityRefs,
  controllerOf,
  costAsDetermined,
  type AbilityCost,
  type EngineDeps,
  type GameState,
  type InstanceId,
} from "@mc/engine";
import { faceUpName } from "./names.js";

/** "Aunt May — exhaust" or, once a card names the ability, "Rocket Boots — Afterburners". */
export function abilityLabelOf(
  state: GameState,
  instanceId: InstanceId,
  abilityId: AbilityId,
  deps: EngineDeps,
): string {
  // The live face, not the card: an alter-ego's action is "Wanda Maximoff — Superpowered Siblings", and offering
  // it under the hero's name sent the player to the wrong side of the card for it.
  const name = faceUpName(state, instanceId);
  const short = abilityShortLabelOf(state, instanceId, abilityId, deps);
  return short ? `${name} — ${short}` : name;
}

/**
 * The same label with the card's own name left off, for the affordance drawn
 * *on* the card.
 *
 * The card is right there with its name on it, so repeating it spends the line's
 * whole width on the one thing the player can already read: at a play-area
 * panel's width "Surveillance Team — exhaust, remove 1 snoop counter" showed as
 * "▶ Surveillance Te…" — the name twice and the cost not at all. The cost is the
 * half the player cannot see anywhere else on the table.
 *
 * Null when the engine's `AbilityCost` yields no phrase at all, so the caller
 * decides what a nameless, costless ability should say rather than being handed
 * an invented word.
 */
export function abilityShortLabelOf(
  state: GameState,
  instanceId: InstanceId,
  abilityId: AbilityId,
  deps: EngineDeps,
): string | null {
  const printed = activeAbilityRefs(state, instanceId).find((ref) => ref.id === abilityId)?.label;
  if (printed) return printed;
  // RRG "Special": a card's own printed sub-heading is literally the word "Special" (Invocation cards, Wakanda
  // Forever!'s targets) — never named on the `AbilityReference` itself (there is nothing else to call it), so this
  // is the one case where the label isn't traced back to printed data via `.label`/`AbilityCost`.
  if (deps.abilities[abilityId]?.trigger.kind === "special") return "Special";
  // Navigation Column (16172) etc.: `conditional` costs read the wrong branch (or none) unless resolved against
  // the board first (`costAsDetermined`, engine `actions.ts` §3.49) — the written cost is only ever a template.
  const written = deps.abilities[abilityId]?.cost;
  const controllerId = controllerOf(state, instanceId);
  const determined = controllerId ? costAsDetermined(state, deps, instanceId, controllerId, written) : written;
  return costPhrase(determined);
}

/**
 * The cost in the engine's own terms, comma-joined in the order `AbilityCost`
 * declares its fields. Never a made-up verb: each phrase names exactly the
 * field that produced it, so a new cost shape either gets a phrase here or
 * silently contributes nothing rather than a guess.
 */
function costPhrase(cost: AbilityCost | undefined): string | null {
  if (!cost) return null;
  const parts: string[] = [];
  // Roughly the order printed cost text uses (RRG "Cost" gives no rule for
  // it): exhaust, then what's spent, then what's discarded — "Spend 1
  // [physical] resource and discard Tenacity" reads spend-then-discard, not
  // the other way around.
  if (cost.exhaustSelf) parts.push("exhaust");
  if (cost.exhaustIdentity) parts.push("exhaust your identity");
  const resources = resourcePhrase(cost.resources);
  if (resources) parts.push(resources);
  if (cost.resourcesX) parts.push(`spend X ${cost.resourcesX.resource}`);
  if (cost.spendCounters) {
    const { amount, counterType } = cost.spendCounters;
    parts.push(`remove ${amount} ${counterType} counter${amount === 1 ? "" : "s"}`);
  }
  if (cost.damageSelf !== undefined) parts.push(`take ${cost.damageSelf} damage`);
  if (cost.damageThisCard !== undefined) parts.push(`deal ${cost.damageThisCard} damage to it`);
  if (cost.healIdentity !== undefined) parts.push(`heal ${cost.healIdentity} damage`);
  if (cost.discardFromHand) {
    const { min, max } = cost.discardFromHand;
    parts.push(min === max ? `discard ${min} card${min === 1 ? "" : "s"}` : `discard up to ${max} cards`);
  }
  if (cost.discardSelf) parts.push("discard this card");
  if (cost.payPrintedCostOf) parts.push("pay a card's printed cost");
  return parts.length > 0 ? parts.join(", ") : null;
}

function resourcePhrase(resources: AbilityCost["resources"]): string | null {
  if (!resources) return null;
  if (typeof resources === "number") return resources > 0 ? `spend ${resources}` : null;
  const typed = Object.entries(resources)
    .filter((entry): entry is [string, number] => typeof entry[1] === "number" && entry[1] > 0)
    .map(([type, amount]) => `${amount} ${type}`);
  return typed.length > 0 ? `spend ${typed.join(", ")}` : null;
}
