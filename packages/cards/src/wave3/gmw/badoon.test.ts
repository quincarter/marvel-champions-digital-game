import { activeVillain, cardsInPlay, type GameState, type InstanceId } from "@mc/engine";
import {
  endTurn,
  firstLegal,
  identityOf,
  inst,
  instancesOf,
  P1,
  P2,
  patchInstance,
  payWith,
  runWith,
  settle,
  stackEncounterDeck,
  toHero,
  use,
} from "../../testing/harness.js";
import { driveEvents } from "../../testing/staging.js";
import { traceAbilities } from "../../testing/trace.js";
import { wave3Scenario } from "../setup.js";
import { encounterCardInVillainArea, runWave3, startWave3Game, WAVE3_DEPS } from "../testing.js";

/** Did this exact ability id's `effects` resolve, anywhere in the event log? Brotherhood of Badoon's villain
 * phase fires several independent "resolve the Badoon Ship's Charge Up ability" abilities in one phase (Drang's
 * own scheme response, a scheme's own step-one response, a boost card, …), and Charge Up itself resets Badoon
 * Ship's barrage counters back to 0 once they reach 4 — so a final-state "barrage count went up" assertion can
 * read 0 even though the ability under test genuinely fired. This checks the event log directly instead. */
const resolvedAbility = (events: readonly { readonly type: string }[], abilityId: string): boolean =>
  events.some((e) => e.type === "abilityResolved" && (e as { readonly abilityId?: string }).abilityId === abilityId);

/** Stage a villain to a later stage directly (by-passing the combat that would normally reach it), for tests
 * that only need a forced response/action *active at that stage* — not the "When Revealed" that only fires
 * through the real defeat→advance transition (that one is tested by actually defeating the earlier stage below). */
const atVillainStage = (state: GameState, villainId: InstanceId, stageIndex: number): GameState =>
  patchInstance(
    { ...state, villains: state.villains.map((v) => (v.instanceId === villainId ? { ...v, stageIndex } : v)) },
    villainId,
    { damage: 0 },
  );

/**
 * Brotherhood of Badoon (docs/phase7-wave3.md §2.2): the villain Drang, Terrestrial Invasion, Badoon Ship, Drang's
 * Spear, Badoon Engineer, the four side schemes, and the Band of Badoon modular set.
 */

const brotherhoodOfBadoon = () =>
  startWave3Game(
    wave3Scenario("brotherhood-of-badoon", { players: [{ starterDeckId: "groot-protection" }], seed: 2026 }),
  );

describe("Brotherhood of Badoon 1A Setup (16061a.setup)", () => {
  it("puts the Badoon Ship environment and the Milano support into play", () => {
    const state = brotherhoodOfBadoon();
    const [ship] = instancesOf(state, "16063");
    const [milano] = instancesOf(state, "16142");
    expect(ship).toBeDefined();
    expect(milano).toBeDefined();
    expect(state.villainArea).toContain(ship);
    expect(state.players.some((p) => p.playArea.includes(milano!))).toBe(true);
    expect(inst(state, milano!).controllerId).toBe(P1);
  });
});

describe("Badoon Ship — Charge Up (16063.charge-up) via Drang's own Forced Response (16058.drang-forced-response)", () => {
  it("places a barrage counter over a villain phase (Drang schemes in alter-ego form) (16061b.terrestrial-invasion-forced-response)", () => {
    // This same villain phase also fires Terrestrial Invasion 1B's own identical Forced Response (after resolving
    // step one of the villain phase), so the counter placed here is really at least two separate Charge Ups —
    // Drang's own scheme trigger and this scheme's step-one trigger both resolve, which is exactly why the
    // assertion below is a floor, not an exact count.
    const state = brotherhoodOfBadoon();
    const [ship] = instancesOf(state, "16063");
    expect(state.players[0]!.identity.form).toBe("alterEgo"); // Drang schemes, not attacks, this villain phase
    const afterPhase = settle(runWave3(state, { type: "endTurn", playerId: P1 }), firstLegal, undefined, WAVE3_DEPS);
    expect(inst(afterPhase, ship!).counters.barrage ?? 0).toBeGreaterThanOrEqual(1);
  });

  it("at 4+ counters, deals 2 indirect damage to each player and clears back down below 4", () => {
    const state = brotherhoodOfBadoon();
    const [ship] = instancesOf(state, "16063");
    const withCounters = patchInstance(state, ship!, { counters: { barrage: 3 } });
    const identity = state.players[0]!.identity.instanceId;
    const damageBefore = inst(withCounters, identity).damage;
    const afterPhase = settle(
      runWave3(withCounters, { type: "endTurn", playerId: P1 }),
      firstLegal,
      undefined,
      WAVE3_DEPS,
    );
    expect(inst(afterPhase, ship!).counters.barrage ?? 0).toBeLessThan(4);
    expect(inst(afterPhase, identity).damage).toBeGreaterThanOrEqual(damageBefore + 2);
  });
});

