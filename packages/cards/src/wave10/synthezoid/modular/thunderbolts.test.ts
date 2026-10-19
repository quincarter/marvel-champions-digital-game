import { CORE_CARDS, encounterSetId, trait } from "@mc/content";
import {
  applyCommand,
  threatCannotBeRemoved,
  createGame,
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
  endTurn,
  firstLegal,
  identityOf,
  inst,
  moveToHand,
  patchInstance,
  payWith,
  picking,
  play,
  type Picker,
  settle,
  stackEncounterDeck,
} from "../../../testing/harness.js";
import { driveEventsPicking, encounterCardInVillainArea } from "../../../testing/staging.js";
import {
  BLACK_CAT,
  BLANK,
  CAPTAIN_MARVEL,
  FILLER_A,
  FILLER_B,
  ONE_ICON,
  SPIDER_MAN,
  attacksBy,
  codeOf,
  heroForm,
  heroThwarts,
  inPlayCard,
  piles,
  types,
} from "../../../wave9/testing.js";
import { WAVE10_CARDS } from "../../cards.js";
import { WAVE10_DEPS, engageMinion, stagedInPlay } from "../../testing.js";
import { SYNTHEZOID_MODULAR_THUNDERBOLTS, SYNTHEZOID_MODULAR_THUNDERBOLTS_SKIPPED } from "./thunderbolts.js";

vi.setConfig({ testTimeout: 120_000 });

/**
 * The Thunderbolts modular set (57017 Atlas, 57018 Songbird, 57019 Penance, 57020 Justice Like Lightning, 57021 The
 * Thunderbolts), docs/phase7-synthezoid.md section 7.3 and M8. Tested in Core's Rhino scenario against the Core decks
 * with the set's cards added to the encounter deck by hand. In a cooperative game there is no "your leader" (MC57
 * p. 4), so each "Otherwise" sentence resolves.
 */
const ATLAS = "57017";
const SONGBIRD = "57018";
const PENANCE = "57019";
const JUSTICE = "57020";
const SCHEME = "57021";
const SET = [ATLAS, SONGBIRD, PENANCE, JUSTICE, SCHEME];
const RHINO = "01094";
const SHOCKER = "01103"; // Core minion: ATK 2, SCH 1
const MERCENARY = "01101"; // Core minion: ATK 1, SCH 0
const NICK_FURY = "01084";
const BLANK_B = "01104"; // Hard to Keep Down: no boost icon
const REFS = [
  "57017.when-revealed",
  "57017.boost",
  "57018.when-revealed",
  "57018.boost",
  "57019.when-revealed",
  "57019.boost",
  "57020.when-revealed",
  "57021.the-thunderbolts-constant",
];

const dataOf = (code: string) =>
  WAVE10_CARDS.find((c) => (c.id as string) === code)! as unknown as Record<string, unknown>;

type Seat = typeof SPIDER_MAN | typeof CAPTAIN_MARVEL;

function game(seats: readonly Seat[] = [SPIDER_MAN]): GameState {
  const config = coreScenario("rhino", {
    players: seats,
    seed: 1,
    difficulty: "standard",
    modularSetIds: [],
    cardPool: [...CORE_CARDS, ...WAVE10_CARDS],
  } as never);
  const copies = WAVE10_CARDS.filter(
    (c) => "encounterSetIds" in c && c.encounterSetIds.includes(encounterSetId("thunderbolts_modular")),
  ).flatMap((c) => Array.from({ length: c.quantityInSet }, () => c.id));
  const created = createGame({ ...config, encounterDeck: [...config.encounterDeck, ...copies] }, WAVE10_DEPS);
  if (!created.ok) throw new Error(created.error.message);
  const settled = settle(created.state, firstLegal, (s) => s.step.phase === "player", WAVE10_DEPS);
  return heroForm(settled, ...seats.map((_, i) => [P1, P2][i]!));
}

/** Every player ends the turn and the villain phase runs on the stacked deck (top first: Rhino boost, then the rest). */
const villainPhase = (state: GameState, stack: readonly string[]) =>
  driveEventsPicking(
    WAVE10_DEPS,
    stackEncounterDeck(state, ...stack),
    firstLegal,
    ...state.players.map((p) => endTurn(p.playerId)),
  );

