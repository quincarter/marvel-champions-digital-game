/**
 * Where an attachment or a player upgrade may attach: the host its "attach to" text allows (`AttachmentHost`), read from
 * the state alone, so the reveal's attach step, playing an upgrade, putting one into play and a query asking "can this
 * be attached to that" (`TargetQuery.canAttachTo`) all get one answer.
 */

import type { AttachmentHost } from "@mc/content";
import { DEFAULT_DEPS, type EngineDeps } from "./abilities.js";
import type { InstanceId, PlayerId } from "./ids.js";
import { hasKeyword } from "./keywords.js";
import {
  activeVillainIdFor,
  cardOf,
  characterProfile,
  currentName,
  getPlayer,
  mainSchemeFor,
  mustInstance,
  printedCostOf,
  printedProfile,
  remainingHitPoints,
  undefeatedVillains,
  villainOf,
} from "./query.js";
import { attachLimitFault, canHaveAttached } from "./rules.js";
import {
  cardsInPlay,
  classificationsOf,
  contextArea,
  controllerOf,
  type EffectContext,
  selectTargets,
  traitsOf,
} from "./select.js";
import type { TargetQuery } from "./spec.js";
import type { GameState } from "./state.js";

const HOST_QUERIES: Partial<Record<AttachmentHost["kind"], TargetQuery>> = {
  sideScheme: { categories: ["sideScheme"] },
  scheme: { categories: ["scheme"] },
  hero: { categories: ["hero"] },
  ally: { categories: ["ally"] },
  minion: { categories: ["minion"] },
  enemy: { categories: ["enemy"] },
  anyCharacter: { categories: ["character"] },
};

type QualifiedHost = Extract<AttachmentHost, { kind: "qualified" }>;
type SuperlativeHost = Extract<AttachmentHost, { kind: "superlative" }>;

/** The pool a `qualified` or `superlative` host ranks among; `friendlyCharacter` is narrowed by `isFriendly`. */
const POOL_QUERIES: Record<QualifiedHost["category"] | SuperlativeHost["among"], TargetQuery> = {
  ally: { categories: ["ally"] },
  minion: { categories: ["minion"] },
  enemy: { categories: ["enemy"] },
  villain: { categories: ["villain"] },
  character: { categories: ["character"] },
  friendlyCharacter: { categories: ["character"] },
  sideScheme: { categories: ["sideScheme"] },
};

/** "The villain" for this context: the active villain, or the context's game area's (docs/phase7-wave2.md §3.1). */
function theVillain(state: GameState, context: EffectContext): readonly InstanceId[] {
  const id = activeVillainIdFor(state, contextArea(state, context));
  const villain = id ? villainOf(state, id) : undefined;
  return villain && !villain.defeated ? [villain.instanceId] : [];
}

/** RRG 1.8 "Friendly" (p. 21): "cards the players control". */
const isFriendly = (state: GameState, id: InstanceId): boolean => controllerOf(state, id) !== null;

const printedHpOf = (state: GameState, id: InstanceId): number => printedProfile(state, id)?.maxHp ?? 0;

/** What a `superlative` host ranks by (RRG 1.8 "Printed", p. 35, for the printed values). */
function hostMeasure(state: GameState, id: InstanceId, measure: SuperlativeHost["measure"], deps: EngineDeps): number {
  switch (measure) {
    case "printedHp":
      return printedHpOf(state, id);
    case "remainingHp":
      return remainingHitPoints(state, id, deps) ?? 0;
    case "printedAtk":
      return printedProfile(state, id)?.atk ?? 0;
    case "atk":
      return characterProfile(state, id, deps)?.atk ?? 0;
    case "thw":
      // "The ally with the lowest THW" (Possessed): the current value, like `atk`/`sch` beside it.
      return characterProfile(state, id, deps)?.thw ?? 0;
    case "sch":
      return characterProfile(state, id, deps)?.sch ?? 0;
    case "activationOrder": {
      // The Sinister Six's printed "Activation Order N" (`VillainCard.activationOrder`); `superlative` drops a villain
      // without one before ranking, so this 0 is never compared.
      const card = cardOf(state, id);
      return card?.type === "villain" ? (card.activationOrder ?? 0) : 0;
    }
    case "traitCount":
      // "The minion with the most traits" (Cyborg Tech): printed and gained traits (RRG 1.8 "Gains"), each counted once.
      return new Set(traitsOf(state, id, deps)).size;
    case "printedCost": {
      // "The ally with the highest cost" (Beguiled, 'Pool-ized): the printed cost (RRG 1.8 "Printed", p. 35). A card
      // in play has no other cost — cost modifiers change what a card costs to *play*. Cards with none are dropped
      // by `hasMeasure` before ranking, so this 0 is never compared.
      return printedCostOf(state, cardOf(state, id));
    }
  }
}

