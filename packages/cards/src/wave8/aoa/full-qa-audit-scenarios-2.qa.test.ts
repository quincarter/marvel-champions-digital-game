import {
  cardsInPlay,
  createGame,
  villainStageOf,
  type Command,
  type GameEvent,
  type GameState,
  type InstanceId,
  type PlayerId,
} from "@mc/engine";
import { describe, expect, it, vi } from "vitest";
import {
  P1,
  P2,
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
import { attachToHost } from "../../wave6/mut_gen/project-wideawake-testing.js";
import { defeatWithAttack, driveEventsPicking, withForm } from "../../testing/staging.js";
import { WAVE8_DEPS } from "../index.js";
import { wave8Scenario, type Wave8ScenarioOptions } from "../setup.js";

vi.setConfig({ testTimeout: 300_000 });

/**
 * Full QA audit, Dark Beast and En Sabah Nur with their modular sets (docs/phase7-wave8-full-qa.md). Every game here is
 * the real `wave8Scenario` builder with the real registry, and every test uses two players unless it says otherwise.
 * Sources: the printed card text in packages/content/src/data/aoa/cards.ts, RRG 1.8, docs/phase7-wave8.md section 4.1.
 */
const SPIDER_MAN = { starterDeckId: "core-spider-man-justice" } as const;
const CAPTAIN_MARVEL = { starterDeckId: "core-captain-marvel-leadership" } as const;
const BLANK = "01186";
const BLANK_2 = "01187";
const TIME_TRAVEL = "45126";
const GENIUS = "45125";
const GOGGLES = "45122";
const SAVAGE = "45127";
const GENOSHA = "45133";
const BLUE_AREA = "45139";
const PTEROSAUR = "45128";

const codeOf = (s: GameState, id: InstanceId): string => String(s.instances[id]!.cardId);
const inPlayByCode = (s: GameState, code: string): InstanceId[] =>
  cardsInPlay(s).filter((id) => codeOf(s, id) === code);
const types = <T extends GameEvent["type"]>(events: readonly GameEvent[], type: T) =>
  events.filter((e): e is Extract<GameEvent, { type: T }> => e.type === type);
const villainId = (s: GameState): InstanceId => s.activeVillainId!;
const damageOf = (s: GameState, id: InstanceId): number => inst(s, id).damage;
const idDamage = (s: GameState, p: PlayerId): number => damageOf(s, identityOf(s, p));
const deckSize = (s: GameState, p: PlayerId): number => playerOf(s, p).deck.length;
const statusOf = (s: GameState, id: InstanceId, name: "stunned" | "confused" | "tough"): number =>
  inst(s, id).statuses[name] ?? 0;

function start(
  scenario: string,
  opts: { seed?: number; expert?: boolean | undefined; players?: number; options?: Partial<Wave8ScenarioOptions> } = {},
): GameState {
  const seats = [SPIDER_MAN, CAPTAIN_MARVEL].slice(0, opts.players ?? 2);
  const config = wave8Scenario(scenario, {
    players: seats,
    seed: opts.seed ?? 1,
    difficulty: opts.expert ? "expert" : "standard",
    ...opts.options,
  });
  const created = createGame(config, WAVE8_DEPS);
  if (!created.ok) throw new Error(created.error.message);
  return settle(created.state, firstLegal, (s) => s.step.phase === "player", WAVE8_DEPS);
}

/** A Dark Beast game whose random Setting environment is `env`. */
function beastGame(env: string, opts: { expert?: boolean } = {}): GameState {
  for (let seed = 1; seed < 80; seed++) {
    const s = start("dark-beast", { seed, ...opts });
    if (inPlayByCode(s, env).length === 1) return s;
  }
  throw new Error(`no seed gives ${env}`);
}

/** The villain phase after both players end their turn (`heroes` change to hero form first). */
function round(
  state: GameState,
  opts: { stack?: readonly string[]; heroes?: readonly PlayerId[]; pick?: (s: GameState) => readonly string[] } = {},
) {
  const calm = state.players.reduce(
    (acc, p) => patchInstance(acc, p.identity.instanceId, { damage: 0 }),
    patchInstance(state, state.mainScheme.instanceId, { threat: 0 }),
  );
  const stacked = opts.stack ? stackEncounterDeck(calm, ...opts.stack) : calm;
  const heroes = opts.heroes ?? [];
  const ids = state.players.map((p) => p.playerId);
  const active = state.step.phase === "player" && state.step.kind === "turn" ? state.step.activePlayerId : ids[0]!;
  const order = [...ids.slice(ids.indexOf(active)), ...ids.slice(0, ids.indexOf(active))];
  const commands: Command[] = order.flatMap((id) => [...(heroes.includes(id) ? [toHero(id)] : []), endTurn(id)]);
  return driveEventsPicking(WAVE8_DEPS, stacked, opts.pick ?? firstLegal, ...commands);
}

describe("Dark Beast (45118 to 45120), two players", () => {
  it("45118 Forced Interrupt: only the attacked player resolves the Special (Blue Area: P2 hero takes ATK 2 + 1, P1 alter-ego nothing)", () => {
    const s = beastGame(BLUE_AREA);
    const run = round(s, { stack: [BLANK, BLANK_2, TIME_TRAVEL, TIME_TRAVEL], heroes: [P2] });
    expect(idDamage(run.state, P2)).toBe(3);
    expect(idDamage(run.state, P1)).toBe(0);
  });

  it("45118 Forced Interrupt: both players in hero form each resolve the Special on their own attack", () => {
    const s = beastGame(BLUE_AREA);
    const run = round(s, { stack: [BLANK, BLANK_2, TIME_TRAVEL, TIME_TRAVEL], heroes: [P1, P2] });
    expect(idDamage(run.state, P1)).toBe(3);
    expect(idDamage(run.state, P2)).toBe(3);
  });

  it("45118 Forced Interrupt (The Savage Land): only the attacked player's deck is milled", () => {
    const s = beastGame(SAVAGE);
    const p1Deck = deckSize(s, P1);
    const p2Deck = deckSize(s, P2);
    const run = round(s, { stack: [BLANK, BLANK_2, TIME_TRAVEL, TIME_TRAVEL], heroes: [P2] });
    expect(deckSize(run.state, P1)).toBe(p1Deck);
    expect(deckSize(run.state, P2)).toBe(p2Deck - 3);
  });

  it("45119 When Revealed (stage change): each of the two players is dealt an encounter card", () => {
    const s = beastGame(SAVAGE);
    expect(villainStageOf(s, villainId(s)).stageNumber).toBe(1);
    expect(playerOf(s, P1).dealtEncounter).toHaveLength(0);
    const done = defeatWithAttack(WAVE8_DEPS, withForm(s, { heroForm: 0 }), villainId(s), P1);
    expect(villainStageOf(done, villainId(done)).stageNumber).toBe(2);
    expect(playerOf(done, P1).dealtEncounter).toHaveLength(1);
    expect(playerOf(done, P2).dealtEncounter).toHaveLength(1);
  });

  it("45120 When Revealed (expert, stage II to III): each of the two players is dealt another card and one Setting stays", () => {
    const s = start("dark-beast", { expert: true });
    expect(villainStageOf(s, villainId(s)).stageNumber).toBe(2);
    const cleared = {
      ...s,
      players: s.players.map((p) => ({ ...p, dealtEncounter: [] })),
    } satisfies GameState;
    const done = defeatWithAttack(WAVE8_DEPS, withForm(cleared, { heroForm: 0 }), villainId(s), P1);
    expect(villainStageOf(done, villainId(done)).stageNumber).toBe(3);
    expect(playerOf(done, P1).dealtEncounter).toHaveLength(1);
    expect(playerOf(done, P2).dealtEncounter).toHaveLength(1);
    const settings = cardsInPlay(done).filter((id) => [SAVAGE, GENOSHA, BLUE_AREA].includes(codeOf(done, id)));
    expect(settings).toHaveLength(1);
  });

  it("45125 Evil Genius dealt to the alter-ego P2 while P1 is a hero: Dark Beast schemes again and is given a tough card", () => {
    const s = beastGame(SAVAGE);
    const run = round(s, { stack: [BLANK, BLANK_2, TIME_TRAVEL, GENIUS], heroes: [P1] });
    const schemes = types(run.events, "schemeResolved").filter((e) => e.enemyInstanceId === villainId(s));
    expect(schemes).toHaveLength(2);
    expect(statusOf(run.state, villainId(run.state), "tough")).toBe(1);
  });

  it("45125 Evil Genius dealt to the hero P2 while P1 is an alter-ego: Dark Beast attacks P2 a second time, no tough card", () => {
    const s = beastGame(SAVAGE);
    const run = round(s, { stack: [BLANK, BLANK_2, TIME_TRAVEL, GENIUS], heroes: [P2] });
    const attacks = types(run.events, "attackResolved").filter((e) => e.enemyInstanceId === villainId(s));
    expect(attacks).toHaveLength(2);
    expect(idDamage(run.state, P1)).toBe(0);
    expect(statusOf(run.state, villainId(run.state), "tough")).toBe(0);
  });

  it("45126 Time-Travel Shenanigans defeated by P2: P2 reveals the Setting-set card (Pterosaur engages P2 and mills P2 only)", () => {
    const s0 = beastGame(SAVAGE);
    const withScheme = stackEncounterDeck(s0, TIME_TRAVEL);
    const revealed = round(withScheme, { stack: [BLANK, BLANK_2, TIME_TRAVEL, TIME_TRAVEL] }).state;
    const scheme = inPlayByCode(revealed, TIME_TRAVEL)[0]!;
    const near = patchInstance(revealed, scheme, { threat: 1 });
    const stacked = stackEncounterDeck(near, BLANK, PTEROSAUR);
    const hero = patchInstance(withForm(stacked, { heroForm: 0 }, P2), identityOf(stacked, P2), { exhausted: false });
    const p1Deck = deckSize(hero, P1);
    const p2Deck = deckSize(hero, P2);
    const done = driveEventsPicking(WAVE8_DEPS, hero, firstLegal, {
      type: "basicThwart",
      playerId: P2,
      thwarterInstanceId: identityOf(hero, P2),
      schemeInstanceId: scheme,
    });
    const ptero = inPlayByCode(done.state, PTEROSAUR)[0]!;
    expect(inst(done.state, ptero).engagedWith).toBe(P2);
    expect(deckSize(done.state, P1)).toBe(p1Deck);
    expect(deckSize(done.state, P2)).toBe(p2Deck - 3);
  });

  it("45122 High-Tech Goggles used by P2's hero: P2's hero exhausts, P2 takes the Special's damage, P1 is untouched", () => {
    const s0 = beastGame(BLUE_AREA, { expert: true });
    const goggles = inPlayByCode(s0, GOGGLES)[0]!;
    const hero = patchInstance(withForm(s0, { heroForm: 0 }, P2), identityOf(s0, P2), { exhausted: false });
    const done = driveEventsPicking(WAVE8_DEPS, hero, firstLegal, use(P2, goggles, "45122.high-tech-goggles-action"));
    expect(inst(done.state, identityOf(done.state, P2)).exhausted).toBe(true);
    expect(idDamage(done.state, P2)).toBe(1);
    expect(idDamage(done.state, P1)).toBe(0);
    expect(inPlayByCode(done.state, GOGGLES)).toHaveLength(0);
  });
});

describe("Dark Beast set, more two-player reads", () => {
  it("45122 Goggles under The Savage Land: the Special is paid by the hero using it (P2's deck loses 3, P1's none)", () => {
    const s0 = beastGame(SAVAGE, { expert: true });
    const goggles = inPlayByCode(s0, GOGGLES)[0]!;
    const hero = patchInstance(withForm(s0, { heroForm: 0 }, P2), identityOf(s0, P2), { exhausted: false });
    const p1Deck = deckSize(hero, P1);
    const p2Deck = deckSize(hero, P2);
    const done = driveEventsPicking(
      WAVE8_DEPS,
      hero,
      firstLegal,
      endTurn(P1),
      use(P2, goggles, "45122.high-tech-goggles-action"),
    );
    expect(deckSize(done.state, P1)).toBe(p1Deck);
    expect(deckSize(done.state, P2)).toBe(p2Deck - 3);
  });

  it("45124 Cruel Experiment dealt to P2: the minion it reveals engages P2 and the card attaches to it", () => {
    const s0 = beastGame(SAVAGE);
    const run = round(s0, { stack: [BLANK, BLANK_2, TIME_TRAVEL, "45124", "45129"] });
    const raptors = inPlayByCode(run.state, "45129");
    expect(raptors).toHaveLength(1);
    expect(inst(run.state, raptors[0]!).engagedWith).toBe(P2);
    const experiment = inPlayByCode(run.state, "45124")[0]!;
    expect(inst(run.state, experiment).attachedTo).toBe(raptors[0]);
  });
});

describe("attachments carry over a stage change of the same title (RRG 1.8 Villain Defeat, p. 47)", () => {
  it("Dark Beast I to II: High-Tech Goggles and a tough status card stay on him", () => {
    const s0 = beastGame(SAVAGE);
    const goggles = attachToHost(s0, GOGGLES, villainId(s0));
    const tough = patchInstance(goggles.state, villainId(s0), {
      statuses: { ...inst(s0, villainId(s0)).statuses, tough: 1 },
    });
    const done = defeatWithAttack(WAVE8_DEPS, withForm(tough, { heroForm: 0 }), villainId(s0), P1);
    expect(villainStageOf(done, villainId(done)).stageNumber).toBe(2);
    expect(inst(done, goggles.id).attachedTo).toBe(villainId(done));
    expect(inPlayByCode(done, GOGGLES)).toHaveLength(1);
  });
});

/** Two harmless side schemes for the cards a villain phase deals (En Sabah Nur has no filler treacheries). */
const DEAL = ["45154", "45155"];
const SOURCE = "45153";
const STRENGTH = "45149";
const BLAST = "45150";
const INTERFACE = "45151";
const RITUAL = "45163";
const ARMOR = "45156";
const WEAPON = "45157";
const TECH = "45158";
const SET_IDS = ["celestial_tech", "clan_akkaba"];

/** An En Sabah Nur game with the two printed modular sets; the facedown cards of 1A's Setup go back into the deck. */
function apocGame(opts: { firstPlayerIndex?: number; expert?: boolean } = {}): GameState {
  const s = start("en-sabah-nur", {
    expert: opts.expert,
    options: {
      modularSetIds: SET_IDS,
      ...(opts.firstPlayerIndex !== undefined ? { firstPlayerIndex: opts.firstPlayerIndex } : {}),
    },
  });
  const deckId = Object.keys(s.encounterDecks)[0]!;
  const pile = s.encounterDecks[deckId]!;
  const dealt = s.players.flatMap((p) => p.dealtEncounter);
  return {
    ...s,
    players: s.players.map((p) => ({ ...p, dealtEncounter: [] })),
    encounterDecks: { ...s.encounterDecks, [deckId]: { ...pile, deck: [...pile.deck, ...dealt] } },
  };
}
const apocId = villainId;
const powerOn = (s: GameState): number => inst(s, s.mainScheme.instanceId).counters.power ?? 0;

describe("En Sabah Nur with its modular sets, two players", () => {
  it("setup: Biomorph form, Ancient Ritual in play at 5, one facedown card each", () => {
    const s = start("en-sabah-nur", { options: { modularSetIds: SET_IDS } });
    expect(s.villains[0]!.side).toBe("A");
    expect(inPlayByCode(s, RITUAL)).toHaveLength(1);
    expect(inst(s, inPlayByCode(s, RITUAL)[0]!).threat).toBe(5);
    for (const p of s.players) expect(p.dealtEncounter).toHaveLength(1);
  });

  it("45184a Biomorph overkill: an ally defending against Apocalypse spills the excess onto the hero", () => {
    const s0 = apocGame();
    const owner = playerOf(s0, P2);
    const ally = [...owner.hand, ...owner.deck].find((i) => codeOf(s0, i) === "01067")!;
    const seated: GameState = {
      ...s0,
      players: s0.players.map((p) =>
        p.playerId === P2
          ? {
              ...p,
              hand: p.hand.filter((i) => i !== ally),
              deck: p.deck.filter((i) => i !== ally),
              playArea: [...p.playArea, ally],
            }
          : p,
      ),
    };
    const wounded = patchInstance(seated, ally, { faceup: true, controllerId: P2, damage: 1 });
    const stacked = stackEncounterDeck(wounded, BLANK, BLANK_2, ...DEAL);
    const pick = (st: GameState): readonly string[] =>
      st.pendingChoice?.prompt.kind === "declareDefender" && st.pendingChoice.playerId === P2
        ? [ally as string]
        : firstLegal(st);
    const commands: Command[] = [toHero(P1), endTurn(P1), toHero(P2), endTurn(P2)];
    const run = driveEventsPicking(WAVE8_DEPS, stacked, pick, ...commands);
    expect(types(run.events, "overkillSpilled").length).toBeGreaterThan(0);
  });

  it("45147b power counters: the FIRST player (P2 here) reveals the SUPERPOWER card, so Biomorphic Blast activates against P2", () => {
    const s0 = apocGame({ firstPlayerIndex: 1 });
    const counted = patchInstance(s0, s0.mainScheme.instanceId, { counters: { power: 3 } });
    const calm = patchInstance(counted, s0.mainScheme.instanceId, { threat: 0 });
    const run = round(calm, { stack: [BLAST, BLANK, BLANK_2, ...DEAL], heroes: [P2] });
    expect(powerOn(run.state)).toBe(0);
    // The Blast (Biomorph) activates against P2, a hero: an attack on P2 on top of the villain phase's own.
    const attacks = types(run.events, "attackResolved").filter((e) => e.enemyInstanceId === apocId(s0));
    expect(attacks.length).toBe(2);
    expect(idDamage(run.state, P1)).toBe(0);
  });

  it("45151 Technological Interface: the Cyberpath threat on each scheme goes through Ancient Ritual's threshold", () => {
    const s0 = apocGame();
    const ritual = inPlayByCode(s0, RITUAL)[0]!;
    const at9 = patchInstance(s0, ritual, { threat: 9 });
    const run = round(at9, { stack: [BLANK, BLANK_2, INTERFACE, DEAL[0]!] });
    expect(run.state.villains[0]!.side).toBe("B");
    expect(inst(run.state, inPlayByCode(run.state, RITUAL)[0]!).threat).toBe(5);
    // Each player is dealt the normal card and, from Ancient Ritual, one more (the second is revealed in the same phase).
    for (const p of [P1, P2])
      expect(
        types(run.events, "cardMoved").filter((m) => m.to.kind === "dealtEncounter" && m.to.playerId === p),
      ).toHaveLength(2);
  });

  it("45149 Staggering Strength carries over a stage change with the Giant form (same title, RRG p. 47)", () => {
    const s0 = apocGame();
    const strength = attachToHost(s0, STRENGTH, apocId(s0));
    const done = defeatWithAttack(WAVE8_DEPS, withForm(strength.state, { heroForm: 0 }), apocId(s0), P1);
    expect(villainStageOf(done, apocId(done)).stageNumber).toBe(2);
    expect(inst(done, strength.id).attachedTo).toBe(apocId(done));
  });

  it("45149 Staggering Strength, both players heroes: the first player's attack is stunned and uses it up, the second's is plain", () => {
    const s0 = apocGame();
    const revealed = round(s0, { stack: [BLANK, BLANK_2, STRENGTH, DEAL[0]!] });
    expect(inPlayByCode(revealed.state, STRENGTH)).toHaveLength(1);
    // The first player token has passed on: the villain phase attacks the new first player first.
    const step = revealed.state.step;
    const first = step.phase === "player" && step.kind === "turn" ? step.activePlayerId : P1;
    const second = first === P1 ? P2 : P1;
    const run = round(revealed.state, { stack: [BLANK, BLANK_2, "45155", SOURCE], heroes: [P1, P2] });
    expect(statusOf(run.state, identityOf(run.state, first), "stunned")).toBe(1);
    expect(statusOf(run.state, identityOf(run.state, second), "stunned")).toBe(0);
    expect(inPlayByCode(run.state, STRENGTH)).toHaveLength(0);
    // Giant stage I ATK 2: the first player took 2 + 2 (the card), the second 2.
    expect(idDamage(run.state, first)).toBe(4);
    expect(idDamage(run.state, second)).toBe(2);
  });

  it("45149 Staggering Strength stays through a scheme: P1 alter-ego is schemed against, P2 hero is stunned and it is discarded", () => {
    const s0 = apocGame();
    const revealed = round(s0, { stack: [BLANK, BLANK_2, STRENGTH, DEAL[0]!] });
    const run = round(revealed.state, { stack: [BLANK, BLANK_2, "45155", SOURCE], heroes: [P2] });
    expect(statusOf(run.state, identityOf(run.state, P1), "stunned")).toBe(0);
    expect(statusOf(run.state, identityOf(run.state, P2), "stunned")).toBe(1);
    expect(inPlayByCode(run.state, STRENGTH)).toHaveLength(0);
    expect(idDamage(run.state, P2)).toBe(4);
  });

  it("45156 Celestial Armor on Apocalypse: his scheme against P1 mills P1's deck only", () => {
    const s0 = apocGame();
    const armor = attachToHost(s0, ARMOR, apocId(s0));
    const p1Deck = deckSize(armor.state, P1);
    const p2Deck = deckSize(armor.state, P2);
    const run = round(armor.state, { stack: [BLANK, BLANK_2, ...DEAL], heroes: [P2] });
    expect(deckSize(run.state, P1)).toBe(p1Deck - 1);
    expect(deckSize(run.state, P2)).toBe(p2Deck);
  });

  it("45157 Celestial Weapon on Apocalypse: his attack on P2 mills P2's deck only", () => {
    const s0 = apocGame();
    const weapon = attachToHost(s0, WEAPON, apocId(s0));
    const p1Deck = deckSize(weapon.state, P1);
    const p2Deck = deckSize(weapon.state, P2);
    const run = round(weapon.state, { stack: [BLANK, BLANK_2, ...DEAL], heroes: [P2] });
    expect(deckSize(run.state, P1)).toBe(p1Deck);
    expect(deckSize(run.state, P2)).toBe(p2Deck - 1);
  });

  it("45158 Celestial Tech dealt to P2: Armor resolves for P2 (the revealing player), not for P1", () => {
    const s0 = apocGame();
    const armor = attachToHost(s0, ARMOR, apocId(s0));
    armor.state = noIconTops(armor.state);
    const p1Deck = deckSize(armor.state, P1);
    const p2Deck = deckSize(armor.state, P2);
    // P1 hero (attacked: Armor stays quiet), P2 alter-ego (schemed against: one mill) and Tech revealed by P2 (another).
    const run = round(armor.state, { stack: [BLANK, BLANK_2, DEAL[0]!, TECH], heroes: [P1] });
    expect(deckSize(run.state, P1)).toBe(p1Deck);
    expect(deckSize(run.state, P2)).toBe(p2Deck - 2);
  });

  it("45153 Source of Power defeated by P2 while Apocalypse is Cyberpath: he turns Biomorph with a tough card and 1 indirect damage to each player", () => {
    const s0 = apocGame();
    const cyber = { ...s0, villains: s0.villains.map((v) => ({ ...v, side: "B" as const })) };
    const near = encounterSide(cyber, SOURCE);
    const hero = patchInstance(withForm(near.state, { heroForm: 0 }, P2), identityOf(near.state, P2), {
      exhausted: false,
    });
    const done = driveEventsPicking(WAVE8_DEPS, hero, firstLegal, endTurn(P1), {
      type: "basicThwart",
      playerId: P2,
      thwarterInstanceId: identityOf(hero, P2),
      schemeInstanceId: near.id,
    });
    expect(done.state.villains[0]!.side).toBe("A");
    expect(statusOf(done.state, apocId(done.state), "tough")).toBe(1);
    expect(idDamage(done.state, P1)).toBe(1);
    expect(idDamage(done.state, P2)).toBe(1);
  });
});

describe("En Sabah Nur 2A (45148a), two players", () => {
  it("completing 1B with P2 as first player: P2 reveals the SUPERPOWER card (Biomorphic Blast activates against P2)", () => {
    const s0 = apocGame({ firstPlayerIndex: 1 });
    const near = patchInstance(s0, s0.mainScheme.instanceId, { threat: 14 });
    const stacked = stackEncounterDeck(near, BLAST, BLANK, BLANK_2, ...DEAL);
    const run = driveEventsPicking(
      WAVE8_DEPS,
      withForm(stacked, { heroForm: 0 }, P2),
      firstLegal,
      endTurn(P2),
      endTurn(P1),
    );
    const revealed = types(run.events, "encounterCardRevealed").filter(
      (e) => codeOf(run.state, e.instanceId) === BLAST,
    );
    expect(revealed.map((e) => e.playerId)).toEqual([P2]);
  });
});

/** The top 3 cards of every deck print no resource, so a Celestial attachment's discard does nothing else. */
function noIconTops(state: GameState): GameState {
  return state.players.reduce(
    (acc, p) => p.deck.slice(0, 3).reduce((a, id) => patchInstance(a, id, { cardId: BLANK as never }), acc),
    state,
  );
}

/** Source of Power in the villain area at 1 threat (surgery). */
function encounterSide(state: GameState, code: string): { state: GameState; id: InstanceId } {
  const deckId = Object.keys(state.encounterDecks)[0]!;
  const pile = state.encounterDecks[deckId]!;
  const id = pile.deck.find((i) => codeOf(state, i) === code)!;
  const moved: GameState = {
    ...state,
    encounterDecks: { ...state.encounterDecks, [deckId]: { ...pile, deck: pile.deck.filter((i) => i !== id) } },
    villainArea: [...state.villainArea, id],
  };
  return { state: patchInstance(moved, id, { faceup: true, threat: 1 }), id };
}
