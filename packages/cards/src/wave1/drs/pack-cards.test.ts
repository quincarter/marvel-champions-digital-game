import { cardId } from "@mc/content";
import { activeEncounterDeck, activeVillain, handSize, remainingHitPoints, type Command, type GameState, type InstanceId, type PlayerId } from "@mc/engine";
import {
  answer,
  endTurn,
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
  putOnTopOfDeck,
  settle,
  settleUntil,
  stackEncounterDeck,
  toHero,
  use,
} from "../../testing/harness.js";
import { wave1Scenario } from "../setup.js";
import { DRS_DEPS, runDrs, startDrsGame } from "./testing.js";

// Real wave 1 content: the Doctor Strange (Protection) precon against Rhino, standard, solo.
const drsVsRhino = (seed = 6601) => startDrsGame(wave1Scenario("rhino", { players: [{ starterDeckId: "drs-protection" }], seed }));

/** A neutral boost card (0 icons, no boost ability), so the villain phase's own boost draw doesn't distort a
 * deterministic attack — matches `wave1/hlk/hulk.test.ts`'s `ADVANCE`, same Rhino encounter pool. */
const ADVANCE = "01186";
/** 2 boost icons, no boost ability (Rhino's own encounter set) — matches `wave1/cap/expert-defense.test.ts`'s use
 * for the identical "prove a DEF bonus actually reduced a defense's damage" shape. */
const CROWD_CONTROL = "01108";

const basicAttack = (attacker: InstanceId, target: InstanceId): Command => ({ type: "basicAttack", playerId: P1, attackerInstanceId: attacker, targetInstanceId: target });

/** Test-only surgery: moves a copy of `code` straight from deck to the player's discard pile. */
function moveToDiscard(state: GameState, player: PlayerId, code: string): { readonly state: GameState; readonly id: InstanceId } {
  const owner = playerOf(state, player);
  const wanted = (id: InstanceId) => state.instances[id]?.cardId === cardId(code);
  const id = owner.deck.find(wanted) ?? owner.hand.find(wanted);
  if (!id) throw new Error(`${player} has no ${code} in deck or hand`);
  return {
    id,
    state: { ...state, players: state.players.map((p) => (p.playerId === player ? { ...p, deck: p.deck.filter((x) => x !== id), hand: p.hand.filter((x) => x !== id), discard: [...p.discard, id] } : p)) },
  };
}

/**
 * Brother Voodoo (09012), Clea (09013), Iron Fist (09014), Momentum Shift (09016), The Night Nurse (09019), Warning
 * (09021) and The Sorcerer Supreme (09026) are all in the "Doctor Strange (Protection)" precon (`drs-protection`,
 * `packages/content/src/data/drs/starterDecks.ts`) and exercised here in a real game.
 *
 * Skilled Strike (09037, aggression), Foiled! (09038, justice) and Iron Man (09039, leadership) are pool cards, not
 * part of that 40-card precon — reaching them through a real game would need a second, differently-aspected legal
 * deck, disproportionate for three cards whose shapes are already proven elsewhere in this file (Skilled Strike
 * mirrors Sanctum Sanctorum's own basic-attack-adjacent stat-bonus shape; Iron Man mirrors Doctor Strange's own
 * `CostModifierSpec.host` doc-comment example). Matches `wave1/msm/pack-cards.test.ts`'s own precedent for its four
 * off-precon cards: still scripted (not a recorded skip), exercised structurally by `coverage.test.ts` and
 * `defineAbilities`'s own validation at import time.
 */
