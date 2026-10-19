import { CORE_CARDS, CW_CARDS, encounterSetId, trait } from "@mc/content";
import {
  applyCommand,
  characterProfile,
  createGame,
  hasKeyword,
  SINGLE_TEAM,
  type Command,
  type GameEvent,
  type GameState,
  type InstanceId,
  type PlayerId,
} from "@mc/engine";
import { describe, expect, it, vi } from "vitest";
import { coreScenario } from "../../../core/setup.js";
import { validateDefinition } from "../../../dsl/validate.js";
import {
  P1,
  P2,
  P3,
  endTurn,
  firstLegal,
  identityOf,
  inst,
  settle,
  stackEncounterDeck,
} from "../../../testing/harness.js";
import { driveEventsPicking, encounterCardInVillainArea, playFromHand } from "../../../testing/staging.js";
import {
  BLACK_CAT,
  BLANK,
  CAPTAIN_MARVEL,
  FILLER_A,
  FILLER_B,
  IRON_MAN,
  ONE_ICON,
  SPIDER_MAN,
  attacksBy,
  codeOf,
  heroForm,
  inDiscard,
  inPlayCard,
  piles,
  revealedCodes,
  types,
} from "../../../wave9/testing.js";
import { WAVE10_CARDS } from "../../cards.js";
import { WAVE10_DEPS, engageMinion } from "../../testing.js";
import { MODULAR_DEFENDERS } from "./defenders.js";
import { MODULAR_HELLS_KITCHEN, MODULAR_HELLS_KITCHEN_SKIPPED } from "./hells-kitchen.js";

vi.setConfig({ testTimeout: 120_000 });

/**
 * The Hell's Kitchen modular set (56189 Daredevil, 56190 Iron Fist, 56191 Resistance Fighter, 56192 Street Defenders,
 * 56193 Defend Hell's Kitchen), docs/phase7-wave10.md sections 3.5, 3.6 and 3.23. The Civil War scenario builder does
 * not exist yet, so the set is tested inside Core's Rhino scenario against Core starter decks with the set's cards
 * added to the encounter deck by hand. There "the enemy leader" is Rhino (FFG ruling July 9, 2026), and in a
 * cooperative game there is no "your leader" (MC56 p. 6), so the "Otherwise" sentences resolve.
 */
const DAREDEVIL = "56189";
const FIST = "56190";
const FIGHTER = "56191";
const STREET = "56192";
const DEFEND = "56193";
const LUKE = "56184"; // The Defenders set: a Defender minion (ATK 2, SCH 1)
const SET = [DAREDEVIL, FIST, FIGHTER, STREET, DEFEND];
const RHINO = "01094";
const SHOCKER = "01103"; // Core minion: ATK 2, SCH 1, 3 hit points
const MERCENARY = "01101"; // Core minion: ATK 1, SCH 0
const BLANK_B = "01104"; // Hard to Keep Down: no boost icon
const REFS = [
  "56189.when-revealed",
  "56189.boost",
  "56190.when-revealed",
  "56190.boost",
  "56191.resistance-fighter-constant",
  "56191.resistance-fighter-constant-2",
  "56191.boost",
  "56192.when-revealed",
  "56193.defend-hells-kitchen-constant",
];

type Seat = typeof SPIDER_MAN | typeof CAPTAIN_MARVEL | typeof IRON_MAN;
const dataOf = (code: string) => CW_CARDS.find((c) => (c.id as string) === code)! as unknown as Record<string, unknown>;

/** Rhino's game against the Core decks (hero form) with one copy of each of the set's cards (and Luke Cage) in the encounter deck. */
function game(seats: readonly Seat[] = [SPIDER_MAN]): GameState {
  const config = coreScenario("rhino", {
    players: seats,
    seed: 1,
    difficulty: "standard",
    modularSetIds: [],
    cardPool: [...CORE_CARDS, ...WAVE10_CARDS],
  } as never);
  const copies = CW_CARDS.filter(
    (c) =>
      "encounterSetIds" in c &&
      (c.encounterSetIds.includes(encounterSetId("hells_kitchen")) || (c.id as string) === LUKE),
  ).flatMap((c) => Array.from({ length: c.quantityInSet }, () => c.id));
  const created = createGame({ ...config, encounterDeck: [...config.encounterDeck, ...copies] }, WAVE10_DEPS);
  if (!created.ok) throw new Error(created.error.message);
  const settled = settle(created.state, firstLegal, (s) => s.step.phase === "player", WAVE10_DEPS);
  return heroForm(settled, ...seats.map((_, i) => [P1, P2, P3][i]!));
}