/** The villain phase, stopping at the first `chooseTarget` prompt (every other choice takes the first legal option). */
function villainPhaseAsked(state: GameState, stack: readonly string[]): GameState {
  let current = stackEncounterDeck(state, ...stack);
  const apply = (command: Command): void => {
    const result = applyCommand(current, command, WAVE10_DEPS);
    if (!result.ok) throw new Error(result.error.message);
    current = result.state;
  };
  const drain = (): boolean => {
    for (let guard = 0; guard < 100 && current.pendingChoice; guard++) {
      const choice = current.pendingChoice;
      if (choice.prompt.kind === "chooseTarget") return true;
      apply({
        type: "resolveChoice",
        playerId: choice.playerId,
        choiceId: choice.choiceId,
        selectedOptionIds: firstLegal(current),
      });
    }
    return false;
  };
  for (const player of state.players) {
    if (drain()) return current;
    apply(endTurn(player.playerId));
  }
  drain();
  return current;
}

const hero = (s: GameState, player: PlayerId = P1) => identityOf(s, player);
const villain = (s: GameState): InstanceId => s.activeVillainId!;
const statuses = (s: GameState, id: InstanceId) => inst(s, id).statuses;
const damageOn = (s: GameState, id: InstanceId) => inst(s, id).damage;
const flips = (events: readonly GameEvent[]) => types(events, "boostCardFlipped").length;
const optionIds = (s: GameState) => s.pendingChoice!.options.map((o) => o.optionId).sort();

describe("registry", () => {
  it("registers the eight refs of the five cards, each a valid definition, and skips nothing", () => {
    expect(Object.keys(SYNTHEZOID_MODULAR_THUNDERBOLTS).sort()).toEqual([...REFS].sort());
    for (const [id, def] of Object.entries(SYNTHEZOID_MODULAR_THUNDERBOLTS))
      expect(validateDefinition(def), id).toEqual([]);
    expect(SYNTHEZOID_MODULAR_THUNDERBOLTS_SKIPPED).toEqual({});
  });

  it("the data names exactly these refs for the five cards", () => {
    const refs = SET.flatMap((code) => ((dataOf(code).abilities ?? []) as { id: string }[]).map((a) => a.id));
    expect(refs.sort()).toEqual([...REFS].sort());
  });

  it("carries the printed timing of each ability", () => {
    const r = SYNTHEZOID_MODULAR_THUNDERBOLTS;
    for (const ref of ["57017", "57018", "57019"]) {
      expect(r[`${ref}.when-revealed`]!.trigger, ref).toMatchObject({ kind: "whenRevealed" });
      expect(r[`${ref}.boost`]!.trigger, ref).toMatchObject({ kind: "boost" });
    }
    expect(r["57020.when-revealed"]!.trigger).toMatchObject({ kind: "whenRevealed" });
    expect(r["57021.the-thunderbolts-constant"]!.trigger).toMatchObject({ kind: "constant" });
  });
});

describe("Atlas (57017) and Songbird (57018)", () => {
  it("are data: unique Thunderbolt minions with a star boost", () => {
    expect([dataOf(ATLAS).atk, dataOf(ATLAS).sch, dataOf(ATLAS).hp, dataOf(ATLAS).traits]).toEqual([
      2,
      1,
      4,
      [trait("GIANT"), trait("THUNDERBOLT")],
    ]);
    expect([dataOf(SONGBIRD).atk, dataOf(SONGBIRD).sch, dataOf(SONGBIRD).hp, dataOf(SONGBIRD).traits]).toEqual([
      1,
      2,
      3,
      [trait("AERIAL"), trait("THUNDERBOLT")],
    ]);
    for (const code of [ATLAS, SONGBIRD]) expect([dataOf(code).starIcon, dataOf(code).unique]).toEqual([true, true]);
  });

  it("Atlas WHEN REVEALED (no 'your leader'): you are stunned, Rhino is not, and he engages you", () => {
    const run = villainPhase(game(), [BLANK, ATLAS, FILLER_A]);
    expect(statuses(run.state, hero(run.state)).stunned).toBe(1);
    expect(statuses(run.state, villain(run.state)).stunned).toBe(0);
    expect(statuses(run.state, hero(run.state)).confused).toBe(0);
    expect(inst(run.state, inPlayCard(run.state, ATLAS)!).engagedWith).toBe(P1);
  });

  it("Songbird WHEN REVEALED: you are confused, Rhino is not", () => {
    const run = villainPhase(game(), [BLANK, SONGBIRD, FILLER_A]);
    expect(statuses(run.state, hero(run.state)).confused).toBe(1);
    expect(statuses(run.state, hero(run.state)).stunned).toBe(0);
    expect(statuses(run.state, villain(run.state)).confused).toBe(0);
  });

  it("WHEN REVEALED in a two-player game: only the revealing player takes the status", () => {
    const run = villainPhase(game([SPIDER_MAN, CAPTAIN_MARVEL]), [BLANK, BLANK_B, FILLER_A, ATLAS, FILLER_B]);
    expect(statuses(run.state, hero(run.state, P1)).stunned).toBe(0);
    expect(statuses(run.state, hero(run.state, P2)).stunned).toBe(1);
  });

  it("BOOST: the player the villain activated against is stunned (confused); the minion does not enter play", () => {
    const atlas = villainPhase(game(), [ATLAS, FILLER_A]);
    expect(statuses(atlas.state, hero(atlas.state)).stunned).toBe(1);
    expect(statuses(atlas.state, villain(atlas.state)).stunned).toBe(0);
    expect(inPlayCard(atlas.state, ATLAS)).toBeUndefined();
    const songbird = villainPhase(game(), [SONGBIRD, FILLER_A]);
    expect(statuses(songbird.state, hero(songbird.state)).confused).toBe(1);
    expect(statuses(songbird.state, villain(songbird.state)).confused).toBe(0);
  });

  it("control: a hero not boosted by either is neither stunned nor confused", () => {
    const run = villainPhase(game(), [BLANK, FILLER_A]);
    expect(statuses(run.state, hero(run.state))).toMatchObject({ stunned: 0, confused: 0 });
  });
});

