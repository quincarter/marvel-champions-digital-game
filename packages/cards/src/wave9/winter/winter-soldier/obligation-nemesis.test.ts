import { WINTER_CARDS, cardId } from "@mc/content";
import {
  activeEncounterDeckId,
  applyCommand,
  cardsInPlay,
  characterProfile,
  hasKeyword,
  type Command,
  type GameEvent,
  type GameState,
  type InstanceId,
} from "@mc/engine";
import { describe, expect, it, vi } from "vitest";
import { abilityRefIds } from "../../../ability-refs.js";
import { validateDefinition } from "../../../dsl/validate.js";
import {
  P1,
  endTurn,
  firstLegal,
  identityOf,
  inst,
  instancesOf,
  patchInstance,
  playerOf,
  use,
  type Picker,
} from "../../../testing/harness.js";
import { driveEventsPicking } from "../../../testing/staging.js";
import { WS_DEPS, wsGame, wsHeroGame } from "../testing.js";
import {
  WINTER_SOLDIER_OBLIGATION_NEMESIS as REGISTRY,
  WINTER_SOLDIER_OBLIGATION_NEMESIS_SKIPPED as SKIPPED,
} from "./obligation-nemesis.js";

vi.setConfig({ testTimeout: 120_000 });

/**
 * Winter Soldier's obligation and nemesis set (54027 Red Room Programming; 54028 Crossbones, 54029 Hydra Hit Squad,
 * 54030 High-Tech Armament, 54031 Hydra Mercenary), docs/phase7-wave9.md section 8.4, 3.49, 3.52. The printed precon
 * `winter-aggression` against Core's Rhino (stage 1: ATK 2, SCH 1). Cards are revealed through the villain phase behind
 * Advance fillers (0 boost icons). Core cards stand in for the rest: Hydra Mercenary 01101 (a Hydra minion, ATK 1,
 * 3 hit points), Sandman 01102 (not Hydra), Black Widow 54003 and Haymaker 01087 (cost 2), Energy 01088 (cost none).
 */
const RED_ROOM = "54027";
const CROSSBONES = "54028";
const HIT_SQUAD = "54029";
const ARMAMENT = "54030";
const MERCENARY = "54031";
const FILLER = "01186"; // Advance: 0 boost icons
const CORE_HYDRA = "01101"; // Hydra Mercenary (Core): trait HYDRA, ATK 1, 3 hit points
const SANDMAN = "01102"; // not Hydra
const HAYMAKER = "01087"; // event, cost 2
const WIDOW = "54003"; // Black Widow: ally, cost 3, 3 hit points
const ENERGY = "01088"; // resource, no cost
const HIT_SQUAD_CONSTANT = "54029.hydra-hit-squad-constant";
const ARMAMENT_ACTION = "54030.high-tech-armament-action";
const REFS = [
  "54027.obligation",
  "54028.crossbones-forced-response",
  HIT_SQUAD_CONSTANT,
  "54029.when-defeated",
  "54030.high-tech-armament-forced-response",
  ARMAMENT_ACTION,
];

const data = (code: string) => WINTER_CARDS.find((c) => (c.id as string) === code)! as any;
const codeOf = (s: GameState, id: InstanceId): string => inst(s, id).cardId as string;
const relabel = (s: GameState, id: InstanceId, code: string): GameState =>
  patchInstance(s, id, { cardId: cardId(code) });
const ofType = <T extends GameEvent["type"]>(events: readonly GameEvent[], type: T) =>
  events.filter((e): e is Extract<GameEvent, { type: T }> => e.type === type);
const encounterCodes = (s: GameState, zone: "deck" | "discard"): string[] =>
  Object.values(s.encounterDecks).flatMap((d) => d[zone].map((i) => codeOf(s, i)));
const setAsideCodes = (s: GameState): string[] => playerOf(s, P1).setAside.map((id) => codeOf(s, id));
const handOf = (s: GameState): readonly InstanceId[] => playerOf(s, P1).hand;
const damageOf = (s: GameState, id: InstanceId): number => inst(s, id).damage;
const inPlayIds = (s: GameState, code: string): InstanceId[] =>
  instancesOf(s, code).filter((i) => cardsInPlay(s).includes(i));
