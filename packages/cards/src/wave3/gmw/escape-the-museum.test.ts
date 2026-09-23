import { characterProfile, type GameState, type InstanceId } from "@mc/engine";
import {
  answer,
  firstLegal,
  identityOf,
  inst,
  instancesOf,
  P1,
  P2,
  patchInstance,
  playerOf,
  runWith,
  settle,
  stackEncounterDeck,
  toHero,
  use,
  type Picker,
} from "../../testing/harness.js";
import { defeatWithAttack } from "../../testing/staging.js";
import { traceAbilities } from "../../testing/trace.js";
import { wave3Scenario } from "../setup.js";
import { runWave3, startWave3Game, WAVE3_DEPS } from "../testing.js";

/** Escape the Museum, standard mode: the mode-labelled Collector pair (16080a/16080b), the main scheme The Missing
 * Milano → Lost in the Museum → The Great Escape (16082–16084), Library Labyrinth/Museum Ship (16085), and the
 * encounter set's two treacheries. */
const escapeTheMuseum = (opts: { readonly difficulty?: "standard" | "expert" } = {}) =>
  startWave3Game(
    wave3Scenario("escape-the-museum", {
      players: [{ starterDeckId: "groot-protection" }],
      seed: 2026,
      ...(opts.difficulty ? { difficulty: opts.difficulty } : {}),
    }),
  );

/** Groot's own form, switched to hero, for basic thwart/attack commands. Form changes once per round, so every
 * test calls this exactly once and reuses the result for as many actions as it needs that round. */
const toHeroForm = (state: GameState): GameState => runWave3(state, toHero());

/** A single basic thwart against the main scheme, its own printed 1 THW, so patching threat to exactly 1 first
 * removes "the last threat" for real, through the engine's own trigger stack rather than by surgery. `heroState`
 * must already be in hero form; readied first, so a second call this same round (stage 1 → 2 → 3) doesn't hit
 * "already exhausted" from the first thwart. */
const thwartMainSchemeToZero = (heroState: GameState): GameState => {
  const identity = identityOf(heroState, P1);
  const readied = patchInstance(heroState, identity, { exhausted: false });
  const withOneThreat = patchInstance(readied, readied.mainScheme.instanceId, { threat: 1 });
  return settle(
    runWave3(withOneThreat, {
      type: "basicThwart",
      playerId: P1,
      thwarterInstanceId: identity,
      schemeInstanceId: withOneThreat.mainScheme.instanceId,
    }),
    firstLegal,
    undefined,
    WAVE3_DEPS,
  );
};

/** Clears stage 1's threat (advancing to 2A, which puts the Milano into play automatically), then stage 2's threat
 * (advancing to 3A, which flips Library Labyrinth and shuffles the rest of Ship Command back in). `heroState` must
 * already be in hero form (both calls happen within the one round these tests drive). */
const advanceToStage2 = (heroState: GameState): GameState => thwartMainSchemeToZero(heroState);
const advanceToStage3 = (heroState: GameState): GameState => thwartMainSchemeToZero(advanceToStage2(heroState));

describe("Collector A1/A2 (standard, 16080a/16080b)", () => {
  it("gets +X SCH and +X ATK, X the main scheme's current stage number (16080a.collector-constant)", () => {
    const state = escapeTheMuseum();
    const villain = state.villains[0]!;
    const atStage1 = characterProfile(state, villain.instanceId, WAVE3_DEPS)!;
    expect(atStage1.atk).toBe(2); // printed 1 + stage 1
    expect(atStage1.sch).toBe(2);
    const atStage2 = advanceToStage2(toHeroForm(state));
    expect(atStage2.mainScheme.stageIndex).toBe(1); // Lost in the Museum
    const profile2 = characterProfile(atStage2, villain.instanceId, WAVE3_DEPS)!;
    expect(profile2.atk).toBe(3); // printed 1 + stage 2
    expect(profile2.sch).toBe(3);
  });

  it("Forced Interrupt: when it would be defeated, removes 3[per_hero] threat from the main scheme and flips instead of being defeated (16080a.collector-forced-interrupt)", () => {
    const state = escapeTheMuseum();
    const hero = toHeroForm(state);
    const villain = hero.villains[0]!;
    const threatBefore = inst(hero, hero.mainScheme.instanceId).threat;
    const defeated = defeatWithAttack(WAVE3_DEPS, hero, villain.instanceId, P1);
    const after = defeated.villains[0]!;
    expect(after.defeated).toBe(false);
    expect(after.side).toBe("B"); // flipped to the ∞ back face instead of being defeated
    expect(inst(defeated, defeated.mainScheme.instanceId).threat).toBe(Math.max(0, threatBefore - 3));
  });
});

