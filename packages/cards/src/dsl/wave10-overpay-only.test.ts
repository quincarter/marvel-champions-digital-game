/**
 * docs/phase7-wave10-hero-packs.md H3.14 (engine task HT11): `resource(…, { overpayOnly: true })`, with the real Mr.
 * Hollywood 58009 in a real Wonder Man game against Core's Rhino, paying for his real events (Active Altruism 58003,
 * Ionic Blast 58004, Starstruck 58005, as the pack's events module scripts them). Mr. Hollywood's script is this
 * test's own; the hero kit's module is scripted elsewhere. The engine's `overpay-only-resource.test.ts` drives the
 * plain data (a wild, an X, an ability's cost, the payment query).
 *
 * Mr. Hollywood: "Resource: Generate a [energy] resource to overpay for a card. (Limit once per card.)" RRG 1.8 "Cost"
 * (p. 13): "Resources generated beyond the specified cost are considered to have been overpaid for that cost and were
 * not paid for that cost." Owner decision, 2026-10-12 (hero-packs Q20 = A): offered only while a card is being played.
 */

import { cardId } from "@mc/content";
import { applyCommand, paymentFor, type AbilityDefinition, type EngineDeps, type GameState } from "@mc/engine";
import { describe, expect, it, vi } from "vitest";
import { action, heroResource, oncePerPaidCard, resource, whenSpentGenerate } from "./abilities.js";
import { validateDefinition } from "./validate.js";
import {
  P1,
  firstLegal,
  inst,
  mainThreat,
  moveToHand,
  patchInstance,
  play,
  playerOf,
  resourceAbility,
  settle,
} from "../testing/harness.js";
import { wonderManHeroGame } from "../wave10/testing.js";
import { depsWith } from "./wave10-labor.testing.js";

vi.setConfig({ testTimeout: 120_000 });

const MR_HOLLYWOOD = "58009";
const RESOURCE = "58009.mr-hollywood-resource";
const ALTRUISM = "58003"; // cost 0: remove 1 threat, 2 more for each [energy] overpaid (to a maximum of 2)
const BLAST = "58004"; // cost 1: 3 damage, 2 more for each [energy] overpaid (to a maximum of 3)
const STRUCK = "58005"; // cost 1: damage equal to ATK; stun if overpaid with a [energy]
const BENEVOLENCE = "58016"; // 1 [physical]

const SCRIPTS: Readonly<Record<string, AbilityDefinition>> = {
  [RESOURCE]: resource({ energy: 1 }, { overpayOnly: true, limit: oncePerPaidCard }),
};
const DEPS: EngineDeps = depsWith(SCRIPTS);

type Id = ReturnType<typeof moveToHand>["ids"][number];

/** Wonder Man in hero form with Mr. Hollywood in play and exactly `codes` in hand (the ids in that order). */
function staged(...codes: readonly string[]) {
  const base = wonderManHeroGame({ deps: DEPS });
  const given = moveToHand(base, P1, MR_HOLLYWOOD, ...codes);
  const [hollywood, ...hand] = given.ids as [Id, ...Id[]];
  const state: GameState = patchInstance(
    {
      ...given.state,
      players: given.state.players.map((p) =>
        p.playerId === P1 ? { ...p, hand, playArea: [...p.playArea, hollywood] } : p,
      ),
    },
    hollywood,
    { faceup: true, controllerId: P1 },
  );
  return { state, hollywood, hand, overpay: resourceAbility(hollywood, RESOURCE) };
}
/** Applies the play and answers its choices with the first option; the refusal code when it is refused. */
function played(state: GameState, command: ReturnType<typeof play>) {
  const result = applyCommand(state, command, DEPS);
  if (!result.ok) return { ok: false as const, code: result.error.code };
  return { ok: true as const, state: settle(result.state, firstLegal, (s) => !s.pendingChoice, DEPS) };
}
const villainOf = (state: GameState) => inst(state, state.activeVillainId!);

