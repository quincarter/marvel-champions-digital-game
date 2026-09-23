import {
  activeEncounterDeckId,
  characterProfile,
  type Command,
  type EngineDeps,
  type GameEvent,
  type GameState,
  type InstanceId,
  type PlayerId,
} from "@mc/engine";
import { cardId } from "@mc/content";
import {
  applyOk,
  firstLegal,
  identityOf,
  inst,
  instancesOf,
  moveToHand,
  P1,
  P2,
  patchInstance,
  payWith,
  play,
  playerOf,
  runWith,
  settle,
  stackEncounterDeck,
  toHero,
  type Picker,
} from "../../testing/harness.js";
import { defeatWithAttack, driveEvents } from "../../testing/staging.js";
import { traceAbilities } from "../../testing/trace.js";
import { wave3Scenario } from "../setup.js";
import { runWave3, startWave3Game, WAVE3_DEPS } from "../testing.js";

/** `driveEvents`, but with a custom choice `Picker` instead of a hardcoded `firstLegal` — needed to declare a
 * specific ally as the defender, which `firstLegal` alone would decline (`ronan.test.ts`'s own note on the same
 * trap). */
function driveEventsPicking(
  deps: EngineDeps,
  state: GameState,
  pick: Picker,
  ...commands: readonly Command[]
): { readonly state: GameState; readonly events: readonly GameEvent[] } {
  let current = state;
  const events: GameEvent[] = [];
  const settleOne = () => {
    while (current.pendingChoice && !current.outcome) {
      const choice = current.pendingChoice;
      const result = applyOk(
        current,
        {
          type: "resolveChoice",
          playerId: choice.playerId,
          choiceId: choice.choiceId,
          selectedOptionIds: pick(current),
        },
        deps,
      );
      current = result.state;
      events.push(...result.events);
    }
  };
  settleOne();
  for (const command of commands) {
    const result = applyOk(current, command, deps);
    current = result.state;
    events.push(...result.events);
    settleOne();
  }
  return { state: current, events };
}

/**
 * The Kree Fanatic modular set (`ron`, 90001–90005, `wave3/ron/kree-fanatic.ts`), exercised by swapping it into
 * Nebula's own recommended modular (Space Pirates) via `modularSetIds` — Nebula is chosen (not any `ronan-the-
 * accuser` scenario) precisely to avoid the title collision the module docblock names: the `gmw` villain is also
 * titled "Ronan the Accuser", and RRG 1.8's Unique rule would keep the minion from entering play at all if both
 * were in the same game.
 */
const withKreeFanatic = (
  players: readonly { readonly starterDeckId: string }[] = [{ starterDeckId: "groot-protection" }],
) => startWave3Game(wave3Scenario("nebula", { players, seed: 2026, modularSetIds: ["kree_fanatic"] }));

/** Moves an encounter-deck (or discard-pile) card straight into a host's `attachments` (surgery, the same shape
 * `gmw/galactic-artifacts.test.ts`'s own `attachTo` uses). */
function attachTo(
  state: GameState,
  code: string,
  host: InstanceId,
): { readonly state: GameState; readonly id: InstanceId } {
  const deckId = activeEncounterDeckId(state);
  const pile = state.encounterDecks[deckId]!;
  const wanted = cardId(code);
  const id =
    pile.deck.find((i) => state.instances[i]?.cardId === wanted) ??
    pile.discard.find((i) => state.instances[i]?.cardId === wanted);
  if (!id) throw new Error(`no ${code} in the encounter deck or discard`);
  return {
    id,
    state: {
      ...state,
      encounterDecks: {
        ...state.encounterDecks,
        [deckId]: { deck: pile.deck.filter((i) => i !== id), discard: pile.discard.filter((i) => i !== id) },
      },
      instances: {
        ...state.instances,
        [id]: { ...state.instances[id]!, faceup: true, attachedTo: host },
        [host]: { ...state.instances[host]!, attachments: [...state.instances[host]!.attachments, id] },
      },
    },
  };
}

