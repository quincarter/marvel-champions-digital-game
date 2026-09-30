import { describe, expect, it } from "vitest";
import {
  activeEncounterDeck,
  applyCommand,
  cardsInPlay,
  characterProfile as characterProfileOf,
  type GameState,
  type InstanceId,
  type Payment,
} from "@mc/engine";
import {
  answer,
  endTurn,
  firstLegal,
  identityOf,
  inst,
  moveToHand,
  P1,
  P2,
  patchInstance,
  payWith,
  play,
  playerOf,
  settle,
  stackEncounterDeck,
  toHero,
  type Picker,
} from "../../testing/harness.js";
import { driveEventsPicking } from "../../testing/staging.js";
import { playFromHand, runWave5, startWave5Game, WAVE5_DEPS } from "../testing.js";
import { spdrScenario } from "./support.js";

const spdrVsRhino = (seed = 1) => startWave5Game(spdrScenario("rhino", { seed }));

function characterProfile(state: GameState, id: InstanceId) {
  const profile = characterProfileOf(state, id, WAVE5_DEPS);
  if (!profile) throw new Error(`no character profile for ${id}`);
  return profile;
}

/** Accepts a named option by exact id or `<instanceId>:<abilityId>` suffix; declines everything else. */
const accepting =
  (...wanted: readonly string[]): Picker =>
  (state) => {
    const choice = state.pendingChoice;
    if (!choice) return [];
    const hits = choice.options
      .map((o) => o.optionId)
      .filter((id) => wanted.some((w) => id === w || id.endsWith(`:${w}`)));
    return hits.length > 0 ? hits.slice(0, choice.maxSelections) : firstLegal(state);
  };

/** Pulls `n` more cards into P1's hand from the precon deck, so a payment doesn't run the real hand dry —
 * `wave5/spiderham/allies.test.ts`'s own `TOPUP_CODES`/`topUp` precedent, spdr's own deck codes. */
const TOPUP_CODES = ["31004", "31004", "31006", "31016", "31016", "31017", "31017", "31023", "31023", "31024"];
function topUp(state: GameState, n: number): GameState {
  return moveToHand(state, P1, ...TOPUP_CODES.slice(0, n)).state;
}

describe("VEN#m (ally, 31003)", () => {
  it("31003.ven-m-constant: gets +1 THW and +1 ATK for each sym counter on her", () => {
    const { state, id } = playFromHand(topUp(spdrVsRhino(1), 4), "31003", 4, accepting("31003.ven-m-response"));
    const printed = characterProfile(state, id);
    expect(printed.atk).toBe(1);
    expect(printed.thw).toBe(1);
    const withCounters = patchInstance(state, id, { counters: { sym: 2 } });
    const boosted = characterProfile(withCounters, id);
    expect(boosted.atk).toBe(3);
    expect(boosted.thw).toBe(3);
  });

  const SYNC = "31001a.sync-ratio";
  const syncUse = (state: GameState, pick: InstanceId): Payment => ({
    ability: { instanceId: identityOf(state, P1), abilityId: SYNC as never, costChoices: { exhausted: [pick] } },
  });

  it('31003.ven-m-response: paid partly with resources Sync Ratio generated, places that many sym counters ("Hero Response")', () => {
    const hero = toHero_(spdrVsRhino(2));
    const spdrUpgrade = playerOf(hero, P1).identity.separatedCardInstanceId!; // SP//dr, an Interface upgrade ([wild] 1).
    const given = moveToHand(topUp(hero, 3), P1, "31003");
    const [card] = given.ids as [InstanceId];
    const other = payWith(given.state, P1, 3, [card]); // Sync Ratio covers 1 of her printed cost of 4.
    const settled = settle(
      runWave5(given.state, play(P1, card, other, { abilities: [syncUse(given.state, spdrUpgrade)] })),
      accepting("31003.ven-m-response"),
      undefined,
      WAVE5_DEPS,
    );
    expect(inst(settled, spdrUpgrade).exhausted).toBe(true); // Sync Ratio's own cost.
    expect(inst(settled, card).counters.sym).toBe(1);
  });

  it("31003.ven-m-response: paid entirely from hand (no Sync Ratio in the payment), places no sym counter", () => {
    const hero = toHero_(spdrVsRhino(3));
    const given = moveToHand(topUp(hero, 4), P1, "31003");
    const [card] = given.ids as [InstanceId];
    const settled = settle(
      runWave5(given.state, play(P1, card, payWith(given.state, P1, 4, [card]))),
      accepting("31003.ven-m-response"),
      undefined,
      WAVE5_DEPS,
    );
    expect(inst(settled, card).counters.sym ?? 0).toBe(0);
  });
});

