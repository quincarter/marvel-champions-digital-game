/**
 * Elektra's identity (63001a/b) against Core's Rhino: her Ninja deck at setup and Ninja Training (owner decision 2A,
 * 2026-11-14, provisional), Killer Instinct (RRG 1.8 "Interrupt", p. 25; "'Then'", p. 44). Hero face: ATK 1, THW 0,
 * DEF 1, villainous.
 */
import { activeEncounterDeck, locateCard, type GameState, type InstanceId } from "@mc/engine";
import { describe, expect, it, vi } from "vitest";
import { validateDefinition } from "../../../dsl/validate.js";
import { P1, identityOf, playerOf, stackEncounterDeck } from "../../../testing/harness.js";
import { driveEventsPicking } from "../../../testing/staging.js";
import {
  ADVANCE,
  ELEKTRA_DEPS,
  NINJA_STARS,
  elektraGame,
  elektraHeroGame,
  holdingNinja,
  ninjaDeck,
  ninjaIntoEncounterDeck,
  picking,
  triggerOption,
  withAmplifyIcon,
} from "./elektra.testing.js";
import { ELEKTRA_ELEKTRA_IDENTITY, ELEKTRA_ELEKTRA_IDENTITY_SKIPPED } from "./identity.js";

vi.setConfig({ testTimeout: 120_000 });

const TRAINING = "63001b.ninja-training";
const KILLER_INSTINCT = "63001a.killer-instinct";
const encounterDeckIds = (s: GameState) => activeEncounterDeck(s).deck;
const ninjaCodes = new Set(["63002", "63003", "63004"]);
const ninjasIn = (s: GameState, ids: readonly InstanceId[]) =>
  ids.filter((id) => ninjaCodes.has(s.instances[id]!.cardId as string));

describe("Elektra's identity module", () => {
  it("scripts every ref and validates", () => {
    expect(Object.keys(ELEKTRA_ELEKTRA_IDENTITY).sort()).toEqual([
      "63001a.killer-instinct",
      "63001b.elektra-natchios-constant",
      "63001b.ninja-training",
    ]);
    expect(ELEKTRA_ELEKTRA_IDENTITY_SKIPPED).toEqual({});
    for (const [ref, definition] of Object.entries(ELEKTRA_ELEKTRA_IDENTITY))
      expect(validateDefinition(definition), ref).toEqual([]);
  });
});

describe("the Ninja deck (63001b; owner decision 2A)", () => {
  it("is built at setup: six facedown cards owned by Elektra's player, none in the encounter deck", () => {
    const s = elektraGame();
    const deck = ninjaDeck(s);
    expect(deck).toHaveLength(6);
    expect(deck.map((id) => s.instances[id]!.cardId as string).sort()).toEqual([
      "63002",
      "63002",
      "63003",
      "63003",
      "63004",
      "63004",
    ]);
    for (const id of deck) expect(s.instances[id]).toMatchObject({ ownerId: P1, faceup: false });
    expect(ninjasIn(s, encounterDeckIds(s))).toEqual([]);
  });
});

describe("Ninja Training: 'When you change to hero form, shuffle the top card of the Ninja deck into the encounter deck'", () => {
  const toHero = (s: GameState, take: boolean) =>
    driveEventsPicking(
      ELEKTRA_DEPS,
      s,
      picking((st) => (take ? triggerOption(st, TRAINING) : undefined)),
      { type: "changeForm", playerId: P1 },
    );

  it("taken: the top card joins the encounter deck as the scenario's card", () => {
    const s = elektraGame();
    const top = ninjaDeck(s)[0]!;
    const after = toHero(s, true);
    expect(playerOf(after.state, P1).identity.form).toBe("hero");
    expect(ninjaDeck(after.state)).toHaveLength(5);
    expect(locateCard(after.state, top)?.kind).toBe("encounterDeck");
    expect(after.state.instances[top]).toMatchObject({ ownerId: null, home: { kind: "encounterDeck" } });
  });

  it("declined (it is optional): nothing moves", () => {
    const after = toHero(elektraGame(), false);
    expect(ninjaDeck(after.state)).toHaveLength(6);
  });

  it("an empty Ninja deck: the form still changes and nothing else happens", () => {
    const s = elektraGame();
    const emptied: GameState = {
      ...s,
      players: s.players.map((p) =>
        p.playerId === P1 ? { ...p, separateDecks: { ...p.separateDecks, Ninja: { deck: [], discard: [] } } } : p,
      ),
    };
    const size = encounterDeckIds(emptied).length;
    const after = toHero(emptied, true);
    expect(playerOf(after.state, P1).identity.form).toBe("hero");
    expect(encounterDeckIds(after.state)).toHaveLength(size);
  });
});