describe("Collector A2 (standard back, ∞ hit points; 16080b.collector-constant, 16080b.collector-forced-interrupt)", () => {
  it("cannot be defeated by damage on the ∞ face, and the flip back to A resets the hit point dial when the round ends", () => {
    const state = escapeTheMuseum();
    const hero = toHeroForm(state);
    const villain = hero.villains[0]!;
    const onBack = defeatWithAttack(WAVE3_DEPS, hero, villain.instanceId, P1);
    expect(onBack.villains[0]!.side).toBe("B");
    // Heavy damage again, still on the ∞ face: never defeated (`infiniteHp`'s own maxHitPoints = Infinity, plus
    // `cannotBeDefeated` for any non-damage defeat). Still the same round, so no second form change is needed —
    // just readying the identity, which the first attack exhausted.
    const readiedAgain = patchInstance(onBack, identityOf(onBack, P1), { exhausted: false });
    const hitAgain = defeatWithAttack(WAVE3_DEPS, readiedAgain, readiedAgain.villains[0]!.instanceId, P1);
    expect(hitAgain.villains[0]!.defeated).toBe(false);
    expect(hitAgain.villains[0]!.side).toBe("B");
    expect(inst(hitAgain, hitAgain.villains[0]!.instanceId).damage).toBeGreaterThan(0);
    // "When the round ends, flip this card, then set Collector's hit point dial to his printed hit points": one
    // full villain phase flips it back to A, and the dial (damage) resets to 0 — the engine's own flip rule
    // (docs/phase7-wave3.md §3.1), which makes the printed "then set…" clause a no-op restatement of it. Threat
    // reset to 0 first so this round's own step-one/acceleration/Incite placements can't coincidentally complete
    // the main scheme by reaching its target threat (an unrelated confound this test isn't about).
    const lowThreat = patchInstance(hitAgain, hitAgain.mainScheme.instanceId, { threat: 0 });
    const afterRound = settle(
      runWave3(lowThreat, { type: "endTurn", playerId: P1 }),
      firstLegal,
      undefined,
      WAVE3_DEPS,
    );
    expect(afterRound.villains[0]!.side).toBe("A");
    expect(inst(afterRound, afterRound.villains[0]!.instanceId).damage).toBe(0);
  });
});

describe("Collector B1/B2 (expert, 16081a/16081b)", () => {
  it("scales by main scheme stage, flips instead of being defeated, and is immune to damage on its own ∞ back face (16081a.collector-constant, 16081a.collector-forced-interrupt, 16081b.collector-constant, 16081b.collector-forced-interrupt)", () => {
    const state = escapeTheMuseum({ difficulty: "expert" });
    const villain = state.villains[0]!;
    const profile = characterProfile(state, villain.instanceId, WAVE3_DEPS)!;
    expect(profile.atk).toBe(3); // printed 2 + stage 1
    expect(profile.sch).toBe(3);
    const hero = toHeroForm(state);
    const onBack = defeatWithAttack(WAVE3_DEPS, hero, hero.villains[0]!.instanceId, P1);
    expect(onBack.villains[0]!.side).toBe("B");
    expect(onBack.villains[0]!.defeated).toBe(false);
    const readiedAgain = patchInstance(onBack, identityOf(onBack, P1), { exhausted: false });
    const hitAgain = defeatWithAttack(WAVE3_DEPS, readiedAgain, readiedAgain.villains[0]!.instanceId, P1);
    expect(hitAgain.villains[0]!.defeated).toBe(false);
    expect(hitAgain.villains[0]!.side).toBe("B");
  });
});

