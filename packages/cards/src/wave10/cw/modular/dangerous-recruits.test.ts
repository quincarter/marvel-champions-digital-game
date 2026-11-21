import { CW_CARDS } from "@mc/content";
import { activeEncounterDeckId, type GameEvent, type GameState, type InstanceId } from "@mc/engine";
import { describe, expect, it, vi } from "vitest";
import { validateDefinition } from "../../../dsl/validate.js";
import {
  P1,
  endTurn,
  firstLegal,
  identityOf,
  inst,
  patchInstance,
  stackEncounterDeck,
} from "../../../testing/harness.js";
import { driveEventsPicking, encounterCardInVillainArea, withForm } from "../../../testing/staging.js";
import { stagedInPlay } from "../../testing.js";
import { attacksBy, codeOf, flippedBoosts, inPlayCard, piles, revealedCodes, types } from "../../../wave9/testing.js";
import { IRON_MAN_SCENARIO, WAVE10_DEPS, civilWarHeroGame, engageMinion } from "../../testing.js";
import { MODULAR_DANGEROUS_RECRUITS, MODULAR_DANGEROUS_RECRUITS_SKIPPED } from "./dangerous-recruits.js";
import { MODULAR_DEFENDERS } from "./defenders.js";

vi.setConfig({ testTimeout: 120_000 });

/**
 * The Dangerous Recruits modular set (56087 Venom, 56088 Bullseye, 56089 Justice Like Lightning, 56090 Excessive
 * Force, 56091 Dangerous Recruits), docs/phase7-wave10.md sections 3.6 and 3.10. Every test is a real game in the
 * `registration-iron-man` scenario (Dangerous Recruits is one of its four modular sets), seated with the Tigra precon.
 * Iron Man's attachments are taken off by `bare` so his activation is ATK 1 and SCH 1 and nothing about the leader
 * interferes. Cooperatively the enemy leader is Iron Man and there is no "your leader" (MC56 p. 6).
 *
 * The villain phase draws the villain's boost card first, then deals each player a card (RRG 1.8 "Villain Phase"), so a
 * stack reads "boost, dealt". Advance 01186 prints no boost icon and no Boost ability. Executive Order 56085 (Maria
 * Hill's set, in this game's deck) is the harmless card to deal: it puts threat on the schemes and activates nobody.
 */
const VENOM = "56087";
const BULLSEYE = "56088";
const JUSTICE = "56089";
const FORCE = "56090";
const RECRUITS = "56091";
const ADVANCE = "01186";
const ORDER = "56085";
const DECOY = "56084"; // Life Model Decoy: an attachment that activates nobody
const AMULET = "56004"; // Tigra's upgrade: a resource ability, nothing that touches a villain phase
const HYDRA_SOLDIER = "01182"; // Guard; When Defeated: deal the engaged player an encounter card; 1 boost icon
const SET = [VENOM, BULLSEYE, JUSTICE, FORCE, RECRUITS];
const REFS = [
  "56087.venom-constant",
  "56087.when-revealed",
  "56088.when-revealed",
  "56089.when-revealed",
  "56090.when-revealed",
  "56090.boost",
  "56091.dangerous-recruits-forced-interrupt",
];

const dataOf = (code: string) => CW_CARDS.find((c) => (c.id as string) === code)! as unknown as Record<string, unknown>;
const leaderOf = (s: GameState): InstanceId => s.activeVillainId!;
const boostsOn = (s: GameState) => inst(s, leaderOf(s)).boostCards;
const hero = (s: GameState) => identityOf(s, P1);
const discardCodes = (s: GameState) => piles(s).discard.map((id) => codeOf(s, id));

/**
 * The scenario past setup, hero form, with every attachment taken off Iron Man (and his tough card) and Stark Tower back
 * back in the encounter deck: its hazard icon deals one player an extra encounter card in the villain phase (RRG 1.8 "Hazard Icon", p. 21),
 * which these stacks do not count on.
 */
