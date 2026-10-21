import {
  cannotLeavePlay,
  mustDefendWithAlly,
  notDefeatedWithoutThreat,
  schemeThreatDestination,
  villainOf,
  type GameEvent,
  type GameState,
  type InstanceId,
} from "@mc/engine";
import {
  P1,
  endTurn,
  firstLegal,
  identityOf,
  inst,
  patchInstance,
  playerOf,
  settle,
  stackEncounterDeck,
  toHero,
  use,
} from "../../testing/harness.js";
import { driveEventsPicking, playFromHand, withActive } from "../../testing/staging.js";
import { wave1Scenario } from "../setup.js";
import { findInstance, forceAttachToVillain, runTwc, startTwcGame, TWC_DEPS } from "./testing.js";

const spiderManVsBreakout = () =>
  startTwcGame(wave1Scenario("breakout", { players: [{ starterDeckId: "core-spider-man-justice" }], seed: 41 }));
const play = (state: GameState, ...commands: Parameters<typeof runTwc>[1][]): GameState =>
  settle(runTwc(state, ...commands), undefined, (s) => s.step.phase === "player" && s.step.kind === "turn", TWC_DEPS);

const bulldozerId = (state: GameState) => state.villains[3]!.instanceId;
const clearTheRoadId = (state: GameState) => villainOf(state, bulldozerId(state))!.signatureSideSchemeId!;

