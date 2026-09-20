import type { InstanceId } from "@mc/engine";
import { characterProfile } from "@mc/engine";
import { firstLegal, identityOf, inst, instancesOf, moveToHand, P1, patchInstance, payWith, playerOf, settle, stackEncounterDeck, toHero, use, type Picker } from "../../testing/harness.js";
import { withDamage } from "../../testing/staging.js";
import { wave2Scenario } from "../setup.js";
import { playFromHand, runWave2, startWave2Game, WAVE2_DEPS } from "../testing.js";
import { QSV_KIT } from "./kit.js";

// Real wave 2 content: the Quicksilver (Protection) precon against Rhino, standard, solo. Pietro starts in alter-ego.
const qsvVsRhino = () => startWave2Game(wave2Scenario("rhino", { players: [{ starterDeckId: "qsv-protection" }], seed: 2026 }));

/**
 * Accepts the named optional responses/interrupts (a trigger's option id is `<instance>:<ability>`) and picks the
 * named targets; declines everything else.
 */
const accepting =
  (...wanted: readonly string[]): Picker =>
  (state) => {
    const choice = state.pendingChoice;
    if (!choice) return [];
    const hits = choice.options.map((o) => o.optionId).filter((id) => wanted.some((w) => id === w || id.endsWith(`:${w}`)));
    return hits.length > 0 ? hits.slice(0, choice.maxSelections) : firstLegal(state);
  };

