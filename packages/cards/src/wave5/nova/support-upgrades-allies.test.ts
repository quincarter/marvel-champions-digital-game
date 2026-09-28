import { describe, expect, it } from "vitest";
import { cardId, encounterSetId, trait, type EncounterSetId } from "@mc/content";
import { applyCommand, cardsInPlay, handSize, statBonus, traitsOf, type GameState, type InstanceId } from "@mc/engine";
import {
  answer,
  endTurn,
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
  resourceAbility,
  run,
  runWith,
  settle,
  stackEncounterDeck,
  toHero,
  use,
  type Picker,
} from "../../testing/harness.js";
import { driveEventsPicking, moveToDiscard, playFromHand, withForm } from "../../testing/staging.js";
import { WAVE5_DEPS } from "../index.js";
import { startWave5Game } from "../testing.js";
import { wave5Scenario, wave5StarterDeckSetup } from "../setup.js";
import { novaScenarioWithExtras } from "./support.js";

const novaVsRhino = (seed = 1, extraCodes: readonly string[] = []) =>
  startWave5Game(novaScenarioWithExtras("rhino", { seed, extraCodes }));

/** Accepts the named optional Interrupt/Response/target option; declines everything else (a `chooseCards` prompt
 * picks `want`). Ghost-Spider's `support-upgrades-allies.test.ts` own `accepting()` precedent. */
const accepting =
  (wanted: string, want: readonly InstanceId[] = []): Picker =>
  (state) => {
    const choice = state.pendingChoice;
    if (!choice) return [];
    if (choice.prompt.kind === "chooseCards") return want;
    const hits = choice.options
      .filter((o) => o.optionId === wanted || o.optionId.endsWith(`:${wanted}`) || o.label === wanted)
      .map((o) => o.optionId);
    return hits.length > 0 ? hits.slice(0, choice.maxSelections) : firstLegal(state);
  };

describe("Ms. Marvel (ally, 28002)", () => {
  it("28002.ms-marvel-response: exhausts and damages Ms. Marvel to return a played event from the discard pile to hand", () => {
    const hero = run(novaVsRhino(1), toHero(P1));
    const { state: withMarvel, id: marvel } = playFromHand(WAVE5_DEPS, hero, "28002", 3);
    const { state: after, id: oneByOne } = playFromHand(
      WAVE5_DEPS,
      withMarvel,
      "28014", // One by One: a cost-1 Attack event.
      1,
      accepting("28002.ms-marvel-response"),
    );
    expect(playerOf(after, P1).hand).toContain(oneByOne); // Returned to hand, not left in the discard pile.
    expect(playerOf(after, P1).discard).not.toContain(oneByOne);
    expect(inst(after, marvel).exhausted).toBe(true);
    expect(inst(after, marvel).damage).toBe(1);
  });

  it("28002.ms-marvel-response: does not trigger for playing an ally (not an event)", () => {
    const hero = run(novaVsRhino(2), toHero(P1));
    const { state: withMarvel, id: marvel } = playFromHand(WAVE5_DEPS, hero, "28002", 3);
    const { state: after } = playFromHand(WAVE5_DEPS, withMarvel, "28010", 2, accepting("28002.ms-marvel-response"));
    expect(inst(after, marvel).exhausted).toBe(false); // Never offered: The Locust is an ally, not an event.
    expect(inst(after, marvel).damage).toBe(0);
  });
});

describe("Connection to the Worldmind (resource, 28007)", () => {
  it("28007.connection-to-the-worldmind-constant: does not count toward hand size", () => {
    const state = novaVsRhino(1);
    const limit = handSize(state, P1, WAVE5_DEPS);
    const beforeHand = playerOf(state, P1).hand;
    const connections = beforeHand.filter((id) => state.instances[id]?.cardId === cardId("28007"));
    // Nova's real precon deals both real copies of Connection to the Worldmind into the opening hand alongside it
    // (deckLimit 2): the hand already sits above the printed hand size (5) by exactly that many uncounted cards.
    expect(beforeHand.length).toBe(limit + connections.length);
    const settled = settle(runWith(WAVE5_DEPS, state, endTurn(P1)), firstLegal, undefined, WAVE5_DEPS);
    // Never forced to discard them for being "extra": the counted mandatory discard only ever removes them if the
    // player chooses to (nothing here does), so both stay held after the end-of-phase step.
    for (const connection of connections) expect(playerOf(settled, P1).hand).toContain(connection);
  });
});

