/**
 * Hand tags during the villain phase (D1/D2, P1/P2, T1/T2; issues #129, #138): each card in the viewer's hand says when
 * it can answer what the villain phase is doing, so the player reads their options without opening every card.
 *
 *  - PLAY NOW: the card is on offer in the interrupt window open right now; the hand rings it too.
 *  - WHEN HIT / ON A TREACHERY / WHEN THREAT LANDS: an optional interrupt or response, by what it waits for (an attack
 *    or damage, an encounter card being revealed, threat being placed), read off the ability's own trigger, never off
 *    its wording. One waiting for anything else reads WHEN IT TRIGGERS.
 *  - RESOURCE: a resource card.
 *  - YOUR TURN: everything else; it waits for the player's own turn.
 *
 * Pure: the engine's ability definitions say what each card waits for.
 */
import type { AbilityTriggerSpec, EngineDeps, GameState, InstanceId, PlayerId } from "@mc/engine";
import { activeAbilityRefs, cardOf } from "@mc/engine";

export type VillainHandTagKind = "now" | "hit" | "treachery" | "threat" | "trigger" | "resource" | "turn";

export interface VillainHandTag {
  readonly kind: VillainHandTagKind;
  /** What the tag says, as the design writes it ("WHEN HIT"). */
  readonly text: string;
  /** Ring the card on the table: it answers what is happening now. */
  readonly ring: boolean;
  /** Drawn as the player phase ended (`view/villain-end-of-turn.ts`): the tag reads "New · …". */
  readonly fresh?: boolean;
}

const TEXT: Record<VillainHandTagKind, string> = {
  now: "Play now",
  hit: "When hit",
  treachery: "On a treachery",
  threat: "When threat lands",
  trigger: "When it triggers",
  resource: "Resource",
  turn: "Your turn",
};

const HIT: ReadonlySet<string> = new Set([
  "enemyAttack",
  "attack",
  "characterAttacked",
  "dealDamage",
  "defended",
  "damagePrevented",
  "enemyActivating",
]);
const TREACHERY: ReadonlySet<string> = new Set([
  "encounterCardRevealing",
  "encounterCardBeingRevealed",
  "cardRevealed",
  "encounterCardResolved",
  "encounterCardBeingDealt",
  "encounterCardDealt",
  "boostCardTurnedFaceup",
]);
const THREAT: ReadonlySet<string> = new Set(["placeThreat", "enemyScheme", "accelerationTokenPlaced"]);

/** What an optional interrupt or response waits for; null for any other ability (an action, a forced trigger). */
export function triggerTagKindOf(trigger: AbilityTriggerSpec): "hit" | "treachery" | "threat" | "trigger" | null {
  if ((trigger.kind !== "interrupt" && trigger.kind !== "response") || trigger.forced) return null;
  const on = trigger.on.on;
  const kinds: readonly string[] = typeof on === "string" ? [on] : on;
  if (kinds.some((kind) => HIT.has(kind))) return "hit";
  if (kinds.some((kind) => TREACHERY.has(kind))) return "treachery";
  if (kinds.some((kind) => THREAT.has(kind))) return "threat";
  return "trigger";
}

/** One card's tag from its abilities' triggers, whether it is a resource card, and whether it is on offer now. */
export function villainHandTagOf(
  triggers: readonly AbilityTriggerSpec[],
  isResource: boolean,
  playableNow: boolean,
): VillainHandTag {
  const tag = (kind: VillainHandTagKind): VillainHandTag => ({ kind, text: TEXT[kind], ring: kind === "now" });
  if (playableNow) return tag("now");
  for (const trigger of triggers) {
    const kind = triggerTagKindOf(trigger);
    if (kind) return tag(kind);
  }
  return tag(isResource ? "resource" : "turn");
}

/** Whether two tag sets say the same thing, so the Board redraws only when one changes. */
export function sameHandTags(
  a: ReadonlyMap<InstanceId, VillainHandTag> | null,
  b: ReadonlyMap<InstanceId, VillainHandTag> | null,
): boolean {
  if (a === b) return true;
  if (!a || !b || a.size !== b.size) return false;
  for (const [id, tag] of a) {
    const other = b.get(id);
    if (other?.kind !== tag.kind || Boolean(other.fresh) !== Boolean(tag.fresh)) return false;
  }
  return true;
}

/** Every card in the viewer's hand, tagged; `playableNow` is the instances the open interrupt window offers. */
export function villainHandTagsOf(
  state: GameState,
  viewer: PlayerId | null,
  deps: EngineDeps,
  playableNow: ReadonlySet<InstanceId>,
  fresh: ReadonlySet<InstanceId> = new Set(),
): ReadonlyMap<InstanceId, VillainHandTag> {
  const tags = new Map<InstanceId, VillainHandTag>();
  const player = state.players.find((candidate) => candidate.playerId === viewer);
  if (!player) return tags;
  for (const id of player.hand) {
    const triggers = activeAbilityRefs(state, id, deps).flatMap((ref) => {
      const trigger = deps.abilities[ref.id]?.trigger;
      return trigger ? [trigger] : [];
    });
    const tag = villainHandTagOf(triggers, cardOf(state, id)?.type === "resource", playableNow.has(id));
    tags.set(id, fresh.has(id) ? { ...tag, text: `New · ${tag.text}`, fresh: true } : tag);
  }
  return tags;
}