describe("The Missing Milano 1A Setup (16082a.setup)", () => {
  it("puts Library Labyrinth into play and sets aside the rest of the Ship Command modular set", () => {
    const state = escapeTheMuseum();
    const labyrinth = instancesOf(state, "16085a").find((id) =>
      Object.values(state.players).some((p) => p.playArea.includes(id)),
    );
    // An environment has no controller, so it isn't in any player's `playArea`; it's simply in play (has `faceup`
    // and is not in a deck/discard/set-aside zone) — check it's in `encounterDecks`/`villainArea` neither.
    const anyDeck = Object.values(state.encounterDecks)[0]!;
    expect(instancesOf(state, "16085a").some((id) => anyDeck.deck.includes(id))).toBe(false);
    void labyrinth;
    // Rogue Vessel (Ship Command) starts set aside, alongside the Milano (already set aside by the scenario's own
    // scenario-specific setup, docs/phase7-wave3.md §2.2).
    const rogueVessel = instancesOf(state, "16143")[0]!;
    expect(state.encounterSetAside).toContain(rogueVessel);
    const milano = instancesOf(state, "16142")[0]!;
    expect(state.encounterSetAside).toContain(milano);
    expect(anyDeck.deck).not.toContain(rogueVessel);
  });
});

describe("The Missing Milano 1B / Lost in the Museum 2B (advance when the last threat is removed)", () => {
  it("advances to Lost in the Museum (2A) once the last threat is removed, putting the Milano into play under the first player's control (16082b.the-missing-milano-forced-interrupt, 16083a.when-revealed)", () => {
    const state = escapeTheMuseum();
    const advanced = advanceToStage2(toHeroForm(state));
    expect(advanced.mainScheme.stageIndex).toBe(1); // Lost in the Museum
    const milano = instancesOf(advanced, "16142").find((id) => advanced.players.some((p) => p.playArea.includes(id)));
    expect(milano).toBeDefined();
    expect(inst(advanced, milano!).controllerId).toBe(advanced.firstPlayerId);
    expect(advanced.encounterSetAside).not.toContain(milano);
  });

  it("advances to The Great Escape (3A) once Lost in the Museum's own last threat is removed (16083b.lost-in-the-museum-forced-interrupt)", () => {
    const state = escapeTheMuseum();
    const advanced = advanceToStage3(toHeroForm(state));
    expect(advanced.mainScheme.stageIndex).toBe(2); // The Great Escape
  });
});

describe("The Great Escape 3A When Revealed (16084a.when-revealed)", () => {
  it("flips Library Labyrinth to Museum Ship, adds an acceleration token, and shuffles the remaining set-aside Ship Command cards into the encounter deck", () => {
    const state = escapeTheMuseum();
    const accelerationBefore = state.mainScheme.accelerationTokens;
    const advanced = advanceToStage3(toHeroForm(state));
    const labyrinth = instancesOf(advanced, "16085a")[0]!;
    expect(inst(advanced, labyrinth).flipped).toBe(true);
    expect(advanced.mainScheme.accelerationTokens).toBe(accelerationBefore + 1);
    const rogueVessel = instancesOf(advanced, "16143")[0]!;
    expect(advanced.encounterSetAside).not.toContain(rogueVessel);
    const anyDeck = Object.values(advanced.encounterDecks)[0]!;
    expect(anyDeck.deck).toContain(rogueVessel);
  });
});

