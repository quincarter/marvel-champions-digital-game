import { cardId } from "@mc/content";
import {
  activeEncounterDeckId,
  activeVillain,
  applyCommand,
  damageTakenAfterConstants,
  hasKeyword,
  legalActions,
  threatCannotBeRemoved,
  type GameState,
  type InstanceId,
} from "@mc/engine";
import {
  endTurn,
  firstLegal,
  identityOf,
  inst,
  instancesOf,
  moveToHand,
  P1,
  P2,
  patchInstance,
  runWith,
  settle,
  stackEncounterDeck,
  toHero,
  use,
} from "../../testing/harness.js";
import { driveEvents } from "../../testing/staging.js";
import { traceAbilities } from "../../testing/trace.js";
import { wave3Scenario } from "../setup.js";
import { encounterCardInVillainArea, playFromHand, runWave3, startWave3Game, WAVE3_DEPS } from "../testing.js";

/**
 * Ronan the Accuser (docs/phase7-wave3.md §2.2): the villain Ronan the Accuser I–III, the main scheme Interception
 * Imminent → "Take What Is Mine", Kree Command Ship, Universal Weapon, Fanaticism, the side schemes Cut the Power/
 * Pincer Maneuver/Superior Tactics, the treacheries Single-Minded Fury/Kree Physiology/"You Stand Accused!", and
 * the Kree Militants modular set. `16114.when-revealed` and `16131.kree-combat-armor-action` (once the last two
 * genuine primitive gaps this pack had, `gmw/ronan.ts`'s own module docblock) are now scripted too, per
 * docs/phase7-wave3.md §3.39/§3.40/§3.43.
 *
 * **Traps hit writing this file, beyond the standing ones in docs/card-scripting-process.md §7:**
 *
 * - **Ronan's own printed "Toughness" keyword gives him a tough status card at setup** (RRG 1.8 "Toughness", p.
 *   45: enters play with one already on). A test that primes his damage dial and lands one small attack, expecting
 *   a kill, silently does nothing until the tough card is cleared first (it absorbs the whole hit instead).
 * - **The Power Stone starts attached to the first player's identity** (16106a's own Setup text), so "you control
 *   the Power Stone" — and the Forced Interrupt's extra boost card — is already *true* in the default post-setup
 *   state. Any test staging a specific card as *the* boost card for Ronan's own activation has to move the stone
 *   off the identity first (`withoutPowerStoneControl`), or the extra boost card silently consumes the staged
 *   card as a second, unplanned boost draw instead of leaving it to be dealt and revealed normally — the same
 *   "villain deals more than one boost card" trap `gmw/badoon.ts`'s own §6c note names, just triggered by this
 *   scenario's own printed setup rather than a card in play.
 * - **A boost card "given" outside an activation (`giveBoostCard`) is consumed by the very next activation of that
 *   enemy, in the same villain phase.** 2A's own "give him 1 facedown boost card" is confirmed via the
 *   `boostCardDealt { outsideActivation: true }` event, not via a post-villain-phase `boostCards.length` check —
 *   by the time a full phase finishes, Ronan's own activation has already flipped and discarded it.
 * - **An ability id is only active on the main scheme stage that prints it.** 16106b (1B's own First Player
 *   Action) does not exist once the main scheme has advanced to 2B (16107b) — testing "threat cannot be removed"
 *   at stage 2 needs the engine's own `threatCannotBeRemoved` rule check directly, not a `useAbility` call to an
 *   ability id that stage no longer carries.
 */

const ronanTheAccuser = (opts: { readonly difficulty?: "standard" | "expert" } = {}) =>
  startWave3Game(
    wave3Scenario("ronan-the-accuser", {
      players: [{ starterDeckId: "groot-protection" }],
      seed: 2026,
      ...(opts.difficulty ? { difficulty: opts.difficulty } : {}),
    }),
  );

/** Moves an already-in-play card from wherever it's attached to a new host (surgery): removes it from its old
 * host's `attachments` array, adds it to the new host's, and updates `attachedTo`. */
function moveAttachment(state: GameState, id: InstanceId, to: InstanceId): GameState {
  const from = inst(state, id).attachedTo;
  const instances = { ...state.instances };
  if (from) {
    instances[from] = { ...inst(state, from), attachments: inst(state, from).attachments.filter((a) => a !== id) };
  }
  instances[to] = { ...inst(state, to), attachments: [...inst(state, to).attachments, id] };
  instances[id] = { ...inst(state, id), attachedTo: to };
  return { ...state, instances };
}

