import { cardId } from "@mc/content";
import { cardOf, hasKeyword, printedResources, type GameState, type InstanceId, type PlayerId } from "@mc/engine";
import type { GameEvent } from "@mc/engine";
import { describe, expect, it } from "vitest";
import {
  applyOk,
  P1,
  P2,
  firstLegal,
  identityOf,
  instancesOf,
  mainThreat,
  patchInstance,
  playerOf,
  settle,
  use,
} from "../../testing/harness.js";
import { defeatWithAttack, encounterCardInVillainArea, withForm } from "../../testing/staging.js";
import { runWave4, startWave4Game, WAVE4_DEPS } from "../testing.js";
import { hoodScenario } from "./support.js";

/**
 * Real-game tests for The Hood's own scripted refs (`hood.ts`): the villain (24001-24003), the main scheme
 * (24004-24006) and The Hood's own encounter set (24007-24013). Every test seats Core's Spider-Man precon at the
 * "the-hood" scenario (`hoodScenario`, `wave4Scenario`'s own `buildHoodSingleVillain`).
 *
 * Ref -> covering test:
 *  24001.the-hood-constant            -> "stage 1 discards the top card ..." / "... Hood-set card at the top ..."
 *  24002.the-hood-constant            -> "stage 2 deals only the first ..."
 *  24002.when-revealed                -> "defeating The Hood (I) shuffles ... (standard mode: I -> II)"
 *  24003.the-hood-constant            -> "stage 3 deals every ..."
 *  24003.when-revealed                -> "defeating The Hood (II) shuffles ... (expert mode: II -> III)"
 *  24004a.setup                       -> "Making Connections' Setup shuffles ..."
 *  24004b.when-revealed               -> "Making Connections' own When Revealed resolves Foul Play ..."
 *  24005a.when-revealed               -> "completing Making Connections flips to Promised Prosperity ..."
 *  24005b.when-revealed               -> "completing Making Connections flips to Promised Prosperity ..."
 *  24006a.when-revealed               -> "completing Promised Prosperity flips to Crime State ..."
 *  24006b.crime-state-forced-response -> "completing Promised Prosperity flips to Crime State ..."
 *  24007.established-dominance-forced-response -> "Established Dominance resolves Foul Play ..."
 *  24007.established-dominance-action -> "Established Dominance's Alter-Ego Action ..."
 *  24008.the-hoods-mantle-constant    -> "The Hood's Mantle grants retaliate 1 and steady"
 *  24008.the-hoods-mantle-action      -> "The Hood's Mantle's Hero Action discards it"
 *  24009.the-hoods-pistol-action      -> "The Hood's Pistol's Hero Action discards it"
 *  24009.boost                       -> "The Hood's Pistol's Boost reveals it"
 *  24010.when-revealed                -> "Madame Masque's When Revealed resolves Foul Play"
 *  24010.when-defeated                -> (the four villain-stage Foul Play tests, via defeating Madame Masque)
 *  24011.unbridled-ambition-forced-interrupt -> "each player resolves Foul Play when the villain phase begins"
 *  24012.when-revealed                -> "shuffles a set-aside set in and resolves Foul Play"
 *  24012.boost                       -> "after this activation ends, resolve Foul Play"
 *  24013.when-revealed-alter-ego      -> "Upper Hand in alter-ego form"
 *  24013.when-revealed-hero           -> "Upper Hand in hero form"
 */

const game = (seed = 1, players: readonly PlayerId[] = [P1]) =>
  startWave4Game(
    hoodScenario("the-hood", {
      seed,
      extraPlayers: players.slice(1).map(() => ({ starterDeckId: "core-black-panther-protection" })),
    }),
  );

const villainId = (state: GameState): InstanceId => state.villains[0]!.instanceId;
const deckId = (state: GameState): string => Object.keys(state.encounterDecks)[0]!;
const dealt = (state: GameState, player: PlayerId = P1): readonly InstanceId[] =>
  playerOf(state, player).dealtEncounter;

