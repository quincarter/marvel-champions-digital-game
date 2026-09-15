import { cardId, trait } from "@mc/content";
import { activeEncounterDeck, activeVillain, characterProfile, remainingHitPoints, traitsOf, type GameState, type InstanceId, type PlayerId } from "@mc/engine";
import { endTurn, firstLegal, identityOf, inst, moveToHand, P1, patchInstance, payWith, picking, play, playerOf, settle, stackEncounterDeck, toHero, use } from "../../testing/harness.js";
import { wave1Scenario } from "../setup.js";
import { DRS_DEPS, runDrs, stackInvocation, startDrsGame } from "./testing.js";

// Real wave 1 content: the Doctor Strange (Protection) precon against Rhino, standard, solo.
const drsVsRhino = (seed = 2001) => startDrsGame(wave1Scenario("rhino", { players: [{ starterDeckId: "drs-protection" }], seed }));

/** Test-only surgery: moves a copy of `code` straight from deck to the player's discard pile, matching
 * `wave1/msm/ms-marvel.test.ts`'s identically-shaped `moveToDiscard`. */
function moveToDiscard(state: GameState, player: PlayerId, code: string): { readonly state: GameState; readonly id: InstanceId } {
  const owner = playerOf(state, player);
  const wanted = (id: InstanceId) => state.instances[id]?.cardId === cardId(code);
  const id = owner.deck.find(wanted) ?? owner.hand.find(wanted);
  if (!id) throw new Error(`${player} has no ${code} in deck or hand`);
  return {
    id,
    state: {
      ...state,
      players: state.players.map((p) => (p.playerId === player ? { ...p, deck: p.deck.filter((x) => x !== id), hand: p.hand.filter((x) => x !== id), discard: [...p.discard, id] } : p)),
    },
  };
}

/** The card code of the active encounter deck's current top card. */
function encounterTop(state: GameState): string {
  const top = activeEncounterDeck(state).deck[0]!;
  return state.instances[top]!.cardId as unknown as string;
}

/** The instance id of the top card of `player`'s Invocation deck, for `AbilityCost.payPrintedCostOf`'s
 * `costChoices` slot ("choose exactly one card for invocation" — the command must name it explicitly). */
function topInvocation(state: GameState, player: PlayerId = P1): InstanceId {
  const top = playerOf(state, player).separateDecks["Invocation"]?.deck[0];
  if (!top) throw new Error(`${player} has an empty Invocation deck`);
  return top;
}

