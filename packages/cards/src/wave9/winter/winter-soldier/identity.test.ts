import { WINTER_CARDS, cardId, trait, type HeroIdentityCard } from "@mc/content";
import {
  applyCommand,
  cardsInPlay,
  handSize,
  legalActions,
  maxHitPoints,
  type Command,
  type GameEvent,
  type GameState,
  type InstanceId,
} from "@mc/engine";
import { describe, expect, it, vi } from "vitest";
import { validateDefinition } from "../../../dsl/validate.js";
import {
  P1,
  firstLegal,
  identityOf,
  inst,
  moveToHand,
  patchInstance,
  payWith,
  play,
  playerOf,
  runWith,
  settle,
  use,
  type Picker,
} from "../../../testing/harness.js";
import { driveEventsPicking, withDamage } from "../../../testing/staging.js";
import { WINTER_SOLDIER_IDENTITY, WINTER_SOLDIER_IDENTITY_SKIPPED } from "./identity.js";
import { WS_DEPS, engageMinion, stagedInPlay, wsGame, wsHeroGame } from "../testing.js";

vi.setConfig({ testTimeout: 120_000 });

/**
 * Winter Soldier (54001a/b), docs/phase7-wave9.md section 8.4. The printed precon `winter-aggression` against Rhino.
 * Hero face: ATK 2, THW 2, DEF 2, hand size 5, 11 hit points; alter-ego face: REC 3, hand size 6. Cybernetic Arm
 * (54002) is another module's card, so only its presence in play is asserted here, never its own abilities.
 */
const LETHAL = "54001a.lethal-protector";
const ENHANCED = "54001b.cybernetically-enhanced";
const ARM = "54002";
const HAYMAKER = "01087";
const MERCENARY = "01101"; // Hydra Mercenary: 3 hit points
const BOMBER = "01110"; // Hydra Bomber: 2 hit points
const BLACK_WIDOW = "54003"; // ally, ATK 2

const IDENTITY = WINTER_CARDS.find((c) => c.id === cardId("54001a")) as HeroIdentityCard;

const villainOf = (s: GameState): InstanceId => s.activeVillainId!;
const schemeOf = (s: GameState): InstanceId => s.mainScheme.instanceId;
const withScheme = (s: GameState, threat: number): GameState => patchInstance(s, schemeOf(s), { threat });
const schemeThreat = (s: GameState): number => inst(s, schemeOf(s)).threat;
const armsInPlay = (s: GameState): InstanceId[] => cardsInPlay(s).filter((i) => (inst(s, i).cardId as string) === ARM);
const armsOf = (s: GameState): InstanceId[] =>
  Object.values(s.instances)
    .filter((i) => (i.cardId as string) === ARM)
    .map((i) => i.instanceId);

const basicAttack = (s: GameState, target: InstanceId, attacker: InstanceId = identityOf(s)): Command => ({
  type: "basicAttack",
  playerId: P1,
  attackerInstanceId: attacker,
  targetInstanceId: target,
});
const basicThwart = (s: GameState): Command => ({
  type: "basicThwart",
  playerId: P1,
  thwarterInstanceId: identityOf(s),
  schemeInstanceId: schemeOf(s),
});

/** Takes Lethal Protector when it is offered; the defender is always the hero. Records every trigger offered. */
const lethalPicker = (take: boolean, offered: string[] = []): Picker => {
  return (s) => {
    const choice = s.pendingChoice!;
    if (choice.prompt.kind === "chooseTriggers") {
      offered.push(...choice.options.map((o) => o.optionId));
      const mine = choice.options.find((o) => o.optionId.endsWith(LETHAL));
      return mine && take ? [mine.optionId] : firstLegal(s);
    }
    if (choice.prompt.kind === "declareDefender") return [identityOf(s)];
    return firstLegal(s);
  };
};