describe("Jesse Alexander (support, 28008)", () => {
  it("28008.jesse-alexander-action: exhausts, shuffles a discarded Connection to the Worldmind into the deck, and draws 1", () => {
    const { state: withDiscard, id: connection } = moveToDiscard(novaVsRhino(1), P1, "28007");
    const { state: withJesse, id: jesse } = playFromHand(WAVE5_DEPS, withDiscard, "28008", 2);
    const beforeHand = playerOf(withJesse, P1).hand.length;
    const beforeDeck = playerOf(withJesse, P1).deck.length;
    const after = settle(
      runWith(WAVE5_DEPS, withJesse, use(P1, jesse, "28008.jesse-alexander-action")),
      firstLegal,
      undefined,
      WAVE5_DEPS,
    );
    expect(playerOf(after, P1).discard).not.toContain(connection); // Shuffled into the deck, not left discarded.
    expect(playerOf(after, P1).hand.length).toBe(beforeHand + 1); // "Draw 1 card."
    expect(playerOf(after, P1).deck.length).toBe(beforeDeck); // Net 0: 1 shuffled in, 1 drawn back out.
    expect(inst(after, jesse).exhausted).toBe(true);
  });

  it("28008.jesse-alexander-action: a legal no-op with no Connection to the Worldmind in the discard pile (still exhausts and draws)", () => {
    const { state: withJesse, id: jesse } = playFromHand(WAVE5_DEPS, novaVsRhino(2), "28008", 2);
    const beforeHand = playerOf(withJesse, P1).hand.length;
    const beforeDeck = playerOf(withJesse, P1).deck.length;
    const after = settle(
      runWith(WAVE5_DEPS, withJesse, use(P1, jesse, "28008.jesse-alexander-action")),
      firstLegal,
      undefined,
      WAVE5_DEPS,
    );
    expect(playerOf(after, P1).deck.length).toBe(beforeDeck - 1); // Nothing shuffled in; only the draw shrank it.
    expect(playerOf(after, P1).hand.length).toBe(beforeHand + 1); // "Draw 1 card" still resolves.
    expect(inst(after, jesse).exhausted).toBe(true);
  });
});

describe("Supernova Helmet (upgrade, 28009)", () => {
  it("28009.supernova-helmet-constant: Nova gains the Aerial trait while it is in play", () => {
    const hero = run(novaVsRhino(1), toHero(P1));
    const identity = identityOf(hero, P1);
    expect(traitsOf(hero, identity, WAVE5_DEPS)).not.toContain(trait("AERIAL"));
    const { state: after } = playFromHand(WAVE5_DEPS, hero, "28009", 1);
    expect(traitsOf(after, identity, WAVE5_DEPS)).toContain(trait("AERIAL"));
  });

  it("28009.supernova-helmet-resource: exhausts Supernova Helmet to generate a wild resource, paying for a hand card", () => {
    const hero = run(novaVsRhino(2), toHero(P1));
    const { state: withHelmet, id: helmet } = playFromHand(WAVE5_DEPS, hero, "28009", 1);
    const given = moveToHand(withHelmet, P1, "28014"); // One by One, cost 1.
    const [oneByOne] = given.ids as [InstanceId];
    const after = settle(
      runWith(
        WAVE5_DEPS,
        given.state,
        play(P1, oneByOne, [], { abilities: [resourceAbility(helmet, "28009.supernova-helmet-resource")] }),
      ),
      firstLegal,
      undefined,
      WAVE5_DEPS,
    );
    expect(inst(after, helmet).exhausted).toBe(true);
    expect(playerOf(after, P1).hand).not.toContain(oneByOne); // Paid for and played.
  });
});

