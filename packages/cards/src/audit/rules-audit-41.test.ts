import { cardId } from "@mc/content";
import {
  activeEncounterDeck,
  activeEncounterDeckId,
  activeVillain,
  cardsInPlay,
  createGame,
  type GameEvent,
  type GameState,
  type InstanceId,
} from "@mc/engine";
import { describe, expect, it } from "vitest";
import { PLAYABLE_DEPS, playableScenario } from "../playable/index.js";
import {
  P1,
  endTurn,
  firstLegal,
  identityOf,
  inst,
  instancesOf,
  moveToHand,
  patchInstance,
  payWith,
  picking,
  play,
  playerOf,
  runWith,
  settle,
  stackEncounterDeck,
  toHero,
  use,
  type Picker,
} from "../testing/harness.js";
import { DEPS, conjure, rhino } from "../testing/qa-bench.js";
import { driveEventsPicking, withForm } from "../testing/staging.js";
import { runWave5, startWave5Game, WAVE5_DEPS } from "../wave5/testing.js";
import { ghostSpiderScenario } from "../wave5/sm/ghost-spider/support.js";
import { attachToHost, engageMinion, tuckBySurgery } from "../wave6/mut_gen/project-wideawake-testing.js";
import { stackInvocation } from "../wave1/drs/testing.js";
import { cyclopsGame } from "../wave6/cyclops/cyclops/support.js";
import { gambitGame } from "../wave6/gambit/gambit/support.js";
import { wolverineGame } from "../wave6/wolv/wolverine/support.js";
import { WAVE6_DEPS } from "../wave6/index.js";
import { magnetoGame, withoutDealtCards } from "../wave6/mut_gen/magneto-testing.js";

/**
 * Chunk 41 audit proofs (FFG rulings May 10 - June 13, 2024). Order of authority: RRG 1.8 first, rulings second.
 */

describe("chunk 41: Worried Father and Lost Visor (ruling May 10, 2024, Ruling 180)", () => {
  // Ruling 180 (1): when the search fails the obligation stays in play, and its Alter-Ego Action then adds George
  // Stacy to hand "from wherever it currently is" (same as the Lost Visor obligation). RRG 1.8 is silent.
  it("the Alter-Ego Action adds George Stacy to hand although the search found him nowhere", () => {
    const base = startWave5Game(ghostSpiderScenario("rhino", { seed: 2 }));
    const [stacy] = instancesOf(base, "27007") as [InstanceId];
    // Stacy sits tucked under the main scheme (like Seized! / Stolen Memories): outside deck, hand, discard, play area.
    const tucked = tuckBySurgery(base, base.mainScheme.instanceId, [stacy]);
    const staged = stackEncounterDeck(tucked, "01186", "27025");
    const revealed = settle(runWave5(staged, endTurn(P1)), firstLegal, undefined, WAVE5_DEPS);
    const [obligation] = instancesOf(revealed, "27025") as [InstanceId];
    expect(cardsInPlay(revealed)).toContain(obligation); // setup check: the obligation stays, nothing attached
    expect(inst(revealed, obligation).attachments).toEqual([]);
    const after = settle(
      runWave5(revealed, use(P1, obligation, "27025.worried-father-action")),
      firstLegal,
      undefined,
      WAVE5_DEPS,
    );
    expect(inst(after, identityOf(after)).exhausted).toBe(true); // setup check: the action ran
    expect(playerOf(after, P1).hand).toContain(stacy);
  });

  it("Lost Visor's Alter-Ego Action adds Ruby Quartz Visor to hand although the search found it nowhere", () => {
    const given = moveToHand(cyclopsGame(), P1, "33003");
    const [visor] = given.ids as [InstanceId];
    // The visor sits tucked under the main scheme: outside deck, hand, discard and play area.
    const tucked = tuckBySurgery(given.state, given.state.mainScheme.instanceId, [visor]);
    const staged = stackEncounterDeck(tucked, "01186", "33027");
    const revealed = settle(runWith(WAVE6_DEPS, staged, endTurn(P1)), firstLegal, undefined, WAVE6_DEPS);
    const [obligation] = instancesOf(revealed, "33027") as [InstanceId];
    expect(cardsInPlay(revealed)).toContain(obligation); // setup check: the obligation stays, nothing tucked
    expect(inst(revealed, obligation).tucked).toEqual([]);
    const after = settle(
      runWith(WAVE6_DEPS, revealed, use(P1, obligation, "33027.lost-visor-action")),
      firstLegal,
      undefined,
      WAVE6_DEPS,
    );
    expect(inst(after, identityOf(after)).exhausted).toBe(true); // setup check: the action ran
    expect(playerOf(after, P1).hand).toContain(visor);
  });
});