/** Puts an encounter-deck minion into play engaged with a player directly (surgery mirroring the `engage`
 * effect's own `moveCard`/`engagedWith` update — `gmw/nebula.test.ts`'s own `engageMinion`). */
function engageMinion(
  state: GameState,
  code: string,
  player: PlayerId = P1,
): { readonly state: GameState; readonly id: InstanceId } {
  const deckId = activeEncounterDeckId(state);
  const pile = state.encounterDecks[deckId]!;
  const wanted = cardId(code);
  const id =
    pile.deck.find((i) => state.instances[i]?.cardId === wanted) ??
    pile.discard.find((i) => state.instances[i]?.cardId === wanted);
  if (!id) throw new Error(`no ${code} in the encounter deck or discard`);
  return {
    id,
    state: {
      ...state,
      encounterDecks: {
        ...state.encounterDecks,
        [deckId]: { deck: pile.deck.filter((i) => i !== id), discard: pile.discard.filter((i) => i !== id) },
      },
      players: state.players.map((p) => (p.playerId === player ? { ...p, playArea: [...p.playArea, id] } : p)),
      instances: {
        ...state.instances,
        [id]: { ...state.instances[id]!, faceup: true, engagedWith: player, controllerId: null },
      },
    },
  };
}

/** Puts an encounter-deck card into the villain area, unengaged (surgery). */
function placeInVillainArea(state: GameState, code: string): { readonly state: GameState; readonly id: InstanceId } {
  const deckId = activeEncounterDeckId(state);
  const pile = state.encounterDecks[deckId]!;
  const wanted = cardId(code);
  const id =
    pile.deck.find((i) => state.instances[i]?.cardId === wanted) ??
    pile.discard.find((i) => state.instances[i]?.cardId === wanted);
  if (!id) throw new Error(`no ${code} in the encounter deck or discard`);
  return {
    id,
    state: {
      ...state,
      encounterDecks: {
        ...state.encounterDecks,
        [deckId]: { deck: pile.deck.filter((i) => i !== id), discard: pile.discard.filter((i) => i !== id) },
      },
      villainArea: [...state.villainArea, id],
      instances: { ...state.instances, [id]: { ...state.instances[id]!, faceup: true } },
    },
  };
}

describe("Ronan the Accuser (90001)", () => {
  it("cannot be stunned: a stunned status is shed on the next state-trigger sweep (90001.ronan-the-accuser-constant)", () => {
    const state = withKreeFanatic();
    const { state: engaged, id: ronan } = engageMinion(state, "90001");
    const stunned = patchInstance(engaged, ronan, { statuses: { stunned: 1, confused: 0, tough: 0 } });
    expect(inst(stunned, ronan).statuses.stunned).toBe(1);
    const { state: after } = driveEvents(WAVE3_DEPS, stunned, { type: "endTurn", playerId: P1 });
    expect(inst(after, ronan).statuses.stunned).toBe(0);
  });

  it("Forced Interrupt: engages the hero with the fewest remaining hit points when the villain phase begins (90001.ronan-the-accuser-forced-interrupt)", () => {
    const state = withKreeFanatic([
      { starterDeckId: "groot-protection" },
      { starterDeckId: "rocket-raccoon-aggression" },
    ]);
    const { state: placed, id: ronan } = placeInVillainArea(state, "90001");
    const p1Identity = identityOf(placed, P1);
    // Damage P1's identity so P1 has strictly fewer remaining hit points than P2.
    const p1Profile = characterProfile(placed, p1Identity, WAVE3_DEPS)!;
    const damaged = patchInstance(placed, p1Identity, { damage: p1Profile.maxHp - 1 });
    const { state: after } = driveEvents(
      WAVE3_DEPS,
      damaged,
      { type: "endTurn", playerId: P1 },
      { type: "endTurn", playerId: P2 },
    );
    expect(inst(after, ronan).engagedWith).toBe(P1);
  });

  it("[star] Boost: puts Ronan the Accuser into play engaged with you (90001.boost)", () => {
    const state = withKreeFanatic();
    const staged = stackEncounterDeck(state, "90001");
    const { state: after } = driveEvents(WAVE3_DEPS, staged, { type: "endTurn", playerId: P1 });
    const [ronan] = instancesOf(after, "90001");
    expect(ronan).toBeDefined();
    expect(inst(after, ronan!).engagedWith).toBe(P1);
  });
});