describe("Doctor Strange hero kit", () => {
  it("Spell Mastery: exhausts Doctor Strange, pays the top Invocation card's cost, and resolves its Special", () => {
    const hero = runDrs(drsVsRhino(), toHero());
    // Winds of Watoomb (09036, cost 0): "Special: Draw 3 cards. Place this card in the Invocation deck discard pile."
    const stacked = stackInvocation(hero, P1, "09036");
    const identity = identityOf(stacked);
    const handBefore = playerOf(stacked, P1).hand.length;
    const after = settle(
      runDrs(stacked, use(P1, identity, "09001a.spell-mastery", [], { invocation: [topInvocation(stacked)] })),
      firstLegal,
      undefined,
      DRS_DEPS,
    );
    expect(inst(after, identity).exhausted).toBe(true);
    expect(playerOf(after, P1).hand.length).toBe(handBefore + 3);
    // The resolved Invocation card goes to the Invocation discard pile, per its own "Special" text.
    expect(playerOf(after, P1).separateDecks["Invocation"]?.discard.length).toBeGreaterThan(0);
  });

  it("Natural Talent: discards the top Invocation card, once per phase", () => {
    const stacked = stackInvocation(drsVsRhino(), P1, "09036");
    const identity = identityOf(stacked);
    const discardBefore = playerOf(stacked, P1).separateDecks["Invocation"]!.discard.length;
    const after = runDrs(stacked, use(P1, identity, "09001b.natural-talent"));
    expect(playerOf(after, P1).separateDecks["Invocation"]!.discard.length).toBe(discardBefore + 1);
    // Limit once per phase: using it again this phase is illegal.
    expect(() => runDrs(after, use(P1, identity, "09001b.natural-talent"))).toThrow();
  });

  it("the Invocation deck reshuffles its discard pile the instant it empties", () => {
    const start = drsVsRhino();
    // Test surgery: move every Invocation card but one to the Invocation discard, so discarding the very last
    // card in the deck empties it.
    const piles = playerOf(start, P1).separateDecks["Invocation"]!;
    const [top, ...rest] = piles.deck;
    const emptied: GameState = {
      ...start,
      players: start.players.map((p) => (p.playerId === P1 ? { ...p, separateDecks: { ...p.separateDecks, Invocation: { ...piles, deck: [top!], discard: [...piles.discard, ...rest] } } } : p)),
    };
    const identity = identityOf(emptied);
    const after = runDrs(emptied, use(P1, identity, "09001b.natural-talent"));
    const finalPiles = playerOf(after, P1).separateDecks["Invocation"]!;
    // The Doctor Strange insert, "The Invocation Deck": "If the INVOCATION deck is ever empty, shuffle the
    // INVOCATION discard pile back into the INVOCATION deck." `runFlow` checks this before every frame/step
    // (`packages/engine/src/resolve/separate-decks.ts`), so the reshuffle — including the card just discarded —
    // already happened by the time this command settles; there's no visible "empty deck" state to observe.
    expect(finalPiles.discard).toHaveLength(0);
    expect(finalPiles.deck).toHaveLength(5);
  });

  it("Wong: exhausts Wong, then heals 1 damage from the identity or discards the top Invocation card", () => {
    const given = moveToHand(drsVsRhino(), P1, "09002");
    const [wong] = given.ids as [InstanceId];
    const withWong = settle(runDrs(given.state, play(P1, wong, payWith(given.state, P1, 3, [wong]))), firstLegal, undefined, DRS_DEPS);
    const damaged = patchInstance(withWong, identityOf(withWong), { damage: 2 });
    const discardBefore = playerOf(damaged, P1).separateDecks["Invocation"]!.discard.length;
    const after = settle(runDrs(damaged, use(P1, wong, "09002.wong-action")), picking("Heal 1 damage from your identity"), undefined, DRS_DEPS);
    expect(inst(after, identityOf(after)).damage).toBe(1);
    expect(playerOf(after, P1).separateDecks["Invocation"]!.discard.length).toBe(discardBefore);
  });

  it("Astral Projection: removes 3 threat from a scheme, plus 1 more per boost icon on the looked-at card", () => {
    const given = moveToHand(drsVsRhino(), P1, "09003");
    const [astral] = given.ids as [InstanceId];
    // False Alarm (01112) has 1 printed boost icon.
    const stacked = stackEncounterDeck(given.state, "01112");
    const hero = runDrs(stacked, toHero());
    const threatBefore = inst(hero, hero.mainScheme.instanceId).threat;
    const played = runDrs(hero, play(P1, astral, payWith(hero, P1, 2, [astral])));
    const after = settle(played, firstLegal, (s) => s.step.phase === "player", DRS_DEPS);
    expect(inst(after, after.mainScheme.instanceId).threat).toBe(Math.max(0, threatBefore - 4));
    // The card was only looked at, not revealed — still on top of the encounter deck.
    expect(encounterTop(after)).toBe(cardId("01112"));
  });

  it("Magic Blast: deals 5 damage to an enemy, plus a milled-resource-type bonus", () => {
    const given = moveToHand(drsVsRhino(), P1, "09004");
    const [blast] = given.ids as [InstanceId];
    const hero = runDrs(given.state, toHero());
    const villain = activeVillain(hero).instanceId;
    const hpBefore = remainingHitPoints(hero, villain);
    const after = settle(runDrs(hero, play(P1, blast, payWith(hero, P1, 3, [blast]))), firstLegal, undefined, DRS_DEPS);
    // At least the flat 5 damage landed; the milled card's own type decides which bonus (if any) also applied.
    expect(hpBefore! - remainingHitPoints(after, villain)!).toBeGreaterThanOrEqual(5);
    expect(playerOf(after, P1).discard.length).toBeGreaterThan(0);
  });

  it("Master of the Mystic Arts: pays the top Invocation card's cost, resolves it, then returns it to the top faceup", () => {
    const given = moveToHand(drsVsRhino(), P1, "09005");
    const [mota] = given.ids as [InstanceId];
    const withStrange = stackInvocation(given.state, P1, "09036"); // Winds of Watoomb, cost 0
    const hero = runDrs(withStrange, toHero());
    const handBefore = playerOf(hero, P1).hand.length;
    const after = settle(
      runDrs(hero, play(P1, mota, payWith(hero, P1, 1, [mota]), { costChoices: { invocation: [topInvocation(hero)] } })),
      firstLegal,
      undefined,
      DRS_DEPS,
    );
    // Drew 3 (Winds of Watoomb's Special); mota itself and its 1-resource payment card both left hand to pay for it.
    expect(playerOf(after, P1).hand.length).toBe(handBefore - 1 - 1 + 3);
    // "Place it back on top of the Invocation deck faceup", not the discard pile.
    const piles = playerOf(after, P1).separateDecks["Invocation"]!;
    expect(piles.deck[0]).toBeDefined();
    expect(piles.discard).not.toContain(piles.deck[0]);
  });

  it("Mystical Studies: searches deck/discard for a Doctor Strange card and adds it to hand", () => {
    const start = drsVsRhino();
    const given = moveToHand(start, P1, "09006");
    const [studies] = given.ids as [InstanceId];
    const { state: withDiscard, id: wong } = moveToDiscard(given.state, P1, "09002");
    // "Alter-Ego Action:" on an event card (Mystical Studies): playing it (in alter-ego form, the default at
    // setup) resolves the action directly, the same shape as Big Hands' "Hero Action (attack): Deal 4 damage".
    const after = settle(runDrs(withDiscard, play(P1, studies, payWith(withDiscard, P1, 1, [studies]))), picking(wong), undefined, DRS_DEPS);
    expect(playerOf(after, P1).hand).toContain(wong);
  });

  it("Protective Ward: cancels a revealed treachery's effects and discards it", () => {
    const start = drsVsRhino();
    const given = moveToHand(start, P1, "09007"); // stays in hand — a Hero Interrupt event is played from its own window
    const [ward] = given.ids as [InstanceId];
    // False Alarm (01112): "When Revealed: You are confused." — behind a neutral 0-icon boost card (01186) so the
    // villain phase's own boost draw doesn't consume it first.
    const stacked = stackEncounterDeck(given.state, "01186", "01112");
    const hero = runDrs(stacked, toHero());
    const identity = identityOf(hero);
    const option = `${ward}:09007.protective-ward-interrupt`;
    const after = settle(
      runDrs(hero, endTurn()),
      (s) => {
        const prompt = s.pendingChoice?.prompt;
        if (prompt?.kind === "chooseTriggers") return picking(option)(s);
        // Paying Protective Ward's own 1-resource play cost, offered once the trigger is accepted: an explicit
        // pick, since `firstLegal`'s minimum-selections default is 0 here (declining is also legal — it would
        // just leave the treachery uncancelled, defeating the point of this test).
        if (prompt?.kind === "payForCard") return [s.pendingChoice!.options[0]!.optionId];
        return firstLegal(s);
      },
      undefined,
      DRS_DEPS,
    );
    expect(inst(after, identity).statuses.confused ?? 0).toBe(0);
    expect(playerOf(after, P1).discard).toContain(ward);
  });

  it("Sanctum Sanctorum: shuffles a Spell card from the discard pile into the deck and draws 1", () => {
    const start = drsVsRhino();
    const given = moveToHand(start, P1, "09008");
    const [sanctum] = given.ids as [InstanceId];
    // Astral Projection (09003) carries the Spell trait.
    const { state: withDiscard, id: astral } = moveToDiscard(given.state, P1, "09003");
    const played = settle(runDrs(withDiscard, play(P1, sanctum, payWith(withDiscard, P1, 1, [sanctum]))), firstLegal, undefined, DRS_DEPS);
    const handBefore = playerOf(played, P1).hand.length;
    const after = settle(runDrs(played, use(P1, sanctum, "09008.sanctum-sanctorum-action")), picking(astral), undefined, DRS_DEPS);
    expect(playerOf(after, P1).discard).not.toContain(astral);
    expect(playerOf(after, P1).hand.length).toBe(handBefore + 1);
  });

  it("Cloak of Levitation: grants the Aerial trait and readies Doctor Strange when exhausted", () => {
    const given = moveToHand(drsVsRhino(), P1, "09009");
    const [cloak] = given.ids as [InstanceId];
    const hero = runDrs(given.state, toHero());
    const withCloak = settle(runDrs(hero, play(P1, cloak, payWith(hero, P1, 2, [cloak]))), firstLegal, undefined, DRS_DEPS);
    expect(traitsOf(withCloak, identityOf(withCloak), DRS_DEPS)).toContain(trait("Aerial"));
    expect(inst(withCloak, cloak).attachedTo).toBe(identityOf(withCloak));
    const exhausted = patchInstance(withCloak, identityOf(withCloak), { exhausted: true });
    const after = runDrs(exhausted, use(P1, cloak, "09009.cloak-of-levitation-action"));
    expect(inst(after, identityOf(after)).exhausted).toBe(false);
  });

  it("Magical Enhancements: +1 THW/ATK/DEF, discarded at the end of the round", () => {
    const given = moveToHand(drsVsRhino(), P1, "09010");
    const [enh] = given.ids as [InstanceId];
    const hero = runDrs(given.state, toHero());
    const before = characterProfile(hero, identityOf(hero), DRS_DEPS)!;
    const withEnh = settle(runDrs(hero, play(P1, enh, payWith(hero, P1, 1, [enh]))), firstLegal, undefined, DRS_DEPS);
    const boosted = characterProfile(withEnh, identityOf(withEnh), DRS_DEPS)!;
    expect(boosted.thw).toBe(before.thw + 1);
    expect(boosted.atk).toBe(before.atk + 1);
    expect(boosted.def).toBe(before.def + 1);
    const afterRound = settle(runDrs(withEnh, endTurn()), firstLegal, (s) => s.round > withEnh.round, DRS_DEPS);
    expect(playerOf(afterRound, P1).discard).toContain(enh);
  });

  it("The Eye of Agamotto: enters play as a Hero Resource generating a [wild] resource", () => {
    const given = moveToHand(drsVsRhino(), P1, "09011");
    const [eye] = given.ids as [InstanceId];
    const hero = runDrs(given.state, toHero());
    const withEye = settle(runDrs(hero, play(P1, eye, payWith(hero, P1, 2, [eye]))), firstLegal, undefined, DRS_DEPS);
    // Auto-attaches to the identity (no printed `attachesTo`), the same as Cloak of Levitation above.
    expect(inst(withEye, eye).attachedTo).toBe(identityOf(withEye));
    expect(inst(withEye, eye).exhausted).toBe(false);
  });
});

