/**
 * docs/phase7-wave11-scenarios.md §S3.8 (engine task E8): threat on a minion, and a minion its own constant treats as
 * an ally while that constant holds, with the real Black Cat card (`fne` 60169) in Core's Rhino scenario. The scripts
 * are this test's own; `fne/scenarios/kingpin.ts` scripts the card itself.
 *
 * 60169: "Villainous. While there is 4 threat here, treat Black Cat as an ally that takes 2 consequential damage after
 * she attacks or thwarts. Hero Action: Spend a [mental] resource → place 1 threat here. If there is 4 threat here,
 * take control of Black Cat as an ally."
 *
 * RRG 1.8 "Card Types" (p. 12): "When a player changes a minion to an ally, that player takes control of that ally."
 * RRG 1.8 "Ability" (p. 5): a "while" constant's effects "are active anytime the specific condition is met". MC60 p. 26
 * FAQ: Black Cat keeps the villainous keyword while she is an ally. RRG 1.8 "Threat" (p. 44): threat tracks the threat
 * on scheme cards, so "when threat would be placed on a scheme" does not hear threat placed on her.
 */

import { CORE_CARDS, PLAYABLE_CARDS, cardId } from "@mc/content";
import {
  activeEncounterDeck,
  applyCommand,
  categoriesOf,
  characterProfile,
  createGame,
  hasKeyword,
  traitsOf,
  type AbilityDefinition,
  type EngineDeps,
  type GameState,
  type InstanceId,
  type PlayerId,
} from "@mc/engine";
import { describe, expect, it, vi } from "vitest";
import {
  blanksTextBox,
  constant,
  heroAction,
  ifThen,
  interrupt,
  named,
  query,
  preventThreat,
  placeThreat,
  removeThreat,
  self,
  spend,
  takeControl,
  threatAtLeast,
  treatSelfAsAlly,
  when,
} from "./index.js";
import { validateDefinition } from "./validate.js";
import { coreScenario } from "../core/setup.js";
import {
  P1,
  P2,
  firstLegal,
  identityOf,
  inst,
  patchInstance,
  playerOf,
  settle,
  use,
  type Picker,
} from "../testing/harness.js";
import { driveEventsPicking, withForm } from "../testing/staging.js";
import { engageMinion, handWith } from "../wave6/mut_gen/project-wideawake-testing.js";
import { WAVE11_ABILITIES } from "../wave11/index.js";

vi.setConfig({ testTimeout: 120_000 });

const BLACK_CAT = "60169";
const CONSTANT = "60169.black-cat-constant";
const ACTION = "60169.black-cat-action";
/** Test only: "Hero Action: remove 1 threat from Black Cat", on each identity. */
const REMOVE = "test.remove-black-cat-threat";
/** Test only: "Treat the text box of each ally you control as if it were blank", on each identity. */
const BLANK_ALLIES = "test.blank-your-allies";
/** Test only: She-Hulk's "I Object" shape, "Interrupt: When threat would be placed on a scheme, prevent 1 of it". */
const OBJECT = "test.when-threat-placed-on-a-scheme";

const BLACK_CAT_ABILITIES: Record<string, AbilityDefinition> = {
  [CONSTANT]: constant(treatSelfAsAlly(threatAtLeast(self, 4), 2)),
  [ACTION]: heroAction(
    { cost: spend({ mental: 1 }) },
    placeThreat(1, self),
    ifThen(threatAtLeast(self, 4), takeControl(self)),
  ),
};
const DEPS: EngineDeps = {
  abilities: {
    ...WAVE11_ABILITIES,
    ...BLACK_CAT_ABILITIES,
    [REMOVE]: heroAction(removeThreat(1, named("Black Cat"))),
    [OBJECT]: interrupt(when.threatPlaced(), preventThreat(1)),
    [BLANK_ALLIES]: constant(blanksTextBox(query("ally", { controller: "you" }))),
  },
};