describe("Judge, Jury, Executioner (90002)", () => {
  it("Forced Response: after a friendly character is defeated by an enemy attack, places 2 threat on the main scheme (90002.judge-jury-executioner-forced-response)", () => {
    const state = withKreeFanatic([
      { starterDeckId: "groot-protection" },
      { starterDeckId: "rocket-raccoon-aggression" },
    ]);
    const { state: placedJJE, id: jje } = placeInVillainArea(state, "90002");
    const { state: engagedRonan } = engageMinion(placedJJE, "90001", P2);
    const p1Done = runWave3(engagedRonan, { type: "endTurn", playerId: P1 }); // now P2's turn
    const hero = runWave3(p1Done, toHero(P2));
    const identity = identityOf(hero, P2);
    const profile = characterProfile(hero, identity, WAVE3_DEPS)!;
    // Prime P2's identity to fall to a single point of damage — any lethal attack defeats it, whatever Ronan's
    // exact ATK total ends up being once boost icons are added.
    const primed = patchInstance(hero, identity, { damage: Math.max(0, profile.maxHp - 1) });
    const { events } = driveEvents(WAVE3_DEPS, primed, { type: "endTurn", playerId: P2 });
    expect(
      events.some(
        (e) =>
          e.type === "threatPlaced" &&
          (e as { readonly amount: number; readonly sourceInstanceId: unknown }).amount === 2 &&
          (e as { readonly sourceInstanceId: unknown }).sourceInstanceId === jje,
      ),
    ).toBe(true);
  });

  it("an ally defeated by an enemy attack also places 2 threat (90002.judge-jury-executioner-forced-response)", () => {
    const state = withKreeFanatic();
    const { state: placedJJE, id: jje } = placeInVillainArea(state, "90002");
    const { state: engagedRonan } = engageMinion(placedJJE, "90001", P1);
    const hero = runWave3(engagedRonan, toHero());
    const given = moveToHand(hero, P1, "16012"); // Starhawk (Groot's own starter-deck ally)
    const [starhawkCard] = given.ids as [InstanceId];
    const played = settle(
      runWave3(given.state, play(P1, starhawkCard, payWith(given.state, P1, 2, [starhawkCard]))),
      firstLegal,
      undefined,
      WAVE3_DEPS,
    );
    const [starhawk] = instancesOf(played, "16012");
    const profile = characterProfile(played, starhawk!, WAVE3_DEPS)!;
    // One point of remaining hit points: any lethal attack (Ronan's own basic ATK) defeats it once it defends.
    const primed = patchInstance(played, starhawk!, { damage: Math.max(0, profile.maxHp - 1) });
    const defendWithStarhawk: Picker = (s) => {
      const choice = s.pendingChoice;
      if (choice?.prompt.kind === "declareDefender") {
        const defend = choice.options.find((o) => o.ref.kind === "card" && o.ref.instanceId === starhawk);
        return defend ? [defend.optionId] : ["decline"];
      }
      return firstLegal(s);
    };
    const { state: settled, events } = driveEventsPicking(WAVE3_DEPS, primed, defendWithStarhawk, {
      type: "endTurn",
      playerId: P1,
    });
    expect(playerOf(settled, P1).playArea).not.toContain(starhawk); // defeated, not just damaged.
    expect(
      events.some(
        (e) =>
          e.type === "threatPlaced" &&
          (e as { readonly amount: number; readonly sourceInstanceId: unknown }).amount === 2 &&
          (e as { readonly sourceInstanceId: unknown }).sourceInstanceId === jje,
      ),
    ).toBe(true);
  });

  it("an ally defeated by non-attack damage does not place threat (90002.judge-jury-executioner-forced-response)", () => {
    const state = withKreeFanatic();
    const { state: placedJJE } = placeInVillainArea(state, "90002");
    const hero = runWave3(placedJJE, toHero());
    const given = moveToHand(hero, P1, "16012"); // Starhawk: consequentialDamage.attack = 2, hp 3.
    const [starhawkCard] = given.ids as [InstanceId];
    const played = settle(
      runWave3(given.state, play(P1, starhawkCard, payWith(given.state, P1, 2, [starhawkCard]))),
      firstLegal,
      undefined,
      WAVE3_DEPS,
    );
    const [starhawk] = instancesOf(played, "16012");
    // 1 remaining hit point: her own 2-consequential-damage basic attack (fromAttack: false, `sourceInstanceId`
    // herself, not an enemy) defeats her without any enemy attack involved.
    const primed = patchInstance(played, starhawk!, { damage: 2 });
    const threatBefore = inst(primed, primed.mainScheme.instanceId).threat;
    const attacked = settle(
      runWith(WAVE3_DEPS, primed, {
        type: "basicAttack",
        playerId: P1,
        attackerInstanceId: starhawk!,
        targetInstanceId: primed.villains[0]!.instanceId,
      } as never),
      firstLegal,
      undefined,
      WAVE3_DEPS,
    );
    expect(playerOf(attacked, P1).playArea).not.toContain(starhawk); // defeated by her own consequential damage.
    expect(inst(attacked, attacked.mainScheme.instanceId).threat).toBe(threatBefore);
  });

  it("[star] Boost: puts Judge, Jury, Executioner into play (90002.boost)", () => {
    const state = withKreeFanatic();
    const staged = stackEncounterDeck(state, "90002");
    const { state: after } = driveEvents(WAVE3_DEPS, staged, { type: "endTurn", playerId: P1 });
    const [jje] = instancesOf(after, "90002");
    expect(jje).toBeDefined();
    expect(after.villainArea).toContain(jje);
  });
});

