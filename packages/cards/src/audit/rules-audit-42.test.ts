/**
 * Rules audit chunk 42 (FFG rulings, June to July 2024). Proof tests for bugs only; see
 * the rules audit
 */
import { describe, expect, it } from "vitest";
import { cardId, PLAYABLE_CARDS } from "@mc/content";
import { activeEncounterDeck, createGame, type GameEvent, type GameState, type InstanceId } from "@mc/engine";
import {
  endTurn,
  firstLegal,
  identityOf,
  inst,
  P1,
  patchInstance,
  picking,
  playerOf,
  runWith,
  settle,
  toHero,
  use,
} from "../testing/harness.js";
import { PLAYABLE_DEPS, playableScenario } from "../playable/index.js";
import {
  accepting,
  basicAttackCmd,
  drive as drive7,
  openedHero,
  spawnMinion,
  wasOffered,
} from "../wave7/cross-hero-testing.js";
import { moveToHand, payWith, play } from "../testing/harness.js";
import { stackInvocation } from "../wave1/drs/testing.js";
import { conjure, drive, playOut, rhino } from "../testing/qa-bench.js";

const nameOf = (state: GameState, id: InstanceId): string => state.cardPool[inst(state, id).cardId]?.name ?? id;

describe("June 13, 2024 - Ruling 212 (post-RRG 1.5): 'the villain' in The Wrecking Crew", () => {
  // Ruling 212: "any card ability (played, triggered, Action, constant, keyword) that refers to 'the villain' always
  // refers to the active villain" in Wrecking Crew (Tower Defense / Sinister Six / Four Horsemen let the player choose;
  // Wrecking Crew does not). RRG 1.8 is silent on this (the scenario insert is the source).
  it.fails("Spider-Woman (01011, 'confuse the villain') played in Breakout confuses the active villain; the player is not asked", () => {
    const start = rhino(1, "core-spider-man-justice", "breakout");
    const active = start.activeVillainId!;
    const other = start.villains.find((v) => v.instanceId !== active)!.instanceId;
    const { state, id } = conjure(start, "01011");
    // The player (wrongly) is offered the other villains; steer the pick at a non-active one.
    const played = playOut(state, id, 3, { use: ["spider-woman"], target: other });
    expect(played.accepted).toBe(true);
    const confused = (v: InstanceId) => inst(played.state, v).statuses.confused ?? 0;
    expect([nameOf(played.state, active), confused(active), confused(other)]).toEqual(["Wrecker", 1, 0]);
  });
});

describe("June 20, 2024 - Ruling 216 answer 2 (post-RRG 1.5): Rogue plays Chill Out! and attaches Iceman's set-aside Frostbite", () => {
  // Ruling 216: "As long as the event Rogue is playing doesn't require her to pay a cost with a card she doesn't
  // control, she can resolve the event as written ... attach a set-aside copy of Frostbite to an enemy". The script
  // reads `setAside(you, FROSTBITE)`, i.e. only the playing player's own set-aside area, which holds no copy.
  it("Rogue (P1) plays a Chill Out! while Iceman (P2) holds the set-aside Frostbite: a copy is attached to an enemy", () => {
    const start = rhino(3, "rogue-protection", "rhino", ["iceman-aggression"]);
    const { state, id } = conjure(start, "46011");
    const played = playOut(state, id, 2, {});
    expect(played.accepted).toBe(true);
    const villain = played.state.villains[0]!.instanceId;
    const onVillain = inst(played.state, villain).attachments.filter(
      (a) => played.state.cardPool[inst(played.state, a).cardId]?.name === "Frostbite",
    );
    expect(onVillain.length).toBe(1);
  });
});

describe("June 13, 2024 - Ruling 214 answer 1 (post-RRG 1.5), RRG 1.8 p. 6 'Activation'", () => {
  // RRG 1.8 p. 6: "If an effect initiates an activation during the resolution of another activation, the newly
  // initiated activation resolves after the current activation has finished resolving." Ruling 214: I've Been Waiting
  // For This! (07014) boost "That villain schemes" does not interrupt the attack it boosts.
  it.fails("I've Been Waiting For This! as a boost: the scheme it causes resolves after the boosted attack deals its damage", () => {
    const base = rhino(5, "core-spider-man-justice", "breakout");
    const start = patchInstance(base, base.mainScheme.instanceId, { threat: 0 });
    const top = activeEncounterDeck(start).deck[0]!;
    const staged = patchInstance(start, top, { cardId: cardId("07014") });
    const done = drive(staged, endTurn(P1), {});
    const hero = identityOf(done.state);
    const index = (test: (e: GameEvent) => boolean) => done.events.findIndex(test);
    const heroDamaged = index((e) => e.type === "damageDealt" && e.targetInstanceId === hero);
    const schemeBegan = index(
      (e) => e.type === "triggerEvent" && e.phase === "initiated" && e.event.kind === "enemyScheme",
    );
    expect(heroDamaged).toBeGreaterThanOrEqual(0);
    expect(schemeBegan).toBeGreaterThanOrEqual(0);
    expect(heroDamaged).toBeLessThan(schemeBegan);
  });
});

