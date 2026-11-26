/**
 * A divided basic attack is divided from the ATK its first share deals (`resolve/divided-basic-attack.ts`; issue #1012
 * §5, owner decision A), with test cards shaped like Giant Wasp (13001c, "Damage you deal using your basic attack power
 * (ATK) can be divided among enemies as you choose") and Bombshell (29033, "as evenly as possible").
 *
 * Sources: RRG 1.8 FAQ "Wasp (#1C)" (p. 61): the targets are chosen when the power is used, each is attacked and each
 * retaliate damages her; ruling January 11, 2026 R4 (Bombshell: divided as evenly as possible among each enemy). The
 * readings for ATK below the number of targets and for an even split re-made are the engine's (authority step 5).
 * RRG 1.8 "Player Elimination" (p. 34): "If a player is eliminated in the middle of an attack, that attack ends".
 */
import { describe, expect, it } from "vitest";
import type { AbilityDefinition } from "./abilities.js";
import { applyCommand } from "./engine.js";
import { playerId, type InstanceId } from "./ids.js";
import { mustInstance } from "./query.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { stubIdentity, stubMinion } from "./testing/fixtures.js";
import { defaultPick, newGame, settle } from "./testing/scenario.js";

const p1 = playerId("p1");
const def = (definition: AbilityDefinition) => definition;
const RETALIATOR = stubMinion({
  id: "retaliator",
  atk: 0,
  sch: 0,
  hp: 9,
  boostIcons: 0,
  keywords: [{ name: "retaliate", value: 1 }],
});
const PLAIN = stubMinion({ id: "plain-minion", atk: 0, sch: 0, hp: 9, boostIcons: 0 });
/** "Forced Interrupt: When this minion is attacked, deal 99 damage to the first player's hero." (Speed Demon's place.) */
const BACKLASH = stubAbility(
  "backlash.forced-interrupt",
  def({
    trigger: { kind: "interrupt", forced: true, on: { on: "attack", selfIs: "target" } },
    effects: [
      {
        kind: "dealDamage",
        target: { kind: "identityOf", player: { kind: "id", playerId: p1 } },
        amount: { kind: "const", value: 99 },
      },
    ],
  }),
);
const DEMON = stubMinion({ id: "demon", atk: 0, sch: 0, hp: 9, boostIcons: 0, abilities: [BACKLASH.ref] });
const DIVIDE = stubAbility(
  "giant.constant",
  def({
    trigger: {
      kind: "constant",
      rules: [{ kind: "divideBasicPower", power: "attack", target: { categories: ["identity"], controller: "you" } }],
    },
    effects: [],
  }),
);
const EVENLY = stubAbility(
  "bombshell.constant",
  def({
    trigger: {
      kind: "constant",
      rules: [
        {
          kind: "divideBasicPower",
          power: "attack",
          target: { categories: ["identity"], controller: "you" },
          evenly: true,
        },
      ],
    },
    effects: [],
  }),
);
/** "Forced Interrupt: When this character attacks, it gets +X ATK for this attack." */
const bonus = (x: number) =>
  stubAbility(
    `bonus${x}.forced-interrupt`,
    def({
      trigger: { kind: "interrupt", forced: true, on: { on: "attack", selfIs: "source" } },
      effects: [{ kind: "modifyAttack", atkBonus: { kind: "const", value: x } }],
    }),
  );

/**
 * A hero-form identity with ATK 3 and `abilities`, both minions engaged with the first player (test surgery from the
 * encounter deck). `first` is the first minion's card (the retaliating one by default); `players` seats that many.
 */
function game(
  abilities: readonly ReturnType<typeof stubAbility>[],
  options: { readonly first?: typeof RETALIATOR; readonly players?: 1 | 2 } = {},
) {
  const first = options.first ?? RETALIATOR;
  const refs = abilities.map((a) => a.ref);
  const identity = stubIdentity({
    id: "divider",
    hp: 20,
    atk: 3,
    thw: 1,
    def: 1,
    rec: 1,
    heroHandSize: 5,
    alterEgoHandSize: 5,
    heroAbilities: refs,
    alterEgoAbilities: refs,
  });
  const deps = depsOf(...abilities, BACKLASH);
  const start = newGame({
    identity,
    deps,
    players: options.players ?? 1,
    extraCards: [RETALIATOR, PLAIN, DEMON],
    encounterDeck: [first.id, PLAIN.id, ...Array.from({ length: 10 }, () => PLAIN.id)],
  });
  const hero = applyCommand(start, { type: "changeForm", playerId: p1 }, deps);
  if (!hero.ok) throw new Error(hero.error.message);
  const state = settle(hero.state, defaultPick, deps);
  const [deckId] = state.encounterDeckOrder;
  const piles = state.encounterDecks[deckId as string]!;
  const retaliator = piles.deck.find((id) => state.instances[id]?.cardId === first.id)!;
  const plain = piles.deck.find((id) => state.instances[id]?.cardId === PLAIN.id)!;
  const minions = [retaliator, plain];
  const staged: GameState = {
    ...state,
    encounterDecks: {
      ...state.encounterDecks,
      [deckId as string]: { ...piles, deck: piles.deck.filter((id) => !minions.includes(id)) },
    },
    players: state.players.map((p) => (p.playerId === p1 ? { ...p, playArea: [...p.playArea, ...minions] } : p)),
    instances: {
      ...state.instances,
      [retaliator]: { ...state.instances[retaliator]!, faceup: true, engagedWith: p1 },
      [plain]: { ...state.instances[plain]!, faceup: true, engagedWith: p1 },
    },
  };
  return { state: staged, deps, retaliator, plain, hero: state.players[0]!.identity.instanceId };
}

