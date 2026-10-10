/**
 * docs/phase7-wave9.md §3.40 (b): `whileTucked(...)`, `on.thisDiscardedFromUnder(...)` and
 * `on.tuckedCardDiscarded(...)`, the builders behind "Forced Response: After a player card effect discards this card
 * from under an identity, that identity takes 2 damage." (Hunting the Spider-Bride, `silk` 52031). The engine's
 * `tucked-card-discarded.test.ts` drives the plain data.
 *
 * The last block runs that ability, on a Core treachery borrowed for it, against the scripted Silk identity (52001a/b):
 * owner decision §4.1 Q7 = A (provisional) says Cindy Moon's cost and the identity's four-card cap are both "a player
 * card effect", and the event has to report them as a player card's for that to hold.
 */

import { cardId } from "@mc/content";
import type { Command, EngineDeps, GameState, InstanceId } from "@mc/engine";
import { describe, expect, it, vi } from "vitest";
import { firstLegal, identityOf, inst, P1, use } from "../testing/harness.js";
import { driveEventsPicking } from "../testing/staging.js";
import { SILK_DEPS, silkGame, silkHeroGame, tuckEncounterCard } from "../wave9/silk/testing.js";
import {
  dealDamage,
  defineAbilities,
  discardTuckedCost,
  eventPlayer,
  forcedInterrupt,
  forcedResponse,
  identityOf as identityRef,
  on,
  response,
  validateDefinition,
  whileTucked,
} from "./index.js";

vi.setConfig({ testTimeout: 120_000 });

const spiderBride = () =>
  whileTucked(
    forcedResponse(
      on.thisDiscardedFromUnder({ fromUnder: "identity", by: "playerCard" }),
      dealDamage(2, identityRef(eventPlayer)),
    ),
  );

describe("`on.thisDiscardedFromUnder` and `on.tuckedCardDiscarded`", () => {
  it("the card's own discard from under any card, with nothing asked of the cause", () => {
    expect(on.thisDiscardedFromUnder()).toEqual({ on: "tuckedCardDiscarded", selfIs: "target" });
  });
  it("Q7 = A: 'a player card effect … from under an identity' asks the side and the host, not effect or cost", () => {
    expect(on.thisDiscardedFromUnder({ fromUnder: "identity", by: "playerCard" })).toEqual({
      on: "tuckedCardDiscarded",
      selfIs: "target",
      eventIs: { under: "identity", by: "playerCard" },
    });
  });
  it("`how` narrows it to an effect, a cost or the game's rule (answer B of Q7 would add `how: 'effect'`)", () => {
    expect(on.thisDiscardedFromUnder({ by: "playerCard", how: "effect" }).eventIs).toEqual({
      by: "playerCard",
      how: "effect",
    });
    expect(on.thisDiscardedFromUnder({ how: ["effect", "cost"] }).eventIs).toEqual({ how: ["effect", "cost"] });
  });
  it("a card in play hears any tucked card's discard, or only those from under its controller's cards", () => {
    expect(on.tuckedCardDiscarded()).toEqual({ on: "tuckedCardDiscarded" });
    expect(on.tuckedCardDiscarded({ yours: true, fromUnder: "identity" })).toEqual({
      on: "tuckedCardDiscarded",
      playerIs: "controller",
      eventIs: { under: "identity" },
    });
  });
});

describe("`whileTucked`", () => {
  it("marks the ability as the tucked card's own and validates as a forced response to its discard", () => {
    const definition = spiderBride();
    expect(definition.activeIn).toBe("tucked");
    expect(definition.trigger).toMatchObject({ kind: "response", forced: true });
    expect(validateDefinition(definition)).toEqual([]);
  });
  it("rejects any other trigger, an event that is not the card's own discard, and a cost", () => {
    const problem =
      "only a response to the card's own discard from under a card works for a tucked card (whileTucked needs response(on.thisDiscardedFromUnder(), …))";
    expect(
      validateDefinition(whileTucked(forcedInterrupt(on.leavesPlay("self"), dealDamage(1, identityRef())))),
    ).toContain(problem);
    expect(validateDefinition(whileTucked(response(on.tuckedCardDiscarded(), dealDamage(1, identityRef()))))).toContain(
      problem,
    );
    const paid = whileTucked(
      response(on.thisDiscardedFromUnder(), { cost: discardTuckedCost() }, dealDamage(1, identityRef())),
    );
    expect(validateDefinition(paid)).toContain("an ability of a tucked card has no cost");
  });
});

describe("Q7 = A against the scripted Silk identity: the cost and the cap are a player card's discards", () => {
  /** "I'm Tough!" (Core 01105), borrowed: it carries the Spider-Bride response while tucked. */
  const BORROWED = "01105";
  const CURSE = "01105.test-spider-bride";
  const deps: EngineDeps = {
    abilities: { ...SILK_DEPS.abilities, ...defineAbilities({ [CURSE]: spiderBride() }) },
  };
  /** Surgery on the card pool: the borrowed treachery also prints the test ability. */
  function withCurse(state: GameState): GameState {
    const id = cardId(BORROWED);
    const card = state.cardPool[id]!;
    if (!("abilities" in card)) throw new Error("the borrowed card has no abilities list");
    const abilities = [...card.abilities, { id: CURSE }];
    return { ...state, cardPool: { ...state.cardPool, [id]: { ...card, abilities } } } as GameState;
  }
  const damageOf = (s: GameState): number => inst(s, identityOf(s)).damage;
  const resolved = (events: readonly { readonly type: string }[]): number =>
    events.filter((e) => e.type === "abilityResolved" && (e as { abilityId?: string }).abilityId === CURSE).length;

  it("Cindy Moon's action pays with the card: the cost is heard as a player card's, and Cindy takes 2 damage", () => {
    const tucked = tuckEncounterCard(withCurse(silkGame()), BORROWED);
    const hand = tucked.state.players[0]!.hand.length;
    const command = use(P1, identityOf(tucked.state), "52001b.cindy-moon-action", [], { discarded: [tucked.id] });
    const { state, events } = driveEventsPicking(deps, tucked.state, firstLegal, command);
    expect(inst(state, identityOf(state)).tucked).toEqual([]);
    expect(resolved(events)).toBe(1);
    expect(damageOf(state)).toBe(2);
    expect(state.players[0]!.hand.length).toBe(hand + 2);
  });

  it("the four-card cap discards it as the fifth card: the identity's own discard, and Silk takes 2 damage", () => {
    let state = withCurse(silkHeroGame());
    const kept: InstanceId[] = [];
    for (const code of ["01101", "01102", "01103", "01107"]) {
      const tucked = tuckEncounterCard(state, code);
      state = tucked.state;
      kept.push(tucked.id);
    }
    const fifth = tuckEncounterCard(state, BORROWED);
    const attack: Command = {
      type: "basicAttack",
      playerId: P1,
      attackerInstanceId: identityOf(fifth.state),
      targetInstanceId: fifth.state.activeVillainId!,
    };
    // When the cap asks which 4 stay, keep the four that were there; anything else as it comes.
    const pick = (s: GameState) => {
      const options = s.pendingChoice!.options.map((o) => o.optionId);
      if (options.includes(fifth.id)) return kept;
      return s.pendingChoice!.prompt.kind === "declareDefender" ? [identityOf(s)] : firstLegal(s);
    };
    const { state: after, events } = driveEventsPicking(deps, fifth.state, pick, attack);
    expect(inst(after, identityOf(after)).tucked).toEqual(kept);
    expect(resolved(events)).toBe(1);
    expect(damageOf(after)).toBe(2);
  });
});
