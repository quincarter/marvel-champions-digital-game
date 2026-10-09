import { WAVE8_CARDS, WAVE8_STARTER_DECKS } from "@mc/content";
import {
  applyCommand,
  characterProfile,
  createGame,
  NO_STATUSES,
  type EngineDeps,
  type GameState,
  type InstanceId,
  type PlayerId,
} from "@mc/engine";
import { describe, expect, it, vi } from "vitest";
import { coreScenario } from "../../core/setup.js";
import { mergeRegistries } from "../../dsl/index.js";
import {
  P1,
  P2,
  endTurn,
  firstLegal,
  identityOf,
  inst,
  instancesOf,
  moveToHand,
  patchInstance,
  payWith,
  play,
  playerOf,
  runWith,
  settle,
  stackEncounterDeck,
  type Picker,
} from "../../testing/harness.js";
import { driveEventsPicking, withDamage, withForm } from "../../testing/staging.js";
import { WAVE7_ABILITIES } from "../../wave7/index.js";
import { ICEMAN_ABILITIES } from "./index.js";

vi.setConfig({ testTimeout: 120_000 });

/**
 * Full QA card-text audit of the Iceman pack (2026-10-09). Real commands in a real game, Iceman's starter deck against
 * Rhino. Covers what the pack's own tests do not: Frostbite across a villain stage change and across the villain's
 * several activations in a multiplayer game, Frozen Solid on a stunned enemy and in a multiplayer game, and the
 * "identity has the X-Men trait" gate of Glob and Shadowcat on the alter-ego face (Bobby Drake is only a MUTANT).
 */
const DEPS: EngineDeps = { abilities: mergeRegistries(WAVE7_ABILITIES, ICEMAN_ABILITIES) };
const FROSTBITE = "46002";
const FREEZE = "46001a.freeze";
const ICEMAN = WAVE8_STARTER_DECKS.find((d) => d.id === "iceman-aggression")!;
const ICEMAN_SEAT = {
  identityCardId: ICEMAN.identityCardId,
  aspects: ICEMAN.aspects,
  deck: ICEMAN.cards.flatMap((c) => Array.from({ length: c.quantity }, () => c.cardId)),
};
const SPIDER_MAN = { starterDeckId: "core-spider-man-justice" } as const;

function setupGame(twoPlayers: boolean): GameState {
  const config = coreScenario("rhino", {
    players: [SPIDER_MAN],
    seed: 1,
    difficulty: "standard",
    modularSetIds: [],
    cardPool: [...WAVE8_CARDS],
  } as never);
  const second = coreScenario("rhino", { players: [SPIDER_MAN], seed: 1, modularSetIds: [] }).players[0]!;
  const created = createGame(
    {
      ...config,
      players: twoPlayers
        ? [{ identityCardId: ICEMAN_SEAT.identityCardId, aspects: ICEMAN_SEAT.aspects, deck: ICEMAN_SEAT.deck }, second]
        : [{ identityCardId: ICEMAN_SEAT.identityCardId, aspects: ICEMAN_SEAT.aspects, deck: ICEMAN_SEAT.deck }],
    },
    DEPS,
  );
  if (!created.ok) throw new Error(created.error.message);
  const settled = settle(created.state, firstLegal, (s) => s.step.phase === "player", DEPS);
  const hero = withForm(settled, { heroForm: 0 });
  return twoPlayers ? withForm(hero, { heroForm: 0 }, P2) : hero;
}

const codeOf = (s: GameState, id: InstanceId): string => s.instances[id]!.cardId as string;
const villainOf = (s: GameState): InstanceId => s.activeVillainId!;
const supply = (s: GameState, p: PlayerId = P1): number =>
  playerOf(s, p).setAside.filter((id) => codeOf(s, id) === FROSTBITE).length;
const frostbiteOn = (s: GameState, host: InstanceId): number =>
  instancesOf(s, FROSTBITE).filter((id) => inst(s, id).attachedTo === host).length;
const damageOf = (s: GameState, p: PlayerId): number => inst(s, identityOf(s, p)).damage;

/** Takes "Freeze!" when offered; declines every defense; otherwise the first legal answer. */
const takeFreezeUndefended: Picker = (s) => {
  const choice = s.pendingChoice!;
  if (choice.prompt.kind === "chooseTriggers") {
    const freeze = choice.options.find((o) => o.optionId.endsWith(FREEZE));
    return freeze ? [freeze.optionId] : firstLegal(s);
  }
  if (choice.prompt.kind === "declareDefender") return ["decline"];
  return firstLegal(s);
};
const undefended: Picker = (s) => {
  const choice = s.pendingChoice!;
  if (choice.prompt.kind === "chooseTriggers") return [];
  if (choice.prompt.kind === "declareDefender") return ["decline"];
  return firstLegal(s);
};
const attackCommand = (s: GameState, target: InstanceId) =>
  ({ type: "basicAttack", playerId: P1, attackerInstanceId: identityOf(s), targetInstanceId: target }) as const;

/** One real "Freeze!" basic attack on `target`, Iceman readied and the target's damage cleared after it. */
function freezeOnce(s: GameState, target: InstanceId): GameState {
  const { state } = driveEventsPicking(DEPS, s, takeFreezeUndefended, attackCommand(s, target));
  return patchInstance(patchInstance(state, identityOf(state), { exhausted: false }), target, { damage: 0 });
}