/** Whether a card has a value for this measure at all (a villain with no printed activation order has none). */
function hasMeasure(state: GameState, id: InstanceId, measure: SuperlativeHost["measure"]): boolean {
  const card = cardOf(state, id);
  if (measure === "printedCost") return card !== undefined && "cost" in card && typeof card.cost === "number";
  if (measure !== "activationOrder") return true;
  return card?.type === "villain" && card.activationOrder !== undefined;
}

/** "an X-MEN ally", "a non-ELITE minion", "without another Goblin Glider attached" (`HostQualifiers`). */
function passesQualifiers(
  state: GameState,
  id: InstanceId,
  host: QualifiedHost | SuperlativeHost,
  deps: EngineDeps,
  context: EffectContext,
): boolean {
  // "The ally you control" (Manipulated Mind): on an encounter card "you" is the revealing player, on a player card its
  // controller (RRG 1.8 "You, Your", p. 46) — the context's controller either way. Nobody to be "you" matches nothing.
  if (host.controlledBy === "you" && (!context.controllerId || controllerOf(state, id) !== context.controllerId))
    return false;
  // "An identity-specific ally" (docs/phase7-wave8.md §3.53): the host's printed classification (RRG 1.8
  // "Classifications", p. 12), of any identity's set, as `TargetQuery.classification` reads it.
  if (host.classification !== undefined && !classificationsOf(state, id).includes(host.classification)) return false;
  if (host.trait && !traitsOf(state, id, deps).includes(host.trait)) return false;
  if (host.withoutTrait && traitsOf(state, id, deps).includes(host.withoutTrait)) return false;
  const barred = host.withoutAttachmentNamed;
  if (barred !== undefined && mustInstance(state, id).attachments.some((a) => currentName(state, a) === barred))
    return false;
  // "a non-permanent side scheme" (docs/phase7-wave2.md §6.5): printed or gained keywords.
  if (host.keyword !== undefined && !hasKeyword(state, id, host.keyword, deps)) return false;
  if (host.withoutKeyword !== undefined && hasKeyword(state, id, host.withoutKeyword, deps)) return false;
  // "a character with 'Spider' in its title" (Warrior of the Great Web): the title showing, not the subtitle beneath
  // it (RRG 1.8 "Subtitle", p. 41) — `currentName` is the same face `namedCard` compares against.
  if (host.titleContains !== undefined && !(currentName(state, id) ?? "").includes(host.titleContains)) return false;
  // "an enemy that X-23 or Honey Badger attacked this turn" (docs/phase7-wave2.md §11.3, §14): the attacks recorded
  // against this card this turn, matched by the title each attacker showed *when it attacked* (RRG 1.8 "Referential
  // Ability", p. 36), so a hero who attacked and then changed form still counts.
  if (host.attackedThisTurnBy !== undefined) {
    const attacks = state.attackedThisTurn[id] ?? [];
    const titles = host.attackedThisTurnBy;
    if (!attacks.some((attack) => titles.includes(attack.attackerTitle))) return false;
  }
  return true;
}

/**
 * Every legal host for an attachment right now, in stable order (docs/phase7-wave1.md §1.6, §3.14).
 *
 * RRG 1.8 "Attach To" (p. 8): "The 'attach to' phrase is checked for legality when the card would be attached", so
 * this is evaluated at that moment and never cached. An empty result means the card cannot attach and is discarded
 * by the caller — with no replacement card revealed (FAQ "Counterspell (#30)", p. 60: "Because it is unable to meet
 * its condition, simply discard it. (Do not reveal a new encounter card in its place.)").
 *
 * Several candidates are a choice for the first player on an encounter card (RRG 1.8 "First Player", p. 19); the
 * superlative kinds return every tied card for that reason.
 */
export function attachmentHostCandidates(
  state: GameState,
  host: AttachmentHost,
  context: EffectContext,
  { ignoreAttachLimits = false }: { readonly ignoreAttachLimits?: boolean } = {},
): readonly InstanceId[] {
  // "Odin cannot have cards attached" (`cannotHaveAttachments`, docs/phase7-wave4.md §3.8): never a legal host. A host
  // already at the card's own "Max 1 per ally" / "Max 1 TRAINING upgrade per ally" is not one either (wave 6 §3.28),
  // unless the caller reports that maximum itself (`legalActions` lists such a host as blocked, with its reason).
  const deps = context.deps ?? DEFAULT_DEPS;
  return rawHostCandidates(state, host, context).filter(
    (id) =>
      canHaveAttached(state, deps, id, context.selfInstanceId) &&
      (ignoreAttachLimits || attachLimitFault(state, deps, id, context.selfInstanceId) === null),
  );
}

