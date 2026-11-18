import { cardId } from "@mc/content";
import { activeEncounterDeck, cardsInPlay } from "@mc/engine";
import { describe, expect, it } from "vitest";
import {
  answer,
  endTurn,
  firstLegal,
  identityOf,
  inst,
  mainThreat,
  moveToHand,
  P1,
  P2,
  patchInstance,
  payWith,
  play,
  playerOf,
  run,
  runWith,
  settle,
  settleUntil,
  stackEncounterDeck,
  toHero,
  type Picker,
} from "../../../testing/harness.js";
import { conjure, playOut, rhino } from "../../../testing/qa-bench.js";
import { moveToDiscard, stackSetAside, withDamage, withForm } from "../../../testing/staging.js";
import { game, villainOf } from "../../../wave7/rulings-2026-10-06-harness.js";
import { playFromHand, startWave5Game, WAVE5_DEPS } from "../../testing.js";
import { ghostSpiderScenario } from "./support.js";

const ghostSpiderVsRhino = (seed = 1) => startWave5Game(ghostSpiderScenario("rhino", { seed }));

describe("Ghost-Spider's events, part B (27013–27019)", () => {
  it("27013.bait-and-switch-action: the villain attacks you (undefended), then removes 4 threat from the main scheme", () => {
    const state = ghostSpiderVsRhino();
    const given = moveToHand(run(state, toHero(P1)), P1, "27013");
    const [card] = given.ids as [never];
    const identity = identityOf(given.state);
    const mainScheme = given.state.mainScheme.instanceId;
    const staged = patchInstance(given.state, mainScheme, { threat: 8 });
    const damageBefore = inst(staged, identity).damage;
    const atDeclare = settleUntil(
      runWith(WAVE5_DEPS, staged, play(P1, card, payWith(staged, P1, 1, [card]))),
      "declareDefender",
      firstLegal,
      WAVE5_DEPS,
    );
    const declined = answer(atDeclare, ["decline"], WAVE5_DEPS); // undefended: Rhino's printed ATK 2 lands in full.
    const after = settle(declined, firstLegal, undefined, WAVE5_DEPS);
    expect(inst(after, identity).damage).toBe(damageBefore + 2);
    expect(mainThreat(after)).toBe(8 - 4);
  });

  it("27014.jump-flip-interrupt: prevents 2 damage, and removes 2 threat from the main scheme when paid with an [energy] resource", () => {
    const state = ghostSpiderVsRhino();
    // Jump Flip itself, and Bait and Switch (27013, an [energy] resource icon) to pay with.
    const given = moveToHand(run(state, toHero(P1)), P1, "27014", "27013");
    const [jumpFlip, payment] = given.ids as [never, never];
    const identity = identityOf(given.state);
    const mainScheme = given.state.mainScheme.instanceId;
    // Below the main scheme's own target threat (7 at 1 player) — high enough to observe the full 2-point removal,
    // low enough that reaching the villain phase doesn't complete it and end the game first.
    const staged = patchInstance(given.state, mainScheme, { threat: 5 });
    // Advance (0 boost icons): Rhino attacks with its printed ATK 2 only (the same neutral stack
    // `wave2/scw/kit.test.ts`'s own "Magic Shield" test uses for an undefended Rhino attack).
    const stacked = stackEncounterDeck(staged, "01186");
    const damageBefore = inst(stacked, identity).damage;
    const option = `${jumpFlip}:27014.jump-flip-interrupt`;
    const pick: Picker = (s) => {
      const choice = s.pendingChoice;
      if (!choice) return [];
      if (choice.options.some((o) => o.optionId === option)) return [option];
      if (choice.prompt.kind === "payForCard" && choice.prompt.instanceId === jumpFlip) return [`hand:${payment}`];
      return firstLegal(s);
    };
    const atDeclare = settleUntil(runWith(WAVE5_DEPS, stacked, endTurn(P1)), "declareDefender", firstLegal, WAVE5_DEPS);
    const declined = answer(atDeclare, ["decline"], WAVE5_DEPS); // undefended: Rhino's printed ATK 2 lands in full.
    // Advance's own "When Revealed: the villain schemes" resolves too (RRG 1.8 "Boost Card", p. 11: a boost card's
    // own text resolves same as any other reveal) — measured here, right before Jump Flip's own interrupt fires,
    // rather than assumed, since it lands Rhino's SCH (1) on the main scheme before the attack finishes.
    const threatBefore = mainThreat(declined);
    const after = settle(declined, pick, undefined, WAVE5_DEPS);
    // Rhino's printed ATK 2, undefended, minus Jump Flip's 2 prevented = 0.
    expect(inst(after, identity).damage).toBe(damageBefore);
    expect(mainThreat(after)).toBe(threatBefore - 2);
    expect(playerOf(after, P1).discard).toContain(jumpFlip);
  });

  it("27015.return-the-favor-action: discards from the top of the encounter deck until a treachery, then deals 5 damage to the villain", () => {
    const state = ghostSpiderVsRhino();
    const given = moveToHand(run(state, toHero(P1)), P1, "27015");
    const [card] = given.ids as [never];
    const villain = given.state.villains[0]!.instanceId;
    // Advance (01186) is itself a treachery (0 boost icons, "the villain schemes"): stacked on top, it is both the
    // first card discarded and the treachery that ends the search, so no other card needs staging beneath it.
    const stacked = stackEncounterDeck(given.state, "01186");
    const damageBefore = inst(stacked, villain).damage;
    const after = settle(
      runWith(WAVE5_DEPS, stacked, play(P1, card, payWith(stacked, P1, 0, [card]))),
      firstLegal,
      undefined,
      WAVE5_DEPS,
    );
    expect(inst(after, villain).damage).toBe(damageBefore + 5);
    expect(playerOf(after, P1).discard).toContain(card);
  });

  // Ruling 2026-04-30 (April 30, 2026 - Ruling 5): "If a treachery revealed in Step 5 Stuns the hero, the Stun card is
  // discarded in Step 6 instead of dealing damage." RRG 1.8 "Initiating Abilities" (p. 24), "Labeled Ability" (p. 26).
  // Owner decision 2026-10-16 (audit finding 13), superseding the 2026-10-08 behavior (the attack began before the
  // cost, so the stun stayed and the 5 damage was dealt). Real cards: Core Spider-Man's Sweeping Swoop (01168, "When
  // Revealed: Stun your hero"), set aside in a Rhino game and put on top of the encounter deck.
  it("27015.return-the-favor-action: a treachery revealed by the cost stuns the hero, so the stun is discarded instead of the 5 damage; the cost stays paid (ruling 2026-04-30; owner decision 2026-10-16 (audit finding 13))", () => {
    const given = conjure(stackSetAside(rhino(), "01168"), "27015");
    const hero = identityOf(given.state);
    const villain = given.state.activeVillainId!;
    const swoop = activeEncounterDeck(given.state).deck[0]!;
    const damageBefore = inst(given.state, villain).damage;
    const done = playOut(given.state, given.id, 0);
    expect(done.accepted).toBe(true);
    const stunned = done.events.findIndex(
      (e) => e.type === "statusGiven" && e.instanceId === hero && e.status === "stunned",
    );
    const discarded = done.events.findIndex(
      (e) => e.type === "statusRemoved" && e.instanceId === hero && e.reason === "cancelledAttack",
    );
    expect(stunned).toBeGreaterThanOrEqual(0);
    expect(discarded).toBeGreaterThan(stunned);
    expect(inst(done.state, hero).statuses.stunned).toBe(0);
    expect(inst(done.state, villain).damage).toBe(damageBefore);
    expect(
      done.events.some((e) => e.type === "triggerEvent" && e.phase === "initiated" && e.event.kind === "attack"),
    ).toBe(false);
    // The cost is not undone: Sweeping Swoop was discarded and revealed, and stays in the encounter discard pile.
    expect(activeEncounterDeck(done.state).discard).toContain(swoop);
    expect(activeEncounterDeck(done.state).deck).not.toContain(swoop);
    expect(playerOf(done.state, P1).discard).toContain(given.id);
  });

  // Ruling April 30, 2026 (5): the effect is initiated in step 6, after the cost, so a guard minion engaged while
  // paying
  // the cost stops the attack. RRG 1.8 "Initiating Abilities" (p. 24); owner decision 2026-11-15 (#525 item 6): guard
  // is checked as the attack is initiated. Mutagen Formula: P1's setup Goblin Thrall (02024, guard) is disengaged, and
  // the cost reveals Advance (01186), whose scheme deals the next card, a Goblin Thrall, as a boost that engages it.
  it("27015.return-the-favor-action: a guard minion engaged while paying the cost stops the 5 damage to the villain (ruling 2026-04-30)", () => {
    const s = game("mutagen-formula", ["core-spider-man-justice"], ["bomb_scare"], 13);
    const thrall = Object.values(s.instances).find((i) => i.cardId === cardId("02024") && i.engagedWith === P1)!;
    const free = patchInstance(s, thrall.instanceId, { engagedWith: null });
    const calm = patchInstance(free, free.mainScheme.instanceId, { threat: 0 });
    const given = conjure(stackEncounterDeck(calm, "01186", "02024"), "27015");
    const villain = villainOf(given.state);
    const damageBefore = inst(given.state, villain).damage;
    const done = playOut(given.state, given.id, 0);
    expect(done.accepted).toBe(true);
    const engaged = Object.values(done.state.instances).filter(
      (i) => i.cardId === cardId("02024") && i.engagedWith === P1,
    );
    expect(engaged.length).toBeGreaterThan(0);
    expect(inst(done.state, villain).damage).toBe(damageBefore);
  });

  it("27015.return-the-favor-action, control: a treachery that stuns nobody (Advance) is revealed, then the 5 damage is dealt", () => {
    // No threat on the main scheme, so Advance's "the villain schemes" does not complete it and end the game.
    const start = rhino();
    const calm = patchInstance(start, start.mainScheme.instanceId, { threat: 0 });
    const given = conjure(stackEncounterDeck(calm, "01186"), "27015");
    const hero = identityOf(given.state);
    const villain = given.state.activeVillainId!;
    const damageBefore = inst(given.state, villain).damage;
    const done = playOut(given.state, given.id, 0);
    expect(done.accepted).toBe(true);
    expect(inst(done.state, hero).statuses.stunned).toBe(0);
    expect(inst(done.state, villain).damage).toBe(damageBefore + 5);
  });

  // FFG ruling, RRG 1.0-1.4 (docs/rulings/rrg-1-0-to-1-4/36-adam-warlock.md): Return the Favor's revealed treachery
  // "should be considered as having come from the encounter deck", so Enhanced Spider-Sense can cancel its When
  // Revealed and the 5 damage is still dealt. Not contradicted by ruling September 14, 2026 - Ruling 1.
  it("27015.return-the-favor-action: its revealed treachery counts as from the encounter deck, so Enhanced Spider-Sense (01004) cancels its stun and the 5 damage lands", () => {
    const start = conjure(stackSetAside(rhino(), "01168"), "27015");
    const sense = moveToHand(start.state, P1, "01004");
    const hero = identityOf(sense.state);
    const villain = sense.state.activeVillainId!;
    const damageBefore = inst(sense.state, villain).damage;
    const done = playOut(sense.state, start.id, 0, { use: ["01004.enhanced-spider-sense-interrupt"], pay: 1 });
    expect(done.accepted).toBe(true);
    expect(playerOf(done.state, P1).discard).toContain(sense.ids[0]);
    expect(done.events.some((e) => e.type === "statusGiven" && e.instanceId === hero && e.status === "stunned")).toBe(
      false,
    );
    expect(inst(done.state, villain).damage).toBe(damageBefore + 5);
  });

  it("27016.what-doesnt-kill-me-action: heals 2 damage from your hero, then readies it", () => {
    const state = ghostSpiderVsRhino();
    // Strength (27022, [physical][physical]) pays the printed Requirement ([physical]) in one card.
    const given = moveToHand(run(state, toHero(P1)), P1, "27016", "27022");
    const [card, strength] = given.ids as [never, never];
    const identity = identityOf(given.state);
    const damaged = withDamage(given.state, identity, 4);
    const exhausted = patchInstance(damaged, identity, { exhausted: true });
    const after = settle(runWith(WAVE5_DEPS, exhausted, play(P1, card, [strength])), firstLegal, undefined, WAVE5_DEPS);
    expect(inst(after, identity).damage).toBe(2);
    expect(inst(after, identity).exhausted).toBe(false);
  });

  it("27018.across-the-spider-verse-action: exhausts a Web-Warrior card, finds an ally in the discard pile, and may repeat for a chosen player", () => {
    const state = ghostSpiderVsRhino();
    const hero = run(state, toHero(P1));
    const identity = identityOf(hero);
    // Spider-Man (Miles Morales, 27011) and Silk (27010): Web-Warrior allies, discarded so the search has something to
    // find, and so one is still in the discard pile for the repeat (it is only offered with one there).
    const withMilesDiscarded = moveToDiscard(hero, P1, "27011");
    const miles = withMilesDiscarded.id;
    const withBoth = moveToDiscard(withMilesDiscarded.state, P1, "27010");
    const silk = withBoth.id;
    const given = moveToHand(withBoth.state, P1, "27018");
    const [card] = given.ids as [never];
    let repeats = 0;
    // Repeat exactly once: the repeat's own exhaust step falls to Miles Morales (Ghost-Spider is already
    // exhausted from the first sentence), and its own search finds nothing (he's already in play) — proving the
    // loop actually re-runs the whole "exhaust / search / put into play" sentence, not just the "choose a player"
    // tail, matching the FAQ's "repeating the ability … includes the repeat effect itself" (RRG 1.8 p. 62/63).
    const pick: Picker = (s) => {
      const choice = s.pendingChoice;
      if (!choice) return [];
      const prompt = choice.prompt;
      if (prompt.kind === "chooseCards" && prompt.slot === "found") {
        return choice.options.slice(0, choice.maxSelections).map((o) => o.optionId);
      }
      if (prompt.kind === "chooseOption") {
        const wantsRepeat = repeats < 1;
        const label = wantsRepeat ? "Spend 3 resources of any type to repeat" : "Do not repeat";
        const found = choice.options.find((o) => o.label === label);
        if (found) {
          if (wantsRepeat) repeats++;
          return [found.optionId];
        }
      }
      // "Spend 3 resources of any type" — pay it in full (`firstLegal`'s own `minSelections: 0` here would
      // otherwise decline the spend for free, the same `payForCard` pitfall `events-a.test.ts`'s own `accepting`
      // works around).
      if (prompt.kind === "spendResources") {
        return choice.options.slice(0, 3).map((o) => o.optionId);
      }
      return firstLegal(s);
    };
    const after = settle(
      runWith(WAVE5_DEPS, given.state, play(P1, card, payWith(given.state, P1, 2, [card]))),
      pick,
      undefined,
      WAVE5_DEPS,
    );
    expect(inst(after, identity).exhausted).toBe(true); // the printed sentence's own exhaust
    // Both allies were found (one per pass); the first one found is exhausted by the repeat, the second enters ready.
    expect(cardsInPlay(after)).toContain(miles);
    expect(cardsInPlay(after)).toContain(silk);
    expect([miles, silk].filter((id) => inst(after, id).exhausted)).toHaveLength(1);
    expect(repeats).toBe(1);
  });

  // FFG ruling 2023-12-08 (docs/rulings/post-rrg-1-5/08-december-2023.md): no Web-Warrior ally in the chosen player's
  // discard pile after the first pass means the repeat is not offered; with one there, it is.
  it("27018.across-the-spider-verse-action: the repeat is not offered when no Web-Warrior ally is left in the discard pile", () => {
    const hero = run(ghostSpiderVsRhino(), toHero(P1));
    const withMilesDiscarded = moveToDiscard(hero, P1, "27011"); // the only one: put into play by the first pass
    const given = moveToHand(withMilesDiscarded.state, P1, "27018");
    const [card] = given.ids as [never];
    const offered: string[] = [];
    const after = settle(
      runWith(WAVE5_DEPS, given.state, play(P1, card, payWith(given.state, P1, 2, [card]))),
      (s) => {
        const choice = s.pendingChoice;
        if (choice?.prompt.kind === "chooseOption") offered.push(...choice.options.map((o) => o.label));
        // The search is "min 0": take the ally found rather than letting firstLegal pick nothing.
        if (choice?.prompt.kind === "chooseCards" && choice.prompt.slot === "found") {
          return choice.options.slice(0, choice.maxSelections).map((o) => o.optionId);
        }
        return firstLegal(s);
      },
      undefined,
      WAVE5_DEPS,
    );
    expect(cardsInPlay(after)).toContain(withMilesDiscarded.id);
    expect(offered).not.toContain("Spend 3 resources of any type to repeat");
  });

  it("27018.across-the-spider-verse-action: the repeat is offered when a Web-Warrior ally is left in the discard pile", () => {
    const hero = run(ghostSpiderVsRhino(), toHero(P1));
    const withBoth = moveToDiscard(moveToDiscard(hero, P1, "27011").state, P1, "27010");
    const given = moveToHand(withBoth.state, P1, "27018");
    const [card] = given.ids as [never];
    const offered: string[] = [];
    settle(
      runWith(WAVE5_DEPS, given.state, play(P1, card, payWith(given.state, P1, 2, [card]))),
      (s) => {
        const choice = s.pendingChoice;
        if (choice?.prompt.kind === "chooseOption") offered.push(...choice.options.map((o) => o.label));
        // The search is "min 0": take the ally found rather than letting firstLegal pick nothing.
        if (choice?.prompt.kind === "chooseCards" && choice.prompt.slot === "found") {
          return choice.options.slice(0, choice.maxSelections).map((o) => o.optionId);
        }
        return firstLegal(s);
      },
      undefined,
      WAVE5_DEPS,
    );
    expect(offered).toContain("Spend 3 resources of any type to repeat");
  });

  // The chosen player's own repeat prerequisites (PR #820 review): P1 plays the event and chooses P2, so the repeat is
  // offered to P2 only with a ready Web-Warrior card and a Web-Warrior ally in P2's own discard pile (FFG ruling
  // 2023-12-08, docs/rulings/post-rrg-1-5/08-december-2023.md; RRG 1.8 FAQ p. 62/63: repeating includes the cost).
  const twoPlayerSpiderVerse = (p2Discard: boolean) => {
    const base = startWave5Game(
      ghostSpiderScenario("rhino", { seed: 1, extraPlayers: [{ starterDeckId: "spider-man-morales" }] }),
    );
    // P2 is in hero form so its identity (Spider-Man, Miles Morales) is a ready Web-Warrior card.
    const hero = withForm(run(base, toHero(P1)), { heroForm: 0 }, P2);
    // P1: Silk (27010) for the first pass (not Miles, who would meet P2's same-named unique identity); with a second
    // ally (Miles, 27011) when P2 has none, so "P1 has a target" cannot be what offers the repeat to P2.
    const p1Silk = moveToDiscard(hero, P1, "27010");
    const p1Staged = p2Discard ? p1Silk.state : moveToDiscard(p1Silk.state, P1, "27011").state;
    const p2Ally = p2Discard ? moveToDiscard(p1Staged, P2, "27041") : undefined; // Spider-Woman, a Web-Warrior ally.
    const given = moveToHand(p2Ally?.state ?? p1Staged, P1, "27018");
    return { given, p2Identity: identityOf(given.state, P2), p2Ally: p2Ally?.id, p1Ally: p1Silk.id };
  };
  const driveSpiderVerse = (setup: ReturnType<typeof twoPlayerSpiderVerse>) => {
    const [card] = setup.given.ids as [never];
    const offered: string[] = [];
    let paidWith = 0;
    const after = settle(
      runWith(WAVE5_DEPS, setup.given.state, play(P1, card, payWith(setup.given.state, P1, 2, [card]))),
      (s) => {
        const choice = s.pendingChoice;
        if (!choice) return [];
        const prompt = choice.prompt;
        if (prompt.kind === "choosePlayer") return [choice.options.find((o) => o.label === "p2")!.optionId];
        if (prompt.kind === "chooseOption") {
          offered.push(...choice.options.map((o) => o.label));
          const repeat = choice.options.find((o) => o.label === "Spend 3 resources of any type to repeat");
          if (repeat) return [repeat.optionId];
        }
        if (prompt.kind === "spendResources") {
          paidWith = Math.min(3, choice.options.length);
          return choice.options.slice(0, 3).map((o) => o.optionId);
        }
        if (prompt.kind === "chooseCards" && prompt.slot === "found") {
          return choice.options.slice(0, choice.maxSelections).map((o) => o.optionId);
        }
        return firstLegal(s);
      },
      undefined,
      WAVE5_DEPS,
    );
    return { after, offered, paidWith };
  };

  it("27018.across-the-spider-verse-action: a chosen P2 with a ready Web-Warrior card and an ally in P2's own discard is offered the repeat, pays 3 and exhausts P2's Web-Warrior card", () => {
    const setup = twoPlayerSpiderVerse(true);
    const handBefore = playerOf(setup.given.state, P2).hand.length;
    const { after, offered, paidWith } = driveSpiderVerse(setup);
    expect(offered).toContain("Spend 3 resources of any type to repeat");
    expect(paidWith).toBe(3);
    // P2 paid from P2's own hand, exhausted P2's own Web-Warrior identity, and the ally came from P2's discard.
    expect(playerOf(after, P2).hand.length).toBe(handBefore - 3);
    expect(inst(after, setup.p2Identity).exhausted).toBe(true);
    expect(playerOf(after, P2).discard).not.toContain(setup.p2Ally!);
    expect(cardsInPlay(after)).toContain(setup.p2Ally!);
    expect(cardsInPlay(after)).toContain(setup.p1Ally); // P1's own first pass found Silk, so the repeat is not the only pass
  });

  it("27018.across-the-spider-verse-action: the repeat is not offered to a chosen P2 with no ally in P2's own discard, even though P1 has one", () => {
    const setup = twoPlayerSpiderVerse(false);
    const { after, offered } = driveSpiderVerse(setup);
    expect(offered).not.toContain("Spend 3 resources of any type to repeat");
    expect(inst(after, setup.p2Identity).exhausted).toBe(false);
    expect(playerOf(after, P2).hand.length).toBe(playerOf(setup.given.state, P2).hand.length);
  });

  it("27018.across-the-spider-verse-action: not playable without a Web-Warrior ally in your discard pile", () => {
    const hero = run(ghostSpiderVsRhino(), toHero(P1));
    const given = moveToHand(hero, P1, "27018"); // Ghost-Spider (ready, a Web-Warrior card) could pay the exhaust
    const [card] = given.ids as [never];
    expect(() => runWith(WAVE5_DEPS, given.state, play(P1, card, payWith(given.state, P1, 2, [card])))).toThrow();
    const withAlly = moveToHand(moveToDiscard(hero, P1, "27011").state, P1, "27018");
    const [ok] = withAlly.ids as [never];
    expect(() => runWith(WAVE5_DEPS, withAlly.state, play(P1, ok, payWith(withAlly.state, P1, 2, [ok])))).not.toThrow();
  });

  it("27018.across-the-spider-verse-action: the exhaust is a cost, so with no ready Web-Warrior card the event is not playable", () => {
    const hero = run(ghostSpiderVsRhino(), toHero(P1));
    const identity = identityOf(hero);
    const given = moveToHand(moveToDiscard(hero, P1, "27011").state, P1, "27018");
    const [card] = given.ids as [never];
    const spent = patchInstance(given.state, identity, { exhausted: true });
    expect(() => runWith(WAVE5_DEPS, spent, play(P1, card, payWith(spent, P1, 2, [card])))).toThrow();
  });

  it("27018.across-the-spider-verse-action: the chosen Web-Warrior card is exhausted as the cost (an ally in play, the identity stays ready)", () => {
    const hero = run(ghostSpiderVsRhino(), toHero(P1));
    const identity = identityOf(hero);
    const { state: withAlly, id: ally } = playFromHand(hero, "27011", 4); // Spider-Man (Miles Morales), a Web-Warrior ally.
    // Silk (27010) in the discard pile satisfies the play condition (a Web-Warrior ally there).
    const given = moveToHand(moveToDiscard(withAlly, P1, "27010").state, P1, "27018");
    const [card] = given.ids as [never];
    const after = settle(
      runWith(
        WAVE5_DEPS,
        given.state,
        play(P1, card, payWith(given.state, P1, 2, [card]), { costChoices: { exhausted: [ally] } }),
      ),
      (s) =>
        s.pendingChoice?.prompt.kind === "chooseOption" ? [s.pendingChoice.options.at(-1)!.optionId] : firstLegal(s),
      undefined,
      WAVE5_DEPS,
    );
    expect(inst(after, ally).exhausted).toBe(true);
    expect(inst(after, identity).exhausted).toBe(false);
  });

  it("27019.young-love-action: heals 3 damage each from Gwen Stacy (the identity) and Miles Morales", () => {
    const state = ghostSpiderVsRhino();
    const { state: withMiles, id: miles } = playFromHand(state, "27011", 4); // Spider-Man (Miles Morales).
    const identity = identityOf(withMiles);
    const damaged = withDamage(withDamage(withMiles, identity, 5), miles, 2);
    const given = moveToHand(damaged, P1, "27019");
    const [card] = given.ids as [never];
    const after = settle(
      runWith(WAVE5_DEPS, given.state, play(P1, card, payWith(given.state, P1, 1, [card]))),
      firstLegal,
      undefined,
      WAVE5_DEPS,
    );
    expect(inst(after, identity).damage).toBe(2); // 5 - 3
    expect(inst(after, miles).damage).toBe(0); // 2 - 3, floored at 0
  });
});

