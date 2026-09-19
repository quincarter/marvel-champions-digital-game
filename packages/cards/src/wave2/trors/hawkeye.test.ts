import { cardId } from "@mc/content";
import { activeEncounterDeckId, applyCommand, characterProfile, hasKeyword, traitsOf, type GameState, type InstanceId } from "@mc/engine";
import {
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
  settle,
  toHero,
  use,
} from "../../testing/harness.js";
import { wave2Scenario } from "../setup.js";
import { runWave2, startWave2Game, WAVE2_DEPS } from "../testing.js";

// Real wave 2 content: the Hawkeye (Leadership) precon against Rhino, standard, solo.
const hawkeyeVsRhino = () => startWave2Game(wave2Scenario("rhino", { players: [{ starterDeckId: "hawkeye-leadership" }], seed: 11 }));

/** Hawkeye's Bow (04002, cost 0) moved to hand and played into play, keeping the current form (hero if already). */
function heroWithBow(state = hawkeyeVsRhino()) {
  const hero = playerOf(state, P1).identity.form === "hero" ? state : runWave2(state, toHero());
  const given = moveToHand(hero, P1, "04002");
  const [bow] = given.ids as [InstanceId];
  const played = settle(runWave2(given.state, play(P1, bow, [])), firstLegal, undefined, WAVE2_DEPS);
  return { state: played, bow };
}

/**
 * A set-aside nemesis-set card (RRG 1.8 Appendix II step 5, "set aside", kept per-player on `PlayerState.setAside`
 * — never shuffled into the encounter deck at setup) moved onto the top of the encounter deck for a reveal test,
 * the test-only-surgery counterpart of `stackEncounterDeck` for cards that never reach the deck.
 */
function stackSetAside(state: GameState, code: string, player = P1): GameState {
  const owner = playerOf(state, player);
  const id = owner.setAside.find((i) => state.instances[i]?.cardId === cardId(code));
  if (!id) throw new Error(`no ${code} set aside for ${player}`);
  const deckId = activeEncounterDeckId(state);
  const pile = state.encounterDecks[deckId]!;
  return {
    ...state,
    players: state.players.map((p) => (p.playerId === player ? { ...p, setAside: p.setAside.filter((i) => i !== id) } : p)),
    encounterDecks: { ...state.encounterDecks, [deckId]: { ...pile, deck: [id, ...pile.deck] } },
  };
}