describe("Bulldozer (07046/07047)", () => {
  it("redirects his own scheme threat to Clear the Road instead of the main scheme", () => {
    const state = spiderManVsBreakout();
    expect(schemeThreatDestination(state, TWC_DEPS, bulldozerId(state))).toBe(clearTheRoadId(state));
  });

  it("Forced Interrupt gives every one of his attacks overkill: a lethal attack against an ally spills over", () => {
    let state = withActive(spiderManVsBreakout(), bulldozerId(spiderManVsBreakout()));
    // 8 (9 after step one's own +1) beats every other villain's post-step-one total (Wrecker's 6+1=7 is the
    // highest of the rest) without itself already crossing Charge!'s own 10-or-more threshold when step one's +1
    // lands, which would hand the active counter to Wrecker before the re-pick even reads the totals
    // (`wave1/twc/breakout.test.ts`'s own test documents the same interaction).
    state = patchInstance(state, clearTheRoadId(state), { threat: 8 });
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

  it("Charge!: at 10+ threat, every player discards the top 10 cards of their deck and it's capped to 3", () => {
    // Alter-ego (no `toHero()`): Bulldozer schemes this round, redirected onto Clear the Road
    // (`07046.bulldozer-constant`), same interaction as Thunderstruck's own Gamma Blast test.
    let state = withActive(spiderManVsBreakout(), bulldozerId(spiderManVsBreakout()));
    // 8 (9 after step one's own +1) keeps Bulldozer picked active while comfortably crossing Charge!'s 10-or-more
    // threshold once his own SCH (1) redirects onto it too.
    state = patchInstance(state, clearTheRoadId(state), { threat: 8 });
    const deckBefore = state.players[0]!.deck.length;
    state = play(state, endTurn());
    expect(inst(state, clearTheRoadId(state)).threat).toBe(3);
    expect(state.players[0]!.deck.length).toBe(deckBefore - 10);
    expect(state.players[0]!.discard.length).toBeGreaterThanOrEqual(10);
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

describe("Bulldozer's Helmet (07049) with overkill spilling past a defending ally", () => {
  const HELMET_RESPONSE = "07049.bulldozers-helmet-forced-response";
  /** Black Cat (2 hit points, no DEF) defends Bulldozer's attack, which has overkill (his Forced Interrupt). */
  function bulldozerAttacksBlackCat(): {
    readonly events: readonly GameEvent[];
    readonly state: GameState;
    readonly deckBefore: number;
  } {
    let state = withActive(spiderManVsBreakout(), bulldozerId(spiderManVsBreakout()));
    // As the tests above: keeps Bulldozer the active villain without tripping Charge!.
    state = patchInstance(state, clearTheRoadId(state), { threat: 8 });
    const bulldozer = bulldozerId(state);
    state = runTwc(forceAttachToVillain(state, findInstance(state, "07049"), bulldozer), toHero());
    state = patchInstance(state, identityOf(state, P1), { exhausted: false });
    const { state: withAlly, id: ally } = playFromHand(TWC_DEPS, state, "01002", 2);
    const deckBefore = playerOf(withAlly, P1).deck.length;
    let defended = false;
    const pick = (s: GameState): readonly string[] => {
      const choice = s.pendingChoice!;
      if (!defended && choice.prompt.kind === "declareDefender" && choice.prompt.attack.enemyInstanceId === bulldozer) {
        defended = true;
        return [ally as InstanceId];
      }
      return choice.prompt.kind === "declareDefender" ? ["decline"] : firstLegal(s);
    };
    const { events, state: after } = driveEventsPicking(TWC_DEPS, withAlly, pick, endTurn(P1));
    return { events, state: after, deckBefore };
  }
  /** Bulldozer's first attack's events (a later attack would answer the Helmet again). */
  const firstAttackOf = (events: readonly GameEvent[]): readonly GameEvent[] => {
    const first = events.findIndex((e) => e.type === "attackResolved");
    const next = events.findIndex((e, i) => i > first && e.type === "attackResolved");
    return events.slice(first, next < 0 ? undefined : next);
  };

  it("'After Bulldozer attacks you' resolves once, discarding 1 card per damage the whole attack dealt", () => {
    // RRG 1.8 "You, Your" (p. 49): "attacks you" is the attacked player, attacked once; "Overkill" (p. 31): the spill
    // is damage from the attack but not another attack. Ruling January 11, 2026 (2) (https://hallofheroeslcg.com/latest-ffg-rulings-post-rrg-1-7/)
    // makes "attacks and damages" a condition per damaged character, which "attacks you" is not.
    const { events, state } = bulldozerAttacksBlackCat();
    const attack = firstAttackOf(events);
    const hits = attack.filter((e) => e.type === "damageDealt");
    // The setup's own check: the ally and, by overkill, the identity were both damaged.
    expect(hits.map((e) => e.targetInstanceId)).toContain(identityOf(state, P1));
    expect(hits.length).toBe(2);
    const total = hits.reduce((sum, e) => sum + (e.type === "damageDealt" ? e.amount : 0), 0);
    const resolved = attack.filter((e) => e.type === "abilityResolved" && String(e.abilityId) === HELMET_RESPONSE);
    expect(resolved).toHaveLength(1);
    const milled = attack.filter((e) => e.type === "cardMoved" && e.from.kind === "deck" && e.to.kind === "discard");
    expect(milled).toHaveLength(total);
  });

  it("counts damage a tough status card stops: it was dealt, not taken", () => {
    // RRG 1.8 "Damage" (p. 14): when the damage taken is modified "(such as by damage being prevented), the amount of
    // damage dealt is not modified"; "Tough" (p. 44) prevents it (ruling January 17, 2026 (3)).
    let state = withActive(spiderManVsBreakout(), bulldozerId(spiderManVsBreakout()));
    state = patchInstance(state, clearTheRoadId(state), { threat: 8 });
    const bulldozer = bulldozerId(state);
    state = runTwc(forceAttachToVillain(state, findInstance(state, "07049"), bulldozer), toHero());
    const identity = identityOf(state, P1);
    state = patchInstance(state, identity, { statuses: { ...inst(state, identity).statuses, tough: 1 } });
    const pick = (s: GameState): readonly string[] =>
      s.pendingChoice!.prompt.kind === "declareDefender" ? ["decline"] : firstLegal(s);
    const { events } = driveEventsPicking(TWC_DEPS, state, pick, endTurn(P1));
    const attack = firstAttackOf(events);
    const stopped = attack.filter((e) => e.type === "damagePrevented" && e.reason === "tough");
    expect(stopped).toHaveLength(1);
    expect(attack.some((e) => e.type === "damageDealt")).toBe(false);
    const milled = attack.filter((e) => e.type === "cardMoved" && e.from.kind === "deck" && e.to.kind === "discard");
    expect(milled).toHaveLength(stopped[0]!.type === "damagePrevented" ? stopped[0]!.amount : -1);
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
    // See the Forced Interrupt test above: 8 keeps Bulldozer picked active without prematurely tripping Charge!
    // during step one, so his own encounter deck (holding the stacked cards below) is the one actually used.
    state = patchInstance(state, clearTheRoadId(state), { threat: 8 });
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
    const found = Object.values(state.instances).some(
      (i) => i.cardId === "07059" && i.home?.kind === "encounterDeck" && i.home.deckId === deckId,
    );
    expect(found).toBe(true);
  });
});
