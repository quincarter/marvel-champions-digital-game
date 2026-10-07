import {
  activeVillain,
  applyCommand,
  createGame,
  handSize,
  hasKeyword,
  maxHitPoints,
  playCostOf,
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
  moveToHand,
  patchInstance,
  putOnTopOfDeck,
  payWith,
  play,
  playerOf,
  settle,
  stackEncounterDeck,
  toHero,
  use,
} from "../../testing/harness.js";
import { driveEventsPicking, encounterCardInVillainArea, withForm } from "../../testing/staging.js";
import { attachToHost, engageMinion } from "../../wave6/mut_gen/project-wideawake-testing.js";
import { WAVE7_DEPS, wave7Scenario } from "../index.js";
import { STRYFE } from "./stryfe.js";

vi.setConfig({ testTimeout: 120_000 });

const SPIDER_MAN = { starterDeckId: "core-spider-man-justice" } as const;
const CAPTAIN_MARVEL = { starterDeckId: "core-captain-marvel-leadership" } as const;
const ONE = [SPIDER_MAN] as const;
const TWO = [SPIDER_MAN, CAPTAIN_MARVEL] as const;
type Seats = readonly (typeof SPIDER_MAN | typeof CAPTAIN_MARVEL)[];

/** Standard-set boost cards that print no boost icon and no Boost ability, so an activation adds exactly its stat. */
const BLANK_BOOSTS = ["01186", "01186", "01187", "01187", "01186", "01187"] as const;

interface Opts {
  readonly players?: Seats;
  readonly expert?: boolean;
}

