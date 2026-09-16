import { cannotLeavePlay, encounterDeckOf, notDefeatedWithoutThreat, schemeThreatDestination, villainOf, type GameState, type InstanceId } from "@mc/engine";
import { P1, endTurn, identityOf, inst, patchInstance, playerOf, settle, stackEncounterDeck, toHero, use } from "../../testing/harness.js";
import { wave1Scenario } from "../setup.js";
import { findInstance, forceAttachToVillain, runTwc, startTwcGame, TWC_DEPS } from "./testing.js";

const spiderManVsBreakout = () => startTwcGame(wave1Scenario("breakout", { players: [{ starterDeckId: "core-spider-man-justice" }], seed: 41 }));
const play = (state: GameState, ...commands: Parameters<typeof runTwc>[1][]): GameState =>
  settle(runTwc(state, ...commands), undefined, (s) => s.step.phase === "player" && s.step.kind === "turn", TWC_DEPS);

const thunderballId = (state: GameState) => state.villains[1]!.instanceId;
const thunderstruckId = (state: GameState) => villainOf(state, thunderballId(state))!.signatureSideSchemeId!;
const withActive = (state: GameState, id: InstanceId): GameState => ({ ...state, activeVillainId: id });

describe("Thunderball (07017/07018)", () => {
  it("redirects his own scheme threat to Thunderstruck instead of the main scheme", () => {
    const state = spiderManVsBreakout();
    expect(schemeThreatDestination(state, TWC_DEPS, thunderballId(state))).toBe(thunderstruckId(state));
  });

  it("Forced Response: after Thunderball attacks you, deals 1 damage to each character you control (real villain-phase attack, hero form)", () => {
    let state = withActive(spiderManVsBreakout(), thunderballId(spiderManVsBreakout()));
    const heroId = identityOf(state, P1);
    state = patchInstance(state, heroId, { exhausted: false });
    // Breakout 1B re-picks the active villain every round by highest side-scheme threat; keep Thunderball active
    // for this round (otherwise it reverts to Wrecker, whose Day of Reckoning starts highest, before step two).
    state = patchInstance(state, thunderstruckId(state), { threat: 99 });
    const before = inst(state, heroId).damage;
    state = play(state, toHero(), endTurn());
    // Thunderball's own attack plus the Forced Response's extra "1 damage to each character you control" (and
    // whatever the round's dealt encounter card also does) all land on the same lone hero, so this is strictly more
    // than any single one of those alone would be.
    expect(inst(state, heroId).damage).toBeGreaterThan(before);
  });
});

describe("Thunderstruck (07019)", () => {
  it("cannot leave play while Thunderball is in play, and is not defeated at 0 threat", () => {
    const state = spiderManVsBreakout();
    const scheme = thunderstruckId(state);
    expect(cannotLeavePlay(state, TWC_DEPS, scheme)).toBe(true);
    expect(notDefeatedWithoutThreat(state, TWC_DEPS, scheme)).toBe(true);
  });
});

describe("Ball and Chain (07020)", () => {
  it("Hero Action: exhausts your hero and discards 1 random hand card, then discards itself", () => {
    const start = spiderManVsBreakout();
    // Same "attach directly, without a real reveal" surgery as `wrecker.test.ts`'s Magic Crowbar test — the RNG
    // determinism of `discardRandomFromHandCost` itself is proven there (`startSession`/`sessionApply`/`replay`);
    // this only needs to prove the shape here.
    const thunderball = thunderballId(start);
    const ballAndChain = findInstance(start, "07020");
    const state = runTwc(forceAttachToVillain(start, ballAndChain, thunderball), toHero());
    const identity = identityOf(state);
    const handBefore = playerOf(state, P1).hand;
    expect(handBefore.length).toBeGreaterThan(0);
    const after = runTwc(state, use(P1, ballAndChain, "07020.ball-and-chain-action"));
    const handAfter = playerOf(after, P1).hand;
    const discarded = handBefore.filter((id) => !handAfter.includes(id));
    expect(discarded).toHaveLength(1);
    expect(playerOf(after, P1).discard).toContain(discarded[0]);
    expect(inst(after, identity).exhausted).toBe(true);
    expect(inst(after, thunderball).attachments).not.toContain(ballAndChain);
    expect(Object.values(after.encounterDecks).some((piles) => piles.discard.includes(ballAndChain))).toBe(true);
  });
});

describe("Radioactive Buildup (07022)", () => {
  it("is in Thunderball's own 15-card encounter deck", () => {
    const state = spiderManVsBreakout();
    const deckId = state.villains[1]!.encounterDeckId;
    const cards = [...encounterDeckOf(state, deckId).deck, ...encounterDeckOf(state, deckId).discard];
    expect(cards.some((id) => inst(state, id).cardId === "07022")).toBe(true);
  });
});