/** Where Cybernetic Arm sits after surgery: in the deck, the discard pile, the hand, or (default) wherever setup left it. */
function withArm(s: GameState, where: "deck" | "discard" | "hand"): GameState {
  const id = armsOf(s)[0]!;
  const strip = (list: readonly InstanceId[]) => list.filter((i) => i !== id);
  return {
    ...s,
    players: s.players.map((p) =>
      p.playerId !== P1
        ? p
        : {
            ...p,
            hand: where === "hand" ? [...strip(p.hand), id] : strip(p.hand),
            deck: where === "deck" ? [...strip(p.deck), id] : strip(p.deck),
            discard: where === "discard" ? [...strip(p.discard), id] : strip(p.discard),
          },
    ),
  };
}

/** Uses Cybernetically Enhanced paying with `pay` (a hand card), answering any prompt like `firstLegal`. */
function enhance(
  s: GameState,
  pay: InstanceId = playerOf(s, P1).hand.find((i) => (inst(s, i).cardId as string) !== ARM)!,
) {
  return driveEventsPicking(WS_DEPS, s, firstLegal, use(P1, identityOf(s), ENHANCED, [{ fromHand: pay }]));
}

describe("Winter Soldier identity registry", () => {
  it("every ability validates, with the printed timing", () => {
    for (const id of [LETHAL, ENHANCED]) expect(validateDefinition(WINTER_SOLDIER_IDENTITY[id]!), id).toEqual([]);
    expect(WINTER_SOLDIER_IDENTITY[LETHAL]!.trigger).toMatchObject({ kind: "response", forced: false });
    expect(WINTER_SOLDIER_IDENTITY[ENHANCED]!.trigger).toMatchObject({ kind: "action", form: "alterEgo" });
    expect(WINTER_SOLDIER_IDENTITY[ENHANCED]!.cost).toEqual({ resources: 1 });
    expect(WINTER_SOLDIER_IDENTITY[ENHANCED]!.limit).toBeUndefined();
  });
  it("both printed refs are registered and none is skipped", () => {
    expect(WINTER_SOLDIER_IDENTITY_SKIPPED).toEqual({});
    const printed = [...IDENTITY.hero.abilities, ...IDENTITY.alterEgo.abilities].map((a) => a.id as string);
    expect(printed.sort()).toEqual([ENHANCED, LETHAL].sort());
    expect(Object.keys(WINTER_SOLDIER_IDENTITY).sort()).toEqual(printed.sort());
  });
});

describe("printed stats, read from the game", () => {
  it("data: hero ATK 2, THW 2, DEF 2, hand size 5, 11 hit points; alter ego REC 3, hand size 6; traits", () => {
    expect(IDENTITY.hp).toBe(11);
    expect(IDENTITY.hero).toMatchObject({ atk: 2, thw: 2, def: 2, handSize: 5 });
    expect(IDENTITY.alterEgo).toMatchObject({ rec: 3, handSize: 6 });
    const traits = [trait("S.H.I.E.L.D."), trait("SOLDIER")];
    expect(IDENTITY.hero.traits).toEqual(traits);
    expect(IDENTITY.alterEgo.traits).toEqual(traits);
    expect(IDENTITY.unique).toBe(true);
    expect(IDENTITY.hero.keywords).toEqual([]);
    expect(IDENTITY.alterEgo.keywords).toEqual([]);
  });
  it("starts in alter-ego form with a hand of 6 and a 34-card deck, 11 hit points", () => {
    const s = wsGame();
    expect(playerOf(s, P1).identity.form).toBe("alterEgo");
    expect(playerOf(s, P1).hand).toHaveLength(6);
    expect(playerOf(s, P1).deck).toHaveLength(34);
    expect(handSize(s, P1, WS_DEPS)).toBe(6);
    expect(maxHitPoints(s, identityOf(s), WS_DEPS)).toBe(11);
  });
  it("REC 3: recovering from 6 damage leaves 3", () => {
    const hurt = withDamage(wsGame(), identityOf(wsGame()), 6);
    const after = settle(
      runWith(WS_DEPS, hurt, { type: "basicRecover", playerId: P1 }),
      firstLegal,
      undefined,
      WS_DEPS,
    );
    expect(inst(after, identityOf(after)).damage).toBe(3);
  });
  it("hero form: hand size 5; THW 2 takes the scheme from 5 to 3; ATK 2 deals 2 damage to Rhino", () => {
    const s = withScheme(wsHeroGame(), 5);
    expect(handSize(s, P1, WS_DEPS)).toBe(5);
    const thwarted = driveEventsPicking(WS_DEPS, s, lethalPicker(false), basicThwart(s)).state;
    expect(schemeThreat(thwarted)).toBe(3);
    const hit = driveEventsPicking(WS_DEPS, s, lethalPicker(false), basicAttack(s, villainOf(s))).state;
    expect(inst(hit, villainOf(hit)).damage).toBe(2);
  });
  it("DEF 2: a defended enemy attack deals 2 less damage than the same attack undefended, and exhausts him", () => {
    const s = wsHeroGame();
    const endTurn: Command = { type: "endTurn", playerId: P1 };
    const undefended = driveEventsPicking(
      WS_DEPS,
      s,
      (st) => {
        const choice = st.pendingChoice!;
        if (choice.prompt.kind !== "declareDefender") return firstLegal(st);
        return [choice.options.find((o) => o.optionId !== (identityOf(st) as string))!.optionId];
      },
      endTurn,
    ).state;
    const defended = driveEventsPicking(WS_DEPS, s, lethalPicker(false), endTurn).state;
    const dealt = inst(undefended, identityOf(undefended)).damage;
    expect(dealt).toBeGreaterThanOrEqual(2);
    expect(inst(defended, identityOf(defended)).damage).toBe(Math.max(0, dealt - 2));
  });
});

