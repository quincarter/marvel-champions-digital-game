/**
 * The Ninja cards (63002 Ninja Stars, 63003 Ninja Strike, 63004 Ninja Vanish) against Core's Rhino. Sources: ruling
 * September 10, 2026 - Ruling 3 (A) (a held boost card resolves on her next basic power, recovery included); ruling
 * October 12, 2026 - Ruling 2 ("Elektra" is her hero face only: in alter-ego form the cards find no Elektra and are
 * discarded to the encounter discard pile); owner decision 2A (2026-11-14, provisional: once in the encounter deck a
 * Ninja card is the scenario's); rules verdict Q3 (her basic defense is a basic power while the villain's boost cards
 * resolve). Elektra's hero face: ATK 1, THW 0, DEF 1, villainous; alter-ego REC 3.
 */
import { locateCard, type Command, type GameState, type InstanceId } from "@mc/engine";
import { describe, expect, it, vi } from "vitest";
import { validateDefinition } from "../../../dsl/validate.js";
import {
  P1,
  P2,
  firstLegal,
  identityOf,
  patchInstance,
  playerOf,
  stackEncounterDeck,
} from "../../../testing/harness.js";
import { driveEventsPicking } from "../../../testing/staging.js";
import {
  ADVANCE,
  ELEKTRA_DEPS,
  NINJA_STARS,
  NINJA_STRIKE,
  NINJA_VANISH,
  elektraGame,
  elektraHeroGame,
  holdingNinja,
  ninjaDealtTo,
  ninjaDeck,
  ninjaIntoEncounterDeck,
} from "./elektra.testing.js";
import { ELEKTRA_ELEKTRA_NINJA_DECK, ELEKTRA_ELEKTRA_NINJA_DECK_SKIPPED } from "./ninja-deck.js";

vi.setConfig({ testTimeout: 120_000 });

const run = (s: GameState, ...commands: readonly Command[]) =>
  driveEventsPicking(ELEKTRA_DEPS, s, firstLegal, ...commands);
const endTurn = (player = P1): Command => ({ type: "endTurn", playerId: player });
const elektra = identityOf;
const heldBy = (s: GameState, id: InstanceId): readonly InstanceId[] =>
  s.instances[id]!.boostCards.filter((b) => s.instances[b]!.heldForBasicPowers === true);
const threat = (s: GameState) => s.instances[s.mainScheme.instanceId]!.threat;
const thwart = (s: GameState): Command => ({
  type: "basicThwart",
  playerId: P1,
  thwarterInstanceId: elektra(s),
  schemeInstanceId: s.mainScheme.instanceId,
});

describe("the Ninja deck module", () => {
  it("scripts every ref and validates", () => {
    expect(Object.keys(ELEKTRA_ELEKTRA_NINJA_DECK).sort()).toEqual([
      "63002.boost",
      "63002.when-revealed",
      "63003.boost",
      "63003.when-revealed",
      "63004.boost",
      "63004.when-revealed",
    ]);
    expect(ELEKTRA_ELEKTRA_NINJA_DECK_SKIPPED).toEqual({});
    for (const [ref, definition] of Object.entries(ELEKTRA_ELEKTRA_NINJA_DECK))
      expect(validateDefinition(definition), ref).toEqual([]);
  });
});

describe("When Revealed: 'Give this card to Elektra as a facedown boost card'", () => {
  it("revealed by Elektra's player in hero form: held facedown for her next basic power, not discarded", () => {
    const dealt = ninjaDealtTo(elektraHeroGame(), NINJA_STARS, P1);
    const after = run(dealt.state, endTurn());
    expect(locateCard(after.state, dealt.id)).toEqual({ kind: "boost", hostInstanceId: elektra(after.state) });
    expect(after.state.instances[dealt.id]).toMatchObject({ faceup: false, heldForBasicPowers: true, ownerId: null });
  });

  it("revealed by another player (multiplayer): it still goes to Elektra", () => {
    const dealt = ninjaDealtTo(elektraHeroGame({ withSpiderMan: true }), NINJA_VANISH, P2);
    const after = run(dealt.state, endTurn(P1), endTurn(P2));
    expect(locateCard(after.state, dealt.id)).toEqual({ kind: "boost", hostInstanceId: elektra(after.state) });
    expect(heldBy(after.state, elektra(after.state))).toContain(dealt.id);
  });

  it("with Elektra in alter-ego form there is no 'Elektra': it is discarded to the encounter discard pile (Oct 12 R2)", () => {
    const dealt = ninjaDealtTo(elektraGame(), NINJA_STRIKE, P1);
    const after = run(dealt.state, endTurn());
    expect(locateCard(after.state, dealt.id)?.kind).toBe("encounterDiscard");
    expect(after.state.instances[elektra(after.state)]!.boostCards).not.toContain(dealt.id);
  });
});