describe("chunk 41: Vapors of Valtorr vs Mister Sinister (ruling May 10, 2024, Ruling 181)", () => {
  // Ruling 181: replacing a status card on Mister Sinister does not trigger his "After a status card is placed on
  // Mister Sinister" Forced Response. RRG 1.8 is silent on "replace" for status cards.
  it.fails("replacing his stunned status with confused places no threat", () => {
    const created = createGame(
      playableScenario("mister-sinister", { seed: 3, players: [{ starterDeckId: "drs-protection" }] }),
      PLAYABLE_DEPS,
    );
    if (!created.ok) throw new Error(created.error.message);
    const open = settle(created.state, firstLegal, (s) => s.step.phase === "player", PLAYABLE_DEPS);
    const hero = settle(runWith(PLAYABLE_DEPS, open, toHero(P1)), firstLegal, undefined, PLAYABLE_DEPS);
    const v = activeVillain(hero).instanceId;
    const stunned = patchInstance(hero, v, { statuses: { ...inst(hero, v).statuses, stunned: 1 } });
    const stacked = stackInvocation(stunned, P1, "09035");
    const top = playerOf(stacked, P1).separateDecks["Invocation"]!.deck[0]!;
    const before = inst(stacked, stacked.mainScheme.instanceId).threat;
    const invoked = runWith(
      PLAYABLE_DEPS,
      stacked,
      use(P1, identityOf(stacked), "09001a.spell-mastery", [], { invocation: [top] }),
    );
    const after = settle(invoked, picking(v, "0"), undefined, PLAYABLE_DEPS);
    expect(inst(after, v).statuses.stunned).toBe(0); // setup check: replaced
    expect(inst(after, v).statuses.confused).toBe(1);
    expect(inst(after, after.mainScheme.instanceId).threat).toBe(before);
  });
});

describe("chunk 41: Slice and Dice through Wolverine's Claws (ruling May 16, 2024, Ruling 190)", () => {
  // Ruling 190: unstunned, "only the first attack gains piercing". FAQ "Dance of Death (#4)" (RRG 1.8 p. 59) makes each
  // damage effect of an unlabeled multi-damage event its own attack; "that attack" (Claws) is the first one.
  it.fails("the second attack does not pierce a tough status card", () => {
    let state = withForm(wolverineGame(), { heroForm: 0 });
    const villain = state.villains[0]!.instanceId;
    state = patchInstance(state, villain, { statuses: { ...inst(state, villain).statuses, tough: 1 } });
    const minion = engageMinion(state, "01101", P1);
    state = minion.state;
    const given = moveToHand(state, P1, "35009");
    const claws = instancesOf(given.state, "35002")[0]!;
    let asked = 0;
    const pick: Picker = (st) => {
      if (st.pendingChoice?.prompt.kind === "chooseTarget") {
        asked++;
        const want = asked === 1 ? minion.id : villain;
        if (st.pendingChoice.options.some((o) => o.optionId === want)) return [want];
      }
      return firstLegal(st);
    };
    const run = driveEventsPicking(
      WAVE6_DEPS,
      given.state,
      pick,
      use(P1, claws, "35002.wolverines-claws-action", [], { event: [given.ids[0]!] }),
    );
    expect(!cardsInPlay(run.state).includes(minion.id)).toBe(true); // setup check: the first attack hit the minion
    expect(inst(run.state, villain).statuses.tough).toBe(0);
    expect(inst(run.state, villain).damage).toBe(0); // tough absorbed the non-piercing second attack
  });
});

describe("chunk 41: Shadow of the Past and Quickstrike (ruling May 23, 2024, Ruling 194)", () => {
  // Ruling 194: Belladonna's quickstrike attack resolves only after all of Shadow of the Past has resolved, so the
  // nemesis side scheme is in play first. RRG 1.8 p. 38 "Reveal": responses to any step of a reveal wait until all steps
  // are done.
  it.fails("the nemesis side scheme enters play before Belladonna's attack resolves", () => {
    const g0 = withForm(gambitGame(), { heroForm: 0 });
    const v = g0.villains[0]!.instanceId;
    const base = patchInstance(g0, v, { statuses: { ...inst(g0, v).statuses, stunned: 1 } });
    const run = driveEventsPicking(WAVE6_DEPS, stackEncounterDeck(base, "01190"), firstLegal, endTurn(P1));
    const code = (id: InstanceId) => run.state.instances[id]?.cardId as string | undefined;
    const idx = (test: (e: GameEvent) => boolean) => run.events.findIndex(test);
    const attack = idx((e) => e.type === "attackResolved" && code(e.enemyInstanceId) === "37026");
    const scheme = idx(
      (e) => e.type === "cardMoved" && code(e.instanceId) === "37027" && JSON.stringify(e.to).includes("villainArea"),
    );
    expect(attack).toBeGreaterThanOrEqual(0);
    expect(scheme).toBeGreaterThanOrEqual(0);
    expect(scheme).toBeLessThan(attack);
  });
});