describe("The Accused (90003)", () => {
  it("Forced Interrupt: an enemy that attacks the attached identity gets +1 ATK for that attack (90003.the-accused-forced-interrupt)", () => {
    const state = withKreeFanatic();
    const identity = identityOf(state, P1);
    const { state: attached } = attachTo(state, "90003", identity);
    const { state: engaged, id: ronan } = engageMinion(attached, "90001", P1);
    const hero = runWave3(engaged, toHero());
    const ronanProfile = characterProfile(hero, ronan, WAVE3_DEPS)!;
    const { events } = driveEvents(WAVE3_DEPS, hero, { type: "endTurn", playerId: P1 });
    // Ronan's own attack event carries his printed ATK plus this card's own +1 — keyed to his instance as the
    // source, so the villain's own separate step-one attack (also against P1 this round) doesn't confound it.
    expect(
      events.some(
        (e) =>
          e.type === "attackResolved" &&
          (e as { readonly enemyInstanceId: unknown }).enemyInstanceId === ronan &&
          (e as { readonly baseAtk: number }).baseAtk === ronanProfile.atk + 1,
      ),
    ).toBe(true);
  });

  it("Forced Response: after Ronan the Accuser is defeated, discards this card (90003.the-accused-forced-response)", () => {
    const state = withKreeFanatic();
    const identity = identityOf(state, P1);
    const { state: attached, id: accused } = attachTo(state, "90003", identity);
    const { state: engaged, id: ronan } = engageMinion(attached, "90001", P1);
    const hero = runWave3(engaged, toHero());
    const after = defeatWithAttack(WAVE3_DEPS, hero, ronan);
    expect(inst(after, identity).attachments).not.toContain(accused);
  });

  it("[star] Boost: attaches to your identity (90003.boost)", () => {
    const state = withKreeFanatic();
    const staged = stackEncounterDeck(state, "90003");
    const { state: after } = driveEvents(WAVE3_DEPS, staged, { type: "endTurn", playerId: P1 });
    const [accused] = instancesOf(after, "90003");
    expect(accused).toBeDefined();
    expect(inst(after, accused!).attachedTo).toBe(identityOf(after));
  });
});