/** Every player ends the turn and the villain phase runs on the stacked deck (top first: Rhino's boosts, then the rest). */
function villainPhase(state: GameState, stack: readonly string[]) {
  return driveEventsPicking(
    WAVE10_DEPS,
    stackEncounterDeck(state, ...stack),
    firstLegal,
    ...state.players.map((p) => endTurn(p.playerId)),
  );
}

/**
 * The same, stopped at the first pending choice `stop` accepts, answering every other choice with the first legal
 * option. Returns the state at that choice (or the end, if none came).
 */
function villainPhaseUntil(
  state: GameState,
  stack: readonly string[],
  stop: (s: GameState) => boolean,
): { readonly state: GameState; readonly events: readonly GameEvent[] } {
  let current = stackEncounterDeck(state, ...stack);
  const events: GameEvent[] = [];
  const apply = (command: Command): void => {
    const result = applyCommand(current, command, WAVE10_DEPS);
    if (!result.ok) throw new Error(`${command.type}: ${result.error.message}`);
    current = result.state;
    events.push(...result.events);
  };
  const settleChoices = (): void => {
    for (let guard = 0; guard < 200; guard++) {
      const choice = current.pendingChoice;
      if (!choice || stop(current)) return;
      apply({
        type: "resolveChoice",
        playerId: choice.playerId,
        choiceId: choice.choiceId,
        selectedOptionIds: firstLegal(current),
      });
    }
    throw new Error("choices did not settle");
  };
  settleChoices();
  // One end of turn for each player still to go this round (the villain phase follows the last).
  const step = current.step;
  const toGo =
    step.phase === "player" && step.kind === "turn"
      ? current.players.length - current.players.findIndex((p) => p.playerId === step.activePlayerId)
      : 0;
  for (let turn = 0; turn < toGo; turn++) {
    const now = current.step;
    if (current.pendingChoice || now.phase !== "player" || now.kind !== "turn") break;
    apply(endTurn(now.activePlayerId));
    settleChoices();
  }
  return { state: current, events };
}

/** Answers the pending choice as `player` with `optionId`, then every later choice with the first legal option. */
function answer(state: GameState, player: PlayerId, optionId: string) {
  const choice = state.pendingChoice!;
  const picked = applyCommand(
    state,
    { type: "resolveChoice", playerId: player, choiceId: choice.choiceId, selectedOptionIds: [optionId] },
    WAVE10_DEPS,
  );
  if (!picked.ok) throw new Error(picked.error.message);
  const rest = driveEventsPicking(WAVE10_DEPS, picked.state, firstLegal);
  return { state: rest.state, events: [...picked.events, ...rest.events] };
}

const refused = (state: GameState, player: PlayerId, optionId: string): boolean => {
  const choice = state.pendingChoice!;
  return !applyCommand(
    state,
    { type: "resolveChoice", playerId: player, choiceId: choice.choiceId, selectedOptionIds: [optionId] },
    WAVE10_DEPS,
  ).ok;
};

function onTurnOf(state: GameState, player: PlayerId): GameState {
  /** Plays out the turns of the players before `player` (each just ends it), so `player` is the active one. */
  let current = state;
  for (let guard = 0; guard < 5; guard++) {
    const step = current.step;
    if (step.phase !== "player" || step.kind !== "turn" || step.activePlayerId === player) break;
    current = driveEventsPicking(WAVE10_DEPS, current, firstLegal, endTurn(step.activePlayerId)).state;
  }
  return current;
}

const hero = (s: GameState, player: PlayerId = P1) => identityOf(s, player);
const exhaustedIds = (events: readonly GameEvent[]) => types(events, "cardExhausted").map((e) => e.instanceId);
const flips = (events: readonly GameEvent[]) => types(events, "boostCardFlipped").length;
const attachedCodes = (s: GameState, host: InstanceId) => inst(s, host).attachments.map((a) => codeOf(s, a));
const optionIds = (s: GameState) => s.pendingChoice!.options.map((o) => o.optionId).sort();
const profile = (s: GameState, id: InstanceId) => characterProfile(s, id, WAVE10_DEPS)!;
const ANY_CHOICE = (s: GameState) =>
  s.pendingChoice?.prompt.kind === "chooseTarget" || s.pendingChoice?.prompt.kind === "chooseAttachmentTarget";