/** The test abilities added to each identity's both faces. */
function withTestAbilities(state: GameState, ids: readonly string[]): GameState {
  let pool = state.cardPool;
  for (const player of state.players) {
    const card = pool[player.identity.cardId];
    if (card?.type !== "hero_identity") continue;
    const refs = ids.map((id) => ({ id: id as never }));
    pool = {
      ...pool,
      [card.id]: {
        ...card,
        hero: { ...card.hero, abilities: [...card.hero.abilities, ...refs] },
        alterEgo: { ...card.alterEgo, abilities: [...card.alterEgo.abilities, ...refs] },
      },
    };
  }
  return { ...state, cardPool: pool };
}

/** Rhino against Spider-Man (and Captain Marvel with `players: 2`), in hero form, Black Cat engaged with `engaged`. */
function game(players = 1, engaged: PlayerId = P1, extra: readonly string[] = []) {
  const seats = [{ starterDeckId: "core-spider-man-justice" }, { starterDeckId: "core-captain-marvel-leadership" }];
  const base = coreScenario("rhino", {
    players: seats.slice(0, players),
    seed: 1,
    difficulty: "standard",
    modularSetIds: [],
    cardPool: [...CORE_CARDS, ...PLAYABLE_CARDS.filter((c) => (c.id as string) === BLACK_CAT)],
  } as never);
  const created = createGame({ ...base, encounterDeck: [...base.encounterDeck, cardId(BLACK_CAT)] }, DEPS);
  if (!created.ok) throw new Error(created.error.message);
  let s = settle(created.state, firstLegal, (st) => st.step.phase === "player", DEPS);
  for (let n = 0; n < players; n++) s = withForm(s, { heroForm: 0 }, n === 0 ? P1 : P2);
  s = withTestAbilities(s, [REMOVE, ...extra]);
  const placed = engageMinion(s, BLACK_CAT, engaged);
  return { state: placed.state, cat: placed.id };
}

/** `player` spends a card with a printed [mental] resource on Black Cat's Hero Action. */
function useAction(state: GameState, cat: InstanceId, player: PlayerId = P1, pick: Picker = firstLegal) {
  const given = handWith(state, player, "mental", 1);
  return driveEventsPicking(DEPS, given.state, pick, use(player, cat, ACTION, [{ fromHand: given.ids[0]! }]));
}
const withThreat = (state: GameState, id: InstanceId, threat: number) => patchInstance(state, id, { threat });
const playAreaOf = (state: GameState, player: PlayerId) => playerOf(state, player).playArea;

describe("the test scripts", () => {
  it.each(Object.keys(BLACK_CAT_ABILITIES))("%s validates", (id) => {
    expect(validateDefinition(BLACK_CAT_ABILITIES[id]!), id).toEqual([]);
  });
  it("`when.threatPlaced()` with no target hears only threat placed on a scheme", () => {
    expect(when.threatPlaced()).toMatchObject({ on: "placeThreat", targetIs: { categories: ["scheme"] } });
  });
});

describe("threat on a minion (Black Cat 60169)", () => {
  it("her Hero Action places 1 threat on her; below 4 she stays a minion nobody controls", () => {
    const { state, cat } = game();
    const run = useAction(withThreat(state, cat, 2), cat);
    const after = inst(run.state, cat);
    expect(after.threat).toBe(3);
    expect(after.treatedAs ?? null).toBeNull();
    expect(after.controllerId).toBeNull();
    expect(after.engagedWith).toBe(P1);
    expect(categoriesOf(run.state, cat)).toContain("minion");
    expect(run.events.some((e) => e.type === "threatPlaced" && e.schemeInstanceId === cat)).toBe(true);
  });

  it("an interrupt to threat placed on a scheme does not hear threat placed on her", () => {
    const { state, cat } = game(1, P1, [OBJECT]);
    let offered = false;
    const pick: Picker = (s) => {
      const choice = s.pendingChoice!;
      if (choice.prompt.kind === "chooseTriggers") {
        const mine = choice.options.filter((o) => o.ref.kind === "ability" && o.ref.abilityId === OBJECT);
        if (mine.length > 0) offered = true;
      }
      return firstLegal(s);
    };
    const run = useAction(withThreat(state, cat, 0), cat, P1, pick);
    expect(offered).toBe(false);
    expect(inst(run.state, cat).threat).toBe(1);
  });
});