describe("Terrestrial Invasion 1B — First Player Action (16061b.terrestrial-invasion-constant)", () => {
  it("exhausting the Milano removes 3 threat from the main scheme", () => {
    const state = brotherhoodOfBadoon();
    const [milano] = instancesOf(state, "16142");
    const before = inst(state, state.mainScheme.instanceId).threat;
    const used = runWave3(
      state,
      use(P1, state.mainScheme.instanceId, "16061b.terrestrial-invasion-constant", [], { exhausted: [milano!] }),
    );
    expect(inst(used, milano!).exhausted).toBe(true);
    expect(inst(used, state.mainScheme.instanceId).threat).toBe(Math.max(0, before - 3));
  });
});

describe("Drang's Spear (16064)", () => {
  it("grants Drang stalwart, shedding a stunned status the moment it's attached (16064.drangs-spear-constant)", () => {
    const state = brotherhoodOfBadoon();
    const villain = activeVillain(state)!.instanceId;
    const stunned = patchInstance(state, villain, { statuses: { stunned: 1, confused: 0, tough: 0 } });
    const { state: staged, id: spear } = encounterCardInVillainArea(stunned, "16064");
    const attached = {
      ...staged,
      instances: { ...staged.instances, [spear]: { ...inst(staged, spear), attachedTo: villain } },
    };
    // `checkStateTriggers` sheds a status a `cannotHaveStatus`/stalwart character can't hold, on the next sweep;
    // driving a no-op command is enough to force one.
    const settled = runWave3(attached, { type: "noop", playerId: P1 } as never);
    expect(inst(settled, villain).statuses.stunned).toBe(0);
  });

  it("Hero Action: spend [mental][physical][physical] resources → discard this card", () => {
    const state = brotherhoodOfBadoon();
    // Drang schemes this villain phase (alter-ego form): stacking 16064 behind a filler treachery reveals it as an
    // ordinary encounter card (docs/card-scripting-process.md's `stackSetAsideBehindBoost` lesson — the villain's
    // own boost draw eats the very top card first).
    const staged = stackEncounterDeck(state, "01186", "16064");
    const [spear] = instancesOf(staged, "16064");
    const villain = activeVillain(staged)!.instanceId;
    const revealed = settle(runWave3(staged, { type: "endTurn", playerId: P1 }), firstLegal, undefined, WAVE3_DEPS);
    expect(inst(revealed, spear!).attachedTo).toBe(villain);
    const heroForm = {
      ...revealed,
      players: revealed.players.map((p) => ({ ...p, identity: { ...p.identity, form: "hero" as const } })),
    };
    const cards = payWith(heroForm, P1, 3);
    const paid = runWave3(
      heroForm,
      use(
        P1,
        spear!,
        "16064.drangs-spear-action",
        cards.map((fromHand) => ({ fromHand })),
      ),
    );
    expect(inst(paid, spear!).attachedTo).toBeNull();
  });
});

describe("Blockade, Bombardment, Oppressive Armada, Spatial Positioning — First Player Action", () => {
  const testExhaustMilanoRemovesThreat = (code: string, abilityId: string) => {
    const state = brotherhoodOfBadoon();
    const [milano] = instancesOf(state, "16142");
    const { state: staged, id: scheme } = encounterCardInVillainArea(state, code, 5);
    const used = runWave3(staged, use(P1, scheme, abilityId, [], { exhausted: [milano!] }));
    expect(inst(used, scheme).threat).toBe(2);
    expect(inst(used, milano!).exhausted).toBe(true);
  };

  it("Blockade (16066.blockade-constant)", () => testExhaustMilanoRemovesThreat("16066", "16066.blockade-constant"));
  it("Bombardment (16067.bombardment-constant)", () =>
    testExhaustMilanoRemovesThreat("16067", "16067.bombardment-constant"));
  it("Oppressive Armada (16068.oppressive-armada-constant)", () =>
    testExhaustMilanoRemovesThreat("16068", "16068.oppressive-armada-constant"));
  it("Spatial Positioning (16069.spatial-positioning-constant)", () =>
    testExhaustMilanoRemovesThreat("16069", "16069.spatial-positioning-constant"));
});

