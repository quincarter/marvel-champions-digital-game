import { activeEncounterDeck } from "@mc/engine";
import { coreScenario } from "../setup.js";
import {
  answer,
  endTurn,
  firstLegal,
  identityOf,
  inst,
  instancesOf,
  moveToHand,
  P1,
  patchInstance,
  payWith,
  picking,
  play,
  playerOf,
  putOnTopOfDeck,
  resourceAbility,
  run,
  settle,
  settleUntil,
  stackEncounterDeck,
  startCoreGame,
  toHero,
  use,
} from "../../testing/harness.js";

// Real Core data: the Spider-Man (Justice) precon against Rhino, standard, solo.
const spiderManVsRhino = () =>
  startCoreGame(coreScenario("rhino", { players: [{ starterDeckId: "core-spider-man-justice" }], seed: 11 }));
const ADVANCE = "01186"; // 0 boost icons, no boost ability: a neutral boost card
const HYDRA_MERCENARY = "01101";

describe("Spider-Man kit", () => {
  it("Spider-Sense: when the villain initiates an attack against you, draw 1 card — before the attack resolves", () => {
    const start = stackEncounterDeck(spiderManVsRhino(), ADVANCE, HYDRA_MERCENARY);
    const hero = run(start, toHero(), endTurn());
    const sense = `${identityOf(hero)}:01001a.spider-sense`;
    const offered = settle(
      hero,
      firstLegal,
      (s) => s.pendingChoice?.options.some((o) => o.optionId === sense) ?? false,
    );
    expect(offered.pendingChoice?.prompt).toMatchObject({
      kind: "chooseTriggers",
      timing: "interrupt",
      event: { kind: "enemyAttack" },
    });
    const handBefore = playerOf(offered, P1).hand.length;
    const atDefense = settleUntil(answer(offered, [sense]), "declareDefender");
    expect(playerOf(atDefense, P1).hand.length).toBe(handBefore + 1);
    expect(inst(atDefense, identityOf(atDefense)).damage).toBe(0);
  });

  it("Backflip: prevents all of the damage from an attack, and is discarded", () => {
    const start = stackEncounterDeck(spiderManVsRhino(), ADVANCE, HYDRA_MERCENARY);
    const given = moveToHand(start, P1, "01003");
    const [backflip] = given.ids as [never];
    const option = `${backflip}:01003.backflip-interrupt`;
    const after = settle(run(given.state, toHero(), endTurn()), (s) => {
      const prompt = s.pendingChoice?.prompt;
      if (prompt?.kind === "payForCard" && prompt.instanceId === backflip) return []; // Backflip costs 0
      return picking(option)(s);
    });
    expect(after.round).toBe(2);
    expect(inst(after, identityOf(after)).damage).toBe(0);
    expect(playerOf(after, P1).discard).toContain(backflip);
  });

  it("Web-Shooter: pays as a wild resource (even for a [physical] cost); the third counter spent discards it", () => {
    const start = spiderManVsRhino();
    const given = moveToHand(start, P1, "01008", "01093", "01086"); // Web-Shooter, Tenacity, First Aid
    const [shooter, tenacity, firstAid] = given.ids as [never, never, never];
    const hero = run(given.state, toHero());
    const withShooter = run(hero, play(P1, shooter, payWith(hero, P1, 1, given.ids)));
    expect(inst(withShooter, shooter).counters.web).toBe(3);
    const web = resourceAbility(shooter, "01008.web-shooter-resource");

    // 1st counter: part of Tenacity's printed cost of 2.
    const withTenacity = run(
      withShooter,
      play(P1, tenacity, payWith(withShooter, P1, 1, given.ids), { abilities: [web] }),
    );
    expect(inst(withTenacity, shooter)).toMatchObject({ exhausted: true, counters: { web: 2 } });

    // 2nd counter (readied by test surgery): Tenacity's "spend a [physical] resource" accepts the wild.
    const usedTenacity = run(
      patchInstance(withTenacity, shooter, { exhausted: false }),
      use(P1, tenacity, "01093.tenacity-action", [web]),
    );
    expect(playerOf(usedTenacity, P1).discard).toContain(tenacity);
    expect(inst(usedTenacity, shooter).counters.web).toBe(1);

    // 3rd counter: Uses (3 web counters) discards it when the last one is removed.
    const paidAid = settle(
      run(patchInstance(usedTenacity, shooter, { exhausted: false }), play(P1, firstAid, [], { abilities: [web] })),
    );
    expect(playerOf(paidAid, P1).discard).toEqual(expect.arrayContaining([shooter, firstAid]));
  });

  it("Web-Shooter: an upgrade attached to the identity readies in the end-of-phase ready step", () => {
    const start = stackEncounterDeck(spiderManVsRhino(), ADVANCE, HYDRA_MERCENARY);
    const given = moveToHand(start, P1, "01008");
    const [shooter] = given.ids as [never];
    const hero = run(given.state, toHero());
    const played = run(hero, play(P1, shooter, payWith(hero, P1, 1, given.ids)));
    expect(inst(played, shooter).attachedTo).toBe(identityOf(played));
    const nextRound = settle(run(patchInstance(played, shooter, { exhausted: true }), endTurn()), firstLegal);
    expect(nextRound.round).toBe(2);
    expect(inst(nextRound, shooter)).toMatchObject({ exhausted: false, counters: { web: 3 } });
  });

  it("Black Cat: after you play her, discard the top 2 cards of your deck and keep each with a printed [mental] resource", () => {
    const given = moveToHand(spiderManVsRhino(), P1, "01002");
    const [cat] = given.ids as [never];
    const stacked = putOnTopOfDeck(given.state, P1, "01089", "01090"); // Genius ([mental][mental]), Strength ([physical][physical])
    const [genius, strength] = stacked.ids as [never, never];
    const after = settle(run(stacked.state, play(P1, cat, payWith(stacked.state, P1, 2, [cat]))));
    expect(playerOf(after, P1).hand).toContain(genius);
    expect(playerOf(after, P1).discard).toContain(strength);
    expect(playerOf(after, P1).playArea).toContain(cat);
  });
});