describe("registry", () => {
  it("registers the nine refs of the five cards, each a valid definition, and skips nothing", () => {
    expect(Object.keys(MODULAR_HELLS_KITCHEN).sort()).toEqual([...REFS].sort());
    for (const [id, def] of Object.entries(MODULAR_HELLS_KITCHEN)) expect(validateDefinition(def), id).toEqual([]);
    expect(MODULAR_HELLS_KITCHEN_SKIPPED).toEqual({});
  });

  it("the data names exactly these refs for the five cards", () => {
    const refs = SET.flatMap((code) => ((dataOf(code).abilities ?? []) as { id: string }[]).map((a) => a.id));
    expect(refs.sort()).toEqual([...REFS].sort());
  });

  it("carries the printed timing of each ability", () => {
    const reg = MODULAR_HELLS_KITCHEN;
    for (const ref of ["56189.when-revealed", "56190.when-revealed", "56192.when-revealed"])
      expect(reg[ref]!.trigger, ref).toMatchObject({ kind: "whenRevealed" });
    for (const ref of ["56189.boost", "56190.boost", "56191.boost"])
      expect(reg[ref]!.trigger, ref).toMatchObject({ kind: "boost" });
    expect(reg["56191.resistance-fighter-constant"]!.trigger).toMatchObject({ kind: "cannotAttach" });
    expect(reg["56191.resistance-fighter-constant-2"]!.trigger).toMatchObject({ kind: "constant" });
    expect(reg["56193.defend-hells-kitchen-constant"]!.trigger).toMatchObject({ kind: "constant" });
  });

  it("56192 is the Defenders' Street Defenders definition, the one shared copy", () => {
    expect(MODULAR_HELLS_KITCHEN["56192.when-revealed"]).toBe(MODULAR_DEFENDERS["56187.when-revealed"]);
  });

  it("Iron Fist's competitive-only sentences are written in full, not dropped", () => {
    const text = JSON.stringify([MODULAR_HELLS_KITCHEN["56190.when-revealed"], MODULAR_HELLS_KITCHEN["56190.boost"]]);
    expect(text).toContain("Iron Fist attacks your leader.");
    expect(text).toContain(
      "The enemy leader attacks your leader (after this activation). Do not give it a boost card for this attack.",
    );
  });

  it("setup: the encounter deck holds one copy of each card", () => {
    const s = game();
    const all = Object.keys(s.instances).map((i) => codeOf(s, i as InstanceId));
    expect(SET.map((code) => all.filter((c) => c === code).length)).toEqual([1, 1, 1, 1, 1]);
  });
});