function game(): GameState {
  const start = civilWarHeroGame(IRON_MAN_SCENARIO, { leaderSideScheme: "discarded" });
  const iron = leaderOf(start);
  let current = patchInstance(start, iron, { attachments: [], statuses: { ...inst(start, iron).statuses, tough: 0 } });
  const deckId = activeEncounterDeckId(current);
  const pile = current.encounterDecks[deckId]!;
  const old = inst(start, iron).attachments;
  for (const id of old) current = patchInstance(current, id, { attachedTo: null });
  current = {
    ...current,
    encounterDecks: { ...current.encounterDecks, [deckId]: { deck: pile.deck, discard: [...old, ...pile.discard] } },
  };
  return current;
}

/** Surgery: the encounter deck's own copy of minion `code`, engaged with player 1 (no reveal, no When Revealed). */
function engaged(state: GameState, code: string): { readonly state: GameState; readonly id: InstanceId } {
  const deckId = activeEncounterDeckId(state);
  const pile = state.encounterDecks[deckId]!;
  const id = [...pile.deck, ...pile.discard].find((i) => codeOf(state, i) === code);
  if (!id) throw new Error(`no ${code} in the encounter deck or discard`);
  return {
    id,
    state: {
      ...state,
      encounterDecks: {
        ...state.encounterDecks,
        [deckId]: { deck: pile.deck.filter((i) => i !== id), discard: pile.discard.filter((i) => i !== id) },
      },
      players: state.players.map((p) => (p.playerId === P1 ? { ...p, playArea: [...p.playArea, id] } : p)),
      instances: { ...state.instances, [id]: { ...state.instances[id]!, engagedWith: P1, faceup: true } },
    },
  };
}

/** Player 1's hero, readied by surgery, defeats `target` with a real basic attack. */
function defeat(state: GameState, target: InstanceId) {
  const ready = patchInstance(patchInstance(state, target, { damage: 999 }), hero(state), { exhausted: false });
  return driveEventsPicking(WAVE10_DEPS, ready, firstLegal, {
    type: "basicAttack",
    playerId: P1,
    attackerInstanceId: hero(state),
    targetInstanceId: target,
  });
}

/** Dangerous Recruits in play (3 threat) and a minion of the set engaged with player 1. */
function withRecruits(state: GameState): GameState {
  return encounterCardInVillainArea(state, RECRUITS, 3).state;
}

/** The first player ends the turn and the villain phase runs on the stacked deck (boost card first, then the dealt card). */
const villainPhase = (state: GameState, ...stack: string[]) =>
  driveEventsPicking(WAVE10_DEPS, stackEncounterDeck(state, ...stack), firstLegal, endTurn(P1));

const status = (s: GameState, id: InstanceId, name: "stunned" | "confused" | "tough") => inst(s, id).statuses[name];
const withStatus = (s: GameState, id: InstanceId, name: "stunned" | "confused" | "tough", n = 1): GameState =>
  patchInstance(s, id, { statuses: { ...inst(s, id).statuses, [name]: n } });

describe("registry", () => {
  it("registers the seven refs of the five cards, each a valid definition, and skips nothing", () => {
    expect(Object.keys(MODULAR_DANGEROUS_RECRUITS).sort()).toEqual([...REFS].sort());
    for (const [id, def] of Object.entries(MODULAR_DANGEROUS_RECRUITS)) expect(validateDefinition(def), id).toEqual([]);
    expect(MODULAR_DANGEROUS_RECRUITS_SKIPPED).toEqual({});
  });

  it("the data names exactly these refs for the five cards", () => {
    const refs = SET.flatMap((code) => ((dataOf(code).abilities ?? []) as { id: string }[]).map((a) => a.id));
    expect(refs.sort()).toEqual([...REFS].sort());
  });

  it("carries the printed timing of each ability", () => {
    const reg = MODULAR_DANGEROUS_RECRUITS;
    for (const ref of ["56087.when-revealed", "56088.when-revealed", "56089.when-revealed", "56090.when-revealed"])
      expect(reg[ref]!.trigger, ref).toMatchObject({ kind: "whenRevealed" });
    expect(reg["56087.venom-constant"]!.trigger).toMatchObject({ kind: "constant" });
    expect(reg["56090.boost"]!.trigger).toMatchObject({ kind: "boost" });
    expect(reg["56091.dangerous-recruits-forced-interrupt"]!.trigger).toMatchObject({
      kind: "interrupt",
      forced: true,
      on: { on: "characterDefeated" },
    });
  });

  it("56089 is the Defenders' Street Defenders definition, the one shared copy", () => {
    expect(MODULAR_DANGEROUS_RECRUITS["56089.when-revealed"]).toBe(MODULAR_DEFENDERS["56187.when-revealed"]);
  });

  it("the sentences about your leader are scripted (M3): Venom's attack, Bullseye's discard, the later attack", () => {
    const text = (ref: string) => JSON.stringify(MODULAR_DANGEROUS_RECRUITS[ref]);
    expect(text("56087.when-revealed")).toContain('"kind":"enemyAttacksEnemy"');
    expect(text("56088.when-revealed")).toContain('"anyGameArea":true');
    expect(text("56090.boost")).toContain('"kind":"atEndOfActivation"');
    expect(text("56090.boost")).not.toContain('"boost":true');
    expect(text("56087.when-revealed") + text("56088.when-revealed") + text("56090.boost")).not.toContain(
      "competitiveOnly",
    );
  });

  it("setup: the encounter deck holds one copy of each card", () => {
    const s = game();
    const all = Object.keys(s.instances).map((i) => codeOf(s, i as InstanceId));
    expect(SET.map((code) => all.filter((c) => c === code).length)).toEqual([1, 1, 1, 1, 1]);
  });
});