describe("The Locust (ally, 28010)", () => {
  it("28010.the-locust-response: adds an Aggression event from the discard pile to hand when The Locust enters play", () => {
    const hero = run(novaVsRhino(1), toHero(P1)); // "Play only if your identity has the champion trait" (Nova, hero form).
    const { state: withDiscard, id: oneByOne } = moveToDiscard(hero, P1, "28014"); // One by One, Aggression aspect.
    const { state: after } = playFromHand(
      WAVE5_DEPS,
      withDiscard,
      "28010",
      2,
      accepting("28010.the-locust-response", [oneByOne]),
    );
    expect(playerOf(after, P1).hand).toContain(oneByOne);
    expect(playerOf(after, P1).discard).not.toContain(oneByOne);
  });

  it("28010.the-locust-response: a legal no-op with no Aggression event in the discard pile", () => {
    const before = run(novaVsRhino(2), toHero(P1));
    const beforeHand = playerOf(before, P1).hand.length;
    const { state: after } = playFromHand(WAVE5_DEPS, before, "28010", 2, accepting("28010.the-locust-response"));
    // Cost paid (2 cards left the hand) and nothing came back: nothing found, `min: 0` lets it choose none.
    expect(playerOf(after, P1).hand.length).toBe(beforeHand - 2);
  });
});

describe("The Power of Aggression (resource, 28015)", () => {
  it("28015.the-power-of-aggression-constant: doubles the resource it generates while paying for an Aggression card", () => {
    const hero = run(novaVsRhino(1), toHero(P1)); // One by One is a Hero Action (attack).
    const given = moveToHand(hero, P1, "28015", "28014"); // The card itself + One by One (Aggression, cost 1).
    const [power, oneByOne] = given.ids as [InstanceId, InstanceId];
    const beforeDiscard = playerOf(given.state, P1).discard.length;
    const after = settle(
      runWith(WAVE5_DEPS, given.state, play(P1, oneByOne, [power])),
      firstLegal,
      undefined,
      WAVE5_DEPS,
    );
    // One [wild]-producing resource card, doubled to 2, more than covers One by One's cost of 1 with nothing else.
    expect(playerOf(after, P1).discard.length).toBe(beforeDiscard + 2); // The Power of Aggression + One by One.
    expect(playerOf(after, P1).hand).not.toContain(oneByOne);
  });
});

describe("Fluid Motion (upgrade, 28016)", () => {
  it("28016.fluid-motion-response: exhausts to give your hero +1 ATK until the end of the phase after playing an Attack event", () => {
    const hero = run(novaVsRhino(1), toHero(P1));
    const { state: withFluidMotion, id: fluidMotion } = playFromHand(WAVE5_DEPS, hero, "28016", 1);
    const identity = identityOf(withFluidMotion, P1);
    expect(statBonus(withFluidMotion, WAVE5_DEPS, identity, "atk")).toBe(0);
    const { state: after } = playFromHand(
      WAVE5_DEPS,
      withFluidMotion,
      "28014", // One by One, an Attack event.
      1,
      accepting("28016.fluid-motion-response"),
    );
    expect(statBonus(after, WAVE5_DEPS, identity, "atk")).toBe(1);
    expect(inst(after, fluidMotion).exhausted).toBe(true);
  });

  it("28016.fluid-motion-response: (Max 1 per Attack event) — a second Attack event this phase can trigger it again, but not the same one twice", () => {
    const hero = run(novaVsRhino(2), toHero(P1));
    const { state: withFluidMotion, id: fluidMotion } = playFromHand(WAVE5_DEPS, hero, "28016", 1);
    const given = moveToHand(withFluidMotion, P1, "28014");
    const [oneByOne] = given.ids as [InstanceId];
    // Exhaust Fluid Motion up front (simulating an already-spent response this phase) and play the event: the
    // response is never offered because its own cost (exhausting an already-exhausted card) cannot be paid.
    const preExhausted = patchInstance(given.state, fluidMotion, { exhausted: true });
    const after = settle(
      runWith(WAVE5_DEPS, preExhausted, play(P1, oneByOne, payWith(preExhausted, P1, 1, given.ids))),
      accepting("28016.fluid-motion-response"),
      undefined,
      WAVE5_DEPS,
    );
    const identity = identityOf(after, P1);
    expect(statBonus(after, WAVE5_DEPS, identity, "atk")).toBe(0); // Already exhausted: nothing to offer.
  });
});