/** Attaches an encounter-deck (or discard-pile) card straight to a host (surgery, `power-stone.test.ts`'s own
 * `attached()` shape) — for a card not already in play. */
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
    state: moveAttachment(
      {
        ...state,
        encounterDecks: {
          ...state.encounterDecks,
          [deckId]: { deck: pile.deck.filter((i) => i !== id), discard: pile.discard.filter((i) => i !== id) },
        },
        instances: { ...state.instances, [id]: { ...state.instances[id]!, faceup: true } },
      },
      id,
      host,
    ),
  };
}

/** Moves the Power Stone off whichever identity it starts attached to (module docblock) — the baseline for tests
 * that aren't themselves about that mechanic, so a staged boost card isn't silently consumed as an extra one. */
function withoutPowerStoneControl(state: GameState): GameState {
  const [stone] = instancesOf(state, "16149");
  return moveAttachment(state, stone!, state.villains[0]!.instanceId);
}

/** Clears a character's tough status card (module docblock: Ronan's own Toughness keyword grants one at setup,
 * which would otherwise absorb a test's priming attack entirely). */
function clearTough(state: GameState, id: InstanceId): GameState {
  return {
    ...state,
    instances: {
      ...state.instances,
      [id]: { ...inst(state, id), statuses: { ...inst(state, id).statuses, tough: 0 } },
    },
  };
}

describe("Ronan the Accuser 1A Setup (16106a.setup)", () => {
  it("puts Kree Command Ship and the Milano into play, attaches Universal Weapon to Ronan, and attaches the Power Stone to the first player", () => {
    const state = ronanTheAccuser();
    const [ship] = instancesOf(state, "16108");
    const [milano] = instancesOf(state, "16142");
    const [weapon] = instancesOf(state, "16109");
    const [stone] = instancesOf(state, "16149");
    const villain = state.villains[0]!.instanceId;
    expect(ship).toBeDefined();
    expect(state.villainArea).toContain(ship);
    expect(milano).toBeDefined();
    expect(state.players.some((p) => p.playArea.includes(milano!))).toBe(true);
    expect(inst(state, milano!).controllerId).toBe(P1);
    expect(inst(state, weapon!).attachedTo).toBe(villain);
    // Not the villain-default auto-attach (module docblock): the Power Stone ends on the first player's identity
    // instead.
    expect(inst(state, stone!).attachedTo).toBe(identityOf(state, state.firstPlayerId!));
    expect(inst(state, stone!).attachedTo).not.toBe(villain);
  });
});

describe("Interception Imminent 1B — First Player Action (16106b.interception-imminent-constant)", () => {
  it("exhausting the Milano removes 3 threat from the main scheme", () => {
    const state = ronanTheAccuser();
    const [milano] = instancesOf(state, "16142");
    const before = inst(state, state.mainScheme.instanceId).threat;
    const used = runWave3(
      state,
      use(P1, state.mainScheme.instanceId, "16106b.interception-imminent-constant", [], { exhausted: [milano!] }),
    );
    expect(inst(used, milano!).exhausted).toBe(true);
    expect(inst(used, state.mainScheme.instanceId).threat).toBe(Math.max(0, before - 3));
  });
});

describe("Ronan I — Forced Interrupt: an extra boost card while you control the Power Stone (16103.ronan-the-accuser-forced-interrupt)", () => {
  it("2 boost cards flip when the Power Stone is attached to your identity (the setup default)", () => {
    const hero = runWave3(ronanTheAccuser(), toHero());
    const { events } = driveEvents(WAVE3_DEPS, hero, endTurn());
    expect(events.filter((e) => e.type === "boostCardFlipped")).toHaveLength(2);
  });

  it("only 1 boost card flips once the Power Stone is moved off your identity", () => {
    const hero = runWave3(ronanTheAccuser(), toHero());
    const moved = withoutPowerStoneControl(hero);
    const { events } = driveEvents(WAVE3_DEPS, moved, endTurn());
    expect(events.filter((e) => e.type === "boostCardFlipped")).toHaveLength(1);
  });
});

