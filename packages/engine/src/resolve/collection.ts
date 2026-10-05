/**
 * "Search your collection" (docs/phase7-wave7.md §3.81; RRG 1.8 "Search", p. 39): the one effect that brings a card
 * into the game from outside it.
 */

import type { AnyCard, CardId } from "@mc/content";
import { CARD_DATA_CATEGORIES, cardTraits } from "../campaign/ops.js";
import { type Ctx, emit, nextInstanceId, requestChoice, setFrame, updatePlayer } from "../ctx.js";
import { EngineInvariantError } from "../errors.js";
import { type EffectContext, resolvePlayers } from "../select.js";
import type { CollectionSearchFilter, EffectSpec } from "../spec.js";
import { type CardInstance, type GameState, NO_STATUSES } from "../state.js";
import { effectChoiceAuthority } from "../villain/authority.js";
import type { Frame } from "./frames.js";
import { markPreThenUnresolved } from "./then.js";

/**
 * A scenario-, campaign- or competitive-specific card is in no collection search: it "can only be used during a
 * campaign from the same product" (RRG 1.8 "Campaign-Specific Card", p. 11), by that campaign's own rules, and the
 * owner's decision leaves every such card out (§4.1 Q47 = A), whatever aspect it also prints.
 */
const matchesFilter = (card: AnyCard, filter: CollectionSearchFilter): boolean => {
  if ("specificTo" in card && card.specificTo !== undefined) return false;
  const categories = CARD_DATA_CATEGORIES[card.type];
  if (filter.categories && !filter.categories.some((category) => categories.includes(category))) return false;
  if (filter.aspects && !filter.aspects.includes("aspect" in card ? (card.aspect as string) : "")) return false;
  if (filter.traits) {
    const traits = cardTraits(card);
    if (!filter.traits.some((trait) => traits.includes(trait))) return false;
  }
  return true;
};

/**
 * The cards of `filter` a collection search can find right now, in title order (then card id), which is the order
 * they are offered in and does not depend on the order the pool was configured or deserialized in.
 *
 * The collection is the game's card pool (§4.1 Q47 = A). A card is in it while a copy is left outside the game: its
 * printed quantity in its product, less every instance of it the game holds, in any zone. That covers each seat's
 * deck copies and copies already fetched, and a copy removed from the game stays counted, since it "does not become a
 * part of the collection" (ruling, December 17, 2025 - Ruling 4, answer 1).
 */
export function collectionCandidates(state: GameState, filter: CollectionSearchFilter): readonly AnyCard[] {
  const inGame = new Map<string, number>();
  for (const instance of Object.values(state.instances))
    inGame.set(instance.cardId, (inGame.get(instance.cardId) ?? 0) + 1);
  const byTitle = (a: AnyCard, b: AnyCard): number => {
    if (a.name !== b.name) return a.name < b.name ? -1 : 1;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  };
  return Object.values(state.cardPool)
    .filter((card) => matchesFilter(card, filter) && card.quantityInSet - (inGame.get(card.id) ?? 0) > 0)
    .sort(byTitle);
}

/**
 * `EffectSpec searchCollection`. The choice is parked on the frame like every other; its answer is the recorded
 * command, and the new instance takes the next id of the game's instance counter, so replaying the log creates the
 * same card under the same id.
 */
export function executeSearchCollection(
  ctx: Ctx,
  frame: Frame<"effects">,
  effect: Extract<EffectSpec, { kind: "searchCollection" }>,
  context: EffectContext,
): void {
  const [playerId] = resolvePlayers(ctx.state, effect.player, context);
  const candidates = playerId ? collectionCandidates(ctx.state, effect.filter) : [];
  const bind = (found: CardInstance["instanceId"] | null): void =>
    setFrame(ctx, {
      ...frame,
      answer: null,
      cursor: frame.cursor + 1,
      bindings: { ...frame.bindings, [effect.bind]: found === null ? [] : [found] },
      vars: { ...frame.vars, [`${effect.bind}.count`]: found === null ? 0 : 1 },
    });
  if (!playerId) return bind(null);
  if (candidates.length === 0) {
    bind(null);
    // The same "then" gate as a deck search that found nothing (RRG 1.8 "'Then'", p. 44).
    markPreThenUnresolved(ctx, frame.frameId, "searchFoundNothing");
    return;
  }
  if (frame.answer === null) {
    requestChoice(ctx, {
      playerId,
      authority: effectChoiceAuthority(ctx.state, frame.selfInstanceId, effect.player),
      prompt: { kind: "searchCollection", slot: effect.bind },
      options: candidates.map((card) => ({
        optionId: card.id,
        label: card.name,
        ref: { kind: "cardDefinition", cardId: card.id } as const,
      })),
      minSelections: 0,
      maxSelections: 1,
      frameId: frame.frameId,
    });
    return;
  }
  const [answered] = frame.answer;
  if (answered === undefined) return bind(null);
  const card = candidates.find((candidate) => candidate.id === answered);
  if (!card) throw new EngineInvariantError(`"${answered}" is not a card the collection search can find`);
  bind(addFromCollection(ctx, card.id, playerId));
}

/** Creates the found card: owned and controlled by the searcher, out of play in their set-aside area, facedown. */
function addFromCollection(ctx: Ctx, cardId: CardId, ownerId: NonNullable<CardInstance["ownerId"]>) {
  const id = nextInstanceId(ctx);
  const instance: CardInstance = {
    instanceId: id,
    cardId,
    ownerId,
    controllerId: ownerId,
    home: { kind: "player" },
    faceup: false,
    exhausted: false,
    damage: 0,
    threat: 0,
    statuses: NO_STATUSES,
    counters: {},
    attachedTo: null,
    attachments: [],
    boostCards: [],
    tucked: [],
    facedownAs: null,
    engagedWith: null,
    flipped: false,
  };
  ctx.state = { ...ctx.state, instances: { ...ctx.state.instances, [id]: instance } };
  updatePlayer(ctx, ownerId, (player) => ({ ...player, setAside: [...player.setAside, id] }));
  emit(ctx, { type: "cardAddedFromCollection", cardId, instanceId: id, ownerId });
  return id;
}