/**
 * The legal hosts of a player upgrade entering play under `controllerId`: the one decision a play (`playCard`,
 * `playFromHand`), a put into play (`putIntoPlay`) and the query "an upgrade that can be attached to X"
 * (`TargetQuery.canAttachTo`) all read. An upgrade with no "attach to" text goes by its controller's identity (RRG 1.8
 * "Upgrade", p. 46: "Most upgrade cards enter play near a player's identity card"), unless a "Max N per …" stops it
 * (`attachLimitFault`); one with the text has the hosts that text allows, read with "you" as that controller
 * (`attachmentHostCandidates`: RRG 1.8 "Attach To", p. 8, "checked for legality when the card would be attached").
 * Empty for a card that is not an upgrade, and for an upgrade with no legal host.
 */
export function upgradeHostCandidates(
  state: GameState,
  deps: EngineDeps,
  id: InstanceId,
  controllerId: PlayerId,
): readonly InstanceId[] {
  const card = cardOf(state, id);
  if (card?.type !== "upgrade") return [];
  if (!card.attachesTo) {
    const identity = getPlayer(state, controllerId)?.identity.instanceId;
    return identity === undefined || attachLimitFault(state, deps, identity, id) ? [] : [identity];
  }
  return attachmentHostCandidates(state, card.attachesTo, {
    selfInstanceId: id,
    controllerId,
    event: null,
    bindings: {},
    deps,
  });
}

/**
 * The hosts a card's own printed text lets it attach to under `controllerId`: an upgrade's (`upgradeHostCandidates`),
 * or an encounter attachment's "attach to" hosts. Empty for any other card and for an attachment with no such text.
 */
export function attachHostCandidates(
  state: GameState,
  deps: EngineDeps,
  id: InstanceId,
  controllerId: PlayerId,
): readonly InstanceId[] {
  const card = cardOf(state, id);
  if (card?.type !== "attachment") return upgradeHostCandidates(state, deps, id, controllerId);
  if (!card.attachesTo) return [];
  return attachmentHostCandidates(state, card.attachesTo, {
    selfInstanceId: id,
    controllerId,
    event: null,
    bindings: {},
    deps,
  });
}

/**
 * Whether a printed "attach to" allows a card of this category, read from the host text alone with no card in play
 * consulted (`TargetQuery.canAttachToCategory`, docs/phase7-wave8.md §3.59; owner decision §4.1 Q30 = A: "eligibility
 * comes from the upgrade's own attach text; no ally host needs to be in play, and the board state is not evaluated").
 *
 * For "ally": a host that is an ally (`ally`, a `qualified` or `superlative` host over allies), or a wider pool an
 * ally belongs to (`anyCharacter`, `friendlyCharacter`, a `qualified` or `superlative` host over characters or
 * friendly characters). A qualifier is not weighed (a trait, a classification, "you control"): it narrows which ally,
 * not whether an ally. A host of several parts (`anyOf`, `ifAble`) allows what any part allows. A host that names a
 * card (`namedCard`) or an encounter-side card does not, whatever that card happens to be.
 */
export function hostAllowsCategory(host: AttachmentHost, category: "ally"): boolean {
  switch (host.kind) {
    case "ally":
    case "anyCharacter":
    case "friendlyCharacter":
      return true;
    case "qualified":
      return host.category === category || host.category === "character" || host.category === "friendlyCharacter";
    case "superlative":
      return host.among === category || host.among === "friendlyCharacter";
    case "anyOf":
      return host.hosts.some((part) => hostAllowsCategory(part, category));
    case "ifAble":
      return hostAllowsCategory(host.preferred, category) || hostAllowsCategory(host.otherwise, category);
    default:
      return false;
  }
}