describe("Venom (56087)", () => {
  it("is data: a unique Thunderbolt minion, ATK 3, SCH 1, 4 hit points, 2 boost icons and a star icon", () => {
    const card = dataOf(VENOM);
    expect([card.type, card.atk, card.sch, card.hp, card.boostIcons, card.unique]).toEqual([
      "minion",
      3,
      1,
      4,
      2,
      true,
    ]);
  });

  it("WHEN REVEALED (no 'your leader' in a cooperative game): he activates against you, attacking you in hero form, with no boost card", () => {
    const start = game();
    const run = villainPhase(start, ADVANCE, VENOM, ORDER);
    expect(attacksBy(run.state, run.events, VENOM)).toMatchObject([{ baseAtk: 3, boostIcons: 0, damageDealt: 3 }]);
    expect(attacksBy(run.state, run.events, VENOM)).toHaveLength(1);
    // Only Iron Man's own boost card was turned up; the card behind Venom stayed on the deck.
    expect(flippedBoosts(run.events)).toHaveLength(1);
    expect(inst(run.state, inPlayCard(run.state, VENOM)!).engagedWith).toBe(P1);
    expect(codeOf(run.state, piles(run.state).deck[0]!)).toBe(ORDER);
    expect(inst(run.state, hero(run.state)).damage).toBe(1 + 3);
  });

  it("CONSTANT: his attacks gain piercing, so a tough status card does not stop his damage", () => {
    const stunnedLeader = withStatus(game(), leaderOf(game()), "stunned");
    const toughHero = withStatus(stunnedLeader, hero(stunnedLeader), "tough");
    const venom = engaged(toughHero, VENOM);
    const run = villainPhase(venom.state, ADVANCE, ORDER);
    expect(attacksBy(run.state, run.events, VENOM)).toMatchObject([{ baseAtk: 3, boostIcons: 0, damageDealt: 3 }]);
    expect(types(run.events, "statusRemoved").filter((e) => e.status === "tough")).toHaveLength(1);
    expect(status(run.state, hero(run.state), "tough")).toBe(0);
    expect(inst(run.state, hero(run.state)).damage).toBe(3);
  });

  it("CONSTANT: a minion without piercing is stopped by the same tough status card (Bullseye, ATK 2)", () => {
    const stunnedLeader = withStatus(game(), leaderOf(game()), "stunned");
    const toughHero = withStatus(stunnedLeader, hero(stunnedLeader), "tough");
    const bullseye = engaged(toughHero, BULLSEYE);
    const run = villainPhase(bullseye.state, ADVANCE, ORDER);
    expect(attacksBy(run.state, run.events, BULLSEYE)).toMatchObject([{ baseAtk: 2, boostIcons: 0 }]);
    expect(status(run.state, hero(run.state), "tough")).toBe(0);
    expect(inst(run.state, hero(run.state)).damage).toBe(0);
  });

  it("BOOST: 2 icons on the activating enemy's attack (Iron Man ATK 1 + 2)", () => {
    const run = villainPhase(game(), VENOM, ORDER);
    expect(attacksBy(run.state, run.events, "56059")).toMatchObject([{ baseAtk: 1, boostIcons: 2, damageDealt: 3 }]);
  });
});

