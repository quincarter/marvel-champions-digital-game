import { cardId } from "@mc/content";
import {
  applyCommand,
  costHelpFor,
  legalActions,
  type AbilityRegistry,
  type EngineDeps,
  type GameState,
  type InstanceId,
} from "@mc/engine";
import { describe, expect, it, vi } from "vitest";
import {
  P1,
  P2,
  firstLegal,
  identityOf,
  inst,
  patchInstance,
  play,
  playerOf,
  runWith,
  settle,
  toHero,
} from "../testing/harness.js";
import { WAVE10_DEPS } from "../wave10/testing.js";
import { heroAction, takeDamageCost } from "./abilities.js";
import { draw } from "./effects.js";
import { defineAbilities, validateDefinition } from "./validate.js";
import { herculesTable } from "./wave10-costs-payable-by-any-player.testing.js";

vi.setConfig({ testTimeout: 120_000 });

/**
 * The owner's answer 48B (2026-10-13, docs/phase7-wave10.md §4.0): a helper may also pay an eligible non-resource part
 * of an alliance card's costs (RRG 1.8 "Alliance", p. 6: "any player(s) may help pay the costs for that card").
 *
 * A fixture, and why: no Alliance card in the pool prints a cost part another player can take over whole. They print
 * resource costs only (Team Investigation, Cosmic Alliance, Joining Forces, Flying Formation, Break Time, Strength in
 * Diversity) or name cards ("exhaust an X character and a Y character": As One!, Stand Together, Problem Solvers,
 * Combine Forces, Gunboat Diplomacy, Serve and Protect; "return them to their owners' hands": Mutant Mayhem), which a
 * helper's cards already pay (docs/phase7-wave4.md §3.17). So the real Team Investigation 40053 (Alliance and its cost
 * of 2 are its card data) is given, for this test only, an Action that costs "take 2 damage", built with the DSL, and
 * is played in a real two-player game: Hercules plays it, Core's Spider-Man helps. The engine's
 * `alliance-cost-parts.test.ts` drives the plain data.
 */
const TEAM_INVESTIGATION = "40053";
const REF = "40053.team-investigation-action";
/** The fixture Action, under the real card's own ability id: "Hero Action: Take 2 damage → draw 1 card." */
const FIXTURE: AbilityRegistry = defineAbilities({ [REF]: heroAction({ cost: takeDamageCost(2) }, draw(1)) });
const DEPS: EngineDeps = { abilities: { ...WAVE10_DEPS.abilities, ...FIXTURE } };

/** Hercules in hero form on his turn with Spider-Man seated; one of his hand cards is Team Investigation. */
function table(): { readonly state: GameState; readonly card: InstanceId; readonly payers: readonly InstanceId[] } {
  const hero = settle(
    runWith(DEPS, herculesTable({ twoPlayers: true, deps: DEPS }), toHero()),
    firstLegal,
    (s) => !s.pendingChoice,
    DEPS,
  );
  const [card, ...rest] = playerOf(hero, P1).hand as [InstanceId, ...InstanceId[]];
  return { state: patchInstance(hero, card, { cardId: cardId(TEAM_INVESTIGATION) }), card, payers: rest };
}
const damageOn = (state: GameState, player: typeof P1) => inst(state, identityOf(state, player)).damage;
/** The fewest of `payers` the engine accepts for this play (the card costs 2). */
function paying(state: GameState, card: InstanceId, payers: readonly InstanceId[], helper: boolean): InstanceId[] {
  for (let size = 1; size <= payers.length; size++) {
    const tried = payers.slice(0, size);
    const selection = helper ? { costSelection: { paidBy: { damageSelf: P2 } } } : {};
    if (applyCommand(state, play(P1, card, tried, selection), DEPS).ok) return tried;
  }
  throw new Error("no payment the engine accepts");
}

describe("48B a helper pays a non-resource part of a real Alliance card's costs", () => {
  it("the fixture: the card is the printed Team Investigation (Alliance, cost 2) with a 'take 2 damage' Action that validates", () => {
    const t = table();
    const data = t.state.cardPool[cardId(TEAM_INVESTIGATION)]!;
    expect(data).toMatchObject({ name: "Team Investigation", cost: 2 });
    expect(data).toMatchObject({ keywords: [{ name: "alliance" }] });
    expect(data).toMatchObject({ abilities: [{ id: REF }] });
    expect(FIXTURE[REF]).toMatchObject({ trigger: { kind: "action", form: "hero" }, cost: { damageSelf: 2 } });
    expect(validateDefinition(FIXTURE[REF]!)).toEqual([]);
  });

  it("Spider-Man, named in paidBy, takes the 2 damage; Hercules takes none, pays the resources and draws", () => {
    const t = table();
    const payers = paying(t.state, t.card, t.payers, true);
    const result = applyCommand(
      t.state,
      play(P1, t.card, payers, { costSelection: { paidBy: { damageSelf: P2 } } }),
      DEPS,
    );
    if (!result.ok) throw new Error(result.error.message);
    const state = settle(result.state, firstLegal, (s) => !s.pendingChoice, DEPS);
    expect(damageOn(state, P2) - damageOn(t.state, P2)).toBe(2);
    expect(damageOn(state, P1)).toBe(damageOn(t.state, P1));
    expect(result.events.filter((event) => event.type === "costPartPaidBy")).toEqual([
      { type: "costPartPaidBy", playerId: P1, helperId: P2, sourceInstanceId: t.card, part: "damageSelf" },
    ]);
    // The event and its payers left Hercules's hand; he drew 1.
    expect(playerOf(state, P1).hand).toHaveLength(playerOf(t.state, P1).hand.length - 1 - payers.length + 1);
    expect(playerOf(state, P1).discard).toContain(t.card);
  });

  it("with nobody named Hercules takes it himself; the engine lists both players as able to pay the part", () => {
    const t = table();
    const payers = paying(t.state, t.card, t.payers, false);
    const result = applyCommand(t.state, play(P1, t.card, payers), DEPS);
    if (!result.ok) throw new Error(result.error.message);
    expect(damageOn(result.state, P1) - damageOn(t.state, P1)).toBe(2);
    expect(damageOn(result.state, P2)).toBe(damageOn(t.state, P2));
    const actions = legalActions(t.state, P1, DEPS);
    if (actions.kind !== "turn") throw new Error("expected Hercules's turn");
    const legal = actions.legal.find((a) => a.action.kind === "playCard" && a.action.instanceId === t.card);
    expect(legal?.costHelp).toEqual([{ part: "damageSelf", payers: [P1, P2] }]);
    expect(costHelpFor(t.state, P1, { kind: "playCard", instanceId: t.card }, P2, {}, DEPS)).toEqual([
      { part: "damageSelf", ok: true },
    ]);
  });

  it("the same Action on the card with its Alliance keyword blanked out of the data: the helper is refused", () => {
    const t = table();
    const data = t.state.cardPool[cardId(TEAM_INVESTIGATION)]!;
    const plain: GameState = {
      ...t.state,
      cardPool: {
        ...t.state.cardPool,
        [data.id]: { ...data, keywords: [] } as typeof data,
      },
    };
    const refused = applyCommand(
      plain,
      play(P1, t.card, [...t.payers], { costSelection: { paidBy: { damageSelf: P2 } } }),
      DEPS,
    );
    expect(refused.ok).toBe(false);
    if (!refused.ok)
      expect(refused.error).toMatchObject({
        code: "no_valid_target",
        message: "only the player using this ability can pay its costs",
      });
  });
});