describe("Killer Instinct: cancel a boost card's Boost ability, then it gains [boost]", () => {
  /** Elektra in hero form holding Ninja Stars, Advance (no Boost ability) on top for her villainous card. */
  const staged = () => {
    const held = holdingNinja(elektraHeroGame(), NINJA_STARS);
    return { state: stackEncounterDeck(held.state, ADVANCE), ninja: held.id };
  };
  const thwart = (s: GameState) => ({
    type: "basicThwart" as const,
    playerId: P1,
    thwarterInstanceId: identityOf(s),
    schemeInstanceId: s.mainScheme.instanceId,
  });

  it("taken on a Ninja card: its Boost (draw 2, shuffle back) is cancelled, it is discarded, and it adds 1 icon", () => {
    const { state, ninja } = staged();
    const threat = state.instances[state.mainScheme.instanceId]!.threat;
    const hand = playerOf(state, P1).hand.length;
    const after = driveEventsPicking(
      ELEKTRA_DEPS,
      state,
      picking((s) => triggerOption(s, KILLER_INSTINCT)),
      thwart(state),
    );
    expect(after.events).toContainEqual(expect.objectContaining({ type: "boostCancelled", scope: "ability" }));
    expect(playerOf(after.state, P1).hand.length).toBe(hand);
    expect(locateCard(after.state, ninja)?.kind).toBe("encounterDiscard");
    // THW 0 + Ninja Stars 0 printed + 1 gained + Advance 0.
    expect(after.state.instances[after.state.mainScheme.instanceId]!.threat).toBe(threat - 1);
  });

  it("declined: the Ninja card's Boost resolves (she is using a basic power): draw 2, back into the Ninja deck", () => {
    const { state, ninja } = staged();
    const hand = playerOf(state, P1).hand.length;
    const after = driveEventsPicking(
      ELEKTRA_DEPS,
      state,
      picking(() => undefined),
      thwart(state),
    );
    expect(playerOf(after.state, P1).hand.length).toBe(hand + 2);
    expect(ninjaDeck(after.state)).toContain(ninja);
    expect(after.state.instances[ninja]).toMatchObject({ ownerId: P1, home: { kind: "separateDeck", name: "Ninja" } });
  });

  it("with an amplify icon in play: the gained icon counts with the card's own and amplify (MC60 p. 4, owner)", () => {
    const { state, ninja } = staged();
    const amplified = withAmplifyIcon(state);
    const threat = amplified.instances[amplified.mainScheme.instanceId]!.threat;
    const after = driveEventsPicking(
      ELEKTRA_DEPS,
      amplified,
      picking((s) => triggerOption(s, KILLER_INSTINCT)),
      thwart(amplified),
    );
    expect(after.events).toContainEqual(expect.objectContaining({ type: "boostCancelled", scope: "ability" }));
    expect(locateCard(after.state, ninja)?.kind).toBe("encounterDiscard");
    // THW 0 + Ninja Stars (0 printed + 1 gained + 1 amplify) + Advance (0 printed + 1 amplify).
    expect(after.state.instances[after.state.mainScheme.instanceId]!.threat).toBe(threat - 3);
  });

  it("is not offered for another character's boost card: the villain's, while she is not defending", () => {
    // Ninja Stars (a Boost ability) as Rhino's boost card; she declines to defend, so its Boost gives it to her.
    const staged = ninjaIntoEncounterDeck(stackEncounterDeck(elektraHeroGame(), ADVANCE), NINJA_STARS, 0);
    let offered = 0;
    const after = driveEventsPicking(
      ELEKTRA_DEPS,
      staged.state,
      picking((st) => {
        if (st.pendingChoice?.prompt.kind === "declareDefender") return ["decline"];
        if (triggerOption(st, KILLER_INSTINCT)) offered++;
        return undefined;
      }),
      { type: "endTurn", playerId: P1 },
    );
    expect(after.events).toContainEqual(expect.objectContaining({ type: "boostCardFlipped", instanceId: staged.id }));
    expect(offered).toBe(0);
  });

  it("is not offered for a card with no Boost ability (her villainous Advance)", () => {
    const s = stackEncounterDeck(elektraHeroGame(), ADVANCE);
    let offered = 0;
    driveEventsPicking(
      ELEKTRA_DEPS,
      s,
      picking((st) => {
        if (triggerOption(st, KILLER_INSTINCT)) offered++;
        return undefined;
      }),
      thwart(s),
    );
    expect(offered).toBe(0);
  });
});