describe("Bullseye (56088)", () => {
  it("is data: a unique Thunderbolt minion, ATK 2, SCH 2, 3 hit points and 2 boost icons", () => {
    const card = dataOf(BULLSEYE);
    expect([card.type, card.atk, card.sch, card.hp, card.boostIcons, card.unique]).toEqual([
      "minion",
      2,
      2,
      3,
      2,
      true,
    ]);
  });

  it("WHEN REVEALED (no leader to discard an attachment from): you discard the upgrade you control", () => {
    const staged = stagedInPlay(game(), AMULET, { attach: true });
    expect(inst(staged.state, hero(staged.state)).attachments).toEqual([staged.id]);
    const run = villainPhase(staged.state, ADVANCE, BULLSEYE, ORDER);
    expect(inst(run.state, hero(run.state)).attachments).toEqual([]);
    expect(types(run.events, "cardDiscardedFromPlay").map((e) => e.instanceId)).toEqual([staged.id]);
    expect(run.state.players[0]!.discard).toContain(staged.id);
    expect(inPlayCard(run.state, BULLSEYE)).toBeDefined();
    expect(revealedCodes(run.state, run.events)).toContain(BULLSEYE);
  });

  it("WHEN REVEALED with no upgrade: nothing is discarded and he stays in play engaged with you", () => {
    const run = villainPhase(game(), ADVANCE, BULLSEYE, ORDER);
    expect(types(run.events, "cardDiscardedFromPlay")).toEqual([]);
    expect(inst(run.state, inPlayCard(run.state, BULLSEYE)!).engagedWith).toBe(P1);
  });
});

describe("Justice Like Lightning (56089, the same card as Street Defenders 56187)", () => {
  it("is data: a treachery with 1 boost icon", () => {
    const card = dataOf(JUSTICE);
    expect([card.type, card.boostIcons, card.starIcon]).toEqual(["treachery", 1, undefined]);
  });

  it("WHEN REVEALED with no minion in play: the enemy leader (Iron Man) activates against you with no boost card", () => {
    const run = villainPhase(game(), ADVANCE, JUSTICE, ORDER);
    expect(attacksBy(run.state, run.events, "56059")).toMatchObject([
      { baseAtk: 1, boostIcons: 0 },
      { baseAtk: 1, boostIcons: 0 },
    ]);
    expect(flippedBoosts(run.events)).toHaveLength(1);
    expect(inst(run.state, hero(run.state)).damage).toBe(2);
    expect(codeOf(run.state, piles(run.state).deck[0]!)).toBe(ORDER);
  });

  it("WHEN REVEALED with a minion engaged with you: that minion activates again (no boost) and Iron Man does not", () => {
    const bullseye = engaged(game(), BULLSEYE);
    const run = villainPhase(bullseye.state, ADVANCE, JUSTICE, ORDER);
    expect(attacksBy(run.state, run.events, "56059")).toHaveLength(1);
    expect(attacksBy(run.state, run.events, BULLSEYE)).toMatchObject([
      { baseAtk: 2, boostIcons: 0 },
      { baseAtk: 2, boostIcons: 0 },
    ]);
    expect(flippedBoosts(run.events)).toHaveLength(1);
    expect(inst(run.state, hero(run.state)).damage).toBe(1 + 2 + 2);
  });

  it("BOOST: 1 icon on the activating enemy's attack (Iron Man ATK 1 + 1)", () => {
    const run = villainPhase(game(), JUSTICE, ORDER);
    expect(attacksBy(run.state, run.events, "56059")).toMatchObject([{ baseAtk: 1, boostIcons: 1, damageDealt: 2 }]);
  });
});

