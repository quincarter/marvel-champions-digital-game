/**
 * QA: the community Doctor Strange 'Pool deck, MarvelCDB decklist 34506 "Invoke the Fourth Wall, Break the Game"
 * (fixture `fixtures/decklists/doctor-strange-invoke-the-fourth-wall.json`, saved unmodified), brief in
 * docs/custom-deck-testing.md "Waiting on packs".
 *
 * The author's strategy, line by line (each is one `describe`):
 *  1. resolve a couple of Invocations, then Mulligan (44048) to draw a new hand;
 *  2. Get Rage-y (44020) readies Wong (09002) to reach the right Invocation;
 *  3. Stick-To-Itiveness (44030) readies the hero for another Invocation;
 *  4. Machine Man (26022) spends spare resources for a good activation.
 * Then the loop question: do the readies chain without limit inside one turn?
 *
 * Sources, kept apart:
 *  - OFFICIAL, RRG 1.8: "Play, Put into Play" p. 32 (a card is played from hand, paying its cost; "A card that is put
 *    into play is not considered to have been played"), "Ready" p. 36 (an exhausted card returns to the ready state),
 *    "Resolve" p. 37 (an event is resolved when it is played; other card types are never "resolved", but their
 *    abilities can be), "Limit X per [period]" (per-instance limits). RRG 1.8 has no general infinite-loop rule
 *    (checked 2026-10-01, docs/custom-deck-testing.md), and marvel-champions-rulings-post-rrg-1-7.md has none either.
 *  - PRINTED TEXT: quoted beside each test from the card data.
 *  - OUR INTERPRETATION: marked "Interpretation:" where the RRG does not say outright (e.g. that resolving an
 *    Invocation's Special through Spell Mastery is not "playing" a card for Mulligan's restriction).
 * Staging (a card put in play, spare Strength cards conjured to pay with) is state surgery for setup only.
 */
import { describe, expect, it, vi } from "vitest";
import {
  applyCommand,
  characterProfile,
  createGame,
  legalActions,
  replay,
  validateDeck,
  type GameState,
  type InstanceId,
} from "@mc/engine";
import { PLAYABLE_CARDS, type CoreAspect } from "@mc/content";
import { WAVE8_DEPS, wave8Scenario } from "./index.js";
import { playToOutcome } from "../testing/driver.js";
import {
  firstLegal,
  identityOf,
  inst,
  moveToHand,
  P1,
  patchInstance,
  payWith,
  picking,
  play,
  playerOf,
  runWith,
  settle,
  use,
  type Picker,
} from "../testing/harness.js";
import { withForm } from "../testing/staging.js";
import { stackInvocation } from "../wave1/drs/testing.js";
import {
  allyInPlay,
  attachedUpgrade,
  FIXTURE_TEXT,
  heroGame,
  importedDeck,
  invocationCodes,
  spellMastery,
  topInvocation,
  withFodder,
} from "./doctor-strange-pool-deck.helpers.js";

vi.setConfig({ testTimeout: 120_000 });

const WINDS = "09036"; // Special: Draw 3 cards. Cost 0.
const IKONN = "09033"; // Special: Confuse the villain and remove 4 threat from a scheme. Cost 1.
const CRIMSON = "09032"; // Special: Stun an enemy and deal 7 damage to it. Cost 2.
const WONG = "09002.wong-action";
const CLOAK = "09009.cloak-of-levitation-action";
const STICK = "44030.stick-to-itiveness-action";

const run = (s: GameState, ...c: Parameters<typeof runWith>[2][]): GameState => runWith(WAVE8_DEPS, s, ...c);
const done = (s: GameState, pick: Picker = firstLegal): GameState => settle(s, pick, undefined, WAVE8_DEPS);
const ok = (s: GameState, c: Parameters<typeof applyCommand>[1]): boolean => applyCommand(s, c, WAVE8_DEPS).ok;
const codeOf = (s: GameState, id: InstanceId): string => s.instances[id]!.cardId as string;
/** Wong's choice: option 0 heals 1, option 1 discards the top Invocation card (the labels are in the card script). */
const discardInvocation: Picker = () => ["1"];