describe("Ronan II (16104) — reached by actually defeating Ronan I, so the real defeat→advance transition fires its When Revealed", () => {
  it("When Revealed: searches for and reveals Cut the Power (16104.when-revealed)", () => {
    const hero = runWave3(ronanTheAccuser(), toHero());
    const villain = hero.villains[0]!.instanceId;
    // 14 solo hit points; Groot's basic ATK is 2. Ronan's own "Toughness" keyword (module docblock) already gave
    // him a tough status card at setup, which would otherwise absorb this attack entirely — cleared first.
    const primed = clearTough(patchInstance(hero, villain, { damage: 13 }), villain);
    const attacked = runWave3(primed, {
      type: "basicAttack",
      playerId: P1,
      attackerInstanceId: identityOf(primed),
      targetInstanceId: villain,
    });
    expect(activeVillain(attacked).stageIndex).toBe(1); // Ronan II is now active
    const [cutThePower] = instancesOf(attacked, "16111");
    expect(cutThePower).toBeDefined();
    expect(inst(attacked, cutThePower!).faceup).toBe(true); // "reveal it"
  });

  // 16104.ronan-the-accuser-forced-interrupt is the identical shared text `gmw/ronan.ts`'s own
  // `ronanBoostsIfYouControlPowerStone()` already covers, exercised above for Ronan I.
});

describe("Ronan III (16105) — reached by actually defeating Ronan II in expert mode, which starts on Ronan II", () => {
  it("When Revealed: searches for and reveals Superior Tactics (16105.when-revealed)", () => {
    const state = ronanTheAccuser({ difficulty: "expert" });
    expect(activeVillain(state).stageIndex).toBe(1); // expert starts on Ronan II
    const hero = runWave3(state, toHero());
    const villain = hero.villains[0]!.instanceId;
    const primed = clearTough(patchInstance(hero, villain, { damage: 16 }), villain); // 18 solo hit points
    const attacked = runWave3(primed, {
      type: "basicAttack",
      playerId: P1,
      attackerInstanceId: identityOf(primed),
      targetInstanceId: villain,
    });
    expect(activeVillain(attacked).stageIndex).toBe(2); // Ronan III is now active
    const [superiorTactics] = instancesOf(attacked, "16113");
    expect(superiorTactics).toBeDefined();
    expect(inst(attacked, superiorTactics!).faceup).toBe(true);
  });

  // 16105.ronan-the-accuser-forced-interrupt is the identical shared text covered above for Ronan I.

  // rules-qa-engineer, full QA pass follow-up: Ronan III's own printed "Retaliate 1" (16105, docs/cards/by_pack/
  // gmw.md "Stats: ... Retaliate 1. Toughness.") is the only villain keyword in the whole `gmw` box besides
  // Toughness (already exercised above and in every other Ronan test's own `clearTough` staging) — grepping every
  // gmw villain's `keywords` array in `packages/content/src/data/gmw/cards.ts` finds no other villain stage with a
  // non-empty keyword list. It had never been driven: reached, but never attacked again to see the reflected damage.
  it('Retaliate 1: an attack against him deals 1 damage back to the attacker (RRG 1.8 "Retaliate", p. 41)', () => {
    const state = ronanTheAccuser({ difficulty: "expert" });
    const hero = runWave3(state, toHero());
    const villain = hero.villains[0]!.instanceId;
    const primed = clearTough(patchInstance(hero, villain, { damage: 16 }), villain); // 18 solo hit points
    const reachedIII = runWave3(primed, {
      type: "basicAttack",
      playerId: P1,
      attackerInstanceId: identityOf(primed),
      targetInstanceId: villain,
    });
    expect(activeVillain(reachedIII).stageIndex).toBe(2); // Ronan III is now active

    const identity = identityOf(reachedIII);
    // Readied first — the attack that just defeated Ronan II exhausted the identity, and this test needs a second,
    // separate attack.
    const readied = patchInstance(reachedIII, identity, { exhausted: false });
    const damageBefore = inst(readied, identity).damage;
    // Ronan III's own 25-solo-HP dial: a small, clearly-non-defeating attack, so any damage the attacker takes back
    // is unambiguously Retaliate's own effect, not incidental to a defeat this attack didn't cause.
    const attacked = runWave3(readied, {
      type: "basicAttack",
      playerId: P1,
      attackerInstanceId: identity,
      targetInstanceId: villain,
    });
    expect(activeVillain(attacked).stageIndex).toBe(2); // still Ronan III — this attack did not defeat him
    expect(inst(attacked, identity).damage).toBe(damageBefore + 1);
  });
});