/** Stryfe, standard (stage I then II) or expert (II then III), past setup. */
function game(opts: Opts = {}): GameState {
  const config = wave7Scenario("stryfe", {
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
const stageOf = (s: GameState) => activeVillain(s).stageIndex;
const mainOf = (s: GameState) => s.mainScheme.instanceId;
const piles = (s: GameState) => Object.values(s.encounterDecks)[0]!;
const deckNames = (s: GameState) => piles(s).deck.map((id) => nameOf(s, id));
const discardNames = (s: GameState) => piles(s).discard.map((id) => nameOf(s, id));
const areaIds = (s: GameState, name: string) => s.villainArea.filter((id) => nameOf(s, id) === name);
const damageOn = (s: GameState, id: InstanceId) => inst(s, id).damage;
const identityDamage = (s: GameState, player: PlayerId = P1) => damageOn(s, identityOf(s, player));
const handOf = (s: GameState, player: PlayerId = P1) => playerOf(s, player).hand;
const handNames = (s: GameState, player: PlayerId = P1) => handOf(s, player).map((id) => nameOf(s, id));
const inPlayNames = (s: GameState, player: PlayerId) => playerOf(s, player).playArea.map((id) => nameOf(s, id));
const events = <T extends GameEvent["type"]>(run: readonly GameEvent[], type: T) =>
  run.filter((e): e is Extract<GameEvent, { type: T }> => e.type === type);
const attacksBy = (run: readonly GameEvent[], enemy: InstanceId) =>
  events(run, "attackResolved").filter((e) => e.enemyInstanceId === enemy);

/** A hand's composition by printed number: Spider-Man (P1) and Captain Marvel (P2) starter cards. */
const UP3 = ["01007", "01007", "01008", "01004", "01005", "01063"] as const; // 3 upgrades, 2 events, 1 support: X = 3
const EV4 = ["01012", "01012", "01013", "01069", "01067", "01073"] as const; // 4 events, 1 ally, 1 support: X = 4

/** The player's hand is exactly these cards (the rest of it goes to the top of their deck), cut to their hand size. */
function setHand(state: GameState, player: PlayerId, codes: readonly string[]): GameState {
  const owner = playerOf(state, player);
  const cleared: GameState = {
    ...state,
    players: state.players.map((p) =>
      p.playerId === player ? { ...p, hand: [], deck: [...owner.hand, ...owner.deck] } : p,
    ),
  };
  const size = handSize(cleared, player, WAVE7_DEPS);
  return moveToHand(cleared, player, ...codes.slice(0, size)).state;
}
/** Every player in hero form (surgery), so a hand is cut to the hero's hand size and nothing is discarded at turn end. */
const heroed = (s: GameState): GameState => s.players.reduce((acc, p) => withForm(acc, { heroForm: 0 }, p.playerId), s);
const toHeroNow = (s: GameState, player: PlayerId = P1): GameState => withForm(s, { heroForm: 0 }, player);
const handOfCodes = (s: GameState, player: PlayerId = P1) => handOf(s, player).map((id) => cardOf(s, id));

/**
 * Filler cards the players are dealt when a test is about something else: Telepathic Camouflage and Cerebral Erasure
 * sit in the villain area (each does nothing to a hand with no upgrade or support in play beyond its own threat).
 */
const QUIET_REVEALS = ["40176", "40175"] as const;

interface Plan {
  /** The label (start) of the option to take at a `chooseOption` prompt; the first one otherwise. */
  readonly choose?: string;
  /** Labels (start) to pick at card or target prompts, in order; the fewest selections otherwise. */
  readonly pick?: readonly string[];
  /** Labels (start) of the optional abilities to trigger at a `chooseTriggers` prompt; none are otherwise. */
  readonly accept?: readonly string[];
  /** Only prompts of this kind are answered from `pick` (the others take the fewest selections). */
  readonly pickKind?: string;
  /** Hand cards (by name) to spend at a `spendResources` prompt. */
  readonly pay?: readonly string[];
}
interface Run {
  readonly state: GameState;
  readonly events: readonly GameEvent[];
  readonly prompts: readonly { readonly kind: string; readonly player: PlayerId; readonly labels: readonly string[] }[];
}
function drive(state: GameState, plan: Plan, ...commands: Parameters<typeof driveEventsPicking>[3][]): Run {
  const prompts: { kind: string; player: PlayerId; labels: readonly string[] }[] = [];
  const picks = [...(plan.pick ?? [])];
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
      case "payForAbility":
      case "spendResources": {
        const ids: string[] = [];
        for (const name of plan.pay ?? []) {
          const hit = choice.options.find((o) => o.label === name && !ids.includes(o.optionId));
          if (hit) ids.push(hit.optionId);
        }
        return ids.length > 0 ? ids : firstLegal(s);
      }
      case "discardDownToHandSize":
        return firstLegal(s);
      case "declareDefender": {
        const hit =
          plan.pickKind === "declareDefender"
            ? choice.options.find((o) => o.label.startsWith(picks[0] ?? "\0"))
            : undefined;
        return hit ? [hit.optionId] : ["decline"];
      }
      default: {
        if (plan.pickKind && choice.prompt.kind !== plan.pickKind) return firstLegal(s);
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
  const { state: after, events: log } = driveEventsPicking(WAVE7_DEPS, state, pick, ...commands);
  return { state: after, events: log, prompts };
}

/**
 * Every player ends their turn (alter-ego form unless `hero`), and the villain phase runs. The encounter deck is
 * stacked: `boosts` blank boost cards (Stryfe draws one per activation), then `reveals`, the cards the players are dealt.
 */
function round(
  state: GameState,
  opts: {
    boosts?: number;
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

/** The change to hero form, unless the player is a hero already (a form may change once each round). */
const heroCommand = (s: GameState, player: PlayerId) =>
  s.players.find((p) => p.playerId === player)!.identity.form === "hero" ? [] : [toHero(player)];

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
  return drive(armed, plan, ...heroCommand(armed, attacker), {
    type: "basicAttack",
    playerId: attacker,
    attackerInstanceId: identityOf(armed, attacker),
    targetInstanceId: target,
  });
}
/** A basic attack by the player's hero on `target`, which first takes `damage` (surgery). */
function attackFor(state: GameState, target: InstanceId, plan: Plan = {}, player: PlayerId = P1): Run {
  const clear = { stunned: 0, confused: 0, tough: 0 };
  const armed = patchInstance(state, identityOf(state, player), { statuses: clear, exhausted: false });
  const active = armed.step.phase === "player" && armed.step.kind === "turn" ? armed.step.activePlayerId : player;
  const form = armed.players.find((p) => p.playerId === player)!.identity.form;
  return drive(
    armed,
    plan,
    ...(active !== player ? [endTurn(active)] : []),
    ...(form === "hero" ? [] : [toHero(player)]),
    {
      type: "basicAttack",
      playerId: player,
      attackerInstanceId: identityOf(armed, player),
      targetInstanceId: target,
    },
  );
}
function thwartFor(state: GameState, scheme: InstanceId, thwarter: InstanceId, player: PlayerId = P1): Run {
  const armed = patchInstance(state, thwarter, { exhausted: false });
  const active = armed.step.phase === "player" && armed.step.kind === "turn" ? armed.step.activePlayerId : player;
  return drive(armed, {}, ...(active !== player ? [endTurn(active)] : []), ...heroCommand(armed, player), {
    type: "basicThwart",
    playerId: player,
    thwarterInstanceId: thwarter,
    schemeInstanceId: scheme,
  });
}
/** Hope Summers is controlled by the first player, so she changes hands when the first player token passes. */
const hopeOf = (s: GameState) => s.players.flatMap((p) => p.playArea).find((id) => nameOf(s, id) === "Hope Summers")!;
const graspOf = (s: GameState) => areaIds(s, "Stryfe's Grasp")[0];
const bombOf = (s: GameState) => areaIds(s, "Living Bomb")[0];
/**
 * Stage I defeated: Stryfe's Grasp flipped to Living Bomb, the main scheme on 2A and Stryfe on stage II. Stage II's When
 * Revealed gives each player a PSIONIC attachment, so the encounter deck is stacked with Mind Alteration for the first
 * player and Mind Trap for the second: attachments that change nothing a test here measures.
 */
const bombed = (s: GameState, plan: Plan = {}) =>
  defeatVillain(stackEncounterDeck(s, ...["40170", "40171"].slice(0, s.players.length)), plan).state;
const attachmentsOf = (s: GameState, id: InstanceId) => inst(s, id).attachments.map((a) => nameOf(s, a));
/** A card out of the encounter deck attached to `host` by surgery (no reveal). */
const attach = (s: GameState, code: string, host: InstanceId) => attachToHost(s, code, host);
/** A player card the player controls in play (surgery, ready). */
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

describe("registry", () => {
  it("registers every ref of the set (Hope Summers and Captive Hope are hope-summers.ts)", () => {
    expect(Object.keys(STRYFE).sort()).toEqual(
      [
        "40163.stryfe-constant",
        "40164.stryfe-constant",
        "40164.when-revealed",
        "40165.stryfe-constant",
        "40165.stryfe-forced-response",
        "40166a.setup",
        "40166b.uncontrollable-power-forced-response",
        "40167b.left-to-your-fate-constant",
        "40167b.left-to-your-fate-constant-2",
        "40168a.stryfes-grasp-constant",
        "40168a.stryfes-grasp-forced-response",
        "40168b.living-bomb-constant",
        "40168b.when-revealed",
        "40169.mental-transferal-constant",
        "40169.mental-transferal-forced-response",
        "40170.mind-alteration-forced-response",
        "40170.mind-alteration-response",
        "40171.mind-trap-constant",
        "40171.mind-trap-action",
        "40172.psionic-amnesia-constant",
        "40172.psionic-amnesia-response",
        "40173.psychic-inertia-action",
        "40174.when-defeated",
        "40175.when-revealed",
        "40175.when-defeated",
        "40176.when-revealed",
        "40177.when-revealed",
        "40178.when-revealed",
        "40178.boost",
        "40179.when-revealed",
        "40179.boost",
      ].sort(),
    );
  });
});

describe("40166a.setup: Stryfe's Grasp is revealed at setup", () => {
  it("standard, 1 player: Stage I on 1B, Stryfe's Grasp in play with 4 + 6 threat and Hope Summers under the first player", () => {
    const s = game();
    expect(stageOf(s)).toBe(0);
    expect(s.mainScheme.stageIndex).toBe(0);
    expect(s.villainArea.map((id) => nameOf(s, id))).toEqual(["Stryfe's Grasp"]);
    expect(inst(s, graspOf(s)!).threat).toBe(10);
    expect(inPlayNames(s, P1)).toContain("Hope Summers");
    expect(maxHitPoints(s, villainId(s), WAVE7_DEPS)).toBe(15);
    expect([...deckNames(s), ...s.encounterSetAside.map((id) => nameOf(s, id))]).not.toContain("Stryfe's Grasp");
  });

  it("standard, 2 players: 4 + 12 threat on the Grasp, 30 hit points, and Hope Summers under the first player only", () => {
    const s = game({ players: TWO });
    expect(inst(s, graspOf(s)!).threat).toBe(16);
    expect(maxHitPoints(s, villainId(s), WAVE7_DEPS)).toBe(30);
    expect(inPlayNames(s, P1)).toContain("Hope Summers");
    expect(inPlayNames(s, P2)).not.toContain("Hope Summers");
  });

  it("expert starts on Stage II (17 per player) with the Grasp in play and no stage I", () => {
    const s = game({ expert: true });
    expect(stageOf(s)).toBe(1);
    expect(inst(s, graspOf(s)!).threat).toBe(10);
    expect(maxHitPoints(s, villainId(s), WAVE7_DEPS)).toBe(17);
  });
});

/** The villain on stage `n` (0-based) of the game in play (surgery on the dial of stages). */
const onStage = (s: GameState, stage: number): GameState => ({
  ...s,
  villains: s.villains.map((v) => (v.instanceId === villainId(s) ? { ...v, stageIndex: stage } : v)),
});

describe("Stryfe I / II / III: +X ATK while attacking you, X the largest group of one type in your hand", () => {
  it("40163.stryfe-constant: printed ATK 0; a hand of 3 upgrades, 2 events and a support attacks for 0 + 3", () => {
    const run = round(setHand(heroed(game()), P1, UP3), {});
    expect(attacksBy(run.events, villainId(run.state))[0]!.baseAtk).toBe(3);
  });

  it("40163.stryfe-constant: a hand with five different types attacks for 0 + 1", () => {
    const mixed = setHand(heroed(game()), P1, ["01007", "01063", "01058", "01004", "01062"]);
    expect(handOfCodes(mixed)).toHaveLength(5);
    const one = round(mixed, {});
    expect(attacksBy(one.events, villainId(one.state))[0]!.baseAtk).toBe(1);
  });

  it("40163.stryfe-constant, 2 players: each attack reads the attacked player's own hand (3 for the first, 4 for the second)", () => {
    const base = setHand(setHand(heroed(game({ players: TWO })), P1, UP3), P2, EV4);
    const run = round(base, {});
    const attacks = attacksBy(run.events, villainId(run.state));
    expect(attacks.map((a) => [a.targetInstanceId, a.baseAtk])).toEqual([
      [identityOf(run.state, P1), 3],
      [identityOf(run.state, P2), 4],
    ]);
  });

  it("40163.stryfe-constant: a bonus only while he attacks: no stalwart or other grant comes with it", () => {
    const s = setHand(heroed(game()), P1, UP3);
    expect(hasKeyword(s, villainId(s), "stalwart", WAVE7_DEPS)).toBe(false);
  });

  it("40163.stryfe-constant: defended by an ally, the attack is still 'attacking you' (Q5 = A): the attacked player's hand counts", () => {
    const { state } = withInPlay(setHand(heroed(game()), P1, UP3), P1, "01058");
    const defender = playerOf(state, P1).playArea.find((id) => nameOf(state, id) === "Daredevil")!;
    const run = round(state, { plan: { pick: ["Daredevil"], pickKind: "declareDefender" } });
    const attack = attacksBy(run.events, villainId(run.state))[0]!;
    expect(attack.baseAtk).toBe(3);
    expect(attack.targetInstanceId).toBe(defender);
  });

  it("40164.stryfe-constant: Stage II prints ATK 1: 1 + 3", () => {
    const run = round(onStage(setHand(heroed(game()), P1, UP3), 1));
    expect(attacksBy(run.events, villainId(run.state))[0]!.baseAtk).toBe(4);
  });

  it("40165.stryfe-constant: Stage III prints ATK 1: 1 + 3", () => {
    const run = round(onStage(setHand(heroed(game()), P1, UP3), 2));
    expect(attacksBy(run.events, villainId(run.state))[0]!.baseAtk).toBe(4);
  });
});

describe("40164.when-revealed: each player discards until a PSIONIC attachment and reveals it", () => {
  it("standard, 1 player: Stage II reveals the first PSIONIC attachment found; what was above it is discarded", () => {
    const base = stackEncounterDeck(game(), "40177", "40175", "40170");
    const s = defeatVillain(base).state;
    expect(stageOf(s)).toBe(1);
    expect(discardNames(s)).toEqual(expect.arrayContaining(["Psionic Surge", "Cerebral Erasure"]));
    expect(discardNames(s)).not.toContain("Mind Alteration");
    expect(attachmentsOf(s, identityOf(s, P1))).toEqual(["Mind Alteration"]);
  });

  it("standard, 2 players: each player discards until their own attachment, in player order", () => {
    const base = stackEncounterDeck(game({ players: TWO }), "40177", "40170", "40175", "40171");
    const s = defeatVillain(base).state;
    expect(attachmentsOf(s, identityOf(s, P1))).toEqual(["Mind Alteration"]);
    expect(attachmentsOf(s, identityOf(s, P2))).toEqual(["Mind Trap"]);
    expect(discardNames(s)).toEqual(expect.arrayContaining(["Psionic Surge", "Cerebral Erasure"]));
  });

  it("expert: setup resolves Stage II's When Revealed, so every player starts with a PSIONIC attachment", () => {
    const s = game({ expert: true, players: TWO });
    for (const player of [P1, P2]) {
      const attached = [identityOf(s, player), ...(player === P1 ? [hopeOf(s)] : [])].flatMap((id) =>
        attachmentsOf(s, id),
      );
      expect(attached.length, player).toBeGreaterThanOrEqual(1);
    }
    const psionic = ["Mental Transferal", "Mind Alteration", "Mind Trap", "Psionic Amnesia", "Psychic Inertia"];
    const all = [identityOf(s, P1), identityOf(s, P2), hopeOf(s)].flatMap((id) => attachmentsOf(s, id));
    expect(all.filter((n) => psionic.includes(n))).toHaveLength(2);
    // Stryfe's Grasp is already in play at setup, so a Mental Transferal went to Hope Summers, never to an identity.
    expect(attachmentsOf(s, identityOf(s, P1))).not.toContain("Mental Transferal");
    expect(attachmentsOf(s, identityOf(s, P2))).not.toContain("Mental Transferal");
  });
});

describe("40165.stryfe-forced-response: after you attack Stryfe, take X damage", () => {
  const stageIII = (opts: Opts = {}) => onStage(game(opts), 2);

  it("1 player: a hero attack on Stryfe III with a hand of 3 upgrades, 2 events: the attacker takes 3", () => {
    const s = setHand(heroed(stageIII()), P1, UP3);
    const run = attackFor(s, villainId(s));
    expect(identityDamage(run.state)).toBe(3);
    expect(damageOn(run.state, villainId(s))).toBeGreaterThan(0);
  });

  it("2 players: the attacking player takes damage by their own hand (4), the other none", () => {
    const s = setHand(setHand(heroed(stageIII({ players: TWO })), P1, UP3), P2, EV4);
    const run = attackFor(s, villainId(s), {}, P2);
    expect(identityDamage(run.state, P2)).toBe(4);
    expect(identityDamage(run.state, P1)).toBe(0);
  });

  it("an ally's attack is not 'you': no damage to the player", () => {
    const base = setHand(heroed(stageIII()), P1, UP3);
    const { state: withAlly, id: ally } = withInPlay(base, P1, "01058");
    const run = drive(
      withAlly,
      {},
      {
        type: "basicAttack",
        playerId: P1,
        attackerInstanceId: ally,
        targetInstanceId: villainId(withAlly),
      },
    );
    expect(damageOn(run.state, villainId(withAlly))).toBeGreaterThan(0);
    expect(identityDamage(run.state)).toBe(0);
  });

  it("Stage I and II have no such response: the attacker takes nothing", () => {
    const s = setHand(heroed(game()), P1, UP3);
    expect(identityDamage(attackFor(s, villainId(s)).state)).toBe(0);
  });
});

/**
 * Hope Summers' own stats are `hope-summers.ts` (a constant "base THW and ATK equal to your hero's"); until that module
 * is scripted her printed '-' ATK and THW cannot attack or thwart at all, so these tests print her 2 and 2 themselves.
 */
const withHopeStats = (s: GameState): GameState => {
  const code = cardOf(s, hopeOf(s));
  const printed = s.cardPool[code as keyof typeof s.cardPool] as unknown as Record<string, unknown>;
  return {
    ...s,
    cardPool: { ...s.cardPool, [code]: { ...printed, atk: 2, thw: 2 } } as unknown as GameState["cardPool"],
  };
};
/** Whether the command is accepted as it stands. */
const accepted = (state: GameState, command: Parameters<typeof applyCommand>[1]) =>
  applyCommand(state, command, WAVE7_DEPS).ok;
const hopeAttack = (s: GameState, target: InstanceId) =>
  ({ type: "basicAttack", playerId: P1, attackerInstanceId: hopeOf(s), targetInstanceId: target }) as const;
const hopeThwart = (s: GameState, scheme: InstanceId) =>
  ({ type: "basicThwart", playerId: P1, thwarterInstanceId: hopeOf(s), schemeInstanceId: scheme }) as const;

describe("40168a.stryfes-grasp-constant: Hope Summers attacks only Stryfe and thwarts only this scheme", () => {
  it("she can attack Stryfe but not a minion, and thwart Stryfe's Grasp but not another side scheme", () => {
    const { state: withZero, id: zero } = engageMinion(game({ players: TWO }), "40174", P2);
    const { state: base, id: camouflage } = encounterCardInVillainArea(withZero, "40176", 2);
    const s = withHopeStats(toHeroNow(base));
    expect(accepted(s, hopeAttack(s, villainId(s)))).toBe(true);
    expect(accepted(s, hopeAttack(s, zero))).toBe(false);
    expect(accepted(s, hopeThwart(s, graspOf(s)!))).toBe(true);
    expect(accepted(s, hopeThwart(s, camouflage))).toBe(false);
  });

  it("the restriction is Hope Summers' alone: the player's hero attacks the minion and thwarts the other side scheme", () => {
    const { state: withZero, id: zero } = engageMinion(game({ players: TWO }), "40174", P2);
    const { state: base, id: camouflage } = encounterCardInVillainArea(withZero, "40176", 2);
    const s = toHeroNow(base);
    const hero = identityOf(s, P1);
    expect(accepted(s, { type: "basicAttack", playerId: P1, attackerInstanceId: hero, targetInstanceId: zero })).toBe(
      true,
    );
    expect(
      accepted(s, { type: "basicThwart", playerId: P1, thwarterInstanceId: hero, schemeInstanceId: camouflage }),
    ).toBe(true);
  });

  it("Living Bomb does not print it: after the flip she attacks the minion and thwarts another side scheme", () => {
    const { state: withZero, id: zero } = engageMinion(bombed(game({ players: TWO })), "40174", P2);
    const { state: base, id: camouflage } = encounterCardInVillainArea(withZero, "40176", 2);
    const s = withHopeStats(toHeroNow(base));
    expect(accepted(s, hopeAttack(s, zero))).toBe(true);
    expect(accepted(s, hopeThwart(s, camouflage))).toBe(true);
  });
});

describe("40168a.stryfes-grasp-forced-response and Living Bomb (40168b)", () => {
  it("Stryfe defeated: the Grasp flips to Living Bomb with the Grasp's 10 threat plus its own 3, and the main scheme advances to 2A", () => {
    const s = bombed(game());
    expect(graspOf(s)).toBeUndefined();
    expect(inst(s, bombOf(s)!).threat).toBe(13);
    expect(s.mainScheme.stageIndex).toBe(1);
    expect(stageOf(s)).toBe(1);
    expect(s.outcome).toBeNull();
  });

  it("2 players: 16 + 3 = 19 threat on Living Bomb", () => {
    const s = bombed(game({ players: TWO }));
    expect(inst(s, bombOf(s)!).threat).toBe(19);
    expect(s.mainScheme.stageIndex).toBe(1);
  });

  it("the last threat removed from the Grasp flips it too: 3 threat (nothing to carry) and Stryfe is not defeated", () => {
    const s = game();
    const nearly = patchInstance(s, graspOf(s)!, { threat: 1 });
    const run = thwartFor(nearly, graspOf(nearly)!, identityOf(nearly, P1));
    const after = run.state;
    expect(graspOf(after)).toBeUndefined();
    expect(inst(after, bombOf(after)!).threat).toBe(3);
    expect(after.mainScheme.stageIndex).toBe(1);
    expect(stageOf(after)).toBe(0);
    expect(damageOn(after, villainId(after))).toBe(0);
  });

  it("threat removed from the Grasp that leaves some does not flip it", () => {
    const s = game();
    const run = thwartFor(s, graspOf(s)!, identityOf(s, P1));
    expect(graspOf(run.state)).toBe(graspOf(s));
    expect(inst(run.state, graspOf(s)!).threat).toBeLessThan(10);
    expect(s.mainScheme.stageIndex).toBe(0);
    expect(run.state.mainScheme.stageIndex).toBe(0);
  });

  // One ability with two triggering conditions (`on.either`): the response is initiated only when one of them is met.
  it("a removal that leaves threat on the Grasp offers nothing: the forced response does not resolve (0 times; the emptying removal and Stryfe's defeat resolve it once each)", () => {
    const graspResponses = (run: Run) =>
      events(run.events, "abilityResolved").filter((e) => e.abilityId === "40168a.stryfes-grasp-forced-response")
        .length;
    const s = patchInstance(game(), graspOf(game())!, { threat: 10 });
    const partial = thwartFor(s, graspOf(s)!, identityOf(s, P1));
    const left = inst(partial.state, graspOf(s)!).threat;
    expect(left).toBe(9);
    expect(graspResponses(partial)).toBe(0);
    expect(partial.prompts.filter((p) => p.kind === "chooseTriggers")).toEqual([]);
    expect(bombOf(partial.state)).toBeUndefined();

    const nearly = patchInstance(s, graspOf(s)!, { threat: 1 });
    expect(graspResponses(thwartFor(nearly, graspOf(nearly)!, identityOf(nearly, P1)))).toBe(1);
    const defeated = defeatVillain(stackEncounterDeck(s, "40170"));
    expect(graspResponses(defeated)).toBe(1);
  });

  it("Stryfe takes damage that does not defeat him: the Grasp stays", () => {
    const s = game();
    const run = attackFor(s, villainId(s));
    expect(damageOn(run.state, villainId(s))).toBeGreaterThan(0);
    expect(graspOf(run.state)).toBe(graspOf(s));
  });

  it("40168b.living-bomb-constant: Stryfe cannot be defeated while Living Bomb is in play (damage past his hit points leaves him on stage II)", () => {
    const s = bombed(game());
    const run = defeatVillain(s);
    expect(stageOf(run.state)).toBe(1);
    expect(run.state.outcome).toBeNull();
    expect(damageOn(run.state, villainId(run.state))).toBeGreaterThanOrEqual(17);
  });

  it("Living Bomb defeated (Victory 1 into the victory display): the rule ends and Stryfe, at 0 hit points, is defeated at once (Q21 = A)", () => {
    const s0 = bombed(game());
    const stuck = defeatVillain(s0).state;
    expect(stuck.outcome).toBeNull();
    const nearly = patchInstance(stuck, bombOf(stuck)!, { threat: 1 });
    const run = thwartFor(nearly, bombOf(nearly)!, identityOf(nearly, P1));
    expect(run.state.victoryDisplay.map((id) => nameOf(run.state, id))).toContain("Living Bomb");
    // Stage II is the last stage in a standard game: its defeat wins.
    expect(run.state.outcome?.result).toBe("win");
    expect(run.events.map((e) => e.type)).toContain("characterDefeated");
  });
});

const mainThreatOf = (s: GameState) => inst(s, mainOf(s)).threat;

describe("40166b.uncontrollable-power-forced-response: each player places X threat here", () => {
  it("1 player, no discard: 3 for a hand of 3 upgrades, 2 events and a support", () => {
    const run = round(setHand(game(), P1, UP3));
    // Step one places nothing (acceleration 0); the 1 more is Stryfe's own scheme in alter-ego form (SCH 1).
    expect(mainThreatOf(run.state)).toBe(1 + 3);
    expect(run.prompts.filter((p) => p.kind === "chooseCards").map((p) => p.player)).toEqual([P1]);
  });

  it("1 player, discarding 1 card first: a Spider-Tracer goes to the discard pile and X falls to 2", () => {
    const run = round(setHand(game(), P1, UP3), { plan: { pick: ["Spider-Tracer"] } });
    expect(mainThreatOf(run.state)).toBe(1 + 2);
    expect(playerOf(run.state, P1).discard.map((id) => nameOf(run.state, id))).toContain("Spider-Tracer");
  });

  it("2 players: each reads their own hand, in player order (3 and 4 threat)", () => {
    const run = round(setHand(setHand(game({ players: TWO }), P1, UP3), P2, EV4));
    expect(mainThreatOf(run.state)).toBe(2 + 3 + 4);
    expect(run.prompts.filter((p) => p.kind === "chooseCards").map((p) => p.player)).toEqual([P1, P2]);
  });

  it("2 players, each discarding first: X is 2 for the first player (a Spider-Tracer) and 3 for the second (a Photonic Blast)", () => {
    const run = round(setHand(setHand(game({ players: TWO }), P1, UP3), P2, EV4), {
      plan: { pick: ["Spider-Tracer", "Photonic Blast"] },
    });
    expect(mainThreatOf(run.state)).toBe(2 + 2 + 3);
  });

  it("completing the stage this way loses the game ('If this stage is completed, the players lose the game')", () => {
    const base = patchInstance(setHand(game(), P1, UP3), mainOf(game()), { threat: 5 });
    const s = patchInstance(setHand(game(), P1, UP3), mainOf(game()), { threat: 5 });
    expect(base.outcome).toBeNull();
    const run = round(s);
    expect(run.state.outcome).toMatchObject({ result: "loss", reason: "mainSchemeCompleted" });
  });
});

describe("Left to Your Fate (2B, reached through Living Bomb)", () => {
  const costs = (s: GameState, player: PlayerId, codes: readonly string[]) => {
    const moved = moveToHand(s, player, ...codes);
    return moved.ids.map((id) => playCostOf(moved.state, player, id, WAVE7_DEPS)?.current ?? null);
  };
  const CARDS = ["01007", "01063", "01058", "01004", "01062"] as const; // upgrade, support, ally, event, resource (printed 1, 1, 4, 1, none)

  it("40167b.left-to-your-fate-constant: Stryfe gains stalwart, which he did not have before", () => {
    const before = game();
    const after = bombed(before);
    expect(hasKeyword(before, villainId(before), "stalwart", WAVE7_DEPS)).toBe(false);
    expect(hasKeyword(after, villainId(after), "stalwart", WAVE7_DEPS)).toBe(true);
  });

  it("40167b.left-to-your-fate-constant-2: each identity gets +2 hand size (both players with 2 players)", () => {
    const before = heroed(game({ players: TWO }));
    const after = bombed(before);
    for (const player of [P1, P2])
      expect(handSize(after, player, WAVE7_DEPS), player).toBe(handSize(before, player, WAVE7_DEPS) + 2);
  });

  it("40167b.left-to-your-fate-constant-2: each player card costs 1 more to play (ally, event, support, upgrade; a resource has no cost)", () => {
    const before = heroed(game());
    const after = bombed(before);
    const was = costs(before, P1, CARDS);
    const now = costs(after, P1, CARDS);
    expect(was).toEqual([1, 1, 4, 1, null]);
    expect(now).toEqual([2, 2, 5, 2, null]);
  });

  it("2 players: the increase is for the second player's cards too", () => {
    const before = game({ players: TWO });
    const after = bombed(before);
    expect(costs(after, P2, ["01012", "01067"])).toEqual(costs(before, P2, ["01012", "01067"]).map((c) => c! + 1));
  });

  it("completing 2B (8 threat per player) loses the game, as stage 1B does", () => {
    const s = patchInstance(bombed(game()), mainOf(bombed(game())), { threat: 7 });
    const run = round(s);
    expect(run.state.outcome).toMatchObject({ result: "loss", reason: "mainSchemeCompleted" });
  });
});

const activePlayer = (s: GameState): PlayerId =>
  s.step.phase === "player" && s.step.kind === "turn" ? s.step.activePlayerId : P1;
/** Resource cards (1 each) a player can pay with, kept beside the card played. */
const RESOURCES = (player: PlayerId) => [player === P1 ? "01062" : "01072", "01088", "01089", "01090"];
/**
 * The player plays `code` from a hand of it and four resource cards, paying its current cost with them. `host` is what
 * an upgrade attaches to. Answers prompts as `plan` says.
 */
function playFromHand(
  state: GameState,
  player: PlayerId,
  code: string,
  opts: { host?: InstanceId; plan?: Plan } = {},
): { run: Run; id: InstanceId } {
  const stocked = setHand(state, player, [code, ...RESOURCES(player)]);
  const id = handOf(stocked, player).find((i) => cardOf(stocked, i) === code)!;
  const cost = playCostOf(stocked, player, id, WAVE7_DEPS)?.current ?? 0;
  const run = drive(
    stocked,
    opts.plan ?? {},
    ...(activePlayer(stocked) !== player ? [endTurn(activePlayer(stocked))] : []),
    ...heroCommand(stocked, player),
    play(player, id, payWith(stocked, player, cost, [id]), opts.host ? { attachToInstanceId: opts.host } : {}),
  );
  return { run, id };
}

describe("Mental Transferal (40169)", () => {
  it("40169.mental-transferal-constant: with Stryfe's Grasp in play it attaches to Hope Summers, not to the revealing player", () => {
    const base = game();
    const run = round(base, { reveals: ["40169", "40176"] });
    expect(attachmentsOf(run.state, hopeOf(run.state))).toEqual(["Mental Transferal"]);
    expect(attachmentsOf(run.state, identityOf(run.state, P1))).toEqual([]);
  });

  it("2 players: a card the second player reveals goes to Hope Summers (the first player's) all the same", () => {
    const run = round(game({ players: TWO }), { reveals: ["40176", "40169"] });
    expect(attachmentsOf(run.state, hopeOf(run.state))).toEqual(["Mental Transferal"]);
    expect(attachmentsOf(run.state, identityOf(run.state, P2))).toEqual([]);
  });

  it("without Stryfe's Grasp (it shows Living Bomb) it attaches to the revealing player's identity", () => {
    const base = bombed(game());
    expect(nameOf(base, bombOf(base)!)).toBe("Living Bomb");
    const run = round(base, { reveals: ["40169", "40176"] });
    expect(attachmentsOf(run.state, identityOf(run.state, P1))).toEqual(["Mind Alteration", "Mental Transferal"]);
    expect(attachmentsOf(run.state, hopeOf(run.state))).toEqual([]);
  });

  it("2 players, Living Bomb showing: each player's own reveal attaches to that player's identity", () => {
    const run = round(bombed(game({ players: TWO })), { reveals: ["40176", "40169"] });
    expect(attachmentsOf(run.state, identityOf(run.state, P2))).toEqual(["Mind Trap", "Mental Transferal"]);
    expect(attachmentsOf(run.state, hopeOf(run.state))).toEqual([]);
  });

  it("40169.mental-transferal-forced-response: damage Stryfe takes is dealt to Hope Summers as well, and the card is discarded", () => {
    const base = game();
    const { state: s } = attach(base, "40169", hopeOf(base));
    const run = attackFor(s, villainId(s));
    const dealt = damageOn(run.state, villainId(s));
    expect(dealt).toBeGreaterThan(0);
    expect(damageOn(run.state, hopeOf(s))).toBe(dealt);
    expect(attachmentsOf(run.state, hopeOf(s))).toEqual([]);
    expect(discardNames(run.state)).toContain("Mental Transferal");
  });

  it("attached to the identity (Living Bomb showing) it deals the damage Stryfe took to that identity", () => {
    const base = bombed(game());
    const { state: s } = attach(base, "40169", identityOf(base, P1));
    const before = identityDamage(s);
    const run = attackFor(s, villainId(s));
    expect(identityDamage(run.state) - before).toBeGreaterThan(0);
    expect(attachmentsOf(run.state, identityOf(s, P1))).toEqual(["Mind Alteration"]);
    expect(discardNames(run.state)).toContain("Mental Transferal");
  });

  it("revealed by Stage II's When Revealed while the Grasp is still in play it goes to Hope Summers, and answers the damage that defeated Stage I", () => {
    const base = stackEncounterDeck(game(), "40169");
    const run = defeatVillain(base);
    // The reveal comes before the response window of the lethal damage: Hope is attached to at that point.
    const attached = events(run.events, "cardMoved").find(
      (e) => e.cardId === "40169" && "hostInstanceId" in e.to && e.to.hostInstanceId === hopeOf(run.state),
    );
    expect(attached).toBeDefined();
    expect(discardNames(run.state)).toContain("Mental Transferal");
    expect(damageOn(run.state, hopeOf(run.state))).toBeGreaterThan(0);
  });
});

describe("Mind Alteration (40170), attached to the player's identity", () => {
  const withIt = (s = game()) => attach(s, "40170", identityOf(s, P1)).state;
  const withIt2 = () => {
    const s = game({ players: TWO });
    return attach(s, "40170", identityOf(s, P2)).state;
  };

  it("40170.mind-alteration-forced-response: after you play an event, take 1 damage", () => {
    const { run } = playFromHand(withIt(), P1, "01086");
    expect(identityDamage(run.state)).toBe(1);
  });

  it("40170.mind-alteration-forced-response: after you play an upgrade, take 1 damage (and the upgrade is in play)", () => {
    const s = withIt();
    const { run } = playFromHand(s, P1, "01008", { host: identityOf(s, P1) });
    expect(identityDamage(run.state)).toBe(1);
    expect(attachmentsOf(run.state, identityOf(s, P1))).toContain("Web-Shooter");
  });

  it("an ally played does not hurt: only events and upgrades", () => {
    const { run } = playFromHand(withIt(), P1, "01083");
    expect(inPlayNames(run.state, P1)).toContain("Mockingbird");
    expect(identityDamage(run.state)).toBe(0);
  });

  it("2 players: only the player whose identity it is on takes the damage", () => {
    const { run } = playFromHand(withIt(game({ players: TWO })), P2, "01086");
    expect(identityDamage(run.state, P1)).toBe(0);
    expect(identityDamage(run.state, P2)).toBe(0);
    const { run: mine } = playFromHand(withIt(game({ players: TWO })), P1, "01086");
    expect(identityDamage(mine.state, P1)).toBe(1);
    expect(identityDamage(mine.state, P2)).toBe(0);
  });

  it("2 players, on the second player's identity: their event costs them 1 hit point, the first player's does not", () => {
    const s = withIt2();
    expect(identityDamage(playFromHand(s, P2, "01086").run.state, P2)).toBe(1);
    expect(identityDamage(playFromHand(s, P1, "01086").run.state, P1)).toBe(0);
  });

  it("40170.mind-alteration-response: after you recover, spend a [mental] resource to discard it", () => {
    const s = setHand(patchInstance(withIt(), identityOf(game(), P1), { damage: 3 }), P1, [
      "01089",
      "01090",
      "01088",
      "01062",
    ]);
    const run = drive(s, { accept: ["Mind Alteration"], pay: ["Genius"] }, { type: "basicRecover", playerId: P1 });
    expect(attachmentsOf(run.state, identityOf(s, P1))).toEqual([]);
    expect(discardNames(run.state)).toContain("Mind Alteration");
    expect(handNames(run.state)).not.toContain("Genius");
  });

  it("40170.mind-alteration-response: with no [mental] resource to spend it cannot be discarded, and declined it stays", () => {
    const s = setHand(patchInstance(withIt(), identityOf(game(), P1), { damage: 3 }), P1, ["01090", "01088"]);
    const run = drive(s, { accept: ["Mind Alteration"] }, { type: "basicRecover", playerId: P1 });
    expect(attachmentsOf(run.state, identityOf(s, P1))).toEqual(["Mind Alteration"]);
  });
});

const exhaustedOf = (s: GameState, id: InstanceId) => inst(s, id).exhausted;
const ready = (s: GameState, id: InstanceId) => patchInstance(s, id, { exhausted: false });
const withCondition = (code: string, player: PlayerId, s: GameState) => attach(s, code, identityOf(s, player)).state;

describe("Mind Trap (40171), attached to the player's identity", () => {
  const withIt = (s = game()) => withCondition("40171", P1, s);

  it("40171.mind-trap-constant: your ally, upgrade and support enter play exhausted", () => {
    const s = withIt();
    const ally = playFromHand(s, P1, "01083").run.state;
    const mockingbird = playerOf(ally, P1).playArea.find((id) => nameOf(ally, id) === "Mockingbird")!;
    expect(exhaustedOf(ally, mockingbird)).toBe(true);
    const support = playFromHand(s, P1, "01063").run.state;
    const room = playerOf(support, P1).playArea.find((id) => nameOf(support, id) === "Interrogation Room")!;
    expect(exhaustedOf(support, room)).toBe(true);
    const upgrade = playFromHand(s, P1, "01008", { host: identityOf(s, P1) }).run.state;
    const shooter = inst(upgrade, identityOf(s, P1)).attachments.find((id) => nameOf(upgrade, id) === "Web-Shooter")!;
    expect(exhaustedOf(upgrade, shooter)).toBe(true);
  });

  it("an event is not exhausted by it (it does not stay in play), and a card without Mind Trap enters ready", () => {
    const plain = playFromHand(game(), P1, "01083").run.state;
    const mockingbird = playerOf(plain, P1).playArea.find((id) => nameOf(plain, id) === "Mockingbird")!;
    expect(exhaustedOf(plain, mockingbird)).toBe(false);
  });

  it("2 players: the other player's ally enters ready ('Your allies')", () => {
    const run = playFromHand(withIt(game({ players: TWO })), P2, "01067").run.state;
    const maria = playerOf(run, P2).playArea.find((id) => nameOf(run, id) === "Maria Hill")!;
    expect(exhaustedOf(run, maria)).toBe(false);
  });

  it("2 players, on the second player's identity: their ally enters exhausted and the first player's does not", () => {
    const base = game({ players: TWO });
    const s = withCondition("40171", P2, base);
    const mine = playFromHand(s, P2, "01067").run.state;
    const maria = playerOf(mine, P2).playArea.find((id) => nameOf(mine, id) === "Maria Hill")!;
    expect(exhaustedOf(mine, maria)).toBe(true);
    const theirs = playFromHand(s, P1, "01083").run.state;
    const bird = playerOf(theirs, P1).playArea.find((id) => nameOf(theirs, id) === "Mockingbird")!;
    expect(exhaustedOf(theirs, bird)).toBe(false);
  });

  it("40171.mind-trap-action: Alter-Ego Action, exhaust 3 cards you control (identity, Hope Summers and a support) to discard it", () => {
    const { state: s, id: room } = withInPlay(withIt(), P1, "01063");
    const trap = inst(s, identityOf(s, P1)).attachments[0]!;
    expect(nameOf(s, trap)).toBe("Mind Trap");
    const run = drive(s, {}, use(P1, trap, "40171.mind-trap-action"));
    expect(exhaustedOf(run.state, identityOf(s, P1))).toBe(true);
    expect(exhaustedOf(run.state, hopeOf(s))).toBe(true);
    expect(exhaustedOf(run.state, room)).toBe(true);
    expect(attachmentsOf(run.state, identityOf(s, P1))).toEqual([]);
    expect(discardNames(run.state)).toContain("Mind Trap");
  });

  it("40171.mind-trap-action: with only 2 ready cards (identity and Hope Summers) it cannot be used", () => {
    const s = withIt();
    const trap = inst(s, identityOf(s, P1)).attachments[0]!;
    expect(accepted(s, use(P1, trap, "40171.mind-trap-action"))).toBe(false);
  });
});

describe("Psionic Amnesia (40172), attached to the player's identity", () => {
  const withIt = (s = game()) => withCondition("40172", P1, s);
  const price = (s: GameState, player: PlayerId, code: string) => {
    const moved = moveToHand(s, player, code);
    return playCostOf(moved.state, player, moved.ids[0]!, WAVE7_DEPS)?.current;
  };

  it("40172.psionic-amnesia-constant: your allies and supports cost 2 more; events and upgrades cost the same", () => {
    const base = game();
    const s = withIt(base);
    // Printed 1 (upgrade 01007), 1 (support 01063), 4 (ally 01058), 1 (event 01004).
    expect(["01007", "01063", "01058", "01004"].map((c) => price(base, P1, c))).toEqual([1, 1, 4, 1]);
    expect(["01007", "01063", "01058", "01004"].map((c) => price(s, P1, c))).toEqual([1, 3, 6, 1]);
  });

  it("2 players: the other player's allies and supports cost what they did", () => {
    const base = game({ players: TWO });
    const s = withIt(base);
    expect(price(s, P2, "01067")).toBe(price(base, P2, "01067"));
    expect(price(s, P2, "01073")).toBe(price(base, P2, "01073"));
  });

  it("40172.psionic-amnesia-response: after you play a support, exhaust your identity to discard it", () => {
    const s = withIt();
    const { run } = playFromHand(s, P1, "01063", { plan: { accept: ["Psionic Amnesia"] } });
    expect(attachmentsOf(run.state, identityOf(s, P1))).toEqual([]);
    expect(exhaustedOf(run.state, identityOf(s, P1))).toBe(true);
    expect(inPlayNames(run.state, P1)).toContain("Interrogation Room");
  });

  it("the response is optional: declined, it stays and the identity stays ready", () => {
    const s = withIt();
    const { run } = playFromHand(s, P1, "01063");
    expect(attachmentsOf(run.state, identityOf(s, P1))).toEqual(["Psionic Amnesia"]);
    expect(exhaustedOf(run.state, identityOf(s, P1))).toBe(false);
  });

  it("40172.psionic-amnesia-response: not after an event or an upgrade", () => {
    const s = withIt();
    const { run } = playFromHand(s, P1, "01086", { plan: { accept: ["Psionic Amnesia"] } });
    expect(attachmentsOf(run.state, identityOf(s, P1))).toEqual(["Psionic Amnesia"]);
    expect(run.prompts.filter((p) => p.kind === "chooseTriggers")).toEqual([]);
  });
});

describe("Psychic Inertia (40173), attached to the player's identity", () => {
  const withIt = (s = game()) => withCondition("40173", P1, s);
  /** Stryfe's Grasp's crisis icon bars thwarting the main scheme, so a side scheme is what the hero thwarts. */
  const withScheme = (s: GameState) => encounterCardInVillainArea(s, "40176", 3);

  it("THW and ATK are -1 (data): the identity's basic ATK is one lower", () => {
    const base = heroed(game());
    const plain = attackFor(base, villainId(base));
    const s = withIt(heroed(game()));
    const inert = attackFor(s, villainId(s));
    expect(damageOn(plain.state, villainId(base)) - damageOn(inert.state, villainId(s))).toBe(1);
  });

  it("40173.psychic-inertia-action: after your hero attacked and thwarted this phase, the action discards it", () => {
    const { state: s, id: scheme } = withScheme(withIt(heroed(game())));
    const inertia = inst(s, identityOf(s, P1)).attachments[0]!;
    const attacked = attackFor(s, villainId(s)).state;
    const both = thwartFor(ready(attacked, identityOf(attacked, P1)), scheme, identityOf(attacked, P1)).state;
    const run = drive(ready(both, identityOf(both, P1)), {}, use(P1, inertia, "40173.psychic-inertia-action"));
    expect(attachmentsOf(run.state, identityOf(s, P1))).toEqual([]);
    expect(discardNames(run.state)).toContain("Psychic Inertia");
  });

  it("40173.psychic-inertia-action: attacked only, or thwarted only, it cannot be used", () => {
    const { state: s, id: scheme } = withScheme(withIt(heroed(game())));
    const inertia = inst(s, identityOf(s, P1)).attachments[0]!;
    expect(accepted(s, use(P1, inertia, "40173.psychic-inertia-action"))).toBe(false);
    const attacked = ready(attackFor(s, villainId(s)).state, identityOf(s, P1));
    expect(accepted(attacked, use(P1, inertia, "40173.psychic-inertia-action"))).toBe(false);
    const thwarted = ready(thwartFor(s, scheme, identityOf(s, P1)).state, identityOf(s, P1));
    expect(accepted(thwarted, use(P1, inertia, "40173.psychic-inertia-action"))).toBe(false);
  });
});

const encounterDeckNames = deckNames;

describe("Zero (40174): When Defeated, shuffled back unless the defeating player holds 3 cards of one type", () => {
  /** Zero engaged with `owner`, lethal damage on it, and `attacker` (whose hand is set) defeats it. */
  function defeatZero(hands: Readonly<Record<string, readonly string[]>>, attacker: PlayerId, players: Seats = ONE) {
    let s = heroed(game({ players }));
    for (const [player, codes] of Object.entries(hands)) s = setHand(s, player as PlayerId, codes);
    const placed = engageMinion(s, "40174", attacker);
    const clear = { stunned: 0, confused: 0, tough: 0 };
    const armed = patchInstance(placed.state, placed.id, { damage: 99, statuses: clear });
    return { run: attackFor(armed, placed.id, {}, attacker), zero: placed.id };
  }

  it("1 player with 3 cards of one type in hand: Zero is discarded and stays there", () => {
    const { run, zero } = defeatZero({ p1: UP3 }, P1);
    expect(discardNames(run.state)).toContain("Zero");
    expect(encounterDeckNames(run.state)).not.toContain("Zero");
    expect(inst(run.state, zero).engagedWith ?? null).toBeNull();
  });

  it("1 player without it (the largest group is 1): Zero is shuffled into the encounter deck", () => {
    const { run } = defeatZero({ p1: ["01007", "01063", "01058", "01004", "01062"] }, P1);
    expect(encounterDeckNames(run.state)).toContain("Zero");
    expect(discardNames(run.state)).not.toContain("Zero");
  });

  it("exactly 2 of a type is not enough: shuffled back", () => {
    const { run } = defeatZero({ p1: ["01007", "01007", "01063", "01058", "01004"] }, P1);
    expect(encounterDeckNames(run.state)).toContain("Zero");
  });

  it("2 players: the hand that counts is the defeating player's (second player with 4 events: discarded; first player's hand is poor)", () => {
    const { run } = defeatZero({ p1: ["01007", "01063", "01058", "01004", "01062"], p2: EV4 }, P2, TWO);
    expect(discardNames(run.state)).toContain("Zero");
    expect(encounterDeckNames(run.state)).not.toContain("Zero");
  });

  it("2 players: the second player defeats it with a poor hand while the first holds 3 of a type: shuffled back", () => {
    const { run } = defeatZero({ p1: UP3, p2: ["01012", "01067", "01073", "01072", "01069"] }, P2, TWO);
    expect(encounterDeckNames(run.state)).toContain("Zero");
  });
});

describe("Cerebral Erasure (40175)", () => {
  /** A support and an upgrade the first player controls in play: Interrogation Room and a Web-Shooter. */
  function withCards(s: GameState, player: PlayerId = P1) {
    const room = withInPlay(s, player, player === P1 ? "01063" : "01073");
    return room;
  }

  it("40175.when-revealed: you return an upgrade or support you control to its owner's hand (the one you pick)", () => {
    const { state, id } = withCards(heroed(game()));
    const second = withInPlay(state, P1, "01064");
    const run = round(second.state, { reveals: ["40175", "40176"], plan: { pick: ["Surveillance Team"] } });
    expect(handOf(run.state).map((i) => nameOf(run.state, i))).toContain("Surveillance Team");
    expect(inPlayNames(run.state, P1)).toContain("Interrogation Room");
    expect(inPlayNames(run.state, P1)).not.toContain("Surveillance Team");
    expect(id).toBeDefined();
  });

  it("40175.when-revealed: with no upgrade or support to return nothing happens and nothing is asked", () => {
    const run = round(game(), { reveals: ["40175", "40176"] });
    expect(run.prompts.filter((p) => p.kind === "chooseTarget")).toEqual([]);
    expect(areaIds(run.state, "Cerebral Erasure")).toHaveLength(1);
  });

  it("40175.when-revealed, 2 players: the revealing player returns their own card, not the other player's", () => {
    const first = withCards(game({ players: TWO }), P1);
    const both = withCards(first.state, P2);
    const run = round(both.state, { reveals: ["40176", "40175"] });
    expect(inPlayNames(run.state, P1)).toContain("Interrogation Room");
    expect(inPlayNames(run.state, P2)).not.toContain("The Triskelion");
    expect(handNames(run.state, P2)).toContain("The Triskelion");
  });

  it("40175.when-defeated: the player who defeated it returns an upgrade or support they control", () => {
    const first = withCards(game({ players: TWO }), P1);
    const both = withCards(first.state, P2);
    const { state: s, id: scheme } = encounterCardInVillainArea(both.state, "40175", 1);
    const run = thwartFor(s, scheme, identityOf(s, P2), P2);
    expect(areaIds(run.state, "Cerebral Erasure")).toHaveLength(0);
    expect(handNames(run.state, P2)).toContain("The Triskelion");
    expect(inPlayNames(run.state, P1)).toContain("Interrogation Room");
  });

  it("starts with 2 threat per player (data): 2 with 1 player, 4 with 2", () => {
    const one = round(game(), { reveals: ["40175"] });
    expect(inst(one.state, areaIds(one.state, "Cerebral Erasure")[0]!).threat).toBe(2);
    const two = round(game({ players: TWO }), { reveals: ["40175", "40176"] });
    expect(inst(two.state, areaIds(two.state, "Cerebral Erasure")[0]!).threat).toBe(4);
  });
});

describe("Telepathic Camouflage (40176)", () => {
  it("40176.when-revealed: its 2 threat plus 3 for a hand with 3 of one type", () => {
    const run = round(setHand(game(), P1, UP3), { reveals: ["40176"] });
    expect(inst(run.state, areaIds(run.state, "Telepathic Camouflage")[0]!).threat).toBe(2 + 3);
  });

  it("2 players: each player places X from their own hand (3 and 4)", () => {
    const base = setHand(setHand(game({ players: TWO }), P1, UP3), P2, EV4);
    const run = round(base, { reveals: ["40176", "40175"] });
    expect(inst(run.state, areaIds(run.state, "Telepathic Camouflage")[0]!).threat).toBe(2 + 3 + 4);
  });
});

const dealtTo = (run: Run, player: PlayerId) =>
  events(run.events, "cardMoved")
    .filter((e) => "playerId" in e.to && e.to.kind === "dealtEncounter" && e.to.playerId === player)
    .map((e) => e.cardId as string);

describe("Psionic Surge (40177)", () => {
  it("40177.when-revealed: discards the top 3 cards (X = 3) and deals each PSIONIC one to you facedown, where it is revealed", () => {
    const run = round(setHand(game(), P1, UP3), {
      boostCards: ["01186"],
      reveals: ["40177", "40170", "40175", "40179"],
    });
    // Mind Alteration (a PSIONIC attachment) and Telekinetic Wave (a PSIONIC treachery) were dealt; Cerebral Erasure was not.
    expect(dealtTo(run, P1)).toEqual(["40177", "40170", "40179"]);
    expect(attachmentsOf(run.state, identityOf(run.state, P1))).toEqual(["Mind Alteration"]);
    expect(discardNames(run.state)).toEqual(expect.arrayContaining(["Cerebral Erasure", "Psionic Surge"]));
    expect(discardNames(run.state)).not.toContain("Mind Alteration");
  });

  it("40177.when-revealed: X is the largest group (2 here: six cards over five types): 2 cards are discarded, one PSIONIC", () => {
    const hand = ["01007", "01063", "01058", "01004", "01062", "01090"];
    const run = round(setHand(game(), P1, hand), {
      boostCards: ["01186"],
      reveals: ["40177", "40175", "40170", "40171"],
    });
    // Cerebral Erasure (not PSIONIC) and Mind Alteration (PSIONIC) were discarded; Mind Trap, below them, was not.
    expect(dealtTo(run, P1)).toEqual(["40177", "40170"]);
    expect(deckNames(run.state)[0]).toBe("Mind Trap");
  });

  it("2 players: the revealing player's hand sets X (4 for the second player) and the cards are dealt to them", () => {
    const base = setHand(setHand(game({ players: TWO }), P1, UP3), P2, EV4);
    const run = round(base, {
      boostCards: ["01186", "01187"],
      reveals: ["40176", "40177", "40170", "40171", "40175", "40172"],
    });
    expect(dealtTo(run, P2)).toEqual(["40177", "40170", "40171", "40172"]);
    expect(dealtTo(run, P1)).toEqual(["40176"]);
    expect(attachmentsOf(run.state, identityOf(run.state, P2))).toEqual([
      "Mind Alteration",
      "Mind Trap",
      "Psionic Amnesia",
    ]);
  });
});

describe("Psychic Override (40178)", () => {
  /** P1's hand is UP3 (3 upgrades, 2 events, a support) and the deck's top cards are `top`; the type chosen is `type`. */
  function override(type: string, top: readonly string[], players: Seats = ONE) {
    const base = putOnTopOfDeck(setHand(game({ players }), P1, UP3), P1, ...top).state;
    const control = round(base, { reveals: ["40176", ...QUIET_REVEALS.slice(1, players.length)] });
    const run = round(base, { reveals: ["40178", ...QUIET_REVEALS.slice(1, players.length)], plan: { pick: [type] } });
    return { run, placed: mainThreatOf(run.state) - mainThreatOf(control.state) };
  }

  it("40178.when-revealed: choose Upgrade: discard the 2 events and the support, draw back up to 6, 1 threat for each Upgrade held", () => {
    const { run, placed } = override("Upgrade", ["01088", "01089", "01090"]);
    expect(events(run.events, "cardTypeChosen")[0]!.cardType).toBe("upgrade");
    expect(handNames(run.state).sort()).toEqual([
      "Energy",
      "Genius",
      "Spider-Tracer",
      "Spider-Tracer",
      "Strength",
      "Web-Shooter",
    ]);
    expect(
      playerOf(run.state, P1)
        .discard.map((i) => nameOf(run.state, i))
        .sort(),
    ).toEqual(["Enhanced Spider-Sense", "Interrogation Room", "Swinging Web Kick"]);
    expect(placed).toBe(3);
  });

  it("40178.when-revealed: an Upgrade drawn counts too (4 threat)", () => {
    const { placed } = override("Upgrade", ["01009", "01088", "01089"]);
    expect(placed).toBe(4);
  });

  it("40178.when-revealed: Event keeps the 2 events and discards the other 4 cards; 1 threat per Event held", () => {
    const { run, placed } = override("Event", ["01088", "01089", "01090", "01062"]);
    expect(handNames(run.state).sort()).toEqual([
      "Energy",
      "Enhanced Spider-Sense",
      "Genius",
      "Strength",
      "Swinging Web Kick",
      "The Power of Justice",
    ]);
    expect(placed).toBe(2);
  });

  it("40178.when-revealed: any type may be chosen, even one nobody can hold (Villain): the whole hand is discarded and no threat is placed (Jan 26, 2026 - Ruling 4 (4))", () => {
    const { run, placed } = override("Villain", ["01088", "01089", "01090", "01062", "01062", "01009"]);
    expect(playerOf(run.state, P1).discard).toHaveLength(6);
    expect(handNames(run.state)).toHaveLength(6);
    expect(placed).toBe(0);
  });

  it("40178.boost: the hero discards 1 card from their hand, then draws 1 (a Spider-Tracer out, Webbed Up in: ATK 0 + 3 + 1 boost icon)", () => {
    const base = putOnTopOfDeck(setHand(heroed(game()), P1, UP3), P1, "01009").state;
    const run = round(base, { boostCards: ["40178"], plan: { pick: ["Spider-Tracer"], pickKind: "chooseTarget" } });
    expect(handNames(run.state)).toContain("Webbed Up");
    expect(playerOf(run.state, P1).discard.map((i) => nameOf(run.state, i))).toContain("Spider-Tracer");
    expect(attacksBy(run.events, villainId(run.state))[0]!.baseAtk).toBe(3);
    expect(identityDamage(run.state)).toBe(4);
  });
});

describe("Telekinetic Wave (40179)", () => {
  it("40179.when-revealed: you return an upgrade or support you control to your hand, and Stryfe schemes against you in alter-ego form", () => {
    const { state } = withInPlay(game(), P1, "01063");
    const run = round(stackEncounterDeck(state, "01186", "40179", "01187"), {
      boostCards: ["01186"],
      reveals: ["40179", "01187"],
    });
    expect(inPlayNames(run.state, P1)).not.toContain("Interrogation Room");
    expect(handNames(run.state)).toContain("Interrogation Room");
    // His own activation and the Wave's: two schemes, no attack.
    expect(events(run.events, "schemeResolved")).toHaveLength(2);
    expect(attacksBy(run.events, villainId(run.state))).toHaveLength(0);
  });

  it("40179.when-revealed: in hero form Stryfe attacks you (a second attack with a boost card of its own)", () => {
    const { state } = withInPlay(heroed(game()), P1, "01063");
    const run = round(state, { boostCards: ["01186"], reveals: ["40179", "01187"] });
    expect(attacksBy(run.events, villainId(run.state))).toHaveLength(2);
    expect(handNames(run.state)).toContain("Interrogation Room");
  });

  it("40179.when-revealed: with nothing to return Stryfe still activates against you", () => {
    const run = round(heroed(game()), { boostCards: ["01186"], reveals: ["40179", "01187"] });
    expect(attacksBy(run.events, villainId(run.state))).toHaveLength(2);
  });

  it("40179.boost: with at least 3 cards of a type in your hand, 3 threat on the main scheme", () => {
    const withThree = round(setHand(heroed(game()), P1, UP3), { boostCards: ["40179"] });
    const withTwo = round(setHand(heroed(game()), P1, ["01007", "01007", "01063", "01058", "01004"]), {
      boostCards: ["40179"],
    });
    // Hero form, so Stryfe attacks and schemes not at all: the 1B response (3 and 2) and, only with 3 of a type, the Boost's 3.
    expect(mainThreatOf(withThree.state)).toBe(3 + 3);
    expect(mainThreatOf(withTwo.state)).toBe(2);
  });
});