describe("Daredevil (56189)", () => {
  it("is data: a unique Defender minion, ATK 2, SCH 2, 3 hit points, no boost icon and a star icon", () => {
    const card = dataOf(DAREDEVIL);
    expect([card.type, card.atk, card.sch, card.hp, card.boostIcons, card.starIcon, card.unique]).toEqual([
      "minion",
      2,
      2,
      3,
      0,
      true,
      true,
    ]);
    expect(card.traits).toEqual([trait("DEFENDER")]);
  });

  it("WHEN REVEALED with one character: the first player is still asked, as the enemy team, then your hero is exhausted", () => {
    const start = game();
    const asked = villainPhaseUntil(start, [BLANK, DAREDEVIL, FILLER_A], ANY_CHOICE);
    expect(asked.state.pendingChoice).toMatchObject({ playerId: P1, authority: "enemyTeam" });
    expect(optionIds(asked.state)).toEqual([hero(start)]);
    const run = answer(asked.state, P1, hero(start));
    expect(exhaustedIds(run.events)).toEqual([hero(start)]);
    expect(inst(run.state, inPlayCard(run.state, DAREDEVIL)!).engagedWith).toBe(P1);
  });

  it("WHEN REVEALED with two characters: the first player (not the revealer) is asked, as the enemy team", () => {
    // Three players: P2 reveals Daredevil and has Black Cat in play; P1 is the first player.
    const withAlly = playFromHand(
      WAVE10_DEPS,
      onTurnOf(game([CAPTAIN_MARVEL, SPIDER_MAN, IRON_MAN]), P2),
      BLACK_CAT,
      2,
      firstLegal,
      P2,
    );
    const cat = withAlly.id;
    const start = withAlly.state;
    expect(inst(start, cat).exhausted).toBe(false);
    const asked = villainPhaseUntil(start, [BLANK, BLANK, BLANK_B, FILLER_A, DAREDEVIL, FILLER_B], ANY_CHOICE);
    const choice = asked.state.pendingChoice!;
    expect(asked.state.firstPlayerId).toBe(P1);
    expect(choice.playerId).toBe(P1);
    expect(choice.authority).toBe("enemyTeam");
    expect(choice.onBehalfOf).toMatchObject({ kind: "enemyTeam", facingPlayerId: P2 });
    // Only the revealing player's characters are offered.
    expect(optionIds(asked.state)).toEqual([hero(start, P2), cat].sort());
    // Neither the revealing player nor the third player may answer for the first player.
    expect(refused(asked.state, P2, cat)).toBe(true);
    expect(refused(asked.state, P3, cat)).toBe(true);
    const done = answer(asked.state, P1, cat);
    expect(exhaustedIds(done.events)).toEqual([cat]);
    expect(inst(done.state, cat).exhausted).toBe(true);
    expect(inst(done.state, hero(start, P2)).exhausted).toBe(false);
    expect(inst(done.state, inPlayCard(done.state, DAREDEVIL)!).engagedWith).toBe(P2);
  });

  it("BOOST with one character: the first player is asked (one option; here also the player Rhino activated against) and the hero is exhausted; Daredevil does not enter play", () => {
    const start = game();
    const asked = villainPhaseUntil(start, [DAREDEVIL, FILLER_A], ANY_CHOICE);
    expect(asked.state.pendingChoice).toMatchObject({ playerId: P1, authority: "firstPlayerTargets" });
    expect(optionIds(asked.state)).toEqual([hero(start)]);
    const run = answer(asked.state, P1, hero(start));
    expect(exhaustedIds(run.events)).toEqual([hero(start)]);
    expect(attacksBy(run.state, [...asked.events, ...run.events], RHINO)).toMatchObject([
      { baseAtk: 2, boostIcons: 0, damageDealt: 2 },
    ]);
    expect(inPlayCard(run.state, DAREDEVIL)).toBeUndefined();
  });

  // No "choose": an encounter card targeting one of several eligible cards; the first player selects
  // (RRG 1.8 "First Player", p. 19).
  it("BOOST with two characters: the first player (P1) chooses among the activated player's (P2) characters, not the enemy team", () => {
    const withAlly = playFromHand(
      WAVE10_DEPS,
      onTurnOf(game([CAPTAIN_MARVEL, SPIDER_MAN]), P2),
      BLACK_CAT,
      2,
      firstLegal,
      P2,
    );
    const cat = withAlly.id;
    // Rhino's first activation is against P1, whose boost is blank; the second is against P2, whose boost is Daredevil.
    const asked = villainPhaseUntil(withAlly.state, [BLANK, DAREDEVIL, FILLER_A, FILLER_B], ANY_CHOICE);
    const choice = asked.state.pendingChoice!;
    expect(choice.playerId).toBe(P1);
    expect(choice.authority).toBe("firstPlayerTargets");
    expect(optionIds(asked.state)).toEqual([hero(withAlly.state, P2), cat].sort());
    expect(refused(asked.state, P2, cat)).toBe(true);
    const done = answer(asked.state, P1, cat);
    expect(exhaustedIds(done.events)).toEqual([cat]);
    expect(inst(done.state, hero(withAlly.state, P1)).exhausted).toBe(false);
  });

  it("a hero not boosted by him is not exhausted (control)", () => {
    const run = villainPhaseUntil(game(), [BLANK, FILLER_A], ANY_CHOICE);
    expect(exhaustedIds(run.events)).toEqual([]);
  });
});

