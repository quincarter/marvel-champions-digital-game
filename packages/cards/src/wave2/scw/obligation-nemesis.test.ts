import { cardId } from "@mc/content";
import { activeEncounterDeck, activeEncounterDeckId, boostIconsFor, cardsInPlay, type GameState, type InstanceId } from "@mc/engine";
import { endTurn, firstLegal, identityOf, inst, moveToHand, P1, payWith, play, playerOf, settle, stackEncounterDeck, toHero } from "../../testing/harness.js";
import { wave2Scenario } from "../setup.js";
import { runWave2, startWave2Game, WAVE2_DEPS } from "../testing.js";
import { SCW_OBLIGATION_NEMESIS } from "./obligation-nemesis.js";

// Real wave 2 content: the Scarlet Witch (Justice) precon against Rhino, standard, solo. Wanda starts in alter-ego.
const scwVsRhino = () => startWave2Game(wave2Scenario("rhino", { players: [{ starterDeckId: "scw-justice" }], seed: 2026 }));

/**
 * Every nemesis-set card is set aside per player at setup (`PlayerState.setAside`, RRG 1.8 Appendix II step 5,
 * `packages/engine/src/setup.ts`) — *including* the minion, unlike a scenario deliberately pulling only the
 * minion out one card at a time (`docs/phase7-wave2-scripting.md` §5's `stackSetAside`/`stageNemesisCardForReveal`).
 * The real, generic way any hero's whole nemesis set actually re-enters a game is Shadow of the Past (01190, a
 * Core "Standard" card, so it's in every scenario's deck regardless of villain): "Reveal your set-aside nemesis
 * minion and put it into play engaged with you. Reveal your set-aside nemesis side scheme and put it into play.
 * Shuffle the rest of your set-aside nemesis encounter set into the encounter deck." Confirmed by inspection before
 * relying on it: it puts Luminous (15025) and The Next Evolution (15024) into play directly, and shuffles Magical
 * Suspension (15026) and Chaos Manipulation (15027) into the encounter deck proper — real content, not a synthetic
 * fixture, so every test below reaches its own card the same way a real game would.
 */
function revealNemesisSet(state: GameState): GameState {
  const stacked = stackEncounterDeck(state, "01186", "01190"); // Advance (Rhino's boost, 0 icons), then Shadow of the Past
  return settle(runWave2(stacked, endTurn()), firstLegal, undefined, WAVE2_DEPS);
}

/** Moves one still-set-aside nemesis card straight to the top of the active encounter deck (test-only surgery). */
function stageFromSetAside(state: GameState, code: string, player = P1): GameState {
  const owner = playerOf(state, player);
  const id = owner.setAside.find((i) => state.instances[i]?.cardId === cardId(code));
  if (!id) throw new Error(`no ${code} set aside for ${player}`);
  const deckId = activeEncounterDeckId(state);
  const pile = state.encounterDecks[deckId]!;
  return {
    ...state,
    players: state.players.map((p) => (p.playerId === player ? { ...p, setAside: p.setAside.filter((i) => i !== id) } : p)),
    encounterDecks: { ...state.encounterDecks, [deckId]: { ...pile, deck: [id, ...pile.deck] } },
  };
}

/** Moves one still-set-aside nemesis card straight to the active encounter deck's own discard pile (test-only surgery). */
function stageToDiscard(state: GameState, code: string, player = P1): GameState {
  const owner = playerOf(state, player);
  const id = owner.setAside.find((i) => state.instances[i]?.cardId === cardId(code));
  if (!id) throw new Error(`no ${code} set aside for ${player}`);
  const deckId = activeEncounterDeckId(state);
  const pile = state.encounterDecks[deckId]!;
  return {
    ...state,
    players: state.players.map((p) => (p.playerId === player ? { ...p, setAside: p.setAside.filter((i) => i !== id) } : p)),
    encounterDecks: { ...state.encounterDecks, [deckId]: { ...pile, discard: [id, ...pile.discard] } },
  };
}

/**
 * Chaos Manipulation staged to the deck top with Luminous already in the encounter discard pile (the same shape a
 * real game reaches once she's been defeated once and needs finding again) — the setup every Chaos Manipulation
 * test below shares.
 */