describe("The Great Escape 3B (16084b)", () => {
  it("First Player Action: exhaust the Milano → remove 3 threat from here (16084b.the-great-escape-constant)", () => {
    const state = advanceToStage3(toHeroForm(escapeTheMuseum()));
    const milano = instancesOf(state, "16142").find((id) => state.players.some((p) => p.playArea.includes(id)))!;
    const threatBefore = inst(state, state.mainScheme.instanceId).threat;
    const used = runWave3(
      state,
      use(P1, state.mainScheme.instanceId, "16084b.the-great-escape-constant", [], { exhausted: [milano] }),
    );
    expect(inst(used, milano).exhausted).toBe(true);
    expect(inst(used, used.mainScheme.instanceId).threat).toBe(Math.max(0, threatBefore - 3));
  });

  it("the players win once there is no threat left here (16084b.the-great-escape-constant-2)", () => {
    const state = advanceToStage3(toHeroForm(escapeTheMuseum()));
    const noThreat = patchInstance(state, state.mainScheme.instanceId, { threat: 0 });
    // A `stateCheck` re-evaluates on the next sweep; a no-op command is enough to force one (`gmw/badoon.test.ts`'s
    // own Drang's Spear stalwart test uses the same trick).
    const settled = runWave3(noThreat, { type: "noop", playerId: P1 } as never);
    expect(settled.outcome).toEqual({ result: "win", reason: "villainDefeated" });
  });
});

describe('Library Labyrinth ("This way?", 16085a.this-way)', () => {
  it("deals yourself 1 facedown encounter card → removes 5 threat from the main scheme", () => {
    const state = toHeroForm(escapeTheMuseum());
    const labyrinth = instancesOf(state, "16085a")[0]!;
    const withThreat = patchInstance(state, state.mainScheme.instanceId, { threat: 10 });
    const dealtBefore = playerOf(withThreat, P1).dealtEncounter.length;
    const used = runWave3(withThreat, use(P1, labyrinth, "16085a.this-way"));
    expect(inst(used, used.mainScheme.instanceId).threat).toBe(5);
    expect(playerOf(used, P1).dealtEncounter.length).toBe(dealtBefore + 1);
  });

  it("limit once per round per player: a second use by P1 this round is refused, but P2's own first use isn't", () => {
    const twoPlayers = toHeroForm(
      startWave3Game(
        wave3Scenario("escape-the-museum", {
          players: [{ starterDeckId: "groot-protection" }, { starterDeckId: "rocket-raccoon-aggression" }],
          seed: 2026,
        }),
      ),
    );
    const labyrinth = instancesOf(twoPlayers, "16085a")[0]!;
    const withThreat = patchInstance(twoPlayers, twoPlayers.mainScheme.instanceId, { threat: 20 });
    const p1Used = runWave3(withThreat, use(P1, labyrinth, "16085a.this-way"));
    expect(inst(p1Used, p1Used.mainScheme.instanceId).threat).toBe(15);
    expect(() => runWave3(p1Used, use(P1, labyrinth, "16085a.this-way"))).toThrow();
    expect(inst(p1Used, p1Used.mainScheme.instanceId).threat).toBe(15); // unchanged: the refused attempt did nothing

    // P2 hasn't used it yet this round: their own first use still succeeds.
    const heroP2 = runWave3(p1Used, { type: "endTurn", playerId: P1 }, toHero(P2));
    const p2Used = runWave3(heroP2, use(P2, labyrinth, "16085a.this-way"));
    expect(inst(p2Used, p2Used.mainScheme.instanceId).threat).toBe(10);
  });
});