describe("Iron Fist (56190)", () => {
  it("is data: a unique Defender minion, ATK 3, SCH 1, 4 hit points, no boost icon and a star icon", () => {
    const card = dataOf(FIST);
    expect([card.type, card.atk, card.sch, card.hp, card.boostIcons, card.starIcon, card.unique]).toEqual([
      "minion",
      3,
      1,
      4,
      0,
      true,
      true,
    ]);
    expect(card.traits).toEqual([trait("DEFENDER")]);
  });

  it("WHEN REVEALED (no 'your leader' in a cooperative game): he activates against you with no boost card", () => {
    // Rhino's villain-phase boost is blank; the one icon card behind Iron Fist must stay on the deck.
    const run = villainPhase(game(), [BLANK, FIST, ONE_ICON, FILLER_A]);
    expect(attacksBy(run.state, run.events, FIST)).toMatchObject([{ baseAtk: 3, boostIcons: 0, damageDealt: 3 }]);
    expect(attacksBy(run.state, run.events, RHINO)).toHaveLength(1);
    expect(flips(run.events)).toBe(1);
    expect(inst(run.state, hero(run.state)).damage).toBe(5);
    expect(inst(run.state, inPlayCard(run.state, FIST)!).engagedWith).toBe(P1);
    expect(codeOf(run.state, piles(run.state).deck[0]!)).toBe(ONE_ICON);
  });

  it("WHEN REVEALED in a two-player game: he attacks the player who revealed him, not the first player", () => {
    const run = villainPhase(game([SPIDER_MAN, CAPTAIN_MARVEL]), [BLANK, BLANK_B, FILLER_A, FIST]);
    const fist = attacksBy(run.state, run.events, FIST);
    expect(fist).toHaveLength(1);
    expect(fist[0]!.targetInstanceId).toBe(hero(run.state, P2));
    expect(inst(run.state, hero(run.state, P1)).damage).toBe(2);
    expect(inst(run.state, hero(run.state, P2)).damage).toBe(5);
  });

  it("BOOST (nothing to attack cooperatively): 0 icons, Rhino attacks once, and Iron Fist neither attacks nor enters play", () => {
    const run = villainPhase(game(), [FIST, FILLER_A]);
    expect(attacksBy(run.state, run.events, RHINO)).toMatchObject([{ baseAtk: 2, boostIcons: 0, damageDealt: 2 }]);
    expect(attacksBy(run.state, run.events, FIST)).toEqual([]);
    expect(types(run.events, "attackResolved")).toHaveLength(1);
    expect(inst(run.state, hero(run.state)).damage).toBe(2);
    expect(inPlayCard(run.state, FIST)).toBeUndefined();
  });
});