describe('"Take What Is Mine" 2A — When Revealed, reached by a real main scheme advance (16107a.when-revealed)', () => {
  it("attaches the Power Stone to Ronan the Accuser when it isn't already there", () => {
    const state = withoutPowerStoneControl(ronanTheAccuser());
    const villain = state.villains[0]!.instanceId;
    const [stone] = instancesOf(state, "16149");
    const scheme = state.mainScheme.instanceId;
    // Stage 1's target threat is 7 solo, acceleration 2; priming 2 below lets step one's own placement complete
    // it for real — a direct `stageIndex` patch would skip 2A's own When Revealed push entirely.
    const primed = patchInstance(state, scheme, { threat: 5 });
    const { state: after } = driveEvents(WAVE3_DEPS, primed, endTurn());
    expect(after.mainScheme.stageIndex).toBe(1); // "Take What Is Mine"
    expect(inst(after, stone!).attachedTo).toBe(villain);
  });

  it("gives Ronan a facedown boost card instead, if the Power Stone is already attached to him (module docblock: checked via the boostCardDealt event, not a post-phase boostCards count — his own activation later this same phase consumes it)", () => {
    const state = ronanTheAccuser();
    const villain = state.villains[0]!.instanceId;
    const [stone] = instancesOf(state, "16149");
    const alreadyThere = moveAttachment(state, stone!, villain);
    const scheme = alreadyThere.mainScheme.instanceId;
    const primed = patchInstance(alreadyThere, scheme, { threat: 5 });
    const { state: after, events } = driveEvents(WAVE3_DEPS, primed, endTurn());
    expect(after.mainScheme.stageIndex).toBe(1);
    expect(
      events.some(
        (e) =>
          e.type === "boostCardDealt" && (e as { readonly outsideActivation?: boolean }).outsideActivation === true,
      ),
    ).toBe(true);
    expect(inst(after, stone!).attachedTo).toBe(villain); // stays attached
  });
});

describe('"Take What Is Mine" 2B — threat cannot be removed while the Power Stone is attached to Ronan (16107b.take-what-is-mine-constant)', () => {
  it("the rule is active while attached, and inactive once the Power Stone moves off Ronan", () => {
    const state = ronanTheAccuser();
    const villain = state.villains[0]!.instanceId;
    const scheme = state.mainScheme.instanceId;
    const atStage2: GameState = { ...state, mainScheme: { ...state.mainScheme, stageIndex: 1 } };
    const [stone] = instancesOf(atStage2, "16149");
    const withStoneOnRonan = moveAttachment(atStage2, stone!, villain);
    expect(threatCannotBeRemoved(withStoneOnRonan, WAVE3_DEPS, scheme)).toBe(true);
    // The Power Stone starts on the first player's identity by default (16106a's own Setup) — moving it there
    // (from Ronan) turns the rule back off.
    const withStoneOnIdentity = moveAttachment(withStoneOnRonan, stone!, identityOf(withStoneOnRonan));
    expect(threatCannotBeRemoved(withStoneOnIdentity, WAVE3_DEPS, scheme)).toBe(false);
  });
});

describe("Kree Command Ship (16108.kree-command-ship-constant)", () => {
  it("exhausting the Milano and spending 1 resource cancels a revealed treachery's When Revealed effects", () => {
    const base = withoutPowerStoneControl(ronanTheAccuser());
    const [milano] = instancesOf(base, "16142");
    // "You Stand Accused!" (16116), not Kree Physiology: 16115 also carries Surge, which deals and reveals a
    // further card regardless of whether its own When Revealed is cancelled — chaining into more interrupt
    // windows for the same ability and confounding a single-cancellation assertion. 16116 has no such keyword, so
    // one filler (absorbing the boost draw) reaches it as the only card revealed this villain phase.
    const staged = stackEncounterDeck(base, "01186", "16116");
    const { deps, trace } = traceAbilities(WAVE3_DEPS);
    const settled = settle(
      runWith(deps, staged, endTurn()),
      (s) => {
        const choice = s.pendingChoice;
        if (!choice) return [];
        if (choice.prompt.kind === "declareDefender") return ["decline"];
        const hit = choice.options.find((o) => o.label.includes("Kree Command Ship"));
        if (hit) return [hit.optionId];
        // Every other prompt this test reaches (the resource-payment choice included) should pick something
        // rather than decline — `firstLegal` alone declines an optional 0-minimum prompt (like this one's own
        // "which card pays the resource" step), which would silently abort paying for the interrupt.
        return choice.options.length > 0 ? [choice.options[0]!.optionId] : [];
      },
      undefined,
      deps,
    );
    expect(trace.resolved()).toContain("16108.kree-command-ship-constant");
    expect(trace.resolved()).not.toContain("16116.when-revealed-alter-ego");
    expect(trace.resolved()).not.toContain("16116.when-revealed-hero");
    expect(inst(settled, milano!).exhausted).toBe(true);
  });
});