describe("June 20, 2024 - Ruling 215 answer 1 (post-RRG 1.5): Vapors of Valtorr and a Stalwart enemy with Tough", () => {
  // Ruling 215: a Stalwart enemy with a tough status card "is not a valid target for Vapors of Valtorr's ability, as a
  // Stalwart enemy cannot be stunned or confused". RRG 1.8 p. 43 "Target": a target is valid only if the ability can
  // affect it (the replacement for Tough can only be stunned or confused). Mister Sinister (33028) is Stalwart.
  it.fails("Vapors of Valtorr cannot take the tough card off the Stalwart minion Mister Sinister: he keeps it", () => {
    const created = createGame(
      playableScenario("mister-sinister", { seed: 3, players: [{ starterDeckId: "drs-protection" }] }),
      PLAYABLE_DEPS,
    );
    if (!created.ok) throw new Error(created.error.message);
    const open = settle(created.state, firstLegal, (s) => s.step.phase === "player", PLAYABLE_DEPS);
    const hero = settle(runWith(PLAYABLE_DEPS, open, toHero(P1)), firstLegal, undefined, PLAYABLE_DEPS);
    // Mister Sinister (33028, a Stalwart minion) put into play engaged with P1 in place of the top encounter card.
    const card = PLAYABLE_CARDS.find((c) => c.id === cardId("33028"));
    if (card?.type !== "minion") throw new Error("no Mister Sinister minion");
    const v = activeEncounterDeck(hero).deck[0]!;
    const pile = activeEncounterDeck(hero);
    const placed: GameState = {
      ...patchInstance(hero, v, { cardId: card.id }),
      cardPool: { ...hero.cardPool, [card.id]: card },
    };
    const inPlay: GameState = {
      ...placed,
      encounterDecks: {
        ...placed.encounterDecks,
        [placed.activeVillainId!]: { deck: pile.deck.filter((i) => i !== v), discard: pile.discard },
      },
      players: placed.players.map((p) => (p.playerId === P1 ? { ...p, playArea: [...p.playArea, v] } : p)),
      instances: { ...placed.instances, [v]: { ...placed.instances[v]!, faceup: true, engagedWith: P1 } },
    };
    const toughened = patchInstance(inPlay, v, { statuses: { ...inst(inPlay, v).statuses, tough: 1 } });
    const stacked = stackInvocation(toughened, P1, "09035");
    const top = playerOf(stacked, P1).separateDecks["Invocation"]!.deck[0]!;
    const invoked = runWith(
      PLAYABLE_DEPS,
      stacked,
      use(P1, identityOf(stacked), "09001a.spell-mastery", [], { invocation: [top] }),
    );
    const after = settle(invoked, picking(v, "0"), undefined, PLAYABLE_DEPS);
    expect(inst(after, v).statuses.stunned + inst(after, v).statuses.confused).toBe(0); // stalwart: neither lands
    expect(inst(after, v).statuses.tough).toBe(1);
  });
});

describe("June 20, 2024 - Ruling 215 answer 3 (post-RRG 1.5): Cypher and overkill damage to a confused villain", () => {
  // Ruling 215: Cypher (41013, "After Cypher attacks and damages a confused enemy, draw 1 card") with overkill that
  // defeats a minion and damages a confused villain "did 'damage a confused enemy' via overkill, so you can draw 1
  // card". RRG 1.8 p. 31 "Overkill": the spill is damage dealt by the attack. The engine reads "damages" only on the
  // enemy the attack targeted (`trigger-events.ts` `attacked`: "never an enemy that only lost hit points to it (an
  // overkill spill)"), so the unconfused minion fails the confused-enemy test.
  it.fails("Cypher (ATK 5 with overkill) defeats an unconfused minion and spills onto the confused villain: he draws", () => {
    const base = openedHero("41013");
    const given = moveToHand(base, P1, "41013");
    const cypher = given.ids[0]!;
    const played = drive7(given.state, accepting([]), play(P1, cypher, payWith(given.state, P1, 3, [cypher])));
    const card = played.state.cardPool[inst(played.state, cypher).cardId]!;
    const boosted: GameState = {
      ...played.state,
      cardPool: {
        ...played.state.cardPool,
        [card.id]: { ...card, atk: 5, keywords: [{ name: "overkill" }] } as typeof card,
      },
    };
    const villain = boosted.villains[0]!.instanceId;
    const confusedVillain = patchInstance(boosted, villain, {
      statuses: { ...inst(boosted, villain).statuses, confused: 1 },
    });
    const minion = spawnMinion(confusedVillain);
    const before = playerOf(minion.state, P1).hand.length;
    const run = drive7(
      minion.state,
      accepting(["41013.cypher-response"]),
      basicAttackCmd(minion.state, minion.id, cypher),
    );
    expect(inst(run.state, villain).damage).toBeGreaterThan(0); // setup check: the overkill damaged the villain
    expect(wasOffered(run.offered, "41013.cypher-response")).toBe(true);
    expect(playerOf(run.state, P1).hand.length).toBe(before + 1);
  });
});