const stat = (s: GameState, id: InstanceId, which: "atk" | "sch"): number => characterProfile(s, id, WS_DEPS)![which];
const hp = (s: GameState, id: InstanceId): number => characterProfile(s, id, WS_DEPS)!.maxHp;
const endPhase = (s: GameState): Command[] => s.players.map((p) => endTurn(p.playerId));
const mainThreat = (s: GameState): number => inst(s, s.mainScheme.instanceId).threat;

const picker =
  (choose?: (s: GameState) => readonly string[] | undefined): Picker =>
  (s) => {
    const prompt = s.pendingChoice!.prompt;
    if (prompt.kind === "declareDefender") return ["decline"];
    return choose?.(s) ?? firstLegal(s);
  };
const pickLabel = (label: string) =>
  picker((s) => {
    const match = s.pendingChoice!.options.find((o) => o.label.includes(label));
    return match ? [match.optionId] : undefined;
  });
const run = (s: GameState, pick: Picker, ...commands: readonly Command[]) =>
  driveEventsPicking(WS_DEPS, s, pick, ...commands);

/** The first instance of `code`: the set-aside copy, else the encounter deck's or any other. */
const findCard = (s: GameState, code: string): InstanceId =>
  playerOf(s, P1).setAside.find((i) => codeOf(s, i) === code) ?? instancesOf(s, code)[0]!;
const removeFromZones = (s: GameState, id: InstanceId): GameState => ({
  ...s,
  players: s.players.map((p) => ({ ...p, setAside: p.setAside.filter((i) => i !== id) })),
  encounterDecks: Object.fromEntries(
    Object.entries(s.encounterDecks).map(([k, d]) => [
      k,
      { deck: d.deck.filter((i) => i !== id), discard: d.discard.filter((i) => i !== id) },
    ]),
  ),
});
/** `id` on top of the encounter deck behind `before` fillers and ahead of `after` more, so it is revealed to P1. */
function stagedForReveal(s: GameState, id: InstanceId, before: number, after: number): GameState {
  const deckId = activeEncounterDeckId(s);
  const stripped = removeFromZones(s, id);
  const pile = stripped.encounterDecks[deckId]!;
  const fillers = [...pile.deck.slice(0, before), ...pile.deck.slice(before, before + after)];
  const staged: GameState = {
    ...stripped,
    encounterDecks: {
      ...stripped.encounterDecks,
      [deckId]: {
        ...pile,
        deck: [
          ...pile.deck.slice(0, before),
          id,
          ...pile.deck.slice(before, before + after),
          ...pile.deck.slice(before + after),
        ],
      },
    },
  };
  return fillers.reduce((acc, f) => relabel(acc, f, FILLER), staged);
}
/**
 * `code` revealed to P1 in the next villain phase, behind `before` Advance fillers (Rhino's boost card, 1 unless he is
 * stunned) and ahead of `after` more (the boost card of an activation the reveal causes).
 */
function reveal(s: GameState, code: string, pick: Picker = picker(), opts: { before?: number; after?: number } = {}) {
  const id = findCard(s, code);
  const staged = stagedForReveal(s, id, opts.before ?? 1, opts.after ?? 0);
  return { ...run(staged, pick, ...endPhase(staged)), id };
}
/** The villain and every engaged minion stunned and confused: their villain-phase activations do nothing and take no boost card. */
function allStunned(s: GameState): GameState {
  const stunned = (acc: GameState, id: InstanceId): GameState =>
    patchInstance(acc, id, { statuses: { ...inst(acc, id).statuses, stunned: 1, confused: 1 } });
  return [s.activeVillainId!, ...cardsInPlay(s).filter((i) => inst(s, i).engagedWith === P1)].reduce(stunned, s);
}
/** A set-aside minion put into play engaged with P1 by surgery (no reveal). */
function engaged(s: GameState, code: string): { state: GameState; id: InstanceId } {
  const id = findCard(s, code);
  const stripped = removeFromZones(s, id);
  return {
    id,
    state: {
      ...stripped,
      players: stripped.players.map((p) => (p.playerId === P1 ? { ...p, playArea: [...p.playArea, id] } : p)),
      instances: { ...stripped.instances, [id]: { ...stripped.instances[id]!, faceup: true, engagedWith: P1 } },
    },
  };
}
/** The set-aside side scheme `code` put into the villain area by surgery. */
function sideScheme(s: GameState, code: string, threat: number): { state: GameState; id: InstanceId } {
  const id = findCard(s, code);
  const stripped = removeFromZones(s, id);
  return {
    id,
    state: {
      ...stripped,
      villainArea: [...stripped.villainArea, id],
      instances: { ...stripped.instances, [id]: { ...stripped.instances[id]!, faceup: true, threat } },
    },
  };
}
/**
 * The hand turned into `codes` by surgery, padded with Energy so that the end-of-turn draw (the top of the deck, made an
 * Energy too) leaves exactly the identity's hand size: no card is discarded down and no unknown card is drawn.
 */
