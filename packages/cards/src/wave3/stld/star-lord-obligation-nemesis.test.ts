import { cardId } from "@mc/content";
import { activeEncounterDeck, cardsInPlay, hasKeyword } from "@mc/engine";
import {
  endTurn,
  firstLegal,
  identityOf,
  inst,
  instancesOf,
  mainThreat,
  P1,
  payWith,
  playerOf,
  settle,
  stackEncounterDeck,
  toHero,
  type Picker,
} from "../../testing/harness.js";
import { driveEvents, stackSetAside } from "../../testing/staging.js";
import type { GameState } from "@mc/engine";
import { wave3Scenario } from "../setup.js";
import { revealFromEncounterDeck, runWave3, startWave3Game, WAVE3_DEPS } from "../testing.js";
import { STAR_LORD_LEADERSHIP } from "./testing.js";

const starLordVsRhino = () => startWave3Game(wave3Scenario("rhino", { players: [STAR_LORD_LEADERSHIP], seed: 2026 }));

const pickingLabelStartingWith =
  (prefix: string): Picker =>
  (state) => {
    const choice = state.pendingChoice;
    if (!choice) return [];
    const hit = choice.options.find((o) => o.label.startsWith(prefix));
    return hit ? [hit.optionId] : firstLegal(state);
  };

