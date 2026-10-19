import { CW_CARDS } from "@mc/content";
import {
  activeEncounterDeckId,
  applyCommand,
  type GameEvent,
  type GameState,
  type InstanceId,
  type PlayerId,
} from "@mc/engine";
import { describe, expect, it, vi } from "vitest";
import { competitiveOnlyTexts, validateDefinition } from "../../../dsl/validate.js";
import {
  P1,
  P2,
  endTurn,
  firstLegal,
  identityOf,
  inst,
  patchInstance,
  stackEncounterDeck,
} from "../../../testing/harness.js";
import { driveEventsPicking, encounterCardInVillainArea } from "../../../testing/staging.js";
import {
  attacksBy,
  codeOf,
  flippedBoosts,
  inDiscard,
  inPlayCard,
  picking,
  piles,
  revealedCodes,
  types,
} from "../../../wave9/testing.js";
import { SPIDER_WOMAN_SCENARIO, WAVE10_DEPS, civilWarHeroGame, stagedInPlay } from "../../testing.js";
import { FREEDOM_FIGHTERS_BOOST, FREEDOM_FIGHTERS_WHEN_REVEALED, MODULAR_NEW_AVENGERS } from "./new-avengers.js";
import { MODULAR_SECRET_AVENGERS, MODULAR_SECRET_AVENGERS_SKIPPED } from "./secret-avengers.js";

vi.setConfig({ testTimeout: 120_000 });

/**
 * The Secret Avengers modular set (56155 Black Panther, 56156 Spectrum, 56157 Freedom Fighters, 56158 Switching Sides,
 * 56159 Secret Avengers), docs/phase7-wave10.md sections 3.4, 3.5, 3.9 and 3.10. Every test is a real game in the
 * `resistance-spider-woman` scenario with Secret Avengers picked as a modular set (Captain America's own scenario is
 * not relied on: its leader is unscripted). Cooperatively the enemy leader is Spider-Woman (MC56 p. 6).
 *
 * The villain phase draws the villain's boost card first, then deals each player a card (RRG 1.8 "Villain Phase"), so a
 * stack reads "boost, dealt". Advance 01186 prints no boost icon and no Boost ability. Self-propelled Glide 56179
 * (Spider-Woman's own side scheme) is the harmless card to deal. A boost exhausts a card, and everything readies
 * again at the end of the villain phase, so a boost's exhaustion is read from the `cardExhausted` events.
 * Freedom Fighters (56157) is the same card as New Avengers' 56153 and shares its definitions (the full behavior
 * suite is in new-avengers.test.ts); here one test per ability proves the second code, with Black Panther as the minion.
 */
const PANTHER = "56155";
const SPECTRUM = "56156";
const FIGHTERS = "56157";
const SWITCHING = "56158";
const SECRET = "56159";
const SPIDER_WOMAN = "56168";
const ADVANCE = "01186";
const GLIDE = "56179";
const DEFEND = "56193"; // Hell's Kitchen's side scheme: a second harmless card
const FILLER = "56184"; // The Defenders set: a card that is only ever stacked here
const SET = [PANTHER, SPECTRUM, FIGHTERS, SWITCHING, SECRET];
const REFS = [
  "56155.when-defeated",
  "56155.boost",
  "56156.when-defeated",
  "56156.boost",
  "56157.when-revealed",
  "56157.boost",
  "56158.when-revealed",
  "56159.when-defeated",
];
// Tigra's own cards: two allies and two upgrades.
const MOON_KNIGHT = "56002";
const TWO_GUN_KID = "56010";
const AMULET = "56004";
const CLAWS = "56005";

const dataOf = (code: string) => CW_CARDS.find((c) => (c.id as string) === code)! as unknown as Record<string, unknown>;
const leaderOf = (s: GameState): InstanceId => s.activeVillainId!;
const boostsOn = (s: GameState) => inst(s, leaderOf(s)).boostCards;
const hero = (s: GameState, player: PlayerId = P1) => identityOf(s, player);
const discardCodes = (s: GameState) => piles(s).discard.map((id) => codeOf(s, id));
const exhaustedIds = (events: readonly GameEvent[]) => types(events, "cardExhausted").map((e) => e.instanceId);
const playerOne = (s: GameState) => s.players.find((p) => p.playerId === P1)!;