describe("Penance (57019)", () => {
  it("is data: a unique Thunderbolt minion, ATK 2, SCH 2, 4 hit points, star boost", () => {
    const card = dataOf(PENANCE);
    expect([card.atk, card.sch, card.hp, card.starIcon, card.unique, card.traits]).toEqual([
      2,
      2,
      4,
      true,
      true,
      [trait("THUNDERBOLT")],
    ]);
  });

  it("WHEN REVEALED (hero alone, no 'your leader'): 2 damage to a character you control, the hero", () => {
    const control = villainPhase(game(), [BLANK, FILLER_A]);
    const run = villainPhase(game(), [BLANK, PENANCE, FILLER_A]);
    expect(damageOn(run.state, hero(run.state)) - damageOn(control.state, hero(control.state))).toBe(2);
  });

  it("WHEN REVEALED with two characters you control: the first player is asked, among the revealer characters", () => {
    const base = game([SPIDER_MAN, CAPTAIN_MARVEL]);
    const staged = stagedInPlay(base, BLACK_CAT);
    const cat = staged.id;
    // The Black Cat changes hands to P2, who reveals Penance second.
    const toP2 = {
      ...patchInstance(staged.state, cat, { controllerId: P2 }),
      players: staged.state.players.map((p) =>
        p.playerId === P1
          ? { ...p, playArea: p.playArea.filter((i) => i !== cat) }
          : { ...p, playArea: [...p.playArea, cat] },
      ),
    } as GameState;
    const asked = villainPhaseAsked(toP2, [BLANK, BLANK_B, FILLER_A, PENANCE, FILLER_B]);
    const choice = asked.pendingChoice!;
    expect(choice.prompt.kind).toBe("chooseTarget");
    expect(choice.playerId).toBe(P1);
    expect(optionIds(asked)).toEqual([cat, hero(asked, P2)].sort());
    const done = applyCommand(
      asked,
      { type: "resolveChoice", playerId: P1, choiceId: choice.choiceId, selectedOptionIds: [cat] },
      WAVE10_DEPS,
    );
    if (!done.ok) throw new Error(done.error.message);
    // The Black Cat has 1 hit point, so the 2 damage defeats her; the hero beside her is untouched.
    expect(types(done.events, "characterDefeated")).toHaveLength(1);
    expect(done.state.players.find((p) => p.playerId === P2)!.playArea).not.toContain(cat);
    expect(damageOn(done.state, hero(done.state, P2))).toBe(damageOn(asked, hero(asked, P2)));
  });

  it("BOOST: 1 damage to a character you control, not 2", () => {
    const control = villainPhase(game(), [BLANK, FILLER_A]);
    const run = villainPhase(game(), [PENANCE, FILLER_A]);
    const rhino = attacksBy(run.state, run.events, RHINO);
    expect(rhino).toHaveLength(1);
    expect(damageOn(run.state, hero(run.state))).toBe(rhino[0]!.damageDealt + 1);
    const controlRhino = attacksBy(control.state, control.events, RHINO);
    expect(damageOn(control.state, hero(control.state))).toBe(controlRhino[0]!.damageDealt);
    expect(inPlayCard(run.state, PENANCE)).toBeUndefined();
  });
});