function stageChaosManipulation(hero: GameState): GameState {
  return stageFromSetAside(stageToDiscard(hero, "15025"), "15027");
}

describe("Scarlet Witch's obligation and nemesis (Slipping Sanity, The Next Evolution, Luminous, Magical Suspension, Chaos Manipulation)", () => {
  it("Slipping Sanity (15023.obligation) is SKIPPED — module docblock (no primitive for counting star icons among a discarded boost-area pool)", () => {
    expect("15023.obligation" in SCW_OBLIGATION_NEMESIS).toBe(false);
  });

  it("The Next Evolution: increases the number of boost icons on every encounter card by 1, once revealed", () => {
    const hero = runWave2(scwVsRhino(), toHero());
    const before = boostIconsFor(hero, WAVE2_DEPS, anyInstanceOf(hero, "01101"));
    expect(before).toBe(1); // Hydra Mercenary's own printed 1 icon, before The Next Evolution is in play
    const revealed = revealNemesisSet(hero);
    expect(cardsInPlay(revealed).some((id) => revealed.instances[id]?.cardId === "15024")).toBe(true);
    const after = boostIconsFor(revealed, WAVE2_DEPS, anyInstanceOf(revealed, "01101"));
    expect(after).toBe(2); // +1 constant, on every encounter card, this one included
  });

  it("Luminous: enters play engaged with the revealing player, and her own Forced Response fires the round she next activates against you", () => {
    const revealed = revealNemesisSet(runWave2(scwVsRhino(), toHero()));
    const luminous = cardsInPlay(revealed).find((id) => revealed.instances[id]?.cardId === "15025")!;
    expect(inst(revealed, luminous).engagedWith).toBe(P1);
    // `endTurn()` (inside `revealNemesisSet`) never forces a form change on its own (RRG "Form, Change Form": a
    // form change is always voluntary, or forced by a specific card) — `revealed` is still hero form here.
    expect(revealed.players[0]!.identity.form).toBe("hero");

    // A new round: both Rhino and Luminous activate, each dealt their own boost card (docs/phase7-wave2-scripting.md
    // §5). Advance (01186, 0 icons) x2 for the two activations, then Hard to Keep Down (01104, 0 printed icons — 1
    // with The Next Evolution's own +1 constant) is what Luminous's own Forced Response discards — 1 < 2, so no
    // extra encounter card this time.
    const stacked = stackEncounterDeck(revealed, "01186", "01186", "01104");
    const after = settle(runWave2(stacked, endTurn()), firstLegal, undefined, WAVE2_DEPS);
    expect(activeEncounterDeck(after).discard.map((id) => after.instances[id]?.cardId)).toContain("01104");
  });

  it("Chaos Manipulation: 2 or more boost icons discarded this way makes Luminous activate against the revealing player", () => {
    const hero = runWave2(scwVsRhino(), toHero());
    const identity = identityOf(hero);
    const damageBefore = inst(hero, identity).damage;
    // Luminous is already engaged with P1 from Chaos Manipulation's own search half (a separate, already-verified
    // ref); Shadow of the Past (01190, 2 icons) is what Chaos Manipulation's own follow-up discard reads. That
    // triggers her own "activates against you" — an ability-triggered attack that draws its own boost card in turn
    // (Hard to Keep Down, 01104, 0 icons) — which then *also* satisfies her own printed Forced Response ("after
    // Luminous activates against you, discard the top card…"), reading one more (01105, 0 icons, kept under the
    // threshold so this test isolates only the attack itself, not a second cascading "deal yourself" card).
    const staged = stageChaosManipulation(hero);
    // `stackEncounterDeck`'s own reordering finds a card already in the deck by its own code, so Chaos Manipulation
    // (just staged to the deck by `stageChaosManipulation`) can be placed explicitly in this exact order.
    const stacked = stackEncounterDeck(staged, "01186", "15027", "01190", "01104", "01105");
    const after = settle(runWave2(stacked, endTurn()), firstLegal, undefined, WAVE2_DEPS);
    const luminous = cardsInPlay(after).find((id) => after.instances[id]?.cardId === "15025")!;
    expect(inst(after, luminous).engagedWith).toBe(P1);
    // Rhino's own printed ATK 2 (undefended) plus Luminous's own printed ATK 2 (also undefended, boosted by 0).
    expect(inst(after, identity).damage).toBe(damageBefore + 4);
  });

  it("Chaos Manipulation: fewer than 2 boost icons discarded this way leaves Luminous merely engaged, no attack", () => {
    const hero = runWave2(scwVsRhino(), toHero());
    const identity = identityOf(hero);
    const damageBefore = inst(hero, identity).damage;
    const staged = stageChaosManipulation(hero);
    const stacked = stackEncounterDeck(staged, "01186", "15027", "01104"); // Hard to Keep Down (01104, 0 icons)
    const after = settle(runWave2(stacked, endTurn()), firstLegal, undefined, WAVE2_DEPS);
    const luminous = cardsInPlay(after).find((id) => after.instances[id]?.cardId === "15025")!;
    expect(inst(after, luminous).engagedWith).toBe(P1); // still found and put into play
    expect(inst(after, identity).damage).toBe(damageBefore + 2); // only Rhino's own attack; she does not attack
  });

  it("Magical Suspension: attaches to your identity, taxes each card you play 1 additional resource, and can be discarded", () => {
    const hero = runWave2(scwVsRhino(), toHero());
    const identity = identityOf(hero);
    // Stage it directly from set-aside (docs/phase7-wave2-scripting.md §5's `stageNemesisCardForReveal` shape) —
    // a real reveal, without needing Shadow of the Past's own two-round detour.
    const staged = stageFromSetAside(hero, "15026");
    const withSuspension = settle(runWave2(stackEncounterDeck(staged, "01186"), endTurn()), firstLegal, undefined, WAVE2_DEPS);
    const suspension = cardsInPlay(withSuspension).find((id) => withSuspension.instances[id]?.cardId === "15026")!;
    expect(inst(withSuspension, suspension).attachedTo).toBe(identity);

    // Crisis Averted (15012, printed cost 3, a plain Hero Action — not reactive) now costs 4 with Magical
    // Suspension in play: paying only 3 leaves the play unresolved (still awaiting a real payment), 4 succeeds.
    const given = moveToHand(withSuspension, P1, "15012");
    const [crisisAverted] = given.ids as [InstanceId];
    const tooLittle = runWave2(given.state, play(P1, crisisAverted, payWith(given.state, P1, 3, [crisisAverted, suspension])));
    expect(tooLittle.pendingChoice).not.toBeUndefined(); // still awaiting more payment, not silently played
    const paid = runWave2(given.state, play(P1, crisisAverted, payWith(given.state, P1, 4, [crisisAverted, suspension])));
    expect(playerOf(paid, P1).discard).toContain(crisisAverted); // the event resolved and was discarded

    // Hero Action: Exhaust your hero → discard this card.
    const discarded = settle(
      runWave2(withSuspension, { type: "useAbility", playerId: P1, cardInstanceId: suspension, abilityId: "15026.magical-suspension-action" as never, payment: [] }),
      firstLegal,
      undefined,
      WAVE2_DEPS,
    );
    // Magical Suspension has no owner (an encounter card), so a discard goes to the active villain's own encounter
    // discard pile, not the player's own discard (RRG 1.8 "Discard Pile", p. 16; ruling Jan 17, 2026 (5)).
    expect(activeEncounterDeck(discarded).discard).toContain(suspension);
    expect(cardsInPlay(discarded)).not.toContain(suspension);
  });

  it("Chaos Manipulation: searches the encounter deck and discard pile for Luminous and puts her into play engaged with the revealing player", () => {
    const hero = runWave2(scwVsRhino(), toHero());
    const staged = stageChaosManipulation(hero);
    const revealed = settle(runWave2(stackEncounterDeck(staged, "01186", "15027"), endTurn()), firstLegal, undefined, WAVE2_DEPS);
    const luminousInPlay = cardsInPlay(revealed).find((id) => revealed.instances[id]?.cardId === "15025");
    expect(luminousInPlay).toBeDefined();
    expect(inst(revealed, luminousInPlay!).engagedWith).toBe(P1);
  });
});

function anyInstanceOf(state: GameState, code: string): InstanceId {
  const id = Object.values(state.instances).find((i) => i.cardId === (cardId(code) as unknown as string))?.instanceId;
  if (!id) throw new Error(`no ${code} anywhere`);
  return id;
}