describe("Universal Weapon (16109) — Attach to Ronan the Accuser is data-driven", () => {
  it("grants Ronan the Accuser stalwart (16109.universal-weapon-constant)", () => {
    const state = ronanTheAccuser();
    const villain = state.villains[0]!.instanceId;
    expect(hasKeyword(state, villain, "stalwart", WAVE3_DEPS)).toBe(true);
  });

  it("Hero Action: take 2 damage and deal yourself 1 facedown encounter card → shuffle it into the encounter deck (16109.universal-weapon-action)", () => {
    const hero = runWave3(ronanTheAccuser(), toHero());
    const [weapon] = instancesOf(hero, "16109");
    const identity = identityOf(hero);
    const damageBefore = inst(hero, identity).damage;
    const used = settle(
      runWave3(hero, use(P1, weapon!, "16109.universal-weapon-action")),
      firstLegal,
      undefined,
      WAVE3_DEPS,
    );
    expect(inst(used, identity).damage).toBe(damageBefore + 2);
    expect(inst(used, weapon!).attachedTo).toBeNull();
  });

  it("[star] Boost: resolves, attaching Universal Weapon to Ronan the Accuser (16109.boost)", () => {
    // Shuffled back into the encounter deck first (its own Hero Action, already tested above), so it can be
    // staged as the villain's own boost card: it starts attached at setup and would otherwise not be findable in
    // the deck at all.
    const hero = runWave3(withoutPowerStoneControl(ronanTheAccuser()), toHero());
    const [weapon] = instancesOf(hero, "16109");
    const villain = hero.villains[0]!.instanceId;
    const used = settle(
      runWave3(hero, use(P1, weapon!, "16109.universal-weapon-action")),
      firstLegal,
      undefined,
      WAVE3_DEPS,
    );
    const staged = stackEncounterDeck(used, "16109");
    const { deps, trace } = traceAbilities(WAVE3_DEPS);
    const { state: after } = driveEvents(deps, staged, endTurn());
    expect(trace.resolved()).toContain("16109.boost");
    expect(inst(after, weapon!).attachedTo).toBe(villain);
  });
});

describe("Fanaticism (16110.fanaticism-forced-interrupt) — Attach to Ronan the Accuser, Surge, Uses are data-driven", () => {
  it("Ronan's attack on you gains overkill and piercing, and 1 fury counter is removed at the end of that attack", () => {
    const hero = runWave3(withoutPowerStoneControl(ronanTheAccuser()), toHero());
    const villain = hero.villains[0]!.instanceId;
    const { state: attached, id: fanaticism } = attachTo(hero, "16110", villain);
    const withCounters = {
      ...attached,
      instances: { ...attached.instances, [fanaticism]: { ...inst(attached, fanaticism), counters: { fury: 2 } } },
    };
    const { deps, trace } = traceAbilities(WAVE3_DEPS);
    const settled = settle(runWith(deps, withCounters, endTurn()), firstLegal, undefined, deps);
    expect(trace.resolved()).toContain("16110.fanaticism-forced-interrupt");
    expect(inst(settled, fanaticism).counters.fury).toBe(1);
  });
});

describe("Cut the Power (16111.boost) — the crisis icon is data-driven", () => {
  it("chooses to either exhaust the Milano or place 2 threat on the main scheme", () => {
    const base = withoutPowerStoneControl(ronanTheAccuser());
    const staged = stackEncounterDeck(base, "16111");
    const [milano] = instancesOf(base, "16142");
    const chosen = settle(
      runWave3(staged, endTurn()),
      (s) => {
        const choice = s.pendingChoice;
        if (!choice) return [];
        const hit = choice.options.find((o) => o.label.startsWith("Exhaust the Milano"));
        return hit ? [hit.optionId] : firstLegal(s);
      },
      undefined,
      WAVE3_DEPS,
    );
    expect(inst(chosen, milano!).exhausted).toBe(true);
  });
});

describe("Pincer Maneuver (16112.pincer-maneuver-constant) — Hinder is data-driven", () => {
  it("exhausting the Milano removes 3 threat from this scheme", () => {
    const state = ronanTheAccuser();
    const [milano] = instancesOf(state, "16142");
    const { state: staged, id: scheme } = encounterCardInVillainArea(state, "16112", 5);
    const used = runWave3(staged, use(P1, scheme, "16112.pincer-maneuver-constant", [], { exhausted: [milano!] }));
    expect(inst(used, scheme).threat).toBe(2);
    expect(inst(used, milano!).exhausted).toBe(true);
  });
});

