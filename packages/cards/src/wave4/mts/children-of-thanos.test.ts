import { cardId } from "@mc/content";
import { cardsInPlay, type GameState, type InstanceId, type PlayerId } from "@mc/engine";
import { describe, expect, it } from "vitest";
import {
  endTurn,
  firstLegal,
  identityOf,
  patchInstance,
  picking,
  playerOf,
  runWith,
  settle,
  stackEncounterDeck,
  toHero,
  P1,
} from "../../testing/harness.js";
import { expectResolved, traceAbilities } from "../../testing/trace.js";
import { WAVE4_DEPS } from "../index.js";
import { runWave4, startWave4Game } from "../testing.js";
import { spectrumScenario } from "./support.js";

/**
 * Real-game tests for Children of Thanos (`children-of-thanos.ts`, `mts` 21125–21128, docs/phase7-wave4.md §2.2,
 * §3.23): Thanos's own recommended modular set, seated onto the (already-playable) Ebony Maw scenario via
 * `modularSetIds` — a modular set can be tested standalone against any single-villain scenario that hosts it
 * (`wave3/ron/kree-fanatic.test.ts`'s own precedent for testing a modular set apart from its recommending scenario).
 */
const game = (seed: number) =>
  startWave4Game(spectrumScenario("ebony-maw", { seed, modularSetIds: ["children_of_thanos"] }));

/** Moves `code` (already in `player`'s deck) straight into their play area — `wave4/mts/infinity-gauntlet.test.ts`'s
 * own surgery for "an ally/support you control" fixtures, generalized to any player-card code. */
function putInPlay(
  state: GameState,
  code: string,
  player: PlayerId = P1,
): { readonly state: GameState; readonly id: InstanceId } {
  const owner = playerOf(state, player);
  const wanted = cardId(code);
  const found = (id: InstanceId) => state.instances[id]?.cardId === wanted;
  const id = (owner.hand.find(found) ?? owner.deck.find(found) ?? owner.discard.find(found))!;
  return {
    id,
    state: {
      ...state,
      players: state.players.map((p) =>
        p.playerId === player
          ? {
              ...p,
              hand: p.hand.filter((i) => i !== id),
              deck: p.deck.filter((i) => i !== id),
              playArea: [...p.playArea, id],
            }
          : p,
      ),
      instances: { ...state.instances, [id]: { ...state.instances[id]!, faceup: true, controllerId: player } },
    },
  };
}

describe("Corvus Glaive (21125)", () => {
  it("21125.boost: drawn as the villain's own boost card, discards an ally or support you control", () => {
    const hero = settle(runWave4(game(1), toHero(P1)), firstLegal, undefined, WAVE4_DEPS);
    // Captain America (21011), a Spectrum precon ally, into P1's play area — the only ally/support Spectrum's own
    // precon starts with in play (no starting supports), so it is the one and only legal target.
    const { state: withAlly, id: cap } = putInPlay(hero, "21011", P1);
    expect(playerOf(withAlly, P1).playArea).toContain(cap);
    // Corvus Glaive on top of the encounter deck: the active villain's own activation draws it as its boost card
    // unconditionally (`ebony-maw.test.ts`'s own `revealTopEncounterCard` docblock).
    const staged = stackEncounterDeck(withAlly, "21125");
    const { deps, trace } = traceAbilities(WAVE4_DEPS);
    const after = settle(runWith(deps, staged, endTurn(P1)), picking(cap), undefined, deps);
    expectResolved(trace, "21125.boost");
    expect(playerOf(after, P1).playArea).not.toContain(cap);
    expect(cardsInPlay(after)).not.toContain(cap);
  });
});

describe("Proxima Midnight (21126)", () => {
  it("21126.proxima-midnight-constant: her attacks gain piercing", () => {
    expect(WAVE4_DEPS.abilities["21126.proxima-midnight-constant"]!.trigger).toEqual({
      kind: "constant",
      rules: [{ kind: "attackKeywords", keywords: ["piercing"], attacker: { self: true } }],
    });
  });

  it("21126.boost: drawn as the villain's own boost card, discards an ally or upgrade you control", () => {
    const hero = settle(runWave4(game(1), toHero(P1)), firstLegal, undefined, WAVE4_DEPS);
    // Spectrum's own precon already has 3 upgrades in play at setup (her Gamma/Photon/Pulsar energy forms), all
    // `keywords: [{ name: "permanent" }]` — `leavePlay` refuses to move a Permanent card at all (RRG 1.8
    // "Permanent"), so they are *legal but inert* choices for "discard an ally or upgrade": picking one is a real
    // answer to the prompt that correctly discards nothing. `picking(cap)` steers the choice at Captain America
    // (21011, the only non-Permanent candidate) so this test proves the effect actually removes a card, not just
    // that the ability resolved.
    const { state: withAlly, id: cap } = putInPlay(hero, "21011", P1);
    expect(cardsInPlay(withAlly)).toContain(cap);
    const staged = stackEncounterDeck(withAlly, "21126");
    const { deps, trace } = traceAbilities(WAVE4_DEPS);
    const after = settle(runWith(deps, staged, endTurn(P1)), picking(cap), undefined, deps);
    expectResolved(trace, "21126.boost");
    expect(cardsInPlay(after)).not.toContain(cap);
  });
});

describe("Ebony Maw (21127)", () => {
  it("21127.boost: drawn as the villain's own boost card, gives it 1 additional boost card for this activation", () => {
    const hero = settle(runWave4(game(4), toHero(P1)), firstLegal, undefined, WAVE4_DEPS);
    const staged = stackEncounterDeck(hero, "21127");
    const { deps, trace } = traceAbilities(WAVE4_DEPS);
    settle(runWith(deps, staged, endTurn(P1)), firstLegal, undefined, deps);
    expectResolved(trace, "21127.boost");
  });
});

describe("Tribute (21128)", () => {
  it("21128.when-defeated: deals the player who defeated this scheme a facedown encounter card", () => {
    const hero = settle(runWave4(game(2), toHero(P1)), firstLegal, undefined, WAVE4_DEPS);
    const staged = stackEncounterDeck(hero, "01186", "21128", "01186");
    const revealed = settle(runWave4(staged, endTurn(P1)), firstLegal, undefined, WAVE4_DEPS);
    const tribute = Object.keys(revealed.instances).find(
      (id) =>
        revealed.instances[id as InstanceId]!.cardId === cardId("21128") &&
        cardsInPlay(revealed).includes(id as InstanceId),
    ) as InstanceId;
    expect(tribute).toBeDefined();
    const primed = patchInstance(revealed, tribute, { threat: 1 });
    const identity = identityOf(primed, P1);
    const before = playerOf(primed, P1).dealtEncounter.length;
    const defeated = settle(
      runWave4(primed, {
        type: "basicThwart",
        playerId: P1,
        thwarterInstanceId: identity,
        schemeInstanceId: tribute,
      }),
      firstLegal,
      undefined,
      WAVE4_DEPS,
    );
    expect(cardsInPlay(defeated)).not.toContain(tribute);
    expect(playerOf(defeated, P1).dealtEncounter.length).toBe(before + 1);
  });
});