describe("Drang II (16059) — reached by actually defeating Drang I, so the real defeat→advance transition fires its When Revealed", () => {
  const primedToDefeatDrangI = () => {
    const hero = runWave3(brotherhoodOfBadoon(), toHero());
    const villain = hero.villains[0]!.instanceId;
    return { hero, villain };
  };
  const defeatDrangI = (state: GameState, villain: InstanceId): GameState => {
    // Drang I prints 13 hit points solo; prime to 1 remaining and land Groot's own basic ATK (2) for the kill,
    // through a real `basicAttack` command, so the engine's own advance code pushes the new stage's When Revealed
    // frames (`resolve/defeat.ts`'s `defeatVillainStage`) — a direct `stageIndex` patch would skip that push.
    const primed = patchInstance(state, villain, { damage: 12 });
    return runWave3(primed, {
      type: "basicAttack",
      playerId: P1,
      attackerInstanceId: identityOf(primed),
      targetInstanceId: villain,
    });
  };

  it("When Revealed: gives Drang a facedown boost card when Drang's Spear is already in play (16059.when-revealed)", () => {
    const { hero, villain } = primedToDefeatDrangI();
    const { state: withSpear } = encounterCardInVillainArea(hero, "16064");
    const boostBefore = inst(withSpear, villain).boostCards.length;
    const attacked = defeatDrangI(withSpear, villain);
    expect(activeVillain(attacked).stageIndex).toBe(1); // Drang II is now the active stage
    expect(inst(attacked, villain).boostCards.length).toBeGreaterThan(boostBefore);
  });

  it("When Revealed: searches for and reveals Drang's Spear when it isn't in play (16059.when-revealed)", () => {
    const { hero, villain } = primedToDefeatDrangI();
    const attacked = defeatDrangI(hero, villain);
    expect(activeVillain(attacked).stageIndex).toBe(1);
    const [spear] = instancesOf(attacked, "16064");
    expect(spear).toBeDefined();
    expect(inst(attacked, spear!).faceup).toBe(true); // "reveal it"
  });

  it("[star] Forced Response: after Drang schemes, resolves Charge Up (16059.drang-forced-response)", () => {
    const state = brotherhoodOfBadoon();
    const villain = state.villains[0]!.instanceId;
    const atStageII = atVillainStage(state, villain, 1);
    expect(state.players[0]!.identity.form).toBe("alterEgo"); // Drang schemes, not attacks
    const [ship] = instancesOf(atStageII, "16063");
    const before = inst(atStageII, ship!).counters.barrage ?? 0;
    const after = settle(runWave3(atStageII, endTurn()), firstLegal, undefined, WAVE3_DEPS);
    expect(inst(after, ship!).counters.barrage ?? 0).toBeGreaterThanOrEqual(before + 1);
  });
});

describe("Drang III (16060) — expert mode, which starts on Drang II and can be staged to III directly", () => {
  const brotherhoodOfBadoonExpert = () =>
    startWave3Game(
      wave3Scenario("brotherhood-of-badoon", {
        difficulty: "expert",
        players: [{ starterDeckId: "groot-protection" }],
        seed: 2026,
      }),
    );

  it("[star] Forced Response: after Drang activates, resolves Charge Up (16060.drang-forced-response)", () => {
    const state = brotherhoodOfBadoonExpert();
    const villain = state.villains[0]!.instanceId;
    expect(activeVillain(state).stageIndex).toBe(1); // expert starts on Drang II
    const atStageIII = atVillainStage(state, villain, 2); // Drang III is stageIndex 2, within expert's lastStageIndex
    expect(state.players[0]!.identity.form).toBe("alterEgo"); // Drang schemes: "activates" covers scheme or attack
    const [ship] = instancesOf(atStageIII, "16063");
    const before = inst(atStageIII, ship!).counters.barrage ?? 0;
    const after = settle(runWave3(atStageIII, endTurn()), firstLegal, undefined, WAVE3_DEPS);
    expect(inst(after, ship!).counters.barrage ?? 0).toBeGreaterThanOrEqual(before + 1);
  });
});