describe("Excessive Force (56090)", () => {
  const threatFrom = (events: readonly GameEvent[], source: InstanceId) =>
    types(events, "threatPlaced")
      .filter((e) => e.sourceInstanceId === source)
      .map((e) => e.amount);

  it("is data: a treachery with a boost star and no boost icon", () => {
    const card = dataOf(FORCE);
    expect([card.type, card.boostIcons, card.starIcon]).toEqual(["treachery", 0, true]);
  });

  it("WHEN REVEALED with two minions in play: 2 threat on the main scheme (1 for each minion), no surge", () => {
    const start = engaged(engaged(game(), BULLSEYE).state, VENOM).state;
    const force = Object.keys(start.instances).find((i) => codeOf(start, i as InstanceId) === FORCE) as InstanceId;
    const run = villainPhase(start, ADVANCE, FORCE, ORDER);
    expect(threatFrom(run.events, force)).toEqual([2]);
    expect(revealedCodes(run.state, run.events)).toEqual([FORCE]);
    expect(discardCodes(run.state)).toContain(FORCE);
    expect(codeOf(run.state, piles(run.state).deck[0]!)).toBe(ORDER);
  });

  it("WHEN REVEALED with no minion in play: no threat, and it gains surge (the next card is revealed too)", () => {
    const start = game();
    const force = Object.keys(start.instances).find((i) => codeOf(start, i as InstanceId) === FORCE) as InstanceId;
    const run = villainPhase(start, ADVANCE, FORCE, ORDER, ADVANCE);
    expect(threatFrom(run.events, force)).toEqual([]);
    expect(revealedCodes(run.state, run.events)).toEqual([FORCE, ORDER]);
  });

  it("WHEN REVEALED counts the minions at that moment: one minion, 1 threat", () => {
    const start = engaged(game(), VENOM).state;
    const force = Object.keys(start.instances).find((i) => codeOf(start, i as InstanceId) === FORCE) as InstanceId;
    const run = villainPhase(start, ADVANCE, FORCE, ORDER);
    expect(threatFrom(run.events, force)).toEqual([1]);
  });

  it("BOOST (no 'your leader' to attack cooperatively): 0 icons, Iron Man attacks once, and no second attack follows", () => {
    const run = villainPhase(game(), FORCE, ORDER);
    expect(attacksBy(run.state, run.events, "56059")).toMatchObject([{ baseAtk: 1, boostIcons: 0, damageDealt: 1 }]);
    expect(types(run.events, "attackResolved")).toHaveLength(1);
    expect(inst(run.state, hero(run.state)).damage).toBe(1);
    expect(discardCodes(run.state)).toContain(FORCE);
  });
});