/** Places `code` engaged with `player`, faceup, as a minion in `player`'s own `playArea` — a minion's real zone
 * once revealed (`resolve/reveal.ts`'s own `case "minion"`), unlike a side scheme or the villain, which share the
 * shared `villainArea` (`encounterCardInVillainArea` is for those, not for minions). */
function minionEngagedWith(
  state: GameState,
  code: string,
  player: PlayerId = P1,
): { readonly state: GameState; readonly id: InstanceId } {
  const deck = deckId(state);
  const pile = state.encounterDecks[deck]!;
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
        [deck]: { deck: pile.deck.filter((i) => i !== id), discard: pile.discard.filter((i) => i !== id) },
      },
      players: state.players.map((p) => (p.playerId === player ? { ...p, playArea: [...p.playArea, id] } : p)),
      instances: {
        ...state.instances,
        [id]: { ...state.instances[id]!, faceup: true, controllerId: null, engagedWith: player },
      },
    },
  };
}

/** Attaches `code` (pulled fresh out of the encounter deck) to `hostId`, faceup and uncontrolled — the same "set
 * `attachedTo`/`attachments` directly" surgery `../mts/ebony-maw.test.ts` uses to attach Abjuration to Ebony Maw. */
function attachedTo(
  state: GameState,
  code: string,
  hostId: InstanceId,
): { readonly state: GameState; readonly id: InstanceId } {
  const staged = encounterCardInVillainArea(state, code);
  return {
    id: staged.id,
    state: {
      ...staged.state,
      villainArea: staged.state.villainArea.filter((id) => id !== staged.id),
      instances: {
        ...staged.state.instances,
        [staged.id]: { ...staged.state.instances[staged.id]!, attachedTo: hostId, controllerId: null },
        [hostId]: {
          ...staged.state.instances[hostId]!,
          attachments: [...staged.state.instances[hostId]!.attachments, staged.id],
        },
      },
    },
  };
}

/** Forces the villain onto a specific stage (0 = The Hood I, 1 = II, 2 = III) — which Foul Play version is active
 * is entirely determined by this index (`hood.ts`'s docblock), so patching it directly is a faithful, deterministic
 * way to exercise each stage's own Foul Play without a real multi-attack defeat sequence in every test. */
function onStage(state: GameState, stageIndex: number): GameState {
  return { ...state, villains: state.villains.map((v) => ({ ...v, stageIndex })) };
}

/** Puts `player` into hero form (`withForm`'s own shape), so a basic attack (defeating a minion/villain in tests
 * below) is legal — the game otherwise starts in alter-ego form. */
function heroified(state: GameState, player: PlayerId = P1): GameState {
  return withForm(state, { heroForm: 0 }, player);
}

/** `n` hand cards that can pay `type` (their own printed type, or wild) — `wave3/gmw/galactic-artifacts.test.ts`'s
 * own `paymentFor` helper, re-derived here since it is local to that file. */
function paymentFor(
  state: GameState,
  playerId: PlayerId,
  type: "physical" | "mental" | "energy",
  n: number,
  excluding: readonly InstanceId[] = [],
): readonly { readonly fromHand: InstanceId }[] {
  const player = playerOf(state, playerId);
  const usable = player.hand.filter((id) => {
    if (excluding.includes(id)) return false;
    const c = cardOf(state, id);
    if (!c) return false;
    const pool = printedResources(c);
    return pool[type] > 0 || pool.wild > 0;
  });
  if (usable.length < n) throw new Error(`not enough ${type}-payable cards for ${playerId}`);
  return usable.slice(0, n).map((fromHand) => ({ fromHand }));
}