function handOfCards(s: GameState, ...codes: readonly string[]): GameState {
  const size = playerOf(s, P1).identity.form === "alterEgo" ? 6 : 5;
  const wanted = [...codes, ...Array.from({ length: size - 1 - codes.length }, () => ENERGY)];
  const ids = handOf(s).slice(0, wanted.length);
  const relabeled = ids.reduce((acc, id, i) => relabel(acc, id, wanted[i]!), s);
  const top = playerOf(relabeled, P1).deck[0]!;
  return {
    ...relabel(relabeled, top, ENERGY),
    players: relabeled.players.map((p) => (p.playerId === P1 ? { ...p, hand: ids } : p)),
  };
}
/** An ally card turned into `code`, put into play for P1. */
function allyInPlay(s: GameState, code: string, damage = 0): { state: GameState; id: InstanceId } {
  const id = handOf(s)[0]!;
  const relabeled = patchInstance(relabel(s, id, code), id, { faceup: true, controllerId: P1, damage });
  return {
    id,
    state: {
      ...relabeled,
      players: relabeled.players.map((p) =>
        p.playerId === P1 ? { ...p, hand: p.hand.filter((i) => i !== id), playArea: [...p.playArea, id] } : p,
      ),
    },
  };
}

describe("registry", () => {
  it("registers every printed ref of the five cards; nothing is skipped", () => {
    const printed = [RED_ROOM, CROSSBONES, HIT_SQUAD, ARMAMENT, MERCENARY].flatMap((code) => abilityRefIds(data(code)));
    expect([...printed].sort()).toEqual([...REFS].sort());
    expect(Object.keys(REGISTRY).sort()).toEqual([...REFS].sort());
    expect(SKIPPED).toEqual({});
  });
  it.each(REFS)("%s validates", (id) => {
    expect(validateDefinition(REGISTRY[id]!)).toEqual([]);
  });
  it("timing words", () => {
    expect(REGISTRY["54027.obligation"]!.trigger).toMatchObject({ kind: "whenRevealed" });
    expect(REGISTRY["54028.crossbones-forced-response"]!.trigger).toMatchObject({ kind: "response", forced: true });
    expect(REGISTRY[HIT_SQUAD_CONSTANT]!.trigger).toMatchObject({ kind: "constant" });
    expect(REGISTRY["54029.when-defeated"]!.trigger).toMatchObject({ kind: "whenDefeated" });
    expect(REGISTRY["54030.high-tech-armament-forced-response"]!.trigger).toMatchObject({
      kind: "response",
      forced: true,
    });
    expect(REGISTRY[ARMAMENT_ACTION]!.trigger).toMatchObject({ kind: "action", form: "hero" });
  });
  it("High-Tech Armament's Hero Action costs exhausting a character you control", () => {
    expect(REGISTRY[ARMAMENT_ACTION]!.cost).toMatchObject({ exhaustCards: { min: 1, slot: "exhausted" } });
  });
});