describe("Honed Technique (upgrade, 28017)", () => {
  const HONED = "28017.honed-technique-interrupt";
  // Extra copies so every payment below names real icons: [mental] Lightspeed Flight 28004, Jesse Alexander 28008,
  // Supernova Helmet 28009; [physical] Ms. Marvel 28002, Forcefield Projection 28003, Champions Mobile Bunker 28020.
  // Uppercut (Core 01054, Aggression Attack, cost 3, "Deal 5 damage to an enemy") and Melee (`msm` 05030, Aggression
  // Attack, cost 3, "Deal 3 damage to an enemy. Deal 3 damage to another enemy.") are off-precon.
  const EXTRAS = ["28017", "01054", "05030", "18013", "28004", "28008", "28009", "28013", "28002", "28003", "28020"];
  const game = (seed: number, modularSetIds?: readonly EncounterSetId[]) =>
    run(
      startWave5Game(
        novaScenarioWithExtras("rhino", { seed, extraCodes: EXTRAS, ...(modularSetIds ? { modularSetIds } : {}) }),
      ),
      toHero(P1),
    );

  /** Honed Technique in play, paid for with three [mental] icons (its Requirement is [mental][mental]). */
  const withHoned = (state: GameState) => {
    const given = moveToHand(state, P1, "28017", "28004", "28008", "28009");
    const [honed, ...payment] = given.ids as [InstanceId, ...InstanceId[]];
    const after = settle(runWith(WAVE5_DEPS, given.state, play(P1, honed, payment)), firstLegal, undefined, WAVE5_DEPS);
    expect(playerOf(after, P1).playArea.concat(inst(after, identityOf(after, P1)).attachments ?? [])).toContain(honed);
    return after;
  };

  /** Plays `code` paid with `payWith` (card codes), accepting Honed Technique; reports whether it was offered. */
  const playEvent = (state: GameState, code: string, payWith: readonly string[]) => {
    const given = moveToHand(state, P1, code, ...payWith);
    const [event, ...payment] = given.ids as [InstanceId, ...InstanceId[]];
    let offered = false;
    const picker = accepting(HONED);
    const { state: after, events } = driveEventsPicking(
      WAVE5_DEPS,
      given.state,
      (s) => {
        if (s.pendingChoice?.options.some((o) => o.optionId.endsWith(HONED))) offered = true;
        return picker(s);
      },
      play(P1, event, payment),
    );
    const dealt = events.flatMap((e) =>
      e.type === "damageDealt" ? [{ target: e.targetInstanceId, amount: e.amount }] : [],
    );
    return { state: after, dealt, offered };
  };

  it(`${"28017.honed-technique-interrupt"}: paid with a [mental] resource, an Aggression Attack event deals its printed cost more`, () => {
    const state = withHoned(game(1));
    const villain = state.villains[0]!.instanceId;
    const { dealt, offered } = playEvent(state, "01054", ["28004", "28002", "28003"]); // Uppercut, cost 3.
    expect(offered).toBe(true);
    expect(dealt).toEqual([{ target: villain, amount: 8 }]); // 5 + printed cost 3.
  });

  it("28017.honed-technique-interrupt: paid without a [mental] resource, the damage is unchanged", () => {
    const state = withHoned(game(2));
    const villain = state.villains[0]!.instanceId;
    const { dealt } = playEvent(state, "01054", ["28002", "28003", "28020"]); // All [physical].
    expect(dealt).toEqual([{ target: villain, amount: 5 }]);
  });

  it("28017.honed-technique-interrupt: not offered for a non-Aggression Attack event, nor an Aggression non-Attack event", () => {
    const state = withHoned(game(3));
    const villain = state.villains[0]!.instanceId;
    // Pot Shot (28005): Nova's own hero-aspect Attack event, cost 2, "Deal 4 damage to an enemy".
    const potShot = playEvent(state, "28005", ["28004", "28008"]);
    expect(potShot.offered).toBe(false);
    expect(potShot.dealt).toEqual([{ target: villain, amount: 4 }]);
    // Plan of Attack (`gam` 18013): an Aggression Tactic event, cost 0.
    expect(playEvent(state, "18013", []).offered).toBe(false);
  });

  it("28017.honed-technique-interrupt: every damage instance of a multi-target event goes up (Melee, FAQ 'Embiggen (#10)')", () => {
    // Radioactive Man (Core 01129, Masters of Evil): 7 hit points, no Guard, revealed in the villain phase behind an
    // Advance boost card.
    const hero = game(4, [encounterSetId("masters_of_evil")]);
    const stacked = stackEncounterDeck(hero, "01186", "01129");
    const nextRound = settle(runWith(WAVE5_DEPS, stacked, endTurn(P1)), firstLegal, undefined, WAVE5_DEPS);
    const minion = instancesOf(nextRound, "01129").find((id) => cardsInPlay(nextRound).includes(id))!;
    expect(minion).toBeDefined();
    const state = withHoned(nextRound);
    const villain = state.villains[0]!.instanceId;
    const { dealt } = playEvent(state, "05030", ["28013", "28002", "28003"]); // Melee, cost 3; No Quarter is [mental].
    // RRG 1.8 "Event" (p. 19): each instance of damage is increased by the printed cost 3.
    expect(dealt.map((d) => d.amount)).toEqual([6, 6]);
    expect(new Set(dealt.map((d) => d.target))).toEqual(new Set([villain, minion]));
  });
});