describe("Bring the Hammer Down (90004)", () => {
  it("When Revealed (Hero): Ronan the Accuser attacks the player he is engaged with (90004.when-revealed)", () => {
    const state = withKreeFanatic();
    const { state: engaged } = engageMinion(state, "90001", P1);
    const hero = runWave3(engaged, toHero());
    const identity = identityOf(hero);
    const damageBefore = inst(hero, identity).damage;
    const staged = stackEncounterDeck(hero, "01186", "90004");
    const { state: after } = driveEvents(WAVE3_DEPS, staged, { type: "endTurn", playerId: P1 });
    expect(inst(after, identity).damage).toBeGreaterThan(damageBefore);
  });

  it("When Revealed (Alter-Ego): Ronan the Accuser schemes against the player he is engaged with (90004.when-revealed)", () => {
    const state = withKreeFanatic();
    const { state: engaged } = engageMinion(state, "90001", P1);
    const reset = patchInstance(engaged, engaged.mainScheme.instanceId, { threat: 0 });
    const staged = stackEncounterDeck(reset, "01186", "90004");
    const { state: after } = driveEvents(WAVE3_DEPS, staged, { type: "endTurn", playerId: P1 });
    const scheme = engaged.mainScheme.instanceId;
    expect(inst(after, scheme).threat).toBeGreaterThan(0);
  });

  it("gains surge if Ronan the Accuser is not in play (90004.when-revealed)", () => {
    const state = withKreeFanatic();
    const staged = stackEncounterDeck(state, "01186", "90004");
    const { events } = driveEvents(WAVE3_DEPS, staged, { type: "endTurn", playerId: P1 });
    expect(events.some((e) => e.type === "surgeTriggered")).toBe(true);
  });

  it("[star] Boost: if this activation defeats a character, deals the first player 1 facedown encounter card (90004.boost)", () => {
    const state = withKreeFanatic();
    // Judge, Jury, Executioner also in play: its own Forced Response listens for a friendly character's defeat,
    // which is what routes an identity's elimination through the interruptible `characterDefeated` event at all
    // (`packages/engine/src/resolve/defeat.ts`'s `checkDefeats`: with nothing listening, a player is eliminated
    // inline and no event — and so no `results.defeated` var this card's own `eventDealt("defeated")` reads —
    // is ever produced). Not a workaround: any real game with an ally or a second character-defeat listener in
    // play reaches the same event path.
    const { state: withJJE } = placeInVillainArea(state, "90002");
    const { state: engaged } = engageMinion(withJJE, "90001", P1);
    const hero = runWave3(engaged, toHero());
    const identity = identityOf(hero);
    const profile = characterProfile(hero, identity, WAVE3_DEPS)!;
    // Any lethal attack defeats it — a single point of remaining hit points, so this doesn't depend on Ronan's
    // exact ATK total once 90004's own boost icons (or a further extra boost card) are added.
    const primed = patchInstance(hero, identity, { damage: Math.max(0, profile.maxHp - 1) });
    const { deps, trace } = traceAbilities(WAVE3_DEPS);
    const staged = stackEncounterDeck(primed, "90004");
    const { events } = driveEvents(deps, staged, { type: "endTurn", playerId: P1 });
    expect(trace.resolved()).toContain("90004.boost");
    expect(events.some((e) => e.type === "characterDefeated")).toBe(true);
  });
});

describe("You Dare Oppose Me? (90005)", () => {
  // 90005.when-revealed is a genuine primitive gap (module docblock); only its Boost is scripted.
  it("[star] Boost: if this activation is an attack, that attack gains overkill (90005.boost)", () => {
    const state = withKreeFanatic();
    const { state: engaged } = engageMinion(state, "90001", P1);
    const hero = runWave3(engaged, toHero());
    const { deps, trace } = traceAbilities(WAVE3_DEPS);
    const staged = stackEncounterDeck(hero, "90005");
    driveEvents(deps, staged, { type: "endTurn", playerId: P1 });
    expect(trace.resolved()).toContain("90005.boost");
  });
});