describe("Justice Like Lightning (57020) and M8", () => {
  it("is data: a treachery with 1 boost icon", () => {
    const card = dataOf(JUSTICE);
    expect([card.type, card.boostIcons, card.starIcon]).toEqual(["treachery", 1, undefined]);
  });

  it("M8, no minion in play: the enemy leader (Rhino) activates against you and is given no boost card", () => {
    // Rhino's villain-phase boost is blank; the one-icon card behind the treachery must stay on the deck.
    const run = villainPhase(game(), [BLANK, JUSTICE, ONE_ICON, FILLER_A]);
    expect(attacksBy(run.state, run.events, RHINO)).toMatchObject([
      { baseAtk: 2, boostIcons: 0, damageDealt: 2 },
      { baseAtk: 2, boostIcons: 0, damageDealt: 2 },
    ]);
    expect(flips(run.events)).toBe(1);
    expect(codeOf(run.state, piles(run.state).deck[0]!)).toBe(ONE_ICON);
  });

  it("M8, a minion engaged with you: it activates with no boost card, and Rhino does not", () => {
    const run = villainPhase(engageMinion(game(), SHOCKER, "shocker"), [BLANK, JUSTICE, ONE_ICON, FILLER_A]);
    expect(attacksBy(run.state, run.events, RHINO)).toHaveLength(1);
    expect(attacksBy(run.state, run.events, SHOCKER)).toMatchObject([
      { baseAtk: 2, boostIcons: 0 },
      { baseAtk: 2, boostIcons: 0 },
    ]);
    expect(flips(run.events)).toBe(1);
    expect(codeOf(run.state, piles(run.state).deck[0]!)).toBe(ONE_ICON);
  });

  it("each minion activates once more, whoever it is engaged with", () => {
    const two = engageMinion(engageMinion(game(), SHOCKER, "shocker"), MERCENARY, "mercenary");
    const run = villainPhase(two, [BLANK, JUSTICE, FILLER_A]);
    expect(attacksBy(run.state, run.events, RHINO)).toHaveLength(1);
    expect(attacksBy(run.state, run.events, SHOCKER)).toHaveLength(2);
    expect(attacksBy(run.state, run.events, MERCENARY)).toHaveLength(2);
  });

  it("a minion engaged with the other player activates against that player", () => {
    const start = engageMinion(game([SPIDER_MAN, CAPTAIN_MARVEL]), SHOCKER, "shocker", P2);
    const run = villainPhase(start, [BLANK, BLANK_B, JUSTICE, FILLER_A]);
    const shocker = attacksBy(run.state, run.events, SHOCKER);
    expect(shocker).toHaveLength(2);
    expect(shocker.every((a) => a.targetInstanceId === hero(run.state, P2))).toBe(true);
  });

  it("2 players, the only minion engaged with P2, P1 reveals it: that minion hits P2 and Rhino does not activate", () => {
    const start = engageMinion(game([SPIDER_MAN, CAPTAIN_MARVEL]), SHOCKER, "shocker", P2);
    // P1 is dealt Justice Like Lightning; Rhino's own two boost cards are blank.
    const run = villainPhase(start, [BLANK, BLANK_B, JUSTICE, FILLER_A]);
    expect(attacksBy(run.state, run.events, RHINO)).toHaveLength(2);
    expect(attacksBy(run.state, run.events, SHOCKER).every((a) => a.targetInstanceId === hero(run.state, P2))).toBe(
      true,
    );
  });

  it("BOOST: 1 icon on the activating attack (Rhino ATK 2 + 1)", () => {
    const run = villainPhase(game(), [JUSTICE, FILLER_A]);
    expect(attacksBy(run.state, run.events, RHINO)).toMatchObject([{ baseAtk: 2, boostIcons: 1, damageDealt: 3 }]);
  });
});

