/**
 * Rules audit cause `restricted-weight-side-holster`, second half. Fork contributor's rules call 2026-10-16 (bluefireF5ran),
 * reverses upstream Q52 = B: a card that "counts as 2 restricted cards" (Laser Swords' shape, `deadpool` 44055) is one
 * of the player's restricted cards, a single card weighing 2. Over the limit it is offered for the discard beside the
 * keyword cards (RRG 1.8 "Restricted", p. 38), and discarding it frees its whole weight.
 */
import { trait, type CardId, type UpgradeCard } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { EngineDeps } from "../abilities.js";
import { applyCommand } from "../engine.js";
import type { InstanceId } from "../ids.js";
import { cardsInPlay, restrictedCardsOf, restrictedLoadOf, restrictedWeightOf } from "../select.js";
import type { GameState } from "../state.js";
import { depsOf } from "../testing/abilities.js";
import { stubUpgrade } from "../testing/fixtures.js";
import { giveCard, resolvePending } from "../testing/scenario.js";
import { gameAtFirstTurn, P1, playerCardIntoPlay } from "../testing/wave3.js";

const WEAPON = trait("Weapon");
const SWORDS: UpgradeCard = { ...stubUpgrade({ id: "swords", cost: 0, traits: [WEAPON] }), restrictedWeight: 2 };
const KATANA = stubUpgrade({ id: "katana", cost: 0, traits: [WEAPON], keywords: [{ name: "restricted" }] });
const BAZOOKA = stubUpgrade({ id: "bazooka", cost: 0, traits: [WEAPON], keywords: [{ name: "restricted" }] });
const deps: EngineDeps = depsOf();
const CARDS = [SWORDS, KATANA, BAZOOKA];

function start(inPlay: readonly CardId[]): { state: GameState; ids: readonly InstanceId[] } {
  let state = gameAtFirstTurn({ cards: CARDS, deps, deck: CARDS.flatMap((card) => [card.id, card.id]) });
  const ids: InstanceId[] = [];
  for (const card of inPlay) {
    const placed = playerCardIntoPlay(state, card);
    state = placed.state;
    ids.push(placed.id);
  }
  return { state, ids };
}
function play(state: GameState, card: CardId) {
  const given = giveCard(state, P1, card);
  const result = applyCommand(
    given.state,
    { type: "playCard", playerId: P1, cardInstanceId: given.id, payment: [], attachToInstanceId: null },
    deps,
  );
  if (!result.ok) throw new Error(result.error.message);
  return { state: result.state, id: given.id };
}
const sorted = (ids: readonly InstanceId[]): InstanceId[] => [...ids].sort();
const offered = (state: GameState): InstanceId[] =>
  state.pendingChoice?.prompt.kind === "discardRestricted"
    ? sorted(state.pendingChoice.options.map((o) => o.optionId as InstanceId))
    : [];
const inPlay = (state: GameState, id: InstanceId): boolean => cardsInPlay(state).includes(id);

describe("restricted-weight-side-holster: Laser Swords is one restricted card weighing 2", () => {
  it("is one of the player's restricted cards, counted once as a card and twice toward the limit", () => {
    const { state, ids } = start([SWORDS.id]);
    expect(restrictedCardsOf(state, P1, deps)).toEqual(ids);
    expect(restrictedWeightOf(state, ids[0]!, deps)).toBe(2);
    expect(restrictedLoadOf(state, P1, deps)).toBe(2);
  });

  it("over the limit, it is offered with the keyword cards and discarding it frees 2", () => {
    // Katana + Bazooka in play (2), Laser Swords played: 1 + 1 + 2 over a limit of 2.
    const { state, ids } = start([KATANA.id, BAZOOKA.id]);
    const swords = play(state, SWORDS.id);
    expect(offered(swords.state)).toEqual(sorted([...ids, swords.id]));
    expect(swords.state.pendingChoice?.maxSelections).toBe(1);
    const after = resolvePending(swords.state, [swords.id], deps);
    expect(inPlay(after, swords.id)).toBe(false);
    expect(ids.map((id) => inPlay(after, id))).toEqual([true, true]);
    expect(restrictedLoadOf(after, P1, deps)).toBe(2);
    expect(after.pendingChoice?.prompt.kind).not.toBe("discardRestricted");
  });

  it("discarding a keyword card first leaves the player over, and they are asked again", () => {
    const { state, ids } = start([KATANA.id, BAZOOKA.id]);
    const swords = play(state, SWORDS.id);
    const first = resolvePending(swords.state, [ids[0]!], deps);
    expect(restrictedLoadOf(first, P1, deps)).toBe(3);
    expect(offered(first)).toEqual(sorted([ids[1]!, swords.id]));
    const after = resolvePending(first, [ids[1]!], deps);
    expect(inPlay(after, swords.id)).toBe(true);
    expect(restrictedLoadOf(after, P1, deps)).toBe(2);
    expect(after.pendingChoice?.prompt.kind).not.toBe("discardRestricted");
  });
});