describe("Boost, as her own held card while she uses a basic power", () => {
  /** Elektra in hero form holding `code`, Advance (0 icons, no Boost) on top for her villainous card. */
  const holding = (code: string) => {
    const held = holdingNinja(elektraHeroGame(), code);
    return { state: stackEncounterDeck(held.state, ADVANCE), id: held.id };
  };

  it("Ninja Stars: draw 2, then shuffled back into the Ninja deck, Elektra's player's card again", () => {
    const { state, id } = holding(NINJA_STARS);
    const hand = playerOf(state, P1).hand.length;
    const after = run(state, thwart(state));
    expect(playerOf(after.state, P1).hand.length).toBe(hand + 2);
    expect(ninjaDeck(after.state)).toContain(id);
    expect(after.state.instances[id]).toMatchObject({
      ownerId: P1,
      controllerId: null,
      faceup: false,
      home: { kind: "separateDeck", name: "Ninja" },
    });
  });

  it("Ninja Strike: +3 to that power for this use (THW 0 + 3)", () => {
    const { state, id } = holding(NINJA_STRIKE);
    const after = run(state, thwart(state));
    expect(threat(after.state)).toBe(threat(state) - 3);
    expect(ninjaDeck(after.state)).toContain(id);
  });

  it("Ninja Vanish: a tough status card for her", () => {
    const { state } = holding(NINJA_VANISH);
    const after = run(state, thwart(state));
    expect(after.state.instances[elektra(after.state)]!.statuses.tough).toBe(1);
  });

  it("in alter-ego form, on a basic recovery: no 'Elektra' using a power and none to give it to, so discarded", () => {
    const held = holdingNinja(elektraGame(), NINJA_STARS);
    const hurt = patchInstance(held.state, elektra(held.state), { damage: 5 });
    const hand = playerOf(hurt, P1).hand.length;
    const after = run(hurt, { type: "basicRecover", playerId: P1 });
    expect(playerOf(after.state, P1).hand.length).toBe(hand);
    expect(locateCard(after.state, held.id)?.kind).toBe("encounterDiscard");
    // REC 3 + Ninja Stars' 0 icons.
    expect(after.state.instances[elektra(after.state)]!.damage).toBe(2);
  });
});

describe("Boost, as the villain's boost card while Elektra defends (rules verdict Q3)", () => {
  it("she is using her basic defense, so its first half resolves: draw 2, back into the Ninja deck", () => {
    // In hero form the villain attacks her: its boost card is the encounter deck's top card; Advance is next, for her
    // villainous defense.
    const staged = ninjaIntoEncounterDeck(stackEncounterDeck(elektraHeroGame(), ADVANCE, ADVANCE), NINJA_STARS, 0);
    const after = driveEventsPicking(
      ELEKTRA_DEPS,
      staged.state,
      (s) => (s.pendingChoice?.prompt.kind === "declareDefender" ? [elektra(s)] : firstLegal(s)),
      endTurn(),
    );
    expect(after.events).toContainEqual(expect.objectContaining({ type: "boostCardFlipped", instanceId: staged.id }));
    expect(ninjaDeck(after.state)).toContain(staged.id);
    // Drawn 2 by the Boost (the end-of-round draw happens too, so compare against the same game without it).
    const plain = driveEventsPicking(
      ELEKTRA_DEPS,
      stackEncounterDeck(elektraHeroGame(), ADVANCE, ADVANCE),
      (s) => (s.pendingChoice?.prompt.kind === "declareDefender" ? [elektra(s)] : firstLegal(s)),
      endTurn(),
    );
    expect(playerOf(after.state, P1).hand.length).toBe(playerOf(plain.state, P1).hand.length + 2);
  });

  it("Ninja Strike: she is using her basic defense, so she gets +3 DEF for it (ATK 2 against DEF 1 + 3: no damage)", () => {
    const defend = (s: GameState) =>
      driveEventsPicking(
        ELEKTRA_DEPS,
        s,
        (st) => (st.pendingChoice?.prompt.kind === "declareDefender" ? [elektra(st)] : firstLegal(st)),
        endTurn(),
      );
    const staged = ninjaIntoEncounterDeck(stackEncounterDeck(elektraHeroGame(), ADVANCE, ADVANCE), NINJA_STRIKE, 0);
    const before = staged.state.instances[elektra(staged.state)]!.damage;
    const after = defend(staged.state);
    expect(after.events).toContainEqual(expect.objectContaining({ type: "boostCardFlipped", instanceId: staged.id }));
    expect(after.state.instances[elektra(after.state)]!.damage).toBe(before);
    expect(ninjaDeck(after.state)).toContain(staged.id);
    // Control: Advance (0 icons, no Boost) as the villain's card, ATK 2 against DEF 1: 1 damage.
    const plain = stackEncounterDeck(elektraHeroGame(), ADVANCE, ADVANCE);
    const control = defend(plain);
    expect(control.state.instances[elektra(control.state)]!.damage).toBe(plain.instances[elektra(plain)]!.damage + 1);
  });

  it("not defending: its Boost gives it to Elektra to hold instead", () => {
    const staged = ninjaIntoEncounterDeck(stackEncounterDeck(elektraHeroGame(), ADVANCE, ADVANCE), NINJA_STARS, 0);
    const after = run(staged.state, endTurn());
    expect(after.events).toContainEqual(expect.objectContaining({ type: "boostCardFlipped", instanceId: staged.id }));
    expect(heldBy(after.state, elektra(after.state))).toContain(staged.id);
    expect(after.state.instances[staged.id]).toMatchObject({ faceup: false });
  });
});