describe("Superior Tactics (16113)", () => {
  it("the Power Stone cannot be unattached from Ronan the Accuser while this side scheme is in play (16113.superior-tactics-constant)", () => {
    const state = ronanTheAccuser();
    const villain = state.villains[0]!.instanceId;
    const [stone] = instancesOf(state, "16149");
    const withStoneOnRonan = moveAttachment(state, stone!, villain);
    const { state: withSideScheme } = encounterCardInVillainArea(withStoneOnRonan, "16113");
    const hero = runWave3(withSideScheme, toHero());
    // Root Stomp (16005, Groot's own event) deals 5 damage to Ronan, well past the Power Stone's own 3-damage
    // move threshold (§3.19) — Superior Tactics should keep it on Ronan instead of letting it move to Groot.
    const { state: attacked } = playFromHand(hero, "16005", 2);
    expect(inst(attacked, stone!).attachedTo).toBe(villain);
  });

  it("When Revealed: attaches the Power Stone to Ronan the Accuser (16113.when-revealed)", () => {
    const base = withoutPowerStoneControl(ronanTheAccuser());
    const villain = base.villains[0]!.instanceId;
    const staged = stackEncounterDeck(base, "01186", "16113");
    const { state: after } = driveEvents(WAVE3_DEPS, staged, endTurn());
    const [stone] = instancesOf(after, "16149");
    expect(inst(after, stone!).attachedTo).toBe(villain);
  });

  it("When Revealed: places 1[per_hero] threat here if the Power Stone is already attached to Ronan (16113.when-revealed)", () => {
    const state = ronanTheAccuser();
    const villain = state.villains[0]!.instanceId;
    const [stone] = instancesOf(state, "16149");
    const alreadyThere = moveAttachment(state, stone!, villain);
    const staged = stackEncounterDeck(alreadyThere, "01186", "16113");
    const { state: after } = driveEvents(WAVE3_DEPS, staged, endTurn());
    const [superiorTactics] = instancesOf(after, "16113");
    expect(inst(after, superiorTactics!).threat).toBeGreaterThanOrEqual(1);
  });
});

describe("Single-Minded Fury (16114.when-revealed) — Ronan attacks the player who controls the Power Stone (module docblock, docs/phase7-wave3.md §3.39/§3.40, §4 Q11)", () => {
  /** A two-player game (`flora-and-fauna.test.ts`'s own precedent) so the Power Stone can be moved onto P2's
   * identity, distinct from the first player (P1) it starts attached to. */
  const twoPlayerRonan = () =>
    startWave3Game(
      wave3Scenario("ronan-the-accuser", {
        players: [{ starterDeckId: "groot-protection" }, { starterDeckId: "rocket-raccoon-aggression" }],
        seed: 2026,
      }),
    );

  const surged = (events: readonly { readonly type: string }[]) => events.some((e) => e.type === "surgeTriggered");

  it("attacks the player whose identity holds the Power Stone (P2), even in alter-ego form", () => {
    // Both hero form, so Ronan's own per-round activation is an attack (module docblock's "villain deals more
    // than one boost card" trap: an *attack* activation doesn't place threat and can't push the main scheme past
    // its own completion threshold mid-phase the way a scheme activation's threat can — `16107a.when-revealed`
    // firing here would reattach the Power Stone to Ronan mid-phase and confound this test). Two safe fillers
    // (`01186`/`01187`, "Standard" Core treacheries with no `[star] Boost:` text of their own, so they never
    // cascade into a further boost draw when *flipped as a boost card* — `stageNemesisCardForReveal`'s own
    // docblock, `../../testing/staging.ts`) absorb P1's own baseline boost draw and P2's own baseline + "you
    // control the Power Stone" extra draw (16103's own Forced Interrupt, since the stone is on P2's identity), so
    // Single-Minded Fury lands as the villain phase's own "Deal Encounter Cards" reveal, not consumed as a boost
    // card itself.
    const base = twoPlayerRonan();
    const p1Hero = runWave3(base, toHero(P1));
    const p1Done = settle(runWave3(p1Hero, endTurn(P1)), firstLegal, undefined, WAVE3_DEPS);
    const hero = runWave3(p1Done, toHero(P2));
    const [stone] = instancesOf(hero, "16149");
    const identity2 = identityOf(hero, P2);
    const onP2 = moveAttachment(hero, stone!, identity2);
    const scheme = onP2.mainScheme.instanceId;
    const lowThreat = patchInstance(onP2, scheme, { threat: 0 });
    const damageBefore = inst(lowThreat, identity2).damage;
    const staged = stackEncounterDeck(lowThreat, "01186", "01186", "01187", "16114");
    const { state: after, events } = driveEvents(WAVE3_DEPS, staged, endTurn(P2));
    expect(inst(after, identity2).damage).toBeGreaterThan(damageBefore);
    expect(surged(events)).toBe(false);
  });

  it("with the Power Stone attached to no identity (on Ronan himself), no attack is made and this card gains surge", () => {
    const base = withoutPowerStoneControl(ronanTheAccuser());
    const staged = stackEncounterDeck(base, "01186", "16114");
    const { events } = driveEvents(WAVE3_DEPS, staged, endTurn());
    expect(events.some((e) => e.type === "attackResolved")).toBe(false);
    expect(surged(events)).toBe(true);
  });

  it("a stunned Ronan does not attack (the stunned status is discarded instead), so this card gains surge", () => {
    const base = ronanTheAccuser();
    const villain = base.villains[0]!.instanceId;
    const stunned = {
      ...base,
      instances: {
        ...base.instances,
        [villain]: { ...inst(base, villain), statuses: { ...inst(base, villain).statuses, stunned: 1 } },
      },
    };
    const staged = stackEncounterDeck(stunned, "01186", "16114");
    const { events } = driveEvents(WAVE3_DEPS, staged, endTurn());
    expect(events.some((e) => e.type === "attackResolved")).toBe(false);
    expect(surged(events)).toBe(true);
  });

  it("[star] Boost: attaches the Power Stone to Ronan the Accuser (16114.boost)", () => {
    const base = withoutPowerStoneControl(ronanTheAccuser());
    const villain = base.villains[0]!.instanceId;
    const [stone] = instancesOf(base, "16149");
    const staged = stackEncounterDeck(base, "16114");
    const { state: after } = driveEvents(WAVE3_DEPS, staged, endTurn());
    expect(inst(after, stone!).attachedTo).toBe(villain);
  });
});