describe("Resistance Fighter (56191)", () => {
  it("is data: a Condition attachment for a minion with +1 ATK and +1 SCH, a boost star and no icon", () => {
    const card = dataOf(FIGHTER);
    expect([card.type, card.statModifiers, card.boostIcons, card.starIcon, card.attachesTo]).toEqual([
      "attachment",
      { atk: 1, sch: 1 },
      0,
      true,
      { kind: "minion" },
    ]);
    expect(card.traits).toEqual([trait("CONDITION")]);
    // "Of the enemy team's choice"; the card prints no limit per character.
    expect(card.hostChosenBy).toBe("enemyTeam");
    expect(card.playRestrictions).toBeUndefined();
  });

  it("WHEN REVEALED with no minion in play: it cannot attach, gains surge (the next card is revealed too) and is discarded", () => {
    const run = villainPhase(game(), [BLANK, FIGHTER, FILLER_A, FILLER_B]);
    expect(revealedCodes(run.state, run.events)).toEqual([FIGHTER, FILLER_A]);
    expect(inPlayCard(run.state, FIGHTER)).toBeUndefined();
    expect(inDiscard(run.state, FIGHTER)).toHaveLength(1);
  });

  it("WHEN REVEALED with one minion in play: it attaches to it without a prompt and does not surge", () => {
    const start = engageMinion(game(), SHOCKER, "shocker");
    const run = villainPhaseUntil(start, [BLANK, FIGHTER, FILLER_A], ANY_CHOICE);
    expect(run.state.pendingChoice).toBeNull();
    expect(attachedCodes(run.state, "shocker" as InstanceId)).toEqual([FIGHTER]);
    expect(revealedCodes(run.state, run.events)).toEqual([FIGHTER]);
    expect(inDiscard(run.state, FIGHTER)).toHaveLength(0);
  });

  it("WHEN REVEALED with several minions: the first player, not the revealer, picks the host as the enemy team", () => {
    // Three players; P2 reveals it, with a Shocker engaged with P2 and a Mercenary engaged with P3.
    const start = engageMinion(
      engageMinion(game([SPIDER_MAN, CAPTAIN_MARVEL, IRON_MAN]), SHOCKER, "shocker", P2),
      MERCENARY,
      "mercenary",
      P3,
    );
    const asked = villainPhaseUntil(start, [BLANK, BLANK, BLANK_B, FILLER_A, FIGHTER, FILLER_B], ANY_CHOICE);
    const choice = asked.state.pendingChoice!;
    expect(choice.prompt.kind).toBe("chooseAttachmentTarget");
    expect(choice.playerId).toBe(P1);
    expect(choice.authority).toBe("enemyTeam");
    expect(choice.onBehalfOf).toEqual({ kind: "enemyTeam", teamId: SINGLE_TEAM, facingPlayerId: P2 });
    expect(optionIds(asked.state)).toEqual(["mercenary", "shocker"]);
    expect(refused(asked.state, P2, "shocker")).toBe(true);
    expect(refused(asked.state, P3, "mercenary")).toBe(true);
    const done = answer(asked.state, P1, "mercenary");
    expect(attachedCodes(done.state, "mercenary" as InstanceId)).toEqual([FIGHTER]);
    expect(attachedCodes(done.state, "shocker" as InstanceId)).toEqual([]);
  });

  it("OF THE ENEMY TEAM'S CHOICE: in a 2-player game P2 reveals it and P1 is asked as the enemy team; P2 is refused", () => {
    const start = engageMinion(
      engageMinion(game([SPIDER_MAN, CAPTAIN_MARVEL]), SHOCKER, "shocker", P2),
      MERCENARY,
      "mercenary",
      P2,
    );
    const asked = villainPhaseUntil(start, [BLANK, BLANK_B, FILLER_A, FIGHTER, FILLER_B], ANY_CHOICE);
    const choice = asked.state.pendingChoice!;
    expect(asked.state.firstPlayerId).toBe(P1);
    expect(choice.prompt.kind).toBe("chooseAttachmentTarget");
    expect(choice.playerId).toBe(P1);
    expect(choice.authority).toBe("enemyTeam");
    expect(choice.onBehalfOf).toEqual({ kind: "enemyTeam", teamId: SINGLE_TEAM, facingPlayerId: P2 });
    expect(optionIds(asked.state)).toEqual(["mercenary", "shocker"]);
    const refusal = applyCommand(
      asked.state,
      { type: "resolveChoice", playerId: P2, choiceId: choice.choiceId, selectedOptionIds: ["shocker"] },
      WAVE10_DEPS,
    );
    expect(refusal.ok).toBe(false);
    if (refusal.ok) return;
    expect(refusal.error.code).toBe("invalid_choice");
    expect(refusal.error.message).toBe("p1 must make this choice");
    const done = answer(asked.state, P1, "shocker");
    expect(attachedCodes(done.state, "shocker" as InstanceId)).toEqual([FIGHTER]);
    expect(attachedCodes(done.state, "mercenary" as InstanceId)).toEqual([]);
    expect(types(done.events, "choiceResolved")[0]).toMatchObject({
      playerId: P1,
      selectedOptionIds: ["shocker"],
      onBehalfOf: { kind: "enemyTeam", teamId: SINGLE_TEAM, facingPlayerId: P2 },
    });
  });

  it("CONSTANT: the attached minion has +4 hit points, +1 ATK, +1 SCH and stalwart; another minion and the villain do not", () => {
    const start = engageMinion(engageMinion(game(), SHOCKER, "shocker"), MERCENARY, "mercenary");
    const shocker = "shocker" as InstanceId;
    const before = profile(start, shocker);
    expect(hasKeyword(start, shocker, "stalwart", WAVE10_DEPS)).toBe(false);
    const asked = villainPhaseUntil(start, [BLANK, FIGHTER, FILLER_A], ANY_CHOICE);
    const host = answer(asked.state, P1, "shocker").state;
    const after = profile(host, shocker);
    expect(attachedCodes(host, shocker)).toEqual([FIGHTER]);
    expect([after.maxHp - before.maxHp, after.atk - before.atk, after.sch - before.sch]).toEqual([4, 1, 1]);
    expect(hasKeyword(host, shocker, "stalwart", WAVE10_DEPS)).toBe(true);
    const other = "mercenary" as InstanceId;
    expect(hasKeyword(host, other, "stalwart", WAVE10_DEPS)).toBe(false);
    expect(profile(host, other).maxHp).toBe(profile(start, other).maxHp);
    expect(hasKeyword(host, host.activeVillainId!, "stalwart", WAVE10_DEPS)).toBe(false);
  });

  it("BOOST: it is attached to a minion engaged with you; Rhino's attack carries no icon from it", () => {
    const start = engageMinion(game(), SHOCKER, "shocker");
    const run = villainPhase(start, [FIGHTER, FILLER_A]);
    expect(attacksBy(run.state, run.events, RHINO)).toMatchObject([{ baseAtk: 2, boostIcons: 0, damageDealt: 2 }]);
    expect(attachedCodes(run.state, "shocker" as InstanceId)).toEqual([FIGHTER]);
    expect(inDiscard(run.state, FIGHTER)).toHaveLength(0);
  });

  it("BOOST: with two minions engaged with you, you choose which", () => {
    const start = engageMinion(engageMinion(game(), SHOCKER, "shocker"), MERCENARY, "mercenary");
    const asked = villainPhaseUntil(start, [FIGHTER, FILLER_A], ANY_CHOICE);
    expect(asked.state.pendingChoice!.playerId).toBe(P1);
    expect(optionIds(asked.state)).toEqual(["mercenary", "shocker"]);
    const done = answer(asked.state, P1, "mercenary");
    expect(attachedCodes(done.state, "mercenary" as InstanceId)).toEqual([FIGHTER]);
    expect(attachedCodes(done.state, "shocker" as InstanceId)).toEqual([]);
  });

  it("BOOST: a minion engaged with another player is not a host; with none engaged with you it attaches nowhere and is discarded", () => {
    const start = engageMinion(game([SPIDER_MAN, CAPTAIN_MARVEL]), SHOCKER, "shocker", P2);
    const run = villainPhase(start, [FIGHTER, BLANK, FILLER_A, FILLER_B]);
    expect(attachedCodes(run.state, "shocker" as InstanceId)).toEqual([]);
    expect(inDiscard(run.state, FIGHTER)).toHaveLength(1);
  });
});