describe("Glob (46013) and Shadowcat (46019): play only if your identity has the X-Men trait", () => {
  // Card text: "Play only if your identity has the X-Men trait." Iceman is ICE and X-MEN; Bobby Drake is only MUTANT
  // (packages/content/src/data/iceman/cards.ts, 46001b), so neither ally may be played in alter-ego form.
  it.each([
    ["46013", 3],
    ["46019", 3],
  ])("%s: playable in hero form, refused in alter-ego form", (code, cost) => {
    const hero = moveToHand(setupGame(false), P1, code);
    const id = hero.ids[0]!;
    const heroPlay = applyCommand(hero.state, play(P1, id, payWith(hero.state, P1, cost, [id])), DEPS);
    expect(heroPlay.ok).toBe(true);
    const ego = moveToHand(withForm(setupGame(false), "alterEgo"), P1, code);
    const egoId = ego.ids[0]!;
    expect(applyCommand(ego.state, play(P1, egoId, payWith(ego.state, P1, cost, [egoId])), DEPS).ok).toBe(false);
  });
});

describe("Frostbite (46002) on the villain across a stage change and several activations", () => {
  // Spec section 3.61 test 6 and RRG 1.8 "Villain Defeat" (p. 47): a next stage with the same title keeps the upgrades.
  // Rhino stage I (14 hit points per hero) and stage II are both titled Rhino.
  it("stage I defeated by the Freeze! attack that put the copy on: the copy stays on the villain, not set aside", () => {
    const s = setupGame(false);
    const staged = withDamage(s, villainOf(s), 13);
    const { state } = driveEventsPicking(DEPS, staged, takeFreezeUndefended, attackCommand(staged, villainOf(staged)));
    expect(state.outcome).toBeNull();
    expect(frostbiteOn(state, villainOf(state))).toBe(1);
    expect(supply(state)).toBe(5);
  });

  // Spec section 3.61 test 3: "A villain that activates once per player loses it after the first."
  it("2 players: the copy weakens the villain's first activation only; the second player is attacked at full ATK", () => {
    const s = setupGame(true);
    const frozen = freezeOnce(s, villainOf(s));
    expect(frostbiteOn(frozen, villainOf(frozen))).toBe(1);
    const stacked = stackEncounterDeck(frozen, "01107", "01108", "01186", "01186");
    const first = driveEventsPicking(DEPS, stacked, undefended, endTurn(P1));
    const state = driveEventsPicking(DEPS, first.state, undefended, endTurn(P2)).state;
    // Both attacks are undefended and carry a 2-icon boost card (01107, 01108): ATK 2 - 1 + 2 = 3, then 2 + 2 = 4.
    expect(frostbiteOn(state, villainOf(state))).toBe(0);
    expect(supply(state)).toBe(6);
    expect(damageOf(state, P1)).toBe(3);
    expect(damageOf(state, P2)).toBe(4);
  });
});

describe("Frozen Solid (46007) on a stunned enemy and in a multiplayer game", () => {
  const FROZEN_SOLID = "46007";
  function solidOnVillain(s: GameState): { state: GameState; id: InstanceId } {
    const given = moveToHand(s, P1, FROZEN_SOLID);
    const id = given.ids[0]!;
    const state = settle(
      runWith(DEPS, given.state, play(P1, id, payWith(given.state, P1, 3, [id]), { attachToInstanceId: villainOf(s) })),
      firstLegal,
      undefined,
      DEPS,
    );
    return { state, id };
  }

  // Spec section 3.61 / Frozen Solid note: "A stunned or confused enemy loses that status card first (RRG p. 5) and
  // Frozen Solid stays for the next activation."
  it("a stunned villain loses the stun, Frozen Solid stays attached and no Frostbite is attached", () => {
    const { state: s, id } = solidOnVillain(setupGame(false));
    const stunned = patchInstance(s, villainOf(s), { statuses: { ...NO_STATUSES, stunned: 1 } });
    const ready = patchInstance(stunned, identityOf(stunned), { exhausted: false });
    const { state } = driveEventsPicking(DEPS, stackEncounterDeck(ready, "01107", "01108"), undefended, endTurn(P1));
    expect(inst(state, villainOf(state)).statuses.stunned).toBe(0);
    expect(inst(state, id).attachedTo).toBe(villainOf(state));
    expect(frostbiteOn(state, villainOf(state))).toBe(0);
    expect(damageOf(state, P1)).toBe(0);
  });

  it("2 players: the replaced activation is the first player's; the villain then attacks the second, weakened by the new copy", () => {
    const { state: s, id } = solidOnVillain(setupGame(true));
    const stacked = stackEncounterDeck(s, "01107", "01108", "01186", "01186");
    const first = driveEventsPicking(DEPS, stacked, undefended, endTurn(P1));
    const second = driveEventsPicking(DEPS, first.state, undefended, endTurn(P2));
    expect(playerOf(second.state, P1).discard).toContain(id);
    expect(damageOf(second.state, P1)).toBe(0);
    expect(damageOf(second.state, P2)).toBeGreaterThan(0);
    // The copy Frozen Solid attached was on the villain for the second player's attack, so it is set aside after it.
    expect(frostbiteOn(second.state, villainOf(second.state))).toBe(0);
    expect(supply(second.state)).toBe(6);
    expect(characterProfile(second.state, villainOf(second.state), DEPS)).toMatchObject({ atk: 2, sch: 1 });
  });
});