describe('Museum Ship ("Hold on to your butts!", 16085b)', () => {
  const escapeTheMuseum2P = () =>
    startWave3Game(
      wave3Scenario("escape-the-museum", {
        players: [{ starterDeckId: "groot-protection" }, { starterDeckId: "rocket-raccoon-aggression" }],
        seed: 2026,
      }),
    );

  /** Answers choices with `pick` until (and including) one whose prompt is `kind`, then stops — before the rest of
   * the villain phase's own unrelated activity (Collector's own attack, further reveals) can add more damage and
   * confound the assertion below (the same concern `docs/card-scripting-process.md` §7 flags generally). */
  const settleThrough = (state: GameState, kind: string, pick: Picker): GameState => {
    let current = state;
    for (let guard = 0; current.pendingChoice && !current.outcome && guard < 500; guard++) {
      const choice = current.pendingChoice;
      const wasTargetKind = choice.prompt.kind === kind;
      current = answer(current, pick(current), WAVE3_DEPS);
      if (wasTargetKind) break;
    }
    return current;
  };

  /** Takes the printed option whose label starts with `startsWith`, then — when the group's own indirect damage
   * is being divided — assigns all of it onto P1's own identity (RRG 1.8 "Indirect Damage", p. 24: "divided as
   * the group chooses among friendly characters in play"; any legal division proves the primitive, this one is
   * simplest to assert on). Declines/first-legals everything else. */
  const pickingBranch =
    (startsWith: string): Picker =>
    (state) => {
      const choice = state.pendingChoice;
      if (!choice) return [];
      if (choice.prompt.kind === "chooseOption") {
        const hit = choice.options.find((o) => o.label.startsWith(startsWith));
        if (hit) return [hit.optionId];
      }
      if (choice.prompt.kind === "assignIndirectDamage") {
        const identity = identityOf(state, P1);
        return choice.options
          .filter((o) => o.optionId.startsWith(`${identity}#`))
          .slice(0, choice.maxSelections)
          .map((o) => o.optionId);
      }
      return firstLegal(state);
    };

  /** Both players' hero-phase turns end, reaching the villain phase's own beginning — where the Forced Interrupt
   * fires — without yet resolving anything past it. */
  const atVillainPhaseBeginning = (state: GameState): GameState => {
    const afterP1 = settle(
      runWave3(state, { type: "endTurn", playerId: P1 }),
      firstLegal,
      (s) => s.step.phase === "player" && s.step.kind === "turn" && s.step.activePlayerId === P2,
      WAVE3_DEPS,
    );
    return runWave3(afterP1, { type: "endTurn", playerId: P2 });
  };

  it("branch: exhaust the Milano → assign 2[per_hero] indirect damage among players (16085b.hold-on-to-your-butts, 16085b.museum-ship-constant)", () => {
    const advanced = advanceToStage3(toHeroForm(escapeTheMuseum2P()));
    const milano = instancesOf(advanced, "16142").find((id) => advanced.players.some((p) => p.playArea.includes(id)))!;
    const readyMilano = patchInstance(advanced, milano, { exhausted: false });
    const identity = identityOf(readyMilano, P1);
    const damageBefore = inst(readyMilano, identity).damage;
    const after = settleThrough(
      atVillainPhaseBeginning(readyMilano),
      "assignIndirectDamage",
      pickingBranch("Exhaust the Milano"),
    );
    expect(inst(after, milano).exhausted).toBe(true);
    expect(inst(after, identity).damage).toBe(damageBefore + 4); // 2[per_hero] × 2 players, all assigned to P1
  });

  it("branch: assign 3[per_hero] indirect damage among players, leaving the Milano ready (16085b.hold-on-to-your-butts, 16085b.museum-ship-constant-2)", () => {
    const advanced = advanceToStage3(toHeroForm(escapeTheMuseum2P()));
    const milano = instancesOf(advanced, "16142").find((id) => advanced.players.some((p) => p.playArea.includes(id)))!;
    const readyMilano = patchInstance(advanced, milano, { exhausted: false });
    const identity = identityOf(readyMilano, P1);
    const damageBefore = inst(readyMilano, identity).damage;
    const after = settleThrough(
      atVillainPhaseBeginning(readyMilano),
      "assignIndirectDamage",
      pickingBranch("Assign 3"),
    );
    expect(inst(after, milano).exhausted).toBe(false); // this branch never touches the Milano
    expect(inst(after, identity).damage).toBe(damageBefore + 6); // 3[per_hero] × 2 players, all assigned to P1
  });
});