describe("the printed cards and setup", () => {
  it("Red Room Programming: an obligation with 2 boost icons in no encounter set", () => {
    expect(data(RED_ROOM)).toMatchObject({ type: "obligation", boostIcons: 2, encounterSetIds: [] });
  });
  it("Crossbones: unique Elite Hydra minion ATK 2 SCH 2 HP 5, 3 boost icons, Quickstrike", () => {
    expect(data(CROSSBONES)).toMatchObject({ type: "minion", atk: 2, sch: 2, hp: 5, boostIcons: 3, unique: true });
    expect(data(CROSSBONES).traits).toEqual(["ELITE", "HYDRA"]);
    expect(data(CROSSBONES).keywords).toEqual([{ name: "quickstrike" }]);
    expect(data(CROSSBONES).nemesisMinion).toBe(true);
  });
  it("Hydra Hit Squad: a side scheme with 3 threat per player, no icons, 3 boost icons", () => {
    expect(data(HIT_SQUAD)).toMatchObject({
      type: "side_scheme",
      startingThreat: { base: 0, perPlayer: 3 },
      boostIcons: 3,
    });
    expect(data(HIT_SQUAD).icons).toEqual([]);
  });
  it("High-Tech Armament: a Tech Weapon attachment, +1 ATK, attaches to Crossbones, else the villain, 2 boost icons", () => {
    expect(data(ARMAMENT)).toMatchObject({
      type: "attachment",
      statModifiers: { atk: 1 },
      boostIcons: 2,
      attachesTo: {
        kind: "ifAble",
        preferred: { kind: "namedCard", name: "Crossbones" },
        otherwise: { kind: "villain" },
      },
    });
    expect(data(ARMAMENT).traits).toEqual(["TECH", "WEAPON"]);
  });
  it("Hydra Mercenary: minion ATK 1 SCH 0 HP 3, 1 boost icon, Guard, two copies", () => {
    expect(data(MERCENARY)).toMatchObject({ type: "minion", atk: 1, sch: 0, hp: 3, boostIcons: 1, quantityInSet: 2 });
    expect(data(MERCENARY).keywords).toEqual([{ name: "guard" }]);
    expect(data(MERCENARY).traits).toEqual(["HYDRA"]);
    expect(data(MERCENARY).abilities).toEqual([]);
  });
  it("the nemesis set is set aside and the obligation is in the encounter deck once", () => {
    const s = wsGame();
    const aside = setAsideCodes(s);
    for (const code of [CROSSBONES, HIT_SQUAD, ARMAMENT]) expect(aside.filter((c) => c === code)).toHaveLength(1);
    expect(aside.filter((c) => c === MERCENARY)).toHaveLength(2);
    expect(aside).not.toContain(RED_ROOM);
    expect(encounterCodes(s, "deck").filter((c) => c === RED_ROOM)).toHaveLength(1);
  });
});