describe("the decklist", () => {
  it("is the saved decklist 34506, and imports as a legal Doctor Strange 'Pool deck against the playable pool", () => {
    const raw = JSON.parse(FIXTURE_TEXT) as { id: number; hero_code: string; meta: string };
    expect(raw.id).toBe(34506);
    expect(raw.hero_code).toBe("09001a");
    expect(JSON.parse(raw.meta)).toEqual({ aspect: "pool" });
    const deck = importedDeck();
    expect(deck.identityCardId).toBe("09001a");
    expect(deck.aspects).toEqual(["pool"]);
    // RRG 1.8 Appendix I "Deck Customization", p. 50: 40 to 50 cards, the chosen aspect plus basic cards.
    expect(validateDeck(deck, PLAYABLE_CARDS)).toEqual({ ok: true });
    const qty = (code: string) => deck.cards.find((l) => l.cardId === code)?.quantity ?? 0;
    // The strategy's named cards are all in it.
    for (const code of ["44048", "44020", "09002", "44030", "26022", "44029"])
      expect(qty(code), code).toBeGreaterThan(0);
    expect(qty("44048")).toBe(2); // Mulligan x2
    expect(qty("09005")).toBe(2); // Master of the Mystic Arts x2
  });
});

describe("line 1: resolve a couple of Invocations, then Mulligan (44048)", () => {
  // Mulligan, printed: "You cannot play this card if you have played another card this phase.
  // Action: Discard your hand. Draw a new hand. (Draw up to your hand size.)" Cost 3.
  // Interpretation: resolving an Invocation through Spell Mastery uses a hero ability and plays no card (RRG p. 32:
  // cards are played from hand; the Invocation deck is not a hand), so it does not stop Mulligan. The strategy
  // depends on this, and the engine agrees.
  const staged = (): { state: GameState; cloak: InstanceId } => {
    let s = heroGame(3);
    const cloak = attachedUpgrade(s, "09009");
    s = withFodder(cloak.state, 4).state;
    return { state: stackInvocation(s, P1, WINDS, IKONN), cloak: cloak.id };
  };

  it("two Invocations resolve with no card played (Spell Mastery, Cloak of Levitation readies the hero), then Mulligan is legal and replaces the hand", () => {
    const { state, cloak } = staged();
    const handBefore = playerOf(state, P1).hand.length;
    // Winds of Watoomb, "Special: Draw 3 cards. Place this card in the Invocation deck discard pile." (cost 0)
    const first = done(run(state, spellMastery(state)));
    expect(playerOf(first, P1).hand).toHaveLength(handBefore + 3);
    expect(invocationCodes(first, "discard")).toContain(WINDS);
    expect(inst(first, identityOf(first)).exhausted).toBe(true);
    // Cloak of Levitation, "Hero Action: Exhaust Cloak of Levitation -> ready Doctor Strange."
    const readied = run(first, use(P1, cloak, CLOAK));
    expect(inst(readied, identityOf(readied)).exhausted).toBe(false);
    // Images of Ikonn (cost 1): "Confuse the villain and remove 4 threat from a scheme."
    const pay = playerOf(readied, P1)
      .hand.filter((i) => codeOf(readied, i) === "01090")
      .slice(0, 1);
    const second = done(run(readied, spellMastery(readied, pay)));
    expect(invocationCodes(second, "discard")).toEqual(expect.arrayContaining([WINDS, IKONN]));
    // Now Mulligan: nothing has been played this phase.
    const given = moveToHand(second, P1, "44048");
    const mull = given.ids[0]!;
    const oldHand = playerOf(given.state, P1).hand.filter((i) => i !== mull);
    const paid = payWith(given.state, P1, 3, [mull]);
    const after = done(run(given.state, play(P1, mull, paid)));
    const owner = playerOf(after, P1);
    // "Draw up to your hand size": hero form is 5 (Sorcerer Supreme, +1 in hero form, is not in play).
    expect(owner.hand).toHaveLength(5);
    for (const id of oldHand) expect(owner.hand).not.toContain(id);
    for (const id of oldHand) expect(owner.discard).toContain(id);
  });

  it("a card played earlier in the phase makes Mulligan illegal: playing Master of the Mystic Arts or Get Rage-y first forecloses it", () => {
    const { state } = staged();
    const withMull = moveToHand(state, P1, "44048");
    const mull = withMull.ids[0]!;
    // Baseline: legal as the first card.
    expect(ok(withMull.state, play(P1, mull, payWith(withMull.state, P1, 3, [mull])))).toBe(true);
    // Get Rage-y (cost 0) played first -> Mulligan refused (the restriction is Mulligan's own printed text).
    const rage = moveToHand(withMull.state, P1, "44020");
    const wong = allyInPlay(rage.state, "09002");
    const playedRage = done(run(wong.state, play(P1, rage.ids[0]!, [])), picking(wong.id));
    expect(ok(playedRage, play(P1, mull, payWith(playedRage, P1, 3, [mull])))).toBe(false);
    // Master of the Mystic Arts is a played card too: the order is Mulligan first or not at all.
    const master = moveToHand(withMull.state, P1, "09005");
    const playedMaster = done(
      run(
        master.state,
        play(P1, master.ids[0]!, payWith(master.state, P1, 1, [mull, master.ids[0]!]), {
          costChoices: { invocation: [topInvocation(master.state)] },
        }),
      ),
    );
    expect(ok(playedMaster, play(P1, mull, payWith(playedMaster, P1, 3, [mull])))).toBe(false);
  });

  it("only one Mulligan can be played per phase: the second sees the first as another played card", () => {
    const { state } = staged();
    const two = moveToHand(moveToHand(state, P1, "44048").state, P1, "44048");
    const [a, b] = two.ids as [InstanceId, InstanceId];
    const first = done(run(two.state, play(P1, a, payWith(two.state, P1, 3, [a, b]))));
    // `b` was discarded with the rest of the hand by the first Mulligan, so fetch the other copy back to hand.
    const again = moveToHand(first, P1, "44048");
    expect(ok(again.state, play(P1, again.ids[0]!, payWith(again.state, P1, 3, again.ids)))).toBe(false);
  });
});