describe("Street Defenders (56192, the same card as 56187)", () => {
  it("is data: a treachery with 2 boost icons", () => {
    const card = dataOf(STREET);
    expect([card.type, card.boostIcons, card.starIcon, card.keywords]).toEqual(["treachery", 2, undefined, []]);
  });

  it("WHEN REVEALED with no minion in play: the enemy leader (Rhino) activates against you with no boost card", () => {
    const run = villainPhase(game(), [BLANK, STREET, ONE_ICON, FILLER_A]);
    expect(attacksBy(run.state, run.events, RHINO)).toMatchObject([
      { baseAtk: 2, boostIcons: 0, damageDealt: 2 },
      { baseAtk: 2, boostIcons: 0, damageDealt: 2 },
    ]);
    expect(flips(run.events)).toBe(1);
    expect(inst(run.state, hero(run.state)).damage).toBe(4);
    expect(codeOf(run.state, piles(run.state).deck[0]!)).toBe(ONE_ICON);
  });

  it("WHEN REVEALED with a minion engaged with you: that minion activates (no boost) and Rhino does not", () => {
    const run = villainPhase(engageMinion(game(), SHOCKER, "shocker"), [BLANK, STREET, ONE_ICON, FILLER_A]);
    expect(attacksBy(run.state, run.events, RHINO)).toHaveLength(1);
    expect(attacksBy(run.state, run.events, SHOCKER)).toMatchObject([
      { baseAtk: 2, boostIcons: 0, damageDealt: 2 },
      { baseAtk: 2, boostIcons: 0, damageDealt: 2 },
    ]);
    expect(flips(run.events)).toBe(1);
    expect(inst(run.state, hero(run.state)).damage).toBe(6);
    expect(codeOf(run.state, piles(run.state).deck[0]!)).toBe(ONE_ICON);
  });

  it("WHEN REVEALED: a minion engaged with the other player activates against that player, not the revealer", () => {
    const start = engageMinion(game([SPIDER_MAN, CAPTAIN_MARVEL]), SHOCKER, "shocker", P2);
    const run = villainPhase(start, [BLANK, BLANK_B, STREET, FILLER_A]);
    const shocker = attacksBy(run.state, run.events, SHOCKER);
    expect(shocker).toHaveLength(2);
    expect(shocker.every((a) => a.targetInstanceId === hero(run.state, P2))).toBe(true);
    expect(inst(run.state, hero(run.state, P1)).damage).toBe(2);
    expect(inst(run.state, hero(run.state, P2)).damage).toBe(6);
  });

  it("BOOST: 2 icons on the activating enemy's attack (Rhino ATK 2 + 2)", () => {
    const run = villainPhase(game(), [STREET, FILLER_A]);
    expect(attacksBy(run.state, run.events, RHINO)).toMatchObject([{ baseAtk: 2, boostIcons: 2, damageDealt: 4 }]);
    expect(attacksBy(run.state, run.events, RHINO)).toHaveLength(1);
  });
});