describe("Kree Physiology (16115.when-revealed) — Surge is data-driven", () => {
  it("gives Ronan a tough status card", () => {
    const base = withoutPowerStoneControl(ronanTheAccuser());
    const villain = base.villains[0]!.instanceId;
    const clean = clearTough(base, villain);
    const staged = stackEncounterDeck(clean, "01186", "16115");
    const { state: after } = driveEvents(WAVE3_DEPS, staged, endTurn());
    expect(inst(after, villain).statuses.tough).toBeGreaterThanOrEqual(1);
  });

  it("takes 1 damage instead if Ronan already has a tough status card (checked before the give)", () => {
    const base = withoutPowerStoneControl(ronanTheAccuser());
    const villain = base.villains[0]!.instanceId;
    const identity = identityOf(base);
    const withTough = {
      ...base,
      instances: {
        ...base.instances,
        [villain]: { ...inst(base, villain), statuses: { ...inst(base, villain).statuses, tough: 1 } },
      },
    };
    const damageBefore = inst(withTough, identity).damage;
    const staged = stackEncounterDeck(withTough, "01186", "16115");
    const { state: after } = driveEvents(WAVE3_DEPS, staged, endTurn());
    expect(inst(after, identity).damage).toBeGreaterThanOrEqual(damageBefore + 1);
  });
});

describe('"You Stand Accused!" (16116)', () => {
  it("When Revealed (Alter-Ego): Ronan schemes with +1 SCH (16116.when-revealed-alter-ego)", () => {
    const base = withoutPowerStoneControl(ronanTheAccuser());
    const staged = stackEncounterDeck(base, "01186", "16116");
    const { deps, trace } = traceAbilities(WAVE3_DEPS);
    driveEvents(deps, staged, endTurn());
    expect(trace.resolved()).toContain("16116.when-revealed-alter-ego");
  });

  it("When Revealed (Hero): Ronan attacks you with +1 ATK (16116.when-revealed-hero)", () => {
    const hero = runWave3(withoutPowerStoneControl(ronanTheAccuser()), toHero());
    const identity = identityOf(hero);
    const damageBefore = inst(hero, identity).damage;
    const staged = stackEncounterDeck(hero, "01186", "16116");
    const { state: after } = driveEvents(WAVE3_DEPS, staged, endTurn());
    expect(inst(after, identity).damage).toBeGreaterThan(damageBefore);
  });

  it("[star] Boost: gives the villain 1 additional boost card for this activation (16116.boost)", () => {
    const base = withoutPowerStoneControl(ronanTheAccuser());
    const staged = stackEncounterDeck(base, "16116");
    const { events } = driveEvents(WAVE3_DEPS, staged, endTurn());
    expect(events.filter((e) => e.type === "boostCardFlipped")).toHaveLength(2);
  });
});