describe("line 2: Get Rage-y (44020) readies Wong (09002) to reach the right Invocation", () => {
  // Wong, printed: "Action: Exhaust Wong -> choose to either heal 1 damage from your identity or discard the top card
  // of the Invocation deck." Get Rage-y, printed: "Max 1 per deck. Action: Ready an ally. That ally gets +1 ATK until
  // the end of the phase." Cost 0. RRG 1.8 "Ready" p. 36.
  it("Wong digs two cards down the Invocation deck in one turn, then Spell Mastery resolves the card it reached", () => {
    let s = heroGame(5);
    const wong = allyInPlay(s, "09002");
    s = withFodder(wong.state, 2).state;
    s = stackInvocation(s, P1, CRIMSON, WINDS, IKONN);
    const once = done(run(s, use(P1, wong.id, WONG)), discardInvocation);
    expect(inst(once, wong.id).exhausted).toBe(true);
    expect(invocationCodes(once, "deck").slice(0, 2)).toEqual([WINDS, IKONN]);
    expect(ok(once, use(P1, wong.id, WONG))).toBe(false); // exhausted: it is the cost
    const rage = moveToHand(once, P1, "44020");
    const atkBefore = characterProfile(rage.state, wong.id, WAVE8_DEPS)!.atk;
    const readied = done(run(rage.state, play(P1, rage.ids[0]!, [])), picking(wong.id));
    expect(inst(readied, wong.id).exhausted).toBe(false);
    expect(characterProfile(readied, wong.id, WAVE8_DEPS)!.atk).toBe(atkBefore + 1);
    expect(playerOf(readied, P1).discard).toContain(rage.ids[0]);
    const twice = done(run(readied, use(P1, wong.id, WONG)), discardInvocation);
    expect(invocationCodes(twice, "discard")).toEqual(expect.arrayContaining([CRIMSON, WINDS]));
    expect(invocationCodes(twice, "deck")[0]).toBe(IKONN);
    // The right Invocation is on top; Spell Mastery pays its cost 1 and resolves it.
    const pay = playerOf(twice, P1)
      .hand.filter((i) => codeOf(twice, i) === "01090")
      .slice(0, 1);
    const resolved = done(run(twice, spellMastery(twice, pay)));
    expect(invocationCodes(resolved, "discard")).toContain(IKONN);
    expect(ok(resolved, use(P1, wong.id, WONG))).toBe(false); // Wong is out of readies this turn (one Get Rage-y per deck)
  });
});