describe("Moon Girl (ally, 28018)", () => {
  it("28018.moon-girl-response: draws exactly 1 card per [mental] resource paid for her (3 [mental] cards)", () => {
    const state = run(novaVsRhino(1), toHero(P1)); // Nova (hero form) has the champion trait.
    // Lightspeed Flight (28004, `resourceIcons: { mental: 1 }`, max 3 in this deck) is a genuine printed [mental]
    // icon — unlike a wild-icon resource card (Connection to the Worldmind, 28007), which `printedResources`
    // (`packages/engine/src/resources.ts`) puts in `pool.wild`, never `pool.mental`, regardless of what it's
    // "declared as": a wild only ever fills a cost's own typed *requirement* slots (`resourceVars`,
    // `packages/engine/src/actions.ts`), and Moon Girl's cost is a plain generic 3 with no typed requirement to
    // fill, so a wild spent on her never counts as `paid.mental`.
    const given = moveToHand(state, P1, "28018", "28004", "28004", "28004");
    const [moonGirl, m1, m2, m3] = given.ids as [InstanceId, InstanceId, InstanceId, InstanceId];
    const beforeHand = playerOf(given.state, P1).hand.length;
    const after = settle(
      runWith(WAVE5_DEPS, given.state, play(P1, moonGirl, [m1, m2, m3])),
      accepting("28018.moon-girl-response"), // Response is an optional trigger; `firstLegal` alone declines it.
      undefined,
      WAVE5_DEPS,
    );
    // 4 cards left hand to pay Moon Girl's own printed cost of 3, then her Response draws back exactly 3 (1 per
    // [mental] resource paid) — not "some number >= 0", the exact printed effect.
    expect(playerOf(after, P1).hand.length).toBe(beforeHand - 4 + 3);
    expect(playerOf(after, P1).playArea).toContain(moonGirl);
  });

  it("28018.moon-girl-response: draws 0 cards when Moon Girl is paid with 0 [mental] resources", () => {
    const state = run(novaVsRhino(1), toHero(P1));
    // Pot Shot (28005, `resourceIcons: { energy: 1 }`, max 3 in this deck): the same cost of 3, paid with cards
    // that carry no printed [mental] icon at all.
    const given = moveToHand(state, P1, "28018", "28005", "28005", "28005");
    const [moonGirl, e1, e2, e3] = given.ids as [InstanceId, InstanceId, InstanceId, InstanceId];
    const beforeHand = playerOf(given.state, P1).hand.length;
    const after = settle(
      runWith(WAVE5_DEPS, given.state, play(P1, moonGirl, [e1, e2, e3])),
      accepting("28018.moon-girl-response"), // accepted, not just declined — still draws 0.
      undefined,
      WAVE5_DEPS,
    );
    // 4 cards left hand to pay her cost of 3; her Response draws 0 (0 [mental] resources paid).
    expect(playerOf(after, P1).hand.length).toBe(beforeHand - 4);
    expect(playerOf(after, P1).playArea).toContain(moonGirl);
  });
});

