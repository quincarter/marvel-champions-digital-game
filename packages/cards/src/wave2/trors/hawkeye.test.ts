import { cardId } from "@mc/content";
import { activeEncounterDeckId, applyCommand, cardsInPlay, characterProfile, hasKeyword, traitsOf, type GameState, type InstanceId } from "@mc/engine";
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
  settle,
  settleUntil,
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

/**
 * A scenario-level set-aside card (`GameState.encounterSetAside`, distinct from a player's own `PlayerState.
 * setAside` above — a villain's own signature encounter card, e.g. The Sleeper) staged as the *second* card of the
 * encounter deck, behind one filler: the villain's own activation is dealt its boost card from the top before any
 * player's own encounter card (docs/phase7-wave2-scripting.md §5), so a stage-onto-the-very-top card would be
 * consumed as boost fodder and never reach a player's reveal.
 */
function stageScenarioSetAsideForReveal(state: GameState, code: string): GameState {
  const deckId = activeEncounterDeckId(state);
  const pile = state.encounterDecks[deckId]!;
  const filler = pile.deck[0];
  const id = state.encounterSetAside.find((i) => state.instances[i]?.cardId === cardId(code));
  if (!id || !filler) throw new Error(`no ${code} set aside, or no filler card on top of the encounter deck`);
  const rest = pile.deck.slice(1).filter((i) => i !== id);
  return {
    ...state,
    encounterSetAside: state.encounterSetAside.filter((i) => i !== id),
    encounterDecks: { ...state.encounterDecks, [deckId]: { ...pile, deck: [filler, id, ...rest] } },
  };
}

/**
 * The `stackSetAside` sibling of `stageScenarioSetAsideForReveal` above, for a *player's own* set-aside nemesis card:
 * the same "villain's boost draw eats the very top of the deck first" trap (`enemy-activation.ts`'s `getsBoostCard`,
 * unconditional for a villain; villain-phase step order in `flow.ts` runs `enemyActivations` before
 * `dealEncounterCards`/`revealEncounterCards`), which `stackSetAside` alone does not protect against — confirmed by
 * instrumenting `04028`/`04030` staged bare: both end up faceup in the encounter deck's own discard, never in
 * `villainArea`/dealing their printed effect, having been drawn and discarded as Rhino's own boost card instead. One
 * throwaway filler card (whatever was already second from the top) absorbs that boost draw, so the staged card lands
 * as the villain phase's actual player reveal.
 */