describe("Star-Lord's obligation and nemesis (Banishment, Mister Knife, Spartoi Cunning)", () => {
  it("Banishment: exhausting Peter Quill removes it from the game (17024.obligation)", () => {
    // "01186" (Advance, 0 boost icons) absorbs the villain's own unconditional boost draw (`docs/card-scripting-
    // process.md`'s own `stackSetAsideBehindBoost` lesson), the same shape `groot-obligation-nemesis.test.ts` uses
    // for Wilt — obligations are ordinary encounter-deck cards once shuffled in, not staged separately.
    const staged = stackEncounterDeck(starLordVsRhino(), "01186", "17024");
    const identity = identityOf(staged);
    const revealed = settle(
      runWave3(staged, { type: "endTurn", playerId: P1 }),
      pickingLabelStartingWith("Exhaust"),
      undefined,
      WAVE3_DEPS,
    );
    const [banishment] = instancesOf(revealed, "17024");
    expect(revealed.removedFromGame).toContain(banishment);
    expect(inst(revealed, identity).exhausted).toBe(true);
  });

  it("Banishment: discards an Element Gun from play when you control one (17024.obligation)", () => {
    const staged = stackEncounterDeck(starLordVsRhino(), "01186", "17024");
    // Peter Quill's own Setup already searched one into hand; play it so there's one in play to discard.
    const hero = runWave3(staged, toHero());
    const gunId = playerOf(hero, P1).hand.find((id) => hero.instances[id]?.cardId === cardId("17007"))!;
    const paid = payWith(hero, P1, 3, [gunId]);
    const played = settle(
      runWave3(hero, {
        type: "playCard",
        playerId: P1,
        cardInstanceId: gunId,
        payment: paid.map((fromHand) => ({ fromHand })),
        attachToInstanceId: null,
      }),
      firstLegal,
      undefined,
      WAVE3_DEPS,
    );
    const discardBefore = played.players.find((p) => p.playerId === P1)!.discard.length;
    const revealed = settle(
      runWave3(played, endTurn()),
      pickingLabelStartingWith("Discard an Element Gun"),
      undefined,
      WAVE3_DEPS,
    );
    expect(instancesOf(played, "17007").some((id) => cardsInPlay(played).includes(id))).toBe(true); // sanity: it
    // really was in play before the reveal (an upgrade, so it's attached rather than sitting in `playArea`)
    expect(playerOf(revealed, P1).discard.length).toBeGreaterThan(discardBefore);
    // Only the villain phase's own step-one threat placement (+1) lands on the main scheme: Star-Lord is in hero
    // form here (needed to play the Element Gun upgrade), so Rhino attacks him directly rather than scheming, and
    // Banishment's own "if you cannot" branch never fires (there's an Element Gun in play to discard).
    expect(mainThreat(revealed)).toBe(mainThreat(played) + 1);
  });

  it("Banishment: places 3 threat on the main scheme when you control no Element Gun (17024.obligation)", () => {
    const staged = stackEncounterDeck(starLordVsRhino(), "01186", "17024");
    const before = mainThreat(staged);
    const revealed = settle(
      runWave3(staged, { type: "endTurn", playerId: P1 }),
      pickingLabelStartingWith("Discard an Element Gun"),
      undefined,
      WAVE3_DEPS,
    );
    // Peter Quill's own hand still holds the Setup-fetched Element Gun (never played), so "in play" finds none —
    // the "if you cannot" branch fires. The villain phase's own step-one threat placement and Rhino's own
    // activation land on the main scheme too (he can't attack an alter-ego identity, so he schemes instead, SCH 1
    // undefended with this helper's own 0-boost filler): +1 (step one) + 1 (Rhino's scheme) + 3 (Banishment).
    expect(mainThreat(revealed)).toBe(before + 1 + 1 + 3);
  });

  it("Mister Knife: Retaliate 1 (data) and the first treachery the engaged player reveals each villain phase gains surge (17026.mister-knife-constant)", () => {
    const { state, id: knife } = revealFromEncounterDeck(starLordVsRhino(), "17026", firstLegal, 1);
    expect(hasKeyword(state, knife, "retaliate", WAVE3_DEPS)).toBe(true);
    // Mister Knife is already engaged with the sole player once revealed (solo play), so no engagement surgery is
    // needed — "the engaged player" is already P1.
    const discardBefore = activeEncounterDeck(state).discard.length;
    // Spartoi Cunning (17027, ×3) starts set aside with the rest of his nemesis set (confirmed: none of the 3
    // copies are in the encounter deck or its discard pile before this point), the same as the nemesis minion
    // itself — `stackSetAside` (not `stackEncounterDeck`) is what actually reaches it. "01186" absorbs Mister
    // Knife's own boost draw as the engaged minion's activation (the same unconditional-boost trap as ever).
    // `stackSetAside` first (unshifts Spartoi Cunning to the very top), then `stackEncounterDeck` (which always
    // places its own cards ahead of whatever's already on top): the boost draw consumes "01186" first, leaving
    // Spartoi Cunning as the very next card — the villain phase's own reveal.
    const staged = stackEncounterDeck(stackSetAside(state, "17027"), "01186");
    const spartoiCunning = activeEncounterDeck(staged).deck[1]!;
    const { state: revealed, events } = driveEvents(WAVE3_DEPS, staged, endTurn());
    // Mister Knife's rule grants Spartoi Cunning surge as it's revealed — proven directly by the log (docs/phase7-
    // wave3.md §3.8's own `surgeGranted` event), not inferred from the discard pile's size (the surge-triggered
    // further reveal might itself be a side scheme, which enters play rather than being discarded, so a raw
    // discard-count check is not a reliable signal either way).
    expect(events).toContainEqual(expect.objectContaining({ type: "surgeGranted", instanceId: spartoiCunning }));
    expect(activeEncounterDeck(revealed).discard.length).toBeGreaterThan(discardBefore);
  });

  it("Spartoi Cunning: When Revealed, discard 1 card at random from hand, take 1 damage, and place 1 threat on the main scheme (17027.when-revealed)", () => {
    const start = starLordVsRhino();
    const identity = identityOf(start);
    // Peter Quill's own printed hand size (alter-ego) is 6; trim to well under it first, so "end of player phase"
    // own discard-down-to-hand-size step (RRG 1.8 p. 18) contributes no noise of its own to the hand-size delta
    // this test reads off Spartoi Cunning's own effect.
    const trimmed: GameState = {
      ...start,
      players: start.players.map((p) =>
        p.playerId === P1 ? { ...p, hand: p.hand.slice(0, 4), discard: [...p.discard, ...p.hand.slice(4)] } : p,
      ),
    };
    const damageBefore = inst(trimmed, identity).damage;
    const discardBefore = playerOf(trimmed, P1).discard.length;
    const threatBefore = mainThreat(trimmed);
    const { state } = revealFromEncounterDeck(trimmed, "17027", firstLegal);
    // Rhino cannot attack an alter-ego identity (RRG 1.8 "Attack", p. 8), so he schemes instead this villain phase
    // (undefended SCH 1, plus this helper's own 0-boost filler): the villain phase's own step-one threat (+1) and
    // Rhino's own scheme (+1) land on the main scheme alongside Spartoi Cunning's own printed +1 — neither touches
    // damage, which stays exact to Spartoi Cunning's own text.
    expect(inst(state, identity).damage).toBe(damageBefore + 1);
    expect(mainThreat(state)).toBe(threatBefore + 1 + 1 + 1);
    // Not asserted on hand *size*: reaching a villain-phase reveal via `endTurn()` runs the flow all the way to
    // the *next* round's own player-phase draw step too (`settle`'s stop condition is "back at a player's own
    // turn", which is after that draw), so a hand-size delta here would conflate Spartoi Cunning's own discard
    // with that unrelated draw. The discard itself — the mechanism, not the resulting count — is what's checked:
    // it must have removed a card from Peter Quill's hand into his own discard pile, and `discardAtRandom`'s
    // underlying primitive already has direct coverage (Adam Warlock's own test, same file's sibling module).
    expect(playerOf(state, P1).discard.length).toBeGreaterThan(discardBefore);
  });
});