function toHero_(state: GameState): GameState {
  return runWave5(state, toHero(P1));
}

describe("Daredevil (ally, 31014)", () => {
  it("31014.daredevil-response: after he defends, moves exactly 1 damage from him to the attacking enemy (capped, not all of it)", () => {
    const hero = toHero_(spdrVsRhino(1));
    const { state: withDaredevil, id: daredevil } = playFromHand(topUp(hero, 4), "31014", 2, accepting());
    // Advance (01186, boost 0) keeps the villain's own boost draw from adding a variable, so Daredevil takes
    // exactly Rhino's printed ATK 2 (well within his 3 hit points), leaving more than 1 damage there to move so
    // the assertion can tell "move 1" from "move all of it".
    const stacked = stackEncounterDeck(withDaredevil, "01186");
    const villain = stacked.villains[0]!.instanceId;
    const villainDamageBefore = inst(stacked, villain).damage;
    const atDefend = settle(
      runWave5(stacked, endTurn(P1)),
      firstLegal,
      (s) => s.pendingChoice?.prompt.kind === "declareDefender",
      WAVE5_DEPS,
    );
    const defending = answer(atDefend, [daredevil], WAVE5_DEPS);
    // The attack itself (Rhino's ATK 2 plus the 0-boost draw) has already resolved by the time the deferred
    // "defended" Response is offered — read Daredevil's own damage right here, per the Groot/rocket-kit precedent.
    const damageAfterAttack = inst(defending, daredevil).damage;
    const settled = settle(defending, accepting("31014.daredevil-response"), undefined, WAVE5_DEPS);
    expect(inst(settled, daredevil).damage).toBe(damageAfterAttack - 1); // exactly 1 moved, not all of it.
    expect(inst(settled, villain).damage).toBe(villainDamageBefore + 1); // only the moved 1: Rhino's own attack
    // damage went to Daredevil (the defender), not to itself.
  });

  it("31014.daredevil-response: a different character defending (not Daredevil) does not trigger his move", () => {
    const hero = toHero_(spdrVsRhino(2));
    const { state: withDaredevil, id: daredevil } = playFromHand(topUp(hero, 4), "31014", 2, accepting());
    const identity = identityOf(withDaredevil, P1);
    const stacked = stackEncounterDeck(withDaredevil, "01186");
    const villain = stacked.villains[0]!.instanceId;
    const villainDamageBefore = inst(stacked, villain).damage;
    const daredevilDamageBefore = inst(stacked, daredevil).damage;
    const atDefend = settle(
      runWave5(stacked, endTurn(P1)),
      firstLegal,
      (s) => s.pendingChoice?.prompt.kind === "declareDefender",
      WAVE5_DEPS,
    );
    // The identity defends instead of Daredevil.
    const defending = answer(atDefend, [identity], WAVE5_DEPS);
    const settled = settle(defending, firstLegal, undefined, WAVE5_DEPS);
    expect(inst(settled, daredevil).damage).toBe(daredevilDamageBefore); // untouched: he never defended.
    expect(inst(settled, villain).damage).toBe(villainDamageBefore); // no move fired, so no +1 either.
  });
});

/** Attaches `cardId` to `hostId`, facedown as a blank card — `attachCard(..., { facedown: true })`'s own resulting
 * shape (`packages/engine/src/state.ts` `CardInstance.attachedTo`/`.attachments`/`.facedownAs`), built directly
 * so the constant can be read without a reveal (the Response's own tests below attach through the engine). */
function attachFacedown(state: GameState, cardId: InstanceId, hostId: InstanceId): GameState {
  const withCard = patchInstance(state, cardId, {
    attachedTo: hostId,
    facedownAs: { kind: "blank", traits: [] },
  });
  const host = inst(withCard, hostId);
  return patchInstance(withCard, hostId, { attachments: [...host.attachments, cardId] });
}