describe("line 3: Stick-To-Itiveness (44030) readies the hero for another Invocation", () => {
  // Printed: "Max 1 per deck. Hero Action: Spend a [physical] resource and exhaust this card -> ready your hero."
  const base = () => {
    let s = heroGame(7);
    const stick = attachedUpgrade(s, "44030");
    s = withFodder(stick.state, 3).state;
    const mental = withFodder(s, 1, "01089"); // Genius: [mental]
    return { state: stackInvocation(mental.state, P1, WINDS, IKONN), stick: stick.id, mental: mental.ids[0]! };
  };
  const strength = (s: GameState) => playerOf(s, P1).hand.filter((i) => codeOf(s, i) === "01090");

  it("after Spell Mastery exhausts the hero, Stick spends a physical resource and exhausts to ready the hero for a second Invocation", () => {
    const { state, stick } = base();
    const first = done(run(state, spellMastery(state)));
    expect(inst(first, identityOf(first)).exhausted).toBe(true);
    const [phys] = strength(first) as [InstanceId];
    const readied = run(first, use(P1, stick, STICK, [{ fromHand: phys }]));
    expect(inst(readied, identityOf(readied)).exhausted).toBe(false);
    expect(inst(readied, stick).exhausted).toBe(true);
    expect(playerOf(readied, P1).discard).toContain(phys); // the spent resource card
    const second = done(run(readied, spellMastery(readied, strength(readied).slice(0, 1))));
    expect(invocationCodes(second, "discard")).toEqual(expect.arrayContaining([WINDS, IKONN]));
  });

  it("the cost is real: a [mental] resource does not pay it, and a second use needs the card to refresh (it is exhausted)", () => {
    const { state, stick, mental } = base();
    const first = done(run(state, spellMastery(state)));
    expect(ok(first, use(P1, stick, STICK, [{ fromHand: mental }]))).toBe(false);
    const [phys, phys2] = strength(first) as [InstanceId, InstanceId];
    const readied = run(first, use(P1, stick, STICK, [{ fromHand: phys }]));
    const exhaustedAgain = done(run(readied, spellMastery(readied, strength(readied).slice(0, 1))));
    expect(ok(exhaustedAgain, use(P1, stick, STICK, [{ fromHand: phys2 }]))).toBe(false);
    expect(inst(exhaustedAgain, identityOf(exhaustedAgain)).exhausted).toBe(true);
  });

  it("it is a Hero Action: in alter-ego form it cannot be used (printed text)", () => {
    const { state, stick } = base();
    const first = done(run(state, spellMastery(state)));
    const ego = withForm(first, "alterEgo");
    const [phys] = strength(ego) as [InstanceId];
    expect(ok(ego, use(P1, stick, STICK, [{ fromHand: phys }]))).toBe(false);
  });
});