describe("Drang III (16060) — When Revealed, a two-player game, reached by actually defeating Drang II", () => {
  const drangIIIExpert = () =>
    startWave3Game(
      wave3Scenario("brotherhood-of-badoon", {
        difficulty: "expert",
        players: [{ starterDeckId: "groot-protection" }, { starterDeckId: "rocket-raccoon-aggression" }],
        seed: 2026,
      }),
    );

  it("discards the top 4[per_hero] cards; each discarded minion engages the player with the fewest minions, re-ranked per minion, ties going to the first player (16060.when-revealed)", () => {
    const start = drangIIIExpert();
    // 8 cards for 2 players: two Badoon Grunt minions (16118, a real minion in this scenario's own recommended
    // Band of Badoon modular set) at positions 1 and 5, six standard-set fillers (Advance/Assault/Caught Off
    // Guard/Gang-Up) filling the rest — a plain `discardEncounterCards`, not a reveal, so none of the fillers'
    // own text fires.
    const stacked = stackEncounterDeck(start, "16118", "01186", "01186", "01187", "16118", "01187", "01188", "01189");
    const hero = runWave3(stacked, toHero(P1));
    const villain = hero.villains[0]!.instanceId;
    expect(activeVillain(hero).stageIndex).toBe(1); // expert starts on Drang II
    // Drang II prints 14[per_hero] hit points (28 for 2 players); prime to 1 remaining and land Groot's own basic
    // ATK (2) for the kill, through a real `basicAttack` command, so the engine's own advance pushes Drang III's
    // own When Revealed frame (the same `defeatDrangI` precedent above).
    const primed = patchInstance(hero, villain, { damage: 26 });
    const attacked = settle(
      runWave3(primed, {
        type: "basicAttack",
        playerId: P1,
        attackerInstanceId: identityOf(primed, P1),
        targetInstanceId: villain,
      }),
      firstLegal,
      undefined,
      WAVE3_DEPS,
    );
    expect(activeVillain(attacked).stageIndex).toBe(2); // Drang III is now the active stage

    const grunts = instancesOf(attacked, "16118").filter((id) => cardsInPlay(attacked).includes(id));
    expect(grunts).toHaveLength(2);
    const engagedWithP1 = grunts.filter((id) => inst(attacked, id).engagedWith === P1);
    const engagedWithP2 = grunts.filter((id) => inst(attacked, id).engagedWith === P2);
    // The first Grunt discarded ties 0-0 and goes to the first player (P1, RRG 1.8 "First Player", p. 19); by the
    // time the second Grunt is discarded, P1 already has 1 and P2 has 0, so the ranking — re-run per minion —
    // sends it to P2 instead of piling both onto P1.
    expect(engagedWithP1).toHaveLength(1);
    expect(engagedWithP2).toHaveLength(1);
  });
});