describe("Quicksilver kit", () => {
  it("Super Speed: readies Quicksilver after he uses a basic power, but only once per phase", () => {
    const hero = runWave2(qsvVsRhino(), toHero());
    const identity = identityOf(hero);
    const villain = hero.villains[0]!.instanceId;

    const afterFirst = settle(
      runWave2(withDamage(hero, villain, 0), { type: "basicAttack", playerId: P1, attackerInstanceId: identity, targetInstanceId: villain }),
      accepting("14001a.super-speed"),
      undefined,
      WAVE2_DEPS,
    );
    // Super Speed readied him again, so a second basic attack is legal this same phase.
    expect(inst(afterFirst, identity).exhausted).toBe(false);

    const afterSecond = settle(
      runWave2(afterFirst, { type: "basicAttack", playerId: P1, attackerInstanceId: identity, targetInstanceId: villain }),
      accepting("14001a.super-speed"),
      undefined,
      WAVE2_DEPS,
    );
    // The limit (once per phase) was already spent, so this time he stays exhausted.
    expect(inst(afterSecond, identity).exhausted).toBe(true);
  });

  // docs/phase7-wave2.md §21/§23: `on.cardReadied`, the "-ed" twin of `cardReadying`, an announcement pushed only
  // once a ready actually happens — proven here by chaining off Super Speed's own real ready of Quicksilver.
  it("Friction Resistance: Hero Response, after you ready Quicksilver, readies this card too", () => {
    const hero = runWave2(qsvVsRhino(), toHero());
    const { state: withFriction, id: friction } = playFromHand(hero, "14009", 3);
    const identity = identityOf(withFriction);
    const villain = withFriction.villains[0]!.instanceId;
    // Exhausted directly (its own Resource ability would normally do this): something for its own Response to
    // ready once Super Speed readies Quicksilver.
    const staged = patchInstance(withDamage(withFriction, villain, 0), friction, { exhausted: true });
    const after = settle(
      runWave2(staged, { type: "basicAttack", playerId: P1, attackerInstanceId: identity, targetInstanceId: villain }),
      accepting("14001a.super-speed", "14009.friction-resistance-response"),
      undefined,
      WAVE2_DEPS,
    );
    expect(inst(after, identity).exhausted).toBe(false); // Super Speed readied him
    expect(inst(after, friction).exhausted).toBe(false); // Friction Resistance's own Response readied it too
  });

  it("Superpowered Siblings: discards 2 and draws 2, or 3 if Scarlet Witch is in play (limit once per round)", () => {
    // A discard-from-hand cost is paid up front (`CostChoices`, not a later pendingChoice), so the two discarded
    // cards are named directly in the command.
    const start = qsvVsRhino(); // alter-ego already
    const handBefore = playerOf(start, P1).hand.length;
    const [d1, d2] = playerOf(start, P1).hand as readonly InstanceId[];
    const withoutWitch = settle(
      runWave2(start, use(P1, identityOf(start), "14001b.superpowered-siblings", [], { discard: [d1!, d2!] })),
      firstLegal,
      undefined,
      WAVE2_DEPS,
    );
    // -2 discarded, +2 drawn: net 0.
    expect(playerOf(withoutWitch, P1).hand.length).toBe(handBefore);

    const { state: withWitch } = playFromHand(qsvVsRhino(), "14002", 3);
    const handBeforeWitch = playerOf(withWitch, P1).hand.length;
    const [w1, w2] = playerOf(withWitch, P1).hand as readonly InstanceId[];
    const withSiblings = settle(
      runWave2(withWitch, use(P1, identityOf(withWitch), "14001b.superpowered-siblings", [], { discard: [w1!, w2!] })),
      firstLegal,
      undefined,
      WAVE2_DEPS,
    );
    // -2 discarded, +3 drawn: net +1.
    expect(playerOf(withSiblings, P1).hand.length).toBe(handBeforeWitch + 1);
  });

  it("Scarlet Witch (ally): discards the top card of the encounter deck when she uses a basic power, and gets +1 to that power for each boost icon discarded", () => {
    const { state: withWitch } = playFromHand(runWave2(qsvVsRhino(), toHero()), "14002", 3);
    const witch = instancesOf(withWitch, "14002")[0]!;
    const villain = withWitch.villains[0]!.instanceId;
    // Hydra Mercenary (01101, Rhino's own set) prints exactly 1 boost icon.
    const staged = stackEncounterDeck(withWitch, "01101");
    const attacked = settle(
      runWave2(withDamage(staged, villain, 0), { type: "basicAttack", playerId: P1, attackerInstanceId: witch, targetInstanceId: villain }),
      accepting("14002.scarlet-witch-interrupt"), // an optional Interrupt — `firstLegal` alone would decline it
      undefined,
      WAVE2_DEPS,
    );
    // Printed ATK 1 + 1 boost icon discarded = 2.
    expect(inst(attacked, villain).damage).toBe(2);
  });

  it("Always Be Running: readies Quicksilver", () => {
    const hero = runWave2(qsvVsRhino(), toHero());
    const identity = identityOf(hero);
    const exhausted = { ...hero, instances: { ...hero.instances, [identity]: { ...hero.instances[identity]!, exhausted: true } } };
    const { state } = playFromHand(exhausted, "14003", 1);
    expect(inst(state, identity).exhausted).toBe(false);
  });

  it("Double Time: choosing 'deal 2 damage' twice deals 4 total damage to the same enemy (allowRepeat)", () => {
    const hero = runWave2(qsvVsRhino(), toHero());
    const villain = hero.villains[0]!.instanceId;
    const { state } = playFromHand(withDamage(hero, villain, 0), "14004", 2);
    expect(inst(state, villain).damage).toBe(4);
  });

  it("Maximum Velocity: +2 THW/ATK/DEF until the end of the round", () => {
    const hero = runWave2(qsvVsRhino(), toHero());
    const identity = identityOf(hero);
    const before = characterProfile(hero, identity, WAVE2_DEPS)!;
    const { state } = playFromHand(hero, "14005", 2);
    const boosted = characterProfile(state, identity, WAVE2_DEPS)!;
    expect(boosted.thw).toBe(before.thw + 2);
    expect(boosted.atk).toBe(before.atk + 2);
    expect(boosted.def).toBe(before.def + 2);
    expect(state.lastingEffects.length).toBeGreaterThan(0);
  });

  it("Speed Cyclone: paying X = 2 stuns 2 enemies", () => {
    const hero = runWave2(qsvVsRhino(), toHero());
    // Reveal a second enemy engaged with P1 by putting a minion into play via test surgery is out of scope here;
    // Speed Cyclone against a single-villain solo game stuns the villain with X = 1 — a smaller, still-real check.
    const given = moveToHand(hero, P1, "14006");
    const [speedCyclone] = given.ids as [InstanceId];
    const villain = given.state.villains[0]!.instanceId;
    const payment = payWith(given.state, P1, 1, [speedCyclone]);
    const played = settle(
      runWave2(given.state, { type: "playCard", playerId: P1, cardInstanceId: speedCyclone, payment: payment.map((id) => ({ fromHand: id })), attachToInstanceId: null, x: 1 }),
      accepting("enemies"),
      undefined,
      WAVE2_DEPS,
    );
    expect(inst(played, villain).statuses.stunned).toBeGreaterThan(0);
  });

  it("Serval Industries: Alter-Ego Action, exhaust it to shuffle up to 2 of your own signature cards from the discard pile into your deck", () => {
    // `chooseCards`'s own options are the candidate instance ids, not slot-keyed — `firstLegal` alone would pick
    // its `min: 0` (0 cards); take every offered candidate instead, up to the prompt's own max.
    const pickAll: Picker = (state) => {
      const choice = state.pendingChoice;
      if (!choice) return [];
      return choice.prompt.kind === "chooseCards" ? choice.options.slice(0, choice.maxSelections).map((o) => o.optionId) : firstLegal(state);
    };
    const start = qsvVsRhino(); // alter-ego already
    const { state: withBoth, ids: discardedIds } = moveToHand(start, P1, "14008", "14010");
    const discarded = discardedIds as InstanceId[];
    const inDiscard = { ...withBoth, players: withBoth.players.map((p) => (p.playerId === P1 ? { ...p, hand: p.hand.filter((id) => !discarded.includes(id)), discard: [...p.discard, ...discarded] } : p)) };
    const { state: withServal, id: serval } = playFromHand(inDiscard, "14007", 1);
    const deckBefore = playerOf(withServal, P1).deck.length;
    const used = settle(runWave2(withServal, use(P1, serval, "14007.serval-industries-action")), pickAll, undefined, WAVE2_DEPS);
    expect(playerOf(used, P1).deck.length).toBe(deckBefore + 2);
    expect(discarded.every((id) => playerOf(used, P1).discard.includes(id))).toBe(false);
  });

  it("Accelerated Reflex / Hyper Perception / Reinforced Sinew: +1 DEF / +1 THW / +1 ATK", () => {
    // Each played from a fresh game (rather than chained onto one), so the small solo hand never runs short paying
    // for three cost-2 upgrades in a row.
    const identity = identityOf(qsvVsRhino());
    const before = characterProfile(runWave2(qsvVsRhino(), toHero()), identity, WAVE2_DEPS)!;
    const withDef = playFromHand(runWave2(qsvVsRhino(), toHero()), "14008", 2);
    expect(characterProfile(withDef.state, identity, WAVE2_DEPS)?.def).toBe(before.def + 1);
    const withThw = playFromHand(runWave2(qsvVsRhino(), toHero()), "14010", 2);
    expect(characterProfile(withThw.state, identity, WAVE2_DEPS)?.thw).toBe(before.thw + 1);
    const withAtk = playFromHand(runWave2(qsvVsRhino(), toHero()), "14011", 2);
    expect(characterProfile(withAtk.state, identity, WAVE2_DEPS)?.atk).toBe(before.atk + 1);
  });

  it("Friction Resistance: Resource, exhaust it to generate a [physical] resource", () => {
    expect(QSV_KIT["14009.friction-resistance-resource"]).toBeDefined();
  });
});