describe("H3.14 the builder", () => {
  it("builds a resource ability marked overpayOnly, with its limit once per card", () => {
    expect(SCRIPTS[RESOURCE]).toMatchObject({
      trigger: { kind: "resource" },
      generates: { energy: 1 },
      overpayOnly: true,
      limit: { count: 1, period: "round", per: "paidCard" },
    });
    expect(validateDefinition(SCRIPTS[RESOURCE]!)).toEqual([]);
    expect(heroResource({ energy: 1 }, { overpayOnly: true })).toMatchObject({ overpayOnly: true });
    expect(resource({ energy: 1 })).not.toHaveProperty("overpayOnly");
  });

  it("the validator refuses it off a resource ability that generates from a card in play", () => {
    const refusals = (definition: AbilityDefinition) => validateDefinition(definition).join("\n");
    expect(refusals({ ...action(), overpayOnly: true })).toMatch(/overpayOnly is a resource ability's/);
    expect(refusals({ ...whenSpentGenerate({ energy: 1 }), overpayOnly: true })).toMatch(/when-spent ability/);
    expect(refusals(resource(1, { overpayOnly: true, spentAsIfResource: true }))).toMatch(/spent as if it were/);
  });
});

describe("H3.14 Mr. Hollywood pays for nothing and is always overpaid", () => {
  it("Active Altruism (cost 0) with an empty hand: 1 [energy] overpaid, 3 threat removed", () => {
    const at = staged(ALTRUISM);
    const state = patchInstance(at.state, at.state.mainScheme.instanceId, { threat: 5 });
    const run = played(state, play(P1, at.hand[0]!, [], { abilities: [at.overpay] }));
    expect(run.ok).toBe(true);
    if (run.ok) expect(mainThreat(run.state)).toBe(2);
    // Without him it removes 1.
    const plain = played(state, play(P1, at.hand[0]!));
    if (plain.ok) expect(mainThreat(plain.state)).toBe(4);
  });

  it("Starstruck (cost 1) with only Mr. Hollywood is refused", () => {
    const at = staged(STRUCK);
    expect(played(at.state, play(P1, at.hand[0]!, [], { abilities: [at.overpay] }))).toEqual({
      ok: false,
      code: "insufficient_resources",
    });
  });

  it("Starstruck paid with a [physical] card and Mr. Hollywood: overpaid with a [energy], the enemy is stunned", () => {
    const at = staged(STRUCK, BENEVOLENCE);
    const [struck, payer] = at.hand as [Id, Id];
    const run = played(at.state, play(P1, struck, [payer], { abilities: [at.overpay] }));
    expect(run.ok).toBe(true);
    if (run.ok) expect(villainOf(run.state).statuses.stunned).toBe(1);
    const plain = played(at.state, play(P1, struck, [payer]));
    if (plain.ok) expect(villainOf(plain.state).statuses.stunned).toBe(0);
  });

  it("Ionic Blast paid with a [physical] card and Mr. Hollywood: 3 + 2 damage", () => {
    const at = staged(BLAST, BENEVOLENCE);
    const [blast, payer] = at.hand as [Id, Id];
    const before = villainOf(at.state).damage;
    const run = played(at.state, play(P1, blast, [payer], { abilities: [at.overpay] }));
    expect(run.ok).toBe(true);
    if (run.ok) expect(villainOf(run.state).damage - before).toBe(5);
  });

  it("usable for each of two events in one turn; twice for one card is refused", () => {
    const at = staged(ALTRUISM, ALTRUISM);
    const [first, second] = at.hand as [Id, Id];
    const state = patchInstance(at.state, at.state.mainScheme.instanceId, { threat: 9 });
    expect(played(state, play(P1, first, [], { abilities: [at.overpay, at.overpay] }))).toEqual({
      ok: false,
      code: "limit_reached",
    });
    const one = played(state, play(P1, first, [], { abilities: [at.overpay] }));
    if (!one.ok) throw new Error(one.code);
    const two = played(one.state, play(P1, second, [], { abilities: [at.overpay] }));
    if (!two.ok) throw new Error(two.code);
    expect(mainThreat(two.state)).toBe(3);
    // No exhaust, no counter: he is as he was.
    expect(inst(two.state, at.hollywood).exhausted).toBe(false);
    expect(playerOf(two.state, P1).playArea).toContain(at.hollywood);
  });

  it("the payment query lists him as an overpayOnly source for a card being played", () => {
    const at = staged(STRUCK, BENEVOLENCE);
    const [struck, payer] = at.hand as [Id, Id];
    const query = paymentFor(at.state, P1, { kind: "playCard", instanceId: struck }, {}, DEPS);
    expect(query?.sources.find((s) => s.instanceId === at.hollywood)).toMatchObject({
      kind: "resourceAbility",
      pool: { energy: 1 },
      overpayOnly: true,
    });
    expect(query?.suggested).toEqual([`hand:${payer}`]);
  });
});

/**
 * The owner's answer 53B (2026-10-13, docs/phase7-wave10.md §4.0), with the real Crushing Blow 10002 ("You can only
 * spend [physical] resources to pay for this card.", as `wave1/hlk/kit.ts` scripts it) retagged onto a card in Wonder
 * Man's hand: Mr. Hollywood's [energy] is generated to overpay, so it is not spent to pay for the card and the
 * restriction does not refuse it. RRG 1.8 "Cost" (p. 13); FAQ "Crushing Blow (#2)" (p. 60).
 */
describe("53B Mr. Hollywood overpays for a card that can only be paid for with [physical] resources", () => {
  const CRUSHING_BLOW = "10002"; // cost 1: deal damage equal to your ATK
  const ENERGY = "58023"; // Wonder Man's Energy resource card
  /** Mr. Hollywood in play; in hand a Crushing Blow, Battlefield Benevolence ([physical]) and Energy. */
  function withCrushingBlow() {
    const at = staged(STRUCK, BENEVOLENCE, ENERGY);
    const [blow, physical, energy] = at.hand as [Id, Id, Id];
    return { ...at, state: patchInstance(at.state, blow, { cardId: cardId(CRUSHING_BLOW) }), blow, physical, energy };
  }

  it("the fixture is the printed card: cost 1, its payment restricted to [physical]", () => {
    const at = withCrushingBlow();
    expect(at.state.cardPool[cardId(CRUSHING_BLOW)]).toMatchObject({ name: "Crushing Blow", cost: 1 });
    expect(DEPS.abilities["10002.crushing-blow-constant"]).toMatchObject({
      trigger: { kind: "constant", paymentOnly: ["physical"] },
    });
  });

  it("paid with a [physical] card, Mr. Hollywood's [energy] on top: played, and it deals its damage", () => {
    const at = withCrushingBlow();
    const before = villainOf(at.state).damage;
    const run = played(at.state, play(P1, at.blow, [at.physical], { abilities: [at.overpay] }));
    expect(run.ok).toBe(true);
    if (run.ok) expect(villainOf(run.state).damage).toBeGreaterThan(before);
  });

  it("Mr. Hollywood alone does not pay for it", () => {
    const at = withCrushingBlow();
    expect(played(at.state, play(P1, at.blow, [], { abilities: [at.overpay] }))).toEqual({
      ok: false,
      code: "insufficient_resources",
    });
  });

  it("an [energy] card from hand is still refused, paying or on top of the [physical] card", () => {
    const at = withCrushingBlow();
    const refused = { ok: false, code: "insufficient_resources" };
    expect(played(at.state, play(P1, at.blow, [at.energy]))).toEqual(refused);
    expect(played(at.state, play(P1, at.blow, [at.physical, at.energy]))).toEqual(refused);
    expect(played(at.state, play(P1, at.blow, [at.physical, at.energy], { abilities: [at.overpay] }))).toEqual(refused);
  });
});
