import {
  activeVillain,
  characterProfile,
  createGame,
  hasKeyword,
  keywordTotal,
  maxHitPoints,
  statBonus,
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
import { driveEventsPicking, encounterCardInVillainArea } from "../../testing/staging.js";
import { attachToHost } from "../../wave6/mut_gen/project-wideawake-testing.js";
import { WAVE7_DEPS, wave7Scenario } from "../index.js";
import { JUGGERNAUT } from "./juggernaut.js";
import { discard, eventResult, heroResponse, on, self, spendEqualTo } from "../../dsl/index.js";

vi.setConfig({ testTimeout: 120_000 });

const SPIDER_MAN = { starterDeckId: "core-spider-man-justice" } as const;
const CAPTAIN_MARVEL = { starterDeckId: "core-captain-marvel-leadership" } as const;
const ONE = [SPIDER_MAN] as const;
const TWO = [SPIDER_MAN, CAPTAIN_MARVEL] as const;
type Seats = readonly (typeof SPIDER_MAN | typeof CAPTAIN_MARVEL)[];

/** Standard-set boost cards that print no boost icon and no Boost ability, so an activation adds exactly its stat. */
const BLANK_BOOSTS = ["01186", "01186", "01187", "01187", "01186", "01187"] as const;

/**
 * The cards the players are dealt when a test is about something else: Building Momentum and Captive Hope are side
 * schemes, which only sit in the villain area (and Captive Hope's When Revealed is another module's).
 */
const QUIET_REVEALS = ["40124", "40131"] as const;
const stageOf = (s: GameState) => activeVillain(s).stageIndex;

interface Opts {
  readonly players?: Seats;
  readonly expert?: boolean;
}

/** Juggernaut, standard (stage I then II) or expert (II then III), past setup. */
function game(opts: Opts = {}): GameState {
  const config = wave7Scenario("juggernaut", {
    players: opts.players ?? ONE,
    seed: 1,
    difficulty: opts.expert ? "expert" : "standard",
    modularSetIds: [],
  });
  const created = createGame(config, WAVE7_DEPS);
  if (!created.ok) throw new Error(created.error.message);
  return settle(created.state, firstLegal, (s) => s.step.phase === "player", WAVE7_DEPS);
}

const nameOf = (s: GameState, id: InstanceId) => s.cardPool[s.instances[id]!.cardId]!.name;
const cardOf = (s: GameState, id: InstanceId) => s.instances[id]!.cardId as string;
const villainId = (s: GameState) => activeVillain(s).instanceId;
const mainOf = (s: GameState) => s.mainScheme.instanceId;
const helmetOf = (s: GameState) => inst(s, villainId(s)).attachments.find((id) => cardOf(s, id) === "40122a");
const attachedNames = (s: GameState) => inst(s, villainId(s)).attachments.map((id) => nameOf(s, id));
const momentum = (s: GameState) => inst(s, villainId(s)).counters.momentum ?? 0;
const tough = (s: GameState) => inst(s, villainId(s)).statuses.tough;
const withMomentum = (s: GameState, n: number) =>
  patchInstance(s, villainId(s), { counters: { ...inst(s, villainId(s)).counters, momentum: n } });
const withTough = (s: GameState, n: number) =>
  patchInstance(s, villainId(s), { statuses: { ...inst(s, villainId(s)).statuses, tough: n } });
/** The Helmet shows its Juggernaut Exposed face (surgery). */
const exposed = (s: GameState) => patchInstance(s, helmetOf(s)!, { flipped: true });
const isExposed = (s: GameState) => inst(s, helmetOf(s)!).flipped === true;
const damageOn = (s: GameState, id: InstanceId) => inst(s, id).damage;
const identityDamage = (s: GameState, player: PlayerId = P1) => damageOn(s, identityOf(s, player));
const piles = (s: GameState) => Object.values(s.encounterDecks)[0]!;
const deckNames = (s: GameState) => piles(s).deck.map((id) => nameOf(s, id));
const retaliate = (s: GameState) => keywordTotal(s, villainId(s), "retaliate", WAVE7_DEPS);
const events = <T extends GameEvent["type"]>(run: readonly GameEvent[], type: T) =>
  run.filter((e): e is Extract<GameEvent, { type: T }> => e.type === type);
const attacksBy = (run: readonly GameEvent[], enemy: InstanceId) =>
  events(run, "attackResolved").filter((e) => e.enemyInstanceId === enemy);

interface Plan {
  /** The label (start) of the option to take at a `chooseOption` prompt; the first one otherwise. */
  readonly choose?: string;
  /** Labels (start) to pick at card or target prompts, in order; the first offered otherwise. */
  readonly pick?: readonly string[];
  /** Labels (start) of the optional abilities to trigger at a `chooseTriggers` prompt; none are otherwise. */
  readonly accept?: readonly string[];
  /** The characters that defend, one per prompt in order (each only if offered); nobody otherwise. */
  readonly defenders?: readonly InstanceId[];
  /** Hand cards (by name) to spend at a `spendResources` prompt. */
  readonly pay?: readonly string[];
}
interface Run {
  readonly state: GameState;
  readonly events: readonly GameEvent[];
  readonly prompts: readonly { readonly kind: string; readonly player: PlayerId; readonly labels: readonly string[] }[];
}
function drive(state: GameState, plan: Plan, ...commands: Parameters<typeof driveEventsPicking>[3][]): Run {
  return driveWith(WAVE7_DEPS, state, plan, ...commands);
}
function driveWith(
  deps: typeof WAVE7_DEPS,
  state: GameState,
  plan: Plan,
  ...commands: Parameters<typeof driveEventsPicking>[3][]
): Run {
  const prompts: { kind: string; player: PlayerId; labels: readonly string[] }[] = [];
  const picks = [...(plan.pick ?? [])];
  const defenders = [...(plan.defenders ?? [])];
  const pick = (s: GameState): readonly string[] => {
    const choice = s.pendingChoice!;
    prompts.push({ kind: choice.prompt.kind, player: choice.playerId, labels: choice.options.map((o) => o.label) });
    switch (choice.prompt.kind) {
      case "chooseOption": {
        const hit = choice.options.find((o) => (plan.choose ? o.label.startsWith(plan.choose) : true));
        return [(hit ?? choice.options[0]!).optionId];
      }
      case "chooseTriggers":
        return choice.options
          .filter((o) => plan.accept?.some((label) => o.label.startsWith(label)))
          .map((o) => o.optionId);
      case "declareDefender": {
        const next = defenders.shift();
        return [next && choice.options.some((o) => o.optionId === next) ? next : "decline"];
      }
      case "spendResources": {
        const ids: string[] = [];
        for (const name of plan.pay ?? []) {
          const hit = choice.options.find((o) => o.label === name && !ids.includes(o.optionId));
          if (hit) ids.push(hit.optionId);
        }
        return ids.length > 0 ? ids : firstLegal(s);
      }
      default: {
        const name = picks[0];
        const hit = name ? choice.options.find((o) => o.label.startsWith(name)) : undefined;
        if (hit) {
          picks.shift();
          return [hit.optionId];
        }
        return firstLegal(s);
      }
    }
  };
  const { state: after, events: log } = driveEventsPicking(deps, state, pick, ...commands);
  return { state: after, events: log, prompts };
}

/**
 * Every player ends their turn (alter-ego form unless `hero`), and the villain phase runs. The encounter deck is
 * stacked: `boosts` blank boost cards (Juggernaut draws one per activation), then `reveals`, the cards the players are
 * dealt, in player order.
 */
function round(
  state: GameState,
  opts: {
    boosts?: number;
    /** Boost cards (printed numbers) instead of the blank ones. */
    boostCards?: readonly string[];
    reveals?: readonly string[];
    hero?: boolean;
    plan?: Plan;
  } = {},
): Run {
  const stacked = stackEncounterDeck(
    state,
    ...(opts.boostCards ?? BLANK_BOOSTS.slice(0, opts.boosts ?? state.players.length)),
    ...(opts.reveals ?? QUIET_REVEALS.slice(0, state.players.length)),
  );
  const order =
    state.step.phase === "player" && state.step.kind === "turn"
      ? [state.step.activePlayerId, ...state.step.remainingPlayerIds]
      : state.players.map((p) => p.playerId);
  const commands = order.flatMap((id) => [...(opts.hero ? [toHero(id)] : []), endTurn(id)]);
  return drive(stacked, opts.plan ?? {}, ...commands);
}
/** The first player's hero defeats the villain with a basic attack (the villain dealt lethal damage first, surgery). */
function defeatVillain(state: GameState, plan: Plan = {}): Run {
  const target = villainId(state);
  const attacker = state.players[0]!.playerId;
  const clear = { stunned: 0, confused: 0, tough: 0 };
  const armed = patchInstance(
    patchInstance(state, target, { damage: 999, statuses: clear }),
    identityOf(state, attacker),
    { statuses: clear, exhausted: false },
  );
  return drive(armed, plan, toHero(attacker), {
    type: "basicAttack",
    playerId: attacker,
    attackerInstanceId: identityOf(armed, attacker),
    targetInstanceId: target,
  });
}
/** A card the player controls in play (surgery, ready). */
function withInPlay(state: GameState, player: PlayerId, code: string): { state: GameState; id: InstanceId } {
  const owner = playerOf(state, player);
  const id = [...owner.hand, ...owner.deck].find((i) => cardOf(state, i) === code);
  if (!id) throw new Error(`${player} has no ${code}`);
  return {
    id,
    state: {
      ...state,
      players: state.players.map((p) =>
        p.playerId === player
          ? {
              ...p,
              hand: p.hand.filter((i) => i !== id),
              deck: p.deck.filter((i) => i !== id),
              playArea: [...p.playArea, id],
            }
          : p,
      ),
      instances: {
        ...state.instances,
        [id]: { ...state.instances[id]!, faceup: true, exhausted: false, controllerId: player },
      },
    },
  };
}
const inPlayNames = (s: GameState, player: PlayerId) => playerOf(s, player).playArea.map((id) => nameOf(s, id));
/** The set's own encounter card moved into the encounter discard pile / deck is whatever the scenario dealt; see `round`. */

describe("registry", () => {
  it("registers every ref of the set (Hope Summers and Captive Hope are hope-summers.ts)", () => {
    expect(Object.keys(JUGGERNAUT).sort()).toEqual(
      [
        "40121a.setup",
        "40121b.the-unstoppable-juggernaut-forced-interrupt",
        "40121b.the-unstoppable-juggernaut-constant",
        "40121b.the-unstoppable-juggernaut-constant-2",
        "40121b.the-unstoppable-juggernaut-constant-3",
        "40121b.the-unstoppable-juggernaut-constant-4",
        "40118.juggernaut-constant",
        "40118.when-revealed",
        "40119.juggernaut-constant",
        "40119.when-revealed",
        "40120.juggernaut-constant",
        "40120.when-revealed",
        "40122a.juggernauts-helmet-constant",
        "40122a.juggernauts-helmet-action",
        "40122b.juggernaut-exposed-constant",
        "40122b.juggernaut-exposed-forced-response",
        "40123.head-of-steam-constant",
        "40123.when-revealed",
        "40124.building-momentum-response",
        "40125.when-revealed",
        "40126.when-revealed",
        "40126.boost",
        "40127.when-revealed",
        "40127.boost",
        "40128.when-revealed-alter-ego",
        "40128.when-revealed-hero",
        "40128.boost",
        "40129.cyttoraks-exemplar-constant",
        "40129.when-revealed",
      ].sort(),
    );
  });
});

describe("40121a.setup and the villain's own When Revealed", () => {
  it("standard, 1 player: Stage I with the Helmet attached (Armor face), 1 momentum counter and a tough status card", () => {
    const s = game();
    expect(stageOf(s)).toBe(0);
    expect(attachedNames(s)).toEqual(["Juggernaut's Helmet"]);
    expect(isExposed(s)).toBe(false);
    expect(deckNames(s)).not.toContain("Juggernaut's Helmet");
    expect(s.encounterSetAside.map((id) => nameOf(s, id))).not.toContain("Juggernaut's Helmet");
    expect(momentum(s)).toBe(1);
    expect(tough(s)).toBe(1);
    expect(maxHitPoints(s, villainId(s), WAVE7_DEPS)).toBe(18);
    expect(statBonus(s, WAVE7_DEPS, villainId(s), "atk")).toBe(1);
  });

  it("standard, 2 players: the same, with 36 hit points", () => {
    const s = game({ players: TWO });
    expect(attachedNames(s)).toEqual(["Juggernaut's Helmet"]);
    expect(momentum(s)).toBe(1);
    expect(tough(s)).toBe(1);
    expect(maxHitPoints(s, villainId(s), WAVE7_DEPS)).toBe(36);
  });

  it("expert starts on Stage II (21 per player): the Helmet is not Exposed at setup, so a tough status card and 1 momentum counter", () => {
    const s = game({ expert: true });
    expect(stageOf(s)).toBe(1);
    expect(attachedNames(s)).toEqual(["Juggernaut's Helmet"]);
    expect(momentum(s)).toBe(1);
    expect(tough(s)).toBe(1);
    expect(maxHitPoints(s, villainId(s), WAVE7_DEPS)).toBe(21);
    expect(statBonus(s, WAVE7_DEPS, villainId(s), "atk")).toBe(1);
  });

  it("Hope Summers is put into play under the first player's control (her own Setup keyword)", () => {
    const s = game({ players: TWO });
    expect(inPlayNames(s, P1)).toContain("Hope Summers");
    expect(inPlayNames(s, P2)).not.toContain("Hope Summers");
  });
});

describe("Juggernaut I / II / III: the momentum constant", () => {
  it("40118.juggernaut-constant: +1 ATK for each momentum counter (printed 2, 1 counter: attacks for 3; 4 counters: 6)", () => {
    const one = round(game(), { hero: true });
    expect(attacksBy(one.events, villainId(one.state))[0]!.baseAtk).toBe(3);
    const four = round(withMomentum(game(), 4), { hero: true });
    expect(attacksBy(four.events, villainId(four.state))[0]!.baseAtk).toBe(6);
    expect(identityDamage(four.state)).toBe(6);
  });

  it("40119.juggernaut-constant: expert Stage II prints ATK 3 (4 with the setup counter)", () => {
    const run = round(game({ expert: true }), { hero: true });
    expect(attacksBy(run.events, villainId(run.state))[0]!.baseAtk).toBe(4);
  });

  it("40118: with no momentum counter the villain is back to its printed ATK 2", () => {
    const run = round(withMomentum(game(), 0), { hero: true });
    expect(attacksBy(run.events, villainId(run.state))[0]!.baseAtk).toBe(2);
  });
});

describe("a defeated stage: momentum counters carry over (MC40 p. 14)", () => {
  it("40119.when-revealed (standard Stage II): the counters stay and Stage II adds 1; a tough status card (no Exposed)", () => {
    const base = withMomentum(game(), 3);
    const run = defeatVillain(base);
    const s = run.state;
    expect(stageOf(s)).toBe(1);
    expect(momentum(s)).toBe(4);
    expect(tough(s)).toBe(1);
    expect(attachedNames(s)).toEqual(["Juggernaut's Helmet"]);
    expect(inst(s, villainId(s)).damage).toBe(0);
  });

  it("40119.when-revealed: with Juggernaut Exposed in play, flip it (the Helmet shows its Armor face) and no tough status card", () => {
    const base = exposed(withMomentum(game(), 0));
    const run = defeatVillain(base);
    const s = run.state;
    expect(stageOf(s)).toBe(1);
    expect(momentum(s)).toBe(1);
    expect(isExposed(s)).toBe(false);
    expect(tough(s)).toBe(0);
  });

  it("40120.when-revealed (expert Stage III): searches the encounter deck and discard pile for Head of Steam and reveals it", () => {
    const base = withMomentum(game({ expert: true }), 2);
    const run = defeatVillain(base);
    const s = run.state;
    expect(stageOf(s)).toBe(2);
    expect(attachedNames(s)).toEqual(["Juggernaut's Helmet", "Head of Steam"]);
    // 2 carried, +1 from Head of Steam's own When Revealed; Stage III's text has no counter of its own.
    expect(momentum(s)).toBe(3);
    // The Helmet shows, so no Exposed to flip: a tough status card.
    expect(tough(s)).toBe(1);
    expect(deckNames(s)).not.toContain("Head of Steam");
    expect(maxHitPoints(s, villainId(s), WAVE7_DEPS)).toBe(25);
  });

  it("40120.when-revealed: with Juggernaut Exposed in play it is flipped and no tough status card is given", () => {
    const run = defeatVillain(exposed(withMomentum(game({ expert: true }), 0)));
    const s = run.state;
    expect(stageOf(s)).toBe(2);
    expect(isExposed(s)).toBe(false);
    expect(tough(s)).toBe(0);
    expect(attachedNames(s)).toContain("Head of Steam");
  });
});

/** The threat step one is about to place completes the scheme: it holds its target (7 per player) already. */
const nearlyDone = (s: GameState, threat = 7 * s.players.length) => patchInstance(s, mainOf(s), { threat });

describe("The Unstoppable Juggernaut (40121b)", () => {
  it("1 player: removes all threat, adds 1 momentum counter, then Juggernaut attacks (4 ATK: 2 + 2 counters) before his own activation", () => {
    const run = round(nearlyDone(game()), { hero: true, boosts: 2 });
    const s = run.state;
    expect(s.mainScheme.stageIndex).toBe(0);
    expect(inst(s, mainOf(s)).threat).toBe(0);
    expect(momentum(s)).toBe(2);
    const attacks = attacksBy(run.events, villainId(s));
    expect(attacks.map((a) => a.baseAtk)).toEqual([4, 4]);
    // The attack of the interrupt comes first (the villain's own activation follows); a threat removal precedes it.
    const types = run.events.map((e) => e.type);
    expect(types.indexOf("counterAdded")).toBeLessThan(types.indexOf("attackResolved"));
    expect(identityDamage(s)).toBe(8);
  });

  it("2 players: Juggernaut attacks each player in player order, each with its own boost card, then activates twice", () => {
    const run = round(nearlyDone(game({ players: TWO })), { hero: true, boosts: 4 });
    const s = run.state;
    expect(momentum(s)).toBe(2);
    const attacks = attacksBy(run.events, villainId(s));
    expect(attacks).toHaveLength(4);
    expect(attacks.map((a) => a.targetInstanceId)).toEqual([
      identityOf(s, P1),
      identityOf(s, P2),
      identityOf(s, P1),
      identityOf(s, P2),
    ]);
    expect(attacks.every((a) => a.baseAtk === 4)).toBe(true);
    expect(events(run.events, "boostCardFlipped").filter((e) => e.enemyInstanceId === villainId(s))).toHaveLength(4);
  });

  it("the attacks are made even if the players are in alter-ego form", () => {
    const run = round(nearlyDone(game()), { boosts: 2 });
    const s = run.state;
    const attacks = attacksBy(run.events, villainId(s));
    // Alter-ego: the activation schemes; the interrupt's attack is the only attack.
    expect(attacks.map((a) => a.baseAtk)).toEqual([4]);
    expect(identityDamage(s)).toBe(4);
  });

  it("step 2: with Juggernaut Exposed in play it is flipped before the attack, so the attack is his again with overkill", () => {
    const run = round(exposed(nearlyDone(game())), { hero: true, boosts: 2 });
    expect(isExposed(run.state)).toBe(false);
    expect(momentum(run.state)).toBe(2);
  });

  it("the threat does not complete the stage twice: it stays stage 1 and the game continues", () => {
    const run = round(nearlyDone(game()), { hero: true, boosts: 2 });
    expect(run.state.outcome).toBeNull();
    expect(events(run.events, "mainSchemeAdvanced")).toEqual([]);
  });
});

describe("Juggernaut's Helmet (40122a) and Juggernaut Exposed (40122b)", () => {
  it("40122a.juggernauts-helmet-constant: Juggernaut gains stalwart", () => {
    const s = game();
    expect(hasKeyword(s, villainId(s), "stalwart", WAVE7_DEPS)).toBe(true);
    expect(hasKeyword(s, villainId(s), "stalwart", WAVE7_DEPS)).toBe(true);
  });

  it("40122a: no stalwart while Exposed shows", () => {
    const s = exposed(game());
    expect(hasKeyword(s, villainId(s), "stalwart", WAVE7_DEPS)).toBe(false);
  });
});

/** `player`'s hand is exactly these cards (printed numbers, the first copies found); the old hand goes to the deck. */
function withHand(
  state: GameState,
  player: PlayerId,
  ...codes: readonly string[]
): { state: GameState; ids: InstanceId[] } {
  const owner = playerOf(state, player);
  const ids: InstanceId[] = [];
  for (const code of codes) {
    const id = [...owner.hand, ...owner.deck].find((i) => cardOf(state, i) === code && !ids.includes(i));
    if (!id) throw new Error(`${player} has no (other) ${code}`);
    ids.push(id);
  }
  return {
    ids,
    state: {
      ...state,
      players: state.players.map((p) =>
        p.playerId === player ? { ...p, hand: ids, deck: [...p.hand, ...p.deck].filter((i) => !ids.includes(i)) } : p,
      ),
    },
  };
}
const ENHANCED_SPIDER_SENSE = "01004";
const GREAT_RESPONSIBILITY = "01061";
const SPIDER_TRACER = "01007";
const GENIUS = "01089";
const ENERGY = "01088";
const STRENGTH = "01090";
const WEB_SHOOTER = "01008";
const SWINGING_WEB_KICK = "01005";
const HELMET_ACTION = "40122a.juggernauts-helmet-action";
/** The first player in hero form with the villain's tough status cleared, ready to act. */
const ready = (s: GameState): GameState =>
  patchInstance(withTough(s, 0), identityOf(s, P1), { statuses: { stunned: 0, confused: 0, tough: 0 } });

describe("Juggernaut's Helmet: Hero Action (40122a.juggernauts-helmet-action)", () => {
  const helmetAction = (s: GameState, ids: readonly InstanceId[]) =>
    use(
      P1,
      helmetOf(s)!,
      HELMET_ACTION,
      ids.map((fromHand) => ({ fromHand })),
    );

  it("spend 3 resources of the same type: every momentum counter is removed and the Helmet flips to Juggernaut Exposed", () => {
    const { state, ids } = withHand(
      withMomentum(game(), 3),
      P1,
      ENHANCED_SPIDER_SENSE,
      ENHANCED_SPIDER_SENSE,
      GREAT_RESPONSIBILITY,
    );
    const run = drive(state, {}, toHero(P1), helmetAction(state, ids));
    const s = run.state;
    expect(momentum(s)).toBe(0);
    expect(isExposed(s)).toBe(true);
    expect(playerOf(s, P1).hand).toEqual([]);
    for (const id of ids) expect(playerOf(s, P1).discard).toContain(id);
    // The attachment stays attached (permanent; flipping is not leaving play).
    expect(attachedNames(s)).toEqual(["Juggernaut's Helmet"]);
    expect(hasKeyword(s, villainId(s), "stalwart", WAVE7_DEPS)).toBe(false);
  });

  it("the three resources must be of the same type: mental, energy and physical are refused", () => {
    const { state, ids } = withHand(withMomentum(game(), 3), P1, ENHANCED_SPIDER_SENSE, SPIDER_TRACER, WEB_SHOOTER);
    expect(() => drive(state, {}, toHero(P1), helmetAction(state, ids))).toThrow(/rejected/);
  });

  it("three resources are required: two are refused", () => {
    const { state, ids } = withHand(game(), P1, ENHANCED_SPIDER_SENSE, GREAT_RESPONSIBILITY);
    expect(() => drive(state, {}, toHero(P1), helmetAction(state, ids))).toThrow(/rejected/);
  });

  it("it is a Hero Action: refused in alter-ego form", () => {
    const { state, ids } = withHand(game(), P1, ENHANCED_SPIDER_SENSE, ENHANCED_SPIDER_SENSE, GREAT_RESPONSIBILITY);
    expect(() => drive(state, {}, helmetAction(state, ids))).toThrow(/rejected/);
  });

  it("with Juggernaut Exposed showing there is no action to use", () => {
    const base = exposed(game());
    const { state, ids } = withHand(base, P1, ENHANCED_SPIDER_SENSE, ENHANCED_SPIDER_SENSE, GREAT_RESPONSIBILITY);
    expect(() => drive(state, {}, toHero(P1), helmetAction(state, ids))).toThrow(/rejected/);
  });
});

describe("Juggernaut Exposed (40122b)", () => {
  /** Swinging Web Kick (Hero Action (attack): deal 8 damage; printed [mental] resource), paid with three other cards. */
  const kick = (base: GameState) => {
    const { state, ids } = withHand(
      ready(base),
      P1,
      SWINGING_WEB_KICK,
      GREAT_RESPONSIBILITY,
      GREAT_RESPONSIBILITY,
      ENHANCED_SPIDER_SENSE,
    );
    return drive(state, {}, toHero(P1), {
      type: "playCard",
      playerId: P1,
      cardInstanceId: ids[0]!,
      payment: ids.slice(1).map((fromHand) => ({ fromHand })),
      attachToInstanceId: null,
      targetInstanceId: villainId(state),
    } as never);
  };

  it("40122b.juggernaut-exposed-constant: an event with a printed [mental] resource deals 8 + 1 = 9; with the Helmet showing, 8", () => {
    const hurt = kick(exposed(game()));
    expect(damageOn(hurt.state, villainId(hurt.state))).toBe(9);
    const armored = kick(game());
    expect(damageOn(armored.state, villainId(armored.state))).toBe(8);
  });

  it("40122b.juggernaut-exposed-forced-response: after Juggernaut schemes, 1 momentum counter and the card flips back to the Helmet", () => {
    const run = round(exposed(withMomentum(game(), 1)));
    const s = run.state;
    expect(events(run.events, "schemeResolved").filter((e) => e.enemyInstanceId === villainId(s))).toHaveLength(1);
    expect(momentum(s)).toBe(2);
    expect(isExposed(s)).toBe(false);
    expect(hasKeyword(s, villainId(s), "stalwart", WAVE7_DEPS)).toBe(true);
  });

  it("the forced response is not heard while the Helmet shows: a scheme adds no counter", () => {
    const run = round(withMomentum(game(), 1));
    expect(momentum(run.state)).toBe(1);
    expect(isExposed(run.state)).toBe(false);
  });

  it("2 players: Juggernaut schemes twice, but Exposed flips after the first (one counter)", () => {
    const run = round(exposed(withMomentum(game({ players: TWO }), 1)));
    expect(events(run.events, "schemeResolved").filter((e) => e.enemyInstanceId === villainId(run.state))).toHaveLength(
      2,
    );
    expect(momentum(run.state)).toBe(2);
    expect(isExposed(run.state)).toBe(false);
  });
});

describe("Head of Steam (40123)", () => {
  const withSteam = (s: GameState) => attachToHost(s, "40123", villainId(s)).state;

  it("40123.when-revealed: attaches to Juggernaut and places 1 momentum counter on him", () => {
    const run = round(game(), { reveals: ["40123"] });
    const s = run.state;
    expect(attachedNames(s)).toEqual(["Juggernaut's Helmet", "Head of Steam"]);
    expect(momentum(s)).toBe(2);
    expect(piles(s).discard.map((id) => nameOf(s, id))).not.toContain("Head of Steam");
  });

  it("40123.head-of-steam-constant: Juggernaut gains retaliate X, X = momentum counters (1, then 4; 0 grants nothing)", () => {
    const base = withSteam(game());
    expect(retaliate(base)).toBe(1);
    expect(retaliate(withMomentum(base, 4))).toBe(4);
    expect(retaliate(withMomentum(base, 0))).toBe(0);
    expect(retaliate(game())).toBe(0);
  });

  it("the Helmet's action empties the counters, so retaliate falls to 0", () => {
    const base = withMomentum(withSteam(game()), 3);
    const { state, ids } = withHand(base, P1, ENHANCED_SPIDER_SENSE, ENHANCED_SPIDER_SENSE, GREAT_RESPONSIBILITY);
    const run = drive(
      state,
      {},
      toHero(P1),
      use(
        P1,
        helmetOf(state)!,
        "40122a.juggernauts-helmet-action",
        ids.map((fromHand) => ({ fromHand })),
      ),
    );
    expect(retaliate(run.state)).toBe(0);
  });

  it("retaliate X hurts the hero who attacks him: X damage back (Juggernaut at 3 counters)", () => {
    const base = ready(withMomentum(withSteam(game()), 3));
    const run = drive(base, {}, toHero(P1), {
      type: "basicAttack",
      playerId: P1,
      attackerInstanceId: identityOf(base, P1),
      targetInstanceId: villainId(base),
    });
    expect(identityDamage(run.state)).toBe(3);
  });

  it("40123.head-of-steam-response is not registered (coverage.test.ts): the printed text is not offered", () => {
    expect(JUGGERNAUT["40123.head-of-steam-response"]).toBeUndefined();
    const { state } = withHand(withSteam(withMomentum(game(), 0)), P1, GENIUS, ENERGY, STRENGTH);
    const run = round(state, { hero: true, plan: { accept: ["Head of Steam"] } });
    expect(run.prompts.filter((p) => p.labels.includes("Head of Steam"))).toEqual([]);
    expect(attachedNames(run.state)).toEqual(["Juggernaut's Helmet", "Head of Steam"]);
  });

  // ENGINE GAP, pinned: the intended script, registered here by the test, discards Head of Steam for free because
  // `AbilityCost.resourcesEqualTo` is read with `event: null` (engine `actions.ts` planCost), so "1 resource for each
  // damage dealt by that attack" is 0. Passes the day the cost can read the triggering event (then drop the test's
  // registration and script the ref; Q15 = A: a 0-damage attack costs 0 and the card may still be discarded).
  it.fails("40123.head-of-steam-response (intended): spends 1 resource per damage dealt (2 here) and discards the card", () => {
    const base = withSteam(withMomentum(game(), 0));
    const { state, ids } = withHand(base, P1, GENIUS, ENERGY, STRENGTH);
    const response = heroResponse(
      on.enemyAttacks("host", { againstYou: true }),
      { cost: spendEqualTo(eventResult("damage")) },
      discard(self),
    );
    const deps = { abilities: { ...WAVE7_DEPS.abilities, "40123.head-of-steam-response": response } };
    const stacked = stackEncounterDeck(state, ...BLANK_BOOSTS.slice(0, 1), "40124");
    const run = driveWith(
      deps,
      stacked,
      { accept: ["Head of Steam"], pay: ["Genius", "Energy"] },
      toHero(P1),
      endTurn(P1),
    );
    expect(identityDamage(run.state)).toBe(2);
    expect(attachedNames(run.state)).toEqual(["Juggernaut's Helmet"]);
    expect(playerOf(run.state, P1).discard).toEqual(expect.arrayContaining([ids[0], ids[1]]));
  });
});

describe("Juggernaut's Helmet: his attacks gain overkill; stalwart", () => {
  const BLACK_CAT = "01002";
  it("40122a.juggernauts-helmet-constant: a defending ally is defeated and the excess damage reaches the hero (overkill)", () => {
    const { state: base, id: cat } = withInPlay(withMomentum(game(), 4), P1, BLACK_CAT);
    const hp = characterProfile(base, cat, WAVE7_DEPS)!.maxHp;
    const run = round(base, { hero: true, plan: { defenders: [cat] } });
    const [attack] = attacksBy(run.events, villainId(run.state));
    expect(attack!.baseAtk).toBe(6);
    expect(attack!.targetInstanceId).toBe(cat);
    expect(playerOf(run.state, P1).discard).toContain(cat);
    expect(identityDamage(run.state)).toBe(6 - hp);
  });

  it("40122b: with Juggernaut Exposed showing his attacks do not have overkill: the ally absorbs it all", () => {
    const { state: base, id: cat } = withInPlay(exposed(withMomentum(game(), 4)), P1, BLACK_CAT);
    const run = round(base, { hero: true, plan: { defenders: [cat] } });
    expect(playerOf(run.state, P1).discard).toContain(cat);
    expect(identityDamage(run.state)).toBe(0);
  });

  it("flipping back to the Helmet gives stalwart, which discards a stunned status card: the interrupt's attack is made", () => {
    const base = exposed(nearlyDone(game()));
    const stunned = patchInstance(base, villainId(base), {
      statuses: { stunned: 1, confused: 0, tough: inst(base, villainId(base)).statuses.tough },
    });
    const run = round(stunned, { hero: true, boosts: 2 });
    expect(inst(run.state, villainId(run.state)).statuses.stunned).toBe(0);
    expect(attacksBy(run.events, villainId(run.state))).toHaveLength(2);
  });
});

describe("Building Momentum (40124)", () => {
  const BM = "40124";
  const inPlay = (s: GameState, threat = 3) => encounterCardInVillainArea(s, BM, threat);

  it("40124.building-momentum-response: after you defend against an attack from Juggernaut, remove 1 threat from it (3 per player at start)", () => {
    const { state, id } = inPlay(game());
    const run = round(state, {
      hero: true,
      reveals: ["40131"],
      plan: { defenders: [identityOf(state, P1)], accept: ["Building Momentum"] },
    });
    expect(inst(run.state, id).threat).toBe(2);
  });

  it("not offered when nobody defends (the attack is undefended) or when Hope Summers defends", () => {
    const { state, id } = inPlay(game());
    const undefended = round(state, { hero: true, reveals: ["40131"], plan: { accept: ["Building Momentum"] } });
    expect(inst(undefended.state, id).threat).toBe(3);
    expect(undefended.prompts.flatMap((p) => p.labels)).not.toContain("Building Momentum");
    const hope = playerOf(state, P1).playArea.find((i) => nameOf(state, i) === "Hope Summers")!;
    const byAlly = round(withMomentum(state, 0), {
      hero: true,
      reveals: ["40131"],
      plan: { defenders: [hope], accept: ["Building Momentum"] },
    });
    expect(inst(byAlly.state, id).threat).toBe(3);
  });

  it("2 players: each hero that defends removes 1 threat", () => {
    const { state, id } = inPlay(game({ players: TWO }), 6);
    const run = round(state, {
      hero: true,
      boostCards: ["01187", "01187"],
      reveals: ["40131", "01186"],
      plan: { defenders: [identityOf(state, P1), identityOf(state, P2)], accept: ["Building Momentum"] },
    });
    expect(inst(run.state, id).threat).toBe(4);
  });
});

/** The prompts of one kind, as `label / label` lines. */
const promptsOf = (run: Run, kind: string) => run.prompts.filter((p) => p.kind === kind).map((p) => p.labels);
const HELICARRIER = "01092";
const AUNT_MAY = "01006";
const INTERROGATION_ROOM = "01063";
const mainThreatOf = (s: GameState) => inst(s, mainOf(s)).threat;

describe("Breakthrough (40125)", () => {
  const BREAKTHROUGH = "40125";
  it("choose: take damage equal to Juggernaut's ATK (3 with 1 momentum counter)", () => {
    const { state } = withInPlay(game(), P1, HELICARRIER);
    const run = round(state, { reveals: [BREAKTHROUGH], plan: { choose: "Take damage" } });
    expect(identityDamage(run.state)).toBe(3);
    expect(inPlayNames(run.state, P1)).toContain("Helicarrier");
    expect(promptsOf(run, "chooseOption")).toEqual([
      ["Take damage equal to Juggernaut's ATK", "Discard the highest-cost upgrade or support you control"],
    ]);
  });

  it("choose: discard the highest-cost upgrade or support you control (Helicarrier 3 over Aunt May 1), no damage", () => {
    const first = withInPlay(game(), P1, AUNT_MAY);
    const { state } = withInPlay(first.state, P1, HELICARRIER);
    const run = round(state, { reveals: [BREAKTHROUGH], plan: { choose: "Discard" } });
    expect(identityDamage(run.state)).toBe(0);
    expect(inPlayNames(run.state, P1)).toContain("Aunt May");
    expect(inPlayNames(run.state, P1)).not.toContain("Helicarrier");
  });

  it("with no upgrade or support the discard option is not offered (Q8 = A): the damage is forced", () => {
    const run = round(game(), { reveals: [BREAKTHROUGH], plan: { choose: "Discard" } });
    expect(promptsOf(run, "chooseOption").flat()).not.toContain(
      "Discard the highest-cost upgrade or support you control",
    );
    expect(identityDamage(run.state)).toBe(3);
  });

  it("tied for highest cost: the player picks which one is discarded", () => {
    const first = withInPlay(game(), P1, INTERROGATION_ROOM);
    const { state } = withInPlay(first.state, P1, INTERROGATION_ROOM);
    const run = round(state, { reveals: [BREAKTHROUGH], plan: { choose: "Discard" } });
    expect(promptsOf(run, "chooseTarget").some((labels) => labels.length === 2)).toBe(true);
    expect(inPlayNames(run.state, P1).filter((n) => n === "Interrogation Room")).toHaveLength(1);
  });

  it("damage reads the modified ATK: 4 momentum counters (ATK 6) deal 6", () => {
    const run = round(withMomentum(game(), 4), { reveals: [BREAKTHROUGH], plan: { choose: "Take damage" } });
    expect(identityDamage(run.state)).toBe(6);
  });
});

describe("Flatten (40126)", () => {
  const FLATTEN = "40126";
  it("choose to take damage equal to Juggernaut's ATK (3)", () => {
    const run = round(game(), { reveals: [FLATTEN], plan: { choose: "Take damage" } });
    expect(identityDamage(run.state)).toBe(3);
    expect(momentum(run.state)).toBe(1);
  });

  it("choose to place 1 momentum counter on him: 2 counters, no damage", () => {
    const run = round(game(), { reveals: [FLATTEN], plan: { choose: "Place 1 momentum" } });
    expect(identityDamage(run.state)).toBe(0);
    expect(momentum(run.state)).toBe(2);
  });

  it("[star] Boost: gives Juggernaut a tough status card (and the 1 boost icon adds to his scheme)", () => {
    const base = withTough(game(), 0);
    const run = round(base, { boostCards: [FLATTEN] });
    expect(tough(run.state)).toBe(1);
  });
});

describe("Ground Pound (40127)", () => {
  const GROUND_POUND = "40127";
  it("1 player: indirect damage equal to Juggernaut's ATK (3)", () => {
    const run = round(game(), { reveals: [GROUND_POUND] });
    expect(identityDamage(run.state)).toBe(3);
  });

  it("2 players: the players as a group take 3 indirect damage in all (4 with 2 counters: ATK 4)", () => {
    const run = round(game({ players: TWO }), { reveals: [GROUND_POUND, "40124"] });
    const group = identityDamage(run.state, P1) + identityDamage(run.state, P2);
    const hope = playerOf(run.state, P1).playArea.find((i) => nameOf(run.state, i) === "Hope Summers")!;
    expect(group + damageOn(run.state, hope)).toBe(3);
  });

  it("[star] Boost: take 1 indirect damage", () => {
    const run = round(game(), { boostCards: [GROUND_POUND] });
    expect(identityDamage(run.state)).toBe(1);
  });
});

describe("Trample (40128)", () => {
  const TRAMPLE = "40128";
  it("Alter-Ego: take 2 indirect damage", () => {
    const run = round(game(), { reveals: [TRAMPLE] });
    expect(identityDamage(run.state)).toBe(2);
  });

  it("Hero: Juggernaut attacks the ally with the fewest remaining hit points (Black Cat damaged to 1 remaining, not Hope Summers at 3)", () => {
    const { state: staged, id: cat } = withInPlay(game(), P1, "01002");
    const hp = characterProfile(staged, cat, WAVE7_DEPS)!.maxHp;
    const state = patchInstance(staged, cat, { damage: hp - 1 });
    const run = round(state, { hero: true, reveals: [TRAMPLE] });
    const attacks = attacksBy(run.events, villainId(run.state));
    expect(attacks).toHaveLength(2);
    expect(attacks[1]!.targetInstanceId).toBe(cat);
    expect(attacks[1]!.baseAtk).toBe(3);
    expect(playerOf(run.state, P1).discard).toContain(cat);
  });

  it("Hero: with only Hope Summers as an ally, she is attacked", () => {
    const state = game();
    const hope = playerOf(state, P1).playArea.find((i) => nameOf(state, i) === "Hope Summers")!;
    const run = round(state, { hero: true, reveals: [TRAMPLE] });
    const attacks = attacksBy(run.events, villainId(run.state));
    expect(attacks[1]!.targetInstanceId).toBe(hope);
  });

  it("Hero: tied for the fewest remaining hit points, the revealing player picks", () => {
    const { state: staged, id: cat } = withInPlay(game(), P1, "01002");
    const hope = playerOf(staged, P1).playArea.find((i) => nameOf(staged, i) === "Hope Summers")!;
    const hopeRemaining = characterProfile(staged, hope, WAVE7_DEPS)!.maxHp;
    const hp = characterProfile(staged, cat, WAVE7_DEPS)!.maxHp;
    const state = patchInstance(staged, cat, { damage: hp - hopeRemaining });
    const run = round(state, { hero: true, reveals: [TRAMPLE], plan: { pick: ["Black Cat"] } });
    expect(promptsOf(run, "chooseTarget").some((labels) => labels.length === 2)).toBe(true);
    expect(attacksBy(run.events, villainId(run.state))[1]!.targetInstanceId).toBe(cat);
  });

  it("[star] Boost: deal 1 damage to an ally you control", () => {
    const { state: staged, id: cat } = withInPlay(game(), P1, "01002");
    const run = round(staged, { boostCards: [TRAMPLE], plan: { pick: ["Black Cat"] } });
    expect(damageOn(run.state, cat)).toBe(1);
  });
});

describe("Cyttorak's Exemplar (40129)", () => {
  const EXEMPLAR = "40129";
  /** The main scheme starts empty, so ATK 4 of threat cannot complete it; compared with a round that reveals a side scheme. */
  const delta = (state: GameState, hero = false) => {
    const empty = patchInstance(state, mainOf(state), { threat: 0 });
    const quiet = round(empty, { reveals: ["40124"], hero });
    const real = round(empty, { reveals: [EXEMPLAR], hero });
    return { quiet, real, threat: mainThreatOf(real.state) - mainThreatOf(quiet.state) };
  };

  it("standard: places threat on the main scheme equal to Juggernaut's ATK (3, then 4 with 2 counters)", () => {
    expect(delta(game()).threat).toBe(3);
    expect(delta(withMomentum(game(), 2)).threat).toBe(4);
  });

  it("with Juggernaut Exposed in play: flips it and places 1 momentum counter on Juggernaut, no threat", () => {
    const { real, quiet, threat } = delta(exposed(game()), true);
    expect(threat).toBe(0);
    expect(isExposed(quiet.state)).toBe(true);
    expect(momentum(quiet.state)).toBe(1);
    expect(isExposed(real.state)).toBe(false);
    expect(momentum(real.state)).toBe(2);
  });

  it("expert: gains incite 1, so 1 more threat than in standard mode (ATK 4 + 1; two players, so the scheme cannot complete)", () => {
    const expert = game({ players: TWO, expert: true });
    const empty = patchInstance(expert, mainOf(expert), { threat: 0 });
    const quiet = round(empty, { reveals: ["40124", "40131"] });
    const real = round(empty, { reveals: [EXEMPLAR, "40131"] });
    expect(mainThreatOf(real.state) - mainThreatOf(quiet.state)).toBe(5);
    const twoPlayers = game({ players: TWO });
    const standard = patchInstance(twoPlayers, mainOf(twoPlayers), { threat: 0 });
    const std = round(standard, { reveals: [EXEMPLAR, "40131"] });
    const stdQuiet = round(standard, { reveals: ["40124", "40131"] });
    expect(mainThreatOf(std.state) - mainThreatOf(stdQuiet.state)).toBe(3);
  });

  it("standard: no incite (ATK only)", () => {
    expect(delta(game()).threat).toBe(3);
  });
});