describe("Spider-Man Noir (ally, 31015)", () => {
  it("31015.spider-man-noir-constant: X (ATK and THW) is the number of facedown cards attached to him", () => {
    const { state, id } = playFromHand(topUp(spdrVsRhino(1), 2), "31015", 3, accepting());
    const given = moveToHand(state, P1, "31023", "31024");
    const [facedownCandidate, faceupCandidate] = given.ids as [InstanceId, InstanceId];
    expect(characterProfile(given.state, id).atk).toBe(0);
    expect(characterProfile(given.state, id).thw).toBe(0);
    const oneFacedown = attachFacedown(given.state, facedownCandidate, id);
    expect(characterProfile(oneFacedown, id).atk).toBe(1);
    expect(characterProfile(oneFacedown, id).thw).toBe(1);
    // A second, faceup attachment (not facedown) does not add to X.
    const withFaceup = patchInstance(patchInstance(oneFacedown, faceupCandidate, { attachedTo: id }), id, {
      attachments: [...inst(oneFacedown, id).attachments, faceupCandidate],
    });
    expect(characterProfile(withFaceup, id).atk).toBe(1);
    expect(characterProfile(withFaceup, id).thw).toBe(1);
    // A second facedown attachment does — flip the already-attached faceup card over rather than attaching a
    // third instance, so `id`'s own `attachments` list gains no duplicate entry.
    const twoFacedown = patchInstance(withFaceup, faceupCandidate, { facedownAs: { kind: "blank", traits: [] } });
    expect(characterProfile(twoFacedown, id).atk).toBe(2);
    expect(characterProfile(twoFacedown, id).thw).toBe(2);
  });

  // Rhino's own "I'm Tough!" (01105, 0 boost): "When Revealed: Give Rhino a tough status card. If Rhino already has a
  // tough status card, this card gains surge." Rhino starts without one, so it resolves with no surge. Advance
  // (01186, 0 boost, no Boost ability) soaks up the boost card Rhino's own activation draws first.
  const IM_TOUGH = "01105";
  const ADVANCE = "01186";
  const NOIR_RESPONSE = "31015.spider-man-noir-response";

  /** Noir in play under P1, with "I'm Tough!" stacked to be the card P1 reveals in the next villain phase. */
  function noirFacing(state: GameState) {
    const { state: withNoir, id: noir } = playFromHand(topUp(state, 2), "31015", 3, accepting());
    const stacked = stackEncounterDeck(withNoir, ADVANCE, IM_TOUGH);
    return { state: stacked, noir, card: activeEncounterDeck(stacked).deck[1]! };
  }
  const encounterDiscard = (state: GameState) => activeEncounterDeck(state).discard;

  it(`${NOIR_RESPONSE}: after you resolve a treachery, attaches it facedown to him, so his ATK and THW go up by 1`, () => {
    const { state, noir, card } = noirFacing(toHero_(spdrVsRhino(1)));
    expect(characterProfile(state, noir).atk).toBe(0);
    const { state: after, events } = driveEventsPicking(WAVE5_DEPS, state, accepting(NOIR_RESPONSE), endTurn(P1));
    // The treachery resolved first (Rhino got his tough status card) and was then taken out of the discard pile.
    expect(events).toContainEqual(
      expect.objectContaining({
        type: "triggerEvent",
        event: expect.objectContaining({ kind: "encounterCardResolved", instanceId: card }),
      }),
    );
    expect(inst(after, after.villains[0]!.instanceId).statuses.tough).toBeTruthy();
    expect(inst(after, card).attachedTo).toBe(noir);
    expect(inst(after, card).facedownAs).toEqual({ kind: "blank", traits: [] });
    expect(encounterDiscard(after)).not.toContain(card);
    expect(characterProfile(after, noir).atk).toBe(1);
    expect(characterProfile(after, noir).thw).toBe(1);
  });

  it(`${NOIR_RESPONSE}: declined, the treachery stays in the encounter discard pile`, () => {
    const { state, noir, card } = noirFacing(toHero_(spdrVsRhino(1)));
    const after = settle(runWave5(state, endTurn(P1)), firstLegal, undefined, WAVE5_DEPS);
    expect(encounterDiscard(after)).toContain(card);
    expect(inst(after, noir).attachments).toEqual([]);
    expect(characterProfile(after, noir).atk).toBe(0);
  });

  it(`${NOIR_RESPONSE}: without another Web-Warrior card (alter-ego Peni Parker), nothing is attached`, () => {
    const { state, noir, card } = noirFacing(spdrVsRhino(1));
    const after = settle(runWave5(state, endTurn(P1)), accepting(NOIR_RESPONSE), undefined, WAVE5_DEPS);
    expect(encounterDiscard(after)).toContain(card);
    expect(inst(after, noir).attachments).toEqual([]);
  });

  it(`${NOIR_RESPONSE}: to a maximum of 3 — with 3 facedown cards already attached, nothing more is attached`, () => {
    const { state, noir, card } = noirFacing(toHero_(spdrVsRhino(1)));
    const given = moveToHand(state, P1, "31023", "31023", "31024");
    const full = (given.ids as InstanceId[]).reduce((s, id) => attachFacedown(s, id, noir), given.state);
    expect(characterProfile(full, noir).atk).toBe(3);
    const after = settle(runWave5(full, endTurn(P1)), accepting(NOIR_RESPONSE), undefined, WAVE5_DEPS);
    expect(encounterDiscard(after)).toContain(card);
    expect(inst(after, noir).attachments).toHaveLength(3);
    expect(characterProfile(after, noir).atk).toBe(3);
  });

  it(`${NOIR_RESPONSE}: a treachery whose When Revealed was cancelled (Spider-Tingle, 31020) did not resolve, so it can't be attached (FAQ "Spider-Man Noir (#15)", RRG 1.8 p. 63)`, () => {
    const { state: withNoir, noir, card } = noirFacing(toHero_(spdrVsRhino(1)));
    const { state } = playFromHand(topUp(withNoir, 1), "31020", 1, accepting());
    const { state: after, events } = driveEventsPicking(
      WAVE5_DEPS,
      state,
      // Spider-Tingle's cost: 1 damage to a Web-Warrior character you control — SP//dr (the first option) pays it.
      (st) =>
        st.pendingChoice?.prompt.kind === "chooseCostCards"
          ? [st.pendingChoice.options[0]!.optionId]
          : accepting("31020.spider-tingle-interrupt", NOIR_RESPONSE)(st),
      endTurn(P1),
    );
    expect(events).toContainEqual(expect.objectContaining({ type: "revealCancelled", instanceId: card }));
    expect(events.some((e) => e.type === "triggerEvent" && e.event.kind === "encounterCardResolved")).toBe(false);
    expect(inst(after, after.villains[0]!.instanceId).statuses.tough).toBeFalsy(); // its When Revealed never happened.
    expect(encounterDiscard(after)).toContain(card);
    expect(inst(after, noir).attachments).toEqual([]);
  });

  it(`${NOIR_RESPONSE}: a non-treachery encounter card (a minion) is not "a treachery"`, () => {
    const { state: withNoir, id: noir } = playFromHand(topUp(toHero_(spdrVsRhino(1)), 2), "31015", 3, accepting());
    const stacked = stackEncounterDeck(withNoir, ADVANCE, "01101"); // Hydra Mercenary, Rhino's own minion.
    const { state: after, events } = driveEventsPicking(WAVE5_DEPS, stacked, accepting(NOIR_RESPONSE), endTurn(P1));
    expect(events.some((e) => e.type === "triggerEvent" && e.event.kind === "encounterCardResolved")).toBe(false);
    expect(inst(after, noir).attachments).toEqual([]);
  });

  it(`${NOIR_RESPONSE}: a treachery another player resolved does not trigger it ("after *you* resolve")`, () => {
    const two = startWave5Game(
      spdrScenario("rhino", { seed: 1, extraPlayers: [{ starterDeckId: "core-spider-man-justice" }] }),
    );
    const { state: withNoir, id: noir } = playFromHand(topUp(toHero_(two), 2), "31015", 3, accepting());
    // Boost cards for Rhino's two activations, then P1's dealt card (a minion), then P2's ("I'm Tough!").
    const stacked = stackEncounterDeck(withNoir, ADVANCE, ADVANCE, "01101", IM_TOUGH);
    const card = activeEncounterDeck(stacked).deck[3]!;
    const { state: after, events } = driveEventsPicking(
      WAVE5_DEPS,
      stacked,
      accepting(NOIR_RESPONSE),
      endTurn(P1),
      endTurn(P2),
    );
    const revealedBy = events.find(
      (e): e is Extract<typeof e, { type: "encounterCardRevealed" }> =>
        e.type === "encounterCardRevealed" && e.instanceId === card,
    );
    expect(revealedBy?.playerId).toBe(P2);
    expect(encounterDiscard(after)).toContain(card);
    expect(inst(after, noir).attachments).toEqual([]);
  });
});

