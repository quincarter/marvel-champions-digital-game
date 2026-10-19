/**
 * docs/phase7-wave11-scenarios.md §S3.9 (engine task E9): every ally a query matches treated as a minion, with the
 * real Baron Zemo card (`fne` 60145) in Core's Rhino scenario. The scripts are this test's own;
 * `fne/scenarios/the-raft-breakout.ts` scripts the card itself.
 *
 * 60145: "Villainous. Treat each ally with threat on it as a [Deceived] minion with a blank text box. Its SCH is equal
 * to its base THW and it does not take consequential damage. When Revealed: Place 1 threat on an ally without threat on
 * it. It engages its controller."
 *
 * MC60 p. 26 FAQ: when Baron Zemo leaves play, those allies are allies again, under their owner's control, and keep
 * the threat. RRG 1.8 "Ability" (p. 5): a constant's effects "are active anytime the specific condition is met". RRG
 * 1.8 "Base Value" (p. 10): "A defined value before modifiers are applied". Ruling Dec 17, 2025 (1) #3: the change is
 * "essentially a status change"; nothing enters or leaves play.
 */

import { CORE_CARDS, PLAYABLE_CARDS, cardId, trait } from "@mc/content";
import {
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
  attachCard,
  blanksTextBox,
  cards,
  chooseTarget,
  chosen,
  constant,
  controllerOf,
  each,
  engage,
  gets,
  heroAction,
  moveCards,
  named,
  placeThreat,
  query,
  removeThreat,
  takeControl,
  threatAtLeast,
  self,
  treatAsMinion,
  treatAttachedAllyAsMinion,
  treatSelfAsAlly,
} from "./index.js";
import { validateDefinition } from "./validate.js";
import { coreScenario } from "../core/setup.js";
import { P1, P2, firstLegal, identityOf, inst, patchInstance, playerOf, settle, use } from "../testing/harness.js";
import {
  defeatWithAttack,
  driveEvents,
  driveEventsPicking,
  encounterCardInVillainArea,
  withForm,
} from "../testing/staging.js";
import { engageMinion } from "../wave6/mut_gen/project-wideawake-testing.js";
import { WAVE11_ABILITIES } from "../wave11/index.js";

vi.setConfig({ testTimeout: 120_000 });

const ZEMO = "60145";
const BLACK_CAT = "60169";
const CONVERTED = "60100";
const INFLUENCED = trait("INFLUENCED");
const DECEIVED = trait("DECEIVED");
const CONSTANT = "60145.baron-zemo-constant";
/** Test only: Zemo's When Revealed as a Hero Action on each identity, so it resolves inside one ability. */
const DECEIVE = "test.place-threat-on-an-ally-it-engages";
/** Test only: "remove 1 threat from each Deceived minion". */
const REMOVE = "test.remove-threat-from-deceived";
/** Test only: "discard Baron Zemo". */
const DISCARD = "test.discard-baron-zemo";
/** Test only: "treat Baron Zemo's text box as if it were blank". */
const BLANK = "test.blank-baron-zemo";
/** Test only, on the identity: +2 THW to each Deceived minion; a base THW of 3 for each Deceived minion. */
const PLUS_THW = "test.deceived-plus-2-thw";
const BASE_THW = "test.deceived-base-3-thw";
/** Test only: "attach Converted to an ally; attached ally engages its controller"; "discard Converted". */
const CONVERT = "test.attach-converted";
const UNCONVERT = "test.discard-converted";