describe("Dangerous Recruits (56091)", () => {
  it("is data: a side scheme with 3 threat (none per player), 2 boost icons and Hinder 1 per hero", () => {
    const card = dataOf(RECRUITS);
    expect([card.type, card.startingThreat, card.boostIcons, card.keywords]).toEqual([
      "side_scheme",
      { base: 3, perPlayer: 0 },
      2,
      [{ name: "hinder", value: 0, perPlayer: 1 }],
    ]);
  });

  it("REVEALED it enters play with 3 threat plus 1 for Hinder (one hero)", () => {
    const run = villainPhase(game(), ADVANCE, RECRUITS);
    expect(inst(run.state, inPlayCard(run.state, RECRUITS)!).threat).toBe(4);
  });

  it("a minion defeated: Iron Man holds it facedown, undamaged and unengaged, and it is in no pile", () => {
    const bullseye = engaged(withRecruits(game()), BULLSEYE);
    const { state, events } = defeat(bullseye.state, bullseye.id);
    expect(types(events, "characterDefeated").map((e) => e.instanceId)).toEqual([bullseye.id]);
    expect(types(events, "boostCardDealt")).toEqual([
      { type: "boostCardDealt", enemyInstanceId: leaderOf(state), instanceId: bullseye.id, outsideActivation: true },
    ]);
    expect(boostsOn(state)).toEqual([bullseye.id]);
    expect(inst(state, bullseye.id)).toMatchObject({ faceup: false, damage: 0, engagedWith: null });
    expect(discardCodes(state)).not.toContain(BULLSEYE);
    expect(piles(state).deck).not.toContain(bullseye.id);
    expect(state.players.flatMap((p) => [...p.playArea, ...p.discard, ...p.hand, ...p.deck])).not.toContain(
      bullseye.id,
    );
    expect(flippedBoosts(events)).toEqual([]);
  });

  it("at Iron Man's next activation the held minion is turned up first (its 2 icons add to ATK 1), then discarded faceup", () => {
    const bullseye = engaged(withRecruits(game()), BULLSEYE);
    const given = defeat(bullseye.state, bullseye.id).state;
    // The villain phase: Iron Man's own boost card (no icon), then the card dealt to player 1.
    const { state, events } = villainPhase(given, ADVANCE, ORDER);
    const flips = flippedBoosts(events);
    expect(flips.map((f) => [codeOf(state, f.instanceId), f.boostIcons])).toEqual([
      [BULLSEYE, 2],
      [ADVANCE, 0],
    ]);
    expect(attacksBy(state, events, "56059")).toMatchObject([{ baseAtk: 1, boostIcons: 2, damageDealt: 3 }]);
    expect(inst(state, hero(state)).damage).toBe(3);
    expect(boostsOn(state)).toEqual([]);
    expect(inst(state, bullseye.id).faceup).toBe(true);
    // The encounter discard pile is newest-first: the activation's own boost card went in last.
    expect(
      piles(state)
        .discard.slice(0, 3)
        .map((id) => codeOf(state, id)),
    ).toEqual([ORDER, ADVANCE, BULLSEYE]);
  });

  it("two minions defeated before one activation: both held in the order given, both turned up, icons added exactly", () => {
    const first = engaged(withRecruits(game()), VENOM);
    const second = engaged(first.state, BULLSEYE);
    const one = defeat(second.state, first.id).state;
    const two = defeat(one, second.id).state;
    expect(boostsOn(two)).toEqual([first.id, second.id]);
    expect([first.id, second.id].map((id) => inst(two, id).faceup)).toEqual([false, false]);
    expect(discardCodes(two)).not.toContain(VENOM);
    expect(discardCodes(two)).not.toContain(BULLSEYE);
    const { state, events } = villainPhase(two, ADVANCE, ORDER);
    expect(flippedBoosts(events).map((f) => [codeOf(state, f.instanceId), f.boostIcons])).toEqual([
      [VENOM, 2],
      [BULLSEYE, 2],
      [ADVANCE, 0],
    ]);
    expect(attacksBy(state, events, "56059")).toMatchObject([{ baseAtk: 1, boostIcons: 4, damageDealt: 5 }]);
    expect(boostsOn(state)).toEqual([]);
    expect(
      piles(state)
        .discard.slice(0, 4)
        .map((id) => codeOf(state, id)),
    ).toEqual([ORDER, ADVANCE, BULLSEYE, VENOM]);
  });

  it("a minion with its own When Defeated: that ability resolves, and the minion is still given to Iron Man", () => {
    // Hydra Soldier (Guard): "When Defeated: Deal the engaged player an encounter card" (the top card, Executive Order, is dealt and revealed in the villain phase).
    const hydra = engageMinion(stackEncounterDeck(withRecruits(game()), ORDER), HYDRA_SOLDIER, "hydra");
    const { state, events } = defeat(hydra, "hydra" as InstanceId);
    const dealt = types(events, "cardMoved").filter((e) => e.to.kind === "dealtEncounter");
    expect(dealt.map((e) => [e.cardId, (e.to as { playerId: string }).playerId])).toEqual([[ORDER, P1]]);
    expect(boostsOn(state)).toEqual(["hydra"]);
    expect(inst(state, "hydra" as InstanceId)).toMatchObject({ faceup: false, damage: 0, engagedWith: null });
    expect(discardCodes(state)).not.toContain(HYDRA_SOLDIER);
    // The villain phase reveals the card it dealt, then the one dealt then; the held minion is turned up at the activation: its 1 icon.
    const next = villainPhase(state, ADVANCE, DECOY);
    expect(revealedCodes(next.state, next.events)).toEqual([ORDER, DECOY]);
    expect(flippedBoosts(next.events).map((f) => [codeOf(next.state, f.instanceId), f.boostIcons])).toEqual([
      [HYDRA_SOLDIER, 1],
      [ADVANCE, 0],
    ]);
    expect(attacksBy(next.state, next.events, "56059")).toMatchObject([{ baseAtk: 1, boostIcons: 1, damageDealt: 2 }]);
  });

  it("without Dangerous Recruits in play the defeated minion goes to the discard pile and Iron Man holds nothing", () => {
    const bullseye = engaged(game(), BULLSEYE);
    const { state, events } = defeat(bullseye.state, bullseye.id);
    expect(boostsOn(state)).toEqual([]);
    expect(types(events, "boostCardDealt")).toEqual([]);
    expect(piles(state).discard).toContain(bullseye.id);
  });

  it("once Dangerous Recruits is defeated, the next minion defeated goes to the discard pile", () => {
    const withIt = encounterCardInVillainArea(game(), RECRUITS, 1);
    const bullseye = engaged(withIt.state, BULLSEYE);
    const thwarted = driveEventsPicking(WAVE10_DEPS, bullseye.state, firstLegal, {
      type: "basicThwart",
      playerId: P1,
      thwarterInstanceId: hero(bullseye.state),
      schemeInstanceId: withIt.id,
    });
    expect(types(thwarted.events, "schemeDefeated").map((e) => e.instanceId)).toEqual([withIt.id]);
    const { state } = defeat(thwarted.state, bullseye.id);
    expect(boostsOn(state)).toEqual([]);
    expect(piles(state).discard).toContain(bullseye.id);
  });

  it("a stunned Iron Man does not activate: the held minion stays facedown, and a minion's own activation does not turn it up", () => {
    const venom = engaged(withRecruits(game()), VENOM);
    const bullseye = engaged(venom.state, BULLSEYE);
    const given = defeat(bullseye.state, bullseye.id).state;
    const stunnedLeader = withStatus(given, leaderOf(given), "stunned");
    // Venom (a minion) activates and attacks; Iron Man's stunned attack does not happen, so no boost card is dealt for it.
    const first = villainPhase(stunnedLeader, ORDER);
    expect(flippedBoosts(first.events)).toEqual([]);
    expect(attacksBy(first.state, first.events, VENOM)).toMatchObject([{ baseAtk: 3, boostIcons: 0 }]);
    expect(attacksBy(first.state, first.events, "56059")).toEqual([]);
    expect(status(first.state, leaderOf(first.state), "stunned")).toBe(0);
    expect(boostsOn(first.state)).toEqual([bullseye.id]);
    expect(inst(first.state, bullseye.id).faceup).toBe(false);
    // The next villain phase is his next activation.
    const second = villainPhase(first.state, ADVANCE, ORDER);
    expect(flippedBoosts(second.events).map((f) => [codeOf(second.state, f.instanceId), f.boostIcons])).toEqual([
      [BULLSEYE, 2],
      [ADVANCE, 0],
    ]);
    expect(boostsOn(second.state)).toEqual([]);
  });

  it("a confused Iron Man in alter-ego form does not scheme: the held minion stays facedown until he does", () => {
    const bullseye = engaged(withRecruits(game()), BULLSEYE);
    const given = defeat(bullseye.state, bullseye.id).state;
    const alterEgo = withForm(withStatus(given, leaderOf(given), "confused"), "alterEgo");
    const first = villainPhase(alterEgo, ORDER);
    expect(flippedBoosts(first.events)).toEqual([]);
    expect(types(first.events, "schemeResolved").filter((e) => e.enemyInstanceId === leaderOf(first.state))).toEqual(
      [],
    );
    expect(status(first.state, leaderOf(first.state), "confused")).toBe(0);
    expect(boostsOn(first.state)).toEqual([bullseye.id]);
    const second = villainPhase(first.state, ADVANCE, ORDER);
    expect(flippedBoosts(second.events).map((f) => [codeOf(second.state, f.instanceId), f.boostIcons])).toEqual([
      [BULLSEYE, 2],
      [ADVANCE, 0],
    ]);
    expect(
      types(second.events, "schemeResolved").filter((e) => e.enemyInstanceId === leaderOf(second.state)),
    ).toMatchObject([{ baseSch: 1, boostIcons: 2 }]);
  });
});