/** Makes the divided attack, answering a `divide` prompt with `shares`; returns the prompts asked and the end state. */
function attack(
  table: ReturnType<typeof game>,
  divide: readonly { readonly targetInstanceId: InstanceId; readonly amount: number }[],
  shares: ReadonlyMap<InstanceId, number> = new Map(),
) {
  const result = applyCommand(
    table.state,
    {
      type: "basicAttack",
      playerId: p1,
      attackerInstanceId: table.hero,
      targetInstanceId: divide[0]!.targetInstanceId,
      divide,
    },
    table.deps,
  );
  if (!result.ok) throw new Error(result.error.message);
  const asked: unknown[] = [];
  const pick = (state: GameState): readonly string[] => {
    const choice = state.pendingChoice;
    if (choice?.prompt.kind === "divide") {
      asked.push(choice.prompt);
      return [...shares].flatMap(([id, n]) => Array.from({ length: n }, (_, i) => `${id}#${i + 1}`));
    }
    return defaultPick(state);
  };
  return { asked, after: settle(result.state, pick, table.deps) };
}
const damageOf = (state: GameState, id: InstanceId) => mustInstance(state, id).damage;

describe("a divided basic attack is divided from the ATK its first share deals (#1012 §5)", () => {
  it("a first-share '+1 ATK for this attack' is divided too, and each retaliate still answers its share", () => {
    const table = game([DIVIDE, bonus(1)]);
    const { retaliator, plain, hero } = table;
    const { asked, after } = attack(
      table,
      [
        { targetInstanceId: retaliator, amount: 2 },
        { targetInstanceId: plain, amount: 1 },
      ],
      new Map([
        [retaliator, 1],
        [plain, 3],
      ]),
    );
    // ATK 3 + 1 for this attack: the command's 2 + 1 is divided again, at least 1 each.
    expect(asked).toEqual([{ kind: "divide", what: "damage", amount: 4, eachAtLeast: 1 }]);
    expect([damageOf(after, retaliator), damageOf(after, plain)]).toEqual([1, 3]);
    // Retaliate 1 from the retaliating minion its share attacked (FAQ "Wasp (#1C)", p. 61).
    expect(damageOf(after, hero)).toBe(1);
  });

  it("ATK below the number of targets divides with no minimum: a target given 0 is attacked for 0 and retaliates", () => {
    const table = game([DIVIDE, bonus(-2)]);
    const { retaliator, plain, hero } = table;
    const { asked, after } = attack(
      table,
      [
        { targetInstanceId: retaliator, amount: 2 },
        { targetInstanceId: plain, amount: 1 },
      ],
      new Map([[plain, 1]]),
    );
    expect(asked).toEqual([{ kind: "divide", what: "damage", amount: 1 }]);
    expect([damageOf(after, retaliator), damageOf(after, plain)]).toEqual([0, 1]);
    expect(damageOf(after, hero)).toBe(1);
  });

  it("with the same total the command's division stands and nothing is asked", () => {
    const table = game([DIVIDE]);
    const { retaliator, plain } = table;
    const { asked, after } = attack(table, [
      { targetInstanceId: retaliator, amount: 2 },
      { targetInstanceId: plain, amount: 1 },
    ]);
    expect(asked).toEqual([]);
    expect([damageOf(after, retaliator), damageOf(after, plain)]).toEqual([2, 1]);
  });

  it("a mandatory even split (Bombshell, ruling January 11, 2026 R4) is split evenly again, not asked", () => {
    const table = game([EVENLY, bonus(1)]);
    const { retaliator, plain } = table;
    const villain = table.state.villains[0]!.instanceId;
    const { asked, after } = attack(table, [
      { targetInstanceId: plain, amount: 1 },
      { targetInstanceId: retaliator, amount: 1 },
      { targetInstanceId: villain, amount: 1 },
    ]);
    expect(asked).toEqual([]);
    // 4 among 3: 2 / 1 / 1, the remainder to the first target chosen (the shares were tied).
    expect([damageOf(after, plain), damageOf(after, retaliator), damageOf(after, villain)]).toEqual([2, 1, 1]);
  });

  // Owner's repro on e6d44d336 (#1012): Giant Wasp at 1 HP divides 1 + 1 between Speed Demon and Shocker with Rapid
  // Growth's +2; Speed Demon's forced interrupt eliminates her, and the engine then asked the eliminated player to
  // divide 4 damage, leaving the table stuck. The attack ends with her elimination (RRG 1.8 p. 34): nobody is asked.
  it("a player eliminated in the first share's interrupt window is not asked to divide: the attack ends unmade", () => {
    const table = game([DIVIDE, bonus(2)], { first: DEMON, players: 2 });
    const { retaliator: demon, plain } = table;
    const { asked, after } = attack(
      table,
      [
        { targetInstanceId: demon, amount: 2 },
        { targetInstanceId: plain, amount: 1 },
      ],
      new Map([
        [demon, 3],
        [plain, 2],
      ]),
    );
    expect(after.players.find((p) => p.playerId === p1)?.eliminated).toBe(true);
    expect(asked).toEqual([]);
    expect(after.pendingChoice?.playerId ?? null).not.toBe(p1);
    expect([damageOf(after, demon), damageOf(after, plain)]).toEqual([0, 0]);
    expect(after.players.filter((p) => !p.eliminated)).toHaveLength(1);
    expect(after.outcome).toBeNull();
  });
});