function stackSetAsideBehindBoost(state: GameState, code: string, player = P1): GameState {
  const staged = stackSetAside(state, code, player);
  const deckId = activeEncounterDeckId(staged);
  const pile = staged.encounterDecks[deckId]!;
  const [card, filler, ...rest] = pile.deck;
  if (!card || !filler) throw new Error(`no filler card behind the staged ${code} on the encounter deck`);
  return { ...staged, encounterDecks: { ...staged.encounterDecks, [deckId]: { ...pile, deck: [filler, card, ...rest] } } };
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

  it("Hawkeye's Bow: +1 ATK, and each of your Arrow attacks gain ranged (ignoring a retaliate enemy's damage back)", () => {
    // Red Skull scenario for The Sleeper (04130: Guard, Retaliate 1, Toughness) — Rhino has no retaliate keyword.
    const start = startWave2Game(wave2Scenario("red-skull", { players: [{ starterDeckId: "hawkeye-leadership" }], seed: 2026 }));
    const hero = runWave2(start, toHero());
    const staged = stageScenarioSetAsideForReveal(hero, "04130");
    const revealed = settle(runWave2(staged, endTurn()), firstLegal, undefined, WAVE2_DEPS);
    const sleeper = instancesOf(revealed, "04130").find((id) => inst(revealed, id).engagedWith === P1);
    if (!sleeper) throw new Error("The Sleeper never engaged P1");
    const identity = identityOf(revealed);
    const baseAtk = characterProfile(revealed, identity, WAVE2_DEPS)?.atk ?? 0;

    const given = moveToHand(revealed, P1, "04002", "04005");
    const [bow, sonicArrow] = given.ids as [InstanceId, InstanceId];
    const withBow = settle(runWave2(given.state, play(P1, bow, [])), firstLegal, undefined, WAVE2_DEPS);
    expect(characterProfile(withBow, identity, WAVE2_DEPS)?.atk).toBe(baseAtk + 1);

    const before = inst(withBow, identity).damage;
    const after = settle(
      runWave2(withBow, play(P1, sonicArrow, payWith(withBow, P1, 2, [sonicArrow, bow]))),
      picking(sleeper),
      undefined,
      WAVE2_DEPS,
    );
    // Ranged ignores retaliate entirely (RRG 1.8 "Ranged", p. 35): the hero's own damage total is unchanged.
    expect(inst(after, identity).damage).toBe(before);
  });

  it("Hawkeye's Bow: without ranged, the same first attack against The Sleeper takes its retaliate 1 back (the control this pack's ranged grant is checked against)", () => {
    const start = startWave2Game(wave2Scenario("red-skull", { players: [{ starterDeckId: "hawkeye-leadership" }], seed: 2026 }));
    const hero = runWave2(start, toHero());
    const staged = stageScenarioSetAsideForReveal(hero, "04130");
    const revealed = settle(runWave2(staged, endTurn()), firstLegal, undefined, WAVE2_DEPS);
    const sleeper = instancesOf(revealed, "04130").find((id) => inst(revealed, id).engagedWith === P1);
    if (!sleeper) throw new Error("The Sleeper never engaged P1");
    const identity = identityOf(revealed);
    const before = inst(revealed, identity).damage;
    const after = settle(
      runWave2(revealed, { type: "basicAttack", playerId: P1, attackerInstanceId: identity, targetInstanceId: sleeper }),
      firstLegal,
      undefined,
      WAVE2_DEPS,
    );
    expect(inst(after, identity).damage).toBe(before + 1);
  });

  it("Mockingbird: Interrupt, spending 1 resource of any type and returning her to hand, prevents all damage from the villain's initiated attack against you", () => {
    // Seed 1 (unlike this file's usual seed 11) has Rhino attack rather than scheme on the very first villain
    // phase, so Mockingbird's interrupt window (attack *initiation*, before a defender is even declared) is reached.
    const start = startWave2Game(wave2Scenario("rhino", { players: [{ starterDeckId: "hawkeye-leadership" }], seed: 1 }));
    const hero = runWave2(start, toHero());
    const given = moveToHand(hero, P1, "04004");
    const [mockingbird] = given.ids as [InstanceId];
    const played = settle(runWave2(given.state, play(P1, mockingbird, payWith(given.state, P1, 3, [mockingbird]))), firstLegal, undefined, WAVE2_DEPS);
    const identity = identityOf(played);
    const before = inst(played, identity).damage;
    // Answered explicitly, three steps only (discard down to hand size, choose the interrupt, pay its 1-resource
    // cost) rather than a generic `settle` loop: later this same villain phase Rhino may activate again (a second
    // attack, a boost-granted extra activation), which would offer the same interrupt a second time and this test
    // only means to observe the one attack it answers.
    const withInterruptOffered = settleUntil(runWave2(played, endTurn()), "chooseTriggers", firstLegal, WAVE2_DEPS);
    const chose = answer(withInterruptOffered, [`${mockingbird}:04004.mockingbird-interrupt`], WAVE2_DEPS);
    // `payForAbility`'s own `minSelections` is 0 (a resource payment may be topped up automatically), but paying
    // nothing here would leave the 1-resource cost unmet, so the payment is picked explicitly.
    const paid = answer(chose, [chose.pendingChoice!.options[0]!.optionId], WAVE2_DEPS);
    const settled = settleUntil(paid, "declareDefender", firstLegal, WAVE2_DEPS);
    // Mockingbird is back in hand (returned as the interrupt's own cost); the villain's attack dealt no damage.
    expect(playerOf(settled, P1).hand).toContain(mockingbird);
    expect(inst(settled, identity).damage).toBe(before);
  });

  it("Cable Arrow: an (thwart) event — exhausts Hawkeye's Bow, removes 3 threat from a scheme, ignoring crisis icons", () => {
    const withBow = heroWithBow();
    const given = moveToHand(withBow.state, P1, "04008");
    const [cableArrow] = given.ids as [InstanceId];
    const scheme = given.state.mainScheme.instanceId;
    const before = inst(given.state, scheme).threat;
    const after = settle(
      runWave2(given.state, play(P1, cableArrow, payWith(given.state, P1, 1, [cableArrow, withBow.bow]))),
      picking(scheme),
      undefined,
      WAVE2_DEPS,
    );
    expect(inst(after, withBow.bow).exhausted).toBe(true);
    expect(inst(after, scheme).threat).toBe(Math.max(0, before - 3));
  });

  it("Hawkeye (Kate Bishop): exhausts herself and discards a card, dealing damage equal to that card's printed resources", () => {
    const start = hawkeyeVsRhino();
    const given = moveToHand(runWave2(start, toHero()), P1, "04011");
    const [kate] = given.ids as [InstanceId];
    const played = settle(runWave2(given.state, play(P1, kate, payWith(given.state, P1, 2, [kate]))), firstLegal, undefined, WAVE2_DEPS);
    // Discard Hawkeye's Bow (04002, cost 0, one [wild] printed resource) as the ability's own cost: X = 1.
    const withDiscardable = moveToHand(played, P1, "04002");
    const [bow] = withDiscardable.ids as [InstanceId];
    const villain = withDiscardable.state.villains[0]!.instanceId;
    const before = inst(withDiscardable.state, villain).damage;
    const result = applyCommand(withDiscardable.state, use(P1, kate, "04011.hawkeye-action", [], { discard: [bow] }), WAVE2_DEPS);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const after = settle(result.state, picking(villain), undefined, WAVE2_DEPS);
    expect(inst(after, kate).exhausted).toBe(true);
    expect(playerOf(after, P1).discard).toContain(bow);
    expect(inst(after, villain).damage).toBe(before + 1);
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

  it("Vibranium Arrow: an (attack) event — exhausts Hawkeye's Bow, deals 6 damage, and gains piercing (discards the enemy's tough status card instead of being fully absorbed by it)", () => {
    const withBow = heroWithBow();
    const given = moveToHand(withBow.state, P1, "04009");
    const [vibraniumArrow] = given.ids as [InstanceId];
    const villain = given.state.villains[0]!.instanceId;
    const toughened = patchInstance(given.state, villain, { statuses: { ...inst(given.state, villain).statuses, tough: 1 } });
    const before = inst(toughened, villain).damage;
    const after = settle(
      runWave2(toughened, play(P1, vibraniumArrow, payWith(toughened, P1, 2, [vibraniumArrow, withBow.bow]))),
      picking(villain),
      undefined,
      WAVE2_DEPS,
    );
    expect(inst(after, withBow.bow).exhausted).toBe(true);
    // A tough card without piercing would absorb the whole attack (0 damage, tough discarded). With piercing, the
    // tough card is discarded *first* (RRG 1.8 "Piercing", p. 32) and the full 6 damage still lands.
    expect(inst(after, villain).statuses.tough).toBe(0);
    expect(inst(after, villain).damage).toBe(before + 6);
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

  it("Crossfire's Rifle: Hero Action, exhausting your hero and spending a [wild] resource, discards it", () => {
    // Crossfire's Rifle attaches to Crossfire if he's in play, else the villain (data, `AttachmentHost.ifAble`) —
    // staged behind a filler for the villain's own boost draw so its generic attachment-reveal rule attaches it to
    // Rhino, the only enemy in this scenario.
    const staged = stackSetAsideBehindBoost(hawkeyeVsRhino(), "04029");
    const hero = runWave2(staged, toHero());
    const revealed = settle(runWave2(hero, endTurn()), firstLegal, undefined, WAVE2_DEPS);
    const rifle = instancesOf(revealed, "04029").find((id) => cardsInPlay(revealed).includes(id));
    if (!rifle) throw new Error("Crossfire's Rifle never attached");
    const identity = identityOf(revealed);
    const ready = patchInstance(revealed, identity, { exhausted: false });
    // "Spend a [wild] resource" (`ResourceRequirement.wild`) demands an actual printed wild icon, not any resource
    // — Hawkeye's Bow (04002, one printed [wild] icon) moved to hand pays it exactly.
    const withWild = moveToHand(ready, P1, "04002");
    const [bow] = withWild.ids as [InstanceId];
    const after = runWave2(withWild.state, use(P1, rifle, "04029.crossfires-rifle-action", [{ fromHand: bow }]));
    expect(inst(after, identity).exhausted).toBe(true);
    expect(cardsInPlay(after)).not.toContain(rifle);
  });

  it("Crossfire: if his card is dealt as the boost card during an enemy's attack, that attack gains piercing (discards the defender's tough status card instead of being fully absorbed by it)", () => {
    // Crossfire's nemesis-set card is set aside per player (RRG 1.8 Appendix II step 5), never shuffled into the
    // deck — staged onto the very top so the villain's own activation (Rhino, no retaliate/piercing of his own)
    // draws it as its boost card, resolving "[star] Boost:" rather than his minion body (which stays out of play).
    const start = hawkeyeVsRhino();
    const hero = runWave2(start, toHero());
    const identity = identityOf(hero);
    const toughened = patchInstance(hero, identity, { statuses: { ...inst(hero, identity).statuses, tough: 1 } });
    const staged = stackSetAside(toughened, "04027");
    const before = inst(staged, identity).damage;
    const settled = settle(runWave2(staged, endTurn()), firstLegal, undefined, WAVE2_DEPS);
    // A tough card without piercing would have absorbed Rhino's attack entirely (0 damage, tough discarded). With
    // piercing granted by Crossfire's boost, the tough card is discarded *and* damage still lands.
    expect(inst(settled, identity).statuses.tough).toBe(0);
    expect(inst(settled, identity).damage).toBeGreaterThan(before);
  });

  it("Sniper Shot: in hero form, deals 3 damage to your hero", () => {
    // Bare `stackSetAside` (no filler) silently reaches Rhino's own automatic boost draw instead of the player's
    // own reveal (every villain gets one unconditionally, drawn from the very top of the deck before any player's
    // own encounter card — `enemy-activation.ts`'s `getsBoostCard`, `flow.ts`'s villain-phase step order): confirmed
    // by instrumenting this exact test, which previously passed only because Rhino's own attack that same villain
    // phase happened to deal >= 3 damage on its own, never actually revealing Sniper Shot at all.
    const staged = stackSetAsideBehindBoost(hawkeyeVsRhino(), "04030");
    const hero = runWave2(staged, toHero());
    const before = inst(hero, identityOf(hero)).damage;
    const settled = settle(runWave2(hero, endTurn()), firstLegal, undefined, WAVE2_DEPS);
    // Still a lower bound, not an exact match: an engaged Rhino may also attack this same villain phase, dealing
    // damage of his own on top of Sniper Shot's printed 3.
    expect(inst(settled, identityOf(settled)).damage).toBeGreaterThanOrEqual(before + 3);
  });

  it("Sniper Shot: in alter-ego form, places 3 threat on the main scheme", () => {
    const staged = stackSetAsideBehindBoost(hawkeyeVsRhino(), "04030");
    const before = inst(staged, staged.mainScheme.instanceId).threat;
    const settled = settle(runWave2(staged, endTurn()), firstLegal, undefined, WAVE2_DEPS);
    // Still a lower bound: the villain phase's own step-one threat placement adds to the main scheme independently
    // of Sniper Shot every round.
    expect(inst(settled, settled.mainScheme.instanceId).threat).toBeGreaterThanOrEqual(before + 3);
  });

  it("Marked for Death: When Revealed, finds Mockingbird in the deck and tucks her faceup beneath it (errata, RRG 1.8 p. 66)", () => {
    // The same boost-draw trap Sniper Shot's own tests hit above — `stackSetAsideBehindBoost`, not bare
    // `stackSetAside`, or Rhino's own automatic boost draw eats this card before it ever reaches a player's reveal.
    const staged = stackSetAsideBehindBoost(hawkeyeVsRhino(), "04028");
    const settled = settle(runWave2(staged, endTurn()), firstLegal, undefined, WAVE2_DEPS);
    const marked = instancesOf(settled, "04028").find((id) => settled.villainArea.includes(id));
    if (!marked) throw new Error("Marked for Death never entered play");
    const tucked = inst(settled, marked).tucked;
    expect(tucked).toHaveLength(1);
    const mockingbird = tucked[0]!;
    expect(inst(settled, mockingbird).cardId).toBe(cardId("04004"));
    expect(inst(settled, mockingbird).faceup).toBe(true);
    expect(playerOf(settled, P1).deck).not.toContain(mockingbird);
  });

  it("Marked for Death: finds Mockingbird already in play, takes her out of it, and tucks the resulting instance", () => {
    const hero = runWave2(hawkeyeVsRhino(), toHero());
    const given = moveToHand(hero, P1, "04004");
    const [mockingbird] = given.ids as [InstanceId];
    const played = settle(runWave2(given.state, play(P1, mockingbird, payWith(given.state, P1, 3, [mockingbird]))), firstLegal, undefined, WAVE2_DEPS);
    expect(playerOf(played, P1).playArea).toContain(mockingbird);
    const staged = stackSetAsideBehindBoost(played, "04028");
    const settled = settle(runWave2(staged, endTurn()), firstLegal, undefined, WAVE2_DEPS);
    expect(playerOf(settled, P1).playArea).not.toContain(mockingbird);
    const marked = instancesOf(settled, "04028").find((id) => settled.villainArea.includes(id));
    if (!marked) throw new Error("Marked for Death never entered play");
    const tucked = inst(settled, marked).tucked;
    expect(tucked).toHaveLength(1);
    // A card that leaves play is a new instance of the same card (docs/phase7-wave2-scripting.md §5) — match on
    // the card id, not the old in-play instance id.
    expect(inst(settled, tucked[0]!).cardId).toBe(cardId("04004"));
  });
});