// Text before a cost arrow is paid even when a stun or confuse status card replaces the labeled ability's effect
// (FFG ruling April 30, 2026 (5); RRG 1.8 "Cost Arrow Icon", p. 14).
describe("Return the Favor (27015) played while stunned", () => {
  it("the discard and reveal (the cost) still happen; the stun card replaces only the 5 damage", () => {
    const state = startWave5Game(ghostSpiderScenario("rhino", { seed: 1 }));
    const given = moveToHand(run(state, toHero(P1)), P1, "27015");
    const [card] = given.ids as [never];
    const me = identityOf(given.state);
    const villain = given.state.villains[0]!.instanceId;
    // Advance (01186) is a treachery: "the villain schemes" resolves on the reveal, so the main scheme gains threat.
    const stacked = patchInstance(stackEncounterDeck(given.state, "01186"), me, {
      statuses: { ...inst(given.state, me).statuses, stunned: 1 },
    });
    const threatBefore = mainThreat(stacked);
    const damageBefore = inst(stacked, villain).damage;
    const after = settle(
      runWith(WAVE5_DEPS, stacked, play(P1, card, payWith(stacked, P1, 0, [card]))),
      firstLegal,
      undefined,
      WAVE5_DEPS,
    );
    expect(mainThreat(after)).toBeGreaterThan(threatBefore);
    expect(inst(after, me).statuses.stunned).toBe(0);
    expect(inst(after, villain).damage).toBe(damageBefore);
    expect(playerOf(after, P1).discard).toContain(card);
  });
});