describe("line 4: Machine Man (26022) spends extra resources for a stronger activation", () => {
  // Printed: "Interrupt: When Machine Man attacks or thwarts, spend up to 3 resources of any type -> Machine Man gets +1
  // THW and +1 ATK for this use for each resource spent this way." ATK 1, THW 1. Staged by playing him from hand
  // (cost 2); his own ability is the behavior under test.
  const attackWith = (spend: number, fodderCode = "01090", damage = 0) => {
    let s = heroGame(11);
    s = patchInstance(s, identityOf(s), { damage });
    const given = moveToHand(s, P1, "26022");
    const mm = given.ids[0]!;
    s = withFodder(given.state, 7, fodderCode).state;
    s = done(run(s, play(P1, mm, payWith(s, P1, 2, [mm]))));
    s = { ...s, instances: { ...s.instances, [mm]: { ...s.instances[mm]!, exhausted: false } } };
    const villain = s.activeVillainId!;
    // Unus starts with a tough status card (RRG 1.8 "Tough", it prevents the next damage): staging, so damage lands.
    s = {
      ...s,
      instances: {
        ...s.instances,
        [villain]: { ...s.instances[villain]!, statuses: { stunned: 0, confused: 0, tough: 0 } },
      },
    };
    const spare = playerOf(s, P1)
      .hand.filter((i) => codeOf(s, i) === fodderCode)
      .slice(0, spend);
    const atk = characterProfile(s, mm, WAVE8_DEPS)!.atk;
    const pick: Picker = (st) => {
      const choice = st.pendingChoice;
      if (!choice) return [];
      const offered = choice.options.find((o) => o.optionId.endsWith("26022.machine-man-interrupt"));
      if (offered) return spend > 0 ? [offered.optionId] : firstLegal(st);
      const hand = choice.options.filter((o) => spare.some((id) => o.optionId === `hand:${id}`));
      return hand.length > 0 ? hand.map((o) => o.optionId).slice(0, choice.maxSelections) : firstLegal(st);
    };
    const before = inst(s, villain).damage;
    const after = done(
      run(s, { type: "basicAttack", playerId: P1, attackerInstanceId: mm, targetInstanceId: villain }),
      pick,
    );
    return { atk, dealt: inst(after, villain).damage - before, after, spare };
  };

  it("spending 3 resources adds 3 ATK to the one attack; spending none leaves his printed ATK", () => {
    const none = attackWith(0);
    expect(none.dealt).toBe(none.atk);
    const three = attackWith(3);
    expect(three.dealt).toBe(three.atk + 3);
    for (const id of three.spare) expect(playerOf(three.after, P1).discard).toContain(id);
  });

  it("'up to 3': four spare resources offered, no more than three can be spent (the bonus is capped at +3)", () => {
    const capped = attackWith(4);
    expect(capped.dealt).toBe(capped.atk + 3);
  });

  // Interpretation (not an RRG sentence): Self Confidence (44025) prints "Double the number of resources this card
  // generates if your identity has sustained less than 5 damage (triple the resources instead if you have sustained no
  // damage)", so one undamaged Doctor Strange spending it for Machine Man is spending 3 resources ("spend up to 3
  // resources"), RRG 1.8 "Resource Card" p. 37: resource cards exist to be discarded to generate resources.
  it("one Self Confidence spent counts as three resources at no damage (+3 ATK), two with some damage (+2), one at 5 or more (+1)", () => {
    expect(attackWith(1, "44025").dealt).toBe(attackWith(1, "44025").atk + 3);
    const hurt = attackWith(1, "44025", 2);
    expect(hurt.dealt).toBe(hurt.atk + 2);
    const worse = attackWith(1, "44025", 5);
    expect(worse.dealt).toBe(worse.atk + 1);
  });
});