const ZEMO_ABILITIES: Record<string, AbilityDefinition> = {
  [CONSTANT]: constant(treatAsMinion(query("ally", { hasThreat: true }), [DECEIVED], { schFromThw: "base" })),
};
const DEPS: EngineDeps = {
  abilities: {
    ...WAVE11_ABILITIES,
    ...ZEMO_ABILITIES,
    "60169.black-cat-constant": constant(treatSelfAsAlly(threatAtLeast(self, 4), 2)),
    "60169.black-cat-action": heroAction(placeThreat(1, self), takeControl(self)),
    [DECEIVE]: heroAction(
      chooseTarget("ally", query("ally", { hasThreat: false })),
      placeThreat(1, chosen("ally")),
      engage(chosen("ally"), controllerOf(chosen("ally"))),
    ),
    [REMOVE]: heroAction(removeThreat(1, each(query("minion", { trait: DECEIVED })))),
    [DISCARD]: heroAction(moveCards(cards(named("Baron Zemo")), "discard")),
    [BLANK]: constant(blanksTextBox(query("minion", { name: "Baron Zemo" }))),
    [PLUS_THW]: constant(gets("thw", 2, query("minion", { trait: DECEIVED }))),
    [BASE_THW]: constant(gets("thw", 3, query("minion", { trait: DECEIVED }), { setBase: true })),
    "60100.converted-constant": constant(treatAttachedAllyAsMinion([INFLUENCED], { schFromThw: "base" })),
    [CONVERT]: heroAction(
      chooseTarget("ally", query("ally")),
      attachCard(named("Converted"), chosen("ally")),
      engage(chosen("ally"), controllerOf(chosen("ally"))),
    ),
    [UNCONVERT]: heroAction(moveCards(cards(named("Converted")), "discard")),
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

/** `count` allies from `player`'s deck put into play under them. */
function alliesInPlay(state: GameState, player: PlayerId, count: number) {
  const allies = playerOf(state, player)
    .deck.filter((i) => state.cardPool[inst(state, i).cardId]?.type === "ally")
    .slice(0, count);
  expect(allies).toHaveLength(count);
  let staged: GameState = {
    ...state,
    players: state.players.map((p) =>
      p.playerId === player
        ? { ...p, deck: p.deck.filter((i) => !allies.includes(i)), playArea: [...p.playArea, ...allies] }
        : p,
    ),
  };
  for (const id of allies) staged = patchInstance(staged, id, { faceup: true, controllerId: player });
  return { state: staged, allies };
}

/** Rhino against Spider-Man (and Captain Marvel with `players: 2`), hero form, Zemo engaged with P1, 2 allies each. */
function game(players = 1, extra: readonly string[] = [], withCat = false) {
  const seats = [{ starterDeckId: "core-spider-man-justice" }, { starterDeckId: "core-captain-marvel-leadership" }];
  const codes = withCat ? [ZEMO, CONVERTED, BLACK_CAT] : [ZEMO, CONVERTED];
  const base = coreScenario("rhino", {
    players: seats.slice(0, players),
    seed: 1,
    difficulty: "standard",
    modularSetIds: [],
    cardPool: [...CORE_CARDS, ...PLAYABLE_CARDS.filter((c) => codes.includes(c.id as string))],
  } as never);
  const created = createGame({ ...base, encounterDeck: [...base.encounterDeck, ...codes.map(cardId)] }, DEPS);
  if (!created.ok) throw new Error(created.error.message);
  let s = settle(created.state, firstLegal, (st) => st.step.phase === "player", DEPS);
  for (let n = 0; n < players; n++) s = withForm(s, { heroForm: 0 }, n === 0 ? P1 : P2);
  s = withTestAbilities(s, [DECEIVE, REMOVE, DISCARD, CONVERT, UNCONVERT, ...extra]);
  s = encounterCardInVillainArea(s, CONVERTED).state;
  const placed = engageMinion(s, ZEMO, P1);
  const mine = alliesInPlay(placed.state, P1, 2);
  return { state: mine.state, zemo: placed.id, allies: mine.allies };
}

const deceive = (state: GameState, player: PlayerId = P1) =>
  driveEvents(DEPS, state, use(player, identityOf(state, player), DECEIVE));
const playAreaOf = (state: GameState, player: PlayerId) => playerOf(state, player).playArea;
const printedThw = (state: GameState, id: InstanceId): number => {
  const card = state.cardPool[inst(state, id).cardId];
  return card?.type === "ally" && typeof card.thw === "number" ? card.thw : 0;
};

describe("the builder", () => {
  it("emits a `treatAsMinion` rule with the query, traits and base THW, and validates", () => {
    const definition = ZEMO_ABILITIES[CONSTANT]!;
    expect(definition.trigger).toMatchObject({
      kind: "constant",
      rules: [
        {
          kind: "treatAsMinion",
          cards: { categories: ["ally"], hasThreat: true },
          traits: [DECEIVED],
          schFromThw: "base",
        },
      ],
    });
    expect(validateDefinition(definition)).toEqual([]);
    expect(validateDefinition(DEPS.abilities[DECEIVE]!)).toEqual([]);
  });

  it("`schFromThw` defaults to the printed THW, as the attachment form's does; the attachment form takes `base`", () => {
    expect(treatAsMinion(query("ally"), [DECEIVED]).rules![0]).toMatchObject({ schFromThw: true });
    expect(treatAttachedAllyAsMinion([DECEIVED], { schFromThw: "base" }).rules![0]).toMatchObject({
      kind: "treatHostAsMinion",
      schFromThw: "base",
    });
  });
});

describe("each ally with threat on it is a Deceived minion (Baron Zemo 60145)", () => {
  it("threat on an ally makes it a minion before the same ability's next step, so it engages its controller", () => {
    const { state, zemo, allies } = game();
    const [ally, other] = allies as [InstanceId, InstanceId];
    const run = deceive(state);
    const after = inst(run.state, ally);
    expect(after.threat).toBe(1);
    expect(after.treatedAs).toMatchObject({ kind: "minion", source: zemo, byRule: true, controllerBefore: P1 });
    expect(after.engagedWith).toBe(P1);
    expect(playAreaOf(run.state, P1)).toContain(ally);
    expect(categoriesOf(run.state, ally)).toEqual(["minion", "enemy", "character"]);
    expect(traitsOf(run.state, ally, DEPS).map(String)).toEqual(["DECEIVED"]);
    expect(run.events.some((e) => e.type === "treatedAsChanged" && e.instanceId === ally && e.as === "minion")).toBe(
      true,
    );
    // The ally without threat is untouched.
    expect(inst(run.state, other).treatedAs ?? null).toBeNull();
    expect(categoriesOf(run.state, other)).toContain("ally");
  });

  it("its SCH is its base THW: its printed THW, with no THW modifier", () => {
    const { state, allies } = game(1, [PLUS_THW]);
    const ally = allies[0]!;
    const run = deceive(state);
    expect(characterProfile(run.state, ally, DEPS)?.sch).toBe(printedThw(run.state, ally));
  });

  it("its SCH is its base THW: a base THW another card sets", () => {
    const { state, allies } = game(1, [BASE_THW]);
    const run = deceive(state);
    expect(characterProfile(run.state, allies[0]!, DEPS)?.sch).toBe(3);
  });

  it("its text box is blank: none of its printed keywords", () => {
    const { state, allies } = game();
    const ally = allies[0]!;
    const card = state.cardPool[inst(state, ally).cardId];
    const run = deceive(state);
    for (const keyword of card && "keywords" in card ? card.keywords : []) {
      expect(hasKeyword(run.state, ally, keyword.name, DEPS)).toBe(false);
    }
  });

  it("its threat removed: an ally again under P1, in P1's play area, engaged with no one", () => {
    const { state, allies } = game();
    const ally = allies[0]!;
    const minion = deceive(state).state;
    const run = driveEvents(DEPS, minion, use(P1, identityOf(minion, P1), REMOVE));
    const after = inst(run.state, ally);
    expect(after.threat).toBe(0);
    expect(after.treatedAs ?? null).toBeNull();
    expect(after.controllerId).toBe(P1);
    expect(after.engagedWith).toBeNull();
    expect(categoriesOf(run.state, ally)).toContain("ally");
    expect(run.events.some((e) => e.type === "treatedAsChanged" && e.instanceId === ally && e.as === null)).toBe(true);
  });

  it("Baron Zemo leaving play: allies again under their controller, keeping the threat (MC60 p. 26 FAQ)", () => {
    const { state, zemo, allies } = game();
    const ally = allies[0]!;
    const minion = deceive(state).state;
    const run = driveEvents(DEPS, minion, use(P1, identityOf(minion, P1), DISCARD));
    expect(playAreaOf(run.state, P1)).not.toContain(zemo);
    const after = inst(run.state, ally);
    expect(after.threat).toBe(1);
    expect(after.treatedAs ?? null).toBeNull();
    expect(after.controllerId).toBe(P1);
    expect(after.engagedWith).toBeNull();
    expect(playAreaOf(run.state, P1)).toContain(ally);
    expect(categoriesOf(run.state, ally)).toContain("ally");
  });

  it("Baron Zemo's text box blanked: his constant is gone, so they are allies again", () => {
    const { state, allies } = game(1, [BLANK]);
    const run = deceive(state);
    const after = inst(run.state, allies[0]!);
    expect(after.threat).toBe(1);
    expect(after.treatedAs ?? null).toBeNull();
    expect(after.controllerId).toBe(P1);
  });

  it("another player's ally engages that player and goes back to that player", () => {
    const { state } = game(2);
    const theirs = alliesInPlay(state, P2, 1);
    // P1's allies already hold threat, so the only ally without threat is P2's.
    let staged = theirs.state;
    for (const id of playAreaOf(staged, P1)) {
      if (staged.cardPool[inst(staged, id).cardId]?.type === "ally") staged = patchInstance(staged, id, { threat: 1 });
    }
    const run = deceive(staged);
    const ally = theirs.allies[0]!;
    expect(inst(run.state, ally).treatedAs).toMatchObject({ kind: "minion", controllerBefore: P2 });
    expect(inst(run.state, ally).engagedWith).toBe(P2);
    expect(playAreaOf(run.state, P2)).toContain(ally);
  });

  it("defeated as a Deceived minion: to its owner's discard pile, threat gone", () => {
    const { state, allies } = game();
    const ally = allies[0]!;
    const minion = deceive(state).state;
    const done = defeatWithAttack(DEPS, minion, ally);
    expect(playerOf(done, P1).discard).toContain(ally);
    expect(inst(done, ally).treatedAs ?? null).toBeNull();
    expect(inst(done, ally).threat).toBe(0);
  });

  it("a minion treated as an ally with threat on it (Black Cat) is left as it is (engine reading)", () => {
    // Its card type is minion, so the rule never looks at it. The box never puts Zemo and Kingpin's Black Cat in one
    // game (MC60 pp. 15, 23); this pins the engine reading only.
    const { state } = game(1, [], true);
    const cat = engageMinion(state, BLACK_CAT, P1);
    const run = driveEvents(
      DEPS,
      patchInstance(cat.state, cat.id, { threat: 3 }),
      use(P1, cat.id, "60169.black-cat-action"),
    );
    expect(inst(run.state, cat.id).treatedAs).toMatchObject({ kind: "ally", controller: P1 });
    expect(categoriesOf(run.state, cat.id)).toContain("ally");
  });

  it("an ally an attachment already treats as a minion is left to it; Zemo takes it once the attachment goes", () => {
    const { state, zemo, allies } = game();
    const ally = allies[0]!;
    const converted = driveEvents(DEPS, state, use(P1, identityOf(state, P1), CONVERT)).state;
    const withThreat = patchInstance(converted, ally, { threat: 1 });
    const kept = driveEvents(DEPS, withThreat, use(P1, identityOf(withThreat, P1), REMOVE)).state;
    // REMOVE reaches Deceived minions only, so the Influenced ally keeps its threat and its attachment's treatment.
    expect(inst(kept, ally).treatedAs).toMatchObject({ kind: "minion", traits: [INFLUENCED] });
    expect(inst(kept, ally).treatedAs).not.toHaveProperty("byRule");
    const run = driveEvents(DEPS, kept, use(P1, identityOf(kept, P1), UNCONVERT));
    expect(inst(run.state, ally).treatedAs).toMatchObject({ kind: "minion", source: zemo, byRule: true });
  });
});

describe('back to its owner\'s control (MC60 FAQ p. 26; RRG 1.8 "Ownership and Control", p. 31)', () => {
  /** P2's ally under P1's control, in P1's play area. */
  function borrowed() {
    const { state, zemo } = game(2);
    const theirs = alliesInPlay(state, P2, 1);
    const ally = theirs.allies[0]!;
    let staged: GameState = {
      ...theirs.state,
      players: theirs.state.players.map((p) =>
        p.playerId === P2
          ? { ...p, playArea: p.playArea.filter((i) => i !== ally) }
          : p.playerId === P1
            ? { ...p, playArea: [...p.playArea, ally] }
            : p,
      ),
    };
    staged = patchInstance(staged, ally, { controllerId: P1 });
    // Every other ally holds threat (Zemo) or is out of the way, so the chosen ally is the borrowed one.
    for (const id of playAreaOf(staged, P1)) {
      if (id !== ally && staged.cardPool[inst(staged, id).cardId]?.type === "ally") {
        staged = patchInstance(staged, id, { threat: 1 });
      }
    }
    expect(inst(staged, ally).ownerId).toBe(P2);
    return { state: staged, zemo, ally };
  }

  it("Zemo's minion: engaged with its controller, P1; Zemo leaving play returns it to its owner, P2", () => {
    const { state, ally } = borrowed();
    const minion = deceive(state).state;
    expect(inst(minion, ally).treatedAs).toMatchObject({ kind: "minion", byRule: true, controllerBefore: P1 });
    expect(inst(minion, ally).engagedWith).toBe(P1);
    const run = driveEvents(DEPS, minion, use(P1, identityOf(minion, P1), DISCARD));
    const after = inst(run.state, ally);
    expect(after.treatedAs ?? null).toBeNull();
    expect(after.controllerId).toBe(P2);
    expect(after.threat).toBe(1);
    expect(playAreaOf(run.state, P2)).toContain(ally);
    expect(playAreaOf(run.state, P1)).not.toContain(ally);
  });

  it("the attachment form (Converted): the attachment discarded returns the ally to its owner, P2", () => {
    const { state, ally } = borrowed();
    // Zemo's rule would take the other allies' threat; Converted goes on the borrowed ally (the first ally choice).
    const pickBorrowed = (s: GameState) => {
      const choice = s.pendingChoice!;
      return choice.options.some((o) => o.optionId === ally) ? [ally] : firstLegal(s);
    };
    const converted = driveEventsPicking(DEPS, state, pickBorrowed, use(P1, identityOf(state, P1), CONVERT)).state;
    expect(inst(converted, ally).treatedAs).toMatchObject({ kind: "minion", traits: [INFLUENCED] });
    expect(inst(converted, ally).engagedWith).toBe(P1);
    const run = driveEvents(DEPS, converted, use(P1, identityOf(converted, P1), UNCONVERT));
    const after = inst(run.state, ally);
    expect(after.treatedAs ?? null).toBeNull();
    expect(after.controllerId).toBe(P2);
    expect(playAreaOf(run.state, P2)).toContain(ally);
  });
});