describe("54027.obligation (Red Room Programming)", () => {
  const OPTION = "Discard the highest printed cost card";
  const EXHAUST = "Exhaust Bucky Barnes";
  it("exhaust Bucky Barnes: removed from the game, Bucky exhausted, nothing discarded, no damage", () => {
    const base = handOfCards(wsGame(), HAYMAKER, WIDOW, ENERGY);
    const { state, id } = reveal(base, RED_ROOM, pickLabel(EXHAUST));
    expect(state.removedFromGame).toContain(id);
    expect(encounterCodes(state, "discard")).not.toContain(RED_ROOM);
    expect(inst(state, identityOf(state)).exhausted).toBe(true);
    expect(damageOf(state, identityOf(state))).toBe(0);
    expect(playerOf(state, P1).discard).toHaveLength(0);
  });
  it("the other option discards the highest printed cost card (Black Widow, 3) and takes 3 indirect damage", () => {
    const base = handOfCards(wsGame(), HAYMAKER, WIDOW, ENERGY);
    const [haymaker, widow, energy] = handOf(base);
    const { state, id } = reveal(base, RED_ROOM, pickLabel(OPTION));
    expect(playerOf(state, P1).discard).toEqual([widow]);
    expect(handOf(state)).toEqual(expect.arrayContaining([haymaker!, energy!]));
    expect(damageOf(state, identityOf(state))).toBe(3);
    expect(inst(state, identityOf(state)).exhausted).toBe(false);
    expect(encounterCodes(state, "discard")).toContain(RED_ROOM);
    expect(state.removedFromGame).not.toContain(id);
  });
  it("a cost 2 card as the highest: 2 indirect damage", () => {
    const base = handOfCards(wsGame(), HAYMAKER);
    const { state } = reveal(base, RED_ROOM, pickLabel(OPTION));
    expect(damageOf(state, identityOf(state))).toBe(2);
    expect(playerOf(state, P1).discard.map((i) => codeOf(state, i))).toEqual([HAYMAKER]);
  });
  it("a hand of only resources (printed cost 0): a resource is discarded and no damage is taken", () => {
    const base = handOfCards(wsGame());
    const { state } = reveal(base, RED_ROOM, pickLabel(OPTION));
    expect(playerOf(state, P1).discard).toHaveLength(1);
    expect(damageOf(state, identityOf(state))).toBe(0);
    expect(encounterCodes(state, "discard")).toContain(RED_ROOM);
  });
  it("a tie for the highest printed cost is the player's pick, and only the tied cards are offered", () => {
    const base = handOfCards(wsGame(), WIDOW, HAYMAKER, WIDOW);
    const [first, , second] = handOf(base);
    const offered: string[][] = [];
    const { state } = reveal(
      base,
      RED_ROOM,
      picker((s) => {
        const choice = s.pendingChoice!;
        if (choice.prompt.kind === "chooseCards") {
          offered.push(choice.options.map((o) => o.optionId as string));
          return [second!];
        }
        return pickLabel(OPTION)(s);
      }),
    );
    expect(offered).toHaveLength(1);
    expect([...offered[0]!].sort()).toEqual([first!, second!].sort());
    expect(playerOf(state, P1).discard).toEqual([second]);
    expect(handOf(state)).toContain(first);
    expect(damageOf(state, identityOf(state))).toBe(3);
  });
  it("an empty hand with nothing to draw: nothing is discarded, no damage, and the obligation is still discarded", () => {
    const base = wsGame();
    const empty: GameState = {
      ...base,
      players: base.players.map((p) => (p.playerId === P1 ? { ...p, hand: [], deck: [], discard: [] } : p)),
    };
    const { state } = reveal(empty, RED_ROOM, pickLabel(OPTION));
    expect(handOf(state)).toHaveLength(0);
    expect(damageOf(state, identityOf(state))).toBe(0);
    expect(encounterCodes(state, "discard")).toContain(RED_ROOM);
  });
  it("in hero form the flip to alter-ego form is offered first; flipping makes the exhaust option payable", () => {
    const base = handOfCards(wsHeroGame(), HAYMAKER);
    const labels: string[] = [];
    const { state, id } = reveal(
      base,
      RED_ROOM,
      picker((s) => {
        const choice = s.pendingChoice!;
        labels.push(...choice.options.map((o) => o.label));
        const flip = choice.options.find((o) => o.label.includes("Flip to alter-ego"));
        if (flip) return [flip.optionId];
        const exhaust = choice.options.find((o) => o.label.includes(EXHAUST));
        return exhaust ? [exhaust.optionId] : undefined;
      }),
    );
    expect(labels.some((l) => l.includes("Flip to alter-ego"))).toBe(true);
    expect(state.removedFromGame).toContain(id);
    expect(playerOf(state, P1).identity.form).toBe("alterEgo");
  });
  it("in hero form without flipping, the discard option damages the hero and the exhaust option cannot be taken", () => {
    const base = handOfCards(wsHeroGame(), HAYMAKER);
    const chosen: string[] = [];
    const { state } = reveal(
      base,
      RED_ROOM,
      picker((s) => {
        const choice = s.pendingChoice!;
        const stay = choice.options.find((o) => o.label.includes("Stay in hero form"));
        if (stay) return [stay.optionId];
        const labelled = choice.options.find((o) => o.label.includes(OPTION));
        if (labelled) {
          chosen.push(...choice.options.map((o) => o.label));
          return [labelled.optionId];
        }
        return undefined;
      }),
    );
    // Rhino's own attack this phase (2) and the 2 indirect damage from Haymaker's printed cost.
    expect(damageOf(state, identityOf(state))).toBe(4);
    expect(encounterCodes(state, "discard")).toContain(RED_ROOM);
    expect(chosen.some((l) => l.includes(EXHAUST))).toBe(false);
  });
});