describe(`${ENHANCED}: Action: spend 1 resource of any type, search your deck and discard pile for Cybernetic Arm and put it into play`, () => {
  it("the precon holds exactly one Cybernetic Arm, outside the starting hand's reach to start with", () => {
    expect(armsOf(wsGame())).toHaveLength(1);
  });
  it("from the deck: the Arm enters play faceup on the identity, the paid card is discarded, nothing else is spent", () => {
    const s = withArm(wsGame(), "deck");
    const pay = playerOf(s, P1).hand[0]!;
    const { state } = enhance(s, pay);
    const arm = armsInPlay(state);
    expect(arm).toHaveLength(1);
    expect(inst(state, arm[0]!).attachedTo).toBe(identityOf(state));
    expect(inst(state, arm[0]!).faceup).toBe(true);
    expect(inst(state, identityOf(state)).attachments).toContain(arm[0]);
    expect(playerOf(state, P1).deck).not.toContain(arm[0]);
    expect(playerOf(state, P1).deck).toHaveLength(33);
    expect(playerOf(state, P1).hand).toHaveLength(5);
    expect(playerOf(state, P1).discard).toEqual([pay]);
    expect(state.pendingChoice).toBeNull();
  });
  it("from the discard pile: the Arm is found there, no card leaves the deck", () => {
    const base = withArm(wsGame(), "discard");
    expect(playerOf(base, P1).discard).toHaveLength(1);
    const pay = playerOf(base, P1).hand[0]!;
    const { state } = enhance(base, pay);
    expect(armsInPlay(state)).toHaveLength(1);
    expect([...playerOf(state, P1).deck].sort()).toEqual([...playerOf(base, P1).deck].sort());
    expect(playerOf(state, P1).discard).toEqual([pay]);
  });
  it("it is not a play: the Arm's printed cost 1 is not paid (the hand loses only the one cost card)", () => {
    const s = withArm(wsGame(), "deck");
    const { state } = enhance(s);
    expect(playerOf(state, P1).hand).toHaveLength(5);
  });
  it("the deck is shuffled afterwards", () => {
    const s = withArm(wsGame(), "deck");
    const { events } = enhance(s);
    expect(events.filter((e) => e.type === "deckShuffled")).toHaveLength(1);
  });
  it("any resource type pays: each of the six cards in hand can be spent", () => {
    const s = withArm(wsGame(), "deck");
    for (const pay of playerOf(s, P1).hand) {
      const { state } = enhance(s, pay);
      expect(armsInPlay(state), String(pay)).toHaveLength(1);
      expect(playerOf(state, P1).discard).toEqual([pay]);
    }
  });
  it("with the Arm in hand it is not found: the resource is spent, the deck shuffled, the Arm stays in hand", () => {
    const s = withArm(wsGame(), "hand");
    const arm = armsOf(s)[0]!;
    const pay = playerOf(s, P1).hand.find((i) => i !== arm)!;
    const { state, events } = enhance(s, pay);
    expect(armsInPlay(state)).toEqual([]);
    expect(playerOf(state, P1).hand).toContain(arm);
    expect(playerOf(state, P1).discard).toEqual([pay]);
    expect(events.filter((e) => e.type === "deckShuffled")).toHaveLength(1);
  });
  it("with the Arm already in play a second use finds nothing: still one Arm, one more resource spent", () => {
    const first = enhance(withArm(wsGame(), "deck")).state;
    const pay = playerOf(first, P1).hand[0]!;
    const { state } = enhance(first, pay);
    expect(armsInPlay(state)).toHaveLength(1);
    expect(playerOf(state, P1).discard).toHaveLength(2);
    expect(state.pendingChoice).toBeNull();
  });
  it("no limit: with the Arm back in the discard pile (surgery) a second use in the same turn puts it into play", () => {
    const first = enhance(withArm(wsGame(), "deck")).state;
    const armId = armsInPlay(first)[0]!;
    const reset = patchInstance(
      {
        ...first,
        players: first.players.map((p) =>
          p.playerId === P1
            ? { ...p, playArea: p.playArea.filter((i) => i !== armId), discard: [...p.discard, armId] }
            : p,
        ),
      },
      identityOf(first),
      { attachments: [] },
    );
    const again = patchInstance(reset, armId, { attachedTo: null, home: { kind: "discard", playerId: P1 } as never });
    const { state } = enhance(again);
    expect(armsInPlay(state)).toEqual([armId]);
  });
  it("the resource is a cost: with no payment the action is refused and nothing is searched", () => {
    const s = withArm(wsGame(), "deck");
    const result = applyCommand(s, use(P1, identityOf(s), ENHANCED, []), WS_DEPS);
    expect(result.ok).toBe(false);
    expect(armsInPlay(s)).toEqual([]);
  });
  it("with an empty hand there is no resource to spend: the action is not offered", () => {
    const s = withArm(wsGame(), "deck");
    const empty = { ...s, players: s.players.map((p) => (p.playerId === P1 ? { ...p, hand: [] } : p)) };
    const legal = legalActions(empty, P1, WS_DEPS);
    if (legal.kind !== "turn") throw new Error(legal.kind);
    expect(legal.legal.some((a) => a.action.kind === "useAbility" && a.action.abilityId === ENHANCED)).toBe(false);
  });
  it("it is an alter-ego action: offered in alter-ego form, not in hero form", () => {
    const offered = (s: GameState) => {
      const legal = legalActions(s, P1, WS_DEPS);
      if (legal.kind !== "turn") throw new Error(legal.kind);
      return legal.legal.some((a) => a.action.kind === "useAbility" && a.action.abilityId === ENHANCED);
    };
    expect(offered(wsGame())).toBe(true);
    expect(offered(wsHeroGame())).toBe(false);
  });
});