describe("chunk 41: an enemy stunned by an attack-labeled event is attacked (ruling May 30, 2024, Ruling 197)", () => {
  // Ruling 197 and RRG 1.8 p. 10 "Attack (Player Ability Type)": resolving an ability labeled as an attack "is
  // considered to attack the specified target", so Tackle (stun only, nothing paid with [physical]) triggers Retaliate.
  function table() {
    let s = rhino();
    const pile = activeEncounterDeck(s);
    const spare = pile.deck[20]!;
    s = {
      ...patchInstance(s, spare, { cardId: cardId("01172"), faceup: true, engagedWith: P1 }),
      encounterDecks: {
        ...s.encounterDecks,
        [activeEncounterDeckId(s)]: { deck: pile.deck.filter((i) => i !== spare), discard: pile.discard },
      },
      players: s.players.map((p) => (p.playerId === P1 ? { ...p, playArea: [...p.playArea, spare] } : p)),
    };
    return { state: s, whiplash: spare };
  }
  it("control: a basic attack on a Retaliate 1 minion hurts the hero", () => {
    const { state, whiplash } = table();
    const hero = identityOf(state);
    const run = driveEventsPicking(DEPS, state, firstLegal, {
      type: "basicAttack",
      playerId: P1,
      attackerInstanceId: hero,
      targetInstanceId: whiplash,
    });
    expect(inst(run.state, hero).damage).toBe(1);
  });
  it.fails("Tackle paid without [physical] stuns the minion and still triggers its Retaliate", () => {
    const { state, whiplash } = table();
    const hero = identityOf(state);
    const c = conjure(state, "05015");
    const hand = playerOf(c.state, P1).hand.filter((i) => i !== c.id);
    const run = driveEventsPicking(
      DEPS,
      c.state,
      (st) => (st.pendingChoice?.options.some((o) => o.optionId === whiplash) ? [whiplash] : firstLegal(st)),
      play(P1, c.id, hand.slice(0, 3)),
    );
    expect(inst(run.state, whiplash).statuses.stunned).toBe(1); // setup check: the stun landed, no damage
    expect(inst(run.state, whiplash).damage).toBe(0);
    expect(inst(run.state, hero).damage).toBe(1);
  });
});

describe("chunk 41: constant damage limits come before 'would take' interrupts (rulings June 6, 2024, Rulings 205 and 206)", () => {
  // RRG 1.8 p. 57 FAQ: constant effects have priority over status cards, which have priority over triggered abilities
  // (interrupts); p. 14 "Damage" puts "would take" interrupts at step 3. Rulings 205/206: Titanium Exoskeleton (cap 2) and
  // Boarding Party (sustained cap) reduce the damage taken first, then Magnetic Bubble places what is left.
  it.fails("Boarding Party's remaining allowance (3) is what Magnetic Bubble receives, not the full 8", () => {
    const base = withoutDealtCards(
      settle(runWith(WAVE6_DEPS, magnetoGame(), toHero(P1)), firstLegal, undefined, WAVE6_DEPS),
    );
    const v = base.villains[0]!.instanceId;
    const armed = attachToHost(base, "32149", v);
    const hurt = patchInstance(armed.state, v, {
      damage: 3,
      statuses: { ...inst(armed.state, v).statuses, tough: 0 },
    });
    const kick = moveToHand(hurt, P1, "01005"); // Swinging Web Kick, 8 damage
    const run = driveEventsPicking(
      WAVE6_DEPS,
      kick.state,
      firstLegal,
      play(P1, kick.ids[0]!, payWith(kick.state, P1, 3, kick.ids)),
    );
    const placed = run.events.filter((e) => e.type === "damagePlaced").map((e) => (e as { amount: number }).amount);
    expect(placed).toEqual([3]); // actual: [8], and the Bubble is discarded
  });

  it.fails("Titanium Exoskeleton's cap (2) is what Magnetic Bubble receives from an 8-damage attack", () => {
    let s = rhino();
    const v = s.activeVillainId as InstanceId;
    s = patchInstance(s, v, { statuses: { ...inst(s, v).statuses, tough: 0 } });
    const attach = (state: GameState, code: string, from: number) => {
      const pile = activeEncounterDeck(state);
      const id = pile.deck[from]!;
      const next: GameState = {
        ...patchInstance(state, id, { cardId: cardId(code), faceup: true, attachedTo: v }),
        encounterDecks: {
          ...state.encounterDecks,
          [activeEncounterDeckId(state)]: { deck: pile.deck.filter((i) => i !== id), discard: pile.discard },
        },
      };
      return { state: patchInstance(next, v, { attachments: [...inst(next, v).attachments, id] }), id };
    };
    s = attach(s, "40091", 26).state;
    s = attach(s, "32149", 25).state;
    const kick = moveToHand(s, P1, "01005");
    const run = driveEventsPicking(
      DEPS,
      kick.state,
      firstLegal,
      play(P1, kick.ids[0]!, payWith(kick.state, P1, 3, kick.ids)),
    );
    const placed = run.events.filter((e) => e.type === "damagePlaced").map((e) => (e as { amount: number }).amount);
    expect(placed).toEqual([2]); // actual: [8]
  });
});