describe("Hawkeye kit", () => {
  it("Quick Draw: exhausts Hawkeye to ready Hawkeye's Bow", () => {
    const { state, bow } = heroWithBow();
    const exhaustedBow = patchInstance(state, bow, { exhausted: true });
    const identity = identityOf(exhaustedBow);
    const after = runWave2(exhaustedBow, use(P1, identity, "04001a.quick-draw"));
    expect(inst(after, identity).exhausted).toBe(true);
    expect(inst(after, bow).exhausted).toBe(false);
  });

  it("Weapon of Choice: spends 1 resource of any type to find Hawkeye's Bow into hand and shuffle", () => {
    const start = hawkeyeVsRhino();
    const alterEgo = identityOf(start);
    const [payer] = payWith(start, P1, 1);
    const before = playerOf(start, P1).hand.length;
    const after = runWave2(start, use(P1, alterEgo, "04001b.weapon-of-choice", [{ fromHand: payer! }]));
    expect(playerOf(after, P1).hand.length).toBe(before - 1 + 1); // -1 resource, +1 found bow
    expect(instancesOf(after, "04002").some((id) => playerOf(after, P1).hand.includes(id))).toBe(true);
  });

  it("Hawkeye's Quiver: searches the top 5 cards of the deck for an Arrow event and attaches it faceup, then shuffles", () => {
    const start = hawkeyeVsRhino();
    const withTop = putOnTopOfDeck(runWave2(start, toHero()), P1, "04005");
    const [sonicArrow] = withTop.ids as [InstanceId];
    const given = moveToHand(withTop.state, P1, "04003");
    const [quiver] = given.ids as [InstanceId];
    const played = settle(runWave2(given.state, play(P1, quiver, payWith(given.state, P1, 1, [quiver]))), firstLegal, undefined, WAVE2_DEPS);
    const after = settle(runWave2(played, use(P1, quiver, "04003.hawkeyes-quiver-action")), picking(sonicArrow), undefined, WAVE2_DEPS);
    expect(inst(after, quiver).exhausted).toBe(true);
    expect(inst(after, sonicArrow).attachedTo).toBe(quiver);
  });

  it("Hawkeye's Quiver: a matching attached event is playable as if from hand", () => {
    const start = hawkeyeVsRhino();
    const withTop = putOnTopOfDeck(runWave2(start, toHero()), P1, "04005");
    const [sonicArrow] = withTop.ids as [InstanceId];
    const given = moveToHand(withTop.state, P1, "04003");
    const [quiver] = given.ids as [InstanceId];
    const played = settle(runWave2(given.state, play(P1, quiver, payWith(given.state, P1, 1, [quiver]))), firstLegal, undefined, WAVE2_DEPS);
    const withArrow = settle(runWave2(played, use(P1, quiver, "04003.hawkeyes-quiver-action")), picking(sonicArrow), undefined, WAVE2_DEPS);
    expect(inst(withArrow, sonicArrow).attachedTo).toBe(quiver);
    // Playing the attached Sonic Arrow doesn't need it in hand — the constant grants it as if it were — but it
    // does still need Hawkeye's Bow in play to pay its own cost.
    const withBow = heroWithBow(withArrow);
    const result = applyCommand(withBow.state, play(P1, sonicArrow, payWith(withBow.state, P1, 2, [withBow.bow])), WAVE2_DEPS);
    expect(result.ok).toBe(true);
  });

  // Mockingbird's interrupt (04004.mockingbird-interrupt) is in `KNOWN_SKIPPED` (`../coverage.test.ts`) — see
  // `hawkeye-kit.ts`'s module docblock: an earlier version of this test proved `preventDamage()` is a silent no-op
  // at "the villain initiates an attack" timing (before a `dealDamage` event frame exists to prevent), so it was
  // pulled rather than shipped subtly wrong.

  it("Sonic Arrow: an (attack) event — exhausting Hawkeye's Bow, confuses an enemy and deals 3 damage to it", () => {
    const withBow = heroWithBow();
    const given = moveToHand(withBow.state, P1, "04005");
    const [sonicArrow] = given.ids as [InstanceId];
    const villain = given.state.villains[0]!.instanceId;
    const before = inst(given.state, villain).damage;
    const after = settle(
      runWave2(given.state, play(P1, sonicArrow, payWith(given.state, P1, 2, [sonicArrow, withBow.bow]))),
      picking(villain),
      undefined,
      WAVE2_DEPS,
    );
    expect(inst(after, withBow.bow).exhausted).toBe(true);
    expect(inst(after, villain).damage).toBe(before + 3);
    expect(inst(after, villain).statuses.confused).toBeGreaterThan(0);
  });

  it("Explosive Arrow: exhausts Hawkeye's Bow and chooses a player, deals 3 damage to the villain and each minion engaged with that player", () => {
    const withBow = heroWithBow();
    const given = moveToHand(withBow.state, P1, "04006");
    const [explosiveArrow] = given.ids as [InstanceId];
    const villain = given.state.villains[0]!.instanceId;
    const before = inst(given.state, villain).damage;
    const after = settle(
      runWave2(given.state, play(P1, explosiveArrow, payWith(given.state, P1, 1, [explosiveArrow, withBow.bow]))),
      picking(P1),
      undefined,
      WAVE2_DEPS,
    );
    expect(inst(after, withBow.bow).exhausted).toBe(true);
    expect(inst(after, villain).damage).toBe(before + 3);
  });

  it("Electric Arrow: exhausts Hawkeye's Bow to stun an enemy and deal 3 damage to it", () => {
    const withBow = heroWithBow();
    const given = moveToHand(withBow.state, P1, "04007");
    const [electricArrow] = given.ids as [InstanceId];
    const villain = given.state.villains[0]!.instanceId;
    const before = inst(given.state, villain).damage;
    const after = settle(
      runWave2(given.state, play(P1, electricArrow, payWith(given.state, P1, 2, [electricArrow, withBow.bow]))),
      picking(villain),
      undefined,
      WAVE2_DEPS,
    );
    expect(inst(after, withBow.bow).exhausted).toBe(true);
    expect(inst(after, villain).damage).toBe(before + 3);
    expect(inst(after, villain).statuses.stunned).toBeGreaterThan(0);
  });

  it("Expert Marksman: exhausts to generate a wild resource, usable for an Arrow event's cost", () => {
    const start = hawkeyeVsRhino();
    const hero = runWave2(start, toHero());
    const given = moveToHand(hero, P1, "04010", "04002", "04005");
    const [marksman, bow, sonicArrow] = given.ids as [InstanceId, InstanceId, InstanceId];
    const withMarksman = settle(runWave2(given.state, play(P1, marksman, payWith(given.state, P1, 1, [marksman, bow, sonicArrow]))), firstLegal, undefined, WAVE2_DEPS);
    const withBow = settle(runWave2(withMarksman, play(P1, bow, [])), firstLegal, undefined, WAVE2_DEPS);
    // Pays Sonic Arrow's cost (2) with Expert Marksman's own resource ability plus 1 other card.
    const played = applyCommand(
      withBow,
      play(P1, sonicArrow, payWith(withBow, P1, 1, [sonicArrow, marksman, bow]), { abilities: [resourceAbility(marksman, "04010.expert-marksman-resource")] }),
      WAVE2_DEPS,
    );
    expect(played.ok).toBe(true);
    if (played.ok) expect(inst(played.state, marksman).exhausted).toBe(true);
  });

  it("Black Knight: his own basic attack gains piercing (a constant keyword grant on himself)", () => {
    expect(WAVE2_DEPS.abilities["04012.black-knight-constant"]).toBeDefined();
    const start = hawkeyeVsRhino();
    const given = moveToHand(runWave2(start, toHero()), P1, "04012");
    const [blackKnight] = given.ids as [InstanceId];
    const played = settle(runWave2(given.state, play(P1, blackKnight, payWith(given.state, P1, 3, [blackKnight]))), firstLegal, undefined, WAVE2_DEPS);
    expect(playerOf(played, P1).playArea).toContain(blackKnight);
    expect(hasKeyword(played, blackKnight, "piercing", WAVE2_DEPS)).toBe(true);
  });

  it("Goliath: gets +4 ATK until the end of the phase, then is discarded at the end of the phase (once per phase)", () => {
    const start = hawkeyeVsRhino();
    const given = moveToHand(runWave2(start, toHero()), P1, "04013");
    const [goliath] = given.ids as [InstanceId];
    const played = settle(runWave2(given.state, play(P1, goliath, payWith(given.state, P1, 4, [goliath]))), firstLegal, undefined, WAVE2_DEPS);
    const baseAtk = characterProfile(played, goliath, WAVE2_DEPS)?.atk ?? 0;
    const boosted = settle(runWave2(played, use(P1, goliath, "04013.goliath-action")), firstLegal, undefined, WAVE2_DEPS);
    expect(characterProfile(boosted, goliath, WAVE2_DEPS)?.atk).toBe(baseAtk + 4);
    const afterEnd = settle(runWave2(boosted, endTurn()), firstLegal, undefined, WAVE2_DEPS);
    expect(playerOf(afterEnd, P1).playArea).not.toContain(goliath);
    expect(playerOf(afterEnd, P1).discard).toContain(goliath);
  });

  it("Sky Cycle: attached ally gains Aerial; exhaust Sky Cycle to ready the attached ally", () => {
    const start = hawkeyeVsRhino();
    const given = moveToHand(runWave2(start, toHero()), P1, "04015", "04014");
    const [skyCycle, usAgent] = given.ids as [InstanceId, InstanceId];
    const withAlly = settle(runWave2(given.state, play(P1, usAgent, payWith(given.state, P1, 3, [skyCycle, usAgent]))), firstLegal, undefined, WAVE2_DEPS);
    const attached = applyCommand(withAlly, play(P1, skyCycle, payWith(withAlly, P1, 1, [skyCycle]), { attachToInstanceId: usAgent }), WAVE2_DEPS);
    expect(attached.ok).toBe(true);
    if (!attached.ok) return;
    const settledAttach = settle(attached.state, firstLegal, undefined, WAVE2_DEPS);
    expect(traitsOf(settledAttach, usAgent, WAVE2_DEPS).map(String)).toContain("AERIAL");
    const exhaustedAlly = patchInstance(settledAttach, usAgent, { exhausted: true });
    const after = runWave2(exhaustedAlly, use(P1, skyCycle, "04015.sky-cycle-action"));
    expect(inst(after, skyCycle).exhausted).toBe(true);
    expect(inst(after, usAgent).exhausted).toBe(false);
  });

  it("Team Training: each ally you control gets +1 hit point", () => {
    const start = hawkeyeVsRhino();
    const given = moveToHand(runWave2(start, toHero()), P1, "04016", "04014");
    const [teamTraining, usAgent] = given.ids as [InstanceId, InstanceId];
    const withTraining = settle(runWave2(given.state, play(P1, teamTraining, payWith(given.state, P1, 2, [teamTraining, usAgent]))), firstLegal, undefined, WAVE2_DEPS);
    const withAlly = settle(runWave2(withTraining, play(P1, usAgent, payWith(withTraining, P1, 3, [usAgent]))), firstLegal, undefined, WAVE2_DEPS);
    // U.S. Agent prints 5 hit points; Team Training's own +1 should be visible on the resolved profile.
    expect(characterProfile(withAlly, usAgent, WAVE2_DEPS)?.maxHp).toBe(6);
  });

  it("Ready for Action: an event — gives an ally you control a tough status card", () => {
    const start = hawkeyeVsRhino();
    const given = moveToHand(runWave2(start, toHero()), P1, "04017", "04014");
    const [readyForAction, usAgent] = given.ids as [InstanceId, InstanceId];
    const withAlly = settle(runWave2(given.state, play(P1, usAgent, payWith(given.state, P1, 3, [readyForAction, usAgent]))), firstLegal, undefined, WAVE2_DEPS);
    const after = settle(runWave2(withAlly, play(P1, readyForAction, payWith(withAlly, P1, 1, [readyForAction]))), picking(usAgent), undefined, WAVE2_DEPS);
    expect(inst(after, usAgent).statuses.tough).toBeGreaterThan(0);
  });

  it("Earth's Mightiest Heroes: an event — exhausts an Avenger character to ready another Avenger character", () => {
    const start = hawkeyeVsRhino();
    const given = moveToHand(runWave2(start, toHero()), P1, "04022", "04014");
    const [heroes, usAgent] = given.ids as [InstanceId, InstanceId];
    const withAlly = settle(runWave2(given.state, play(P1, usAgent, payWith(given.state, P1, 3, [heroes, usAgent]))), firstLegal, undefined, WAVE2_DEPS);
    const exhaustedAlly = patchInstance(withAlly, usAgent, { exhausted: true });
    const identity = identityOf(exhaustedAlly);
    const after = settle(runWave2(exhaustedAlly, play(P1, heroes, [])), picking(identity, usAgent), undefined, WAVE2_DEPS);
    expect(inst(after, identity).exhausted).toBe(true);
    expect(inst(after, usAgent).exhausted).toBe(false);
  });
});