describe("Invocation cards", () => {
  it("Crimson Bands of Cyttorak: stuns an enemy and deals 7 damage to it", () => {
    const hero = runDrs(drsVsRhino(), toHero());
    const stacked = stackInvocation(hero, P1, "09032");
    const villain = activeVillain(stacked).instanceId;
    const hpBefore = remainingHitPoints(stacked, villain);
    const payment = payWith(stacked, P1, 2).map((id) => ({ fromHand: id }) as const);
    const after = settle(runDrs(stacked, use(P1, identityOf(stacked), "09001a.spell-mastery", payment, { invocation: [topInvocation(stacked)] })), firstLegal, undefined, DRS_DEPS);
    expect(remainingHitPoints(after, villain)).toBe(hpBefore! - 7);
    expect(after.instances[villain]?.statuses.stunned).toBeGreaterThan(0);
  });

  it("Images of Ikonn: confuses the villain and removes 4 threat from a scheme", () => {
    const hero = runDrs(drsVsRhino(), toHero());
    const stacked = stackInvocation(hero, P1, "09033");
    const villain = activeVillain(stacked).instanceId;
    const threatBefore = inst(stacked, stacked.mainScheme.instanceId).threat;
    const payment = payWith(stacked, P1, 1).map((id) => ({ fromHand: id }) as const);
    const after = settle(runDrs(stacked, use(P1, identityOf(stacked), "09001a.spell-mastery", payment, { invocation: [topInvocation(stacked)] })), firstLegal, undefined, DRS_DEPS);
    expect(after.instances[villain]?.statuses.confused).toBeGreaterThan(0);
    expect(inst(after, after.mainScheme.instanceId).threat).toBe(Math.max(0, threatBefore - 4));
  });

  it("Seven Rings of Raggadorr: gives up to 3 characters a tough status card", () => {
    const hero = runDrs(drsVsRhino(), toHero());
    const stacked = stackInvocation(hero, P1, "09034");
    const identity = identityOf(stacked);
    const payment = payWith(stacked, P1, 1).map((id) => ({ fromHand: id }) as const);
    const after = settle(runDrs(stacked, use(P1, identity, "09001a.spell-mastery", payment, { invocation: [topInvocation(stacked)] })), picking(identity), undefined, DRS_DEPS);
    expect(inst(after, identity).statuses.tough).toBeGreaterThan(0);
  });

  it("Winds of Watoomb: draws 3 cards", () => {
    const hero = runDrs(drsVsRhino(), toHero());
    const stacked = stackInvocation(hero, P1, "09036");
    const handBefore = playerOf(stacked, P1).hand.length;
    const after = settle(runDrs(stacked, use(P1, identityOf(stacked), "09001a.spell-mastery", [], { invocation: [topInvocation(stacked)] })), firstLegal, undefined, DRS_DEPS);
    expect(playerOf(after, P1).hand.length).toBe(handBefore + 3);
  });

  // Vapors of Valtorr (09035) is intentionally unscripted — see `kit.ts`'s doc comment for the full citation
  // (missing `TargetQuery` primitives for "has any status" / "a *different* status").
});