describe(`${LETHAL}: Response: after you attack and defeat an enemy, remove 2 threat from a scheme`, () => {
  const withMinion = (s: GameState, code: string): { state: GameState; id: InstanceId } => {
    const id = "minion-1" as InstanceId;
    return { state: engageMinion(s, code, id), id };
  };

  it("a basic attack (ATK 2) that defeats a 2-hit-point minion: accepted, the scheme goes from 5 to 3", () => {
    const { state: staged, id } = withMinion(withScheme(wsHeroGame(), 5), BOMBER);
    const { state } = driveEventsPicking(WS_DEPS, staged, lethalPicker(true), basicAttack(staged, id));
    expect(cardsInPlay(state)).not.toContain(id);
    expect(schemeThreat(state)).toBe(3);
    expect(state.pendingChoice).toBeNull();
  });
  it("it is a response the player may decline: declined, the scheme stays at 5", () => {
    const { state: staged, id } = withMinion(withScheme(wsHeroGame(), 5), BOMBER);
    const offered: string[] = [];
    const { state } = driveEventsPicking(WS_DEPS, staged, lethalPicker(false, offered), basicAttack(staged, id));
    expect(offered.filter((o) => o.endsWith(LETHAL))).toHaveLength(1);
    expect(schemeThreat(state)).toBe(5);
  });
  it("removes up to 2 and no more: a scheme at 1 goes to 0", () => {
    const { state: staged, id } = withMinion(withScheme(wsHeroGame(), 1), BOMBER);
    const { state } = driveEventsPicking(WS_DEPS, staged, lethalPicker(true), basicAttack(staged, id));
    expect(schemeThreat(state)).toBe(0);
  });
  it("an attack that does not defeat (2 damage on a 3-hit-point minion) does not offer it", () => {
    const { state: staged, id } = withMinion(withScheme(wsHeroGame(), 5), MERCENARY);
    const offered: string[] = [];
    const { state } = driveEventsPicking(WS_DEPS, staged, lethalPicker(true, offered), basicAttack(staged, id));
    expect(offered.filter((o) => o.endsWith(LETHAL))).toEqual([]);
    expect(inst(state, id).damage).toBe(2);
    expect(schemeThreat(state)).toBe(5);
  });
  it("an attack on the villain that does not defeat it does not offer it", () => {
    const s = withScheme(wsHeroGame(), 5);
    const offered: string[] = [];
    const { state } = driveEventsPicking(WS_DEPS, s, lethalPicker(true, offered), basicAttack(s, villainOf(s)));
    expect(offered.filter((o) => o.endsWith(LETHAL))).toEqual([]);
    expect(schemeThreat(state)).toBe(5);
  });
  it("the 2 threat is one removal of 2 from the main scheme, sourced to Winter Soldier", () => {
    const { state: staged, id } = withMinion(withScheme(wsHeroGame(), 5), BOMBER);
    const { events } = driveEventsPicking(WS_DEPS, staged, lethalPicker(true), basicAttack(staged, id));
    expect(events.filter((e: GameEvent) => e.type === "threatRemoved")).toMatchObject([
      { schemeInstanceId: schemeOf(staged), amount: 2, sourceInstanceId: identityOf(staged) },
    ]);
  });
  it("an attack event also answers it: Haymaker (3 damage) defeating a 3-hit-point minion", () => {
    const { state: staged, id } = withMinion(withScheme(wsHeroGame({ swap: { "54005": HAYMAKER } }), 5), MERCENARY);
    const given = moveToHand(staged, P1, HAYMAKER);
    const card = given.ids[0]!;
    const pay = payWith(given.state, P1, 2, [card]);
    const { state } = driveEventsPicking(WS_DEPS, given.state, lethalPicker(true), play(P1, card, pay));
    expect(cardsInPlay(state)).not.toContain(id);
    expect(schemeThreat(state)).toBe(3);
  });
  it("an ally's attack that defeats an enemy does not offer it (you is the identity)", () => {
    const ally = stagedInPlay(withScheme(wsHeroGame(), 5), BLACK_WIDOW);
    const { state: staged, id } = withMinion(ally.state, BOMBER);
    const offered: string[] = [];
    const { state } = driveEventsPicking(
      WS_DEPS,
      staged,
      lethalPicker(true, offered),
      basicAttack(staged, id, ally.id),
    );
    expect(cardsInPlay(state)).not.toContain(id);
    expect(offered.filter((o) => o.endsWith(LETHAL))).toEqual([]);
    expect(schemeThreat(state)).toBe(5);
  });
});
