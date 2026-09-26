import {
  cannotLeavePlay,
  encounterDeckOf,
  notDefeatedWithoutThreat,
  schemeThreatDestination,
  villainOf,
  type GameState,
  type InstanceId,
} from "@mc/engine";
import {
  answer,
  P1,
  endTurn,
  firstLegal,
  identityOf,
  inst,
  moveToHand,
  patchInstance,
  payWith,
  play as playCard,
  playerOf,
  settle,
  settleUntil,
  stackEncounterDeck,
  toHero,
  use,
} from "../../testing/harness.js";
import { withActive } from "../../testing/staging.js";
import { wave1Scenario } from "../setup.js";
import { findInstance, forceAttachToVillain, runTwc, startTwcGame, TWC_DEPS } from "./testing.js";

const spiderManVsBreakout = () =>
  startTwcGame(wave1Scenario("breakout", { players: [{ starterDeckId: "core-spider-man-justice" }], seed: 41 }));
const play = (state: GameState, ...commands: Parameters<typeof runTwc>[1][]): GameState =>
  settle(runTwc(state, ...commands), undefined, (s) => s.step.phase === "player" && s.step.kind === "turn", TWC_DEPS);

const thunderballId = (state: GameState) => state.villains[1]!.instanceId;
const thunderstruckId = (state: GameState) => villainOf(state, thunderballId(state))!.signatureSideSchemeId!;

describe("Thunderball (07017/07018)", () => {
  it("redirects his own scheme threat to Thunderstruck instead of the main scheme", () => {
    const state = spiderManVsBreakout();
    expect(schemeThreatDestination(state, TWC_DEPS, thunderballId(state))).toBe(thunderstruckId(state));
  });

  it("Forced Response: after Thunderball attacks you, deals 1 damage to each character you control (real villain-phase attack, hero form)", () => {
    let state = withActive(spiderManVsBreakout(), thunderballId(spiderManVsBreakout()));
    const heroId = identityOf(state, P1);
    state = patchInstance(state, heroId, { exhausted: false });
    // Breakout 1B re-picks the active villain every round by highest post-step-one side-scheme threat; keep
    // Thunderball active for this round (otherwise it reverts to Wrecker, whose Day of Reckoning starts highest,
    // before step two). 8 (9 after step one's own +1) beats every other villain's post-step-one total (Wrecker's
    // 6+1=7 is the highest of the rest) without itself already crossing Gamma Blast's own 10-or-more threshold when
    // step one's +1 lands, which would hand the active counter to Wrecker before the re-pick even reads the totals
    // (`wave1/twc/breakout.test.ts`'s own test documents the same interaction).
    state = patchInstance(state, thunderstruckId(state), { threat: 8 });
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

  it("Gamma Blast: at 10+ threat, stuns each friendly character and removes all but 3 threat here", () => {
    // Alter-ego (no `toHero()`): Thunderball schemes this round, redirected onto Thunderstruck
    // (`07017.thunderball-constant`), same as `wave1/twc/breakout.test.ts`'s Wrecker/Hard Hitter interaction.
    let state = withActive(spiderManVsBreakout(), thunderballId(spiderManVsBreakout()));
    const identity = identityOf(state, P1);
    // 8 (9 after step one's own +1) keeps Thunderball picked active (see the Forced Response test's own comment)
    // while comfortably crossing Gamma Blast's 10-or-more threshold once his own SCH (2) redirects onto it too.
    state = patchInstance(state, thunderstruckId(state), { threat: 8 });
    state = play(state, endTurn());
    expect(inst(state, thunderstruckId(state)).threat).toBe(3);
    expect(inst(state, identity).statuses.stunned).toBeGreaterThan(0);
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

  it("redirects excess damage *dealt by* Thunderball (not damage dealt to him) as threat on Thunderstruck", () => {
    // Overkilling the *identity* would end this solo game before the queued threat-placement frame can resolve
    // (an ally's defeat doesn't), so Black Cat defends and takes the hit instead of the hero.
    let state = withActive(spiderManVsBreakout(), thunderballId(spiderManVsBreakout()));
    const thunderball = thunderballId(state);
    const buildup = findInstance(state, "07022");
    state = forceAttachToVillain(state, buildup, thunderball);
    state = runTwc(state, toHero());
    const heroId = identityOf(state, P1);
    state = patchInstance(state, heroId, { exhausted: false });
    // Keep Thunderball picked active (see the Forced Response test's own comment): 8 (9 after step one's own +1)
    // beats every other villain's post-step-one total without itself already crossing Gamma Blast's threshold.
    state = patchInstance(state, thunderstruckId(state), { threat: 8 });
    const given = moveToHand(state, P1, "01002"); // Black Cat, printed HP 2, no printed DEF
    const [blackCat] = given.ids as [InstanceId];
    state = settle(
      runTwc(given.state, playCard(P1, blackCat, payWith(given.state, P1, 2, [blackCat]))),
      firstLegal,
      undefined,
      TWC_DEPS,
    );
    // Thunderball's own boost card this activation (07030, 2 icons): ATK 1 + 2 = 3 against Black Cat's 2 HP (no
    // printed DEF) overkills by exactly 1. "07023" (no ability) is the harmless following per-player card.
    state = stackEncounterDeck(state, "07030", "07023");
    const atDeclare = settleUntil(runTwc(state, endTurn()), "declareDefender", firstLegal, TWC_DEPS);
    const declared = answer(atDeclare, [blackCat], TWC_DEPS);
    const after = settle(declared, firstLegal, (s) => s.step.phase === "player" && s.step.kind === "turn", TWC_DEPS);
    // Excess damage is what overkill would spill (RRG 1.8 p. 31); no tough card is in play here. The redirect is a
    // constant, not a race with the card's own "discard after Thunderball attacks" Forced Response above. Without
    // it, this scheme would sit at 9 (8 + step one's own +1) — the redirected excess (1) is exactly what pushes it
    // to 10, crossing Thunderstruck's own Gamma Blast threshold and capping it to 3, proof the excess really was
    // placed *here*.
    expect(inst(after, thunderstruckId(after)).threat).toBe(3);
  });
});

describe("Energy Projectiles (07027)", () => {
  it("Boost: deals 1 damage to the defending character, on top of the (defended) attack itself", () => {
    let state = withActive(spiderManVsBreakout(), thunderballId(spiderManVsBreakout()));
    const heroId = identityOf(state, P1);
    state = patchInstance(state, heroId, { exhausted: false });
    // Thunderball's own boost card this activation; Corrupt Prison Guard (07023, no ability) as the following
    // per-player dealt card, harmless filler matching this file's own `07023`-adjacent precedent.
    state = stackEncounterDeck(state, "07027", "07023");
    const before = inst(state, heroId).damage;
    const atDeclare = settleUntil(runTwc(state, toHero(), endTurn()), "declareDefender", firstLegal, TWC_DEPS);
    const declared = answer(atDeclare, [heroId], TWC_DEPS);
    const after = settle(declared, firstLegal, (s) => s.step.phase === "player" && s.step.kind === "turn", TWC_DEPS);
    // Thunderball's printed ATK (1) against the hero's printed DEF (3) alone deals 0 — the boost's own "deal 1
    // damage to the defending character" is a separate effect, unaffected by DEF, landing regardless.
    expect(inst(after, heroId).damage).toBeGreaterThan(before);
  });
});