describe("Spider-Ham (ally, 31021)", () => {
  it("31021.spider-ham-constant: cannot be played without controlling a Web-Warrior card (alter-ego: Peni Parker)", () => {
    const hero = spdrVsRhino(1);
    const given = moveToHand(hero, P1, "31021");
    const [card] = given.ids as [InstanceId];
    const result = applyCommand(given.state, play(P1, card, payWith(given.state, P1, 3, [card])), WAVE5_DEPS);
    expect(result.ok).toBe(false);
  });

  it("31021.spider-ham-constant: can be played while controlling a Web-Warrior card (the identity, in hero form)", () => {
    const hero = toHero_(spdrVsRhino(1));
    const { state, id } = playFromHand(topUp(hero, 3), "31021", 3, accepting());
    expect(cardsInPlay(state)).toContain(id);
  });

  it("31021.spider-ham-forced-response: after he attacks, discards the top encounter card and deals damage to himself equal to its boost icons", () => {
    const hero = toHero_(spdrVsRhino(2));
    const { state: withHam, id: ham } = playFromHand(topUp(hero, 3), "31021", 3, accepting());
    const villain = withHam.villains[0]!.instanceId;
    const villainDamageBefore = inst(withHam, villain).damage;
    const stacked = stackEncounterDeck(withHam, "01100"); // boostIcons: 2 (Ghost-Spider Hobie precedent's own card).
    const attacked = settle(
      runWave5(stacked, { type: "basicAttack", playerId: P1, attackerInstanceId: ham, targetInstanceId: villain }),
      firstLegal,
      undefined,
      WAVE5_DEPS,
    );
    expect(inst(attacked, villain).damage).toBe(villainDamageBefore + 2); // Spider-Ham's own printed ATK 2.
    expect(inst(attacked, ham).damage).toBe(2); // 2 boost icons on the one discarded card.
  });
});