describe("54028 Crossbones", () => {
  it("in play: ATK 2, SCH 2, 5 hit points, Quickstrike", () => {
    const { state, id } = engaged(wsHeroGame(), CROSSBONES);
    expect(stat(state, id, "atk")).toBe(2);
    expect(stat(state, id, "sch")).toBe(2);
    expect(hp(state, id)).toBe(5);
    expect(hasKeyword(state, id, "quickstrike")).toBe(true);
  });

  /**
   * Hero-form P1 with Crossbones engaged and a Black Widow ally (3 hit points) holding `allyDamage`; the ally defends
   * `defendedBy` only, Rhino is stunned (no attack, no boost card), so Crossbones' attack is the only one.
   */
  function villainPhase(allyDamage: number, defendedBy: "crossbones" | "rhino") {
    const { state: withAlly, id: ally } = allyInPlay(wsHeroGame(), WIDOW, allyDamage);
    const { state: staged, id: crossbones } = engaged(withAlly, CROSSBONES);
    const villain = staged.activeVillainId!;
    const live = defendedBy === "crossbones" ? patchStunned(staged, villain) : patchStunned(staged, crossbones);
    const result = run(
      live,
      (s) => {
        const prompt = s.pendingChoice!.prompt;
        if (prompt.kind === "declareDefender") {
          const attacker = defendedBy === "crossbones" ? crossbones : villain;
          return prompt.attack.enemyInstanceId === attacker && s.pendingChoice!.options.some((o) => o.optionId === ally)
            ? [ally]
            : ["decline"];
        }
        return firstLegal(s);
      },
      ...endPhase(live),
    );
    return { ...result, ally };
  }
  const patchStunned = (s: GameState, id: InstanceId): GameState =>
    patchInstance(s, id, { statuses: { ...inst(s, id).statuses, stunned: 1 } });

  it("his attack defeats an ally (1 hit point left): 2 threat on the main scheme", () => {
    const defeated = villainPhase(2, "crossbones");
    const survived = villainPhase(0, "crossbones");
    expect(ofType(defeated.events, "characterDefeated").some((e) => e.instanceId === defeated.ally)).toBe(true);
    expect(ofType(survived.events, "characterDefeated").some((e) => e.instanceId === survived.ally)).toBe(false);
    expect(mainThreat(defeated.state) - mainThreat(survived.state)).toBe(2);
  });
  it("his attack does not defeat the ally (3 hit points, ATK 2): it takes 2 and no threat is placed", () => {
    const { state, ally, events } = villainPhase(0, "crossbones");
    expect(damageOf(state, ally)).toBe(2);
    expect(ofType(events, "threatPlaced").filter((e) => e.amount === 2)).toHaveLength(0);
  });
  it("an ally defeated by another enemy's attack (Rhino) is not his response", () => {
    const viaRhino = villainPhase(2, "rhino");
    expect(ofType(viaRhino.events, "characterDefeated").some((e) => e.instanceId === viaRhino.ally)).toBe(true);
    const control = villainPhase(0, "rhino");
    expect(mainThreat(viaRhino.state)).toBe(mainThreat(control.state));
  });
});

