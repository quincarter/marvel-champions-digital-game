/**
 * `EffectSpec pairCards` (docs/phase7-wave8.md §3.36): a player assigns cards, one each, to different characters, and
 * a pair matches when the two share a resource icon.
 *
 * MC45 p. 6, steps 1 and 2 of a mission attempt: "Assign each of the discarded cards to a different ally at the
 * mission." / "If a resource icon on the ally matches a resource icon on the card assigned to it, that ally
 * participates." / "Wild resource icons ([wild]) on cards discarded for the mission attempt may be used to match any
 * resource icon on an ally at the mission" / "Any resource icon … may be used to match an ally with a wild resource
 * icon". The rulebook's own rule for this match stands in for RRG 1.8 "Wild Resource" (p. 48), which is about paying.
 * The engine knows no "mission": the cards are a slot, the characters a query.
 */

import { displayNameOf } from "../visibility.js";
import type { ChoiceOption, ChoicePrompt } from "../choices.js";
import { type Ctx, emit, requestChoice, setFrame } from "../ctx.js";
import type { InstanceId } from "../ids.js";
import { showingResources } from "../query.js";
import { RESOURCE_TYPES, type ResourcePool, type ResourceType } from "../resources.js";
import { pairLimitFor, resourceIconsInPlay } from "../rules.js";
import { type EffectContext, resolvePlayers, resolveRef, selectTargets } from "../select.js";
import type { EffectSpec, PairLimit } from "../spec.js";
import { effectChoiceAuthority } from "../villain/authority.js";
import type { Frame } from "./frames.js";

/** A pairing option's id: the card, then the character it is assigned to. */
export const pairOptionId = (card: InstanceId, character: InstanceId): string => `${card}>${character}`;

/** The pair an option id names, or null for an id of another shape. */
export function pairOfOptionId(optionId: string): { readonly card: InstanceId; readonly character: InstanceId } | null {
  const at = optionId.indexOf(">");
  if (at <= 0 || at === optionId.length - 1) return null;
  return { card: optionId.slice(0, at) as InstanceId, character: optionId.slice(at + 1) as InstanceId };
}

const typesOf = (pool: ResourcePool): readonly ResourceType[] => RESOURCE_TYPES.filter((type) => pool[type] > 0);

/**
 * Whether a card's icons match a character's (`match: "resourceIcon"`, `wild: "either"`): they share a resource type,
 * or either side has a [wild] and the other has any icon at all. A side with no icon matches nothing (an encounter
 * card discarded from a player's deck has none).
 */
export function resourceIconsMatch(card: readonly ResourceType[], character: readonly ResourceType[]): boolean {
  if (card.length === 0 || character.length === 0) return false;
  if (card.includes("wild") || character.includes("wild")) return true;
  return card.some((type) => character.includes(type));
}

/**
 * Why a selection of pairing options is not a legal pairing, or null (`ChoicePrompt pairCards`): each card goes to at
 * most one character and each character takes at most one card ("to a different ally"); under a
 * `distinctBy: "resourceIcon"` limit no two assigned cards share a printed resource type, [wild] being a type of its
 * own there ("cards with the same resource icon ([energy], [mental], [physical], or [wild])"). A card with several
 * types shares if any type is shared.
 */
export function pairSelectionFault(
  prompt: Extract<ChoicePrompt, { kind: "pairCards" }>,
  selected: readonly string[],
): string | null {
  const cards = new Set<InstanceId>();
  const characters = new Set<InstanceId>();
  for (const optionId of selected) {
    const pair = pairOfOptionId(optionId);
    if (!pair) return `${optionId} is not a pairing`;
    if (cards.has(pair.card)) return "a card is assigned to one character only";
    if (characters.has(pair.character)) return "each card is assigned to a different character";
    cards.add(pair.card);
    characters.add(pair.character);
  }
  if (prompt.limit?.distinctBy === "resourceIcon") {
    const seen = new Set<ResourceType>();
    for (const card of cards) {
      const types = prompt.icons[card] ?? [];
      if (types.some((type) => seen.has(type)))
        return "cards with the same resource icon cannot be assigned to more than one character";
      for (const type of types) seen.add(type);
    }
  }
  return null;
}

export function executePairCards(
  ctx: Ctx,
  frame: Frame<"effects">,
  effect: Extract<EffectSpec, { kind: "pairCards" }>,
  context: EffectContext,
): void {
  const [chooser] = resolvePlayers(ctx.state, effect.chooser, context);
  // Bound and logged whether or not anything was paired, so a replay shows an attempt that paired nothing.
  const finish = (pairs: readonly { card: InstanceId; character: InstanceId; matched: boolean }[]): void => {
    const matched = pairs.filter((pair) => pair.matched).map((pair) => pair.character);
    setFrame(ctx, {
      ...frame,
      answer: null,
      cursor: frame.cursor + 1,
      bindings: {
        ...frame.bindings,
        [`${effect.bind}.matched`]: matched,
        [`${effect.bind}.paired`]: pairs.map((pair) => pair.character),
      },
      vars: { ...frame.vars, [`${effect.bind}.pairs`]: pairs.length, [`${effect.bind}.count`]: matched.length },
    });
    emit(ctx, {
      type: "cardsPaired",
      playerId: chooser ?? null,
      sourceInstanceId: frame.selfInstanceId,
      pairs: pairs.map((pair) => ({
        cardInstanceId: pair.card,
        characterInstanceId: pair.character,
        matched: pair.matched,
      })),
    });
  };

  const cards = [...new Set(resolveRef(ctx.state, effect.cards, context))];
  const characters = selectTargets(ctx.state, effect.with, context);
  if (!chooser || cards.length === 0 || characters.length === 0) return finish([]);

  const icons: Record<string, readonly ResourceType[]> = {};
  for (const card of cards) icons[card] = typesOf(showingResources(ctx.state, card));
  for (const character of characters)
    icons[character] = typesOf(resourceIconsInPlay(ctx.state, ctx.deps, character).icons);
  const matches = (card: InstanceId, character: InstanceId): boolean =>
    resourceIconsMatch(icons[card] ?? [], icons[character] ?? []);

  if (frame.answer === null) {
    const limit: PairLimit | undefined =
      effect.limit ?? pairLimitFor(ctx.state, ctx.deps, effect.with.inScenarioPlayArea ?? null) ?? undefined;
    const options: ChoiceOption[] = cards.flatMap((card) =>
      characters.map((character) => ({
        optionId: pairOptionId(card, character),
        label: `${displayNameOf(ctx.state, card)} → ${displayNameOf(ctx.state, character)}`,
        ref: { kind: "card", instanceId: character } as const,
      })),
    );
    requestChoice(ctx, {
      playerId: chooser,
      authority: effectChoiceAuthority(ctx.state, frame.selfInstanceId, effect.chooser),
      prompt: {
        kind: "pairCards",
        cards,
        with: characters,
        icons,
        matching: options
          .map((o) => o.optionId)
          .filter((id) => {
            const pair = pairOfOptionId(id);
            return pair !== null && matches(pair.card, pair.character);
          }),
        ...(limit ? { limit } : {}),
        sourceInstanceId: frame.selfInstanceId,
      },
      options,
      minSelections: 0,
      maxSelections: Math.min(cards.length, characters.length),
      frameId: frame.frameId,
    });
    return;
  }
  const pairs = frame.answer.flatMap((optionId) => {
    const pair = pairOfOptionId(optionId);
    return pair ? [{ ...pair, matched: matches(pair.card, pair.character) }] : [];
  });
  finish(pairs);
}