describe("Eviction Notice (Spider-Man's obligation)", () => {
  it("offers the optional flip in hero form, then 'exhaust Peter Parker → remove it from the game'", () => {
    const start = stackEncounterDeck(spiderManVsRhino(), ADVANCE, "01165");
    const atFlip = settleUntil(run(start, toHero(), endTurn()), "chooseOption");
    expect(atFlip.pendingChoice?.playerId).toBe(P1);
    expect(atFlip.pendingChoice?.options.map((o) => o.label)).toEqual(["Flip to alter-ego form", "Stay in hero form"]);
    const flipped = answer(atFlip, ["0"]);
    expect(playerOf(flipped, P1).identity.form).toBe("alterEgo");
    expect(flipped.pendingChoice?.options.map((o) => o.label)).toEqual([
      "Exhaust Peter Parker → remove this obligation from the game",
      "Discard 1 card at random from your hand; this card gains surge",
    ]);
    const removed = settle(answer(flipped, ["0"]));
    const notice = instancesOf(removed, "01165")[0];
    expect(removed.removedFromGame).toContain(notice);
    expect(inst(removed, identityOf(removed)).exhausted).toBe(true);
  });

  it("the alternative discards a random card, surges, and puts the obligation in the encounter discard", () => {
    const start = stackEncounterDeck(spiderManVsRhino(), ADVANCE, "01165", HYDRA_MERCENARY);
    const atChoice = settleUntil(run(start, endTurn()), "chooseOption"); // alter-ego: no flip offer
    expect(atChoice.pendingChoice?.options).toHaveLength(2);
    const handBefore = playerOf(atChoice, P1).hand.length;
    const after = settle(answer(atChoice, ["1"]));
    expect(activeEncounterDeck(after).discard).toContain(instancesOf(after, "01165")[0]);
    // Surge revealed the Hydra Mercenary.
    expect(playerOf(after, P1).playArea.some((id) => inst(after, id).cardId === HYDRA_MERCENARY)).toBe(true);
    expect(handBefore).toBeGreaterThan(0);
  });
});