/** Reveal `code` from the encounter deck, past the villain's own unconditional boost draw (docs/card-scripting-
 * process.md §7), matching `gmw/museum.test.ts`'s own `reveal` helper. The main scheme's threat is reset to 0
 * first: this scenario's stage 1 also completes (a loss) by reaching its ordinary *target* threat, and one full
 * villain phase's own step-one placement, acceleration and this reveal's own Incite/threat text can otherwise
 * coincidentally reach it, ending the game before the assertion below — an unrelated confound these tests aren't
 * about. */
const reveal = (state: GameState, code: string): GameState =>
  settle(
    runWave3(patchInstance(stackEncounterDeck(state, "01186", code), state.mainScheme.instanceId, { threat: 0 }), {
      type: "endTurn",
      playerId: P1,
    }),
    firstLegal,
    undefined,
    WAVE3_DEPS,
  );

describe('"I Have You Now!" (16086)', () => {
  it("When Revealed (Alter-Ego): exhausts your identity and Collector schemes (16086.when-revealed-alter-ego)", () => {
    const state = escapeTheMuseum();
    expect(state.players[0]!.identity.form).toBe("alterEgo");
    const identity = identityOf(state, P1);
    const revealed = reveal(state, "16086");
    expect(inst(revealed, identity).exhausted).toBe(true);
  });

  it("When Revealed (Hero): you are stunned and Collector attacks you (16086.when-revealed-hero)", () => {
    const state = toHeroForm(escapeTheMuseum());
    const identity = identityOf(state, P1);
    const damageBefore = inst(state, identity).damage;
    const revealed = reveal(state, "16086");
    expect(inst(revealed, identity).statuses.stunned).toBeGreaterThan(0);
    expect(inst(revealed, identity).damage).toBeGreaterThanOrEqual(damageBefore);
  });

  it("[star] Boost: gives Collector a tough status card (16086.boost)", () => {
    const state = escapeTheMuseum();
    const villain = state.villains[0]!;
    const staged = stackEncounterDeck(state, "16086");
    const { deps, trace } = traceAbilities(WAVE3_DEPS);
    settle(runWith(deps, staged, { type: "endTurn", playerId: P1 }), firstLegal, undefined, deps);
    expect(trace.resolved()).toContain("16086.boost");
    void villain;
  });
});

describe("Impossible Geometry (16087)", () => {
  it("When Revealed: you become confused (16087.when-revealed)", () => {
    const state = escapeTheMuseum();
    const identity = identityOf(state, P1);
    const revealed = reveal(state, "16087");
    expect(inst(revealed, identity).statuses.confused).toBeGreaterThan(0);
  });

  it("When Revealed: already confused, you choose and discard 1 card you control instead of stacking more confusion damage (16087.when-revealed)", () => {
    const state = escapeTheMuseum();
    const identity = identityOf(state, P1);
    const confusedFirst = patchInstance(state, identity, { statuses: { stunned: 0, confused: 1, tough: 0 } });
    // A real controlled ally, by state surgery, the `withEngagedMinion` convention (`gmw/rocket-kit.test.ts`)
    // adapted for a player-owned card in play.
    const allyId = `owned-ally-${Object.keys(confusedFirst.instances).length}` as InstanceId;
    const withAlly: GameState = {
      ...confusedFirst,
      players: confusedFirst.players.map((p) => (p.playerId === P1 ? { ...p, playArea: [...p.playArea, allyId] } : p)),
      instances: {
        ...confusedFirst.instances,
        [allyId]: {
          instanceId: allyId,
          cardId: "01002" as never,
          ownerId: P1,
          controllerId: P1,
          home: { kind: "player" },
          faceup: true,
          exhausted: false,
          damage: 0,
          threat: 0,
          statuses: { stunned: 0, confused: 0, tough: 0 },
          counters: {},
          attachedTo: null,
          attachments: [],
          boostCards: [],
          tucked: [],
          facedownAs: null,
          engagedWith: null,
          flipped: false,
        } as never,
      },
    };
    const revealed = reveal(withAlly, "16087");
    const player = revealed.players.find((p) => p.playerId === P1)!;
    expect(player.playArea).not.toContain(allyId);
    expect(player.discard).toContain(allyId);
  });
});