function rawHostCandidates(state: GameState, host: AttachmentHost, context: EffectContext): readonly InstanceId[] {
  const deps = context.deps ?? DEFAULT_DEPS;
  switch (host.kind) {
    case "villain":
      // "Attach to the villain": the active villain (The Wrecking Crew insert, "The Active Villain"), the area's own
      // with separate game areas (docs/phase7-wave2.md §3.1).
      return theVillain(state, context);
    case "namedVillain":
      // "Attach to Wrecker": by the title showing, so a flipped villain is found under its current face's name.
      return undefeatedVillains(state)
        .filter((villain) => currentName(state, villain.instanceId) === host.name)
        .map((villain) => villain.instanceId);
    case "mainScheme": {
      // The main scheme of the revealing player's area when the players are split (docs/phase7-wave2.md §3.1).
      const scheme = mainSchemeFor(state, contextArea(state, context));
      return scheme ? [scheme.instanceId] : [];
    }
    case "villainSideScheme": {
      // "Attach to the active villain's side scheme" (Held Hostage), or a named villain's.
      const of = host.of;
      const villains =
        of === "activeVillain"
          ? undefeatedVillains(state).filter((villain) => villain.instanceId === state.activeVillainId)
          : undefeatedVillains(state).filter((villain) => currentName(state, villain.instanceId) === of.villainName);
      const inPlay = cardsInPlay(state);
      return villains.flatMap((villain) =>
        villain.signatureSideSchemeId && inPlay.includes(villain.signatureSideSchemeId)
          ? [villain.signatureSideSchemeId]
          : [],
      );
    }
    case "yourIdentity": {
      // RRG 1.8 "You, Your": on an encounter card, the player resolving it. An identity not in the named form is no
      // legal host, so the card is discarded (FAQ "Counterspell (#30)", p. 60).
      const playerId = context.controllerId;
      const player = playerId ? getPlayer(state, playerId) : undefined;
      if (!player || player.eliminated) return [];
      if (host.form !== undefined && player.identity.form !== host.form) return [];
      // "Attach to your identity if a copy of Targeted for Elimination is not attached to you" (docs/phase7-wave6.md
      // §1.3): checked by the title each attachment shows, as for the `qualified` host's qualifier.
      const barred = host.withoutAttachmentNamed;
      const identity = player.identity.instanceId;
      if (
        barred !== undefined &&
        mustInstance(state, identity).attachments.some((a) => currentName(state, a) === barred)
      )
        return [];
      return [identity];
    }
    case "friendlyCharacter":
      return selectTargets(state, { categories: ["character"] }, context).filter((id) => isFriendly(state, id));
    case "namedCard":
      return selectTargets(state, { name: host.name }, context);
    case "qualified": {
      const pool = selectTargets(state, POOL_QUERIES[host.category], context).filter(
        (id) => host.category !== "friendlyCharacter" || isFriendly(state, id),
      );
      return pool.filter((id) => passesQualifiers(state, id, host, deps, context));
    }
    case "minionWithHighestPrintedHp": {
      const minions = selectTargets(state, { categories: ["minion"] }, context).filter(
        (id) =>
          host.withoutAttachmentNamed === undefined ||
          !mustInstance(state, id).attachments.some((a) => currentName(state, a) === host.withoutAttachmentNamed),
      );
      const highest = Math.max(...minions.map((id) => printedHpOf(state, id)));
      return minions.filter((id) => printedHpOf(state, id) === highest);
    }
    case "superlative": {
      // "The enemy with the highest printed hit points and without another Goblin Glider attached."
      const pool = selectTargets(state, POOL_QUERIES[host.among], context)
        .filter((id) => host.among !== "friendlyCharacter" || isFriendly(state, id))
        .filter((id) => passesQualifiers(state, id, host, deps, context))
        .filter((id) => hasMeasure(state, id, host.measure));
      if (pool.length === 0) return [];
      const values = pool.map((id) => hostMeasure(state, id, host.measure, deps));
      const best = host.order === "highest" ? Math.max(...values) : Math.min(...values);
      return pool.filter((_, index) => values[index] === best);
    }
    case "ifAble": {
      // "Attach to Yellowjacket, if able. If you cannot, attach to the villain." (docs/phase7-wave2.md §1.7). The
      // fallback is only considered when the preferred host has no legal candidate at this moment (RRG 1.8 "Attach
      // To", p. 8).
      const preferred = attachmentHostCandidates(state, host.preferred, context);
      return preferred.length > 0 ? preferred : attachmentHostCandidates(state, host.otherwise, context);
    }
    case "anyOf": {
      // "Attach to an enemy or scheme." / "Attach to Greycrow or Harpoon." (docs/phase7-wave2.md §6.6): every host any
      // part names, each once, in the order listed.
      const all = host.hosts.flatMap((part) => attachmentHostCandidates(state, part, context));
      return [...new Set(all)];
    }
    case "leader": {
      // Cooperative play only (the Civil War rulebook, p. 6): "The leader in play is called 'the enemy leader.'", so the
      // enemy leader is the villain; "A card ability that refers to 'your leader' cannot be resolved." (competitive mode,
      // where a team has a leader of its own, is not built). Ruling, Jul 9, 2026 (3) answer 2.
      if (host.of === "yours") return [];
      return theVillain(state, context);
    }
    case "encounterCard":
      // "Attach to an encounter card in play." (Coordinated Effort): every in-play card on the encounter side,
      // whatever its type. RRG 1.8 "Encounter Card" (p. 18); an encounter card has no controller, which is the same
      // test `isFriendly` inverts.
      return selectTargets(state, {}, context).filter((id) => !isFriendly(state, id));
    case "nonActiveVillain":
      // "Attach to the villain who is not the active villain." (Direct Assault): several are a first-player choice.
      return undefeatedVillains(state)
        .filter((villain) => villain.instanceId !== state.activeVillainId)
        .map((villain) => villain.instanceId);
    default: {
      const query = HOST_QUERIES[host.kind];
      return query ? selectTargets(state, query, context) : [];
    }
  }
}