/**
 * The Spider-Woman scenario with Secret Avengers as a modular set, past setup, hero form. Stage 1A revealed
 * Self-propelled Glide; it is back in the encounter deck because the stacks deal it as the harmless filler card.
 */
function game(twoPlayers = false, firstPlayerIndex?: number): GameState {
  return civilWarHeroGame(SPIDER_WOMAN_SCENARIO, {
    modularSetIds: ["secret_avengers", "defenders", "hells_kitchen"],
    leaderSideScheme: "discarded",
    twoPlayers,
    ...(firstPlayerIndex === undefined ? {} : { firstPlayerIndex }),
  });
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

/** The first player ends the turn and the villain phase runs on the stacked deck (boost card first, then the dealt card). */
const villainPhase = (state: GameState, ...stack: string[]) =>
  driveEventsPicking(WAVE10_DEPS, stackEncounterDeck(state, ...stack), firstLegal, endTurn(P1));

const flipped = (s: GameState, events: Parameters<typeof flippedBoosts>[0]) =>
  flippedBoosts(events).map((f) => [codeOf(s, f.instanceId), f.boostIcons]);

/** Applies `resolveChoice` for `player`; the result is returned whole so a test can assert a refusal. */
const resolve = (state: GameState, player: PlayerId, optionId: string) =>
  applyCommand(
    state,
    { type: "resolveChoice", playerId: player, choiceId: state.pendingChoice!.choiceId, selectedOptionIds: [optionId] },
    WAVE10_DEPS,
  );
const optionOf = (state: GameState, id: InstanceId) =>
  state.pendingChoice!.options.find((o) => o.ref.kind === "card" && o.ref.instanceId === id)!.optionId;
const offeredCards = (state: GameState) =>
  state.pendingChoice!.options.flatMap((o) => (o.ref.kind === "card" ? [o.ref.instanceId] : []));

/**
 * Applies `command`, then answers every choice with the first legal option until one satisfies `stop`. Returns the
 * state at that choice (or at the end if none did) and every event on the way.
 */
function until(
  state: GameState,
  command: Parameters<typeof applyCommand>[1],
  stop: (s: GameState) => boolean,
): { readonly state: GameState; readonly events: readonly GameEvent[] } {
  const first = applyCommand(state, command, WAVE10_DEPS);
  if (!first.ok) throw new Error(first.error.message);
  let current = first.state;
  const events: GameEvent[] = [...first.events];
  for (let guard = 0; guard < 100; guard++) {
    const choice = current.pendingChoice;
    if (!choice || stop(current)) break;
    const next = applyCommand(
      current,
      {
        type: "resolveChoice",
        playerId: choice.playerId,
        choiceId: choice.choiceId,
        selectedOptionIds: firstLegal(current),
      },
      WAVE10_DEPS,
    );
    if (!next.ok) throw new Error(next.error.message);
    current = next.state;
    events.push(...next.events);
  }
  return { state: current, events };
}

describe("registry", () => {
  it("registers the eight refs of the scripted cards, each a valid definition", () => {
    expect(Object.keys(MODULAR_SECRET_AVENGERS).sort()).toEqual([...REFS].sort());
    for (const [id, def] of Object.entries(MODULAR_SECRET_AVENGERS)) expect(validateDefinition(def), id).toEqual([]);
  });

  it("skips nothing: Freedom Fighters' two refs are scripted", () => {
    expect(Object.keys(MODULAR_SECRET_AVENGERS_SKIPPED)).toEqual([]);
  });

  it("the data names exactly these refs, for the five cards", () => {
    const refs = SET.flatMap((code) => ((dataOf(code).abilities ?? []) as { id: string }[]).map((a) => a.id));
    expect(refs.sort()).toEqual([...REFS].sort());
  });

  it("carries the printed timing of each ability", () => {
    for (const ref of ["56155.when-defeated", "56156.when-defeated", "56159.when-defeated"])
      expect(MODULAR_SECRET_AVENGERS[ref]!.trigger, ref).toMatchObject({ kind: "whenDefeated" });
    expect(MODULAR_SECRET_AVENGERS["56157.when-revealed"]!.trigger).toMatchObject({ kind: "whenRevealed" });
    for (const ref of ["56155.boost", "56156.boost", "56157.boost"])
      expect(MODULAR_SECRET_AVENGERS[ref]!.trigger, ref).toMatchObject({ kind: "boost" });
    expect(MODULAR_SECRET_AVENGERS["56158.when-revealed"]!.trigger).toMatchObject({ kind: "whenRevealed" });
  });

  it("the Teamwork minions give themselves the way New Avengers' do (the same definition)", () => {
    expect(MODULAR_SECRET_AVENGERS["56156.when-defeated"]).toBe(MODULAR_SECRET_AVENGERS["56155.when-defeated"]);
    expect(MODULAR_SECRET_AVENGERS["56155.when-defeated"]!.effects).toEqual(
      MODULAR_NEW_AVENGERS["56150.when-defeated"]!.effects,
    );
  });

  it("Switching Sides writes its competitive sentence in full", () => {
    expect(competitiveOnlyTexts(MODULAR_SECRET_AVENGERS["56158.when-revealed"]!)).toEqual([
      "In competitive mode, any player on the enemy team may spend resources equal to that ally's cost to put it into play under their control.",
    ]);
  });

  it("setup: the encounter deck holds one copy of each card", () => {
    const s = game();
    const all = Object.keys(s.instances).map((i) => codeOf(s, i as InstanceId));
    expect(SET.map((code) => all.filter((c) => c === code).length)).toEqual([1, 1, 1, 1, 1]);
  });
});

describe.each([
  [PANTHER, "Black Panther", 4],
  [SPECTRUM, "Spectrum", 3],
] as const)("%s %s: Teamwork minion", (code, _name, hp) => {
  it("is data: a unique Avenger minion with Teamwork (Avenger), ATK 2, SCH 2, no boost icon and a star icon", () => {
    const card = dataOf(code);
    expect([card.type, card.atk, card.sch, card.hp, card.boostIcons, card.starIcon, card.unique]).toEqual([
      "minion",
      2,
      2,
      hp,
      0,
      true,
      true,
    ]);
    expect(card.keywords).toEqual([{ name: "teamwork", sharedTrait: expect.anything() }]);
  });

  it("WHEN DEFEATED: Spider-Woman holds it facedown, undamaged and unengaged, and it is in no pile", () => {
    const minion = engaged(game(), code);
    const { state, events } = defeat(minion.state, minion.id);
    expect(types(events, "characterDefeated").map((e) => e.instanceId)).toEqual([minion.id]);
    expect(types(events, "boostCardDealt")).toEqual([
      { type: "boostCardDealt", enemyInstanceId: leaderOf(state), instanceId: minion.id, outsideActivation: true },
    ]);
    expect(boostsOn(state)).toEqual([minion.id]);
    expect(inst(state, minion.id)).toMatchObject({ faceup: false, damage: 0, engagedWith: null });
    expect(discardCodes(state)).not.toContain(code);
    expect(state.players.flatMap((p) => [...p.playArea, ...p.discard, ...p.hand, ...p.deck])).not.toContain(minion.id);
    expect(flippedBoosts(events)).toEqual([]);
  });

  it("a stunned Spider-Woman does not activate: the card stays facedown until her next activation", () => {
    const minion = engaged(game(), code);
    const given = defeat(minion.state, minion.id).state;
    const stunnedLeader = patchInstance(given, leaderOf(given), {
      statuses: { ...inst(given, leaderOf(given)).statuses, stunned: 1 },
    });
    const first = villainPhase(stunnedLeader, GLIDE);
    expect(flippedBoosts(first.events)).toEqual([]);
    expect(boostsOn(first.state)).toEqual([minion.id]);
    expect(inst(first.state, minion.id).faceup).toBe(false);
    const second = villainPhase(first.state, ADVANCE, DEFEND);
    expect(flipped(second.state, second.events)).toEqual([
      [code, 0],
      [ADVANCE, 0],
    ]);
    expect(boostsOn(second.state)).toEqual([]);
  });
});

describe("Black Panther (56155) Boost: exhaust each upgrade you control", () => {
  /** Tigra with two upgrades attached and an ally in play. */
  function armed() {
    const one = stagedInPlay(game(), AMULET, { attach: true });
    const two = stagedInPlay(one.state, CLAWS, { attach: true });
    const ally = stagedInPlay(two.state, MOON_KNIGHT);
    return { state: ally.state, upgrades: [one.id, two.id], ally: ally.id };
  }

  it("as the villain's boost card: both upgrades are exhausted and nothing else is", () => {
    const { state, upgrades } = armed();
    const run = villainPhase(state, PANTHER, GLIDE);
    expect(exhaustedIds(run.events).sort()).toEqual([...upgrades].sort());
    expect(attacksBy(run.state, run.events, SPIDER_WOMAN)).toMatchObject([
      { baseAtk: 2, boostIcons: 0, damageDealt: 2 },
    ]);
  });

  it("with no upgrade in play: nothing is exhausted", () => {
    const run = villainPhase(game(), PANTHER, GLIDE);
    expect(exhaustedIds(run.events)).toEqual([]);
    expect(attacksBy(run.state, run.events, SPIDER_WOMAN)).toMatchObject([
      { baseAtk: 2, boostIcons: 0, damageDealt: 2 },
    ]);
  });

  it("turned up from the leader's held cards at her next activation: its Boost resolves, then the dealt card's", () => {
    const { state, upgrades } = armed();
    const panther = engaged(state, PANTHER);
    const given = defeat(panther.state, panther.id).state;
    const run = villainPhase(given, ADVANCE, GLIDE);
    expect(flipped(run.state, run.events)).toEqual([
      [PANTHER, 0],
      [ADVANCE, 0],
    ]);
    expect(exhaustedIds(run.events).sort()).toEqual([...upgrades].sort());
    expect(boostsOn(run.state)).toEqual([]);
  });
});

describe("Spectrum (56156) Boost: exhaust a character you control", () => {
  function withAlly() {
    const ally = stagedInPlay(game(), MOON_KNIGHT);
    return { state: ally.state, ally: ally.id };
  }

  it("as the villain's boost card: the chosen ally is exhausted and the hero is not", () => {
    const { state, ally } = withAlly();
    const run = driveEventsPicking(WAVE10_DEPS, stackEncounterDeck(state, SPECTRUM, GLIDE), picking(ally), endTurn(P1));
    expect(exhaustedIds(run.events)).toEqual([ally]);
  });

  it("the hero may be the character chosen", () => {
    const { state } = withAlly();
    const run = driveEventsPicking(
      WAVE10_DEPS,
      stackEncounterDeck(state, SPECTRUM, GLIDE),
      picking(hero(state)),
      endTurn(P1),
    );
    expect(exhaustedIds(run.events)).toEqual([hero(state)]);
  });

  // No "choose": an encounter card targeting one of several eligible cards; the first player selects
  // (RRG 1.8 "First Player", p. 19).
  it("the prompt is the first player's (not the enemy team's) and offers the activated player's hero and ally", () => {
    const { state, ally } = withAlly();
    const asked = until(
      stackEncounterDeck(state, SPECTRUM, GLIDE),
      endTurn(P1),
      (s) => s.pendingChoice?.prompt.kind === "chooseTarget",
    );
    expect(asked.state.pendingChoice).toMatchObject({ playerId: P1, authority: "firstPlayerTargets" });
    expect(offeredCards(asked.state).sort()).toEqual([hero(state), ally].sort());
  });

  it("turned up from the leader's held cards at her next activation: the chosen character is exhausted", () => {
    const { state, ally } = withAlly();
    const spectrum = engaged(state, SPECTRUM);
    const given = defeat(spectrum.state, spectrum.id).state;
    const run = driveEventsPicking(WAVE10_DEPS, stackEncounterDeck(given, ADVANCE, GLIDE), picking(ally), endTurn(P1));
    expect(flipped(run.state, run.events)).toEqual([
      [SPECTRUM, 0],
      [ADVANCE, 0],
    ]);
    expect(exhaustedIds(run.events)).toEqual([ally]);
  });
});

describe("Switching Sides (56158)", () => {
  it("is data: a treachery with 2 boost icons and no Boost ability", () => {
    const card = dataOf(SWITCHING);
    expect([card.type, card.boostIcons]).toEqual(["treachery", 2]);
    expect(((card.abilities ?? []) as { id: string }[]).map((a) => a.id)).toEqual(["56158.when-revealed"]);
  });

  it("WHEN REVEALED with one ally: it is discarded to its owner's pile and the card does not gain surge", () => {
    const { state, id: ally } = stagedInPlay(game(), MOON_KNIGHT);
    const run = villainPhase(state, ADVANCE, SWITCHING, GLIDE);
    expect(revealedCodes(run.state, run.events)).toEqual([SWITCHING]);
    expect(inPlayCard(run.state, MOON_KNIGHT)).toBeUndefined();
    expect(playerOne(run.state).discard).toContain(ally);
    expect(playerOne(run.state).playArea).not.toContain(ally);
  });

  it("WHEN REVEALED with two allies: the chosen one is discarded and the other stays in play", () => {
    const first = stagedInPlay(game(), MOON_KNIGHT);
    const second = stagedInPlay(first.state, TWO_GUN_KID);
    const run = driveEventsPicking(
      WAVE10_DEPS,
      stackEncounterDeck(second.state, ADVANCE, SWITCHING, GLIDE),
      picking(second.id),
      endTurn(P1),
    );
    expect(playerOne(run.state).playArea).toContain(first.id);
    expect(playerOne(run.state).playArea).not.toContain(second.id);
    expect(playerOne(run.state).discard).toContain(second.id);
    expect(revealedCodes(run.state, run.events)).toEqual([SWITCHING]);
  });

  it("WHEN REVEALED with no ally: nothing leaves play and the card gains surge (the next card is revealed too)", () => {
    const run = villainPhase(game(), ADVANCE, SWITCHING, GLIDE);
    expect(revealedCodes(run.state, run.events)).toEqual([SWITCHING, GLIDE]);
  });
});

describe("Freedom Fighters (56157), the second code of New Avengers' 56153", () => {
  it("is data: a treachery with a boost star and no boost icon; both abilities are the 56153 definitions", () => {
    const card = dataOf(FIGHTERS);
    expect([card.type, card.boostIcons, card.starIcon]).toEqual(["treachery", 0, true]);
    expect(MODULAR_SECRET_AVENGERS["56157.when-revealed"]).toBe(FREEDOM_FIGHTERS_WHEN_REVEALED);
    expect(MODULAR_SECRET_AVENGERS["56157.boost"]).toBe(FREEDOM_FIGHTERS_BOOST);
    expect(MODULAR_SECRET_AVENGERS["56157.boost"]).toBe(MODULAR_NEW_AVENGERS["56153.boost"]);
    expect(MODULAR_SECRET_AVENGERS["56157.when-revealed"]).toBe(MODULAR_NEW_AVENGERS["56153.when-revealed"]);
  });

  /** Tigra with an upgrade attached, and Black Panther engaged with her. */
  function withPanther() {
    const upgrade = stagedInPlay(game(), AMULET, { attach: true });
    const panther = engaged(upgrade.state, PANTHER);
    return { state: panther.state, upgrade: upgrade.id, panther: panther.id };
  }

  it("WHEN REVEALED: Black Panther's Boost resolves in play (the upgrade is exhausted), and the card does not gain surge", () => {
    const { state, upgrade, panther } = withPanther();
    const run = villainPhase(state, ADVANCE, FIGHTERS, GLIDE);
    expect(revealedCodes(run.state, run.events)).toEqual([FIGHTERS]);
    expect(exhaustedIds(run.events)).toEqual([upgrade]);
    expect(types(run.events, "surgeTriggered")).toEqual([]);
    expect(inst(run.state, panther)).toMatchObject({ engagedWith: P1, faceup: true });
  });

  it("WHEN REVEALED with no minion in play: the card gains surge and the next card is revealed too", () => {
    const run = villainPhase(game(), ADVANCE, FIGHTERS, GLIDE);
    expect(types(run.events, "surgeTriggered").map((e) => codeOf(run.state, e.instanceId))).toEqual([FIGHTERS]);
    expect(revealedCodes(run.state, run.events)).toEqual([FIGHTERS, GLIDE]);
  });

  it("BOOST, as the leader's boost card: Black Panther engaged with you has his Boost resolved (the upgrade is exhausted); question 10 changes nothing here", () => {
    const { state, upgrade, panther } = withPanther();
    const run = villainPhase(state, FIGHTERS, GLIDE);
    expect(flipped(run.state, run.events)).toEqual([[FIGHTERS, 0]]);
    expect(exhaustedIds(run.events)).toEqual([upgrade]);
    expect(inst(run.state, panther)).toMatchObject({ engagedWith: P1, faceup: true });
    expect(attacksBy(run.state, run.events, SPIDER_WOMAN)).toMatchObject([
      { baseAtk: 2, boostIcons: 0, damageDealt: 2 },
    ]);
  });
});

describe("Secret Avengers (56159)", () => {
  it("is data: a side scheme with 3 threat (none per player), a crisis icon, 2 boost icons and Hinder 1 per hero", () => {
    const card = dataOf(SECRET);
    expect([card.type, card.startingThreat, card.icons, card.boostIcons, card.keywords]).toEqual([
      "side_scheme",
      { base: 3, perPlayer: 0 },
      ["crisis"],
      2,
      [{ name: "hinder", value: 0, perPlayer: 1 }],
    ]);
  });

  const TOP_FIVE = [ADVANCE, GLIDE, DEFEND, FILLER, PANTHER];
  const SIXTH = SPECTRUM;

  /** The scheme in the villain area with 1 threat and the deck stacked with `TOP_FIVE` then `SIXTH`. */
  function staged(state: GameState) {
    const scheme = encounterCardInVillainArea(state, SECRET, 1);
    return { id: scheme.id, state: stackEncounterDeck(scheme.state, ...TOP_FIVE, SIXTH) };
  }

  /** Player 1's hero thwarts the scheme away; stops at the search's prompt (a `chooseCards`). */
  const atSearch = (state: GameState, scheme: InstanceId) =>
    until(
      patchInstance(state, hero(state), { exhausted: false }),
      { type: "basicThwart", playerId: P1, thwarterInstanceId: hero(state), schemeInstanceId: scheme },
      (s) => s.pendingChoice?.prompt.kind === "chooseCards",
    );

  it("WHEN DEFEATED (one player): the first player is asked, marked as the enemy team, among exactly the top 5 cards", () => {
    const { id, state } = staged(game());
    const top = piles(state).deck.slice(0, 5);
    const run = atSearch(state, id);
    expect(run.state.pendingChoice).toMatchObject({ playerId: P1, authority: "enemyTeam" });
    expect(offeredCards(run.state).sort()).toEqual([...top].sort());
    expect(
      offeredCards(run.state)
        .map((i) => codeOf(run.state, i))
        .sort(),
    ).toEqual([...TOP_FIVE].sort());
  });

  it("WHEN DEFEATED: the chosen card is held facedown by Spider-Woman, and the whole encounter deck (the other four and the rest) is shuffled once (RRG 1.8 'Search' p. 39)", () => {
    const { id, state } = staged(game());
    const top = piles(state).deck.slice(0, 5);
    const rest = piles(state).deck.slice(5);
    const run = atSearch(state, id);
    const done = resolve(run.state, P1, optionOf(run.state, top[3]!));
    if (!done.ok) throw new Error(done.error.message);
    const after = driveEventsPicking(WAVE10_DEPS, done.state, firstLegal);
    expect(boostsOn(after.state)).toEqual([top[3]]);
    expect(inst(after.state, top[3]!).faceup).toBe(false);
    const events = [...done.events, ...after.events];
    // The deck holds exactly the cards it held, less the one found, in the order the one shuffle left them.
    const left = [top[0]!, top[1]!, top[2]!, top[4]!, ...rest];
    expect([...piles(after.state).deck].sort()).toEqual([...left].sort());
    const shuffles = types(events, "deckShuffled");
    expect(shuffles.map((e) => e.zone)).toEqual([
      { kind: "encounterDeck", deckId: activeEncounterDeckId(after.state) },
    ]);
    expect(shuffles[0]!.order).toEqual(piles(after.state).deck);
    expect(piles(after.state).deck).not.toEqual(left);
    // The shuffle follows the card being given: it is the ability's last step.
    expect(events.findIndex((e) => e.type === "boostCardDealt")).toBeLessThan(
      events.findIndex((e) => e.type === "deckShuffled"),
    );
    expect(types(events, "boostCardDealt")).toEqual([
      { type: "boostCardDealt", enemyInstanceId: leaderOf(after.state), instanceId: top[3], outsideActivation: true },
    ]);
    expect(flippedBoosts(events)).toEqual([]);
    expect(inPlayCard(after.state, SECRET)).toBeUndefined();
  });

  it("WHEN DEFEATED: the held card is turned up at the leader's next activation", () => {
    const { id, state } = staged(game());
    const top = piles(state).deck.slice(0, 5);
    const run = atSearch(state, id);
    const done = resolve(run.state, P1, optionOf(run.state, top[4]!)); // Black Panther
    if (!done.ok) throw new Error(done.error.message);
    const after = driveEventsPicking(WAVE10_DEPS, done.state, firstLegal);
    const phase = villainPhase(after.state, ADVANCE, GLIDE);
    expect(flipped(phase.state, phase.events)).toEqual([
      [PANTHER, 0],
      [ADVANCE, 0],
    ]);
    expect(boostsOn(phase.state)).toEqual([]);
    expect(inDiscard(phase.state, PANTHER)).toHaveLength(1);
  });

  it("WHEN DEFEATED, player 2 first and player 1 defeating it: player 2 is prompted as the enemy team and player 1 is refused", () => {
    const base = game(true, 1);
    expect(base.firstPlayerId).toBe(P2);
    const passed = applyCommand(base, endTurn(P2), WAVE10_DEPS);
    if (!passed.ok) throw new Error(passed.error.message);
    expect(passed.state.step).toMatchObject({ phase: "player", activePlayerId: P1 });
    const { id, state } = staged(passed.state);
    const top = piles(state).deck.slice(0, 5);
    const run = atSearch(state, id);
    expect(run.state.pendingChoice).toMatchObject({ playerId: P2, authority: "enemyTeam" });
    expect(run.state.pendingChoice!.onBehalfOf).toMatchObject({ kind: "enemyTeam" });
    // The player who defeated the scheme may not answer for the first player.
    expect(resolve(run.state, P1, optionOf(run.state, top[0]!)).ok).toBe(false);
    const done = resolve(run.state, P2, optionOf(run.state, top[2]!));
    if (!done.ok) throw new Error(done.error.message);
    const after = driveEventsPicking(WAVE10_DEPS, done.state, firstLegal);
    expect(boostsOn(after.state)).toEqual([top[2]]);
  });

  it("WHEN DEFEATED with fewer than 5 cards in the encounter deck: only those are offered", () => {
    const { id, state } = staged(game());
    const deckId = activeEncounterDeckId(state);
    const pile = state.encounterDecks[deckId]!;
    const short: GameState = {
      ...state,
      encounterDecks: { ...state.encounterDecks, [deckId]: { ...pile, deck: pile.deck.slice(0, 2) } },
    };
    const run = atSearch(short, id);
    expect(run.state.pendingChoice!.options).toHaveLength(2);
  });

  it("BOOST: 2 icons on the activating enemy's attack (Spider-Woman ATK 2 + 2)", () => {
    const run = villainPhase(game(), SECRET, GLIDE);
    expect(attacksBy(run.state, run.events, SPIDER_WOMAN)).toMatchObject([
      { baseAtk: 2, boostIcons: 2, damageDealt: 4 },
    ]);
  });
});