describe("Protect the Planet (16062) — main scheme stage 2", () => {
  it("2A When Revealed: resolves Charge Up when the main scheme advances from stage 1 (16062a.when-revealed)", () => {
    const state = brotherhoodOfBadoon();
    const scheme = state.mainScheme.instanceId;
    // Stage 1's target threat is 8 solo; prime 1 below it so step one's own placement (>= 1) completes and advances
    // it through the real event system, the same `risky-business.test.ts` "Hostile Takeover 1B" precedent.
    const primed = patchInstance(state, scheme, { threat: 7 });
    const { state: after, events } = driveEvents(WAVE3_DEPS, primed, endTurn());
    expect(after.mainScheme.stageIndex).toBe(1); // "Protect the Planet" is now active
    expect(resolvedAbility(events, "16062a.when-revealed")).toBe(true);
  });

  it("2B First Player Action: exhaust the Milano → choose to remove 3 threat from this scheme (16062b.protect-the-planet-constant)", () => {
    const state = brotherhoodOfBadoon();
    const scheme = state.mainScheme.instanceId;
    const atStage2: GameState = { ...state, mainScheme: { ...state.mainScheme, stageIndex: 1 } };
    const withThreat = patchInstance(atStage2, scheme, { threat: 5 });
    const [milano] = instancesOf(withThreat, "16142");
    const chosen = settle(
      runWave3(withThreat, use(P1, scheme, "16062b.protect-the-planet-constant", [], { exhausted: [milano!] })),
      (s) => {
        const choice = s.pendingChoice;
        if (!choice) return [];
        const hit = choice.options.find((o) => o.label.startsWith("Remove 3 threat"));
        return hit ? [hit.optionId] : firstLegal(s);
      },
      undefined,
      WAVE3_DEPS,
    );
    expect(inst(chosen, scheme).threat).toBe(2);
    expect(inst(chosen, milano!).exhausted).toBe(true);
  });

  it("2B First Player Action: exhaust the Milano → choose to deal 3 damage to a minion (16062b.protect-the-planet-constant)", () => {
    const state = brotherhoodOfBadoon();
    const scheme = state.mainScheme.instanceId;
    const atStage2: GameState = { ...state, mainScheme: { ...state.mainScheme, stageIndex: 1 } };
    // Badoon Engineer (16065) is an ordinary encounter card (not a nemesis set), so it's staged and revealed with
    // `stackEncounterDeck` + a real `endTurn`, the same convention Drang's Spear's own reveal test above uses.
    const staged = stackEncounterDeck(atStage2, "01186", "16065");
    const withMinion = settle(runWave3(staged, endTurn()), firstLegal, undefined, WAVE3_DEPS);
    const engineer = instancesOf(withMinion, "16065").find((id) => withMinion.players[0]!.playArea.includes(id))!;
    const [milano] = instancesOf(withMinion, "16142");
    const chosen = settle(
      runWave3(withMinion, use(P1, scheme, "16062b.protect-the-planet-constant", [], { exhausted: [milano!] })),
      (s) => {
        const choice = s.pendingChoice;
        if (!choice) return [];
        const hit = choice.options.find((o) => o.label.startsWith("Deal 3 damage"));
        return hit ? [hit.optionId] : firstLegal(s); // the follow-up "choose a minion" prompt has only one candidate
      },
      undefined,
      WAVE3_DEPS,
    );
    // Badoon Engineer prints exactly 3 hit points, so this ability's 3 damage defeats it outright rather than
    // merely marking it — the defeat pipeline resets a fallen character's damage dial back to 0 (the same
    // `groot-kit.test.ts` "Root Stomp" lesson), so "it left play" is the assertion, not "its damage went up".
    expect(cardsInPlay(chosen)).not.toContain(engineer);
  });

  it("2B Forced Response: after resolving step one of the villain phase, resolves Charge Up (16062b.protect-the-planet-forced-response)", () => {
    const state = brotherhoodOfBadoon();
    const scheme = state.mainScheme.instanceId;
    const atStage2: GameState = { ...state, mainScheme: { ...state.mainScheme, stageIndex: 1 } };
    const withThreat = patchInstance(atStage2, scheme, { threat: 0 }); // well below stage 2's target: no loss risk
    const [ship] = instancesOf(withThreat, "16063");
    const before = inst(withThreat, ship!).counters.barrage ?? 0;
    const after = settle(runWave3(withThreat, endTurn()), firstLegal, undefined, WAVE3_DEPS);
    expect(after.outcome).toBeNull();
    expect(inst(after, ship!).counters.barrage ?? 0).toBeGreaterThanOrEqual(before + 1);
  });
});

describe("Badoon Engineer (16065)", () => {
  it("[star] Forced Response: after it engages you, resolves Charge Up (16065.badoon-engineer-forced-response)", () => {
    const state = brotherhoodOfBadoon();
    // An ordinary encounter card (not a nemesis set): staged with `stackEncounterDeck` + a real `endTurn`.
    const staged = stackEncounterDeck(state, "01186", "16065");
    const { events } = driveEvents(WAVE3_DEPS, staged, { type: "endTurn", playerId: P1 });
    expect(resolvedAbility(events, "16065.badoon-engineer-forced-response")).toBe(true);
  });

  it("[star] Boost: resolves Charge Up (16065.boost)", () => {
    const state = brotherhoodOfBadoon();
    const [ship] = instancesOf(state, "16063");
    const before = inst(state, ship!).counters.barrage ?? 0;
    const staged = stackEncounterDeck(state, "16065"); // drawn as Drang's own boost card, not revealed as an activation
    const { deps, trace } = traceAbilities(WAVE3_DEPS);
    const after = settle(runWith(deps, staged, { type: "endTurn", playerId: P1 }), firstLegal, undefined, deps);
    expect(trace.resolved()).toContain("16065.boost");
    expect(inst(after, ship!).counters.barrage ?? 0).toBeGreaterThanOrEqual(before + 1);
  });
});

describe("Bombardment (16067)", () => {
  it("Forced Response: after resolving step one of the villain phase, resolves Charge Up (16067.bombardment-forced-response)", () => {
    const state = brotherhoodOfBadoon();
    const { state: withBombardment } = encounterCardInVillainArea(state, "16067", 5);
    const { events } = driveEvents(WAVE3_DEPS, withBombardment, { type: "endTurn", playerId: P1 });
    expect(resolvedAbility(events, "16067.bombardment-forced-response")).toBe(true);
  });
});