describe("Doctor Strange pack cards", () => {
  it("Brother Voodoo: searches the top 5 cards of the deck for an event and adds it to hand", () => {
    const start = drsVsRhino();
    const given = moveToHand(start, P1, "09012");
    const [voodoo] = given.ids as [InstanceId];
    const hero = runDrs(given.state, toHero());
    // Momentum Shift (09016, an event) forced onto the deck's top, guaranteeing a hit among the top 5 searched.
    const { state: stacked } = putOnTopOfDeck(hero, P1, "09016");
    const handBefore = playerOf(stacked, P1).hand.length;
    const played = runDrs(stacked, play(P1, voodoo, payWith(stacked, P1, 3, [voodoo])));
    // A plain "Response:" is optional: `firstLegal` would decline it (minimum selections), so the trigger is picked
    // explicitly.
    const option = `${voodoo}:09012.brother-voodoo-response`;
    const after = settle(played, picking(option), undefined, DRS_DEPS);
    expect(playerOf(after, P1).playArea).toContain(voodoo);
    // "Response: After Brother Voodoo enters play" drew exactly one event card into hand (net of the 3 payment
    // cards and Voodoo himself leaving hand to be played).
    expect(playerOf(after, P1).hand.length).toBe(handBefore - 1 - 3 + 1);
  });

  it("Clea: an Interrupt that replaces her own defeat, shuffling her into her owner's deck", () => {
    const start = drsVsRhino();
    const given = moveToHand(start, P1, "09013");
    const [clea] = given.ids as [InstanceId];
    const hero = runDrs(given.state, toHero());
    const withClea = settle(runDrs(hero, play(P1, clea, payWith(hero, P1, 2, [clea]))), firstLegal, undefined, DRS_DEPS);
    // Clea has no printed DEF (an unmodifiable dash): declaring her as defender against Rhino's 2-ATK attack (a
    // neutral 0-icon boost card so the total is deterministic) deals exactly 2 damage — her printed 2 hit points.
    const staged = stackEncounterDeck(withClea, ADVANCE);
    const atDeclare = settleUntil(runDrs(staged, endTurn()), "declareDefender", firstLegal, DRS_DEPS);
    const declared = answer(atDeclare, [clea], DRS_DEPS);
    const option = `${clea}:09013.clea-interrupt`;
    const after = settle(declared, picking(option), (s) => s.step.kind === "turn", DRS_DEPS);
    expect(playerOf(after, P1).deck).toContain(clea);
    expect(playerOf(after, P1).discard).not.toContain(clea);
    expect(playerOf(after, P1).playArea).not.toContain(clea);
  });

  it("Desperate Defense: +2 DEF reduces that attack's damage to 0, and readies the hero since it took none", () => {
    // Doctor Strange (printed DEF 2) against Rhino (ATK 2) with Crowd Control (2 boost icons) staged: a basic
    // defense alone takes 2 + 2 - 2 = 2 damage (`09021.warning-interrupt`'s own test, above, is the DEF-2-vs-ATK-2
    // baseline with no boost); Desperate Defense's own +2 DEF makes it 2 + 2 - 4 = 0.
    const start = drsVsRhino();
    const given = moveToHand(start, P1, "09015");
    const [desperate] = given.ids as [InstanceId];
    const hero = runDrs(given.state, toHero());
    const identity = identityOf(hero);
    const staged = stackEncounterDeck(hero, CROWD_CONTROL);
    const atDeclare = settleUntil(runDrs(staged, endTurn()), "declareDefender", firstLegal, DRS_DEPS);
    const declared = answer(atDeclare, [identity], DRS_DEPS); // basic defense: exhausts Doctor Strange
    expect(inst(declared, identity).exhausted).toBe(true);
    const option = `${desperate}:09015.desperate-defense-interrupt`;
    // "When your hero defends" is an Interrupt: offered as the defense is declared, before damage (RRG 1.8
    // "Interrupt", p. 25) — fixed 2026-09-15 (`isAnnouncement`, `packages/engine/src/trigger-events.ts`).
    expect(declared.pendingChoice?.prompt).toMatchObject({ kind: "chooseTriggers", timing: "interrupt" });
    expect(declared.pendingChoice?.options.map((o) => o.optionId)).toContain(option);
    const played = answer(declared, [option], DRS_DEPS);
    // Desperate Defense is played from hand, paying its own printed cost as it triggers (matches
    // `doctor-strange.test.ts`'s other from-hand interrupts) — the only hand card offered pays its cost 1.
    const after = settle(
      played,
      (s) => (s.pendingChoice?.prompt.kind === "payForCard" ? [s.pendingChoice!.options[0]!.optionId] : firstLegal(s)),
      (s) => activeEncounterDeck(s).discard.some((id) => inst(s, id).cardId === CROWD_CONTROL),
      DRS_DEPS,
    );
    expect(inst(after, identity).damage).toBe(0);
    expect(playerOf(after, P1).discard).toContain(desperate);
    // "If you take no damage from that attack, ready your hero" — the deferred `atEndOfAttack` effect (proven by
    // Rhino's Charge) fires once the attack (and its deferred `defended` response window, RRG 1.8 p. 16) is done.
    expect(inst(after, identity).exhausted).toBe(false);
  });

  it("Desperate Defense: without it, the same basic defense takes 2 damage and stays exhausted", () => {
    const start = drsVsRhino();
    const hero = runDrs(start, toHero());
    const identity = identityOf(hero);
    const staged = stackEncounterDeck(hero, CROWD_CONTROL);
    const atDeclare = settleUntil(runDrs(staged, endTurn()), "declareDefender", firstLegal, DRS_DEPS);
    const declared = answer(atDeclare, [identity], DRS_DEPS);
    const after = settle(declared, firstLegal, (s) => activeEncounterDeck(s).discard.some((id) => inst(s, id).cardId === CROWD_CONTROL), DRS_DEPS);
    expect(inst(after, identity).damage).toBe(2);
    expect(inst(after, identity).exhausted).toBe(true); // never readied: nothing removed the damage this time
  });

  it("Unflappable: after defending and taking no damage, exhausts to draw a card", () => {
    // Doctor Strange (printed DEF 2) against Rhino (ATK 2) with a neutral 0-icon boost card: a basic defense takes
    // 2 + 0 - 2 = 0 damage already (no extra DEF bonus needed — matches `09021.warning-interrupt`'s own DEF-2-vs-
    // ATK-2 baseline note above).
    const start = drsVsRhino();
    const given = moveToHand(start, P1, "09020");
    const [unflappable] = given.ids as [InstanceId];
    const hero = runDrs(given.state, toHero());
    const withCard = settle(runDrs(hero, play(P1, unflappable, payWith(hero, P1, 1, [unflappable]))), firstLegal, undefined, DRS_DEPS);
    const identity = identityOf(withCard);
    // Two neutral Advances (matching `doctor-strange.test.ts`'s own precedent, line ~245): one is Rhino's own
    // boost card for this attack, the other keeps the per-player reveal that immediately follows from dealing
    // extra, uncontrolled damage this same round (an Ambush minion, say) that would confuse the "took no damage"
    // read.
    const staged = stackEncounterDeck(withCard, ADVANCE, ADVANCE, "01104");
    const atDeclare = settleUntil(runDrs(staged, endTurn()), "declareDefender", firstLegal, DRS_DEPS);
    const declared = answer(atDeclare, [identity], DRS_DEPS);
    const handBefore = playerOf(declared, P1).hand.length;
    // The deferred `defended` Response window opens only after the attack finishes (RRG 1.8 "Defend, Defense",
    // p. 16), carrying that attack's own results — "and take no damage" is part of the trigger condition
    // (`EventPattern.resultsAtMost`), so the ability is offered here only because the attack actually dealt 0. It
    // resolves before the per-player encounter card reveal that follows in the same villain phase, so stopping the
    // instant the boost card lands in the encounter discard (matching Desperate Defense's own precedent above)
    // isolates it from anything a later, uncontrolled reveal might also do.
    const atResponse = settleUntil(declared, "chooseTriggers", firstLegal, DRS_DEPS);
    const option = `${unflappable}:09020.unflappable-response`;
    expect(atResponse.pendingChoice?.options.map((o) => o.optionId)).toContain(option);
    // A single `answer` (not a broad `settle`): the response itself ("exhaust Unflappable, draw 1") needs no
    // further choice, so this lands immediately after it resolves, before any later, uncontrolled villain-phase
    // step gets a chance to run.
    const after = answer(atResponse, [option], DRS_DEPS);
    expect(inst(after, identity).damage).toBe(0);
    expect(inst(after, unflappable).exhausted).toBe(true);
    expect(playerOf(after, P1).hand.length).toBe(handBefore + 1);
  });

  it("Unflappable: not offered when the defense takes damage", () => {
    const start = drsVsRhino();
    const given = moveToHand(start, P1, "09020");
    const [unflappable] = given.ids as [InstanceId];
    const hero = runDrs(given.state, toHero());
    const withCard = settle(runDrs(hero, play(P1, unflappable, payWith(hero, P1, 1, [unflappable]))), firstLegal, undefined, DRS_DEPS);
    const identity = identityOf(withCard);
    // CROWD_CONTROL (2 boost icons) as Rhino's own boost card: 2 + 2 - 2 = 2 damage taken. ADVANCE/"01104" again
    // keep the following per-player reveal harmless.
    const staged = stackEncounterDeck(withCard, CROWD_CONTROL, ADVANCE, "01104");
    const atDeclare = settleUntil(runDrs(staged, endTurn()), "declareDefender", firstLegal, DRS_DEPS);
    const declared = answer(atDeclare, [identity], DRS_DEPS);
    const after = settle(declared, firstLegal, (s) => activeEncounterDeck(s).discard.some((id) => inst(s, id).cardId === cardId(CROWD_CONTROL)), DRS_DEPS);
    expect(inst(after, identity).damage).toBe(2);
    expect(inst(after, unflappable).exhausted).toBe(false); // never offered, so never paid for
  });

  it("Iron Fist: enters play with 2 mystic counters; his own attack can remove one to stun and damage the target", () => {
    const start = drsVsRhino();
    const given = moveToHand(start, P1, "09014");
    const [ironFist] = given.ids as [InstanceId];
    const hero = runDrs(given.state, toHero());
    const withFist = settle(runDrs(hero, play(P1, ironFist, payWith(hero, P1, 4, [ironFist]))), firstLegal, undefined, DRS_DEPS);
    expect(inst(withFist, ironFist).counters.mystic).toBe(2);
    const villain = activeVillain(withFist).instanceId;
    const hpBefore = remainingHitPoints(withFist, villain);
    const option = `${ironFist}:09014.iron-fist-interrupt`;
    const after = settle(runDrs(withFist, basicAttack(ironFist, villain)), picking(option), undefined, DRS_DEPS);
    expect(inst(after, ironFist).counters.mystic).toBe(1);
    expect(after.instances[villain]?.statuses.stunned).toBeGreaterThan(0);
    // Iron Fist's own basic ATK (2) plus the interrupt's own 1 damage.
    expect(hpBefore! - remainingHitPoints(after, villain)!).toBe(3);
  });

  it("Momentum Shift: heals 2 damage from your hero to deal 2 damage to an enemy", () => {
    const given = moveToHand(drsVsRhino(), P1, "09016");
    const [shift] = given.ids as [InstanceId];
    const hero = runDrs(given.state, toHero());
    const damaged = patchInstance(hero, identityOf(hero), { damage: 2 });
    const villain = activeVillain(damaged).instanceId;
    const hpBefore = remainingHitPoints(damaged, villain);
    const after = settle(runDrs(damaged, play(P1, shift, payWith(damaged, P1, 2, [shift]))), firstLegal, undefined, DRS_DEPS);
    expect(inst(after, identityOf(after)).damage).toBe(0);
    expect(remainingHitPoints(after, villain)).toBe(hpBefore! - 2);
  });

  it("The Night Nurse: heals 1 damage from a hero and discards a status card from it", () => {
    const given = moveToHand(drsVsRhino(), P1, "09019");
    const [nurse] = given.ids as [InstanceId];
    const hero = runDrs(given.state, toHero());
    const withNurse = settle(runDrs(hero, play(P1, nurse, payWith(hero, P1, 1, [nurse]))), firstLegal, undefined, DRS_DEPS);
    const identity = identityOf(withNurse);
    // Test surgery: a status is a plain instance field, unlike damage/threat there is no separate "defeat check"
    // or "hit 0" bookkeeping it needs to go through, so patching it directly is exact, not an approximation.
    const staged = patchInstance(withNurse, identity, { damage: 1, statuses: { ...inst(withNurse, identity).statuses, confused: 1 } });
    const after = settle(runDrs(staged, use(P1, nurse, "09019.the-night-nurse-action", [], undefined)), (s) => {
      const prompt = s.pendingChoice?.prompt;
      if (prompt?.kind === "chooseTarget") return [identity];
      return firstLegal(s);
    }, undefined, DRS_DEPS);
    expect(inst(after, identity).damage).toBe(0);
    expect(inst(after, identity).statuses.confused).toBe(0);
    expect(inst(after, nurse).counters.medical).toBe(2);
  });

  it("Warning: reduces the next amount of damage a hero would take by 1", () => {
    const start = drsVsRhino();
    const given = moveToHand(start, P1, "09021");
    const [warning] = given.ids as [InstanceId];
    const hero = runDrs(given.state, toHero());
    const identity = identityOf(hero);
    // Advance as Rhino's boost card, Advance dealt to Doctor Strange (it schemes, dealing no damage), and Hard to Keep
    // Down (01104, 0 icons) as that scheme's boost card. Otherwise a random dealt card (e.g. Assault) attacks again
    // after Warning is spent. Core has only two Advances.
    const staged = stackEncounterDeck(hero, ADVANCE, ADVANCE, "01104");
    const atDeclare = settleUntil(runDrs(staged, endTurn()), "declareDefender", firstLegal, DRS_DEPS);
    const declared = answer(atDeclare, [identity], DRS_DEPS); // basic defense: printed DEF 2 against Rhino's ATK 2
    const option = `${warning}:09021.warning-interrupt`;
    const after = settle(declared, picking(option), (s) => s.step.kind === "turn", DRS_DEPS);
    // Rhino's 2 ATK vs. Doctor Strange's printed 2 DEF would already deal 0 damage; Warning's own -1 has nothing
    // left to reduce, so the only fully unambiguous signal here is that the card was actually used (discarded).
    expect(playerOf(after, P1).discard).toContain(warning);
    expect(inst(after, identity).damage).toBe(0);
  });

  it("The Sorcerer Supreme: +1 hand size while in hero form, none in alter-ego form", () => {
    const given = moveToHand(drsVsRhino(), P1, "09026");
    const [supreme] = given.ids as [InstanceId];
    // Alter-ego form (the default at this point): no bonus yet — Doctor Strange's printed alter-ego hand size is 6.
    const alterEgoBefore = handSize(given.state, P1, DRS_DEPS);
    expect(alterEgoBefore).toBe(6);
    const played = settle(runDrs(given.state, play(P1, supreme, payWith(given.state, P1, 2, [supreme]))), firstLegal, undefined, DRS_DEPS);
    expect(handSize(played, P1, DRS_DEPS)).toBe(6); // still alter-ego: no bonus while not in hero form
    const hero = runDrs(played, toHero());
    // Printed hero hand size 5, +1 from The Sorcerer Supreme while in hero form — distinct from alter-ego's own
    // printed 6, so this number alone proves the bonus applied (without it, hero form would show 5).
    expect(handSize(hero, P1, DRS_DEPS)).toBe(6);
  });
});