describe("a minion treated as an ally while it holds 4 threat", () => {
  it("the 4th threat makes her the acting player's ally: in their play area, engaged with no one, text kept", () => {
    const { state, cat } = game(2, P1);
    const run = useAction(withThreat(state, cat, 3), cat, P2);
    const after = inst(run.state, cat);
    expect(after.threat).toBe(4);
    expect(after.treatedAs).toMatchObject({ kind: "ally", source: cat, controller: P2, consequential: 2 });
    expect(after.controllerId).toBe(P2);
    expect(after.engagedWith).toBeNull();
    expect(playAreaOf(run.state, P2)).toContain(cat);
    expect(playAreaOf(run.state, P1)).not.toContain(cat);
    expect(categoriesOf(run.state, cat)).toEqual(["ally", "character"]);
    // MC60 p. 26 FAQ: she keeps villainous; her printed traits stay too.
    expect(hasKeyword(run.state, cat, "villainous", DEPS)).toBe(true);
    expect(traitsOf(run.state, cat, DEPS).map(String).sort()).toEqual(["THIEF", "UNDERLING"]);
    expect(run.events.some((e) => e.type === "treatedAsChanged" && e.instanceId === cat && e.as === "ally")).toBe(true);
  });

  it("as an ally she attacks with her printed ATK and takes 2 consequential damage", () => {
    const { state, cat } = game();
    const run = useAction(withThreat(state, cat, 3), cat);
    expect(characterProfile(run.state, cat, DEPS)?.atk).toBe(1);
    const villain = run.state.activeVillainId!;
    const attacked = driveEventsPicking(DEPS, patchInstance(run.state, cat, { exhausted: false }), firstLegal, {
      type: "basicAttack",
      playerId: P1,
      attackerInstanceId: cat,
      targetInstanceId: villain,
    });
    expect(inst(attacked.state, villain).damage).toBe(1);
    expect(inst(attacked.state, cat).damage).toBe(2);
  });

  it("only her controller may use her Hero Action once she is an ally", () => {
    const { state, cat } = game(2, P1);
    const run = useAction(withThreat(state, cat, 3), cat, P1);
    const given = handWith(run.state, P2, "mental", 1);
    const refused = applyCommand(given.state, use(P2, cat, ACTION, [{ fromHand: given.ids[0]! }]), DEPS);
    expect(refused.ok).toBe(false);
    expect(!refused.ok && refused.error.message).toBe("you do not control that card");
  });

  it("threat below 4 again: a minion engaged with the player who controlled her, keeping her threat", () => {
    const { state, cat } = game(2, P1);
    const ally = useAction(withThreat(state, cat, 3), cat, P2).state;
    const run = driveEventsPicking(DEPS, ally, firstLegal, use(P1, identityOf(ally, P1), REMOVE));
    const after = inst(run.state, cat);
    expect(after.threat).toBe(3);
    expect(after.treatedAs ?? null).toBeNull();
    expect(after.controllerId).toBeNull();
    expect(after.engagedWith).toBe(P2);
    expect(categoriesOf(run.state, cat)).toContain("minion");
    expect(run.events.some((e) => e.type === "treatedAsChanged" && e.instanceId === cat && e.as === null)).toBe(true);
  });

  it("4 threat with nobody having taken control leaves her a minion (engine reading, no player changed her)", () => {
    const { state, cat } = game();
    const run = driveEventsPicking(DEPS, withThreat(state, cat, 4), firstLegal, use(P1, identityOf(state, P1), REMOVE));
    expect(inst(run.state, cat).treatedAs ?? null).toBeNull();
    // The removal took her to 3, so her own action can bring her back to 4 and take control.
    const again = useAction(run.state, cat);
    expect(inst(again.state, cat).treatedAs).toMatchObject({ kind: "ally", controller: P1 });
  });

  it("over the ally limit: P1 with three allies discards one; discarding her sends her to the encounter pile", () => {
    // RRG 1.8 "Ally Limit" (p. 7): a player who "ever" controls more allies than the limit chooses and discards.
    const { state, cat } = game();
    const allies = playerOf(state, P1)
      .deck.filter((i) => state.cardPool[inst(state, i).cardId]?.type === "ally")
      .slice(0, 3);
    expect(allies).toHaveLength(3);
    let staged: GameState = {
      ...state,
      players: state.players.map((p) =>
        p.playerId === P1
          ? { ...p, deck: p.deck.filter((i) => !allies.includes(i)), playArea: [...p.playArea, ...allies] }
          : p,
      ),
    };
    for (const id of allies) staged = patchInstance(staged, id, { faceup: true, controllerId: P1 });
    let asked: readonly string[] = [];
    const pick: Picker = (s) => {
      const choice = s.pendingChoice!;
      if (choice.prompt.kind === "discardOverAllyLimit") {
        asked = choice.options.map((o) => o.optionId);
        return [cat];
      }
      return firstLegal(s);
    };
    const run = useAction(withThreat(staged, cat, 3), cat, P1, pick);
    expect([...asked].sort()).toEqual([...allies, cat].sort());
    expect(activeEncounterDeck(run.state).discard).toContain(cat);
    const after = inst(run.state, cat);
    expect(after.treatedAs ?? null).toBeNull();
    expect(after.controllerId).toBeNull();
    expect(after.engagedWith).toBeNull();
    for (const id of allies) expect(playAreaOf(run.state, P1)).toContain(id);
  });

  it("her text box blanked: her constant no longer holds, so she is a minion engaged with her controller", () => {
    // The test blank reaches allies you control only: the moment she is P1's ally it blanks her, her own constant goes
    // with it, and she is a minion again. A minion is out of the blank's reach, but nobody has taken control of her.
    const { state, cat } = game(1, P1, [BLANK_ALLIES]);
    const run = useAction(withThreat(state, cat, 3), cat);
    const after = inst(run.state, cat);
    expect(after.threat).toBe(4);
    expect(after.treatedAs ?? null).toBeNull();
    expect(after.controllerId).toBeNull();
    expect(after.engagedWith).toBe(P1);
    const changes = run.events.flatMap((e) => (e.type === "treatedAsChanged" && e.instanceId === cat ? [e.as] : []));
    expect(changes).toEqual(["ally", null]);
  });

  it("defeated as an ally by her consequential damage: to the encounter discard, nobody's, engaged with no one", () => {
    const { state, cat } = game();
    const ally = useAction(withThreat(state, cat, 3), cat).state;
    const villain = ally.activeVillainId!;
    const run = driveEventsPicking(DEPS, patchInstance(ally, cat, { exhausted: false, damage: 5 }), firstLegal, {
      type: "basicAttack",
      playerId: P1,
      attackerInstanceId: cat,
      targetInstanceId: villain,
    });
    expect(activeEncounterDeck(run.state).discard).toContain(cat);
    expect(playAreaOf(run.state, P1)).not.toContain(cat);
    const after = inst(run.state, cat);
    expect(after.treatedAs ?? null).toBeNull();
    expect(after.controllerId).toBeNull();
    expect(after.engagedWith).toBeNull();
    expect(after.threat).toBe(0);
    expect(after.damage).toBe(0);
  });
});