describe("Defend Hell's Kitchen (56193)", () => {
  const thwart = (s: GameState, scheme: InstanceId) =>
    applyCommand(
      s,
      { type: "basicThwart", playerId: P1, thwarterInstanceId: hero(s), schemeInstanceId: scheme },
      WAVE10_DEPS,
    );

  it("is data: a side scheme with 3 threat (none per player), 2 boost icons and Hinder 1 per hero", () => {
    const card = dataOf(DEFEND);
    expect([card.type, card.startingThreat, card.boostIcons, card.keywords]).toEqual([
      "side_scheme",
      { base: 3, perPlayer: 0 },
      2,
      [{ name: "hinder", value: 0, perPlayer: 1 }],
    ]);
  });

  it("REVEALED it enters play with 3 threat plus 1 for Hinder (one hero)", () => {
    const run = villainPhase(game(), [BLANK, DEFEND, FILLER_A]);
    expect(inst(run.state, inPlayCard(run.state, DEFEND)!).threat).toBe(4);
  });

  // A scheme threat cannot be removed from is no target for a basic thwart (docs/phase7-wave11-scenarios.md §S7 item
  // 40; RRG 1.8 "Target", p. 43).
  it("CONSTANT: with a Defender minion in play no threat can be removed from it, so a thwart of it is refused", () => {
    const withLuke = engageMinion(game(), LUKE, "luke");
    const { state, id } = encounterCardInVillainArea(withLuke, DEFEND, 4);
    expect(thwart(state, id)).toMatchObject({ ok: false, error: { code: "no_valid_target" } });
    expect(inst(state, id).threat).toBe(4);
  });

  it("CONSTANT: without a Defender the same thwart removes 1 threat; a non-Defender minion does not stop it", () => {
    const { state, id } = encounterCardInVillainArea(game(), DEFEND, 4);
    const free = thwart(state, id);
    expect(free.ok).toBe(true);
    if (free.ok) expect(inst(free.state, id).threat).toBe(3);
    const withShocker = encounterCardInVillainArea(engageMinion(game(), SHOCKER, "shocker"), DEFEND, 4);
    const second = thwart(withShocker.state, withShocker.id);
    expect(second.ok).toBe(true);
    if (second.ok) expect(inst(second.state, withShocker.id).threat).toBe(3);
  });

  it("CONSTANT: once the Defender leaves play, threat can be removed again", () => {
    const withLuke = engageMinion(game(), LUKE, "luke");
    const { state, id } = encounterCardInVillainArea(withLuke, DEFEND, 4);
    const gone: GameState = {
      ...state,
      players: state.players.map((p) => ({ ...p, playArea: p.playArea.filter((i) => i !== ("luke" as InstanceId)) })),
    };
    const result = thwart(gone, id);
    expect(result.ok).toBe(true);
    if (result.ok) expect(inst(result.state, id).threat).toBe(3);
  });

  it("BOOST: 2 icons on the activating enemy's attack (Rhino ATK 2 + 2)", () => {
    const run = villainPhase(game(), [DEFEND, FILLER_A]);
    expect(attacksBy(run.state, run.events, RHINO)).toMatchObject([{ baseAtk: 2, boostIcons: 2, damageDealt: 4 }]);
  });
});