describe("Everyday Hero (resource, 28019)", () => {
  // P2 plays Ghost-Spider, not Nova (a group may only have one copy of a unique identity in play at once), with 3
  // extra copies of Everyday Hero (28019) appended to her deck so `moveToHand` can find one — legality is off
  // (`requireLegalDecks: false`) the same way `novaScenarioWithExtras` relaxes it for an off-precon card. Gwen
  // Stacy (Ghost-Spider's own alter-ego) prints the Civilian trait (`sm` 27001b), matching Everyday Hero's own
  // condition on its *owner's* identity (module docblock).
  const twoPlayerNova = (seed: number) => {
    const p2 = wave5StarterDeckSetup("ghost-spider");
    return startWave5Game({
      ...wave5Scenario("rhino", {
        seed,
        players: [{ starterDeckId: "nova-aggression" }, { ...p2, deck: [...p2.deck, "28019", "28019", "28019"] }],
      }),
      requireLegalDecks: false,
    });
  };

  it("28019.everyday-hero-constant + -response: spent for another player while Civilian, healing that player's identity", () => {
    const state = twoPlayerNova(1);
    const givenP2 = moveToHand(state, P2, "28019");
    const [everydayHero] = givenP2.ids as [InstanceId];
    const givenP1 = moveToHand(givenP2.state, P1, "28009"); // Supernova Helmet, cost 1.
    const [supernovaHelmet] = givenP1.ids as [InstanceId];
    const identityP1 = identityOf(givenP1.state, P1);
    const damaged = patchInstance(givenP1.state, identityP1, { damage: 2 });
    const after = settle(
      runWith(WAVE5_DEPS, damaged, play(P1, supernovaHelmet, [everydayHero])),
      accepting("28019.everyday-hero-response"),
      undefined,
      WAVE5_DEPS,
    );
    expect(playerOf(after, P2).discard).toContain(everydayHero); // Spent, so discarded to its owner's pile.
    expect(inst(after, identityP1).damage).toBe(1); // Healed 1: "that player's identity" is the payer, P1.
  });

  it("28019.everyday-hero-constant: refused for another player once the owner's identity leaves Civilian form", () => {
    const state = withForm(twoPlayerNova(2), { heroForm: 0 }, P2); // Gwen Stacy (alter-ego) is the only Civilian face.
    const givenP2 = moveToHand(state, P2, "28019");
    const [everydayHero] = givenP2.ids as [InstanceId];
    const givenP1 = moveToHand(givenP2.state, P1, "28009");
    const [supernovaHelmet] = givenP1.ids as [InstanceId];
    const result = applyCommand(givenP1.state, play(P1, supernovaHelmet, [everydayHero]), WAVE5_DEPS);
    expect(result.ok).toBe(false); // Not spendable for another player: the condition is false.
  });
});