describe("Kree Militants modular (16131-16134)", () => {
  it("Kree Combat Armor: reduces the damage the attached (highest-ATK) enemy takes from each attack by 1 (16131.kree-combat-armor-constant)", () => {
    const state = ronanTheAccuser();
    const villain = state.villains[0]!.instanceId;
    const { state: attached } = attachTo(state, "16131", villain);
    expect(damageTakenAfterConstants(attached, WAVE3_DEPS, villain, 4, true)).toBe(3);
  });

  describe("Kree Combat Armor — Hero Action: spend 3 resources of the same type → discard this card (16131.kree-combat-armor-action, docs/phase7-wave3.md §3.43)", () => {
    it("three of one type (three copies of Desperate Defense, all [energy]) pays and discards the card", () => {
      const hero = runWave3(ronanTheAccuser(), toHero());
      const villain = hero.villains[0]!.instanceId;
      const { state: attached, id: armor } = attachTo(hero, "16131", villain);
      const given = moveToHand(attached, P1, "16013", "16013", "16013");
      const [c1, c2, c3] = given.ids as [InstanceId, InstanceId, InstanceId];
      const used = runWave3(
        given.state,
        use(P1, armor, "16131.kree-combat-armor-action", [{ fromHand: c1 }, { fromHand: c2 }, { fromHand: c3 }]),
      );
      expect(inst(used, armor).attachedTo).toBeNull();
    });

    it("a mixed-type payment is refused, and legalActions does not offer an unpayable hand", () => {
      const hero = runWave3(ronanTheAccuser(), toHero());
      const villain = hero.villains[0]!.instanceId;
      const { state: attached, id: armor } = attachTo(hero, "16131", villain);
      // 16013 (Desperate Defense, [energy]), 16014 (Fighting Fit, [physical]), 16002 (Fruition, [mental]) — one of
      // each type, so even Milano's own "spend 1 resource of any type" ability (16142.milano-constant-2, `gmw/
      // ship-command.ts`) can push at most 2 of any one type to 3, never far enough. The rest of the hand is
      // emptied first (back into the deck) so `legalActions`' own "probe the whole wallet" check has no other way
      // to pay (the engine test's own `table()` convention, `packages/engine/src/same-type-resource-cost.test.ts`).
      const emptied: GameState = {
        ...attached,
        players: attached.players.map((p) =>
          p.playerId === P1 ? { ...p, deck: [...p.hand, ...p.deck], hand: [] } : p,
        ),
      };
      const given = moveToHand(emptied, P1, "16013", "16014", "16002");
      const [c1, c2, c3] = given.ids as [InstanceId, InstanceId, InstanceId];
      const result = applyCommand(
        given.state,
        use(P1, armor, "16131.kree-combat-armor-action", [{ fromHand: c1 }, { fromHand: c2 }, { fromHand: c3 }]),
        WAVE3_DEPS,
      );
      expect(result.ok).toBe(false);
      const actions = legalActions(given.state, P1, WAVE3_DEPS);
      if (actions.kind !== "turn") throw new Error(`expected a turn, got ${actions.kind}`);
      const offered = actions.legal.find((a) => a.action.kind === "useAbility" && a.action.instanceId === armor);
      expect(offered).toBeUndefined();
    });

    it("wild resources count as any type (two copies of The Power of Protection, [wild], plus one [physical])", () => {
      const hero = runWave3(ronanTheAccuser(), toHero());
      const villain = hero.villains[0]!.instanceId;
      const { state: attached, id: armor } = attachTo(hero, "16131", villain);
      // RRG 1.8 "Wild Resource" (p. 48): a wild resource may be declared as any type — so 2 wild + 1 physical pays
      // 3 physical.
      const given = moveToHand(attached, P1, "16015", "16015", "16014");
      const [c1, c2, c3] = given.ids as [InstanceId, InstanceId, InstanceId];
      const result = applyCommand(
        given.state,
        use(P1, armor, "16131.kree-combat-armor-action", [{ fromHand: c1 }, { fromHand: c2 }, { fromHand: c3 }]),
        WAVE3_DEPS,
      );
      expect(result.ok).toBe(true);
    });
  });

  const boostResolves = (code: string, abilityId: string) => {
    const base = withoutPowerStoneControl(ronanTheAccuser());
    const staged = stackEncounterDeck(base, code);
    const { deps, trace } = traceAbilities(WAVE3_DEPS);
    driveEvents(deps, staged, endTurn());
    expect(trace.resolved()).toContain(abilityId);
  };

  it("Kree Commando: if this is an attack, this attack gains piercing (16132.boost)", () =>
    boostResolves("16132", "16132.boost"));
  it("Kree Lieutenant: if this activation is an attack, this card gets +3 boost icons (16133.boost)", () =>
    boostResolves("16133", "16133.boost"));
  it("Kree Private: if this activation is an attack, this attack gains overkill (16134.boost)", () =>
    boostResolves("16134", "16134.boost"));
});