describe("Spider-Man / Otto Octavius (ally, 31022)", () => {
  it("31022.spider-man-constant: cannot be played without controlling a Web-Warrior card (alter-ego: Peni Parker)", () => {
    const hero = spdrVsRhino(1);
    const given = moveToHand(hero, P1, "31022");
    const [card] = given.ids as [InstanceId];
    const result = applyCommand(given.state, play(P1, card, payWith(given.state, P1, 2, [card])), WAVE5_DEPS);
    expect(result.ok).toBe(false);
  });

  it("31022.spider-man-response: readies a chosen Tech upgrade and draws 1 card", () => {
    const hero = toHero_(spdrVsRhino(3));
    const { state: withBarrier, id: barrier } = playFromHand(topUp(hero, 3), "31018", 2, accepting()); // Energy Barrier: TECH.
    const exhaustedBarrier = patchInstance(withBarrier, barrier, { exhausted: true });
    const given = moveToHand(topUp(exhaustedBarrier, 2), P1, "31022");
    const [card] = given.ids as [InstanceId];
    const handBefore = playerOf(given.state, P1).hand.length;
    const settled = settle(
      runWave5(given.state, play(P1, card, payWith(given.state, P1, 2, [card]))),
      accepting("31022.spider-man-response", barrier),
      undefined,
      WAVE5_DEPS,
    );
    expect(inst(settled, barrier).exhausted).toBe(false);
    expect(playerOf(settled, P1).hand.length).toBe(handBefore - 1 - 2 + 1); // -1 played, -2 payment, +1 draw.
  });

  it("31022.spider-man-response: readies a chosen non-Tech upgrade, but draws no card", () => {
    const hero = toHero_(spdrVsRhino(4));
    const { state: withUnshakable, id: unshakable } = playFromHand(topUp(hero, 3), "31024", 1, accepting()); // Unshakable: no Tech trait.
    const exhausted = patchInstance(withUnshakable, unshakable, { exhausted: true });
    const given = moveToHand(topUp(exhausted, 2), P1, "31022");
    const [card] = given.ids as [InstanceId];
    const handBefore = playerOf(given.state, P1).hand.length;
    const settled = settle(
      runWave5(given.state, play(P1, card, payWith(given.state, P1, 2, [card]))),
      accepting("31022.spider-man-response", unshakable),
      undefined,
      WAVE5_DEPS,
    );
    expect(inst(settled, unshakable).exhausted).toBe(false);
    expect(playerOf(settled, P1).hand.length).toBe(handBefore - 1 - 2); // -1 played, -2 payment, no draw.
  });
});