describe("The Thunderbolts (57021)", () => {
  it("is data: a side scheme with 3 threat, 2 boost icons, a hazard icon and Hinder 1 per hero", () => {
    const card = dataOf(SCHEME);
    expect([card.type, card.startingThreat, card.boostIcons, card.icons, card.keywords]).toEqual([
      "side_scheme",
      { base: 3, perPlayer: 0 },
      2,
      ["hazard"],
      [{ name: "hinder", value: 0, perPlayer: 1 }],
    ]);
  });

  /** The scheme in play with 3 threat; a Thunderbolt minion (Atlas) is engaged with P1 when `withMinion`. */
  function schemeGame(withMinion: boolean) {
    const placed = encounterCardInVillainArea(game(), SCHEME, 3);
    if (!withMinion) return { state: placed.state, scheme: placed.id };
    return { state: engageMinion(placed.state, ATLAS, "atlas"), scheme: placed.id };
  }

  it("control: with no Thunderbolt minion in play, a thwart removes threat", () => {
    const { state, scheme } = schemeGame(false);
    const run = heroThwarts(WAVE10_DEPS, state, scheme);
    expect(inst(run.state, scheme).threat).toBeLessThan(3);
  });

  // The engine refuses a basic thwart up front only for a rule with an exception (`characterCannotRemoveThreat`,
  // "left to the removal itself" for a plain rule), so a plain rule lets the hero thwart and removes nothing. Flagged:
  // RRG "Target" (p. 43) arguably makes the scheme not a legal target.
  it("while a Thunderbolt minion is in play, a basic thwart is accepted by the engine but removes no threat", () => {
    const { state, scheme } = schemeGame(true);
    const result = applyCommand(
      state,
      { type: "basicThwart", playerId: P1, thwarterInstanceId: hero(state), schemeInstanceId: scheme },
      WAVE10_DEPS,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(inst(driveEventsPicking(WAVE10_DEPS, result.state, firstLegal).state, scheme).threat).toBe(3);
  });

  /** P1 plays Nick Fury (Core: "remove 2 threat from a scheme"), choosing that option and the side scheme. */
  const furyRemoves = (state: GameState, scheme: InstanceId) => {
    const given = moveToHand(state, P1, NICK_FURY);
    const [fury] = given.ids as [InstanceId];
    const pick: Picker = (s) => {
      const choice = s.pendingChoice!;
      if (choice.prompt.kind === "chooseTarget") return picking(scheme)(s);
      const take = choice.options.find((o) => /remove/i.test(JSON.stringify(o)));
      return take ? [take.optionId] : firstLegal(s);
    };
    return driveEventsPicking(WAVE10_DEPS, given.state, pick, play(P1, fury, payWith(given.state, P1, 4, [fury])));
  };

  it("control: Nick Fury removes 2 threat from the side scheme when no Thunderbolt minion is in play", () => {
    const { state, scheme } = schemeGame(false);
    expect(inst(furyRemoves(state, scheme).state, scheme).threat).toBe(1);
  });

  it("while a Thunderbolt minion is in play, a non-thwart removal (Nick Fury) removes no threat from it either", () => {
    const { state, scheme } = schemeGame(true);
    expect(threatCannotBeRemoved(state, WAVE10_DEPS, scheme)).toBe(true);
    expect(inst(furyRemoves(state, scheme).state, scheme).threat).toBe(3);
  });

  it("the rule flips: once the Thunderbolt minion is defeated, a thwart removes threat again", () => {
    const { state, scheme } = schemeGame(true);
    const hurt = patchInstance(state, "atlas" as InstanceId, { damage: 3 });
    const cat = stagedInPlay(hurt, BLACK_CAT);
    const killed = driveEventsPicking(WAVE10_DEPS, cat.state, firstLegal, {
      type: "basicAttack",
      playerId: P1,
      attackerInstanceId: cat.id,
      targetInstanceId: "atlas" as InstanceId,
    });
    expect(inPlayCard(killed.state, ATLAS)).toBeUndefined();
    expect(threatCannotBeRemoved(killed.state, WAVE10_DEPS, scheme)).toBe(false);
    const run = heroThwarts(WAVE10_DEPS, killed.state, scheme);
    expect(inst(run.state, scheme).threat).toBeLessThan(3);
  });

  it("a minion that is not a Thunderbolt does not hold the threat", () => {
    const { state, scheme } = schemeGame(false);
    const run = heroThwarts(WAVE10_DEPS, engageMinion(state, SHOCKER, "shocker"), scheme);
    expect(inst(run.state, scheme).threat).toBeLessThan(3);
  });
});