describe("the loop question: do the readies chain without limit in one turn?", () => {
  // Every ready in the deck, by printed text:
  //   Cloak of Levitation (09009)  Hero Action: Exhaust Cloak -> ready Doctor Strange        (x1 in the deck)
  //   Stick-To-Itiveness (44030)   Hero Action: Spend [physical] and exhaust -> ready your hero (x1)
  //   Get Rage-y (44020)           Action: Ready an ally (Wong, who discards the top Invocation)   (x1, an event)
  // None of them readies another of these upgrades, and Spell Mastery exhausts the hero, so the hero resolves at most
  // 1 (base) + 1 (Cloak) + 1 (Stick) = 3 Invocations per turn. Master of the Mystic Arts (09005, x2, an event with
  // cost 1) resolves the top Invocation without exhausting anyone and puts it back on top, so with Winds of Watoomb
  // (draw 3, cost 0) on top it draws 3 per copy: bounded by the two copies, since nothing returns an event from the
  // discard pile to hand. Mulligan is limited to one per phase by its own printed text (line 1).
  // RRG 1.8 has no infinite-loop rule and the rulings file has none; the bound here is simply the printed costs.
  const MAX_STEPS = 200;

  /** Everything staged at once: Wong, Cloak and Stick in play, Get Rage-y and both Masters in hand, ample payment. */
  const loaded = () => {
    let s = heroGame(21);
    const wong = allyInPlay(s, "09002");
    const cloak = attachedUpgrade(wong.state, "09009");
    const stick = attachedUpgrade(cloak.state, "44030");
    s = withFodder(stick.state, 14).state;
    s = moveToHand(s, P1, "09005", "09005", "44020").state;
    return { state: stackInvocation(s, P1, WINDS, IKONN, CRIMSON), wong: wong.id, cloak: cloak.id, stick: stick.id };
  };

  /** One greedy step: the first legal use of any ready-or-resolve action, preferring the loop pieces. */
  function step(
    s: GameState,
    ids: { wong: InstanceId; cloak: InstanceId; stick: InstanceId },
    tally: Record<string, number>,
  ) {
    const fodder = () => playerOf(s, P1).hand.filter((i) => codeOf(s, i) === "01090");
    const top = invocationCodes(s, "deck")[0];
    const cost = top === CRIMSON ? 2 : top === IKONN || top === "09034" ? 1 : 0;
    const rage = playerOf(s, P1).hand.find((i) => codeOf(s, i) === "44020");
    const master = playerOf(s, P1).hand.find((i) => codeOf(s, i) === "09005");
    const candidates: { name: string; cmd: Parameters<typeof applyCommand>[1]; pick?: Picker }[] = [
      { name: "spellMastery", cmd: spellMastery(s, fodder().slice(0, cost)) },
      { name: "cloak", cmd: use(P1, ids.cloak, CLOAK) },
      {
        name: "stick",
        cmd: use(
          P1,
          ids.stick,
          STICK,
          fodder()
            .slice(0, 1)
            .map((fromHand) => ({ fromHand })),
        ),
      },
      { name: "wong", cmd: use(P1, ids.wong, WONG), pick: discardInvocation },
      ...(rage ? [{ name: "rage", cmd: play(P1, rage, []), pick: picking(ids.wong) }] : []),
      ...(master
        ? [
            {
              name: "master",
              cmd: play(P1, master, fodder().slice(0, 1), { costChoices: { invocation: [topInvocation(s)] } }),
            },
          ]
        : []),
    ];
    for (const c of candidates) {
      if (!ok(s, c.cmd)) continue;
      tally[c.name] = (tally[c.name] ?? 0) + 1;
      return done(run(s, c.cmd), c.pick ?? firstLegal);
    }
    return null;
  }

  it("a greedy player who takes every legal ready runs out of actions after a fixed number of steps, far below any cap", () => {
    const { state, ...ids } = loaded();
    const tally: Record<string, number> = {};
    let s = state;
    let steps = 0;
    for (; steps < MAX_STEPS; steps++) {
      const next = step(s, ids, tally);
      if (!next) break;
      s = next;
    }
    expect(steps).toBeLessThan(MAX_STEPS);
    // Spell Mastery: base, Cloak, Stick. Wong: base, Get Rage-y. Each ready exactly once; both Masters.
    expect(tally["cloak"]).toBe(1);
    expect(tally["stick"]).toBe(1);
    expect(tally["rage"]).toBe(1);
    expect(tally["wong"]).toBeLessThanOrEqual(2);
    expect(tally["spellMastery"]).toBeLessThanOrEqual(3);
    expect(tally["master"]).toBeLessThanOrEqual(2);
    expect(steps).toBeLessThanOrEqual(12);
    // Terminal state: the hero, Cloak, Stick and Wong are exhausted, and no repeat of any of them is legal.
    expect(inst(s, identityOf(s)).exhausted).toBe(true);
    for (const id of [ids.cloak, ids.stick, ids.wong]) expect(inst(s, id).exhausted).toBe(true);
    expect(ok(s, use(P1, ids.cloak, CLOAK))).toBe(false);
    expect(ok(s, use(P1, ids.wong, WONG))).toBe(false);
    // The engine settled with no pending choice and a finite legal-action set.
    expect(s.pendingChoice).toBeNull();
    const actions = legalActions(s, P1, WAVE8_DEPS);
    expect(actions.kind).toBe("turn");
    if (actions.kind === "turn") {
      expect(actions.legal.length).toBeLessThan(200);
      expect(JSON.stringify(actions.legal)).not.toContain("spell-mastery");
    }
  });

  it("Master of the Mystic Arts with Winds of Watoomb on top draws 3 per copy and keeps Winds on top, but only two copies exist", () => {
    // Master: "Hero Action: Pay the printed cost of the top card of the Invocation deck -> resolve its 'Special'
    // ability. Then, place it back on top of the Invocation deck faceup." Winds of Watoomb costs 0.
    let s = heroGame(23);
    s = withFodder(s, 4).state;
    s = stackInvocation(s, P1, WINDS);
    s = moveToHand(s, P1, "09005", "09005").state;
    const masters = playerOf(s, P1).hand.filter((i) => codeOf(s, i) === "09005");
    expect(masters).toHaveLength(2);
    let handNow = playerOf(s, P1).hand.length;
    for (const m of masters) {
      const pay = payWith(s, P1, 1, masters);
      s = done(run(s, play(P1, m, pay, { costChoices: { invocation: [topInvocation(s)] } })));
      expect(invocationCodes(s, "deck")[0]).toBe(WINDS);
      // -1 Master played, -1 paid card, +3 drawn.
      expect(playerOf(s, P1).hand.length).toBe(handNow - 2 + 3);
      handNow = playerOf(s, P1).hand.length;
    }
    expect(inst(s, identityOf(s)).exhausted).toBe(false); // no exhaust anywhere in this loop piece
    expect(playerOf(s, P1).hand.some((i) => codeOf(s, i) === "09005")).toBe(false);
    // The deck is 40 cards: two Masters drawing 3 each cannot empty it.
    expect(playerOf(s, P1).deck.length).toBeGreaterThan(20);
  });
});

describe("a seeded greedy game with the deck", () => {
  const contents = importedDeck();
  const config = wave8Scenario("dark-beast", {
    seed: 91,
    players: [
      {
        identityCardId: contents.identityCardId,
        deck: contents.cards.flatMap(({ cardId: id, quantity }) => Array.from({ length: quantity }, () => id)),
        aspects: contents.aspects as readonly CoreAspect[],
      },
    ],
  });

  it("plays to an outcome (or the command cap) without hanging, and the log replays deep-equal", () => {
    const created = createGame({ ...config, cards: PLAYABLE_CARDS }, WAVE8_DEPS);
    if (!created.ok) throw new Error(`setup failed: ${created.error.message}`);
    const result = playToOutcome(created.state, WAVE8_DEPS, { maxCommands: 4000 });
    expect(result.rounds).toBeGreaterThanOrEqual(1);
    expect(result.outcome !== null || result.commands >= 4000).toBe(true);
    const replayed = replay(result.session.log, WAVE8_DEPS);
    expect(replayed.ok).toBe(true);
    if (replayed.ok) expect(replayed.state).toEqual(result.session.state);
  });
});