/** Stacks the encounter deck's very top with `codes` (`codes[0]` ends up on top). */
function stackTop(state: GameState, ...codes: readonly string[]): GameState {
  const id = deckId(state);
  const pile = state.encounterDecks[id]!;
  const used = new Set<InstanceId>();
  const picked = codes.map((code) => {
    const wanted = cardId(code);
    const found = pile.deck.find((i) => state.instances[i]?.cardId === wanted && !used.has(i));
    if (!found) throw new Error(`no ${code} left in the encounter deck`);
    used.add(found);
    return found;
  });
  const rest = pile.deck.filter((i) => !used.has(i));
  return { ...state, encounterDecks: { ...state.encounterDecks, [id]: { ...pile, deck: [...picked, ...rest] } } };
}

describe("The Hood (villain, main scheme and The Hood's own encounter set)", () => {
  it("stage 1 (24001.the-hood-constant, via 24010.when-defeated): discards the top card; a non-Hood card is dealt to the defeating player", () => {
    const base = onStage(game(), 0);
    const staged = minionEngagedWith(stackTop(base, "01186"), "24010", P1); // 01186 (Advance, Standard) is not in `the_hood`.
    const advanceId = instancesOf(staged.state, "01186")[0]!;
    const defeated = defeatWithAttack(WAVE4_DEPS, heroified(staged.state), staged.id, P1);
    expect(dealt(defeated, P1)).toContain(advanceId);
    expect(defeated.encounterDecks[deckId(defeated)]!.discard).not.toContain(advanceId);
  });

  it("stage 1 (24001.the-hood-constant): a Hood-set card at the top is discarded but not dealt", () => {
    const base = onStage(game(), 0);
    const staged = minionEngagedWith(stackTop(base, "24007"), "24010", P1); // 24007 belongs to `the_hood`.
    const dominanceId = instancesOf(staged.state, "24007")[0]!;
    const defeated = defeatWithAttack(WAVE4_DEPS, heroified(staged.state), staged.id, P1);
    expect(dealt(defeated, P1)).not.toContain(dominanceId);
    expect(defeated.encounterDecks[deckId(defeated)]!.discard).toContain(dominanceId);
  });

  it("stage 2 (24002.the-hood-constant): deals only the first of two discarded cards that is not a Hood card", () => {
    const base = onStage(game(), 1);
    const stacked = stackTop(base, "01186", "01187");
    const topDeck = stacked.encounterDecks[deckId(stacked)]!.deck;
    const [first, second] = [topDeck[0]!, topDeck[1]!];
    const staged = minionEngagedWith(stacked, "24010", P1);
    const defeated = defeatWithAttack(WAVE4_DEPS, heroified(staged.state), staged.id, P1);
    expect(dealt(defeated, P1)).toEqual([first]);
    expect(dealt(defeated, P1)).not.toContain(second);
  });

  it("stage 3 (24003.the-hood-constant): deals every one of two discarded cards that is not a Hood card", () => {
    const base = onStage(game(), 2);
    const stacked = stackTop(base, "01186", "01187");
    const topDeck = stacked.encounterDecks[deckId(stacked)]!.deck;
    const [first, second] = [topDeck[0]!, topDeck[1]!];
    const staged = minionEngagedWith(stacked, "24010", P1);
    const defeated = defeatWithAttack(WAVE4_DEPS, heroified(staged.state), staged.id, P1);
    expect(dealt(defeated, P1)).toEqual([first, second]);
  });

  it("24010.when-revealed: Madame Masque resolves Foul Play as soon as she is revealed", () => {
    const base = onStage(game(), 0);
    const staged = stackTop(base, "01186", "24010");
    const revealed = settle(runWave4(staged, { type: "endTurn", playerId: P1 }), firstLegal, undefined, WAVE4_DEPS);
    const totalGone = revealed.encounterDecks[deckId(revealed)]!.discard.length + dealt(revealed, P1).length;
    // The filler (01186, the villain's own boost draw) plus Foul Play's own discard: at least two cards gone.
    expect(totalGone).toBeGreaterThanOrEqual(2);
    expect(instancesOf(revealed, "24010").some((id) => revealed.instances[id]?.engagedWith === P1)).toBe(true);
  });

  it("24011.unbridled-ambition-forced-interrupt: each player resolves Foul Play when the villain phase begins", () => {
    const base = onStage(game(1, [P1, P2]), 0);
    const staged = encounterCardInVillainArea(base, "24011");
    const before = { p1: dealt(staged.state, P1).length, p2: dealt(staged.state, P2).length };
    const afterVillainPhase = settle(
      runWave4(staged.state, { type: "endTurn", playerId: P1 }, { type: "endTurn", playerId: P2 }),
      firstLegal,
      undefined,
      WAVE4_DEPS,
    );
    const p1Gained = dealt(afterVillainPhase, P1).length - before.p1;
    const p2Gained = dealt(afterVillainPhase, P2).length - before.p2;
    const discardGrowth = afterVillainPhase.encounterDecks[deckId(afterVillainPhase)]!.discard.length;
    // Every player's own stage-1 Foul Play discards exactly one card (dealt or not) — two players, two discards.
    expect(p1Gained + p2Gained + discardGrowth).toBeGreaterThanOrEqual(2);
  });

  it("24004a.setup: Making Connections' Setup shuffles one set-aside modular set into the encounter deck at game start", () => {
    const state = game();
    expect(state.setAsideModularSets).toHaveLength(6); // 7 chosen at setup, minus the 1 stage-1 Setup shuffles in.
  });

  it("24002.when-revealed: defeating The Hood (I) shuffles another set-aside modular set in (standard mode: I -> II)", () => {
    const stage1 = game();
    expect(stage1.setAsideModularSets).toHaveLength(6);
    const stage2 = defeatWithAttack(WAVE4_DEPS, heroified(stage1), villainId(stage1), P1);
    expect(stage2.setAsideModularSets).toHaveLength(5); // 24002.when-revealed shuffled another in.
  });

  it("24003.when-revealed: defeating The Hood (II) shuffles another set-aside modular set in (expert mode: II -> III)", () => {
    // Standard mode only ever plays The Hood I/II (`villainStages.standard: [1, 2]`) — Hood III is expert-only
    // (`villainStages.expert: [2, 3]`), so this ref needs an expert game to reach at all.
    const stage2 = startWave4Game(hoodScenario("the-hood", { seed: 1, difficulty: "expert", extraPlayers: [] }));
    const before = stage2.setAsideModularSets!.length;
    const stage3 = defeatWithAttack(WAVE4_DEPS, heroified(stage2), villainId(stage2), P1);
    expect(stage3.setAsideModularSets).toHaveLength(before - 1); // 24003.when-revealed shuffled another in.
  });

  it("24004b.when-revealed: Making Connections' own When Revealed resolves Foul Play for the player at setup", () => {
    const state = game();
    // Stage 1's own Foul Play discards exactly one card at setup, dealt or not.
    expect(state.encounterDecks[deckId(state)]!.discard.length + dealt(state, P1).length).toBeGreaterThanOrEqual(1);
  });

  it("24005a.when-revealed / 24005b.when-revealed: completing Making Connections flips to Promised Prosperity, shuffling another set-aside set in and resolving Foul Play for the player", () => {
    const base = onStage(game(), 0);
    const before = base.setAsideModularSets!.length;
    const dealtBefore = dealt(base, P1).length + base.encounterDecks[deckId(base)]!.discard.length;
    const overThreshold = patchInstance(base, base.mainScheme.instanceId, { threat: 999 });
    const advanced = settle(
      runWave4(overThreshold, { type: "endTurn", playerId: P1 }),
      firstLegal,
      undefined,
      WAVE4_DEPS,
    );
    expect(advanced.mainScheme.stageIndex).toBe(1); // Promised Prosperity
    expect(advanced.setAsideModularSets!.length).toBe(before - 1); // 24005a.when-revealed's own shuffle-in.
    const dealtAfter = dealt(advanced, P1).length + advanced.encounterDecks[deckId(advanced)]!.discard.length;
    expect(dealtAfter).toBeGreaterThan(dealtBefore); // 24005b.when-revealed's own Foul Play.
  });

  it("24005b.when-revealed: with two players, each resolves Foul Play as themself (the per-player 'you')", () => {
    const base = onStage(game(3, [P1, P2]), 0);
    const def = WAVE4_DEPS.abilities["24005b.when-revealed"]!;
    const json = JSON.stringify(def.effects);
    // The shape whose exact threat counts (2 per player dealt nothing) are proven in
    // packages/engine/src/per-player-snapshot.test.ts.
    expect(json).toContain('"kind":"setVar","name":"dealtBefore"');
    expect(json).toContain('"kind":"resolveSpecials","of":{"kind":"villain"},"player":{"kind":"scoped"}');
    expect(json).toContain('"kind":"placeThreat"');
    const overThreshold = patchInstance(base, base.mainScheme.instanceId, { threat: 999 });
    // Two players: both turns end before the villain phase, whose step one completes Making Connections.
    let state = settle(runWave4(overThreshold, { type: "endTurn", playerId: P1 }), firstLegal, undefined, WAVE4_DEPS);
    const result = applyOk(state, { type: "endTurn", playerId: P2 }, WAVE4_DEPS);
    state = result.state;
    const events: GameEvent[] = [...result.events];
    while (state.pendingChoice && !state.outcome) {
      const choice = state.pendingChoice;
      const next = applyOk(
        state,
        {
          type: "resolveChoice",
          playerId: choice.playerId,
          choiceId: choice.choiceId,
          selectedOptionIds: firstLegal(state),
        },
        WAVE4_DEPS,
      );
      state = next.state;
      events.push(...next.events);
    }
    // Between Promised Prosperity's arrival and the next step change: each player's own Foul Play.
    const start = events.findIndex((e) => e.type === "mainSchemeAdvanced");
    expect(start).toBeGreaterThanOrEqual(0);
    const end = events.findIndex((e, k) => k > start && e.type === "stepChanged");
    const window = events.slice(start, end < 0 ? undefined : end);
    const discards = window.filter(
      (e) => e.type === "cardMoved" && (e.to as { kind: string }).kind === "encounterDiscard",
    ).length;
    const dealtTo = (player: PlayerId) =>
      window.filter(
        (e) =>
          e.type === "cardMoved" &&
          (e.to as { kind: string; playerId?: string }).kind === "dealtEncounter" &&
          (e.to as { playerId?: string }).playerId === player,
      ).length;
    // Each player's Foul Play discarded its own card (dealt cards leave the discard again), and neither player's
    // pass dealt to the other: P2 got at most its own one card.
    expect(discards).toBeGreaterThanOrEqual(2);
    expect(dealtTo(P1)).toBeLessThanOrEqual(1);
    expect(dealtTo(P2)).toBeLessThanOrEqual(1);
  });

  it("24006a.when-revealed / 24006b.crime-state-forced-response: completing Promised Prosperity flips to Crime State, and step one of the next villain phase resolves Foul Play again", () => {
    // Force Promised Prosperity (main scheme stage index 1) directly active, the same "patch the index" shortcut
    // `onStage` uses for the villain, then advance it by threat exactly like the 24005 test does for stage 1.
    const base = game();
    const withStage2 = { ...base, mainScheme: { ...base.mainScheme, stageIndex: 1 } };
    const before = withStage2.setAsideModularSets!.length;
    const overThreshold = patchInstance(withStage2, withStage2.mainScheme.instanceId, { threat: 999 });
    const advanced = settle(
      runWave4(overThreshold, { type: "endTurn", playerId: P1 }),
      firstLegal,
      undefined,
      WAVE4_DEPS,
    );
    expect(advanced.mainScheme.stageIndex).toBe(2); // Crime State
    expect(advanced.setAsideModularSets!.length).toBe(before - 1); // 24006a.when-revealed's own shuffle-in.
    // Crime State's own Forced Response fires after step one of the *next* villain phase — advance one more round.
    const dealtBefore = dealt(advanced, P1).length + advanced.encounterDecks[deckId(advanced)]!.discard.length;
    const readied = patchInstance(advanced, identityOf(advanced, P1), { exhausted: false });
    const nextPhase = settle(runWave4(readied, { type: "endTurn", playerId: P1 }), firstLegal, undefined, WAVE4_DEPS);
    const dealtAfter = dealt(nextPhase, P1).length + nextPhase.encounterDecks[deckId(nextPhase)]!.discard.length;
    expect(dealtAfter).toBeGreaterThan(dealtBefore); // 24006b.crime-state-forced-response's own Foul Play.
  });

  it("24007.established-dominance-forced-response: after The Hood attacks you, resolve Foul Play", () => {
    const base = heroified(onStage(game(), 0), P1); // in hero form, the villain's own activation is an attack.
    const staged = attachedTo(base, "24007", identityOf(base, P1));
    const before = dealt(staged.state, P1).length + staged.state.encounterDecks[deckId(staged.state)]!.discard.length;
    const attacked = settle(
      runWave4(staged.state, { type: "endTurn", playerId: P1 }),
      firstLegal,
      undefined,
      WAVE4_DEPS,
    );
    // The villain's own attack (a boost draw) plus Established Dominance's own Foul Play (another discard): at
    // least two more cards gone than before the villain phase.
    const after = dealt(attacked, P1).length + attacked.encounterDecks[deckId(attacked)]!.discard.length;
    expect(after).toBeGreaterThan(before + 1);
  });

  it("24007.established-dominance-action: exhausts your identity, places 2 threat on the main scheme, and discards this card", () => {
    const base = onStage(game(), 0);
    const staged = attachedTo(base, "24007", identityOf(base, P1));
    const before = mainThreat(staged.state);
    const acted = runWave4(staged.state, use(P1, staged.id, "24007.established-dominance-action"));
    expect(mainThreat(acted)).toBe(before + 2);
    expect(acted.encounterDecks[deckId(acted)]!.discard).toContain(staged.id);
    expect(acted.instances[identityOf(acted, P1)]!.exhausted).toBe(true);
  });

  it("24008.the-hoods-mantle-constant: The Hood gains retaliate 1 and steady", () => {
    const base = game();
    const staged = attachedTo(base, "24008", villainId(base));
    expect(hasKeyword(staged.state, villainId(staged.state), "steady", WAVE4_DEPS)).toBe(true);
    expect(hasKeyword(staged.state, villainId(staged.state), "retaliate", WAVE4_DEPS)).toBe(true);
  });

  it("24008.the-hoods-mantle-action: Hero Action discards it", () => {
    const base = heroified(game(), P1);
    const staged = attachedTo(base, "24008", villainId(base));
    const energy = paymentFor(staged.state, P1, "energy", 1)[0]!;
    const mental = paymentFor(staged.state, P1, "mental", 1, [energy.fromHand])[0]!;
    const physical = paymentFor(staged.state, P1, "physical", 1, [energy.fromHand, mental.fromHand])[0]!;
    const acted = runWave4(
      staged.state,
      use(P1, staged.id, "24008.the-hoods-mantle-action", [energy, mental, physical]),
    );
    expect(acted.encounterDecks[deckId(acted)]!.discard).toContain(staged.id);
  });

  it("24009.the-hoods-pistol-action: Hero Action discards it", () => {
    const base = heroified(game(), P1);
    const staged = attachedTo(base, "24009", villainId(base));
    const mental = paymentFor(staged.state, P1, "mental", 1)[0]!;
    const physical = paymentFor(staged.state, P1, "physical", 1, [mental.fromHand])[0]!;
    const acted = runWave4(staged.state, use(P1, staged.id, "24009.the-hoods-pistol-action", [mental, physical]));
    expect(acted.encounterDecks[deckId(acted)]!.discard).toContain(staged.id);
  });

  it("24009.boost: [star] Boost reveals this card", () => {
    const base = onStage(game(), 0);
    const staged = attachedTo(base, "24009", villainId(base));
    // 24009's own boost ability is resolved as the villain's own dealt boost card during its activation; staging it
    // directly on top of the encounter deck's boost draw (via the villain's own basic attack, which deals itself a
    // boost card first) exercises the same `boost()` ability the villain phase would.
    const attacked = settle(
      runWave4(withForm(staged.state, { heroForm: 0 }, P1), {
        type: "basicAttack",
        playerId: P1,
        attackerInstanceId: identityOf(staged.state, P1),
        targetInstanceId: villainId(staged.state),
      }),
      firstLegal,
      undefined,
      WAVE4_DEPS,
    );
    expect(attacked.instances[staged.id]?.faceup).toBe(true);
  });

  it("24012.when-revealed: shuffles a set-aside set in and resolves Foul Play", () => {
    // "Remove this card from the game" sticks: the reveal's finish discards only a treachery still where its reveal
    // found it (docs/phase7-wave4.md §3.45).
    const base = onStage(game(), 0);
    const before = base.setAsideModularSets!.length;
    const staged = stackTop(base, "01186", "24012");
    const revealed = settle(runWave4(staged, { type: "endTurn", playerId: P1 }), firstLegal, undefined, WAVE4_DEPS);
    expect(revealed.setAsideModularSets!.length).toBe(before - 1);
    const recruitment = Object.values(revealed.instances).find((i) => i.cardId === ("24012" as never))!.instanceId;
    expect(revealed.removedFromGame).toContain(recruitment);
  });

  it("24012.boost: after this activation ends, resolve Foul Play", () => {
    const base = heroified(onStage(game(), 0), P1);
    const staged = stackTop(base, "24012");
    const before = dealt(staged, P1).length + staged.encounterDecks[deckId(staged)]!.discard.length;
    const attacked = settle(runWave4(staged, { type: "endTurn", playerId: P1 }), firstLegal, undefined, WAVE4_DEPS);
    // The villain's own boost draw (Field Recruitment itself, dealt facedown as its boost card) plus Foul Play's
    // own discard at the end of that activation: at least two more cards gone than before the villain phase.
    const after = dealt(attacked, P1).length + attacked.encounterDecks[deckId(attacked)]!.discard.length;
    expect(after).toBeGreaterThan(before + 1);
  });

  it("24013.when-revealed-alter-ego: The Hood schemes and resolves Foul Play (alter-ego reveal)", () => {
    const base = onStage(game(), 0);
    const staged = stackTop(withForm(base, "alterEgo", P1), "01186", "24013");
    const beforeThreat = mainThreat(staged);
    const revealed = settle(runWave4(staged, { type: "endTurn", playerId: P1 }), firstLegal, undefined, WAVE4_DEPS);
    expect(mainThreat(revealed)).toBeGreaterThan(beforeThreat); // The Hood schemed.
  });

  it("24013.when-revealed-hero: The Hood attacks you and resolves Foul Play (hero reveal)", () => {
    const base = onStage(game(), 0);
    const staged = stackTop(withForm(base, { heroForm: 0 }, P1), "01186", "24013");
    const beforeDamage = staged.instances[identityOf(staged, P1)]!.damage;
    const revealed = settle(runWave4(staged, { type: "endTurn", playerId: P1 }), firstLegal, undefined, WAVE4_DEPS);
    expect(revealed.instances[identityOf(revealed, P1)]!.damage).toBeGreaterThan(beforeDamage);
  });
});