describe("54029 Hydra Hit Squad", () => {
  it("revealed: 3 threat for one player; 6 for two", () => {
    const one = reveal(wsGame(), HIT_SQUAD);
    expect(inst(one.state, one.id).threat).toBe(3);
    const two = reveal(wsGame({ twoPlayers: true }), HIT_SQUAD, picker(), { before: 2 });
    expect(inst(two.state, two.id).threat).toBe(6);
  });
  it("every Hydra minion gets +1 ATK and +2 hit points: Crossbones 3 and 7, Mercenary 2 and 5, Core's Mercenary too", () => {
    const { state: a, id: crossbones } = engaged(wsHeroGame(), CROSSBONES);
    const { state: b, id: mercenary } = engaged(a, MERCENARY);
    const { state: c, id: core } = engaged(b, CORE_HYDRA);
    expect([stat(c, crossbones, "atk"), hp(c, crossbones)]).toEqual([2, 5]);
    expect([stat(c, mercenary, "atk"), hp(c, mercenary)]).toEqual([1, 3]);
    expect([stat(c, core, "atk"), hp(c, core)]).toEqual([1, 3]);
    const { state: squad } = sideScheme(c, HIT_SQUAD, 3);
    expect([stat(squad, crossbones, "atk"), hp(squad, crossbones)]).toEqual([3, 7]);
    expect([stat(squad, mercenary, "atk"), hp(squad, mercenary)]).toEqual([2, 5]);
    expect([stat(squad, core, "atk"), hp(squad, core)]).toEqual([2, 5]);
  });
  it("a minion without the Hydra trait is unchanged", () => {
    const { state: staged, id } = engaged(wsHeroGame(), CORE_HYDRA);
    const sand = relabel(staged, id, SANDMAN);
    const base = [stat(sand, id, "atk"), hp(sand, id)];
    const { state: squad } = sideScheme(sand, HIT_SQUAD, 3);
    expect([stat(squad, id, "atk"), hp(squad, id)]).toEqual(base);
  });

  /** A Hit Squad with 2 threat, the encounter deck holding no other Hydra minion, and `top` (a Core Hydra Mercenary) in `zone`. */
  function defeatWithHydraIn(zone: "deck" | "discard" | "none") {
    const { state: staged, id: scheme } = sideScheme(wsHeroGame(), HIT_SQUAD, 2);
    const deckId = activeEncounterDeckId(staged);
    const pile = staged.encounterDecks[deckId]!;
    const cleared = [...pile.deck, ...pile.discard].reduce(
      (acc, id) => (codeOf(acc, id) === CORE_HYDRA ? relabel(acc, id, FILLER) : acc),
      staged,
    );
    const card = pile.deck[0]!;
    const placed =
      zone === "none"
        ? cleared
        : relabel(
            zone === "deck"
              ? cleared
              : {
                  ...cleared,
                  encounterDecks: {
                    ...cleared.encounterDecks,
                    [deckId]: { deck: pile.deck.slice(1), discard: [card, ...pile.discard] },
                  },
                },
            card,
            CORE_HYDRA,
          );
    const result = run(placed, picker(), {
      type: "basicThwart",
      playerId: P1,
      thwarterInstanceId: identityOf(placed),
      schemeInstanceId: scheme,
    });
    return { ...result, scheme, card, before: placed };
  }
  it("When Defeated: the defeating player finds a Hydra minion in the encounter deck and reveals it, engaged with them", () => {
    const { state, events, scheme, card } = defeatWithHydraIn("deck");
    expect(cardsInPlay(state)).not.toContain(scheme);
    expect(inPlayIds(state, CORE_HYDRA)).toEqual([card]);
    expect(inst(state, card).engagedWith).toBe(P1);
    expect(ofType(events, "encounterCardRevealed").some((e) => e.instanceId === card)).toBe(true);
  });
  it("When Defeated with the Hydra minion only in the encounter discard pile: found there", () => {
    const { state, card } = defeatWithHydraIn("discard");
    expect(inPlayIds(state, CORE_HYDRA)).toEqual([card]);
    expect(inst(state, card).engagedWith).toBe(P1);
  });
  it("When Defeated with no Hydra minion to find: nothing is revealed and the scheme is still defeated", () => {
    const { state, events, scheme } = defeatWithHydraIn("none");
    expect(cardsInPlay(state)).not.toContain(scheme);
    expect(ofType(events, "encounterCardRevealed")).toHaveLength(0);
    expect(inPlayIds(state, CORE_HYDRA)).toHaveLength(0);
  });
});

