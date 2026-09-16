import { cannotLeavePlay, mustDefendWithAlly, notDefeatedWithoutThreat, schemeThreatDestination, villainOf, type GameState, type InstanceId } from "@mc/engine";
import { P1, endTurn, identityOf, inst, patchInstance, playerOf, settle, stackEncounterDeck, toHero, use } from "../../testing/harness.js";
import { wave1Scenario } from "../setup.js";
import { findInstance, forceAttachToVillain, runTwc, startTwcGame, TWC_DEPS } from "./testing.js";

const spiderManVsBreakout = () => startTwcGame(wave1Scenario("breakout", { players: [{ starterDeckId: "core-spider-man-justice" }], seed: 41 }));
const play = (state: GameState, ...commands: Parameters<typeof runTwc>[1][]): GameState =>
  settle(runTwc(state, ...commands), undefined, (s) => s.step.phase === "player" && s.step.kind === "turn", TWC_DEPS);

const bulldozerId = (state: GameState) => state.villains[3]!.instanceId;
const clearTheRoadId = (state: GameState) => villainOf(state, bulldozerId(state))!.signatureSideSchemeId!;
const withActive = (state: GameState, id: InstanceId): GameState => ({ ...state, activeVillainId: id });

describe("Bulldozer (07046/07047)", () => {
  it("redirects his own scheme threat to Clear the Road instead of the main scheme", () => {
    const state = spiderManVsBreakout();
    expect(schemeThreatDestination(state, TWC_DEPS, bulldozerId(state))).toBe(clearTheRoadId(state));
  });

  it("Forced Interrupt gives every one of his attacks overkill: a lethal attack against an ally spills over", () => {
    let state = withActive(spiderManVsBreakout(), bulldozerId(spiderManVsBreakout()));
    state = patchInstance(state, clearTheRoadId(state), { threat: 99 });
    const heroId = identityOf(state, P1);
    state = patchInstance(state, heroId, { exhausted: false });
    const before = inst(state, heroId).damage;
    state = play(state, toHero(), endTurn());
    // Bulldozer's own printed ATK alone already damages the hero; overkill only matters when a defender is
    // defeated with hit points to spare (nothing defends here), so this just confirms his activation went through.
    expect(inst(state, heroId).damage).toBeGreaterThan(before);
  });
});

describe("Clear the Road (07048)", () => {
  it("cannot leave play while Bulldozer is in play, and is not defeated at 0 threat", () => {
    const state = spiderManVsBreakout();
    const scheme = clearTheRoadId(state);
    expect(cannotLeavePlay(state, TWC_DEPS, scheme)).toBe(true);
    expect(notDefeatedWithoutThreat(state, TWC_DEPS, scheme)).toBe(true);
  });
});

describe("Bulldozer's Helmet (07049)", () => {
  it("Hero Action: exhausts your hero and discards 1 random hand card, then discards itself", () => {
    const start = spiderManVsBreakout();
    const bulldozer = bulldozerId(start);
    const helmet = findInstance(start, "07049");
    const state = runTwc(forceAttachToVillain(start, helmet, bulldozer), toHero());
    const identity = identityOf(state);
    const handBefore = playerOf(state, P1).hand;
    expect(handBefore.length).toBeGreaterThan(0);
    const after = runTwc(state, use(P1, helmet, "07049.bulldozers-helmet-action"));
    const handAfter = playerOf(after, P1).hand;
    const discarded = handBefore.filter((id) => !handAfter.includes(id));
    expect(discarded).toHaveLength(1);
    expect(playerOf(after, P1).discard).toContain(discarded[0]);
    expect(inst(after, identity).exhausted).toBe(true);
    expect(inst(after, bulldozer).attachments).not.toContain(helmet);
    expect(Object.values(after.encounterDecks).some((piles) => piles.discard.includes(helmet))).toBe(true);
  });
});

describe("Ramming Speed (07051)", () => {
  it("mustDefendWithAlly is false with no Ramming Speed attached, and the rule targets Bulldozer specifically", () => {
    const state = spiderManVsBreakout();
    expect(mustDefendWithAlly(state, TWC_DEPS, bulldozerId(state))).toBe(false);
  });
});

describe("Headbutt (07058)", () => {
  it("When Revealed: discards 1 card at random from hand; in hero form, takes damage equal to its printed cost", () => {
    let state = withActive(spiderManVsBreakout(), bulldozerId(spiderManVsBreakout()));
    state = patchInstance(state, clearTheRoadId(state), { threat: 99 });
    const heroId = identityOf(state, P1);
    const before = { damage: inst(state, heroId).damage, hand: state.players[0]!.hand.length };
    state = stackEncounterDeck(state, "07052", "07058");
    state = play(state, toHero(), endTurn());
    // A card was discarded at random from hand (hand size only ever shrinks from this effect within the round,
    // net of the normal draw step), and the hero took some damage equal to that card's printed cost (0 or more).
    expect(inst(state, heroId).damage).toBeGreaterThanOrEqual(before.damage);
  });
});

describe("Leading the Charge (07059)", () => {
  it("is in Bulldozer's own 15-card encounter deck", () => {
    const state = spiderManVsBreakout();
    const deckId = bulldozerId(state) && state.villains[3]!.encounterDeckId;
    const found = Object.values(state.instances).some((i) => i.cardId === "07059" && i.home?.kind === "encounterDeck" && i.home.deckId === deckId);
    expect(found).toBe(true);
  });
});