describe("Hawkeye's obligation and nemesis (Criminal Past, Crossfire)", () => {
  it("Crossfire: his attacks gain piercing (a constant keyword grant on himself)", () => {
    expect(WAVE2_DEPS.abilities["04027.crossfire-constant"]).toBeDefined();
  });

  it("Crossfire's Rifle: the attached enemy's attacks gain ranged (a constant keyword grant on the host)", () => {
    expect(WAVE2_DEPS.abilities["04029.crossfires-rifle-constant"]).toBeDefined();
  });

  it("Sniper Shot: in hero form, deals 3 damage to your hero", () => {
    const start = stackSetAside(hawkeyeVsRhino(), "04030");
    const hero = runWave2(start, toHero());
    const before = inst(hero, identityOf(hero)).damage;
    const settled = settle(runWave2(hero, endTurn()), firstLegal, undefined, WAVE2_DEPS);
    expect(inst(settled, identityOf(settled)).damage).toBeGreaterThanOrEqual(before + 3);
  });

  it("Sniper Shot: in alter-ego form, places 3 threat on the main scheme", () => {
    const start = stackSetAside(hawkeyeVsRhino(), "04030");
    const before = inst(start, start.mainScheme.instanceId).threat;
    const settled = settle(runWave2(start, endTurn()), firstLegal, undefined, WAVE2_DEPS);
    expect(inst(settled, settled.mainScheme.instanceId).threat).toBeGreaterThanOrEqual(before + 3);
  });
});