describe("54030 High-Tech Armament", () => {
  it("revealed with Crossbones in play: attached to Crossbones (ATK 2 to 3), who then attacks the hero for 3", () => {
    const { state: staged, id: crossbones } = engaged(wsHeroGame(), CROSSBONES);
    const { state, events, id } = reveal(allStunned(staged), ARMAMENT, picker(), { before: 0, after: 1 });
    expect(inst(state, id).attachedTo).toBe(crossbones);
    expect(stat(state, crossbones, "atk")).toBe(3);
    const hits = ofType(events, "damageDealt").filter(
      (e) => e.targetInstanceId === identityOf(state) && e.sourceInstanceId === crossbones,
    );
    expect(hits.map((e) => e.amount)).toEqual([3]);
  });
  it("revealed to an alter-ego player: Crossbones schemes against them (SCH 2: 2 more threat than without the card)", () => {
    const { state: staged, id: crossbones } = engaged(wsGame(), CROSSBONES);
    const stunned = allStunned(staged);
    const { state, events, id } = reveal(stunned, ARMAMENT, picker(), { before: 0, after: 1 });
    expect(inst(state, id).attachedTo).toBe(crossbones);
    const placed = ofType(events, "threatPlaced").filter((e) => e.sourceInstanceId === crossbones);
    expect(placed.map((e) => e.amount)).toEqual([2]);
  });
  it("revealed with Crossbones out of play: attached to the villain, who activates against you (Rhino ATK 3 + 0 boost)", () => {
    const { state, events, id } = reveal(wsHeroGame(), ARMAMENT, picker(), { before: 1, after: 1 });
    const rhino = state.activeVillainId!;
    expect(inst(state, id).attachedTo).toBe(rhino);
    expect(stat(state, rhino, "atk")).toBe(3);
    const hits = ofType(events, "damageDealt").filter(
      (e) => e.targetInstanceId === identityOf(state) && e.sourceInstanceId === rhino,
    );
    expect(hits.map((e) => e.amount)).toEqual([2, 3]);
  });
  it("Hero Action: exhaust a character you control to discard it (the identity pays here)", () => {
    const base = wsHeroGame();
    const { state: revealed, id } = reveal(base, ARMAMENT, picker(), { before: 1, after: 1 });
    const ready = patchInstance(revealed, identityOf(revealed), { exhausted: false, damage: 0 });
    expect(stat(ready, ready.activeVillainId!, "atk")).toBe(3);
    const { state } = run(ready, picker(), use(P1, id, ARMAMENT_ACTION, [], { exhausted: [identityOf(ready)] }));
    expect(inst(state, identityOf(state)).exhausted).toBe(true);
    expect(cardsInPlay(state)).not.toContain(id);
    expect(encounterCodes(state, "discard")).toContain(ARMAMENT);
    expect(stat(state, state.activeVillainId!, "atk")).toBe(2);
  });
  it.todo(
    "with Fixer 53038 in play (engine task 35, docs/phase7-wave9.md section 3.49): revealed with Crossbones out of play it attaches to Fixer, not the villain, and 'that enemy activates against you' is Fixer's activation; with Crossbones in play it attaches to Crossbones as printed (an attachment naming its host first never reaches Fixer's interrupt)",
  );
});

describe("54031 Hydra Mercenary", () => {
  it("in play engaged with you: ATK 1, 3 hit points, Guard (the hero cannot attack the villain)", () => {
    const { state, id } = engaged(wsHeroGame(), MERCENARY);
    expect(stat(state, id, "atk")).toBe(1);
    expect(hp(state, id)).toBe(3);
    expect(hasKeyword(state, id, "guard")).toBe(true);
    const attack: Command = {
      type: "basicAttack",
      playerId: P1,
      attackerInstanceId: identityOf(state),
      targetInstanceId: state.activeVillainId!,
    };
    expect(applyCommand(state, attack, WS_DEPS).ok).toBe(false);
  });
  it("attacking the Mercenary itself is allowed: 2 damage from the hero's ATK 2", () => {
    const { state: staged, id } = engaged(wsHeroGame(), MERCENARY);
    const { state } = run(staged, picker(), {
      type: "basicAttack",
      playerId: P1,
      attackerInstanceId: identityOf(staged),
      targetInstanceId: id,
    });
    expect(damageOf(state, id)).toBe(2);
  });
});