describe("Champions Mobile Bunker (support, 28020)", () => {
  /** Picks `identity` for the initial `chooseTarget`, `label` for the yes/no `chooseOneBy`, and otherwise defers
   * to `firstLegal` — importantly, for the "discard 2 cards from your hand" step that follows accepting the
   * draw-then-discard option (an ordinary `chooseCards` prompt, whose own minimum already picks exactly 2). */
  const choosing =
    (identity: InstanceId, label: string): Picker =>
    (state) => {
      const choice = state.pendingChoice;
      if (!choice) return [];
      if (choice.prompt.kind === "chooseTarget" && choice.prompt.slot === "identity") return [identity];
      const hit = choice.options.find((o) => o.label === label);
      return hit ? [hit.optionId] : firstLegal(state);
    };

  it("28020.champions-mobile-bunker-action: the chosen player may draw 2 then discard 2", () => {
    const hero = run(novaVsRhino(1), toHero(P1)); // Nova (hero form) has the champion trait.
    const { state: withBunker, id: bunker } = playFromHand(WAVE5_DEPS, hero, "28020", 2);
    const identity = identityOf(withBunker, P1);
    const beforeHand = playerOf(withBunker, P1).hand.length;
    const beforeDeck = playerOf(withBunker, P1).deck.length;
    const beforeDiscard = playerOf(withBunker, P1).discard.length;
    const after = settle(
      runWith(WAVE5_DEPS, withBunker, use(P1, bunker, "28020.champions-mobile-bunker-action")),
      choosing(identity, "Draw 2 cards, then discard 2 cards from your hand"),
      undefined,
      WAVE5_DEPS,
    );
    expect(playerOf(after, P1).hand.length).toBe(beforeHand); // Drew 2, then discarded 2: net 0.
    expect(playerOf(after, P1).deck.length).toBe(beforeDeck - 2); // "Draw 2 cards" actually drew from the deck.
    expect(playerOf(after, P1).discard.length).toBe(beforeDiscard + 2); // "discard 2 cards" actually discarded.
    expect(inst(after, bunker).exhausted).toBe(true);
  });

  it('28020.champions-mobile-bunker-action: the chosen player may decline ("Do not")', () => {
    const hero = run(novaVsRhino(2), toHero(P1));
    const { state: withBunker, id: bunker } = playFromHand(WAVE5_DEPS, hero, "28020", 2);
    const identity = identityOf(withBunker, P1);
    const beforeHand = playerOf(withBunker, P1).hand.length;
    const after = settle(
      runWith(WAVE5_DEPS, withBunker, use(P1, bunker, "28020.champions-mobile-bunker-action")),
      choosing(identity, "Do not"),
      undefined,
      WAVE5_DEPS,
    );
    expect(playerOf(after, P1).hand.length).toBe(beforeHand); // Declined: no draw, no discard.
    expect(inst(after, bunker).exhausted).toBe(true); // The exhaust cost is still paid either way.
  });
});

describe("Height Advantage (upgrade, 28027)", () => {
  it("28027.height-advantage-constant: reduces damage taken from an enemy attack by 1 while Aerial (via Supernova Helmet)", () => {
    const hero = run(novaVsRhino(1, ["28027"]), toHero(P1));
    const { state: withHelmet } = playFromHand(WAVE5_DEPS, hero, "28009", 1); // Grants Aerial (module docblock).
    const identity = identityOf(withHelmet, P1);

    const attack = (state: typeof withHelmet) => {
      const stacked = stackEncounterDeck(state, "01108"); // Crowd Control: 2 boost icons, inflates Rhino's ATK.
      const reached = settle(
        runWith(WAVE5_DEPS, stacked, endTurn(P1)),
        firstLegal,
        (s) => s.pendingChoice?.prompt.kind === "declareDefender",
        WAVE5_DEPS,
      );
      const defending = answer(reached, [identity], WAVE5_DEPS);
      return settle(defending, firstLegal, undefined, WAVE5_DEPS);
    };

    const without = attack(withHelmet);
    const { state: withBoth } = playFromHand(WAVE5_DEPS, withHelmet, "28027", 1);
    const withReduction = attack(withBoth);
    expect(inst(withReduction, identity).damage).toBe(inst(without, identity).damage - 1);
  });

  it("28027.height-advantage-forced-interrupt: discards itself when your turn begins", () => {
    const hero = run(novaVsRhino(2, ["28027"]), toHero(P1));
    const { state: withHeightAdvantage, id: heightAdvantage } = playFromHand(WAVE5_DEPS, hero, "28027", 1);
    const identity = identityOf(withHeightAdvantage, P1);
    expect(inst(withHeightAdvantage, heightAdvantage).attachedTo).toBe(identity);
    const after = settle(runWith(WAVE5_DEPS, withHeightAdvantage, endTurn(P1)), firstLegal, undefined, WAVE5_DEPS);
    expect(playerOf(after, P1).discard).toContain(heightAdvantage); // Discarded as your (next) turn begins.
    expect(inst(after, heightAdvantage).attachedTo).toBeNull();
  });
});
